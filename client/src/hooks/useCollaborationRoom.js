import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { useCollaborationSessionCache } from './collaborationSessionCache';

export function getCollaborationUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const configuredUrl = import.meta.env.VITE_COLLABORATION_URL;
  if (configuredUrl) return configuredUrl;
  return `${protocol}//${window.location.host}/collaboration`;
}

export function getCollaborationColor(seed = '') {
  const colors = ['#4cc9f0', '#f72585', '#ffd166', '#06d6a0', '#b5179e', '#f77f00', '#8ecae6', '#e63946'];
  const value = String(seed || 'mysthra').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[value % colors.length];
}

export function getCollaborationUser(currentUser, isVisitor = false) {
  const name = currentUser?.username || (isVisitor ? 'Visitor' : 'Mysthra user');
  const id = currentUser?.userId || (isVisitor ? 'visitor' : name);
  return {
    id,
    name,
    color: getCollaborationColor(id)
  };
}

export function useCollaborationRoom({
  roomName = '',
  currentUser = null,
  isVisitor = false,
  locked = false,
  onStateless,
  sessionCache = false
}) {
  const cache = useCollaborationSessionCache();
  const identity = useMemo(
    () => currentUser || (isVisitor ? { userId: 'visitor', username: 'Visitor' } : null),
    [currentUser, isVisitor]
  );
  const user = useMemo(() => getCollaborationUser(identity, isVisitor), [identity, isVisitor]);
  const onStatelessRef = useRef(onStateless);
  const [connectionState, setConnectionState] = useState({
    status: roomName && identity ? 'connecting' : 'disabled',
    readOnly: false,
    authenticated: false,
    synced: false,
    saveStatus: roomName && identity ? 'saving' : 'saved',
    dirty: Boolean(roomName && identity)
  });
  const [awarenessStates, setAwarenessStates] = useState([]);
  const [collaboration, setCollaboration] = useState(null);

  useEffect(() => {
    onStatelessRef.current = onStateless;
  }, [onStateless]);

  useEffect(() => {
    if (!roomName || !identity) {
      setCollaboration(null);
      setConnectionState({
        status: 'disabled',
        readOnly: false,
        authenticated: false,
        synced: false,
        saveStatus: 'saved',
        dirty: false
      });
      setAwarenessStates([]);
      return undefined;
    }

    const cachedEntry = sessionCache && cache ? cache.acquire(roomName, user) : null;
    const doc = cachedEntry?.doc || new Y.Doc();
    const provider = cachedEntry?.provider || new HocuspocusProvider({
      url: getCollaborationUrl(), name: roomName, document: doc
    });
    const getStates = () => Array.from(provider.awareness?.getStates?.().entries?.() || [])
      .map(([clientId, state]) => ({ clientId, ...state }));
    const updateAwareness = ({ states } = {}) => {
      const nextStates = states
        ? states.map((state, index) => ({ clientId: state.clientId ?? index, ...state }))
        : getStates();
      setAwarenessStates(nextStates);
    };
    const setSaving = () => {
      setConnectionState(prev => ({
        ...prev,
        saveStatus: 'saving',
        dirty: true,
        synced: false
      }));
    };
    const setSaved = () => {
      setConnectionState(prev => ({
        ...prev,
        saveStatus: 'saved',
        dirty: false,
        synced: true
      }));
    };
    const setError = () => {
      setConnectionState(prev => ({
        ...prev,
        status: 'error',
        saveStatus: 'error',
        dirty: true,
        synced: false
      }));
    };
    const handleStatus = ({ status }) => {
      setConnectionState(prev => ({
        ...prev,
        status,
        saveStatus: status === 'disconnected' ? 'error' : prev.saveStatus,
        dirty: status === 'disconnected' ? true : prev.dirty
      }));
    };
    const handleAuthenticated = ({ scope }) => {
      const readOnly = scope === 'readonly';
      setConnectionState(prev => ({
        ...prev,
        status: readOnly ? 'readonly' : 'connected',
        readOnly,
        authenticated: true
      }));
    };
    const handleUnsyncedChanges = ({ number }) => {
      if (number > 0) {
        setSaving();
        return;
      }
      setSaved();
    };
    const handleSynced = () => setSaved();
    const handleStateless = ({ payload }) => onStatelessRef.current?.({ payload });

    setConnectionState(cachedEntry?.state || {
      status: 'connecting',
      readOnly: false,
      authenticated: false,
      synced: false,
      saveStatus: 'saving',
      dirty: true,
      hydrated: false
    });
    setCollaboration({ doc, provider });
    provider.awareness.setLocalStateField('user', user);
    provider.on('status', handleStatus);
    provider.on('authenticated', handleAuthenticated);
    provider.on('authenticationFailed', setError);
    provider.on('unsyncedChanges', handleUnsyncedChanges);
    provider.on('synced', handleSynced);
    provider.on('awarenessChange', updateAwareness);
    provider.on('stateless', handleStateless);
    const handleCachedState = state => {
      setConnectionState(state);
      setAwarenessStates(state.awarenessStates || []);
    };
    if (cachedEntry) {
      cachedEntry.listeners.add(handleCachedState);
    }
    updateAwareness();

    return () => {
      provider.off('status', handleStatus);
      provider.off('authenticated', handleAuthenticated);
      provider.off('authenticationFailed', setError);
      provider.off('unsyncedChanges', handleUnsyncedChanges);
      provider.off('synced', handleSynced);
      provider.off('awarenessChange', updateAwareness);
      provider.off('stateless', handleStateless);
      if (cachedEntry) {
        cachedEntry.listeners.delete(handleCachedState);
        cache.release(roomName);
      } else {
        provider.destroy();
        doc.destroy();
      }
    };
  }, [cache, identity, roomName, sessionCache, user]);

  const setAwarenessField = useCallback((key, value) => {
    collaboration?.provider.awareness?.setLocalStateField(key, value);
  }, [collaboration]);

  const localClientId = collaboration?.provider.awareness?.clientID;
  const remoteUsers = useMemo(() => awarenessStates
    .filter(state => state.clientId !== localClientId)
    .map(state => ({
      clientId: state.clientId,
      ...(state.user || {}),
      ...(state.map || {}),
      location: state.location,
      visitor: state.visitor
    }))
    .filter(remoteUser => remoteUser.name), [awarenessStates, localClientId]);

  return {
    doc: collaboration?.doc || null,
    provider: collaboration?.provider || null,
    user,
    status: connectionState.status,
    readOnly: Boolean(locked || connectionState.readOnly),
    authenticated: connectionState.authenticated,
    synced: connectionState.synced,
    hydrated: Boolean(connectionState.hydrated || connectionState.synced),
    saveStatus: connectionState.saveStatus,
    dirty: connectionState.dirty,
    awarenessStates,
    remoteUsers,
    setAwarenessField
  };
}

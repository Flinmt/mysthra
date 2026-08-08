/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo } from 'react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

const CollaborationSessionCacheContext = createContext(null)

export function createCollaborationSessionCache({
  url,
  limit = 8,
  providerFactory = options => new HocuspocusProvider(options)
}) {
  const entries = new Map()
  let usage = 0

  const notify = (entry) => entry.listeners.forEach(listener => listener(entry.state))
  const update = (entry, patch) => {
    entry.state = { ...entry.state, ...patch }
    notify(entry)
  }

  const destroyEntry = (entry) => {
    entry.provider.destroy()
    entry.doc.destroy()
    entries.delete(entry.roomName)
  }

  const suspend = (entry) => {
    if (entry.activeCount > 0 || entry.state.dirty || entry.suspended) return
    entry.suspended = true
    entry.provider.disconnect?.()
    update(entry, { status: 'disconnected', authenticated: false, synced: false })
  }

  const prune = () => {
    if (entries.size <= limit) return
    const candidates = [...entries.values()]
      .filter(entry => entry.activeCount === 0 && !entry.state.dirty)
      .sort((left, right) => left.lastUsed - right.lastUsed)
    while (entries.size > limit && candidates.length > 0) destroyEntry(candidates.shift())
  }

  const createEntry = (roomName) => {
    const doc = new Y.Doc()
    const provider = providerFactory({ url, name: roomName, document: doc })
    const entry = {
      roomName,
      doc,
      provider,
      activeCount: 0,
      suspended: false,
      lastUsed: ++usage,
      listeners: new Set(),
      state: {
        status: 'connecting',
        readOnly: false,
        authenticated: false,
        synced: false,
        hydrated: false,
        saveStatus: 'saving',
        dirty: true,
        awarenessStates: []
      }
    }

    const awarenessStates = ({ states } = {}) => states
      ? states.map((state, index) => ({ clientId: state.clientId ?? index, ...state }))
      : Array.from(provider.awareness?.getStates?.().entries?.() || [])
        .map(([clientId, state]) => ({ clientId, ...state }))

    provider.on('status', ({ status }) => update(entry, {
      status,
      saveStatus: status === 'disconnected' && !entry.suspended ? 'error' : entry.state.saveStatus,
      dirty: status === 'disconnected' && !entry.suspended ? true : entry.state.dirty,
      synced: status === 'disconnected' ? false : entry.state.synced
    }))
    provider.on('authenticated', ({ scope }) => update(entry, {
      status: scope === 'readonly' ? 'readonly' : 'connected',
      readOnly: scope === 'readonly',
      authenticated: true
    }))
    provider.on('authenticationFailed', () => update(entry, {
      status: 'error', saveStatus: 'error', dirty: true, synced: false
    }))
    provider.on('unsyncedChanges', ({ number }) => {
      if (number > 0) update(entry, { saveStatus: 'saving', dirty: true, synced: false })
      else {
        update(entry, { saveStatus: 'saved', dirty: false, synced: true, hydrated: true })
        suspend(entry)
        prune()
      }
    })
    provider.on('synced', () => {
      update(entry, { saveStatus: 'saved', dirty: false, synced: true, hydrated: true })
      suspend(entry)
      prune()
    })
    provider.on('awarenessChange', payload => update(entry, { awarenessStates: awarenessStates(payload) }))
    entry.state.awarenessStates = awarenessStates()
    return entry
  }

  const getEntry = roomName => {
    let entry = entries.get(roomName)
    if (!entry) {
      entry = createEntry(roomName)
      entries.set(roomName, entry)
    }
    entry.lastUsed = ++usage
    return entry
  }

  return {
    acquire(roomName, user) {
      const entry = getEntry(roomName)
      entry.activeCount += 1
      entry.lastUsed = ++usage
      if (entry.suspended) {
        entry.suspended = false
        update(entry, { status: 'connecting', authenticated: false, synced: false })
        entry.provider.connect?.()
      }
      entry.provider.awareness.setLocalStateField('user', user)
      prune()
      return entry
    },
    release(roomName) {
      const entry = entries.get(roomName)
      if (!entry) return
      entry.activeCount = Math.max(0, entry.activeCount - 1)
      entry.lastUsed = ++usage
      if (entry.activeCount === 0) entry.provider.awareness.setLocalState(null)
      suspend(entry)
      prune()
    },
    hasHydrated(roomName) {
      return Boolean(entries.get(roomName)?.state.hydrated)
    },
    invalidate(roomName) {
      const entry = entries.get(roomName)
      if (entry) destroyEntry(entry)
    },
    destroy() {
      ;[...entries.values()].forEach(destroyEntry)
    }
  }
}

export function CollaborationSessionCacheProvider({ cacheKey, url, limit = 8, children }) {
  const cache = useMemo(() => {
    void cacheKey
    return createCollaborationSessionCache({ url, limit })
  }, [cacheKey, limit, url])
  useEffect(() => () => cache.destroy(), [cache])
  return <CollaborationSessionCacheContext.Provider value={cache}>{children}</CollaborationSessionCacheContext.Provider>
}

export function useCollaborationSessionCache() {
  return useContext(CollaborationSessionCacheContext)
}

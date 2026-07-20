import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { useCollaborationRoom } from '../../hooks/useCollaborationRoom'

const MIGRATION_VERSION = 1

function bytesToBase64(bytes) {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return window.btoa(value)
}

function base64ToBytes(value = '') {
  const decoded = window.atob(value)
  return Uint8Array.from(decoded, char => char.charCodeAt(0))
}

function byteArraysEqual(left, right) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

export function isPersistedStateVector(document, encodedStateVector) {
  if (!document || !encodedStateVector) return false
  try {
    return byteArraysEqual(Y.encodeStateVector(document), base64ToBytes(encodedStateVector))
  } catch {
    return false
  }
}

export async function hashLegacyContent(content = '') {
  const bytes = new TextEncoder().encode(String(content))
  if (window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function encodeNotionMigrationUpdate(update) {
  return bytesToBase64(update)
}

export function useNotionDocument({
  roomName,
  currentUser,
  isVisitor = false,
  locked = false
}) {
  const documentRef = useRef(null)
  const providerRef = useRef(null)
  const initialSyncRef = useRef(false)
  const changedBeforeInitialSyncRef = useRef(false)
  const migrationRequestRef = useRef('')
  const [persistenceStatus, setPersistenceStatus] = useState('pending')
  const [migrationStatus, setMigrationStatus] = useState('idle')
  const [hasSharedContent, setHasSharedContent] = useState(false)

  const handleStateless = useCallback(({ payload }) => {
    let message
    try {
      message = typeof payload === 'string' ? JSON.parse(payload) : payload
    } catch {
      return
    }

    if (message?.type === 'document-persisted') {
      if (isPersistedStateVector(documentRef.current, message.stateVector)) {
        setPersistenceStatus('persisted')
      }
      return
    }
    if (message?.type === 'document-persistence-error') {
      setPersistenceStatus('error')
      return
    }
    if (message?.type !== 'notion:migration-result' || message.requestId !== migrationRequestRef.current) return

    if (message.status === 'accepted') {
      setMigrationStatus('migrating')
    } else if (message.status === 'already-migrated') {
      setMigrationStatus('completed')
    } else {
      setMigrationStatus('error')
    }
  }, [])

  const collaboration = useCollaborationRoom({
    roomName,
    currentUser,
    isVisitor,
    locked,
    onStateless: handleStateless
  })
  const { doc, provider, synced, status, readOnly } = collaboration
  const fragment = useMemo(() => doc?.getXmlFragment('blocknote') || null, [doc])

  useEffect(() => {
    documentRef.current = doc
    providerRef.current = provider
  }, [doc, provider])

  useEffect(() => {
    initialSyncRef.current = false
    changedBeforeInitialSyncRef.current = false
    migrationRequestRef.current = ''
    setPersistenceStatus(roomName ? 'pending' : 'persisted')
    setMigrationStatus('idle')
    setHasSharedContent(false)
  }, [roomName])

  useEffect(() => {
    if (!fragment) {
      setHasSharedContent(false)
      return undefined
    }
    const updateSharedContent = () => {
      const nextHasContent = fragment.length > 0
      setHasSharedContent(nextHasContent)
      if (nextHasContent) setMigrationStatus(current => current === 'error' ? current : 'completed')
    }
    fragment.observeDeep(updateSharedContent)
    updateSharedContent()
    return () => fragment.unobserveDeep(updateSharedContent)
  }, [fragment])

  useEffect(() => {
    if (!doc) return undefined
    const handleUpdate = (_update, origin) => {
      if (!initialSyncRef.current) {
        if (origin !== provider) changedBeforeInitialSyncRef.current = true
        return
      }
      setPersistenceStatus('persisting')
    }
    doc.on('update', handleUpdate)
    return () => doc.off('update', handleUpdate)
  }, [doc, provider])

  useEffect(() => {
    if (!doc || !synced || initialSyncRef.current) return
    initialSyncRef.current = true
    setPersistenceStatus(changedBeforeInitialSyncRef.current ? 'persisting' : 'persisted')
  }, [doc, synced])

  const requestMigration = useCallback(async (update, legacyContent) => {
    const activeProvider = providerRef.current
    if (!activeProvider || readOnly || !update?.length || !String(legacyContent || '').trim()) return false

    const requestId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    migrationRequestRef.current = requestId
    setMigrationStatus('migrating')
    setPersistenceStatus('persisting')
    try {
      activeProvider.sendStateless(JSON.stringify({
        type: 'notion:migrate',
        version: MIGRATION_VERSION,
        requestId,
        sourceHash: await hashLegacyContent(legacyContent),
        update: encodeNotionMigrationUpdate(update)
      }))
      return true
    } catch {
      setMigrationStatus('error')
      return false
    }
  }, [readOnly])

  const connectionStatus = readOnly
    ? 'readonly'
    : status === 'connected'
      ? 'online'
      : status === 'disconnected'
        ? 'offline'
        : status === 'error'
          ? 'error'
          : 'connecting'
  const saveStatus = connectionStatus === 'offline'
    ? 'offline'
    : connectionStatus === 'error' || persistenceStatus === 'error'
      ? 'error'
      : readOnly
        ? 'readonly'
        : persistenceStatus === 'persisted'
          ? 'saved'
          : 'saving'

  return {
    ...collaboration,
    fragment,
    hasSharedContent,
    connectionStatus,
    persistenceStatus,
    migrationStatus,
    saveStatus,
    dirty: persistenceStatus !== 'persisted',
    requestMigration
  }
}

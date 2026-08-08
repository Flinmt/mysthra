import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollaborationRoom } from '../../hooks/useCollaborationRoom'

export function useTiptapDocument({ roomName, currentUser, isVisitor = false, locked = false }) {
  const documentRef = useRef(null)
  const [status, setStatus] = useState('pending')
  const collaboration = useCollaborationRoom({ roomName, currentUser, isVisitor, locked, sessionCache: true })
  const { doc, provider, synced, hydrated, readOnly, saveStatus, dirty, user, awarenessStates, setAwarenessField } = collaboration

  useEffect(() => {
    documentRef.current = doc
    if (!roomName) setStatus('saved')
    else if (synced) setStatus('saved')
    else if (saveStatus === 'error') setStatus('error')
    else setStatus('syncing')
  }, [doc, roomName, saveStatus, synced])

  const fragment = useMemo(() => doc?.getXmlFragment('tiptap') || null, [doc])
  const onUpdate = useCallback(() => {
    if (documentRef.current) setStatus('syncing')
  }, [])

  return {
    doc,
    provider,
    fragment,
    user,
    readOnly,
    synced,
    hydrated,
    saveStatus: status,
    dirty,
    awarenessStates,
    setAwarenessField,
    onUpdate
  }
}

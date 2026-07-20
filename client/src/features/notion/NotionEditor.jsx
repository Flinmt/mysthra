import { useEffect, useMemo } from 'react'
import { useNotionDocument } from './useNotionDocument'
import NotionSurface from './NotionSurface'

export default function NotionEditor({
  content,
  contentKey,
  editable,
  locked,
  collaborationRoom,
  currentUser,
  isVisitor = false,
  onVisitorCountChange,
  onCollaborationSaveState,
  ...surfaceProps
}) {
  const notionDocument = useNotionDocument({
    roomName: collaborationRoom,
    currentUser,
    isVisitor,
    locked
  })
  const {
    doc,
    provider,
    fragment,
    user,
    readOnly,
    synced,
    saveStatus,
    dirty,
    hasSharedContent,
    requestMigration,
    awarenessStates,
    setAwarenessField
  } = notionDocument
  const useLegacyFallback = Boolean(
    synced
    && readOnly
    && !hasSharedContent
    && String(content || '').trim()
  )
  const collaborationState = useMemo(() => {
    if (useLegacyFallback || !fragment || !doc || !provider) return null
    return { doc, provider, fragment }
  }, [doc, fragment, provider, useLegacyFallback])

  useEffect(() => {
    if (!provider) {
      onVisitorCountChange?.(0)
      onCollaborationSaveState?.({ status: 'saved', dirty: false })
      return
    }
    if (isVisitor) setAwarenessField('visitor', { viewing: true })
    const visitorCount = awarenessStates.filter(state => state?.visitor?.viewing).length
    onVisitorCountChange?.(visitorCount)
    onCollaborationSaveState?.({ status: saveStatus, dirty })
  }, [
    awarenessStates,
    dirty,
    isVisitor,
    onCollaborationSaveState,
    onVisitorCountChange,
    provider,
    saveStatus,
    setAwarenessField
  ])

  return (
    <NotionSurface
      key={`${contentKey}:${useLegacyFallback ? 'legacy' : 'shared'}`}
      {...surfaceProps}
      content={content}
      contentKey={contentKey}
      editable={editable}
      collaborationState={collaborationState}
      collaborationUser={user}
      collaborationReadOnly={Boolean(locked || readOnly)}
      collaborationSynced={synced}
      requestMigration={requestMigration}
    />
  )
}

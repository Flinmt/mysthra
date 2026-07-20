import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BlockNoteView } from '@blocknote/mantine'
import {
  FormattingToolbarController,
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote
} from '@blocknote/react'
import { multiColumnDropCursor } from '@blocknote/xl-multi-column'
import { useTranslation } from 'react-i18next'
import '@blocknote/mantine/style.css'
import WorkspaceInsertSearch from '../../workspace/WorkspaceInsertSearch'
import { isInternalPageLink } from '../../workspace/utils'
import { getNotionSlashMenuItems } from './notionCommands'
import { createNotionMigrationUpdate, parseNotionContent, resolveNotionBlocks } from './notionContent'
import { NOTION_EDITING_OPTIONS } from './notionEditing'
import { getNotionDictionary, isAllowedNotionLink, NOTION_SCHEMA } from './notionSchema'
import { NotionFormattingToolbar, NotionSideMenu } from './notionTools'
import { uploadNotionImage, useNotionAssets } from './useNotionAssets'

export default function NotionSurface({
  content,
  contentKey,
  editable,
  worldId,
  collaborationState,
  collaborationUser,
  collaborationReadOnly,
  collaborationSynced,
  requestMigration,
  getAssetUrl,
  onRequestAssets,
  labels,
  documentTree = [],
  assetTree = [],
  onNavigateToPageLink,
  onChange
}) {
  const { i18n } = useTranslation()
  const canEdit = editable && !collaborationReadOnly
  const [insertSearch, setInsertSearch] = useState({ isOpen: false, x: 0, y: 0, mode: 'all', selectedText: '' })
  const onNavigateToPageLinkRef = useRef(onNavigateToPageLink)
  const onChangeRef = useRef(onChange)
  const emitFrameRef = useRef(null)
  const isLoadingRef = useRef(true)
  const legacyMigrationRef = useRef('')
  const dictionary = useMemo(() => getNotionDictionary(i18n.language, {
    emptyDocument: labels.emptyPlaceholder,
    default: labels.blockPlaceholder
  }), [i18n.language, labels.blockPlaceholder, labels.emptyPlaceholder])
  const commandMenuLabels = useMemo(() => ({
    commandGroupText: labels.commandGroupText,
    commandGroupLists: labels.commandGroupLists,
    commandGroupStructure: labels.commandGroupStructure,
    commandGroupMedia: labels.commandGroupMedia
  }), [
    labels.commandGroupLists,
    labels.commandGroupMedia,
    labels.commandGroupStructure,
    labels.commandGroupText
  ])
  const initialBlocks = useMemo(() => collaborationState ? null : parseNotionContent(content), [collaborationState, content])

  useEffect(() => {
    onNavigateToPageLinkRef.current = onNavigateToPageLink
  }, [onNavigateToPageLink])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useCreateBlockNote(
    {
      ...NOTION_EDITING_OPTIONS,
      schema: NOTION_SCHEMA,
      dictionary,
      dropCursor: multiColumnDropCursor,
      ...(collaborationState
        ? {
          collaboration: {
            fragment: collaborationState.fragment,
            user: collaborationUser,
            provider: collaborationState.provider,
            showCursorLabels: 'activity'
          }
        }
        : initialBlocks ? { initialContent: initialBlocks } : {}),
      links: {
        isValidLink: isAllowedNotionLink,
        onClick: (event) => {
          const href = event.target?.closest?.('a')?.getAttribute('href') || ''
          if (!isInternalPageLink(href)) return false
          event.preventDefault()
          onNavigateToPageLinkRef.current?.(href)
          return true
        }
      },
      ...(canEdit ? {
        uploadFile: async (file) => {
          const uploaded = await uploadNotionImage({ file, worldId, getAssetUrl, onRequestAssets })
          return uploaded.url
        }
      } : {})
    },
    [canEdit, contentKey, collaborationState?.provider, dictionary]
  )
  const { insertImage, onDragOver, onDrop } = useNotionAssets({
    editor,
    editable: canEdit,
    worldId,
    getAssetUrl,
    onRequestAssets
  })

  const insertPageLink = useCallback(({ href, label }) => {
    if (!href) return
    editor.createLink(href, label || labels.pageLink || 'Page link')
    editor.focus()
  }, [editor, labels.pageLink])
  const getSlashMenuItems = useCallback(
    query => getNotionSlashMenuItems(editor, dictionary, commandMenuLabels, query),
    [commandMenuLabels, dictionary, editor]
  )
  const emitEditorDocument = useCallback(() => {
    if (collaborationState || isLoadingRef.current || !canEdit) return
    if (emitFrameRef.current) window.cancelAnimationFrame(emitFrameRef.current)
    emitFrameRef.current = window.requestAnimationFrame(() => {
      emitFrameRef.current = null
      onChangeRef.current?.(JSON.stringify(editor.document))
    })
  }, [canEdit, collaborationState, editor])

  useEffect(() => () => {
    if (emitFrameRef.current) window.cancelAnimationFrame(emitFrameRef.current)
  }, [])

  useEffect(() => {
    let isCancelled = false
    const loadLegacyContent = async () => {
      if (collaborationState) {
        isLoadingRef.current = false
        return
      }
      const source = content || ''
      if (parseNotionContent(source) || !source.trim()) {
        isLoadingRef.current = false
        return
      }
      try {
        const blocks = await resolveNotionBlocks(editor, source)
        if (isCancelled) return
        editor.replaceBlocks(editor.document, blocks)
        isLoadingRef.current = false
        emitEditorDocument()
      } catch {
        isLoadingRef.current = false
      }
    }
    loadLegacyContent()
    return () => { isCancelled = true }
  }, [collaborationState, content, contentKey, editor, emitEditorDocument])

  useEffect(() => {
    if (!collaborationState || !collaborationSynced || collaborationReadOnly) return
    if (legacyMigrationRef.current === contentKey || collaborationState.fragment.length > 0) return
    const source = content || ''
    if (!source.trim()) return

    let isCancelled = false
    const migrateLegacyContent = async () => {
      try {
        const blocks = await resolveNotionBlocks(editor, source)
        if (isCancelled || blocks.length === 0 || collaborationState.fragment.length > 0) return
        const update = createNotionMigrationUpdate(editor, blocks)
        if (await requestMigration(update, source)) legacyMigrationRef.current = contentKey
      } catch {
        // A reconnect or a later render can retry a migration that failed locally.
      }
    }
    migrateLegacyContent()
    return () => { isCancelled = true }
  }, [
    collaborationReadOnly,
    collaborationState,
    collaborationSynced,
    content,
    contentKey,
    editor,
    requestMigration
  ])

  return (
    <div
      className="notion-editor"
      onContextMenu={async (event) => {
        if (!canEdit) return
        event.preventDefault()
        await onRequestAssets?.()
        setInsertSearch({
          isOpen: true,
          x: event.clientX,
          y: event.clientY,
          mode: 'all',
          selectedText: editor.getSelectedText?.().trim() || ''
        })
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {canEdit && insertSearch.isOpen && (
        <WorkspaceInsertSearch
          documentTree={documentTree}
          assetTree={assetTree}
          mode={insertSearch.mode}
          supportedAssets={['image']}
          selectedText={insertSearch.selectedText}
          position={insertSearch.x || insertSearch.y ? { x: insertSearch.x, y: insertSearch.y } : null}
          getAssetUrl={getAssetUrl}
          labels={labels}
          onInsertPageLink={insertPageLink}
          onInsertAsset={asset => insertImage(getAssetUrl(asset.path), asset.name)}
          onClose={() => setInsertSearch(previous => ({ ...previous, isOpen: false }))}
        />
      )}
      <BlockNoteView
        editor={editor}
        editable={canEdit}
        theme="dark"
        slashMenu={false}
        sideMenu={false}
        formattingToolbar={false}
        onChange={emitEditorDocument}
      >
        {canEdit && (
          <>
            <SideMenuController sideMenu={NotionSideMenu} />
            <FormattingToolbarController
              formattingToolbar={() => (
                <NotionFormattingToolbar
                  onOpenPageLink={() => setInsertSearch({
                    isOpen: true,
                    x: 0,
                    y: 0,
                    mode: 'page-link',
                    selectedText: editor.getSelectedText?.().trim() || ''
                  })}
                  pageLinkLabel={labels.pageLink}
                />
              )}
            />
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={getSlashMenuItems}
            />
          </>
        )}
      </BlockNoteView>
    </div>
  )
}

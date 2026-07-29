import { Component, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension, Node } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Strike from '@tiptap/extension-strike'
import Underline from '@tiptap/extension-underline'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { ySyncPlugin, yUndoPlugin } from 'y-prosemirror'
import TiptapSlashMenu from './TiptapSlashMenu'
import { TiptapCallout } from './TiptapCallout'
import { TiptapBlockAwareness } from './tiptapBlockAwareness'
import TiptapBlockControls from './TiptapBlockControls'
import { createTiptapCommands } from './tiptapCommands'
import { TiptapEditingShortcuts } from './tiptapEditingShortcuts'
import { getTiptapMenuPosition } from './tiptapMenuPosition'
import { insertAssetMedia, TiptapAssetAudio, TiptapAssetImage } from './tiptapMedia'
import {
  canInsertPageLink,
  getInternalPageLinkHref,
  insertPageLink,
  isPageLinkShortcut,
  shouldNavigatePageLink,
  TiptapPageLink
} from './tiptapPageLinks'
import {
  TiptapTableBlockMenu,
  TiptapTableControls
} from './TiptapTableUi'
import {
  ensureParagraphAfterTable,
  TiptapTableCell,
  TiptapTableClipboard,
  TiptapTableHeader,
  TiptapTableNavigation
} from './tiptapTables'
import { useTiptapDocument } from './useTiptapDocument'
import { getAssetFileUrl } from '../assets/assetApi'
import WorkspaceInsertSearch from '../../workspace/WorkspaceInsertSearch'
import {
  TiptapBlockquote,
  TiptapBulletList,
  TiptapCodeBlock,
  TiptapHardBreak,
  TiptapHeading,
  TiptapListItem,
  TiptapOrderedList,
  TiptapExpand,
  TiptapToggleHeading
} from './tiptapNodes'

const TiptapDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

class TiptapControlsBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Tiptap contextual controls failed to mount', error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function isInsideTableCell($position) {
  for (let depth = $position.depth - 1; depth > 0; depth -= 1) {
    const name = $position.node(depth).type.name
    if (name === 'tableCell' || name === 'tableHeader') return true
  }
  return false
}

export default function TiptapEditor({
  content = '',
  editable,
  locked,
  worldId,
  documentUid = '',
  collaborationRoom,
  currentUser,
  isVisitor = false,
  documentTree = [],
  onNavigateToPageLink,
  onRequestMedia,
  onVisitorCountChange,
  onCollaborationSaveState
}) {
  const { t } = useTranslation()
  const collaboration = useTiptapDocument({ roomName: collaborationRoom, currentUser, isVisitor, locked })
  const {
    awarenessStates,
    provider: collaborationProvider,
    setAwarenessField
  } = collaboration
  const [slashState, setSlashState] = useState(null)
  const [pageLinkSearch, setPageLinkSearch] = useState({ isOpen: false, selectedText: '' })
  const commands = useMemo(() => createTiptapCommands(t), [t])
  const pageLinkLabels = useMemo(() => ({
    insertPageLink: t('workspace.insert_page_link'),
    searchTabsAssetsPlaceholder: t('workspace.tiptap_page_link_search_placeholder'),
    searchHint: t('workspace.tiptap_page_link_search_hint'),
    noSearchResults: t('workspace.no_search_results'),
    resultTypeTab: t('workspace.result_type_tab'),
    previewPath: t('workspace.preview_path'),
    tabTypeNotion: t('workspace.tab_type_notion'),
    tabTypeMarkdown: t('workspace.tab_type_markdown'),
    tabTypeMap: t('workspace.tab_type_map'),
    tabTypeBoard: t('workspace.tab_type_board')
  }), [t])
  const blockLabels = useMemo(() => ({
    add: t('workspace.tiptap_block_add', 'Adicionar bloco'),
    addHint: t('workspace.tiptap_block_add_hint', 'Clique para adicionar abaixo; Alt+clique para adicionar acima'),
    menu: t('workspace.tiptap_block_menu', 'Abrir ações do bloco ou arrastar'),
    actions: t('workspace.tiptap_block_actions', 'Ações do bloco'),
    insertAbove: t('workspace.tiptap_block_insert_above', 'Inserir acima'),
    insertBelow: t('workspace.tiptap_block_insert_below', 'Inserir abaixo'),
    duplicate: t('workspace.tiptap_block_duplicate', 'Duplicar'),
    delete: t('workspace.tiptap_block_delete', 'Excluir')
  }), [t])
  const tableLabels = useMemo(() => ({
    row: t('workspace.tiptap_table_row', 'Linha'),
    column: t('workspace.tiptap_table_column', 'Coluna'),
    openRowMenu: t('workspace.tiptap_table_open_row_menu', 'Abrir controles da linha'),
    openColumnMenu: t('workspace.tiptap_table_open_column_menu', 'Abrir controles da coluna'),
    cannotDeleteLast: t('workspace.tiptap_table_cannot_delete_last', 'Use Excluir tabela para remover a tabela inteira'),
    headerRow: t('workspace.tiptap_table_header_row', 'Linha de cabeçalho'),
    headerColumn: t('workspace.tiptap_table_header_column', 'Coluna de cabeçalho'),
    addRowAbove: t('workspace.tiptap_table_add_row_above', 'Adicionar linha acima'),
    addRowBelow: t('workspace.tiptap_table_add_row_below', 'Adicionar linha abaixo'),
    deleteRow: t('workspace.tiptap_table_delete_row', 'Excluir linha'),
    duplicateRow: t('workspace.tiptap_table_duplicate_row', 'Duplicar linha'),
    clearRow: t('workspace.tiptap_table_clear_row', 'Limpar linha'),
    addColumnLeft: t('workspace.tiptap_table_add_column_left', 'Adicionar coluna à esquerda'),
    addColumnRight: t('workspace.tiptap_table_add_column_right', 'Adicionar coluna à direita'),
    deleteColumn: t('workspace.tiptap_table_delete_column', 'Excluir coluna'),
    duplicateColumn: t('workspace.tiptap_table_duplicate_column', 'Duplicar coluna'),
    clearColumn: t('workspace.tiptap_table_clear_column', 'Limpar coluna'),
    table: t('workspace.tiptap_table', 'Tabela')
  }), [t])
  const extensions = useMemo(() => [
    TiptapDocument,
    Text,
    Paragraph,
    TiptapHeading,
    TiptapToggleHeading,
    TiptapListItem,
    TiptapBulletList,
    TiptapOrderedList,
    TiptapExpand,
    TiptapBlockquote,
    TiptapCodeBlock,
    TiptapHardBreak,
    TiptapCallout.configure({
      labels: {
        customize: t('workspace.tiptap_callout_customize', 'Personalizar destaque'),
        color: t('workspace.tiptap_callout_color', 'Cor'),
        icon: t('workspace.tiptap_callout_icon', 'Ícone'),
        convert: t('workspace.tiptap_callout_convert', 'Converter em blocos normais'),
        variants: {
          neutral: t('workspace.tiptap_callout_neutral', 'Neutro'),
          info: t('workspace.tiptap_callout_info', 'Informação'),
          success: t('workspace.tiptap_callout_success', 'Sucesso'),
          warning: t('workspace.tiptap_callout_warning', 'Aviso'),
          danger: t('workspace.tiptap_callout_danger', 'Perigo')
        }
      }
    }),
    TableKit.configure({
      table: {
        resizable: true,
        renderWrapper: true,
        cellMinWidth: 80,
        lastColumnResizable: true
      },
      tableCell: false,
      tableHeader: false
    }),
    TiptapTableCell,
    TiptapTableHeader,
    TiptapTableClipboard,
    TiptapTableNavigation,
    Bold,
    Italic,
    Strike,
    Underline,
    TiptapPageLink,
    HorizontalRule,
    TiptapAssetImage.configure({
      resolveAssetUrl: assetId => getAssetFileUrl(worldId, { id: assetId }, documentUid),
      unavailableLabel: t('workspace.tiptap_media_unavailable'),
      resizeLabel: t('workspace.tiptap_resize_image')
    }),
    TiptapAssetAudio.configure({
      resolveAssetUrl: assetId => getAssetFileUrl(worldId, { id: assetId }, documentUid),
      unavailableLabel: t('workspace.tiptap_media_unavailable')
    }),
    TiptapEditingShortcuts.configure({
      collaborative: Boolean(collaboration.fragment)
    }),
    TiptapBlockAwareness.configure({
      rootPlaceholder: t('workspace.tiptap_placeholder'),
      blockPlaceholder: t('workspace.tiptap_block_placeholder'),
      headingPlaceholder: level => t('workspace.tiptap_heading_placeholder', { level }),
      toggleHeadingPlaceholder: level => t('workspace.tiptap_toggle_heading_placeholder', { level })
    }),
    ...(collaboration.fragment ? [Extension.create({
      name: 'tiptapYjsCollaboration',
      addProseMirrorPlugins: () => [ySyncPlugin(collaboration.fragment), yUndoPlugin()]
    })] : [])
  ], [collaboration.fragment, documentUid, t, worldId])
  const editor = useEditor({
    extensions,
    content: collaboration.doc ? undefined : content,
    editable: editable && !collaboration.readOnly,
    onUpdate: collaboration.onUpdate
  }, [collaboration.doc])
  useEffect(() => {
    editor?.setEditable(editable && !collaboration.readOnly)
  }, [collaboration.readOnly, editable, editor])

  useEffect(() => {
    if (editor?.isEditable) return
    setPageLinkSearch(current => current.isOpen ? { isOpen: false, selectedText: '' } : current)
  }, [editor, editor?.isEditable])

  useEffect(() => {
    onCollaborationSaveState?.({ status: collaboration.saveStatus, dirty: collaboration.dirty })
  }, [collaboration.dirty, collaboration.saveStatus, onCollaborationSaveState])

  useEffect(() => {
    if (!collaborationProvider) {
      onVisitorCountChange?.(0)
      return
    }
    if (isVisitor) setAwarenessField('visitor', { viewing: true })
    const visitorCount = awarenessStates.filter(state => state?.visitor?.viewing).length
    onVisitorCountChange?.(visitorCount)
  }, [
    awarenessStates,
    collaborationProvider,
    isVisitor,
    onVisitorCountChange,
    setAwarenessField
  ])

  const closeSlashMenu = useCallback(() => setSlashState(null), [])
  const closePageLinkSearch = useCallback(() => {
    setPageLinkSearch({ isOpen: false, selectedText: '' })
    window.requestAnimationFrame(() => editor?.commands.focus())
  }, [editor])
  const handleInsertPageLink = useCallback((item) => {
    if (!editor) return
    insertPageLink(editor, item)
  }, [editor])
  const updateSlashMenu = useCallback(() => {
    if (!editor) return
    const { $from } = editor.state.selection
    if ($from.parent.type.name !== 'paragraph' || isInsideTableCell($from)) {
      setSlashState(null)
      return
    }
    const { from } = editor.state.selection
    const lineStart = $from.start()
    const textBeforeCursor = editor.state.doc.textBetween(lineStart, from, '\n')
    const match = textBeforeCursor.match(/^\/(\S*)$/)
    if (!match) {
      setSlashState(null)
      return
    }
    const query = match[1].toLowerCase()
    const items = commands.filter(item =>
      [item.label, ...(item.keywords || [])].some(value => value.toLowerCase().includes(query))
    )
    const coords = editor.view.coordsAtPos(lineStart)
    const position = getTiptapMenuPosition(coords, {
      width: window.innerWidth,
      height: window.innerHeight
    })
    setSlashState(current => ({
      query,
      items,
      selectedIndex: Math.min(current?.selectedIndex || 0, Math.max(items.length - 1, 0)),
      ...position,
      range: { from: from - textBeforeCursor.length, to: from }
    }))
  }, [commands, editor])

  useEffect(() => {
    if (!editor) return undefined
    editor.on('transaction', updateSlashMenu)
    return () => editor.off('transaction', updateSlashMenu)
  }, [editor, updateSlashMenu])

  useEffect(() => {
    if (!slashState) return undefined
    window.addEventListener('resize', updateSlashMenu)
    return () => window.removeEventListener('resize', updateSlashMenu)
  }, [slashState, updateSlashMenu])

  const executeSlashCommand = useCallback((item) => {
    if (!editor || !slashState) return
    const chain = editor.chain().focus().deleteRange(slashState.range)
    if (item.id === 'media') {
      chain.run()
      closeSlashMenu()
      onRequestMedia?.(null, asset => {
        insertAssetMedia(editor, asset?.mediaType, asset)
      })
      return
    }
    if (item.id === 'table') {
      chain.insertTable({
        rows: 3,
        cols: 3,
        withHeaderRow: true
      }).run()
      ensureParagraphAfterTable(editor, { focus: false })
      closeSlashMenu()
      return
    }
    if (item.id.startsWith('heading-')) chain.setHeading({ level: Number(item.id.split('-')[1]) })
    if (item.id.startsWith('toggle-heading-')) {
      chain.setToggleHeading({ level: Number(item.id.split('-')[2]) })
    }
    if (item.id === 'bulletList') chain.toggleBulletList()
    if (item.id === 'orderedList') chain.toggleOrderedList()
    if (item.id === 'blockquote') chain.setBlockquote()
    if (item.id === 'callout') chain.insertCallout({ variant: 'info', icon: 'Info' })
    if (item.id === 'horizontalRule') chain.setHorizontalRule()
    chain.run()
    closeSlashMenu()
  }, [closeSlashMenu, editor, onRequestMedia, slashState])

  const handleEditorKeyDown = useCallback((event) => {
    if (!editor?.view.dom.contains(event.target)) return
    if (isPageLinkShortcut(event) && canInsertPageLink(editor)) {
      event.preventDefault()
      event.stopPropagation()
      const { from, to } = editor.state.selection
      const selectedText = from === to ? '' : editor.state.doc.textBetween(from, to, ' ')
      closeSlashMenu()
      setPageLinkSearch({ isOpen: true, selectedText })
      return
    }
    const selectionFrom = editor?.state.selection.$from
    const currentBlock = selectionFrom?.parent
    const isToggleHeadingTitle = (
      currentBlock?.type.name === 'heading' &&
      selectionFrom.depth >= 2 &&
      selectionFrom.node(selectionFrom.depth - 1).type.name === 'toggleHeading'
    )
    if (
      event.key === 'Backspace' &&
      currentBlock?.content.size === 0 &&
      currentBlock.type.name !== 'paragraph' &&
      !isToggleHeadingTitle
    ) {
      event.preventDefault()
      editor.chain().focus().setParagraph().run()
      return
    }
    if (!slashState) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSlashMenu()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setSlashState(current => {
        const count = current?.items.length || 0
        if (!count) return current
        const delta = event.key === 'ArrowDown' ? 1 : -1
        return { ...current, selectedIndex: (current.selectedIndex + delta + count) % count }
      })
      return
    }
    if (event.key === 'Enter' && slashState.items[slashState.selectedIndex]) {
      event.preventDefault()
      executeSlashCommand(slashState.items[slashState.selectedIndex])
    }
  }, [closeSlashMenu, editor, executeSlashCommand, slashState])

  const handleEditorClick = useCallback((event) => {
    if (!editor?.view.dom.contains(event.target)) return
    const href = getInternalPageLinkHref(event.target)
    if (!href) return

    event.preventDefault()
    if (!shouldNavigatePageLink(editor, event)) return
    onNavigateToPageLink?.(href)
  }, [editor, onNavigateToPageLink])

  const renderBlockExtraMenu = useCallback(({ block, run }) => (
    block.node.type.name === 'table'
      ? (
          <TiptapTableBlockMenu
            block={block}
            editor={editor}
            labels={tableLabels}
            run={run}
          />
        )
      : null
  ), [editor, tableLabels])
  const contextualControlsReady = Boolean(
    editor &&
    editor.state.doc.childCount > 0 &&
    (!collaborationRoom || collaboration.synced)
  )

  return (
    <div className="tiptap-editor-shell" onClickCapture={handleEditorClick} onKeyDownCapture={handleEditorKeyDown}>
      <div className="tiptap-editor">
        <EditorContent editor={editor} />
        {pageLinkSearch.isOpen && editor && (
          <WorkspaceInsertSearch
            documentTree={documentTree}
            mode="page-link"
            selectedText={pageLinkSearch.selectedText}
            labels={pageLinkLabels}
            onInsertPageLink={handleInsertPageLink}
            onClose={closePageLinkSearch}
          />
        )}
        {contextualControlsReady && (
          <TiptapControlsBoundary>
            <TiptapBlockControls
              editor={editor}
              labels={blockLabels}
              renderExtraMenu={renderBlockExtraMenu}
            />
            <TiptapTableControls editor={editor} labels={tableLabels} />
          </TiptapControlsBoundary>
        )}
        {slashState && editor && (
          <div
            className="tiptap-slash-menu-anchor"
            data-placement={slashState.placement}
            style={{
              top: slashState.top,
              left: slashState.left,
              transform: slashState.placement === 'above' ? 'translateY(-100%)' : undefined,
              '--tiptap-slash-menu-max-height': `${slashState.maxHeight}px`
            }}
          >
            <TiptapSlashMenu
              items={slashState.items}
              selectedIndex={slashState.selectedIndex}
              onSelect={executeSlashCommand}
              onClose={closeSlashMenu}
            />
          </div>
        )}
      </div>
    </div>
  )
}

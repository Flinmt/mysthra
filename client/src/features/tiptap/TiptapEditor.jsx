import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension, Node } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Strike from '@tiptap/extension-strike'
import Underline from '@tiptap/extension-underline'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { ySyncPlugin, yUndoPlugin } from 'y-prosemirror'
import TiptapSlashMenu from './TiptapSlashMenu'
import { TiptapBlockAwareness } from './tiptapBlockAwareness'
import { TIPTAP_COMMANDS } from './tiptapCommands'
import { TiptapEditingShortcuts } from './tiptapEditingShortcuts'
import { getTiptapMenuPosition } from './tiptapMenuPosition'
import { useTiptapDocument } from './useTiptapDocument'
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

export default function TiptapEditor({
  content = '',
  editable,
  locked,
  collaborationRoom,
  currentUser,
  isVisitor = false,
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
    Bold,
    Italic,
    Strike,
    Underline,
    HorizontalRule,
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
  ], [collaboration.fragment, t])
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
  const updateSlashMenu = useCallback(() => {
    if (!editor) return
    if (editor.state.selection.$from.parent.type.name !== 'paragraph') {
      setSlashState(null)
      return
    }
    const { from } = editor.state.selection
    const lineStart = editor.state.selection.$from.start()
    const textBeforeCursor = editor.state.doc.textBetween(lineStart, from, '\n')
    const match = textBeforeCursor.match(/^\/(\S*)$/)
    if (!match) {
      setSlashState(null)
      return
    }
    const query = match[1].toLowerCase()
    const items = TIPTAP_COMMANDS.filter(item => item.label.toLowerCase().includes(query))
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
  }, [editor])

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
    if (item.id.startsWith('heading-')) chain.setHeading({ level: Number(item.id.split('-')[1]) })
    if (item.id.startsWith('toggle-heading-')) {
      chain.setToggleHeading({ level: Number(item.id.split('-')[2]) })
    }
    if (item.id === 'bulletList') chain.toggleBulletList()
    if (item.id === 'orderedList') chain.toggleOrderedList()
    if (item.id === 'blockquote') chain.setBlockquote()
    if (item.id === 'horizontalRule') chain.setHorizontalRule()
    chain.run()
    closeSlashMenu()
  }, [closeSlashMenu, editor, slashState])

  const handleEditorKeyDown = useCallback((event) => {
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

  return (
    <div className="tiptap-editor-shell" onKeyDownCapture={handleEditorKeyDown}>
      <div className="tiptap-editor">
        <EditorContent editor={editor} />
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
              shortcutHints={[
                { label: t('workspace.tiptap_shortcut_undo'), shortcut: ['Mod', 'Z'] },
                { label: t('workspace.tiptap_shortcut_redo'), shortcut: ['Mod', 'Shift', 'Z'] },
                { label: t('workspace.tiptap_shortcut_clear_formatting'), shortcut: ['Mod', '\\'] }
              ]}
              onSelect={executeSlashCommand}
              onClose={closeSlashMenu}
            />
          </div>
        )}
      </div>
    </div>
  )
}

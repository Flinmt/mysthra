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
import { TIPTAP_COMMANDS } from './tiptapCommands'
import { useTiptapDocument } from './useTiptapDocument'
import {
  TiptapBlockquote,
  TiptapBulletList,
  TiptapCodeBlock,
  TiptapHardBreak,
  TiptapHeading,
  TiptapListItem,
  TiptapOrderedList,
  TiptapExpand
} from './tiptapNodes'

const TiptapDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

export default function TiptapEditor({ content = '', editable, locked, collaborationRoom, currentUser, isVisitor = false, onCollaborationSaveState }) {
  const { t } = useTranslation()
  const collaboration = useTiptapDocument({ roomName: collaborationRoom, currentUser, isVisitor, locked })
  const [slashState, setSlashState] = useState(null)
  const extensions = useMemo(() => [
    TiptapDocument,
    Text,
    Paragraph,
    TiptapHeading,
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
    ...(collaboration.fragment ? [Extension.create({
      name: 'tiptapYjsCollaboration',
      addProseMirrorPlugins: () => [ySyncPlugin(collaboration.fragment), yUndoPlugin()]
    })] : [])
  ], [collaboration.fragment])
  const editor = useEditor({
    extensions,
    content: collaboration.doc ? undefined : content,
    editable: editable && !collaboration.readOnly,
    onUpdate: collaboration.onUpdate
  }, [collaboration.doc])
  const [placeholderPosition, setPlaceholderPosition] = useState(null)

  useEffect(() => {
    if (!editor) return undefined
    const updateEmptyState = () => {
      const currentBlock = editor.state.selection.$from.parent
      if (currentBlock.type.name !== 'paragraph' || currentBlock.content.size > 0) {
        setPlaceholderPosition(null)
        return
      }
      const editorRect = editor.view.dom.closest('.tiptap-editor')?.getBoundingClientRect()
      const cursorRect = editor.view.coordsAtPos(editor.state.selection.from)
      if (!editorRect) return
      setPlaceholderPosition({
        top: cursorRect.top - editorRect.top,
        left: cursorRect.left - editorRect.left
      })
    }
    editor.on('transaction', updateEmptyState)
    updateEmptyState()
    return () => editor.off('transaction', updateEmptyState)
  }, [editor])

  useEffect(() => {
    editor?.setEditable(editable && !collaboration.readOnly)
  }, [collaboration.readOnly, editable, editor])

  useEffect(() => {
    onCollaborationSaveState?.({ status: collaboration.saveStatus, dirty: collaboration.dirty })
  }, [collaboration.dirty, collaboration.saveStatus, onCollaborationSaveState])

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
    setSlashState(current => ({
      query,
      items,
      selectedIndex: Math.min(current?.selectedIndex || 0, Math.max(items.length - 1, 0)),
      top: coords.bottom + 6,
      left: coords.left,
      range: { from: from - textBeforeCursor.length, to: from }
    }))
  }, [editor])

  useEffect(() => {
    if (!editor) return undefined
    editor.on('transaction', updateSlashMenu)
    return () => editor.off('transaction', updateSlashMenu)
  }, [editor, updateSlashMenu])

  const executeSlashCommand = useCallback((item) => {
    if (!editor || !slashState) return
    const chain = editor.chain().focus().deleteRange(slashState.range)
    if (item.id.startsWith('heading-')) chain.setHeading({ level: Number(item.id.split('-')[1]) })
    if (item.id === 'bulletList') chain.setBulletList()
    if (item.id === 'orderedList') chain.setOrderedList()
    if (item.id === 'expand') chain.setExpand()
    if (item.id === 'blockquote') chain.setBlockquote()
    if (item.id === 'codeBlock') chain.setCodeBlock()
    if (item.id === 'horizontalRule') chain.setHorizontalRule()
    chain.run()
    closeSlashMenu()
  }, [closeSlashMenu, editor, slashState])

  const handleEditorKeyDown = useCallback((event) => {
    const currentBlock = editor?.state.selection.$from.parent
    if (event.key === 'Backspace' && currentBlock?.content.size === 0 && currentBlock.type.name !== 'paragraph') {
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
    <div className="notion-editor" onKeyDownCapture={handleEditorKeyDown}>
      <div className="tiptap-editor">
        <EditorContent editor={editor} className="bn-editor" />
        {editor && editable && !collaboration.readOnly && placeholderPosition && (
          <div className="tiptap-placeholder" style={placeholderPosition} aria-hidden="true">
            {t('workspace.tiptap_placeholder')}
          </div>
        )}
        {slashState && editor && (
          <div className="tiptap-slash-menu-anchor" style={{ top: slashState.top, left: slashState.left }}>
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

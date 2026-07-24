import { Editor, Extension, Node } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Paragraph from '@tiptap/extension-paragraph'
import Strike from '@tiptap/extension-strike'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'
import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { ySyncPlugin, yUndoPlugin } from 'y-prosemirror'
import { TiptapEditingShortcuts } from './tiptapEditingShortcuts'
import {
  TiptapBlockquote,
  TiptapBulletList,
  TiptapHeading,
  TiptapListItem,
  TiptapToggleHeading
} from './tiptapNodes'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = new Set()
const yDocs = new Set()

function createEditor(content, { collaborative = false, yDoc = null, editable = true } = {}) {
  const element = document.createElement('div')
  document.body.append(element)
  const extensions = [
    TiptapTestDocument,
    Text,
    Paragraph,
    TiptapHeading,
    TiptapToggleHeading,
    TiptapListItem,
    TiptapBulletList,
    TiptapBlockquote,
    Bold,
    Italic,
    Strike,
    Underline,
    TiptapEditingShortcuts.configure({ collaborative })
  ]
  if (collaborative) {
    const doc = yDoc || new Y.Doc()
    yDocs.add(doc)
    extensions.push(Extension.create({
      name: `testYjsCollaboration${editors.size}`,
      addProseMirrorPlugins: () => [
        ySyncPlugin(doc.getXmlFragment('tiptap')),
        yUndoPlugin()
      ]
    }))
  }
  const editor = new Editor({
    element,
    editable,
    extensions,
    ...(collaborative ? {} : { content })
  })
  editors.add(editor)
  return editor
}

function paragraph(text, marks) {
  return {
    type: 'paragraph',
    ...(text ? {
      content: [{
        type: 'text',
        text,
        ...(marks ? { marks } : {})
      }]
    } : {})
  }
}

function heading(level, text, marks) {
  return {
    type: 'heading',
    attrs: { level },
    ...(text ? {
      content: [{
        type: 'text',
        text,
        ...(marks ? { marks } : {})
      }]
    } : {})
  }
}

function pressKey(editor, key, options = {}) {
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  }))
}

function typeText(editor, text) {
  for (const character of text) {
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp(
      'handleTextInput',
      handler => handler(editor.view, from, to, character)
    )
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(character, from, to))
  }
}

afterEach(() => {
  editors.forEach(editor => {
    editor.view.dom.parentElement?.remove()
    editor.destroy()
  })
  editors.clear()
  yDocs.forEach(doc => doc.destroy())
  yDocs.clear()
})

describe('Tiptap essential editing shortcuts', () => {
  it('undoes and redoes local edits with conventional shortcuts', () => {
    const editor = createEditor({ type: 'doc', content: [paragraph()] })
    editor.commands.insertContent('Primeiro')

    pressKey(editor, 'z', { ctrlKey: true })
    expect(editor.getText()).toBe('')

    pressKey(editor, 'z', { ctrlKey: true, shiftKey: true })
    expect(editor.getText()).toBe('Primeiro')

    pressKey(editor, 'z', { ctrlKey: true })
    pressKey(editor, 'y', { ctrlKey: true })
    expect(editor.getText()).toBe('Primeiro')
  })

  it('invalidates redo after a new edit', () => {
    const editor = createEditor({ type: 'doc', content: [paragraph()] })
    editor.commands.insertContent('Primeiro')
    pressKey(editor, 'z', { ctrlKey: true })
    editor.commands.insertContent('Novo')

    pressKey(editor, 'y', { ctrlKey: true })
    expect(editor.getText()).toBe('Novo')
  })

  it('converts the current block to a paragraph with Mod+Alt+0', () => {
    const editor = createEditor({
      type: 'doc',
      content: [heading(3, 'Título')]
    })
    editor.commands.setTextSelection(3)

    pressKey(editor, '0', { ctrlKey: true, altKey: true })

    expect(editor.getJSON().content[0].type).toBe('paragraph')
  })

  it('lifts a list item to ordinary text with Mod+Alt+0 while preserving marks', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [paragraph('Item', [{ type: 'bold' }])]
        }]
      }]
    })
    editor.commands.setTextSelection(3)

    pressKey(editor, '0', { ctrlKey: true, altKey: true })

    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'paragraph',
      content: [{
        text: 'Item',
        marks: [{ type: 'bold' }]
      }]
    })
  })

  it.each([
    [
      'heading',
      { type: 'doc', content: [heading(2, 'Título', [{ type: 'bold' }])] }
    ],
    [
      'list',
      {
        type: 'doc',
        content: [{
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [paragraph('Item', [{ type: 'bold' }])]
          }]
        }]
      }
    ],
    [
      'blockquote',
      {
        type: 'doc',
        content: [{
          type: 'blockquote',
          content: [paragraph('Citação', [{ type: 'italic' }])]
        }]
      }
    ]
  ])('clears marks and block formatting from a %s', (_name, content) => {
    const editor = createEditor(content)
    editor.commands.selectAll()

    pressKey(editor, '\\', { ctrlKey: true })

    expect(editor.getJSON().content).toHaveLength(1)
    expect(editor.getJSON().content[0].type).toBe('paragraph')
    expect(editor.getJSON().content[0].content[0].marks).toBeUndefined()
  })

  it('preserves the expandable heading structure while clearing its marks', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'toggleHeading',
        attrs: { id: 'clear-toggle', level: 2 },
        content: [
          heading(2, 'Título', [{ type: 'bold' }]),
          paragraph('Conteúdo')
        ]
      }]
    })
    editor.commands.setTextSelection({ from: 2, to: 8 })

    pressKey(editor, '\\', { ctrlKey: true })

    expect(editor.getJSON().content[0].type).toBe('toggleHeading')
    expect(editor.getJSON().content[0].content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ text: 'Título' }]
    })
  })

  it('keeps conventional inline formatting shortcuts active', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Texto')]
    })
    editor.commands.setTextSelection({ from: 1, to: 6 })

    pressKey(editor, 'b', { ctrlKey: true })
    pressKey(editor, 'i', { ctrlKey: true })
    pressKey(editor, 'u', { ctrlKey: true })
    pressKey(editor, 's', { ctrlKey: true, shiftKey: true })

    expect(editor.getJSON().content[0].content[0].marks.map(mark => mark.type)).toEqual(
      expect.arrayContaining(['bold', 'italic', 'underline', 'strike'])
    )
  })

  it.each([1, 2, 3, 4, 5, 6])('creates heading level %i from its text pattern', level => {
    const headingEditor = createEditor({ type: 'doc', content: [paragraph()] })
    typeText(headingEditor, `${'#'.repeat(level)} `)
    expect(headingEditor.getJSON().content[0]).toMatchObject({
      type: 'heading',
      attrs: { level }
    })
  })

  it('creates a blockquote from its standard text pattern', () => {
    const quoteEditor = createEditor({ type: 'doc', content: [paragraph()] })
    typeText(quoteEditor, '> ')
    expect(quoteEditor.getJSON().content[0].type).toBe('blockquote')
  })

  it('does not let heading input rules change an expandable title level', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'toggleHeading',
        attrs: { id: 'input-toggle', level: 2 },
        content: [heading(2)]
      }]
    })
    editor.commands.setTextSelection(2)

    typeText(editor, '### ')

    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'toggleHeading',
      attrs: { level: 2 },
      content: [{
        type: 'heading',
        attrs: { level: 2 },
        content: [{ text: '### ' }]
      }]
    })
  })

  it('does not change a read-only editor', () => {
    const editor = createEditor(
      { type: 'doc', content: [heading(2, 'Título', [{ type: 'bold' }])] },
      { editable: false }
    )
    const before = editor.getJSON()

    pressKey(editor, '\\', { ctrlKey: true })
    pressKey(editor, '0', { ctrlKey: true, altKey: true })
    pressKey(editor, 'z', { ctrlKey: true })

    expect(editor.getJSON()).toEqual(before)
  })
})

describe('Tiptap collaborative history', () => {
  it('undoes and redoes local Yjs edits', () => {
    const editor = createEditor(null, { collaborative: true })
    editor.commands.insertContent('Local')

    pressKey(editor, 'z', { ctrlKey: true })
    expect(editor.getText()).toBe('')

    pressKey(editor, 'y', { ctrlKey: true })
    expect(editor.getText()).toBe('Local')
  })

  it('keeps remote Yjs edits when undoing a local change', () => {
    const localDoc = new Y.Doc()
    const remoteDoc = new Y.Doc()
    yDocs.add(localDoc)
    yDocs.add(remoteDoc)
    const localEditor = createEditor(null, { collaborative: true, yDoc: localDoc })

    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(localDoc), 'initial-sync')
    remoteDoc.on('update', update => Y.applyUpdate(localDoc, update, 'remote'))
    const remoteEditor = createEditor(null, { collaborative: true, yDoc: remoteDoc })

    remoteEditor.commands.insertContent('Remoto')
    localEditor.commands.setTextSelection(localEditor.state.doc.content.size - 1)
    localEditor.commands.insertContent(' local')
    pressKey(localEditor, 'z', { ctrlKey: true })

    expect(localEditor.getText()).toBe('Remoto')
  })
})

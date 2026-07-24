import { Editor, Node } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TiptapBulletList,
  TiptapListItem,
  TiptapOrderedList
} from './tiptapNodes'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = new Set()

function createEditor(content) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      TiptapTestDocument,
      Text,
      Paragraph,
      TiptapListItem,
      TiptapBulletList,
      TiptapOrderedList,
      Bold
    ],
    content
  })
  editors.add(editor)
  return editor
}

function paragraph(text, marks) {
  return {
    type: 'paragraph',
    ...(text ? { content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] } : {})
  }
}

function list(type, items, attrs) {
  return {
    type,
    ...(attrs ? { attrs } : {}),
    content: items.map(item => ({
      type: 'listItem',
      content: [paragraph(item)]
    }))
  }
}

function setCursorInParagraph(editor, paragraphIndex = 0, offset = 0) {
  const positions = []
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'paragraph') positions.push(position + 1)
  })
  editor.commands.setTextSelection(positions[paragraphIndex] + offset)
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
})

describe('Tiptap lists', () => {
  it.each([
    ['toggleBulletList', 'bulletList'],
    ['toggleOrderedList', 'orderedList']
  ])('creates %s through the same chained flow used by the slash menu', (command, type) => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('/lista')]
    })
    setCursorInParagraph(editor, 0, '/lista'.length)

    const commandChain = editor
      .chain()
      .focus()
      .deleteRange({ from: 1, to: 7 })
    const applied = commandChain[command]().run()

    expect(applied).toBe(true)
    expect(editor.getJSON().content[0].type).toBe(type)
  })

  it('creates, converts, and removes lists without losing inline marks', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Item', [{ type: 'bold' }])]
    })
    setCursorInParagraph(editor, 0, 2)

    expect(editor.commands.toggleBulletList()).toBe(true)
    expect(editor.getJSON().content[0].type).toBe('bulletList')

    expect(editor.commands.toggleOrderedList()).toBe(true)
    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'orderedList',
      attrs: { start: 1 },
      content: [{
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{ text: 'Item', marks: [{ type: 'bold' }] }]
        }]
      }]
    })

    expect(editor.commands.toggleOrderedList()).toBe(true)
    expect(editor.getJSON().content[0].type).toBe('paragraph')
  })

  it('creates a sibling item with Enter and exits from an empty item', () => {
    const editor = createEditor({
      type: 'doc',
      content: [list('bulletList', ['Primeiro'])]
    })
    setCursorInParagraph(editor, 0, 'Primeiro'.length)

    pressKey(editor, 'Enter')
    expect(editor.getJSON().content[0].content).toHaveLength(2)

    pressKey(editor, 'Enter')
    expect(editor.getJSON().content).toMatchObject([
      {
        type: 'bulletList',
        content: [{ type: 'listItem' }]
      },
      { type: 'paragraph' }
    ])
  })

  it('nests and outdents items with Tab and Shift+Tab', () => {
    const editor = createEditor({
      type: 'doc',
      content: [list('bulletList', ['Primeiro', 'Segundo'])]
    })
    setCursorInParagraph(editor, 1, 2)

    pressKey(editor, 'Tab')
    expect(editor.getJSON().content[0].content).toHaveLength(1)
    expect(editor.getJSON().content[0].content[0].content[1]).toMatchObject({
      type: 'bulletList',
      content: [{ type: 'listItem' }]
    })

    pressKey(editor, 'Tab', { shiftKey: true })
    expect(editor.getJSON().content[0].content).toHaveLength(2)
  })

  it('creates bullet and numbered lists from text patterns', () => {
    const bulletEditor = createEditor({ type: 'doc', content: [paragraph()] })
    typeText(bulletEditor, '- ')
    expect(bulletEditor.getJSON().content[0].type).toBe('bulletList')

    const orderedEditor = createEditor({ type: 'doc', content: [paragraph()] })
    typeText(orderedEditor, '3. ')
    expect(orderedEditor.getJSON().content[0]).toMatchObject({
      type: 'orderedList',
      attrs: { start: 3 }
    })
    expect(orderedEditor.getHTML()).toContain('<ol start="3">')
  })

  it('toggles list types with the conventional keyboard shortcuts', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Item')]
    })
    setCursorInParagraph(editor, 0, 2)

    pressKey(editor, '8', { ctrlKey: true, shiftKey: true })
    expect(editor.getJSON().content[0].type).toBe('bulletList')

    pressKey(editor, '7', { ctrlKey: true, shiftKey: true })
    expect(editor.getJSON().content[0].type).toBe('orderedList')
  })
})

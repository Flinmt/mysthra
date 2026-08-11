import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { afterEach, describe, expect, it } from 'vitest'
import { getSelectionTextColor, normalizeTextColor } from './tiptapTextColors'

const TestDocument = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const editors = new Set()

function createEditor() {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [TestDocument, Text, Paragraph, Bold, TextStyle, Color],
    content: '<p>Texto colorido</p>'
  })
  editors.add(editor)
  return editor
}

afterEach(() => {
  editors.forEach(editor => {
    editor.view.dom.parentElement?.remove()
    editor.destroy()
  })
  editors.clear()
})

describe('Tiptap text colors', () => {
  it('normalizes supported CSS colors to six-digit hexadecimal', () => {
    expect(normalizeTextColor('#ABC')).toBe('#aabbcc')
    expect(normalizeTextColor('rgb(18, 52, 86)')).toBe('#123456')
    expect(normalizeTextColor('red')).toBe('')
  })

  it('persists and removes a selected text color in JSON and HTML', () => {
    const editor = createEditor()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.chain().focus().setColor('#123456').run()

    expect(editor.getJSON().content[0].content[0].marks[0]).toMatchObject({
      type: 'textStyle', attrs: { color: '#123456' }
    })
    expect(editor.getHTML()).toContain('color: rgb(18, 52, 86)')
    expect(getSelectionTextColor(editor)).toEqual({ color: '#123456', mixed: false })

    editor.chain().focus().unsetColor().run()
    expect(editor.getJSON().content[0].content[0].marks).toBeUndefined()
  })

  it('reports a mixed state when the selection has colored and default text', () => {
    const editor = createEditor()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.commands.setColor('#d97872')
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })

    expect(getSelectionTextColor(editor)).toEqual({ color: '', mixed: true })
  })

  it('keeps the selected color when the text is bold', () => {
    const editor = createEditor()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.chain().focus().setBold().setColor('#d97872').run()

    const marks = editor.getJSON().content[0].content[0].marks
    expect(marks.map(mark => mark.type)).toEqual(expect.arrayContaining(['bold', 'textStyle']))
    expect(marks.find(mark => mark.type === 'textStyle')?.attrs.color).toBe('#d97872')
    expect(editor.getHTML()).toContain('color: rgb(217, 120, 114)')
  })
})

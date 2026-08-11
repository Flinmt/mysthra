import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapHeading, TiptapToggleHeading } from './tiptapNodes'
import {
  getSelectionHighlight,
  setSelectionHighlight,
  TiptapTextHighlight,
  unsetSelectionHighlight
} from './tiptapHighlights'

const TestDocument = Node.create({ name: 'doc', topNode: true, content: 'block+' })
let editor

function createEditor(content) {
  const element = document.createElement('div')
  document.body.append(element)
  editor = new Editor({
    element,
    extensions: [TestDocument, Text, Paragraph, TiptapHeading, TiptapToggleHeading, TiptapTextHighlight],
    content
  })
  return editor
}

function textPosition(doc, text) {
  let result = null
  doc.descendants((node, position) => {
    if (result === null && node.isText && node.text.includes(text)) result = position
  })
  return result
}

afterEach(() => {
  editor?.view.dom.parentElement?.remove()
  editor?.destroy()
  editor = null
})

describe('Tiptap marker highlights', () => {
  it('highlights only the selected part of ordinary text', () => {
    const instance = createEditor('<p>Texto comum</p>')
    instance.commands.setTextSelection({ from: 1, to: 6 })

    expect(setSelectionHighlight(instance, '#d6bd63')).toBe(true)
    expect(instance.getJSON().content[0].content[0]).toMatchObject({
      text: 'Texto',
      marks: [{ type: 'textHighlight', attrs: { color: '#d6bd63' } }]
    })
    expect(instance.getJSON().content[0].content[1].text).toBe(' comum')
  })

  it.each([1, 2, 3, 4, 5, 6])('highlights the entire H%i line from a partial selection', level => {
    const instance = createEditor(`<h${level}>Título completo</h${level}>`)
    instance.commands.setTextSelection({ from: 2, to: 5 })

    setSelectionHighlight(instance, '#62a8d8')

    expect(instance.getJSON().content[0]).toMatchObject({
      type: 'heading', attrs: { level }
    })
    expect(instance.getJSON().content[0].content[0].marks[0]).toMatchObject({
      type: 'textHighlight', attrs: { color: '#62a8d8' }
    })
    expect(instance.view.dom.querySelector(`h${level}`).getAttribute('data-highlight-line')).toBe('#62a8d8')
  })

  it('highlights the whole title line inside a toggle heading', () => {
    const instance = createEditor({
      type: 'doc',
      content: [{
        type: 'toggleHeading',
        attrs: { level: 2 },
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Título expansível' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Conteúdo' }] }
        ]
      }]
    })
    const position = textPosition(instance.state.doc, 'Título')
    instance.commands.setTextSelection({ from: position, to: position + 3 })

    setSelectionHighlight(instance, '#a889dc')

    expect(instance.getJSON().content[0].content[0].content[0].marks[0]).toMatchObject({
      type: 'textHighlight', attrs: { color: '#a889dc' }
    })
    expect(instance.getJSON().content[0].content[1].content[0].marks).toBeUndefined()
  })

  it('handles mixed block selections and removes both highlight forms', () => {
    const instance = createEditor('<h2>Título</h2><p>Parágrafo</p>')
    instance.commands.setTextSelection({ from: 2, to: instance.state.doc.content.size - 1 })
    setSelectionHighlight(instance, '#62b884')

    expect(instance.getJSON().content[0].content[0].marks[0].type).toBe('textHighlight')
    expect(instance.getJSON().content[1].content[0].marks[0].type).toBe('textHighlight')
    expect(getSelectionHighlight(instance)).toEqual({ color: '#62b884', mixed: false })

    expect(unsetSelectionHighlight(instance)).toBe(true)
    expect(instance.getJSON().content[0].content[0].marks).toBeUndefined()
    expect(instance.getJSON().content[1].content[0].marks).toBeUndefined()
  })
})

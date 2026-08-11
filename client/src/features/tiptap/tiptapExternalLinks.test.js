import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapPageLink } from './tiptapPageLinks'
import {
  normalizeExternalUrl,
  setExternalLink,
  TiptapExternalLinkPaste
} from './tiptapExternalLinks'

const TestDocument = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const editors = new Set()

function createEditor() {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [TestDocument, Text, Paragraph, TiptapPageLink, TiptapExternalLinkPaste],
    content: '<p>Texto selecionado</p>'
  })
  editors.add(editor)
  return editor
}

function paste(editor, text) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: type => type === 'text/plain' ? text : '' }
  })
  editor.view.dom.dispatchEvent(event)
  return event
}

afterEach(() => {
  editors.forEach(editor => {
    editor.view.dom.parentElement?.remove()
    editor.destroy()
  })
  editors.clear()
})

describe('Tiptap external links', () => {
  it('normalizes safe URLs and rejects unsafe protocols', () => {
    expect(normalizeExternalUrl('www.example.com')).toBe('https://www.example.com/')
    expect(normalizeExternalUrl('https://example.com/path')).toBe('https://example.com/path')
    expect(normalizeExternalUrl('javascript:alert(1)')).toBe('')
  })

  it('associates an external URL with selected text', () => {
    const editor = createEditor()
    editor.commands.setTextSelection({ from: 1, to: 6 })

    expect(setExternalLink(editor, 'https://example.com')).toBe(true)
    expect(editor.getJSON().content[0].content[0].marks[0]).toMatchObject({
      type: 'link',
      attrs: { href: 'https://example.com/' }
    })
  })

  it('turns a pasted URL into a link when text is selected', () => {
    const editor = createEditor()
    editor.commands.setTextSelection({ from: 1, to: 6 })

    const event = paste(editor, 'https://example.com/docs')

    expect(event.defaultPrevented).toBe(true)
    expect(editor.getJSON().content[0].content[0].marks[0]).toMatchObject({
      type: 'link', attrs: { href: 'https://example.com/docs' }
    })
    expect(editor.getText()).toBe('Texto selecionado')
  })

  it('keeps ordinary paste behavior without a selection or valid URL', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(1)
    paste(editor, 'https://example.com')
    expect(editor.getText()).toContain('https://example.com')

    const invalid = createEditor()
    invalid.commands.setTextSelection({ from: 1, to: 6 })
    paste(invalid, 'não é uma URL')
    expect(invalid.getJSON().content[0].content.some(node => node.marks?.some(mark => mark.type === 'link'))).toBe(false)
  })
})

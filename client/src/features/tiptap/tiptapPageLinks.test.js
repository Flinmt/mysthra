import { Editor, Extension, Node } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import { ySyncPlugin } from 'y-prosemirror'
import * as Y from 'yjs'
import { createInternalPageLink } from '../../workspace/utils'
import { TiptapCodeBlock } from './tiptapNodes'
import {
  canInsertPageLink,
  getInternalPageLinkHref,
  insertPageLink,
  isPageLinkShortcut,
  shouldNavigatePageLink,
  TiptapPageLink
} from './tiptapPageLinks'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = new Set()
const yDocs = new Set()

function paragraph(text = '', marks = []) {
  return {
    type: 'paragraph',
    ...(text ? {
      content: [{
        type: 'text',
        text,
        ...(marks.length > 0 ? { marks } : {})
      }]
    } : {})
  }
}

function createEditor(content, editable = true) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    editable,
    extensions: [
      TiptapTestDocument,
      Text,
      Paragraph,
      TiptapCodeBlock,
      Bold,
      TiptapPageLink
    ],
    content
  })
  editors.add(editor)
  return editor
}

function createCollaborativeEditor(doc) {
  const element = document.createElement('div')
  document.body.append(element)
  yDocs.add(doc)
  const editor = new Editor({
    element,
    extensions: [
      TiptapTestDocument,
      Text,
      Paragraph,
      TiptapPageLink,
      Extension.create({
        name: `pageLinkCollaboration${editors.size}`,
        addProseMirrorPlugins: () => [ySyncPlugin(doc.getXmlFragment('tiptap'))]
      })
    ]
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
  yDocs.forEach(doc => doc.destroy())
  yDocs.clear()
})

describe('Tiptap internal page links', () => {
  it('inserts the tab name at the cursor without extending the link to later text', () => {
    const editor = createEditor({ type: 'doc', content: [paragraph()] })
    const href = createInternalPageLink({ documentUid: 'doc-1', tabUid: 'tab-1' })

    expect(insertPageLink(editor, { href, label: 'Bestiary' })).toBe(true)
    editor.commands.insertContent(' continues')

    expect(editor.getJSON().content[0].content).toEqual([
      {
        type: 'text',
        marks: [{
          type: 'link',
          attrs: {
            class: 'tiptap-page-link',
            href,
            rel: null,
            target: null,
            title: null
          }
        }],
        text: 'Bestiary'
      },
      { type: 'text', text: ' continues' }
    ])
  })

  it('links selected text while preserving its content and formatting', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Ancient dragon', [{ type: 'bold' }])]
    })
    const href = createInternalPageLink({ documentUid: 'doc-1', tabUid: 'tab-2' })
    editor.commands.setTextSelection({ from: 1, to: 15 })

    expect(insertPageLink(editor, { href, label: 'Ignored label' })).toBe(true)

    expect(editor.getText()).toBe('Ancient dragon')
    expect(editor.getJSON().content[0].content[0]).toMatchObject({
      text: 'Ancient dragon',
      marks: expect.arrayContaining([
        { type: 'bold' },
        { type: 'link', attrs: expect.objectContaining({ href }) }
      ])
    })
  })

  it('rejects read-only editors, code blocks and external URLs', () => {
    const readOnly = createEditor({ type: 'doc', content: [paragraph('Read only')] }, false)
    const code = createEditor({
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'const value = 1' }] }]
    })
    code.commands.setTextSelection(2)

    expect(canInsertPageLink(readOnly)).toBe(false)
    expect(canInsertPageLink(code)).toBe(false)
    expect(insertPageLink(code, { href: 'https://example.com', label: 'External' })).toBe(false)
  })

  it('resolves only internal anchors from clicked content', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = '<a href="mysthra://document/doc-1?tab=tab-1"><span>Page</span></a><a href="https://example.com">External</a>'

    expect(getInternalPageLinkHref(wrapper.querySelector('span'))).toBe('mysthra://document/doc-1?tab=tab-1')
    expect(getInternalPageLinkHref(wrapper.querySelector('a[href^="https"]'))).toBe('')
  })

  it('recognizes only Ctrl+Space and applies the edit/read navigation rules', () => {
    const editable = { isEditable: true }
    const readOnly = { isEditable: false }

    expect(isPageLinkShortcut({ code: 'Space', ctrlKey: true })).toBe(true)
    expect(isPageLinkShortcut({ code: 'Space', metaKey: true })).toBe(false)
    expect(isPageLinkShortcut({ code: 'Space', ctrlKey: true, shiftKey: true })).toBe(false)
    expect(shouldNavigatePageLink(editable, {})).toBe(false)
    expect(shouldNavigatePageLink(editable, { ctrlKey: true })).toBe(true)
    expect(shouldNavigatePageLink(editable, { metaKey: true })).toBe(true)
    expect(shouldNavigatePageLink(readOnly, {})).toBe(true)
  })

  it('synchronizes the stable page target through Yjs', () => {
    const doc = new Y.Doc()
    const first = createCollaborativeEditor(doc)
    const second = createCollaborativeEditor(doc)
    const href = createInternalPageLink({ documentUid: 'doc-1', tabUid: 'stable-tab-id' })

    first.commands.setTextSelection(1)
    expect(insertPageLink(first, { href, label: 'World lore' })).toBe(true)

    expect(second.getJSON().content[0].content[0]).toMatchObject({
      text: 'World lore',
      marks: [{
        type: 'link',
        attrs: expect.objectContaining({ href })
      }]
    })
  })
})

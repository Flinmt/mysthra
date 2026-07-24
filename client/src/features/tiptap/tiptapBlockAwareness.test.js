import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapBlockAwareness } from './tiptapBlockAwareness'
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
      TiptapHeading,
      TiptapListItem,
      TiptapBulletList,
      TiptapBlockquote,
      TiptapToggleHeading,
      TiptapBlockAwareness.configure({
        rootPlaceholder: 'Root prompt',
        blockPlaceholder: 'Block prompt',
        headingPlaceholder: level => `Heading ${level}`,
        toggleHeadingPlaceholder: level => `Toggle heading ${level}`
      })
    ],
    content
  })
  editors.add(editor)
  return editor
}

function paragraph(text) {
  return {
    type: 'paragraph',
    ...(text ? { content: [{ type: 'text', text }] } : {})
  }
}

function textblockPositions(editor) {
  const positions = []
  editor.state.doc.descendants((node, position) => {
    if (node.isTextblock) positions.push(position + 1)
  })
  return positions
}

afterEach(() => {
  editors.forEach(editor => {
    editor.view.dom.parentElement?.remove()
    editor.destroy()
  })
  editors.clear()
})

describe('Tiptap block awareness', () => {
  it('decorates only the active empty root block', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph(), paragraph()]
    })
    const paragraphs = editor.view.dom.querySelectorAll('p')

    expect(paragraphs[0].classList.contains('tiptap-active-block')).toBe(true)
    expect(paragraphs[0].dataset.placeholder).toBe('Root prompt')
    expect(paragraphs[1].classList.contains('tiptap-active-block')).toBe(false)

    editor.commands.setTextSelection(textblockPositions(editor)[1])

    expect(paragraphs[0].classList.contains('tiptap-active-block')).toBe(false)
    expect(paragraphs[1].dataset.placeholder).toBe('Root prompt')
  })

  it.each([
    [
      'list',
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [paragraph()] }]
      }
    ],
    [
      'blockquote',
      {
        type: 'blockquote',
        content: [paragraph()]
      }
    ]
  ])('uses the compact placeholder inside a %s', (_name, block) => {
    const editor = createEditor({ type: 'doc', content: [block] })
    const activeBlock = editor.view.dom.querySelector('.tiptap-active-block')

    expect(activeBlock.tagName).toBe('P')
    expect(activeBlock.dataset.placeholder).toBe('Block prompt')
  })

  it('uses the root placeholder inside an expandable heading', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'toggleHeading',
        attrs: { id: 'inner-placeholder-toggle', level: 2 },
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Título' }] },
          paragraph()
        ]
      }]
    })
    editor.commands.setTextSelection(textblockPositions(editor)[1])

    expect(
      editor.view.dom.querySelector('.tiptap-toggle-heading-content > p').dataset.placeholder
    ).toBe('Root prompt')
  })

  it('uses contextual labels for normal and expandable headings', () => {
    const normalEditor = createEditor({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 3 } }]
    })
    expect(normalEditor.view.dom.querySelector('h3').dataset.placeholder).toBe('Heading 3')

    const toggleEditor = createEditor({
      type: 'doc',
      content: [{
        type: 'toggleHeading',
        attrs: { id: 'placeholder-toggle', level: 5 },
        content: [{ type: 'heading', attrs: { level: 5 } }]
      }]
    })
    expect(toggleEditor.view.dom.querySelector('h5').dataset.placeholder).toBe('Toggle heading 5')
  })

  it('keeps a filled block active without showing a placeholder', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Conteúdo')]
    })
    const paragraphElement = editor.view.dom.querySelector('p')

    expect(paragraphElement.classList.contains('tiptap-active-block')).toBe(true)
    expect(paragraphElement.classList.contains('is-empty')).toBe(false)
    expect(paragraphElement.hasAttribute('data-placeholder')).toBe(false)
  })

  it('removes the placeholder when content is inserted', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph()]
    })

    expect(editor.view.dom.querySelector('p').dataset.placeholder).toBe('Root prompt')
    editor.commands.insertContent('Texto remoto')

    const paragraphElement = editor.view.dom.querySelector('p')
    expect(paragraphElement.classList.contains('is-empty')).toBe(false)
    expect(paragraphElement.hasAttribute('data-placeholder')).toBe(false)
  })

  it('does not decorate blocks in read-only mode', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph()]
    }, false)

    expect(editor.view.dom.querySelector('.tiptap-active-block')).toBeNull()
    expect(editor.view.dom.querySelector('[data-placeholder]')).toBeNull()
  })
})

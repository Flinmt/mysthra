import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TiptapExpand,
  TiptapHeading,
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
      TiptapToggleHeading,
      TiptapExpand
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

function heading(level, text) {
  return {
    type: 'heading',
    attrs: { level },
    ...(text ? { content: [{ type: 'text', text }] } : {})
  }
}

function toggleHeading({ id = 'toggle-test', level = 2, title = 'Título', children = [] } = {}) {
  return {
    type: 'toggleHeading',
    attrs: { id, level },
    content: [heading(level, title), ...children]
  }
}

function pressKey(editor, key) {
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true
  }))
}

function getParagraphPositions(editor) {
  const positions = []
  editor.state.doc.descendants((node, position) => {
    if (node.isTextblock) positions.push({ type: node.type.name, position: position + 1 })
  })
  return positions
}

afterEach(() => {
  editors.forEach(editor => {
    editor.view.dom.parentElement?.remove()
    editor.destroy()
  })
  editors.clear()
  window.localStorage.clear()
})

describe('Tiptap toggle headings', () => {
  it.each([1, 2, 3, 4, 5, 6])('creates a level %i toggle heading with a stable ID', level => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Título')]
    })
    editor.commands.setTextSelection(3)

    expect(editor.commands.setToggleHeading({ level })).toBe(true)
    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'toggleHeading',
      attrs: {
        id: expect.any(String),
        level
      },
      content: [{
        type: 'heading',
        attrs: { level },
        content: [{ text: 'Título' }]
      }]
    })
  })

  it('preserves the level and ID through HTML serialization', () => {
    const sourceEditor = createEditor({
      type: 'doc',
      content: [toggleHeading({ id: 'round-trip', level: 6, title: 'Título 6' })]
    })
    const html = sourceEditor.getHTML()
    const parsedEditor = createEditor(html)

    expect(html).toContain('data-tiptap-toggle-heading')
    expect(parsedEditor.getJSON().content[0]).toMatchObject({
      type: 'toggleHeading',
      attrs: { id: 'round-trip', level: 6 },
      content: [{
        type: 'heading',
        attrs: { level: 6 },
        content: [{ text: 'Título 6' }]
      }]
    })
  })

  it('toggles only from the chevron and persists state locally', () => {
    const content = {
      type: 'doc',
      content: [toggleHeading({ children: [paragraph('Conteúdo')] })]
    }
    const editor = createEditor(content)
    const root = editor.view.dom.querySelector('.tiptap-toggle-heading')
    const trigger = root.querySelector('.tiptap-toggle-heading-trigger')
    const title = root.querySelector('h2')

    expect(root.dataset.open).toBe('true')
    title.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(root.dataset.open).toBe('true')

    trigger.click()
    expect(root.dataset.open).toBe('false')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(window.localStorage.getItem('mysthra:tiptap-toggle-heading:toggle-test')).toBe('closed')
    expect(editor.getJSON()).toEqual(content)

    editor.view.dom.parentElement?.remove()
    editor.destroy()
    editors.delete(editor)

    const reopenedEditor = createEditor(content)
    expect(reopenedEditor.view.dom.querySelector('.tiptap-toggle-heading').dataset.open).toBe('false')
  })

  it('moves a hidden content selection back to the title when collapsed', () => {
    const editor = createEditor({
      type: 'doc',
      content: [toggleHeading({ title: 'Título', children: [paragraph('Conteúdo')] })]
    })
    const positions = getParagraphPositions(editor)
    editor.commands.setTextSelection(positions[1].position + 3)

    editor.view.dom.querySelector('.tiptap-toggle-heading-trigger').click()

    expect(editor.state.selection.$from.parent.type.name).toBe('heading')
  })

  it('skips hidden children when navigating down from a collapsed title', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        toggleHeading({ title: 'Título', children: [paragraph('Conteúdo oculto')] }),
        paragraph('Próxima linha principal')
      ]
    })
    const positions = getParagraphPositions(editor)
    editor.commands.setTextSelection(positions[0].position + 3)
    editor.view.dom.querySelector('.tiptap-toggle-heading-trigger').click()

    pressKey(editor, 'ArrowDown')

    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parent.textContent).toBe('Próxima linha principal')
  })

  it('creates an external paragraph when a collapsed title has no next block', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        toggleHeading({ title: 'Título', children: [paragraph('Conteúdo oculto')] })
      ]
    })
    editor.commands.setTextSelection(getParagraphPositions(editor)[0].position + 3)
    editor.view.dom.querySelector('.tiptap-toggle-heading-trigger').click()

    pressKey(editor, 'ArrowDown')

    expect(editor.getJSON().content).toMatchObject([
      { type: 'toggleHeading' },
      { type: 'paragraph' }
    ])
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('moves Backspace from the next block to a collapsed title without changing content', () => {
    const content = {
      type: 'doc',
      content: [
        toggleHeading({ title: 'Título', children: [paragraph('Conteúdo oculto')] }),
        paragraph('Próxima linha principal')
      ]
    }
    const editor = createEditor(content)
    const positions = getParagraphPositions(editor)
    editor.view.dom.querySelector('.tiptap-toggle-heading-trigger').click()
    editor.commands.setTextSelection(positions[2].position)

    pressKey(editor, 'Backspace')

    expect(editor.getJSON()).toEqual(content)
    expect(editor.state.selection.$from.parent.type.name).toBe('heading')
    expect(editor.state.selection.$from.parentOffset).toBe('Título'.length)
  })

  it('moves Backspace from the next block into the expanded content without changing it', () => {
    const content = {
      type: 'doc',
      content: [
        toggleHeading({
          title: 'Título',
          children: [
            paragraph('Primeiro bloco'),
            paragraph('Último bloco interno')
          ]
        }),
        paragraph('Bloco externo')
      ]
    }
    const editor = createEditor(content)
    const positions = getParagraphPositions(editor)
    editor.commands.setTextSelection(positions[3].position)

    pressKey(editor, 'Backspace')

    expect(editor.getJSON()).toEqual(content)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parent.textContent).toBe('Último bloco interno')
    expect(editor.state.selection.$from.parentOffset).toBe('Último bloco interno'.length)
  })

  it('creates child content with Enter and exits from a final empty child', () => {
    const editor = createEditor({
      type: 'doc',
      content: [toggleHeading({ title: 'Título', children: [] })]
    })
    const titlePosition = getParagraphPositions(editor)[0].position
    editor.commands.setTextSelection(titlePosition + 'Título'.length)

    pressKey(editor, 'Enter')
    expect(editor.getJSON().content[0].content).toHaveLength(2)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')

    pressKey(editor, 'Enter')
    expect(editor.getJSON().content).toMatchObject([
      { type: 'toggleHeading', content: [{ type: 'heading' }] },
      { type: 'paragraph' }
    ])
  })

  it('splits an expanded title into a paragraph directly below the cursor', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        toggleHeading({
          title: 'Título completo',
          children: [paragraph('Conteúdo existente')]
        })
      ]
    })
    const titlePosition = getParagraphPositions(editor)[0].position
    editor.commands.setTextSelection(titlePosition + 'Título'.length)

    pressKey(editor, 'Enter')

    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'toggleHeading',
      content: [
        { type: 'heading', content: [{ text: 'Título' }] },
        { type: 'paragraph', content: [{ text: ' completo' }] },
        { type: 'paragraph', content: [{ text: 'Conteúdo existente' }] }
      ]
    })
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parentOffset).toBe(0)
  })

  it('creates the new block outside when the toggle heading is collapsed', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        toggleHeading({
          title: 'Título completo',
          children: [paragraph('Conteúdo oculto')]
        })
      ]
    })
    const titlePosition = getParagraphPositions(editor)[0].position
    editor.view.dom.querySelector('.tiptap-toggle-heading-trigger').click()
    editor.commands.setTextSelection(titlePosition + 'Título'.length)

    pressKey(editor, 'Enter')

    expect(editor.getJSON().content).toMatchObject([
      {
        type: 'toggleHeading',
        content: [
          { type: 'heading', content: [{ text: 'Título' }] },
          { type: 'paragraph', content: [{ text: 'Conteúdo oculto' }] }
        ]
      },
      { type: 'paragraph', content: [{ text: ' completo' }] }
    ])
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parentOffset).toBe(0)
  })

  it('unwraps an empty title with Backspace without dropping child blocks', () => {
    const editor = createEditor({
      type: 'doc',
      content: [toggleHeading({ title: '', children: [paragraph('Conteúdo')] })]
    })
    editor.commands.setTextSelection(getParagraphPositions(editor)[0].position)

    pressKey(editor, 'Backspace')

    expect(editor.getJSON().content).toMatchObject([
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ text: 'Conteúdo' }] }
    ])
  })

  it('keeps legacy expand nodes readable and allows local toggling in read-only mode', () => {
    const legacyEditor = createEditor({
      type: 'doc',
      content: [{
        type: 'expand',
        content: [paragraph('Legado'), paragraph('Conteúdo antigo')]
      }]
    })
    expect(legacyEditor.getJSON().content[0].type).toBe('expand')

    const readOnlyEditor = createEditor({
      type: 'doc',
      content: [toggleHeading()]
    }, false)
    const root = readOnlyEditor.view.dom.querySelector('.tiptap-toggle-heading')
    root.querySelector('.tiptap-toggle-heading-trigger').click()
    expect(root.dataset.open).toBe('false')
  })
})

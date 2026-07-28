import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { EditorContent } from '@tiptap/react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapCallout } from './TiptapCallout'

const TestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = []

function createEditor(content = '<p></p>') {
  const editor = new Editor({
    extensions: [
      TestDocument,
      Text,
      Paragraph,
      TiptapCallout.configure({
        labels: {
          customize: 'Personalizar destaque',
          variants: { warning: 'Aviso' }
        }
      })
    ],
    content
  })
  editors.push(editor)
  render(<EditorContent editor={editor} />)
  return editor
}

afterEach(() => {
  cleanup()
  editors.splice(0).forEach(editor => editor.destroy())
})

describe('Tiptap callout', () => {
  it('inserts and serializes a multi-block callout with stable attributes', () => {
    const editor = createEditor()

    editor.commands.insertCallout({ variant: 'success', icon: 'CircleCheck' })

    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'callout',
      attrs: { variant: 'success', icon: 'CircleCheck' },
      content: [{ type: 'paragraph' }]
    })
    expect(editor.getHTML()).toContain('data-tiptap-callout')
    expect(editor.getHTML()).toContain('data-variant="success"')
    expect(editor.getHTML()).toContain('data-icon="CircleCheck"')
  })

  it('updates the variant from the compact popover and converts without losing content', async () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'info', icon: 'Info' },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Primeiro' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] }
        ]
      }]
    })

    const icon = await waitFor(() => {
      const element = editor.view.dom.querySelector('.tiptap-callout-icon')
      expect(element).not.toBeNull()
      return element
    })
    fireEvent.click(icon)
    const warning = await waitFor(() =>
      editor.view.dom.querySelector('.tiptap-callout-variants [aria-label="Aviso"]')
    )
    fireEvent.click(warning)

    expect(editor.getJSON().content[0].attrs.variant).toBe('warning')

    fireEvent.click(editor.view.dom.querySelector('.tiptap-callout-convert'))
    expect(editor.getJSON().content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Primeiro' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] }
    ])
  })

  it('hides customization controls when the document is read-only', async () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'info', icon: 'Info' },
        content: [{ type: 'paragraph' }]
      }]
    })

    editor.setEditable(false)
    const icon = await waitFor(() => {
      const element = editor.view.dom.querySelector('.tiptap-callout-icon')
      expect(element).not.toBeNull()
      return element
    })
    expect(icon.disabled).toBe(true)
    expect(editor.view.dom.querySelector('.tiptap-callout-popover')).toBeNull()
  })
})

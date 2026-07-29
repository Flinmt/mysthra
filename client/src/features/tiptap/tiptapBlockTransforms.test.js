import { Editor, Node } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapCallout } from './TiptapCallout'
import {
  TiptapBlockquote,
  TiptapBulletList,
  TiptapHeading,
  TiptapListItem,
  TiptapOrderedList
} from './tiptapNodes'
import {
  canTransformRootBlock,
  getBlockTransformId,
  transformRootBlock
} from './tiptapBlockTransforms'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const UnsupportedBlock = Node.create({
  name: 'unsupportedBlock',
  group: 'block',
  atom: true,
  parseHTML: () => [{ tag: '[data-unsupported-block]' }],
  renderHTML: () => ['div', { 'data-unsupported-block': '' }]
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
      Bold,
      TiptapHeading,
      TiptapListItem,
      TiptapBulletList,
      TiptapOrderedList,
      TiptapBlockquote,
      TiptapCallout,
      UnsupportedBlock
    ],
    content
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

describe('root block transformations', () => {
  it('turns text into a heading while preserving inline content and marks', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Ancient dragon', marks: [{ type: 'bold' }] }]
      }]
    })

    expect(transformRootBlock(editor, 0, 'heading-2')).toBe(true)
    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
      content: [{
        type: 'text',
        text: 'Ancient dragon',
        marks: [{ type: 'bold' }]
      }]
    })
    expect(getBlockTransformId(editor.state.doc.firstChild)).toBe('heading-2')
  })

  it('switches between list types and can flatten the list back into text blocks', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }] }
        ]
      }]
    })

    expect(transformRootBlock(editor, 0, 'orderedList')).toBe(true)
    expect(editor.getJSON().content[0].type).toBe('orderedList')

    expect(transformRootBlock(editor, 0, 'paragraph')).toBe(true)
    expect(editor.getJSON().content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }
    ])
  })

  it('wraps a list in a callout without discarding its structure', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quest' }] }]
        }]
      }]
    })

    expect(transformRootBlock(editor, 0, 'callout')).toBe(true)
    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'callout',
      attrs: { variant: 'info', icon: 'Info' },
      content: [{ type: 'orderedList' }]
    })
  })

  it('turns every textual block in a callout into a list item', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'callout',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Second' }] }
        ]
      }]
    })

    expect(transformRootBlock(editor, 0, 'bulletList')).toBe(true)
    expect(editor.getJSON().content[0].content.map(item =>
      item.content[0].content[0].text
    )).toEqual(['First', 'Second'])
  })

  it('rejects structural blocks and read-only editors', () => {
    const unsupported = createEditor({
      type: 'doc',
      content: [{ type: 'unsupportedBlock' }]
    })
    const readOnly = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Locked' }] }]
    }, false)

    expect(canTransformRootBlock(unsupported.state.doc.firstChild)).toBe(false)
    expect(transformRootBlock(unsupported, 0, 'paragraph')).toBe(false)
    expect(transformRootBlock(readOnly, 0, 'heading-1')).toBe(false)
  })
})

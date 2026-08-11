import { Editor, Node } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Link from '@tiptap/extension-link'
import Paragraph from '@tiptap/extension-paragraph'
import Strike from '@tiptap/extension-strike'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapBlockSelection, selectRootBlockWithModifiers } from './tiptapBlockSelection'
import {
  getBlockFormattingState,
  getBlockFormattingTargets,
  setBlockHighlight,
  setBlockLink,
  setBlockTextColor,
  toggleBlockMark,
  unsetBlockHighlight,
  unsetBlockLink,
  unsetBlockTextColor
} from './tiptapBlockFormatting'
import { TiptapTextHighlight } from './tiptapHighlights'
import { TiptapBulletList, TiptapHeading, TiptapListItem } from './tiptapNodes'

const TestDocument = Node.create({ name: 'doc', topNode: true, content: 'block+' })
let editor

function createEditor(content = '<p>A</p><p>B</p><h2>C</h2>') {
  const element = document.createElement('div')
  document.body.append(element)
  editor = new Editor({
    element,
    extensions: [
      TestDocument, Text, Paragraph, TiptapHeading, TiptapListItem, TiptapBulletList,
      Bold, Italic, Underline, Strike, TextStyle, Color, TiptapTextHighlight,
      Link.configure({ protocols: ['http', 'https'], openOnClick: false }),
      TiptapBlockSelection
    ],
    content
  })
  return editor
}

afterEach(() => {
  editor?.view.dom.parentElement?.remove()
  editor?.destroy()
  editor = null
})

describe('Tiptap root block formatting', () => {
  it('formats all and only non-contiguous selected blocks', () => {
    const instance = createEditor()
    const blocks = []
    instance.state.doc.forEach((node, position) => blocks.push({ node, position }))
    selectRootBlockWithModifiers(instance, blocks[0].position)
    selectRootBlockWithModifiers(instance, blocks[2].position, { toggle: true })
    const targets = getBlockFormattingTargets(instance, blocks[2].position)

    expect(toggleBlockMark(instance, targets, 'bold')).toBe(true)
    const content = instance.getJSON().content
    expect(content[0].content[0].marks[0].type).toBe('bold')
    expect(content[1].content[0].marks).toBeUndefined()
    expect(content[2].content[0].marks[0].type).toBe('bold')
    expect(getBlockFormattingState(instance, targets).bold).toMatchObject({ active: true, mixed: false })

    toggleBlockMark(instance, targets, 'bold')
    expect(instance.getJSON().content[0].content[0].marks).toBeUndefined()
    expect(instance.getJSON().content[2].content[0].marks).toBeUndefined()
  })

  it('applies formatting recursively to list item text', () => {
    const instance = createEditor({
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Um' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dois' }] }] }
        ]
      }]
    })
    const targets = getBlockFormattingTargets(instance, 0)

    toggleBlockMark(instance, targets, 'italic')

    const items = instance.getJSON().content[0].content
    expect(items[0].content[0].content[0].marks[0].type).toBe('italic')
    expect(items[1].content[0].content[0].marks[0].type).toBe('italic')
  })

  it('sets and removes link, text color and marker across a whole block', () => {
    const instance = createEditor('<h2>Título inteiro</h2>')
    const targets = getBlockFormattingTargets(instance, 0)

    expect(setBlockLink(instance, targets, 'https://example.com')).toBe(true)
    expect(setBlockTextColor(instance, targets, '#123456')).toBe(true)
    expect(setBlockHighlight(instance, targets, '#d6bd63')).toBe(true)
    let marks = instance.getJSON().content[0].content[0].marks
    expect(marks.map(mark => mark.type)).toEqual(expect.arrayContaining(['link', 'textStyle', 'textHighlight']))
    expect(instance.view.dom.querySelector('h2').getAttribute('data-highlight-line')).toBe('#d6bd63')

    expect(unsetBlockLink(instance, targets)).toBe(true)
    expect(unsetBlockTextColor(instance, targets)).toBe(true)
    expect(unsetBlockHighlight(instance, targets)).toBe(true)
    marks = instance.getJSON().content[0].content[0].marks
    expect(marks).toBeUndefined()
  })

  it('ignores empty blocks without creating invisible marks', () => {
    const instance = createEditor('<p></p>')
    const targets = getBlockFormattingTargets(instance, 0)

    expect(toggleBlockMark(instance, targets, 'underline')).toBe(false)
    expect(setBlockTextColor(instance, targets, '#123456')).toBe(false)
    expect(instance.getJSON()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })
})

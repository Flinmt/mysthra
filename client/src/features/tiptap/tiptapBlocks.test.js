import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteRootBlock,
  duplicateRootBlock,
  getRootBlockInfo,
  insertRootParagraph,
  moveRootBlock,
  rootBlockPositionFromPointer
} from './tiptapBlocks'
import {
  TiptapBulletList,
  TiptapListItem
} from './tiptapNodes'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = new Set()

function paragraph(text = '') {
  return {
    type: 'paragraph',
    ...(text ? { content: [{ type: 'text', text }] } : {})
  }
}

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
      TiptapBulletList
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

describe('Tiptap root blocks', () => {
  it('ignores an empty transient collaborative document', () => {
    const doc = {
      childCount: 0
    }
    expect(getRootBlockInfo({
      doc,
      selection: { from: 0 }
    })).toBeNull()
  })

  it('resolves a nested list item as its root list block', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [paragraph('Item')]
        }]
      }]
    })
    editor.commands.setTextSelection(3)

    expect(getRootBlockInfo(editor.state)).toMatchObject({
      index: 0,
      position: 0
    })
    expect(getRootBlockInfo(editor.state).node.type.name).toBe('bulletList')
  })

  it('inserts a neighboring paragraph and reuses an existing empty one', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('A'), paragraph()]
    })

    expect(insertRootParagraph(editor, 0, 'after')).toBe(true)
    expect(editor.state.doc.childCount).toBe(2)
    expect(insertRootParagraph(editor, 0, 'before')).toBe(true)
    expect(editor.state.doc.childCount).toBe(3)
    expect(editor.state.doc.firstChild.type.name).toBe('paragraph')
  })

  it('duplicates, moves and deletes complete root blocks', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('A'), paragraph('B')]
    })

    expect(duplicateRootBlock(editor, 0)).toBe(true)
    expect(editor.state.doc.content.content.map(node => node.textContent)).toEqual(['A', 'A', 'B'])

    const duplicatePosition = editor.state.doc.child(0).nodeSize
    const documentEnd = editor.state.doc.content.size
    expect(moveRootBlock(editor, duplicatePosition, documentEnd)).toBe(true)
    expect(editor.state.doc.content.content.map(node => node.textContent)).toEqual(['A', 'B', 'A'])

    const lastPosition = editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize
    expect(deleteRootBlock(editor, lastPosition)).toBe(true)
    expect(editor.state.doc.content.content.map(node => node.textContent)).toEqual(['A', 'B'])
  })

  it('replaces the final deleted block with an empty paragraph', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Only')]
    })

    expect(deleteRootBlock(editor, 0)).toBe(true)
    expect(editor.state.doc.childCount).toBe(1)
    expect(editor.state.doc.firstChild.type.name).toBe('paragraph')
    expect(editor.state.doc.firstChild.content.size).toBe(0)
  })

  it('does not treat empty space after the content as a hover on the last block', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Last')]
    })
    editor.view.posAtCoords = () => ({ pos: 1, inside: 0 })
    editor.view.dom.firstElementChild.getBoundingClientRect = () => ({
      left: 40,
      right: 240,
      top: 20,
      bottom: 42,
      width: 200,
      height: 22
    })

    expect(rootBlockPositionFromPointer(editor, 80, 30)?.position).toBe(0)
    expect(rootBlockPositionFromPointer(editor, 0, 30)?.position).toBe(0)
    expect(rootBlockPositionFromPointer(editor, -30, 30)).toBeNull()
    expect(rootBlockPositionFromPointer(editor, 80, 90)).toBeNull()
  })
})

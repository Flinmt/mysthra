import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteRootBlock,
  duplicateRootBlock,
  getRootBlockDropSlot,
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
      HorizontalRule,
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

  it('locates and manages a divider as a complete root block', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('Before'), { type: 'horizontalRule' }, paragraph('After')]
    })
    const divider = editor.view.dom.querySelector('hr')
    const dividerPosition = editor.state.doc.child(0).nodeSize

    expect(rootBlockPositionFromPointer(editor, 0, 0, divider)).toMatchObject({
      position: dividerPosition,
      index: 1
    })
    expect(duplicateRootBlock(editor, dividerPosition)).toBe(true)
    expect(editor.state.doc.content.content.map(node => node.type.name)).toEqual([
      'paragraph', 'horizontalRule', 'horizontalRule', 'paragraph'
    ])
    expect(deleteRootBlock(editor, dividerPosition)).toBe(true)
    expect(editor.state.doc.content.content.map(node => node.type.name)).toEqual([
      'paragraph', 'horizontalRule', 'paragraph'
    ])
  })

  it('uses one canonical drop slot per boundary and hides no-op slots', () => {
    const editor = createEditor({
      type: 'doc',
      content: [paragraph('A'), paragraph('B'), paragraph('C')]
    })
    const positions = [
      0,
      editor.state.doc.child(0).nodeSize,
      editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize
    ]
    positions.forEach((position, index) => {
      editor.view.nodeDOM(position).getBoundingClientRect = () => ({
        left: 40,
        right: 340,
        width: 300,
        top: 10 + index * 40,
        bottom: 40 + index * 40,
        height: 30
      })
    })

    const aboveBoundary = getRootBlockDropSlot(editor, 80, 48)
    const belowBoundary = getRootBlockDropSlot(editor, 80, 52)
    expect(aboveBoundary.position).toBe(positions[1])
    expect(belowBoundary.position).toBe(positions[1])
    expect(aboveBoundary.top).toBe(50)
    expect(belowBoundary.top).toBe(50)

    expect(getRootBlockDropSlot(editor, 80, 50, positions[0])).toBeNull()
    expect(getRootBlockDropSlot(editor, 80, 88, positions[0])).toMatchObject({
      position: positions[2],
      top: 90
    })
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

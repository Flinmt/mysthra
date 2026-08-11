import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Text from '@tiptap/extension-text'
import { NodeSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { preventNativeSelectAll } from '../../appKeyboardShortcuts'
import {
  BLOCK_CLIPBOARD_TYPE,
  clearBlockSelection,
  getBlockSelection,
  getRootBlocks,
  getSelectedRootBlocks,
  moveSelectedRootBlocks,
  selectRootBlockWithModifiers,
  setBlockSelection,
  TiptapBlockSelection
} from './tiptapBlockSelection'

const TestDocument = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const editors = new Set()

function paragraph(text) {
  return { type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }
}

function createEditor(labels = ['A', 'B', 'C'], content = null) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [TestDocument, Text, Paragraph, HorizontalRule, TiptapBlockSelection],
    content: content || { type: 'doc', content: labels.map(paragraph) }
  })
  editors.add(editor)
  return editor
}

function clipboard() {
  const values = new Map()
  return {
    getData: type => values.get(type) || '',
    setData: vi.fn((type, value) => values.set(type, value)),
    values
  }
}

function dispatchClipboard(editor, type, clipboardData) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: clipboardData })
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

describe('Tiptap block selection', () => {
  it('selects a clicked divider without placing a text cursor beside it', () => {
    const editor = createEditor([], {
      type: 'doc',
      content: [paragraph('Before'), { type: 'horizontalRule' }, paragraph('After')]
    })
    const dividerPosition = editor.state.doc.child(0).nodeSize
    const divider = editor.view.dom.querySelector('hr')
    document.elementFromPoint = () => divider

    divider.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, cancelable: true, clientX: 1, clientY: 1
    }))
    divider.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, clientX: 1, clientY: 1
    }))

    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect(editor.state.selection.from).toBe(dividerPosition)
    expect(getSelectedRootBlocks(editor).map(block => block.position)).toEqual([dividerPosition])
  })

  it('uses Ctrl+A to select all root blocks without browser selection', () => {
    const editor = createEditor()
    editor.commands.focus()
    const event = new KeyboardEvent('keydown', {
      key: 'a', ctrlKey: true, bubbles: true, cancelable: true
    })
    editor.view.dom.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(getSelectedRootBlocks(editor)).toHaveLength(3)
    expect(editor.view.dom.querySelectorAll('.tiptap-block-multi-selected')).toHaveLength(3)
  })

  it('handles Ctrl+A before the application blocks the native browser action', () => {
    const editor = createEditor()
    document.addEventListener('keydown', preventNativeSelectAll)
    const event = new KeyboardEvent('keydown', {
      key: 'a', ctrlKey: true, bubbles: true, cancelable: true
    })

    editor.view.dom.dispatchEvent(event)
    document.removeEventListener('keydown', preventNativeSelectAll)

    expect(event.defaultPrevented).toBe(true)
    expect(getSelectedRootBlocks(editor)).toHaveLength(3)
  })

  it('does not apply block selection when Ctrl+A is used outside the editor', () => {
    const editor = createEditor()
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    const event = new KeyboardEvent('keydown', {
      key: 'a', ctrlKey: true, bubbles: true, cancelable: true
    })
    input.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(getBlockSelection(editor.state)).toBeNull()
    input.remove()
  })

  it('copies rich block data and pastes it after the active block', () => {
    const editor = createEditor(['A', 'B'])
    const firstSize = editor.state.doc.firstChild.nodeSize
    setBlockSelection(editor, 0, firstSize)
    const data = clipboard()

    expect(dispatchClipboard(editor, 'copy', data).defaultPrevented).toBe(true)
    expect(JSON.parse(data.values.get(BLOCK_CLIPBOARD_TYPE))).toMatchObject({ version: 1 })

    editor.commands.setTextSelection(firstSize + 1)
    clearBlockSelection(editor)
    expect(dispatchClipboard(editor, 'paste', data).defaultPrevented).toBe(true)
    expect(editor.state.doc.content.content.map(node => node.textContent)).toEqual(['A', 'B', 'A'])
  })

  it('moves a selected range as one ordered group', () => {
    const editor = createEditor(['A', 'B', 'C'])
    const firstTwoEnd = editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize
    setBlockSelection(editor, 0, firstTwoEnd)

    expect(moveSelectedRootBlocks(editor, editor.state.doc.content.size)).toBe(true)
    expect(editor.state.doc.content.content.map(node => node.textContent)).toEqual(['C', 'A', 'B'])
    expect(getBlockSelection(editor.state)).toMatchObject({
      from: editor.state.doc.firstChild.nodeSize
    })
  })

  it('supports individual Ctrl selection and Shift range selection', () => {
    const editor = createEditor(['A', 'B', 'C', 'D'])
    const blocks = getRootBlocks(editor.state)

    selectRootBlockWithModifiers(editor, blocks[0].position)
    selectRootBlockWithModifiers(editor, blocks[2].position, { toggle: true })
    expect(getSelectedRootBlocks(editor).map(block => block.node.textContent)).toEqual(['A', 'C'])

    selectRootBlockWithModifiers(editor, blocks[3].position, { extend: true })
    expect(getSelectedRootBlocks(editor).map(block => block.node.textContent)).toEqual(['A', 'B', 'C', 'D'])

    selectRootBlockWithModifiers(editor, blocks[1].position, { toggle: true })
    expect(getSelectedRootBlocks(editor).map(block => block.node.textContent)).toEqual(['A', 'C', 'D'])
  })

  it('selects intersected blocks with a marquee started from the editor margin', () => {
    const editor = createEditor()
    editor.view.dom.style.setProperty('--accent-color', '#7c5cff')
    const blocks = Array.from(editor.view.dom.children)
    blocks.forEach((block, index) => {
      block.getBoundingClientRect = () => ({
        left: 40, right: 340, width: 300,
        top: 10 + index * 40, bottom: 40 + index * 40, height: 30
      })
    })

    editor.view.dom.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: 0, clientY: 5
    }))
    document.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true, clientX: 350, clientY: 75
    }))
    expect(document.querySelector('.tiptap-block-marquee')?.style.getPropertyValue('--accent-color'))
      .toBe('#7c5cff')
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))

    expect(getSelectedRootBlocks(editor).map(block => block.node.textContent)).toEqual(['A', 'B'])
    expect(document.querySelector('.tiptap-block-marquee')).toBeNull()
  })

  it('starts marquee from empty space inside the editor without native text selection', () => {
    const editor = createEditor()
    Array.from(editor.view.dom.children).forEach((block, index) => {
      block.getBoundingClientRect = () => ({
        left: 40, right: 340, width: 300,
        top: 10 + index * 40, bottom: 40 + index * 40, height: 30
      })
    })
    const down = new MouseEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: 100, clientY: 160
    })

    editor.view.dom.dispatchEvent(down)
    document.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true, clientX: 100, clientY: 15
    }))
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))

    expect(down.defaultPrevented).toBe(true)
    expect(getSelectedRootBlocks(editor)).toHaveLength(3)
  })

  it('does not start structural marquee selection over an existing block', () => {
    const editor = createEditor()
    const blocks = Array.from(editor.view.dom.children)
    blocks.forEach((block, index) => {
      block.getBoundingClientRect = () => ({
        left: 40, right: 340, width: 300,
        top: 10 + index * 40, bottom: 40 + index * 40, height: 30
      })
    })

    blocks[0].dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: 100, clientY: 20
    }))
    const move = new MouseEvent('pointermove', {
      bubbles: true, cancelable: true, clientX: 100, clientY: 105
    })
    document.dispatchEvent(move)
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))

    expect(move.defaultPrevented).toBe(false)
    expect(getSelectedRootBlocks(editor)).toHaveLength(0)
    expect(document.querySelector('.tiptap-block-marquee')).toBeNull()
  })

  it('does not start marquee from the vertical gap between existing blocks', () => {
    const editor = createEditor()
    Array.from(editor.view.dom.children).forEach((block, index) => {
      block.getBoundingClientRect = () => ({
        left: 40, right: 340, width: 300,
        top: 10 + index * 40, bottom: 35 + index * 40, height: 25
      })
    })
    const down = new MouseEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: 100, clientY: 40
    })

    editor.view.dom.dispatchEvent(down)
    const move = new MouseEvent('pointermove', {
      bubbles: true, cancelable: true, clientX: 100, clientY: 100
    })
    document.dispatchEvent(move)
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))

    expect(down.defaultPrevented).toBe(false)
    expect(move.defaultPrevented).toBe(false)
    expect(getSelectedRootBlocks(editor)).toHaveLength(0)
  })

  it('deletes all selected blocks while retaining an editable paragraph', () => {
    const editor = createEditor(['A', 'B'])
    editor.commands.focus()
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a', ctrlKey: true, bubbles: true, cancelable: true
    }))
    const event = new KeyboardEvent('keydown', {
      key: 'Backspace', bubbles: true, cancelable: true
    })
    editor.view.dom.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(editor.state.doc.childCount).toBe(1)
    expect(editor.state.doc.firstChild.type.name).toBe('paragraph')
    expect(editor.state.doc.firstChild.textContent).toBe('')
  })
})

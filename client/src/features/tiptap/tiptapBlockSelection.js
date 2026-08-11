import { Extension } from '@tiptap/core'
import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Fragment } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { getRootBlockInfo } from './tiptapBlocks'

export const BLOCK_CLIPBOARD_TYPE = 'application/x-mysthra-tiptap-blocks+json'
export const blockSelectionPluginKey = new PluginKey('mysthraBlockSelection')

export function getRootBlocks(state) {
  const blocks = []
  state.doc.forEach((node, position, index) => blocks.push({ node, position, index }))
  return blocks
}

export function getBlockSelection(state) {
  return blockSelectionPluginKey.getState(state) || null
}

function selectionMeta(transaction, selection) {
  return transaction.setMeta(blockSelectionPluginKey, selection)
}

function createSelection(blocks, anchor = blocks[0]?.position) {
  if (!blocks.length) return null
  const positions = blocks.map(block => block.position).sort((a, b) => a - b)
  const last = blocks.find(block => block.position === positions.at(-1))
  return {
    positions,
    anchor: positions.includes(anchor) ? anchor : positions[0],
    from: positions[0],
    to: positions.at(-1) + last.node.nodeSize
  }
}

export function setBlockSelection(editor, from, to) {
  if (!editor || editor.isDestroyed) return false
  const safeFrom = Math.min(from, to)
  const safeTo = Math.max(from, to)
  const blocks = getRootBlocks(editor.state).filter(block => (
    block.position >= safeFrom && block.position < safeTo
  ))
  editor.view.dispatch(selectionMeta(editor.state.tr, createSelection(blocks)))
  return true
}

export function selectRootBlockWithModifiers(editor, position, { toggle = false, extend = false } = {}) {
  if (!editor || editor.isDestroyed) return false
  const blocks = getRootBlocks(editor.state)
  const clickedIndex = blocks.findIndex(block => block.position === position)
  if (clickedIndex < 0) return false
  const current = getBlockSelection(editor.state)
  let selected
  let anchor = position
  if (extend && current) {
    const anchorIndex = Math.max(0, blocks.findIndex(block => block.position === current.anchor))
    selected = blocks.slice(Math.min(anchorIndex, clickedIndex), Math.max(anchorIndex, clickedIndex) + 1)
    anchor = blocks[anchorIndex].position
  } else if (toggle && current) {
    const positions = new Set(current.positions)
    if (positions.has(position)) positions.delete(position)
    else positions.add(position)
    selected = blocks.filter(block => positions.has(block.position))
    anchor = positions.has(current.anchor) ? current.anchor : position
  } else {
    selected = [blocks[clickedIndex]]
  }
  editor.view.dispatch(selectionMeta(editor.state.tr, createSelection(selected, anchor)))
  return true
}

export function clearBlockSelection(editor) {
  if (!getBlockSelection(editor?.state)) return false
  editor.view.dispatch(selectionMeta(editor.state.tr, null))
  return true
}

export function selectAllRootBlocks(editor) {
  if (!editor?.state.doc.childCount) return false
  return setBlockSelection(editor, 0, editor.state.doc.content.size)
}

export function getSelectedRootBlocks(editor) {
  const selection = getBlockSelection(editor?.state)
  if (!selection) return []
  const positions = new Set(selection.positions)
  return getRootBlocks(editor.state).filter(block => positions.has(block.position))
}

function ensureDocumentContent(transaction, schema) {
  if (transaction.doc.childCount > 0) return transaction
  return transaction.insert(0, schema.nodes.paragraph.create())
}

export function deleteSelectedRootBlocks(editor) {
  const selection = getBlockSelection(editor?.state)
  if (!selection || !editor.isEditable) return false
  const selected = getSelectedRootBlocks(editor)
  let transaction = editor.state.tr
  selected.slice().reverse().forEach(block => {
    transaction.delete(block.position, block.position + block.node.nodeSize)
  })
  transaction = ensureDocumentContent(transaction, editor.state.schema)
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(
    Math.min(selected[0].position + 1, transaction.doc.content.size)
  )))
  editor.view.dispatch(selectionMeta(transaction, null))
  return true
}

export function moveSelectedRootBlocks(editor, targetPosition) {
  const selection = getBlockSelection(editor?.state)
  if (!selection || !editor.isEditable) return false
  if (targetPosition >= selection.from && targetPosition <= selection.to) return false
  const selected = getSelectedRootBlocks(editor)
  const fragment = Fragment.fromArray(selected.map(block => block.node))
  let transaction = editor.state.tr
  selected.slice().reverse().forEach(block => {
    transaction.delete(block.position, block.position + block.node.nodeSize)
  })
  const mappedTarget = transaction.mapping.map(targetPosition, -1)
  transaction = transaction.insert(mappedTarget, fragment)
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(mappedTarget + 1)))
  const inserted = []
  let position = mappedTarget
  fragment.forEach(node => {
    inserted.push({ node, position })
    position += node.nodeSize
  })
  editor.view.dispatch(selectionMeta(transaction, createSelection(inserted)))
  return true
}

function selectedFragment(state) {
  const selection = getBlockSelection(state)
  if (!selection) return null
  const positions = new Set(selection.positions)
  return Fragment.fromArray(getRootBlocks(state)
    .filter(block => positions.has(block.position))
    .map(block => block.node))
}

function writeClipboard(view, clipboardData) {
  const fragment = selectedFragment(view.state)
  if (!fragment || !clipboardData) return false
  const wrapper = document.createElement('div')
  wrapper.append(DOMSerializer.fromSchema(view.state.schema).serializeFragment(fragment))
  clipboardData.setData(BLOCK_CLIPBOARD_TYPE, JSON.stringify({
    version: 1,
    nodes: fragment.content.map(node => node.toJSON())
  }))
  clipboardData.setData('text/html', wrapper.innerHTML)
  clipboardData.setData('text/plain', fragment.textBetween(0, fragment.size, '\n\n'))
  return true
}

function readClipboardFragment(state, clipboardData, allowExternal) {
  const internal = clipboardData?.getData(BLOCK_CLIPBOARD_TYPE)
  if (internal) {
    try {
      const payload = JSON.parse(internal)
      if (payload.version !== 1 || !Array.isArray(payload.nodes)) return null
      return Fragment.fromArray(payload.nodes.map(node => state.schema.nodeFromJSON(node)))
    } catch {
      return null
    }
  }
  if (!allowExternal) return null
  const html = clipboardData?.getData('text/html')
  if (html) {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    return ProseMirrorDOMParser.fromSchema(state.schema).parseSlice(wrapper).content
  }
  const text = clipboardData?.getData('text/plain')
  if (!text) return null
  return Fragment.fromArray(text.split(/\n{2,}/).map(value => (
    state.schema.nodes.paragraph.create(null, value ? state.schema.text(value) : null)
  )))
}

function pasteBlocks(editor, clipboardData) {
  if (!editor.isEditable) return false
  const selection = getBlockSelection(editor.state)
  const fragment = readClipboardFragment(editor.state, clipboardData, Boolean(selection))
  if (!fragment?.size) return false
  const active = getRootBlockInfo(editor.state)
  const selected = selection ? getSelectedRootBlocks(editor) : []
  let transaction = editor.state.tr
  let from
  if (selected.length) {
    selected.slice().reverse().forEach(block => {
      transaction.delete(block.position, block.position + block.node.nodeSize)
    })
    from = transaction.mapping.map(selected[0].position, -1)
    transaction.insert(from, fragment)
  } else {
    from = active ? active.position + active.node.nodeSize : editor.state.doc.content.size
    transaction.insert(from, fragment)
  }
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(from + 1)))
  const inserted = []
  let position = from
  fragment.forEach(node => {
    inserted.push({ node, position })
    position += node.nodeSize
  })
  editor.view.dispatch(selectionMeta(transaction, createSelection(inserted)))
  return true
}

function intersects(rect, blockRect) {
  return rect.left <= blockRect.right && rect.right >= blockRect.left &&
    rect.top <= blockRect.bottom && rect.bottom >= blockRect.top
}

function selectClickedDivider(view, event) {
  const divider = event.target instanceof Element
    ? event.target.closest('hr')
    : null
  if (!divider || divider.parentElement !== view.dom) return false
  const index = Array.from(view.dom.children).indexOf(divider)
  const block = getRootBlocks(view.state)[index]
  if (!block || block.node.type.name !== 'horizontalRule') return false
  event.preventDefault()
  const transaction = view.state.tr.setSelection(
    NodeSelection.create(view.state.doc, block.position)
  )
  view.dispatch(selectionMeta(transaction, createSelection([block])))
  view.focus()
  return true
}

export function beginBlockMarqueeSelection(editor, event) {
  const target = event.target
  if (target instanceof Element) {
    const interactive = target.closest(
      'button, input, textarea, select, a, [contenteditable="true"], .tiptap-block-control-layer'
    )
    if (interactive && interactive !== editor.view.dom) return false
  }
  const blocks = getRootBlocks(editor.state).map(block => ({
    ...block,
    dom: editor.view.nodeDOM(block.position)
  })).filter(block => block.dom instanceof HTMLElement)
  if (!blocks.length) return false
  const startsInsideBlock = blocks.some(block => {
    const rect = block.dom.getBoundingClientRect()
    return event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom
  })
  if (startsInsideBlock) return false
  const blockRects = blocks.map(block => block.dom.getBoundingClientRect())
  const inHorizontalMargin = event.clientX < Math.min(...blockRects.map(rect => rect.left)) ||
    event.clientX > Math.max(...blockRects.map(rect => rect.right))
  const outsideVerticalBlockArea = event.clientY < Math.min(...blockRects.map(rect => rect.top)) ||
    event.clientY > Math.max(...blockRects.map(rect => rect.bottom))
  if (!inHorizontalMargin && !outsideVerticalBlockArea) return false
  event.preventDefault()
  const origin = { x: event.clientX, y: event.clientY }
  let marquee = null
  let moved = false

  const move = pointerEvent => {
    const distance = Math.hypot(pointerEvent.clientX - origin.x, pointerEvent.clientY - origin.y)
    if (distance < 4) return
    pointerEvent.preventDefault()
    window.getSelection()?.removeAllRanges()
    moved = true
    if (!marquee) {
      marquee = document.createElement('div')
      marquee.className = 'tiptap-block-marquee'
      const accentColor = window.getComputedStyle(editor.view.dom)
        .getPropertyValue('--accent-color')
        .trim()
      if (accentColor) marquee.style.setProperty('--accent-color', accentColor)
      document.body.append(marquee)
    }
    const rect = {
      left: Math.min(origin.x, pointerEvent.clientX),
      right: Math.max(origin.x, pointerEvent.clientX),
      top: Math.min(origin.y, pointerEvent.clientY),
      bottom: Math.max(origin.y, pointerEvent.clientY)
    }
    Object.assign(marquee.style, {
      left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.right - rect.left}px`, height: `${rect.bottom - rect.top}px`
    })
    const selected = blocks.filter(block => intersects(rect, block.dom.getBoundingClientRect()))
    if (!selected.length) {
      clearBlockSelection(editor)
      return
    }
    const first = selected[0]
    const last = selected.at(-1)
    setBlockSelection(editor, first.position, last.position + last.node.nodeSize)
  }
  const finish = () => {
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', finish)
    marquee?.remove()
    if (!moved) clearBlockSelection(editor)
  }
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', finish)
  return true
}

export const TiptapBlockSelection = Extension.create({
  name: 'tiptapBlockSelection',
  priority: 120,
  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({
      key: blockSelectionPluginKey,
      state: {
        init: () => null,
        apply(transaction, previous) {
          const meta = transaction.getMeta(blockSelectionPluginKey)
          if (meta !== undefined) return meta
          if (!previous || !transaction.docChanged) return previous
          const mappedPositions = new Set(previous.positions.map(position => (
            transaction.mapping.map(position, 1)
          )))
          const blocks = getRootBlocks({ doc: transaction.doc })
            .filter(block => mappedPositions.has(block.position))
          const mappedAnchor = transaction.mapping.map(previous.anchor, 1)
          return createSelection(blocks, mappedAnchor)
        }
      },
      props: {
        decorations(state) {
          const selection = getBlockSelection(state)
          if (!selection) return DecorationSet.empty
          const positions = new Set(selection.positions)
          return DecorationSet.create(state.doc, getRootBlocks(state)
            .filter(block => positions.has(block.position))
            .map(block => Decoration.node(
              block.position,
              block.position + block.node.nodeSize,
              { class: 'tiptap-block-multi-selected' }
            )))
        },
        handleKeyDown(view, event) {
          const modifier = event.metaKey || event.ctrlKey
          if (modifier && event.key.toLowerCase() === 'a') {
            if (!view.dom.contains(event.target)) return false
            event.preventDefault()
            return selectAllRootBlocks(editor)
          }
          if (event.key === 'Escape') return clearBlockSelection(editor)
          if ((event.key === 'Backspace' || event.key === 'Delete') && getBlockSelection(view.state)) {
            event.preventDefault()
            return deleteSelectedRootBlocks(editor)
          }
          if (
            getBlockSelection(view.state) &&
            editor.isEditable &&
            event.key.length === 1 &&
            !event.ctrlKey && !event.metaKey && !event.altKey
          ) {
            deleteSelectedRootBlocks(editor)
            return false
          }
          return false
        },
        handleDOMEvents: {
          mousedown: (view, event) => selectClickedDivider(view, event),
          click: (view, event) => selectClickedDivider(view, event),
          pointerdown: (_view, event) => {
            const started = beginBlockMarqueeSelection(editor, event)
            if (!started) clearBlockSelection(editor)
            return started
          },
          copy(view, event) {
            if (!writeClipboard(view, event.clipboardData)) return false
            event.preventDefault()
            return true
          },
          cut(view, event) {
            if (!editor.isEditable || !getBlockSelection(view.state) || !writeClipboard(view, event.clipboardData)) return false
            event.preventDefault()
            deleteSelectedRootBlocks(editor)
            return true
          },
          paste(_view, event) {
            if (!getBlockSelection(editor.state) && !event.clipboardData?.getData(BLOCK_CLIPBOARD_TYPE)) return false
            if (!pasteBlocks(editor, event.clipboardData)) return false
            event.preventDefault()
            return true
          }
        }
      }
    })]
  }
})

import { NodeSelection, TextSelection } from '@tiptap/pm/state'

export function getRootBlockInfo(state, position = state.selection.from) {
  if (!state.doc.childCount) return null
  const safePosition = Math.min(Math.max(position, 0), state.doc.content.size)
  const $position = state.doc.resolve(safePosition)
  if ($position.depth === 0) {
    const index = Math.min($position.index(0), state.doc.childCount - 1)
    const node = state.doc.child(index)
    if (!node) return null
    let nodePosition = 0
    for (let childIndex = 0; childIndex < index; childIndex += 1) {
      nodePosition += state.doc.child(childIndex).nodeSize
    }
    return { index, node, position: nodePosition }
  }

  const index = $position.index(0)
  return {
    index,
    node: $position.node(1),
    position: $position.before(1)
  }
}

function selectNear(transaction, position, direction = 1) {
  return transaction.setSelection(TextSelection.near(
    transaction.doc.resolve(Math.min(
      Math.max(position, 0),
      transaction.doc.content.size
    )),
    direction
  ))
}

export function insertRootParagraph(editor, blockPosition, side = 'after') {
  const info = getRootBlockInfo(editor.state, blockPosition)
  if (!info) return false
  const adjacentIndex = side === 'before' ? info.index - 1 : info.index + 1
  const adjacent = adjacentIndex >= 0 && adjacentIndex < editor.state.doc.childCount
    ? editor.state.doc.child(adjacentIndex)
    : null
  if (adjacent?.type.name === 'paragraph' && adjacent.content.size === 0) {
    const adjacentPosition = side === 'before'
      ? info.position - adjacent.nodeSize
      : info.position + info.node.nodeSize
    const transaction = editor.state.tr.setSelection(TextSelection.near(
      editor.state.doc.resolve(adjacentPosition + 1)
    ))
    editor.view.dispatch(transaction)
    editor.view.focus()
    return true
  }
  const insertPosition = side === 'before'
    ? info.position
    : info.position + info.node.nodeSize
  const paragraph = editor.state.schema.nodes.paragraph.create()
  const transaction = editor.state.tr.insert(insertPosition, paragraph)
  transaction.setSelection(TextSelection.near(
    transaction.doc.resolve(insertPosition + 1)
  ))
  editor.view.dispatch(transaction)
  editor.view.focus()
  return true
}

export function duplicateRootBlock(editor, blockPosition) {
  const info = getRootBlockInfo(editor.state, blockPosition)
  if (!info) return false
  const insertPosition = info.position + info.node.nodeSize
  const transaction = editor.state.tr.insert(insertPosition, info.node.copy(info.node.content))
  transaction.setSelection(NodeSelection.create(transaction.doc, insertPosition))
  editor.view.dispatch(transaction)
  editor.view.focus()
  return true
}

export function selectRootBlock(editor, blockPosition) {
  const info = getRootBlockInfo(editor.state, blockPosition)
  if (!info) return false
  editor.view.dispatch(editor.state.tr.setSelection(
    NodeSelection.create(editor.state.doc, info.position)
  ))
  return true
}

export function deleteRootBlock(editor, blockPosition) {
  const info = getRootBlockInfo(editor.state, blockPosition)
  if (!info) return false
  let transaction = editor.state.tr

  if (editor.state.doc.childCount === 1) {
    const paragraph = editor.state.schema.nodes.paragraph.create()
    transaction = transaction.replaceWith(
      info.position,
      info.position + info.node.nodeSize,
      paragraph
    )
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(info.position + 1)))
  } else {
    transaction = transaction.delete(
      info.position,
      info.position + info.node.nodeSize
    )
    selectNear(transaction, info.position)
  }

  editor.view.dispatch(transaction)
  editor.view.focus()
  return true
}

export function moveRootBlock(editor, blockPosition, targetPosition) {
  const info = getRootBlockInfo(editor.state, blockPosition)
  if (!info) return false
  const sourceFrom = info.position
  const sourceTo = sourceFrom + info.node.nodeSize
  if (targetPosition >= sourceFrom && targetPosition <= sourceTo) return false

  const transaction = editor.state.tr.delete(sourceFrom, sourceTo)
  const mappedTarget = transaction.mapping.map(targetPosition, -1)
  transaction.insert(mappedTarget, info.node.copy(info.node.content))
  transaction.setSelection(NodeSelection.create(transaction.doc, mappedTarget))
  editor.view.dispatch(transaction)
  editor.view.focus()
  return true
}

export function rootBlockPositionFromPoint(editor, clientX, clientY) {
  const result = editor.view.posAtCoords({ left: clientX, top: clientY })
  if (!result) return null
  return getRootBlockInfo(editor.state, result.pos)
}

export function getRootBlockDropSlot(editor, clientX, clientY, sourceRange = null) {
  if (!editor || editor.isDestroyed || !editor.state.doc.childCount) return null
  const blocks = []
  editor.state.doc.forEach((node, position) => {
    const dom = editor.view.nodeDOM(position)
    if (!(dom instanceof HTMLElement)) return
    blocks.push({ node, position, rect: dom.getBoundingClientRect() })
  })
  if (blocks.length === 0) return null

  const minimumLeft = Math.min(...blocks.map(block => block.rect.left)) - 64
  const maximumRight = Math.max(...blocks.map(block => block.rect.right))
  if (clientX < minimumLeft || clientX > maximumRight) return null

  const slots = blocks.map(block => ({
    position: block.position,
    top: block.rect.top,
    left: block.rect.left,
    width: block.rect.width
  }))
  const lastBlock = blocks.at(-1)
  slots.push({
    position: lastBlock.position + lastBlock.node.nodeSize,
    top: lastBlock.rect.bottom,
    left: lastBlock.rect.left,
    width: lastBlock.rect.width
  })

  const slot = slots.reduce((closest, candidate) => (
    Math.abs(candidate.top - clientY) < Math.abs(closest.top - clientY)
      ? candidate
      : closest
  ))
  if (sourceRange !== null) {
    const range = typeof sourceRange === 'number'
      ? (() => {
          const source = getRootBlockInfo(editor.state, sourceRange)
          return source ? { from: source.position, to: source.position + source.node.nodeSize } : null
        })()
      : sourceRange
    if (!range || (slot.position >= range.from && slot.position <= range.to)) return null
  }
  return slot
}

export function rootBlockPositionFromPointer(editor, clientX, clientY) {
  const info = rootBlockPositionFromPoint(editor, clientX, clientY)
  const dom = info && editor.view.nodeDOM(info.position)
  if (!info || !(dom instanceof HTMLElement)) return null
  const rect = dom.getBoundingClientRect()
  const leftGutter = 64
  if (
    clientX < rect.left - leftGutter ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null
  }
  return info
}

export function autoScrollEditorDuringDrag(editor, clientY) {
  let scrollContainer = editor.view.dom.parentElement
  while (scrollContainer && scrollContainer !== document.body) {
    const { overflowY } = window.getComputedStyle(scrollContainer)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      scrollContainer.scrollHeight > scrollContainer.clientHeight
    ) {
      break
    }
    scrollContainer = scrollContainer.parentElement
  }
  const target = scrollContainer && scrollContainer !== document.body
    ? scrollContainer
    : document.scrollingElement
  if (!target) return
  const rect = target === document.scrollingElement
    ? { top: 0, bottom: window.innerHeight }
    : target.getBoundingClientRect()
  const threshold = 48
  if (clientY < rect.top + threshold) target.scrollTop -= 14
  if (clientY > rect.bottom - threshold) target.scrollTop += 14
}

function sanitizeDragPreview(root) {
  root.removeAttribute('contenteditable')
  root.removeAttribute('draggable')
  root.removeAttribute('id')
  root.querySelectorAll('[contenteditable], [draggable], [id]').forEach(element => {
    element.removeAttribute('contenteditable')
    element.removeAttribute('draggable')
    element.removeAttribute('id')
  })
}

export function createRootBlockDragPreview(editor, blockPositions) {
  if (!editor || editor.isDestroyed) return null
  const positions = Array.isArray(blockPositions) ? blockPositions : [blockPositions]
  const source = editor.view.nodeDOM(positions[0])
  if (!(source instanceof HTMLElement)) return null

  const sourceRect = source.getBoundingClientRect()
  const preview = document.createElement('div')
  positions.slice(0, 3).forEach(position => {
    const block = editor.view.nodeDOM(position)
    if (!(block instanceof HTMLElement)) return
    const clone = block.cloneNode(true)
    sanitizeDragPreview(clone)
    preview.append(clone)
  })
  preview.className = 'tiptap-block-drag-preview ProseMirror'
  preview.setAttribute('aria-hidden', 'true')
  preview.style.width = `${Math.min(560, Math.max(240, sourceRect.width || source.offsetWidth || 240))}px`
  if (positions.length > 1) {
    const count = document.createElement('span')
    count.className = 'tiptap-block-drag-preview-count'
    count.textContent = String(positions.length)
    preview.append(count)
  }
  const previewHost = source.closest('.tiptap-editor') || document.body
  previewHost.append(preview)

  return {
    element: preview,
    offsetX: 24,
    offsetY: Math.min(20, Math.max(8, (sourceRect.height || source.offsetHeight || 24) / 2)),
    destroy() {
      preview.remove()
    }
  }
}

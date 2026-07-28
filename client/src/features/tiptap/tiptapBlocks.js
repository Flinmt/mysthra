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

import { Extension } from '@tiptap/core'
import { TableCell, TableHeader } from '@tiptap/extension-table'
import { Fragment } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { CellSelection, TableMap } from '@tiptap/pm/tables'

function tableCellWithLeftAlignment(extension) {
  return extension.extend({
    content: 'paragraph+',
    addAttributes() {
      const attributes = this.parent?.() || {}
      const align = attributes.align || {}
      return {
        ...attributes,
        align: {
          ...align,
          default: 'left',
          parseHTML: () => 'left',
          renderHTML: () => ({ style: 'text-align: left' })
        }
      }
    }
  })
}

export const TiptapTableCell = tableCellWithLeftAlignment(TableCell)
export const TiptapTableHeader = tableCellWithLeftAlignment(TableHeader)

export function getTableInfoAtPosition(state, position) {
  const safePosition = Math.min(Math.max(position, 0), state.doc.content.size)
  const $from = state.doc.resolve(safePosition)
  let tableDepth = -1
  let rowDepth = -1
  let cellDepth = -1

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name
    if (cellDepth < 0 && (name === 'tableCell' || name === 'tableHeader')) cellDepth = depth
    if (rowDepth < 0 && name === 'tableRow') rowDepth = depth
    if (name === 'table') {
      tableDepth = depth
      break
    }
  }

  if (tableDepth < 0 || rowDepth < 0 || cellDepth < 0) return null
  const table = $from.node(tableDepth)
  const tableMap = TableMap.get(table)
  const tablePosition = $from.before(tableDepth)
  const rowIndex = $from.index(tableDepth)
  const columnIndex = $from.index(rowDepth)
  const cellPosition = $from.before(cellDepth)

  return {
    cellPosition,
    columnCount: tableMap.width,
    tableDepth,
    tablePosition,
    table,
    tableMap,
    rowCount: tableMap.height,
    rowIndex,
    columnIndex
  }
}

export function getActiveTableInfo(state) {
  const cellSelection = state.selection instanceof CellSelection
    ? state.selection
    : null
  if (!cellSelection) return getTableInfoAtPosition(state, state.selection.from)

  const $from = cellSelection.$headCell
  let tableDepth = -1
  for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      tableDepth = depth
      break
    }
  }
  if (tableDepth < 0) return null

  const table = $from.node(tableDepth)
  const tableMap = TableMap.get(table)
  const tablePosition = $from.before(tableDepth)
  let rowIndex = $from.index(tableDepth)
  let columnIndex = $from.index($from.depth)
  let cellPosition = $from.pos

  if (cellSelection?.isRowSelection()) {
    const tableStart = tablePosition + 1
    const selectionRect = tableMap.rectBetween(
      cellSelection.$anchorCell.pos - tableStart,
      cellSelection.$headCell.pos - tableStart
    )
    rowIndex = selectionRect.top
    columnIndex = selectionRect.left
    cellPosition = tableStart + tableMap.positionAt(rowIndex, columnIndex, table)
  }

  return {
    cellPosition,
    columnCount: tableMap.width,
    tableDepth,
    tablePosition,
    table,
    tableMap,
    rowCount: tableMap.height,
    rowIndex,
    columnIndex
  }
}

export function selectCurrentTableAxis(editor, axis, { focus = true } = {}) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false
  return selectTableAxisAtCell(editor, axis, info.cellPosition, { focus })
}

export function selectTableAxisAtCell(editor, axis, cellPosition, { focus = true } = {}) {
  const $cell = editor.state.doc.resolve(cellPosition)
  const selection = axis === 'row'
    ? CellSelection.rowSelection($cell)
    : CellSelection.colSelection($cell)
  editor.view.dispatch(editor.state.tr.setSelection(selection))
  if (focus) editor.view.focus()
  return true
}

export function deleteCurrentTableAxis(editor, axis) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false
  const count = axis === 'row' ? info.rowCount : info.columnCount
  if (count <= 1) return false
  const deleted = axis === 'row'
    ? editor.commands.deleteRow()
    : editor.commands.deleteColumn()
  if (!deleted) return false

  const table = editor.state.doc.nodeAt(info.tablePosition)
  if (table?.type.name !== 'table') return true
  const rowIndex = Math.min(info.rowIndex, table.childCount - 1)
  const columnIndex = Math.min(
    info.columnIndex,
    table.child(rowIndex).childCount - 1
  )
  const transaction = editor.state.tr.setSelection(TextSelection.near(
    editor.state.doc.resolve(cellTextPosition(
      info.tablePosition,
      table,
      rowIndex,
      columnIndex
    ))
  ))
  editor.view.dispatch(transaction.scrollIntoView())
  editor.view.focus()
  return true
}

export function ensureParagraphAfterTable(editor, { focus = true } = {}) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false
  const insertAt = info.tablePosition + info.table.nodeSize
  const $after = editor.state.doc.resolve(insertAt)
  const nextNode = $after.nodeAfter
  let transaction = editor.state.tr
  let selectionPosition = insertAt + 1

  if (!(nextNode?.type.name === 'paragraph' && nextNode.content.size === 0)) {
    transaction = transaction.insert(insertAt, editor.state.schema.nodes.paragraph.create())
  }
  if (focus) {
    transaction = transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(selectionPosition), 1)
    )
  }
  if (!transaction.docChanged && !focus) return true
  editor.view.dispatch(transaction.scrollIntoView())
  if (focus) editor.view.focus()
  return true
}

function cellTextPosition(tablePosition, table, rowIndex, columnIndex) {
  let rowPosition = tablePosition + 1
  for (let index = 0; index < rowIndex; index += 1) {
    rowPosition += table.child(index).nodeSize
  }
  let cellPosition = rowPosition + 1
  const row = table.child(rowIndex)
  for (let index = 0; index < columnIndex; index += 1) {
    cellPosition += row.child(index).nodeSize
  }
  return cellPosition + 2
}

function replaceTable(editor, info, nextTable, rowIndex = info.rowIndex, columnIndex = info.columnIndex) {
  const transaction = editor.state.tr.replaceWith(
    info.tablePosition,
    info.tablePosition + info.table.nodeSize,
    nextTable
  )
  const safeRow = Math.min(Math.max(rowIndex, 0), nextTable.childCount - 1)
  const safeColumn = Math.min(
    Math.max(columnIndex, 0),
    nextTable.child(safeRow).childCount - 1
  )
  transaction.setSelection(TextSelection.near(
    transaction.doc.resolve(cellTextPosition(
      info.tablePosition,
      nextTable,
      safeRow,
      safeColumn
    ))
  ))
  editor.view.dispatch(transaction.scrollIntoView())
  editor.view.focus()
  return true
}

export function moveCurrentTableRow(editor, direction) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false
  const targetIndex = info.rowIndex + direction
  if (targetIndex < 0 || targetIndex >= info.table.childCount) return false
  const hasHeaderRow = info.table.firstChild?.firstChild?.type.name === 'tableHeader'
  if (hasHeaderRow && (info.rowIndex === 0 || targetIndex === 0)) return false
  const rows = [...info.table.content.content]
  ;[rows[info.rowIndex], rows[targetIndex]] = [rows[targetIndex], rows[info.rowIndex]]
  return replaceTable(
    editor,
    info,
    info.table.copy(Fragment.fromArray(rows)),
    targetIndex,
    info.columnIndex
  )
}

export function moveCurrentTableColumn(editor, direction) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false
  const targetIndex = info.columnIndex + direction
  if (targetIndex < 0) return false
  if (info.table.content.content.some(row => targetIndex >= row.childCount)) return false
  const hasHeaderColumn = info.table.content.content.every(
    row => row.firstChild?.type.name === 'tableHeader'
  )
  if (hasHeaderColumn && (info.columnIndex === 0 || targetIndex === 0)) return false
  const rows = info.table.content.content.map(row => {
    const cells = [...row.content.content]
    ;[cells[info.columnIndex], cells[targetIndex]] = [cells[targetIndex], cells[info.columnIndex]]
    return row.copy(Fragment.fromArray(cells))
  })
  return replaceTable(
    editor,
    info,
    info.table.copy(Fragment.fromArray(rows)),
    info.rowIndex,
    targetIndex
  )
}

function moveItem(items, from, to) {
  const nextItems = [...items]
  const [item] = nextItems.splice(from, 1)
  nextItems.splice(to, 0, item)
  return nextItems
}

export function moveCurrentTableAxisTo(editor, axis, targetIndex) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false
  const sourceIndex = axis === 'row' ? info.rowIndex : info.columnIndex
  const count = axis === 'row' ? info.rowCount : info.columnCount
  const safeTarget = Math.min(Math.max(targetIndex, 0), count - 1)
  if (sourceIndex === safeTarget) return false

  if (axis === 'row') {
    const hasHeaderRow = info.table.firstChild?.firstChild?.type.name === 'tableHeader'
    if (hasHeaderRow && (sourceIndex === 0 || safeTarget === 0)) return false
    const rows = moveItem(info.table.content.content, sourceIndex, safeTarget)
    return replaceTable(
      editor,
      info,
      info.table.copy(Fragment.fromArray(rows)),
      safeTarget,
      info.columnIndex
    )
  }

  const hasHeaderColumn = info.table.content.content.every(
    row => row.firstChild?.type.name === 'tableHeader'
  )
  if (hasHeaderColumn && (sourceIndex === 0 || safeTarget === 0)) return false
  const rows = info.table.content.content.map(row => row.copy(Fragment.fromArray(
    moveItem(row.content.content, sourceIndex, safeTarget)
  )))
  return replaceTable(
    editor,
    info,
    info.table.copy(Fragment.fromArray(rows)),
    info.rowIndex,
    safeTarget
  )
}

export function duplicateCurrentTableAxis(editor, axis) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false

  if (axis === 'row') {
    const rows = [...info.table.content.content]
    const source = rows[info.rowIndex]
    const hasHeaderRow = info.table.firstChild?.firstChild?.type.name === 'tableHeader'
    const hasHeaderColumn = rows.every(row => row.firstChild?.type.name === 'tableHeader')
    const cells = source.content.content.map((cell, columnIndex) => {
      const type = hasHeaderRow && info.rowIndex === 0
        ? (hasHeaderColumn && columnIndex === 0
            ? editor.state.schema.nodes.tableHeader
            : editor.state.schema.nodes.tableCell)
        : cell.type
      return type.create(cell.attrs, cell.content, cell.marks)
    })
    rows.splice(info.rowIndex + 1, 0, source.copy(Fragment.fromArray(cells)))
    return replaceTable(
      editor,
      info,
      info.table.copy(Fragment.fromArray(rows)),
      info.rowIndex + 1,
      info.columnIndex
    )
  }

  const hasHeaderRow = info.table.firstChild?.firstChild?.type.name === 'tableHeader'
  const hasHeaderColumn = info.table.content.content.every(
    row => row.firstChild?.type.name === 'tableHeader'
  )
  const rows = info.table.content.content.map((row, rowIndex) => {
    const cells = [...row.content.content]
    const source = cells[info.columnIndex]
    const type = hasHeaderColumn && info.columnIndex === 0
      ? (hasHeaderRow && rowIndex === 0
          ? editor.state.schema.nodes.tableHeader
          : editor.state.schema.nodes.tableCell)
      : source.type
    cells.splice(
      info.columnIndex + 1,
      0,
      type.create(source.attrs, source.content, source.marks)
    )
    return row.copy(Fragment.fromArray(cells))
  })
  return replaceTable(
    editor,
    info,
    info.table.copy(Fragment.fromArray(rows)),
    info.rowIndex,
    info.columnIndex + 1
  )
}

export function clearCurrentTableAxis(editor, axis) {
  const info = getActiveTableInfo(editor.state)
  if (!info) return false
  const paragraph = editor.state.schema.nodes.paragraph
  const rows = info.table.content.content.map((row, rowIndex) => row.copy(
    Fragment.fromArray(row.content.content.map((cell, columnIndex) => {
      const shouldClear = axis === 'row'
        ? rowIndex === info.rowIndex
        : columnIndex === info.columnIndex
      if (!shouldClear) return cell
      return cell.type.create(cell.attrs, paragraph.create(), cell.marks)
    }))
  ))
  return replaceTable(
    editor,
    info,
    info.table.copy(Fragment.fromArray(rows))
  )
}

export function parseTabularText(text) {
  if (!text.includes('\t')) return null
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  if (!lines.length) return null
  const rows = lines.map(line => line.split('\t'))
  const columns = Math.max(...rows.map(row => row.length))
  return columns > 1 ? rows.map(row => [
    ...row,
    ...Array.from({ length: columns - row.length }, () => '')
  ]) : null
}

function paragraphWithText(schema, value) {
  return schema.nodes.paragraph.create(
    null,
    value ? schema.text(value) : undefined
  )
}

export function createTableFromGrid(schema, grid, withHeaderRow = true) {
  const rows = grid.map((values, rowIndex) => {
    const cellType = withHeaderRow && rowIndex === 0
      ? schema.nodes.tableHeader
      : schema.nodes.tableCell
    return schema.nodes.tableRow.create(
      null,
      values.map(value => cellType.create(null, paragraphWithText(schema, value)))
    )
  })
  return schema.nodes.table.create(null, rows)
}

function fillTableFromGrid(schema, info, grid) {
  const requiredRows = Math.max(info.table.childCount, info.rowIndex + grid.length)
  const currentColumns = Math.max(...info.table.content.content.map(row => row.childCount))
  const requiredColumns = Math.max(currentColumns, info.columnIndex + grid[0].length)
  const hasHeaderRow = info.table.firstChild?.firstChild?.type.name === 'tableHeader'
  const rows = []

  for (let rowIndex = 0; rowIndex < requiredRows; rowIndex += 1) {
    const existingRow = rowIndex < info.table.childCount ? info.table.child(rowIndex) : null
    const cells = []
    for (let columnIndex = 0; columnIndex < requiredColumns; columnIndex += 1) {
      const existingCell = existingRow && columnIndex < existingRow.childCount
        ? existingRow.child(columnIndex)
        : null
      const sourceRow = rowIndex - info.rowIndex
      const sourceColumn = columnIndex - info.columnIndex
      const pastedValue = grid[sourceRow]?.[sourceColumn]
      if (pastedValue !== undefined) {
        const cellType = existingCell?.type || (
          hasHeaderRow && rowIndex === 0 ? schema.nodes.tableHeader : schema.nodes.tableCell
        )
        cells.push(cellType.create(
          existingCell?.attrs,
          paragraphWithText(schema, pastedValue)
        ))
      } else if (existingCell) {
        cells.push(existingCell)
      } else {
        const cellType = hasHeaderRow && rowIndex === 0
          ? schema.nodes.tableHeader
          : schema.nodes.tableCell
        cells.push(cellType.create(null, paragraphWithText(schema, '')))
      }
    }
    rows.push(schema.nodes.tableRow.create(existingRow?.attrs, cells))
  }

  return info.table.type.create(info.table.attrs, rows)
}

const tableClipboardPluginKey = new PluginKey('tiptapTableClipboard')

export const TiptapTableClipboard = Extension.create({
  name: 'tiptapTableClipboard',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tableClipboardPluginKey,
        props: {
          handlePaste: (view, event) => {
            if (!view.editable) return false
            const clipboard = event.clipboardData
            const html = clipboard?.getData('text/html') || ''
            if (/<table[\s>]/i.test(html)) return false
            const grid = parseTabularText(clipboard?.getData('text/plain') || '')
            if (!grid) return false
            event.preventDefault()
            const info = getActiveTableInfo(view.state)
            if (!info) {
              const table = createTableFromGrid(view.state.schema, grid, true)
              const originalPosition = view.state.selection.from
              const transaction = view.state.tr.replaceSelectionWith(table)
              let tablePosition = null
              let closestDistance = Number.POSITIVE_INFINITY
              transaction.doc.descendants((node, position) => {
                if (node.type.name !== 'table') return true
                const distance = Math.abs(position - originalPosition)
                if (distance < closestDistance) {
                  tablePosition = position
                  closestDistance = distance
                }
                return false
              })
              if (tablePosition !== null) {
                const insertAt = tablePosition + table.nodeSize
                const nextNode = transaction.doc.resolve(insertAt).nodeAfter
                if (!(nextNode?.type.name === 'paragraph' && nextNode.content.size === 0)) {
                  transaction.insert(insertAt, view.state.schema.nodes.paragraph.create())
                }
              }
              view.dispatch(transaction.scrollIntoView())
              return true
            }
            const table = fillTableFromGrid(view.state.schema, info, grid)
            const transaction = view.state.tr.replaceWith(
              info.tablePosition,
              info.tablePosition + info.table.nodeSize,
              table
            )
            transaction.setSelection(TextSelection.near(
              transaction.doc.resolve(cellTextPosition(
                info.tablePosition,
                table,
                info.rowIndex,
                info.columnIndex
              ))
            ))
            view.dispatch(transaction.scrollIntoView())
            return true
          }
        }
      })
    ]
  }
})

export const TiptapTableNavigation = Extension.create({
  name: 'tiptapTableNavigation',
  priority: 120,
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => ensureParagraphAfterTable(this.editor),
      ArrowDown: () => {
        const info = getActiveTableInfo(this.editor.state)
        const { $from, empty } = this.editor.state.selection
        if (
          !info ||
          !empty ||
          info.rowIndex !== info.rowCount - 1 ||
          $from.parent.type.name !== 'paragraph' ||
          $from.parentOffset !== $from.parent.content.size
        ) {
          return false
        }

        let cellDepth = -1
        for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
          const name = $from.node(depth).type.name
          if (name === 'tableCell' || name === 'tableHeader') {
            cellDepth = depth
            break
          }
        }
        if (cellDepth < 0 || $from.index(cellDepth) !== $from.node(cellDepth).childCount - 1) {
          return false
        }
        return ensureParagraphAfterTable(this.editor)
      }
    }
  }
})

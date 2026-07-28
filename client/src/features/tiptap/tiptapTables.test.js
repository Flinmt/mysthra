import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import { TableKit } from '@tiptap/extension-table'
import Text from '@tiptap/extension-text'
import { TextSelection } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearCurrentTableAxis,
  createTableFromGrid,
  deleteCurrentTableAxis,
  duplicateCurrentTableAxis,
  ensureParagraphAfterTable,
  getActiveTableInfo,
  getTableInfoAtPosition,
  moveCurrentTableAxisTo,
  moveCurrentTableColumn,
  moveCurrentTableRow,
  parseTabularText,
  selectCurrentTableAxis,
  TiptapTableCell,
  TiptapTableClipboard,
  TiptapTableHeader,
  TiptapTableNavigation
} from './tiptapTables'

const TestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = []

function createEditor(content = '<p></p>') {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      TestDocument,
      Text,
      Paragraph,
      TableKit.configure({
        table: { resizable: true },
        tableCell: false,
        tableHeader: false
      }),
      TiptapTableCell,
      TiptapTableHeader,
      TiptapTableClipboard,
      TiptapTableNavigation
    ],
    content
  })
  editors.push(editor)
  return editor
}

function selectCell(editor, rowIndex, columnIndex) {
  const table = editor.state.doc.firstChild
  let position = 1
  for (let row = 0; row < rowIndex; row += 1) position += table.child(row).nodeSize
  position += 1
  for (let column = 0; column < columnIndex; column += 1) {
    position += table.child(rowIndex).child(column).nodeSize
  }
  editor.view.dispatch(editor.state.tr.setSelection(
    TextSelection.near(editor.state.doc.resolve(position + 2))
  ))
}

function tableTexts(editor) {
  return editor.state.doc.firstChild.content.content.map(row =>
    row.content.content.map(cell => cell.textContent)
  )
}

function pressKey(editor, key, options = {}) {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...options })
  let handled = false
  editor.view.someProp('handleKeyDown', handler => {
    if (handled) return true
    handled = handler(editor.view, event)
    return handled
  })
  return handled
}

afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy())
})

describe('Tiptap tables', () => {
  it('creates the requested dimensions and a header row by default', () => {
    const editor = createEditor()

    editor.commands.insertTable({ rows: 3, cols: 4, withHeaderRow: true })

    const table = editor.state.doc.firstChild
    expect(table.type.name).toBe('table')
    expect(table.childCount).toBe(3)
    expect(table.firstChild.childCount).toBe(4)
    expect(table.firstChild.firstChild.type.name).toBe('tableHeader')
    expect(table.firstChild.firstChild.attrs.align).toBe('left')
    expect(table.child(1).firstChild.type.name).toBe('tableCell')
    expect(table.child(1).firstChild.attrs.align).toBe('left')
    expect(getTableInfoAtPosition(editor.state, 4)).toMatchObject({
      rowIndex: 0,
      columnIndex: 0,
      cellPosition: 2
    })
  })

  it('normalizes imported cell alignment to the left', () => {
    const editor = createEditor(
      '<table><tbody><tr><td style="text-align: right"><p>A</p></td></tr></tbody></table>'
    )

    expect(editor.state.doc.firstChild.firstChild.firstChild.attrs.align).toBe('left')
    expect(editor.view.dom.querySelector('td').style.textAlign).toBe('left')
  })

  it('keeps cells aligned left and reorders rows and columns', () => {
    const editor = createEditor()
    const table = createTableFromGrid(editor.schema, [
      ['A', 'B'],
      ['C', 'D']
    ], false)
    editor.commands.setContent({ type: 'doc', content: [table.toJSON()] })
    selectCell(editor, 1, 1)

    expect(getActiveTableInfo(editor.state)).toMatchObject({ rowIndex: 1, columnIndex: 1 })
    expect(editor.state.doc.firstChild.firstChild.child(1).attrs.align).toBe('left')
    expect(editor.state.doc.firstChild.child(1).child(1).attrs.align).toBe('left')

    expect(moveCurrentTableColumn(editor, -1)).toBe(true)
    expect(tableTexts(editor)).toEqual([
      ['B', 'A'],
      ['D', 'C']
    ])
    expect(moveCurrentTableRow(editor, -1)).toBe(true)
    expect(tableTexts(editor)).toEqual([
      ['D', 'C'],
      ['B', 'A']
    ])
  })

  it('duplicates, clears and directly reorders table axes', () => {
    const editor = createEditor()
    const table = createTableFromGrid(editor.schema, [
      ['A', 'B'],
      ['C', 'D'],
      ['E', 'F']
    ], false)
    editor.commands.setContent({ type: 'doc', content: [table.toJSON()] })
    selectCell(editor, 1, 0)

    expect(duplicateCurrentTableAxis(editor, 'row')).toBe(true)
    expect(tableTexts(editor)).toEqual([
      ['A', 'B'],
      ['C', 'D'],
      ['C', 'D'],
      ['E', 'F']
    ])

    expect(clearCurrentTableAxis(editor, 'row')).toBe(true)
    expect(tableTexts(editor)[2]).toEqual(['', ''])
    expect(moveCurrentTableAxisTo(editor, 'row', 3)).toBe(true)
    expect(tableTexts(editor)[3]).toEqual(['', ''])

    expect(duplicateCurrentTableAxis(editor, 'column')).toBe(true)
    expect(editor.state.doc.firstChild.firstChild.childCount).toBe(3)
    expect(clearCurrentTableAxis(editor, 'column')).toBe(true)
    expect(tableTexts(editor).every(row => row[1] === '')).toBe(true)
    expect(moveCurrentTableAxisTo(editor, 'column', 2)).toBe(true)
    expect(tableTexts(editor).every(row => row[2] === '')).toBe(true)
  })

  it('keeps an active header at the first row or column during direct reordering', () => {
    const editor = createEditor()
    const table = createTableFromGrid(editor.schema, [
      ['A', 'B'],
      ['C', 'D']
    ])
    editor.commands.setContent({ type: 'doc', content: [table.toJSON()] })

    selectCell(editor, 1, 0)
    expect(moveCurrentTableAxisTo(editor, 'row', 0)).toBe(false)
    selectCell(editor, 0, 0)
    expect(moveCurrentTableAxisTo(editor, 'row', 1)).toBe(false)

    editor.commands.toggleHeaderColumn()
    selectCell(editor, 1, 1)
    expect(moveCurrentTableAxisTo(editor, 'column', 0)).toBe(false)
    selectCell(editor, 1, 0)
    expect(moveCurrentTableAxisTo(editor, 'column', 1)).toBe(false)
  })

  it('selects the complete current row or column for contextual controls', () => {
    const editor = createEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [createTableFromGrid(editor.schema, [
        ['A', 'B'],
        ['C', 'D']
      ]).toJSON()]
    })
    selectCell(editor, 1, 1)

    expect(selectCurrentTableAxis(editor, 'row')).toBe(true)
    expect(editor.state.selection).toBeInstanceOf(CellSelection)
    expect(editor.state.selection.isRowSelection()).toBe(true)
    expect(getActiveTableInfo(editor.state)).toMatchObject({
      rowIndex: 1,
      columnIndex: 0,
      rowCount: 2,
      columnCount: 2
    })

    expect(selectCurrentTableAxis(editor, 'column')).toBe(true)
    expect(editor.state.selection.isColSelection()).toBe(true)
  })

  it('deletes an axis and focuses the nearest surviving cell', () => {
    const editor = createEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [createTableFromGrid(editor.schema, [
        ['A', 'B'],
        ['C', 'D']
      ]).toJSON()]
    })
    selectCell(editor, 1, 1)
    selectCurrentTableAxis(editor, 'column')

    expect(deleteCurrentTableAxis(editor, 'column')).toBe(true)
    expect(editor.state.doc.firstChild.firstChild.childCount).toBe(1)
    expect(getActiveTableInfo(editor.state)).toMatchObject({
      rowIndex: 1,
      columnIndex: 0
    })
    expect(deleteCurrentTableAxis(editor, 'column')).toBe(false)
    expect(editor.state.doc.firstChild.type.name).toBe('table')
  })

  it('creates or reuses a paragraph after the table without duplicates', () => {
    const editor = createEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [createTableFromGrid(editor.schema, [['A']]).toJSON()]
    })
    selectCell(editor, 0, 0)

    expect(ensureParagraphAfterTable(editor, { focus: false })).toBe(true)
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.doc.lastChild.type.name).toBe('paragraph')

    expect(ensureParagraphAfterTable(editor)).toBe(true)
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('leaves the table with Mod+Enter or ArrowDown at the end of the last row', () => {
    const editor = createEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [createTableFromGrid(editor.schema, [
        ['A'],
        ['B']
      ]).toJSON()]
    })
    selectCell(editor, 1, 0)
    const lastCell = getActiveTableInfo(editor.state)
    editor.commands.setTextSelection(
      lastCell.cellPosition + 2 + lastCell.table.child(1).child(0).textContent.length
    )
    expect(pressKey(editor, 'ArrowDown')).toBe(true)
    expect(editor.state.doc.lastChild.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')

    editor.commands.setContent({
      type: 'doc',
      content: [createTableFromGrid(editor.schema, [['C']]).toJSON()]
    })
    selectCell(editor, 0, 0)
    expect(pressKey(editor, 'Enter', { ctrlKey: true })).toBe(true)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('parses TSV and creates a rectangular table', () => {
    const editor = createEditor()
    const grid = parseTabularText('Nome\tIdade\nAna\t30\n')
    const table = createTableFromGrid(editor.schema, grid)

    expect(grid).toEqual([
      ['Nome', 'Idade'],
      ['Ana', '30']
    ])
    expect(table.childCount).toBe(2)
    expect(table.firstChild.firstChild.type.name).toBe('tableHeader')
    expect(table.child(1).child(1).textContent).toBe('30')
  })

  it('pastes TSV into a table and expands it from the active cell', () => {
    const editor = createEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [createTableFromGrid(editor.schema, [['A'], ['B']]).toJSON()]
    })
    selectCell(editor, 1, 0)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: type => type === 'text/plain' ? 'C\tD\nE\tF' : ''
      }
    })

    editor.view.dom.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(tableTexts(editor)).toEqual([
      ['A', ''],
      ['C', 'D'],
      ['E', 'F']
    ])
  })

  it('keeps an editable block after a table pasted outside a table', () => {
    const editor = createEditor()
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: type => type === 'text/plain' ? 'A\tB\nC\tD' : ''
      }
    })

    editor.view.dom.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(editor.state.doc.firstChild.type.name).toBe('table')
    expect(editor.state.doc.lastChild.type.name).toBe('paragraph')
  })
})

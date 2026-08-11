import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Eraser,
  GripHorizontal,
  GripVertical,
  Heading,
  TableColumnsSplit,
  Trash2
} from 'lucide-react'
import {
  clearCurrentTableAxis,
  deleteCurrentTableAxis,
  duplicateCurrentTableAxis,
  getTableInfoAtPosition,
  moveCurrentTableAxisTo,
  selectTableAxisAtCell
} from './tiptapTables'
import { autoScrollEditorDuringDrag } from './tiptapBlocks'

const TABLE_AXIS_MENU_WIDTH = 210

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

function containsTarget(container, target) {
  return target instanceof Node && Boolean(container?.contains(target))
}

function getActiveEditorView(editor) {
  if (!editor || editor.isDestroyed) return null
  try {
    return editor.view || null
  } catch {
    return null
  }
}

function getTableInfoFromCellElement(editor, cell) {
  const view = getActiveEditorView(editor)
  if (!view) return null
  const row = cell.parentElement
  const table = row?.closest('table')
  if (!row || !table) return null
  const rowIndex = Array.from(table.querySelectorAll('tr')).indexOf(row)
  const columnIndex = Array.from(row.children).indexOf(cell)
  let tablePosition = null
  let tableNode = null

  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'table') return true
    const dom = view.nodeDOM(position)
    if (dom === table || (dom instanceof HTMLElement && dom.contains(table))) {
      tablePosition = position
      tableNode = node
    }
    return false
  })
  if (tablePosition === null || !tableNode?.child(rowIndex)?.child(columnIndex)) {
    return null
  }

  let cellPosition = tablePosition + 2
  for (let index = 0; index < rowIndex; index += 1) {
    cellPosition += tableNode.child(index).nodeSize
  }
  const tableRow = tableNode.child(rowIndex)
  for (let index = 0; index < columnIndex; index += 1) {
    cellPosition += tableRow.child(index).nodeSize
  }
  return getTableInfoAtPosition(editor.state, cellPosition + 1)
}

function AxisMenu({ axis, editor, info, labels, position, run }) {
  const isRow = axis === 'row'
  const count = isRow ? info.rowCount : info.columnCount
  const index = isRow ? info.rowIndex : info.columnIndex
  const hasHeaderRow = info.table.firstChild?.firstChild?.type.name === 'tableHeader'
  const hasHeaderColumn = info.table.content.content.every(
    row => row.firstChild?.type.name === 'tableHeader'
  )
  const label = `${isRow ? labels.row : labels.column} ${index + 1}`
  const BeforeIcon = isRow ? ArrowUp : ArrowLeft
  const AfterIcon = isRow ? ArrowDown : ArrowRight

  return (
    <div
      className="tiptap-table-axis-menu"
      style={position}
      role="menu"
      aria-label={label}
    >
      {isRow && index === 0 && (
        <MenuToggle
          checked={hasHeaderRow}
          onClick={() => run(() => editor.chain().focus().toggleHeaderRow().run())}
        >
          <Heading size={13} />
          {labels.headerRow}
        </MenuToggle>
      )}
      {!isRow && index === 0 && (
        <MenuToggle
          checked={hasHeaderColumn}
          onClick={() => run(() => editor.chain().focus().toggleHeaderColumn().run())}
        >
          <TableColumnsSplit size={13} />
          {labels.headerColumn}
        </MenuToggle>
      )}
      {index === 0 && <div className="tiptap-table-axis-menu-separator" />}
      <MenuAction onClick={() => run(() => (
        isRow
          ? editorCommand(editor, 'addRowBefore')
          : editorCommand(editor, 'addColumnBefore')
      ))}>
        <BeforeIcon size={13} />
        {isRow ? labels.addRowAbove : labels.addColumnLeft}
      </MenuAction>
      <MenuAction onClick={() => run(() => (
        isRow
          ? editorCommand(editor, 'addRowAfter')
          : editorCommand(editor, 'addColumnAfter')
      ))}>
        <AfterIcon size={13} />
        {isRow ? labels.addRowBelow : labels.addColumnRight}
      </MenuAction>
      <MenuAction onClick={() => run(() => duplicateCurrentTableAxis(editor, axis))}>
        <Copy size={13} />
        {isRow ? labels.duplicateRow : labels.duplicateColumn}
      </MenuAction>
      <MenuAction onClick={() => run(() => clearCurrentTableAxis(editor, axis))}>
        <Eraser size={13} />
        {isRow ? labels.clearRow : labels.clearColumn}
      </MenuAction>
      <div className="tiptap-table-axis-menu-separator" />
      <MenuAction
        danger
        disabled={count <= 1}
        title={count <= 1 ? labels.cannotDeleteLast : undefined}
        onClick={() => run(() => deleteCurrentTableAxis(editor, axis))}
      >
        <Trash2 size={13} />
        {isRow ? labels.deleteRow : labels.deleteColumn}
      </MenuAction>
    </div>
  )
}

function editorCommand(editor, command) {
  return editor.chain().focus()[command]().run()
}

function MenuAction({ children, danger = false, disabled, onClick, title }) {
  return (
    <button
      type="button"
      className={danger ? 'is-danger' : ''}
      disabled={disabled}
      title={title}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      role="menuitem"
    >
      {children}
    </button>
  )
}

function MenuToggle({ checked, children, onClick }) {
  return (
    <button
      type="button"
      className="tiptap-table-menu-toggle"
      role="menuitemcheckbox"
      aria-checked={checked}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {children}
      <span className="tiptap-table-toggle-status">
        <span className="tiptap-table-toggle-switch" aria-hidden="true">
          <span />
        </span>
      </span>
    </button>
  )
}

export function TiptapTableControls({ editor, labels }) {
  const [activeMenu, setActiveMenu] = useState('')
  const [layout, setLayout] = useState(null)
  const [axisDrag, setAxisDrag] = useState(null)
  const [hoveredCellPosition, setHoveredCellPosition] = useState(null)
  const [lockedCellPosition, setLockedCellPosition] = useState(null)
  const layerRef = useRef(null)
  const layoutRef = useRef(null)
  const axisDragRef = useRef(null)
  const axisDidDragRef = useRef(false)
  const activeCellPositionRef = useRef(null)
  const hoverExitTimerRef = useRef(null)
  const activeCellPosition = lockedCellPosition ?? hoveredCellPosition
  const isAxisDragging = Boolean(axisDrag)
  const updateAxisDrag = useCallback(value => {
    const nextValue = typeof value === 'function'
      ? value(axisDragRef.current)
      : value
    axisDragRef.current = nextValue
    setAxisDrag(nextValue)
  }, [])
  const cancelHoverExit = useCallback(() => {
    if (hoverExitTimerRef.current === null) return
    window.clearTimeout(hoverExitTimerRef.current)
    hoverExitTimerRef.current = null
  }, [])
  const scheduleHoverExit = useCallback(() => {
    cancelHoverExit()
    hoverExitTimerRef.current = window.setTimeout(() => {
      setHoveredCellPosition(null)
      hoverExitTimerRef.current = null
    }, 180)
  }, [cancelHoverExit])

  const updatePosition = useCallback((preferredPosition = activeCellPositionRef.current) => {
    if (
      !editor ||
      editor.isDestroyed ||
      !editor.isEditable ||
      preferredPosition === null
    ) {
      setLayout(null)
      return
    }
    const info = (
      getTableInfoAtPosition(editor.state, preferredPosition) ||
      getTableInfoAtPosition(editor.state, preferredPosition + 1)
    )
    if (!info) {
      setLayout(null)
      return
    }
    const view = getActiveEditorView(editor)
    if (!view) {
      setLayout(null)
      return
    }
    const tableDom = view.nodeDOM(info.tablePosition)
    const cellDom = view.nodeDOM(info.cellPosition)
    if (!(tableDom instanceof HTMLElement) || !(cellDom instanceof HTMLElement)) {
      setLayout(null)
      return
    }
    const tableRect = tableDom.getBoundingClientRect()
    const cellRect = cellDom.getBoundingClientRect()
    const columnHandleLeft = clamp(
      cellRect.left + (cellRect.width - 18) / 2,
      4,
      window.innerWidth - 22
    )
    const rowHandle = {
      left: clamp(tableRect.left - 10, 4, window.innerWidth - 22),
      top: clamp(
        cellRect.top + (cellRect.height - 18) / 2,
        4,
        window.innerHeight - 22
      )
    }
    const columnHandle = {
      left: columnHandleLeft,
      top: Math.max(4, tableRect.top - 9)
    }
    setLayout({
      info,
      tableRect,
      cellRect,
      rowHandle,
      columnHandle,
      columnHandleVisible: tableRect.top >= 0 && tableRect.top <= window.innerHeight - 20,
      rowMenu: {
        left: clamp(
          rowHandle.left + 27,
          8,
          window.innerWidth - TABLE_AXIS_MENU_WIDTH - 8
        ),
        top: clamp(rowHandle.top, 8, window.innerHeight - 270)
      },
      columnMenu: {
        left: clamp(
          columnHandle.left,
          8,
          window.innerWidth - TABLE_AXIS_MENU_WIDTH - 8
        ),
        top: clamp(columnHandle.top + 23, 8, window.innerHeight - 300)
      }
    })
  }, [editor])

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    activeCellPositionRef.current = activeCellPosition
    updatePosition(activeCellPosition)
  }, [activeCellPosition, updatePosition])

  useEffect(() => {
    const view = getActiveEditorView(editor)
    const editorDom = view?.dom
    if (!view || !editorDom) return undefined
    const activateFromPointer = event => {
      if (editor.isDestroyed || activeMenu || isAxisDragging) return
      cancelHoverExit()
      const cell = event.target.closest?.('td, th')
      if (!cell || !editorDom.contains(cell)) {
        scheduleHoverExit()
        return
      }
      try {
        const info = getTableInfoFromCellElement(editor, cell)
        setHoveredCellPosition(info?.cellPosition ?? null)
      } catch {
        setHoveredCellPosition(null)
      }
    }
    const clearPointer = event => {
      if (containsTarget(layerRef.current, event.relatedTarget)) {
        cancelHoverExit()
        return
      }
      scheduleHoverExit()
    }
    editorDom.addEventListener('pointermove', activateFromPointer)
    editorDom.addEventListener('pointerleave', clearPointer)
    return () => {
      editorDom.removeEventListener('pointermove', activateFromPointer)
      editorDom.removeEventListener('pointerleave', clearPointer)
    }
  }, [
    activeMenu,
    cancelHoverExit,
    editor,
    isAxisDragging,
    scheduleHoverExit
  ])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return undefined
    const reposition = () => updatePosition()
    editor.on('transaction', reposition)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      editor.off('transaction', reposition)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [editor, updatePosition])

  useEffect(() => cancelHoverExit, [cancelHoverExit])

  useEffect(() => {
    if (!activeMenu) return undefined
    const close = event => {
      if (event.target.closest?.('.tiptap-table-context-layer')) return
      setActiveMenu('')
      setLockedCellPosition(null)
    }
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return
      setActiveMenu('')
      setLockedCellPosition(null)
      getActiveEditorView(editor)?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [activeMenu, editor])

  useEffect(() => {
    if (!isAxisDragging) return undefined
    const view = getActiveEditorView(editor)
    const editorDom = view?.dom
    if (!view || !editorDom) return undefined
    const handleDragOver = event => {
      if (editor.isDestroyed) return
      autoScrollEditorDuringDrag(editor, event.clientY)
      const cell = event.target.closest?.('td, th')
      const table = cell?.closest('table')
      const currentLayout = layoutRef.current
      const currentDrag = axisDragRef.current
      if (!cell || !table || !currentLayout || !currentDrag) return
      const activeTableDom = view.nodeDOM(currentLayout.info.tablePosition)
      if (!(activeTableDom instanceof HTMLElement) || !activeTableDom.contains(table)) return
      event.preventDefault()
      const row = cell.parentElement
      const hoveredIndex = currentDrag.axis === 'row'
        ? Array.from(row.parentElement.children).indexOf(row)
        : Array.from(row.children).indexOf(cell)
      const rect = currentDrag.axis === 'row'
        ? row.getBoundingClientRect()
        : cell.getBoundingClientRect()
      const after = currentDrag.axis === 'row'
        ? event.clientY >= rect.top + rect.height / 2
        : event.clientX >= rect.left + rect.width / 2
      const count = currentDrag.axis === 'row'
        ? currentLayout.info.rowCount
        : currentLayout.info.columnCount
      const boundaryIndex = hoveredIndex + (after ? 1 : 0)
      const targetIndex = Math.min(
        boundaryIndex > currentDrag.sourceIndex ? boundaryIndex - 1 : boundaryIndex,
        count - 1
      )
      updateAxisDrag(current => ({
        ...current,
        targetIndex,
        indicator: currentDrag.axis === 'row'
          ? {
              left: currentLayout.tableRect.left,
              top: after ? rect.bottom : rect.top,
              width: currentLayout.tableRect.width,
              height: 2
            }
          : {
              left: after ? rect.right : rect.left,
              top: currentLayout.tableRect.top,
              width: 2,
              height: currentLayout.tableRect.height
            }
      }))
    }
    const finish = event => {
      if (event.type === 'drop') {
        event.preventDefault()
        event.stopPropagation()
      }
      const currentDrag = axisDragRef.current
      if (event.type === 'drop' && currentDrag && currentDrag.targetIndex !== null) {
        moveCurrentTableAxisTo(editor, currentDrag.axis, currentDrag.targetIndex)
      }
      updateAxisDrag(null)
      setLockedCellPosition(null)
      setHoveredCellPosition(null)
      window.setTimeout(() => {
        axisDidDragRef.current = false
      }, 0)
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', finish)
    document.addEventListener('dragend', finish)
    editorDom.addEventListener('drop', finish, true)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', finish)
      document.removeEventListener('dragend', finish)
      editorDom.removeEventListener('drop', finish, true)
    }
  }, [editor, isAxisDragging, updateAxisDrag])

  if (!layout || !editor?.isEditable) return null
  const { info } = layout
  const run = callback => {
    if (editor.isDestroyed) return
    callback()
    setActiveMenu('')
    setLockedCellPosition(null)
    window.requestAnimationFrame(() => updatePosition(hoveredCellPosition))
  }
  const openAxisMenu = axis => {
    selectTableAxisAtCell(editor, axis, info.cellPosition, { focus: false })
    setLockedCellPosition(info.cellPosition)
    setActiveMenu(axis)
    window.requestAnimationFrame(() => {
      updatePosition(info.cellPosition)
      layerRef.current
        ?.querySelector('.tiptap-table-axis-menu button:not(:disabled)')
        ?.focus()
    })
  }

  return (
    <div
      className="tiptap-table-context-layer"
      ref={layerRef}
      onPointerEnter={cancelHoverExit}
      onPointerLeave={event => {
        if (activeMenu || isAxisDragging) return
        const nextTarget = event.relatedTarget
        if (
          containsTarget(layerRef.current, nextTarget) ||
          containsTarget(getActiveEditorView(editor)?.dom, nextTarget)
        ) {
          cancelHoverExit()
          return
        }
        scheduleHoverExit()
      }}
    >
      <div
        className="tiptap-table-active-cell"
        style={{
          left: layout.cellRect.left,
          top: layout.cellRect.top,
          width: layout.cellRect.width,
          height: layout.cellRect.height
        }}
      />
      <button
        type="button"
        draggable
        className="tiptap-table-axis-handle is-row"
        style={layout.rowHandle}
        aria-label={`${labels.openRowMenu} ${info.rowIndex + 1}`}
        aria-expanded={activeMenu === 'row'}
        onPointerEnter={cancelHoverExit}
        onClick={() => {
          if (axisDidDragRef.current) {
            axisDidDragRef.current = false
            return
          }
          openAxisMenu('row')
        }}
        onDragStart={event => {
          axisDidDragRef.current = true
          const sourceIndex = info.rowIndex
          selectTableAxisAtCell(editor, 'row', info.cellPosition, { focus: false })
          setLockedCellPosition(info.cellPosition)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(
            'application/x-mysthra-table-axis',
            `row:${sourceIndex}`
          )
          setActiveMenu('')
          updateAxisDrag({ axis: 'row', sourceIndex, targetIndex: null, indicator: null })
        }}
      >
        <GripVertical size={13} />
      </button>
      {layout.columnHandleVisible && (
        <button
          type="button"
          draggable
          className="tiptap-table-axis-handle is-column"
          style={layout.columnHandle}
          aria-label={`${labels.openColumnMenu} ${info.columnIndex + 1}`}
          aria-expanded={activeMenu === 'column'}
          onPointerEnter={cancelHoverExit}
          onClick={() => {
            if (axisDidDragRef.current) {
              axisDidDragRef.current = false
              return
            }
            openAxisMenu('column')
          }}
          onDragStart={event => {
            axisDidDragRef.current = true
            const sourceIndex = info.columnIndex
            selectTableAxisAtCell(editor, 'column', info.cellPosition, { focus: false })
            setLockedCellPosition(info.cellPosition)
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(
              'application/x-mysthra-table-axis',
              `column:${sourceIndex}`
            )
            setActiveMenu('')
            updateAxisDrag({ axis: 'column', sourceIndex, targetIndex: null, indicator: null })
          }}
        >
          <GripHorizontal size={13} />
        </button>
      )}
      {activeMenu === 'row' && (
        <AxisMenu axis="row" editor={editor} info={info} labels={labels} position={layout.rowMenu} run={run} />
      )}
      {activeMenu === 'column' && (
        <AxisMenu axis="column" editor={editor} info={info} labels={labels} position={layout.columnMenu} run={run} />
      )}
      {axisDrag?.indicator && (
        <div className="tiptap-table-axis-drop-indicator" style={axisDrag.indicator} />
      )}
    </div>
  )
}

export function TiptapTableBlockMenu({ block, editor, labels, run }) {
  if (block.node.type.name !== 'table') return null
  const hasHeaderRow = block.node.firstChild?.firstChild?.type.name === 'tableHeader'
  const hasHeaderColumn = block.node.content.content.every(
    row => row.firstChild?.type.name === 'tableHeader'
  )
  const runTableCommand = command => run(() => {
    const chain = editor.chain().focus().setTextSelection(block.position + 4)
    return chain[command]().run()
  })

  return (
    <>
      <strong className="tiptap-block-menu-title">{labels.table}</strong>
      <MenuToggle
        checked={hasHeaderRow}
        onClick={() => runTableCommand('toggleHeaderRow')}
      >
        <Heading size={13} />
        {labels.headerRow}
      </MenuToggle>
      <MenuToggle
        checked={hasHeaderColumn}
        onClick={() => runTableCommand('toggleHeaderColumn')}
      >
        <TableColumnsSplit size={13} />
        {labels.headerColumn}
      </MenuToggle>
    </>
  )
}

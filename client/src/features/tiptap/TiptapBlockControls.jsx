import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListOrdered,
  Pilcrow,
  Plus,
  Quote,
  Trash2
} from 'lucide-react'
import {
  autoScrollEditorDuringDrag,
  createRootBlockDragPreview,
  deleteRootBlock,
  duplicateRootBlock,
  getRootBlockDropSlot,
  getRootBlockInfo,
  insertRootParagraph,
  rootBlockPositionFromPointer,
  selectRootBlock
} from './tiptapBlocks'
import {
  getSelectedRootBlocks,
  moveSelectedRootBlocks,
  selectRootBlockWithModifiers,
  setBlockSelection
} from './tiptapBlockSelection'
import {
  BLOCK_TRANSFORM_OPTIONS,
  canTransformRootBlock,
  getBlockTransformId,
  transformRootBlock
} from './tiptapBlockTransforms'

const BLOCK_MENU_WIDTH = 184

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

const TRANSFORM_ICONS = {
  paragraph: Pilcrow,
  'heading-1': Heading1,
  'heading-2': Heading2,
  'heading-3': Heading3,
  bulletList: List,
  orderedList: ListOrdered,
  blockquote: Quote,
  callout: Info
}

function BlockMenuAction({ active = false, children, danger = false, onClick }) {
  return (
    <button
      type="button"
      className={`${danger ? 'is-danger' : ''}${active ? ' is-active' : ''}`.trim()}
      role="menuitem"
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function TiptapBlockControls({
  editor,
  labels,
  renderExtraMenu
}) {
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [hoveredPosition, setHoveredPosition] = useState(null)
  const [pointerInsideEditor, setPointerInsideEditor] = useState(false)
  const [lockedPosition, setLockedPosition] = useState(null)
  const [layout, setLayout] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [transformMenuOpen, setTransformMenuOpen] = useState(false)
  const [dragState, setDragState] = useState(null)
  const layerRef = useRef(null)
  const dragStateRef = useRef(null)
  const didDragRef = useRef(false)
  const hoverExitTimerRef = useRef(null)
  const dragPreviewRef = useRef(null)
  const activePosition = lockedPosition ?? (
    pointerInsideEditor ? hoveredPosition : selectedPosition
  )
  const isDragging = Boolean(dragState)
  const updateDragState = useCallback(value => {
    const nextValue = typeof value === 'function'
      ? value(dragStateRef.current)
      : value
    dragStateRef.current = nextValue
    setDragState(nextValue)
  }, [])
  const cancelHoverExit = useCallback(() => {
    if (hoverExitTimerRef.current === null) return
    window.clearTimeout(hoverExitTimerRef.current)
    hoverExitTimerRef.current = null
  }, [])
  const clearDragPreview = useCallback(() => {
    dragPreviewRef.current?.destroy()
    dragPreviewRef.current = null
  }, [])
  const scheduleHoverExit = useCallback(() => {
    cancelHoverExit()
    hoverExitTimerRef.current = window.setTimeout(() => {
      setHoveredPosition(null)
      setPointerInsideEditor(false)
      hoverExitTimerRef.current = null
    }, 180)
  }, [cancelHoverExit])

  const updateLayout = useCallback(preferredPosition => {
    if (
      !editor ||
      editor.isDestroyed ||
      !editor.isEditable ||
      preferredPosition === null
    ) {
      setLayout(null)
      return
    }
    const view = getActiveEditorView(editor)
    if (!view) {
      setLayout(null)
      return
    }
    const info = getRootBlockInfo(editor.state, preferredPosition)
    const dom = info && view.nodeDOM(info.position)
    if (!info || !(dom instanceof HTMLElement)) {
      setLayout(null)
      return
    }
    const rect = dom.getBoundingClientRect()
    const top = clamp(rect.top + Math.min(8, Math.max(0, (rect.height - 22) / 2)), 4, window.innerHeight - 26)
    const gripLeft = clamp(rect.left - 30, 22, window.innerWidth - 24)
    const plusLeft = clamp(gripLeft - 22, 0, window.innerWidth - 46)
    const menuLeft = clamp(
      gripLeft,
      8,
      window.innerWidth - BLOCK_MENU_WIDTH - 8
    )
    const menuHeight = transformMenuOpen
      ? 258
      : info.node.type.name === 'table' ? 250 : 178
    setLayout({
      block: info,
      grip: { left: gripLeft, top },
      plus: { left: plusLeft, top },
      menu: {
        left: menuLeft,
        top: clamp(top + 25, 8, window.innerHeight - menuHeight)
      },
      rect
    })
  }, [editor, transformMenuOpen])

  useEffect(() => {
    const view = getActiveEditorView(editor)
    const editorDom = view?.dom
    if (!view || !editorDom) return undefined
    const activateFromSelection = () => {
      if (editor.isDestroyed) return
      const info = getRootBlockInfo(editor.state)
      setSelectedPosition(info?.position ?? null)
    }
    const activateFromPointer = event => {
      if (editor.isDestroyed || menuOpen || isDragging) return
      cancelHoverExit()
      setPointerInsideEditor(true)
      const info = rootBlockPositionFromPointer(
        editor,
        event.clientX,
        event.clientY
      )
      if (!info) {
        setHoveredPosition(null)
        return
      }
      setHoveredPosition(info.position)
    }
    const clearPointer = event => {
      if (containsTarget(layerRef.current, event.relatedTarget)) {
        cancelHoverExit()
        return
      }
      scheduleHoverExit()
    }
    activateFromSelection()
    editor.on('selectionUpdate', activateFromSelection)
    editor.on('transaction', activateFromSelection)
    editorDom.addEventListener('pointermove', activateFromPointer)
    editorDom.addEventListener('pointerleave', clearPointer)
    return () => {
      editor.off('selectionUpdate', activateFromSelection)
      editor.off('transaction', activateFromSelection)
      editorDom.removeEventListener('pointermove', activateFromPointer)
      editorDom.removeEventListener('pointerleave', clearPointer)
    }
  }, [
    cancelHoverExit,
    editor,
    isDragging,
    menuOpen,
    scheduleHoverExit
  ])

  useEffect(() => () => {
    cancelHoverExit()
    clearDragPreview()
  }, [cancelHoverExit, clearDragPreview])

  useEffect(() => {
    updateLayout(activePosition)
  }, [activePosition, updateLayout])

  useEffect(() => {
    const reposition = () => updateLayout(activePosition)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [activePosition, updateLayout])

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = event => {
      if (layerRef.current?.contains(event.target)) return
      setMenuOpen(false)
      setTransformMenuOpen(false)
      setLockedPosition(null)
    }
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return
      if (transformMenuOpen) {
        setTransformMenuOpen(false)
        return
      }
      setMenuOpen(false)
      setLockedPosition(null)
      getActiveEditorView(editor)?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [editor, menuOpen, transformMenuOpen])

  useEffect(() => {
    if (!isDragging) return undefined
    const view = getActiveEditorView(editor)
    const editorDom = view?.dom
    if (!view || !editorDom) return undefined
    const handleDragOver = event => {
      if (editor.isDestroyed) return
      autoScrollEditorDuringDrag(editor, event.clientY)
      const currentDrag = dragStateRef.current
      if (!currentDrag) return
      const slot = getRootBlockDropSlot(
        editor,
        event.clientX,
        event.clientY,
        { from: currentDrag.sourceFrom, to: currentDrag.sourceTo }
      )
      if (!slot) {
        updateDragState(current => ({
          ...current,
          targetPosition: null,
          indicator: null
        }))
        return
      }
      event.preventDefault()
      updateDragState(current => ({
        ...current,
        targetPosition: slot.position,
        indicator: {
          left: slot.left,
          top: slot.top,
          width: slot.width
        }
      }))
    }
    const handleDrop = event => {
      event.preventDefault()
      event.stopPropagation()
      const currentDrag = dragStateRef.current
      if (currentDrag && currentDrag.targetPosition !== null) {
        moveSelectedRootBlocks(editor, currentDrag.targetPosition)
      }
      updateDragState(null)
      setHoveredPosition(null)
      setPointerInsideEditor(false)
      setTransformMenuOpen(false)
      setLockedPosition(null)
      clearDragPreview()
      window.setTimeout(() => {
        didDragRef.current = false
      }, 0)
    }
    const handleEnd = () => {
      updateDragState(null)
      setHoveredPosition(null)
      setPointerInsideEditor(false)
      setTransformMenuOpen(false)
      setLockedPosition(null)
      clearDragPreview()
      window.setTimeout(() => {
        didDragRef.current = false
      }, 0)
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    document.addEventListener('dragend', handleEnd)
    editorDom.addEventListener('drop', handleDrop, true)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
      document.removeEventListener('dragend', handleEnd)
      editorDom.removeEventListener('drop', handleDrop, true)
    }
  }, [clearDragPreview, editor, isDragging, updateDragState])

  if (!layout || !editor?.isEditable) return null
  const run = callback => {
    if (editor.isDestroyed) return
    callback()
    setMenuOpen(false)
    setTransformMenuOpen(false)
    setHoveredPosition(null)
    setPointerInsideEditor(false)
    setLockedPosition(null)
    window.requestAnimationFrame(() => updateLayout(selectedPosition))
  }
  const insert = side => {
    if (editor.isDestroyed) return
    if (!insertRootParagraph(editor, layout.block.position, side)) return
    setMenuOpen(false)
    setTransformMenuOpen(false)
    setHoveredPosition(null)
    setPointerInsideEditor(false)
    setLockedPosition(null)
  }
  const extraMenu = renderExtraMenu?.({
    block: layout.block,
    close: () => setMenuOpen(false),
    run
  })
  const leaveControls = event => {
    if (menuOpen || isDragging) return
    const nextTarget = event.relatedTarget
    if (
      containsTarget(layerRef.current, nextTarget) ||
      containsTarget(getActiveEditorView(editor)?.dom, nextTarget)
    ) {
      cancelHoverExit()
      return
    }
    scheduleHoverExit()
  }

  return (
    <div
      className="tiptap-block-control-layer"
      ref={layerRef}
      onPointerEnter={cancelHoverExit}
      onPointerLeave={leaveControls}
    >
      <div
        className={`tiptap-block-selection${menuOpen || dragState ? ' is-active' : ''}`}
        style={{
          left: layout.rect.left,
          top: layout.rect.top,
          width: layout.rect.width,
          height: layout.rect.height
        }}
      />
      <button
        type="button"
        className="tiptap-block-add"
        style={layout.plus}
        aria-label={labels.add}
        title={labels.addHint}
        onMouseDown={event => event.preventDefault()}
        onPointerEnter={cancelHoverExit}
        onClick={event => insert(event.altKey ? 'before' : 'after')}
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        draggable
        className="tiptap-block-handle"
        style={layout.grip}
        aria-label={labels.menu}
        aria-expanded={menuOpen}
        title={labels.menu}
        onPointerEnter={cancelHoverExit}
        onClick={event => {
          if (didDragRef.current) {
            didDragRef.current = false
            return
          }
          const toggle = event.ctrlKey || event.metaKey
          const extend = event.shiftKey
          selectRootBlockWithModifiers(editor, layout.block.position, { toggle, extend })
          if (toggle || extend) {
            setMenuOpen(false)
            setTransformMenuOpen(false)
            setLockedPosition(layout.block.position)
            return
          }
          const opening = !menuOpen
          selectRootBlock(editor, layout.block.position)
          setLockedPosition(opening ? layout.block.position : null)
          setMenuOpen(opening)
          setTransformMenuOpen(false)
        }}
        onDragStart={event => {
          didDragRef.current = true
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(
            'application/x-mysthra-block',
            String(layout.block.position)
          )
          let selectedBlocks = getSelectedRootBlocks(editor)
          if (!selectedBlocks.some(block => block.position === layout.block.position)) {
            setBlockSelection(
              editor,
              layout.block.position,
              layout.block.position + layout.block.node.nodeSize
            )
            selectedBlocks = [{
              node: layout.block.node,
              position: layout.block.position
            }]
          }
          const sourceFrom = selectedBlocks[0].position
          const lastSelected = selectedBlocks.at(-1)
          const sourceTo = lastSelected.position + lastSelected.node.nodeSize
          clearDragPreview()
          const preview = createRootBlockDragPreview(
            editor,
            selectedBlocks.map(block => block.position)
          )
          if (preview && typeof event.dataTransfer.setDragImage === 'function') {
            dragPreviewRef.current = preview
            event.dataTransfer.setDragImage(preview.element, preview.offsetX, preview.offsetY)
          } else {
            preview?.destroy()
          }
          setMenuOpen(false)
          setTransformMenuOpen(false)
          setLockedPosition(layout.block.position)
          updateDragState({
            sourcePosition: layout.block.position,
            sourceFrom,
            sourceTo,
            targetPosition: null,
            indicator: null
          })
        }}
      >
        <GripVertical size={14} />
      </button>
      {menuOpen && (
        <div
          className="tiptap-block-menu"
          style={layout.menu}
          role="menu"
          aria-label={labels.actions}
          onPointerEnter={cancelHoverExit}
        >
          {transformMenuOpen ? (
            <>
              <BlockMenuAction onClick={() => setTransformMenuOpen(false)}>
                <ChevronLeft size={13} />
                {labels.transformBack}
              </BlockMenuAction>
              <div className="tiptap-block-menu-separator" />
              {BLOCK_TRANSFORM_OPTIONS.map(option => {
                const Icon = TRANSFORM_ICONS[option.id]
                return (
                  <BlockMenuAction
                    key={option.id}
                    active={getBlockTransformId(layout.block.node) === option.id}
                    onClick={() => run(() => {
                      transformRootBlock(editor, layout.block.position, option.id)
                    })}
                  >
                    <Icon size={13} />
                    {labels.transformTypes?.[option.id] || option.id}
                  </BlockMenuAction>
                )
              })}
            </>
          ) : (
            <>
              {extraMenu}
              {extraMenu && <div className="tiptap-block-menu-separator" />}
              {canTransformRootBlock(layout.block.node) && (
                <>
                  <BlockMenuAction onClick={() => setTransformMenuOpen(true)}>
                    <Pilcrow size={13} />
                    {labels.transform}
                    <ChevronRight className="tiptap-block-menu-chevron" size={12} />
                  </BlockMenuAction>
                  <div className="tiptap-block-menu-separator" />
                </>
              )}
              <BlockMenuAction onClick={() => insert('before')}>
                <ArrowUpToLine size={13} />
                {labels.insertAbove}
              </BlockMenuAction>
              <BlockMenuAction onClick={() => insert('after')}>
                <ArrowDownToLine size={13} />
                {labels.insertBelow}
              </BlockMenuAction>
              <BlockMenuAction onClick={() => run(() => duplicateRootBlock(editor, layout.block.position))}>
                <Copy size={13} />
                {labels.duplicate}
              </BlockMenuAction>
              <BlockMenuAction
                danger
                onClick={() => run(() => deleteRootBlock(editor, layout.block.position))}
              >
                <Trash2 size={13} />
                {labels.delete}
              </BlockMenuAction>
            </>
          )}
        </div>
      )}
      {dragState?.indicator && (
        <div className="tiptap-block-drop-indicator" style={dragState.indicator} />
      )}
    </div>
  )
}

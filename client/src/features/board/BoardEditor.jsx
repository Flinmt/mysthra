import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Circle, Ellipse, Line, Arrow, Text, Image as KonvaImage, Group, Transformer } from 'react-konva'
import { ArrowLeft, Circle as CircleIcon, Copy, Focus, Folder, FolderPlus, Grid2X2, Image, Link2, Minus, MousePointer2, Plus, Search, Settings, Square, StickyNote, Trash2, Type, Upload, Workflow, X } from 'lucide-react'
import * as Y from 'yjs'
import { useCollaborationRoom } from '../../hooks/useCollaborationRoom'

const DEFAULT_CANVAS = {
  backgroundColor: '#0b0d11',
  gridVisible: true,
  gridSize: 48
}

const DEFAULT_SETTINGS = {
  snapToGrid: false
}

const TOOL_LABELS = {
  select: 'Select',
  note: 'Note',
  text: 'Text',
  rect: 'Rectangle',
  circle: 'Circle',
  image: 'Image'
}

const NOTE_COLORS = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fecdd3', '#ddd6fe']
const FALLBACK_THEME_ACCENT = '#b96f3d'
const DEFAULT_TEXT_FILL = 'rgba(15, 23, 42, 0.74)'
const DEFAULT_TEXT_COLOR = '#f8fafc'
const DEFAULT_TEXT_FONT_SIZE = 22
const DEFAULT_TEXT_FONT_WEIGHT = '700'
const SHAPE_STROKE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#f8fafc']
const INLINE_TEXT_TYPES = new Set(['note', 'text'])
const CONNECTABLE_ITEM_TYPES = new Set(['note', 'text', 'rect', 'circle', 'image'])

function resolveCanvasBackground(backgroundColor, themeBackground) {
  if (!backgroundColor || backgroundColor.toLowerCase() === '#0b0d11') return themeBackground
  return backgroundColor
}

function readCssVariable(element, name, fallback) {
  if (!element) return fallback
  const value = getComputedStyle(element).getPropertyValue(name).trim()
  return value || fallback
}

function createId(prefix = 'board') {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readYState(yCanvas, ySettings, yItems) {
  return {
    canvas: { ...DEFAULT_CANVAS, ...Object.fromEntries(yCanvas.entries()) },
    settings: { ...DEFAULT_SETTINGS, ...Object.fromEntries(ySettings.entries()) },
    items: yItems.toArray()
  }
}

function replaceYItem(yItems, itemId, nextItem) {
  const index = yItems.toArray().findIndex(item => item.id === itemId)
  if (index === -1) return
  yItems.delete(index, 1)
  yItems.insert(index, [nextItem])
}

function removeYItem(yItems, itemId) {
  const index = yItems.toArray().findIndex(item => item.id === itemId)
  if (index === -1) return
  yItems.delete(index, 1)
}

function getItemBounds(item, allItems = []) {
  if (item.type === 'connector') {
    return getConnectorBounds(item, allItems)
  }
  if (item.type === 'line') {
    const points = item.props?.points || [0, 0, 180, 0]
    const xs = points.filter((_, index) => index % 2 === 0).map(point => point + item.x)
    const ys = points.filter((_, index) => index % 2 === 1).map(point => point + item.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    return { x: minX, y: minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY) }
  }
  return {
    x: item.x,
    y: item.y,
    width: item.width || 180,
    height: item.height || 110
  }
}

function getItemsBounds(items = [], allItems = items) {
  if (!items.length) return null
  const bounds = items.map(item => getItemBounds(item, allItems))
  const minX = Math.min(...bounds.map(box => box.x))
  const minY = Math.min(...bounds.map(box => box.y))
  const maxX = Math.max(...bounds.map(box => box.x + box.width))
  const maxY = Math.max(...bounds.map(box => box.y + box.height))
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  }
}

function getBoundsCenter(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

function cloneBoardItem(item, patch = {}) {
  return {
    ...item,
    ...patch,
    props: {
      ...(item.props || {}),
      ...(patch.props || {})
    }
  }
}

function getClipboardItemsFromSelection(selectedItems = [], allItems = []) {
  const normalItems = selectedItems
    .filter(item => item.type !== 'connector')
    .map(item => cloneBoardItem(item))
  const normalIds = new Set(normalItems.map(item => item.id))
  const connectors = allItems
    .filter(item => item.type === 'connector' && normalIds.has(item.props?.sourceId) && normalIds.has(item.props?.targetId))
    .map(item => cloneBoardItem(item))

  return [...normalItems, ...connectors]
}

function createPastedBoardItems(items = [], options = {}) {
  const offset = options.offset ?? 24
  const sourceBounds = options.targetPoint ? getItemsBounds(items.filter(item => item.type !== 'connector'), items) : null
  const dx = sourceBounds ? options.targetPoint.x - (sourceBounds.x + sourceBounds.width / 2) : offset
  const dy = sourceBounds ? options.targetPoint.y - (sourceBounds.y + sourceBounds.height / 2) : offset
  const idMap = new Map()
  const normalItems = items.filter(item => item.type !== 'connector')
  const pastedItems = normalItems.map(item => {
    const id = createId('board-item')
    idMap.set(item.id, id)
    return cloneBoardItem(item, {
      id,
      x: item.x + dx,
      y: item.y + dy
    })
  })
  const pastedConnectors = items
    .filter(item => item.type === 'connector' && idMap.has(item.props?.sourceId) && idMap.has(item.props?.targetId))
    .map(item => cloneBoardItem(item, {
      id: createId('board-item'),
      props: {
        sourceId: idMap.get(item.props.sourceId),
        targetId: idMap.get(item.props.targetId)
      }
    }))

  return [...pastedItems, ...pastedConnectors]
}

function getConnectorAnchor(bounds, toward) {
  const center = getBoundsCenter(bounds)
  const dx = toward.x - center.x
  const dy = toward.y - center.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: dx >= 0 ? bounds.x + bounds.width : bounds.x, y: center.y, side: dx >= 0 ? 'right' : 'left' }
  }
  return { x: center.x, y: dy >= 0 ? bounds.y + bounds.height : bounds.y, side: dy >= 0 ? 'bottom' : 'top' }
}

function getOrthogonalConnectorPoints(sourceBounds, targetBounds) {
  const sourceCenter = getBoundsCenter(sourceBounds)
  const targetCenter = getBoundsCenter(targetBounds)
  const source = getConnectorAnchor(sourceBounds, targetCenter)
  const target = getConnectorAnchor(targetBounds, sourceCenter)

  if (source.side === 'left' || source.side === 'right') {
    const midX = source.x + (target.x - source.x) / 2
    return [source.x, source.y, midX, source.y, midX, target.y, target.x, target.y]
  }
  const midY = source.y + (target.y - source.y) / 2
  return [source.x, source.y, source.x, midY, target.x, midY, target.x, target.y]
}

function getConnectorPoints(connector, allItems = [], draftPoint = null) {
  const source = allItems.find(item => item.id === connector.props?.sourceId)
  const target = allItems.find(item => item.id === connector.props?.targetId)
  if (!source) return []
  const sourceBounds = getItemBounds(source, allItems)
  if (target) return getOrthogonalConnectorPoints(sourceBounds, getItemBounds(target, allItems))
  if (!draftPoint) return []
  const draftBounds = { x: draftPoint.x, y: draftPoint.y, width: 1, height: 1 }
  return getOrthogonalConnectorPoints(sourceBounds, draftBounds)
}

function getConnectorBounds(connector, allItems = [], draftPoint = null) {
  const points = getConnectorPoints(connector, allItems, draftPoint)
  if (!points.length) return { x: connector.x || 0, y: connector.y || 0, width: 1, height: 1 }
  const xs = points.filter((_, index) => index % 2 === 0)
  const ys = points.filter((_, index) => index % 2 === 1)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY) }
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
}

function getTreeChildrenForLinks(nodes = []) {
  const entries = []
  const walk = (items, depth = 0) => {
    for (const item of items) {
      if (item.type !== 'container') continue
      entries.push({ ...item, depth })
      walk(item.children || [], depth + 1)
    }
  }
  walk(nodes)
  return entries
}

function getTabsForLinkedDocument(tree = [], documentPath = '') {
  if (!documentPath) return []
  const find = (nodes) => {
    for (const node of nodes) {
      if (node.path === documentPath) return node
      const child = find(node.children || [])
      if (child) return child
    }
    return null
  }
  return (find(tree)?.children || []).filter(child => child.type === 'tab')
}

function normalizeAssetSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getAssetNodeByPath(nodes = [], path = '') {
  for (const node of nodes) {
    if (node.path === path) return node
    const child = getAssetNodeByPath(node.children || [], path)
    if (child) return child
  }
  return null
}

function getAssetFolderChildren(assetTree = [], folderPath = '') {
  if (!folderPath) return assetTree
  const folder = getAssetNodeByPath(assetTree, folderPath)
  return folder?.type === 'folder' ? folder.children || [] : []
}

function getSiblingAssetFolders(assetTree = [], parentPath = '') {
  return getAssetFolderChildren(assetTree, parentPath).filter(node => node.type === 'folder')
}

function getUniqueAssetFolderName(assetTree = [], parentPath = '', baseName = 'New folder') {
  const siblingNames = new Set(getSiblingAssetFolders(assetTree, parentPath).map(node => node.name))
  if (!siblingNames.has(baseName)) return baseName

  let suffix = 2
  while (siblingNames.has(`${baseName} ${suffix}`)) suffix += 1
  return `${baseName} ${suffix}`
}

function getAssetBreadcrumb(assetTree = [], folderPath = '', rootLabel = 'Assets root') {
  if (!folderPath) return [{ name: rootLabel, path: '' }]
  const crumbs = [{ name: rootLabel, path: '' }]
  const parts = folderPath.split('/').filter(Boolean)
  let currentPath = ''
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const node = getAssetNodeByPath(assetTree, currentPath)
    crumbs.push({ name: node?.name || part, path: currentPath })
  }
  return crumbs
}

function getParentAssetFolderPath(folderPath = '') {
  if (!folderPath) return ''
  const parts = folderPath.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

function getAssetSearchResults(nodes = [], query = '', folderPath = '') {
  const normalizedQuery = normalizeAssetSearch(query)
  const results = []
  const walk = (items = []) => {
    for (const node of items) {
      const isImage = node.mediaType === 'image'
      const isFolder = node.type === 'folder'
      const matches = normalizeAssetSearch(`${node.name || ''} ${node.path || ''}`).includes(normalizedQuery)
      if ((isFolder || isImage) && matches) results.push(node)
      if (isFolder) walk(node.children || [])
    }
  }
  walk(getAssetFolderChildren(nodes, folderPath))
  return results
}

function getRootFallbackAssetNodes(assetTree = [], assetImages = [], folderPath = '') {
  if (assetTree.length > 0 || folderPath) return []
  return assetImages.map(asset => ({ ...asset, type: 'file', mediaType: 'image' }))
}

function useImageSource(src) {
  const [image, setImage] = useState(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return undefined
    }
    const nextImage = new window.Image()
    nextImage.onload = () => setImage(nextImage)
    nextImage.onerror = () => setImage(null)
    nextImage.src = src
    return () => {
      nextImage.onload = null
      nextImage.onerror = null
    }
  }, [src])

  return image
}

function BoardGrid({ viewport, size, gridSize = 48 }) {
  const lines = []
  const visibleStartX = -viewport.x / viewport.scale
  const visibleStartY = -viewport.y / viewport.scale
  const visibleEndX = visibleStartX + size.width / viewport.scale
  const visibleEndY = visibleStartY + size.height / viewport.scale
  const startX = Math.floor(visibleStartX / gridSize) * gridSize
  const startY = Math.floor(visibleStartY / gridSize) * gridSize

  for (let x = startX; x <= visibleEndX; x += gridSize) {
    lines.push(<Line key={`x-${x}`} points={[x, visibleStartY, x, visibleEndY]} stroke="rgba(255,255,255,0.07)" strokeWidth={1} listening={false} />)
  }
  for (let y = startY; y <= visibleEndY; y += gridSize) {
    lines.push(<Line key={`y-${y}`} points={[visibleStartX, y, visibleEndX, y]} stroke="rgba(255,255,255,0.07)" strokeWidth={1} listening={false} />)
  }
  return <>{lines}</>
}

function BoardImageItem({ item, draggable, isHovered, isSelected, selectionColor, getAssetUrl, registerNode, onSelect, onChange, onEdit, onHover, onDragStart, onDragMove, onDragEnd }) {
  const image = useImageSource(item.props?.assetPath ? getAssetUrl(item.props.assetPath) : '')
  return (
    <KonvaImage
      ref={node => registerNode(item.id, node)}
      image={image}
      x={item.x}
      y={item.y}
      width={item.width || 220}
      height={item.height || 150}
      rotation={item.rotation || 0}
      stroke={isSelected ? selectionColor : isHovered ? 'rgba(255,255,255,0.48)' : undefined}
      strokeWidth={isSelected ? 2 : isHovered ? 1 : 0}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onEdit}
      onDblTap={onEdit}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover('')}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={event => {
        const node = event.target
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onChange({
          ...item,
          x: node.x(),
          y: node.y(),
          width: Math.max(40, node.width() * scaleX),
          height: Math.max(40, node.height() * scaleY),
          rotation: node.rotation()
        })
      }}
    />
  )
}

export default function BoardEditor({
  worldId,
  collaborationRoom,
  currentUser,
  isVisitor = false,
  locked = false,
  themeBackground = DEFAULT_CANVAS.backgroundColor,
  themeAccent = FALLBACK_THEME_ACCENT,
  themeGlow = 'rgba(185, 111, 61, 0.28)',
  assetImages = [],
  assetTree = [],
  getAssetUrl,
  onRequestAssets,
  documentTree = [],
  onNavigateToLink,
  onCollaborationSaveState,
  labels = {}
}) {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const transformerRef = useRef(null)
  const itemNodesRef = useRef(new Map())
  const panSessionRef = useRef(null)
  const selectionMarqueeRef = useRef(null)
  const multiDragSessionRef = useRef(null)
  const clipboardRef = useRef([])
  const lastBoardPointerRef = useRef(null)
  const lastMouseClientRef = useRef(null)
  const fileInputRef = useRef(null)
  const userMovedViewportRef = useRef(false)
  const undoManagerRef = useRef(null)

  const [size, setSize] = useState({ width: 960, height: 640 })
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })
  const [tool, setTool] = useState('select')
  const [state, setState] = useState({ canvas: { ...DEFAULT_CANVAS, backgroundColor: themeBackground }, settings: DEFAULT_SETTINGS, items: [] })
  const [selectedId, setSelectedId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [hoveredId, setHoveredId] = useState('')
  const [isViewportPanning, setIsViewportPanning] = useState(false)
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [pendingImagePoint, setPendingImagePoint] = useState(null)
  const [assetSearchQuery, setAssetSearchQuery] = useState('')
  const [selectedAssetFolderPath, setSelectedAssetFolderPath] = useState('')
  const [creatingAssetFolder, setCreatingAssetFolder] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [itemEditor, setItemEditor] = useState({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const [drawingShape, setDrawingShape] = useState(null)
  const [selectionMarquee, setSelectionMarquee] = useState(null)
  const [dragPreviewItems, setDragPreviewItems] = useState([])
  const [connectorDraft, setConnectorDraft] = useState(null)
  const [connectorPulse, setConnectorPulse] = useState(0)
  const [inlineEditor, setInlineEditor] = useState({ isOpen: false, itemId: '', text: '' })
  const [selectionTheme, setSelectionTheme] = useState({
    accent: themeAccent,
    glow: themeGlow
  })
  const shapeStrokeColors = useMemo(() => [selectionTheme.accent, ...SHAPE_STROKE_COLORS.filter(color => color.toLowerCase() !== selectionTheme.accent.toLowerCase())], [selectionTheme.accent])

  const collaboration = useCollaborationRoom({
    roomName: collaborationRoom,
    currentUser,
    isVisitor,
    locked,
    sessionCache: true
  })
  const {
    doc: collaborationDoc,
    provider: collaborationProvider,
    readOnly: collaborationReadOnly,
    synced: collaborationSynced,
    saveStatus: collaborationSaveStatus,
    dirty: collaborationDirty,
    awarenessStates,
    setAwarenessField
  } = collaboration
  const readOnly = Boolean(isVisitor || locked || collaborationReadOnly)

  const yState = useMemo(() => {
    if (!collaborationDoc || !collaborationProvider) return null
    return {
      doc: collaborationDoc,
      yCanvas: collaborationDoc.getMap('boardCanvas'),
      ySettings: collaborationDoc.getMap('boardSettings'),
      yItems: collaborationDoc.getArray('boardItems')
    }
  }, [collaborationDoc, collaborationProvider])

  const remoteUsers = useMemo(() => awarenessStates
    .filter(state => state.clientId !== collaborationProvider?.awareness?.clientID)
    .map(state => ({ clientId: state.clientId, ...(state.user || {}), ...(state.board || {}) }))
    .filter(user => user.name), [awarenessStates, collaborationProvider])

  const selectedItemIds = useMemo(() => {
    const nextIds = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : [])
    const wanted = new Set(nextIds)
    return state.items.filter(item => wanted.has(item.id)).map(item => item.id)
  }, [selectedId, selectedIds, state.items])
  const selectedItems = useMemo(() => state.items.filter(item => selectedItemIds.includes(item.id)), [selectedItemIds, state.items])
  const selectedItem = selectedItems[0] || null
  const previewItems = useMemo(() => {
    if (dragPreviewItems.length === 0) return state.items
    const previewById = new Map(dragPreviewItems.map(item => [item.id, item]))
    return state.items.map(item => previewById.get(item.id) || item)
  }, [dragPreviewItems, state.items])
  const assetBreadcrumb = useMemo(
    () => getAssetBreadcrumb(assetTree, selectedAssetFolderPath, labels.assetsRootTarget || 'Assets root'),
    [assetTree, labels.assetsRootTarget, selectedAssetFolderPath]
  )
  const selectedAssetFolderName = assetBreadcrumb.at(-1)?.name || labels.assetsRootTarget || 'Assets root'
  const visibleAssetNodes = useMemo(() => {
    const query = assetSearchQuery.trim()
    const fallbackNodes = getRootFallbackAssetNodes(assetTree, assetImages, selectedAssetFolderPath)
    if (query) return [...getAssetSearchResults(assetTree, query, selectedAssetFolderPath), ...fallbackNodes.filter(asset => normalizeAssetSearch(`${asset.name || ''} ${asset.path || ''}`).includes(normalizeAssetSearch(query)))]
    return [...getAssetFolderChildren(assetTree, selectedAssetFolderPath), ...fallbackNodes]
      .filter(node => node.type === 'folder' || node.mediaType === 'image')
  }, [assetImages, assetSearchQuery, assetTree, selectedAssetFolderPath])
  const editedItem = state.items.find(item => item.id === itemEditor.itemId)
  const selectedPreviewItems = previewItems.filter(item => selectedItemIds.includes(item.id))
  const selectedBounds = selectedPreviewItems.length > 0 ? getItemsBounds(selectedPreviewItems, previewItems) : null
  const inlineItem = state.items.find(item => item.id === inlineEditor.itemId)
  const inlineBounds = inlineItem ? getItemBounds(inlineItem) : null
  const contextualBounds = selectedBounds ? {
    left: viewport.x + selectedBounds.x * viewport.scale,
    top: viewport.y + selectedBounds.y * viewport.scale,
    width: selectedBounds.width * viewport.scale,
    height: selectedBounds.height * viewport.scale
  } : null
  const selectedItemHasStyleMenu = selectedItems.length === 1 && selectedItem && ['note', 'text', 'rect', 'circle'].includes(selectedItem.type)
  const canStartConnector = selectedItems.length === 1 && selectedItem && CONNECTABLE_ITEM_TYPES.has(selectedItem.type)
  const contextualToolbarWidth = selectedItems.length > 1 ? 104 : selectedItem ? (INLINE_TEXT_TYPES.has(selectedItem.type) ? 42 : 0) + (canStartConnector ? 42 : 0) + (selectedItemHasStyleMenu ? 42 : 0) + 126 : 0
  const linkDocuments = useMemo(() => getTreeChildrenForLinks(documentTree), [documentTree])
  const filteredLinkDocuments = useMemo(() => {
    const query = linkSearchQuery.trim().toLowerCase()
    const linkedPath = editedItem?.props?.linkedDocumentPath || ''
    if (!query) return linkDocuments
    return linkDocuments.filter(document => {
      if (document.path === linkedPath) return true
      return `${document.name || ''} ${document.path || ''}`.toLowerCase().includes(query)
    })
  }, [editedItem?.props?.linkedDocumentPath, linkDocuments, linkSearchQuery])
  const linkedTabs = useMemo(
    () => getTabsForLinkedDocument(documentTree, editedItem?.props?.linkedDocumentPath || ''),
    [documentTree, editedItem?.props?.linkedDocumentPath]
  )

  const emitAwareness = useCallback((patch = {}) => {
    if (!collaborationProvider) return
    setAwarenessField('board', { tool, selectedId, selectedIds, ...patch })
  }, [collaborationProvider, selectedId, selectedIds, setAwarenessField, tool])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined
    setSelectionTheme({
      accent: readCssVariable(element, '--accent-color', themeAccent),
      glow: readCssVariable(element, '--accent-glow', themeGlow)
    })
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect
      setSize({ width: Math.max(320, rect.width), height: Math.max(320, rect.height) })
      setSelectionTheme({
        accent: readCssVariable(element, '--accent-color', themeAccent),
        glow: readCssVariable(element, '--accent-glow', themeGlow)
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [themeAccent, themeGlow])

  useEffect(() => {
    if (!yState) return undefined
    const { doc, yCanvas, ySettings, yItems } = yState
    onCollaborationSaveState?.({ status: collaborationSaveStatus, dirty: collaborationDirty })
    const updateState = () => setState(readYState(yCanvas, ySettings, yItems))
    const initialize = () => {
      if (readOnly || !collaborationSynced) return
      doc.transact(() => {
        if (!yCanvas.has('backgroundColor')) yCanvas.set('backgroundColor', themeBackground)
        if (!yCanvas.has('gridVisible')) yCanvas.set('gridVisible', DEFAULT_CANVAS.gridVisible)
        if (!yCanvas.has('gridSize')) yCanvas.set('gridSize', DEFAULT_CANVAS.gridSize)
        if (!ySettings.has('snapToGrid')) ySettings.set('snapToGrid', DEFAULT_SETTINGS.snapToGrid)
      })
      updateState()
    }
    yCanvas.observe(updateState)
    ySettings.observe(updateState)
    yItems.observe(updateState)
    initialize()
    updateState()
    return () => {
      yCanvas.unobserve(updateState)
      ySettings.unobserve(updateState)
      yItems.unobserve(updateState)
    }
  }, [collaborationDirty, collaborationSaveStatus, collaborationSynced, onCollaborationSaveState, readOnly, themeBackground, yState])

  useEffect(() => {
    if (!yState) {
      undoManagerRef.current = null
      return undefined
    }
    const undoManager = new Y.UndoManager([yState.yItems, yState.yCanvas, yState.ySettings], {
      captureTimeout: 500
    })
    undoManagerRef.current = undoManager
    return () => {
      undoManager.destroy()
      if (undoManagerRef.current === undoManager) undoManagerRef.current = null
    }
  }, [yState])

  useEffect(() => {
    emitAwareness()
  }, [emitAwareness])


  useEffect(() => {
    const hasSelectedConnectorEndpoint = state.items.some(item => item.type === 'connector' && (selectedItemIds.includes(item.props?.sourceId) || selectedItemIds.includes(item.props?.targetId)))
    if (!hasSelectedConnectorEndpoint) {
      setConnectorPulse(0)
      return undefined
    }
    let frameId = 0
    const tick = () => {
      setConnectorPulse(prev => (prev + 0.8) % 32)
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedItemIds, state.items])

  useEffect(() => {
    if (!transformerRef.current) return
    const node = selectedItems.length === 1 ? itemNodesRef.current.get(selectedItems[0].id) : null
    const item = selectedItems[0]
    transformerRef.current.nodes(node && !readOnly && item?.type !== 'line' && item?.type !== 'connector' ? [node] : [])
    transformerRef.current.getLayer()?.batchDraw()
  }, [readOnly, selectedItems])

  useEffect(() => {
    selectionMarqueeRef.current = selectionMarquee
  }, [selectionMarquee])

  useEffect(() => {
    const updateMouseClient = (event) => {
      lastMouseClientRef.current = { x: event.clientX, y: event.clientY }
    }
    document.addEventListener('mousemove', updateMouseClient, true)
    return () => document.removeEventListener('mousemove', updateMouseClient, true)
  }, [])

  const registerNode = useCallback((id, node) => {
    if (node) itemNodesRef.current.set(id, node)
    else itemNodesRef.current.delete(id)
  }, [])


  const setStageCursor = useCallback((cursor = '') => {
    const container = stageRef.current?.container()
    if (!container) return
    container.style.cursor = cursor
    container.querySelectorAll('canvas').forEach(canvas => {
      canvas.style.cursor = cursor
    })
  }, [])

  const handleItemHover = useCallback((itemId = '') => {
    setHoveredId(itemId)
    setStageCursor(itemId ? 'pointer' : '')
  }, [setStageCursor])

  const setSelection = useCallback((nextIds) => {
    const wanted = new Set(nextIds.filter(Boolean))
    const normalized = state.items.filter(item => wanted.has(item.id)).map(item => item.id)
    setSelectedIds(normalized)
    setSelectedId(normalized[0] || '')
    return normalized
  }, [state.items])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
    setSelectedId('')
  }, [])

  const stagePointToWorld = useCallback(() => {
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!pointer) return { x: 0, y: 0 }
    return {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale
    }
  }, [viewport])

  const getMousePointInBoard = useCallback(() => {
    const mouse = lastMouseClientRef.current
    const stageContainer = stageRef.current?.container()
    if (!mouse || !stageContainer) return null
    const rect = stageContainer.getBoundingClientRect()
    const stageX = mouse.x - rect.left
    const stageY = mouse.y - rect.top
    if (stageX < 0 || stageY < 0 || stageX > rect.width || stageY > rect.height) return null
    return {
      x: (stageX - viewport.x) / viewport.scale,
      y: (stageY - viewport.y) / viewport.scale
    }
  }, [viewport])


  const findConnectableItemAtPoint = useCallback((point, excludedId = '') => {
    for (let index = state.items.length - 1; index >= 0; index -= 1) {
      const item = state.items[index]
      if (item.id === excludedId || !CONNECTABLE_ITEM_TYPES.has(item.type)) continue
      const bounds = getItemBounds(item, state.items)
      if (point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height) return item
    }
    return null
  }, [state.items])

  const getVisibleCenterPoint = useCallback(() => ({
    x: (size.width / 2 - viewport.x) / viewport.scale,
    y: (size.height / 2 - viewport.y) / viewport.scale
  }), [size.height, size.width, viewport])

  useEffect(() => {
    if (!selectedAssetFolderPath) return
    if (!getAssetNodeByPath(assetTree, selectedAssetFolderPath)) setSelectedAssetFolderPath('')
  }, [assetTree, selectedAssetFolderPath])

  const updateItem = useCallback((nextItem) => {
    if (readOnly || !yState) return
    replaceYItem(yState.yItems, nextItem.id, nextItem)
  }, [readOnly, yState])

  const updateItems = useCallback((nextItems) => {
    if (readOnly || !yState || nextItems.length === 0) return
    yState.doc.transact(() => {
      nextItems.forEach(nextItem => replaceYItem(yState.yItems, nextItem.id, nextItem))
    })
  }, [readOnly, yState])

  const addItem = useCallback((item, options = {}) => {
    if (readOnly || !yState) return
    yState.yItems.push([item])
    setInlineEditor({ isOpen: false, itemId: '', text: '' })
    setSelection([item.id])
    setHoveredId('')
    setTool('select')
    if (options.editInline && INLINE_TEXT_TYPES.has(item.type)) {
      window.requestAnimationFrame(() => {
        setInlineEditor({ isOpen: true, itemId: item.id, text: item.props?.text || '' })
      })
    }
  }, [readOnly, setSelection, yState])

  const createItemAtPoint = useCallback((point, type, props = {}) => {
    const id = createId('board-item')
    if (type === 'note') {
      const width = 220
      const height = 150
      return { id, type, x: point.x - width / 2, y: point.y - height / 2, width, height, props: { text: labels.noteDefault || 'Note', color: NOTE_COLORS[0], ...props } }
    }
    if (type === 'text') {
      const width = 260
      const height = 120
      return {
        id,
        type,
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        props: {
          text: labels.textDefault || 'Text',
          color: DEFAULT_TEXT_COLOR,
          fill: DEFAULT_TEXT_FILL,
          fontSize: DEFAULT_TEXT_FONT_SIZE,
          fontWeight: DEFAULT_TEXT_FONT_WEIGHT,
          align: 'left',
          ...props
        }
      }
    }
    if (type === 'circle') {
      const width = 160
      const height = 120
      return { id, type, x: point.x - width / 2, y: point.y - height / 2, width, height, props: { fill: 'transparent', stroke: selectionTheme.accent, ...props } }
    }
    if (type === 'image') {
      const width = 240
      const height = 160
      return { id, type, x: point.x - width / 2, y: point.y - height / 2, width, height, props: { ...props } }
    }
    const width = 180
    const height = 110
    return { id, type: 'rect', x: point.x - width / 2, y: point.y - height / 2, width, height, props: { fill: 'transparent', stroke: selectionTheme.accent, ...props } }
  }, [labels.noteDefault, labels.textDefault, selectionTheme.accent])

  const commitInlineEdit = useCallback(() => {
    if (!inlineEditor.isOpen) return
    const item = state.items.find(nextItem => nextItem.id === inlineEditor.itemId)
    if (item && !readOnly) {
      updateItem({ ...item, props: { ...(item.props || {}), text: inlineEditor.text } })
    }
    setInlineEditor({ isOpen: false, itemId: '', text: '' })
  }, [inlineEditor.isOpen, inlineEditor.itemId, inlineEditor.text, readOnly, state.items, updateItem])


  const createConnector = useCallback((sourceId, targetId) => {
    if (readOnly || !yState || !sourceId || !targetId || sourceId === targetId) return
    const source = state.items.find(item => item.id === sourceId)
    const target = state.items.find(item => item.id === targetId)
    if (!source || !target || !CONNECTABLE_ITEM_TYPES.has(source.type) || !CONNECTABLE_ITEM_TYPES.has(target.type)) return
    const connector = {
      id: createId('board-item'),
      type: 'connector',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      props: {
        sourceId,
        targetId,
        stroke: selectionTheme.accent,
        arrowEnd: true
      }
    }
    yState.yItems.push([connector])
    setSelection([connector.id])
    setHoveredId('')
  }, [readOnly, selectionTheme.accent, setSelection, state.items, yState])

  const selectBoardItem = useCallback((event, itemId) => {
    event.cancelBubble = true
    commitInlineEdit()
    if (connectorDraft) {
      if (itemId !== connectorDraft.sourceId) createConnector(connectorDraft.sourceId, itemId)
      setConnectorDraft(null)
      setHoveredId('')
      return
    }
    const additive = Boolean(event?.evt?.shiftKey || event?.evt?.metaKey || event?.evt?.ctrlKey)
    if (additive) {
      const nextIds = selectedItemIds.includes(itemId)
        ? selectedItemIds.filter(id => id !== itemId)
        : [...selectedItemIds, itemId]
      setSelection(nextIds)
      return
    }
    setSelection([itemId])
  }, [commitInlineEdit, connectorDraft, createConnector, selectedItemIds, setSelection])

  const openItemEditor = useCallback((event, item, mode = 'style') => {
    event?.cancelBubble && (event.cancelBubble = true)
    event?.evt?.preventDefault?.()
    event?.evt?.stopPropagation?.()
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const pointer = stageRef.current?.getPointerPosition() || { x: size.width / 2, y: size.height / 2 }
    const popoverWidth = mode === 'link' ? 360 : 280
    const popoverHeight = mode === 'link' ? 390 : 220
    setSelection([item.id])
    setInlineEditor({ isOpen: false, itemId: '', text: '' })
    setLinkSearchQuery('')
    setItemEditor({
      isOpen: true,
      itemId: item.id,
      mode,
      x: Math.max(16, Math.min(size.width - popoverWidth - 16, pointer.x + 16)),
      y: Math.max(16, Math.min(size.height - popoverHeight - 16, pointer.y + 16))
    })
  }, [setSelection, size.height, size.width])

  const startInlineEdit = useCallback((event, item) => {
    event?.cancelBubble && (event.cancelBubble = true)
    if (readOnly || !INLINE_TEXT_TYPES.has(item.type)) return
    setSelection([item.id])
    setItemEditor({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })
    setInlineEditor({ isOpen: true, itemId: item.id, text: item.props?.text || '' })
  }, [readOnly, setSelection])

  const cancelInlineEdit = useCallback(() => {
    setInlineEditor({ isOpen: false, itemId: '', text: '' })
  }, [])

  const navigateItem = useCallback((item) => {
    if (!item?.props?.linkedDocumentPath && !item?.props?.linkedTabPath) return false
    onNavigateToLink?.(item.props || {})
    return true
  }, [onNavigateToLink])

  const getNormalizedShapeDraft = useCallback((draft) => {
    if (!draft) return null
    const x = Math.min(draft.start.x, draft.current.x)
    const y = Math.min(draft.start.y, draft.current.y)
    const width = Math.abs(draft.current.x - draft.start.x)
    const height = Math.abs(draft.current.y - draft.start.y)
    return { x, y, width, height }
  }, [])

  const beginViewportPan = useCallback((event) => {
    const pointer = event.target.getStage()?.getPointerPosition()
    if (!pointer) return false
    event.evt?.preventDefault?.()
    event.cancelBubble = true
    panSessionRef.current = { pointer, viewport }
    setIsViewportPanning(true)
    return true
  }, [viewport])

  const handleStagePointerDown = useCallback((event) => {
    if (event.evt?.button === 1) {
      beginViewportPan(event)
      return
    }
    if (event.target !== event.target.getStage()) return
    commitInlineEdit()
    setItemEditor({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })
    const point = stagePointToWorld()
    if (connectorDraft) {
      setConnectorDraft(null)
      setHoveredId('')
      return
    }
    if (tool === 'select') {
      selectionMarqueeRef.current = {
        start: point,
        current: point,
        baseIds: selectedItemIds,
        active: false
      }
      setSelectionMarquee(selectionMarqueeRef.current)
      return
    }
    if (readOnly) return
    if (tool === 'image') {
      setPendingImagePoint(point)
      setAssetPickerOpen(true)
      return
    }
    if (tool === 'rect' || tool === 'circle') {
      setDrawingShape({ type: tool, start: point, current: point })
      clearSelection()
      return
    }
    const item = createItemAtPoint(point, tool)
    addItem(item, { editInline: INLINE_TEXT_TYPES.has(item.type) })
  }, [addItem, beginViewportPan, commitInlineEdit, clearSelection, connectorDraft, createItemAtPoint, readOnly, selectedItemIds, stagePointToWorld, tool])

  const updateViewportPan = useCallback(() => {
    const session = panSessionRef.current
    if (!session) return
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    userMovedViewportRef.current = true
    setViewport({
      ...session.viewport,
      x: session.viewport.x + pointer.x - session.pointer.x,
      y: session.viewport.y + pointer.y - session.pointer.y
    })
  }, [])

  const updateSelectionMarquee = useCallback(() => {
    setSelectionMarquee(prev => {
      if (!prev) return prev
      const nextPoint = stagePointToWorld()
      const dx = nextPoint.x - prev.start.x
      const dy = nextPoint.y - prev.start.y
      const active = prev.active || Math.sqrt(dx * dx + dy * dy) > 4
      return { ...prev, current: nextPoint, active }
    })
  }, [stagePointToWorld])

  const finishSelectionMarquee = useCallback(() => {
    const marquee = selectionMarqueeRef.current
    if (!marquee) return false
    selectionMarqueeRef.current = null
    setSelectionMarquee(null)
    if (!marquee.active) {
      clearSelection()
      return true
    }
    const box = {
      x: Math.min(marquee.start.x, marquee.current.x),
      y: Math.min(marquee.start.y, marquee.current.y),
      width: Math.abs(marquee.current.x - marquee.start.x),
      height: Math.abs(marquee.current.y - marquee.start.y)
    }
    const hitIds = state.items
      .filter(item => rectsIntersect(box, getItemBounds(item, state.items)))
      .map(item => item.id)
    setSelection([...marquee.baseIds, ...hitIds])
    return true
  }, [clearSelection, setSelection, state.items])

  const updateShapeDrawing = useCallback(() => {
    if (!drawingShape) return
    setDrawingShape(prev => prev ? { ...prev, current: stagePointToWorld() } : prev)
  }, [drawingShape, stagePointToWorld])

  const finishShapeDrawing = useCallback(() => {
    if (!drawingShape) return false
    const box = getNormalizedShapeDraft(drawingShape)
    setDrawingShape(null)
    if (!box || box.width < 8 || box.height < 8 || readOnly || !yState) return true
    const item = {
      id: createId('board-item'),
      type: drawingShape.type,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      props: {
        fill: 'transparent',
        stroke: selectionTheme.accent
      }
    }
    yState.yItems.push([item])
    setSelection([item.id])
    setHoveredId('')
    setTool('select')
    return true
  }, [drawingShape, getNormalizedShapeDraft, readOnly, selectionTheme.accent, setSelection, yState])

  const endViewportPan = useCallback(() => {
    if (finishSelectionMarquee()) return
    if (finishShapeDrawing()) return
    panSessionRef.current = null
    setIsViewportPanning(false)
  }, [finishSelectionMarquee, finishShapeDrawing])

  const handleWheel = useCallback((event) => {
    event.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!pointer) return
    const scaleBy = 1.08
    const direction = event.evt.deltaY > 0 ? -1 : 1
    const nextScale = Math.min(3, Math.max(0.2, direction > 0 ? viewport.scale * scaleBy : viewport.scale / scaleBy))
    const mousePointTo = {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale
    }
    userMovedViewportRef.current = true
    setViewport({
      scale: nextScale,
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale
    })
  }, [viewport])

  const zoomBy = useCallback((factor) => {
    const center = { x: size.width / 2, y: size.height / 2 }
    const nextScale = Math.min(3, Math.max(0.2, viewport.scale * factor))
    const worldCenter = {
      x: (center.x - viewport.x) / viewport.scale,
      y: (center.y - viewport.y) / viewport.scale
    }
    setViewport({
      scale: nextScale,
      x: center.x - worldCenter.x * nextScale,
      y: center.y - worldCenter.y * nextScale
    })
  }, [size.height, size.width, viewport])

  const resetView = useCallback(() => {
    userMovedViewportRef.current = false
    setViewport({ x: size.width / 2 - 480, y: size.height / 2 - 320, scale: 1 })
  }, [size.height, size.width])

  useEffect(() => {
    if (userMovedViewportRef.current) return
    resetView()
  }, [resetView])

  const toggleGrid = useCallback(() => {
    if (!yState) return
    yState.yCanvas.set('gridVisible', !state.canvas.gridVisible)
  }, [state.canvas.gridVisible, yState])

  const deleteSelected = useCallback(() => {
    if (readOnly || selectedItemIds.length === 0 || !yState) return
    const idsToRemove = new Set(selectedItemIds)
    state.items.forEach(item => {
      if (item.type === 'connector' && (idsToRemove.has(item.props?.sourceId) || idsToRemove.has(item.props?.targetId))) idsToRemove.add(item.id)
    })
    yState.doc.transact(() => {
      Array.from(idsToRemove).forEach(itemId => removeYItem(yState.yItems, itemId))
    })
    clearSelection()
    setHoveredId('')
    setDrawingShape(null)
    setDragPreviewItems([])
    setConnectorDraft(null)
    setInlineEditor({ isOpen: false, itemId: '', text: '' })
    setItemEditor({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })
  }, [clearSelection, readOnly, selectedItemIds, state.items, yState])

  const duplicateSelected = useCallback(() => {
    if (readOnly || selectedItems.length === 0 || !yState) return
    const duplicates = createPastedBoardItems(getClipboardItemsFromSelection(selectedItems, state.items))
    if (duplicates.length === 0) return
    yState.doc.transact(() => {
      duplicates.forEach(duplicate => yState.yItems.push([duplicate]))
    })
    setSelection(duplicates.map(item => item.id))
    setHoveredId('')
  }, [readOnly, selectedItems, setSelection, state.items, yState])

  const copySelectedToClipboard = useCallback(() => {
    if (selectedItems.length === 0) return false
    const clipboardItems = getClipboardItemsFromSelection(selectedItems, state.items)
    if (clipboardItems.length === 0) return false
    clipboardRef.current = clipboardItems
    return true
  }, [selectedItems, state.items])

  const pasteClipboardItems = useCallback(() => {
    if (readOnly || !yState || clipboardRef.current.length === 0) return false
    const pastedItems = createPastedBoardItems(clipboardRef.current, { targetPoint: getMousePointInBoard() || lastBoardPointerRef.current })
    if (pastedItems.length === 0) return false
    yState.doc.transact(() => {
      pastedItems.forEach(item => yState.yItems.push([item]))
    })
    clipboardRef.current = pastedItems.map(item => cloneBoardItem(item))
    setSelection(pastedItems.map(item => item.id))
    setHoveredId('')
    setDrawingShape(null)
    setConnectorDraft(null)
    setInlineEditor({ isOpen: false, itemId: '', text: '' })
    setItemEditor({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })
    return true
  }, [getMousePointInBoard, readOnly, setSelection, yState])

  const cutSelectedToClipboard = useCallback(() => {
    if (readOnly || selectedItems.length === 0) return false
    if (!copySelectedToClipboard()) return false
    deleteSelected()
    return true
  }, [copySelectedToClipboard, deleteSelected, readOnly, selectedItems.length])

  const moveSelectedBy = useCallback((dx, dy) => {
    if (readOnly || selectedItems.length === 0) return
    updateItems(selectedItems.filter(item => item.type !== 'connector').map(item => ({
      ...item,
      x: item.x + dx,
      y: item.y + dy
    })))
  }, [readOnly, selectedItems, updateItems])

  const getMovedDragItems = useCallback((items, dx, dy) => (
    items.filter(item => item.type !== 'connector').map(item => ({
      ...item,
      x: item.x + dx,
      y: item.y + dy
    }))
  ), [])

  const previewSelectionDragBy = useCallback((items, dx, dy) => {
    if (readOnly || items.length === 0) return
    setDragPreviewItems(getMovedDragItems(items, dx, dy))
  }, [getMovedDragItems, readOnly])

  const moveSelectionDragBy = useCallback((items, dx, dy) => {
    if (readOnly || items.length === 0) return
    updateItems(getMovedDragItems(items, dx, dy))
  }, [getMovedDragItems, readOnly, updateItems])

  const getDraggedItemPosition = useCallback((node, item) => {
    if (item.type === 'circle') {
      return {
        x: node.x() - (item.width || 160) / 2,
        y: node.y() - (item.height || 120) / 2
      }
    }
    return { x: node.x(), y: node.y() }
  }, [])

  const beginItemDrag = useCallback((event, item) => {
    if (readOnly) {
      multiDragSessionRef.current = null
      setDragPreviewItems([])
      return
    }
    const dragItems = selectedItemIds.includes(item.id) && selectedItems.length > 1
      ? selectedItems
      : [item]
    const anchorPosition = getDraggedItemPosition(event.target, item)
    multiDragSessionRef.current = {
      anchorId: item.id,
      anchorX: anchorPosition.x,
      anchorY: anchorPosition.y,
      items: dragItems.map(dragItem => ({ ...dragItem }))
    }
    setDragPreviewItems([])
  }, [getDraggedItemPosition, readOnly, selectedItemIds, selectedItems])

  const updateItemDrag = useCallback((event, item) => {
    const session = multiDragSessionRef.current
    if (!session || session.anchorId !== item.id) return
    const position = getDraggedItemPosition(event.target, item)
    previewSelectionDragBy(session.items, position.x - session.anchorX, position.y - session.anchorY)
  }, [getDraggedItemPosition, previewSelectionDragBy])

  const endItemDrag = useCallback((event, item) => {
    const session = multiDragSessionRef.current
    if (session && session.anchorId === item.id) {
      const position = getDraggedItemPosition(event.target, item)
      moveSelectionDragBy(session.items, position.x - session.anchorX, position.y - session.anchorY)
      multiDragSessionRef.current = null
      setDragPreviewItems([])
      return
    }
    multiDragSessionRef.current = null
    setDragPreviewItems([])
    const position = getDraggedItemPosition(event.target, item)
    updateItem({ ...item, x: position.x, y: position.y })
  }, [getDraggedItemPosition, moveSelectionDragBy, updateItem])


  const startConnectorDraft = useCallback((event, item) => {
    event.preventDefault()
    event.stopPropagation()
    if (readOnly || !item || !CONNECTABLE_ITEM_TYPES.has(item.type)) return
    const bounds = getItemBounds(item, state.items)
    setConnectorDraft({ sourceId: item.id, currentPoint: getBoundsCenter(bounds), targetId: '' })
    setItemEditor({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })
    setInlineEditor({ isOpen: false, itemId: '', text: '' })
    setHoveredId('')
  }, [readOnly, state.items])

  const updateLinePoint = useCallback((item, pointIndex, x, y) => {
    if (readOnly || !item || item.type !== 'line') return
    const points = [...(item.props?.points || [0, 0, 180, 0])]
    points[pointIndex] = x - item.x
    points[pointIndex + 1] = y - item.y
    updateItem({ ...item, props: { ...(item.props || {}), points } })
  }, [readOnly, updateItem])

  useEffect(() => {
    const isTextEditingEvent = (event) => {
      const target = event.target
      const tagName = target?.tagName?.toLowerCase()
      return Boolean(target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select')
    }
    const isShortcut = (event, key) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return false
      const normalizedKey = String(event.key || '').toLowerCase()
      return normalizedKey === key || event.code === `Key${key.toUpperCase()}`
    }
    const handleCopy = (event) => {
      if (isTextEditingEvent(event) || selectedItems.length === 0) return
      event.preventDefault()
      copySelectedToClipboard()
    }
    const handleCut = (event) => {
      if (isTextEditingEvent(event) || selectedItems.length === 0 || readOnly) return
      event.preventDefault()
      cutSelectedToClipboard()
    }
    const handlePaste = (event) => {
      if (isTextEditingEvent(event) || readOnly || clipboardRef.current.length === 0) return
      event.preventDefault()
      pasteClipboardItems()
    }
    const handleKeyDown = (event) => {
      if (isTextEditingEvent(event)) return
      if (isShortcut(event, 'z')) {
        event.preventDefault()
        if (event.shiftKey) undoManagerRef.current?.redo()
        else undoManagerRef.current?.undo()
        return
      }
      if (isShortcut(event, 'y')) {
        event.preventDefault()
        undoManagerRef.current?.redo()
        return
      }
      if (isShortcut(event, 'c')) {
        if (selectedItems.length === 0) return
        event.preventDefault()
        copySelectedToClipboard()
        return
      }
      if (isShortcut(event, 'x')) {
        if (selectedItems.length === 0 || readOnly) return
        event.preventDefault()
        cutSelectedToClipboard()
        return
      }
      if (isShortcut(event, 'v')) {
        if (readOnly || clipboardRef.current.length === 0) return
        event.preventDefault()
        pasteClipboardItems()
        return
      }
      if (isShortcut(event, 'd')) {
        if (selectedItems.length === 0 || readOnly) return
        event.preventDefault()
        duplicateSelected()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        multiDragSessionRef.current = null
        setDragPreviewItems([])
        clearSelection()
        setHoveredId('')
        setItemEditor({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })
        setConnectorDraft(null)
        setSelectionMarquee(null)
        cancelInlineEdit()
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        if (selectedItems.length === 0 || readOnly) return
        event.preventDefault()
        const step = event.shiftKey ? 16 : 2
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        moveSelectedBy(dx, dy)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedItems.length === 0 || readOnly) return
        event.preventDefault()
        multiDragSessionRef.current = null
        setDragPreviewItems([])
        deleteSelected()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('copy', handleCopy, true)
    document.addEventListener('cut', handleCut, true)
    document.addEventListener('paste', handlePaste, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('copy', handleCopy, true)
      document.removeEventListener('cut', handleCut, true)
      document.removeEventListener('paste', handlePaste, true)
    }
  }, [cancelInlineEdit, clearSelection, copySelectedToClipboard, cutSelectedToClipboard, deleteSelected, duplicateSelected, moveSelectedBy, pasteClipboardItems, readOnly, selectedItems])

  const handleUpload = useCallback(async (event) => {
    const [file] = Array.from(event.target.files || [])
    event.target.value = ''
    if (!file || readOnly) return
    setUploading(true)
    try {
      const contentType = file.type || 'application/octet-stream'
      if (!contentType.startsWith('image/')) return
      const query = new URLSearchParams({ path: selectedAssetFolderPath, filename: file.name || `board-asset-${Date.now()}` })
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: file
      })
      if (!res.ok) return
      const uploaded = await res.json()
      await onRequestAssets?.()
      const point = pendingImagePoint || getVisibleCenterPoint()
      addItem(createItemAtPoint(point, 'image', { assetPath: uploaded.path }))
      setPendingImagePoint(null)
      setAssetPickerOpen(false)
      setAssetSearchQuery('')
    } finally {
      setUploading(false)
    }
  }, [addItem, createItemAtPoint, getVisibleCenterPoint, onRequestAssets, pendingImagePoint, readOnly, selectedAssetFolderPath, worldId])

  const createAssetFolder = useCallback(async () => {
    if (readOnly || creatingAssetFolder) return
    setCreatingAssetFolder(true)
    try {
      const folderName = getUniqueAssetFolderName(assetTree, selectedAssetFolderPath, labels.newAssetFolderName || labels.assetsNewFolder || 'New folder')
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: selectedAssetFolderPath, name: folderName })
      })
      if (!res.ok) return
      const folder = await res.json()
      await onRequestAssets?.()
      setSelectedAssetFolderPath(folder.path || '')
      setAssetSearchQuery('')
    } finally {
      setCreatingAssetFolder(false)
    }
  }, [assetTree, creatingAssetFolder, labels.assetsNewFolder, labels.newAssetFolderName, onRequestAssets, readOnly, selectedAssetFolderPath, worldId])

  const updateEditedItemProps = useCallback((patch) => {
    if (!editedItem) return
    updateItem({ ...editedItem, props: { ...(editedItem.props || {}), ...patch } })
  }, [editedItem, updateItem])

  const tools = [
    { id: 'select', icon: MousePointer2, label: labels.selectTool || TOOL_LABELS.select },
    { id: 'note', icon: StickyNote, label: labels.noteTool || TOOL_LABELS.note },
    { id: 'text', icon: Type, label: labels.textTool || TOOL_LABELS.text },
    { id: 'rect', icon: Square, label: labels.rectTool || TOOL_LABELS.rect },
    { id: 'circle', icon: CircleIcon, label: labels.circleTool || TOOL_LABELS.circle },
    { id: 'image', icon: Image, label: labels.imageTool || TOOL_LABELS.image }
  ].filter(item => !readOnly || item.id === 'select')

  return (
    <div
      ref={containerRef}
      className="board-editor-shell"
      onContextMenu={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onWheel={handleWheel}
        onMouseDown={handleStagePointerDown}
        onTouchStart={handleStagePointerDown}
        onMouseMove={() => {
          updateViewportPan()
          updateSelectionMarquee()
          updateShapeDrawing()
          const point = stagePointToWorld()
          lastBoardPointerRef.current = point
          if (connectorDraft) {
            const target = findConnectableItemAtPoint(point, connectorDraft.sourceId)
            setConnectorDraft(prev => prev ? { ...prev, currentPoint: point, targetId: target?.id || '' } : prev)
            setHoveredId(target?.id || '')
          }
          emitAwareness({ cursor: point })
        }}
        onTouchMove={() => updateShapeDrawing()}
        onMouseUp={endViewportPan}
        onTouchEnd={endViewportPan}
        onMouseLeave={() => {
          lastBoardPointerRef.current = null
          endViewportPan()
        }}
        className={`board-stage tool-${tool} ${drawingShape ? 'is-drawing-shape' : ''} ${connectorDraft ? 'is-connecting' : ''} ${isViewportPanning ? 'is-panning' : ''}`.trim()}
      >
        <Layer>
          <Rect x={-100000} y={-100000} width={200000} height={200000} fill={resolveCanvasBackground(state.canvas.backgroundColor, themeBackground)} listening={false} />
          {state.canvas.gridVisible && <BoardGrid viewport={viewport} size={size} gridSize={state.canvas.gridSize || 48} />}
          {previewItems.filter(item => item.type === 'connector').map(item => {
            const points = getConnectorPoints(item, previewItems)
            if (points.length === 0) return null
            const isSelected = selectedItemIds.includes(item.id)
            const isHovered = hoveredId === item.id
            const stroke = isSelected ? selectionTheme.accent : isHovered ? 'rgba(255,255,255,0.82)' : item.props?.stroke || selectionTheme.accent
            const isEndpointSelected = selectedItemIds.includes(item.props?.sourceId) || selectedItemIds.includes(item.props?.targetId)
            return (
              <Arrow
                key={item.id}
                ref={node => registerNode(item.id, node)}
                points={points}
                stroke={stroke}
                fill={stroke}
                strokeWidth={isSelected || isHovered || isEndpointSelected ? 3 : 2.25}
                pointerLength={12}
                pointerWidth={12}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={16}
                dash={isEndpointSelected ? [10, 7] : []}
                dashOffset={isEndpointSelected ? -connectorPulse : 0}
                opacity={isEndpointSelected ? 0.96 : 0.88}
                onClick={event => selectBoardItem(event, item.id)}
                onTap={event => selectBoardItem(event, item.id)}
                onMouseEnter={() => handleItemHover(item.id)}
                onMouseLeave={() => handleItemHover('')}
              />
            )
          })}
          {connectorDraft && (() => {
            const points = getConnectorPoints({ type: 'connector', props: { sourceId: connectorDraft.sourceId } }, previewItems, connectorDraft.currentPoint)
            if (!points.length) return null
            return <Arrow points={points} stroke={connectorDraft.targetId ? selectionTheme.accent : 'rgba(248,250,252,0.58)'} fill={connectorDraft.targetId ? selectionTheme.accent : 'rgba(248,250,252,0.58)'} strokeWidth={2.25} pointerLength={11} pointerWidth={11} lineCap="round" lineJoin="round" dash={connectorDraft.targetId ? [] : [8, 6]} listening={false} />
          })()}
          {previewItems.filter(item => item.type !== 'connector').map(item => {
            const isSelected = selectedItemIds.includes(item.id)
            const isHovered = hoveredId === item.id
            const draggable = !readOnly && tool === 'select' && !isViewportPanning
            const common = {
              ref: node => registerNode(item.id, node),
              x: item.x,
              y: item.y,
              width: item.width || 180,
              height: item.height || 110,
              rotation: item.rotation || 0,
              draggable,
              onClick: event => selectBoardItem(event, item.id),
              onTap: event => selectBoardItem(event, item.id),
              onDblClick: event => navigateItem(item) || (INLINE_TEXT_TYPES.has(item.type) ? startInlineEdit(event, item) : openItemEditor(event, item)),
              onDblTap: event => navigateItem(item) || (INLINE_TEXT_TYPES.has(item.type) ? startInlineEdit(event, item) : openItemEditor(event, item)),
              onMouseEnter: () => handleItemHover(item.id),
              onMouseLeave: () => handleItemHover(''),
              onContextMenu: event => openItemEditor(event, item),
              onDragStart: event => beginItemDrag(event, item),
              onDragMove: event => updateItemDrag(event, item),
              onDragEnd: event => endItemDrag(event, item),
              onTransformEnd: event => {
                const node = event.target
                const scaleX = node.scaleX()
                const scaleY = node.scaleY()
                node.scaleX(1)
                node.scaleY(1)
                updateItem({
                  ...item,
                  x: node.x(),
                  y: node.y(),
                  width: Math.max(40, node.width() * scaleX),
                  height: Math.max(32, node.height() * scaleY),
                  rotation: node.rotation()
                })
              }
            }

            if (item.type === 'image') {
              return <BoardImageItem key={item.id} item={item} isSelected={isSelected} isHovered={isHovered} selectionColor={selectionTheme.accent} draggable={draggable} getAssetUrl={getAssetUrl} registerNode={registerNode} onSelect={event => selectBoardItem(event, item.id)} onChange={updateItem} onEdit={event => openItemEditor(event, item)} onHover={handleItemHover} onDragStart={event => beginItemDrag(event, item)} onDragMove={event => updateItemDrag(event, item)} onDragEnd={event => endItemDrag(event, item)} />
            }
            if (item.type === 'circle') {
              return (
                <Ellipse
                  key={item.id}
                  {...common}
                  x={item.x + (item.width || 160) / 2}
                  y={item.y + (item.height || 120) / 2}
                  radiusX={(item.width || 160) / 2}
                  radiusY={(item.height || 120) / 2}
                  fill={item.props?.fill || 'transparent'}
                  stroke={isSelected ? selectionTheme.accent : isHovered ? 'rgba(255,255,255,0.62)' : item.props?.stroke || selectionTheme.accent}
                  strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
                  onTransformEnd={event => {
                    const node = event.target
                    const scaleX = node.scaleX()
                    const scaleY = node.scaleY()
                    node.scaleX(1)
                    node.scaleY(1)
                    const nextWidth = Math.max(40, node.radiusX() * 2 * scaleX)
                    const nextHeight = Math.max(32, node.radiusY() * 2 * scaleY)
                    updateItem({
                      ...item,
                      x: node.x() - nextWidth / 2,
                      y: node.y() - nextHeight / 2,
                      width: nextWidth,
                      height: nextHeight,
                      rotation: node.rotation()
                    })
                  }}
                />
              )
            }
            if (item.type === 'line') {
              return <Line key={item.id} ref={node => registerNode(item.id, node)} x={item.x} y={item.y} points={item.props?.points || [0, 0, 180, 0]} stroke={isSelected ? selectionTheme.accent : isHovered ? 'rgba(255,255,255,0.72)' : item.props?.stroke || '#f8fafc'} strokeWidth={isSelected || isHovered ? 4 : 3} lineCap="round" lineJoin="round" draggable={draggable} onClick={event => selectBoardItem(event, item.id)} onTap={event => selectBoardItem(event, item.id)} onDblClick={event => navigateItem(item) || openItemEditor(event, item)} onDblTap={event => navigateItem(item) || openItemEditor(event, item)} onMouseEnter={() => handleItemHover(item.id)} onMouseLeave={() => handleItemHover('')} onContextMenu={event => openItemEditor(event, item)} onDragStart={event => beginItemDrag(event, item)} onDragMove={event => updateItemDrag(event, item)} onDragEnd={event => endItemDrag(event, item)} />
            }
            if (item.type === 'text') {
              return (
                <Group key={item.id} {...common}>
                  <Rect
                    width={item.width || 260}
                    height={item.height || 120}
                    fill={item.props?.fill || DEFAULT_TEXT_FILL}
                    stroke={isSelected ? selectionTheme.accent : isHovered ? 'rgba(248,250,252,0.46)' : item.props?.stroke || 'rgba(148, 163, 184, 0.22)'}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 1.75 : 1}
                    cornerRadius={8}
                    shadowColor="#000"
                    shadowBlur={14}
                    shadowOpacity={0.2}
                    shadowOffsetY={6}
                  />
                  <Text
                    x={0}
                    y={0}
                    width={item.width || 260}
                    height={item.height || 120}
                    text={item.props?.text || ''}
                    fill={item.props?.color || DEFAULT_TEXT_COLOR}
                    fontSize={item.props?.fontSize || DEFAULT_TEXT_FONT_SIZE}
                    fontStyle={item.props?.fontWeight || DEFAULT_TEXT_FONT_WEIGHT}
                    lineHeight={1.22}
                    padding={14}
                    verticalAlign="middle"
                    align={item.props?.align || 'left'}
                    wrap="word"
                    listening={false}
                  />
                </Group>
              )
            }
            if (item.type === 'note') {
              return (
                <Group key={item.id} {...common}>
                  <Rect
                    width={item.width || 220}
                    height={item.height || 150}
                    fill={item.props?.color || NOTE_COLORS[0]}
                    stroke={isSelected ? selectionTheme.accent : isHovered ? 'rgba(15, 23, 42, 0.48)' : 'rgba(15, 23, 42, 0.24)'}
                    strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                    cornerRadius={10}
                    shadowColor="#000"
                    shadowBlur={16}
                    shadowOpacity={0.24}
                    shadowOffsetY={8}
                  />
                  <Text
                    x={0}
                    y={0}
                    width={item.width || 220}
                    height={item.height || 150}
                    text={item.props?.text || ''}
                    fill="#172033"
                    fontSize={18}
                    lineHeight={1.18}
                    padding={14}
                    verticalAlign="middle"
                    align="center"
                    wrap="word"
                    listening={false}
                  />
                </Group>
              )
            }
            return <Rect key={item.id} {...common} fill={item.props?.fill || 'transparent'} stroke={isSelected ? selectionTheme.accent : isHovered ? 'rgba(255,255,255,0.62)' : item.props?.stroke || selectionTheme.accent} strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2} cornerRadius={10} />
          })}
          {selectionMarquee?.active && (() => {
            const x = Math.min(selectionMarquee.start.x, selectionMarquee.current.x)
            const y = Math.min(selectionMarquee.start.y, selectionMarquee.current.y)
            const width = Math.abs(selectionMarquee.current.x - selectionMarquee.start.x)
            const height = Math.abs(selectionMarquee.current.y - selectionMarquee.start.y)
            return (
              <Rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="rgba(56, 189, 248, 0.12)"
                stroke={selectionTheme.accent}
                strokeWidth={1.5}
                dash={[8, 5]}
                cornerRadius={10}
                listening={false}
              />
            )
          })()}
          {drawingShape && (() => {
            const box = getNormalizedShapeDraft(drawingShape)
            if (!box) return null
            if (drawingShape.type === 'circle') {
              return (
                <Ellipse
                  x={box.x + box.width / 2}
                  y={box.y + box.height / 2}
                  radiusX={box.width / 2}
                  radiusY={box.height / 2}
                  fill="transparent"
                  stroke={selectionTheme.accent}
                  strokeWidth={2}
                  dash={[8, 5]}
                  listening={false}
                />
              )
            }
            return <Rect x={box.x} y={box.y} width={box.width} height={box.height} fill="transparent" stroke={selectionTheme.accent} strokeWidth={2} dash={[8, 5]} cornerRadius={10} listening={false} />
          })()}
          {selectedBounds && (
            <Rect
              x={selectedBounds.x - 7}
              y={selectedBounds.y - 7}
              width={selectedBounds.width + 14}
              height={Math.max(12, selectedBounds.height) + 14}
              cornerRadius={12}
              stroke={selectionTheme.accent}
              strokeWidth={2}
              dash={[10, 6]}
              shadowColor={selectionTheme.glow}
              shadowBlur={18}
              shadowOpacity={0.85}
              listening={false}
            />
          )}
          {selectedItem?.type === 'line' && !readOnly && (selectedItem.props?.points || [0, 0, 180, 0]).slice(0, 4).filter((_, index) => index % 2 === 0).map((_, handleIndex) => {
            const points = selectedItem.props?.points || [0, 0, 180, 0]
            const pointIndex = handleIndex * 2
            return (
              <Circle
                key={`line-handle-${handleIndex}`}
                x={selectedItem.x + points[pointIndex]}
                y={selectedItem.y + points[pointIndex + 1]}
                radius={7}
                fill={selectionTheme.accent}
                stroke="#ffffff"
                strokeWidth={2}
                draggable
                onDragMove={event => updateLinePoint(selectedItem, pointIndex, event.target.x(), event.target.y())}
                onDragEnd={event => updateLinePoint(selectedItem, pointIndex, event.target.x(), event.target.y())}
              />
            )
          })}
          {remoteUsers.filter(user => user.selectedId && user.selectedId !== selectedId).map(user => {
            const item = previewItems.find(nextItem => nextItem.id === user.selectedId)
            if (!item) return null
            const bounds = getItemBounds(item, previewItems)
            return <Rect key={`${user.clientId}-${item.id}`} x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} stroke={user.color} strokeWidth={2} dash={[8, 5]} listening={false} />
          })}
          <Transformer ref={transformerRef} rotateEnabled={selectedItems.length === 1} borderStroke={selectionTheme.accent} borderStrokeWidth={1.5} borderDash={[10, 6]} anchorFill={selectionTheme.accent} anchorStroke="#ffffff" anchorStrokeWidth={1.5} anchorCornerRadius={5} anchorSize={10} enabledAnchors={selectedItems.length === 1 ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right'] : []} />
        </Layer>
      </Stage>

      {contextualBounds && selectedItem && !inlineEditor.isOpen && !readOnly && (
        <div
          className="board-context-toolbar"
          style={{
            left: Math.max(16, Math.min(size.width - contextualToolbarWidth - 16, contextualBounds.left + contextualBounds.width / 2 - contextualToolbarWidth / 2)),
            top: Math.max(16, contextualBounds.top - 48)
          }}
        >
          {INLINE_TEXT_TYPES.has(selectedItem.type) && (
            <button type="button" onClick={event => startInlineEdit(event, selectedItem)} title={labels.itemText || 'Text'}>
              <Type size={15} />
            </button>
          )}
          {canStartConnector && (
            <button type="button" className={connectorDraft?.sourceId === selectedItem.id ? 'active' : ''} onClick={event => startConnectorDraft(event, selectedItem)} title={labels.connectItems || 'Connect items'}>
              <Workflow size={15} />
            </button>
          )}
          <button type="button" onClick={duplicateSelected} title={labels.duplicate || 'Duplicate'}>
            <Copy size={15} />
          </button>
          {selectedItemHasStyleMenu && selectedItems.length === 1 && (
            <button type="button" onClick={event => openItemEditor(event, selectedItem, 'style')} title={labels.itemEditorTitle || 'Board item'}>
              <Settings size={15} />
            </button>
          )}
          {selectedItems.length === 1 && selectedItem.type !== 'connector' && (
            <button type="button" onClick={event => openItemEditor(event, selectedItem, 'link')} title={labels.pageLink || 'Page link'}>
              <Link2 size={15} />
            </button>
          )}
          <button type="button" onClick={deleteSelected} title={labels.deleteSelected || 'Delete selected'}>
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {selectedItems.length > 1 && !inlineEditor.isOpen && !readOnly && (
        <div
          className="board-selection-count"
          style={{
            left: Math.max(16, Math.min(size.width - 180, contextualBounds ? contextualBounds.left : 16)),
            top: Math.max(16, (contextualBounds ? contextualBounds.top : 16) - 32)
          }}
        >
          {selectedItems.length} selected
        </div>
      )}

      {inlineEditor.isOpen && inlineItem && inlineBounds && (
        <textarea
          className={`board-inline-note-editor ${inlineItem.type === 'text' ? 'is-text' : 'is-note'}`}
          value={inlineEditor.text}
          autoFocus
          style={{
            left: viewport.x + inlineBounds.x * viewport.scale,
            top: viewport.y + inlineBounds.y * viewport.scale,
            width: inlineBounds.width * viewport.scale,
            height: inlineBounds.height * viewport.scale,
            fontSize: `${Math.max(12, (inlineItem.type === 'text' ? (inlineItem.props?.fontSize || DEFAULT_TEXT_FONT_SIZE) : 18) * viewport.scale)}px`,
            lineHeight: inlineItem.type === 'text' ? 1.22 : 1.18,
            textAlign: inlineItem.type === 'text' ? (inlineItem.props?.align || 'left') : 'center',
            padding: `${Math.max(8, 14 * viewport.scale)}px`,
            background: inlineItem.type === 'text' ? (inlineItem.props?.fill || DEFAULT_TEXT_FILL) : (inlineItem.props?.color || NOTE_COLORS[0])
          }}
          onChange={event => setInlineEditor(prev => ({ ...prev, text: event.target.value }))}
          onBlur={commitInlineEdit}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelInlineEdit()
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              commitInlineEdit()
            }
          }}
        />
      )}

      <div className="board-floating-dock" role="toolbar" aria-label={labels.toolbar || 'Board tools'}>
        {tools.map(({ id, icon: Icon, label }) => (
          <button key={id} type="button" className={tool === id ? 'active' : ''} onClick={() => { setTool(id); if (id === 'image' && !readOnly) { setPendingImagePoint(getVisibleCenterPoint()); setAssetPickerOpen(true) } }} title={label}>
            <Icon size={17} />
          </button>
        ))}
        <span className="map-dock-divider" />
        <button type="button" onClick={toggleGrid} title={labels.gridMode || 'Toggle grid'}>
          <Grid2X2 size={17} />
        </button>
        <span className="map-dock-divider" />
        <button type="button" onClick={() => zoomBy(0.86)} title={labels.zoomOut || 'Zoom out'}><Minus size={17} /></button>
        <button type="button" onClick={resetView} title={labels.resetView || 'Reset view'}><Focus size={17} /></button>
        <button type="button" onClick={() => zoomBy(1.16)} title={labels.zoomIn || 'Zoom in'}><Plus size={17} /></button>
        {!readOnly && <><span className="map-dock-divider" /><button type="button" onClick={deleteSelected} disabled={selectedItems.length === 0} title={labels.deleteSelected || 'Delete selected'}><Trash2 size={17} /></button></>}
      </div>

      {remoteUsers.length > 0 && <div className="board-status-strip">{remoteUsers.length} {labels.onlineUsers || 'online'}</div>}

      <div className="board-zoom-indicator">{Math.round(viewport.scale * 100)}%</div>

      <input ref={fileInputRef} type="file" accept="image/*,.gif" hidden onChange={handleUpload} />

      {assetPickerOpen && !readOnly && (
        <div className="board-asset-popover glass-panel">
          <div className="board-asset-popover-header">
            <div>
              <span>{selectedAssetFolderName}</span>
              <strong>{labels.insertImage || 'Insert image'}</strong>
            </div>
            <button type="button" aria-label="Close" onClick={() => { setAssetPickerOpen(false); setPendingImagePoint(null); setAssetSearchQuery('') }}>
              <X size={15} />
            </button>
          </div>

          <div className="board-asset-explorer-bar">
            <button type="button" className="board-asset-back-button" onClick={() => setSelectedAssetFolderPath(getParentAssetFolderPath(selectedAssetFolderPath))} disabled={!selectedAssetFolderPath}>
              <ArrowLeft size={15} />
            </button>
            <div className="board-asset-breadcrumb" aria-label="Asset folder path">
              {assetBreadcrumb.map((crumb, index) => (
                <button key={crumb.path || 'root'} type="button" onClick={() => setSelectedAssetFolderPath(crumb.path)} disabled={index === assetBreadcrumb.length - 1}>
                  {crumb.name}
                </button>
              ))}
            </div>
          </div>

          <div className="board-asset-search-bar">
            <Search size={15} />
            <input
              value={assetSearchQuery}
              placeholder={labels.assetsSearch || 'Filter assets...'}
              onChange={event => setAssetSearchQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') setAssetSearchQuery('')
              }}
            />
            {assetSearchQuery && (
              <button type="button" onClick={() => setAssetSearchQuery('')} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="board-asset-action-row">
            <button type="button" className="map-upload-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload size={15} />
              <span>{uploading ? labels.uploading || 'Uploading...' : labels.uploadImage || 'Upload image'}</span>
            </button>
            <button type="button" className="board-new-folder-button" onClick={createAssetFolder} disabled={creatingAssetFolder}>
              <FolderPlus size={15} />
              <span>{labels.assetsNewFolder || 'New folder'}</span>
            </button>
          </div>

          <div className="board-asset-picker-body">
            <div className="board-asset-explorer-grid">
              {visibleAssetNodes.length === 0 ? (
                <div className="map-asset-empty">{assetSearchQuery ? labels.noSearchResults || 'No results found' : labels.noAssetImages || 'No image assets yet.'}</div>
              ) : visibleAssetNodes.map(node => {
                const isFolder = node.type === 'folder'
                if (isFolder) {
                  return (
                    <button key={node.path} type="button" className="board-asset-card is-folder" onClick={() => { setSelectedAssetFolderPath(node.path); setAssetSearchQuery('') }}>
                      <span className="board-asset-folder-thumb"><Folder size={28} /></span>
                      <span>{node.name || node.path}</span>
                    </button>
                  )
                }
                return (
                  <button key={node.path} type="button" className="board-asset-card is-image" onClick={() => { addItem(createItemAtPoint(pendingImagePoint || getVisibleCenterPoint(), 'image', { assetPath: node.path })); setPendingImagePoint(null); setAssetPickerOpen(false); setAssetSearchQuery('') }}>
                    <img src={getAssetUrl(node.path)} alt="" />
                    <span>{node.name || node.path}</span>
                    {assetSearchQuery && <small>{node.path}</small>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {itemEditor.isOpen && editedItem && !readOnly && (
        <div className={`board-item-popover glass-panel is-${itemEditor.mode || 'style'}-mode`} style={{ left: itemEditor.x, top: itemEditor.y }}>
          <div className="board-item-popover-header">
            <div>
              <span>{itemEditor.mode === 'link' ? labels.pageLink || 'Page link' : editedItem.type}</span>
              <strong>{itemEditor.mode === 'link' ? labels.pageLink || 'Page link' : labels.itemEditorTitle || 'Board item'}</strong>
            </div>
            <button type="button" aria-label="Close" onClick={() => setItemEditor({ isOpen: false, itemId: '', mode: 'style', x: 0, y: 0 })}>
              <X size={16} />
            </button>
          </div>

          {(itemEditor.mode || 'style') === 'style' && (
            <>
              {editedItem.type === 'text' && (
                <>
                  <label className="board-popover-field">
                    <span>{labels.itemText || 'Text'}</span>
                    <textarea value={editedItem.props?.text || ''} onChange={event => updateEditedItemProps({ text: event.target.value })} />
                  </label>
                  <label className="board-popover-field">
                    <span>{labels.textSize || 'Text size'}</span>
                    <input
                      type="number"
                      min="12"
                      max="56"
                      value={editedItem.props?.fontSize || DEFAULT_TEXT_FONT_SIZE}
                      onChange={event => updateEditedItemProps({ fontSize: Math.max(12, Math.min(56, Number(event.target.value) || DEFAULT_TEXT_FONT_SIZE)) })}
                    />
                  </label>
                  <div className="board-popover-section">
                    <span>{labels.textAlign || 'Text align'}</span>
                    <div className="board-text-align-row">
                      {['left', 'center', 'right'].map(align => (
                        <button
                          key={align}
                          type="button"
                          className={(editedItem.props?.align || 'left') === align ? 'active' : ''}
                          onClick={() => updateEditedItemProps({ align })}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {editedItem.type === 'note' && (
                <div className="board-popover-section">
                  <span>{labels.itemColor || 'Color'}</span>
                  <div className="map-marker-color-row">
                    {NOTE_COLORS.map(color => <button key={color} type="button" className={editedItem.props?.color === color ? 'active' : ''} style={{ background: color }} onClick={() => updateEditedItemProps({ color })} />)}
                  </div>
                </div>
              )}
              {(editedItem.type === 'rect' || editedItem.type === 'circle') && (
                <div className="board-popover-section">
                  <span>{labels.shapeBorderColor || 'Border color'}</span>
                  <div className="board-stroke-color-row">
                    {shapeStrokeColors.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={(editedItem.props?.stroke || selectionTheme.accent) === color ? 'active' : ''}
                        style={{ '--stroke-color': color }}
                        onClick={() => updateEditedItemProps({ stroke: color })}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {itemEditor.mode === 'link' && (
            <div className="board-link-panel">
              <div className="board-link-panel-header">
                <div className="board-link-title">
                  <span className="board-link-icon"><Link2 size={15} /></span>
                  <strong>{labels.pageLink || 'Page link'}</strong>
                </div>
                <span className={`board-link-badge ${editedItem.props?.linkedDocumentPath ? 'is-linked' : ''}`}>
                  {editedItem.props?.linkedDocumentPath
                    ? labels.linkConfigured || 'Linked'
                    : labels.markerNoLink || 'No link'}
                </span>
              </div>
              <input
                className="board-link-search"
                value={linkSearchQuery}
                onChange={event => setLinkSearchQuery(event.target.value)}
                placeholder={labels.searchPageLink || 'Search pages...'}
              />
              <div className="board-link-select-grid">
                <label className="board-popover-field">
                  <span>{labels.linkedDocument || 'Document'}</span>
                  <div className="board-select-shell">
                    <select value={editedItem.props?.linkedDocumentPath || ''} onChange={event => updateEditedItemProps({ linkedDocumentPath: event.target.value, linkedTabPath: '' })}>
                      <option value="">{labels.markerNoLink || 'No link'}</option>
                      {filteredLinkDocuments.map(document => <option key={document.path} value={document.path}>{`${'  '.repeat(document.depth)}${document.name}`}</option>)}
                    </select>
                  </div>
                </label>
                <label className="board-popover-field">
                  <span>{labels.linkedTab || 'Tab'}</span>
                  <div className={`board-select-shell ${!editedItem.props?.linkedDocumentPath ? 'is-disabled' : ''}`}>
                    <select value={editedItem.props?.linkedTabPath || ''} disabled={!editedItem.props?.linkedDocumentPath} onChange={event => updateEditedItemProps({ linkedTabPath: event.target.value })}>
                      <option value="">{labels.markerDocumentDefaultTab || 'Document default tab'}</option>
                      {linkedTabs.map(tab => <option key={tab.path} value={tab.path}>{tab.name}</option>)}
                    </select>
                  </div>
                </label>
              </div>
              <div className="board-link-summary" title={editedItem.props?.linkedDocumentPath || labels.noPageLinked || 'No page selected'}>
                {editedItem.props?.linkedDocumentPath
                  ? `${editedItem.props.linkedDocumentPath}${editedItem.props?.linkedTabPath ? ` / ${editedItem.props.linkedTabPath.split('/').at(-1)}` : ''}`
                  : labels.noPageLinked || 'No page selected'}
              </div>
              <div className="board-link-actions">
                <button type="button" className="board-link-remove" disabled={!editedItem.props?.linkedDocumentPath && !editedItem.props?.linkedTabPath} onClick={() => updateEditedItemProps({ linkedDocumentPath: '', linkedTabPath: '' })}>{labels.markerRemoveLink || 'Remove link'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

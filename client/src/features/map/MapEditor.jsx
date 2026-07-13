import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Circle, Text, Image as KonvaImage, Group, Transformer, Path } from 'react-konva';
import { Focus, Grid2X2, Grid3X3, Hexagon, Image, MapPin, Minus, MousePointer2, Plus, Trash2, Type, Upload, Users } from 'lucide-react';
import DropdownSelect from '../../components/ui/DropdownSelect';
import { __iconNode as BookIconNode } from 'lucide-react/dist/esm/icons/book.mjs';
import { __iconNode as CastleIconNode } from 'lucide-react/dist/esm/icons/castle.mjs';
import { __iconNode as CircleHelpIconNode } from 'lucide-react/dist/esm/icons/circle-question-mark.mjs';
import { __iconNode as CrownIconNode } from 'lucide-react/dist/esm/icons/crown.mjs';
import { __iconNode as DoorOpenIconNode } from 'lucide-react/dist/esm/icons/door-open.mjs';
import { __iconNode as FlameIconNode } from 'lucide-react/dist/esm/icons/flame.mjs';
import { __iconNode as GemIconNode } from 'lucide-react/dist/esm/icons/gem.mjs';
import { __iconNode as HomeIconNode } from 'lucide-react/dist/esm/icons/house.mjs';
import { __iconNode as MapPinIconNode } from 'lucide-react/dist/esm/icons/map-pin.mjs';
import { __iconNode as MountainIconNode } from 'lucide-react/dist/esm/icons/mountain.mjs';
import { __iconNode as ShieldIconNode } from 'lucide-react/dist/esm/icons/shield.mjs';
import { __iconNode as SkullIconNode } from 'lucide-react/dist/esm/icons/skull.mjs';
import { __iconNode as StarIconNode } from 'lucide-react/dist/esm/icons/star.mjs';
import { __iconNode as SwordIconNode } from 'lucide-react/dist/esm/icons/sword.mjs';
import { __iconNode as TentIconNode } from 'lucide-react/dist/esm/icons/tent.mjs';
import { __iconNode as TreesIconNode } from 'lucide-react/dist/esm/icons/trees.mjs';
import { useCollaborationRoom } from '../../hooks/useCollaborationRoom';

const DEFAULT_CANVAS = {
  backgroundColor: '#0b0d11'
};

const DEFAULT_SETTINGS = {
  gridMode: 'free',
  gridSize: 64,
  gridVisible: true
};

const DEFAULT_LAYER = {
  id: 'default',
  name: 'Default',
  visible: true,
  locked: false,
  order: 0
};

const TOOL_LABELS = {
  select: 'Select',
  pan: 'Pan',
  marker: 'Marker',
  text: 'Text',
  image: 'Image'
};

const MARKER_ICON_NODES = {
  MapPin: MapPinIconNode,
  Castle: CastleIconNode,
  Skull: SkullIconNode,
  Sword: SwordIconNode,
  Shield: ShieldIconNode,
  Crown: CrownIconNode,
  Book: BookIconNode,
  Star: StarIconNode,
  Home: HomeIconNode,
  Gem: GemIconNode,
  Flame: FlameIconNode,
  DoorOpen: DoorOpenIconNode,
  Trees: TreesIconNode,
  Mountain: MountainIconNode,
  Tent: TentIconNode,
  CircleHelp: CircleHelpIconNode
};

const MARKER_ICON_OPTIONS = Object.keys(MARKER_ICON_NODES);
const MARKER_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

function createId(prefix = 'map') {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getItemBounds(item) {
  if (item.type === 'marker') {
    const labelWidth = item.props?.label ? Math.max(54, String(item.props.label).length * 8 + 18) : 0;
    return { x: item.x - 18, y: item.y - 18, width: 44 + labelWidth, height: 36 };
  }
  return {
    x: item.x,
    y: item.y,
    width: item.width || 160,
    height: item.height || 80
  };
}

function getMarkerLinkLabel(item, labels = {}) {
  if (item.props?.linkedTabPath) return labels.linkedTab || 'Linked tab';
  if (item.props?.linkedDocumentPath) return labels.linkedDocument || 'Linked document';
  return labels.notLinked || 'No link';
}

function getTreeChildrenForLinks(nodes = [], depth = 0) {
  const entries = [];
  const walk = (items, level) => {
    for (const item of items) {
      if (item.type !== 'container') continue;
      entries.push({ ...item, depth: level });
      walk(item.children || [], level + 1);
    }
  };
  walk(nodes, depth);
  return entries;
}

function getTabsForLinkedDocument(tree = [], documentPath = '') {
  if (!documentPath) return [];
  const find = (nodes) => {
    for (const node of nodes) {
      if (node.path === documentPath) return node;
      const child = find(node.children || []);
      if (child) return child;
    }
    return null;
  };
  return (find(tree)?.children || []).filter(child => child.type === 'tab');
}

function MarkerIconShape({ icon = 'MapPin' }) {
  const iconNode = MARKER_ICON_NODES[icon] || MARKER_ICON_NODES.MapPin;
  const common = {
    stroke: '#ffffff',
    strokeWidth: 2,
    strokeScaleEnabled: false,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false
  };

  return (
    <Group x={-9} y={-9} scaleX={0.75} scaleY={0.75} listening={false}>
      {iconNode.map(([tag, attrs], index) => {
        if (tag === 'path') {
          return <Path key={attrs.key || index} data={attrs.d} {...common} />;
        }
        if (tag === 'circle') {
          return <Circle key={attrs.key || index} x={Number(attrs.cx)} y={Number(attrs.cy)} radius={Number(attrs.r)} {...common} />;
        }
        if (tag === 'line') {
          return <Line key={attrs.key || index} points={[Number(attrs.x1), Number(attrs.y1), Number(attrs.x2), Number(attrs.y2)]} {...common} />;
        }
        if (tag === 'rect') {
          return <Rect key={attrs.key || index} x={Number(attrs.x)} y={Number(attrs.y)} width={Number(attrs.width)} height={Number(attrs.height)} cornerRadius={Number(attrs.rx || 0)} {...common} />;
        }
        if (tag === 'polyline' || tag === 'polygon') {
          const points = String(attrs.points || '').trim().split(/[,\s]+/).map(Number).filter(Number.isFinite);
          return <Line key={attrs.key || index} points={points} closed={tag === 'polygon'} {...common} />;
        }
        return null;
      })}
    </Group>
  );
}

function readYState(yCanvas, ySettings, yLayers, yItems) {
  return {
    canvas: { ...DEFAULT_CANVAS, ...Object.fromEntries(yCanvas.entries()) },
    settings: { ...DEFAULT_SETTINGS, ...Object.fromEntries(ySettings.entries()) },
    layers: yLayers.toArray(),
    items: yItems.toArray()
  };
}

function replaceYItem(yItems, itemId, nextItem) {
  const index = yItems.toArray().findIndex(item => item.id === itemId);
  if (index === -1) return;
  yItems.delete(index, 1);
  yItems.insert(index, [nextItem]);
}

function removeYItem(yItems, itemId) {
  const index = yItems.toArray().findIndex(item => item.id === itemId);
  if (index === -1) return;
  yItems.delete(index, 1);
}

function prepareAssetUpload(file) {
  const contentType = file.type || 'application/octet-stream';
  const filename = file.name || `map-asset-${Date.now()}`;
  return { contentType, filename, blob: file };
}

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function useImageSource(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return undefined;
    }

    const nextImage = new window.Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => setImage(null);
    nextImage.src = src;
    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [src]);

  return image;
}

function MapImageItem({ item, isSelected, draggable, onSelect, onChange, getAssetUrl, registerNode }) {
  const src = item.props?.src || (item.props?.assetPath ? getAssetUrl(item.props.assetPath) : '');
  const image = useImageSource(src);

  return (
    <KonvaImage
      ref={node => registerNode(item.id, node)}
      image={image}
      x={item.x}
      y={item.y}
      width={item.width || 180}
      height={item.height || 120}
      rotation={item.rotation || 0}
      draggable={draggable}
      stroke={isSelected ? '#f8fafc' : undefined}
      strokeWidth={isSelected ? 1 : 0}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={event => onChange({ ...item, x: event.target.x(), y: event.target.y() })}
      onTransformEnd={event => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          ...item,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(24, node.width() * scaleX),
          height: Math.max(24, node.height() * scaleY)
        });
      }}
    />
  );
}

function MapGrid({ settings, viewport, size, mapSize }) {
  if (!settings.gridVisible || settings.gridMode === 'free') return null;

  const gridSize = Number(settings.gridSize || 64);
  const scale = viewport.scale || 1;
  const visibleStartX = Math.floor((-viewport.x / scale) / gridSize) * gridSize - gridSize * 2;
  const visibleEndX = visibleStartX + (size.width / scale) + gridSize * 4;
  const visibleStartY = Math.floor((-viewport.y / scale) / gridSize) * gridSize - gridSize * 2;
  const visibleEndY = visibleStartY + (size.height / scale) + gridSize * 4;
  const startX = Math.max(0, visibleStartX);
  const endX = Math.min(mapSize.width, visibleEndX);
  const startY = Math.max(0, visibleStartY);
  const endY = Math.min(mapSize.height, visibleEndY);
  const lines = [];

  if (settings.gridMode === 'square') {
    for (let x = startX; x <= endX; x += gridSize) {
      lines.push(<Line key={`v-${x}`} points={[x, startY, x, endY]} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeScaleEnabled={false} listening={false} />);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      lines.push(<Line key={`h-${y}`} points={[startX, y, endX, y]} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeScaleEnabled={false} listening={false} />);
    }
    return <>{lines}</>;
  }

  const radius = gridSize / Math.sqrt(3);
  const hexWidth = Math.sqrt(3) * radius;
  const hexHeight = radius * 2;
  const rowHeight = hexHeight * 0.75;
  let row = 0;
  const firstY = Math.floor(startY / rowHeight) * rowHeight - rowHeight;
  const firstX = Math.floor(startX / hexWidth) * hexWidth - hexWidth;
  for (let y = firstY; y <= endY + rowHeight; y += rowHeight) {
    const offset = row % 2 === 0 ? 0 : hexWidth / 2;
    for (let x = firstX; x <= endX + hexWidth; x += hexWidth) {
      const cx = x + offset;
      const cy = y;
      const points = [];
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 180 * (60 * i - 30);
        points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      }
      lines.push(
        <Line
          key={`hex-${row}-${x}`}
          points={points}
          closed
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      );
    }
    row += 1;
  }

  return <>{lines}</>;
}

function RemotePresence({ remoteUsers, viewport }) {
  return (
    <>
      {remoteUsers.map(user => {
        const cursor = user.mapCursor;
        if (!cursor) return null;
        return (
          <div
            key={user.clientId}
            className="map-remote-cursor"
            style={{
              '--presence-color': user.color,
              left: `${(cursor.x * viewport.scale) + viewport.x}px`,
              top: `${(cursor.y * viewport.scale) + viewport.y}px`
            }}
          >
            <span>{user.name}</span>
          </div>
        );
      })}
    </>
  );
}

export default function MapEditor({
  worldId,
  collaborationRoom,
  currentUser,
  isVisitor = false,
  locked = false,
  initialMapAssetPath = '',
  documentTree = [],
  assetImages = [],
  getAssetUrl,
  onRequestAssets,
  onNavigateToLink,
  onCollaborationSaveState,
  labels = {}
}) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const baseMapInputRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const itemNodesRef = useRef(new Map());
  const fittedBackgroundRef = useRef('');
  const userMovedViewportRef = useRef(false);
  const panSessionRef = useRef(null);
  const spacePressedRef = useRef(false);
  const [size, setSize] = useState({ width: 900, height: 560 });
  const [tool, setTool] = useState('select');
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [state, setState] = useState({
    canvas: DEFAULT_CANVAS,
    settings: DEFAULT_SETTINGS,
    layers: [DEFAULT_LAYER],
    items: []
  });
  const [selectedId, setSelectedId] = useState('');
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [markerEditor, setMarkerEditor] = useState({ isOpen: false, itemId: '', x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isViewportPanning, setIsViewportPanning] = useState(false);
  const collaborationRoomState = useCollaborationRoom({
    roomName: collaborationRoom,
    currentUser,
    isVisitor,
    locked
  });
  const {
    doc: collaborationDoc,
    provider: collaborationProvider,
    readOnly: collaborationReadOnly,
    synced: collaborationSynced,
    saveStatus: collaborationSaveStatus,
    dirty: collaborationDirty,
    remoteUsers,
    setAwarenessField
  } = collaborationRoomState;
  const readOnly = Boolean(isVisitor || locked || collaborationReadOnly);
  const backgroundAssetPath = state.canvas.backgroundAssetPath || initialMapAssetPath || '';
  const backgroundImage = useImageSource(backgroundAssetPath ? getAssetUrl(backgroundAssetPath) : '');
  const mapSize = useMemo(() => ({
    width: Math.max(1, backgroundImage?.naturalWidth || 1600),
    height: Math.max(1, backgroundImage?.naturalHeight || 1000)
  }), [backgroundImage]);

  const getFittedViewport = useCallback(() => {
    const padding = 48;
    const availableWidth = Math.max(1, size.width - padding * 2);
    const availableHeight = Math.max(1, size.height - padding * 2);
    const scale = Math.min(1, availableWidth / mapSize.width, availableHeight / mapSize.height);
    return {
      scale,
      x: (size.width - mapSize.width * scale) / 2,
      y: (size.height - mapSize.height * scale) / 2
    };
  }, [mapSize.height, mapSize.width, size.height, size.width]);

  const collaboration = useMemo(() => {
    if (!collaborationDoc || !collaborationProvider) return null;
    return {
      doc: collaborationDoc,
      provider: collaborationProvider,
      yCanvas: collaborationDoc.getMap('mapCanvas'),
      yItems: collaborationDoc.getArray('mapItems'),
      ySettings: collaborationDoc.getMap('mapSettings'),
      yLayers: collaborationDoc.getArray('mapLayers')
    };
  }, [collaborationDoc, collaborationProvider]);

  const emitAwareness = useCallback((patch = {}) => {
    if (!collaborationProvider) return;
    setAwarenessField('map', {
      tool,
      selectedId,
      ...patch
    });
  }, [collaborationProvider, selectedId, setAwarenessField, tool]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({
        width: Math.max(320, rect.width),
        height: Math.max(320, rect.height)
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!collaboration) {
      return undefined;
    }

    const { doc, yCanvas, yItems, ySettings, yLayers } = collaboration;
    onCollaborationSaveState?.({
      status: collaborationSaveStatus,
      dirty: collaborationDirty
    });
    const updateState = () => setState(readYState(yCanvas, ySettings, yLayers, yItems));
    const initialize = () => {
      if (readOnly || !collaborationSynced) return;
      doc.transact(() => {
        if (!yCanvas.has('backgroundColor')) yCanvas.set('backgroundColor', DEFAULT_CANVAS.backgroundColor);
        if (!yCanvas.has('backgroundAssetPath') && initialMapAssetPath) yCanvas.set('backgroundAssetPath', initialMapAssetPath);
        if (!ySettings.has('gridMode')) ySettings.set('gridMode', DEFAULT_SETTINGS.gridMode);
        if (!ySettings.has('gridSize')) ySettings.set('gridSize', DEFAULT_SETTINGS.gridSize);
        if (!ySettings.has('gridVisible')) ySettings.set('gridVisible', DEFAULT_SETTINGS.gridVisible);
        if (yLayers.length === 0) yLayers.insert(0, [DEFAULT_LAYER]);
      });
      updateState();
    };
    yCanvas.observe(updateState);
    ySettings.observe(updateState);
    yLayers.observe(updateState);
    yItems.observe(updateState);
    setAwarenessField('map', { tool, selectedId });
    initialize();
    updateState();

    return () => {
      yCanvas.unobserve(updateState);
      ySettings.unobserve(updateState);
      yLayers.unobserve(updateState);
      yItems.unobserve(updateState);
    };
  }, [
    collaboration,
    collaborationDirty,
    collaborationSaveStatus,
    collaborationSynced,
    initialMapAssetPath,
    onCollaborationSaveState,
    readOnly,
    selectedId,
    setAwarenessField,
    tool
  ]);

  useEffect(() => {
    emitAwareness();
  }, [emitAwareness]);

  useEffect(() => {
    if (!backgroundImage || !backgroundAssetPath) return;
    const fitKey = `${backgroundAssetPath}:${size.width}:${size.height}:${mapSize.width}:${mapSize.height}`;
    if (fittedBackgroundRef.current === fitKey) return;
    if (fittedBackgroundRef.current && userMovedViewportRef.current) return;
    fittedBackgroundRef.current = fitKey;
    setViewport(getFittedViewport());
  }, [backgroundAssetPath, backgroundImage, getFittedViewport, mapSize.height, mapSize.width, size.height, size.width]);

  useEffect(() => {
    const node = itemNodesRef.current.get(selectedId);
    const item = state.items.find(nextItem => nextItem.id === selectedId);
    if (!transformerRef.current) return;
    transformerRef.current.nodes(node && !readOnly && item?.type !== 'marker' ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [readOnly, selectedId, state.items]);

  const registerNode = useCallback((id, node) => {
    if (node) itemNodesRef.current.set(id, node);
    else itemNodesRef.current.delete(id);
  }, []);

  const stagePointToWorld = useCallback(() => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    return {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale
    };
  }, [viewport]);

  const endViewportPan = useCallback(() => {
    panSessionRef.current = null;
    setIsViewportPanning(false);
  }, []);

  const beginViewportPan = useCallback((event) => {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return false;

    event.evt?.preventDefault?.();
    event.cancelBubble = true;
    panSessionRef.current = {
      pointer,
      viewport
    };
    setIsViewportPanning(true);
    return true;
  }, [viewport]);

  const updateViewportPan = useCallback(() => {
    const session = panSessionRef.current;
    if (!session) return false;

    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return false;

    setViewport({
      ...session.viewport,
      x: session.viewport.x + pointer.x - session.pointer.x,
      y: session.viewport.y + pointer.y - session.pointer.y
    });
    userMovedViewportRef.current = true;
    return true;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault();
        spacePressedRef.current = true;
        setIsSpacePressed(true);
        return;
      }

      if (readOnly || !selectedId || !collaboration) return;
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      event.preventDefault();
      collaboration.doc.transact(() => removeYItem(collaboration.yItems, selectedId));
      setSelectedId('');
    };
    const handleKeyUp = (event) => {
      if (event.code !== 'Space') return;
      spacePressedRef.current = false;
      setIsSpacePressed(false);
      endViewportPan();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [collaboration, endViewportPan, readOnly, selectedId]);

  useEffect(() => {
    if (!isViewportPanning) return undefined;

    const stopPanning = () => endViewportPan();
    window.addEventListener('mouseup', stopPanning);
    window.addEventListener('blur', stopPanning);
    return () => {
      window.removeEventListener('mouseup', stopPanning);
      window.removeEventListener('blur', stopPanning);
    };
  }, [endViewportPan, isViewportPanning]);

  const updateItem = useCallback((item) => {
    if (readOnly || !collaboration) return;
    collaboration.doc.transact(() => replaceYItem(collaboration.yItems, item.id, item));
  }, [collaboration, readOnly]);

  const addItem = useCallback((type, point, props = {}) => {
    if (readOnly || !collaboration) return;
    const item = {
      id: createId('item'),
      type,
      x: point.x,
      y: point.y,
      width: type === 'text' ? 180 : 160,
      height: type === 'text' ? 56 : 120,
      rotation: 0,
      layerId: 'default',
      props: type === 'marker'
        ? {
          label: labels.markerDefault || 'Point',
          description: '',
          color: '#8b5cf6',
          icon: 'MapPin',
          linkedDocumentPath: '',
          linkedTabPath: '',
          ...props
        }
        : props
    };
    collaboration.doc.transact(() => collaboration.yItems.push([item]));
    setSelectedId(item.id);
    setTool('select');
  }, [collaboration, labels.markerDefault, readOnly]);

  const addImageItem = useCallback((asset) => {
    const point = stagePointToWorld();
    addItem('image', point, {
      assetPath: asset.path,
      name: asset.name
    });
    setAssetPickerOpen(false);
  }, [addItem, stagePointToWorld]);

  const handleStagePointerDown = (event) => {
    const button = event.evt?.button ?? 0;
    if (button === 1 || (button === 0 && spacePressedRef.current)) {
      beginViewportPan(event);
      return;
    }

    if (event.target !== event.target.getStage()) return;
    if (readOnly) {
      setSelectedId('');
      return;
    }

    const point = stagePointToWorld();
    if (tool === 'marker') {
      addItem('marker', point);
      return;
    }
    if (tool === 'text') {
      addItem('text', point, { text: labels.textDefault || 'Text', color: '#f8fafc' });
      return;
    }
    if (tool === 'image') {
      setAssetPickerOpen(true);
      return;
    }
    setSelectedId('');
  };

  const handleWheel = (event) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.08;
    const nextScale = event.evt.deltaY > 0
      ? viewport.scale / scaleBy
      : viewport.scale * scaleBy;
    const scale = Math.max(0.25, Math.min(3, nextScale));
    const mousePointTo = {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale
    };
    setViewport({
      scale,
      x: pointer.x - mousePointTo.x * scale,
      y: pointer.y - mousePointTo.y * scale
    });
    userMovedViewportRef.current = true;
  };

  const zoomBy = (factor) => {
    userMovedViewportRef.current = true;
    setViewport(prev => ({
      ...prev,
      scale: Math.max(0.25, Math.min(3, prev.scale * factor))
    }));
  };

  const updateGridMode = () => {
    if (!collaboration) return;
    const order = ['free', 'square', 'hex'];
    const current = state.settings.gridMode || 'free';
    const next = order[(order.indexOf(current) + 1) % order.length];
    collaboration.ySettings.set('gridMode', next);
    collaboration.ySettings.set('gridVisible', next !== 'free');
  };

  const deleteSelected = () => {
    if (readOnly || !selectedId || !collaboration) return;
    collaboration.doc.transact(() => removeYItem(collaboration.yItems, selectedId));
    setSelectedId('');
  };

  const openMarkerEditor = (event, item) => {
    if (readOnly || !item) return;
    event.evt?.preventDefault?.();
    event.cancelBubble = true;
    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const nextX = (event.evt?.clientX || rect.left + 180) - rect.left;
    const nextY = (event.evt?.clientY || rect.top + 120) - rect.top;
    setSelectedId(item.id);
    setMarkerEditor({
      isOpen: true,
      itemId: item.id,
      x: Math.max(12, Math.min(nextX, Math.max(12, size.width - 340))),
      y: Math.max(12, Math.min(nextY, Math.max(12, size.height - 420)))
    });
  };

  const updateMarkerProps = (item, props) => {
    updateItem({
      ...item,
      props: {
        ...item.props,
        ...props
      }
    });
  };

  const navigateMarker = (item) => {
    const linkedTabPath = item.props?.linkedTabPath || '';
    const linkedDocumentPath = item.props?.linkedDocumentPath || '';
    if (!linkedTabPath && !linkedDocumentPath) return;
    onNavigateToLink?.({ linkedDocumentPath, linkedTabPath });
  };

  const selectMapItem = (event, itemId) => {
    const button = event.evt?.button;
    if (button !== undefined && button !== 0) return;
    if (spacePressedRef.current || isViewportPanning) return;
    event.cancelBubble = true;
    setSelectedId(itemId);
  };

  const uploadImageAsset = async (file) => {
    const prepared = prepareAssetUpload(file);
    if (!prepared.contentType.startsWith('image/')) return null;
    const query = new URLSearchParams({ path: '', filename: prepared.filename });
    const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': prepared.contentType },
      body: prepared.blob
    });
    if (!res.ok) return null;
    const uploaded = await res.json();
    await onRequestAssets?.();
    return uploaded;
  };

  const handleUpload = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = '';
    if (!file || readOnly) return;

    setUploading(true);
    try {
      const uploaded = await uploadImageAsset(file);
      if (uploaded) addImageItem(uploaded);
    } finally {
      setUploading(false);
    }
  };

  const handleBaseMapUpload = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = '';
    if (!file || readOnly || !collaboration) return;

    setUploading(true);
    try {
      const uploaded = await uploadImageAsset(file);
      if (!uploaded) return;
      collaboration.yCanvas.set('backgroundAssetPath', uploaded.path);
      userMovedViewportRef.current = false;
      fittedBackgroundRef.current = '';
    } finally {
      setUploading(false);
    }
  };

  const handleTextEdit = (item) => {
    if (readOnly) return;
    const nextText = window.prompt(labels.editText || 'Text', item.props?.text || '');
    if (nextText === null) return;
    updateItem({ ...item, props: { ...item.props, text: nextText } });
  };

  const editableTools = [
    { id: 'select', icon: MousePointer2, label: labels.selectTool || TOOL_LABELS.select },
    { id: 'marker', icon: MapPin, label: labels.markerTool || TOOL_LABELS.marker },
    { id: 'text', icon: Type, label: labels.textTool || TOOL_LABELS.text },
    { id: 'image', icon: Image, label: labels.imageTool || TOOL_LABELS.image }
  ];
  const tools = readOnly ? editableTools.slice(0, 1) : editableTools;
  const GridIcon = state.settings.gridMode === 'hex'
    ? Hexagon
    : state.settings.gridMode === 'square'
      ? Grid3X3
      : Grid2X2;

  const selectedItem = state.items.find(item => item.id === selectedId);
  const editedMarker = state.items.find(item => item.id === markerEditor.itemId && item.type === 'marker');
  const linkDocuments = useMemo(() => getTreeChildrenForLinks(documentTree), [documentTree]);
  const linkedTabs = useMemo(
    () => getTabsForLinkedDocument(documentTree, editedMarker?.props?.linkedDocumentPath || ''),
    [documentTree, editedMarker?.props?.linkedDocumentPath]
  );
  const selectedBounds = selectedItem ? getItemBounds(selectedItem) : null;
  const remoteSelections = remoteUsers
    .filter(user => user.selectedId && user.selectedId !== selectedId)
    .map(user => ({ user, item: state.items.find(item => item.id === user.selectedId) }))
    .filter(entry => entry.item);

  return (
    <div ref={containerRef} className="map-editor-shell">
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
        onMouseUp={endViewportPan}
        onMouseLeave={endViewportPan}
        onTouchStart={handleStagePointerDown}
        onMouseMove={() => {
          updateViewportPan();
          const point = stagePointToWorld();
          emitAwareness({ cursor: point, mapCursor: point });
        }}
        className={`${isSpacePressed ? 'can-pan' : ''} ${isViewportPanning ? 'is-panning' : ''}`.trim()}
      >
        <Layer>
          {backgroundImage && (
            <KonvaImage
              image={backgroundImage}
              x={0}
              y={0}
              width={mapSize.width}
              height={mapSize.height}
              listening={false}
            />
          )}
          <Rect x={0} y={0} width={mapSize.width} height={mapSize.height} stroke="rgba(255,255,255,0.12)" strokeWidth={1} listening={false} />
          <MapGrid settings={state.settings} viewport={viewport} size={size} mapSize={mapSize} />
          {state.items.map(item => {
            const isSelected = selectedId === item.id;
            const draggable = !readOnly && tool === 'select' && !isSpacePressed && !isViewportPanning;
            if (item.type === 'image') {
              return (
                <MapImageItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  draggable={draggable}
                  getAssetUrl={getAssetUrl}
                  registerNode={registerNode}
                  onSelect={(event) => selectMapItem(event, item.id)}
                  onChange={updateItem}
                />
              );
            }
            if (item.type === 'text') {
              return (
                <Text
                  key={item.id}
                  ref={node => registerNode(item.id, node)}
                  x={item.x}
                  y={item.y}
                  width={item.width || 180}
                  height={item.height || 56}
                  text={item.props?.text || ''}
                  fill={item.props?.color || '#f8fafc'}
                  fontSize={22}
                  fontStyle="600"
                  padding={6}
                  draggable={draggable}
                  onClick={(event) => selectMapItem(event, item.id)}
                  onTap={(event) => selectMapItem(event, item.id)}
                  onDblClick={() => handleTextEdit(item)}
                  onDblTap={() => handleTextEdit(item)}
                  onDragEnd={event => updateItem({ ...item, x: event.target.x(), y: event.target.y() })}
                  onTransformEnd={event => {
                    const node = event.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    updateItem({
                      ...item,
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(60, node.width() * scaleX),
                      height: Math.max(28, node.height() * scaleY),
                      rotation: node.rotation()
                    });
                  }}
                />
              );
            }
            return (
              <Group
                key={item.id}
                ref={node => registerNode(item.id, node)}
                x={item.x}
                y={item.y}
                draggable={draggable}
                onClick={(event) => selectMapItem(event, item.id)}
                onTap={(event) => selectMapItem(event, item.id)}
                onDblClick={() => {
                  navigateMarker(item);
                }}
                onDblTap={() => {
                  navigateMarker(item);
                }}
                onContextMenu={(event) => {
                  openMarkerEditor(event, item);
                }}
                onDragEnd={event => {
                  event.cancelBubble = true;
                  const node = itemNodesRef.current.get(item.id);
                  if (node) {
                    updateItem({ ...item, x: node.x(), y: node.y() });
                  }
                }}
              >
                <Circle
                  radius={18}
                  fill={item.props?.color || '#8b5cf6'}
                  stroke={isSelected ? '#f8fafc' : 'rgba(255,255,255,0.9)'}
                  strokeWidth={isSelected ? 3 : 2}
                  shadowColor="#000"
                  shadowBlur={14}
                  shadowOpacity={0.38}
                  shadowOffsetY={6}
                />
                <MarkerIconShape icon={item.props?.icon || 'MapPin'} />
                {item.props?.label && (
                  <Group x={26} y={-14}>
                    <Rect
                      width={Math.max(54, String(item.props.label).length * 8 + 18)}
                      height={27}
                      cornerRadius={8}
                      fill="rgba(8, 10, 15, 0.78)"
                      stroke="rgba(255, 255, 255, 0.16)"
                      strokeWidth={1}
                      shadowColor="#000"
                      shadowBlur={12}
                      shadowOpacity={0.28}
                      shadowOffsetY={5}
                    />
                    <Text
                      text={item.props.label}
                      x={9}
                      y={6}
                      fill="#f8fafc"
                      fontSize={13}
                      fontStyle="700"
                      listening={false}
                    />
                  </Group>
                )}
              </Group>
            );
          })}
          {selectedBounds && selectedItem?.type !== 'marker' && (
            <Rect
              x={selectedBounds.x}
              y={selectedBounds.y}
              width={selectedBounds.width}
              height={selectedBounds.height}
              stroke="#f8fafc"
              strokeWidth={1}
              dash={[6, 4]}
              listening={false}
            />
          )}
          {remoteSelections.map(({ user, item }) => {
            const bounds = getItemBounds(item);
            return (
              <Group key={`${user.clientId}-${item.id}`} listening={false}>
                <Rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} stroke={user.color} strokeWidth={2} dash={[8, 5]} />
                <Text x={bounds.x} y={bounds.y - 22} text={user.name} fill={user.color} fontSize={13} fontStyle="700" />
              </Group>
            );
          })}
          <Transformer ref={transformerRef} rotateEnabled enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']} />
        </Layer>
      </Stage>

      <RemotePresence remoteUsers={remoteUsers} viewport={viewport} />

      {remoteUsers.length > 0 && (
        <div className="map-status-strip">
          <span className="map-presence-count" title={labels.onlineUsers || 'Online users'}>
            <Users size={14} />
            {remoteUsers.length}
          </span>
        </div>
      )}

      <div className="board-zoom-indicator map-zoom-indicator">{Math.round(viewport.scale * 100)}%</div>

      <div className="map-floating-dock" role="toolbar" aria-label={labels.toolbar || 'Map tools'}>
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={tool === id ? 'active' : ''}
            onClick={() => {
              setTool(id);
              if (id === 'image' && !readOnly) setAssetPickerOpen(true);
            }}
            title={label}
          >
            <Icon size={17} />
          </button>
        ))}
        <span className="map-dock-divider" />
        <button type="button" onClick={updateGridMode} title={labels.gridMode || 'Grid'}>
          <GridIcon size={17} />
        </button>
        {!readOnly && (
          <button type="button" onClick={() => baseMapInputRef.current?.click()} disabled={uploading} title={labels.changeBaseMap || 'Change base map'}>
            <Upload size={17} />
          </button>
        )}
        <span className="map-dock-divider" />
        <button type="button" onClick={() => zoomBy(0.86)} title={labels.zoomOut || 'Zoom out'}>
          <Minus size={17} />
        </button>
        <button
          type="button"
          onClick={() => {
            userMovedViewportRef.current = false;
            fittedBackgroundRef.current = '';
            setViewport(getFittedViewport());
          }}
          title={labels.resetView || 'Reset view'}
        >
          <Focus size={17} />
        </button>
        <button type="button" onClick={() => zoomBy(1.16)} title={labels.zoomIn || 'Zoom in'}>
          <Plus size={17} />
        </button>
        {!readOnly && (
          <>
            <span className="map-dock-divider" />
            <button type="button" onClick={deleteSelected} disabled={!selectedId} title={labels.deleteSelected || 'Delete selected'}>
              <Trash2 size={17} />
            </button>
          </>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,.gif" hidden onChange={handleUpload} />
      <input ref={baseMapInputRef} type="file" accept="image/*,.gif" hidden onChange={handleBaseMapUpload} />

      {markerEditor.isOpen && editedMarker && !readOnly && (
        <div
          className="map-marker-popover glass-panel"
          style={{ left: markerEditor.x, top: markerEditor.y }}
        >
          <div className="map-marker-popover-header">
            <strong>{labels.markerEditorTitle || 'Marker'}</strong>
            <button type="button" onClick={() => setMarkerEditor({ isOpen: false, itemId: '', x: 0, y: 0 })}>x</button>
          </div>

          <label className="map-marker-field">
            <span>{labels.markerLabel || 'Label'}</span>
            <input
              value={editedMarker.props?.label || ''}
              onChange={event => updateMarkerProps(editedMarker, { label: event.target.value })}
            />
          </label>

          <label className="map-marker-field">
            <span>{labels.markerDescription || 'Description'}</span>
            <textarea
              value={editedMarker.props?.description || ''}
              onChange={event => updateMarkerProps(editedMarker, { description: event.target.value })}
              rows={2}
            />
          </label>

          <div className="map-marker-section">
            <span>{labels.markerIcon || 'Icon'}</span>
            <div className="map-marker-icon-grid">
              {MARKER_ICON_OPTIONS.map(iconName => {
                const IconNode = MARKER_ICON_NODES[iconName];
                return (
                  <button
                    key={iconName}
                    type="button"
                    className={editedMarker.props?.icon === iconName ? 'active' : ''}
                    onClick={() => updateMarkerProps(editedMarker, { icon: iconName })}
                    title={iconName}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {IconNode.map(([tag, attrs], index) => {
                        const { key, ...rest } = attrs;
                        const Tag = tag;
                        return <Tag key={key || index} {...rest} />;
                      })}
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="map-marker-section">
            <span>{labels.markerColor || 'Color'}</span>
            <div className="map-marker-color-row">
              {MARKER_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={editedMarker.props?.color === color ? 'active' : ''}
                  style={{ '--marker-color': color }}
                  onClick={() => updateMarkerProps(editedMarker, { color })}
                  title={color}
                />
              ))}
            </div>
          </div>

            <label className="map-marker-field">
            <span>{labels.markerLinkedDocument || 'Linked document'}</span>
            <DropdownSelect
              value={editedMarker.props?.linkedDocumentPath || ''}
              onChange={path => updateMarkerProps(editedMarker, { linkedDocumentPath: path, linkedTabPath: '' })}
              options={[
                { value: '', label: labels.markerNoLink || 'No link' },
                ...linkDocuments.map(document => ({
                  value: document.path,
                  label: `${'  '.repeat(document.depth)}${document.name}`
                }))
              ]}
            />
          </label>

          {editedMarker.props?.linkedDocumentPath && (
            <label className="map-marker-field">
              <span>{labels.markerLinkedTab || 'Linked tab'}</span>
              <DropdownSelect
                value={editedMarker.props?.linkedTabPath || ''}
                onChange={path => updateMarkerProps(editedMarker, { linkedTabPath: path })}
                options={[
                  { value: '', label: labels.markerDocumentDefaultTab || 'Document default tab' },
                  ...linkedTabs.map(tab => ({
                    value: tab.path,
                    label: tab.name
                  }))
                ]}
              />
            </label>
          )}

          <div className="map-marker-link-state">{getMarkerLinkLabel(editedMarker, labels)}</div>

          <div className="map-marker-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => updateMarkerProps(editedMarker, { linkedDocumentPath: '', linkedTabPath: '' })}
            >
              {labels.markerRemoveLink || 'Remove link'}
            </button>
            <button
              type="button"
              className="btn-secondary danger"
              onClick={() => {
                deleteSelected();
                setMarkerEditor({ isOpen: false, itemId: '', x: 0, y: 0 });
              }}
            >
              {labels.deleteSelected || 'Delete'}
            </button>
          </div>
        </div>
      )}

      {assetPickerOpen && !readOnly && (
        <div className="map-asset-popover glass-panel">
          <div className="map-asset-popover-header">
            <strong>{labels.insertImage || 'Insert image'}</strong>
            <button type="button" onClick={() => setAssetPickerOpen(false)}>x</button>
          </div>
          <button type="button" className="map-upload-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={15} />
            <span>{uploading ? labels.uploading || 'Uploading...' : labels.uploadImage || 'Upload image'}</span>
          </button>
          <div className="map-asset-list">
            {assetImages.length === 0 ? (
              <div className="map-asset-empty">{labels.noAssetImages || 'No image assets yet.'}</div>
            ) : assetImages.map(asset => (
              <button key={asset.path} type="button" onClick={() => addImageItem(asset)}>
                <img src={getAssetUrl(asset.path)} alt="" />
                <span>{asset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, FolderPlus, FilePlus, Save, Eye, Edit2, Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Sword, Shield, Castle, Map, MapPin, Crown, Book, Star, Skull, Tag, Trash2, Search, Image, Music, Copy, ExternalLink, Layers, Package, Layout, Columns, Bookmark, Share2, Upload } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import L from 'leaflet';
import { ImageOverlay, MapContainer, Marker, Popup, useMapEvents } from 'react-leaflet';

const ICON_MAP = {
  FileText, Sword, Shield, Castle, Map, Crown, Book, Star, Skull
};

const MAP_BOUNDS = [[0, 0], [100, 100]];
const leafletPinIcon = L.divIcon({
  className: 'mysthra-map-pin',
  html: '<span></span>',
  iconSize: [26, 32],
  iconAnchor: [13, 32],
  popupAnchor: [0, -30]
});

const isImageAsset = (node) => node?.type === 'image';

function flattenNodes(nodes = [], predicate = () => true) {
  return nodes.flatMap((node) => {
    const children = node.children ? flattenNodes(node.children, predicate) : [];
    return predicate(node) ? [node, ...children] : children;
  });
}

function findNodeByPath(nodes = [], targetPath = '') {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const match = findNodeByPath(node.children, targetPath);
      if (match) return match;
    }
  }
  return null;
}

function getMapImageUrl(worldId, imagePath) {
  return `/api/worlds/${encodeURIComponent(worldId)}/media/${encodeURIComponent(imagePath)}`;
}

function MapClickHandler({ enabled, onAddPin }) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      const x = Math.max(0, Math.min(1, event.latlng.lng / 100));
      const y = Math.max(0, Math.min(1, event.latlng.lat / 100));
      onAddPin({ x, y });
    }
  });
  return null;
}

function MapTreeNode({ node, selectedMap, onSelect, onDelete, onMove, onCreateFolder, renamingPath, onRename, onContextMenu, isVisitor, isSearching }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const isFolder = node.type === 'folder';
  const isRenaming = renamingPath === node.path;
  const showChildren = isOpen || isSearching;

  useEffect(() => {
    if (isRenaming) setEditValue(node.name);
  }, [isRenaming, node.name]);

  const handleDragStart = (e) => {
    if (isVisitor) return;
    e.dataTransfer.setData('mapPath', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!isVisitor && isFolder) {
      e.preventDefault();
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    if (isVisitor || !isFolder) return;
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const mapPath = e.dataTransfer.getData('mapPath');
    if (mapPath && mapPath !== node.path) {
      onMove(mapPath, node.path + '/' + mapPath.split('/').pop());
    }
  };

  return (
    <li className="tree-document">
      <div 
        className={`tree-node ${selectedMap?.path === node.path ? 'selected' : ''}`}
        draggable={!isVisitor && !isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          if (isVisitor || isRenaming) return;
          e.preventDefault();
          onContextMenu(e, node);
        }}
        onClick={() => {
          if (isRenaming) return;
          if (isFolder) setIsOpen(!isOpen);
          else onSelect(node);
        }}
      >
        <span className="tree-icon" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
          {isFolder ? (showChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <span className="tree-icon" style={{ color: isFolder ? 'var(--accent-color)' : 'inherit' }}>
          {isFolder ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />) : <Map size={14} />}
        </span>
        {isRenaming ? (
          <input
            className="tree-rename-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => onRename(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename(node, editValue);
              else if (e.key === 'Escape') onRename(null);
            }}
            autoFocus
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="asset-name-tree" style={{ flex: 1 }}>{node.name}</span>
        )}
        {!isVisitor && !isRenaming && (
          <button
            className="node-action-btn"
            title={isFolder ? "Excluir pasta" : "Excluir mapa"}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node);
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {isFolder && showChildren && node.children && (
        <ul className="file-tree">
          {node.children.map(child => (
            <MapTreeNode 
              key={child.path} 
              node={child} 
              selectedMap={selectedMap} 
              onSelect={onSelect} 
              onDelete={onDelete}
              onMove={onMove}
              onCreateFolder={onCreateFolder}
              renamingPath={renamingPath}
              onRename={onRename}
              onContextMenu={onContextMenu}
              isVisitor={isVisitor}
              isSearching={isSearching}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function MapTree({ maps, selectedMap, onSelect, onDelete, onMove, onCreateFolder, renamingPath, onRename, onContextMenu, isVisitor, isSearching }) {
  if (!maps || maps.length === 0) return null;
  return (
    <ul className="file-tree">
      {maps.map(node => (
        <MapTreeNode 
          key={node.path} 
          node={node} 
          selectedMap={selectedMap} 
          onSelect={onSelect} 
          onDelete={onDelete}
          onMove={onMove}
          onCreateFolder={onCreateFolder}
          renamingPath={renamingPath}
          onRename={onRename}
          onContextMenu={onContextMenu}
          isVisitor={isVisitor}
          isSearching={isSearching}
        />
      ))}
    </ul>
  );
}

function MapWorkspace({
  mapData,
  worldId,
  isVisitor,
  pinMode,
  mapSaving,
  onTogglePinMode,
  onAddPin,
  onEditPin,
  onDeletePin,
  onOpenTarget
}) {
  const imageUrl = getMapImageUrl(worldId, mapData.imagePath);

  return (
    <div className="map-workspace">
      <div className="map-toolbar">
        <div className="map-title-block">
          <Map size={18} />
          <div>
            <h2>{mapData.name}</h2>
            <span>{mapData.pins?.length || 0} pins</span>
          </div>
        </div>
        {!isVisitor && (
          <button
            className={`btn-secondary ${pinMode ? 'active-mode' : ''}`}
            onClick={onTogglePinMode}
            disabled={mapSaving}
          >
            <MapPin size={16} /> Pin
          </button>
        )}
      </div>

      <div className={`map-canvas ${pinMode ? 'pin-mode-cursor' : ''}`}>
        <MapContainer
          key={`${mapData.id}:${mapData.imagePath}`}
          crs={L.CRS.Simple}
          bounds={MAP_BOUNDS}
          minZoom={-2}
          maxZoom={4}
          zoomSnap={0.25}
          className="leaflet-map"
        >
          <ImageOverlay url={imageUrl} bounds={MAP_BOUNDS} />
          <MapClickHandler enabled={!isVisitor && pinMode} onAddPin={onAddPin} />
          {(mapData.pins || []).map(pin => (
            <Marker key={pin.id} position={[pin.y * 100, pin.x * 100]} icon={leafletPinIcon}>
              <Popup>
                <div className="map-popup">
                  <strong>{pin.label}</strong>
                  {pin.target && <span>{pin.target}</span>}
                  <div className="map-popup-actions">
                    {pin.target && (
                      <button type="button" onClick={() => onOpenTarget(pin.target)}>
                        Abrir
                      </button>
                    )}
                    {!isVisitor && (
                      <>
                        <button type="button" onClick={() => onEditPin(pin)}>
                          Editar
                        </button>
                        <button type="button" className="danger" onClick={() => onDeletePin(pin.id)}>
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function FileTree({ nodes, onFileSelect, selectedFile, openPrompt, onIconSelect, onContextMenu, renamingPath, onRename, isSearching, isVisitor }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.map(node => (
        <FileTreeNode key={node.path} node={node} onFileSelect={onFileSelect} selectedFile={selectedFile} openPrompt={openPrompt} onIconSelect={onIconSelect} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} isSearching={isSearching} isVisitor={isVisitor} />
      ))}
    </ul>
  );
}

function FileTreeNode({ node, onFileSelect, selectedFile, openPrompt, onIconSelect, onContextMenu, renamingPath, onRename, isSearching, isVisitor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const isSelected = selectedFile?.path === node.path;
  const isRenaming = renamingPath === node.path;
  const showChildren = isOpen || isSearching;
  
  useEffect(() => {
    if (isRenaming) {
      setEditValue(node.name);
    }
  }, [isRenaming, node.name]);

  // Close icon dropdown when clicking elsewhere
  useEffect(() => {
    if (!showIcons) return;
    const closeIt = () => setShowIcons(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [showIcons]);

  const handleDragStart = (e) => {
    if (isRenaming) return;
    const dragData = {
      uid: node.uid,
      name: node.name,
      path: node.path,
      type: 'wiki-link'
    };
    e.dataTransfer.setData('wiki-link', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <li className="tree-document">
      <div 
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        draggable={!isRenaming && !isVisitor}
        onDragStart={handleDragStart}
        onContextMenu={(e) => {
          if (isRenaming) return;
          e.preventDefault();
          onContextMenu(e, node);
        }}
      >
        <span
          className="tree-icon"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          style={{ width: 16, display: 'flex', justifyContent: 'center' }}
        >
          {node.children && node.children.length > 0 ? (showChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <div onClick={() => !isRenaming && onFileSelect(node)} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <span 
            className="tree-icon" 
            style={{ color: 'var(--text-secondary)', position: 'relative', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); !isRenaming && setShowIcons(!showIcons); }}
            title="Mudar Ícone"
          >
            {React.createElement(ICON_MAP[node.icon] || FileText, { size: 14 })}
            
            {showIcons && (
              <div className="icon-selector-dropdown glass-panel" onClick={e => e.stopPropagation()} style={{ top: '100%', left: '50%' }}>
                {Object.keys(ICON_MAP).map(key => (
                  <button 
                    key={key} 
                    className="icon-option" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowIcons(false); 
                      onIconSelect(node, key); 
                    }} 
                    title={key}
                  >
                    {React.createElement(ICON_MAP[key], { size: 18 })}
                  </button>
                ))}
              </div>
            )}
          </span>
          {isRenaming ? (
            <input
              className="tree-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => onRename(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRename(node, editValue);
                } else if (e.key === 'Escape') {
                  onRename(null);
                }
              }}
              autoFocus
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isVisitor && (
            <button
              className="node-action-btn"
              onClick={(e) => { e.stopPropagation(); openPrompt(node.path); setIsOpen(true); }}
              title="Criar"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>
      {showChildren && node.children && <FileTree nodes={node.children} onFileSelect={onFileSelect} selectedFile={selectedFile} openPrompt={openPrompt} onIconSelect={onIconSelect} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} isSearching={isSearching} isVisitor={isVisitor} />}
    </li>
  );
}

function AssetTree({ nodes, onAssetSelect, worldId, onDelete, onMove, onCreateFolder, renamingPath, onRename, onContextMenu, onExternalUpload, isSearching }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.map(node => (
        <AssetTreeNode 
          key={node.path} 
          node={node} 
          onAssetSelect={onAssetSelect} 
          worldId={worldId}
          onDelete={onDelete}
          onMove={onMove}
          onCreateFolder={onCreateFolder}
          renamingPath={renamingPath}
          onRename={onRename}
          onContextMenu={onContextMenu}
          onExternalUpload={onExternalUpload}
          isSearching={isSearching}
        />
      ))}
    </ul>
  );
}

function TemplateTree({ nodes, onTemplateSelect, onDelete, onMove, onCreateFolder, onCreateTemplate, renamingPath, onRename, onContextMenu, isSearching, worldId }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.map(node => (
        <TemplateTreeNode 
          key={node.path} 
          node={node} 
          onTemplateSelect={onTemplateSelect} 
          onDelete={onDelete}
          onMove={onMove}
          onCreateFolder={onCreateFolder}
          onCreateTemplate={onCreateTemplate}
          renamingPath={renamingPath}
          onRename={onRename}
          onContextMenu={onContextMenu}
          isSearching={isSearching}
          worldId={worldId}
        />
      ))}
    </ul>
  );
}

function TemplateTreeNode({ node, onTemplateSelect, onDelete, onMove, onCreateFolder, onCreateTemplate, renamingPath, onRename, onContextMenu, isSearching, worldId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const [showPreview, setShowPreview] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [previewContent, setPreviewContent] = useState('');
  const isFolder = node.type === 'folder';
  const isRenaming = renamingPath === node.path;
  const isChildRenaming = renamingPath && renamingPath.startsWith(node.path + '/');
  const showChildren = isOpen || isSearching || isChildRenaming;

  useEffect(() => {
    if (isRenaming) setEditValue(node.name);
  }, [isRenaming, node.name]);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('sourcePath', node.path);
    e.dataTransfer.setData('templatePath', node.path);
    e.dataTransfer.setData('templateType', 'content');
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e) => {
    if (isFolder && e.dataTransfer.types.includes('sourcepath')) {
      e.preventDefault();
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    if (!isFolder) return;
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const sourcePath = e.dataTransfer.getData('sourcePath');
    if (sourcePath && sourcePath !== node.path) {
      onMove(sourcePath, node.path);
    }
  };

  const fetchPreview = async () => {
    if (isFolder || node.type !== 'content') return;
    try {
      const res = await fetch(`/api/templates/read?path=${encodeURIComponent(node.path)}`);
      if (res.ok) {
        const text = await res.text();
        setPreviewContent(text.slice(0, 500) + (text.length > 500 ? '...' : ''));
      }
    } catch (e) {}
  };

  return (
    <li className="tree-document">
      <div 
        className="tree-node"
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          if (isRenaming) return;
          e.preventDefault();
          onContextMenu(e, node);
        }}
        onMouseEnter={() => {
          if (!isFolder && node.type === 'content') {
            setShowPreview(true);
            fetchPreview();
          }
        }}
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setShowPreview(false)}
        onClick={() => {
          if (isRenaming) return;
          if (isFolder) setIsOpen(!isOpen);
          else onTemplateSelect(node);
        }}
      >
        <span className="tree-icon" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
          {isFolder ? (showChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
          <span className="tree-icon" style={{ color: 'var(--text-secondary)' }}>
            {isFolder ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />) : (
              node.type === 'content' ? <FileText size={14} /> : <Columns size={14} />
            )}
          </span>
          {isRenaming ? (
            <input
              className="tree-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => onRename(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename(node, editValue);
                else if (e.key === 'Escape') onRename(null);
              }}
              autoFocus
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="node-name">{node.name}</span>
          )}
        </div>
        {isFolder && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className="node-action-btn"
              onClick={(e) => { e.stopPropagation(); onCreateTemplate(node.path); setIsOpen(true); }}
              title="Criar Template"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
      {showChildren && node.children && (
        <TemplateTree 
          nodes={node.children} 
          onTemplateSelect={onTemplateSelect} 
          onDelete={onDelete}
          onMove={onMove}
          onCreateFolder={onCreateFolder}
          onCreateTemplate={onCreateTemplate}
          renamingPath={renamingPath}
          onRename={onRename}
          onContextMenu={onContextMenu}
          isSearching={isSearching}
          worldId={worldId}
        />
      )}
      {showPreview && <TemplatePreviewCard content={previewContent} name={node.name} pos={mousePos} />}
    </li>
  );
}

function TemplatePreviewCard({ content, name, pos }) {
  const html = useMemo(() => {
    return DOMPurify.sanitize(marked(content));
  }, [content]);

  return (
    <div 
      className="floating-preview-card glass-panel"
      style={{ 
        position: 'fixed',
        left: Math.min(pos.x + 20, window.innerWidth - 320), 
        top: Math.min(pos.y + 20, window.innerHeight - 400),
        maxHeight: '300px',
        width: '300px',
        overflow: 'hidden',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <div className="preview-header" style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
        <FileText size={14} />
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Preview: {name}</span>
      </div>
      <div className="preview-body markdown-preview" dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: '12px', padding: '12px', overflowY: 'auto' }} />
    </div>
  );
}


function AssetTreeNode({ node, onAssetSelect, worldId, onDelete, onMove, onCreateFolder, renamingPath, onRename, onContextMenu, onExternalUpload, isSearching }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const [showPreview, setShowPreview] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const isFolder = node.type === 'folder';
  const isImage = node.type === 'image';
  const isAudio = node.type === 'audio';
  const isRenaming = renamingPath === node.path;
  const showChildren = isOpen || isSearching;

  const displayName = isFolder ? node.name : node.name.replace(/\.[^/.]+$/, "");

  useEffect(() => {
    if (isRenaming) setEditValue(displayName);
  }, [isRenaming, displayName]);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('sourcePath', node.path);
    e.dataTransfer.setData('assetNode', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e) => {
    if (isFolder) {
      e.preventDefault();
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    if (!isFolder) return;
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    // Internal move
    const sourcePath = e.dataTransfer.getData('sourcePath');
    if (sourcePath && sourcePath !== node.path) {
      onMove(sourcePath, node.path);
      return;
    }

    // External upload
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onExternalUpload(e.dataTransfer.files[0], node.path);
    }
  };

  return (
    <li className="tree-document">
      <div 
        className="tree-node"
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          if (isRenaming) return;
          e.preventDefault();
          onContextMenu(e, node, true); // true for isAsset
        }}
        onMouseEnter={(e) => {
          if (isImage || isAudio) setShowPreview(true);
        }}
        onMouseMove={(e) => {
          if (isImage || isAudio) setMousePos({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => {
          setShowPreview(false);
        }}
        onClick={() => {
          if (isRenaming) return;
          if (isFolder) setIsOpen(!isOpen);
          else onAssetSelect(node);
        }}
      >
        <span className="tree-icon" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
          {isFolder ? (showChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
          <span className="tree-icon" style={{ color: 'var(--text-secondary)' }}>
            {isFolder ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />) : (
              node.type === 'image' ? <Image size={14} /> : <Music size={14} />
            )}
          </span>
          {isRenaming ? (
            <input
              className="tree-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => onRename(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename(node, editValue);
                else if (e.key === 'Escape') onRename(null);
              }}
              autoFocus
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="asset-name-tree">{displayName}</span>
          )}
        </div>
        {isFolder && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className="node-action-btn"
              onClick={(e) => { e.stopPropagation(); onCreateFolder(node.path); setIsOpen(true); }}
              title="Criar"
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {(isImage || isAudio) && showPreview && (
          <div 
            className="asset-hover-preview glass-panel"
            style={{ 
              position: 'fixed', 
              top: mousePos.y + 10, 
              left: mousePos.x + 20,
              zIndex: 10000,
              pointerEvents: isAudio ? 'auto' : 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isImage && <img src={node.url} alt="Preview" style={{ maxWidth: '250px', maxHeight: '250px', display: 'block', borderRadius: '4px' }} />}
            {isAudio && (
              <div style={{ minWidth: '220px', padding: '4px' }}>
                <div style={{ fontSize: '11px', marginBottom: '8px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {node.name}
                </div>
                <audio src={node.url} controls autoPlay style={{ width: '100%', height: '32px' }} />
              </div>
            )}
          </div>
        )}
      </div>
      {isFolder && showChildren && node.children && (
        <AssetTree 
          nodes={node.children} 
          onAssetSelect={onAssetSelect} 
          worldId={worldId}
          onDelete={onDelete}
          onMove={onMove}
          onCreateFolder={onCreateFolder}
          renamingPath={renamingPath}
          onRename={onRename}
          onContextMenu={onContextMenu}
          onExternalUpload={onExternalUpload}
          isSearching={isSearching}
        />
      )}
    </li>
  );
}

export default function WorldWorkspace({ params }) {
  const worldId = params.id;
  const [, setLocation] = useLocation();
  const isVisitor = useMemo(() => new URLSearchParams(window.location.search).get('view') === 'true', []);
  
  const [worldData, setWorldData] = useState(null);
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('view'); // Inicia sempre em Preview (view)
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'dirty', 'error'
  const editorRef = useRef(null);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, node: null, isAsset: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [sidebarTab, setSidebarTab] = useState('project'); // 'project', 'assets', 'maps', or 'templates'
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [renamingPath, setRenamingPath] = useState(null);
  const [renamingMediaPath, setRenamingMediaPath] = useState(null);
  const [uploadingProgress, setUploadingProgress] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [maps, setMaps] = useState([]);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [selectedMap, setSelectedMap] = useState(null);
  const [showMapCreateModal, setShowMapCreateModal] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapImagePath, setNewMapImagePath] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [pinDraft, setPinDraft] = useState(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [wikiResolver, setWikiResolver] = useState({ isOpen: false, query: '', name: '', onSelect: null });
  const [showAssetUploadModal, setShowAssetUploadModal] = useState(false);
  const [renamingMapPath, setRenamingMapPath] = useState(null);
  const treeRef = useRef(tree);
  const mapFileInputRef = useRef(null);
  const assetFileInputRef = useRef(null);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
    };
  }, [contextMenu]);

  const processWikiLinks = (content) => {
    if (!content) return '';
    // Suporta tanto [[nome]] quanto [[uid|nome]]
    return content.replace(/\[\[(.*?)\]\]/g, (match, raw) => {
      const parts = raw.split('|');
      const target = parts[0].trim();
      const alias = parts[1] ? parts[1].trim() : target;
      
      // Verifica se o target é um UID (formato uuid v4 aproximado) ou nome
      const isUid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
      
      return `<a href="#" class="wiki-link" data-wiki-target="${target}" data-is-uid="${isUid}">${alias}</a>`;
    });
  };

  const handleWikiLinkNavigation = (target, isUid = false) => {
    const findInTree = (nodes, val, byUid = false) => {
      for (const node of nodes) {
        if (byUid) {
          if (node.uid === val) return node;
        } else {
          if (node.name.toLowerCase() === val.toLowerCase()) return node;
        }
        if (node.children) {
          const found = findInTree(node.children, val, byUid);
          if (found) return found;
        }
      }
      return null;
    };

    const match = findInTree(tree, target, isUid);

    if (match) {
      addToast(`Abrindo: ${match.name}`, 'success');
      setViewMode('view');
      selectFile(match);
    } else {
      addToast(`Documento não encontrado para "${target}".`, 'warning');
    }
  };

  const handlePreviewClick = (e) => {
    const wikiLink = e.target.closest('.wiki-link');
    if (wikiLink) {
      e.preventDefault();
      const target = wikiLink.getAttribute('data-wiki-target');
      const isUid = wikiLink.getAttribute('data-is-uid') === 'true';
      handleWikiLinkNavigation(target, isUid);
    }
  };

  const handleWikiLinkSelection = (text) => {
    // Abre sempre o modal para permitir busca e seleção precisa
    setWikiResolver({ 
      isOpen: true, 
      query: text.trim(),
      name: text.trim(), // Texto original para o alias do link
      onSelect: (selected) => {
        const uidLink = `[[${selected.uid}|${text}]]`;
        const editor = editorRef.current;
        const selection = editor.getSelection();
        editor.executeEdits('wiki-link', [{
          range: selection,
          text: uidLink,
          forceMoveMarkers: true
        }]);
      }
    });
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register Ctrl + S command in Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    const languages = ['markdown', 'html'];
    languages.forEach(langId => {
      if (!monaco.languages.getLanguages().some(l => l.id === langId && l._wikiRegistered)) {
        monaco.languages.registerCompletionItemProvider(langId, {
          triggerCharacters: ['['],
          provideCompletionItems: (model, position) => {
            const lineContent = model.getLineContent(position.lineNumber);
            const beforeCursor = lineContent.substring(0, position.column - 1);
            
            if (beforeCursor.endsWith('[[')) {
              const suggestions = [];
              const flatten = (nodes) => {
                nodes.forEach(n => {
                  suggestions.push({
                    label: n.name,
                    kind: monaco.languages.CompletionItemKind.Reference,
                    insertText: `${n.uid}|${n.name}]]`,
                    detail: n.path,
                    range: {
                      startLineNumber: position.lineNumber,
                      endLineNumber: position.lineNumber,
                      startColumn: position.column,
                      endColumn: position.column
                    }
                  });
                  if (n.children) flatten(n.children);
                });
              };
              flatten(treeRef.current);
              return { suggestions };
            }
            return { suggestions: [] };
          }
        });
        const lang = monaco.languages.getLanguages().find(l => l.id === langId);
        if (lang) lang._wikiRegistered = true;
      }
    });

    // Comando Ctrl+L para transformar seleção em link
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      const selection = editor.getSelection();
      const text = editor.getModel().getValueInRange(selection);
      if (text) {
        handleWikiLinkSelection(text);
      }
    });

    // Drag & Drop / Paste support
    const container = editor.getDomNode();
    if (container) {
      container.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // Wiki-link Drop (from Project Tree)
        const wikiData = e.dataTransfer.getData('wiki-link');
        if (wikiData) {
          try {
            const data = JSON.parse(wikiData);
            const uidLink = `[[${data.uid}|${data.name}]]`;
            
            const coords = { x: e.clientX, y: e.clientY };
            const target = editor.getTargetAtClientPoint(coords.x, coords.y);
            if (target && target.position) {
              editor.executeEdits('wiki-link-drop', [{
                range: {
                  startLineNumber: target.position.lineNumber,
                  startColumn: target.position.column,
                  endLineNumber: target.position.lineNumber,
                  endColumn: target.position.column
                },
                text: uidLink,
                forceMoveMarkers: true
              }]);
            }
          } catch(err) {
            console.error('Error parsing wiki-link data:', err);
          }
          return;
        }

        // Internal Asset Drop
        const assetData = e.dataTransfer.getData('assetNode');
        if (assetData) {
          const node = JSON.parse(assetData);
          if (node.type !== 'folder') {
            const code = node.type === 'audio' 
              ? `<audio controls src="${node.url}" style="width:100%; margin: 10px 0;"></audio>` 
              : `<img src="${node.url}" alt="${node.name}" style="width: 100%; display: block;">`;
            
            const coords = { x: e.clientX, y: e.clientY };
            const target = editor.getTargetAtClientPoint(coords.x, coords.y);
            if (target && target.position) {
              editor.executeEdits('', [{
                range: {
                  startLineNumber: target.position.lineNumber,
                  startColumn: target.position.column,
                  endLineNumber: target.position.lineNumber,
                  endColumn: target.position.column
                },
                text: code,
                forceMoveMarkers: true
              }]);
            }
            return;
          }
        }

        // External File
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
      }, true);

      container.addEventListener('paste', (e) => {
        const file = e.clipboardData.files[0];
        if (file) {
          e.preventDefault();
          handleUpload(file);
        }
      }, true);
    }
  };
  const [showTemplateSaveModal, setShowTemplateSaveModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [renamingTemplatePath, setRenamingTemplatePath] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleCreate = async (parentPath = '') => {
    try {
      const tempName = `Novo Documento`;
      const path = parentPath ? `${parentPath}/${tempName}` : tempName;
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: '' })
      });
      
      if (!res.ok) throw new Error('Erro ao criar');
      
      const newDoc = await res.json();
      await loadTree();
      
      // Trigger renaming for the new document
      setTimeout(() => {
        setRenamingPath(newDoc.path);
      }, 100);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
    };
  }, []);

  const loadTree = async () => {
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/tree?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setTree(data.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setWorldData({ id: worldId, displayName: decodeURIComponent(worldId) });
    loadTree();
  }, [worldId]);

  const loadMedia = async () => {
    setMediaLoading(true);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/media`);
      if (res.ok) {
        const data = await res.json();
        setMediaFiles(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMediaLoading(false);
    }
  };

  const loadMaps = async () => {
    setMapsLoading(true);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps`);
      if (res.ok) {
        const data = await res.json();
        setMaps(data.items || []);
        setSelectedMap(current => {
          if (!current) return current;
          return (data.items || []).find(mapItem => mapItem.id === current.id) || null;
        });
      }
    } catch (e) {
      console.error(e);
      addToast('Erro ao carregar mapas', 'error');
    } finally {
      setMapsLoading(false);
    }
  };

  const selectFile = (node) => {
    setSelectedMap(null);
    setPinMode(false);
    setSelectedFile(node);
  };

  const selectMap = (mapItem) => {
    if (!mapItem || mapItem.type === 'folder') return;
    setSelectedFile(null);
    setViewMode('view');
    setSelectedMap(mapItem);
    setPinMode(false);
  };

  const saveMap = async (mapData, successMessage = 'Mapa salvo') => {
    setMapSaving(true);
    try {
      const path = mapData.path.replace(/\.json$/, '');
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapData)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao salvar mapa');
      }
      const savedMap = await res.json();
      await loadMaps();
      setSelectedMap(savedMap);
      addToast(successMessage, 'success');
      return savedMap;
    } catch (e) {
      console.error(e);
      addToast(e.message || 'Erro ao salvar mapa', 'error');
      return null;
    } finally {
      setMapSaving(false);
    }
  };

  const handleCreateMap = async () => {
    if (!newMapName.trim() || !newMapImagePath) return;
    setMapSaving(true);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMapName.trim(), imagePath: newMapImagePath })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao criar mapa');
      }
      await loadMaps();
      setShowMapCreateModal(false);
      setNewMapName('');
      setNewMapImagePath('');
      addToast('Mapa criado!', 'success');
    } catch (e) {
      console.error(e);
      addToast(e.message || 'Erro ao criar mapa', 'error');
    } finally {
      setMapSaving(false);
    }
  };

  const handleCreateMapFolder = async (parentPath = '') => {
    const name = window.prompt('Nome da pasta:');
    if (!name) return;
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath })
      });
      if (res.ok) {
        await loadMaps();
        addToast('Pasta criada!', 'success');
      } else {
        const error = await res.json();
        addToast(error.error || 'Erro ao criar pasta', 'error');
      }
    } catch (e) {
      addToast('Erro ao criar pasta', 'error');
    }
  };

  const handleRenameMapSubmit = async (node, newName) => {
    if (!node || !newName || newName === node.name) {
      setRenamingMapPath(null);
      return;
    }
    
    try {
      const isFolder = node.type === 'folder';
      const extension = isFolder ? "" : ".json";
      const oldPath = node.path;
      const parentPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
      const newPath = parentPath ? `${parentPath}/${newName}${extension}` : `${newName}${extension}`;
      
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: oldPath, targetPath: newPath })
      });
      
      if (res.ok) {
        await loadMaps();
        addToast('Renomeado!', 'success');
      } else {
        const err = await res.json();
        addToast('Erro ao renomear: ' + (err.error || ''), 'error');
      }
    } catch (e) {
      addToast('Erro de conexão ao renomear', 'error');
    } finally {
      setRenamingMapPath(null);
    }
  };

  const handleMoveMap = async (sourcePath, targetPath) => {
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, targetPath })
      });
      if (res.ok) {
        await loadMaps();
        addToast('Movido com sucesso!', 'success');
      } else {
        const error = await res.json();
        addToast(error.error || 'Erro ao mover', 'error');
      }
    } catch (e) {
      addToast('Erro ao mover', 'error');
    }
  };

  const handleMapImageUpload = async (file) => {
    if (!file) return;
    const isImageFile = file.type.startsWith('image/') || /\.(gif|jpe?g|png|webp)$/i.test(file.name);
    if (!isImageFile) {
      addToast('Use uma imagem para criar o mapa.', 'warning');
      return;
    }

    try {
      const uploaded = await handleUpload(file, 'maps', false);
      const uploadedPath = uploaded?.path || (uploaded?.filename ? `maps/${uploaded.filename}` : '');
      if (!uploadedPath) {
        throw new Error('Upload sem caminho retornado');
      }
      setNewMapImagePath(uploadedPath);
      if (!newMapName.trim()) {
        setNewMapName(file.name.replace(/\.[^/.]+$/, ''));
      }
      await loadMedia();
      addToast('Imagem do mapa enviada!', 'success');
    } catch (e) {
      console.error(e);
      addToast('Erro ao enviar imagem do mapa', 'error');
    } finally {
      if (mapFileInputRef.current) {
        mapFileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteMap = (mapItem) => {
    setDeleteModal({ isOpen: true, node: mapItem, isAsset: false, isTemplate: false, isMap: true });
  };

  const handleMapPointClick = ({ x, y }) => {
    setPinDraft({
      mode: 'create',
      id: null,
      label: '',
      target: '',
      x,
      y
    });
  };

  const handleEditPin = (pin) => {
    setPinDraft({
      mode: 'edit',
      ...pin
    });
  };

  const handleSavePin = async () => {
    if (!selectedMap || !pinDraft?.label.trim()) {
      addToast('Informe um nome para o pin.', 'warning');
      return;
    }

    const pin = {
      id: pinDraft.id || crypto.randomUUID(),
      label: pinDraft.label.trim(),
      x: pinDraft.x,
      y: pinDraft.y,
      target: pinDraft.target.trim(),
      icon: pinDraft.icon || 'MapPin'
    };
    const pins = pinDraft.mode === 'edit'
      ? (selectedMap.pins || []).map(item => item.id === pin.id ? pin : item)
      : [...(selectedMap.pins || []), pin];
    const saved = await saveMap({ ...selectedMap, pins }, 'Pin salvo');
    if (saved) {
      setPinDraft(null);
      setPinMode(false);
    }
  };

  const handleDeletePin = async (pinId) => {
    if (!selectedMap) return;
    const pins = (selectedMap.pins || []).filter(pin => pin.id !== pinId);
    await saveMap({ ...selectedMap, pins }, 'Pin removido');
  };

  const handleOpenMapTarget = (targetPath) => {
    const match = findNodeByPath(tree, targetPath);
    if (match) {
      selectFile(match);
      setSidebarTab('project');
      return;
    }
    handleWikiLinkNavigation(targetPath, false);
  };

  const handleDeleteMedia = async (filename) => {
    if (!confirm(`Deseja excluir permanentemente o arquivo ${filename}?`)) return;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/media/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMediaFiles(prev => prev.filter(f => f.filename !== filename));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyMediaCode = (item) => {
    const code = item.type === 'audio' 
      ? `<audio controls src="${item.url}" style="width:100%; margin: 10px 0;"></audio>` 
      : `<img src="${item.url}" alt="${item.name}" style="width: 100%; display: block;">`;
    navigator.clipboard.writeText(code);
    addToast('Código copiado para a área de transferência!', 'success');
  };

  const handleCreateMediaFolder = async (parentPath = '') => {
    try {
      const tempName = 'Nova Pasta';
      const path = parentPath ? `${parentPath}/${tempName}` : tempName;
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/media/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      if (res.ok) {
        await loadMedia();
        setTimeout(() => setRenamingMediaPath(path), 100);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch(`/api/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (sidebarTab === 'assets') {
      loadMedia();
    } else if (sidebarTab === 'maps') {
      loadMaps();
      loadMedia();
    } else if (sidebarTab === 'templates') {
      loadTemplates();
    }
  }, [sidebarTab, worldId]);

  const handleSaveTemplate = async (parentPathArg = "") => {
    const nameStr = String(newTemplateName || "");
    const contentStr = String(fileContent || "");
    const parentPathStr = typeof parentPathArg === 'string' ? parentPathArg : "";
    
    if (!nameStr) {
      addToast('Por favor, informe o nome do template.', 'warning');
      return;
    }
    
    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameStr,
          content: contentStr,
          parentPath: parentPathStr,
          type: 'content'
        })
      });
      
      if (res.ok) {
        setShowTemplateSaveModal(false);
        setNewTemplateName('');
        loadTemplates();
        addToast('Template salvo com sucesso!', 'success');
      } else {
        const errorData = await res.json().catch(() => ({}));
        addToast('Erro ao salvar template: ' + (errorData.error || 'Erro no servidor'), 'error');
      }
    } catch (e) {
      console.error('Save Template Fatal Error:', e);
      addToast('Erro de conexão ou erro interno ao salvar template.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleEditTemplate = async (template) => {
    if (template.type !== 'content') return;
    try {
      const res = await fetch(`/api/templates/read?path=${encodeURIComponent(template.path)}`);
      if (res.ok) {
        const content = await res.text();
        setFileContent(content);
        setSelectedMap(null);
        setSelectedFile({ ...template, isTemplate: true });
        setViewMode('edit');
        if (editorRef.current) {
          editorRef.current.setValue(content);
        }
      } else {
        addToast('Erro ao carregar template', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erro ao carregar template para edição', 'error');
    }
  };

  const handleCreateBlankTemplate = async (parentPathArg = '') => {
    const parentPath = typeof parentPathArg === 'string' ? parentPathArg : "";
    try {
      const tempName = 'Novo Template';
      const res = await fetch(`/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempName, content: '', parentPath, type: 'content' })
      });
      if (res.ok) {
        const newTemplate = await res.json();
        loadTemplates();
        setTimeout(() => setRenamingTemplatePath(newTemplate.path), 100);
        addToast('Template criado!', 'success');
      } else {
        const err = await res.json();
        addToast('Erro ao criar template: ' + (err.error || ''), 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erro de conexão ao criar template', 'error');
    }
  };

  const handleCreateTemplateFolder = async (parentPathArg = '') => {
    const parentPath = typeof parentPathArg === 'string' ? parentPathArg : "";
    try {
      const tempName = 'Nova Pasta';
      const path = parentPath ? `${parentPath}/${tempName}` : tempName;
      const res = await fetch(`/api/templates/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      if (res.ok) {
        loadTemplates();
        setTimeout(() => setRenamingTemplatePath(path), 100);
      } else {
        const errorData = await res.json().catch(() => ({}));
        addToast('Erro ao criar pasta: ' + (errorData.error || 'Erro no servidor'), 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erro de conexão ao criar pasta', 'error');
    }
  };

  const handleRenameTemplate = async (node, newName) => {
    if (!node || !newName) {
      setRenamingTemplatePath(null);
      return;
    }
    
    try {
      const isFolder = node.type === 'folder';
      const extension = isFolder ? "" : (node.path.includes('.') ? node.path.slice(node.path.lastIndexOf('.')) : "");
      const finalName = newName + extension;
      
      const parentPath = node.path.split('/').slice(0, -1).join('/');
      const targetPath = parentPath ? `${parentPath}/${finalName}` : finalName;
      
      const res = await fetch(`/api/templates/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: node.path, targetPath })
      });
      if (res.ok) {
        setRenamingTemplatePath(null);
        loadTemplates();
      }
    } catch (e) {
      console.error(e);
      setRenamingTemplatePath(null);
    }
  };

  const handleMoveTemplate = async (sourcePath, targetPath) => {
    const filename = sourcePath.includes('/') ? sourcePath.split('/').pop() : sourcePath;
    const fullTargetPath = targetPath ? `${targetPath}/${filename}` : filename;
    if (sourcePath === fullTargetPath) return;
    try {
      const res = await fetch(`/api/templates/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, targetPath: fullTargetPath })
      });
      if (res.ok) loadTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTemplate = async (node) => {
    setDeleteModal({ isOpen: true, node, isTemplate: true });
  };


  const handleRenameMediaSubmit = async (node, newName) => {
    if (!node) {
      setRenamingMediaPath(null);
      return;
    }
    
    try {
      const isFolder = node.type === 'folder';
      const oldDisplayName = isFolder ? node.name : node.name.replace(/\.[^/.]+$/, "");
      
      if (!newName || newName === oldDisplayName) {
        setRenamingMediaPath(null);
        return;
      }
      
      const extension = isFolder ? "" : node.name.slice(node.name.lastIndexOf('.'));
      const finalName = newName + extension;
      
      const parentPath = node.path.split('/').slice(0, -1).join('/');
      const targetPath = parentPath ? `${parentPath}/${finalName}` : finalName;
      
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/media/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: node.path, targetPath })
      });
      
      if (res.ok) {
        setRenamingMediaPath(null);
        loadMedia();
      }
    } catch (e) {
      console.error(e);
      setRenamingMediaPath(null);
    }
  };

  const handleMoveMedia = async (sourcePath, targetParentPath) => {
    const filename = sourcePath.split('/').pop();
    const targetPath = `${targetParentPath}/${filename}`;
    
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/media/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, targetPath })
      });
      if (res.ok) loadMedia();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMediaNode = async (node) => {
    setDeleteModal({ isOpen: true, node, isAsset: true });
  };

  useEffect(() => {
    if (selectedFile && !selectedFile.isTemplate) {
      fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(selectedFile.path)}`)
        .then(res => res.json())
        .then(data => setFileContent(data.content || ''))
        .catch(console.error);
    }
  }, [selectedFile, worldId]);



  const handleDeleteSubmit = async () => {
    try {
      if (!deleteModal.node) return;
      
      if (deleteModal.isAsset) {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/media/${encodeURIComponent(deleteModal.node.path)}`, {
          method: 'DELETE'
        });
        if (res.ok) loadMedia();
      } else if (deleteModal.isTemplate) {
        const res = await fetch(`/api/templates?path=${encodeURIComponent(deleteModal.node.path)}`, {
          method: 'DELETE'
        });
        if (res.ok) loadTemplates();
      } else if (deleteModal.isMap) {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: deleteModal.node.path })
        });
        if (res.ok) {
          if (selectedMap?.path === deleteModal.node.path) setSelectedMap(null);
          await loadMaps();
          addToast(deleteModal.node.type === 'folder' ? 'Pasta excluída' : 'Mapa excluído', 'success');
        }
      } else {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(deleteModal.node.path)}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) throw new Error('Erro ao deletar documento');
        
        if (selectedFile && selectedFile.path.startsWith(deleteModal.node.path)) {
          setSelectedFile(null);
          setViewMode('edit');
        }
        loadTree();
        addToast(deleteModal.node.type === 'folder' ? 'Pasta excluída' : 'Documento excluído', 'success');
      }
      
      setDeleteModal({ isOpen: false, node: null, isAsset: false, isTemplate: false, isMap: false });
    } catch (e) {
      console.error(e);
      addToast('Erro ao excluir', 'error');
    }
  };

  const handleRenameSubmit = async (node, newName) => {
    if (!node) {
      setRenamingPath(null);
      return;
    }
    
    try {
      if (!newName || newName === node.name) {
        setRenamingPath(null);
        return;
      }
      
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, newName })
      });
      
      setRenamingPath(null);
      loadTree();
    } catch (e) {
      console.error(e);
      setRenamingPath(null);
    }
  };

  // Track changes to show "isDirty" status
  useEffect(() => {
    if (fileContent !== lastSavedContent) {
      setIsDirty(true);
      setSaveStatus('dirty');
    } else {
      setIsDirty(false);
      setSaveStatus('saved');
    }
  }, [fileContent, lastSavedContent]);

  // Autosave Logic
  useEffect(() => {
    if (!isDirty || saving || isVisitor || !selectedFile) return;

    const timer = setTimeout(() => {
      handleSave(true); // Silent save
    }, 2000);

    return () => clearTimeout(timer);
  }, [fileContent, isDirty, saving, isVisitor, selectedFile]);

  // Ctrl + S Global Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileContent, selectedFile]); // Depend on content to ensure current state is used
  const handleSave = async (isSilent = false) => {
    if (!selectedFile) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const isTemplate = selectedFile.isTemplate;
      const url = isTemplate ? '/api/templates' : `/api/worlds/${encodeURIComponent(worldId)}/documents`;
      
      const body = isTemplate ? {
        name: selectedFile.name,
        content: fileContent,
        parentPath: selectedFile.path.includes('/') ? selectedFile.path.substring(0, selectedFile.path.lastIndexOf('/')) : '',
        type: 'content'
      } : {
        path: selectedFile.path,
        content: fileContent
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setLastSavedContent(fileContent);
        setSaveStatus('saved');
        addToast(isSilent ? 'Autosave: Progresso salvo' : (isTemplate ? 'Template salvo com sucesso!' : 'Arquivo salvo com sucesso!'), 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        if (!isSilent) {
          addToast('Erro ao salvar: ' + (err.error || 'Erro desconhecido'), 'error');
        }
        setSaveStatus('error');
      }
      setSaving(false);
    } catch (e) {
      console.error(e);
      if (!isSilent) {
        addToast('Erro de conexão ao salvar', 'error');
      }
      setSaveStatus('error');
      setSaving(false);
    }
  };

  const handleUpload = async (file, targetFolder = '', insertInEditor = true) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (targetFolder) formData.append('folder', targetFolder);

    const placeholder = insertInEditor ? `![Uploading ${file.name}...]()` : null;
    let placeholderPos = null;

    if (insertInEditor && editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      placeholderPos = selection;
      
      editor.executeEdits('', [{
        range: selection,
        text: placeholder,
        forceMoveMarkers: true
      }]);
    }

    setUploadingProgress(0);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadingProgress(percent);
        }
      });

      xhr.addEventListener('load', async () => {
        setUploadingProgress(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          
          if (insertInEditor && editorRef.current && placeholderPos) {
            const editor = editorRef.current;
            const model = editor.getModel();
            const content = model.getValue();
            const code = data.type === 'audio' 
              ? `<audio controls src="${data.url}" style="width:100%; margin: 10px 0;"></audio>` 
              : `<img src="${data.url}" alt="${data.filename}" style="width: 100%; display: block;">`;
            
            const startIdx = content.indexOf(placeholder);
            if (startIdx !== -1) {
              const startPos = model.getPositionAt(startIdx);
              const endPos = model.getPositionAt(startIdx + placeholder.length);
              
              editor.executeEdits('', [{
                range: {
                  startLineNumber: startPos.lineNumber,
                  startColumn: startPos.column,
                  endLineNumber: endPos.lineNumber,
                  endColumn: endPos.column
                },
                text: code,
                forceMoveMarkers: true
              }]);
            }
          }
          
          loadMedia();
          resolve(data);
        } else {
          if (insertInEditor && editorRef.current && placeholder) {
            const editor = editorRef.current;
            const model = editor.getModel();
            const content = model.getValue();
            const startIdx = content.indexOf(placeholder);
            if (startIdx !== -1) {
               const startPos = model.getPositionAt(startIdx);
               const endPos = model.getPositionAt(startIdx + placeholder.length);
               editor.executeEdits('', [{
                 range: { startLineNumber: startPos.lineNumber, startColumn: startPos.column, endLineNumber: endPos.lineNumber, endColumn: endPos.column },
                 text: `[Erro no upload: ${file.name}]`,
                 forceMoveMarkers: true
               }]);
            }
          }
          reject(new Error('Upload failed'));
        }
      });

      xhr.addEventListener('error', () => {
        setUploadingProgress(null);
        reject(new Error('Network error'));
      });

      xhr.open('POST', `/api/worlds/${encodeURIComponent(worldId)}/media`);
      xhr.send(formData);
    });
  };


  const sidebarStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(to bottom, rgba(15, 17, 21, 0.75), rgba(15, 17, 21, 0.98)), url(/api/worlds/${encodeURIComponent(worldId)}/thumbnail?v=${Date.now()})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }), [worldId]);

  const handleIconSelect = async (node, iconName) => {
    // Optimistic UI Update
    const updateNodeIcon = (nodes) => {
      return nodes.map(n => {
        if (n.path === node.path) return { ...n, icon: iconName };
        if (n.children) return { ...n, children: updateNodeIcon(n.children) };
        return n;
      });
    };
    setTree(prev => updateNodeIcon(prev));
    
    if (selectedFile && selectedFile.path === node.path) {
      setSelectedFile(prev => ({ ...prev, icon: iconName }));
    }

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, metadata: { icon: iconName } })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update icon');
      }
      
      loadTree();
    } catch(e) {
      console.error(e);
      loadTree(); // revert on failure
    }
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    const filter = (items) => {
      return items.reduce((acc, item) => {
        const matches = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const filteredChildren = item.children ? filter(item.children) : null;
        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...item, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(tree);
  }, [tree, searchQuery]);

  const filteredAssets = useMemo(() => {
    if (!assetSearchQuery) return mediaFiles;
    const filter = (items) => {
      return items.reduce((acc, item) => {
        const matches = item.name.toLowerCase().includes(assetSearchQuery.toLowerCase());
        const filteredChildren = item.children ? filter(item.children) : null;
        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...item, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(mediaFiles);
  }, [mediaFiles, assetSearchQuery]);

  const imageAssets = useMemo(() => flattenNodes(mediaFiles, isImageAsset), [mediaFiles]);

  const filteredTemplates = useMemo(() => {
    if (!assetSearchQuery) return templates;
    const filter = (items) => {
      return items.reduce((acc, item) => {
        const matches = item.name.toLowerCase().includes(assetSearchQuery.toLowerCase());
        const filteredChildren = item.children ? filter(item.children) : null;
        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...item, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(templates);
  }, [templates, assetSearchQuery]);

  const filteredMaps = useMemo(() => {
    if (!mapSearchQuery) return maps;
    const filter = (items) => {
      return items.reduce((acc, item) => {
        const matches = item.type === 'map' && item.name.toLowerCase().includes(mapSearchQuery.toLowerCase());
        const filteredChildren = item.children ? filter(item.children) : null;
        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...item, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(maps);
  }, [maps, mapSearchQuery]);

  const breadcrumbs = useMemo(() => {
    if (!selectedFile) return [];
    const segments = selectedFile.path.split('/');
    const items = segments.map((seg, i) => ({
      name: seg,
      path: segments.slice(0, i + 1).join('/')
    }));
    if (selectedFile.isTemplate) {
      items[items.length - 1].name = `[TEMPLATE] ${items[items.length - 1].name}`;
    }
    return items;
  }, [selectedFile]);

  const handleContextMenu = (e, node, isAsset = false, isTemplate = false, isMap = false) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
      isAsset,
      isTemplate,
      isMap
    });
  };

  const editorLanguage = useMemo(() => {
    if (!fileContent) return 'markdown';
    const htmlIndicators = ['<!doctype', '<html', '<div', '<section', '<p>', '<br>', '<style'];
    const contentLower = fileContent.toLowerCase().trim();
    if (htmlIndicators.some(indicator => contentLower.includes(indicator))) {
      return 'html';
    }
    return 'markdown';
  }, [fileContent]);

  return (
    <div className="workspace-container">
      {/* Top Bar */}
      <header className="workspace-header">
        <div className="header-left">
          {!isVisitor && (
            <>
              <button className="icon-btn" onClick={() => setLocation('/')} title="Voltar ao Nexus">
                <ArrowLeft size={20} />
              </button>
              <div className="workspace-separator" />
            </>
          )}
          <h2>{worldData ? worldData.displayName : 'Carregando...'}</h2>
        </div>
        <div className="header-actions">
          {selectedFile && !isVisitor && (
            <div className="save-indicator">
              {saveStatus === 'saving' && <span className="status-text saving">Salvando...</span>}
              {saveStatus === 'dirty' && <span className="status-text dirty">Não salvo</span>}
              {saveStatus === 'saved' && <span className="status-text saved">Salvo</span>}
              {saveStatus === 'error' && <span className="status-text error">Erro</span>}
            </div>
          )}
          
          {!isVisitor && (
            <>
              <button
                className={`btn-secondary ${viewMode === 'view' ? 'active-mode' : ''}`}
                onClick={() => setViewMode(viewMode === 'edit' ? 'view' : 'edit')}
                disabled={!selectedFile}
                title={viewMode === 'edit' ? 'Ver Preview' : 'Voltar ao Editor'}
              >
                {viewMode === 'edit' ? (
                  <><Eye size={16} style={{ marginRight: 8 }} /> Preview</>
                ) : (
                  <><Edit2 size={16} style={{ marginRight: 8 }} /> Editor</>
                )}
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setShowTemplateSaveModal(true)} 
                disabled={!selectedFile}
                title="Salvar como Template"
              >
                <Bookmark size={16} style={{ marginRight: 8 }} /> Template
              </button>
              <button className="btn-primary" onClick={() => handleSave()} disabled={saving || !selectedFile}>
                <Save size={16} style={{ marginRight: 8 }} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          )}

          <button 
            className="btn-secondary share-btn" 
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'true');
              navigator.clipboard.writeText(url.toString());
              addToast('Link de visitante copiado!', 'success');
            }}
            title="Compartilhar Link de Visitante"
          >
            <Share2 size={16} style={{ marginRight: 8 }} /> Compartilhar
          </button>
        </div>
      </header>

      <div className="workspace-main">
        {/* Sidebar */}
        <aside className="workspace-sidebar glass-panel" style={sidebarStyle}>
          <div className="sidebar-tabs">
            <button 
              className={`tab-btn ${sidebarTab === 'project' ? 'active' : ''}`}
              onClick={() => setSidebarTab('project')}
            >
              <Package size={14} /> Projeto
            </button>
            <button 
              className={`tab-btn ${sidebarTab === 'maps' ? 'active' : ''}`}
              onClick={() => setSidebarTab('maps')}
            >
              <Map size={14} /> Mapas
            </button>
            {!isVisitor && (
              <>
                <button 
                  className={`tab-btn ${sidebarTab === 'assets' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('assets')}
                >
                  <Layers size={14} /> Assets
                </button>
                <button 
                  className={`tab-btn ${sidebarTab === 'templates' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('templates')}
                >
                  <Layout size={14} /> Templates
                </button>
              </>
            )}
          </div>

          {sidebarTab === 'project' && (
            <>
              <div className="search-container">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Pesquisar..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="sidebar-tree">
                {filteredTree.length === 0 ? (
                  <div className="empty-state-sidebar">
                    <p>Nenhum arquivo encontrado.</p>
                  </div>
                ) : (
                  <FileTree 
                    nodes={filteredTree} 
                    onFileSelect={selectFile} 
                    selectedFile={selectedFile} 
                    openPrompt={handleCreate} 
                    onIconSelect={handleIconSelect} 
                    onContextMenu={handleContextMenu}
                    renamingPath={renamingPath}
                    onRename={handleRenameSubmit}
                    isSearching={!!searchQuery}
                    isVisitor={isVisitor}
                  />
                )}
              </div>

              {!isVisitor && (
                <div className="sidebar-footer">
                  <button className="btn-secondary sidebar-action-btn" title="Criar Documento" onClick={() => handleCreate('')}>
                    <FilePlus size={16} /> <span className="btn-text">Criar</span>
                  </button>
                </div>
              )}
            </>
          )}

          {sidebarTab === 'maps' && (
            <>
              <div className="search-container">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Pesquisar..." 
                  value={mapSearchQuery}
                  onChange={(e) => setMapSearchQuery(e.target.value)}
                />
              </div>

              <div className="sidebar-tree">
                {mapsLoading ? (
                  <div className="loading-state">Carregando mapas...</div>
                ) : filteredMaps.length === 0 ? (
                  <div className="empty-state-sidebar">
                    <p>Nenhum mapa encontrado.</p>
                  </div>
                ) : (
                  <MapTree
                    maps={filteredMaps}
                    selectedMap={selectedMap}
                    onSelect={selectMap}
                    onDelete={handleDeleteMap}
                    onMove={handleMoveMap}
                    onCreateFolder={handleCreateMapFolder}
                    renamingPath={renamingMapPath}
                    onRename={handleRenameMapSubmit}
                    onContextMenu={(e, node) => handleContextMenu(e, node, false, false, true)}
                    isVisitor={isVisitor}
                    isSearching={!!mapSearchQuery}
                  />
                )}
              </div>
              {!isVisitor && (
                <div className="sidebar-footer">
                  <button
                    className="btn-secondary sidebar-action-btn"
                    title="Criar mapa"
                    onClick={() => {
                      loadMedia();
                      setShowMapCreateModal(true);
                    }}
                  >
                    <Map size={16} /> <span className="btn-text">Mapa</span>
                  </button>
                  <button 
                    className="btn-secondary sidebar-action-btn"
                    title="Nova pasta"
                    onClick={() => handleCreateMapFolder()}
                  >
                    <FolderPlus size={16} /> <span className="btn-text">Pasta</span>
                  </button>
                </div>
              )}
            </>
          )}

          {sidebarTab === 'assets' && !isVisitor && (
            <>
              <div className="search-container">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Pesquisar..." 
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                />
              </div>

              {uploadingProgress !== null && (
                <div className="upload-progress-container">
                  <div className="upload-progress-bar" style={{ width: `${uploadingProgress}%` }}></div>
                  <span className="upload-progress-text">Enviando... {uploadingProgress}%</span>
                </div>
              )}

              <div 
                className="sidebar-tree assets-tree"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('drag-over');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('drag-over');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  
                  // External upload to root
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleUpload(e.dataTransfer.files[0], '', false);
                    return;
                  }

                  // Internal move to root
                  const sourcePath = e.dataTransfer.getData('sourcePath');
                  if (sourcePath) {
                    handleMoveMedia(sourcePath, '');
                  }
                }}
              >
                {mediaLoading ? (
                  <div className="loading-state">Carregando assets...</div>
                ) : filteredAssets.length === 0 ? (
                  <div className="empty-state-sidebar">
                    <p>Nenhum asset encontrado.</p>
                  </div>
                ) : (
                  <AssetTree 
                    nodes={filteredAssets} 
                    onAssetSelect={copyMediaCode} 
                    worldId={worldId}
                    onDelete={handleDeleteMediaNode}
                    onMove={handleMoveMedia}
                    onCreateFolder={handleCreateMediaFolder}
                    renamingPath={renamingMediaPath}
                    onRename={handleRenameMediaSubmit}
                    onContextMenu={handleContextMenu}
                    onExternalUpload={(file, folder) => handleUpload(file, folder, false)}
                    isSearching={!!assetSearchQuery}
                  />
                )}
              </div>
              <div className="sidebar-footer">
                <button 
                  className="btn-secondary sidebar-action-btn" 
                  title="Upload de Arquivos" 
                  onClick={() => setShowAssetUploadModal(true)}
                >
                  <Upload size={16} /> <span className="btn-text">Upload</span>
                </button>
                <button className="btn-secondary sidebar-action-btn" title="Nova Pasta" onClick={() => handleCreateMediaFolder('')}>
                  <FolderPlus size={16} /> <span className="btn-text">Pasta</span>
                </button>
              </div>
            </>
          )}            {sidebarTab === 'templates' && !isVisitor && (
              <>
                <div className="search-container">
                  <Search size={16} className="search-icon" />
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="Pesquisar..." 
                    value={assetSearchQuery}
                    onChange={(e) => setAssetSearchQuery(e.target.value)}
                  />
                </div>
                
                <div 
                  className="sidebar-tree assets-tree"
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('sourcepath')) {
                      e.preventDefault();
                      e.currentTarget.classList.add('drag-over');
                    }
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('drag-over');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('drag-over');
                    const sourcePath = e.dataTransfer.getData('sourcePath');
                    if (sourcePath) handleMoveTemplate(sourcePath, '');
                  }}
                >
                  {templatesLoading ? (
                    <div className="loading-state">Carregando templates...</div>
                  ) : templates.length === 0 ? (
                    <div className="empty-state-sidebar">
                      <p>Nenhum template encontrado.</p>
                    </div>
                  ) : (
                    <TemplateTree 
                      nodes={filteredTemplates}
                      onTemplateSelect={handleEditTemplate}
                      onDelete={handleDeleteTemplate}
                      onMove={handleMoveTemplate}
                      onCreateFolder={handleCreateTemplateFolder}
                      onCreateTemplate={handleCreateBlankTemplate}
                      renamingPath={renamingTemplatePath}
                      onRename={handleRenameTemplate}
                      onContextMenu={(e, node) => handleContextMenu(e, node, false, true)}
                      isSearching={!!assetSearchQuery}
                      worldId={worldId}
                    />
                  )}
                </div>
                <div className="sidebar-footer">
                  <button className="btn-secondary sidebar-action-btn" title="Novo Template" onClick={() => handleCreateBlankTemplate('')}>
                    <FilePlus size={16} /> <span className="btn-text">Template</span>
                  </button>
                  <button className="btn-secondary sidebar-action-btn" title="Nova Pasta" onClick={() => handleCreateTemplateFolder('')}>
                    <FolderPlus size={16} /> <span className="btn-text">Pasta</span>
                  </button>
                </div>
              </>
            )}
          </aside>

        {/* Editor Area */}
        <section className="workspace-editor">
          {selectedMap ? (
            <MapWorkspace
              mapData={selectedMap}
              worldId={worldId}
              isVisitor={isVisitor}
              pinMode={pinMode}
              mapSaving={mapSaving}
              onTogglePinMode={() => setPinMode(prev => !prev)}
              onAddPin={handleMapPointClick}
              onEditPin={handleEditPin}
              onDeletePin={handleDeletePin}
              onOpenTarget={handleOpenMapTarget}
            />
          ) : !selectedFile ? (
            <div className="empty-editor">
              <FolderOpen size={64} style={{ color: 'var(--border-color)', marginBottom: 16 }} />
              <h2>Selecione um arquivo ou mapa</h2>
              <p>Crie ou abra um item na barra lateral para começar.</p>
            </div>
          ) : (
            <>
              {/* Breadcrumbs */}
              <div className="breadcrumbs-container">
                {breadcrumbs.map((bc, i) => (
                  <React.Fragment key={bc.path}>
                    <button 
                      className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? 'active' : ''}`}
                      onClick={() => selectFile({ path: bc.path, name: bc.name })}
                    >
                      {bc.name}
                    </button>
                    {i < breadcrumbs.length - 1 && (
                      <ChevronRight size={14} className="breadcrumb-separator" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {viewMode === 'edit' ? (
                <div 
                  className="editor-main-wrapper"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const path = e.dataTransfer.getData('templatePath');
                    if (path) {
                      try {
                        const res = await fetch(`/api/templates/read?path=${encodeURIComponent(path)}`);
                        if (res.ok) {
                          const content = await res.text();
                          setFileContent(content);
                          addToast('Template aplicado!', 'success');
                        }
                      } catch (err) {
                        addToast('Erro ao aplicar template', 'error');
                      }
                    }
                  }}
                  style={{ height: '100%', width: '100%' }}
                >
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={editorLanguage}
                    value={fileContent}
                    onChange={setFileContent}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 16,
                      wordWrap: 'on',
                      padding: { top: 60 },
                      scrollBeyondLastLine: false,
                      dropIntoEditor: { enabled: true }
                    }}
                  />
                </div>
              ) : (
                <div className="preview-container glass-panel" onClick={handlePreviewClick}>
                  <div
                    className={editorLanguage === 'html' ? 'html-preview' : 'markdown-preview'}
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(
                        processWikiLinks(editorLanguage === 'html' ? fileContent : marked(fileContent)), 
                        {
                          ADD_TAGS: ['audio', 'source', 'video', 'style'],
                          ADD_ATTR: ['controls', 'src', 'style', 'data-wiki-target', 'data-is-uid', 'class']
                        }
                      ) 
                    }}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>



      {deleteModal.isOpen && deleteModal.node && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <h2>Deletar {deleteModal.isAsset ? (deleteModal.node.type === 'folder' ? 'Pasta' : 'Asset') : 'Documento'}</h2>
            <p style={{ marginTop: '16px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
              Tem certeza que deseja deletar <strong>{deleteModal.node.name}</strong>?
            </p>
            {deleteModal.node.children && deleteModal.node.children.length > 0 && (
              <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#f87171' }}>
                Aviso: Tudo o que estiver dentro desta pasta será apagado permanentemente!
              </p>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn-secondary" onClick={() => setDeleteModal({ isOpen: false, node: null, isAsset: false, isTemplate: false })}>Cancelar</button>
              <button className="btn-primary btn-danger" onClick={handleDeleteSubmit}>Deletar</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu.visible && (
        <div 
          className="context-menu glass-panel"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isAsset ? (
            <>
              <div className="context-menu-item" onClick={() => {
                copyMediaCode(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Copy size={14} /> Copiar Código
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingMediaPath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> Renomear
              </div>
              <div className="context-menu-item delete" onClick={() => {
                handleDeleteMediaNode(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> Excluir
              </div>
            </>
          ) : contextMenu.isTemplate ? (
            <>
              <div className="context-menu-item" onClick={() => {
                handleEditTemplate(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Eye size={14} /> Abrir
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingTemplatePath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> Renomear
              </div>
              {contextMenu.node.type === 'folder' && (
                <div className="context-menu-item" onClick={() => {
                  handleCreateTemplateFolder(contextMenu.node.path);
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}>
                  <FolderPlus size={14} /> Nova Pasta
                </div>
              )}
              <div className="context-menu-item delete" onClick={() => {
                handleDeleteTemplate(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> Excluir
              </div>
            </>
          ) : contextMenu.isMap ? (
            <>
              <div className="context-menu-item" onClick={() => {
                if (contextMenu.node.type !== 'folder') selectMap(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Eye size={14} /> Abrir
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingMapPath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> Renomear
              </div>
              {contextMenu.node.type === 'folder' && (
                <div className="context-menu-item" onClick={() => {
                  handleCreateMapFolder(contextMenu.node.path);
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}>
                  <FolderPlus size={14} /> Nova Pasta
                </div>
              )}
              <div className="context-menu-item delete" onClick={() => {
                handleDeleteMap(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> Excluir
              </div>
            </>
          ) : (
            <>
              <div className="context-menu-item" onClick={() => {
                selectFile(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Eye size={14} /> Abrir
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingPath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> Renomear
              </div>
              {contextMenu.node.type === 'folder' && (
                <>
                  <div className="context-menu-item" onClick={() => {
                    handleCreate(contextMenu.node.path);
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}>
                    <Plus size={14} /> Novo Documento
                  </div>
                  <div className="context-menu-item" onClick={() => {
                    handleCreateFolder(contextMenu.node.path);
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}>
                    <FolderPlus size={14} /> Nova Pasta
                  </div>
                </>
              )}
              <div className="context-menu-item delete" onClick={() => {
                setDeleteModal({ isOpen: true, node: contextMenu.node, isAsset: false, isTemplate: false });
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> Excluir
              </div>
            </>
          )}
        </div>
      )}

      {showTemplateSaveModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <h2>Salvar como Template</h2>
            <p>Crie um template a partir do conteúdo atual do editor.</p>
            <div className="input-group">
              <label>Nome do Template</label>
              <input 
                type="text" 
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="Ex: Personagem, Local, etc."
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowTemplateSaveModal(false)}>Cancelar</button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  handleSaveTemplate("");
                }} 
                disabled={!newTemplateName || savingTemplate}
              >
                {savingTemplate ? 'Salvando...' : 'Salvar Template'}
              </button>
            </div>
          </div>
        </div>
      )}


      {showMapCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
            <h2>Novo Mapa</h2>
            <p>Envie uma imagem nova ou escolha uma que já esteja nos assets.</p>
            <div className="input-group">
              <label>Nome</label>
              <input
                type="text"
                value={newMapName}
                onChange={(event) => setNewMapName(event.target.value)}
                placeholder="Ex: Continente Norte"
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Imagem</label>
              <div
                className={`map-upload-dropzone ${newMapImagePath ? 'has-image' : ''}`}
                onClick={() => mapFileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.currentTarget.classList.add('drag-over');
                }}
                onDragLeave={(event) => {
                  event.currentTarget.classList.remove('drag-over');
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.currentTarget.classList.remove('drag-over');
                  handleMapImageUpload(event.dataTransfer.files?.[0]);
                }}
              >
                <input
                  ref={mapFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleMapImageUpload(event.target.files?.[0])}
                  hidden
                />
                {newMapImagePath ? (
                  <>
                    <img src={getMapImageUrl(worldId, newMapImagePath)} alt="Preview do mapa" />
                    <span>{newMapImagePath}</span>
                  </>
                ) : (
                  <>
                    <Image size={24} />
                    <span>Clique ou solte uma imagem aqui</span>
                  </>
                )}
              </div>
              <select
                className="modal-select"
                value={newMapImagePath}
                onChange={(event) => setNewMapImagePath(event.target.value)}
              >
                <option value="">Selecione uma imagem</option>
                {imageAssets.map(asset => (
                  <option key={asset.path} value={asset.path}>{asset.path}</option>
                ))}
              </select>
              <p className="field-hint">Uploads feitos aqui são salvos em Assets/maps para poderem ser reutilizados.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowMapCreateModal(false)}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handleCreateMap}
                disabled={mapSaving || !newMapName.trim() || !newMapImagePath}
              >
                {mapSaving ? 'Criando...' : 'Criar Mapa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssetUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
            <h2>Upload de Assets</h2>
            <p>Selecione arquivos para enviar para o diretório raiz de assets.</p>
            <div 
              className="map-upload-dropzone"
              onClick={() => assetFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                if (e.dataTransfer.files) {
                  Array.from(e.dataTransfer.files).forEach(file => handleUpload(file, '', false));
                  setShowAssetUploadModal(false);
                }
              }}
            >
              <input 
                ref={assetFileInputRef}
                type="file" 
                multiple 
                onChange={(e) => {
                  if (e.target.files) {
                    Array.from(e.target.files).forEach(file => handleUpload(file, '', false));
                    setShowAssetUploadModal(false);
                  }
                }} 
                hidden 
              />
              <Upload size={24} />
              <span>Clique ou arraste arquivos aqui</span>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAssetUploadModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {pinDraft && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
            <h2>{pinDraft.mode === 'edit' ? 'Editar Pin' : 'Novo Pin'}</h2>
            <div className="input-group">
              <label>Nome</label>
              <input
                type="text"
                value={pinDraft.label}
                onChange={(event) => setPinDraft(prev => ({ ...prev, label: event.target.value }))}
                placeholder="Ex: Torre de Marfim"
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Destino</label>
              <div className="linked-input-row">
                <input
                  type="text"
                  value={pinDraft.target}
                  onChange={(event) => setPinDraft(prev => ({ ...prev, target: event.target.value }))}
                  placeholder="Caminho do documento"
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    setWikiResolver({
                      isOpen: true,
                      query: pinDraft.target || '',
                      name: pinDraft.label || '',
                      onSelect: (selected) => {
                        setPinDraft(prev => ({ ...prev, target: selected.path }));
                      }
                    });
                  }}
                >
                  <Search size={16} />
                </button>
              </div>
              <p className="field-hint">Opcional. Use um caminho de documento para o pin abrir a página.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setPinDraft(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSavePin} disabled={mapSaving || !pinDraft.label.trim()}>
                {mapSaving ? 'Salvando...' : 'Salvar Pin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {wikiResolver.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Search size={20} className="accent-text" />
              <h2 style={{ margin: 0 }}>Inserir Wiki-link</h2>
            </div>
            
            <div className="search-input-wrapper" style={{ marginBottom: 20 }}>
              <input 
                type="text" 
                className="modal-search-input"
                placeholder="Pesquisar documento..."
                value={wikiResolver.query}
                onChange={e => setWikiResolver(prev => ({ ...prev, query: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="wiki-resolver-list">
              {(() => {
                const results = [];
                const searchNodes = (nodes) => {
                  nodes.forEach(n => {
                    if (n.name.toLowerCase().includes(wikiResolver.query.toLowerCase()) || 
                        n.path.toLowerCase().includes(wikiResolver.query.toLowerCase())) {
                      results.push(n);
                    }
                    if (n.children) searchNodes(n.children);
                  });
                };
                searchNodes(tree);
                
                if (results.length === 0) {
                  return (
                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                      Nenhum documento encontrado para "{wikiResolver.query}"
                    </div>
                  );
                }

                return results.map((match, idx) => (
                  <div 
                    key={idx} 
                    className="resolver-item glass-panel"
                    onClick={() => {
                      if (wikiResolver.onSelect) {
                        wikiResolver.onSelect(match);
                      } else {
                        selectFile(match);
                        setViewMode('view');
                      }
                      setWikiResolver({ isOpen: false, query: '', name: '', onSelect: null });
                    }}
                  >
                    <div className="resolver-item-icon">
                      <FileText size={18} />
                    </div>
                    <div className="resolver-item-info">
                      <div className="resolver-item-name">{match.name}</div>
                      <div className="resolver-item-path">{match.path}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setWikiResolver({ isOpen: false, query: '', name: '', onSelect: null })}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type} glass-panel`}>
            {toast.type === 'success' && <Castle size={16} />}
            {toast.type === 'error' && <Skull size={16} />}
            {toast.type === 'warning' && <Shield size={16} />}
            {toast.type === 'info' && <Book size={16} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

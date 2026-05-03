import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, FolderPlus, FilePlus, Save, Eye, Edit2, Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Sword, Shield, Castle, Map, MapPin, Crown, Book, Star, Skull, Tag, Trash2, Search, Image, Music, Copy, ExternalLink, Layers, Package, Layout, Columns, Bookmark, Share2, Upload, Languages, RefreshCw, Home } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
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

function getParentPath(itemPath = '') {
  const normalizedPath = itemPath.replace(/\.json$/, '');
  return normalizedPath.includes('/') ? normalizedPath.slice(0, normalizedPath.lastIndexOf('/')) : '';
}

function getMapNodeName(node) {
  return node?.name || node?.path?.split('/').pop()?.replace(/\.json$/, '') || '';
}

function sortProjectNodes(nodes = []) {
  return [...nodes].sort((left, right) => {
    const leftHasChildren = left.type !== 'map' && left.children?.length;
    const rightHasChildren = right.type !== 'map' && right.children?.length;
    if (leftHasChildren && !rightHasChildren) return -1;
    if (!leftHasChildren && rightHasChildren) return 1;
    if (left.type !== 'map' && right.type === 'map') return -1;
    if (left.type === 'map' && right.type !== 'map') return 1;
    return (left.name || '').localeCompare(right.name || '');
  });
}

function getTreeChildren(node) {
  return (node.children || []).filter(child => child.relationToParent !== 'tab');
}

function getTabChildren(node) {
  return (node.children || []).filter(child => child.relationToParent === 'tab');
}

function getUniqueChildName(parentNode, baseName) {
  const names = new Set((parentNode?.children || []).map(child => child.name));
  if (!names.has(baseName)) return baseName;

  let suffix = 2;
  while (names.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

function buildUnifiedProjectTree(documentNodes = [], mapNodes = []) {
  const cloneDocuments = (nodes = []) => nodes.map((node) => ({
    ...node,
    source: 'wiki',
    children: cloneDocuments(node.children || [])
  }));

  const root = cloneDocuments(documentNodes);

  const findOrCreateFolder = (siblings, folderNode) => {
    const existing = siblings.find((item) => item.path === folderNode.path && item.type !== 'map');
    if (existing) {
      existing.children = existing.children || [];
      return existing;
    }

    const created = {
      name: folderNode.name,
      path: folderNode.path,
      type: 'folder',
      source: 'map',
      children: []
    };
    siblings.push(created);
    return created;
  };

  const mergeMaps = (targetChildren, nodes = []) => {
    nodes.forEach((node) => {
      if (node.type === 'folder') {
        const folder = findOrCreateFolder(targetChildren, node);
        mergeMaps(folder.children, node.children || []);
        folder.children = sortProjectNodes(folder.children);
        return;
      }

      targetChildren.push({
        ...node,
        name: getMapNodeName(node),
        source: 'map',
        type: 'map',
        relationToParent: node.relationToParent || 'tree',
        contentType: 'map'
      });
    });
  };

  mergeMaps(root, mapNodes);
  return sortProjectNodes(root.map((node) => ({
    ...node,
    children: node.children ? sortProjectNodes(node.children) : node.children
  })));
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
  const { t } = useTranslation();
  const imageUrl = getMapImageUrl(worldId, mapData.imagePath);

  return (
    <div className="map-workspace">
      <div className="map-toolbar">
        <div className="map-title-block">
          <Map size={18} />
          <div>
            <h2>{mapData.name}</h2>
            <span>{mapData.pins?.length || 0} {t('workspace.pins')}</span>
          </div>
        </div>
        {!isVisitor && (
          <button
            className={`btn-secondary ${pinMode ? 'active-mode' : ''}`}
            onClick={onTogglePinMode}
            disabled={mapSaving}
          >
            <MapPin size={16} /> {t('workspace.pin_mode')}
          </button>
        )}
      </div>

      <div className={`map-canvas ${pinMode ? 'pin-mode-cursor' : ''}`}>
        <MapContainer
          key={`${mapData.id}:${mapData.imagePath}`}
          crs={L.CRS.Simple}
          bounds={MAP_BOUNDS}
          minZoom={-2}
          maxZoom={10}
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
                          {t('common.open')}
                        </button>
                    )}
                    {!isVisitor && (
                      <>
                        <button type="button" onClick={() => onEditPin(pin)}>
                          {t('common.edit')}
                        </button>
                        <button type="button" className="danger" onClick={() => onDeletePin(pin.id)}>
                          {t('common.delete')}
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

function ContextTabs({ tabs, onSelect, onAdd, onContextMenu, renamingPath, onRename, renamingMapPath, onRenameMap }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if ((renamingPath || renamingMapPath) && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [renamingPath, renamingMapPath]);

  if ((!tabs || tabs.length === 0) && !onAdd) return null;

  return (
    <div className="context-tabs-bar">
      {tabs.map((tab) => {
        const isRenaming = tab.type === 'map' 
          ? renamingMapPath === tab.node.path 
          : renamingPath === tab.node.path;

        return (
          <div
            key={`${tab.type}:${tab.node.path}`}
            className={`context-tab-container ${tab.active ? 'active' : ''}`}
          >
            <button
              className={`context-tab ${tab.active ? 'active' : ''}`}
              onClick={() => !isRenaming && onSelect(tab)}
              onContextMenu={(e) => {
                if (isRenaming) return;
                e.preventDefault();
                onContextMenu(e, tab.node, false, false, tab.type === 'map', tab.isOverview);
              }}
              title={tab.label}
            >
              {tab.type === 'map' ? <Map size={14} /> : <FileText size={14} />}
              {isRenaming ? (
                <input
                  ref={inputRef}
                  defaultValue={tab.label}
                  className="context-tab-input"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onRename(tab.node, e.target.value);
                    } else if (e.key === 'Escape') {
                      onRename(null, '');
                    }
                  }}
                  onBlur={(e) => {
                    // Only trigger if we didn't just cancel or submit
                    if (renamingPath === tab.node.path || renamingMapPath === tab.node.path) {
                      onRename(tab.node, e.target.value);
                    }
                  }}
                />
              ) : (
                <span>{tab.label}</span>
              )}
            </button>
          </div>
        );
      })}
      {onAdd && (
        <button
          className="context-tab add-tab"
          onClick={onAdd}
          title="Add tab"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}

function UninitializedFileChooser({ node, onChooseWiki, onChooseMap }) {
  const { t } = useTranslation();
  const [name, setName] = useState(node?.name || 'Untitled');

  return (
    <div className="type-choice-panel">
      <div className="type-choice-header">
        <span className="type-choice-eyebrow">{t('workspace.new_tab')}</span>
        <input 
          className="type-choice-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onChooseWiki(node, name);
          }}
        />
      </div>
      <div className="type-choice-grid">
        <button className="type-choice-card" onClick={() => onChooseWiki(node, name)}>
          <FileText size={28} className="card-main-icon" />
          <FileText size={140} className="card-bg-icon" />
          <div>
            <strong>{t('workspace.wiki_page')}</strong>
            <span>{t('workspace.wiki_page_hint')}</span>
          </div>
        </button>
        <button className="type-choice-card" onClick={() => onChooseMap(node, name)}>
          <Map size={28} className="card-main-icon" />
          <Map size={140} className="card-bg-icon" />
          <div>
            <strong>{t('workspace.map')}</strong>
            <span>{t('workspace.map_tab_hint')}</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function FileTree({ nodes, onFileSelect, onMapSelect, selectedFile, selectedMap, openPrompt, onIconSelect, onContextMenu, renamingPath, onRename, isSearching, isVisitor, worldData }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.filter(node => isSearching || node.relationToParent !== 'tab').map(node => (
        <FileTreeNode key={`${node.source || 'wiki'}:${node.path}`} node={node} onFileSelect={onFileSelect} onMapSelect={onMapSelect} selectedFile={selectedFile} selectedMap={selectedMap} openPrompt={openPrompt} onIconSelect={onIconSelect} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} isSearching={isSearching} isVisitor={isVisitor} worldData={worldData} />
      ))}
    </ul>
  );
}

function FileTreeNode({ node, onFileSelect, onMapSelect, selectedFile, selectedMap, openPrompt, onIconSelect, onContextMenu, renamingPath, onRename, isSearching, isVisitor, worldData }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const isMap = node.type === 'map';
  const isMapFolder = node.source === 'map' && node.type === 'folder';
  const isSelected = isMap ? selectedMap?.path === node.path : selectedFile?.path === node.path;
  const isRenaming = renamingPath === node.path;
  const isHome = worldData?.homePage === node.path;
  const visibleChildren = isSearching ? (node.children || []) : getTreeChildren(node);
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
    if (isRenaming || isMap || isMapFolder) return;
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
          onContextMenu(e, node, false, false, isMap || isMapFolder);
        }}
      >
        <span
          className="tree-icon"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          style={{ width: 16, display: 'flex', justifyContent: 'center' }}
        >
          {visibleChildren.length > 0 ? (showChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <div
          onClick={() => {
            if (isRenaming) return;
            if (isMap) onMapSelect(node);
            else if (isMapFolder) setIsOpen(!isOpen);
            else onFileSelect(node);
          }}
          style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
        >
          <span 
            className="tree-icon" 
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isRenaming && !isMap && !isMapFolder) setShowIcons(!showIcons);
            }}
            title={!isMap && !isMapFolder ? t('workspace.change_icon') : undefined}
          >
            {isMap ? <Map size={14} /> : isMapFolder ? (showChildren ? <FolderOpen size={14} /> : <Folder size={14} />) : React.createElement(ICON_MAP[node.icon] || FileText, { size: 14 })}
            
            {showIcons && !isMap && !isMapFolder && (
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
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
              {node.name}
              {isHome && <Home size={12} style={{ marginLeft: 6, opacity: 0.7 }} className="accent-text" title={t('workspace.home_page')} />}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isVisitor && !isMap && (
            <button
              className="node-action-btn"
              onClick={(e) => { e.stopPropagation(); openPrompt(node.path); setIsOpen(true); }}
              title={t('common.create')}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>
      {showChildren && visibleChildren.length > 0 && <FileTree nodes={visibleChildren} onFileSelect={onFileSelect} onMapSelect={onMapSelect} selectedFile={selectedFile} selectedMap={selectedMap} openPrompt={openPrompt} onIconSelect={onIconSelect} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} isSearching={isSearching} isVisitor={isVisitor} worldData={worldData} />}
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
  const { t } = useTranslation();
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
          <span className="tree-icon">
            {isFolder ? (showChildren ? <FolderOpen size={14} /> : <Folder size={14} />) : (
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
              title={t('workspace.create_template')}
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
  const { t } = useTranslation();
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
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{t('workspace.preview')}: {name}</span>
      </div>
      <div className="preview-body markdown-preview" dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: '12px', padding: '12px', overflowY: 'auto' }} />
    </div>
  );
}


function AssetTreeNode({ node, onAssetSelect, worldId, onDelete, onMove, onCreateFolder, renamingPath, onRename, onContextMenu, onExternalUpload, isSearching }) {
  const { t } = useTranslation();
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
          <span className="tree-icon">
            {isFolder ? (showChildren ? <FolderOpen size={14} /> : <Folder size={14} />) : (
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
              title={t('common.create')}
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
  const { t, i18n } = useTranslation();
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
  const [newMapParentPath, setNewMapParentPath] = useState('');
  const [pendingMapPlaceholder, setPendingMapPlaceholder] = useState(null);
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
      addToast(t('workspace.opening_doc', { name: match.name }), 'success');
      setViewMode('view');
      selectFile(match);
    } else {
      addToast(t('workspace.doc_not_found', { target }), 'warning');
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

  const handleCreate = async (parentPath = '', relationToParent = 'tree') => {
    try {
      const tempName = t('workspace.new_document');
      const path = parentPath ? `${parentPath}/${tempName}` : tempName;
      
      // Calcular posição se for aba
      let position = 0;
      if (relationToParent === 'tab') {
        const parentNode = findNodeByPath(unifiedProjectTree, parentPath);
        if (parentNode && parentNode.children) {
          const existingTabs = parentNode.children.filter(c => c.metadata?.relationToParent === 'tab');
          if (existingTabs.length > 0) {
            position = Math.max(...existingTabs.map(t => t.metadata?.position || 0)) + 1;
          }
        }
      }

      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path, 
          content: '', 
          metadata: { 
            contentType: 'unset',
            relationToParent,
            position
          } 
        })
      });
      
      if (!res.ok) throw new Error(t('workspace.error_creating'));
      
      await loadTree();
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
        const items = data.items || [];
        setTree(items);
        return items;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  useEffect(() => {
    const init = async () => {
      setWorldData({ id: worldId, displayName: decodeURIComponent(worldId) });
      const [treeItems, mapItems] = await Promise.all([loadTree(), loadMaps()]);
      
      // Auto-select Home or First Doc
      const configRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/config`);
      let configData = null;
      if (configRes.ok) {
        configData = await configRes.json();
        setWorldData(prev => ({ ...prev, ...configData }));
      }

      if (treeItems.length > 0) {
        const firstDoc = (nodes) => {
          for (const node of nodes) {
            if (node.type === 'document' && (!isVisitor || node.contentType !== 'unset') && (!node.children || node.children.length === 0)) return node;
            if (node.children) {
              const found = firstDoc(node.children);
              if (found && (!isVisitor || found.contentType !== 'unset')) return found;
            }
          }
          for (const node of nodes) {
            if (node.type === 'document' && (!node.children || node.children.length === 0)) return node;
          }
          return nodes[0];
        };

        const homePath = configData?.homePage;
        const targetNode = homePath ? findNodeByPath(treeItems, homePath) : firstDoc(treeItems);
        
        if (targetNode) {
          const unified = buildUnifiedProjectTree(treeItems, mapItems);
          selectFile(targetNode, unified, configData);
          if (isVisitor) setViewMode('view');
        }
      }
    };
    init();
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
        const items = data.items || [];
        setMaps(items);
        setSelectedMap(current => {
          if (!current) return current;
          return flattenNodes(items, item => item.type === 'map')
            .find(mapItem => mapItem.path === current.path || mapItem.id === current.id) || null;
        });
        return items;
      }
    } catch (e) {
      console.error(e);
      addToast(t('workspace.error_loading_maps'), 'error');
    } finally {
      setMapsLoading(false);
    }
    return [];
  };

  const handleSetHomePage = async (path) => {
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/homepage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homePage: path })
      });
      if (res.ok) {
        setWorldData(prev => ({ ...prev, homePage: path }));
        addToast(t('workspace.home_defined_success'), 'success');
      } else {
        addToast(t('workspace.error_setting_home'), 'error');
      }
    } catch (e) {
      console.error(e);
      addToast(t('common.error_connection'), 'error');
    }
  };

  const handleGoHome = () => {
    if (!worldData?.homePage) {
      // Fallback: first document
      const firstDoc = (nodes) => {
        for (const node of nodes) {
          if (node.type === 'document' && (!isVisitor || node.contentType !== 'unset') && (!node.children || node.children.length === 0)) return node;
          if (node.children) {
            const found = firstDoc(node.children);
            if (found && (!isVisitor || found.contentType !== 'unset')) return found;
          }
        }
        for (const node of nodes) {
          if (node.type === 'document' && (!node.children || node.children.length === 0)) return node;
        }
        return nodes[0];
      };
      const home = firstDoc(tree);
      if (home) selectFile(home);
      return;
    }

    const homeNode = findNodeByPath(tree, worldData.homePage);
    if (homeNode) {
      selectFile(homeNode);
      if (isVisitor) setViewMode('view');
    }
  };

  const selectFile = (node, treeOverride = null, configOverride = null) => {
    const currentTree = treeOverride || unifiedProjectTree;
    const currentConfig = configOverride || worldData;

    // If the document is an uninitialized container (root or tree item) with tab children,
    // open the first tab directly instead of showing the type chooser.
    // Tabs themselves should never redirect.
    if (node.contentType === 'unset' && node.relationToParent !== 'tab') {
      const unifiedNode = findNodeByPath(currentTree, node.path);
      const rawTabChildren = unifiedNode ? getTabChildren(unifiedNode) : [];
      const tabChildren = isVisitor ? rawTabChildren.filter(tab => tab.contentType !== 'unset') : rawTabChildren;
      
      if (tabChildren.length > 0) {
        // Priorizar a Home se ela for uma das abas, senão usar a posição
        const homeTab = tabChildren.find(tab => tab.path === currentConfig?.homePage);
        const sortedTabs = [...tabChildren].sort((a, b) => {
          if (a.path === currentConfig?.homePage) return -1;
          if (b.path === currentConfig?.homePage) return 1;
          return (a.metadata?.position || 0) - (b.metadata?.position || 0);
        });
        const firstTab = homeTab || sortedTabs[0];
        if (firstTab.type === 'map') {
          selectMap(firstTab);
          return;
        }
        setSelectedMap(null);
        setPinMode(false);
        setSelectedFile(firstTab);
        return;
      }
    }
    setSelectedMap(null);
    setPinMode(false);
    setSelectedFile(node);
    if (node.contentType === 'wiki') {
      setViewMode('preview');
    }
  };

  const selectMap = (mapItem) => {
    if (!mapItem || mapItem.type === 'folder') return;
    setSelectedFile(null);
    setViewMode('view');
    setSelectedMap(mapItem);
    setPinMode(false);
  };

  const openMapCreateModal = (parentPath = '') => {
    setNewMapParentPath(parentPath);
    loadMedia();
    setShowMapCreateModal(true);
  };

  const handleCreateTab = async (parentPath) => {
    if (!parentPath) {
      console.warn('handleCreateTab: No parentPath provided');
      return;
    }
    const parentNode = findNodeByPath(unifiedProjectTree, parentPath);
    const tabName = getUniqueChildName(parentNode, t('workspace.new_document'));
    const tabPath = `${parentPath}/${tabName}`;
    
    // Calcular posição
    let position = 0;
    if (parentNode && parentNode.children) {
      const existingTabs = parentNode.children.filter(c => c.metadata?.relationToParent === 'tab');
      if (existingTabs.length > 0) {
        position = Math.max(...existingTabs.map(t => t.metadata?.position || 0)) + 1;
      }
    }

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/placeholder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: tabPath,
          metadata: {
            relationToParent: 'tab',
            contentType: 'unset',
            position
          }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || t('workspace.error_creating'));
      }
      
      const created = await res.json();
      const finalPath = created.path || tabPath;
      
      await loadTree();
      setSelectedMap(null);
      setSelectedFile({
        name: tabName,
        path: finalPath,
        type: 'document',
        relationToParent: 'tab',
        contentType: 'unset'
      });
    } catch (e) {
      console.error('Error creating tab:', e);
      addToast(e.message || t('workspace.error_creating'), 'error');
    }
  };

  const handleChooseWikiType = async (node, customName) => {
    if (!node) return;
    const finalName = customName || node.name;
    let currentPath = node.path;

    try {
      // Se o nome foi alterado no painel, renomeamos o placeholder antes de inicializar
      if (customName && customName !== node.name) {
        const renameRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: node.path, newName: customName })
        });
        if (renameRes.ok) {
          const renameData = await renameRes.json();
          currentPath = renameData.newPath;
        }
      }

      // Se já for uma aba (criada pelo botão +), transformamos ela mesma em Wiki
      if (node.relationToParent === 'tab') {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: currentPath, 
            metadata: { contentType: 'wiki' } 
          })
        });
        
        if (!res.ok) throw new Error('Failed to convert tab to wiki');
        
        await loadTree();
        setSelectedFile({ 
          path: currentPath, 
          name: finalName, 
          contentType: 'wiki', 
          relationToParent: 'tab' 
        });
        setViewMode('preview');
        return;
      }

      // Se for um documento primário, criamos uma aba filha para desacoplar a pasta
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: currentPath + '/' + finalName,
          metadata: { relationToParent: 'tab', contentType: 'wiki' }
        })
      });
      
      if (!res.ok) throw new Error('Failed to create initial wiki tab');
      
      const newTabPath = currentPath + '/' + finalName;
      await loadTree();
      
      // Selecionamos diretamente a nova aba criada
      setSelectedFile({ 
        path: newTabPath, 
        name: finalName, 
        contentType: 'wiki', 
        relationToParent: 'tab' 
      });
      setViewMode('preview');
    } catch (e) {
      console.error(e);
      addToast('Erro ao criar aba wiki', 'error');
    }
  };

  const handleResetToContainer = async (node) => {
    if (!node) return;
    if (!confirm(t('workspace.confirm_reset_container'))) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, metadata: { contentType: 'unset' } })
      });
      
      if (!res.ok) throw new Error('Failed to reset container');
      
      addToast(t('workspace.container_reset_success'), 'success');
      await loadTree();
      // Reforce a seleção para disparar o seletor de tipo
      const updatedNode = { ...node, contentType: 'unset' };
      selectFile(updatedNode);
    } catch (e) {
      console.error(e);
      addToast('Erro ao resetar documento', 'error');
    }
  };

  const handleChooseMapType = async (node, customName) => {
    if (!node) return;
    const finalName = customName || node.name;
    let currentPath = node.path;

    // Se o nome foi alterado, renomeamos antes de abrir o modal de criação
    if (customName && customName !== node.name) {
      try {
        const renameRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: node.path, newName: customName })
        });
        if (renameRes.ok) {
          const renameData = await renameRes.json();
          currentPath = renameData.newPath;
        }
      } catch (e) {
        console.error('Rename failed before map choice:', e);
      }
    }

    setPendingMapPlaceholder({ ...node, path: currentPath, name: finalName });
    setNewMapName(finalName);
    openMapCreateModal(getParentPath(currentPath));
  };

  const saveMap = async (mapData, successMessage = t('workspace.map_saved')) => {
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
      setSelectedMap({ ...savedMap, path: mapData.path, type: 'map' });
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
      // When a non-tab document (root/tree) becomes a map, keep the document
      // as a container and nest the map as a tab inside it so tabs still work.
      const isContainerConversion = pendingMapPlaceholder && pendingMapPlaceholder.relationToParent !== 'tab';
      const mapParentPath = isContainerConversion ? pendingMapPlaceholder.path : newMapParentPath;
      const mapRelation = isContainerConversion ? 'tab' : (pendingMapPlaceholder?.relationToParent || 'tree');

      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMapName.trim(),
          imagePath: newMapImagePath,
          parentPath: mapParentPath,
          relationToParent: mapRelation
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao criar mapa');
      }
      const createdMap = await res.json();
      if (pendingMapPlaceholder) {
        if (isContainerConversion) {
          // Keep the document as a container with contentType 'unset'.
          // This means no Overview tab is shown — the map IS the primary content.
          // The user can still add more tabs later.
        } else {
          // Tab placeholder: delete it since the parent container already exists
          await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(pendingMapPlaceholder.path)}`, {
            method: 'DELETE'
          });
        }
      }
      await loadTree();
      await loadMaps();
      setShowMapCreateModal(false);
      setNewMapName('');
      setNewMapImagePath('');
      setNewMapParentPath('');
      setPendingMapPlaceholder(null);
      if (pendingMapPlaceholder && createdMap?.path) {
        setSelectedFile(null);
        setSelectedMap(createdMap);
      }
      addToast('Mapa criado!', 'success');
    } catch (e) {
      console.error(e);
      addToast(e.message || t('workspace.error_creating_map'), 'error');
    } finally {
      setMapSaving(false);
    }
  };

  const handleCreateMapFolder = async (parentPath = '') => {
    const tempName = t('workspace.new_folder');
    const folderPath = parentPath ? `${parentPath}/${tempName}` : tempName;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath })
      });
      if (res.ok) {
        const newFolder = await res.json();
        await loadMaps();
        setTimeout(() => {
          setRenamingMapPath(newFolder.path || folderPath);
        }, 100);
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
        addToast(t('workspace.renamed_success'), 'success');
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
        addToast(t('workspace.moved_success'), 'success');
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
      addToast(t('workspace.use_image_for_map'), 'warning');
      return;
    }

    try {
      const uploaded = await handleUpload(file, 'maps', false);
      if (!uploaded) throw new Error('Upload failed - no data returned');
      
      const uploadedPath = uploaded.path || (uploaded.filename ? `maps/${uploaded.filename}` : '');
      
      if (!uploadedPath) {
        throw new Error('Upload sem caminho retornado');
      }
      
      setNewMapImagePath(uploadedPath);
      
      if (!newMapName.trim()) {
        setNewMapName(file.name.replace(/\.[^/.]+$/, ''));
      }
      
      await loadMedia();
      addToast(t('workspace.map_image_uploaded'), 'success');
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
      addToast(t('workspace.pin_name_required'), 'warning');
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
    const saved = await saveMap({ ...selectedMap, pins }, t('workspace.pin_saved'));
    if (saved) {
      setPinDraft(null);
      setPinMode(false);
    }
  };

  const handleDeletePin = async (pinId) => {
    if (!selectedMap) return;
    const pins = (selectedMap.pins || []).filter(pin => pin.id !== pinId);
    await saveMap({ ...selectedMap, pins }, t('workspace.pin_removed'));
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
    if (!confirm(t('workspace.confirm_delete_media', { filename }))) return;
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
    addToast(t('workspace.code_copied'), 'success');
  };

  const handleCreateMediaFolder = async (parentPath = '') => {
    try {
      const tempName = t('workspace.new_folder');
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
      addToast(t('workspace.template_name_required'), 'warning');
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
        addToast(t('workspace.template_saved'), 'success');
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
        addToast(t('workspace.error_loading_template'), 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erro ao carregar template para edição', 'error');
    }
  };

  const handleCreateBlankTemplate = async (parentPathArg = '') => {
    const parentPath = typeof parentPathArg === 'string' ? parentPathArg : "";
    try {
      const tempName = t('workspace.new_template');
      const res = await fetch(`/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempName, content: '', parentPath, type: 'content' })
      });
      if (res.ok) {
        const newTemplate = await res.json();
        loadTemplates();
        setTimeout(() => setRenamingTemplatePath(newTemplate.path), 100);
        addToast(t('workspace.template_created'), 'success');
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
      const tempName = t('workspace.new_folder');
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
    if (selectedFile && !selectedFile.isTemplate && selectedFile.contentType !== 'unset') {
      fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(selectedFile.path)}`)
        .then(res => res.json())
        .then(data => setFileContent(data.content || ''))
        .catch(console.error);
    } else if (selectedFile?.contentType === 'unset') {
      setFileContent('');
      setLastSavedContent('');
    }
  }, [selectedFile, worldId]);



  const handleDeleteSubmit = async () => {
    const nodeToDelete = deleteModal.node;
    const isMapDeletion = deleteModal.isMap;
    const isAssetDeletion = deleteModal.isAsset;
    const isTemplateDeletion = deleteModal.isTemplate;
    const isOverviewDeletion = deleteModal.isOverview;

    if (!nodeToDelete) return;

    // Close modal immediately
    setDeleteModal({ isOpen: false, node: null, isAsset: false, isTemplate: false, isMap: false, isOverview: false });

    try {
      if (isAssetDeletion) {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/media/${encodeURIComponent(nodeToDelete.path)}`, {
          method: 'DELETE'
        });
        if (res.ok) loadMedia();
      } else if (isTemplateDeletion) {
        const res = await fetch(`/api/templates?path=${encodeURIComponent(nodeToDelete.path)}`, {
          method: 'DELETE'
        });
        if (res.ok) loadTemplates();
      } else if (isMapDeletion) {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/maps`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: nodeToDelete.path })
        });
        if (res.ok) {
          const wasSelected = selectedMap?.path === nodeToDelete.path;
          const isTab = nodeToDelete.relationToParent === 'tab';
          
          await loadMaps();
          
          if (wasSelected) {
            if (isTab) {
              const parentPath = getParentPath(nodeToDelete.path);
              const parentNode = findNodeByPath(unifiedProjectTree, parentPath);
              if (parentNode) selectFile(parentNode);
              else setSelectedMap(null);
            } else {
              setSelectedMap(null);
            }
          }
          
          addToast(nodeToDelete.type === 'folder' ? 'Pasta excluída' : 'Mapa excluído', 'success');
        }
      } else {
        // Lógica especial para Overview: se tiver filhos, apenas reseta o tipo (deleta o conteúdo wiki)
        const hasChildren = nodeToDelete.children && nodeToDelete.children.length > 0;
        
        if (isOverviewDeletion && hasChildren) {
          const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: nodeToDelete.path, metadata: { contentType: 'unset' } })
          });
          
          if (!res.ok) throw new Error('Erro ao resetar documento');
          
          addToast('Aba removida do documento', 'success');
          await loadTree();
          const parentNode = findNodeByPath(unifiedProjectTree, nodeToDelete.path);
          if (parentNode) selectFile(parentNode);
          return;
        }

        // Deleção normal (deleta a pasta/arquivo)
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(nodeToDelete.path)}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) throw new Error('Erro ao deletar documento');
        
        const isTab = nodeToDelete.relationToParent === 'tab';
        const wasSelected = selectedFile && (selectedFile.path === nodeToDelete.path || selectedFile.path.startsWith(nodeToDelete.path + '/'));
        
        const newTree = await loadTree();
        const newMaps = await loadMaps();

        if (wasSelected) {
          if (isTab) {
            const parentPath = getParentPath(nodeToDelete.path);
            const freshTree = buildUnifiedProjectTree(newTree, newMaps);
            const parentNode = findNodeByPath(freshTree, parentPath);
            
            if (parentNode) {
              const remainingTabs = getTabChildren(parentNode);
              if (remainingTabs.length > 0) {
                // Se ainda houver abas, seleciona a primeira (ou mantém o pai se preferir)
                selectFile(remainingTabs[0]);
              } else {
                // Se era a última aba, volta para a seleção
                setSelectedFile({ path: parentPath, contentType: 'unset' });
              }
            } else {
              setSelectedFile(null);
            }
          } else {
            setSelectedFile(null);
            setViewMode('edit');
          }
        }

        if (worldData?.homePage && (nodeToDelete.path === worldData.homePage || worldData.homePage.startsWith(nodeToDelete.path + '/'))) {
          await handleSetHomePage("");
        }

        if (selectedMap && (selectedMap.path === nodeToDelete.path || selectedMap.path.startsWith(nodeToDelete.path + '/'))) {
          setSelectedMap(null);
        }
        
        addToast(nodeToDelete.type === 'folder' ? 'Pasta excluída' : 'Documento excluído', 'success');
      }
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
      
      if (res.ok) {
        const data = await res.json();
        const oldPrefix = node.path;
        const newPrefix = data.newPath;

        // Update selectedFile / selectedMap if their path was affected by the rename
        if (selectedFile && (selectedFile.path === oldPrefix || selectedFile.path.startsWith(oldPrefix + '/'))) {
          setSelectedFile(prev => ({ ...prev, path: prev.path.replace(oldPrefix, newPrefix), name: prev.path === oldPrefix ? newName : prev.name }));
        }
        if (selectedMap && (selectedMap.path === oldPrefix || selectedMap.path.startsWith(oldPrefix + '/'))) {
          setSelectedMap(prev => ({ ...prev, path: prev.path.replace(oldPrefix, newPrefix) }));
        }
      }

      setRenamingPath(null);
      loadTree();
      loadMaps();
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
    if (!isDirty || saving || isVisitor || !selectedFile || selectedFile.contentType === 'unset') return;

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
    if (!selectedFile || selectedFile.contentType === 'unset') return;
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
        addToast(isSilent ? t('workspace.autosave_success') : (isTemplate ? t('workspace.template_saved') : t('workspace.file_saved')), 'success');
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

  const unifiedProjectTree = useMemo(() => {
    const fullTree = buildUnifiedProjectTree(tree, maps);
    if (!isVisitor) return fullTree;
    
    const filterUnset = (nodes) => {
      const filtered = [];
      for (const n of nodes) {
        const filteredChildren = n.children ? filterUnset(n.children) : undefined;
        const hasValidChildren = filteredChildren && filteredChildren.length > 0;
        
        // Mantém o nó se ele estiver inicializado OU se possuir filhos válidos
        if (n.contentType !== 'unset' || hasValidChildren) {
          filtered.push({
            ...n,
            children: filteredChildren
          });
        }
      }
      return filtered;
    };
    return filterUnset(fullTree);
  }, [tree, maps, isVisitor]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return unifiedProjectTree;
    const filter = (items) => {
      return items.reduce((acc, item) => {
        const matches = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const filteredChildren = item.children ? filter(item.children) : null;
        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...item, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(unifiedProjectTree);
  }, [unifiedProjectTree, searchQuery]);

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

  const activeEditableFile = selectedFile && !selectedMap ? selectedFile : null;
  const showFileControls = !!activeEditableFile && activeEditableFile.contentType !== 'unset' && !isVisitor;
  const activeFileKind = activeEditableFile?.isTemplate ? t('workspace.templates') : t('workspace.wiki');
  const activeFileName = activeEditableFile?.name || activeEditableFile?.path?.split('/').pop() || '';

  const contextTabs = useMemo(() => {
    const buildTabsForNode = (node, activePath, activeType) => {
      if (!node) return [];
      const tabChildren = getTabChildren(node);
      const tabs = [];

      // Se o nó em si for uma wiki (legado), ainda mostramos ele como primeira aba
      if (node.contentType === 'wiki') {
        tabs.push({
          type: 'document',
          label: node.name,
          node,
          active: activeType === 'document' && activePath === node.path,
          isOverview: true
        });
      }

      tabs.push(
        ...tabChildren
          .sort((a, b) => {
            if (a.path === worldData?.homePage) return -1;
            if (b.path === worldData?.homePage) return 1;
            return (a.metadata?.position || 0) - (b.metadata?.position || 0);
          })
          .map(child => ({
          type: child.type === 'map' ? 'map' : child.contentType === 'unset' ? 'unset' : 'document',
          label: child.type === 'map' ? getMapNodeName(child) : child.name,
          node: child,
          active: activePath === child.path,
          isOverview: false
        }))
      );
      return tabs;
    };

    if (selectedFile && !selectedFile.isTemplate) {
      const parentNode = selectedFile.relationToParent === 'tab'
        ? findNodeByPath(unifiedProjectTree, getParentPath(selectedFile.path))
        : findNodeByPath(unifiedProjectTree, selectedFile.path);
      return buildTabsForNode(parentNode, selectedFile.path, selectedFile.contentType === 'unset' ? 'unset' : 'document');
    }

    if (selectedMap?.path) {
      const parentNode = findNodeByPath(unifiedProjectTree, getParentPath(selectedMap.path));
      return buildTabsForNode(parentNode, selectedMap.path, 'map');
    }

    return [];
  }, [selectedFile, selectedMap, unifiedProjectTree, worldData]);

  const contextTabParent = useMemo(() => {
    if (selectedFile && !selectedFile.isTemplate) {
      return selectedFile.relationToParent === 'tab'
        ? findNodeByPath(unifiedProjectTree, getParentPath(selectedFile.path))
        : findNodeByPath(unifiedProjectTree, selectedFile.path);
    }
    if (selectedMap?.path) {
      return findNodeByPath(unifiedProjectTree, getParentPath(selectedMap.path));
    }
    return null;
  }, [selectedFile, selectedMap, unifiedProjectTree]);

  const handleContextTabSelect = (tab) => {
    if (tab.type === 'map') {
      selectMap(tab.node);
      return;
    }
    selectFile(tab.node);
  };

  const handleContextMenu = (e, node, isAsset = false, isTemplate = false, isMap = false, isOverview = false) => {
    e.preventDefault();
    e.stopPropagation();
    const isTab = node.relationToParent === 'tab';
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
      isAsset,
      isTemplate,
      isMap,
      isOverview,
      isTab
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
              <button className="icon-btn" onClick={() => setLocation('/')} title={t('workspace.voltar_dashboard')}>
                <ArrowLeft size={20} />
              </button>
              <div className="workspace-separator" />
            </>
          )}
          <h2>{worldData ? worldData.displayName : t('common.loading')}</h2>
        </div>
        <div className="header-actions">
          {showFileControls && (
            <div className="file-action-cluster" aria-label={`${activeFileKind}: ${activeFileName}`}>
              <div className="active-file-pill" title={`${activeFileKind}: ${activeFileName}`}>
                {activeEditableFile.isTemplate ? <Layout size={14} /> : <FileText size={14} />}
                <span className="active-file-kind">{activeFileKind}</span>
                <span className="active-file-name">{activeFileName}</span>
              </div>

              <div className="save-indicator">
                {saveStatus === 'saving' && <span className="status-text saving">{t('common.saving')}</span>}
                {saveStatus === 'dirty' && <span className="status-text dirty">{t('workspace.nao_salvo')}</span>}
                {saveStatus === 'saved' && <span className="status-text saved">{t('workspace.salvo')}</span>}
                {saveStatus === 'error' && <span className="status-text error">{t('workspace.erro')}</span>}
              </div>

              <button
                className={`btn-secondary ${viewMode === 'view' ? 'active-mode' : ''}`}
                onClick={() => setViewMode(viewMode === 'edit' ? 'view' : 'edit')}
                title={viewMode === 'edit' ? t('workspace.ver_preview') : t('workspace.voltar_editor')}
              >
                {viewMode === 'edit' ? (
                  <><Eye size={16} style={{ marginRight: 8 }} /> {t('workspace.preview')}</>
                ) : (
                  <><Edit2 size={16} style={{ marginRight: 8 }} /> {t('workspace.editor')}</>
                )}
              </button>
              {!activeEditableFile.isTemplate && (
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowTemplateSaveModal(true)} 
                  title={t('workspace.salvar_template_tooltip')}
                >
                  <Bookmark size={16} style={{ marginRight: 8 }} /> {t('workspace.template')}
                </button>
              )}
              <button className="btn-primary" onClick={() => handleSave()} disabled={saving || !selectedFile}>
                <Save size={16} style={{ marginRight: 8 }} /> {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          )}

          <button 
            className="btn-secondary share-btn" 
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'true');
              navigator.clipboard.writeText(url.toString());
              addToast(t('workspace.link_visitante_copiado'), 'success');
            }}
            title={t('workspace.compartilhar_tooltip')}
          >
            <Share2 size={16} style={{ marginRight: 8 }} /> {t('workspace.compartilhar')}
          </button>
          
          <div className="workspace-separator" />

          <button 
            className="nexus-icon-btn language-switcher" 
            onClick={handleGoHome}
            title={t('workspace.home_page')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', width: 'auto' }}
          >
            <Home size={18} />
          </button>
          
          <div className="workspace-separator" />
          
          <button 
            className="nexus-icon-btn language-switcher" 
            onClick={() => i18n.changeLanguage(i18n.language === 'pt' ? 'en' : 'pt')} 
            title={i18n.language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', width: 'auto' }}
          >
            <Languages size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
              {i18n.language}
            </span>
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
              <Package size={14} /> {t('workspace.wiki')}
            </button>

            {!isVisitor && (
              <>
                <button 
                  className={`tab-btn ${sidebarTab === 'assets' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('assets')}
                >
                  <Layers size={14} /> {t('workspace.assets')}
                </button>
                <button 
                  className={`tab-btn ${sidebarTab === 'templates' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('templates')}
                >
                  <Layout size={14} /> {t('workspace.templates')}
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
                  placeholder={t('workspace.search_nodes')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="sidebar-tree">
                {filteredTree.length === 0 ? (
                  <div className="empty-state-sidebar">
                    <p>{t('workspace.no_files_found')}</p>
                  </div>
                ) : (
                  <FileTree 
                    nodes={filteredTree} 
                    onFileSelect={selectFile} 
                    onMapSelect={selectMap}
                    selectedFile={selectedFile} 
                    selectedMap={selectedMap}
                    openPrompt={handleCreate} 
                    onIconSelect={handleIconSelect} 
                    onContextMenu={handleContextMenu}
                    renamingPath={renamingPath}
                    onRename={handleRenameSubmit}
                    isSearching={!!searchQuery}
                    isVisitor={isVisitor}
                    worldData={worldData}
                  />
                )}
              </div>

              {!isVisitor && (
                <div className="sidebar-footer">
                  <button className="btn-secondary sidebar-action-btn" title={t('workspace.create_document')} onClick={() => handleCreate('', 'tree')}>
                    <FilePlus size={16} /> <span className="btn-text">{t('common.create')}</span>
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
                  placeholder={t('workspace.search_nodes')}
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                />
              </div>

              {uploadingProgress !== null && (
                <div className="upload-progress-container">
                  <div className="upload-progress-bar" style={{ width: `${uploadingProgress}%` }}></div>
                  <span className="upload-progress-text">{t('common.uploading')}... {uploadingProgress}%</span>
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
                  <div className="loading-state">{t('workspace.loading_assets')}</div>
                ) : filteredAssets.length === 0 ? (
                  <div className="empty-state-sidebar">
                    <p>{t('workspace.no_assets_found')}</p>
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
                  <Upload size={16} /> <span className="btn-text">{t('workspace.upload_asset')}</span>
                </button>
                <button className="btn-secondary sidebar-action-btn" title={t('workspace.create_folder')} onClick={() => handleCreateMediaFolder('')}>
                  <FolderPlus size={16} /> <span className="btn-text">{t('workspace.folder')}</span>
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
                    placeholder={t('workspace.search_nodes')}
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
                    <div className="loading-state">{t('workspace.loading_templates')}</div>
                  ) : templates.length === 0 ? (
                    <div className="empty-state-sidebar">
                      <p>{t('workspace.no_templates_found')}</p>
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
                  <button className="btn-secondary sidebar-action-btn" title={t('workspace.create_template')} onClick={() => handleCreateBlankTemplate('')}>
                    <FilePlus size={16} /> <span className="btn-text">{t('workspace.create_template')}</span>
                  </button>
                  <button className="btn-secondary sidebar-action-btn" title={t('workspace.create_folder')} onClick={() => handleCreateTemplateFolder('')}>
                    <FolderPlus size={16} /> <span className="btn-text">{t('workspace.folder')}</span>
                  </button>
                </div>
              </>
            )}
          </aside>

        {/* Editor Area */}
        <section className="workspace-editor">
          {selectedMap ? (
            <>
              <ContextTabs
                tabs={contextTabs}
                onSelect={handleContextTabSelect}
                onAdd={contextTabParent && !isVisitor ? () => handleCreateTab(contextTabParent.path) : null}
                onContextMenu={handleContextMenu}
                renamingPath={renamingPath}
                onRename={handleRenameSubmit}
                renamingMapPath={renamingMapPath}
                onRenameMap={handleRenameMapSubmit}
              />
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
            </>
          ) : !selectedFile ? (
            <div className="empty-editor">
              <FolderOpen size={64} style={{ color: 'var(--border-color)', marginBottom: 16 }} />
              <h2>{t('workspace.select_file_or_map')}</h2>
              <p>{t('workspace.select_file_or_map_hint')}</p>
            </div>
          ) : (
            <>
              <ContextTabs
                tabs={contextTabs}
                onSelect={handleContextTabSelect}
                onAdd={contextTabParent && !isVisitor && !selectedFile.isTemplate ? () => handleCreateTab(contextTabParent.path) : null}
                onContextMenu={handleContextMenu}
                renamingPath={renamingPath}
                onRename={handleRenameSubmit}
                renamingMapPath={renamingMapPath}
                onRenameMap={handleRenameMapSubmit}
              />
              {contextTabs.length === 0 && (
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
              )}

              {selectedFile.contentType === 'unset' ? (
                isVisitor ? (
                  <div className="empty-state-sidebar" style={{ marginTop: '10vh' }}>
                    <p>{t('workspace.document_unavailable', 'This document is unavailable or not yet initialized.')}</p>
                  </div>
                ) : (
                  <UninitializedFileChooser
                    node={selectedFile}
                    onChooseWiki={handleChooseWikiType}
                    onChooseMap={handleChooseMapType}
                  />
                )
              ) : viewMode === 'edit' ? (
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
                          addToast(t('workspace.template_applied'), 'success');
                        }
                      } catch (err) {
                        addToast(t('workspace.error_applying_template'), 'error');
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
            <h2>{t('common.delete')} {deleteModal.isAsset ? (deleteModal.node.type === 'folder' ? t('workspace.folder') : t('workspace.asset')) : t('workspace.document')}</h2>
            <p style={{ marginTop: '16px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
              <Trans
                i18nKey="workspace.confirm_delete_specific"
                values={{ name: deleteModal.node.name }}
                components={{ strong: <strong /> }}
              />
            </p>
            {deleteModal.node.children && deleteModal.node.children.length > 0 && (
              <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#f87171' }}>
                {t('workspace.delete_folder_warning')}
              </p>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn-secondary" onClick={() => setDeleteModal({ isOpen: false, node: null, isAsset: false, isTemplate: false })}>{t('common.cancel')}</button>
              <button className="btn-primary btn-danger" onClick={handleDeleteSubmit}>{t('common.delete')}</button>
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
                <Copy size={14} /> {t('workspace.copy_code')}
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingMediaPath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> {t('common.rename')}
              </div>
              <div className="context-menu-item delete" onClick={() => {
                handleDeleteMediaNode(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> {t('common.delete')}
              </div>
            </>
          ) : contextMenu.isTemplate ? (
            <>
              <div className="context-menu-item" onClick={() => {
                handleEditTemplate(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Eye size={14} /> {t('common.open')}
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingTemplatePath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> {t('common.rename')}
              </div>
              {contextMenu.node.type === 'folder' && (
                <div className="context-menu-item" onClick={() => {
                  handleCreateTemplateFolder(contextMenu.node.path);
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}>
                  <FolderPlus size={14} /> {t('workspace.new_folder')}
                </div>
              )}
              <div className="context-menu-item delete" onClick={() => {
                handleDeleteTemplate(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> {t('common.delete')}
              </div>
            </>
          ) : contextMenu.isMap ? (
            <>
              <div className="context-menu-item" onClick={() => {
                if (contextMenu.node.type !== 'folder') selectMap(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Eye size={14} /> {t('common.open')}
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingMapPath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> {t('common.rename')}
              </div>
              {contextMenu.node.type === 'folder' && (
                <>
                  <div className="context-menu-item" onClick={() => {
                    openMapCreateModal(contextMenu.node.path);
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}>
                    <Map size={14} /> {t('workspace.create_map')}
                  </div>
                  <div className="context-menu-item" onClick={() => {
                    handleCreateMapFolder(contextMenu.node.path);
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}>
                    <FolderPlus size={14} /> {t('workspace.new_folder')}
                  </div>
                </>
              )}
              <div className="context-menu-item delete" onClick={() => {
                handleDeleteMap(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> {t('common.delete')}
              </div>
            </>
          ) : (
            <>
              <div className="context-menu-item" onClick={() => {
                selectFile(contextMenu.node);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Eye size={14} /> {t('common.open')}
              </div>
              <div className="context-menu-item" onClick={() => {
                setRenamingPath(contextMenu.node.path);
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Edit2 size={14} /> {t('common.rename')}
              </div>
              
              {/* Opção especial para resetar Wiki para Container sem deletar filhos */}
              {contextMenu.isOverview && contextMenu.node.contentType === 'wiki' && (
                <div className="context-menu-item" onClick={() => {
                  handleResetToContainer(contextMenu.node);
                  setContextMenu({ visible: false, x: 0, y: 0, node: null });
                }}>
                  <RefreshCw size={14} /> {t('workspace.reset_to_container')}
                </div>
              )}

              {!contextMenu.isTab && (
                <>
                  <div className="context-menu-item" onClick={() => {
                    handleCreate(contextMenu.node.path, 'tree');
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}>
                    <Plus size={14} /> {t('workspace.create_document')}
                  </div>
                  <div className="context-menu-item" onClick={() => {
                    openMapCreateModal(contextMenu.node.path);
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}>
                    <Map size={14} /> {t('workspace.create_map')}
                  </div>
                </>
              )}
              <div className="context-menu-item delete" onClick={() => {
                setDeleteModal({ 
                  isOpen: true, 
                  node: contextMenu.node, 
                  isAsset: false, 
                  isTemplate: false,
                  isOverview: contextMenu.isOverview 
                });
                setContextMenu({ visible: false, x: 0, y: 0, node: null });
              }}>
                <Trash2 size={14} /> {t('common.delete')}
              </div>
              
              {!isVisitor && contextMenu.node.type === 'document' && (
                <>
                  <div className="context-menu-divider" />
                  <div className="context-menu-item" onClick={() => {
                    if (contextMenu.node.path === worldData?.homePage) {
                      handleSetHomePage("");
                    } else {
                      handleSetHomePage(contextMenu.node.path);
                    }
                    setContextMenu({ visible: false, x: 0, y: 0, node: null });
                  }}>
                    {contextMenu.node.path === worldData?.homePage ? (
                      <><Home size={14} /> {t('workspace.unset_as_home')}</>
                    ) : (
                      <><Home size={14} /> {t('workspace.set_as_home')}</>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {showTemplateSaveModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <h2>{t('workspace.salvar_como_template')}</h2>
            <p>{t('workspace.salvar_como_template_hint')}</p>
            <div className="input-group">
              <label>{t('workspace.template_name')}</label>
              <input 
                type="text" 
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder={t('workspace.template_name_placeholder')}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowTemplateSaveModal(false)}>{t('common.cancel')}</button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  handleSaveTemplate("");
                }} 
                disabled={!newTemplateName || savingTemplate}
              >
                {savingTemplate ? t('common.saving') : t('workspace.save_template')}
              </button>
            </div>
          </div>
        </div>
      )}


      {showMapCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
            <h2>{t('workspace.new_map')}</h2>
            <p>{t('workspace.new_map_hint')}</p>
            {newMapParentPath && (
              <div className="modal-path-pill">
                <Folder size={14} />
                <span>{newMapParentPath}</span>
              </div>
            )}
            <div className="input-group">
              <label>{t('workspace.name')}</label>
              <input
                type="text"
                value={newMapName}
                onChange={(event) => setNewMapName(event.target.value)}
                placeholder={t('workspace.map_name_placeholder')}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>{t('workspace.image')}</label>
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
                    <span>{t('workspace.click_or_drop_image')}</span>
                  </>
                )}
              </div>
              <select
                className="modal-select"
                value={newMapImagePath}
                onChange={(event) => setNewMapImagePath(event.target.value)}
              >
                <option value="">{t('workspace.select_image')}</option>
                {imageAssets.map(asset => (
                  <option key={asset.path} value={asset.path}>{asset.path}</option>
                ))}
              </select>
              <p className="field-hint">{t('workspace.map_upload_hint')}</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => {
                setShowMapCreateModal(false);
                setNewMapParentPath('');
                setPendingMapPlaceholder(null);
              }}>{t('common.cancel')}</button>
              <button
                className="btn-primary"
                onClick={handleCreateMap}
                disabled={mapSaving || !newMapName.trim() || !newMapImagePath}
              >
                {mapSaving ? t('common.creating') : t('workspace.create_map')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssetUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
            <h2>{t('workspace.upload_assets')}</h2>
            <p>{t('workspace.upload_assets_hint')}</p>
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
              <span>{t('workspace.click_or_drag_files')}</span>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAssetUploadModal(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {pinDraft && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
            <h2>{pinDraft.mode === 'edit' ? t('workspace.edit_pin') : t('workspace.new_pin')}</h2>
            <div className="input-group">
              <label>{t('workspace.name')}</label>
              <input
                type="text"
                value={pinDraft.label}
                onChange={(event) => setPinDraft(prev => ({ ...prev, label: event.target.value }))}
                placeholder={t('workspace.pin_name_placeholder')}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>{t('workspace.destination')}</label>
              <div className="linked-input-row">
                <input
                  type="text"
                  value={pinDraft.target}
                  onChange={(event) => setPinDraft(prev => ({ ...prev, target: event.target.value }))}
                  placeholder={t('workspace.doc_path_placeholder')}
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
              <p className="field-hint">{t('workspace.pin_target_hint')}</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setPinDraft(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleSavePin} disabled={mapSaving || !pinDraft.label.trim()}>
                {mapSaving ? t('common.saving') : t('workspace.save_pin')}
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
              <h2 style={{ margin: 0 }}>{t('workspace.insert_wiki_link')}</h2>
            </div>
            
            <div className="search-input-wrapper" style={{ marginBottom: 20 }}>
              <input 
                type="text" 
                className="modal-search-input"
                placeholder={t('workspace.search_doc_placeholder')}
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
                      {t('workspace.no_doc_found_for', { query: wikiResolver.query })}
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
                {t('common.cancel')}
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

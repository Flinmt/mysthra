import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Edit2, Folder, FileText, ChevronRight, ChevronDown, Plus, Sword, Shield, Castle, Map, Crown, Book, Star, Skull, Trash2, Search, Home, X, Copy, Image, Upload, Music, FolderPlus, MoveRight, Lock, Unlock, MoveVertical, MoreVertical, Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

const ICON_MAP = {
  FileText, Sword, Shield, Castle, Map, Crown, Book, Star, Skull
};

const AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'm4a', 'mp4']);

function getTreeChildren(node) {
  // Retorna apenas filhos que são containers para a Sidebar
  return (node.children || []).filter(child => child.type === 'container');
}

function getTabsForNode(node) {
  // Retorna apenas filhos que são tabs para o Workspace
  return (node?.children || []).filter(child => child.type === 'tab');
}

function isRootContainer(node) {
  return node?.type === 'container' && !String(node.path || '').includes('/');
}

function orderTreeWithHome(nodes = [], homePagePath = '') {
  if (!homePagePath) return nodes;
  const homeIndex = nodes.findIndex(node => isRootContainer(node) && node.path === homePagePath);
  if (homeIndex <= 0) return nodes;
  const nextNodes = [...nodes];
  const [homeNode] = nextNodes.splice(homeIndex, 1);
  return [homeNode, ...nextNodes];
}

function findNodeByPath(nodes = [], targetPath = '') {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    const childMatch = findNodeByPath(node.children || [], targetPath);
    if (childMatch) return childMatch;
  }
  return null;
}

function findAssetByPath(nodes = [], targetPath = '') {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    const childMatch = findAssetByPath(node.children || [], targetPath);
    if (childMatch) return childMatch;
  }
  return null;
}

function getAssetFolders(nodes = []) {
  const folders = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.type !== 'folder') continue;
      folders.push(item);
      walk(item.children || []);
    }
  };
  walk(nodes);
  return folders;
}

function getAssetImages(nodes = []) {
  const images = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.type === 'folder') {
        walk(item.children || []);
        continue;
      }
      if (item.mediaType === 'image') images.push(item);
    }
  };
  walk(nodes);
  return images;
}

function isInvalidAssetMoveTarget(sourceNode, targetPath) {
  if (!sourceNode || sourceNode.type !== 'folder') return false;
  return targetPath === sourceNode.path || targetPath.startsWith(`${sourceNode.path}/`);
}

function getFileExtension(filename = '') {
  return filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
}

function getFileBaseName(filename = '') {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}

function pathParent(assetPath = '') {
  const normalized = String(assetPath || '').replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

function formatAssetSize(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function parseBlockNoteContent(content = '') {
  if (!content.trim()) return null;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return null;
  }
  return null;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Copy failed');
}

function WikiBlockEditor({
  content,
  contentKey,
  editable,
  worldId,
  assetImages = [],
  getAssetUrl,
  onRequestAssets,
  labels,
  onChange
}) {
  const [imageContextMenu, setImageContextMenu] = useState({ isOpen: false, x: 0, y: 0 });
  const initialBlocks = useMemo(() => parseBlockNoteContent(content), [content]);
  const initialContentRef = useRef(content);
  const isLoadingRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const emitFrameRef = useRef(null);
  const editor = useCreateBlockNote(
    {
      ...(initialBlocks ? { initialContent: initialBlocks } : {}),
      uploadFile: async (file) => {
        const prepared = await prepareAssetUpload(file);
        if (!prepared.contentType.startsWith('image/')) {
          throw new Error('Only images can be uploaded to image blocks');
        }
        const query = new URLSearchParams({
          path: '',
          filename: prepared.filename
        });
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': prepared.contentType },
          body: prepared.blob
        });
        if (!res.ok) throw new Error('Failed to upload image');
        const uploaded = await res.json();
        await onRequestAssets?.();
        return getAssetUrl(uploaded.path);
      }
    },
    [contentKey]
  );

  const insertImageBlock = useCallback((url, name = '') => {
    const cursorBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [{
        type: 'image',
        props: {
          url,
          name
        }
      }],
      cursorBlock,
      'after'
    );
    editor.focus();
  }, [editor]);

  const uploadAndInsertImage = useCallback(async (file) => {
    const prepared = await prepareAssetUpload(file);
    if (!prepared.contentType.startsWith('image/')) return;
    const query = new URLSearchParams({
      path: '',
      filename: prepared.filename
    });
    const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': prepared.contentType },
      body: prepared.blob
    });
    if (!res.ok) throw new Error('Failed to upload image');
    const uploaded = await res.json();
    await onRequestAssets?.();
    insertImageBlock(getAssetUrl(uploaded.path), uploaded.name || prepared.filename);
  }, [getAssetUrl, insertImageBlock, onRequestAssets, worldId]);

  const emitEditorDocument = useCallback(() => {
    if (isLoadingRef.current || !editable) return;
    onChangeRef.current(JSON.stringify(editor.document));
    if (emitFrameRef.current) {
      window.cancelAnimationFrame(emitFrameRef.current);
    }
    emitFrameRef.current = window.requestAnimationFrame(() => {
      emitFrameRef.current = null;
      onChangeRef.current(JSON.stringify(editor.document));
    });
  }, [editable, editor]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (emitFrameRef.current) {
        window.cancelAnimationFrame(emitFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!imageContextMenu.isOpen) return undefined;
    const close = () => setImageContextMenu(prev => ({ ...prev, isOpen: false }));
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [imageContextMenu.isOpen]);

  useEffect(() => {
    let isCancelled = false;

    const loadLegacyMarkdown = async () => {
      const source = initialContentRef.current || '';
      const nativeBlocks = parseBlockNoteContent(source);
      if (nativeBlocks) {
        isLoadingRef.current = false;
        return;
      }

      if (!source.trim()) {
        isLoadingRef.current = false;
        return;
      }

      try {
        const blocks = await editor.tryParseMarkdownToBlocks(source);
        if (isCancelled) return;
        editor.replaceBlocks(editor.document, blocks);
        isLoadingRef.current = false;
        emitEditorDocument();
      } catch {
        isLoadingRef.current = false;
      }
    };

    loadLegacyMarkdown();

    return () => {
      isCancelled = true;
    };
  }, [contentKey, editor, emitEditorDocument]);

  return (
    <div
      className="wiki-block-editor"
      onContextMenu={async (event) => {
        if (!editable) return;
        event.preventDefault();
        await onRequestAssets?.();
        setImageContextMenu({ isOpen: true, x: event.clientX, y: event.clientY });
      }}
      onDragOver={(event) => {
        if (!editable) return;
        const hasImageAsset = event.dataTransfer.types.includes('application/x-mythra-asset-image');
        const hasImageFile = Array.from(event.dataTransfer.items || []).some(item => item.kind === 'file' && item.type.startsWith('image/'));
        if (hasImageAsset || hasImageFile) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={async (event) => {
        if (!editable) return;
        const assetPayload = event.dataTransfer.getData('application/x-mythra-asset-image');
        if (assetPayload) {
          event.preventDefault();
          try {
            const asset = JSON.parse(assetPayload);
            insertImageBlock(getAssetUrl(asset.path), asset.name);
          } catch {
            // Ignore invalid drag payloads from outside the app.
          }
          return;
        }

        const imageFiles = Array.from(event.dataTransfer.files || []).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;
        event.preventDefault();
        for (const file of imageFiles) {
          await uploadAndInsertImage(file);
        }
      }}
    >
      {editable && imageContextMenu.isOpen && (
        <div
          className="context-menu glass-panel wiki-image-context-menu"
          style={{ top: imageContextMenu.y, left: imageContextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="context-menu-section-label">{labels.insertImage}</div>
          {assetImages.length === 0 ? (
            <span className="context-menu-empty">{labels.noAssetImages}</span>
          ) : (
            assetImages.map(asset => (
              <button
                key={asset.path}
                type="button"
                onClick={() => {
                  insertImageBlock(getAssetUrl(asset.path), asset.name);
                  setImageContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
              >
                <img className="context-menu-thumb" src={getAssetUrl(asset.path)} alt="" />
                <span>{asset.name}</span>
              </button>
            ))
          )}
        </div>
      )}
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="dark"
        onChange={emitEditorDocument}
      />
    </div>
  );
}

function convertImageToWebp(file) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          reject(new Error('Could not convert image'));
          return;
        }
        resolve(blob);
      }, 'image/webp', 0.86);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    image.src = objectUrl;
  });
}

async function prepareAssetUpload(file) {
  const extension = getFileExtension(file.name);
  const isGif = extension === 'gif' || file.type === 'image/gif';

  if (file.type.startsWith('image/') && !isGif) {
    const blob = await convertImageToWebp(file);
    return {
      blob,
      filename: `${getFileBaseName(file.name)}.webp`,
      contentType: 'image/webp'
    };
  }

  if (isGif) {
    return { blob: file, filename: file.name, contentType: file.type || 'image/gif' };
  }

  if (file.type.startsWith('audio/') && AUDIO_EXTENSIONS.has(extension)) {
    return { blob: file, filename: file.name, contentType: file.type || 'application/octet-stream' };
  }

  throw new Error('Unsupported asset type');
}

function AssetTree({ nodes, selectedAsset, selectedFolderPath, onSelectAsset, onSelectFolder, onCreateFolder, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isVisitor }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="asset-tree">
      {nodes.map(node => (
        <AssetTreeNode
          key={node.path}
          node={node}
          selectedAsset={selectedAsset}
          selectedFolderPath={selectedFolderPath}
          onSelectAsset={onSelectAsset}
          onSelectFolder={onSelectFolder}
          onCreateFolder={onCreateFolder}
          onContextMenu={onContextMenu}
          renamingPath={renamingPath}
          onRename={onRename}
          onRequestRename={onRequestRename}
          onDelete={onDelete}
          isVisitor={isVisitor}
        />
      ))}
    </ul>
  );
}

function AssetTreeNode({ node, selectedAsset, selectedFolderPath, onSelectAsset, onSelectFolder, onCreateFolder, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isVisitor }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [editValue, setEditValue] = useState(node.name);
  const isFolder = node.type === 'folder';
  const isRenaming = renamingPath === node.path;
  const isSelected = isFolder ? selectedFolderPath === node.path : selectedAsset?.path === node.path;
  const Icon = isFolder ? Folder : node.mediaType === 'audio' ? Music : Image;

  useEffect(() => {
    if (isRenaming) setEditValue(node.name);
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (renamingPath?.startsWith(`${node.path}/`)) setIsOpen(true);
  }, [node.path, renamingPath]);

  return (
    <li className="asset-tree-document">
      <div
        className={`asset-tree-node ${isSelected ? 'selected' : ''}`}
        draggable={!isRenaming && !isFolder && node.mediaType === 'image'}
        onDragStart={(event) => {
          if (isRenaming || isFolder || node.mediaType !== 'image') return;
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('application/x-mythra-asset-image', JSON.stringify({
            path: node.path,
            name: node.name
          }));
          event.dataTransfer.setData('text/plain', node.name);
        }}
        onContextMenu={(event) => {
          if (isVisitor || isRenaming) return;
          event.preventDefault();
          event.stopPropagation();
          onContextMenu(event, node);
        }}
        onClick={() => {
          if (isRenaming) return;
          if (isFolder) {
            setIsOpen(prev => !prev);
            onSelectFolder(node.path);
          } else {
            onSelectAsset(node);
          }
        }}
      >
        <span className={`tree-expander ${isFolder && node.children?.length ? 'has-children' : ''}`} aria-hidden="true">
          {isFolder && node.children?.length ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <span className="tree-icon">
          <Icon size={14} />
        </span>
        {isRenaming ? (
          <input
            className="tree-rename-input"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={() => onRename(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRename(node, editValue);
              if (event.key === 'Escape') onRename(null);
            }}
            autoFocus
            onFocus={(event) => event.target.select()}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="asset-tree-label">
            <span>{node.name}</span>
            {!isFolder && <small>{formatAssetSize(node.size)}</small>}
          </span>
        )}
        {!isVisitor && !isRenaming && (
          <span className="tree-node-actions asset-node-actions">
            {isFolder && (
              <span
                role="button"
                tabIndex={0}
                className="node-action-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsOpen(true);
                  onCreateFolder(node.path);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setIsOpen(true);
                    onCreateFolder(node.path);
                  }
                }}
                title={t('common.create')}
              >
                <Plus size={14} />
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              className="node-action-btn"
              onClick={(event) => {
                event.stopPropagation();
                onRequestRename(node);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRequestRename(node);
                }
              }}
              title={t('common.rename')}
            >
              <Edit2 size={14} />
            </span>
            <span
              role="button"
              tabIndex={0}
              className="node-action-btn danger"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(node);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onDelete(node);
                }
              }}
              title={t('common.delete')}
            >
              <Trash2 size={14} />
            </span>
          </span>
        )}
      </div>
      {isFolder && isOpen && node.children?.length > 0 && (
        <AssetTree
          nodes={node.children}
          selectedAsset={selectedAsset}
          selectedFolderPath={selectedFolderPath}
          onSelectAsset={onSelectAsset}
          onSelectFolder={onSelectFolder}
          onCreateFolder={onCreateFolder}
          onContextMenu={onContextMenu}
          renamingPath={renamingPath}
          onRename={onRename}
          onRequestRename={onRequestRename}
          onDelete={onDelete}
          isVisitor={isVisitor}
        />
      )}
    </li>
  );
}

function FileTree({ nodes, onFileSelect, selectedFile, onCreateChild, onIconSelect, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isSearching, isVisitor, worldData }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.filter(node => isSearching || node.type === 'container').map(node => (
        <FileTreeNode 
          key={node.path} 
          node={node} 
          onFileSelect={onFileSelect} 
          selectedFile={selectedFile} 
          onCreateChild={onCreateChild} 
          onIconSelect={onIconSelect} 
          onContextMenu={onContextMenu} 
          renamingPath={renamingPath} 
          onRename={onRename} 
          onRequestRename={onRequestRename}
          onDelete={onDelete}
          isSearching={isSearching} 
          isVisitor={isVisitor} 
          worldData={worldData} 
        />
      ))}
    </ul>
  );
}

function FileTreeNode({ node, onFileSelect, selectedFile, onCreateChild, onIconSelect, onContextMenu, renamingPath, onRename, onRequestRename, onDelete, isSearching, isVisitor, worldData }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [iconPickerPosition, setIconPickerPosition] = useState({ top: 0, left: 0 });
  const [editValue, setEditValue] = useState(node.name);
  const isSelected = selectedFile?.path === node.path;
  const isRenaming = renamingPath === node.path;
  const isHome = worldData?.homePage === node.path;
  const visibleChildren = isSearching ? (node.children || []) : getTreeChildren(node);
  const showChildren = isOpen || isSearching;
  
  useEffect(() => {
    if (isRenaming) setEditValue(node.name);
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (renamingPath?.startsWith(`${node.path}/`)) setIsOpen(true);
  }, [node.path, renamingPath]);

  useEffect(() => {
    if (!showIcons) return;
    const closeIt = () => setShowIcons(false);
    window.addEventListener('click', closeIt);
    window.addEventListener('scroll', closeIt, true);
    window.addEventListener('resize', closeIt);
    return () => {
      window.removeEventListener('click', closeIt);
      window.removeEventListener('scroll', closeIt, true);
      window.removeEventListener('resize', closeIt);
    };
  }, [showIcons]);

  const toggleIconPicker = (event) => {
    event.stopPropagation();
    if (isRenaming || isVisitor) return;
    if (showIcons) {
      setShowIcons(false);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const pickerWidth = 178;
    const pickerHeight = 118;
    const viewportPadding = 12;
    const top = Math.min(
      Math.max(rect.top - 12, viewportPadding),
      window.innerHeight - pickerHeight - viewportPadding
    );
    const left = Math.max(
      viewportPadding,
      Math.min(rect.right + 10, window.innerWidth - pickerWidth - viewportPadding)
    );

    setIconPickerPosition({ top, left });
    setShowIcons(true);
  };

  return (
    <li className="tree-document">
      <div 
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        draggable={!isRenaming && !isVisitor}
        onContextMenu={(e) => {
          if (isVisitor) return;
          if (isRenaming) return;
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, node);
        }}
      >
        <span
          className={`tree-expander ${visibleChildren.length > 0 ? 'has-children' : ''}`}
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          aria-hidden="true"
        >
          {visibleChildren.length > 0 ? (showChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <div
          className="tree-node-main"
          onClick={() => {
            if (isRenaming) return;
            onFileSelect(node);
          }}
        >
          <span 
            className={`tree-icon ${showIcons ? 'is-picking' : ''}`}
            onClick={toggleIconPicker}
            title={isVisitor ? undefined : t('workspace.change_icon')}
          >
            {React.createElement(ICON_MAP[node.icon] || FileText, { size: 14 })}
            
            {showIcons && !isVisitor && (
              <div
                className="icon-selector-dropdown glass-panel"
                style={{ top: iconPickerPosition.top, left: iconPickerPosition.left }}
                onClick={e => e.stopPropagation()}
              >
                {Object.keys(ICON_MAP).map(key => (
                  <button 
                    key={key} 
                    className={`icon-option ${node.icon === key ? 'active' : ''}`}
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
                if (e.key === 'Enter') onRename(node, editValue);
                else if (e.key === 'Escape') onRename(null);
              }}
              autoFocus
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-node-label">
              <span>{node.name}</span>
              {isHome && <Home size={12} className="tree-home-indicator" title={t('workspace.home_page')} />}
            </span>
          )}
        </div>
        <div className="tree-node-actions">
          {!isVisitor && (
            <>
              <button
                className="node-action-btn"
                onClick={(e) => { e.stopPropagation(); setIsOpen(true); onCreateChild(node.path); }}
                title={t('common.create')}
              >
                <Plus size={14} />
              </button>
              <button
                className="node-action-btn"
                onClick={(e) => { e.stopPropagation(); onRequestRename(node); }}
                title={t('common.rename')}
              >
                <Edit2 size={14} />
              </button>
              <button
                className="node-action-btn danger"
                onClick={(e) => { e.stopPropagation(); onDelete(node); }}
                title={t('common.delete')}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {showChildren && visibleChildren.length > 0 && <FileTree nodes={visibleChildren} onFileSelect={onFileSelect} selectedFile={selectedFile} onCreateChild={onCreateChild} onIconSelect={onIconSelect} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} onRequestRename={onRequestRename} onDelete={onDelete} isSearching={isSearching} isVisitor={isVisitor} worldData={worldData} />}
    </li>
  );
}

export default function WorldWorkspace({ params, isVisitor = false, currentUser = null }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const worldId = decodeURIComponent(params.id);
  
  const [tree, setTree] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState('edit'); // 'view' or 'edit'
  const [searchQuery, setSearchQuery] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState('wiki');
  const [assetTree, setAssetTree] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedAssetFolderPath, setSelectedAssetFolderPath] = useState('');
  const [worldData, setWorldData] = useState(null);
  const [worldDataLoaded, setWorldDataLoaded] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const assetFileInputRef = useRef(null);
  const coverFileInputRef = useRef(null);
  
  // Modals/UI State
  const [prompt, setPrompt] = useState({ isOpen: false, parentPath: '', name: '', type: 'container', contentType: 'wiki' });
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [tabContextMenu, setTabContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [assetContextMenu, setAssetContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [worldActionsMenu, setWorldActionsMenu] = useState(false);
  const [membersPanel, setMembersPanel] = useState({ isOpen: false, loading: false, members: [], users: [], userId: '', username: '', password: '', error: '' });
  const [duplicatePrompt, setDuplicatePrompt] = useState({ isOpen: false, node: null });
  const [assetDuplicatePrompt, setAssetDuplicatePrompt] = useState({ isOpen: false, node: null });
  const [assetMovePrompt, setAssetMovePrompt] = useState({ isOpen: false, node: null, targetPath: '' });
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, node: null });
  const [assetDeletePrompt, setAssetDeletePrompt] = useState({ isOpen: false, node: null });
  const [tabIconPicker, setTabIconPicker] = useState({ isOpen: false, top: 0, left: 0 });
  const [renamingPath, setRenamingPath] = useState(null);
  const [assetRenamingPath, setAssetRenamingPath] = useState(null);
  const [renamingTab, setRenamingTab] = useState({ path: '', value: '' });
  const [pageTitleEdit, setPageTitleEdit] = useState({ isEditing: false, value: '' });
  const [tabCreationPanel, setTabCreationPanel] = useState({ isOpen: false, name: '', contentType: 'wiki' });
  const [isRepositioningCover, setIsRepositioningCover] = useState(false);
  const assetUploadTargetPathRef = useRef('');
  const latestContentRef = useRef('');
  const latestTabPathRef = useRef('');
  const skipTitleRenameRef = useRef(false);
  const initialSharedSelectionRef = useRef(false);
  const coverDragRef = useRef({ isDragging: false, startY: 0, startPosition: 50, currentPosition: 50, frame: null });
  const [coverUploading, setCoverUploading] = useState(false);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/tree`);
      if (res.ok) {
        const data = await res.json();
        setTree(data.items || []);
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  }, [addToast, t, worldId]);

  const fetchWorldData = useCallback(async () => {
    setWorldDataLoaded(false);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/config`);
      if (res.ok) {
        const data = await res.json();
        setWorldData(data);
      }
    } catch {
      setWorldData(null);
    } finally {
      setWorldDataLoaded(true);
    }
  }, [worldId]);

  const fetchAssets = useCallback(async () => {
    setAssetLoading(true);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssetTree(data.items || []);
      }
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setAssetLoading(false);
    }
  }, [addToast, t, worldId]);

  const fetchMembersPanelData = useCallback(async () => {
    if (!currentUser?.isAdmin) return;
    setMembersPanel(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const [membersRes, usersRes] = await Promise.all([
        fetch(`/api/worlds/${encodeURIComponent(worldId)}/members`),
        fetch('/api/users')
      ]);
      if (!membersRes.ok || !usersRes.ok) {
        setMembersPanel(prev => ({ ...prev, loading: false, error: t('common.error') }));
        return;
      }
      const membersData = await membersRes.json();
      const usersData = await usersRes.json();
      setMembersPanel(prev => ({
        ...prev,
        loading: false,
        members: membersData.items || [],
        users: usersData.items || [],
        error: ''
      }));
    } catch {
      setMembersPanel(prev => ({ ...prev, loading: false, error: t('common.error_connection') }));
    }
  }, [currentUser?.isAdmin, t, worldId]);

  const openMembersPanel = () => {
    if (!currentUser?.isAdmin) return;
    setMembersPanel(prev => ({ ...prev, isOpen: true, error: '' }));
    fetchMembersPanelData();
  };

  useEffect(() => {
    latestContentRef.current = fileContent;
    latestTabPathRef.current = activeTab?.path || '';
  }, [activeTab, fileContent]);

  const handleWikiContentChange = useCallback((nextContent) => {
    latestContentRef.current = nextContent;
    latestTabPathRef.current = activeTab?.path || '';
    setFileContent(nextContent);
    setIsDirty(true);
  }, [activeTab?.path]);

  const saveDocument = useCallback(async (silent = true) => {
    if (!activeTab || isVisitor) return false;
    const savedPath = activeTab.path;
    const savedContent = latestContentRef.current;
    setSaveStatus('saving');

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: savedPath,
          content: savedContent
        })
      });

      if (!res.ok) {
        setSaveStatus('error');
        if (!silent) addToast(t('common.error'), 'error');
        return false;
      }

      if (latestTabPathRef.current === savedPath && latestContentRef.current === savedContent) {
        setIsDirty(false);
        setSaveStatus('saved');
      }
      if (!silent) addToast(t('common.saved'), 'success');
      return true;
    } catch {
      setSaveStatus('error');
      if (!silent) addToast(t('common.error'), 'error');
      return false;
    }
  }, [activeTab, addToast, isVisitor, t, worldId]);

  useEffect(() => {
    fetchTree();
    fetchWorldData();
  }, [fetchTree, fetchWorldData]);

  useEffect(() => {
    setPageTitleEdit({ isEditing: false, value: selectedContainer?.name || '' });
    setTabCreationPanel({ isOpen: false, name: '', contentType: 'wiki' });
    setViewMode(selectedContainer?.metadata?.isLocked ? 'view' : 'edit');
  }, [selectedContainer?.uid, selectedContainer?.name, selectedContainer?.metadata?.isLocked]);

  useEffect(() => {
    if (!activeTab || isVisitor || !isDirty) return;

    setSaveStatus('idle');
    const timer = setTimeout(() => {
      saveDocument(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeTab, fileContent, isDirty, isVisitor, saveDocument]);

  useEffect(() => {
    if (!isVisitor && activeSidebarTab === 'assets') {
      fetchAssets();
    }
  }, [activeSidebarTab, fetchAssets, isVisitor]);

  useEffect(() => {
    if (isVisitor && activeSidebarTab !== 'wiki') {
      setActiveSidebarTab('wiki');
    }
  }, [activeSidebarTab, isVisitor]);

  useEffect(() => {
    if (!worldActionsMenu) return undefined;
    const close = () => setWorldActionsMenu(false);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [worldActionsMenu]);

  // Sincroniza o container selecionado quando a árvore muda (para refletir novas abas)
  useEffect(() => {
    if (selectedContainer && tree.length > 0) {
      const updatedNode = findNodeByPath(tree, selectedContainer.path);
      if (updatedNode) {
        setSelectedContainer(updatedNode);
      }
    }
    if (activeTab && tree.length > 0) {
      const updatedTab = findNodeByPath(tree, activeTab.path);
      if (updatedTab) {
        setActiveTab(updatedTab);
      }
    }
  }, [activeTab, selectedContainer, tree]);

  const selectContainer = async (node) => {
    setSelectedContainer(node);
    const tabs = getTabsForNode(node);
    if (tabs.length > 0) {
      selectTab(tabs[0]);
    } else {
      setActiveTab(null);
      setFileContent('');
    }
  };

  const selectTab = async (tabNode) => {
    if (isDirty) {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      const saved = await saveDocument(true);
      if (!saved) return;
    }
    setTabCreationPanel(prev => ({ ...prev, isOpen: false }));

    if (tabNode.contentType === 'map') {
      setActiveTab(tabNode);
      setFileContent('');
      setIsDirty(false);
      setSaveStatus('saved');
      return;
    }
    
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(tabNode.path)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveTab(tabNode);
        setFileContent(data.content);
        setIsDirty(false);
        setSaveStatus('saved');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  useEffect(() => {
    if (initialSharedSelectionRef.current || !worldDataLoaded || tree.length === 0 || selectedContainer) return;

    const queryParams = new URLSearchParams(window.location.search);
    const documentPath = queryParams.get('document');
    const tabPath = queryParams.get('tab');
    const sharedContainerPath = documentPath || pathParent(tabPath);
    const sharedContainer = sharedContainerPath ? findNodeByPath(tree, sharedContainerPath) : null;
    const homeContainer = tree.find(node => isRootContainer(node) && node.path === worldData?.homePage);
    const fallbackContainer = tree.find(node => isRootContainer(node));
    const targetContainer = sharedContainer?.type === 'container'
      ? sharedContainer
      : homeContainer || fallbackContainer;

    if (!targetContainer) return;

    initialSharedSelectionRef.current = true;
    setSelectedContainer(targetContainer);

    const sharedTab = tabPath ? findNodeByPath(tree, tabPath) : null;
    const tabToOpen = sharedContainer?.type === 'container' && sharedTab?.type === 'tab'
      ? sharedTab
      : getTabsForNode(targetContainer)[0];
    if (!tabToOpen) {
      setActiveTab(null);
      setFileContent('');
      setIsDirty(false);
      setSaveStatus('saved');
      return;
    }

    const openInitialTab = async () => {
      if (tabToOpen.contentType === 'map') {
        setActiveTab(tabToOpen);
        setFileContent('');
        setIsDirty(false);
        setSaveStatus('saved');
        return;
      }

      try {
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(tabToOpen.path)}`);
        if (res.ok) {
          const data = await res.json();
          setActiveTab(tabToOpen);
          setFileContent(data.content);
          setIsDirty(false);
          setSaveStatus('saved');
        }
      } catch {
        addToast(t('common.error'), 'error');
      }
    };

    openInitialTab();
  }, [addToast, selectedContainer, t, tree, worldData?.homePage, worldDataLoaded, worldId]);

  const getUniqueTabName = () => {
    const baseName = t('workspace.new_tab_name');
    const siblingNames = new Set(selectedTabs.map(tab => tab.name));
    if (!siblingNames.has(baseName)) return baseName;

    let suffix = 2;
    while (siblingNames.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  };

  const openTabCreationPanel = () => {
    if (isVisitor || !selectedContainer) return;
    setTabCreationPanel({ isOpen: true, name: getUniqueTabName(), contentType: 'wiki' });
  };

  const handleCreateTabInline = async () => {
    if (isVisitor || !selectedContainer) return;
    const tabName = tabCreationPanel.name.trim();
    if (!tabName) return;
    if (isDirty) {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      const saved = await saveDocument(true);
      if (!saved) return;
    }

    try {
      const contentType = tabCreationPanel.contentType;
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${selectedContainer.path}/${tabName}`,
          content: '',
          metadata: {
            type: 'tab',
            contentType
          }
        })
      });
      if (res.ok) {
        const createdTab = await res.json();
        setTabCreationPanel({ isOpen: false, name: '', contentType: 'wiki' });
        const nextActiveTab = {
          ...createdTab,
          icon: null,
          type: 'tab',
          contentType,
          metadata: { type: 'tab', contentType }
        };

        if (contentType === 'wiki') {
          const resDoc = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(createdTab.path)}`);
          if (resDoc.ok) {
            const data = await resDoc.json();
            setActiveTab(nextActiveTab);
            setFileContent(data.content || '');
            setIsDirty(false);
            setSaveStatus('saved');
          }
        } else {
          setActiveTab(nextActiveTab);
          setFileContent('');
          setIsDirty(false);
          setSaveStatus('saved');
        }
        await fetchTree();
        addToast(t('common.created'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleCreateNode = async () => {
    if (!prompt.name) return;
    const nodePath = prompt.parentPath ? `${prompt.parentPath}/${prompt.name}` : prompt.name;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: nodePath, 
          content: '', 
          metadata: { 
            type: prompt.type,
            contentType: prompt.type === 'tab' ? prompt.contentType : null
          } 
        })
      });
      if (res.ok) {
        setPrompt({ isOpen: false, parentPath: '', name: '', type: 'container', contentType: 'wiki' });
        fetchTree();
        addToast(t('common.created'), 'success');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleRename = async (node, newName) => {
    if (!newName || newName === node.name) {
      setRenamingPath(null);
      return;
    }
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, newName })
      });
      if (res.ok) {
        setRenamingPath(null);
        fetchTree();
        addToast(t('common.renamed'), 'success');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const commitTabRename = async (tab) => {
    const nextName = renamingTab.value.trim();
    if (!tab || !nextName || nextName === tab.name) {
      setRenamingTab({ path: '', value: '' });
      return;
    }

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tab.path, newName: nextName })
      });
      if (res.ok) {
        setRenamingTab({ path: '', value: '' });
        setActiveTab(prev => prev?.path === tab.path ? { ...prev, name: nextName, metadata: { ...prev.metadata, name: nextName } } : prev);
        await fetchTree();
        addToast(t('common.renamed'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleDelete = async (node) => {
    if (isVisitor || !node) return;
    setDeletePrompt({ isOpen: true, node });
  };

  const updateHomePage = async (node) => {
    if (isVisitor) return;
    const nextHomePage = node ? node.path : null;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/homepage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homePage: nextHomePage })
      });
      if (res.ok) {
        const data = await res.json();
        setWorldData(data);
        addToast(nextHomePage ? t('workspace.home_page_set') : t('workspace.home_page_unset'), 'success');
      } else {
        addToast(t('workspace.home_page_failed'), 'error');
      }
    } catch {
      addToast(t('workspace.home_page_failed'), 'error');
    }
  };

  const addExistingMember = async () => {
    if (!currentUser?.isAdmin || !membersPanel.userId) return;
    setMembersPanel(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: membersPanel.userId })
      });
      if (res.ok) {
        const data = await res.json();
        setMembersPanel(prev => ({ ...prev, loading: false, members: data.items || [], userId: '' }));
      } else {
        const data = await res.json();
        setMembersPanel(prev => ({ ...prev, loading: false, error: data.error || t('common.error') }));
      }
    } catch {
      setMembersPanel(prev => ({ ...prev, loading: false, error: t('common.error_connection') }));
    }
  };

  const createAndAddMember = async () => {
    if (!currentUser?.isAdmin || !membersPanel.username.trim() || !membersPanel.password) return;
    setMembersPanel(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: membersPanel.username.trim(),
          password: membersPanel.password
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMembersPanel(prev => ({
          ...prev,
          loading: false,
          members: data.items || [],
          username: '',
          password: ''
        }));
        await fetchMembersPanelData();
      } else {
        const data = await res.json();
        setMembersPanel(prev => ({ ...prev, loading: false, error: data.error || t('common.error') }));
      }
    } catch {
      setMembersPanel(prev => ({ ...prev, loading: false, error: t('common.error_connection') }));
    }
  };

  const removeMember = async (userId) => {
    if (!currentUser?.isAdmin) return;
    setMembersPanel(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/members/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setMembersPanel(prev => ({ ...prev, loading: false, members: data.items || [] }));
      } else {
        const data = await res.json();
        setMembersPanel(prev => ({ ...prev, loading: false, error: data.error || t('common.error') }));
      }
    } catch {
      setMembersPanel(prev => ({ ...prev, loading: false, error: t('common.error_connection') }));
    }
  };

  const confirmDelete = async () => {
    const node = deletePrompt.node;
    if (isVisitor || !node) return;
    const deletedHomePage = worldData?.homePage === node.path;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(node.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (node.type === 'tab') {
          if (activeTab?.path === node.path) {
            setActiveTab(null);
            setFileContent('');
            setIsDirty(false);
            setSaveStatus('saved');
          }
        } else if (
          selectedContainer?.path === node.path ||
          selectedContainer?.path?.startsWith(`${node.path}/`)
        ) {
          setSelectedContainer(null);
          setActiveTab(null);
          setFileContent('');
          initialSharedSelectionRef.current = false;
        }
        if (deletedHomePage) {
          try {
            const homeRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/homepage`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ homePage: null })
            });
            if (homeRes.ok) {
              const data = await homeRes.json();
              setWorldData(data);
            } else {
              setWorldData(prev => prev ? { ...prev, homePage: null } : prev);
            }
          } catch {
            setWorldData(prev => prev ? { ...prev, homePage: null } : prev);
          }
          initialSharedSelectionRef.current = false;
        }
        setDeletePrompt({ isOpen: false, node: null });
        await fetchTree();
        addToast(t('common.deleted'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const duplicateTab = async (tab) => {
    if (isVisitor || !tab) return;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: tab.path,
          includeChildren: false,
          name: `${tab.name} ${t('workspace.copy_suffix')}`
        })
      });
      if (res.ok) {
        const result = await res.json();
        await fetchTree();
        setRenamingTab({ path: result.path, value: result.name });
        addToast(t('workspace.duplicated'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const openDuplicatePrompt = (node) => {
    if (isVisitor || !node) return;
    setDuplicatePrompt({ isOpen: true, node });
  };

  const handleDuplicate = async (includeChildren) => {
    const node = duplicatePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: node.path,
          includeChildren,
          name: `${node.name} ${t('workspace.copy_suffix')}`
        })
      });
      if (res.ok) {
        const result = await res.json();
        setDuplicatePrompt({ isOpen: false, node: null });
        setSearchQuery('');
        await fetchTree();
        setRenamingPath(result.path);
        addToast(t('workspace.duplicated'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleIconSelect = async (node, icon) => {
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, metadata: { icon } })
      });
      if (res.ok) {
        fetchTree();
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const openTabIconPicker = (event) => {
    if (isVisitor || !selectedContainer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTabIconPicker({
      isOpen: true,
      top: rect.bottom + 10,
      left: Math.max(12, rect.left)
    });
  };

  const handleTabIconSelect = async (icon) => {
    if (!selectedContainer) return;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, metadata: { icon } })
      });
      if (res.ok) {
        setTabIconPicker({ isOpen: false, top: 0, left: 0 });
        setSelectedContainer(prev => prev ? { ...prev, icon, metadata: { ...prev.metadata, icon } } : prev);
        await fetchTree();
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const displayTree = useMemo(() => {
    return orderTreeWithHome(tree, worldData?.homePage);
  }, [tree, worldData?.homePage]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return displayTree;
    const search = (nodes) => {
      return nodes.map(node => {
        const matches = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        const children = node.children ? search(node.children) : [];
        if (matches || children.length > 0) {
          return { ...node, children };
        }
        return null;
      }).filter(Boolean);
    };
    return search(displayTree);
  }, [displayTree, searchQuery]);

  const filteredAssetTree = useMemo(() => {
    if (!assetSearchQuery) return assetTree;

    const query = assetSearchQuery.toLowerCase();
    const filterNodes = (nodes) => {
      return nodes.map(node => {
        const matches = node.name.toLowerCase().includes(query);
        const children = node.children ? filterNodes(node.children) : [];
        if (matches || children.length > 0) {
          return { ...node, children };
        }
        return null;
      }).filter(Boolean);
    };

    return filterNodes(assetTree);
  }, [assetSearchQuery, assetTree]);

  const assetMoveTargets = useMemo(() => {
    const sourceNode = assetMovePrompt.node;
    return [
      {
        name: t('workspace.assets_root_target'),
        path: '',
        depth: 0,
        disabled: isInvalidAssetMoveTarget(sourceNode, '')
      },
      ...getAssetFolders(assetTree).map(folder => ({
        ...folder,
        depth: folder.path.split('/').length,
        disabled: isInvalidAssetMoveTarget(sourceNode, folder.path)
      }))
    ];
  }, [assetMovePrompt.node, assetTree, t]);
  const assetImages = useMemo(() => getAssetImages(assetTree), [assetTree]);

  const getUniqueDocumentName = (parentPath = '') => {
    const baseName = t('workspace.new_document_name');
    const parentNode = parentPath ? findNodeByPath(tree, parentPath) : null;
    const siblingNodes = parentNode ? (parentNode.children || []) : tree;
    const siblingNames = new Set(siblingNodes.map(node => node.name));
    if (!siblingNames.has(baseName)) return baseName;

    let suffix = 2;
    while (siblingNames.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  };

  const createDocumentInline = async (parentPath = '') => {
    if (isVisitor) return;
    const name = getUniqueDocumentName(parentPath);
    const path = parentPath ? `${parentPath}/${name}` : name;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          content: '',
          metadata: {
            type: 'container',
            contentType: null
          }
        })
      });
      if (res.ok) {
        const result = await res.json();
        setSearchQuery('');
        await fetchTree();
        setRenamingPath(result.path);
        addToast(t('common.created'), 'success');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const getAssetUrl = (assetPath) => {
    return `/api/worlds/${encodeURIComponent(worldId)}/assets/file?path=${encodeURIComponent(assetPath)}`;
  };

  const getUniqueAssetFolderName = (parentPath = '') => {
    const baseName = t('workspace.new_asset_folder_name');
    const parentNode = parentPath ? findAssetByPath(assetTree, parentPath) : null;
    const siblingNodes = parentNode ? (parentNode.children || []) : assetTree;
    const siblingNames = new Set(siblingNodes.filter(node => node.type === 'folder').map(node => node.name));
    if (!siblingNames.has(baseName)) return baseName;

    let suffix = 2;
    while (siblingNames.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  };

  const createAssetFolderInline = async (parentPath = selectedAssetFolderPath) => {
    if (isVisitor) return;
    const name = getUniqueAssetFolderName(parentPath);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath,
          name
        })
      });
      if (res.ok) {
        const folder = await res.json();
        setAssetSearchQuery('');
        setSelectedAssetFolderPath(folder.path);
        setSelectedAsset(null);
        await fetchAssets();
        setAssetRenamingPath(folder.path);
        addToast(t('workspace.asset_folder_created'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetRename = async (node, newName) => {
    if (!node || !newName || newName === node.name) {
      setAssetRenamingPath(null);
      return;
    }

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, newName })
      });
      if (res.ok) {
        const renamed = await res.json();
        setAssetRenamingPath(null);
        if (selectedAsset?.path === node.path) setSelectedAsset(renamed.type === 'file' ? renamed : null);
        if (selectedAssetFolderPath === node.path) setSelectedAssetFolderPath(renamed.path);
        await fetchAssets();
        addToast(t('common.renamed'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetDelete = (node) => {
    if (isVisitor || !node) return;
    setAssetDeletePrompt({ isOpen: true, node });
  };

  const confirmAssetDelete = async () => {
    const node = assetDeletePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets?path=${encodeURIComponent(node.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedAsset?.path === node.path || selectedAsset?.path?.startsWith(`${node.path}/`)) {
          setSelectedAsset(null);
        }
        if (selectedAssetFolderPath === node.path || selectedAssetFolderPath?.startsWith(`${node.path}/`)) {
          setSelectedAssetFolderPath('');
        }
        setAssetDeletePrompt({ isOpen: false, node: null });
        await fetchAssets();
        addToast(t('common.deleted'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetDuplicate = async (includeChildren) => {
    const node = assetDuplicatePrompt.node;
    if (isVisitor || !node) return;

    const extension = node.type === 'file' ? getFileExtension(node.name) : '';
    const baseName = node.type === 'file' ? getFileBaseName(node.name) : node.name;
    const copyName = extension
      ? `${baseName} ${t('workspace.copy_suffix')}.${extension}`
      : `${baseName} ${t('workspace.copy_suffix')}`;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: node.path,
          includeChildren,
          name: copyName
        })
      });
      if (res.ok) {
        const duplicated = await res.json();
        setAssetDuplicatePrompt({ isOpen: false, node: null });
        setAssetSearchQuery('');
        await fetchAssets();
        setAssetRenamingPath(duplicated.path);
        if (duplicated.type === 'file') setSelectedAsset(duplicated);
        if (duplicated.type === 'folder') setSelectedAssetFolderPath(duplicated.path);
        addToast(t('workspace.duplicated'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const openAssetMovePrompt = (node) => {
    if (isVisitor || !node) return;
    const parentPath = pathParent(node.path);
    setAssetMovePrompt({ isOpen: true, node, targetPath: parentPath });
  };

  const confirmAssetMove = async () => {
    const node = assetMovePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: node.path,
          targetFolderPath: assetMovePrompt.targetPath
        })
      });
      if (res.ok) {
        const moved = await res.json();
        setAssetMovePrompt({ isOpen: false, node: null, targetPath: '' });
        setAssetSearchQuery('');
        await fetchAssets();
        if (moved.type === 'file') {
          setSelectedAsset(moved);
          setSelectedAssetFolderPath(pathParent(moved.path));
        } else {
          setSelectedAsset(null);
          setSelectedAssetFolderPath(moved.path);
        }
        addToast(t('workspace.asset_moved'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleAssetUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const uploadPath = assetUploadTargetPathRef.current || selectedAssetFolderPath;
    assetUploadTargetPathRef.current = '';
    setAssetUploading(true);
    try {
      for (const file of files) {
        const prepared = await prepareAssetUpload(file);
        const query = new URLSearchParams({
          path: uploadPath,
          filename: prepared.filename
        });
        const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': prepared.contentType },
          body: prepared.blob
        });

        if (!res.ok) {
          addToast(t('workspace.asset_upload_failed', { name: file.name }), 'error');
          continue;
        }

        const uploaded = await res.json();
        setSelectedAsset(uploaded);
      }

      await fetchAssets();
      addToast(t('workspace.assets_uploaded'), 'success');
    } catch {
      addToast(t('workspace.asset_unsupported'), 'error');
    } finally {
      setAssetUploading(false);
    }
  };

  const openAssetUpload = (targetPath = selectedAssetFolderPath) => {
    assetUploadTargetPathRef.current = targetPath;
    assetFileInputRef.current?.click();
  };

  const commitPageTitleRename = async () => {
    if (!selectedContainer) return;
    if (skipTitleRenameRef.current) {
      skipTitleRenameRef.current = false;
      return;
    }
    const nextName = pageTitleEdit.value.trim();
    setPageTitleEdit({ isEditing: false, value: selectedContainer.name });

    if (!nextName || nextName === selectedContainer.name) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, newName: nextName })
      });
      if (res.ok) {
        setSelectedContainer(prev => prev ? { ...prev, name: nextName, metadata: { ...prev.metadata, name: nextName } } : prev);
        await fetchTree();
        addToast(t('common.renamed'), 'success');
      } else {
        addToast(t('common.error'), 'error');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleCoverUpload = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = '';
    if (!file || isVisitor || !selectedContainer) return;

    setCoverUploading(true);
    try {
      const prepared = await prepareAssetUpload(file);
      if (!prepared.contentType.startsWith('image/')) {
        addToast(t('workspace.asset_unsupported'), 'error');
        return;
      }

      const query = new URLSearchParams({
        path: '',
        filename: prepared.filename
      });
      const uploadRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': prepared.contentType },
        body: prepared.blob
      });

      if (!uploadRes.ok) {
        addToast(t('workspace.asset_upload_failed', { name: file.name }), 'error');
        return;
      }

      const uploaded = await uploadRes.json();
      const metadataRes = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, metadata: { coverAssetPath: uploaded.path, coverPositionY: 50 } })
      });

      if (!metadataRes.ok) {
        addToast(t('common.error'), 'error');
        return;
      }

      setSelectedContainer(prev => prev ? { ...prev, metadata: { ...prev.metadata, coverAssetPath: uploaded.path, coverPositionY: 50 } } : prev);
      await fetchTree();
      await fetchAssets();
      addToast(t('common.saved'), 'success');
    } catch {
      addToast(t('workspace.asset_unsupported'), 'error');
    } finally {
      setCoverUploading(false);
    }
  };

  const updateSelectedContainerMetadata = (metadata) => {
    setSelectedContainer(prev => prev ? { ...prev, metadata: { ...prev.metadata, ...metadata } } : prev);
  };

  const saveSelectedContainerMetadata = async (metadata) => {
    if (!selectedContainer) return false;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedContainer.path, metadata })
      });
      if (!res.ok) {
        addToast(t('common.error'), 'error');
        return false;
      }
      await fetchTree();
      return true;
    } catch {
      addToast(t('common.error'), 'error');
      return false;
    }
  };

  const toggleDocumentLock = async () => {
    if (isVisitor || !selectedContainer) return;

    const previousMode = viewMode;
    const nextIsLocked = viewMode === 'edit';
    const nextMode = nextIsLocked ? 'view' : 'edit';
    setViewMode(nextMode);
    updateSelectedContainerMetadata({ isLocked: nextIsLocked });

    const saved = await saveSelectedContainerMetadata({ isLocked: nextIsLocked });
    if (!saved) {
      setViewMode(previousMode);
      updateSelectedContainerMetadata({ isLocked: previousMode !== 'edit' });
    }
  };

  const shareWorld = async () => {
    const shareUrl = new URL(`/world/${encodeURIComponent(worldId)}`, window.location.origin);
    shareUrl.searchParams.set('view', 'true');
    if (selectedContainer?.path) {
      shareUrl.searchParams.set('document', selectedContainer.path);
    }
    if (activeTab?.path) {
      shareUrl.searchParams.set('tab', activeTab.path);
    }
    setWorldActionsMenu(false);

    try {
      await copyTextToClipboard(shareUrl.toString());
      addToast(t('workspace.share_world_copied'), 'success');
    } catch {
      addToast(t('workspace.share_world_failed'), 'error');
    }
  };

  const removeCover = async () => {
    if (isVisitor || !selectedContainer || !activeCoverPath) return;
    updateSelectedContainerMetadata({ coverAssetPath: null, coverPositionY: 50 });
    setIsRepositioningCover(false);
    const saved = await saveSelectedContainerMetadata({ coverAssetPath: null, coverPositionY: 50 });
    if (saved) addToast(t('common.saved'), 'success');
  };

  const handleCoverPointerDown = (event) => {
    if (!isRepositioningCover || !selectedContainer || !activeCoverPath) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = 'none';
    coverDragRef.current = {
      isDragging: true,
      startY: event.clientY,
      startPosition: Number(selectedContainer.metadata?.coverPositionY ?? 50),
      currentPosition: Number(selectedContainer.metadata?.coverPositionY ?? 50),
      frame: null
    };
  };

  const handleCoverPointerMove = (event) => {
    if (!coverDragRef.current.isDragging) return;
    const coverElement = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    const delta = ((coverDragRef.current.startY - event.clientY) / Math.max(rect.height, 1)) * 100;
    const nextPosition = Math.min(100, Math.max(0, coverDragRef.current.startPosition + delta));
    coverDragRef.current.currentPosition = nextPosition;

    if (coverDragRef.current.frame) return;
    coverDragRef.current.frame = window.requestAnimationFrame(() => {
      coverElement.style.setProperty('--editor-cover-position-y', `${coverDragRef.current.currentPosition}%`);
      coverDragRef.current.frame = null;
    });
  };

  const handleCoverPointerUp = async (event) => {
    if (!coverDragRef.current.isDragging) return;
    if (coverDragRef.current.frame) {
      window.cancelAnimationFrame(coverDragRef.current.frame);
      coverDragRef.current.frame = null;
    }
    coverDragRef.current.isDragging = false;
    document.body.style.userSelect = '';
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const finalPosition = Math.round(coverDragRef.current.currentPosition);
    event.currentTarget.style.setProperty('--editor-cover-position-y', `${finalPosition}%`);
    updateSelectedContainerMetadata({ coverPositionY: finalPosition });
    await saveSelectedContainerMetadata({ coverPositionY: finalPosition });
  };

  const handleTreeBlankContextMenu = (event) => {
    if (isVisitor) return;
    event.preventDefault();
    setContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node: null });
  };

  const handleAssetsBlankContextMenu = (event) => {
    if (isVisitor) return;
    event.preventDefault();
    event.stopPropagation();
    setAssetContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node: null });
  };

  const sidebarTabs = [
    { id: 'wiki', label: t('workspace.sidebar_tab_wiki'), icon: Book },
    { id: 'assets', label: t('workspace.sidebar_tab_assets'), icon: Image },
    { id: 'templates', label: t('workspace.sidebar_tab_templates'), icon: FileText }
  ].filter(tab => !isVisitor || tab.id === 'wiki');
  const selectedTabs = getTabsForNode(selectedContainer);
  const ActiveDisplayIcon = ICON_MAP[selectedContainer?.icon] || Folder;
  const activeCoverPath = selectedContainer?.metadata?.coverAssetPath;
  const coverPositionY = Number(selectedContainer?.metadata?.coverPositionY ?? 50);
  const coverActionLabel = activeCoverPath ? t('workspace.change_cover') : t('workspace.add_cover');
  const isAdmin = Boolean(currentUser?.isAdmin);
  const isDocumentUnlocked = !isVisitor && viewMode === 'edit';
  const memberUserIds = new Set(membersPanel.members.map(member => member.userId));
  const availableUsers = membersPanel.users.filter(user => !user.disabled && !memberUserIds.has(user.id));
  const saveStatusLabel = saveStatus === 'saving'
    ? t('workspace.save_status_saving')
    : saveStatus === 'error'
      ? t('workspace.save_status_error')
      : isDirty
        ? t('workspace.save_status_pending')
        : t('workspace.save_status_saved');

  return (
    <div className="workspace-container" style={{ flexDirection: 'row' }}>
      <aside className="workspace-sidebar sidebar-nexus">
        <div className="sidebar-header sidebar-nexus-header">
          <div className="sidebar-nexus-glow" aria-hidden="true" />
          <div className="sidebar-topline">
            <h1 className="sidebar-world-title">{worldData?.displayName || worldId}</h1>
            {!isVisitor && (
              <button className="sidebar-icon-button" onClick={() => setLocation('/')} title={t('common.back')}>
                <ArrowLeft size={18} />
              </button>
            )}
            {isAdmin && (
              <button className="sidebar-icon-button" onClick={openMembersPanel} title={t('workspace.manage_members')}>
                <Users size={18} />
              </button>
            )}
          </div>
        </div>

        {!isVisitor && (
          <div className="sidebar-nexus-tabs" role="tablist" aria-label={t('workspace.sidebar_tabs_label')}>
            {sidebarTabs.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeSidebarTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`sidebar-nexus-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                >
                  <TabIcon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {activeSidebarTab === 'wiki' ? (
          <>
            <nav
              className={`sidebar-tree sidebar-nexus-tree ${tree.length === 0 ? 'is-empty' : ''}`}
              onContextMenu={handleTreeBlankContextMenu}
            >
              {tree.length === 0 ? (
                <div className="sidebar-empty-state">
                  <div className="sidebar-empty-icon">
                    <Castle size={30} />
                  </div>
                  <h2>{t('workspace.empty_sidebar_title')}</h2>
                  <p>{t('workspace.empty_sidebar_hint')}</p>
                  {!isVisitor && (
                    <button className="btn-primary sidebar-empty-cta" onClick={() => createDocumentInline()}>
                      <Plus size={16} /> {t('workspace.create_first_document')}
                    </button>
                  )}
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="sidebar-empty-state compact">
                  <div className="sidebar-empty-icon">
                    <Search size={26} />
                  </div>
                  <h2>{t('workspace.no_search_results')}</h2>
                  <p>{t('workspace.no_search_results_hint')}</p>
                </div>
              ) : (
                <FileTree 
                  nodes={filteredTree} 
                  onFileSelect={selectContainer}
                  selectedFile={selectedContainer}
                  onCreateChild={createDocumentInline}
                  onIconSelect={handleIconSelect}
                  onContextMenu={(e, node) => setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, node })}
                  renamingPath={renamingPath}
                  onRename={handleRename}
                  onRequestRename={(node) => setRenamingPath(node.path)}
                  onDelete={handleDelete}
                  isSearching={!!searchQuery}
                  isVisitor={isVisitor}
                  worldData={worldData}
                />
              )}
            </nav>

            <div className="sidebar-search-dock">
              {tree.length > 0 && !isVisitor && (
                <div className="wiki-toolbar">
                  <button type="button" onClick={() => createDocumentInline()}>
                    <Plus size={14} />
                    <span>{t('workspace.create_root_document')}</span>
                  </button>
                </div>
              )}
              <div className="sidebar-search-bar">
                <Search size={15} />
                <input
                  placeholder={t('workspace.search_tree')}
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') setSearchQuery('');
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title={t('common.cancel')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : activeSidebarTab === 'assets' ? (
          <div className="sidebar-assets-panel">
            <div
              className="assets-tree-panel"
              onContextMenu={(event) => {
                handleAssetsBlankContextMenu(event);
              }}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedAssetFolderPath('');
                }
              }}
            >
              {assetLoading ? (
                <div className="sidebar-empty-state compact">
                  <div className="sidebar-empty-icon">
                    <Image size={26} />
                  </div>
                  <h2>{t('common.loading')}</h2>
                </div>
              ) : assetTree.length === 0 ? (
                <div className="sidebar-empty-state compact">
                  <div className="sidebar-empty-icon">
                    <Image size={26} />
                  </div>
                  <h2>{t('workspace.assets_empty_title')}</h2>
                  <p>{t('workspace.assets_empty_hint')}</p>
                </div>
              ) : filteredAssetTree.length === 0 ? (
                <div className="sidebar-empty-state compact">
                  <div className="sidebar-empty-icon">
                    <Search size={26} />
                  </div>
                  <h2>{t('workspace.no_search_results')}</h2>
                  <p>{t('workspace.no_search_results_hint')}</p>
                </div>
              ) : (
                <AssetTree
                  nodes={filteredAssetTree}
                  selectedAsset={selectedAsset}
                  selectedFolderPath={selectedAssetFolderPath}
                  onSelectAsset={setSelectedAsset}
                  onSelectFolder={setSelectedAssetFolderPath}
                  onCreateFolder={createAssetFolderInline}
                  onContextMenu={(event, node) => setAssetContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node })}
                  renamingPath={assetRenamingPath}
                  onRename={handleAssetRename}
                  onRequestRename={(node) => setAssetRenamingPath(node.path)}
                  onDelete={handleAssetDelete}
                  isVisitor={isVisitor}
                />
              )}
            </div>

            {selectedAsset && (
              <div className="asset-preview-panel">
                <div className="asset-preview-header">
                  <strong>{selectedAsset.name}</strong>
                  <span>{formatAssetSize(selectedAsset.size)}</span>
                </div>
                {selectedAsset.mediaType === 'audio' ? (
                  <audio controls src={getAssetUrl(selectedAsset.path)} />
                ) : (
                  <img src={getAssetUrl(selectedAsset.path)} alt={selectedAsset.name} />
                )}
              </div>
            )}

            <div className="assets-bottom-dock">
              {!isVisitor && (
                <div className="assets-toolbar">
                  <input
                    ref={assetFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.gif,audio/*"
                    onChange={handleAssetUpload}
                    hidden
                  />
                  <button type="button" onClick={() => openAssetUpload()} disabled={assetUploading}>
                    <Upload size={14} />
                    <span>{assetUploading ? t('common.uploading') : t('workspace.assets_upload')}</span>
                  </button>
                  <button type="button" onClick={() => createAssetFolderInline()}>
                    <FolderPlus size={14} />
                    <span>{t('workspace.assets_new_folder')}</span>
                  </button>
                </div>
              )}

              <div className="sidebar-search-bar">
                <Search size={15} />
                <input
                  placeholder={t('workspace.assets_search')}
                  value={assetSearchQuery}
                  onChange={event => setAssetSearchQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') setAssetSearchQuery('');
                  }}
                />
                {assetSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAssetSearchQuery('')}
                    title={t('common.cancel')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="sidebar-panel-placeholder">
            <div className="sidebar-empty-state compact">
              <div className="sidebar-empty-icon">
                <FileText size={28} />
              </div>
              <h2>{t('workspace.templates_empty_title')}</h2>
              <p>{t('workspace.templates_empty_hint')}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Área Principal */}
      <main className="workspace-main workspace-editor-main">
        {selectedContainer ? (
          <div className="document-workspace editor-page-shell">
            <div className="document-content editor-page-scroll">
              <article className="editor-page">
                <div
                  className={`editor-page-cover ${activeCoverPath ? 'has-image' : ''} ${isRepositioningCover ? 'is-repositioning' : ''}`}
                  style={activeCoverPath ? {
                    '--editor-cover-image': `url("${getAssetUrl(activeCoverPath)}")`,
                    '--editor-cover-position-y': `${coverPositionY}%`
                  } : undefined}
                  onPointerDown={handleCoverPointerDown}
                  onPointerMove={handleCoverPointerMove}
                  onPointerUp={handleCoverPointerUp}
                  onPointerCancel={handleCoverPointerUp}
                >
                  <div className="editor-page-cover-shade" aria-hidden="true" />
                  {!isVisitor && (
                    <div className="editor-cover-controls">
                      {activeTab && (
                        <span className={`editor-save-status ${saveStatus}`}>
                          {saveStatusLabel}
                        </span>
                      )}
                      <button
                        type="button"
                        className={`editor-lock-toggle ${isDocumentUnlocked ? 'unlocked' : ''}`}
                        onClick={toggleDocumentLock}
                        disabled={!selectedContainer}
                        title={isDocumentUnlocked ? t('workspace.lock_document') : t('workspace.unlock_document')}
                      >
                        {isDocumentUnlocked ? <Unlock size={16} /> : <Lock size={16} />}
                      </button>
                      <div className="editor-world-actions" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className={`editor-more-toggle ${worldActionsMenu ? 'active' : ''}`}
                          onClick={() => setWorldActionsMenu(prev => !prev)}
                          disabled={!selectedContainer}
                          title={t('workspace.world_actions')}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {worldActionsMenu && (
                          <div className="editor-world-actions-menu glass-panel">
                            <button type="button" onClick={shareWorld}>
                              <Share2 size={14} />
                              <span>{t('workspace.share_world')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!isVisitor && selectedContainer && (
                    <>
                      <input
                        ref={coverFileInputRef}
                        type="file"
                        accept="image/*,.gif"
                        onChange={handleCoverUpload}
                        hidden
                      />
                      <div className="editor-cover-toolbar">
                        <button
                          type="button"
                          className="editor-cover-action"
                          onPointerDown={event => event.stopPropagation()}
                          onClick={() => coverFileInputRef.current?.click()}
                          disabled={coverUploading}
                          title={coverActionLabel}
                        >
                          <Image size={15} />
                          <span>{coverUploading ? t('common.uploading') : coverActionLabel}</span>
                        </button>
                        {activeCoverPath && (
                          <>
                            <button
                              type="button"
                              className={`editor-cover-action icon-only ${isRepositioningCover ? 'active' : ''}`}
                              onPointerDown={event => event.stopPropagation()}
                              onClick={() => setIsRepositioningCover(prev => !prev)}
                              title={t('workspace.reposition_cover')}
                            >
                              <MoveVertical size={15} />
                            </button>
                            <button
                              type="button"
                              className="editor-cover-action icon-only danger"
                              onPointerDown={event => event.stopPropagation()}
                              onClick={removeCover}
                              title={t('workspace.remove_cover')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <header className="editor-page-header">
                  <div className="editor-page-title-row">
                    <button
                      type="button"
                      className={`editor-page-icon ${selectedContainer && !isVisitor ? 'is-editable' : ''}`}
                      onClick={openTabIconPicker}
                      disabled={!selectedContainer || isVisitor}
                      title={selectedContainer && !isVisitor ? t('workspace.change_icon') : undefined}
                    >
                      <ActiveDisplayIcon size={34} />
                    </button>
                    <div className="editor-title-copy">
                      {pageTitleEdit.isEditing ? (
                        <input
                          className="editor-title-input"
                          value={pageTitleEdit.value}
                          onChange={event => setPageTitleEdit(prev => ({ ...prev, value: event.target.value }))}
                          onBlur={commitPageTitleRename}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                            if (event.key === 'Escape') {
                              skipTitleRenameRef.current = true;
                              setPageTitleEdit({ isEditing: false, value: selectedContainer.name });
                            }
                          }}
                          autoFocus
                          onFocus={event => event.target.select()}
                        />
                      ) : (
                        <h1
                          onDoubleClick={() => {
                            if (!isVisitor) setPageTitleEdit({ isEditing: true, value: selectedContainer.name });
                          }}
                          title={!isVisitor ? t('workspace.rename_title_hint') : undefined}
                        >
                          {selectedContainer.name || t('workspace.select_document')}
                        </h1>
                      )}
                    </div>
                  </div>

                  <div className="editor-tab-row">
                    {selectedTabs.map(tab => (
                      renamingTab.path === tab.path ? (
                        <input
                          key={tab.uid}
                          className="editor-tab-rename-input"
                          value={renamingTab.value}
                          onChange={event => setRenamingTab(prev => ({ ...prev, value: event.target.value }))}
                          onBlur={() => commitTabRename(tab)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                            if (event.key === 'Escape') {
                              setRenamingTab({ path: '', value: '' });
                            }
                          }}
                          autoFocus
                          onFocus={event => event.target.select()}
                        />
                      ) : (
                        <button
                          key={tab.uid}
                          type="button"
                          className={`editor-tab-pill ${activeTab?.uid === tab.uid ? 'active' : ''}`}
                          onClick={() => selectTab(tab)}
                          onContextMenu={event => {
                            if (isVisitor) return;
                            event.preventDefault();
                            event.stopPropagation();
                            setTabContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node: tab });
                          }}
                        >
                          {React.createElement(ICON_MAP[tab.icon] || (tab.contentType === 'map' ? Map : FileText), { size: 14 })}
                          <span>{tab.name}</span>
                        </button>
                      )
                    ))}
                    {!isVisitor && (
                      <button
                        type="button"
                        className="editor-tab-add"
                        onClick={openTabCreationPanel}
                        title={t('workspace.create_tab')}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </header>

                <section className="editor-page-body">
                  {tabCreationPanel.isOpen ? (
                    <div className="tab-creation-panel">
                      <div className="tab-creation-header">
                        <div className="tab-creation-icon">
                          <Plus size={20} />
                        </div>
                        <div>
                          <h2>{t('workspace.create_tab')}</h2>
                          <p>{t('workspace.create_tab_inline_hint')}</p>
                        </div>
                      </div>

                      <label className="tab-creation-label" htmlFor="tab-name-input">
                        {t('common.name')}
                      </label>
                      <input
                        id="tab-name-input"
                        className="tab-creation-input"
                        value={tabCreationPanel.name}
                        onChange={event => setTabCreationPanel(prev => ({ ...prev, name: event.target.value }))}
                        onKeyDown={event => {
                          if (event.key === 'Enter') handleCreateTabInline();
                          if (event.key === 'Escape') setTabCreationPanel({ isOpen: false, name: '', contentType: 'wiki' });
                        }}
                        placeholder={t('workspace.new_tab_name')}
                        autoFocus
                        onFocus={event => event.target.select()}
                      />

                      <div className="tab-type-grid">
                        <button
                          type="button"
                          className={`tab-type-card ${tabCreationPanel.contentType === 'wiki' ? 'active' : ''}`}
                          onClick={() => setTabCreationPanel(prev => ({ ...prev, contentType: 'wiki' }))}
                        >
                          <FileText size={22} />
                          <strong>Wiki</strong>
                          <span>{t('workspace.tab_type_wiki_hint')}</span>
                        </button>
                        <button
                          type="button"
                          className={`tab-type-card ${tabCreationPanel.contentType === 'map' ? 'active' : ''}`}
                          onClick={() => setTabCreationPanel(prev => ({ ...prev, contentType: 'map' }))}
                        >
                          <Map size={22} />
                          <strong>{t('workspace.tab_type_map')}</strong>
                          <span>{t('workspace.tab_type_map_hint')}</span>
                        </button>
                      </div>

                      <div className="tab-creation-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setTabCreationPanel({ isOpen: false, name: '', contentType: 'wiki' })}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleCreateTabInline}
                          disabled={!tabCreationPanel.name.trim()}
                        >
                          {t('common.create')}
                        </button>
                      </div>
                    </div>
                  ) : activeTab ? (
                    activeTab.contentType === 'map' ? (
                      <div className="editor-placeholder">
                        <Map size={76} />
                        <h2>Módulo de Mapas</h2>
                        <p>O visualizador de mapas interativos será implementado na próxima fase.</p>
                      </div>
                    ) : (
                      <WikiBlockEditor
                        key={activeTab.path}
                        contentKey={activeTab.path}
                        content={fileContent}
                        editable={isDocumentUnlocked && !isVisitor}
                        worldId={worldId}
                        assetImages={assetImages}
                        getAssetUrl={getAssetUrl}
                        onRequestAssets={fetchAssets}
                        labels={{
                          insertImage: t('workspace.insert_image'),
                          noAssetImages: t('workspace.no_asset_images')
                        }}
                        onChange={handleWikiContentChange}
                      />
                    )
                  ) : (
                    <div className="editor-placeholder muted">
                      <Book size={48} />
                      <p>Esta página não possui abas de conteúdo.</p>
                      {!isVisitor && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={openTabCreationPanel}
                        >
                          {t('workspace.create_first_tab')}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              </article>
            </div>
          </div>
        ) : (
          <div className="empty-state editor-empty-state">
            <Castle size={80} />
            <h2>{t('workspace.select_document')}</h2>
            <p>{t('workspace.select_document_hint')}</p>
          </div>
        )}
      </main>

      {/* Modals & Overlays */}
      {tabIconPicker.isOpen && (
        <>
          <div className="icon-picker-backdrop" onClick={() => setTabIconPicker({ isOpen: false, top: 0, left: 0 })} />
          <div
            className="icon-selector-dropdown glass-panel"
            style={{ top: tabIconPicker.top, left: tabIconPicker.left }}
            onClick={event => event.stopPropagation()}
          >
            {Object.keys(ICON_MAP).map(key => (
              <button
                key={key}
                type="button"
                className={`icon-option ${selectedContainer?.icon === key ? 'active' : ''}`}
                onClick={() => handleTabIconSelect(key)}
                title={key}
              >
                {React.createElement(ICON_MAP[key], { size: 18 })}
              </button>
            ))}
          </div>
        </>
      )}

      {prompt.isOpen && (
        <div className="modal-overlay" onClick={() => setPrompt({ ...prompt, isOpen: false })}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h3>{prompt.type === 'tab' ? t('workspace.create_tab') : t('workspace.create_document')}</h3>
            
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: 8, display: 'block' }}>{t('common.name')}</label>
              <input 
                autoFocus 
                placeholder={t('common.name_placeholder')}
                value={prompt.name}
                onChange={e => setPrompt({ ...prompt, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleCreateNode()}
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'white' }}
              />
            </div>

            {prompt.type === 'tab' && (
              <div className="input-group" style={{ marginBottom: 24 }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: 8, display: 'block' }}>Tipo de Conteúdo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => setPrompt({ ...prompt, contentType: 'wiki' })}
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: 8, 
                      padding: '12px', 
                      background: prompt.contentType === 'wiki' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', 
                      border: 'none', 
                      borderRadius: 8, 
                      color: 'white', 
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <FileText size={20} />
                    <span style={{ fontSize: '0.75rem' }}>Wiki</span>
                  </button>
                  <button 
                    onClick={() => setPrompt({ ...prompt, contentType: 'map' })}
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: 8, 
                      padding: '12px', 
                      background: prompt.contentType === 'map' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', 
                      border: 'none', 
                      borderRadius: 8, 
                      color: 'white', 
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Map size={20} />
                    <span style={{ fontSize: '0.75rem' }}>Mapa</span>
                  </button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setPrompt({ ...prompt, isOpen: false })}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleCreateNode}>{t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {duplicatePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setDuplicatePrompt({ isOpen: false, node: null })}>
          <div className="modal-content glass-panel duplicate-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setDuplicatePrompt({ isOpen: false, node: null })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <Copy size={20} />
              </div>
              <div>
                <h3>{t('workspace.duplicate_document')}</h3>
                <p>{t('workspace.duplicate_document_hint', { name: duplicatePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="duplicate-scope-grid">
              <button type="button" onClick={() => handleDuplicate(false)}>
                <FileText size={18} />
                <span>{t('workspace.duplicate_single')}</span>
              </button>
              <button type="button" onClick={() => handleDuplicate(true)}>
                <Folder size={18} />
                <span>{t('workspace.duplicate_with_children')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deletePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setDeletePrompt({ isOpen: false, node: null })}>
          <div className="modal-content glass-panel duplicate-modal delete-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setDeletePrompt({ isOpen: false, node: null })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon delete-modal-icon">
                <Trash2 size={20} />
              </div>
              <div>
                <h3>{t('workspace.delete_document')}</h3>
                <p>{t('workspace.delete_document_hint', { name: deletePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="delete-modal-actions">
              <button type="button" className="delete-confirm-button" onClick={confirmDelete}>
                <Trash2 size={16} />
                <span>{t('workspace.delete_document_confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {assetDuplicatePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setAssetDuplicatePrompt({ isOpen: false, node: null })}>
          <div className="modal-content glass-panel duplicate-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setAssetDuplicatePrompt({ isOpen: false, node: null })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <Copy size={20} />
              </div>
              <div>
                <h3>{t('workspace.duplicate_asset')}</h3>
                <p>{t('workspace.duplicate_asset_hint', { name: assetDuplicatePrompt.node?.name })}</p>
              </div>
            </div>

            {assetDuplicatePrompt.node?.type === 'folder' ? (
              <div className="duplicate-scope-grid">
                <button type="button" onClick={() => handleAssetDuplicate(false)}>
                  <Folder size={18} />
                  <span>{t('workspace.duplicate_asset_single')}</span>
                </button>
                <button type="button" onClick={() => handleAssetDuplicate(true)}>
                  <FolderPlus size={18} />
                  <span>{t('workspace.duplicate_asset_with_children')}</span>
                </button>
              </div>
            ) : (
              <div className="delete-modal-actions">
                <button type="button" className="asset-folder-create-button" onClick={() => handleAssetDuplicate(false)}>
                  <Copy size={16} />
                  <span>{t('workspace.duplicate_asset_single')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {assetDeletePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setAssetDeletePrompt({ isOpen: false, node: null })}>
          <div className="modal-content glass-panel duplicate-modal delete-modal" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setAssetDeletePrompt({ isOpen: false, node: null })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon delete-modal-icon">
                <Trash2 size={20} />
              </div>
              <div>
                <h3>{t('workspace.delete_asset')}</h3>
                <p>{t('workspace.delete_asset_hint', { name: assetDeletePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="delete-modal-actions">
              <button type="button" className="delete-confirm-button" onClick={confirmAssetDelete}>
                <Trash2 size={16} />
                <span>{t('workspace.delete_asset_confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {assetMovePrompt.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setAssetMovePrompt({ isOpen: false, node: null, targetPath: '' })}>
          <div className="modal-content glass-panel duplicate-modal" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setAssetMovePrompt({ isOpen: false, node: null, targetPath: '' })}
              title={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <MoveRight size={20} />
              </div>
              <div>
                <h3>{t('workspace.move_asset')}</h3>
                <p>{t('workspace.move_asset_hint', { name: assetMovePrompt.node?.name })}</p>
              </div>
            </div>

            <div className="asset-move-target-list">
              {assetMoveTargets.map(target => (
                <button
                  key={target.path || '__root__'}
                  type="button"
                  className={`asset-move-target ${assetMovePrompt.targetPath === target.path ? 'selected' : ''}`}
                  disabled={target.disabled}
                  onClick={() => setAssetMovePrompt(prev => ({ ...prev, targetPath: target.path }))}
                  style={{ paddingLeft: 12 + target.depth * 16 }}
                >
                  <Folder size={15} />
                  <span>{target.name}</span>
                </button>
              ))}
            </div>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="asset-folder-create-button"
                onClick={confirmAssetMove}
                disabled={assetMoveTargets.find(target => target.path === assetMovePrompt.targetPath)?.disabled}
              >
                <MoveRight size={16} />
                <span>{t('workspace.move_asset_confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {membersPanel.isOpen && (
        <div className="duplicate-modal-overlay" onClick={() => setMembersPanel(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-content glass-panel duplicate-modal" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              className="duplicate-modal-close"
              onClick={() => setMembersPanel(prev => ({ ...prev, isOpen: false }))}
              aria-label={t('common.cancel')}
            >
              <X size={16} />
            </button>
            <div className="duplicate-modal-header">
              <div className="duplicate-modal-icon">
                <Users size={22} />
              </div>
              <div>
                <h3>{t('workspace.world_members')}</h3>
                <p>{t('workspace.world_members_hint')}</p>
              </div>
            </div>

            <div className="members-panel-section">
              <div className="context-menu-section-label">{t('workspace.current_members')}</div>
              {membersPanel.members.length === 0 ? (
                <span className="context-menu-empty">{t('workspace.no_members')}</span>
              ) : (
                <div className="members-list">
                  {membersPanel.members.map(member => (
                    <div key={member.userId} className="member-row">
                      <span>{member.user?.username || member.userId}</span>
                      <button type="button" className="node-action-btn danger" onClick={() => removeMember(member.userId)} disabled={membersPanel.loading}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="members-panel-section">
              <div className="context-menu-section-label">{t('workspace.add_existing_member')}</div>
              <div className="member-form-row">
                <select
                  value={membersPanel.userId}
                  onChange={event => setMembersPanel(prev => ({ ...prev, userId: event.target.value }))}
                  disabled={membersPanel.loading || availableUsers.length === 0}
                >
                  <option value="">{t('workspace.select_user')}</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                  ))}
                </select>
                <button type="button" className="btn-secondary" onClick={addExistingMember} disabled={membersPanel.loading || !membersPanel.userId}>
                  {t('common.add')}
                </button>
              </div>
            </div>

            <div className="members-panel-section">
              <div className="context-menu-section-label">{t('workspace.create_member_user')}</div>
              <div className="member-form-stack">
                <input
                  type="text"
                  value={membersPanel.username}
                  onChange={event => setMembersPanel(prev => ({ ...prev, username: event.target.value }))}
                  placeholder={t('login.username_placeholder')}
                  disabled={membersPanel.loading}
                />
                <input
                  type="password"
                  value={membersPanel.password}
                  onChange={event => setMembersPanel(prev => ({ ...prev, password: event.target.value }))}
                  placeholder={t('login.password_placeholder')}
                  disabled={membersPanel.loading}
                />
                <button type="button" className="btn-primary" onClick={createAndAddMember} disabled={membersPanel.loading || !membersPanel.username.trim() || !membersPanel.password}>
                  {t('workspace.create_and_add_member')}
                </button>
              </div>
            </div>

            {membersPanel.error && <div className="error-msg">{membersPanel.error}</div>}
          </div>
        </div>
      )}

      {contextMenu.isOpen && (
        <div className="context-menu-overlay" onClick={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}>
          <div 
            className="context-menu glass-panel"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            {contextMenu.node ? (
              <>
                <button onClick={() => { createDocumentInline(contextMenu.node.path); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <Plus size={14} /> {t('workspace.create_document')}
                </button>
                {isAdmin && isRootContainer(contextMenu.node) && worldData?.homePage !== contextMenu.node.path && (
                  <button onClick={() => { updateHomePage(contextMenu.node); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                    <Home size={14} /> {t('workspace.set_home_page')}
                  </button>
                )}
                {isAdmin && isRootContainer(contextMenu.node) && worldData?.homePage === contextMenu.node.path && (
                  <button onClick={() => { updateHomePage(null); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                    <Home size={14} /> {t('workspace.unset_home_page')}
                  </button>
                )}
                <button onClick={() => { openDuplicatePrompt(contextMenu.node); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <Copy size={14} /> {t('workspace.duplicate_document')}
                </button>
                <button onClick={() => { setRenamingPath(contextMenu.node.path); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <Edit2 size={14} /> {t('common.rename')}
                </button>
                <button className="danger" onClick={() => { handleDelete(contextMenu.node); setContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <Trash2 size={14} /> {t('common.delete')}
                </button>
              </>
            ) : (
              <button onClick={() => { setContextMenu(prev => ({ ...prev, isOpen: false })); createDocumentInline(); }}>
                <Plus size={14} /> {t('workspace.create_root_document')}
              </button>
            )}
          </div>
        </div>
      )}

      {tabContextMenu.isOpen && (
        <div className="context-menu-overlay" onClick={() => setTabContextMenu(prev => ({ ...prev, isOpen: false }))}>
          <div
            className="context-menu glass-panel"
            style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => {
                setRenamingTab({ path: tabContextMenu.node.path, value: tabContextMenu.node.name });
                setTabContextMenu(prev => ({ ...prev, isOpen: false }));
              }}
            >
              <Edit2 size={14} /> {t('common.rename')}
            </button>
            <button
              onClick={() => {
                duplicateTab(tabContextMenu.node);
                setTabContextMenu(prev => ({ ...prev, isOpen: false }));
              }}
            >
              <Copy size={14} /> {t('workspace.duplicate_tab')}
            </button>
            <button
              className="danger"
              onClick={() => {
                handleDelete(tabContextMenu.node);
                setTabContextMenu(prev => ({ ...prev, isOpen: false }));
              }}
            >
              <Trash2 size={14} /> {t('workspace.delete_tab')}
            </button>
          </div>
        </div>
      )}

      {assetContextMenu.isOpen && (
        <div className="context-menu-overlay" onClick={() => setAssetContextMenu(prev => ({ ...prev, isOpen: false }))}>
          <div
            className="context-menu glass-panel"
            style={{ top: assetContextMenu.y, left: assetContextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            {assetContextMenu.node ? (
              <>
                {assetContextMenu.node.type === 'folder' && (
                  <>
                    <button onClick={() => { openAssetUpload(assetContextMenu.node.path); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                      <Upload size={14} /> {t('workspace.assets_upload_here')}
                    </button>
                    <button onClick={() => { createAssetFolderInline(assetContextMenu.node.path); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                      <Plus size={14} /> {t('workspace.assets_new_folder')}
                    </button>
                  </>
                )}
                <button onClick={() => { setAssetDuplicatePrompt({ isOpen: true, node: assetContextMenu.node }); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <Copy size={14} /> {t('workspace.duplicate_asset')}
                </button>
                <button onClick={() => { openAssetMovePrompt(assetContextMenu.node); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <MoveRight size={14} /> {t('workspace.move_asset')}
                </button>
                <button onClick={() => { setAssetRenamingPath(assetContextMenu.node.path); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <Edit2 size={14} /> {t('common.rename')}
                </button>
                <button className="danger" onClick={() => { handleAssetDelete(assetContextMenu.node); setAssetContextMenu(prev => ({ ...prev, isOpen: false })); }}>
                  <Trash2 size={14} /> {t('common.delete')}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setAssetContextMenu(prev => ({ ...prev, isOpen: false })); openAssetUpload(''); }}>
                  <Upload size={14} /> {t('workspace.assets_upload_here')}
                </button>
                <button onClick={() => { setAssetContextMenu(prev => ({ ...prev, isOpen: false })); createAssetFolderInline(''); }}>
                  <Plus size={14} /> {t('workspace.assets_new_folder')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type} glass-panel`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

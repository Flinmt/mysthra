import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, FolderPlus, FilePlus, Save, Eye, Edit2, Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Sword, Shield, Castle, Map, Crown, Book, Star, Skull, Tag, Trash2, Search, Image, Music, Copy, ExternalLink, Layers, Package } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ICON_MAP = {
  FileText, Sword, Shield, Castle, Map, Crown, Book, Star, Skull
};

function FileTree({ nodes, onFileSelect, selectedFile, openPrompt, onIconSelect, onContextMenu, renamingPath, onRename, isSearching }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.map(node => (
        <FileTreeNode key={node.path} node={node} onFileSelect={onFileSelect} selectedFile={selectedFile} openPrompt={openPrompt} onIconSelect={onIconSelect} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} isSearching={isSearching} />
      ))}
    </ul>
  );
}

function FileTreeNode({ node, onFileSelect, selectedFile, openPrompt, onIconSelect, onContextMenu, renamingPath, onRename, isSearching }) {
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

  return (
    <li className="tree-document">
      <div 
        className={`tree-node ${isSelected ? 'selected' : ''}`}
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
          <button
            className="node-action-btn"
            onClick={(e) => { e.stopPropagation(); openPrompt(node.path); setIsOpen(true); }}
            title="Criar"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      {showChildren && node.children && <FileTree nodes={node.children} onFileSelect={onFileSelect} selectedFile={selectedFile} openPrompt={openPrompt} onIconSelect={onIconSelect} onContextMenu={onContextMenu} renamingPath={renamingPath} onRename={onRename} isSearching={isSearching} />}
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
  const [worldData, setWorldData] = useState(null);
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'view'
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, node: null, isAsset: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [sidebarTab, setSidebarTab] = useState('project'); // 'project' or 'assets'
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [renamingPath, setRenamingPath] = useState(null);
  const [renamingMediaPath, setRenamingMediaPath] = useState(null);
  const [uploadingProgress, setUploadingProgress] = useState(null);

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

  useEffect(() => {
    if (sidebarTab === 'assets') {
      loadMedia();
    }
  }, [sidebarTab, worldId]);

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
      : `![${item.name}](${item.url})`;
    navigator.clipboard.writeText(code);
    alert('Código copiado para a área de transferência!');
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
    if (selectedFile) {
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
        if (res.ok) {
          loadMedia();
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
      }
      
      setDeleteModal({ isOpen: false, node: null, isAsset: false });
    } catch (e) {
      console.error(e);
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
      
      if (!res.ok) throw new Error('Erro ao renomear');
      
      const result = await res.json();
      
      if (selectedFile && selectedFile.path.startsWith(node.path)) {
        const relative = selectedFile.path.slice(node.path.length);
        setSelectedFile({ ...selectedFile, path: result.newPath + relative });
      }
      
      setRenamingPath(null);
      loadTree();
    } catch (e) {
      console.error(e);
      setRenamingPath(null);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path, content: fileContent })
      });
      setSaving(false);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const handleUpload = async (file, targetFolder = '', insertInEditor = true) => {
    if (!file) return;
    
    if (file.size > 20 * 1024 * 1024) {
      alert('O arquivo é muito grande. Limite: 20MB');
      return;
    }

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
              : `![${data.filename}](${data.url})`;
            
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

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    
    const container = editor.getDomNode();
    if (!container) return;

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      
      // Internal Asset
      const assetData = e.dataTransfer.getData('assetNode');
      if (assetData) {
        const node = JSON.parse(assetData);
        if (node.type !== 'folder') {
          const code = node.type === 'audio' 
            ? `<audio controls src="${node.url}" style="width:100%; margin: 10px 0;"></audio>` 
            : `![${node.name}](${node.url})`;
          
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

  const breadcrumbs = useMemo(() => {
    if (!selectedFile) return [];
    const segments = selectedFile.path.split('/');
    return segments.map((seg, i) => ({
      name: seg,
      path: segments.slice(0, i + 1).join('/')
    }));
  }, [selectedFile]);

  const handleContextMenu = (e, node, isAsset = false) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      node,
      isAsset
    });
  };

  return (
    <div className="workspace-container">
      {/* Top Bar */}
      <header className="workspace-header">
        <div className="header-left">
          <button className="icon-btn" onClick={() => setLocation('/')}>
            <ArrowLeft size={18} />
          </button>
          <h2>{worldData ? worldData.displayName : 'Carregando...'}</h2>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
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
          <button className="btn-primary" onClick={handleSave} disabled={saving || !selectedFile}>
            <Save size={16} style={{ marginRight: 8 }} /> {saving ? 'Salvando...' : 'Salvar'}
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
              className={`tab-btn ${sidebarTab === 'assets' ? 'active' : ''}`}
              onClick={() => setSidebarTab('assets')}
            >
              <Layers size={14} /> Assets
            </button>
          </div>

          {sidebarTab === 'project' ? (
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
                    onFileSelect={setSelectedFile} 
                    selectedFile={selectedFile} 
                    openPrompt={handleCreate} 
                    onIconSelect={handleIconSelect} 
                    onContextMenu={handleContextMenu}
                    renamingPath={renamingPath}
                    onRename={handleRenameSubmit}
                    isSearching={!!searchQuery}
                  />
                )}
              </div>

              <div className="sidebar-footer">
                <button className="btn-secondary sidebar-action-btn" title="Criar Documento" onClick={() => handleCreate('')}>
                  <FilePlus size={16} /> <span className="btn-text">Criar</span>
                </button>
              </div>
            </>
          ) : (
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
                <button className="btn-secondary sidebar-action-btn" title="Nova Pasta" onClick={() => handleCreateMediaFolder('')}>
                  <FolderPlus size={16} /> <span className="btn-text">Pasta</span>
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Editor Area */}
        <section className="workspace-editor">
          {!selectedFile ? (
            <div className="empty-editor">
              <FolderOpen size={64} style={{ color: 'var(--border-color)', marginBottom: 16 }} />
              <h2>Selecione um arquivo</h2>
              <p>Crie ou abra um arquivo na barra lateral para começar a editar.</p>
            </div>
          ) : (
            <>
              {/* Breadcrumbs */}
              <div className="breadcrumbs-container">
                {breadcrumbs.map((bc, i) => (
                  <React.Fragment key={bc.path}>
                    <button 
                      className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? 'active' : ''}`}
                      onClick={() => setSelectedFile({ path: bc.path, name: bc.name })}
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
                <Editor
                  height="100%"
                  theme="vs-dark"
                  defaultLanguage="markdown"
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
              ) : (
                <div className="preview-container glass-panel">
                  <div
                    className="markdown-preview"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(marked(fileContent), {
                        ADD_TAGS: ['audio', 'source', 'video'],
                        ADD_ATTR: ['controls', 'src', 'style']
                      }) 
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
              <button className="btn-secondary" onClick={() => setDeleteModal({ isOpen: false, node: null, isAsset: false })}>Cancelar</button>
              <button className="btn-primary btn-danger" onClick={handleDeleteSubmit}>Deletar</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu.isOpen && (
        <div 
          className="context-menu glass-panel" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isAsset ? (
            <>
              {contextMenu.node.type === 'folder' && (
                <button className="context-menu-item" onClick={() => {
                  setContextMenu({ ...contextMenu, isOpen: false });
                  handleCreateMediaFolder(contextMenu.node.path);
                }}>
                  <FolderPlus size={14} /> Nova Pasta
                </button>
              )}
              {contextMenu.node.type !== 'folder' && (
                <button className="context-menu-item" onClick={() => {
                  setContextMenu({ ...contextMenu, isOpen: false });
                  copyMediaCode(contextMenu.node);
                }}>
                  <Copy size={14} /> Copiar Código
                </button>
              )}
              <button className="context-menu-item" onClick={() => {
                const node = contextMenu.node;
                setContextMenu({ ...contextMenu, isOpen: false });
                setRenamingMediaPath(node.path);
              }}>
                <Edit2 size={14} /> Renomear
              </button>
              <div className="context-menu-divider" />
              <button className="context-menu-item danger" onClick={() => {
                const node = contextMenu.node;
                setContextMenu({ ...contextMenu, isOpen: false });
                handleDeleteMediaNode(node);
              }}>
                <Trash2 size={14} /> Excluir
              </button>
            </>
          ) : (
            <>
              <button className="context-menu-item" onClick={() => {
                setContextMenu({ ...contextMenu, isOpen: false });
                handleCreate(contextMenu.node.path);
              }}>
                <Plus size={14} /> Criar
              </button>
              <button className="context-menu-item" onClick={() => {
                const node = contextMenu.node;
                setContextMenu({ ...contextMenu, isOpen: false });
                setRenamingPath(node.path);
              }}>
                <Edit2 size={14} /> Renomear
              </button>
              <div className="context-menu-divider" />
              <button className="context-menu-item danger" onClick={() => {
                const node = contextMenu.node;
                setContextMenu({ ...contextMenu, isOpen: false });
                setDeleteModal({ isOpen: true, node, isAsset: false });
              }}>
                <Trash2 size={14} /> Excluir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

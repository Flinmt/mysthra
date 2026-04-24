import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, FolderPlus, FilePlus, Save, Eye, Edit2, Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Sword, Shield, Castle, Map, Crown, Book, Star, Skull, Tag, Trash2, Search } from 'lucide-react';
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


export default function WorldWorkspace({ params }) {
  const worldId = params.id;
  const [, setLocation] = useLocation();
  const [worldData, setWorldData] = useState(null);
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'view'
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, node: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [renamingPath, setRenamingPath] = useState(null);

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
      
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(deleteModal.node.path)}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        throw new Error('Erro ao deletar documento');
      }
      
      if (selectedFile && selectedFile.path.startsWith(deleteModal.node.path)) {
        setSelectedFile(null);
        setViewMode('edit');
      }
      
      setDeleteModal({ isOpen: false, node: null });
      loadTree();
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
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const sidebarStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(to bottom, rgba(15, 17, 21, 0.75), rgba(15, 17, 21, 0.98)), url(/api/worlds/${worldId}/thumbnail)`,
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

  const filterTree = (nodes, query) => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();
    
    return nodes.reduce((acc, node) => {
      const matchesName = node.name.toLowerCase().includes(lowerQuery);
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      
      if (matchesName || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: node.children ? filteredChildren : undefined,
        });
      }
      return acc;
    }, []);
  };

  const filteredTree = filterTree(tree, searchQuery);

  const breadcrumbs = useMemo(() => {
    if (!selectedFile) return [];
    const segments = selectedFile.path.split('/');
    return segments.map((seg, i) => ({
      name: seg,
      path: segments.slice(0, i + 1).join('/')
    }));
  }, [selectedFile]);

  const handleContextMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      node
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
            className={`btn-secondary ${viewMode === 'edit' ? 'active' : ''}`}
            onClick={() => setViewMode('edit')}
            disabled={!selectedFile}
          >
            <Edit2 size={16} style={{ marginRight: 8 }} /> Editor
          </button>
          <button
            className={`btn-secondary ${viewMode === 'view' ? 'active' : ''}`}
            onClick={() => setViewMode('view')}
            disabled={!selectedFile}
          >
            <Eye size={16} style={{ marginRight: 8 }} /> Preview
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !selectedFile}>
            <Save size={16} style={{ marginRight: 8 }} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <div className="workspace-main">
        {/* Sidebar / File Explorer */}
        <aside className="workspace-sidebar glass-panel" style={sidebarStyle}>
          
          {/* Search Bar */}
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
              <p style={{ color: 'var(--text-secondary)', padding: '16px', fontSize: '0.875rem' }}>
                Nenhum arquivo encontrado.
              </p>
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
                  options={{
                    minimap: { enabled: false },
                    fontSize: 16,
                    wordWrap: 'on',
                    padding: { top: 60 },
                    scrollBeyondLastLine: false
                  }}
                />
              ) : (
                <div className="preview-container glass-panel">
                  <div
                    className="markdown-preview"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked(fileContent)) }}
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
            <h2>Deletar Documento</h2>
            <p style={{ marginTop: '16px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
              Tem certeza que deseja deletar <strong>{deleteModal.node.name}</strong>?
            </p>
            {deleteModal.node.children && deleteModal.node.children.length > 0 && (
              <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#f87171' }}>
                Aviso: Todos os {deleteModal.node.children.length} sub-documentos também serão apagados permanentemente!
              </p>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn-secondary" onClick={() => setDeleteModal({ isOpen: false, node: null })}>Cancelar</button>
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
            setDeleteModal({ isOpen: true, node });
          }}>
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

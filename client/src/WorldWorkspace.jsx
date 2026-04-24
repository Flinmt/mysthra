import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, FolderPlus, FilePlus, Save, Eye, Edit2, Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Sword, Shield, Castle, Map, Crown, Book, Star, Skull, Tag, Trash2 } from 'lucide-react';
import Editor from '@monaco-editor/react';

const ICON_MAP = {
  FileText, Sword, Shield, Castle, Map, Crown, Book, Star, Skull
};

function FileTree({ nodes, onFileSelect, selectedFile, openPrompt, onIconSelect, onDeletePrompt }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="file-tree">
      {nodes.map(node => (
        <FileTreeNode key={node.path} node={node} onFileSelect={onFileSelect} selectedFile={selectedFile} openPrompt={openPrompt} onIconSelect={onIconSelect} onDeletePrompt={onDeletePrompt} />
      ))}
    </ul>
  );
}

function FileTreeNode({ node, onFileSelect, selectedFile, openPrompt, onIconSelect, onDeletePrompt }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const isSelected = selectedFile?.path === node.path;
  
  // Close icon dropdown when clicking elsewhere
  useEffect(() => {
    if (!showIcons) return;
    const closeIt = () => setShowIcons(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [showIcons]);

  return (
    <li className="tree-document">
      <div className={`tree-node ${isSelected ? 'selected' : ''}`}>
        <span
          className="tree-icon"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          style={{ width: 16, display: 'flex', justifyContent: 'center' }}
        >
          {node.children && node.children.length > 0 ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <div onClick={() => onFileSelect(node)} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <span 
            className="tree-icon" 
            style={{ color: 'var(--text-secondary)', position: 'relative', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setShowIcons(!showIcons); }}
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
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className="node-action-btn"
            onClick={(e) => { e.stopPropagation(); openPrompt(node.path); setIsOpen(true); }}
            title="Novo sub-documento"
          >
            <Plus size={14} />
          </button>
          <button
            className="node-action-btn delete-btn"
            onClick={(e) => { e.stopPropagation(); onDeletePrompt(node); }}
            title="Deletar documento"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {isOpen && node.children && <FileTree nodes={node.children} onFileSelect={onFileSelect} selectedFile={selectedFile} openPrompt={openPrompt} onIconSelect={onIconSelect} onDeletePrompt={onDeletePrompt} />}
    </li>
  );
}
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default function WorldWorkspace({ params }) {
  const worldId = params.id;
  const [, setLocation] = useLocation();
  const [worldData, setWorldData] = useState(null);
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'view'
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [promptModal, setPromptModal] = useState({ isOpen: false, type: '', parentPath: '' });
  const [promptValue, setPromptValue] = useState('');
  const [promptError, setPromptError] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, node: null });

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

  const openPrompt = (parentPath = '') => {
    setPromptModal({ isOpen: true, type: 'document', parentPath });
    setPromptValue('');
    setPromptError('');
  };

  const handlePromptSubmit = async () => {
    try {
      if (!promptValue.trim()) return;
      const { parentPath } = promptModal;
      let name = promptValue.trim();
      let newPath = parentPath ? `${parentPath}/${name}` : name;

      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath, content: '# ' + name })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar documento');
      }

      setPromptModal({ isOpen: false, type: '', parentPath: '' });
      loadTree();
    } catch (e) {
      setPromptError(e.message);
    }
  };

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
          <div className="sidebar-tree">
            {tree.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '16px', fontSize: '0.875rem' }}>
                Nenhum arquivo encontrado.
              </p>
            ) : (
              <FileTree nodes={tree} onFileSelect={setSelectedFile} selectedFile={selectedFile} openPrompt={openPrompt} onIconSelect={handleIconSelect} onDeletePrompt={(node) => setDeleteModal({ isOpen: true, node })} />
            )}
          </div>

          <div className="sidebar-footer">
            <button className="btn-secondary sidebar-action-btn" title="Novo Documento na Raiz" onClick={() => openPrompt('')}>
              <FilePlus size={16} /> <span className="btn-text">Documento Raiz</span>
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
          ) : viewMode === 'edit' ? (
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
                padding: { top: 24 }
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
        </section>
      </div>

      {promptModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <h2>Novo Documento</h2>
            {promptModal.parentPath && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Em: {promptModal.parentPath}</p>}

            {promptError && <div className="error-msg">{promptError}</div>}

            <div className="input-group" style={{ marginTop: '16px' }}>
              <label>Nome</label>
              <input
                type="text"
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handlePromptSubmit()}
                placeholder={'Ex: História Antiga'}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setPromptModal({ isOpen: false, type: '', parentPath: '' })}>Cancelar</button>
              <button className="btn-primary" onClick={handlePromptSubmit}>Criar</button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

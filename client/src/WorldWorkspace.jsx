import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Save, Eye, Edit2, Folder, FileText, ChevronRight, ChevronDown, Plus, Sword, Shield, Castle, Map, Crown, Book, Star, Skull, Trash2, Search, Home, X, Copy, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ICON_MAP = {
  FileText, Sword, Shield, Castle, Map, Crown, Book, Star, Skull
};

function getTreeChildren(node) {
  // Retorna apenas filhos que são containers para a Sidebar
  return (node.children || []).filter(child => child.type === 'container');
}

function getTabsForNode(node) {
  // Retorna apenas filhos que são tabs para o Workspace
  return (node.children || []).filter(child => child.type === 'tab');
}

function findNodeByPath(nodes = [], targetPath = '') {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    const childMatch = findNodeByPath(node.children || [], targetPath);
    if (childMatch) return childMatch;
  }
  return null;
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

export default function WorldWorkspace({ params }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const worldId = decodeURIComponent(params.id);
  
  const [tree, setTree] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState('view'); // 'view' or 'edit'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState('wiki');
  const [worldData, setWorldData] = useState(null);
  const [isVisitor, setIsVisitor] = useState(false);
  const [toasts, setToasts] = useState([]);
  
  // Modals/UI State
  const [prompt, setPrompt] = useState({ isOpen: false, parentPath: '', name: '', type: 'container', contentType: 'wiki' });
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, node: null });
  const [duplicatePrompt, setDuplicatePrompt] = useState({ isOpen: false, node: null });
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, node: null });
  const [renamingPath, setRenamingPath] = useState(null);

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
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/config`);
      if (res.ok) {
        const data = await res.json();
        setWorldData(data);
        if (data.isPublic && !window.localStorage.getItem('mysthra_session')) {
          setIsVisitor(true);
        }
      }
    } catch {
      setWorldData(null);
    }
  }, [worldId]);

  useEffect(() => {
    fetchTree();
    fetchWorldData();
  }, [fetchTree, fetchWorldData]);

  // Sincroniza o container selecionado quando a árvore muda (para refletir novas abas)
  useEffect(() => {
    if (selectedContainer && tree.length > 0) {
      const findNode = (nodes) => {
        for (const n of nodes) {
          if (n.uid === selectedContainer.uid) return n;
          if (n.children) {
            const found = findNode(n.children);
            if (found) return found;
          }
        }
        return null;
      };
      const updatedNode = findNode(tree);
      if (updatedNode) {
        setSelectedContainer(updatedNode);
      }
    }
  }, [selectedContainer, tree]);

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
    if (isDirty && !window.confirm(t('workspace.unsaved_changes'))) return;
    
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(tabNode.path)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveTab(tabNode);
        setFileContent(data.content);
        setIsDirty(false);
        setViewMode('view');
      }
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  const handleSave = async () => {
    if (!activeTab) return;
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activeTab.path,
          content: fileContent
        })
      });
      if (res.ok) {
        setIsDirty(false);
        addToast(t('common.saved'), 'success');
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

  const handleDelete = async (node) => {
    if (isVisitor || !node) return;
    setDeletePrompt({ isOpen: true, node });
  };

  const confirmDelete = async () => {
    const node = deletePrompt.node;
    if (isVisitor || !node) return;

    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/documents?path=${encodeURIComponent(node.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (
          selectedContainer?.path === node.path ||
          selectedContainer?.path?.startsWith(`${node.path}/`) ||
          activeTab?.path === node.path ||
          activeTab?.path?.startsWith(`${node.path}/`)
        ) {
          setSelectedContainer(null);
          setActiveTab(null);
          setFileContent('');
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

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
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
    return search(tree);
  }, [tree, searchQuery]);

  const renderedContent = useMemo(() => {
    return DOMPurify.sanitize(marked(fileContent));
  }, [fileContent]);

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

  const handleTreeBlankContextMenu = (event) => {
    if (isVisitor) return;
    event.preventDefault();
    setContextMenu({ isOpen: true, x: event.clientX, y: event.clientY, node: null });
  };

  const sidebarTabs = [
    { id: 'wiki', label: t('workspace.sidebar_tab_wiki'), icon: Book },
    { id: 'assets', label: t('workspace.sidebar_tab_assets'), icon: Image },
    { id: 'templates', label: t('workspace.sidebar_tab_templates'), icon: FileText }
  ];

  return (
    <div className="workspace-container" style={{ flexDirection: 'row' }}>
      <aside className="workspace-sidebar sidebar-nexus">
        <div className="sidebar-header sidebar-nexus-header">
          <div className="sidebar-nexus-glow" aria-hidden="true" />
          <div className="sidebar-topline">
            <button className="sidebar-icon-button" onClick={() => setLocation('/')} title={t('common.back')}>
              <ArrowLeft size={18} />
            </button>
            <h1 className="sidebar-world-title">{worldData?.displayName || worldId}</h1>
          </div>
        </div>

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
        ) : (
          <div className="sidebar-panel-placeholder">
            <div className="sidebar-empty-state compact">
              <div className="sidebar-empty-icon">
                {activeSidebarTab === 'assets' ? <Image size={28} /> : <FileText size={28} />}
              </div>
              <h2>{activeSidebarTab === 'assets' ? t('workspace.assets_empty_title') : t('workspace.templates_empty_title')}</h2>
              <p>{activeSidebarTab === 'assets' ? t('workspace.assets_empty_hint') : t('workspace.templates_empty_hint')}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Área Principal */}
      <main className="workspace-main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedContainer ? (
          <div className="document-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <header className="document-header" style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', background: 'rgba(11,13,17,0.4)' }}>
              {/* Top Bar: Info + Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px' }}>
                <div className="document-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ color: 'var(--accent-color)' }}>
                    {React.createElement(ICON_MAP[selectedContainer.icon] || Folder, { size: 20 })}
                  </div>
                  <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{selectedContainer.name}</h2>
                </div>
                
                <div className="document-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="view-toggle glass-panel" style={{ display: 'flex', padding: 4, borderRadius: 8 }}>
                    <button 
                      className={`icon-btn ${viewMode === 'view' ? 'active' : ''}`} 
                      onClick={() => setViewMode('view')}
                      style={{ background: viewMode === 'view' ? 'var(--accent-color)' : 'transparent', border: 'none', borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <Eye size={16} color={viewMode === 'view' ? 'white' : 'var(--text-secondary)'} />
                    </button>
                    {!isVisitor && (
                      <button 
                        className={`icon-btn ${viewMode === 'edit' ? 'active' : ''}`} 
                        onClick={() => setViewMode('edit')}
                        style={{ background: viewMode === 'edit' ? 'var(--accent-color)' : 'transparent', border: 'none', borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <Edit2 size={16} color={viewMode === 'edit' ? 'white' : 'var(--text-secondary)'} />
                      </button>
                    )}
                  </div>
                  
                  {!isVisitor && (
                    <button 
                      className="btn-primary" 
                      onClick={handleSave} 
                      disabled={!isDirty || !activeTab}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <Save size={16} /> {t('common.save')}
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Bar: Subfolders with index.md */}
              <div className="tab-bar" style={{ display: 'flex', padding: '0 24px', gap: 4, background: 'rgba(0,0,0,0.1)' }}>
                {getTabsForNode(selectedContainer).map(tab => (
                  <button
                    key={tab.uid}
                    onClick={() => selectTab(tab)}
                    style={{
                      padding: '10px 20px',
                      background: activeTab?.uid === tab.uid ? 'rgba(255,255,255,0.05)' : 'transparent',
                      border: 'none',
                      borderBottom: activeTab?.uid === tab.uid ? '2px solid var(--accent-color)' : '2px solid transparent',
                      color: activeTab?.uid === tab.uid ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s'
                    }}
                  >
                    {React.createElement(tab.contentType === 'map' ? Map : FileText, { size: 14, opacity: 0.7 })}
                    {tab.name}
                  </button>
                ))}
                {!isVisitor && (
                  <button 
                    onClick={() => setPrompt({ isOpen: true, parentPath: selectedContainer.path, name: '', type: 'tab', contentType: 'wiki' })}
                    style={{ padding: '10px', background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title={t('workspace.create_tab')}
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </header>

            <div className="document-content" style={{ flex: 1, overflow: 'hidden', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeTab ? (
                activeTab.contentType === 'map' ? (
                  <div style={{ textAlign: 'center', opacity: 0.5 }}>
                    <Map size={80} style={{ marginBottom: 24, color: 'var(--accent-color)' }} />
                    <h2 style={{ fontWeight: 700 }}>Módulo de Mapas</h2>
                    <p>O visualizador de mapas interativos será implementado na próxima fase.</p>
                  </div>
                ) : (
                  viewMode === 'edit' ? (
                    <div style={{ textAlign: 'center', opacity: 0.5 }}>
                      <Edit2 size={48} style={{ marginBottom: 16 }} />
                      <p>Editor em transição para BlockNote...</p>
                    </div>
                  ) : (
                    <div className="markdown-preview" style={{ padding: '40px 60px', height: '100%', overflowY: 'auto' }}>
                      <div 
                        className="markdown-body" 
                        style={{ maxWidth: '800px', margin: '0 auto' }}
                        dangerouslySetInnerHTML={{ __html: renderedContent }} 
                      />
                    </div>
                  )
                )
              ) : (
                <div style={{ textAlign: 'center', opacity: 0.3 }}>
                  <Book size={48} style={{ marginBottom: 16 }} />
                  <p>Esta página não possui abas de conteúdo.</p>
                  {!isVisitor && (
                    <button 
                      className="btn-secondary" 
                      onClick={() => setPrompt({ isOpen: true, parentPath: selectedContainer.path, name: '', type: 'tab', contentType: 'wiki' })}
                      style={{ marginTop: 16 }}
                    >
                      Criar Primeira Aba
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
            <Castle size={80} style={{ marginBottom: 24 }} />
            <h2 style={{ fontWeight: 700 }}>{t('workspace.select_document')}</h2>
            <p>{t('workspace.select_document_hint')}</p>
          </div>
        )}
      </main>

      {/* Modals & Overlays */}
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

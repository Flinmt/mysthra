import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ChevronDown, ChevronRight, Copy, Edit2, Eye, FileImage, MoveRight, Music, PanelLeftClose, PanelLeftOpen, Plus, Settings, Share2, Trash2, Upload, X } from 'lucide-react'

export function WorkspaceBootScreen({ theme, themeStyle, title, label }) {
  return (
    <div className="workspace-container workspace-boot" data-world-theme={theme} style={themeStyle}>
      <div className="workspace-boot-card">
        <div className="workspace-boot-mark" aria-hidden="true" />
        <div><strong>{title}</strong><span>{label}</span></div>
      </div>
    </div>
  )
}

export function WorkspaceTopbar({
  worldName,
  breadcrumbs,
  navigatorOpen,
  canManageWorld,
  saveStatus,
  saveStatusLabel,
  presenceUsers,
  navigatorLabel,
  backLabel,
  settingsLabel,
  worldMenuLabel,
  shareLabel,
  onToggleNavigator,
  onBack,
  onSelectBreadcrumb,
  onOpenSettings,
  onShareWorld,
  languageSwitcher
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const handlePointerDown = event => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar-leading">
        <button type="button" className="workspace-topbar-button" onClick={onToggleNavigator} title={navigatorLabel} aria-label={navigatorLabel} aria-expanded={navigatorOpen} aria-controls="workspace-sidebar">
          {navigatorOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>
        <button type="button" className="workspace-topbar-button" onClick={onBack} title={backLabel} aria-label={backLabel}>
          <ArrowLeft size={16} />
        </button>
        <div className="workspace-topbar-world">
          <span className="workspace-topbar-world-mark" aria-hidden="true" />
          <strong title={worldName}>{worldName}</strong>
        </div>
        {breadcrumbs.length > 0 && (
          <nav className="workspace-breadcrumbs" aria-label={worldName}>
            {breadcrumbs.map((item, index) => (
              <span key={item.path} className={index === breadcrumbs.length - 1 ? 'current' : undefined}>
                <ChevronRight size={12} aria-hidden="true" />
                <button type="button" onClick={() => onSelectBreadcrumb(item)} disabled={index === breadcrumbs.length - 1} title={item.name}>{item.name}</button>
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="workspace-topbar-actions">
        {saveStatusLabel && <span className={`workspace-topbar-save ${saveStatus}`}>{saveStatusLabel}</span>}
        {presenceUsers.length > 0 && (
          <div className="workspace-topbar-presence" title={`${presenceUsers.length}`}>
            {presenceUsers.slice(0, 3).map(user => <span key={user.id} style={{ '--presence-color': user.color }} title={user.name}>{String(user.name || '?').slice(0, 1).toUpperCase()}</span>)}
            {presenceUsers.length > 3 && <span className="more">+{presenceUsers.length - 3}</span>}
          </div>
        )}
        {canManageWorld && (
          <button type="button" className="workspace-topbar-button" onClick={onOpenSettings} title={settingsLabel} aria-label={settingsLabel}>
            <Settings size={16} />
          </button>
        )}
        {languageSwitcher && <div className="workspace-topbar-language">{languageSwitcher}</div>}
        <div ref={menuRef} className="workspace-topbar-menu">
          <button type="button" className="workspace-topbar-button" onClick={() => setMenuOpen(value => !value)} title={worldMenuLabel} aria-label={worldMenuLabel} aria-expanded={menuOpen}>
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div className="workspace-topbar-menu-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onShareWorld() }}><Share2 size={14} /><span>{shareLabel}</span></button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export function WorkspaceBody({ navigator = null, content = null, inspector = null, children = null }) {
  return (
    <div className="workspace-studio-body" data-has-inspector={inspector ? 'true' : undefined}>
      {children || <>{navigator}{content}</>}
      {inspector && <aside className="workspace-inspector">{inspector}</aside>}
    </div>
  )
}

export function WorkspaceSidebar({ tabs, activeTab, tabsLabel, onTabChange, isCollapsed, isDrawerOpen, isMobile, onClose, collapseLabel, children }) {
  const sidebarRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!isMobile || !isDrawerOpen) return undefined
    previousFocusRef.current = document.activeElement
    sidebarRef.current?.querySelector('button')?.focus()
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [isDrawerOpen, isMobile, onClose])

  return (
    <>
      {isMobile && isDrawerOpen && <button type="button" className="workspace-sidebar-backdrop" onClick={onClose} aria-label={collapseLabel} />}
      <aside ref={sidebarRef} id="workspace-sidebar" className="workspace-sidebar sidebar-nexus" data-collapsed={!isMobile && isCollapsed ? 'true' : undefined} data-drawer-open={isMobile && isDrawerOpen ? 'true' : undefined} aria-hidden={isMobile && !isDrawerOpen ? 'true' : undefined} inert={isMobile && !isDrawerOpen ? true : undefined}>
        <div className="world-navigator-header">
          <div className="sidebar-nexus-tabs" role="tablist" aria-label={tabsLabel}>
            {tabs.map(tab => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button key={tab.id} type="button" className={`sidebar-nexus-tab ${isActive ? 'active' : ''}`} onClick={() => onTabChange(tab.id)} role="tab" aria-selected={isActive} title={tab.label}>
                  <TabIcon size={15} /><span>{tab.label}</span>
                </button>
              )
            })}
          </div>
          {isMobile && <button type="button" className="world-navigator-close" onClick={onClose} aria-label={collapseLabel}><X size={16} /></button>}
        </div>
        <div className="sidebar-content">{children}</div>
      </aside>
    </>
  )
}

export function AssetPreviewDialog({ asset, source, sizeLabel, typeLabel, labels, onClose }) {
  const closeRef = useRef(null)
  const previousFocusRef = useRef(null)
  const titleId = useId()
  const [mediaState, setMediaState] = useState('loading')

  useEffect(() => {
    if (!asset) return undefined
    previousFocusRef.current = document.activeElement
    setMediaState('loading')
    closeRef.current?.focus()
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [asset, source, onClose])

  if (!asset) return null
  const isAudio = asset.mediaType === 'audio'
  const MediaIcon = isAudio ? Music : FileImage

  return (
    <div className="asset-preview-backdrop" onPointerDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`asset-preview-dialog ${isAudio ? 'is-audio' : 'is-image'}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="asset-preview-dialog-header">
          <span className="asset-preview-dialog-icon" aria-hidden="true"><MediaIcon size={16} /></span>
          <div>
            <h2 id={titleId}>{asset.name}</h2>
            <span>{typeLabel}</span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} title={labels.close} aria-label={labels.close}><X size={15} /></button>
        </header>

        <div className="asset-preview-stage">
          {mediaState === 'loading' && <div className="asset-preview-status"><span className="asset-preview-spinner" aria-hidden="true" />{labels.loading}</div>}
          {mediaState === 'error' && <div className="asset-preview-status is-error"><AlertCircle size={20} aria-hidden="true" />{labels.error}</div>}
          {isAudio ? (
            <audio controls src={source} onLoadedMetadata={() => setMediaState('ready')} onError={() => setMediaState('error')} />
          ) : (
            <img src={source} alt={asset.name} onLoad={() => setMediaState('ready')} onError={() => setMediaState('error')} />
          )}
        </div>

        <footer className="asset-preview-metadata">
          <div><span>{labels.path}</span><strong title={asset.path}>{asset.path}</strong></div>
          <div><span>{labels.size}</span><strong>{sizeLabel}</strong></div>
        </footer>
      </section>
    </div>
  )
}

export function AssetContextMenu({ node, isVisitor, labels, onPreview, onCopyReference, onUpload, onCreateFolder, onDuplicate, onMove, onRename, onDelete }) {
  if (!node) {
    if (isVisitor) return null
    return (
      <>
        <button type="button" onClick={() => onUpload('')}><Upload size={14} /> {labels.uploadHere}</button>
        <button type="button" onClick={() => onCreateFolder('')}><Plus size={14} /> {labels.newFolder}</button>
      </>
    )
  }

  const isFolder = node.type === 'folder'
  const canPreview = !isFolder && ['image', 'audio'].includes(node.mediaType)

  return (
    <>
      {canPreview && <button type="button" onClick={() => onPreview(node)}><Eye size={14} /> {labels.preview}</button>}
      {!isFolder && <button type="button" onClick={() => onCopyReference(node)}><Copy size={14} /> {labels.copyReference}</button>}
      {!isVisitor && isFolder && (
        <>
          <button type="button" onClick={() => onUpload(node.path)}><Upload size={14} /> {labels.uploadHere}</button>
          <button type="button" onClick={() => onCreateFolder(node.path)}><Plus size={14} /> {labels.newFolder}</button>
        </>
      )}
      {!isVisitor && (
        <>
          <button type="button" onClick={() => onDuplicate(node)}><Copy size={14} /> {labels.duplicate}</button>
          <button type="button" onClick={() => onMove(node)}><MoveRight size={14} /> {labels.move}</button>
          <button type="button" onClick={() => onRename(node)}><Edit2 size={14} /> {labels.rename}</button>
          <button type="button" className="danger" onClick={() => onDelete(node)}><Trash2 size={14} /> {labels.delete}</button>
        </>
      )}
    </>
  )
}

export function DocumentChrome({ title, tabs, controls }) {
  return (
    <div className="document-chrome">
      <header className="document-chrome-title">{title}{tabs}</header>
      <div className="document-chrome-controls">{controls}</div>
    </div>
  )
}

export function WorkspaceTabRow({ tabs, activeTab, renamingTab, canCreate, createLabel, getTabIcon, onSelect, onContextMenu, onRenameChange, onRenameCommit, onRenameCancel, onCreate }) {
  return (
    <div className="editor-tab-row">
      {tabs.map(tab => {
        if (renamingTab.path === tab.path) {
          return (
            <input key={tab.uid} className="editor-tab-rename-input" value={renamingTab.value} onChange={event => onRenameChange(event.target.value)} onBlur={() => onRenameCommit(tab)} onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
              if (event.key === 'Escape') onRenameCancel()
            }} autoFocus onFocus={event => event.target.select()} />
          )
        }
        const TabIcon = getTabIcon(tab.contentType)
        return (
          <button key={tab.uid} type="button" className={`editor-tab-pill ${activeTab?.uid === tab.uid ? 'active' : ''}`} onClick={() => onSelect(tab)} onContextMenu={event => onContextMenu(event, tab)}>
            <TabIcon size={14} /><span>{tab.name}</span>
          </button>
        )
      })}
      {canCreate && <button type="button" className="editor-tab-add" onClick={onCreate} title={createLabel}><Plus size={16} /></button>}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe2, LogOut, MoreVertical, Plus, RefreshCw, Search, Settings, Trash2, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getThemeColors, getWorldTheme } from '../../worldThemes'
import WorldDialog from './WorldDialog'

function WorldActions({ world, canEdit, canDelete, onEdit, onDelete }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && rootRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={rootRef} className="world-dashboard-card-menu">
      <button
        type="button"
        className="world-dashboard-icon-button"
        aria-label={t('dashboard.world_actions', { name: world.displayName || world.name })}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="world-dashboard-action-menu" role="menu">
          {canEdit && <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(world) }}><Settings size={15} /><span>{t('common.edit')}</span></button>}
          {canDelete && <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onDelete(world) }}><Trash2 size={15} /><span>{t('common.delete')}</span></button>}
        </div>
      )}
    </div>
  )
}

function WorldCard({ world, canEdit, canDelete, onOpen, onEdit, onDelete }) {
  const { t } = useTranslation()
  const name = world.displayName || world.name
  const theme = getWorldTheme(world.theme)
  const colors = getThemeColors(world.theme, world.customTheme)
  const themeName = world.customTheme?.preset?.name || (world.customTheme ? t('dashboard.theme_custom') : t(theme.labelKey))
  const thumbnail = world.thumbnail?.filename
    ? `url(/api/worlds/${encodeURIComponent(world.id)}/thumbnail?v=${world.thumbnail.updatedAt || 0})`
    : undefined
  const cardStyle = {
    '--world-card-background': colors.background,
    '--world-card-surface': colors.surface,
    '--world-card-accent': colors.accent,
    '--world-card-secondary': colors.secondaryAccent
  }

  return (
    <article className="world-dashboard-card" style={cardStyle}>
      <button type="button" className="world-dashboard-card-open" onClick={() => onOpen(world)} aria-label={t('dashboard.open_world', { name })}>
        <span className={`world-dashboard-card-media ${thumbnail ? 'has-thumbnail' : ''}`} style={thumbnail ? { backgroundImage: thumbnail } : undefined} />
        <span className="world-dashboard-card-shade" />
        <span className="world-dashboard-card-content">
          <span className="world-dashboard-card-meta">
            <span className="world-dashboard-theme"><i style={{ backgroundColor: colors.accent }} />{themeName}</span>
            {world.publicRead && <span><Globe2 size={13} />{t('dashboard.public')}</span>}
          </span>
          <strong>{name}</strong>
          <span className="world-dashboard-card-description">{world.description || t('dashboard.default_world_description')}</span>
        </span>
      </button>
      {(canEdit || canDelete) && <WorldActions world={world} canEdit={canEdit} canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} />}
    </article>
  )
}

function CreateWorldCard({ onCreate }) {
  const { t } = useTranslation()
  return (
    <button type="button" className="world-dashboard-create-card" onClick={onCreate}>
      <span className="world-dashboard-create-icon"><Plus size={22} /></span>
      <strong>{t('dashboard.create_new_world')}</strong>
    </button>
  )
}

function DashboardState({ icon, title, description, action }) {
  return (
    <div className="world-dashboard-state" role="status">
      {icon}
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

function SessionMenu({ currentUser, canManage, onManageUsers, onLogout }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && rootRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={rootRef} className="world-dashboard-session">
      <button
        type="button"
        className="world-dashboard-account"
        aria-label={t('dashboard.session_menu', { name: currentUser?.username })}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="world-dashboard-account-avatar" aria-hidden="true">{currentUser?.username?.slice(0, 1).toUpperCase()}</span>
        <span className="world-dashboard-account-name">{currentUser?.username}</span>
        <ChevronDown size={14} className={open ? 'open' : ''} aria-hidden="true" />
      </button>
      {open && (
        <div className="world-dashboard-session-menu" role="menu">
          {canManage && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onManageUsers() }}>
              <Users size={15} />
              <span>{t('dashboard.manage_users')}</span>
            </button>
          )}
          <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onLogout() }}>
            <LogOut size={15} />
            <span>{t('dashboard.logout_tooltip')}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function WorldDashboard({
  currentUser,
  worldCount,
  filteredWorlds,
  loading,
  error,
  searchQuery,
  languageSwitcher,
  onSearchChange,
  onRetry,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
  onManageUsers,
  onLogout
}) {
  const { t } = useTranslation()
  const canManageGlobally = Boolean(currentUser?.globalRole)
  const hasSearch = searchQuery.trim().length > 0
  const showSearch = worldCount >= 7 || hasSearch
  const [confirmLogout, setConfirmLogout] = useState(false)

  let content
  if (loading) {
    content = <DashboardState icon={<span className="world-dashboard-spinner" />} title={t('dashboard.loading_worlds')} description={t('dashboard.loading_worlds_hint')} />
  } else if (error) {
    content = (
      <DashboardState
        icon={<RefreshCw size={22} />}
        title={t('dashboard.load_error')}
        description={t('dashboard.load_error_hint')}
        action={<button type="button" className="world-dashboard-secondary-button" onClick={onRetry}><RefreshCw size={15} />{t('dashboard.try_again')}</button>}
      />
    )
  } else if (filteredWorlds.length === 0 && (hasSearch || !canManageGlobally)) {
    content = (
      <DashboardState
        icon={<Globe2 size={22} />}
        title={hasSearch ? t('dashboard.no_search_results') : t('dashboard.no_worlds_available')}
        description={hasSearch ? t('dashboard.no_search_results_hint') : canManageGlobally ? t('dashboard.no_worlds_admin_hint') : t('dashboard.no_worlds_member_hint')}
        action={hasSearch
          ? <button type="button" className="world-dashboard-secondary-button" onClick={() => onSearchChange('')}><X size={15} />{t('dashboard.clear_search')}</button>
          : null}
      />
    )
  } else {
    content = (
      <div className="world-dashboard-grid">
        {canManageGlobally && !hasSearch && <CreateWorldCard onCreate={onCreate} />}
        {filteredWorlds.map(world => {
          const isWorldAdmin = world.members?.some(member => member.userId === currentUser?.userId && member.role === 'admin')
          return <WorldCard key={world.id} world={world} canEdit={canManageGlobally || isWorldAdmin} canDelete={canManageGlobally} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
        })}
      </div>
    )
  }

  return (
    <div className="world-dashboard">
      <main className="world-dashboard-main">
        <header className="world-dashboard-header">
          <div className="world-dashboard-heading">
            <div>
              <h1>Mysthra</h1>
              <p>{t('dashboard.subtitle')}</p>
            </div>
          </div>

          <div className="world-dashboard-toolbar">
            {showSearch && (
              <label className="world-dashboard-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">{t('dashboard.search_universes')}</span>
                <input type="search" value={searchQuery} onChange={event => onSearchChange(event.target.value)} placeholder={t('dashboard.search_universes')} />
                {hasSearch && <button type="button" onClick={() => onSearchChange('')} aria-label={t('dashboard.clear_search')}><X size={15} /></button>}
              </label>
            )}
            <div className="world-dashboard-language">{languageSwitcher}</div>
            <SessionMenu currentUser={currentUser} canManage={canManageGlobally} onManageUsers={onManageUsers} onLogout={() => setConfirmLogout(true)} />
          </div>
        </header>
        <section className="world-dashboard-content" aria-label={t('dashboard.worlds_section')}>
          {content}
        </section>
      </main>
      {confirmLogout && (
        <WorldDialog title={t('dashboard.logout_confirm_title')} description={t('dashboard.logout_confirm_hint')} onClose={() => setConfirmLogout(false)} tone="danger">
          <div className="world-dialog-body world-logout-dialog-body">
            <p>{t('dashboard.logout_confirm_description', { name: currentUser?.username })}</p>
          </div>
          <div className="world-dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => setConfirmLogout(false)}>{t('common.cancel')}</button>
            <button type="button" className="btn-primary world-dialog-danger-action" onClick={onLogout}>{t('dashboard.logout_confirm_action')}</button>
          </div>
        </WorldDialog>
      )}
    </div>
  )
}

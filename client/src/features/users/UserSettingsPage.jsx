import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || fallback)
  return data
}

function roleLabel(t, user) {
  if (user.globalRole === 'root') return t('dashboard.role_root')
  if (user.globalRole === 'server-admin') return t('dashboard.role_server_admin')
  return t('dashboard.role_user')
}

function ConfirmDialog({ title, description, confirmLabel, danger = false, loading, error, onCancel, onConfirm }) {
  const { t } = useTranslation()
  return (
    <div className="modal-backdrop user-settings-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !loading && onCancel()}>
      <div className="user-settings-dialog" role="alertdialog" aria-modal="true" aria-labelledby="user-confirm-title">
        <h2 id="user-confirm-title">{title}</h2>
        <p>{description}</p>
        {error && <div className="user-admin-error">{error}</div>}
        <div className="user-settings-dialog-actions">
          <button type="button" className="user-admin-secondary" onClick={onCancel} disabled={loading}>{t('common.cancel')}</button>
          <button type="button" className={danger ? 'user-admin-danger' : 'user-admin-primary'} onClick={onConfirm} disabled={loading}>
            {loading ? t('common.saving') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateUserDialog({ loading, error, onCancel, onCreate }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="modal-backdrop user-settings-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !loading && onCancel()}>
      <form className="user-settings-dialog user-settings-create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-user-title" onSubmit={event => {
        event.preventDefault()
        onCreate({ username, password })
      }}>
        <div>
          <h2 id="create-user-title">{t('dashboard.create_user')}</h2>
          <p>{t('dashboard.create_user_hint')}</p>
        </div>
        <label>
          <span>{t('login.username')}</span>
          <input value={username} onChange={event => setUsername(event.target.value)} autoFocus required />
        </label>
        <label>
          <span>{t('dashboard.password_access')}</span>
          <div className="user-settings-password-input">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? t('dashboard.hide_password') : t('dashboard.show_password')}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        {error && <div className="user-admin-error">{error}</div>}
        <div className="user-settings-dialog-actions">
          <button type="button" className="user-admin-secondary" onClick={onCancel} disabled={loading}>{t('common.cancel')}</button>
          <button type="submit" className="user-admin-primary" disabled={loading || !username.trim() || password.length < 4}>
            {loading ? t('common.creating') : t('dashboard.create_user')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function UserSettingsPage({ currentUser }) {
  const { t } = useTranslation()
  const [, setLocation] = useLocation()
  const [users, setUsers] = useState([])
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('user') || 'root')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('account')
  const [worlds, setWorlds] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingWorlds, setLoadingWorlds] = useState(false)
  const [action, setAction] = useState(null)
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const requestId = useRef(0)

  const selectedUser = users.find(user => user.id === selectedId) || null
  const canEditSelected = selectedUser && selectedUser.id !== 'root' && !(
    currentUser.globalRole === 'server-admin' && selectedUser.globalRole === 'server-admin'
  )

  const replaceUser = useCallback(updated => {
    setUsers(current => current.map(user => user.id === updated.id ? { ...user, ...updated } : user))
  }, [])

  const loadUsers = useCallback(async preferredId => {
    setLoadingUsers(true)
    setPageError('')
    try {
      const data = await readResponse(await fetch('/api/users'), t('dashboard.users_load_error'))
      const items = data.items || []
      setUsers(items)
      const requestedId = preferredId || new URLSearchParams(window.location.search).get('user') || 'root'
      const nextId = items.some(user => user.id === requestedId) ? requestedId : (items[0]?.id || null)
      setSelectedId(nextId)
      if (nextId && nextId !== requestedId) setLocation(`/settings/users?user=${encodeURIComponent(nextId)}`, { replace: true })
    } catch (error) {
      setPageError(error.message)
    } finally {
      setLoadingUsers(false)
    }
  }, [setLocation, t])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!selectedUser || selectedUser.globalRole) {
      setWorlds([])
      setLoadingWorlds(false)
      return
    }
    const currentRequest = ++requestId.current
    setLoadingWorlds(true)
    setActionError('')
    fetch(`/api/users/${encodeURIComponent(selectedUser.id)}/worlds`)
      .then(response => readResponse(response, t('dashboard.world_access_load_error')))
      .then(data => {
        if (requestId.current === currentRequest) setWorlds(data.items || [])
      })
      .catch(error => {
        if (requestId.current === currentRequest) setActionError(error.message)
      })
      .finally(() => {
        if (requestId.current === currentRequest) setLoadingWorlds(false)
      })
  }, [selectedUser, t])

  const filteredUsers = useMemo(() => users.filter(user => {
    if (!user.username.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (filter === 'admins') return Boolean(user.globalRole)
    if (filter === 'users') return !user.globalRole
    return true
  }), [filter, query, users])

  const selectUser = user => {
    setSelectedId(user.id)
    setActiveTab('account')
    setActionError('')
    setNewPassword('')
    setLocation(`/settings/users?user=${encodeURIComponent(user.id)}`)
  }

  const runAction = async (key, request, onSuccess) => {
    setAction(key)
    setActionError('')
    try {
      const data = await readResponse(await request(), t('dashboard.user_update_error'))
      await onSuccess(data)
      return true
    } catch (error) {
      setActionError(error.message)
      return false
    } finally {
      setAction(null)
    }
  }

  const createUser = data => runAction('create', () => fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }), async created => {
    setShowCreate(false)
    await loadUsers(created.id)
    setActiveTab('worlds')
    setLocation(`/settings/users?user=${encodeURIComponent(created.id)}`)
  })

  const updateWorldRole = async (world, nextRole) => {
    if (world.role === nextRole) return
    const hasAccess = world.role !== 'none'
    const url = `/api/worlds/${encodeURIComponent(world.id)}/members${hasAccess ? `/${encodeURIComponent(selectedUser.id)}` : ''}`
    const method = nextRole === 'none' ? 'DELETE' : (hasAccess ? 'PATCH' : 'POST')
    await runAction(`world:${world.id}`, () => fetch(url, {
      method,
      headers: method === 'DELETE' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? undefined : JSON.stringify(hasAccess ? { role: nextRole } : { userId: selectedUser.id, role: nextRole })
    }), async () => {
      setWorlds(current => current.map(item => item.id === world.id ? { ...item, role: nextRole } : item))
      replaceUser({ ...selectedUser, worldCount: worlds.filter(item => item.id === world.id ? nextRole !== 'none' : item.role !== 'none').length })
    })
  }

  if (!currentUser?.globalRole) {
    return null
  }

  return (
    <div className="user-settings-page">
      <header className="user-settings-header">
        <div className="user-settings-header-main">
          <button type="button" className="user-settings-icon-button" onClick={() => setLocation('/')} title={t('dashboard.back_to_worlds')}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>{t('dashboard.users_title')}</h1>
            <p>{t('dashboard.users_page_hint')}</p>
          </div>
        </div>
        <button type="button" className="user-settings-create-button" onClick={() => { setActionError(''); setShowCreate(true) }}>
          <Plus size={18} />
          <span>{t('dashboard.create_user')}</span>
        </button>
      </header>

      <main className={`user-settings-layout ${selectedUser ? 'has-selection' : ''}`}>
        <aside className="user-settings-directory" aria-label={t('dashboard.user_directory')}>
          <div className="user-settings-search">
            <Search size={17} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('dashboard.search_users')} />
          </div>
          <div className="user-settings-filters" aria-label={t('dashboard.filter_user_list')}>
            {['all', 'users', 'admins'].map(value => (
              <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
                {t(`dashboard.filter_${value}`)}
              </button>
            ))}
          </div>
          <div className="user-settings-directory-heading">
            <span>{t('dashboard.user_directory')}</span>
            <strong>{filteredUsers.length}</strong>
          </div>
          <div className="user-settings-user-list">
            {loadingUsers ? <div className="user-settings-empty">{t('common.loading')}</div> : filteredUsers.length === 0 ? (
              <div className="user-settings-empty">{t('dashboard.no_users')}</div>
            ) : filteredUsers.map(user => (
              <button key={user.id} type="button" className={`user-settings-user-row ${selectedId === user.id ? 'active' : ''}`} onClick={() => selectUser(user)}>
                <span className={`user-settings-avatar role-${user.globalRole || 'user'}`}>{user.username.slice(0, 1).toUpperCase()}</span>
                <span className="user-settings-user-copy">
                  <strong>{user.username}</strong>
                  <small>{roleLabel(t, user)}{!user.globalRole && ` · ${t('dashboard.world_count', { count: user.worldCount || 0 })}`}</small>
                </span>
                {user.globalRole ? <ShieldCheck size={16} /> : <Check size={16} />}
              </button>
            ))}
          </div>
        </aside>

        <section className="user-settings-detail">
          {pageError ? <div className="user-admin-error">{pageError}</div> : selectedUser ? (
            <>
              <button type="button" className="user-settings-mobile-back" onClick={() => setSelectedId(null)}><ChevronLeft size={17} />{t('dashboard.all_users')}</button>
              <div className="user-settings-profile-header">
                <span className={`user-settings-avatar large role-${selectedUser.globalRole || 'user'}`}>{selectedUser.username.slice(0, 1).toUpperCase()}</span>
                <div className="user-settings-profile-copy">
                  <span>{roleLabel(t, selectedUser)}</span>
                  <h2>{selectedUser.username}</h2>
                </div>
              </div>

              <nav className="user-settings-tabs">
                <button type="button" className={activeTab === 'account' ? 'active' : ''} onClick={() => setActiveTab('account')}><UserRound size={16} />{t('dashboard.account_tab')}</button>
                <button type="button" className={activeTab === 'worlds' ? 'active' : ''} onClick={() => setActiveTab('worlds')}><Users size={16} />{t('dashboard.user_step_worlds')}</button>
              </nav>

              {actionError && <div className="user-admin-error user-settings-action-error">{actionError}</div>}

              {activeTab === 'account' ? (
                <div className="user-settings-account">
                  <section className="user-settings-section">
                    <div className="user-settings-section-heading"><div><h3>{t('dashboard.account_access')}</h3><p>{t('dashboard.account_access_hint')}</p></div></div>
                    <div className="user-settings-field-row"><span>{t('dashboard.global_role')}</span><strong>{roleLabel(t, selectedUser)}</strong></div>
                    {currentUser.globalRole === 'root' && selectedUser.id !== 'root' && (
                      <button type="button" className="user-admin-secondary user-settings-inline-action" onClick={() => setConfirmAction({ type: 'role', user: selectedUser })}>
                        <ShieldCheck size={16} />{selectedUser.globalRole === 'server-admin' ? t('dashboard.demote_server_admin') : t('dashboard.promote_server_admin')}
                      </button>
                    )}
                  </section>

                  {selectedUser.id === 'root' ? (
                    <section className="user-settings-notice"><ShieldCheck size={20} /><div><strong>{t('dashboard.root_protected')}</strong><p>{t('dashboard.root_protected_hint')}</p></div></section>
                  ) : canEditSelected && (
                    <section className="user-settings-section">
                      <div className="user-settings-section-heading"><div><h3>{t('dashboard.password_access')}</h3><p>{t('dashboard.password_access_hint')}</p></div></div>
                      <div className="user-settings-password-row">
                        <label><KeyRound size={17} /><input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder={t('dashboard.new_password')} /></label>
                        <button type="button" className="user-admin-primary" disabled={action === 'password' || newPassword.length < 4} onClick={() => runAction('password', () => fetch(`/api/users/${encodeURIComponent(selectedUser.id)}/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword }) }), async () => setNewPassword(''))}>{t('dashboard.update_password')}</button>
                      </div>
                    </section>
                  )}

                  {canEditSelected && (
                    <section className="user-settings-danger-zone">
                      <div><h3>{t('dashboard.account_actions')}</h3><p>{t('dashboard.account_actions_hint')}</p></div>
                      <div>
                        <button type="button" className="user-admin-danger" onClick={() => setConfirmAction({ type: 'delete', user: selectedUser })}><Trash2 size={16} />{t('dashboard.delete_user')}</button>
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="user-settings-worlds">
                  <div className="user-settings-section-heading"><div><h3>{t('dashboard.world_access')}</h3><p>{t('dashboard.world_access_hint')}</p></div></div>
                  {selectedUser.globalRole ? (
                    <section className="user-settings-notice"><ShieldCheck size={20} /><div><strong>{t('dashboard.global_access')}</strong><p>{t('dashboard.global_access_hint')}</p></div></section>
                  ) : loadingWorlds ? <div className="user-settings-empty">{t('common.loading')}</div> : worlds.length === 0 ? <div className="user-settings-empty">{t('dashboard.no_worlds')}</div> : (
                    <div className="user-settings-world-list">
                      {worlds.map(world => (
                        <div key={world.id} className="user-settings-world-row">
                          <span>{world.displayName || world.name}</span>
                          <div className="user-admin-role-segments">
                            {['none', 'member', 'admin'].map(role => (
                              <button key={role} type="button" className={world.role === role ? 'active' : ''} disabled={action === `world:${world.id}`} onClick={() => updateWorldRole(world, role)}>{role === 'none' ? t('dashboard.no_access') : t(`workspace.member_role_${role}`)}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : <div className="user-settings-empty detail"><Users size={34} /><span>{t('dashboard.select_user_to_manage')}</span></div>}
        </section>
      </main>

      {showCreate && <CreateUserDialog loading={action === 'create'} error={actionError} onCancel={() => setShowCreate(false)} onCreate={createUser} />}
      {confirmAction && <ConfirmDialog
        title={t(`dashboard.confirm_${confirmAction.type}_title`)}
        description={t(`dashboard.confirm_${confirmAction.type}_description`, { name: confirmAction.user.username })}
        confirmLabel={confirmAction.type === 'delete' ? t('dashboard.delete_user') : t('common.save')}
        danger={confirmAction.type !== 'role' || confirmAction.user.globalRole === 'server-admin'}
        loading={Boolean(action)}
        error={actionError}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const user = confirmAction.user
          if (confirmAction.type === 'role') {
            const globalRole = user.globalRole === 'server-admin' ? null : 'server-admin'
            const ok = await runAction('role', () => fetch(`/api/users/${encodeURIComponent(user.id)}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ globalRole }) }), async updated => replaceUser(updated))
            if (ok) setConfirmAction(null)
          } else {
            const ok = await runAction('delete', () => fetch(`/api/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }), async () => {
              setConfirmAction(null)
              await loadUsers('root')
              setLocation('/settings/users?user=root')
            })
            if (ok) setConfirmAction(null)
          }
        }}
      />}
    </div>
  )
}

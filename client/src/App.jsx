import { useState, useEffect, useMemo, useCallback } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { LogOut, Plus, Settings, Trash2, Key, ShieldCheck, Sparkles, Search, Share2, ChevronDown, ChevronUp, Users, Upload, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WorldWorkspace from './WorldWorkspace'

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('Copy failed')
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const { t } = useTranslation()

  useEffect(() => {
    fetch('/api/auth/verify')
      .then(async res => {
        if (!res.ok) return
        const data = await res.json()
        setIsAuthenticated(Boolean(data.authenticated))
        setCurrentUser(data.user || null)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return <div className="login-container">{t('common.loading')}</div>
  }

  return (
    <Switch>
      <Route path="/world/:id">
        {(params) => {
          const isVisitor = new URLSearchParams(window.location.search).get('view') === 'true';
          if (isAuthenticated || isVisitor) {
            return (
              <>
                <WorldWorkspace params={params} isVisitor={isVisitor && !isAuthenticated} currentUser={currentUser} />
                <div className="workspace-language-wrapper">
                  {isVisitor && !isAuthenticated && <WorldShareButton worldId={params.id} />}
                  <LanguageSwitcher variant="floating" />
                </div>
              </>
            );
          }
          return <Login onLogin={(user) => { setIsAuthenticated(true); setCurrentUser(user); }} />;
        }}
      </Route>
      <Route path="/">
        {isAuthenticated ? (
          <Dashboard
            currentUser={currentUser}
            onLogout={() => {
              setIsAuthenticated(false)
              setCurrentUser(null)
            }}
          />
        ) : (
          <Login onLogin={(user) => { setIsAuthenticated(true); setCurrentUser(user); }} />
        )}
      </Route>
    </Switch>
  );
}

function Login({ onLogin }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [loginUsers, setLoginUsers] = useState([{ id: 'admin', username: 'admin', isAdmin: true }])
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/users')
      .then(async res => {
        if (!res.ok) return
        const data = await res.json()
        const users = data.items?.length ? data.items : [{ id: 'admin', username: 'admin', isAdmin: true }]
        setLoginUsers(users)
      })
      .catch(() => {})
  }, [])

  const filteredLoginUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase()
    if (!query) return loginUsers
    return loginUsers.filter(user => user.username.toLowerCase().includes(query))
  }, [loginUsers, userQuery])

  const selectLoginUser = (user) => {
    setUsername(user.username)
    setUserQuery(user.username)
    setIsUserMenuOpen(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const selectedUser = loginUsers.find(user => user.username.toLowerCase() === userQuery.trim().toLowerCase())
    if (!selectedUser) {
      setError(t('login.select_user_first'))
      return
    }
    setUsername(selectedUser.username)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedUser.username, password })
      })

      if (res.ok) {
        const data = await res.json()
        onLogin(data.user)
      } else {
        const data = await res.json()
        setError(data.error || t('login.failed'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container login-nexus">
      <div className="login-language-wrapper">
        <LanguageSwitcher />
      </div>
      <div className="login-card login-nexus-panel">
        <div className="login-nexus-glow" aria-hidden="true" />
        <div className="login-brand-mark">
          <Sparkles size={22} />
        </div>
        <h1>Mysthra</h1>
        <p>{t('login.subtitle')}</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">
              <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {t('login.username')}
            </label>
            <div className="login-user-combobox">
              <input
                id="username"
                type="text"
                value={userQuery}
                onChange={(e) => {
                  setUserQuery(e.target.value)
                  setUsername('')
                  setIsUserMenuOpen(true)
                }}
                onFocus={() => setIsUserMenuOpen(true)}
                onBlur={() => setTimeout(() => setIsUserMenuOpen(false), 120)}
                placeholder={t('login.username_placeholder')}
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                className="login-user-menu-toggle"
                onMouseDown={(event) => {
                  event.preventDefault()
                  setIsUserMenuOpen(prev => !prev)
                }}
                aria-label={isUserMenuOpen ? t('login.close_user_dropdown') : t('login.open_user_dropdown')}
              >
                {isUserMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {isUserMenuOpen && (
                <div className="login-user-menu">
                  {filteredLoginUsers.length === 0 ? (
                    <div className="login-user-empty">{t('login.no_users_found')}</div>
                  ) : (
                    filteredLoginUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        className={`login-user-option ${user.username === username ? 'active' : ''}`}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          selectLoginUser(user)
                        }}
                      >
                        <span>{user.username}</span>
                        {user.isAdmin && <small>{t('login.admin_user')}</small>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">
              <Key size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {t('login.master_password')}
            </label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.password_placeholder')}
            />
          </div>
          
          {error && <div className="error-msg">{error}</div>}
          
          <button type="submit" className="login-submit-button" disabled={loading}>
            {loading ? (
              <span>{t('login.authenticating')}</span>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>{t('login.enter_nexus')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function Dashboard({ onLogout, currentUser }) {
  const { t } = useTranslation()
  const [, setLocation] = useLocation()
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWorld, setEditingWorld] = useState(null)
  const [deletingWorld, setDeletingWorld] = useState(null)
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isAdmin = Boolean(currentUser?.isAdmin)

  const loadWorlds = async () => {
    try {
      const res = await fetch('/api/worlds')
      if (res.ok) {
        const data = await res.json()
        setWorlds(data.items || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorlds()
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    onLogout()
  }

  const filteredWorlds = useMemo(() => {
    return worlds.filter(w => 
      (w.displayName || w.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [worlds, searchQuery])

  return (
    <div className="dashboard-container">
      {/* Main Content Nexus */}
      <main className="nexus-main">
        <header className="nexus-header">
          <div className="welcome-msg">
            <h1 className="nexus-title-mysthra">Mysthra</h1>
            <p>{t('dashboard.subtitle')}</p>
          </div>

          <div className="nexus-search-group">
            <div className="nexus-search-wrapper">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                className="nexus-search-bar"
                placeholder={t('dashboard.search_universes')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="dashboard-action-group">
              <LanguageSwitcher />

              {isAdmin && (
                <button className="nexus-icon-btn dashboard-users-button" onClick={() => setShowUsersModal(true)} title={t('dashboard.manage_users')}>
                  <Users size={18} />
                </button>
              )}

              <button className="nexus-icon-btn logout-btn-nexus" onClick={handleLogout} title={t('dashboard.logout_tooltip')}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="loading-state-dashboard">
            <div className="spinner"></div>
            <p>{t('dashboard.connecting_to_nexus')}</p>
          </div>
        ) : (
          <div className="nexus-grid">
            {filteredWorlds.map(world => (
              <div key={world.id} className="nexus-card" onClick={() => setLocation(`/world/${world.id}`)}>
                <div
                  className={`nexus-card-bg ${world.thumbnail?.filename ? 'has-thumbnail' : ''}`}
                  style={world.thumbnail?.filename ? { backgroundImage: `url(/api/worlds/${encodeURIComponent(world.id)}/thumbnail?v=${world.thumbnail.updatedAt || 0})` } : undefined}
                ></div>
                {isAdmin && (
                  <div className="nexus-card-actions">
                    <button className="nexus-icon-btn" onClick={(e) => { e.stopPropagation(); setEditingWorld(world); }}>
                      <Settings size={14} />
                    </button>
                    <button className="nexus-icon-btn" onClick={(e) => { e.stopPropagation(); setDeletingWorld(world); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                <div className="nexus-card-content">
                  <h3>{world.displayName || world.name}</h3>
                  <p>{world.description || t('dashboard.default_world_description')}</p>
                </div>
              </div>
            ))}
            
            {/* Create Card */}
            {!searchQuery && isAdmin && (
              <div className="nexus-card nexus-create-btn" onClick={() => setShowModal(true)}>
                <div className="plus-circle-nexus">
                  <Plus size={24} />
                </div>
                <div style={{ fontWeight: 600 }}>{t('dashboard.create_new_world')}</div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals remain the same */}
      {showModal && (
        <CreateWorldModal 
          onClose={() => setShowModal(false)} 
          onCreated={() => {
            setShowModal(false)
            loadWorlds()
          }} 
        />
      )}
      
      {editingWorld && (
        <EditWorldModal 
          world={editingWorld}
          onClose={() => setEditingWorld(null)} 
          onUpdated={() => {
            setEditingWorld(null)
            loadWorlds()
          }} 
        />
      )}

      {deletingWorld && (
        <DeleteWorldModal 
          world={deletingWorld}
          onClose={() => setDeletingWorld(null)} 
          onDeleted={() => {
            setDeletingWorld(null)
            loadWorlds()
          }} 
        />
      )}

      {showUsersModal && (
        <UserSettingsModal
          onClose={() => setShowUsersModal(false)}
        />
      )}
    </div>
  )
}



function UserSettingsModal({ onClose }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [worlds, setWorlds] = useState([])
  const [memberships, setMemberships] = useState({})
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetPasswords, setResetPasswords] = useState({})
  const [accessUser, setAccessUser] = useState(null)
  const [activeTab, setActiveTab] = useState('user')
  const [userSearch, setUserSearch] = useState('')
  const [deleteUserPrompt, setDeleteUserPrompt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, worldsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/worlds')
      ])
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.items || [])
      }
      let loadedWorlds = []
      if (worldsRes.ok) {
        const data = await worldsRes.json()
        loadedWorlds = data.items || []
        setWorlds(loadedWorlds)
      }
      const memberPairs = await Promise.all(
        loadedWorlds.map(async world => {
          const res = await fetch(`/api/worlds/${encodeURIComponent(world.id)}/members`)
          if (!res.ok) return [world.id, []]
          const data = await res.json()
          return [world.id, data.items || []]
        })
      )
      const nextMemberships = {}
      for (const [worldId, members] of memberPairs) {
        for (const member of members) {
          if (!nextMemberships[member.userId]) nextMemberships[member.userId] = {}
          nextMemberships[member.userId][worldId] = member.role || 'member'
        }
      }
      setMemberships(nextMemberships)
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const filteredUsers = users.filter(user => user.username.toLowerCase().includes(userSearch.trim().toLowerCase()))

  const selectUser = (user) => {
    setAccessUser(user)
    setActiveTab('user')
  }

  const createUser = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (res.ok) {
        setUsername('')
        setPassword('')
        await loadUsers()
      } else {
        const data = await res.json()
        setError(data.error || t('dashboard.user_create_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  const toggleWorldAccess = async (userId, worldId, hasAccess, role = 'member') => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/members${hasAccess ? `/${encodeURIComponent(userId)}` : ''}`, {
        method: hasAccess ? 'DELETE' : 'POST',
        headers: hasAccess ? undefined : { 'Content-Type': 'application/json' },
        body: hasAccess ? undefined : JSON.stringify({ userId, role })
      })
      if (res.ok) {
        setMemberships(prev => {
          const current = { ...(prev[userId] || {}) }
          if (hasAccess) delete current[worldId]
          else current[worldId] = role
          return { ...prev, [userId]: current }
        })
      } else {
        const data = await res.json()
        setError(data.error || t('dashboard.user_update_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  const changeWorldRole = async (userId, worldId, role) => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/members/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      if (res.ok) {
        setMemberships(prev => ({
          ...prev,
          [userId]: {
            ...(prev[userId] || {}),
            [worldId]: role
          }
        }))
      } else {
        const data = await res.json()
        setError(data.error || t('dashboard.user_update_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (userId) => {
    const nextPassword = resetPasswords[userId]
    if (!nextPassword) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nextPassword })
      })
      if (res.ok) {
        setResetPasswords(prev => ({ ...prev, [userId]: '' }))
      } else {
        const data = await res.json()
        setError(data.error || t('dashboard.user_update_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async (user) => {
    if (!user) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteUserPrompt(null)
        if (accessUser?.id === user.id) setAccessUser(null)
        await loadUsers()
      } else {
        const data = await res.json()
        setError(data.error || t('dashboard.user_update_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="user-admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-admin-title">
        <div className="user-admin-modal-header">
          <div>
            <h2 id="user-admin-title">{t('dashboard.manage_users')}</h2>
            <p>{t('dashboard.manage_users_hint')}</p>
          </div>
          <button type="button" className="user-admin-close" onClick={onClose} disabled={saving} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="user-admin-modal-body user-admin-flow">
          <aside className="user-admin-directory-panel">
            <form className="user-admin-create-card" onSubmit={createUser}>
              <div className="user-admin-section-title">{t('dashboard.create_user')}</div>
              <div className="user-admin-form-stack">
                <label>
                  <span>{t('login.username')}</span>
                  <input value={username} onChange={event => setUsername(event.target.value)} placeholder={t('login.username_placeholder')} required />
                </label>
                <label className="user-admin-password-input-wrap">
                  <span>{t('login.master_password')}</span>
                  <div className="user-admin-password-input">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={t('login.password_placeholder')} required />
                    <button type="button" className="user-admin-password-toggle" onClick={() => setShowPassword(prev => !prev)} tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <button type="submit" className="user-admin-primary" disabled={saving}>
                  {saving ? t('common.saving') : t('dashboard.create_user')}
                </button>
              </div>
            </form>

            <section className="user-admin-directory">
              <div className="user-admin-section-title">{t('dashboard.user_directory')}</div>
              <input className="user-admin-search" value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder={t('dashboard.search_users')} />
              <div className="user-admin-list">
                {loading ? (
                  <div className="user-admin-empty compact">{t('common.loading')}</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="user-admin-empty compact">{t('dashboard.no_users')}</div>
                ) : (
                  filteredUsers.map(user => {
                    const accessCount = Object.keys(memberships[user.id] || {}).length
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={`user-admin-user-card ${accessUser?.id === user.id ? 'active' : ''}`}
                        onClick={() => selectUser(user)}
                      >
                        <span className="user-admin-avatar">{String(user.username || '?').slice(0, 1).toUpperCase()}</span>
                        <span className="user-admin-user-main">
                          <strong>{user.username}</strong>
                          <small>{accessCount} {accessCount === 1 ? t('dashboard.world_count_singular') : t('dashboard.world_count_plural')}</small>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </section>
          </aside>

          <section className="user-admin-flow-panel">
            {accessUser ? (
              <>
                <div className="user-admin-flow-header">
                  <div className="user-admin-avatar large">{String(accessUser.username || '?').slice(0, 1).toUpperCase()}</div>
                  <div>
                    <span>{t('dashboard.configuring_access_for')}</span>
                    <h3>{accessUser.username}</h3>
                  </div>
                </div>

                <nav className="user-admin-steps" aria-label={t('dashboard.manage_users')}>
                  <button type="button" className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')}>
                    {t('dashboard.user_step_profile')}
                  </button>
                  <button type="button" className={activeTab === 'worlds' ? 'active' : ''} onClick={() => setActiveTab('worlds')}>
                    {t('dashboard.user_step_worlds')}
                  </button>
                </nav>

                <div className="user-admin-step-card">
                  {activeTab === 'user' && (
                    <div className="user-admin-step-section">
                      <div>
                        <div className="user-admin-section-title">{t('dashboard.user_step_profile')}</div>
                        <p>{t('dashboard.user_profile_hint')}</p>
                      </div>
                      <div className="user-admin-profile-row">
                        <span>{t('login.username')}</span>
                        <strong>{accessUser.username}</strong>
                      </div>
                      <button type="button" className="user-admin-text-danger" onClick={() => setDeleteUserPrompt(accessUser)} disabled={saving}>
                        {t('dashboard.delete_user')}
                      </button>
                      <div>
                        <div className="user-admin-section-title">{t('dashboard.password_access')}</div>
                        <p>{t('dashboard.password_access_hint')}</p>
                      </div>
                      <div className="user-admin-password compact">
                        <label className="user-admin-password-field">
                          <Key size={15} />
                          <input type="password" value={resetPasswords[accessUser.id] || ''} onChange={event => setResetPasswords(prev => ({ ...prev, [accessUser.id]: event.target.value }))} placeholder={t('dashboard.new_password')} disabled={saving} />
                        </label>
                        <button type="button" className="user-admin-secondary" onClick={() => changePassword(accessUser.id)} disabled={saving || !resetPasswords[accessUser.id]}>
                          {t('dashboard.update_password')}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'worlds' && (
                    <div className="user-admin-step-section user-admin-world-step">
                    <div>
                      <div className="user-admin-section-title">{t('dashboard.world_access')}</div>
                      <p>{t('dashboard.world_access_hint')}</p>
                    </div>
                  <div className="user-admin-world-list">
                    {worlds.length === 0 ? (
                      <div className="user-admin-empty">{t('dashboard.no_worlds')}</div>
                    ) : (
                        worlds.map(world => {
                        const role = memberships[accessUser.id]?.[world.id] || 'none'
                        const hasAccess = role !== 'none'
                        return (
                          <div key={world.id} className="user-admin-world-access-row">
                            <div className="user-admin-world-copy">
                              <span>{world.displayName || world.name}</span>
                            </div>
                            <div className="user-admin-role-segments" aria-label={t('dashboard.world_access')}>
                              {[
                                ['none', t('dashboard.no_access')],
                                ['member', t('workspace.member_role_member')],
                                ['admin', t('workspace.member_role_admin')]
                              ].map(([nextRole, label]) => (
                                <button key={nextRole} type="button" className={role === nextRole ? 'active' : ''} disabled={saving} onClick={() => {
                                  if (nextRole === role) return
                                  if (nextRole === 'none') {
                                    if (hasAccess) toggleWorldAccess(accessUser.id, world.id, true)
                                    return
                                  }
                                  if (!hasAccess) toggleWorldAccess(accessUser.id, world.id, false, nextRole)
                                  else changeWorldRole(accessUser.id, world.id, nextRole)
                                }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="user-admin-empty user-admin-select-empty">
                <Users size={36} />
                <span>{t('dashboard.select_user_to_manage')}</span>
              </div>
            )}
          </section>

          {error && <div className="user-admin-error">{error}</div>}
        </div>

        {deleteUserPrompt && (
          <div className="user-admin-confirm">
            <div className="user-admin-confirm-card">
              <h3>{t('dashboard.delete_user')}</h3>
              <p>{t('dashboard.delete_user_confirm', { name: deleteUserPrompt.username })}</p>
              <div>
                <button type="button" className="user-admin-secondary" onClick={() => setDeleteUserPrompt(null)} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="user-admin-danger" onClick={() => deleteUser(deleteUserPrompt)} disabled={saving}>
                  {t('dashboard.delete_user')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CreateWorldModal({ onClose, onCreated }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [publicRead, setPublicRead] = useState(false)
  const [thumbnailPreview, setThumbnailPreview] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/worlds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          publicRead
        })
      })

      if (res.ok) {
        const world = await res.json()
        if (thumbnailFile) {
          const query = new URLSearchParams({ filename: thumbnailFile.name })
          const thumbRes = await fetch(`/api/worlds/${encodeURIComponent(world.name)}/thumbnail?${query.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': thumbnailFile.type || 'application/octet-stream' },
            body: await thumbnailFile.arrayBuffer()
          })
          if (!thumbRes.ok) {
            const data = await thumbRes.json()
            setError(data.error || t('dashboard.thumbnail_error'))
            setSaving(false)
            return
          }
        }
        onCreated()
      } else {
        const data = await res.json()
        setError(data.error || t('dashboard.create_world_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  const handleThumbnailChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel">
        <h2>{t('dashboard.create_new_world')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>{t('dashboard.world_name')}</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={t('dashboard.world_name_placeholder')}
              required
              autoFocus
            />
          </div>
          
          <div className="input-group">
            <label>{t('dashboard.short_description')}</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder={t('dashboard.short_description_placeholder')}
            />
          </div>

          <div className="input-group">
            <label>{t('dashboard.world_thumbnail')}</label>
            <label className="world-thumbnail-picker">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleThumbnailChange} />
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="" />
              ) : (
                <span><Upload size={18} /> {t('dashboard.choose_thumbnail')}</span>
              )}
            </label>
          </div>

          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={publicRead}
              onChange={e => setPublicRead(e.target.checked)}
            />
            <span>
              <strong>{t('dashboard.public_read')}</strong>
              <small>{t('dashboard.public_read_hint')}</small>
            </span>
          </label>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.creating') : t('dashboard.create_world_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditWorldModal({ world, onClose, onUpdated }) {
  const { t } = useTranslation()
  const [name, setName] = useState(world.displayName || '')
  const [description, setDescription] = useState(world.description || '')
  const [publicRead, setPublicRead] = useState(Boolean(world.publicRead))
  const [thumbnailPreview, setThumbnailPreview] = useState(world.thumbnail?.filename ? `/api/worlds/${encodeURIComponent(world.id)}/thumbnail?v=${world.thumbnail.updatedAt || 0}` : '')
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch(`/api/worlds/${world.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          publicRead
        })
      })

      if (res.ok) {
        if (thumbnailFile) {
          const query = new URLSearchParams({ filename: thumbnailFile.name });
          const thumbRes = await fetch(`/api/worlds/${encodeURIComponent(world.id)}/thumbnail?${query.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': thumbnailFile.type || 'application/octet-stream' },
            body: await thumbnailFile.arrayBuffer()
          })
          if (!thumbRes.ok) {
            const data = await thumbRes.json()
            setError(data.error || t('dashboard.thumbnail_error'))
            setSaving(false)
            return
          }
        }
        onUpdated()
      } else {
        const data = await res.json()
        setError(data.error || t('dashboard.create_world_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  const handleThumbnailChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel">
        <h2>{t('dashboard.edit_world')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>{t('dashboard.world_name')}</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>
          
          <div className="input-group">
            <label>{t('dashboard.short_description')}</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
          </div>

          <div className="input-group">
            <label>{t('dashboard.world_thumbnail')}</label>
            <label className="world-thumbnail-picker">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleThumbnailChange} />
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="" />
              ) : (
                <span><Upload size={18} /> {t('dashboard.choose_thumbnail')}</span>
              )}
            </label>
          </div>

          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={publicRead}
              onChange={e => setPublicRead(e.target.checked)}
            />
            <span>
              <strong>{t('dashboard.public_read')}</strong>
              <small>{t('dashboard.public_read_hint')}</small>
            </span>
          </label>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('dashboard.save_changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteWorldModal({ world, onClose, onDeleted }) {
  const { t } = useTranslation()
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async (e) => {
    e.preventDefault()
    
    const targetName = world.displayName || world.name
    if (confirmName !== targetName) {
      setError(t('dashboard.name_mismatch_error'))
      return
    }

    setError('')
    setDeleting(true)

    try {
      const res = await fetch(`/api/worlds/${world.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        onDeleted()
      } else {
        const data = await res.json()
        setError(data.error || t('common.delete_error'))
      }
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel" style={{ borderColor: 'var(--error-color)' }}>
        <h2 style={{ color: 'var(--error-color)' }}>{t('dashboard.delete_world_title')}</h2>
        <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
          {t('dashboard.delete_confirm_prefix')} <strong>{world.displayName || world.name}</strong>{t('dashboard.delete_confirm_suffix')}
        </p>
        <form onSubmit={handleDelete}>
          <div className="input-group">
            <label>{t('dashboard.confirm_name_label')}</label>
            <input 
              type="text" 
              value={confirmName} 
              onChange={e => setConfirmName(e.target.value)} 
              placeholder={world.displayName || world.name}
              required
              autoFocus
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--error-color)' }} disabled={deleting || confirmName !== (world.displayName || world.name)}>
              {deleting ? t('common.deleting') : t('dashboard.confirm_delete_world')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function WorldShareButton({ worldId }) {
  const { t } = useTranslation()

  const shareWorld = async () => {
    const shareUrl = new URL(`/world/${encodeURIComponent(worldId)}`, window.location.origin)
    shareUrl.searchParams.set('view', 'true')
    await copyTextToClipboard(shareUrl.toString())
  }

  return (
    <button
      className="nexus-icon-btn workspace-share-floating"
      onClick={shareWorld}
      title={t('workspace.share_world')}
    >
      <Share2 size={18} />
    </button>
  )
}

function LanguageSwitcher({ variant = 'default' }) {
  const { i18n } = useTranslation();
  const currentLanguage = String(i18n.language || 'pt').slice(0, 2).toLowerCase();
  const languageLabel = currentLanguage === 'en' ? 'en' : 'pt';

  const toggleLanguage = () => {
    const nextLng = languageLabel === 'pt' ? 'en' : 'pt';
    i18n.changeLanguage(nextLng);
  };

  return (
    <button 
      className={`nexus-icon-btn language-switcher language-switcher-${variant}`}
      onClick={toggleLanguage} 
      title={languageLabel === 'pt' ? 'Switch to English' : 'Mudar para Português'}
    >
      <span>
        {languageLabel}
      </span>
    </button>
  );
}

export default App

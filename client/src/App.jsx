import { useState, useEffect, useMemo } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { LogOut, Plus, Settings, Trash2, Key, ShieldCheck, Sparkles, Search, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WorldWorkspace from './WorldWorkspace'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const { t } = useTranslation()

  useEffect(() => {
    fetch('/api/auth/verify')
      .then(res => {
        if (res.ok) setIsAuthenticated(true)
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
                <WorldWorkspace params={params} />
                <div className="workspace-language-wrapper">
                  <LanguageSwitcher variant="floating" />
                </div>
              </>
            );
          }
          return <Login onLogin={() => setIsAuthenticated(true)} />;
        }}
      </Route>
      <Route path="/">
        {isAuthenticated ? (
          <Dashboard onLogout={() => setIsAuthenticated(false)} />
        ) : (
          <Login onLogin={() => setIsAuthenticated(true)} />
        )}
      </Route>
    </Switch>
  );
}

function Login({ onLogin }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        onLogin()
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
    <div className="login-container">
      <div className="login-language-wrapper">
        <LanguageSwitcher />
      </div>
      <div className="login-card glass-panel">
        <Sparkles size={40} color="var(--accent-color)" style={{ marginBottom: 16 }} />
        <h1>Mysthra</h1>
        <p>{t('login.subtitle')}</p>
        
        <form onSubmit={handleSubmit}>
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
              autoFocus
            />
          </div>
          
          {error && <div className="error-msg">{error}</div>}
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? (
              t('login.authenticating')
            ) : (
              <><ShieldCheck size={18} style={{ marginRight: 8 }} /> {t('login.enter_nexus')}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function Dashboard({ onLogout }) {
  const { t } = useTranslation()
  const [, setLocation] = useLocation()
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWorld, setEditingWorld] = useState(null)
  const [deletingWorld, setDeletingWorld] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

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
            
            <LanguageSwitcher />

            <button className="nexus-icon-btn logout-btn-nexus" onClick={handleLogout} title={t('dashboard.logout_tooltip')}>
              <LogOut size={18} />
            </button>
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
                <div className="nexus-card-bg"></div>
                <div className="nexus-card-actions">
                  <button className="nexus-icon-btn" onClick={(e) => { e.stopPropagation(); setEditingWorld(world); }}>
                    <Settings size={14} />
                  </button>
                  <button className="nexus-icon-btn" onClick={(e) => { e.stopPropagation(); setDeletingWorld(world); }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="nexus-card-content">
                  <h3>{world.displayName || world.name}</h3>
                  <p>{world.description || t('dashboard.default_world_description')}</p>
                </div>
              </div>
            ))}
            
            {/* Create Card */}
            {!searchQuery && (
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
    </div>
  )
}



function CreateWorldModal({ onClose, onCreated }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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
          description
        })
      })

      if (res.ok) {
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
          description
        })
      })

      if (res.ok) {
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
          {t('dashboard.delete_confirm_msg', { name: world.displayName || world.name })}
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

function LanguageSwitcher({ variant = 'default' }) {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLng = i18n.language === 'pt' ? 'en' : 'pt';
    i18n.changeLanguage(nextLng);
  };

  return (
    <button 
      className={`nexus-icon-btn language-switcher language-switcher-${variant}`}
      onClick={toggleLanguage} 
      title={i18n.language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
    >
      <Languages size={18} />
      <span>
        {i18n.language}
      </span>
    </button>
  );
}

export default App

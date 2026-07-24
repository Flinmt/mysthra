import { useState, useEffect, useMemo } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import WorldWorkspace from './WorldWorkspace'
import UserSettingsPage from './features/users/UserSettingsPage'
import Login from './features/auth/Login'
import WorldDashboard from './features/worlds/WorldDashboard'
import WorldDialog from './features/worlds/WorldDialog'
import WorldSettingsDialog from './features/worlds/WorldSettingsDialog'

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
    return <div className="auth-shell"><div className="auth-loading">{t('common.loading')}</div></div>
  }

  return (
    <Switch>
      <Route path="/settings/users">
        {isAuthenticated && currentUser?.globalRole ? (
          <UserSettingsPage currentUser={currentUser} />
        ) : isAuthenticated ? (
          <Redirect to="/" />
        ) : (
          <Login languageSwitcher={<LanguageSwitcher />} onLogin={(user) => { setIsAuthenticated(true); setCurrentUser(user); }} />
        )}
      </Route>
      <Route path="/world/:id">
        {(params) => {
          const isVisitor = new URLSearchParams(window.location.search).get('view') === 'true';
          if (isAuthenticated || isVisitor) {
            return (
              <WorldWorkspace
                params={params}
                isVisitor={isVisitor && !isAuthenticated}
                currentUser={currentUser}
                languageSwitcher={<LanguageSwitcher variant="workspace" />}
              />
            );
          }
          return <Login languageSwitcher={<LanguageSwitcher />} onLogin={(user) => { setIsAuthenticated(true); setCurrentUser(user); }} />;
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
          <Login languageSwitcher={<LanguageSwitcher />} onLogin={(user) => { setIsAuthenticated(true); setCurrentUser(user); }} />
        )}
      </Route>
    </Switch>
  );
}

function Dashboard({ onLogout, currentUser }) {
  const [, setLocation] = useLocation()
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWorld, setEditingWorld] = useState(null)
  const [deletingWorld, setDeletingWorld] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadError, setLoadError] = useState(false)
  const loadWorlds = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/worlds')
      if (!res.ok) throw new Error('Failed to load worlds')
      const data = await res.json()
      setWorlds(data.items || [])
    } catch (e) {
      console.error(e)
      setLoadError(true)
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
    <div>
      <WorldDashboard
        currentUser={currentUser}
        worldCount={worlds.length}
        filteredWorlds={filteredWorlds}
        loading={loading}
        error={loadError}
        searchQuery={searchQuery}
        languageSwitcher={<LanguageSwitcher />}
        onSearchChange={setSearchQuery}
        onRetry={loadWorlds}
        onCreate={() => setShowModal(true)}
        onOpen={world => setLocation(`/world/${world.id}`)}
        onEdit={setEditingWorld}
        onDelete={setDeletingWorld}
        onManageUsers={() => setLocation('/settings/users')}
        onLogout={handleLogout}
      />

      {showModal && (
        <WorldSettingsDialog
          mode="create"
          currentUser={currentUser}
          onClose={() => setShowModal(false)} 
          onCreated={() => {
            setShowModal(false)
            loadWorlds()
          }} 
        />
      )}
      
      {editingWorld && (
        <WorldSettingsDialog
          mode="edit"
          world={editingWorld}
          currentUser={currentUser}
          onClose={() => setEditingWorld(null)} 
          onSaved={() => {
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
    <WorldDialog title={t('dashboard.delete_world_title')} description={t('dashboard.delete_world_hint')} onClose={onClose} busy={deleting} tone="danger">
      <form className="world-dialog-form" onSubmit={handleDelete}>
        <div className="world-dialog-body world-delete-dialog-body">
        <p className="world-delete-warning">
          {t('dashboard.delete_confirm_prefix')} <strong>{world.displayName || world.name}</strong>{t('dashboard.delete_confirm_suffix')}
        </p>
          <div className="input-group">
            <label htmlFor="delete-world-name">{t('dashboard.confirm_name_label')}</label>
            <input 
              id="delete-world-name"
              type="text" 
              value={confirmName} 
              onChange={e => setConfirmName(e.target.value)} 
              placeholder={world.displayName || world.name}
              required
              autoFocus
            />
          </div>
        </div>

          {error && <div className="error-msg world-form-error">{error}</div>}

          <div className="world-dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary world-dialog-danger-action" disabled={deleting || confirmName !== (world.displayName || world.name)}>
              {deleting ? t('common.deleting') : t('dashboard.confirm_delete_world')}
            </button>
          </div>
        </form>
    </WorldDialog>
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

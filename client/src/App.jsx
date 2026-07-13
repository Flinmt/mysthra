import { useState, useEffect, useMemo } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { LogOut, Plus, Settings, Trash2, Search, Share2, Users, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WorldWorkspace from './WorldWorkspace'
import UserSettingsPage from './features/users/UserSettingsPage'
import Login from './features/auth/Login'
import DropdownSelect from './components/ui/DropdownSelect'
import {
  DEFAULT_WORLD_THEME,
  WORLD_THEMES,
  getThemeColors,
  getThemeSwatches,
  getWorldTheme,
  normalizeCustomTheme
} from './worldThemes'

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
              <>
                <WorldWorkspace params={params} isVisitor={isVisitor && !isAuthenticated} currentUser={currentUser} />
                <div className="workspace-language-wrapper">
                  {isVisitor && !isAuthenticated && <WorldShareButton worldId={params.id} />}
                  <LanguageSwitcher variant="floating" />
                </div>
              </>
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
  const { t } = useTranslation()
  const [, setLocation] = useLocation()
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWorld, setEditingWorld] = useState(null)
  const [deletingWorld, setDeletingWorld] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const isGlobalAdmin = Boolean(currentUser?.globalRole)

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

              {isGlobalAdmin && (
                <button className="nexus-icon-btn dashboard-users-button" onClick={() => setLocation('/settings/users')} title={t('dashboard.manage_users')}>
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
                {isGlobalAdmin && (
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
            {!searchQuery && isGlobalAdmin && (
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



const CUSTOM_THEME_COLOR_FIELDS = [
  ['background', 'dashboard.theme_color_background'],
  ['surface', 'dashboard.theme_color_surface'],
  ['text', 'dashboard.theme_color_text'],
  ['mutedText', 'dashboard.theme_color_muted_text'],
  ['accent', 'dashboard.theme_color_accent'],
  ['secondaryAccent', 'dashboard.theme_color_secondary_accent']
]
const CUSTOM_THEME_OPTION = 'custom'

function buildCustomThemePayload(enabled, colors) {
  return enabled ? normalizeCustomTheme({ colors }) : null
}

function ThemeSelect({ value, customTheme, onChange }) {
  const { t } = useTranslation()
  const isCustomTheme = value === CUSTOM_THEME_OPTION
  const selectedTheme = isCustomTheme ? getWorldTheme(DEFAULT_WORLD_THEME) : getWorldTheme(value)
  const swatches = getThemeSwatches(selectedTheme.id, customTheme)
  const options = [
    ...WORLD_THEMES.map(theme => ({ value: theme.id, label: t(theme.labelKey) })),
    { value: CUSTOM_THEME_OPTION, label: t('dashboard.theme_custom') }
  ]

  return (
    <div className="input-group world-theme-field world-form-field">
      <label>{t('dashboard.world_theme')}</label>
      <DropdownSelect
        className="world-theme-dropdown"
        value={isCustomTheme ? CUSTOM_THEME_OPTION : selectedTheme.id}
        onChange={onChange}
        options={options}
        placeholder={t('dashboard.world_theme')}
      />
      <div className="world-theme-preview" aria-hidden="true">
        {swatches.map(color => (
          <span key={color} style={{ backgroundColor: color }} />
        ))}
      </div>
      <small>{t('dashboard.world_theme_hint')}</small>
    </div>
  )
}

function ThemeColorPicker({ theme, enabled, colors, onColorsChange }) {
  const { t } = useTranslation()

  const resetToPreset = () => {
    onColorsChange(getThemeColors(theme))
  }

  return (
    <div className="input-group world-custom-theme-field world-form-field">
      {enabled && (
        <div className="world-custom-theme-controls">
          <div className="world-custom-theme-copy">
            <strong>{t('dashboard.theme_customize_colors')}</strong>
            <small>{t('dashboard.theme_customize_colors_hint')}</small>
          </div>
          <div className="world-custom-theme-grid">
            {CUSTOM_THEME_COLOR_FIELDS.map(([key, labelKey]) => (
              <label
                key={key}
                className="world-color-control"
                style={{ backgroundColor: colors[key] }}
                title={t(labelKey)}
              >
                <input
                  type="color"
                  aria-label={t(labelKey)}
                  value={colors[key]}
                  onChange={event => onColorsChange({ ...colors, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <button type="button" className="btn-secondary world-custom-theme-reset" onClick={resetToPreset}>
            {t('dashboard.theme_restore_preset')}
          </button>
        </div>
      )}
    </div>
  )
}

function WorldFormFields({
  name,
  setName,
  description,
  setDescription,
  theme,
  setTheme,
  customThemeEnabled,
  setCustomThemeEnabled,
  customThemeColors,
  setCustomThemeColors,
  publicRead,
  setPublicRead,
  thumbnailPreview,
  handleThumbnailChange,
  isEditing
}) {
  const { t } = useTranslation()
  const customTheme = buildCustomThemePayload(customThemeEnabled, customThemeColors)
  const selectedThemeValue = customThemeEnabled ? CUSTOM_THEME_OPTION : theme

  return (
    <div className="world-form-body">
      <div className="world-form-grid">
        <section className="world-form-section">
          <div className="world-form-section-heading">
            <span>{t('dashboard.world_form_identity')}</span>
          </div>
          <div className="input-group world-form-field">
            <label>{t('dashboard.world_name')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isEditing ? undefined : t('dashboard.world_name_placeholder')}
              required
              autoFocus={!isEditing}
            />
          </div>

          <div className="input-group world-form-field">
            <label>{t('dashboard.short_description')}</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isEditing ? undefined : t('dashboard.short_description_placeholder')}
            />
          </div>

          <div className="input-group world-form-field world-form-thumbnail-field">
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
        </section>

        <section className="world-form-section">
          <div className="world-form-section-heading">
            <span>{t('dashboard.world_form_appearance')}</span>
          </div>
          <ThemeSelect
            value={selectedThemeValue}
            customTheme={customTheme}
            onChange={nextTheme => {
              if (nextTheme === CUSTOM_THEME_OPTION) {
                setCustomThemeEnabled(true)
                return
              }
              setTheme(nextTheme)
              setCustomThemeEnabled(false)
              setCustomThemeColors(getThemeColors(nextTheme))
            }}
          />

          <ThemeColorPicker
            theme={theme}
            enabled={customThemeEnabled}
            colors={customThemeColors}
            onColorsChange={setCustomThemeColors}
          />

          <label className="settings-checkbox world-public-read-toggle">
            <input
              type="checkbox"
              checked={publicRead}
              onChange={e => setPublicRead(e.target.checked)}
            />
            <span>
              <strong>{t('dashboard.public_read')}</strong>
            </span>
          </label>
        </section>
      </div>
    </div>
  )
}

function CreateWorldModal({ onClose, onCreated }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState(DEFAULT_WORLD_THEME)
  const [customThemeEnabled, setCustomThemeEnabled] = useState(false)
  const [customThemeColors, setCustomThemeColors] = useState(() => getThemeColors(DEFAULT_WORLD_THEME))
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
          theme,
          customTheme: buildCustomThemePayload(customThemeEnabled, customThemeColors),
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
      <div className="modal-content glass-panel world-form-modal">
        <form onSubmit={handleSubmit}>
          <div className="world-form-header">
            <h2>{t('dashboard.create_new_world')}</h2>
          </div>
          <WorldFormFields
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            theme={theme}
            setTheme={setTheme}
            customThemeEnabled={customThemeEnabled}
            setCustomThemeEnabled={setCustomThemeEnabled}
            customThemeColors={customThemeColors}
            setCustomThemeColors={setCustomThemeColors}
            publicRead={publicRead}
            setPublicRead={setPublicRead}
            thumbnailPreview={thumbnailPreview}
            handleThumbnailChange={handleThumbnailChange}
          />
          {error && <div className="error-msg world-form-error">{error}</div>}

          <div className="modal-actions world-form-actions">
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
  const [theme, setTheme] = useState(getWorldTheme(world.theme).id)
  const [customThemeEnabled, setCustomThemeEnabled] = useState(Boolean(world.customTheme))
  const [customThemeColors, setCustomThemeColors] = useState(() => getThemeColors(world.theme, world.customTheme))
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
          theme,
          customTheme: buildCustomThemePayload(customThemeEnabled, customThemeColors),
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
      <div className="modal-content glass-panel world-form-modal">
        <form onSubmit={handleSubmit}>
          <div className="world-form-header">
            <h2>{t('dashboard.edit_world')}</h2>
          </div>
          <WorldFormFields
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            theme={theme}
            setTheme={setTheme}
            customThemeEnabled={customThemeEnabled}
            setCustomThemeEnabled={setCustomThemeEnabled}
            customThemeColors={customThemeColors}
            setCustomThemeColors={setCustomThemeColors}
            publicRead={publicRead}
            setPublicRead={setPublicRead}
            thumbnailPreview={thumbnailPreview}
            handleThumbnailChange={handleThumbnailChange}
            isEditing
          />
          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions world-form-actions">
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

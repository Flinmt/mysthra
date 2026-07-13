import { useState, useEffect, useMemo } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { Palette, Share2, SlidersHorizontal, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WorldWorkspace from './WorldWorkspace'
import UserSettingsPage from './features/users/UserSettingsPage'
import Login from './features/auth/Login'
import WorldDashboard from './features/worlds/WorldDashboard'
import WorldDialog from './features/worlds/WorldDialog'
import {
  DEFAULT_WORLD_THEME,
  WORLD_THEMES,
  getThemeColors,
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
function buildCustomThemePayload(enabled, colors) {
  return enabled ? normalizeCustomTheme({ colors }) : null
}

function ThemePresetSelect({ value, onChange }) {
  const { t } = useTranslation()

  return (
    <div className="world-theme-presets">
      <div className="world-appearance-heading">
        <strong>{t('dashboard.world_theme')}</strong>
        <small>{t('dashboard.theme_preset_hint')}</small>
      </div>
      <div className="world-theme-preset-grid">
        {WORLD_THEMES.map(preset => (
          <button key={preset.id} type="button" className={value === preset.id ? 'active' : ''} aria-pressed={value === preset.id} onClick={() => onChange(preset.id)}>
            <span className="world-theme-preset-swatches" aria-hidden="true">
              {preset.swatches.map(color => <i key={color} style={{ backgroundColor: color }} />)}
            </span>
            <strong>{t(preset.labelKey)}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

function ThemeColorPicker({ theme, colors, onEnabledChange, onColorsChange }) {
  const { t } = useTranslation()

  const resetToPreset = () => {
    onColorsChange(getThemeColors(theme))
    onEnabledChange(false)
  }

  return (
    <div className="world-custom-theme-field">
      <div className="world-custom-theme-controls">
        <div className="world-custom-theme-copy">
          <strong>{t('dashboard.theme_customize_colors')}</strong>
          <small>{t('dashboard.theme_customize_colors_hint')}</small>
        </div>
        <div className="world-custom-theme-grid">
          {CUSTOM_THEME_COLOR_FIELDS.map(([key, labelKey]) => (
            <label key={key} className="world-native-color-control">
              <input
                type="color"
                value={colors[key]}
                aria-label={t(labelKey)}
                onChange={event => {
                  onEnabledChange(true)
                  onColorsChange({ ...colors, [key]: event.target.value })
                }}
              />
              <span><strong>{t(labelKey)}</strong><small>{colors[key].toUpperCase()}</small></span>
            </label>
          ))}
        </div>
        <button type="button" className="btn-secondary world-custom-theme-reset" onClick={resetToPreset}>
          {t('dashboard.theme_restore_preset')}
        </button>
      </div>
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
  const [activeTab, setActiveTab] = useState('general')
  return (
    <div className="world-form-tabs-layout">
      <nav className="world-form-tabs" role="tablist" aria-label={t('dashboard.world_settings_tabs')}>
        <button type="button" role="tab" aria-selected={activeTab === 'general'} aria-controls="world-general-panel" className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>
          <SlidersHorizontal size={15} />{t('dashboard.world_tab_general')}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'appearance'} aria-controls="world-appearance-panel" className={activeTab === 'appearance' ? 'active' : ''} onClick={() => setActiveTab('appearance')}>
          <Palette size={15} />{t('dashboard.world_tab_appearance')}
        </button>
      </nav>

      {activeTab === 'general' && (
        <section id="world-general-panel" className="world-form-section" role="tabpanel">
          <div className="input-group world-form-field">
            <label htmlFor="world-name">{t('dashboard.world_name')}</label>
            <input
              id="world-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isEditing ? undefined : t('dashboard.world_name_placeholder')}
              required
              autoFocus={!isEditing}
            />
          </div>

          <div className="input-group world-form-field">
            <label htmlFor="world-description">{t('dashboard.short_description')}</label>
            <input
              id="world-description"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isEditing ? undefined : t('dashboard.short_description_placeholder')}
            />
          </div>

          <div className="input-group world-form-field world-form-thumbnail-field">
            <label id="world-thumbnail-label">{t('dashboard.world_thumbnail')}</label>
            <label className="world-thumbnail-picker">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleThumbnailChange} aria-labelledby="world-thumbnail-label" />
              {thumbnailPreview ? (
                <>
                  <img src={thumbnailPreview} alt="" />
                  <span className="world-thumbnail-change">{t('dashboard.change_thumbnail')}</span>
                </>
              ) : (
                <span><Upload size={18} /> {t('dashboard.choose_thumbnail')}</span>
              )}
            </label>
          </div>

          <label className="world-public-control">
            <input type="checkbox" checked={publicRead} onChange={e => setPublicRead(e.target.checked)} />
            <span className="world-public-switch" aria-hidden="true"><i /></span>
            <span className="world-public-copy">
              <strong>{t('dashboard.public_read')}</strong>
              <small>{t('dashboard.public_read_hint')}</small>
            </span>
          </label>
        </section>
      )}

      {activeTab === 'appearance' && (
        <section id="world-appearance-panel" className="world-form-section" role="tabpanel">
          <ThemePresetSelect
            value={theme}
            onChange={nextTheme => {
              setTheme(nextTheme)
              setCustomThemeEnabled(false)
              setCustomThemeColors(getThemeColors(nextTheme))
            }}
          />

          <ThemeColorPicker
            theme={theme}
            colors={customThemeColors}
            onEnabledChange={setCustomThemeEnabled}
            onColorsChange={setCustomThemeColors}
          />
        </section>
      )}
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

  useEffect(() => () => {
    if (thumbnailPreview.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview)
  }, [thumbnailPreview])

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
    <WorldDialog title={t('dashboard.create_new_world')} description={t('dashboard.create_world_hint')} onClose={onClose} busy={saving}>
        <form className="world-dialog-form" onSubmit={handleSubmit}>
          <div className="world-dialog-body">
          <WorldFormFields
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            theme={theme}
            setTheme={setTheme}
            setCustomThemeEnabled={setCustomThemeEnabled}
            customThemeColors={customThemeColors}
            setCustomThemeColors={setCustomThemeColors}
            publicRead={publicRead}
            setPublicRead={setPublicRead}
            thumbnailPreview={thumbnailPreview}
            handleThumbnailChange={handleThumbnailChange}
          />
          </div>
          {error && <div className="error-msg world-form-error">{error}</div>}

          <div className="world-dialog-actions world-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.creating') : t('dashboard.create_world_button')}
            </button>
          </div>
        </form>
    </WorldDialog>
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

  useEffect(() => () => {
    if (thumbnailPreview.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview)
  }, [thumbnailPreview])

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
    <WorldDialog title={t('dashboard.edit_world')} description={t('dashboard.edit_world_hint')} onClose={onClose} busy={saving}>
        <form className="world-dialog-form" onSubmit={handleSubmit}>
          <div className="world-dialog-body">
          <WorldFormFields
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            theme={theme}
            setTheme={setTheme}
            setCustomThemeEnabled={setCustomThemeEnabled}
            customThemeColors={customThemeColors}
            setCustomThemeColors={setCustomThemeColors}
            publicRead={publicRead}
            setPublicRead={setPublicRead}
            thumbnailPreview={thumbnailPreview}
            handleThumbnailChange={handleThumbnailChange}
            isEditing
          />
          </div>
          {error && <div className="error-msg world-form-error">{error}</div>}

          <div className="world-dialog-actions world-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('dashboard.save_changes')}
            </button>
          </div>
        </form>
    </WorldDialog>
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

function WorldShareButton({ worldId }) {
  const { t } = useTranslation()

  const shareWorld = async () => {
    const shareUrl = new URL(`/world/${encodeURIComponent(worldId)}`, window.location.origin)
    shareUrl.searchParams.set('view', 'true')
    await copyTextToClipboard(shareUrl.toString())
  }

  return (
    <button
      className="workspace-share-floating"
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

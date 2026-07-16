import { useCallback, useEffect, useMemo, useState } from 'react'
import { Palette, SlidersHorizontal, Trash2, Upload, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import UserSearchSelect from '../../components/ui/UserSearchSelect'
import {
  DEFAULT_WORLD_THEME,
  WORLD_THEMES,
  getThemeColors,
  getWorldTheme,
  getWorldThemeStyle,
  normalizeCustomTheme
} from '../../worldThemes'
import WorldDialog from './WorldDialog'

const CUSTOM_THEME_COLOR_FIELDS = [
  ['background', 'dashboard.theme_color_background'],
  ['surface', 'dashboard.theme_color_surface'],
  ['text', 'dashboard.theme_color_text'],
  ['mutedText', 'dashboard.theme_color_muted_text'],
  ['accent', 'dashboard.theme_color_accent'],
  ['secondaryAccent', 'dashboard.theme_color_secondary_accent']
]

const SETTINGS_TABS = ['general', 'appearance', 'users']

function getSettingsStorageKey(worldId) {
  return `mysthra:world-settings-tab:${worldId}`
}

function getInitialTab(mode, worldId, initialTab) {
  if (mode === 'create') return 'general'
  if (SETTINGS_TABS.includes(initialTab)) return initialTab
  try {
    const stored = window.sessionStorage.getItem(getSettingsStorageKey(worldId))
    return SETTINGS_TABS.includes(stored) ? stored : 'general'
  } catch {
    return 'general'
  }
}

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
          <button
            key={preset.id}
            type="button"
            className={value === preset.id ? 'active' : ''}
            style={{ '--preset-accent': preset.colors.accent, '--preset-background': preset.colors.background, '--preset-text': preset.colors.text }}
            aria-pressed={value === preset.id}
            onClick={() => onChange(preset.id)}
          >
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

function WorldGeneralPanel({ name, setName, description, setDescription, publicRead, setPublicRead, thumbnailPreview, onThumbnailChange, isEditing }) {
  const { t } = useTranslation()

  return (
    <section id="world-general-panel" className="world-form-section" role="tabpanel">
      <div className="input-group world-form-field">
        <label htmlFor="world-name">{t('dashboard.world_name')}</label>
        <input id="world-name" type="text" value={name} onChange={event => setName(event.target.value)} placeholder={isEditing ? undefined : t('dashboard.world_name_placeholder')} required autoFocus={!isEditing} />
      </div>
      <div className="input-group world-form-field">
        <label htmlFor="world-description">{t('dashboard.short_description')}</label>
        <input id="world-description" type="text" value={description} onChange={event => setDescription(event.target.value)} placeholder={isEditing ? undefined : t('dashboard.short_description_placeholder')} />
      </div>
      <div className="input-group world-form-field world-form-thumbnail-field">
        <label id="world-thumbnail-label">{t('dashboard.world_thumbnail')}</label>
        <label className="world-thumbnail-picker">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onThumbnailChange} aria-labelledby="world-thumbnail-label" />
          {thumbnailPreview ? (
            <><img src={thumbnailPreview} alt="" /><span className="world-thumbnail-change">{t('dashboard.change_thumbnail')}</span></>
          ) : (
            <span><Upload size={18} /> {t('dashboard.choose_thumbnail')}</span>
          )}
        </label>
      </div>
      <label className="world-public-control">
        <input type="checkbox" checked={publicRead} onChange={event => setPublicRead(event.target.checked)} />
        <span className="world-public-switch" aria-hidden="true"><i /></span>
        <span className="world-public-copy"><strong>{t('dashboard.public_read')}</strong><small>{t('dashboard.public_read_hint')}</small></span>
      </label>
    </section>
  )
}

function WorldUsersPanel({ worldId, currentUser }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ loading: true, members: [], users: [], userId: '', username: '', password: '', error: '' })
  const canCreateUsers = Boolean(currentUser?.globalRole)

  const loadMembers = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true, error: '' }))
    try {
      const membersResponse = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/members`)
      const membersData = await membersResponse.json().catch(() => ({}))
      if (!membersResponse.ok) {
        setState(previous => ({ ...previous, loading: false, error: membersData.error || t('common.error') }))
        return
      }

      setState(previous => ({ ...previous, members: membersData.items || [] }))

      const usersResponse = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/available-users`)
      const usersData = await usersResponse.json().catch(() => ({}))
      if (!usersResponse.ok) {
        setState(previous => ({ ...previous, loading: false, users: [], error: usersData.error || t('dashboard.users_load_error') }))
        return
      }

      setState(previous => ({ ...previous, loading: false, users: usersData.items || [], error: '' }))
    } catch {
      setState(previous => ({ ...previous, loading: false, error: t('common.error_connection') }))
    }
  }, [t, worldId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const availableUsers = useMemo(() => {
    const memberIds = new Set(state.members.map(member => member.userId))
    return state.users.filter(user => !memberIds.has(user.id))
  }, [state.members, state.users])

  const runMemberRequest = async (url, options) => {
    setState(previous => ({ ...previous, loading: true, error: '' }))
    try {
      const response = await fetch(url, options)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setState(previous => ({ ...previous, loading: false, error: data.error || t('common.error') }))
        return false
      }
      setState(previous => ({ ...previous, loading: false, members: data.items || previous.members, error: '' }))
      return true
    } catch {
      setState(previous => ({ ...previous, loading: false, error: t('common.error_connection') }))
      return false
    }
  }

  const addExistingMember = async () => {
    if (!state.userId) return
    const saved = await runMemberRequest(`/api/worlds/${encodeURIComponent(worldId)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.userId })
    })
    if (saved) setState(previous => ({ ...previous, userId: '' }))
  }

  const createAndAddMember = async () => {
    if (!canCreateUsers || !state.username.trim() || !state.password) return
    const saved = await runMemberRequest(`/api/worlds/${encodeURIComponent(worldId)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: state.username.trim(), password: state.password })
    })
    if (saved) setState(previous => ({ ...previous, username: '', password: '' }))
  }

  return (
    <section id="world-users-panel" className="world-form-section world-users-panel" role="tabpanel">
      <div className="world-members-directory">
        <div className="world-form-section-heading">{t('workspace.current_members')}</div>
        <div className="world-members-list">
          {state.loading && state.members.length === 0 ? (
            <div className="world-users-state">{t('workspace.loading_members')}</div>
          ) : state.members.length === 0 ? (
            <div className="world-users-state">{t('workspace.no_members')}</div>
          ) : state.members.map(member => (
            <div key={member.userId} className="world-member-row">
              <strong>{member.user?.username || member.userId}</strong>
              <div className="world-member-actions">
                <div className="world-member-role" aria-label={t('workspace.member_role')}>
                  {[['member', t('workspace.member_role_member')], ['admin', t('workspace.member_role_admin')]].map(([role, label]) => (
                    <button key={role} type="button" className={member.role === role ? 'active' : ''} disabled={state.loading} onClick={() => role !== member.role && runMemberRequest(`/api/worlds/${encodeURIComponent(worldId)}/members/${encodeURIComponent(member.userId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })}>{label}</button>
                  ))}
                </div>
                <button type="button" className="world-member-remove" onClick={() => runMemberRequest(`/api/worlds/${encodeURIComponent(worldId)}/members/${encodeURIComponent(member.userId)}`, { method: 'DELETE' })} disabled={state.loading} aria-label={t('common.delete')}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="world-members-add">
        <div className="world-form-section-heading">{t('workspace.add_existing_member')}</div>
        <div className="world-member-add-row">
          <UserSearchSelect
            value={state.userId}
            onChange={userId => setState(previous => ({ ...previous, userId }))}
            options={availableUsers.map(user => ({ value: user.id, label: user.username }))}
            placeholder={t('workspace.select_user')}
            emptyLabel={t('login.no_users_found')}
            listLabel={t('login.available_users')}
            openLabel={t('login.open_user_dropdown')}
            closeLabel={t('login.close_user_dropdown')}
            disabled={state.loading || availableUsers.length === 0}
          />
          <button type="button" className="btn-secondary" onClick={addExistingMember} disabled={state.loading || !state.userId}>{t('common.add')}</button>
        </div>
        {canCreateUsers && (
          <div className="world-member-create">
            <div className="world-form-section-heading">{t('workspace.create_member_user')}</div>
            <input type="text" value={state.username} onChange={event => setState(previous => ({ ...previous, username: event.target.value }))} placeholder={t('login.username_placeholder')} disabled={state.loading} />
            <input type="password" value={state.password} onChange={event => setState(previous => ({ ...previous, password: event.target.value }))} placeholder={t('login.password_placeholder')} disabled={state.loading} />
            <button type="button" className="btn-primary" onClick={createAndAddMember} disabled={state.loading || !state.username.trim() || !state.password}>{t('workspace.create_and_add_member')}</button>
          </div>
        )}
      </div>
      {state.error && <div className="world-users-error">{state.error}</div>}
    </section>
  )
}

export default function WorldSettingsDialog({ mode = 'edit', world = null, currentUser = null, initialTab, onClose, onCreated, onSaved }) {
  const { t } = useTranslation()
  const isEditing = mode === 'edit'
  const worldId = world?.id || world?.name || ''
  const initialTheme = isEditing ? getWorldTheme(world?.theme).id : DEFAULT_WORLD_THEME
  const [activeTab, setActiveTab] = useState(() => getInitialTab(mode, worldId, initialTab))
  const [name, setName] = useState(isEditing ? world?.displayName || world?.name || '' : '')
  const [description, setDescription] = useState(isEditing ? world?.description || '' : '')
  const [theme, setTheme] = useState(initialTheme)
  const [customThemeEnabled, setCustomThemeEnabled] = useState(Boolean(isEditing && world?.customTheme))
  const [customThemeColors, setCustomThemeColors] = useState(() => getThemeColors(initialTheme, world?.customTheme))
  const [publicRead, setPublicRead] = useState(Boolean(isEditing && world?.publicRead))
  const [thumbnailPreview, setThumbnailPreview] = useState(isEditing && world?.thumbnail?.filename ? `/api/worlds/${encodeURIComponent(worldId)}/thumbnail?v=${world.thumbnail.updatedAt || 0}` : '')
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogThemeStyle = getWorldThemeStyle(
    theme,
    customThemeEnabled ? { colors: customThemeColors } : null
  )

  useEffect(() => () => {
    if (thumbnailPreview.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview)
  }, [thumbnailPreview])

  useEffect(() => {
    if (!isEditing || !worldId) return
    try {
      window.sessionStorage.setItem(getSettingsStorageKey(worldId), activeTab)
    } catch {
      // Session storage can be unavailable in restricted browsing contexts.
    }
  }, [activeTab, isEditing, worldId])

  const selectTheme = nextTheme => {
    setTheme(nextTheme)
    setCustomThemeEnabled(false)
    setCustomThemeColors(getThemeColors(nextTheme))
  }

  const handleThumbnailChange = event => {
    const file = event.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(previous => {
      if (previous.startsWith('blob:')) URL.revokeObjectURL(previous)
      return URL.createObjectURL(file)
    })
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (activeTab === 'users') return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(isEditing ? `/api/worlds/${encodeURIComponent(worldId)}` : '/api/worlds', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, theme, customTheme: buildCustomThemePayload(customThemeEnabled, customThemeColors), publicRead })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || t('dashboard.create_world_error'))
        return
      }

      const savedWorldId = data.id || data.name || worldId
      let updatedWorld = { ...world, ...data, id: savedWorldId }
      if (thumbnailFile) {
        const query = new URLSearchParams({ filename: thumbnailFile.name })
        const thumbnailResponse = await fetch(`/api/worlds/${encodeURIComponent(savedWorldId)}/thumbnail?${query.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': thumbnailFile.type || 'application/octet-stream' },
          body: await thumbnailFile.arrayBuffer()
        })
        const thumbnailData = await thumbnailResponse.json().catch(() => ({}))
        if (!thumbnailResponse.ok) {
          setError(thumbnailData.error || t('dashboard.thumbnail_error'))
          return
        }
        updatedWorld = { ...updatedWorld, ...thumbnailData, id: savedWorldId }
      }

      if (isEditing) onSaved?.(updatedWorld)
      else onCreated?.(updatedWorld)
    } catch {
      setError(t('common.error_connection'))
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    ['general', SlidersHorizontal, t('dashboard.world_tab_general')],
    ['appearance', Palette, t('dashboard.world_tab_appearance')],
    ...(isEditing ? [['users', Users, t('dashboard.world_tab_users')]] : [])
  ]

  return (
    <WorldDialog className="world-settings-dialog world-themed-dialog" style={dialogThemeStyle} title={isEditing ? t('dashboard.edit_world') : t('dashboard.create_new_world')} description={isEditing ? t('dashboard.edit_world_hint') : t('dashboard.create_world_hint')} onClose={onClose} busy={saving}>
      <form className="world-dialog-form" onSubmit={handleSubmit}>
        <div className="world-dialog-body world-settings-body">
          <div className="world-form-tabs-layout">
            <nav className="world-form-tabs" role="tablist" aria-label={t('dashboard.world_settings_tabs')}>
              {tabs.map(([id, Icon, label]) => (
                <button key={id} type="button" role="tab" aria-selected={activeTab === id} aria-controls={`world-${id}-panel`} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
                  <Icon size={15} />{label}
                </button>
              ))}
            </nav>
            {activeTab === 'general' && <WorldGeneralPanel name={name} setName={setName} description={description} setDescription={setDescription} publicRead={publicRead} setPublicRead={setPublicRead} thumbnailPreview={thumbnailPreview} onThumbnailChange={handleThumbnailChange} isEditing={isEditing} />}
            {activeTab === 'appearance' && (
              <section id="world-appearance-panel" className="world-form-section" role="tabpanel">
                <ThemePresetSelect value={theme} onChange={selectTheme} />
                <ThemeColorPicker theme={theme} colors={customThemeColors} onEnabledChange={setCustomThemeEnabled} onColorsChange={setCustomThemeColors} />
              </section>
            )}
            {activeTab === 'users' && <WorldUsersPanel worldId={worldId} currentUser={currentUser} />}
          </div>
        </div>
        {error && <div className="error-msg world-form-error">{error}</div>}
        <div className="world-dialog-actions world-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{activeTab === 'users' ? t('common.close') : t('common.cancel')}</button>
          {activeTab !== 'users' && <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>{saving ? t(isEditing ? 'common.saving' : 'common.creating') : t(isEditing ? 'dashboard.save_changes' : 'dashboard.create_world_button')}</button>}
        </div>
      </form>
    </WorldDialog>
  )
}

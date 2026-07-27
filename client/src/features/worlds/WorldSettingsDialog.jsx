import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Palette, Save, SlidersHorizontal, Trash2, Upload, Users } from 'lucide-react'
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
const THEME_PRESET_FORMAT = 'mysthra-theme-presets'
const THEME_PRESET_VERSION = 1
const MAX_THEME_PRESET_FILE_SIZE = 1000 * 1000

function getBuiltInPresetKey(themeId) {
  return `builtin:${themeId}`
}

function getCustomPresetKey(presetId) {
  return `custom:${presetId}`
}

function colorsMatch(first, second) {
  return CUSTOM_THEME_COLOR_FIELDS.every(([key]) => first?.[key]?.toLowerCase() === second?.[key]?.toLowerCase())
}

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

function buildCustomThemePayload(enabled, colors, preset = null) {
  if (!enabled) return null
  const customTheme = normalizeCustomTheme({ colors })
  return customTheme
    ? { ...customTheme, ...(preset ? { preset } : {}) }
    : null
}

function PresetButton({ presetKey, selectedKey, name, colors, onClick }) {
  const swatches = [colors.background, colors.surface, colors.accent, colors.text]

  return (
    <button
      type="button"
      className={selectedKey === presetKey ? 'active' : ''}
      style={{ '--preset-accent': colors.accent, '--preset-background': colors.background, '--preset-text': colors.text }}
      aria-pressed={selectedKey === presetKey}
      onClick={onClick}
    >
      <span className="world-theme-preset-swatches" aria-hidden="true">
        {swatches.map((color, index) => <i key={`${color}-${index}`} style={{ backgroundColor: color }} />)}
      </span>
      <strong>{name}</strong>
    </button>
  )
}

function ThemePresetSelect({ selectedKey, customPresets, loading, onSelectBuiltIn, onSelectCustom }) {
  const { t } = useTranslation()

  return (
    <div className="world-theme-presets">
      <div className="world-appearance-heading">
        <strong>{t('dashboard.world_theme')}</strong>
        <small>{t('dashboard.theme_preset_hint')}</small>
      </div>
      <div className="world-theme-preset-group-label">{t('dashboard.theme_builtin_presets')}</div>
      <div className="world-theme-preset-grid">
        {WORLD_THEMES.map(preset => (
          <PresetButton
            key={preset.id}
            presetKey={getBuiltInPresetKey(preset.id)}
            selectedKey={selectedKey}
            name={t(preset.labelKey)}
            colors={preset.colors}
            onClick={() => onSelectBuiltIn(preset.id)}
          />
        ))}
      </div>
      <div className="world-theme-preset-group-label">{t('dashboard.theme_saved_presets')}</div>
      {loading ? (
        <div className="world-theme-preset-state">{t('dashboard.theme_presets_loading')}</div>
      ) : customPresets.length === 0 ? (
        <div className="world-theme-preset-state">{t('dashboard.theme_presets_empty')}</div>
      ) : (
        <div className="world-theme-preset-grid">
          {customPresets.map(preset => (
            <PresetButton
              key={preset.id}
              presetKey={getCustomPresetKey(preset.id)}
              selectedKey={selectedKey}
              name={preset.name}
              colors={preset.colors}
              onClick={() => onSelectCustom(preset)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ThemeColorPicker({ colors, onColorChange, onReset }) {
  const { t } = useTranslation()

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
                onChange={event => onColorChange(key, event.target.value)}
              />
              <span><strong>{t(labelKey)}</strong><small>{colors[key].toUpperCase()}</small></span>
            </label>
          ))}
        </div>
        <button type="button" className="world-custom-theme-reset" onClick={onReset}>
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
  const [themePresets, setThemePresets] = useState([])
  const [themePresetsLoaded, setThemePresetsLoaded] = useState(false)
  const [themePresetsLoading, setThemePresetsLoading] = useState(false)
  const [selectedPresetKey, setSelectedPresetKey] = useState(
    isEditing && world?.customTheme?.preset?.id
      ? getCustomPresetKey(world.customTheme.preset.id)
      : isEditing && world?.customTheme
        ? null
        : getBuiltInPresetKey(initialTheme)
  )
  const [selectedPresetSnapshot, setSelectedPresetSnapshot] = useState(
    isEditing && world?.customTheme?.preset
      ? { ...world.customTheme.preset }
      : null
  )
  const [presetAction, setPresetAction] = useState('')
  const [presetStatus, setPresetStatus] = useState(null)
  const [presetName, setPresetName] = useState('')
  const [showPresetName, setShowPresetName] = useState(false)
  const [deletePreset, setDeletePreset] = useState(null)
  const importInputRef = useRef(null)
  const canManagePresets = Boolean(currentUser?.globalRole)
  const selectedCustomPreset = useMemo(() => {
    if (!selectedPresetKey?.startsWith('custom:')) return null
    return themePresets.find(preset => getCustomPresetKey(preset.id) === selectedPresetKey) || null
  }, [selectedPresetKey, themePresets])
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

  useEffect(() => {
    if (activeTab !== 'appearance' || themePresetsLoaded) return
    let cancelled = false
    setThemePresetsLoading(true)
    Promise.resolve(fetch('/api/theme-presets'))
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || t('dashboard.theme_presets_load_error'))
        if (cancelled) return
        const items = data.items || []
        setThemePresets(items)
        setThemePresetsLoaded(true)
        if (customThemeEnabled) {
          const matchingPreset = items.find(preset => (
            preset.baseTheme === theme && colorsMatch(preset.colors, customThemeColors)
          ))
          if (matchingPreset) {
            setSelectedPresetKey(getCustomPresetKey(matchingPreset.id))
            setSelectedPresetSnapshot({ id: matchingPreset.id, name: matchingPreset.name })
          }
        }
      })
      .catch(fetchError => {
        if (!cancelled) setPresetStatus({ tone: 'error', message: fetchError.message || t('common.error_connection') })
      })
      .finally(() => {
        if (!cancelled) setThemePresetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, customThemeColors, customThemeEnabled, t, theme, themePresetsLoaded])

  const selectTheme = nextTheme => {
    setTheme(nextTheme)
    setCustomThemeEnabled(false)
    setCustomThemeColors(getThemeColors(nextTheme))
    setSelectedPresetKey(getBuiltInPresetKey(nextTheme))
    setSelectedPresetSnapshot(null)
    setPresetStatus(null)
  }

  const selectCustomTheme = preset => {
    setTheme(preset.baseTheme)
    setCustomThemeEnabled(true)
    setCustomThemeColors({ ...preset.colors })
    setSelectedPresetKey(getCustomPresetKey(preset.id))
    setSelectedPresetSnapshot({ id: preset.id, name: preset.name })
    setPresetStatus(null)
  }

  const handleThemeColorChange = (key, value) => {
    setCustomThemeEnabled(true)
    setCustomThemeColors(previous => ({ ...previous, [key]: value }))
    setSelectedPresetKey(null)
    setSelectedPresetSnapshot(null)
    setPresetStatus(null)
  }

  const restoreThemeColors = () => {
    selectTheme(theme)
  }

  const saveThemePreset = async () => {
    const trimmedName = presetName.trim()
    if (!trimmedName || presetAction) return
    setPresetAction('save')
    setPresetStatus(null)
    try {
      const response = await fetch('/api/theme-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, baseTheme: theme, colors: customThemeColors })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || t('dashboard.theme_preset_save_error'))
      setThemePresets(previous => [...previous, data])
      selectCustomTheme(data)
      setPresetName('')
      setShowPresetName(false)
      setPresetStatus({ tone: 'success', message: t('dashboard.theme_preset_saved', { name: data.name }) })
    } catch (saveError) {
      setPresetStatus({ tone: 'error', message: saveError.message || t('common.error_connection') })
    } finally {
      setPresetAction('')
    }
  }

  const importThemePresetFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || presetAction) return
    if (file.size > MAX_THEME_PRESET_FILE_SIZE) {
      setPresetStatus({ tone: 'error', message: t('dashboard.theme_preset_file_too_large') })
      return
    }

    setPresetAction('import')
    setPresetStatus(null)
    try {
      const payload = JSON.parse(await file.text())
      const response = await fetch('/api/theme-presets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || t('dashboard.theme_preset_import_error'))
      const imported = data.items || []
      setThemePresets(previous => [...previous, ...imported])
      if (imported[0]) selectCustomTheme(imported[0])
      setPresetStatus({ tone: 'success', message: t('dashboard.theme_presets_imported', { count: imported.length }) })
    } catch (importError) {
      setPresetStatus({
        tone: 'error',
        message: importError instanceof SyntaxError
          ? t('dashboard.theme_preset_invalid_file')
          : importError.message || t('common.error_connection')
      })
    } finally {
      setPresetAction('')
    }
  }

  const exportSelectedThemePreset = () => {
    let exportedPreset = null
    if (selectedPresetKey?.startsWith('builtin:')) {
      const builtIn = WORLD_THEMES.find(preset => getBuiltInPresetKey(preset.id) === selectedPresetKey)
      if (builtIn) {
        exportedPreset = {
          name: t(builtIn.labelKey),
          baseTheme: builtIn.id,
          colors: builtIn.colors
        }
      }
    } else if (selectedCustomPreset) {
      exportedPreset = {
        name: selectedCustomPreset.name,
        baseTheme: selectedCustomPreset.baseTheme,
        colors: selectedCustomPreset.colors
      }
    }
    if (!exportedPreset) return

    const blob = new Blob([JSON.stringify({
      format: THEME_PRESET_FORMAT,
      version: THEME_PRESET_VERSION,
      presets: [exportedPreset]
    }, null, 2)], { type: 'application/json' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = exportedPreset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'
    link.href = downloadUrl
    link.download = `mysthra-theme-${safeName}.json`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    setPresetStatus({ tone: 'success', message: t('dashboard.theme_preset_exported') })
  }

  const confirmDeleteThemePreset = async () => {
    if (!deletePreset || presetAction) return
    setPresetAction('delete')
    setPresetStatus(null)
    try {
      const response = await fetch(`/api/theme-presets/${encodeURIComponent(deletePreset.id)}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || t('dashboard.theme_preset_delete_error'))
      setThemePresets(previous => previous.filter(preset => preset.id !== deletePreset.id))
      if (selectedPresetKey === getCustomPresetKey(deletePreset.id)) {
        setSelectedPresetKey(null)
        setSelectedPresetSnapshot(null)
      }
      setPresetStatus({ tone: 'success', message: t('dashboard.theme_preset_deleted', { name: deletePreset.name }) })
      setDeletePreset(null)
    } catch (deleteError) {
      setPresetStatus({ tone: 'error', message: deleteError.message || t('common.error_connection') })
    } finally {
      setPresetAction('')
    }
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
        body: JSON.stringify({
          name,
          description,
          theme,
          customTheme: buildCustomThemePayload(customThemeEnabled, customThemeColors, selectedPresetSnapshot),
          publicRead
        })
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
                <ThemePresetSelect
                  selectedKey={selectedPresetKey}
                  customPresets={themePresets}
                  loading={themePresetsLoading}
                  onSelectBuiltIn={selectTheme}
                  onSelectCustom={selectCustomTheme}
                />
                <ThemeColorPicker colors={customThemeColors} onColorChange={handleThemeColorChange} onReset={restoreThemeColors} />
                <div className="world-theme-preset-library">
                  <div className="world-appearance-heading">
                    <strong>{t('dashboard.theme_preset_library')}</strong>
                    <small>{t('dashboard.theme_preset_library_hint')}</small>
                  </div>
                  <div className="world-theme-preset-actions">
                    {canManagePresets && (
                      <>
                        <button type="button" onClick={() => setShowPresetName(previous => !previous)} disabled={Boolean(presetAction)}>
                          <Save size={14} />{t('dashboard.theme_save_as_preset')}
                        </button>
                        <button type="button" onClick={() => importInputRef.current?.click()} disabled={Boolean(presetAction)}>
                          <Upload size={14} />{t('dashboard.theme_import_preset')}
                        </button>
                        <input ref={importInputRef} className="world-theme-preset-file" type="file" accept="application/json,.json" onChange={importThemePresetFile} />
                      </>
                    )}
                    <button type="button" onClick={exportSelectedThemePreset} disabled={!selectedPresetKey || Boolean(presetAction)}>
                      <Download size={14} />{t('dashboard.theme_export_preset')}
                    </button>
                    {canManagePresets && selectedCustomPreset && (
                      <button type="button" className="danger" onClick={() => setDeletePreset(selectedCustomPreset)} disabled={Boolean(presetAction)}>
                        <Trash2 size={14} />{t('common.delete')}
                      </button>
                    )}
                  </div>
                  {canManagePresets && showPresetName && (
                    <div className="world-theme-preset-save-row">
                      <input
                        type="text"
                        maxLength={60}
                        value={presetName}
                        onChange={event => setPresetName(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            saveThemePreset()
                          } else if (event.key === 'Escape') {
                            setShowPresetName(false)
                          }
                        }}
                        placeholder={t('dashboard.theme_preset_name_placeholder')}
                        aria-label={t('dashboard.theme_preset_name')}
                        autoFocus
                      />
                      <button type="button" className="btn-primary" onClick={saveThemePreset} disabled={!presetName.trim() || Boolean(presetAction)}>
                        {presetAction === 'save' ? t('common.saving') : t('common.save')}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setShowPresetName(false)} disabled={Boolean(presetAction)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  )}
                  {deletePreset && (
                    <div className="world-theme-preset-confirm" role="alertdialog" aria-label={t('dashboard.theme_delete_preset_title')}>
                      <span>{t('dashboard.theme_delete_preset_confirm', { name: deletePreset.name })}</span>
                      <div>
                        <button type="button" className="btn-secondary" onClick={() => setDeletePreset(null)} disabled={Boolean(presetAction)}>{t('common.cancel')}</button>
                        <button type="button" className="btn-primary world-dialog-danger-action" onClick={confirmDeleteThemePreset} disabled={Boolean(presetAction)}>{t('common.delete')}</button>
                      </div>
                    </div>
                  )}
                  {presetStatus && <div className={`world-theme-preset-status ${presetStatus.tone}`} role="status">{presetStatus.message}</div>}
                </div>
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

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorldSettingsDialog from './WorldSettingsDialog'

const { translate } = vi.hoisted(() => ({ translate: key => key }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate })
}))

const world = {
  id: 'ember',
  name: 'ember',
  displayName: 'Ember Archive',
  description: 'Campaign notes',
  theme: 'ember-archive',
  publicRead: false
}

function jsonResponse(data, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) })
}

describe('WorldSettingsDialog', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads member data only after the users tab is opened', async () => {
    const user = userEvent.setup()
    fetch
      .mockImplementationOnce(() => jsonResponse({ items: [{ userId: 'user-1', role: 'member', user: { username: 'Liba' } }] }))
      .mockImplementationOnce(() => jsonResponse({ items: [{ id: 'user-2', username: 'Yosef' }] }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    expect(fetch).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_users' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Liba')).toBeTruthy()
    expect(window.sessionStorage.getItem('mysthra:world-settings-tab:ember')).toBe('users')
  })

  it('only exposes account creation to global administrators', async () => {
    const user = userEvent.setup()
    fetch.mockImplementation(() => jsonResponse({ items: [] }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: null }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_users' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('workspace.create_member_user')).toBeNull()

    cleanup()
    window.sessionStorage.clear()
    fetch.mockClear()
    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'server-admin' }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_users' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(screen.getByText('workspace.create_member_user')).toBeTruthy()
  })

  it('keeps loaded members visible and reports the server error when available users fail', async () => {
    const user = userEvent.setup()
    fetch
      .mockImplementationOnce(() => jsonResponse({ items: [{ userId: 'user-1', role: 'admin', user: { username: 'Liba' } }] }))
      .mockImplementationOnce(() => jsonResponse({ error: 'Unable to list available users' }, false))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_users' }))

    expect(await screen.findByText('Liba')).toBeTruthy()
    expect(await screen.findByText('Unable to list available users')).toBeTruthy()
    expect(screen.queryByText('common.error_connection')).toBeNull()
  })

  it('searches and selects an existing user before adding them to the world', async () => {
    const user = userEvent.setup()
    fetch
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse({ items: [{ id: 'user-1', username: 'Alice' }, { id: 'user-2', username: 'Zara' }] }))
      .mockImplementationOnce(() => jsonResponse({ items: [{ userId: 'user-2', role: 'member', user: { username: 'Zara' } }] }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_users' }))
    const search = await screen.findByRole('combobox')
    await user.click(search)
    await user.type(search, 'zar')
    await user.click(screen.getByRole('option', { name: /Zara/ }))
    await user.click(screen.getByRole('button', { name: 'common.add' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(fetch).toHaveBeenLastCalledWith('/api/worlds/ember/members', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ userId: 'user-2' })
    }))
  })

  it('saves world settings through the shared edit contract', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    fetch.mockImplementationOnce(() => jsonResponse({ ...world, displayName: 'Revised Archive', publicRead: true }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} onSaved={onSaved} />)
    const nameInput = screen.getByLabelText('dashboard.world_name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Revised Archive')
    await user.click(screen.getByRole('button', { name: 'dashboard.save_changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith('/api/worlds/ember', expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('Revised Archive')
    }))
  })

  it('applies the selected appearance to the settings dialog', async () => {
    const user = userEvent.setup()

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.getPropertyValue('--accent-color')).toBe('#c17539')

    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await user.click(screen.getByRole('button', { name: 'dashboard.theme_vampire_masquerade' }))

    expect(dialog.style.getPropertyValue('--accent-color')).toBe('#8f1d2c')
    expect(dialog.style.getPropertyValue('--theme-custom-surface')).toBe('#1a1014')
  })

  it('restores custom colors using the currently selected theme', async () => {
    const user = userEvent.setup()

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await user.click(screen.getByRole('button', { name: 'dashboard.theme_vampire_masquerade' }))

    fireEvent.change(screen.getByLabelText('dashboard.theme_color_accent'), { target: { value: '#123456' } })
    expect(dialog.style.getPropertyValue('--accent-color')).toBe('#123456')

    await user.click(screen.getByRole('button', { name: 'dashboard.theme_restore_preset' }))
    expect(dialog.style.getPropertyValue('--accent-color')).toBe('#8f1d2c')
  })

  it('loads and applies a saved preset as an independent world color snapshot', async () => {
    const user = userEvent.setup()
    const preset = {
      id: 'preset-1',
      name: 'Moonlit Archive',
      baseTheme: 'default',
      colors: {
        background: '#101820',
        surface: '#202a34',
        text: '#f4f7fa',
        mutedText: '#9ba8b5',
        accent: '#5577cc',
        secondaryAccent: '#44aa99'
      }
    }
    fetch.mockImplementationOnce(() => jsonResponse({ items: [preset] }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await user.click(await screen.findByRole('button', { name: 'Moonlit Archive' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.style.getPropertyValue('--accent-color')).toBe('#5577cc')
    expect(screen.getByRole('button', { name: 'Moonlit Archive' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.change(screen.getByLabelText('dashboard.theme_color_accent'), { target: { value: '#112233' } })
    expect(screen.getByRole('button', { name: 'dashboard.theme_export_preset' }).disabled).toBe(true)
  })

  it('lets global administrators save the current appearance as a shared preset', async () => {
    const user = userEvent.setup()
    const savedPreset = {
      id: 'preset-saved',
      name: 'New Chronicle',
      baseTheme: 'ember-archive',
      colors: {
        background: '#151c20',
        surface: '#1d2529',
        text: '#ece4d3',
        mutedText: '#aeb2aa',
        accent: '#c17539',
        secondaryAccent: '#3b6474'
      },
      createdAt: 1
    }
    fetch
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse(savedPreset))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await screen.findByText('dashboard.theme_presets_empty')
    await user.click(screen.getByRole('button', { name: 'dashboard.theme_save_as_preset' }))
    await user.type(screen.getByLabelText('dashboard.theme_preset_name'), 'New Chronicle')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith('/api/theme-presets', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"name":"New Chronicle"')
    }))
    expect(await screen.findByRole('button', { name: 'New Chronicle' })).toBeTruthy()
  })

  it('keeps library mutations hidden from non-admin users', async () => {
    const user = userEvent.setup()
    fetch.mockImplementationOnce(() => jsonResponse({ items: [] }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: null }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await screen.findByText('dashboard.theme_presets_empty')

    expect(screen.queryByRole('button', { name: 'dashboard.theme_save_as_preset' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'dashboard.theme_import_preset' })).toBeNull()
    expect(screen.getByRole('button', { name: 'dashboard.theme_export_preset' })).toBeTruthy()
  })

  it('imports a versioned preset file and selects the first imported item', async () => {
    const user = userEvent.setup()
    const importedPreset = {
      id: 'imported-1',
      name: 'Imported Theme',
      baseTheme: 'vampire-masquerade',
      colors: {
        background: '#090607',
        surface: '#1a1014',
        text: '#f1e7dc',
        mutedText: '#a9918d',
        accent: '#71303a',
        secondaryAccent: '#b08d57'
      }
    }
    fetch
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse({ items: [importedPreset] }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await screen.findByText('dashboard.theme_presets_empty')

    const file = new File(['{}'], 'theme.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify({
        format: 'mysthra-theme-presets',
        version: 1,
        presets: [{ name: 'Imported Theme' }]
      }))
    })
    await user.upload(document.querySelector('.world-theme-preset-file'), file)

    const importedButton = await screen.findByRole('button', { name: 'Imported Theme' })
    expect(importedButton.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('dialog').style.getPropertyValue('--accent-color')).toBe('#71303a')
  })

  it('exports the selected built-in preset through a versioned JSON download', async () => {
    const user = userEvent.setup()
    fetch.mockImplementationOnce(() => jsonResponse({ items: [] }))
    const createObjectURL = vi.fn(() => 'blob:theme-export')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const clickDownload = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: null }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await screen.findByText('dashboard.theme_presets_empty')
    await user.click(screen.getByRole('button', { name: 'dashboard.theme_export_preset' }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(clickDownload).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:theme-export')
  })

  it('requires confirmation before removing a selected custom preset', async () => {
    const user = userEvent.setup()
    const preset = {
      id: 'delete-me',
      name: 'Temporary Theme',
      baseTheme: 'default',
      colors: {
        background: '#101112',
        surface: '#202122',
        text: '#f0f1f2',
        mutedText: '#a0a1a2',
        accent: '#a05030',
        secondaryAccent: '#306070'
      }
    }
    fetch
      .mockImplementationOnce(() => jsonResponse({ items: [preset] }))
      .mockImplementationOnce(() => jsonResponse({ success: true }))

    render(<WorldSettingsDialog world={world} currentUser={{ globalRole: 'root' }} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'dashboard.world_tab_appearance' }))
    await user.click(await screen.findByRole('button', { name: 'Temporary Theme' }))
    await user.click(screen.getByRole('button', { name: 'common.delete' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'common.delete' }).at(-1))

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/theme-presets/delete-me', { method: 'DELETE' }))
    expect(screen.queryByRole('button', { name: 'Temporary Theme' })).toBeNull()
  })
})

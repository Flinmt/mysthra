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
})

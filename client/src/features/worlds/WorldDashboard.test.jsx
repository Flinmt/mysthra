import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorldDashboard from './WorldDashboard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => ({
      'dashboard.subtitle': 'World forge',
      'dashboard.world_count': `${values.count} worlds`,
      'dashboard.search_universes': 'Search worlds',
      'dashboard.new_world': 'New world',
      'dashboard.create_new_world': 'Create new world',
      'dashboard.signed_in_as': `Signed in as ${values.name}`,
      'dashboard.session_menu': `Open ${values.name} menu`,
      'dashboard.manage_users': 'Manage users',
      'dashboard.logout_tooltip': 'Logout',
      'dashboard.logout_confirm_title': 'End session',
      'dashboard.logout_confirm_hint': 'Confirm logout',
      'dashboard.logout_confirm_description': `End ${values.name} session?`,
      'dashboard.logout_confirm_action': 'Confirm logout',
      'dashboard.worlds_section': 'Available worlds',
      'dashboard.open_world': `Open world ${values.name}`,
      'dashboard.world_actions': `Actions for ${values.name}`,
      'dashboard.theme_default': 'Default theme',
      'dashboard.public': 'Public',
      'dashboard.default_world_description': 'New universe',
      'dashboard.no_search_results': 'No worlds found',
      'dashboard.no_search_results_hint': 'Try another search',
      'dashboard.clear_search': 'Clear search',
      'dashboard.load_error': 'Could not load worlds',
      'dashboard.load_error_hint': 'Check the connection',
      'dashboard.try_again': 'Try again',
      'common.edit': 'Edit',
      'common.delete': 'Delete',
      'common.cancel': 'Cancel',
      'common.close': 'Close'
    }[key] || key)
  })
}))

const worlds = [{
  id: 'ember',
  name: 'ember',
  displayName: 'Ember Archive',
  description: 'Campaign notes',
  theme: 'default',
  publicRead: true
}]

function renderDashboard(overrides = {}) {
  const props = {
    currentUser: { username: 'admin', globalRole: 'root' },
    worldCount: worlds.length,
    filteredWorlds: worlds,
    loading: false,
    error: false,
    searchQuery: '',
    languageSwitcher: <button type="button">PT</button>,
    onSearchChange: vi.fn(),
    onRetry: vi.fn(),
    onCreate: vi.fn(),
    onOpen: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onManageUsers: vi.fn(),
    onLogout: vi.fn(),
    ...overrides
  }
  render(<WorldDashboard {...props} />)
  return props
}

describe('WorldDashboard', () => {
  afterEach(cleanup)

  it('opens a world through an accessible button', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Open world Ember Archive' }))

    expect(props.onOpen).toHaveBeenCalledWith(worlds[0])
  })

  it('shows and clears an empty search result', async () => {
    const user = userEvent.setup()
    const props = renderDashboard({ filteredWorlds: [], searchQuery: 'missing' })

    expect(screen.getByText('No worlds found')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Clear search' })[0])
    expect(props.onSearchChange).toHaveBeenCalledWith('')
  })

  it('only shows world search for large collections', () => {
    renderDashboard({ worldCount: 6 })
    expect(screen.queryByRole('searchbox')).toBeNull()

    cleanup()
    renderDashboard({ worldCount: 7 })
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('renders world creation as the first grid card', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()
    const cards = screen.getByRole('region', { name: 'Available worlds' }).querySelectorAll('.world-dashboard-grid > *')

    expect(cards[0]).toBe(screen.getByRole('button', { name: 'Create new world' }))
    await user.click(screen.getByRole('button', { name: 'Create new world' }))
    expect(props.onCreate).toHaveBeenCalledOnce()
  })

  it('allows retrying after a load error', async () => {
    const user = userEvent.setup()
    const props = renderDashboard({ error: true, filteredWorlds: [] })

    await user.click(screen.getByRole('button', { name: /Try again/ }))
    expect(props.onRetry).toHaveBeenCalledOnce()
  })

  it('hides global administration actions from common users', () => {
    renderDashboard({ currentUser: { username: 'member', globalRole: null } })

    expect(screen.queryByRole('button', { name: 'New world' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage users' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Actions for Ember Archive' })).toBeNull()
  })

  it('lets a world admin edit their world without exposing global actions', async () => {
    const user = userEvent.setup()
    const worldAdminWorld = { ...worlds[0], members: [{ userId: 'user-1', role: 'admin' }] }
    const props = renderDashboard({
      currentUser: { userId: 'user-1', username: 'world-admin', globalRole: null },
      filteredWorlds: [worldAdminWorld]
    })

    expect(screen.queryByRole('button', { name: 'Create new world' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage users' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Actions for Ember Archive' }))
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(props.onEdit).toHaveBeenCalledWith(worldAdminWorld)
  })

  it('opens the world menu and routes edit without opening the world', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Actions for Ember Archive' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

    expect(props.onEdit).toHaveBeenCalledWith(worlds[0])
    expect(props.onOpen).not.toHaveBeenCalled()
  })

  it('groups administration and logout in the user session menu', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()

    expect(screen.queryByRole('menuitem', { name: 'Manage users' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Open admin menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Manage users' }))

    expect(props.onManageUsers).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menuitem', { name: 'Logout' })).toBeNull()
  })

  it('requires confirmation before logout', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Open admin menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }))
    expect(props.onLogout).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'End session' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Confirm logout' }))
    expect(props.onLogout).toHaveBeenCalledOnce()
  })
})

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UserSettingsPage from './UserSettingsPage'

const setLocation = vi.fn()

vi.mock('wouter', () => ({ useLocation: () => ['/', setLocation] }))
vi.mock('react-i18next', () => {
  const t = (key, values = {}) => ({
      'common.loading': 'Loading',
      'common.cancel': 'Cancel',
      'common.close': 'Close',
      'dashboard.users_title': 'Users',
      'dashboard.users_page_hint': 'Manage server users',
      'dashboard.back_to_worlds': 'Back to worlds',
      'dashboard.create_user': 'Create user',
      'dashboard.create_user_hint': 'Create an account',
      'dashboard.user_directory': 'User directory',
      'dashboard.search_users': 'Search users',
      'dashboard.filter_user_list': 'Filter users',
      'dashboard.filter_all': 'All',
      'dashboard.filter_users': 'Users',
      'dashboard.filter_admins': 'Admins',
      'dashboard.role_root': 'Root',
      'dashboard.role_server_admin': 'Server admin',
      'dashboard.role_user': 'User',
      'dashboard.world_count': `${values.count} worlds`,
      'dashboard.account_tab': 'Account',
      'dashboard.user_step_worlds': 'Worlds',
      'dashboard.user_settings_tabs': 'User settings',
      'dashboard.account_access': 'Application access',
      'dashboard.account_access_hint': 'Global account role',
      'dashboard.global_role': 'Global role',
      'dashboard.password_access': 'Password',
      'dashboard.password_access_hint': 'Reset password',
      'dashboard.new_password': 'New password',
      'dashboard.update_password': 'Update password',
      'dashboard.account_actions': 'Account actions',
      'dashboard.account_actions_hint': 'Permanent actions',
      'dashboard.delete_user': 'Delete user',
      'dashboard.world_access': 'World access',
      'dashboard.world_access_hint': 'Set world roles',
      'dashboard.no_access': 'No access',
      'dashboard.show_password': 'Show password',
      'dashboard.hide_password': 'Hide password',
      'login.username': 'Username',
      'workspace.member_role_member': 'Member',
      'workspace.member_role_admin': 'Admin'
    }[key] || key)
  return { useTranslation: () => ({ t }) }
})

const users = [
  { id: 'root', username: 'admin', globalRole: 'root', worldCount: 0 },
  { id: 'user-1', username: 'alice', globalRole: null, worldCount: 1 }
]

describe('UserSettingsPage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    setLocation.mockReset()
    globalThis.fetch = vi.fn(async url => {
      if (String(url) === '/api/users') return { ok: true, json: async () => ({ items: users }) }
      if (String(url).endsWith('/worlds')) return { ok: true, json: async () => ({ items: [{ id: 'ember', displayName: 'Ember', role: 'member' }] }) }
      return { ok: true, json: async () => ({}) }
    })
  })

  it('renders a filterable user directory', async () => {
    const user = userEvent.setup()
    render(<UserSettingsPage currentUser={users[0]} />)

    expect(await screen.findByRole('button', { name: /alice/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Admins' }))
    expect(screen.queryByRole('button', { name: /alice/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Admins' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('loads world access through the Worlds tab', async () => {
    const user = userEvent.setup()
    render(<UserSettingsPage currentUser={users[0]} />)

    await user.click(await screen.findByRole('button', { name: /alice/i }))
    await user.click(screen.getByRole('tab', { name: 'Worlds' }))

    expect(await screen.findByText('Ember')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Member' }).className).toContain('active')
  })

  it('opens user creation in the shared accessible dialog', async () => {
    const user = userEvent.setup()
    render(<UserSettingsPage currentUser={users[0]} />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Create user' }))
    expect(screen.getByRole('dialog', { name: 'Create user' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Username'))
  })
})

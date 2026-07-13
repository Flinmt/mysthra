import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => ({
    'login.username': 'Username',
    'login.username_placeholder': 'Select user',
    'login.available_users': 'Available users',
    'login.no_users_found': 'No users',
    'login.root_user': 'root',
    'login.server_admin_user': 'server admin',
    'login.open_user_dropdown': 'Open users',
    'login.close_user_dropdown': 'Close users',
    'login.subtitle': 'World forge',
    'login.password': 'Password',
    'login.password_placeholder': 'Enter password',
    'login.enter': 'Sign in'
  }[key] || key) })
}))

const users = [
  { id: 'root', username: 'admin', globalRole: 'root' },
  { id: 'user-1', username: 'alice', globalRole: null },
  { id: 'user-2', username: 'zara', globalRole: null }
]

describe('Login user combobox', () => {
  afterEach(cleanup)

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: users })
    })
  })

  it('does not open when the username label is clicked', async () => {
    const user = userEvent.setup()
    render(<Login onLogin={vi.fn()} />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    await user.click(screen.getByText('Username'))

    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('does not open from initial autofocus', async () => {
    render(<Login onLogin={vi.fn()} />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    expect(document.activeElement).toBe(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes after selection and keeps the selected username', async () => {
    const user = userEvent.setup()
    render(<Login onLogin={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.click(await screen.findByRole('option', { name: /alice/ }))

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input.value).toBe('alice')
  })

  it('wraps keyboard selection from the last user to the first', async () => {
    const user = userEvent.setup()
    render(<Login onLogin={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await screen.findByRole('option', { name: /zara/ })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-activedescendant')).toBe('login-user-option-user-2')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe('login-user-option-root')
  })
})

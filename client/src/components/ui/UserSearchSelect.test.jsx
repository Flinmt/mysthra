import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import UserSearchSelect from './UserSearchSelect'

const options = [
  { value: 'alice', label: 'Alice' },
  { value: 'yosef', label: 'Yosef' },
  { value: 'zara', label: 'Zara' }
]

function renderSelect(overrides = {}) {
  return render(
    <UserSearchSelect
      value=""
      onChange={vi.fn()}
      options={options}
      placeholder="Search users"
      emptyLabel="No users"
      listLabel="Available users"
      openLabel="Open users"
      closeLabel="Close users"
      {...overrides}
    />
  )
}

afterEach(cleanup)

describe('UserSearchSelect', () => {
  it('opens only through interaction and filters users by name', async () => {
    const user = userEvent.setup()
    renderSelect()
    const input = screen.getByRole('combobox')

    input.focus()
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.click(input)
    await user.type(input, 'zar')

    expect(screen.getByRole('option', { name: /Zara/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Alice/ })).toBeNull()
  })

  it('closes after selection and keeps the selected label in the input', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderSelect({ onChange })
    const input = screen.getByRole('combobox')

    await user.click(input)
    await user.click(screen.getByRole('option', { name: /Yosef/ }))

    expect(onChange).toHaveBeenCalledWith('yosef')
    expect(input.value).toBe('Yosef')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('wraps keyboard navigation from the last option to the first', async () => {
    const user = userEvent.setup()
    renderSelect()
    const input = screen.getByRole('combobox')

    await user.click(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-2$/)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-0$/)
  })
})

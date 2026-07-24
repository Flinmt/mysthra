import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorldDialog from './WorldDialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key === 'common.close' ? 'Close' : key })
}))

describe('WorldDialog', () => {
  afterEach(cleanup)

  it('exposes dialog semantics and closes from its close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<WorldDialog title="Create world" description="World settings" onClose={onClose}><div>Content</div></WorldDialog>)

    expect(screen.getByRole('dialog', { name: 'Create world' }).getAttribute('aria-modal')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes with Escape and backdrop interaction', () => {
    const onClose = vi.fn()
    const { container } = render(<WorldDialog title="Edit world" description="World settings" onClose={onClose}><div>Content</div></WorldDialog>)

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(container.querySelector('.world-dialog-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('does not close while an operation is pending', () => {
    const onClose = vi.fn()
    const { container } = render(<WorldDialog title="Edit world" description="World settings" onClose={onClose} busy><div>Content</div></WorldDialog>)

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(container.querySelector('.world-dialog-backdrop'))
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus into the dialog', () => {
    render(<WorldDialog title="Create world" description="World settings" onClose={vi.fn()}><input aria-label="World name" /></WorldDialog>)

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'World name' }))
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileText, Folder } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DeleteItemDialog from './DeleteItemDialog'

const labels = {
  title: 'Delete tab?',
  description: 'The tab and all its content will be permanently deleted.',
  warning: 'This action cannot be undone.',
  close: 'Close',
  cancel: 'Cancel',
  confirm: 'Delete tab',
  deleting: 'Deleting...'
}

function renderDialog(props = {}) {
  return render(
    <DeleteItemDialog
      item={{ name: 'Campaign notes' }}
      icon={<FileText size={14} />}
      labels={labels}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...props}
    />
  )
}

describe('DeleteItemDialog', () => {
  afterEach(cleanup)

  it('presents a compact, accessible tab-specific confirmation', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Delete tab?' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('Campaign notes')).toBeTruthy()
    expect(screen.getByText('This action cannot be undone.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBe(document.activeElement)
  })

  it('reuses the same confirmation structure for a document', () => {
    renderDialog({
      item: { name: 'World lore' },
      icon: <Folder size={14} />,
      labels: {
        ...labels,
        title: 'Delete document?',
        description: 'The document and all nested items will be permanently deleted.',
        confirm: 'Delete document'
      }
    })

    expect(screen.getByRole('dialog', { name: 'Delete document?' })).toBeTruthy()
    expect(screen.getByText('World lore')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeTruthy()
  })

  it('supports every dismissal path and traps keyboard focus', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const { container } = renderDialog({ onCancel })

    await user.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerDown(container.firstChild)

    expect(onCancel).toHaveBeenCalledTimes(3)

    const confirm = screen.getByRole('button', { name: 'Delete tab' })
    confirm.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toBe(document.activeElement)
  })

  it('confirms once and blocks every action while deleting', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = renderDialog({ onCancel, onConfirm })

    await user.click(screen.getByRole('button', { name: 'Delete tab' }))
    expect(onConfirm).toHaveBeenCalledOnce()

    rerender(
      <DeleteItemDialog
        item={{ name: 'Campaign notes' }}
        icon={<FileText size={14} />}
        labels={labels}
        deleting
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByRole('dialog').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Deleting...' }).disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })
})

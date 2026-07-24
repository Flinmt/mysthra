import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkspaceToastRegion from './WorkspaceToasts'
import { enqueueWorkspaceToast } from './workspaceToastUtils'

const successToast = { id: 1, message: 'Saved', type: 'success', duration: 4000 }
const errorToast = { id: 2, message: 'Unable to save', type: 'error', duration: 7000 }

describe('WorkspaceToastRegion', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders themed semantic notifications with dismiss controls', () => {
    render(<WorkspaceToastRegion toasts={[successToast, errorToast]} closeLabel="Close" onDismiss={vi.fn()} />)

    expect(screen.getByRole('status').textContent).toContain('Saved')
    expect(screen.getByRole('alert').textContent).toContain('Unable to save')
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2)
    expect(document.querySelector('.workspace-toast.is-success')).toBeTruthy()
    expect(document.querySelector('.workspace-toast.is-error')).toBeTruthy()
  })

  it('uses the supplied duration before animating out', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<WorkspaceToastRegion toasts={[successToast]} closeLabel="Close" onDismiss={onDismiss} />)

    act(() => vi.advanceTimersByTime(3999))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    act(() => vi.advanceTimersByTime(160))
    expect(onDismiss).toHaveBeenCalledWith(successToast.id)
  })

  it('pauses and resumes the timeout while hovered', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<WorkspaceToastRegion toasts={[successToast]} closeLabel="Close" onDismiss={onDismiss} />)
    const toast = screen.getByRole('status')

    act(() => vi.advanceTimersByTime(1000))
    fireEvent.mouseEnter(toast)
    act(() => vi.advanceTimersByTime(6000))
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.mouseLeave(toast)
    act(() => vi.advanceTimersByTime(3000))
    act(() => vi.advanceTimersByTime(160))
    expect(onDismiss).toHaveBeenCalledWith(successToast.id)
  })

  it('pauses on focus and supports manual dismissal', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<WorkspaceToastRegion toasts={[errorToast]} closeLabel="Close" onDismiss={onDismiss} />)
    const close = screen.getByRole('button', { name: 'Close' })

    fireEvent.focus(close)
    act(() => vi.advanceTimersByTime(8000))
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.click(close)
    act(() => vi.advanceTimersByTime(160))
    expect(onDismiss).toHaveBeenCalledWith(errorToast.id)
  })

  it('keeps only the newest notifications within the queue limit', () => {
    const queued = [1, 2, 3, 4, 5].reduce(
      (toasts, id) => enqueueWorkspaceToast(toasts, { id, message: `${id}`, type: 'info', duration: 4000 }),
      []
    )

    expect(queued.map(toast => toast.id)).toEqual([2, 3, 4, 5])
  })
})

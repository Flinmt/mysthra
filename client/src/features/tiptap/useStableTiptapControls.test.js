import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useStableTiptapControls } from './useStableTiptapControls'

describe('useStableTiptapControls', () => {
  it('creates a new controls session when the collaborative editor replaces a transient editor', async () => {
    const transientEditor = { isDestroyed: false }
    const collaborativeEditor = { isDestroyed: false }
    const transientDocument = {}
    const collaborativeDocument = {}
    const { result, rerender } = renderHook(
      ({ editor, document }) => useStableTiptapControls(editor, document),
      { initialProps: { editor: transientEditor, document: transientDocument } }
    )

    await waitFor(() => expect(result.current?.editor).toBe(transientEditor))
    const transientSessionId = result.current.id

    transientEditor.isDestroyed = true
    rerender({ editor: collaborativeEditor, document: collaborativeDocument })

    await waitFor(() => expect(result.current?.editor).toBe(collaborativeEditor))
    expect(result.current.id).toBeGreaterThan(transientSessionId)
  })

  it('does not expose a destroyed editor to contextual controls', async () => {
    const editor = { isDestroyed: true }
    const { result } = renderHook(() => useStableTiptapControls(editor, {}))

    await waitFor(() => expect(result.current).toBeNull())
  })
})

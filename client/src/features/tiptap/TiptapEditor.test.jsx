import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TiptapEditor from './TiptapEditor'

const tiptapMocks = vi.hoisted(() => ({
  collaboration: null
}))

vi.mock('@tiptap/react', () => ({
  EditorContent: () => <div data-testid="tiptap-content" />,
  useEditor: () => null
}))

vi.mock('./useTiptapDocument', () => ({
  useTiptapDocument: () => tiptapMocks.collaboration
}))

function createCollaboration(overrides = {}) {
  return {
    doc: {},
    provider: {},
    fragment: null,
    readOnly: false,
    saveStatus: 'saved',
    dirty: false,
    awarenessStates: [],
    setAwarenessField: vi.fn(),
    onUpdate: vi.fn(),
    ...overrides
  }
}

describe('TiptapEditor workspace integration', () => {
  beforeEach(() => {
    tiptapMocks.collaboration = createCollaboration()
  })

  afterEach(cleanup)

  it('reports visitor presence and persistence state to the workspace', async () => {
    const onVisitorCountChange = vi.fn()
    const onCollaborationSaveState = vi.fn()
    tiptapMocks.collaboration = createCollaboration({
      dirty: true,
      saveStatus: 'saving',
      awarenessStates: [{ visitor: { viewing: true } }, { visitor: { viewing: true } }]
    })

    render(
      <TiptapEditor
        editable
        collaborationRoom="world:test:tab:tab-1"
        isVisitor
        onVisitorCountChange={onVisitorCountChange}
        onCollaborationSaveState={onCollaborationSaveState}
      />
    )

    await waitFor(() => expect(onVisitorCountChange).toHaveBeenCalledWith(2))
    expect(onCollaborationSaveState).toHaveBeenCalledWith({ status: 'saving', dirty: true })
    expect(tiptapMocks.collaboration.setAwarenessField).toHaveBeenCalledWith('visitor', { viewing: true })
  })
})

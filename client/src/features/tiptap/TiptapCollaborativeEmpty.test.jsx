import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import TiptapEditor from './TiptapEditor'

const collaborationState = vi.hoisted(() => ({
  value: null
}))

vi.mock('../../hooks/useCollaborationRoom', () => ({
  useCollaborationRoom: () => collaborationState.value
}))

describe('Tiptap empty collaborative document', () => {
  beforeEach(() => {
    Range.prototype.getClientRects = () => []
    Range.prototype.getBoundingClientRect = () => ({
      top: 0,
      right: 0,
      bottom: 20,
      left: 0,
      width: 0,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
    collaborationState.value = {
      doc: new Y.Doc(),
      provider: null,
      synced: false,
      readOnly: false,
      saveStatus: 'saved',
      dirty: false,
      user: null,
      awarenessStates: [],
      setAwarenessField: vi.fn()
    }
  })

  afterEach(() => {
    collaborationState.value.doc.destroy()
    cleanup()
  })

  it('mounts a newly created notion-like tab before its first synchronization', async () => {
    render(
      <TiptapEditor
        content=""
        editable
        worldId="world"
        documentUid="new-tab"
        collaborationRoom="world:world:tab:new-tab"
        currentUser={{ username: 'admin' }}
      />
    )

    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).not.toBeNull()
    })
  })
})

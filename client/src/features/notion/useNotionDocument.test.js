import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

const collaborationMock = vi.hoisted(() => ({ args: null, state: null }))

vi.mock('../../hooks/useCollaborationRoom', () => ({
  useCollaborationRoom: (args) => {
    collaborationMock.args = args
    return collaborationMock.state
  }
}))

import { encodeNotionMigrationUpdate, isPersistedStateVector, useNotionDocument } from './useNotionDocument'

function encodeStateVector(document) {
  const bytes = Y.encodeStateVector(document)
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return window.btoa(value)
}

describe('useNotionDocument helpers', () => {
  beforeEach(() => {
    collaborationMock.args = null
    collaborationMock.state = null
  })

  it('accepts only the state vector matching the current document', () => {
    const document = new Y.Doc()
    document.getText('content').insert(0, 'first')
    const persistedVector = encodeStateVector(document)

    expect(isPersistedStateVector(document, persistedVector)).toBe(true)

    document.getText('content').insert(5, ' change')
    expect(isPersistedStateVector(document, persistedVector)).toBe(false)
    expect(isPersistedStateVector(document, 'invalid')).toBe(false)
    document.destroy()
  })

  it('encodes migration updates without changing their bytes', () => {
    const update = Uint8Array.from([0, 1, 127, 128, 255])
    const decoded = window.atob(encodeNotionMigrationUpdate(update))

    expect(Array.from(decoded, char => char.charCodeAt(0))).toEqual(Array.from(update))
  })
})

describe('useNotionDocument state contract', () => {
  let document

  beforeEach(() => {
    document = new Y.Doc()
    collaborationMock.state = {
      doc: document,
      provider: { sendStateless: vi.fn() },
      user: { id: 'user-1', name: 'User' },
      status: 'connected',
      readOnly: false,
      authenticated: true,
      synced: true,
      saveStatus: 'saved',
      dirty: false,
      awarenessStates: [],
      remoteUsers: [],
      setAwarenessField: vi.fn()
    }
  })

  it('does not accept a stale persistence acknowledgement', () => {
    const { result } = renderHook(() => useNotionDocument({ roomName: 'world:test:tab:tab-1' }))
    expect(result.current.saveStatus).toBe('saved')
    const persistedVector = encodeStateVector(document)

    act(() => document.getText('content').insert(0, 'changed'))
    expect(result.current.saveStatus).toBe('saving')

    act(() => collaborationMock.args.onStateless({
      payload: JSON.stringify({ type: 'document-persisted', stateVector: persistedVector })
    }))
    expect(result.current.saveStatus).toBe('saving')

    act(() => collaborationMock.args.onStateless({
      payload: JSON.stringify({ type: 'document-persisted', stateVector: encodeStateVector(document) })
    }))
    expect(result.current.saveStatus).toBe('saved')
  })

  it('keeps offline and readonly separate from persistence', () => {
    collaborationMock.state = { ...collaborationMock.state, status: 'disconnected', synced: false }
    const { result, rerender } = renderHook(() => useNotionDocument({ roomName: 'world:test:tab:tab-1' }))
    expect(result.current.connectionStatus).toBe('offline')
    expect(result.current.saveStatus).toBe('offline')

    collaborationMock.state = { ...collaborationMock.state, status: 'connected', readOnly: true, synced: true }
    rerender()
    expect(result.current.connectionStatus).toBe('readonly')
    expect(result.current.saveStatus).toBe('readonly')
  })
})

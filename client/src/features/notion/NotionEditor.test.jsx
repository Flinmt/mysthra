import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotionEditor from './NotionEditor'

const notionMocks = vi.hoisted(() => ({ document: null, surfaceProps: null }))

vi.mock('./useNotionDocument', () => ({
  useNotionDocument: () => notionMocks.document
}))

vi.mock('./NotionSurface', () => ({
  default: (props) => {
    notionMocks.surfaceProps = props
    return <div data-testid="notion-surface" />
  }
}))

function createNotionDocument(overrides = {}) {
  return {
    doc: {},
    provider: {},
    fragment: {},
    user: { id: 'user-1', name: 'Alice' },
    readOnly: false,
    synced: true,
    saveStatus: 'saved',
    dirty: false,
    hasSharedContent: true,
    requestMigration: vi.fn(),
    awarenessStates: [],
    setAwarenessField: vi.fn(),
    ...overrides
  }
}

describe('NotionEditor', () => {
  beforeEach(() => {
    notionMocks.surfaceProps = null
    notionMocks.document = createNotionDocument()
  })

  afterEach(cleanup)

  it('provides the collaborative document to the BlockNote surface', () => {
    render(<NotionEditor content="" contentKey="tab-1" editable collaborationRoom="world:test:tab:tab-1" />)

    expect(notionMocks.surfaceProps.collaborationState).toEqual({
      doc: notionMocks.document.doc,
      provider: notionMocks.document.provider,
      fragment: notionMocks.document.fragment
    })
    expect(notionMocks.surfaceProps.collaborationReadOnly).toBe(false)
  })

  it('uses local legacy content for readonly documents without shared blocks', () => {
    notionMocks.document = createNotionDocument({ readOnly: true, hasSharedContent: false })
    render(<NotionEditor content="# Legacy" contentKey="tab-1" editable={false} collaborationRoom="world:test:tab:tab-1" />)

    expect(notionMocks.surfaceProps.collaborationState).toBeNull()
    expect(notionMocks.surfaceProps.collaborationReadOnly).toBe(true)
    expect(notionMocks.surfaceProps.content).toBe('# Legacy')
  })

  it('reports visitor presence and persistence state to the workspace', async () => {
    const onVisitorCountChange = vi.fn()
    const onCollaborationSaveState = vi.fn()
    notionMocks.document = createNotionDocument({
      dirty: true,
      saveStatus: 'saving',
      awarenessStates: [{ visitor: { viewing: true } }, { visitor: { viewing: true } }]
    })

    render(
      <NotionEditor
        content=""
        contentKey="tab-1"
        editable
        collaborationRoom="world:test:tab:tab-1"
        isVisitor
        onVisitorCountChange={onVisitorCountChange}
        onCollaborationSaveState={onCollaborationSaveState}
      />
    )

    await waitFor(() => expect(onVisitorCountChange).toHaveBeenCalledWith(2))
    expect(onCollaborationSaveState).toHaveBeenCalledWith({ status: 'saving', dirty: true })
    expect(notionMocks.document.setAwarenessField).toHaveBeenCalledWith('visitor', { viewing: true })
  })
})

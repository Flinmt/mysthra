import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkspaceInsertSearch from './WorkspaceInsertSearch'

describe('WorkspaceInsertSearch', () => {
  afterEach(cleanup)

  it('identifies experimental Tiptap tabs without falling back to Notion', async () => {
    const user = userEvent.setup()
    const documentTree = [{
      uid: 'document-1',
      path: 'Lore',
      name: 'Lore',
      type: 'container',
      children: [{
        uid: 'tab-1',
        path: 'Lore/Notes',
        name: 'Notes',
        type: 'tab',
        contentType: 'tiptap'
      }]
    }]

    render(
      <WorkspaceInsertSearch
        documentTree={documentTree}
        mode="page-link"
        onClose={vi.fn()}
        labels={{
          searchTabsAssetsPlaceholder: 'Search',
          resultTypeTab: 'Tab',
          tabTypeNotion: 'Notion',
          tabTypeTiptap: 'Tiptap'
        }}
      />
    )

    await user.type(screen.getByPlaceholderText('Search'), 'Tiptap')

    expect(screen.getByRole('button', { name: /Tab · Notes · Tiptap/ })).toBeTruthy()
    expect(screen.queryByText(/Tab · Notes · Notion/)).toBeNull()
  })
})

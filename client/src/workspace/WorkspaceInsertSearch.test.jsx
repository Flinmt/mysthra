import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkspaceInsertSearch from './WorkspaceInsertSearch'

describe('WorkspaceInsertSearch', () => {
  afterEach(cleanup)

  it('identifies legacy Tiptap tabs as Notion', async () => {
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
          tabTypeNotion: 'Notion'
        }}
      />
    )

    await user.type(screen.getByPlaceholderText('Search'), 'Notion')

    expect(screen.getByRole('option', { name: /Notes.*Tab · Notion.*Lore/ })).toBeTruthy()
    expect(screen.queryByText(/Tab · Notes · Tiptap/)).toBeNull()
  })

  it('finds accented tab names without accents and exposes their document paths', async () => {
    const user = userEvent.setup()
    const documentTree = [{
      uid: 'root-document',
      path: 'Compêndio',
      name: 'Compêndio',
      type: 'container',
      children: [{
        uid: 'nested-document',
        path: 'Compêndio/Criaturas',
        name: 'Criaturas',
        type: 'container',
        children: [{
          uid: 'tab-1',
          path: 'Compêndio/Criaturas/Dragões',
          name: 'Dragões Anciões',
          type: 'tab',
          contentType: 'wiki'
        }]
      }]
    }]

    render(
      <WorkspaceInsertSearch
        documentTree={documentTree}
        mode="page-link"
        onClose={vi.fn()}
        labels={{
          searchTabsAssetsPlaceholder: 'Search',
          searchHint: 'Type to search',
          resultTypeTab: 'Tab',
          tabTypeNotion: 'Notion'
        }}
      />
    )

    expect(screen.getByText('Type to search')).toBeTruthy()
    expect(screen.queryByRole('option')).toBeNull()

    await user.type(screen.getByPlaceholderText('Search'), 'dragoes')

    expect(screen.getByRole('option', {
      name: /Dragões Anciões.*Compêndio > Criaturas/
    })).toBeTruthy()
  })

  it('selects search results with the keyboard and inserts the tab name by default', async () => {
    const user = userEvent.setup()
    const onInsertPageLink = vi.fn()
    const documentTree = [{
      uid: 'document-1',
      path: 'Lore',
      name: 'Lore',
      type: 'container',
      children: [
        { uid: 'tab-1', path: 'Lore/Bestiary', name: 'Bestiary', type: 'tab', contentType: 'wiki' },
        { uid: 'tab-2', path: 'Lore/Beasts', name: 'Beasts', type: 'tab', contentType: 'wiki' }
      ]
    }]

    render(
      <WorkspaceInsertSearch
        documentTree={documentTree}
        mode="page-link"
        onInsertPageLink={onInsertPageLink}
        onClose={vi.fn()}
        labels={{
          searchTabsAssetsPlaceholder: 'Search',
          resultTypeTab: 'Tab',
          tabTypeNotion: 'Notion'
        }}
      />
    )

    const input = screen.getByPlaceholderText('Search')
    await user.type(input, 'be')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onInsertPageLink).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Bestiary',
      tab: expect.objectContaining({ uid: 'tab-1' })
    }))
  })
})

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Book, Image } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssetContextMenu, AssetPreviewDialog, DocumentChrome, WorkspaceBody, WorkspaceBootScreen, WorkspaceSidebar, WorkspaceTabRow, WorkspaceTopbar } from './WorkspaceShell'

describe('WorkspaceShell', () => {
  afterEach(cleanup)

  it('renders the themed boot state', () => {
    const themeStyle = { '--world-theme-accent': '#c17539' }
    const { container } = render(<WorkspaceBootScreen theme="ember-archive" themeStyle={themeStyle} title="Eldoria" label="Loading" />)

    expect(screen.getByText('Eldoria')).toBeTruthy()
    expect(container.firstChild.getAttribute('data-world-theme')).toBe('ember-archive')
    expect(container.firstChild.style.getPropertyValue('--world-theme-accent')).toBe('#c17539')
  })

  it('keeps navigator mode selection available', async () => {
    const user = userEvent.setup()
    const onTabChange = vi.fn()

    render(
      <WorkspaceSidebar
        tabs={[{ id: 'wiki', label: 'Wiki', icon: Book }, { id: 'assets', label: 'Assets', icon: Image }]}
        activeTab="wiki"
        tabsLabel="Workspace sections"
        onTabChange={onTabChange}
        collapseLabel="Collapse sidebar"
        onClose={vi.fn()}
      >
        <div>Sidebar content</div>
      </WorkspaceSidebar>
    )

    await user.click(screen.getByRole('tab', { name: 'Assets' }))

    expect(onTabChange).toHaveBeenCalledWith('assets')
    expect(screen.getByRole('tab', { name: 'Wiki' }).getAttribute('aria-selected')).toBe('true')
  })

  it('renders public navigator content without privileged controls', () => {
    render(
      <WorkspaceSidebar tabs={[]} activeTab="wiki" collapseLabel="Collapse sidebar" onClose={vi.fn()}>
        <div>Public document tree</div>
      </WorkspaceSidebar>
    )

    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Public document tree')).toBeTruthy()
  })

  it('exposes collapsed and mobile drawer states', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <WorkspaceSidebar tabs={[{ id: 'wiki', label: 'Wiki', icon: Book }]} activeTab="wiki" isCollapsed collapseLabel="Collapse sidebar" onClose={onClose} />
    )

    expect(document.getElementById('workspace-sidebar').dataset.collapsed).toBe('true')

    rerender(
      <WorkspaceSidebar tabs={[{ id: 'wiki', label: 'Wiki', icon: Book }]} activeTab="wiki" isMobile isDrawerOpen collapseLabel="Collapse sidebar" onClose={onClose} />
    )
    expect(document.getElementById('workspace-sidebar').dataset.drawerOpen).toBe('true')
    expect(screen.getAllByLabelText('Collapse sidebar')).toHaveLength(2)
  })

  it('coordinates global navigation, breadcrumbs and world actions', async () => {
    const user = userEvent.setup()
    const onToggleNavigator = vi.fn()
    const onBack = vi.fn()
    const onSelectBreadcrumb = vi.fn()
    const onOpenSettings = vi.fn()
    const onShareWorld = vi.fn()
    const breadcrumbs = [{ name: 'Lore', path: '/lore' }, { name: 'Cities', path: '/lore/cities' }]

    render(
      <WorkspaceTopbar
        worldName="Eldoria"
        breadcrumbs={breadcrumbs}
        navigatorOpen
        canManageWorld
        saveStatus="saved"
        saveStatusLabel="Saved"
        presenceUsers={[{ id: '1', name: 'Alice', color: '#58727a' }]}
        navigatorLabel="Toggle navigator"
        backLabel="Back"
        settingsLabel="World settings"
        worldMenuLabel="World menu"
        shareLabel="Share world"
        onToggleNavigator={onToggleNavigator}
        onBack={onBack}
        onSelectBreadcrumb={onSelectBreadcrumb}
        onOpenSettings={onOpenSettings}
        onShareWorld={onShareWorld}
      />
    )

    await user.click(screen.getByLabelText('Toggle navigator'))
    await user.click(screen.getByLabelText('Back'))
    await user.click(screen.getByRole('button', { name: 'Lore' }))
    await user.click(screen.getByLabelText('World settings'))
    await user.click(screen.getByLabelText('World menu'))
    await user.click(screen.getByRole('menuitem', { name: 'Share world' }))

    expect(onToggleNavigator).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
    expect(onSelectBreadcrumb).toHaveBeenCalledWith(breadcrumbs[0])
    expect(onOpenSettings).toHaveBeenCalledOnce()
    expect(onShareWorld).toHaveBeenCalledOnce()
  })

  it('reserves inspector space only when content is provided', () => {
    const { rerender } = render(<WorkspaceBody navigator={<nav>Tree</nav>} content={<main>Document</main>} />)
    expect(screen.queryByText('Inspector')).toBeNull()
    expect(screen.getByText('Tree').parentElement.dataset.hasInspector).toBeUndefined()

    rerender(<WorkspaceBody navigator={<nav>Tree</nav>} content={<main>Document</main>} inspector={<div>Inspector</div>} />)
    expect(screen.getByText('Inspector')).toBeTruthy()
    expect(screen.getByText('Tree').parentElement.dataset.hasInspector).toBe('true')
  })

  it('loads and closes the asset preview dialog with Escape', () => {
    const onClose = vi.fn()
    render(
      <AssetPreviewDialog
        asset={{ name: 'Map.png', path: 'maps/Map.png', mediaType: 'image' }}
        source="/map.png"
        sizeLabel="24 KB"
        typeLabel="Image"
        labels={{ close: 'Close preview', loading: 'Loading preview', error: 'Preview failed', path: 'Path', size: 'Size' }}
        onClose={onClose}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Map.png' })).toBeTruthy()
    expect(screen.getByText('Loading preview')).toBeTruthy()
    fireEvent.load(screen.getByRole('img', { name: 'Map.png' }))
    expect(screen.queryByText('Loading preview')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('reports media failures and closes the preview from its backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(
      <AssetPreviewDialog
        asset={{ name: 'Theme.ogg', path: 'audio/Theme.ogg', mediaType: 'audio' }}
        source="/theme.ogg"
        sizeLabel="1.2 MB"
        typeLabel="Audio"
        labels={{ close: 'Close preview', loading: 'Loading preview', error: 'Preview failed', path: 'Path', size: 'Size' }}
        onClose={onClose}
      />
    )

    fireEvent.error(container.querySelector('audio'))
    expect(screen.getByText('Preview failed')).toBeTruthy()
    fireEvent.pointerDown(container.querySelector('.asset-preview-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows only read actions in an asset context menu for visitors', async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn()
    const onCopyReference = vi.fn()
    const callbacks = {
      onPreview,
      onCopyReference,
      onUpload: vi.fn(),
      onCreateFolder: vi.fn(),
      onDuplicate: vi.fn(),
      onMove: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn()
    }
    const labels = { preview: 'Preview', copyReference: 'Copy reference', uploadHere: 'Upload here', newFolder: 'New folder', duplicate: 'Duplicate', move: 'Move', rename: 'Rename', delete: 'Delete' }

    render(<AssetContextMenu node={{ name: 'Map.png', path: 'Map.png', type: 'file', mediaType: 'image' }} isVisitor labels={labels} {...callbacks} />)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await user.click(screen.getByRole('button', { name: 'Copy reference' }))

    expect(onPreview).toHaveBeenCalledOnce()
    expect(onCopyReference).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('keeps preview unavailable for folders and preserves member write actions', () => {
    const labels = { preview: 'Preview', copyReference: 'Copy reference', uploadHere: 'Upload here', newFolder: 'New folder', duplicate: 'Duplicate', move: 'Move', rename: 'Rename', delete: 'Delete' }
    const callbacks = { onPreview: vi.fn(), onCopyReference: vi.fn(), onUpload: vi.fn(), onCreateFolder: vi.fn(), onDuplicate: vi.fn(), onMove: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() }

    render(<AssetContextMenu node={{ name: 'Maps', path: 'Maps', type: 'folder', children: [] }} isVisitor={false} labels={labels} {...callbacks} />)

    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Upload here' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rename' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('preserves tab selection, rename, context menu and creation callbacks', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onContextMenu = vi.fn(event => event.preventDefault())
    const onRenameCommit = vi.fn()
    const onCreate = vi.fn()
    const tabs = [{ uid: 'tab-1', path: '/doc/main', name: 'Main', contentType: 'wiki' }]

    const { rerender } = render(
      <DocumentChrome
        title={<h1>Document</h1>}
        controls={<span>Saved</span>}
        tabs={(
          <WorkspaceTabRow
            tabs={tabs}
            activeTab={tabs[0]}
            renamingTab={{ path: '', value: '' }}
            canCreate
            createLabel="Create tab"
            getTabIcon={() => Book}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onRenameChange={vi.fn()}
            onRenameCommit={onRenameCommit}
            onRenameCancel={vi.fn()}
            onCreate={onCreate}
          />
        )}
      />
    )

    const tab = screen.getByRole('button', { name: 'Main' })
    await user.click(tab)
    fireEvent.contextMenu(tab)
    await user.click(screen.getByTitle('Create tab'))

    expect(onSelect).toHaveBeenCalledWith(tabs[0])
    expect(onContextMenu).toHaveBeenCalled()
    expect(onCreate).toHaveBeenCalledOnce()

    rerender(
      <WorkspaceTabRow
        tabs={tabs}
        activeTab={tabs[0]}
        renamingTab={{ path: tabs[0].path, value: 'Renamed' }}
        canCreate={false}
        createLabel="Create tab"
        getTabIcon={() => Book}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
        onRenameChange={vi.fn()}
        onRenameCommit={onRenameCommit}
        onRenameCancel={vi.fn()}
        onCreate={onCreate}
      />
    )

    fireEvent.blur(screen.getByDisplayValue('Renamed'))
    expect(onRenameCommit).toHaveBeenCalledWith(tabs[0])
  })

  it('renders a local draft as an inline rename field', async () => {
    const user = userEvent.setup()
    const onDraftNameChange = vi.fn()
    const onDraftRenameCommit = vi.fn()

    render(
      <WorkspaceTabRow
        tabs={[]}
        activeTab={null}
        renamingTab={{ path: '', value: '' }}
        draftTab={{ name: 'Untitled', isCreating: false }}
        draftRenameLabel="Rename draft tab"
        canCreate={false}
        getTabIcon={() => Book}
        onDraftNameChange={onDraftNameChange}
        onDraftRenameCommit={onDraftRenameCommit}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Rename draft tab' })
    expect(input.parentElement.classList.contains('editor-tab-pill')).toBe(true)
    expect(input.parentElement.classList.contains('active')).toBe(true)
    await user.clear(input)
    await user.type(input, 'Lore{Enter}')

    expect(onDraftNameChange).toHaveBeenCalled()
    expect(onDraftRenameCommit).toHaveBeenCalledOnce()
  })

  it('keeps creation after the last tab while overflowing tabs can be scrolled', async () => {
    const tabs = Array.from({ length: 12 }, (_, index) => ({
      uid: `tab-${index + 1}`,
      path: `/doc/tab-${index + 1}`,
      name: `Tab ${index + 1}`,
      contentType: 'wiki'
    }))
    const { container } = render(
      <WorkspaceTabRow
        tabs={tabs}
        activeTab={tabs[0]}
        renamingTab={{ path: '', value: '' }}
        scrollBackLabel="Scroll tabs back"
        scrollForwardLabel="Scroll tabs forward"
        canCreate
        createLabel="Create tab"
        getTabIcon={() => Book}
        onSelect={vi.fn()}
        onContextMenu={vi.fn()}
        onRenameChange={vi.fn()}
        onRenameCommit={vi.fn()}
        onRenameCancel={vi.fn()}
        onCreate={vi.fn()}
      />
    )

    const row = container.querySelector('.editor-tab-row')
    Object.defineProperties(row, {
      clientWidth: { configurable: true, value: 240 },
      scrollWidth: { configurable: true, value: 960 },
      scrollLeft: { configurable: true, writable: true, value: 0 }
    })
    row.scrollBy = vi.fn()
    fireEvent(window, new Event('resize'))

    const forward = await screen.findByRole('button', { name: 'Scroll tabs forward' })
    expect(screen.getByRole('button', { name: 'Scroll tabs back' }).disabled).toBe(true)
    expect(row.contains(screen.getByRole('button', { name: 'Create tab' }))).toBe(true)

    fireEvent.click(forward)
    expect(row.scrollBy).toHaveBeenCalledWith({ left: 168, behavior: 'smooth' })

    fireEvent.wheel(row, { deltaY: 90 })
    await waitFor(() => expect(row.scrollLeft).toBe(90))
  })
})

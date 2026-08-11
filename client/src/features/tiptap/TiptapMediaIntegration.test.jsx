import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TiptapEditor from './TiptapEditor'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => ({
      'workspace.tiptap_placeholder': 'Digite ou use /',
      'workspace.tiptap_block_placeholder': 'Digite ou use /',
      'workspace.tiptap_block_add': 'Adicionar bloco',
      'workspace.tiptap_block_add_hint': 'Clique para adicionar abaixo',
      'workspace.tiptap_block_menu': 'Abrir ações do bloco ou arrastar',
      'workspace.tiptap_block_actions': 'Ações do bloco',
      'workspace.tiptap_block_insert_above': 'Inserir acima',
      'workspace.tiptap_block_insert_below': 'Inserir abaixo',
      'workspace.tiptap_block_duplicate': 'Duplicar',
      'workspace.tiptap_block_delete': 'Excluir',
      'workspace.tiptap_heading_placeholder': 'Título',
      'workspace.tiptap_toggle_heading_placeholder': 'Título expansível',
      'workspace.tiptap_media_unavailable': 'Mídia indisponível',
      'workspace.tiptap_resize_image': 'Redimensionar imagem',
      'workspace.tiptap_table_insert': 'Inserir tabela',
      'workspace.tiptap_table_size': 'Tamanho da tabela',
      'workspace.tiptap_table_header_row': 'Linha de cabeçalho',
      'workspace.tiptap_table_header_column': 'Coluna de cabeçalho',
      'workspace.tiptap_table_row': 'Linha',
      'workspace.tiptap_table_column': 'Coluna',
      'workspace.tiptap_table_open_row_menu': 'Abrir controles da linha',
      'workspace.tiptap_table_open_column_menu': 'Abrir controles da coluna',
      'workspace.tiptap_table_add_block_below': 'Adicionar bloco abaixo',
      'workspace.tiptap_table_delete_row': 'Excluir linha',
      'workspace.tiptap_table_duplicate_row': 'Duplicar linha',
      'workspace.tiptap_table_clear_row': 'Limpar linha',
      'workspace.tiptap_table_delete_column': 'Excluir coluna',
      'workspace.tiptap_table_duplicate_column': 'Duplicar coluna',
      'workspace.tiptap_table_clear_column': 'Limpar coluna',
      'workspace.tiptap_table_cannot_delete_last': 'Use Excluir tabela'
    })[key] || key
  })
}))

vi.mock('./useTiptapDocument', () => ({
  useTiptapDocument: () => ({
    doc: null,
    provider: null,
    fragment: null,
    readOnly: false,
    saveStatus: 'saved',
    dirty: false,
    awarenessStates: [],
    setAwarenessField: vi.fn(),
    onUpdate: vi.fn()
  })
}))

describe('Tiptap media picker integration', () => {
  beforeEach(() => {
    document.elementFromPoint = () => document.querySelector('.ProseMirror')
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
  })

  afterEach(cleanup)

  it('hides block and table controls in read-only mode', async () => {
    render(
      <TiptapEditor
        content="<table><tbody><tr><td><p>Célula</p></td></tr></tbody></table>"
        editable={false}
        worldId="world"
      />
    )

    await waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull())
    expect(screen.queryByRole('button', { name: 'Adicionar bloco' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Abrir controles da linha/ })).toBeNull()
  })

  it('starts block marquee selection from the editor outer margin', async () => {
    render(
      <section className="editor-page-body">
        <TiptapEditor
          content="<p>A</p><p>B</p><p>C</p>"
          editable
          worldId="world"
        />
      </section>
    )
    const editor = document.querySelector('.ProseMirror')
    await waitFor(() => expect(editor?.children).toHaveLength(3))
    Array.from(editor.children).forEach((block, index) => {
      block.getBoundingClientRect = () => ({
        left: 40, right: 340, width: 300,
        top: 10 + index * 40, bottom: 40 + index * 40, height: 30
      })
    })

    fireEvent.pointerDown(document.querySelector('.editor-page-body'), {
      clientX: 0, clientY: 5
    })
    fireEvent.pointerMove(document, { clientX: 350, clientY: 75 })
    fireEvent.pointerUp(document)

    expect(editor.querySelectorAll('.tiptap-block-multi-selected')).toHaveLength(2)
  })

  it('opens the image explorer from /image and inserts the confirmed asset', async () => {
    const user = userEvent.setup()
    const onRequestMedia = vi.fn()
    render(
      <TiptapEditor
        content="<p></p>"
        editable
        worldId="world"
        onRequestMedia={onRequestMedia}
      />
    )

    const editor = document.querySelector('.ProseMirror')
    await user.click(editor)
    await user.type(editor, '/image')

    await user.click(await screen.findByRole('option', { name: /Inserir mídia/ }))
    expect(onRequestMedia).toHaveBeenCalledTimes(1)
    expect(onRequestMedia.mock.calls[0][0]).toBeNull()
    expect(editor.textContent).not.toContain('/image')

    onRequestMedia.mock.calls[0][1]({
      id: 'image-1',
      name: 'map.gif',
      mediaType: 'image',
      contentType: 'image/gif'
    })

    await waitFor(() => {
      expect(editor.querySelector('.tiptap-media-image img')?.getAttribute('src'))
        .toBe('/api/worlds/world/assets/file?id=image-1')
    })
    fireEvent.load(editor.querySelector('.tiptap-media-image img'))
    expect(editor.querySelectorAll('p')).toHaveLength(1)
  })

  it('finds slash commands by aliases and multi-word queries', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<TiptapEditor content="<p></p>" editable worldId="world" />)
    let editor = document.querySelector('.ProseMirror')

    await user.click(editor)
    await user.type(editor, '/H2')
    expect(await screen.findByRole('option', { name: /Título 2/ })).not.toBeNull()

    unmount()
    render(<TiptapEditor content="<p></p>" editable worldId="world" />)
    editor = document.querySelector('.ProseMirror')
    await user.click(editor)
    await user.type(editor, '/lista numerada')
    expect(await screen.findByRole('option', { name: /Lista numerada/ })).not.toBeNull()
  })

  it('inserts a callout from the slash menu', async () => {
    const user = userEvent.setup()
    render(<TiptapEditor content="<p></p>" editable worldId="world" />)

    const editor = document.querySelector('.ProseMirror')
    await user.click(editor)
    await user.type(editor, '/callout')
    await user.click(await screen.findByRole('option', { name: /Destaque/ }))

    await waitFor(() => expect(editor.querySelector('.tiptap-callout')).not.toBeNull())
    expect(editor.textContent).not.toContain('/callout')
    expect(editor.querySelector('.tiptap-callout').getAttribute('data-variant')).toBe('info')
  })

  it('adds, duplicates and deletes complete root blocks from the shared controls', async () => {
    const user = userEvent.setup()
    render(
      <TiptapEditor
        content="<p>Primeiro</p><p>Segundo</p>"
        editable
        worldId="world"
      />
    )

    const editor = document.querySelector('.ProseMirror')
    await user.click(editor.querySelector('p'))
    await user.click(await screen.findByRole('button', {
      name: 'Abrir ações do bloco ou arrastar'
    }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicar' }))
    expect(Array.from(editor.querySelectorAll(':scope > p'), node => node.textContent))
      .toEqual(['Primeiro', 'Primeiro', 'Segundo'])

    await user.click(screen.getByRole('button', {
      name: 'Abrir ações do bloco ou arrastar'
    }))
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    expect(Array.from(editor.querySelectorAll(':scope > p'), node => node.textContent))
      .toEqual(['Primeiro', 'Segundo'])

    await user.click(screen.getByRole('button', {
      name: 'Abrir ações do bloco ou arrastar'
    }))
    await user.click(screen.getByRole('menuitem', { name: 'Inserir acima' }))
    expect(screen.queryByRole('listbox', { name: 'Comandos' })).toBeNull()
    expect(editor.querySelectorAll(':scope > p')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Adicionar bloco' }))
    expect(screen.queryByRole('listbox', { name: 'Comandos' })).toBeNull()
    expect(editor.querySelectorAll(':scope > p')).toHaveLength(4)
  })

  it('uses an internal payload when dragging a block', async () => {
    const user = userEvent.setup()
    render(<TiptapEditor content="<p>Bloco</p>" editable worldId="world" />)

    const editor = document.querySelector('.ProseMirror')
    await user.click(editor.querySelector('p'))
    const handle = await screen.findByRole('button', {
      name: 'Abrir ações do bloco ou arrastar'
    })
    const dataTransfer = {
      effectAllowed: '',
      setData: vi.fn(),
      setDragImage: vi.fn()
    }

    fireEvent.dragStart(handle, { dataTransfer })

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-mysthra-block',
      '0'
    )
    expect(dataTransfer.setData).not.toHaveBeenCalledWith(
      'text/plain',
      expect.anything()
    )
    expect(dataTransfer.setDragImage).toHaveBeenCalledWith(
      expect.objectContaining({ className: expect.stringContaining('tiptap-block-drag-preview') }),
      24,
      expect.any(Number)
    )
    fireEvent.dragEnd(handle, { dataTransfer })
    expect(document.querySelector('.tiptap-block-drag-preview')).toBeNull()
  })

  it('inserts a 3 × 3 table with a header row directly from the slash menu', async () => {
    const user = userEvent.setup()
    render(<TiptapEditor content="<p></p>" editable worldId="world" />)

    const editor = document.querySelector('.ProseMirror')
    await user.click(editor)
    await user.type(editor, '/table')
    await user.click(await screen.findByRole('option', { name: /Tabela/ }))

    await waitFor(() => expect(editor.querySelector('table')).not.toBeNull())
    expect(screen.queryByRole('dialog', { name: 'Inserir tabela' })).toBeNull()
    expect(editor.querySelectorAll('tr')).toHaveLength(3)
    expect(editor.querySelectorAll('tr:first-child th')).toHaveLength(3)
    expect(editor.querySelector(':scope > p:last-child')).not.toBeNull()
    expect(editor.textContent).not.toContain('/table')
    expect(editor.querySelector('table [data-placeholder]')).toBeNull()

    await user.click(screen.getByRole('button', {
      name: 'Abrir ações do bloco ou arrastar'
    }))
    expect(await screen.findByRole('menu', { name: 'Ações do bloco' })).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Duplicar' })).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', {
      name: 'Abrir controles da linha 1'
    })).toBeNull()
    fireEvent.pointerMove(editor.querySelector('th'))

    const rowHandle = await screen.findByRole('button', {
      name: 'Abrir controles da linha 1'
    })
    await user.click(rowHandle)
    const rowMenu = await screen.findByRole('menu', { name: 'Linha 1' })
    expect(rowMenu.querySelector('strong')).toBeNull()
    expect(screen.getByRole('menuitemcheckbox', {
      name: /Linha de cabeçalho/
    }).getAttribute('aria-checked')).toBe('true')
    expect(rowMenu.querySelector('.tiptap-table-toggle-label')).toBeNull()
    expect(rowMenu.querySelector('.tiptap-table-toggle-switch')).not.toBeNull()
    expect(rowMenu.querySelector('.lucide-arrow-up')).not.toBeNull()
    expect(rowMenu.querySelector('.lucide-arrow-down')).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Duplicar linha' })).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Limpar linha' })).not.toBeNull()
    expect(screen.queryByRole('toolbar')).toBeNull()
    await user.click(screen.getByRole('menuitem', { name: 'Excluir linha' }))
    expect(editor.querySelectorAll('tr')).toHaveLength(2)

    await user.click(screen.getByRole('button', {
      name: 'Abrir controles da linha 1'
    }))
    await user.click(screen.getByRole('menuitem', { name: 'Excluir linha' }))
    expect(editor.querySelectorAll('tr')).toHaveLength(1)

    await user.click(screen.getByRole('button', {
      name: 'Abrir controles da linha 1'
    }))
    expect(screen.getByRole('menuitem', { name: 'Excluir linha' }).disabled).toBe(true)
    await user.keyboard('{Escape}')

    for (const remainingColumns of [2, 1]) {
      await user.click(screen.getByRole('button', {
        name: 'Abrir controles da coluna 1'
      }))
      const columnMenu = screen.getByRole('menu', { name: 'Coluna 1' })
      expect(columnMenu.querySelector('strong')).toBeNull()
      expect(columnMenu.querySelector('.lucide-arrow-left')).not.toBeNull()
      expect(columnMenu.querySelector('.lucide-arrow-right')).not.toBeNull()
      const deleteColumn = screen.getByRole('menuitem', { name: 'Excluir coluna' })
      await user.click(deleteColumn)
      expect(editor.querySelectorAll('tr:first-child > *')).toHaveLength(remainingColumns)
    }
    await user.click(screen.getByRole('button', {
      name: 'Abrir controles da coluna 1'
    }))
    expect(screen.getByRole('menuitem', { name: 'Excluir coluna' }).disabled).toBe(true)
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Adicionar bloco' }))
    expect(editor.querySelectorAll(':scope > p')).toHaveLength(1)
    expect(screen.queryByRole('listbox', { name: 'Comandos' })).toBeNull()

    const firstCell = editor.querySelector('td p, th p')
    await user.click(firstCell)
    await user.type(firstCell, '/table')

    expect(screen.queryByRole('listbox', { name: 'Comandos' })).toBeNull()
    expect(firstCell.textContent).toBe('/table')
    expect(firstCell.hasAttribute('data-placeholder')).toBe(false)
  })
})

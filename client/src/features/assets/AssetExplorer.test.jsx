import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssetExplorer from './AssetExplorer'
import {
  loadAssetTrash,
  loadAssetTree,
  renameAssetItem
} from './assetApi'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pt' },
    t: key => ({
      'common.rename': 'Renomear',
      'assetExplorer.title': 'Explorador de assets',
      'assetExplorer.sections': 'Seções do explorador',
      'assetExplorer.assets': 'Assets',
      'assetExplorer.trash': 'Lixeira',
      'assetExplorer.empty': 'Esta pasta está vazia',
      'assetExplorer.trashEmpty': 'A lixeira está vazia',
      'assetExplorer.newFolder': 'Nova pasta',
      'assetExplorer.uploadFiles': 'Enviar arquivos',
      'assetExplorer.uploadFolder': 'Enviar pasta',
      'assetExplorer.copy': 'Copiar',
      'assetExplorer.cut': 'Recortar',
      'assetExplorer.trashAction': 'Mover para lixeira',
      'assetExplorer.refresh': 'Atualizar'
    })[key] || key
  })
}))

vi.mock('./assetApi', async importOriginal => ({
  ...await importOriginal(),
  loadAssetTree: vi.fn(),
  loadAssetTrash: vi.fn(),
  renameAssetItem: vi.fn()
}))

describe('AssetExplorer rename flow', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renames an item inline from its context menu', async () => {
    const user = userEvent.setup()
    const folder = { id: 'folder-1', name: 'Lore', path: 'Lore', type: 'folder', children: [] }
    loadAssetTree.mockResolvedValue({ revision: 1, items: [folder] })
    loadAssetTrash.mockResolvedValue({ revision: 1, items: [] })
    renameAssetItem.mockResolvedValue({ ...folder, name: 'Characters', path: 'Characters' })

    render(
      <AssetExplorer
        worldId="world"
        clipboard={null}
        onClipboardChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const item = (await screen.findAllByRole('button', { name: /Lore/ }))
      .find(element => element.classList.contains('asset-explorer-item'))
    fireEvent.contextMenu(item, { clientX: 100, clientY: 100 })
    await user.click(screen.getByRole('button', { name: 'Renomear' }))

    const input = screen.getByDisplayValue('Lore')
    await user.clear(input)
    await user.type(input, 'Characters')
    expect(input.value).toBe('Characters')
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(renameAssetItem).toHaveBeenCalledWith('world', folder, 'Characters')
    })
  })

  it('uses the sidebar only to switch between assets and the trash', async () => {
    const user = userEvent.setup()
    loadAssetTree.mockResolvedValue({ revision: 1, items: [] })
    loadAssetTrash.mockResolvedValue({ revision: 1, items: [] })

    render(
      <AssetExplorer
        worldId="world"
        clipboard={null}
        onClipboardChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(await screen.findByText('Esta pasta está vazia')).toBeTruthy()
    const sidebar = screen.getByRole('complementary', { name: 'Seções do explorador' })
    expect(sidebar.querySelectorAll('button')).toHaveLength(2)
    expect(sidebar.querySelector('.asset-explorer-folder-tree')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Lixeira' }))

    expect(await screen.findByText('A lixeira está vazia')).toBeTruthy()
  })
})

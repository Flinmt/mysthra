import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssetExplorer from './AssetExplorer'
import {
  loadAssetTrash,
  loadAssetTree,
  loadAssetPermissions,
  renameAssetItem,
  saveAssetPermissions
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
      'assetExplorer.insert': 'Inserir',
      'assetExplorer.insertMedia': 'Selecionar imagem, GIF ou áudio',
      'assetExplorer.insertImage': 'Selecionar imagem ou GIF',
      'assetExplorer.insertAudio': 'Selecionar áudio',
      'assetExplorer.wrongMediaType': 'Tipo incompatível',
      'assetExplorer.newFolder': 'Nova pasta',
      'assetExplorer.uploadFiles': 'Enviar arquivos',
      'assetExplorer.uploadFolder': 'Enviar pasta',
      'assetExplorer.copy': 'Copiar',
      'assetExplorer.cut': 'Recortar',
      'assetExplorer.trashAction': 'Mover para lixeira',
      'assetExplorer.manageAccess': 'Gerenciar acesso',
      'assetExplorer.inheritAccess': 'Herdar permissões',
      'assetExplorer.allWorldMembers': 'Todos os membros do mundo',
      'assetExplorer.accessInherited': 'Herdado',
      'assetExplorer.accessNone': 'Sem acesso',
      'assetExplorer.accessRead': 'Leitura',
      'assetExplorer.accessWrite': 'Escrita',
      'assetExplorer.owner': 'Proprietário',
      'assetExplorer.refresh': 'Atualizar'
    })[key] || key
  })
}))

vi.mock('./assetApi', async importOriginal => ({
  ...await importOriginal(),
  loadAssetTree: vi.fn(),
  loadAssetTrash: vi.fn(),
  loadAssetPermissions: vi.fn(),
  saveAssetPermissions: vi.fn(),
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

  it('filters insertion mode and returns one compatible asset', async () => {
    const user = userEvent.setup()
    const image = {
      id: 'image-1',
      name: 'map.gif',
      path: 'map.gif',
      type: 'file',
      mediaType: 'image',
      contentType: 'image/gif',
      size: 120
    }
    const audio = {
      id: 'audio-1',
      name: 'theme.opus',
      path: 'theme.opus',
      type: 'file',
      mediaType: 'audio',
      contentType: 'audio/ogg',
      size: 240
    }
    const onInsert = vi.fn()
    loadAssetTree.mockResolvedValue({ revision: 1, items: [image, audio] })
    loadAssetTrash.mockResolvedValue({ revision: 1, items: [] })

    render(
      <AssetExplorer
        worldId="world"
        mode="insert"
        mediaFilter="image"
        clipboard={null}
        onClipboardChange={vi.fn()}
        onInsert={onInsert}
        onClose={vi.fn()}
      />
    )

    const imageItem = (await screen.findAllByRole('button', { name: /map.gif/ }))
      .find(element => element.classList.contains('asset-explorer-item'))
    expect(screen.queryByText('theme.opus')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lixeira' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Inserir' }).disabled).toBe(true)

    await user.click(imageItem)
    await user.click(screen.getByRole('button', { name: 'Inserir' }))

    expect(onInsert).toHaveBeenCalledTimes(1)
    expect(onInsert).toHaveBeenCalledWith(image)
  })

  it('inserts a compatible asset on double click', async () => {
    const audio = {
      id: 'audio-1',
      name: 'theme.opus',
      path: 'theme.opus',
      type: 'file',
      mediaType: 'audio',
      contentType: 'audio/ogg',
      size: 240
    }
    const onInsert = vi.fn()
    loadAssetTree.mockResolvedValue({ revision: 1, items: [audio] })
    loadAssetTrash.mockResolvedValue({ revision: 1, items: [] })

    render(
      <AssetExplorer
        worldId="world"
        mode="insert"
        clipboard={null}
        onClipboardChange={vi.fn()}
        onInsert={onInsert}
        onClose={vi.fn()}
      />
    )

    const audioItem = (await screen.findAllByRole('button', { name: /theme.opus/ }))
      .find(element => element.classList.contains('asset-explorer-item'))
    fireEvent.doubleClick(audioItem)

    expect(onInsert).toHaveBeenCalledWith(audio)
  })

  it('lets an item administrator share it with all world members', async () => {
    const user = userEvent.setup()
    const folder = {
      id: 'folder-1',
      name: 'Shared',
      path: 'Shared',
      type: 'folder',
      ownerUserId: 'owner-1',
      currentUserAccess: 'admin',
      canManagePermissions: true,
      children: []
    }
    loadAssetTree.mockResolvedValue({ revision: 1, items: [folder] })
    loadAssetTrash.mockResolvedValue({ revision: 1, items: [] })
    loadAssetPermissions.mockResolvedValue({
      ...folder,
      permissions: { inherit: true, users: {} },
      members: [{ userId: 'reader-1', user: { username: 'Reader' } }]
    })
    saveAssetPermissions.mockResolvedValue({ revision: 2 })

    render(
      <AssetExplorer
        worldId="world"
        clipboard={null}
        onClipboardChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const item = (await screen.findAllByRole('button', { name: /Shared/ }))
      .find(element => element.classList.contains('asset-explorer-item'))
    fireEvent.contextMenu(item, { clientX: 100, clientY: 100 })
    await user.click(screen.getByRole('button', { name: 'Gerenciar acesso' }))

    const worldMembersRow = screen.getByText('Todos os membros do mundo').closest('.asset-explorer-access-row')
    await user.click(within(worldMembersRow).getByRole('button', { name: 'Leitura' }))
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(saveAssetPermissions).toHaveBeenCalledWith('world', folder, {
        inherit: true,
        users: {},
        worldMembers: 'read'
      })
    })
  })
})

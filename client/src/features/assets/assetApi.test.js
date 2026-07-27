import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getAssetFileUrl,
  getAssetThumbnailUrl,
  runAssetAction
} from './assetApi'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('asset explorer API', () => {
  it('uses stable ids for file and thumbnail delivery', () => {
    expect(getAssetFileUrl('my world', { id: 'asset-1', path: 'old/path.png' }))
      .toBe('/api/worlds/my%20world/assets/file?id=asset-1')
    expect(getAssetThumbnailUrl('my world', { id: 'asset-1' }, 160))
      .toBe('/api/worlds/my%20world/assets/thumbnail?id=asset-1&size=160')
  })

  it('sends batch operations with a stable target folder id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ items: [], revision: 4 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ))

    await runAssetAction('world', 'move', ['one', 'two'], { id: 'folder-id' })

    expect(fetchMock).toHaveBeenCalledWith('/api/worlds/world/assets/actions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        action: 'move',
        itemIds: ['one', 'two'],
        targetFolderId: 'folder-id',
        targetFolderPath: undefined
      })
    }))
  })
})

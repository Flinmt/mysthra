import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveDocumentCover } from './documentCover'

describe('document cover client contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it('updates the cover by stable document and asset ids', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ documentUid: 'document/uid', coverAssetId: 'asset-id' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ))

    await saveDocumentCover('world name', 'document/uid', 'asset-id')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/world%20name/documents/document%2Fuid/cover',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ assetId: 'asset-id' })
      })
    )
  })
})

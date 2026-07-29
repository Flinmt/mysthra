import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getDocumentSoundtrackSource,
  loadDocumentSoundtrack,
  readDocumentSoundtrackPreference,
  saveDocumentSoundtrack,
  saveDocumentSoundtrackPreference
} from './documentSoundtrack'

describe('document soundtrack client contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('loads and saves soundtrack configuration by stable document id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        documentUid: 'document/uid',
        soundtrack: { assetId: 'audio-id', defaultVolume: 0.35 }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        documentUid: 'document/uid',
        soundtrack: { assetId: 'audio-id', defaultVolume: 0.5 }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))

    await loadDocumentSoundtrack('world name', 'document/uid')
    await saveDocumentSoundtrack('world name', 'document/uid', {
      assetId: 'audio-id',
      defaultVolume: 0.5
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/worlds/world%20name/documents/document%2Fuid/soundtrack')
    expect(fetchMock.mock.calls[1]).toEqual([
      '/api/worlds/world%20name/documents/document%2Fuid/soundtrack',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ assetId: 'audio-id', defaultVolume: 0.5 })
      })
    ])
  })

  it('scopes personal playback preferences by world, user, and document', () => {
    saveDocumentSoundtrackPreference('world-a', 'doc-a', 'user-a', {
      paused: true,
      volume: 0.42
    })

    expect(readDocumentSoundtrackPreference('world-a', 'doc-a', 'user-a')).toEqual({
      paused: true,
      volume: 0.42
    })
    expect(readDocumentSoundtrackPreference('world-a', 'doc-a', 'user-b')).toEqual({})
    expect(readDocumentSoundtrackPreference('world-a', 'doc-b', 'user-a')).toEqual({})
  })

  it('builds a private asset URL carrying only its document context', () => {
    expect(getDocumentSoundtrackSource('my world', 'doc/uid', 'asset id')).toBe(
      '/api/worlds/my%20world/assets/file?id=asset+id&documentUid=doc%2Fuid'
    )
  })
})

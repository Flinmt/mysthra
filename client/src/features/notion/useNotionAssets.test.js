import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadNotionImage, useNotionAssets } from './useNotionAssets'

describe('uploadNotionImage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uploads supported images and refreshes the asset tree', async () => {
    const onRequestAssets = vi.fn()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'portraits/hero.gif', name: 'hero.gif' })
    })
    const file = new File(['gif'], 'hero.gif', { type: 'image/gif' })

    const uploaded = await uploadNotionImage({
      file,
      worldId: 'world one',
      getAssetUrl: path => `/assets/${path}`,
      onRequestAssets
    })

    expect(fetchMock.mock.calls[0][0]).toContain('/api/worlds/world%20one/assets/upload?')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(uploaded.url).toBe('/assets/portraits/hero.gif')
    expect(onRequestAssets).toHaveBeenCalledOnce()
  })

  it('rejects non-image assets before sending a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const file = new File(['audio'], 'theme.mp3', { type: 'audio/mpeg' })

    await expect(uploadNotionImage({ file, worldId: 'world' })).rejects.toThrow('Only images')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not duplicate a file drop already handled by BlockNote', async () => {
    const editor = {
      focus: vi.fn(),
      getTextCursorPosition: vi.fn(() => ({ block: { id: 'block-1' } })),
      insertBlocks: vi.fn()
    }
    const { result } = renderHook(() => useNotionAssets({
      editor,
      editable: true,
      worldId: 'world',
      getAssetUrl: path => `/assets/${path}`
    }))

    await result.current.onDrop({
      defaultPrevented: true,
      dataTransfer: {
        files: [new File(['image'], 'portrait.png', { type: 'image/png' })],
        getData: vi.fn()
      },
      preventDefault: vi.fn()
    })

    expect(editor.insertBlocks).not.toHaveBeenCalled()
  })

  it('ignores Mysthra asset drops in readonly mode', async () => {
    const editor = {
      focus: vi.fn(),
      getTextCursorPosition: vi.fn(),
      insertBlocks: vi.fn()
    }
    const { result } = renderHook(() => useNotionAssets({
      editor,
      editable: false,
      worldId: 'world',
      getAssetUrl: path => `/assets/${path}`
    }))

    await result.current.onDrop({
      defaultPrevented: false,
      dataTransfer: {
        files: [],
        getData: vi.fn(() => JSON.stringify({ path: 'portrait.png', name: 'Portrait' }))
      },
      preventDefault: vi.fn()
    })

    expect(editor.insertBlocks).not.toHaveBeenCalled()
  })
})

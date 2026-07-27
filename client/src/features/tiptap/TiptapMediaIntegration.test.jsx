import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TiptapEditor from './TiptapEditor'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => ({
      'workspace.tiptap_placeholder': 'Digite ou use /',
      'workspace.tiptap_block_placeholder': 'Digite ou use /',
      'workspace.tiptap_heading_placeholder': 'Título',
      'workspace.tiptap_toggle_heading_placeholder': 'Título expansível',
      'workspace.tiptap_media_unavailable': 'Mídia indisponível',
      'workspace.tiptap_resize_image': 'Redimensionar imagem'
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
})

import { Editor, Extension, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ySyncPlugin } from 'y-prosemirror'
import * as Y from 'yjs'
import {
  clampImageWidth,
  insertAssetMedia,
  TiptapAssetAudio,
  TiptapAssetImage
} from './tiptapMedia'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = new Set()
const yDocs = new Set()

function createEditor() {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      TiptapTestDocument,
      Text,
      Paragraph,
      TiptapAssetImage.configure({
        resolveAssetUrl: assetId => `/assets/${assetId}`,
        unavailableLabel: 'Mídia indisponível',
        resizeLabel: 'Redimensionar imagem'
      }),
      TiptapAssetAudio.configure({
        resolveAssetUrl: assetId => `/assets/${assetId}`,
        unavailableLabel: 'Mídia indisponível'
      })
    ],
    content: '<p></p>'
  })
  editors.add(editor)
  return editor
}

function createCollaborativeEditor(doc) {
  const element = document.createElement('div')
  document.body.append(element)
  yDocs.add(doc)
  const editor = new Editor({
    element,
    extensions: [
      TiptapTestDocument,
      Text,
      Paragraph,
      TiptapAssetImage.configure({ resolveAssetUrl: assetId => `/assets/${assetId}` }),
      TiptapAssetAudio.configure({ resolveAssetUrl: assetId => `/assets/${assetId}` }),
      Extension.create({
        name: `mediaCollaboration${editors.size}`,
        addProseMirrorPlugins: () => [ySyncPlugin(doc.getXmlFragment('tiptap'))]
      })
    ]
  })
  editors.add(editor)
  return editor
}

afterEach(() => {
  editors.forEach(editor => {
    editor.view.dom.parentElement?.remove()
    editor.destroy()
  })
  editors.clear()
  yDocs.forEach(doc => doc.destroy())
  yDocs.clear()
})

describe('Tiptap asset media nodes', () => {
  it('inserts an image by stable asset id and leaves a paragraph after it', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(1)

    expect(insertAssetMedia(editor, 'image', {
      id: 'image-1',
      name: 'map.gif',
      contentType: 'image/gif'
    })).toBe(true)

    expect(editor.getJSON().content).toEqual([
      {
        type: 'assetImage',
        attrs: {
          assetId: 'image-1',
          assetName: 'map.gif',
          contentType: 'image/gif',
          width: 100
        }
      },
      { type: 'paragraph' }
    ])
    const image = editor.view.dom.querySelector('.tiptap-media-image img')
    expect(image.getAttribute('src')).toBe('/assets/image-1')
    expect(image.alt).toBe('map.gif')
  })

  it('renders an audio player and exposes a fallback when delivery fails', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(1)
    insertAssetMedia(editor, 'audio', {
      id: 'audio-1',
      name: 'voice.opus',
      contentType: 'audio/ogg'
    })

    const audio = editor.view.dom.querySelector('.tiptap-media-audio audio')
    expect(audio.controls).toBe(true)
    expect(audio.preload).toBe('metadata')
    expect(audio.getAttribute('src')).toBe('/assets/audio-1')

    fireEvent.error(audio)
    expect(audio.hidden).toBe(true)
    expect(editor.view.dom.querySelector('.tiptap-media-unavailable').hidden).toBe(false)
  })

  it('clamps and persists image width through the accessible resize handle', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(1)
    insertAssetMedia(editor, 'image', {
      id: 'image-1',
      name: 'map.png',
      contentType: 'image/png'
    })

    const handle = editor.view.dom.querySelector('.tiptap-media-resize-handle.is-right')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(editor.getJSON().content[0].attrs.width).toBe(95)
    expect(clampImageWidth(10)).toBe(25)
    expect(clampImageWidth(140)).toBe(100)
  })

  it('synchronizes media nodes and their attributes through Yjs', () => {
    const doc = new Y.Doc()
    const first = createCollaborativeEditor(doc)
    const second = createCollaborativeEditor(doc)

    insertAssetMedia(first, 'image', {
      id: 'shared-image',
      name: 'shared.gif',
      contentType: 'image/gif'
    })

    expect(second.getJSON().content[0]).toMatchObject({
      type: 'assetImage',
      attrs: {
        assetId: 'shared-image',
        assetName: 'shared.gif',
        contentType: 'image/gif',
        width: 100
      }
    })
  })
})

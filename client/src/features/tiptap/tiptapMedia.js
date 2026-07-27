import { Node } from '@tiptap/core'

const clampImageWidth = value => Math.min(100, Math.max(25, Number(value) || 100))

function mediaAttributes(resizable) {
  return {
    assetId: {
      default: '',
      parseHTML: element => element.getAttribute('data-asset-id') || '',
      renderHTML: attributes => ({ 'data-asset-id': attributes.assetId })
    },
    assetName: {
      default: '',
      parseHTML: element => element.getAttribute('data-asset-name') || '',
      renderHTML: attributes => ({ 'data-asset-name': attributes.assetName })
    },
    contentType: {
      default: '',
      parseHTML: element => element.getAttribute('data-content-type') || '',
      renderHTML: attributes => ({ 'data-content-type': attributes.contentType })
    },
    ...(resizable
      ? {
          width: {
            default: 100,
            parseHTML: element => clampImageWidth(element.getAttribute('data-width')),
            renderHTML: attributes => ({ 'data-width': clampImageWidth(attributes.width) })
          }
        }
      : {})
  }
}

function createAssetMediaNode({ name, mediaType, tagName, resizable = false }) {
  const dataAttribute = `data-tiptap-asset-${mediaType}`

  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    addOptions: () => ({
      resolveAssetUrl: () => '',
      unavailableLabel: 'Media unavailable',
      resizeLabel: 'Resize image'
    }),
    addAttributes: () => mediaAttributes(resizable),
    parseHTML: () => [{ tag: `[${dataAttribute}]` }],
    renderHTML: ({ HTMLAttributes }) => ['div', { ...HTMLAttributes, [dataAttribute]: '' }],
    addCommands() {
      return {
        [`insert${name[0].toUpperCase()}${name.slice(1)}`]: attributes => ({ commands }) =>
          commands.insertContent({ type: name, attrs: attributes })
      }
    },
    addNodeView() {
      const options = this.options
      return ({ node: initialNode, view, getPos }) => {
        let node = initialNode
        let activeWidth = clampImageWidth(node.attrs.width)
        let removeResizeListeners = null
        const dom = document.createElement('div')
        const media = document.createElement(tagName)
        const fallback = document.createElement('div')

        dom.className = `tiptap-media-block tiptap-media-${mediaType}`
        dom.contentEditable = 'false'
        media.className = 'tiptap-media-element'
        media.draggable = false
        fallback.className = 'tiptap-media-unavailable'
        fallback.hidden = true
        fallback.textContent = options.unavailableLabel

        if (mediaType === 'image') {
          media.alt = node.attrs.assetName || ''
        } else {
          media.controls = true
          media.preload = 'metadata'
        }

        const showFallback = () => {
          media.hidden = true
          fallback.hidden = false
        }
        const showMedia = () => {
          media.hidden = false
          fallback.hidden = true
        }
        media.addEventListener(mediaType === 'image' ? 'load' : 'loadedmetadata', showMedia)
        media.addEventListener('error', showFallback)
        dom.append(media, fallback)

        const persistWidth = nextWidth => {
          activeWidth = clampImageWidth(nextWidth)
          dom.style.setProperty('--tiptap-media-width', `${activeWidth}%`)
          const position = getPos()
          if (typeof position !== 'number') return
          view.dispatch(view.state.tr.setNodeMarkup(position, undefined, {
            ...node.attrs,
            width: activeWidth
          }))
        }

        if (resizable) {
          for (const side of ['left', 'right']) {
            const handle = document.createElement('button')
            handle.type = 'button'
            handle.className = `tiptap-media-resize-handle is-${side}`
            handle.setAttribute('aria-label', options.resizeLabel)
            handle.setAttribute('role', 'slider')
            handle.setAttribute('aria-valuemin', '25')
            handle.setAttribute('aria-valuemax', '100')
            handle.addEventListener('pointerdown', event => {
              if (!view.editable) return
              event.preventDefault()
              event.stopPropagation()
              removeResizeListeners?.()
              const parentWidth = dom.parentElement?.getBoundingClientRect().width || dom.getBoundingClientRect().width
              const startWidth = dom.getBoundingClientRect().width
              const startX = event.clientX
              const direction = side === 'right' ? 1 : -1
              let previewWidth = activeWidth
              const move = moveEvent => {
                const widthPx = startWidth + ((moveEvent.clientX - startX) * direction * 2)
                previewWidth = clampImageWidth((widthPx / parentWidth) * 100)
                dom.style.setProperty('--tiptap-media-width', `${previewWidth}%`)
                handle.setAttribute('aria-valuenow', String(Math.round(previewWidth)))
              }
              const finish = () => {
                removeResizeListeners?.()
                persistWidth(previewWidth)
              }
              removeResizeListeners = () => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', finish)
                window.removeEventListener('pointercancel', finish)
                removeResizeListeners = null
                dom.dataset.resizing = 'false'
              }
              dom.dataset.resizing = 'true'
              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', finish)
              window.addEventListener('pointercancel', finish)
            })
            handle.addEventListener('keydown', event => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !view.editable) return
              event.preventDefault()
              const delta = event.key === 'ArrowRight' ? 5 : -5
              persistWidth(activeWidth + delta)
            })
            dom.append(handle)
          }
        }

        const update = nextNode => {
          if (nextNode.type.name !== name) return false
          node = nextNode
          dom.dataset.assetId = node.attrs.assetId
          dom.dataset.assetName = node.attrs.assetName
          media.setAttribute('aria-label', node.attrs.assetName || mediaType)
          if (mediaType === 'image') media.alt = node.attrs.assetName || ''
          if (resizable) {
            activeWidth = clampImageWidth(node.attrs.width)
            dom.style.setProperty('--tiptap-media-width', `${activeWidth}%`)
            dom.querySelectorAll('[role="slider"]').forEach(handle => {
              handle.setAttribute('aria-valuenow', String(Math.round(activeWidth)))
            })
          }
          const nextSource = options.resolveAssetUrl(node.attrs.assetId)
          if (media.getAttribute('src') !== nextSource) {
            media.hidden = false
            fallback.hidden = true
            media.setAttribute('src', nextSource)
          }
          return true
        }

        update(node)
        return {
          dom,
          update,
          selectNode: () => dom.classList.add('ProseMirror-selectednode'),
          deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
          stopEvent: event => Boolean(event.target.closest('audio, .tiptap-media-resize-handle')),
          ignoreMutation: mutation => mutation.type === 'attributes',
          destroy: () => {
            removeResizeListeners?.()
            media.removeEventListener(mediaType === 'image' ? 'load' : 'loadedmetadata', showMedia)
            media.removeEventListener('error', showFallback)
          }
        }
      }
    }
  })
}

export const TiptapAssetImage = createAssetMediaNode({
  name: 'assetImage',
  mediaType: 'image',
  tagName: 'img',
  resizable: true
})

export const TiptapAssetAudio = createAssetMediaNode({
  name: 'assetAudio',
  mediaType: 'audio',
  tagName: 'audio'
})

export function insertAssetMedia(editor, mediaType, asset) {
  if (!editor || editor.isDestroyed || !asset?.id || !['image', 'audio'].includes(mediaType)) return false
  const { $from } = editor.state.selection
  const range = $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0
    ? { from: $from.before(), to: $from.after() }
    : { from: editor.state.selection.from, to: editor.state.selection.to }
  return editor.chain()
    .focus()
    .insertContentAt(range, [
      {
        type: mediaType === 'image' ? 'assetImage' : 'assetAudio',
        attrs: {
          assetId: asset.id,
          assetName: asset.name,
          contentType: asset.contentType,
          ...(mediaType === 'image' ? { width: 100 } : {})
        }
      },
      { type: 'paragraph' }
    ], { updateSelection: true })
    .run()
}

export { clampImageWidth }

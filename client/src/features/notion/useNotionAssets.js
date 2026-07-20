import { useCallback } from 'react'
import { prepareAssetUpload } from '../../workspace/utils'

export async function uploadNotionImage({ file, worldId, getAssetUrl, onRequestAssets }) {
  const prepared = await prepareAssetUpload(file)
  if (!prepared.contentType.startsWith('image/')) throw new Error('Only images can be uploaded to image blocks')
  const query = new URLSearchParams({ path: '', filename: prepared.filename })
  const response = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': prepared.contentType },
    body: prepared.blob
  })
  if (!response.ok) throw new Error('Failed to upload image')
  const uploaded = await response.json()
  await onRequestAssets?.()
  return { ...uploaded, url: getAssetUrl(uploaded.path), filename: prepared.filename }
}

export function useNotionAssets({ editor, editable, worldId, getAssetUrl, onRequestAssets }) {
  const insertImage = useCallback((url, name = '') => {
    const cursorBlock = editor.getTextCursorPosition().block
    editor.insertBlocks([{ type: 'image', props: { url, name } }], cursorBlock, 'after')
    editor.focus()
  }, [editor])

  const uploadAndInsertImage = useCallback(async (file) => {
    const uploaded = await uploadNotionImage({ file, worldId, getAssetUrl, onRequestAssets })
    insertImage(uploaded.url, uploaded.name || uploaded.filename)
  }, [getAssetUrl, insertImage, onRequestAssets, worldId])

  const onDragOver = useCallback((event) => {
    if (!editable) return
    const hasImageAsset = event.dataTransfer.types.includes('application/x-mythra-asset-image')
    const hasImageFile = Array.from(event.dataTransfer.items || []).some(item => item.kind === 'file' && item.type.startsWith('image/'))
    if (!hasImageAsset && !hasImageFile) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [editable])

  const onDrop = useCallback(async (event) => {
    if (!editable || event.defaultPrevented) return
    const assetPayload = event.dataTransfer.getData('application/x-mythra-asset-image')
    if (assetPayload) {
      event.preventDefault()
      try {
        const asset = JSON.parse(assetPayload)
        insertImage(getAssetUrl(asset.path), asset.name)
      } catch {
        // Ignore drag payloads that do not belong to Mysthra.
      }
      return
    }

    const imageFiles = Array.from(event.dataTransfer.files || []).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    event.preventDefault()
    for (const file of imageFiles) await uploadAndInsertImage(file)
  }, [editable, getAssetUrl, insertImage, uploadAndInsertImage])

  return { insertImage, onDragOver, onDrop, uploadAndInsertImage }
}

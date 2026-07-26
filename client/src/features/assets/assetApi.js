function worldAssetsUrl(worldId, suffix = '') {
  return `/api/worlds/${encodeURIComponent(worldId)}/assets${suffix}`
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Asset request failed')
  return payload
}

export function getAssetFileUrl(worldId, item) {
  const query = item?.id
    ? `id=${encodeURIComponent(item.id)}`
    : `path=${encodeURIComponent(item?.path || '')}`
  return `${worldAssetsUrl(worldId, '/file')}?${query}`
}

export function getAssetThumbnailUrl(worldId, item, size = 320) {
  const reference = item?.id
    ? `id=${encodeURIComponent(item.id)}`
    : `path=${encodeURIComponent(item?.path || '')}`
  return `${worldAssetsUrl(worldId, '/thumbnail')}?${reference}&size=${size}`
}

export async function loadAssetTree(worldId) {
  return readResponse(await fetch(worldAssetsUrl(worldId)))
}

export async function loadAssetTrash(worldId) {
  return readResponse(await fetch(worldAssetsUrl(worldId, '/trash')))
}

export async function createAssetFolder(worldId, parentPath, name) {
  return readResponse(await fetch(worldAssetsUrl(worldId, '/folders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPath, name })
  }))
}

export async function renameAssetItem(worldId, item, newName) {
  return readResponse(await fetch(worldAssetsUrl(worldId, '/rename'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id, path: item.id ? undefined : item.path, newName })
  }))
}

export async function runAssetAction(worldId, action, itemIds, targetFolder = null) {
  return readResponse(await fetch(worldAssetsUrl(worldId, '/actions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      itemIds,
      targetFolderId: targetFolder?.id || undefined,
      targetFolderPath: targetFolder ? undefined : ''
    })
  }))
}

export async function emptyAssetTrash(worldId) {
  return readResponse(await fetch(worldAssetsUrl(worldId, '/trash'), { method: 'DELETE' }))
}

export function uploadAsset(worldId, folderPath, file, onProgress) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({ filename: file.name, path: folderPath || '' })
    const request = new XMLHttpRequest()
    request.open('POST', `${worldAssetsUrl(worldId, '/upload')}?${query}`)
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      let payload = {}
      try {
        payload = JSON.parse(request.responseText || '{}')
      } catch {
        // The status code still provides a useful fallback error.
      }
      if (request.status >= 200 && request.status < 300) resolve(payload)
      else reject(new Error(payload.error || `Upload failed (${request.status})`))
    })
    request.addEventListener('error', () => reject(new Error('Upload failed')))
    request.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')))
    request.send(file)
  })
}

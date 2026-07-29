export const DEFAULT_DOCUMENT_SOUNDTRACK_VOLUME = 0.35

function getSoundtrackEndpoint(worldId, documentUid) {
  return `/api/worlds/${encodeURIComponent(worldId)}/documents/${encodeURIComponent(documentUid)}/soundtrack`
}

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to update the document soundtrack')
  return payload
}

export async function loadDocumentSoundtrack(worldId, documentUid, signal) {
  const response = await fetch(getSoundtrackEndpoint(worldId, documentUid), { signal })
  return readApiResponse(response)
}

export async function saveDocumentSoundtrack(worldId, documentUid, soundtrack) {
  const response = await fetch(getSoundtrackEndpoint(worldId, documentUid), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(soundtrack)
  })
  return readApiResponse(response)
}

export function getDocumentSoundtrackSource(worldId, documentUid, assetId) {
  const params = new URLSearchParams({ id: assetId, documentUid })
  return `/api/worlds/${encodeURIComponent(worldId)}/assets/file?${params}`
}

function getPreferenceKey(worldId, documentUid, userScope) {
  return `mysthra:document-soundtrack:${worldId}:${userScope || 'visitor'}:${documentUid}`
}

export function readDocumentSoundtrackPreference(worldId, documentUid, userScope) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(getPreferenceKey(worldId, documentUid, userScope)))
    if (!stored || typeof stored !== 'object') return {}
    return {
      ...(typeof stored.paused === 'boolean' ? { paused: stored.paused } : {}),
      ...(Number.isFinite(stored.volume) ? { volume: Math.min(1, Math.max(0, stored.volume)) } : {})
    }
  } catch {
    return {}
  }
}

export function saveDocumentSoundtrackPreference(worldId, documentUid, userScope, preference) {
  try {
    window.localStorage.setItem(
      getPreferenceKey(worldId, documentUid, userScope),
      JSON.stringify(preference)
    )
  } catch {
    // Playback preferences are best-effort in restricted browsing contexts.
  }
}

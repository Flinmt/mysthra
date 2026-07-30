export async function saveDocumentCover(worldId, documentUid, assetId) {
  const response = await fetch(
    `/api/worlds/${encodeURIComponent(worldId)}/documents/${encodeURIComponent(documentUid)}/cover`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId })
    }
  )
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to update the document cover')
  return payload
}

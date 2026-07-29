export function getPageSuggestionPopoverPosition(rect, viewport = {}) {
  const width = Math.min(332, Math.max(240, (viewport.width || 332) - 16))
  const height = 230
  const gap = 7
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, (viewport.width || width + 16) - width - 8)
  )
  const fitsBelow = rect.bottom + gap + height <= (viewport.height || rect.bottom + gap + height)
  return {
    left,
    top: fitsBelow ? rect.bottom + gap : Math.max(8, rect.top - gap),
    placement: fitsBelow ? 'below' : 'above',
    width
  }
}

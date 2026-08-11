const TOOLBAR_WIDTH = 174
const TOOLBAR_HEIGHT = 38
const TOOLBAR_GAP = 8

export function getTextToolbarPosition(start, end, viewport = {}) {
  const width = viewport.width || window.innerWidth
  const height = viewport.height || window.innerHeight
  const left = Math.min(
    width - TOOLBAR_WIDTH / 2 - 8,
    Math.max(TOOLBAR_WIDTH / 2 + 8, (start.left + end.right) / 2)
  )
  const above = Math.min(start.top, end.top) >= TOOLBAR_HEIGHT + TOOLBAR_GAP
  return {
    left,
    top: above
      ? Math.min(start.top, end.top) - TOOLBAR_GAP
      : Math.min(height - TOOLBAR_HEIGHT - 8, Math.max(start.bottom, end.bottom) + TOOLBAR_GAP),
    placement: above ? 'above' : 'below'
  }
}

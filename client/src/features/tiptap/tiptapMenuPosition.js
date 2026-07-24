const MENU_WIDTH = 286
const MENU_MAX_HEIGHT = 220
const VIEWPORT_MARGIN = 8
const CURSOR_GAP = 6

export function getTiptapMenuPosition(rect, viewport) {
  const availableBelow = Math.max(0, viewport.height - rect.bottom - CURSOR_GAP - VIEWPORT_MARGIN)
  const availableAbove = Math.max(0, rect.top - CURSOR_GAP - VIEWPORT_MARGIN)
  const placement = availableBelow < MENU_MAX_HEIGHT && availableAbove > availableBelow
    ? 'above'
    : 'below'
  const availableHeight = placement === 'above' ? availableAbove : availableBelow
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - MENU_WIDTH - VIEWPORT_MARGIN)

  return {
    placement,
    top: placement === 'above' ? rect.top - CURSOR_GAP : rect.bottom + CURSOR_GAP,
    left: Math.min(Math.max(rect.left, VIEWPORT_MARGIN), maxLeft),
    maxHeight: Math.min(MENU_MAX_HEIGHT, availableHeight)
  }
}

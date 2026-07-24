export function normalizeIconSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function filterDocumentIconCategories(categories, value) {
  const query = normalizeIconSearch(value)
  if (!query) return categories

  return categories
    .map(category => ({
      ...category,
      icons: category.icons.filter(icon => {
        const searchableText = normalizeIconSearch([
          icon.key,
          category.id,
          ...(icon.aliases || [])
        ].join(' '))
        return searchableText.includes(query)
      })
    }))
    .filter(category => category.icons.length > 0)
}

export function getDocumentIconPickerPosition(
  triggerRect,
  viewport,
  { width = 360, height = 440, gap = 8, padding = 10 } = {}
) {
  const availableWidth = Math.max(0, viewport.width - padding * 2)
  const pickerWidth = Math.min(width, availableWidth)
  const targetHeight = Math.min(height, Math.max(0, viewport.height - padding * 2))
  const spaceBelow = viewport.height - triggerRect.bottom - gap - padding
  const spaceAbove = triggerRect.top - gap - padding
  const placement = spaceBelow >= targetHeight || spaceBelow >= spaceAbove ? 'below' : 'above'
  const directionalSpace = placement === 'below' ? spaceBelow : spaceAbove
  const maxHeight = Math.max(0, Math.min(targetHeight, directionalSpace))
  const unclampedTop = placement === 'below'
    ? triggerRect.bottom + gap
    : triggerRect.top - gap - maxHeight
  const maxLeft = Math.max(padding, viewport.width - pickerWidth - padding)

  return {
    placement,
    width: pickerWidth,
    maxHeight,
    top: Math.min(
      Math.max(unclampedTop, padding),
      Math.max(padding, viewport.height - maxHeight - padding)
    ),
    left: Math.min(Math.max(triggerRect.left, padding), maxLeft)
  }
}

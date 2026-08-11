export const TEXT_COLOR_PALETTE = [
  '#d97872',
  '#d89a5b',
  '#d6bd63',
  '#62b884',
  '#62a8d8',
  '#a889dc',
  '#d77faf'
]

const toHexPart = value => Math.max(0, Math.min(255, Number(value)))
  .toString(16)
  .padStart(2, '0')

export function normalizeTextColor(value = '') {
  const color = String(value).trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(color)) return color
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return `#${color.slice(1).split('').map(part => `${part}${part}`).join('')}`
  }
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  return rgb ? `#${toHexPart(rgb[1])}${toHexPart(rgb[2])}${toHexPart(rgb[3])}` : ''
}

export function getThemeAccentTextColor(editorDom) {
  if (!(editorDom instanceof HTMLElement)) return ''
  const probe = document.createElement('span')
  probe.style.color = 'var(--accent-color)'
  editorDom.append(probe)
  const color = normalizeTextColor(window.getComputedStyle(probe).color)
  probe.remove()
  return color
}

export function getSelectionTextColor(editor) {
  const colors = new Set()
  const { from, to } = editor.state.selection
  editor.state.doc.nodesBetween(from, to, node => {
    if (!node.isText) return
    const mark = node.marks.find(candidate => candidate.type.name === 'textStyle')
    colors.add(normalizeTextColor(mark?.attrs.color) || '')
  })
  if (colors.size > 1) return { color: '', mixed: true }
  return { color: colors.values().next().value || '', mixed: false }
}

export const DEFAULT_WORLD_THEME = 'default'

export const WORLD_THEMES = [
  {
    id: DEFAULT_WORLD_THEME,
    labelKey: 'dashboard.theme_default',
    colors: {
      background: '#0b0d11',
      surface: '#1d2230',
      text: '#f8fafc',
      mutedText: '#94a3b8',
      accent: '#8b5cf6',
      secondaryAccent: '#14b8a6'
    },
    swatches: ['#0b0d11', '#1d2230', '#8b5cf6', '#f8fafc']
  },
  {
    id: 'ember-archive',
    labelKey: 'dashboard.theme_ember_archive',
    colors: {
      background: '#151c20',
      surface: '#1d2529',
      text: '#ece4d3',
      mutedText: '#aeb2aa',
      accent: '#c17539',
      secondaryAccent: '#3b6474'
    },
    swatches: ['#151c20', '#1d2529', '#c17539', '#ece4d3']
  },
  {
    id: 'vampire-masquerade',
    labelKey: 'dashboard.theme_vampire_masquerade',
    colors: {
      background: '#090607',
      surface: '#1a1014',
      text: '#f1e7dc',
      mutedText: '#a9918d',
      accent: '#8f1d2c',
      secondaryAccent: '#b08d57'
    },
    swatches: ['#090607', '#1a1014', '#8f1d2c', '#f1e7dc']
  }
]

export function getWorldTheme(themeId) {
  return WORLD_THEMES.find(theme => theme.id === themeId) || WORLD_THEMES[0]
}

const CUSTOM_THEME_COLOR_KEYS = ['background', 'surface', 'text', 'mutedText', 'accent', 'secondaryAccent']
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function normalizeHexColor(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!HEX_COLOR_PATTERN.test(trimmed)) return null
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
  }
  return trimmed.toLowerCase()
}

function hexToRgb(color) {
  const normalized = normalizeHexColor(color)
  if (!normalized) return null
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  }
}

function rgba(color, alpha) {
  const rgb = hexToRgb(color)
  if (!rgb) return color
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function mixHex(color, target, amount) {
  const sourceRgb = hexToRgb(color)
  const targetRgb = hexToRgb(target)
  if (!sourceRgb || !targetRgb) return color
  const mixChannel = (source, next) => Math.round(source + (next - source) * amount)
  return `#${[mixChannel(sourceRgb.r, targetRgb.r), mixChannel(sourceRgb.g, targetRgb.g), mixChannel(sourceRgb.b, targetRgb.b)]
    .map(channel => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

export function normalizeCustomTheme(customTheme) {
  if (!customTheme?.colors || typeof customTheme.colors !== 'object') return null
  const colors = {}
  CUSTOM_THEME_COLOR_KEYS.forEach(key => {
    const normalizedColor = normalizeHexColor(customTheme.colors[key])
    if (normalizedColor) colors[key] = normalizedColor
  })
  return Object.keys(colors).length > 0 ? { colors } : null
}

export function getThemeColors(themeId, customTheme = null) {
  const preset = getWorldTheme(themeId)
  return {
    ...preset.colors,
    ...(normalizeCustomTheme(customTheme)?.colors || {})
  }
}

export function getThemeSwatches(themeId, customTheme = null) {
  const colors = getThemeColors(themeId, customTheme)
  return [colors.background, colors.surface, colors.accent, colors.text]
}

export function getWorldThemeStyle(themeId, customTheme = null) {
  const colors = getThemeColors(themeId, customTheme)
  return {
    '--bg-color': colors.background,
    '--panel-bg': rgba(colors.surface, 0.74),
    '--border-color': rgba(colors.accent, 0.16),
    '--text-primary': colors.text,
    '--text-secondary': colors.mutedText,
    '--accent-color': colors.accent,
    '--accent-hover': mixHex(colors.accent, '#ffffff', 0.16),
    '--accent-glow': rgba(colors.accent, 0.28),
    '--primary-color': colors.accent,
    '--arcane-color': colors.secondaryAccent,
    '--arcane-hover': mixHex(colors.secondaryAccent, '#ffffff', 0.16),
    '--scrollbar-track': rgba(colors.surface, 0.28),
    '--scrollbar-thumb': rgba(colors.accent, 0.34),
    '--scrollbar-thumb-hover': rgba(colors.accent, 0.58),
    '--theme-custom-bg': colors.background,
    '--theme-custom-bg-soft': mixHex(colors.background, '#ffffff', 0.08),
    '--theme-custom-surface': colors.surface,
    '--theme-custom-accent': colors.accent,
    '--theme-custom-accent-soft': rgba(colors.accent, 0.16),
    '--theme-custom-accent-border': rgba(colors.accent, 0.34),
    '--theme-custom-secondary': colors.secondaryAccent,
    '--theme-custom-secondary-soft': rgba(colors.secondaryAccent, 0.2)
  }
}

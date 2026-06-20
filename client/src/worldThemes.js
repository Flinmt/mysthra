export const DEFAULT_WORLD_THEME = 'default'

export const WORLD_THEMES = [
  {
    id: DEFAULT_WORLD_THEME,
    labelKey: 'dashboard.theme_default',
    swatches: ['#0b0d11', '#1d2230', '#8b5cf6', '#f8fafc']
  },
  {
    id: 'ember-archive',
    labelKey: 'dashboard.theme_ember_archive',
    swatches: ['#151c20', '#1d2529', '#c17539', '#ece4d3']
  }
]

export function getWorldTheme(themeId) {
  return WORLD_THEMES.find(theme => theme.id === themeId) || WORLD_THEMES[0]
}

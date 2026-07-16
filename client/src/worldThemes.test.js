import { describe, expect, it } from 'vitest'
import { getWorldThemeShellStyle, getWorldThemeStyle } from './worldThemes'

describe('world theme styles', () => {
  it('maps the vampire preset to the complete content palette', () => {
    const style = getWorldThemeStyle('vampire-masquerade')

    expect(style['--bg-color']).toBe('#090607')
    expect(style['--panel-bg']).toBe('rgba(26, 16, 20, 0.74)')
    expect(style['--text-primary']).toBe('#f1e7dc')
    expect(style['--accent-color']).toBe('#8f1d2c')
    expect(style['--arcane-color']).toBe('#b08d57')
  })

  it('exposes theme accents to the neutral workspace shell', () => {
    expect(getWorldThemeShellStyle('vampire-masquerade')).toEqual(expect.objectContaining({
      '--world-theme-background': '#090607',
      '--world-theme-surface': '#1a1014',
      '--world-theme-text': '#f1e7dc',
      '--world-theme-muted': '#a9918d',
      '--world-theme-accent': '#8f1d2c',
      '--world-theme-accent-soft': 'rgba(143, 29, 44, 0.14)',
      '--world-theme-accent-border': 'rgba(143, 29, 44, 0.34)',
      '--world-theme-secondary': '#b08d57'
    }))
  })

  it('keeps custom colors synchronized across namespaced and content tokens', () => {
    const customTheme = {
      colors: {
        background: '#101820',
        surface: '#24303a',
        text: '#f4f7f8',
        mutedText: '#a7b2b8',
        accent: '#2f7f8f',
        secondaryAccent: '#9c7a4d'
      }
    }
    const shellStyle = getWorldThemeShellStyle('ember-archive', customTheme)
    const contentStyle = getWorldThemeStyle('ember-archive', customTheme)

    expect(shellStyle['--world-theme-background']).toBe('#101820')
    expect(shellStyle['--world-theme-accent']).toBe('#2f7f8f')
    expect(contentStyle['--bg-color']).toBe(shellStyle['--world-theme-background'])
    expect(contentStyle['--accent-color']).toBe(shellStyle['--world-theme-accent'])
  })
})

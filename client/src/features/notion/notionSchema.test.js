import { describe, expect, it } from 'vitest'
import { getNotionDictionary, isAllowedNotionLink } from './notionSchema'

describe('notion schema', () => {
  it('accepts web and Mysthra document links while rejecting unsafe protocols', () => {
    expect(isAllowedNotionLink('https://example.com')).toBe(true)
    expect(isAllowedNotionLink('mysthra://document/doc-1?tab=tab-1')).toBe(true)
    expect(isAllowedNotionLink('javascript:alert(1)')).toBe(false)
  })

  it('falls back to English for unsupported locales and includes column commands', () => {
    const dictionary = getNotionDictionary('unknown-locale')

    expect(dictionary.slash_menu.heading).toBeTruthy()
    expect(dictionary.multi_column.slash_menu.two_columns).toBeTruthy()
    expect(dictionary.multi_column.slash_menu.three_columns).toBeTruthy()
  })

  it('overrides BlockNote placeholders with Mysthra copy', () => {
    const dictionary = getNotionDictionary('pt-BR', {
      emptyDocument: "Comece a escrever ou use '/' para comandos",
      default: "Digite ou use '/'"
    })

    expect(dictionary.placeholders.emptyDocument).toBe("Comece a escrever ou use '/' para comandos")
    expect(dictionary.placeholders.default).toBe("Digite ou use '/'")
  })
})

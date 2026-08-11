import { describe, expect, it } from 'vitest'
import { createTiptapCommands } from './tiptapCommands'
import { filterTiptapCommands, normalizeCommandSearch } from './tiptapCommandSearch'

const commands = createTiptapCommands((key, fallback) => fallback)
const ids = query => filterTiptapCommands(commands, query).map(command => command.id)

describe('Tiptap slash command search', () => {
  it('normalizes case, accents and punctuation', () => {
    expect(normalizeCommandSearch('  TÍTULO-2 ')).toBe('titulo 2')
  })

  it.each([
    ['h1', 'heading-1'],
    ['H2', 'heading-2'],
    ['paragrafo', 'paragraph'],
    ['citacao', 'blockquote'],
    ['imagem', 'media'],
    ['planilha', 'table'],
    ['marcadores', 'bulletList'],
    ['separador', 'horizontalRule'],
    ['toggle h3', 'toggle-heading-3']
  ])('finds %s through a common alias', (query, expected) => {
    expect(ids(query)).toContain(expected)
  })

  it('tolerates small typing mistakes', () => {
    expect(ids('tabeal')).toContain('table')
    expect(ids('citaco')).toContain('blockquote')
  })

  it('ranks the most direct match first', () => {
    expect(ids('h2')[0]).toBe('heading-2')
    expect(ids('lista numerada')[0]).toBe('orderedList')
  })
})

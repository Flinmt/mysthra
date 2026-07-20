import { describe, expect, it, vi } from 'vitest'
import { handleNotionPaste, NOTION_EDITING_OPTIONS } from './notionEditing'

describe('Notion editing contract', () => {
  it('keeps focus manual and preserves keyboard access to editor UI', () => {
    expect(NOTION_EDITING_OPTIONS.autofocus).toBe(false)
    expect(NOTION_EDITING_OPTIONS.tabBehavior).toBe('prefer-navigate-ui')
    expect(NOTION_EDITING_OPTIONS.trailingBlock).toBe(true)
  })

  it('prefers rich clipboard HTML while parsing plain text as Markdown', () => {
    const defaultPasteHandler = vi.fn().mockReturnValue(true)

    expect(handleNotionPaste({ defaultPasteHandler })).toBe(true)
    expect(defaultPasteHandler).toHaveBeenCalledWith({
      prioritizeMarkdownOverHTML: false,
      plainTextAsMarkdown: true
    })
  })

  it('enables browser writing assistance without handling composition itself', () => {
    expect(NOTION_EDITING_OPTIONS.domAttributes.editor).toEqual({
      autocapitalize: 'sentences',
      autocorrect: 'on',
      spellcheck: 'true'
    })
  })
})

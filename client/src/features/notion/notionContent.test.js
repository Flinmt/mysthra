import { describe, expect, it, vi } from 'vitest'
import { parseNotionContent, resolveNotionBlocks } from './notionContent'

describe('notion content helpers', () => {
  it('accepts only arrays as native BlockNote content', () => {
    const blocks = [{ id: 'block-1', type: 'paragraph' }]

    expect(parseNotionContent(JSON.stringify(blocks))).toEqual(blocks)
    expect(parseNotionContent('{"type":"paragraph"}')).toBeNull()
    expect(parseNotionContent('# Markdown')).toBeNull()
  })

  it('uses the BlockNote parser only for legacy Markdown', async () => {
    const editor = { tryParseMarkdownToBlocks: vi.fn().mockResolvedValue([{ type: 'heading' }]) }
    const native = [{ type: 'paragraph' }]

    await expect(resolveNotionBlocks(editor, JSON.stringify(native))).resolves.toEqual(native)
    expect(editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled()
    await expect(resolveNotionBlocks(editor, '# Heading')).resolves.toEqual([{ type: 'heading' }])
    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith('# Heading')
  })
})

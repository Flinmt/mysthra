import { blocksToYXmlFragment } from '@blocknote/core/yjs'
import * as Y from 'yjs'

export function parseNotionContent(content = '') {
  if (!content.trim()) return null
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function resolveNotionBlocks(editor, content = '') {
  const nativeBlocks = parseNotionContent(content)
  if (nativeBlocks) return nativeBlocks
  if (!content.trim()) return []
  return editor.tryParseMarkdownToBlocks(content)
}

export function createNotionMigrationUpdate(editor, blocks) {
  const migrationDocument = new Y.Doc()
  try {
    blocksToYXmlFragment(editor, blocks, migrationDocument.getXmlFragment('blocknote'))
    return Y.encodeStateAsUpdate(migrationDocument)
  } finally {
    migrationDocument.destroy()
  }
}

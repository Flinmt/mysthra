import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vitest'
import { getNotionSlashMenuItems, getOfficialColumnItems } from './notionCommands'
import { getNotionDictionary, NOTION_SCHEMA } from './notionSchema'

const labels = {
  commandGroupText: 'Texto',
  commandGroupLists: 'Listas',
  commandGroupStructure: 'Estrutura',
  commandGroupMedia: 'Mídia'
}

function createEditor() {
  return BlockNoteEditor.create({
    schema: NOTION_SCHEMA,
    dictionary: getNotionDictionary('pt-BR')
  })
}

describe('Notion slash commands integration', () => {
  it('builds the supported menu against the real BlockNote schema', async () => {
    const editor = createEditor()

    expect(getOfficialColumnItems(editor)).toHaveLength(2)

    const items = await getNotionSlashMenuItems(editor, editor.dictionary, labels, '')

    expect(items.some(item => item.key === 'table')).toBe(true)
    expect(items.some(item => item.key === 'columns_2')).toBe(true)
    expect(items.some(item => item.key === 'columns_3')).toBe(true)
    expect(items.some(item => ['video', 'audio', 'file'].includes(item.key))).toBe(false)
  })

  it('inserts table and column blocks through official callbacks', async () => {
    const tableEditor = createEditor()
    const tableItems = await getNotionSlashMenuItems(tableEditor, tableEditor.dictionary, labels, '')
    tableItems.find(item => item.key === 'table').onItemClick()
    expect(tableEditor.document[0].type).toBe('table')

    const columnEditor = createEditor()
    const columnItems = await getNotionSlashMenuItems(columnEditor, columnEditor.dictionary, labels, '')
    columnItems.find(item => item.key === 'columns_2').onItemClick()
    expect(columnEditor.document[0].type).toBe('columnList')
    expect(columnEditor.document[0].children).toHaveLength(2)
  })
})

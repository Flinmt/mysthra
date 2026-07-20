import { beforeEach, describe, expect, it, vi } from 'vitest'

const commandMocks = vi.hoisted(() => ({
  defaultItems: [],
  columnItems: []
}))

vi.mock('@blocknote/react', () => ({
  getDefaultReactSlashMenuItems: () => {
    if (commandMocks.defaultItems instanceof Error) throw commandMocks.defaultItems
    return commandMocks.defaultItems
  }
}))

vi.mock('@blocknote/xl-multi-column', () => ({
  multiColumnSchema: { blockSchema: { column: {}, columnList: {} } },
  getMultiColumnSlashMenuItems: () => {
    if (commandMocks.columnItems instanceof Error) throw commandMocks.columnItems
    return commandMocks.columnItems
  }
}))

import { COMMAND_ORDER, getNotionSlashMenuItems } from './notionCommands'

const labels = {
  commandGroupText: 'Texto',
  commandGroupLists: 'Listas',
  commandGroupStructure: 'Estrutura',
  commandGroupMedia: 'Mídia'
}

function createItem(key, title = key) {
  return {
    key,
    title,
    aliases: [title.toLowerCase()],
    group: 'Original',
    onItemClick: vi.fn()
  }
}

describe('Notion slash commands', () => {
  const editor = { schema: { blockSchema: {} } }

  beforeEach(() => {
    commandMocks.defaultItems = [
      createItem('image', 'Imagem'),
      createItem('video', 'Vídeo'),
      createItem('paragraph', 'Texto'),
      createItem('heading', 'Título 1'),
      createItem('heading_2', 'Título 2'),
      createItem('heading_3', 'Título 3'),
      createItem('bullet_list', 'Lista'),
      createItem('numbered_list', 'Lista numerada'),
      createItem('check_list', 'Checklist'),
      createItem('quote', 'Citação'),
      createItem('divider', 'Divisor'),
      createItem('table', 'Tabela'),
      createItem('code_block', 'Código')
    ]
    commandMocks.columnItems = [
      createItem(undefined, 'Duas colunas'),
      createItem(undefined, 'Três colunas')
    ]
  })

  it('returns a promise with only supported commands in the configured order', async () => {
    const result = getNotionSlashMenuItems(editor, {}, labels, '')

    expect(result).toBeInstanceOf(Promise)
    const items = await result
    expect(items.map(item => item.key)).toEqual(COMMAND_ORDER)
    expect(items.some(item => ['video', 'code_block'].includes(item.key))).toBe(false)
    expect(items.find(item => item.key === 'paragraph').group).toBe('Texto')
    expect(items.find(item => item.key === 'bullet_list').group).toBe('Listas')
    expect(items.find(item => item.key === 'table').group).toBe('Estrutura')
    expect(items.find(item => item.key === 'image').group).toBe('Mídia')
  })

  it('filters translated titles and preserves official insertion callbacks', async () => {
    const tableCallback = commandMocks.defaultItems.find(item => item.key === 'table').onItemClick
    const [table] = await getNotionSlashMenuItems(editor, {}, labels, 'tabela')

    expect(table.key).toBe('table')
    table.onItemClick()
    expect(tableCallback).toHaveBeenCalledOnce()
  })

  it('keeps essential commands when the column extension fails', async () => {
    commandMocks.columnItems = new Error('column extension unavailable')

    const items = await getNotionSlashMenuItems(editor, {}, labels, '')

    expect(items.some(item => item.key === 'paragraph')).toBe(true)
    expect(items.some(item => item.key.startsWith('columns_'))).toBe(false)
  })

  it('resolves to an empty list when default command generation fails', async () => {
    commandMocks.defaultItems = new Error('invalid editor')

    await expect(getNotionSlashMenuItems(editor, {}, labels, '')).resolves.toEqual([])
  })
})

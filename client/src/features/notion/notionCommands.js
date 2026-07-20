import { createElement } from 'react'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { getDefaultReactSlashMenuItems } from '@blocknote/react'
import { getMultiColumnSlashMenuItems, multiColumnSchema } from '@blocknote/xl-multi-column'
import {
  Columns2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Image,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table2
} from 'lucide-react'

const COMMAND_ORDER = [
  'paragraph',
  'heading',
  'heading_2',
  'heading_3',
  'bullet_list',
  'numbered_list',
  'check_list',
  'quote',
  'divider',
  'table',
  'columns_2',
  'columns_3',
  'image'
]

const COMMAND_ICONS = {
  paragraph: Pilcrow,
  heading: Heading1,
  heading_2: Heading2,
  heading_3: Heading3,
  bullet_list: List,
  numbered_list: ListOrdered,
  check_list: ListChecks,
  quote: Quote,
  divider: Minus,
  table: Table2,
  columns_2: Columns2,
  columns_3: Columns3,
  image: Image
}

function getCommandGroup(commandId, dictionary, labels) {
  const defaultTextGroup = dictionary?.slash_menu?.paragraph?.group || 'Text'
  if (['paragraph', 'heading', 'heading_2', 'heading_3', 'quote'].includes(commandId)) {
    return labels.commandGroupText || defaultTextGroup
  }
  if (['bullet_list', 'numbered_list', 'check_list'].includes(commandId)) {
    return labels.commandGroupLists || defaultTextGroup
  }
  if (['divider', 'table', 'columns_2', 'columns_3'].includes(commandId)) {
    return labels.commandGroupStructure || defaultTextGroup
  }
  return labels.commandGroupMedia || defaultTextGroup
}

function prepareCommand(item, commandId, dictionary, labels) {
  const Icon = COMMAND_ICONS[commandId]
  return {
    ...item,
    id: `notion-command-${commandId}`,
    key: commandId,
    group: getCommandGroup(commandId, dictionary, labels),
    icon: createElement(Icon, { size: 16, strokeWidth: 1.8 }),
    size: 'small'
  }
}

export function getOfficialColumnItems(editor) {
  const compatibleBlockSchema = {
    ...editor.schema.blockSchema,
    column: multiColumnSchema.blockSchema.column,
    columnList: multiColumnSchema.blockSchema.columnList
  }
  const compatibleEditor = new Proxy(editor, {
    get(target, property) {
      if (property === 'schema') return { ...target.schema, blockSchema: compatibleBlockSchema }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })

  return getMultiColumnSlashMenuItems(compatibleEditor)
}

export async function getNotionSlashMenuItems(editor, dictionary, labels = {}, query = '') {
  let defaultItems
  try {
    defaultItems = getDefaultReactSlashMenuItems(editor)
  } catch {
    return []
  }

  const itemsByKey = new Map(defaultItems.map(item => [item.key, item]))

  try {
    const columnItems = getOfficialColumnItems(editor)
    if (columnItems[0]) itemsByKey.set('columns_2', columnItems[0])
    if (columnItems[1]) itemsByKey.set('columns_3', columnItems[1])
  } catch {
    // The essential menu remains available when the column extension is unavailable.
  }

  const supportedItems = COMMAND_ORDER
    .filter(commandId => itemsByKey.has(commandId))
    .map(commandId => prepareCommand(itemsByKey.get(commandId), commandId, dictionary, labels))

  try {
    return filterSuggestionItems(supportedItems, query)
  } catch {
    return supportedItems
  }
}

export { COMMAND_ORDER }

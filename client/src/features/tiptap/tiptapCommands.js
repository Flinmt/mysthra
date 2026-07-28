import { createElement } from 'react'
import {
  Grid3X3,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Images,
  Info,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote
} from 'lucide-react'

const command = (id, label, group, Icon, shortcut = null, keywords = []) => ({
  id,
  label,
  group,
  shortcut,
  keywords,
  icon: createElement(Icon, { size: 15, strokeWidth: 1.8, 'aria-hidden': true })
})

const translate = (t, key, fallback) => {
  const value = t?.(key, fallback)
  return !value || value === key ? fallback : value
}

export function createTiptapCommands(t) {
  const textGroup = translate(t, 'workspace.tiptap_group_text', 'Texto')
  const toggleGroup = translate(t, 'workspace.tiptap_group_toggles', 'Títulos expansíveis')
  const listGroup = translate(t, 'workspace.tiptap_group_lists', 'Listas')
  const highlightGroup = translate(t, 'workspace.tiptap_group_highlights', 'Destaques')
  const structureGroup = translate(t, 'workspace.tiptap_group_structure', 'Estrutura')
  const mediaGroup = translate(t, 'workspace.tiptap_group_media', 'Mídia')

  return [
    command('paragraph', translate(t, 'workspace.tiptap_command_text', 'Texto'), textGroup, Pilcrow, ['Mod', 'Alt', '0']),
    ...[1, 2, 3, 4, 5, 6].map(level => command(
      `heading-${level}`,
      translate(t, 'workspace.tiptap_command_heading', `Título ${level}`).replace('{{level}}', level),
      textGroup,
      [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6][level - 1],
      ['Mod', 'Alt', String(level)]
    )),
    command('blockquote', translate(t, 'workspace.tiptap_command_quote', 'Citação'), textGroup, Quote),
    ...[1, 2, 3, 4, 5, 6].map(level => command(
      `toggle-heading-${level}`,
      translate(t, 'workspace.tiptap_command_toggle_heading', `Título expansível ${level}`).replace('{{level}}', level),
      toggleGroup,
      [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6][level - 1]
    )),
    command('bulletList', translate(t, 'workspace.tiptap_command_list', 'Lista'), listGroup, List, ['Mod', 'Shift', '8']),
    command('orderedList', translate(t, 'workspace.tiptap_command_ordered_list', 'Lista numerada'), listGroup, ListOrdered, ['Mod', 'Shift', '7']),
    command('callout', translate(t, 'workspace.tiptap_command_callout', 'Destaque'), highlightGroup, Info, null, [
      'callout',
      'aviso',
      'destaque',
      'informação',
      'informacao',
      'notice',
      'alert'
    ]),
    command('horizontalRule', translate(t, 'workspace.tiptap_command_divider', 'Divisor'), structureGroup, Minus),
    command('table', translate(t, 'workspace.tiptap_command_table', 'Tabela'), structureGroup, Grid3X3, null, [
      'table',
      'tabela',
      'grade',
      'grid',
      'planilha',
      'spreadsheet'
    ]),
    command('media', translate(t, 'workspace.tiptap_command_media', 'Inserir mídia'), mediaGroup, Images, null, [
    'media',
    'mídia',
    'midia',
    'image',
    'imagem',
    'gif',
    'audio',
    'áudio',
    'som'
    ])
  ]
}

export const TIPTAP_COMMANDS = createTiptapCommands()

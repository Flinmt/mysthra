import { createElement } from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote
} from 'lucide-react'

const command = (id, label, group, Icon, shortcut = null) => ({
  id,
  label,
  group,
  shortcut,
  icon: createElement(Icon, { size: 15, strokeWidth: 1.8, 'aria-hidden': true })
})

export const TIPTAP_COMMANDS = [
  command('paragraph', 'Texto', 'Texto', Pilcrow, ['Mod', 'Alt', '0']),
  command('heading-1', 'Título 1', 'Texto', Heading1, ['Mod', 'Alt', '1']),
  command('heading-2', 'Título 2', 'Texto', Heading2, ['Mod', 'Alt', '2']),
  command('heading-3', 'Título 3', 'Texto', Heading3, ['Mod', 'Alt', '3']),
  command('heading-4', 'Título 4', 'Texto', Heading4, ['Mod', 'Alt', '4']),
  command('heading-5', 'Título 5', 'Texto', Heading5, ['Mod', 'Alt', '5']),
  command('heading-6', 'Título 6', 'Texto', Heading6, ['Mod', 'Alt', '6']),
  command('blockquote', 'Citação', 'Texto', Quote),
  command('toggle-heading-1', 'Título expansível 1', 'Títulos expansíveis', Heading1),
  command('toggle-heading-2', 'Título expansível 2', 'Títulos expansíveis', Heading2),
  command('toggle-heading-3', 'Título expansível 3', 'Títulos expansíveis', Heading3),
  command('toggle-heading-4', 'Título expansível 4', 'Títulos expansíveis', Heading4),
  command('toggle-heading-5', 'Título expansível 5', 'Títulos expansíveis', Heading5),
  command('toggle-heading-6', 'Título expansível 6', 'Títulos expansíveis', Heading6),
  command('bulletList', 'Lista', 'Listas', List, ['Mod', 'Shift', '8']),
  command('orderedList', 'Lista numerada', 'Listas', ListOrdered, ['Mod', 'Shift', '7']),
  command('horizontalRule', 'Divisor', 'Estrutura', Minus)
]

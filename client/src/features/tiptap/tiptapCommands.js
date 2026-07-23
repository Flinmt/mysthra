import { createElement } from 'react'
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  ListTree,
  Minus,
  Pilcrow,
  Quote
} from 'lucide-react'

const command = (id, label, group, Icon) => ({
  id,
  label,
  group,
  icon: createElement(Icon, { size: 15, strokeWidth: 1.8, 'aria-hidden': true })
})

export const TIPTAP_COMMANDS = [
  command('paragraph', 'Texto', 'Texto', Pilcrow),
  command('heading-1', 'Título 1', 'Texto', Heading1),
  command('heading-2', 'Título 2', 'Texto', Heading2),
  command('heading-3', 'Título 3', 'Texto', Heading3),
  command('heading-4', 'Título 4', 'Texto', Heading4),
  command('heading-5', 'Título 5', 'Texto', Heading5),
  command('heading-6', 'Título 6', 'Texto', Heading6),
  command('blockquote', 'Citação', 'Texto', Quote),
  command('bulletList', 'Lista', 'Listas', List),
  command('orderedList', 'Lista numerada', 'Listas', ListOrdered),
  command('expand', 'Expandir', 'Estrutura', ListTree),
  command('codeBlock', 'Código', 'Estrutura', Code2),
  command('horizontalRule', 'Divisor', 'Estrutura', Minus)
]

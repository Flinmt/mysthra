import { Node } from '@tiptap/core'

export const TiptapHardBreak = Node.create({
  name: 'hardBreak',
  inline: true,
  group: 'inline',
  selectable: false,
  atom: true,
  parseHTML: () => [{ tag: 'br' }],
  renderHTML: () => ['br'],
  addCommands: () => ({
    setHardBreak: () => ({ commands }) => commands.insertContent({ type: 'hardBreak' })
  }),
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () => this.editor.commands.setHardBreak()
    }
  }
})

export const TiptapHeading = Node.create({
  name: 'heading',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes: () => ({ level: { default: 2 } }),
  parseHTML: () => [{ tag: 'h1' }, { tag: 'h2' }, { tag: 'h3' }],
  renderHTML: ({ node, HTMLAttributes }) => [`h${node.attrs.level}`, HTMLAttributes, 0],
  addCommands: () => ({
    setHeading: attributes => ({ commands }) => commands.setNode('heading', attributes)
  })
})

export const TiptapListItem = Node.create({
  name: 'listItem',
  group: 'block',
  content: 'paragraph block*',
  parseHTML: () => [{ tag: 'li' }],
  renderHTML: ({ HTMLAttributes }) => ['li', HTMLAttributes, 0]
})

function createListNode(name, tag, commandName) {
  return Node.create({
    name,
    group: 'block',
    content: 'listItem+',
    parseHTML: () => [{ tag }],
    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes, 0],
    addCommands: () => ({
      [commandName]: () => ({ commands }) => commands.wrapIn(name)
    })
  })
}

export const TiptapBulletList = createListNode('bulletList', 'ul', 'setBulletList')
export const TiptapOrderedList = createListNode('orderedList', 'ol', 'setOrderedList')

export const TiptapExpand = Node.create({
  name: 'expand',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML: () => [{ tag: '[data-tiptap-expand]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { ...HTMLAttributes, 'data-tiptap-expand': '' }, 0],
  addNodeView: () => () => {
    const dom = document.createElement('div')
    const button = document.createElement('button')
    const contentDOM = document.createElement('div')
    dom.className = 'tiptap-expand'
    button.type = 'button'
    button.className = 'tiptap-expand-trigger'
    button.setAttribute('aria-label', 'Expandir ou recolher conteúdo')
    contentDOM.className = 'tiptap-expand-content'
    let isOpen = true
    const updateVisibility = () => {
      dom.dataset.open = String(isOpen)
      Array.from(contentDOM.children).forEach((child, index) => {
        child.hidden = index > 0 && !isOpen
      })
      button.setAttribute('aria-expanded', String(isOpen))
    }
    const toggle = event => {
      event.preventDefault()
      event.stopPropagation()
      isOpen = !isOpen
      updateVisibility()
    }
    button.addEventListener('mousedown', toggle)
    button.addEventListener('click', event => event.stopPropagation())
    contentDOM.addEventListener('click', event => {
      const title = event.target.closest?.('p')
      if (title && title === contentDOM.firstElementChild) {
        event.stopPropagation()
        isOpen = !isOpen
        updateVisibility()
      }
    })
    dom.append(button, contentDOM)
    updateVisibility()
    return {
      dom,
      contentDOM,
      ignoreMutation: mutation => mutation.type === 'attributes'
    }
  },
  addCommands: () => ({
    setExpand: () => ({ commands }) => commands.wrapIn('expand')
  })
})

export const TiptapBlockquote = Node.create({
  name: 'blockquote',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML: () => [{ tag: 'blockquote' }],
  renderHTML: ({ HTMLAttributes }) => ['blockquote', HTMLAttributes, 0],
  addCommands: () => ({
    setBlockquote: () => ({ commands }) => commands.wrapIn('blockquote')
  })
})

export const TiptapCodeBlock = Node.create({
  name: 'codeBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  parseHTML: () => [{ tag: 'pre' }],
  renderHTML: ({ HTMLAttributes }) => ['pre', HTMLAttributes, ['code', 0]],
  addCommands: () => ({
    setCodeBlock: () => ({ commands }) => commands.setNode('codeBlock')
  })
})

import { InputRule, Node, wrappingInputRule } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

const TOGGLE_HEADING_STORAGE_PREFIX = 'mysthra:tiptap-toggle-heading:'

function createToggleHeadingId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `toggle-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getStoredToggleHeadingState(id) {
  if (!id) return true
  try {
    const stored = window.localStorage.getItem(`${TOGGLE_HEADING_STORAGE_PREFIX}${id}`)
    return stored === null ? true : stored === 'open'
  } catch {
    return true
  }
}

function storeToggleHeadingState(id, isOpen) {
  if (!id) return
  try {
    window.localStorage.setItem(
      `${TOGGLE_HEADING_STORAGE_PREFIX}${id}`,
      isOpen ? 'open' : 'closed'
    )
  } catch {
    // Local persistence is optional when storage is unavailable.
  }
}

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
  parseHTML: () => [1, 2, 3, 4, 5, 6].map(level => ({
    tag: `h${level}`,
    attrs: { level }
  })),
  renderHTML: ({ node, HTMLAttributes }) => [`h${node.attrs.level}`, HTMLAttributes, 0],
  addCommands: () => ({
    setHeading: attributes => ({ commands }) => commands.setNode('heading', attributes)
  }),
  addKeyboardShortcuts() {
    return Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map(level => [
        `Mod-Alt-${level}`,
        () => this.editor.commands.setHeading({ level })
      ])
    )
  },
  addInputRules() {
    return [1, 2, 3, 4, 5, 6].map(level => new InputRule({
      find: new RegExp(`^(#{${level}})\\s$`),
      handler: ({ state, range }) => {
        const $from = state.doc.resolve(range.from)
        if ($from.parent.type.name !== 'paragraph') return null
        state.tr
          .delete(range.from, range.to)
          .setBlockType(range.from, range.from, this.type, { level })
      }
    }))
  }
})

export const TiptapListItem = Node.create({
  name: 'listItem',
  content: 'paragraph block*',
  defining: true,
  parseHTML: () => [{ tag: 'li' }],
  renderHTML: ({ HTMLAttributes }) => ['li', HTMLAttributes, 0],
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name)
    }
  }
})

function createListNode({ name, tag, commandName, shortcut, inputPattern, ordered = false }) {
  return Node.create({
    name,
    group: 'block list',
    content: 'listItem+',
    addAttributes: () => ordered
      ? {
          start: {
            default: 1,
            parseHTML: element => {
              const start = Number.parseInt(element.getAttribute('start') || '', 10)
              return Number.isFinite(start) ? start : 1
            },
            renderHTML: attributes => attributes.start === 1 ? {} : { start: attributes.start }
          }
        }
      : {},
    parseHTML: () => [{ tag }],
    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes, 0],
    addCommands: () => ({
      [commandName]: () => ({ commands }) => commands.toggleList(name, 'listItem', true)
    }),
    addKeyboardShortcuts() {
      return {
        [shortcut]: () => this.editor.commands[commandName]()
      }
    },
    addInputRules() {
      return [
        wrappingInputRule({
          find: inputPattern,
          type: this.type,
          ...(ordered
            ? {
                getAttributes: match => ({ start: Number(match[1]) }),
                joinPredicate: (match, node) => node.childCount + node.attrs.start === Number(match[1])
              }
            : {})
        })
      ]
    }
  })
}

export const TiptapBulletList = createListNode({
  name: 'bulletList',
  tag: 'ul',
  commandName: 'toggleBulletList',
  shortcut: 'Mod-Shift-8',
  inputPattern: /^\s*([-+*])\s$/
})

export const TiptapOrderedList = createListNode({
  name: 'orderedList',
  tag: 'ol',
  commandName: 'toggleOrderedList',
  shortcut: 'Mod-Shift-7',
  inputPattern: /^(\d+)\.\s$/,
  ordered: true
})

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

export const TiptapToggleHeading = Node.create({
  name: 'toggleHeading',
  group: 'block',
  content: 'heading block*',
  defining: true,
  addAttributes: () => ({
    id: {
      default: null,
      parseHTML: element => element.getAttribute('data-toggle-heading-id'),
      renderHTML: attributes => attributes.id
        ? { 'data-toggle-heading-id': attributes.id }
        : {}
    },
    level: {
      default: 1,
      parseHTML: element => {
        const level = Number(element.getAttribute('data-toggle-heading-level'))
        return level >= 1 && level <= 6 ? level : 1
      },
      renderHTML: attributes => ({ 'data-toggle-heading-level': attributes.level })
    }
  }),
  parseHTML: () => [{ tag: '[data-tiptap-toggle-heading]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    { ...HTMLAttributes, 'data-tiptap-toggle-heading': '' },
    0
  ],
  addCommands() {
    return {
      setToggleHeading: ({ level }) => ({ chain }) => {
        const normalizedLevel = Math.min(6, Math.max(1, Number(level) || 1))
        return chain()
          .setHeading({ level: normalizedLevel })
          .wrapIn(this.name, {
            id: createToggleHeadingId(),
            level: normalizedLevel
          })
          .run()
      }
    }
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.command(({ state, dispatch, view }) => {
        const { $from, empty } = state.selection
        if (
          !empty ||
          $from.parent.type.name !== 'heading' ||
          $from.depth < 2
        ) {
          return false
        }

        const toggleDepth = $from.depth - 1
        const toggleNode = $from.node(toggleDepth)
        if (toggleNode.type !== this.type || $from.index(toggleDepth) !== 0) return false

        const togglePosition = $from.before(toggleDepth)
        const toggleDom = view.nodeDOM(togglePosition)
        if (!(toggleDom instanceof HTMLElement)) {
          return false
        }

        if (dispatch) {
          const headingPosition = $from.before()
          const headingBeforeCursor = $from.parent.copy(
            $from.parent.content.cut(0, $from.parentOffset)
          )
          const paragraphAfterCursor = state.schema.nodes.paragraph.create(
            null,
            $from.parent.content.cut($from.parentOffset)
          )

          if (toggleDom.dataset.open === 'false') {
            const updatedToggle = toggleNode.copy(Fragment.fromArray([
              headingBeforeCursor,
              ...toggleNode.content.content.slice(1)
            ]))
            const transaction = state.tr.replaceWith(
              togglePosition,
              togglePosition + toggleNode.nodeSize,
              Fragment.fromArray([updatedToggle, paragraphAfterCursor])
            )
            transaction.setSelection(
              TextSelection.near(
                transaction.doc.resolve(togglePosition + updatedToggle.nodeSize + 1),
                1
              )
            )
            dispatch(transaction)
          } else {
            const transaction = state.tr.replaceWith(
              headingPosition,
              headingPosition + $from.parent.nodeSize,
              Fragment.fromArray([headingBeforeCursor, paragraphAfterCursor])
            )
            transaction.setSelection(
              TextSelection.near(
                transaction.doc.resolve(headingPosition + headingBeforeCursor.nodeSize + 1),
                1
              )
            )
            dispatch(transaction)
          }
        }
        return true
      }),
      ArrowDown: () => this.editor.commands.command(({ state, dispatch, view }) => {
        const { $from, empty } = state.selection
        if (
          !empty ||
          $from.parent.type.name !== 'heading' ||
          $from.depth < 2
        ) {
          return false
        }

        const toggleDepth = $from.depth - 1
        const toggleNode = $from.node(toggleDepth)
        if (toggleNode.type !== this.type || $from.index(toggleDepth) !== 0) return false

        const togglePosition = $from.before(toggleDepth)
        const toggleDom = view.nodeDOM(togglePosition)
        if (!(toggleDom instanceof HTMLElement) || toggleDom.dataset.open !== 'false') {
          return false
        }

        const positionAfterToggle = togglePosition + toggleNode.nodeSize
        const nextSelection = TextSelection.near(
          state.doc.resolve(positionAfterToggle),
          1
        )
        if (nextSelection.from <= positionAfterToggle) {
          if (dispatch) {
            const transaction = state.tr.insert(
              positionAfterToggle,
              state.schema.nodes.paragraph.create()
            )
            transaction.setSelection(
              TextSelection.near(transaction.doc.resolve(positionAfterToggle + 1), 1)
            )
            dispatch(transaction)
          }
          return true
        }

        if (dispatch) dispatch(state.tr.setSelection(nextSelection))
        return true
      }),
      Backspace: () => this.editor.commands.command(({ state, dispatch, view }) => {
        const { $from, empty } = state.selection
        if (
          empty &&
          $from.parentOffset === 0 &&
          $from.depth === 1
        ) {
          const currentIndex = $from.index(0)
          const previousNode = currentIndex > 0
            ? state.doc.child(currentIndex - 1)
            : null

          if (previousNode?.type === this.type) {
            const currentPosition = $from.before(1)
            const togglePosition = currentPosition - previousNode.nodeSize
            const toggleDom = view.nodeDOM(togglePosition)

            if (
              toggleDom instanceof HTMLElement &&
              (toggleDom.dataset.open === 'false' || toggleDom.dataset.open === 'true')
            ) {
              if (dispatch) {
                const destination = toggleDom.dataset.open === 'false'
                  ? togglePosition + previousNode.firstChild.nodeSize
                  : togglePosition + previousNode.nodeSize - 1
                dispatch(state.tr.setSelection(
                  TextSelection.near(state.doc.resolve(destination), -1)
                ))
              }
              return true
            }
          }
        }

        if (
          !empty ||
          $from.parent.type.name !== 'heading' ||
          $from.parentOffset !== 0 ||
          $from.depth < 2
        ) {
          return false
        }

        const toggleDepth = $from.depth - 1
        const toggleNode = $from.node(toggleDepth)
        if (toggleNode.type !== this.type || $from.index(toggleDepth) !== 0) return false

        if (dispatch) {
          const togglePosition = $from.before(toggleDepth)
          const paragraph = state.schema.nodes.paragraph.create(
            null,
            $from.parent.content
          )
          const replacement = Fragment.fromArray([
            paragraph,
            ...toggleNode.content.content.slice(1)
          ])
          const transaction = state.tr.replaceWith(
            togglePosition,
            togglePosition + toggleNode.nodeSize,
            replacement
          )
          transaction.setSelection(
            TextSelection.near(transaction.doc.resolve(togglePosition + 1))
          )
          dispatch(transaction)
        }
        return true
      })
    }
  },
  addNodeView: () => ({ node, view, getPos }) => {
    const dom = document.createElement('div')
    const button = document.createElement('button')
    const contentDOM = document.createElement('div')
    let currentNode = node
    let currentId = node.attrs.id
    let isOpen = getStoredToggleHeadingState(currentId)

    dom.className = 'tiptap-toggle-heading'
    button.type = 'button'
    button.contentEditable = 'false'
    button.className = 'tiptap-toggle-heading-trigger'
    button.setAttribute('aria-label', 'Expandir ou recolher título')
    contentDOM.className = 'tiptap-toggle-heading-content'
    dom.append(button, contentDOM)

    const syncDomState = () => {
      dom.dataset.open = String(isOpen)
      dom.dataset.level = String(currentNode.attrs.level)
      button.setAttribute('aria-expanded', String(isOpen))
      const contentId = `tiptap-toggle-heading-${currentId || 'pending'}`
      contentDOM.id = contentId
      button.setAttribute('aria-controls', contentId)
    }

    const ensureId = () => {
      if (currentId) return currentId
      currentId = createToggleHeadingId()
      const position = getPos()
      if (typeof position === 'number') {
        view.dispatch(view.state.tr.setNodeMarkup(position, undefined, {
          ...currentNode.attrs,
          id: currentId
        }))
      }
      return currentId
    }

    const moveSelectionToTitle = () => {
      const position = getPos()
      const title = currentNode.firstChild
      if (typeof position !== 'number' || !title) return
      const titleEnd = position + title.nodeSize
      const nodeEnd = position + currentNode.nodeSize
      const { from, to } = view.state.selection
      if (from <= titleEnd || to >= nodeEnd) return
      const transaction = view.state.tr.setSelection(
        TextSelection.near(view.state.doc.resolve(titleEnd), -1)
      )
      view.dispatch(transaction)
    }

    const handleMouseDown = event => event.preventDefault()
    const handleClick = event => {
      event.preventDefault()
      event.stopPropagation()
      if (isOpen) moveSelectionToTitle()
      isOpen = !isOpen
      storeToggleHeadingState(ensureId(), isOpen)
      syncDomState()
    }

    button.addEventListener('mousedown', handleMouseDown)
    button.addEventListener('click', handleClick)
    syncDomState()

    return {
      dom,
      contentDOM,
      update: updatedNode => {
        if (updatedNode.type !== currentNode.type) return false
        const previousId = currentId
        currentNode = updatedNode
        currentId = updatedNode.attrs.id || currentId
        if (currentId !== previousId && previousId) {
          isOpen = getStoredToggleHeadingState(currentId)
        }
        syncDomState()
        return true
      },
      ignoreMutation: mutation => (
        mutation.type === 'attributes' &&
        (mutation.target === dom || mutation.target === button || mutation.target === contentDOM)
      ),
      stopEvent: event => button.contains(event.target),
      destroy: () => {
        button.removeEventListener('mousedown', handleMouseDown)
        button.removeEventListener('click', handleClick)
      }
    }
  }
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
  }),
  addInputRules() {
    return [
      wrappingInputRule({
        find: /^>\s$/,
        type: this.type
      })
    ]
  }
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

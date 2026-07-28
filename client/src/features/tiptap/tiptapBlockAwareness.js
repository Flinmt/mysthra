import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const blockAwarenessPluginKey = new PluginKey('tiptapBlockAwareness')

function findAncestor($position, nodeName) {
  for (let depth = $position.depth - 1; depth > 0; depth -= 1) {
    const node = $position.node(depth)
    if (node.type.name === nodeName) return node
  }
  return null
}

function getPlaceholder($anchor, options) {
  const block = $anchor.parent
  if (block.content.size > 0) return null
  if (
    findAncestor($anchor, 'tableCell') ||
    findAncestor($anchor, 'tableHeader')
  ) {
    return null
  }

  if (block.type.name === 'heading') {
    const toggleHeading = findAncestor($anchor, 'toggleHeading')
    if (toggleHeading) {
      return options.toggleHeadingPlaceholder(toggleHeading.attrs.level)
    }
    return options.headingPlaceholder(block.attrs.level)
  }

  if (
    block.type.name === 'paragraph' &&
    findAncestor($anchor, 'toggleHeading')
  ) {
    return options.rootPlaceholder
  }

  if (block.type.name === 'paragraph' && $anchor.depth === 1) {
    return options.rootPlaceholder
  }

  return options.blockPlaceholder
}

export const TiptapBlockAwareness = Extension.create({
  name: 'tiptapBlockAwareness',
  addOptions: () => ({
    rootPlaceholder: 'Type or use / for commands',
    blockPlaceholder: 'Type or use /',
    headingPlaceholder: level => `Heading ${level}`,
    toggleHeadingPlaceholder: level => `Toggle heading ${level}`
  }),
  addProseMirrorPlugins() {
    const editor = this.editor
    const options = this.options

    return [
      new Plugin({
        key: blockAwarenessPluginKey,
        props: {
          decorations(state) {
            if (!editor.isEditable) return DecorationSet.empty

            const $anchor = state.selection.$anchor || state.selection.$from
            const block = $anchor.parent
            if (!block.isTextblock) return DecorationSet.empty

            const position = $anchor.before($anchor.depth)
            const placeholder = getPlaceholder($anchor, options)
            const attributes = {
              class: `tiptap-active-block${placeholder ? ' is-empty' : ''}`
            }
            if (placeholder) attributes['data-placeholder'] = placeholder

            return DecorationSet.create(state.doc, [
              Decoration.node(position, position + block.nodeSize, attributes)
            ])
          }
        }
      })
    ]
  }
})

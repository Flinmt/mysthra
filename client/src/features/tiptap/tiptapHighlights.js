import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { normalizeTextColor } from './tiptapTextColors'

export const TiptapTextHighlight = Mark.create({
  name: 'textHighlight',
  addAttributes: () => ({
    color: {
      default: null,
      parseHTML: element => normalizeTextColor(element.getAttribute('data-highlight-color')) || null,
      renderHTML: attributes => {
        const color = normalizeTextColor(attributes.color)
        return color ? {
          'data-highlight-color': color,
          style: `--tiptap-highlight-color: ${color}`
        } : {}
      }
    }
  }),
  parseHTML: () => [{ tag: 'mark[data-highlight-color]' }],
  renderHTML: ({ HTMLAttributes }) => ['mark', mergeAttributes(HTMLAttributes), 0],
  addProseMirrorPlugins() {
    const markType = this.type
    return [new Plugin({
      props: {
        decorations(state) {
          const decorations = []
          state.doc.descendants((node, position) => {
            if (node.type.name !== 'heading') return true
            let color = ''
            node.descendants(child => {
              if (color || !child.isText) return
              const mark = child.marks.find(candidate => candidate.type === markType)
              color = normalizeTextColor(mark?.attrs.color)
            })
            if (color) decorations.push(Decoration.node(
              position,
              position + node.nodeSize,
              {
                'data-highlight-line': color,
                style: `--tiptap-highlight-color: ${color}`
              }
            ))
            return false
          })
          return DecorationSet.create(state.doc, decorations)
        }
      }
    })]
  }
})

function updateSelectionHighlight(editor, value) {
  const color = value === null ? null : normalizeTextColor(value)
  if (
    !editor?.isEditable || !(editor.state.selection instanceof TextSelection) ||
    editor.state.selection.empty || (value !== null && !color)
  ) return false
  const { from, to } = editor.state.selection
  const markType = editor.schema.marks.textHighlight
  if (!markType) return false
  const transaction = editor.state.tr
  editor.state.doc.nodesBetween(from, to, (node, position, parent) => {
    if (node.type.name === 'heading') {
      const headingFrom = position + 1
      const headingTo = headingFrom + node.content.size
      if (color) transaction.addMark(headingFrom, headingTo, markType.create({ color }))
      else transaction.removeMark(headingFrom, headingTo, markType)
      return false
    }
    if (!node.isText || !parent?.type.allowsMarkType(markType)) return undefined
    const markFrom = Math.max(from, position)
    const markTo = Math.min(to, position + node.nodeSize)
    if (markFrom >= markTo) return undefined
    if (color) transaction.addMark(markFrom, markTo, markType.create({ color }))
    else transaction.removeMark(markFrom, markTo, markType)
    return undefined
  })
  if (!transaction.docChanged) return false
  editor.view.dispatch(transaction.scrollIntoView())
  return true
}

export function setSelectionHighlight(editor, color) {
  return updateSelectionHighlight(editor, color)
}

export function unsetSelectionHighlight(editor) {
  return updateSelectionHighlight(editor, null)
}

export function getSelectionHighlight(editor) {
  const colors = new Set()
  const { from, to } = editor.state.selection
  const markType = editor.schema.marks.textHighlight
  editor.state.doc.nodesBetween(from, to, node => {
    if (node.type.name === 'heading') {
      node.descendants(child => {
        if (!child.isText) return
        const mark = child.marks.find(candidate => candidate.type === markType)
        colors.add(normalizeTextColor(mark?.attrs.color) || '')
      })
      return false
    }
    if (!node.isText) return undefined
    const mark = node.marks.find(candidate => candidate.type === markType)
    colors.add(normalizeTextColor(mark?.attrs.color) || '')
    return undefined
  })
  if (colors.size > 1) return { color: '', mixed: true }
  return { color: colors.values().next().value || '', mixed: false }
}

import Link from '@tiptap/extension-link'
import { getMarkRange } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { isInternalPageLink } from '../../workspace/utils'
import { normalizeExternalUrl } from './tiptapExternalLinks'

export const TiptapPageLink = Link.configure({
  autolink: false,
  enableClickSelection: false,
  linkOnPaste: false,
  openOnClick: false,
  protocols: ['mysthra', 'http', 'https', 'mailto'],
  HTMLAttributes: {
    class: 'tiptap-page-link',
    rel: null,
    target: null
  },
  isAllowedUri: href => isInternalPageLink(href) || Boolean(normalizeExternalUrl(href))
})

export function canInsertPageLink(editor) {
  if (!editor?.isEditable || !(editor.state.selection instanceof TextSelection)) return false
  const linkMark = editor.schema.marks.link
  if (!linkMark) return false

  const { doc } = editor.state
  const { from, to, empty, $from } = editor.state.selection
  if (empty) return $from.parent.type.allowsMarkType(linkMark)

  let allowed = true
  doc.nodesBetween(from, to, node => {
    if (node.isTextblock && !node.type.allowsMarkType(linkMark)) allowed = false
  })
  return allowed
}

export function isPageLinkShortcut(event) {
  return Boolean(
    event?.code === 'Space' &&
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}

export function insertPageLink(editor, { href = '', label = '' } = {}) {
  if (!canInsertPageLink(editor) || !isInternalPageLink(href)) return false
  const { empty } = editor.state.selection

  if (!empty) {
    return editor.chain().focus().setLink({ href }).run()
  }

  const text = String(label || '').trim()
  if (!text) return false
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      text,
      marks: [{ type: 'link', attrs: { href } }]
    })
    .run()
}

export function deletePageLinkAtSelection(editor, key) {
  if (
    !editor?.isEditable ||
    (key !== 'Backspace' && key !== 'Delete') ||
    !(editor.state.selection instanceof TextSelection)
  ) {
    return false
  }

  const { doc, selection } = editor.state
  const linkMark = editor.schema.marks.link
  if (!linkMark) return false

  if (selection.empty) {
    const adjacentNode = key === 'Backspace'
      ? selection.$from.nodeBefore
      : selection.$from.nodeAfter
    const mark = adjacentNode?.marks.find(candidate =>
      candidate.type === linkMark && isInternalPageLink(candidate.attrs.href)
    )
    if (!mark) return false

    const range = getMarkRange(selection.$from, linkMark, { href: mark.attrs.href })
    if (!range) return false
    editor.view.dispatch(editor.state.tr.delete(range.from, range.to).scrollIntoView())
    return true
  }

  let deleteFrom = selection.from
  let deleteTo = selection.to
  let foundLink = false
  doc.nodesBetween(selection.from, selection.to, (node, position) => {
    if (!node.isText) return
    const mark = node.marks.find(candidate =>
      candidate.type === linkMark && isInternalPageLink(candidate.attrs.href)
    )
    if (!mark) return

    const probePosition = Math.max(selection.from, position)
    const range = getMarkRange(doc.resolve(probePosition), linkMark, { href: mark.attrs.href })
    if (!range) return
    foundLink = true
    deleteFrom = Math.min(deleteFrom, range.from)
    deleteTo = Math.max(deleteTo, range.to)
  })

  if (!foundLink) return false
  editor.view.dispatch(editor.state.tr.delete(deleteFrom, deleteTo).scrollIntoView())
  return true
}

export function getInternalPageLinkHref(target) {
  const anchor = target instanceof Element ? target.closest('a[href]') : null
  const href = anchor?.getAttribute('href') || ''
  return isInternalPageLink(href) ? href : ''
}

export function shouldNavigatePageLink(editor, event) {
  return Boolean(!editor?.isEditable || event?.ctrlKey || event?.metaKey)
}

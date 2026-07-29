import Link from '@tiptap/extension-link'
import { TextSelection } from '@tiptap/pm/state'
import { isInternalPageLink } from '../../workspace/utils'

export const TiptapPageLink = Link.configure({
  autolink: false,
  enableClickSelection: false,
  linkOnPaste: false,
  openOnClick: false,
  protocols: ['mysthra'],
  HTMLAttributes: {
    class: 'tiptap-page-link',
    rel: null,
    target: null
  },
  isAllowedUri: href => isInternalPageLink(href)
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

export function getInternalPageLinkHref(target) {
  const anchor = target instanceof Element ? target.closest('a[href]') : null
  const href = anchor?.getAttribute('href') || ''
  return isInternalPageLink(href) ? href : ''
}

export function shouldNavigatePageLink(editor, event) {
  return Boolean(!editor?.isEditable || event?.ctrlKey || event?.metaKey)
}

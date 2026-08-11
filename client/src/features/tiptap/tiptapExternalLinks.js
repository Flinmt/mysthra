import { Extension } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'

export function normalizeExternalUrl(value = '') {
  const raw = String(value).trim()
  if (!raw || /\s/.test(raw)) return ''
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw
  try {
    const url = new URL(candidate)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

export function setExternalLink(editor, value) {
  const href = normalizeExternalUrl(value)
  if (
    !href || !editor?.isEditable || editor.state.selection.empty ||
    !(editor.state.selection instanceof TextSelection) || !editor.schema.marks.link
  ) return false
  let allowed = true
  editor.state.doc.nodesBetween(editor.state.selection.from, editor.state.selection.to, node => {
    if (node.isTextblock && !node.type.allowsMarkType(editor.schema.marks.link)) allowed = false
  })
  if (!allowed) return false
  return editor.chain().focus().setLink({
    href,
    target: '_blank',
    rel: 'noopener noreferrer'
  }).run()
}

export function getExternalLinkHref(target) {
  const anchor = target instanceof Element ? target.closest('a[href]') : null
  return normalizeExternalUrl(anchor?.getAttribute('href') || '')
}

export const TiptapExternalLinkPaste = Extension.create({
  name: 'tiptapExternalLinkPaste',
  priority: 130,
  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({
      props: {
        handlePaste: (_view, event) => {
          if (!editor.isEditable || editor.state.selection.empty) return false
          const href = normalizeExternalUrl(event.clipboardData?.getData('text/plain'))
          if (!href || !setExternalLink(editor, href)) return false
          event.preventDefault()
          return true
        }
      }
    })]
  }
})

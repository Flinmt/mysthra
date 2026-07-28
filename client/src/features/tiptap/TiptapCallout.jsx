/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer
} from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import {
  AlertTriangle,
  Bell,
  Bookmark,
  CircleCheck,
  CircleX,
  Flame,
  HelpCircle,
  Info,
  Lightbulb,
  MessageSquareQuote,
  Sparkles,
  Star
} from 'lucide-react'

export const CALLOUT_VARIANTS = ['neutral', 'info', 'success', 'warning', 'danger']

export const CALLOUT_ICONS = {
  Info,
  Lightbulb,
  AlertTriangle,
  CircleCheck,
  CircleX,
  HelpCircle,
  Star,
  Bookmark,
  Bell,
  Flame,
  MessageSquareQuote,
  Sparkles
}

const DEFAULT_ICON = 'Info'

function normalizeVariant(value) {
  return CALLOUT_VARIANTS.includes(value) ? value : 'info'
}

function normalizeIcon(value) {
  return CALLOUT_ICONS[value] ? value : DEFAULT_ICON
}

function replaceCalloutWithContent(view, getPos, node) {
  const position = getPos()
  if (typeof position !== 'number') return
  const content = node.content.size
    ? node.content
    : Fragment.from(view.state.schema.nodes.paragraph.create())
  const transaction = view.state.tr.replaceWith(
    position,
    position + node.nodeSize,
    content
  )
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(position)))
  view.dispatch(transaction)
  view.focus()
}

function CalloutNodeView({ editor, getPos, node, updateAttributes }) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)
  const Icon = CALLOUT_ICONS[normalizeIcon(node.attrs.icon)]
  const labels = editor.extensionManager.extensions.find(
    extension => extension.name === 'callout'
  )?.options.labels || {}

  useEffect(() => {
    if (!isOpen) return undefined
    const close = event => {
      if (!popoverRef.current?.contains(event.target)) setIsOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <NodeViewWrapper
      className="tiptap-callout"
      data-variant={normalizeVariant(node.attrs.variant)}
      data-icon={normalizeIcon(node.attrs.icon)}
    >
      <div className="tiptap-callout-controls" contentEditable={false} ref={popoverRef}>
        <button
          type="button"
          className="tiptap-callout-icon"
          aria-label={labels.customize || 'Personalizar destaque'}
          aria-expanded={isOpen}
          disabled={!editor.isEditable}
          onMouseDown={event => event.preventDefault()}
          onClick={() => setIsOpen(current => !current)}
        >
          <Icon size={17} strokeWidth={1.8} />
        </button>
        {isOpen && editor.isEditable && (
          <div className="tiptap-callout-popover" role="dialog" aria-label={labels.customize || 'Personalizar destaque'}>
            <span className="tiptap-callout-popover-label">{labels.color || 'Cor'}</span>
            <div className="tiptap-callout-variants">
              {CALLOUT_VARIANTS.map(variant => (
                <button
                  key={variant}
                  type="button"
                  className={node.attrs.variant === variant ? 'is-selected' : ''}
                  data-variant={variant}
                  aria-label={labels.variants?.[variant] || variant}
                  aria-pressed={node.attrs.variant === variant}
                  onClick={() => updateAttributes({ variant })}
                />
              ))}
            </div>
            <span className="tiptap-callout-popover-label">{labels.icon || 'Ícone'}</span>
            <div className="tiptap-callout-icons">
              {Object.entries(CALLOUT_ICONS).map(([iconName, CalloutIcon]) => (
                <button
                  key={iconName}
                  type="button"
                  className={node.attrs.icon === iconName ? 'is-selected' : ''}
                  aria-label={labels.icons?.[iconName] || iconName}
                  aria-pressed={node.attrs.icon === iconName}
                  onClick={() => updateAttributes({ icon: iconName })}
                >
                  <CalloutIcon size={15} strokeWidth={1.8} />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="tiptap-callout-convert"
              onClick={() => replaceCalloutWithContent(editor.view, getPos, node)}
            >
              {labels.convert || 'Converter em blocos normais'}
            </button>
          </div>
        )}
      </div>
      <NodeViewContent className="tiptap-callout-content" />
    </NodeViewWrapper>
  )
}

function findCalloutDepth($position, nodeType) {
  for (let depth = $position.depth - 1; depth > 0; depth -= 1) {
    if ($position.node(depth).type === nodeType) return depth
  }
  return -1
}

export const TiptapCallout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addOptions: () => ({
    labels: {}
  }),
  addAttributes: () => ({
    variant: {
      default: 'info',
      parseHTML: element => normalizeVariant(element.getAttribute('data-variant')),
      renderHTML: attributes => ({ 'data-variant': normalizeVariant(attributes.variant) })
    },
    icon: {
      default: DEFAULT_ICON,
      parseHTML: element => normalizeIcon(element.getAttribute('data-icon')),
      renderHTML: attributes => ({ 'data-icon': normalizeIcon(attributes.icon) })
    }
  }),
  parseHTML: () => [{ tag: '[data-tiptap-callout]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-tiptap-callout': '' }),
    0
  ],
  addCommands() {
    return {
      insertCallout: attributes => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: {
          variant: normalizeVariant(attributes?.variant),
          icon: normalizeIcon(attributes?.icon)
        },
        content: [{ type: 'paragraph' }]
      })
    }
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.command(({ state, dispatch }) => {
        const depth = findCalloutDepth(state.selection.$from, this.type)
        if (depth < 0) return false
        const calloutPosition = state.selection.$from.before(depth)
        const callout = state.selection.$from.node(depth)
        if (dispatch) {
          const insertAt = calloutPosition + callout.nodeSize
          const transaction = state.tr.insert(insertAt, state.schema.nodes.paragraph.create())
          transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertAt + 1)))
          dispatch(transaction.scrollIntoView())
        }
        return true
      }),
      Backspace: () => this.editor.commands.command(({ state, dispatch }) => {
        const { $from, empty } = state.selection
        if (!empty || $from.parent.type.name !== 'paragraph' || $from.parentOffset !== 0) return false
        const depth = findCalloutDepth($from, this.type)
        if (depth < 0 || $from.index(depth) !== 0 || $from.parent.content.size > 0) return false
        if (!dispatch) return true
        const calloutPosition = $from.before(depth)
        const callout = $from.node(depth)
        const content = callout.childCount > 1
          ? Fragment.fromArray(callout.content.content.slice(1))
          : Fragment.from(state.schema.nodes.paragraph.create())
        const transaction = state.tr.replaceWith(
          calloutPosition,
          calloutPosition + callout.nodeSize,
          content
        )
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(calloutPosition)))
        dispatch(transaction.scrollIntoView())
        return true
      })
    }
  },
  addNodeView: () => ReactNodeViewRenderer(CalloutNodeView)
})

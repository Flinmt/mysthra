import { useCallback, useEffect, useRef, useState } from 'react'
import { Bold, Check, Highlighter, Italic, Link, Palette, RotateCcw, Strikethrough, Underline, Unlink, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getBlockSelection } from './tiptapBlockSelection'
import { getTextToolbarPosition } from './tiptapTextToolbarPosition'
import { normalizeExternalUrl, setExternalLink } from './tiptapExternalLinks'
import {
  getSelectionTextColor,
  getThemeAccentTextColor,
  normalizeTextColor,
  TEXT_COLOR_PALETTE
} from './tiptapTextColors'
import {
  getSelectionHighlight,
  setSelectionHighlight,
  unsetSelectionHighlight
} from './tiptapHighlights'

const FORMATS = [
  { name: 'bold', icon: Bold, labelKey: 'workspace.tiptap_format_bold', fallback: 'Negrito', shortcut: 'Ctrl+B' },
  { name: 'italic', icon: Italic, labelKey: 'workspace.tiptap_format_italic', fallback: 'Itálico', shortcut: 'Ctrl+I' },
  { name: 'underline', icon: Underline, labelKey: 'workspace.tiptap_format_underline', fallback: 'Sublinhado', shortcut: 'Ctrl+U' },
  { name: 'strike', icon: Strikethrough, labelKey: 'workspace.tiptap_format_strike', fallback: 'Tachado', shortcut: 'Ctrl+Shift+S' }
]

function runFormat(editor, name) {
  const chain = editor.chain().focus()
  const command = `toggle${name[0].toUpperCase()}${name.slice(1)}`
  chain[command]().run()
}

export default function TiptapTextToolbar({ editor }) {
  const { t } = useTranslation()
  const [toolbar, setToolbar] = useState(null)
  const [linkEditor, setLinkEditor] = useState(null)
  const [colorEditor, setColorEditor] = useState(false)
  const [highlightEditor, setHighlightEditor] = useState(false)
  const linkInputRef = useRef(null)

  const refresh = useCallback(() => {
    if (
      !editor || editor.isDestroyed || !editor.isEditable ||
      editor.state.selection.empty || getBlockSelection(editor.state)
    ) {
      setToolbar(null)
      setLinkEditor(null)
      setColorEditor(false)
      setHighlightEditor(false)
      return
    }
    const { from, to } = editor.state.selection
    const position = getTextToolbarPosition(
      editor.view.coordsAtPos(from),
      editor.view.coordsAtPos(to),
      { width: window.innerWidth, height: window.innerHeight }
    )
    const textColor = getSelectionTextColor(editor)
    const highlight = getSelectionHighlight(editor)
    setToolbar({
      ...position,
      active: Object.fromEntries(FORMATS.map(format => [format.name, editor.isActive(format.name)])),
      linkActive: editor.isActive('link'),
      textColor,
      highlight
    })
  }, [editor])

  useEffect(() => {
    if (!editor) return undefined
    refresh()
    editor.on('selectionUpdate', refresh)
    editor.on('transaction', refresh)
    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, true)
    return () => {
      editor.off('selectionUpdate', refresh)
      editor.off('transaction', refresh)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh, true)
    }
  }, [editor, refresh])

  const openLinkEditor = useCallback(() => {
    if (!editor || editor.state.selection.empty) return
    const href = editor.getAttributes('link')?.href || ''
    setColorEditor(false)
    setHighlightEditor(false)
    setLinkEditor({ value: href, error: false })
  }, [editor])

  useEffect(() => {
    if (linkEditor) linkInputRef.current?.focus()
  }, [linkEditor])

  useEffect(() => {
    const handleLinkShortcut = event => {
      if (
        event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey ||
        !editor?.view.dom.contains(event.target) || editor.state.selection.empty
      ) return
      event.preventDefault()
      openLinkEditor()
    }
    document.addEventListener('keydown', handleLinkShortcut)
    return () => document.removeEventListener('keydown', handleLinkShortcut)
  }, [editor, openLinkEditor])

  const applyLink = useCallback(() => {
    if (!linkEditor) return
    if (!normalizeExternalUrl(linkEditor.value)) {
      setLinkEditor(current => ({ ...current, error: true }))
      return
    }
    setExternalLink(editor, linkEditor.value)
    setLinkEditor(null)
  }, [editor, linkEditor])

  const removeLink = useCallback(() => {
    editor.chain().focus().unsetLink().run()
    setLinkEditor(null)
  }, [editor])

  const applyTextColor = useCallback(value => {
    const color = normalizeTextColor(value)
    if (!color) return
    editor.chain().focus().setColor(color).run()
    setColorEditor(false)
  }, [editor])

  const clearTextColor = useCallback(() => {
    editor.chain().focus().unsetColor().run()
    setColorEditor(false)
  }, [editor])

  const applyHighlight = useCallback(value => {
    if (!normalizeTextColor(value)) return
    setSelectionHighlight(editor, value)
    setHighlightEditor(false)
  }, [editor])

  const clearHighlight = useCallback(() => {
    unsetSelectionHighlight(editor)
    setHighlightEditor(false)
  }, [editor])

  if (!toolbar) return null
  return (
    <div
      className="tiptap-text-toolbar"
      data-placement={toolbar.placement}
      role="toolbar"
      aria-label={t('workspace.tiptap_format_toolbar', 'Formatação de texto')}
      style={{ left: toolbar.left, top: toolbar.top }}
    >
      {linkEditor ? (
        <form className="tiptap-text-toolbar-link-editor" onSubmit={event => { event.preventDefault(); applyLink() }}>
          <input
            ref={linkInputRef}
            type="text"
            inputMode="url"
            value={linkEditor.value}
            className={linkEditor.error ? 'is-invalid' : ''}
            aria-label={t('workspace.tiptap_format_url', 'URL do link')}
            placeholder="https://example.com"
            onChange={event => setLinkEditor({ value: event.target.value, error: false })}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setLinkEditor(null)
                editor.commands.focus()
              }
            }}
          />
          <button type="submit" aria-label={t('workspace.tiptap_format_link_apply', 'Aplicar link')} title={t('workspace.tiptap_format_link_apply', 'Aplicar link')}>
            <Check size={15} />
          </button>
          {toolbar.linkActive && (
            <button type="button" onClick={removeLink} aria-label={t('workspace.tiptap_format_link_remove', 'Remover link')} title={t('workspace.tiptap_format_link_remove', 'Remover link')}>
              <Unlink size={15} />
            </button>
          )}
          <button type="button" onClick={() => setLinkEditor(null)} aria-label={t('common.cancel', 'Cancelar')} title={t('common.cancel', 'Cancelar')}>
            <X size={15} />
          </button>
        </form>
      ) : colorEditor ? (
        <div className="tiptap-text-color-editor" role="group" aria-label={t('workspace.tiptap_format_color_palette', 'Cores do texto')}>
          <button type="button" className="tiptap-text-color-reset" onClick={clearTextColor} aria-label={t('workspace.tiptap_format_color_default', 'Cor padrão')} title={t('workspace.tiptap_format_color_default', 'Cor padrão')}>
            <RotateCcw size={14} />
          </button>
          {[getThemeAccentTextColor(editor.view.dom), ...TEXT_COLOR_PALETTE]
            .filter((color, index, colors) => color && colors.indexOf(color) === index)
            .map((color, index) => (
              <button
                key={color}
                type="button"
                className={toolbar.textColor.color === color && !toolbar.textColor.mixed ? 'is-active tiptap-text-color-swatch' : 'tiptap-text-color-swatch'}
                style={{ '--text-swatch-color': color }}
                aria-label={index === 0 ? t('workspace.tiptap_format_color_theme', 'Cor do tema') : color}
                aria-pressed={toolbar.textColor.color === color && !toolbar.textColor.mixed}
                onClick={() => applyTextColor(color)}
              ><span /></button>
            ))}
          <label className="tiptap-text-color-custom" title={t('workspace.tiptap_format_color_custom', 'Cor personalizada')}>
            <Palette size={14} />
            <input
              type="color"
              value={toolbar.textColor.color || '#ffffff'}
              aria-label={t('workspace.tiptap_format_color_custom', 'Cor personalizada')}
              onChange={event => applyTextColor(event.target.value)}
            />
          </label>
          <button type="button" onClick={() => setColorEditor(false)} aria-label={t('common.close', 'Fechar')} title={t('common.close', 'Fechar')}>
            <X size={14} />
          </button>
        </div>
      ) : highlightEditor ? (
        <div className="tiptap-text-color-editor" role="group" aria-label={t('workspace.tiptap_format_highlight_palette', 'Cores do marca-texto')}>
          <button type="button" className="tiptap-text-color-reset" onClick={clearHighlight} aria-label={t('workspace.tiptap_format_highlight_remove', 'Remover destaque')} title={t('workspace.tiptap_format_highlight_remove', 'Remover destaque')}>
            <RotateCcw size={14} />
          </button>
          {[getThemeAccentTextColor(editor.view.dom), ...TEXT_COLOR_PALETTE]
            .filter((color, index, colors) => color && colors.indexOf(color) === index)
            .map((color, index) => (
              <button
                key={color}
                type="button"
                className={toolbar.highlight.color === color && !toolbar.highlight.mixed ? 'is-active tiptap-text-color-swatch is-highlight' : 'tiptap-text-color-swatch is-highlight'}
                style={{ '--text-swatch-color': color }}
                aria-label={index === 0 ? t('workspace.tiptap_format_color_theme', 'Cor do tema') : color}
                aria-pressed={toolbar.highlight.color === color && !toolbar.highlight.mixed}
                onClick={() => applyHighlight(color)}
              ><span /></button>
            ))}
          <label className="tiptap-text-color-custom" title={t('workspace.tiptap_format_color_custom', 'Cor personalizada')}>
            <Highlighter size={14} />
            <input
              type="color"
              value={toolbar.highlight.color || '#ffffff'}
              aria-label={t('workspace.tiptap_format_highlight_custom', 'Destaque personalizado')}
              onChange={event => applyHighlight(event.target.value)}
            />
          </label>
          <button type="button" onClick={() => setHighlightEditor(false)} aria-label={t('common.close', 'Fechar')} title={t('common.close', 'Fechar')}>
            <X size={14} />
          </button>
        </div>
      ) : FORMATS.map(format => {
        const Icon = format.icon
        const label = t(format.labelKey, format.fallback)
        return (
          <button
            key={format.name}
            type="button"
            className={toolbar.active[format.name] ? 'is-active' : ''}
            aria-label={`${label} (${format.shortcut})`}
            aria-pressed={toolbar.active[format.name]}
            title={`${label} (${format.shortcut})`}
            onMouseDown={event => event.preventDefault()}
            onClick={() => runFormat(editor, format.name)}
          >
            <Icon size={15} />
          </button>
        )
      }).concat([
        <button
          key="link"
          type="button"
          className={toolbar.linkActive ? 'is-active' : ''}
          aria-label={`${t('workspace.tiptap_format_link', 'Link')} (Ctrl+K)`}
          aria-pressed={toolbar.linkActive}
          title={`${t('workspace.tiptap_format_link', 'Link')} (Ctrl+K)`}
          onMouseDown={event => event.preventDefault()}
          onClick={openLinkEditor}
        >
          <Link size={15} />
        </button>,
        <button
          key="color"
          type="button"
          className={toolbar.textColor.color || toolbar.textColor.mixed ? 'is-active tiptap-text-color-button' : 'tiptap-text-color-button'}
          aria-label={t('workspace.tiptap_format_color', 'Cor do texto')}
          title={t('workspace.tiptap_format_color', 'Cor do texto')}
          onMouseDown={event => event.preventDefault()}
          onClick={() => { setLinkEditor(null); setHighlightEditor(false); setColorEditor(true) }}
        >
          <Palette size={15} />
          <span
            className={toolbar.textColor.mixed ? 'is-mixed' : ''}
            style={toolbar.textColor.color ? { '--text-active-color': toolbar.textColor.color } : undefined}
          />
        </button>,
        <button
          key="highlight"
          type="button"
          className={toolbar.highlight.color || toolbar.highlight.mixed ? 'is-active tiptap-text-color-button' : 'tiptap-text-color-button'}
          aria-label={t('workspace.tiptap_format_highlight', 'Marca-texto')}
          title={t('workspace.tiptap_format_highlight', 'Marca-texto')}
          onMouseDown={event => event.preventDefault()}
          onClick={() => { setLinkEditor(null); setColorEditor(false); setHighlightEditor(true) }}
        >
          <Highlighter size={15} />
          <span
            className={toolbar.highlight.mixed ? 'is-mixed' : ''}
            style={toolbar.highlight.color ? { '--text-active-color': toolbar.highlight.color } : undefined}
          />
        </button>
      ])}
    </div>
  )
}

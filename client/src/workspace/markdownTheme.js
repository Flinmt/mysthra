import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--workspace-editor-text)', fontWeight: '760' },
  { tag: tags.strong, color: 'var(--workspace-editor-text)', fontWeight: '760' },
  { tag: tags.emphasis, color: 'var(--accent-hover)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--accent-hover)' },
  { tag: tags.atom, color: 'var(--arcane-hover)' },
  { tag: tags.bool, color: 'var(--arcane-hover)' },
  { tag: tags.number, color: '#fbbf24' },
  { tag: tags.string, color: '#86efac' },
  { tag: tags.regexp, color: '#f0abfc' },
  { tag: tags.variableName, color: 'var(--workspace-editor-text)' },
  { tag: tags.definition(tags.variableName), color: 'var(--arcane-hover)' },
  { tag: tags.function(tags.variableName), color: 'var(--arcane-hover)' },
  { tag: tags.propertyName, color: 'color-mix(in srgb, var(--accent-color) 58%, var(--text-primary))' },
  { tag: tags.typeName, color: '#fde68a' },
  { tag: tags.className, color: '#fde68a' },
  { tag: tags.comment, color: 'color-mix(in srgb, var(--workspace-editor-muted) 72%, transparent)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--accent-hover)' },
  { tag: tags.link, color: 'var(--arcane-hover)', textDecoration: 'underline' },
  { tag: tags.quote, color: 'var(--workspace-editor-muted)', fontStyle: 'italic' },
  { tag: tags.invalid, color: '#fca5a5' }
])

export const codeMirrorTheme = EditorView.theme({
  '&': {
    color: 'var(--workspace-editor-text)',
    backgroundColor: 'transparent',
    fontSize: '0.95rem'
  },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
    lineHeight: '1.65',
    overflow: 'visible'
  },
  '.cm-content': {
    padding: '0',
    caretColor: 'var(--accent-color)',
    minHeight: '420px'
  },
  '.cm-line': { padding: '0' },
  '.cm-focused, &.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--accent-color)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent-color) 26%, transparent)'
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-gutters': { display: 'none' },
  '.cm-placeholder': { color: 'color-mix(in srgb, var(--workspace-editor-muted) 54%, transparent)' }
}, { dark: true })

export const MARKDOWN_PREVIEW_STYLES = `
  :host { display: block; color: var(--workspace-editor-text); background: transparent; }
  * { box-sizing: border-box; }
  .markdown-html-preview-body {
    margin: 0;
    padding: 0;
    color: var(--workspace-editor-text);
    background: transparent;
    font: 16px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  h1, h2, h3, h4, h5, h6 { color: var(--workspace-editor-text); line-height: 1.15; margin: 1.35em 0 0.55em; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  h1 { font-size: 2.2rem; }
  h2 { font-size: 1.65rem; border-bottom: 1px solid color-mix(in srgb, var(--workspace-editor-muted) 20%, transparent); padding-bottom: 0.35em; }
  h3 { font-size: 1.28rem; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
  a { color: var(--arcane-hover); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { padding: 0.15em 0.35em; border-radius: 6px; background: color-mix(in srgb, var(--theme-custom-surface) 72%, transparent); color: var(--accent-hover); }
  pre { overflow: auto; padding: 14px; border: 1px solid var(--workspace-theme-accent-border); border-radius: 8px; background: color-mix(in srgb, var(--bg-color) 76%, black); }
  pre code { padding: 0; background: transparent; }
  blockquote { padding-left: 1em; border-left: 3px solid var(--accent-color); color: var(--workspace-editor-muted); }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  audio { width: min(100%, 520px); display: block; margin: 0 0 1em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; border: 1px solid var(--workspace-theme-accent-border); }
  th { background: var(--workspace-theme-accent-soft); text-align: left; }
`

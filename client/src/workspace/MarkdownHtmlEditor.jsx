import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import { LanguageDescription, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'
import MarkdownIt from 'markdown-it'
import { useCollaborationRoom } from '../useCollaborationRoom'
import { prepareAssetUpload } from './utils'

const MARKDOWN_TEXT_NAME = 'markdown'
const ASSET_REFERENCE_PATTERN = /\{\{asset:([^}]+)\}\}/g

const codeLanguages = [
  LanguageDescription.of({ name: 'JavaScript', alias: ['js', 'jsx', 'mjs', 'cjs'], support: javascript({ jsx: true }) }),
  LanguageDescription.of({ name: 'TypeScript', alias: ['ts', 'tsx'], support: javascript({ jsx: true, typescript: true }) }),
  LanguageDescription.of({ name: 'HTML', alias: ['html', 'xml', 'svg'], support: html() }),
  LanguageDescription.of({ name: 'CSS', alias: ['css', 'scss', 'sass', 'less'], support: css() }),
  LanguageDescription.of({ name: 'JSON', alias: ['json'], support: json() })
]

const markdownExtensions = [
  markdownLanguage({
    codeLanguages
  })
]

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#f8fafc', fontWeight: '760' },
  { tag: tags.strong, color: '#f8fafc', fontWeight: '760' },
  { tag: tags.emphasis, color: '#ddd6fe', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#c4b5fd' },
  { tag: tags.atom, color: '#93c5fd' },
  { tag: tags.bool, color: '#93c5fd' },
  { tag: tags.number, color: '#fbbf24' },
  { tag: tags.string, color: '#86efac' },
  { tag: tags.regexp, color: '#f0abfc' },
  { tag: tags.variableName, color: '#e2e8f0' },
  { tag: tags.definition(tags.variableName), color: '#bae6fd' },
  { tag: tags.function(tags.variableName), color: '#bae6fd' },
  { tag: tags.propertyName, color: '#f9a8d4' },
  { tag: tags.typeName, color: '#fde68a' },
  { tag: tags.className, color: '#fde68a' },
  { tag: tags.comment, color: 'rgba(148, 163, 184, 0.72)', fontStyle: 'italic' },
  { tag: tags.meta, color: '#a78bfa' },
  { tag: tags.link, color: '#93c5fd', textDecoration: 'underline' },
  { tag: tags.quote, color: '#cbd5e1', fontStyle: 'italic' },
  { tag: tags.invalid, color: '#fca5a5' }
])

const codeMirrorTheme = EditorView.theme({
  '&': {
    color: 'rgba(248, 250, 252, 0.94)',
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
    caretColor: '#c4b5fd',
    minHeight: '420px'
  },
  '.cm-line': {
    padding: '0'
  },
  '.cm-focused': {
    outline: 'none'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-cursor': {
    borderLeftColor: '#c4b5fd'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(139, 92, 246, 0.26)'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent'
  },
  '.cm-gutters': {
    display: 'none'
  },
  '.cm-placeholder': {
    color: 'rgba(148, 163, 184, 0.54)'
  }
}, { dark: true })

const editorExtensions = [
  ...markdownExtensions,
  syntaxHighlighting(markdownHighlightStyle),
  codeMirrorTheme,
  EditorView.lineWrapping
]

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

function sanitizePreviewHtml(html = '') {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
}

function isSafeAssetPath(assetPath = '') {
  const normalized = String(assetPath).trim().replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || normalized.includes('://')) return false
  return normalized.split('/').every(segment => segment && segment !== '.' && segment !== '..')
}

function resolveAssetReferences(source = '', getAssetUrl) {
  if (typeof getAssetUrl !== 'function') return source
  return source.replace(ASSET_REFERENCE_PATTERN, (_match, rawPath) => {
    const assetPath = String(rawPath || '').trim()
    if (!isSafeAssetPath(assetPath)) return '#'
    return getAssetUrl(assetPath)
  })
}

function getPreviewMarkup(body = '') {
  return `<style>
    :host { display: block; background: transparent; }
    * { box-sizing: border-box; }
    .markdown-html-preview-body {
      margin: 0;
      padding: 0;
      color: rgba(248, 250, 252, 0.94);
      background: transparent;
      font: 16px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    h1, h2, h3, h4, h5, h6 { color: white; line-height: 1.15; margin: 1.35em 0 0.55em; }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    h1 { font-size: 2.2rem; }
    h2 { font-size: 1.65rem; border-bottom: 1px solid rgba(148, 163, 184, 0.2); padding-bottom: 0.35em; }
    h3 { font-size: 1.28rem; }
    p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
    a { color: #c4b5fd; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { padding: 0.15em 0.35em; border-radius: 6px; background: rgba(15, 23, 42, 0.72); color: #ddd6fe; }
    pre { overflow: auto; padding: 14px; border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 12px; background: rgba(2, 6, 23, 0.76); }
    pre code { padding: 0; background: transparent; }
    blockquote { padding-left: 1em; border-left: 3px solid rgba(167, 139, 250, 0.58); color: rgba(203, 213, 225, 0.9); }
    img { max-width: 100%; height: auto; border-radius: 12px; }
    audio { width: min(100%, 520px); display: block; margin: 0 0 1em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid rgba(148, 163, 184, 0.18); }
    th { background: rgba(148, 163, 184, 0.08); text-align: left; }
  </style>
  <div class="markdown-html-preview-body">${sanitizePreviewHtml(body)}</div>`
}

function MarkdownPreview({ html }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' })
    root.innerHTML = getPreviewMarkup(html)
  }, [html])

  return <div className="markdown-html-preview" ref={hostRef} />
}

function getAssetReference(assetPath = '') {
  return `{{asset:${String(assetPath).trim().replace(/\\/g, '/')}}}`
}

function escapeAttribute(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getAssetMarkup(asset) {
  const reference = getAssetReference(asset.path)
  const name = asset.name || asset.path
  if (asset.mediaType === 'audio') {
    return `<audio controls src="${escapeAttribute(reference)}"></audio>`
  }
  return `<img src="${escapeAttribute(reference)}" alt="${escapeAttribute(name)}">`
}

export default function MarkdownHtmlEditor({
  content,
  editable,
  locked,
  worldId,
  mode = 'preview',
  collaborationRoom,
  currentUser,
  isVisitor = false,
  assetImages = [],
  assetAudios = [],
  getAssetUrl,
  onRequestAssets,
  labels,
  onCollaborationSaveState
}) {
  const editorViewRef = useRef(null)
  const yTextRef = useRef(null)
  const [assetContextMenu, setAssetContextMenu] = useState({ isOpen: false, x: 0, y: 0 })
  const [source, setSource] = useState(content || '')
  const collaborationRoomState = useCollaborationRoom({
    roomName: collaborationRoom,
    currentUser,
    isVisitor,
    locked
  })
  const {
    doc: collaborationDoc,
    provider: collaborationProvider,
    readOnly: collaborationReadOnly,
    saveStatus: collaborationSaveStatus,
    dirty: collaborationDirty,
    synced: collaborationSynced
  } = collaborationRoomState
  const readOnly = Boolean(!editable || isVisitor || locked || collaborationReadOnly)
  const effectiveMode = readOnly ? 'preview' : mode
  const previewHtml = useMemo(() => markdown.render(resolveAssetReferences(source || '', getAssetUrl)), [getAssetUrl, source])

  useEffect(() => {
    onCollaborationSaveState?.({
      status: collaborationSaveStatus,
      dirty: collaborationDirty
    })
  }, [collaborationDirty, collaborationSaveStatus, onCollaborationSaveState])

  useEffect(() => {
    if (!collaborationDoc || !collaborationProvider) {
      setSource(content || '')
      return undefined
    }

    const yText = collaborationDoc.getText(MARKDOWN_TEXT_NAME)
    yTextRef.current = yText
    const updateSource = () => {
      const nextSource = yText.toString()
      setSource(nextSource || (readOnly ? content || '' : ''))
    }
    yText.observe(updateSource)
    updateSource()

    return () => {
      yText.unobserve(updateSource)
      if (yTextRef.current === yText) yTextRef.current = null
    }
  }, [collaborationDoc, collaborationProvider, content, readOnly])

  useEffect(() => {
    const yText = yTextRef.current
    if (!yText || readOnly || !collaborationSynced || yText.length > 0 || !content) return
    yText.insert(0, content)
  }, [collaborationSynced, content, readOnly])

  const updateText = useCallback((nextSource) => {
    setSource(nextSource)
    const yText = yTextRef.current
    if (!yText || readOnly) return
    yText.doc?.transact(() => {
      yText.delete(0, yText.length)
      if (nextSource) yText.insert(0, nextSource)
    })
  }, [readOnly])

  const insertMarkup = useCallback((markup) => {
    if (readOnly || !markup) return
    const view = editorViewRef.current
    if (!view) {
      updateText(`${source}${source ? '\n\n' : ''}${markup}`)
      return
    }
    const selection = view.state.selection.main
    const prefix = selection.from > 0 && !source.slice(0, selection.from).endsWith('\n') ? '\n\n' : ''
    const suffix = source.slice(selection.to).startsWith('\n') ? '' : '\n\n'
    const text = `${prefix}${markup}${suffix}`
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: text },
      selection: { anchor: selection.from + text.length }
    })
    view.focus()
  }, [readOnly, source, updateText])

  const insertAsset = useCallback((asset) => {
    if (!asset?.path) return
    insertMarkup(getAssetMarkup(asset))
  }, [insertMarkup])

  const uploadAndInsertAsset = useCallback(async (file) => {
    if (readOnly || !file) return
    const prepared = await prepareAssetUpload(file)
    const query = new URLSearchParams({
      path: '',
      filename: prepared.filename
    })
    const res = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/assets/upload?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': prepared.contentType },
      body: prepared.blob
    })
    if (!res.ok) throw new Error('Failed to upload asset')
    const uploaded = await res.json()
    await onRequestAssets?.()
    const mediaType = prepared.contentType.startsWith('audio/') ? 'audio' : 'image'
    insertAsset({ ...uploaded, mediaType })
  }, [insertAsset, onRequestAssets, readOnly, worldId])

  useEffect(() => {
    if (!assetContextMenu.isOpen) return undefined
    const close = () => setAssetContextMenu(prev => ({ ...prev, isOpen: false }))
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [assetContextMenu.isOpen])

  return (
    <div
      className={`markdown-html-editor ${effectiveMode === 'edit' ? 'is-editing' : 'is-previewing'}`}
      onContextMenu={async (event) => {
        if (readOnly || effectiveMode !== 'edit') return
        event.preventDefault()
        await onRequestAssets?.()
        setAssetContextMenu({ isOpen: true, x: event.clientX, y: event.clientY })
      }}
      onDragOver={(event) => {
        if (readOnly || effectiveMode !== 'edit') return
        const hasAsset = event.dataTransfer.types.includes('application/x-mythra-asset') || event.dataTransfer.types.includes('application/x-mythra-asset-image')
        const hasUpload = Array.from(event.dataTransfer.items || []).some(item => item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('audio/')))
        if (hasAsset || hasUpload) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={async (event) => {
        if (readOnly || effectiveMode !== 'edit') return
        const assetPayload = event.dataTransfer.getData('application/x-mythra-asset') || event.dataTransfer.getData('application/x-mythra-asset-image')
        if (assetPayload) {
          event.preventDefault()
          try {
            insertAsset(JSON.parse(assetPayload))
          } catch {
            // Ignore invalid drag payloads from outside the app.
          }
          return
        }

        const files = Array.from(event.dataTransfer.files || []).filter(file => file.type.startsWith('image/') || file.type.startsWith('audio/'))
        if (files.length === 0) return
        event.preventDefault()
        for (const file of files) {
          await uploadAndInsertAsset(file).catch(() => {})
        }
      }}
    >
      {effectiveMode === 'edit' && assetContextMenu.isOpen && (
        <div
          className="context-menu glass-panel markdown-asset-context-menu"
          style={{ top: assetContextMenu.y, left: assetContextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="context-menu-section-label">{labels?.insertImage}</div>
          {assetImages.length === 0 ? (
            <span className="context-menu-empty">{labels?.noAssetImages}</span>
          ) : assetImages.map(asset => (
            <button
              key={asset.path}
              type="button"
              onClick={() => {
                insertAsset(asset)
                setAssetContextMenu(prev => ({ ...prev, isOpen: false }))
              }}
            >
              <img className="context-menu-thumb" src={getAssetUrl?.(asset.path)} alt="" />
              <span>{asset.name}</span>
            </button>
          ))}
          <div className="context-menu-section-label">{labels?.insertAudio}</div>
          {assetAudios.length === 0 ? (
            <span className="context-menu-empty">{labels?.noAssetAudios}</span>
          ) : assetAudios.map(asset => (
            <button
              key={asset.path}
              type="button"
              onClick={() => {
                insertAsset(asset)
                setAssetContextMenu(prev => ({ ...prev, isOpen: false }))
              }}
            >
              <span className="context-menu-media-icon">Audio</span>
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
      )}
      {effectiveMode === 'edit' ? (
        <CodeMirror
          className="markdown-html-source"
          value={source}
          height="auto"
          minHeight="420px"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            searchKeymap: true
          }}
          extensions={editorExtensions}
          onChange={updateText}
          onCreateEditor={(view) => {
            editorViewRef.current = view
          }}
          placeholder={labels?.sourcePlaceholder}
          aria-label={labels?.sourceLabel}
        />
      ) : (
        <MarkdownPreview html={previewHtml} />
      )}
    </div>
  )
}

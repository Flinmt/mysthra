import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import MarkdownIt from 'markdown-it'
import { useCollaborationRoom } from '../useCollaborationRoom'

const MARKDOWN_TEXT_NAME = 'markdown'

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

export default function MarkdownHtmlEditor({
  content,
  editable,
  locked,
  mode = 'preview',
  collaborationRoom,
  currentUser,
  isVisitor = false,
  labels,
  onCollaborationSaveState
}) {
  const textareaRef = useRef(null)
  const yTextRef = useRef(null)
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
  const previewHtml = useMemo(() => markdown.render(source || ''), [source])

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

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || effectiveMode !== 'edit') return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(420, textarea.scrollHeight)}px`
  }, [effectiveMode, source])

  return (
    <div className={`markdown-html-editor ${effectiveMode === 'edit' ? 'is-editing' : 'is-previewing'}`}>
      {effectiveMode === 'edit' ? (
        <textarea
          ref={textareaRef}
          className="markdown-html-source"
          value={source}
          onChange={event => updateText(event.target.value)}
          spellCheck="false"
          placeholder={labels?.sourcePlaceholder}
          aria-label={labels?.sourceLabel}
        />
      ) : (
        <MarkdownPreview html={previewHtml} />
      )}
    </div>
  )
}

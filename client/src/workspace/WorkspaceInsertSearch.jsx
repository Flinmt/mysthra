import { useMemo, useRef, useState } from 'react'
import { createInternalPageLink, getTabsForNode, pathParent } from './utils'

function getDocumentPathLabel(node, pathByUid) {
  const names = []
  let current = node
  while (current) {
    names.unshift(current.name)
    const parentPath = pathParent(current.path)
    current = parentPath ? pathByUid.get(parentPath) : null
  }
  return names.join(' > ')
}

function getTabTypeLabel(contentType, labels = {}) {
  if (contentType === 'tiptap') return labels.tabTypeTiptap || 'Tiptap'
  if (contentType === 'markdown') return labels.tabTypeMarkdown || 'Markdown/HTML'
  if (contentType === 'map') return labels.tabTypeMap || 'Map'
  if (contentType === 'board') return labels.tabTypeBoard || 'Board'
  return labels.tabTypeNotion || 'Notion'
}

function buildTabResults(documentTree = [], labels = {}) {
  const documentsByPath = new Map()
  const tabs = []
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (node.type === 'container') documentsByPath.set(node.path, node)
      walk(node.children || [])
    }
  }
  walk(documentTree)

  for (const document of documentsByPath.values()) {
    const pathLabel = getDocumentPathLabel(document, documentsByPath)
    for (const tab of getTabsForNode(document)) {
      const tabType = getTabTypeLabel(tab.contentType, labels)
      tabs.push({
        id: `tab:${tab.uid}`,
        kind: 'tab',
        title: document.name,
        subtitle: `${labels.resultTypeTab || 'Tab'} · ${tab.name} · ${tabType}`,
        context: pathLabel,
        searchText: `${tab.name} ${tabType} ${document.name} ${pathLabel}`.toLowerCase(),
        document,
        tab,
        href: createInternalPageLink({ documentUid: document.uid, tabUid: tab.uid })
      })
    }
  }
  return tabs
}

function buildAssetResults(assetTree = [], supportedAssets = ['image', 'audio'], labels = {}) {
  const allowed = new Set(supportedAssets)
  const results = []
  const walk = (nodes, folderPath = '') => {
    for (const node of nodes || []) {
      if (node.type === 'folder') {
        walk(node.children || [], node.path || folderPath)
        continue
      }
      if (!allowed.has(node.mediaType)) continue
      const label = node.mediaType === 'audio'
        ? labels.resultTypeAudio || 'Audio'
        : labels.resultTypeImage || 'Image'
      results.push({
        id: `asset:${node.path}`,
        kind: 'asset',
        assetKind: node.mediaType,
        title: node.name || node.path,
        subtitle: label,
        context: folderPath || pathParent(node.path),
        searchText: `${node.name || ''} ${node.path || ''} ${label}`.toLowerCase(),
        asset: node
      })
    }
  }
  walk(assetTree)
  return results
}

function SearchPreview({ item, labels = {}, getAssetUrl }) {
  if (!item) return null
  if (item.kind === 'asset' && item.assetKind === 'image') {
    return (
      <div className="workspace-insert-preview">
        <img src={getAssetUrl?.(item.asset.path)} alt="" />
        <strong>{item.title}</strong>
        <span>{item.context}</span>
      </div>
    )
  }
  return (
    <div className="workspace-insert-preview">
      <strong>{item.title}</strong>
      <span>{item.subtitle}</span>
      <small>{item.context || labels.previewPath}</small>
    </div>
  )
}

export default function WorkspaceInsertSearch({
  documentTree = [],
  assetTree = [],
  mode = 'all',
  supportedAssets = ['image', 'audio'],
  selectedText = '',
  position,
  getAssetUrl,
  onInsertPageLink,
  onInsertAsset,
  onClose,
  labels = {}
}) {
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [hoveredId, setHoveredId] = useState('')
  const allItems = useMemo(() => {
    const tabResults = mode === 'asset' ? [] : buildTabResults(documentTree, labels)
    const assetResults = mode === 'page-link' ? [] : buildAssetResults(assetTree, supportedAssets, labels)
    return [...tabResults, ...assetResults]
  }, [assetTree, documentTree, labels, mode, supportedAssets])
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return allItems.filter(item => item.searchText.includes(normalized)).slice(0, 12)
  }, [allItems, query])
  const hoveredItem = results.find(item => item.id === hoveredId) || results[0] || null
  const hasQuery = query.trim().length > 0
  const style = position
    ? { top: position.y, left: position.x }
    : undefined

  const selectItem = (item) => {
    if (item.kind === 'tab') {
      onInsertPageLink?.({ href: item.href, label: selectedText || item.title, document: item.document, tab: item.tab })
    } else {
      onInsertAsset?.(item.asset)
    }
    onClose?.()
  }

  return (
    <div className="workspace-insert-search-backdrop" onMouseDown={onClose}>
      <div
        className={`workspace-insert-search glass-panel${position ? ' is-positioned' : ''}`}
        style={style}
        onMouseDown={event => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape') onClose?.()
            if (event.key === 'Enter' && results[0]) selectItem(results[0])
          }}
          placeholder={labels.searchTabsAssetsPlaceholder || 'Search tabs or assets...'}
          autoFocus
        />

        {hasQuery && (
          <div className="workspace-insert-results-shell">
            <div className="workspace-insert-results">
              {results.length === 0 ? (
                <div className="workspace-insert-empty">{labels.noSearchResults || 'No results found'}</div>
              ) : results.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="workspace-insert-result"
                  onMouseEnter={() => setHoveredId(item.id)}
                  onClick={() => selectItem(item)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                  <small>{item.context}</small>
                </button>
              ))}
            </div>
            {results.length > 0 && <SearchPreview item={hoveredItem} labels={labels} getAssetUrl={getAssetUrl} />}
          </div>
        )}
      </div>
    </div>
  )
}

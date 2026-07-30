import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FileText, Image, Music2, Search } from 'lucide-react'
import { createInternalPageLink, getTabsForNode, pathParent } from './utils'

function normalizeSearchValue(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function getDocumentPathLabel(node, documentsByPath) {
  const names = []
  let current = node
  while (current) {
    names.unshift(current.name)
    const parentPath = pathParent(current.path)
    current = parentPath ? documentsByPath.get(parentPath) : null
  }
  return names.join(' > ')
}

function getTabTypeLabel(contentType, labels = {}) {
  if (contentType === 'wiki' || contentType === 'tiptap') return labels.tabTypeNotion || 'Notion'
  if (contentType === 'markdown') return labels.tabTypeMarkdown || 'Markdown/HTML'
  if (contentType === 'map') return labels.tabTypeMap || 'Map'
  if (contentType === 'board') return labels.tabTypeBoard || 'Board'
  if (contentType === 'sheet') return labels.tabTypeSheet || 'Character sheet'
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
        title: tab.name,
        subtitle: `${labels.resultTypeTab || 'Tab'} · ${tabType}`,
        context: pathLabel,
        searchTitle: normalizeSearchValue(tab.name),
        searchText: normalizeSearchValue(`${tab.name} ${tabType} ${document.name} ${pathLabel}`),
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
        searchTitle: normalizeSearchValue(node.name || node.path),
        searchText: normalizeSearchValue(`${node.name || ''} ${node.path || ''} ${label}`),
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
  const activeResultRef = useRef(null)
  const resultsId = useId()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const allItems = useMemo(() => {
    const tabResults = mode === 'asset' ? [] : buildTabResults(documentTree, labels)
    const assetResults = mode === 'page-link' ? [] : buildAssetResults(assetTree, supportedAssets, labels)
    return [...tabResults, ...assetResults]
  }, [assetTree, documentTree, labels, mode, supportedAssets])
  const results = useMemo(() => {
    const normalized = normalizeSearchValue(query.trim())
    if (!normalized) return []
    return allItems
      .filter(item => item.searchText.includes(normalized))
      .sort((left, right) => {
        const score = item => (
          item.searchTitle === normalized
            ? 0
            : item.searchTitle.startsWith(normalized)
              ? 1
              : item.searchTitle.includes(normalized) ? 2 : 3
        )
        return score(left) - score(right)
          || left.title.localeCompare(right.title)
          || left.context.localeCompare(right.context)
      })
      .slice(0, 12)
  }, [allItems, query])
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])
  const selectedItem = results[selectedIndex] || results[0] || null
  useEffect(() => {
    activeResultRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex])
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
        className={`workspace-insert-search glass-panel is-${mode}${position ? ' is-positioned' : ''}`}
        style={style}
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
        aria-label={labels.insertPageLink || labels.searchTabsAssetsPlaceholder || 'Search'}
      >
        <div className="workspace-insert-search-field">
          <Search size={13} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onClose?.()
                return
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (results.length === 0) return
                const delta = event.key === 'ArrowDown' ? 1 : -1
                setSelectedIndex(current => (current + delta + results.length) % results.length)
                return
              }
              if (event.key === 'Enter' && selectedItem) {
                event.preventDefault()
                selectItem(selectedItem)
              }
            }}
            placeholder={labels.searchTabsAssetsPlaceholder || 'Search tabs or assets...'}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={hasQuery}
            aria-controls={resultsId}
            aria-activedescendant={selectedItem ? `${resultsId}-${selectedItem.id}` : undefined}
            autoFocus
          />
          {mode === 'page-link' && <kbd>Esc</kbd>}
        </div>

        {!hasQuery && mode === 'page-link' ? (
          <div className="workspace-insert-empty">{labels.searchHint || 'Type to search'}</div>
        ) : hasQuery ? (
          <div className="workspace-insert-results-shell">
            <div className="workspace-insert-results" id={resultsId} role="listbox">
              {results.length === 0 ? (
                <div className="workspace-insert-empty">{labels.noSearchResults || 'No results found'}</div>
              ) : results.map((item, index) => (
                <button
                  key={item.id}
                  id={`${resultsId}-${item.id}`}
                  ref={index === selectedIndex ? activeResultRef : null}
                  type="button"
                  className={`workspace-insert-result${index === selectedIndex ? ' is-selected' : ''}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => selectItem(item)}
                >
                  <span className="workspace-insert-result-icon" aria-hidden="true">
                    {item.kind === 'tab'
                      ? <FileText />
                      : item.assetKind === 'audio' ? <Music2 /> : <Image />}
                  </span>
                  <span className="workspace-insert-result-copy">
                    <span className="workspace-insert-result-line">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </span>
                    <small>{item.context}</small>
                  </span>
                </button>
              ))}
            </div>
            {results.length > 0 && mode !== 'page-link' && <SearchPreview item={selectedItem} labels={labels} getAssetUrl={getAssetUrl} />}
          </div>
        ) : null}
      </div>
    </div>
  )
}

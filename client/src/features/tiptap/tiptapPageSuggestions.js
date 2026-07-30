import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { createInternalPageLink, pathParent } from '../../workspace/utils'

export const pageSuggestionPluginKey = new PluginKey('tiptapPageSuggestions')
const PAGE_SUGGESTION_CONTENT_TYPES = new Set(['wiki', 'tiptap', 'markdown', 'map', 'board', 'sheet'])

function normalizePageText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function normalizePageTitle(value = '') {
  return normalizePageText(value).trim()
}

function getDocumentPathLabel(document, documentsByPath) {
  const names = []
  let current = document
  while (current) {
    names.unshift(current.name)
    const parentPath = pathParent(current.path)
    current = parentPath ? documentsByPath.get(parentPath) : null
  }
  return names.join(' > ')
}

export function buildPageSuggestionTargets(documentTree = [], currentTabUid = '') {
  const documentsByPath = new Map()
  const documentOrder = new Map()
  const documents = []
  let currentDocumentUid = ''

  const walk = nodes => {
    for (const node of nodes || []) {
      if (node.type === 'container') {
        documentsByPath.set(node.path, node)
        documentOrder.set(node.uid, documents.length)
        documents.push(node)
      }
      walk(node.children || [])
    }
  }
  walk(documentTree)

  for (const document of documents) {
    if ((document.children || []).some(child => child.type === 'tab' && child.uid === currentTabUid)) {
      currentDocumentUid = document.uid
      break
    }
  }

  const targets = []
  for (const document of documents) {
    const documentPath = getDocumentPathLabel(document, documentsByPath)
    for (const [tabOrder, tab] of (document.children || []).entries()) {
      if (
        tab.type !== 'tab' ||
        tab.uid === currentTabUid ||
        !PAGE_SUGGESTION_CONTENT_TYPES.has(tab.contentType || 'wiki')
      ) {
        continue
      }
      const normalizedTitle = normalizePageTitle(tab.name)
      if ([...normalizedTitle].length < 4) continue
      targets.push({
        key: normalizedTitle,
        title: tab.name,
        tabUid: tab.uid,
        documentUid: document.uid,
        documentPath,
        contentType: tab.contentType || 'wiki',
        href: createInternalPageLink({ documentUid: document.uid, tabUid: tab.uid }),
        isCurrentDocument: document.uid === currentDocumentUid,
        treeOrder: documentOrder.get(document.uid),
        tabOrder
      })
    }
  }

  return targets.sort((left, right) =>
    Number(right.isCurrentDocument) - Number(left.isCurrentDocument)
    || left.treeOrder - right.treeOrder
    || left.tabOrder - right.tabOrder
  )
}

function isWordCharacter(value = '') {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value))
}

function hasTitleBoundary(text, index, title) {
  const before = index > 0 ? text[index - 1] : ''
  const after = index + title.length < text.length ? text[index + title.length] : ''
  const startsWithWord = isWordCharacter(title[0])
  const endsWithWord = isWordCharacter(title[title.length - 1])
  return (!startsWithWord || !isWordCharacter(before))
    && (!endsWithWord || !isWordCharacter(after))
}

function groupTargets(targets = []) {
  const groups = new Map()
  for (const target of targets) {
    const current = groups.get(target.key) || []
    current.push(target)
    groups.set(target.key, current)
  }
  return [...groups.entries()]
    .map(([key, candidates]) => ({ key, candidates }))
    .sort((left, right) => right.key.length - left.key.length)
}

export function findPageSuggestions(doc, targets = [], linkMark = null) {
  const groups = groupTargets(targets)
  if (groups.length === 0) return []
  const suggestions = []

  doc.descendants((node, position) => {
    if (!node.isTextblock || node.type.name === 'codeBlock') return
    const text = node.textBetween(0, node.content.size, '\n', '\n')
    const normalizedText = normalizePageText(text)
    if (!normalizedText) return
    const blockMatches = []

    for (const group of groups) {
      let searchFrom = 0
      while (searchFrom <= normalizedText.length - group.key.length) {
        const index = normalizedText.indexOf(group.key, searchFrom)
        if (index < 0) break
        searchFrom = index + Math.max(group.key.length, 1)
        if (!hasTitleBoundary(normalizedText, index, group.key)) continue

        const from = position + 1 + index
        const to = from + group.key.length
        if (linkMark && doc.rangeHasMark(from, to, linkMark)) continue
        blockMatches.push({
          from,
          to,
          key: group.key,
          candidates: group.candidates
        })
      }
    }

    const acceptedMatches = []
    blockMatches
      .sort((left, right) => left.from - right.from || (right.to - right.from) - (left.to - left.from))
      .forEach(match => {
        const overlaps = acceptedMatches.some(current =>
          current.from < match.to
          && match.from < current.to
        )
        if (!overlaps) {
          const accepted = {
            from: match.from,
            to: match.to,
            key: match.key,
            candidates: match.candidates
          }
          acceptedMatches.push(accepted)
          suggestions.push(accepted)
        }
      })
  })

  return suggestions
}

function createSuggestionDecorations(doc, targets, label) {
  const linkMark = doc.type.schema.marks.link
  const suggestions = findPageSuggestions(doc, targets, linkMark)
  return DecorationSet.create(doc, suggestions.map((suggestion, index) => {
    const id = `${suggestion.key}:${suggestion.from}:${suggestion.to}:${index}`
    return Decoration.inline(
      suggestion.from,
      suggestion.to,
      {
        class: 'tiptap-page-suggestion',
        'data-page-suggestion-id': id,
        role: 'button',
        tabindex: '0',
        'aria-label': label
      },
      {
        id,
        key: suggestion.key,
        candidates: suggestion.candidates
      }
    )
  }))
}

export function getPageSuggestion(editor, id) {
  const pluginState = pageSuggestionPluginKey.getState(editor?.state)
  if (!pluginState || !id) return null
  const [decoration] = pluginState.decorations.find(undefined, undefined, spec => spec.id === id)
  if (!decoration) return null
  return {
    id,
    from: decoration.from,
    to: decoration.to,
    key: decoration.spec.key,
    candidates: decoration.spec.candidates
  }
}

export function refreshPageSuggestions(editor, targets) {
  if (!editor || editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(pageSuggestionPluginKey, {
    refresh: true,
    ...(targets ? { targets } : {})
  }))
}

export const TiptapPageSuggestions = Extension.create({
  name: 'tiptapPageSuggestions',

  addOptions() {
    return {
      targets: [],
      label: 'Suggested page link',
      debounceMs: 250
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: pageSuggestionPluginKey,
        state: {
          init: (_, state) => ({
            decorations: createSuggestionDecorations(state.doc, options.targets, options.label),
            targets: options.targets
          }),
          apply(transaction, pluginState, _oldState, newState) {
            const meta = transaction.getMeta(pageSuggestionPluginKey)
            if (meta?.refresh) {
              const targets = meta.targets || pluginState.targets
              return {
                decorations: createSuggestionDecorations(newState.doc, targets, options.label),
                targets
              }
            }
            return {
              ...pluginState,
              decorations: pluginState.decorations.map(transaction.mapping, transaction.doc)
            }
          }
        },
        props: {
          decorations: state => pageSuggestionPluginKey.getState(state)?.decorations
        },
        view() {
          let timeoutId = null
          return {
            update(nextView, previousState) {
              if (nextView.state.doc.eq(previousState.doc)) return
              window.clearTimeout(timeoutId)
              timeoutId = window.setTimeout(() => {
                if (!nextView.isDestroyed) {
                  nextView.dispatch(
                    nextView.state.tr.setMeta(pageSuggestionPluginKey, { refresh: true })
                  )
                }
              }, options.debounceMs)
            },
            destroy() {
              window.clearTimeout(timeoutId)
            }
          }
        }
      })
    ]
  }
})

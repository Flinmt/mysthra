import { Editor, Node } from '@tiptap/core'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import { TiptapCodeBlock } from './tiptapNodes'
import { TiptapPageLink } from './tiptapPageLinks'
import {
  buildPageSuggestionTargets,
  findPageSuggestions,
  getPageSuggestion,
  normalizePageTitle,
  refreshPageSuggestions,
  TiptapPageSuggestions
} from './tiptapPageSuggestions'

const TiptapTestDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+'
})

const editors = new Set()

function createEditor(content) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      TiptapTestDocument,
      Text,
      Paragraph,
      TiptapCodeBlock,
      TiptapPageLink
    ],
    content
  })
  editors.add(editor)
  return editor
}

function createSuggestionEditor(content, targets) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      TiptapTestDocument,
      Text,
      Paragraph,
      TiptapCodeBlock,
      TiptapPageLink,
      TiptapPageSuggestions.configure({ targets, debounceMs: 0 })
    ],
    content
  })
  editors.add(editor)
  return editor
}

function target(title, tabUid = title) {
  return {
    key: normalizePageTitle(title),
    title,
    tabUid,
    documentUid: 'doc-target',
    documentPath: 'Lore',
    href: `mysthra://document/doc-target?tab=${tabUid}`
  }
}

afterEach(() => {
  editors.forEach(editor => {
    editor.view.dom.parentElement?.remove()
    editor.destroy()
  })
  editors.clear()
})

describe('suggested page links', () => {
  it('builds all supported tab targets and prioritizes the current document', () => {
    const tree = [{
      type: 'container',
      uid: 'doc-current',
      path: 'Lore',
      name: 'Lore',
      children: [
        { type: 'tab', uid: 'tab-current', name: 'Notes', contentType: 'wiki' },
        { type: 'tab', uid: 'tab-local', name: 'Dragons', contentType: 'tiptap' },
        { type: 'tab', uid: 'tab-short', name: 'Map', contentType: 'wiki' },
        { type: 'tab', uid: 'tab-markdown', name: 'Timeline', contentType: 'markdown' },
        { type: 'tab', uid: 'tab-map', name: 'Northern Map', contentType: 'map' },
        { type: 'tab', uid: 'tab-board', name: 'Story Board', contentType: 'board' },
        {
          type: 'container',
          uid: 'doc-child',
          path: 'Lore/Creatures',
          name: 'Creatures',
          children: [
            { type: 'tab', uid: 'tab-remote', name: 'Dragons', contentType: 'wiki' }
          ]
        }
      ]
    }]

    const targets = buildPageSuggestionTargets(tree, 'tab-current')

    expect(targets.map(item => item.tabUid)).toEqual([
      'tab-local',
      'tab-markdown',
      'tab-map',
      'tab-board',
      'tab-remote'
    ])
    expect(targets[0]).toMatchObject({
      documentUid: 'doc-current',
      documentPath: 'Lore',
      isCurrentDocument: true
    })
    expect(targets[4].documentPath).toBe('Lore > Creatures')
  })

  it('matches every whole-title occurrence without case or accent sensitivity', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: '  DRAGOES vivem aqui; dragões também.' }]
      }]
    })

    const matches = findPageSuggestions(
      editor.state.doc,
      [target('Dragões')],
      editor.schema.marks.link
    )

    expect(matches).toHaveLength(2)
    expect(matches.map(match =>
      editor.state.doc.textBetween(match.from, match.to)
    )).toEqual(['DRAGOES', 'dragões'])
  })

  it('keeps the longest title when suggestions overlap', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Ancient Dragon guards the gate.' }]
      }]
    })

    const matches = findPageSuggestions(
      editor.state.doc,
      [target('Dragon'), target('Ancient Dragon')],
      editor.schema.marks.link
    )

    expect(matches).toHaveLength(1)
    expect(editor.state.doc.textBetween(matches[0].from, matches[0].to)).toBe('Ancient Dragon')
  })

  it('ignores partial words, code blocks and existing links', () => {
    const href = 'mysthra://document/existing?tab=existing'
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Dragonfly and ' },
            { type: 'text', text: 'Dragon', marks: [{ type: 'link', attrs: { href } }] },
            { type: 'text', text: ' then Dragon.' }
          ]
        },
        {
          type: 'codeBlock',
          content: [{ type: 'text', text: 'Dragon' }]
        }
      ]
    })

    const matches = findPageSuggestions(
      editor.state.doc,
      [target('Dragon')],
      editor.schema.marks.link
    )

    expect(matches).toHaveLength(1)
    expect(editor.state.doc.textBetween(matches[0].from, matches[0].to)).toBe('Dragon')
  })

  it('keeps suggestions local and refreshes them when visible targets change', () => {
    const editor = createSuggestionEditor({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Dragon' }]
      }]
    }, [target('Dragon')])
    const decoration = editor.view.dom.querySelector('[data-page-suggestion-id]')
    const id = decoration?.getAttribute('data-page-suggestion-id')

    expect(id).toBeTruthy()
    expect(getPageSuggestion(editor, id)).toMatchObject({ from: 1, to: 7 })
    expect(editor.getJSON().content[0].content[0].marks).toBeUndefined()

    refreshPageSuggestions(editor, [])

    expect(editor.view.dom.querySelector('[data-page-suggestion-id]')).toBeNull()
    expect(editor.getJSON().content[0].content[0].marks).toBeUndefined()
  })
})

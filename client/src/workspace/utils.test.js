import { describe, expect, it } from 'vitest'
import { isCollaborativeContentType, shouldOpenFirstTabDraft } from './utils'

describe('first tab draft eligibility', () => {
  const writableEmptyDocument = {
    treeLoaded: true,
    hasSelectedDocument: true,
    hasActiveTab: false,
    tabCount: 0,
    isVisitor: false,
    canWrite: true,
    locked: false
  }

  it('opens automatically for an empty writable document', () => {
    expect(shouldOpenFirstTabDraft(writableEmptyDocument)).toBe(true)
  })

  it.each([
    ['tree still loading', { treeLoaded: false }],
    ['no selected document', { hasSelectedDocument: false }],
    ['an active tab is still selected', { hasActiveTab: true }],
    ['document already has a tab', { tabCount: 1 }],
    ['visitor mode', { isVisitor: true }],
    ['read-only access', { canWrite: false }],
    ['locked document', { locked: true }]
  ])('stays closed when %s', (_scenario, override) => {
    expect(shouldOpenFirstTabDraft({ ...writableEmptyDocument, ...override })).toBe(false)
  })
})

describe('collaborative content types', () => {
  it('treats character sheets as collaborative documents', () => {
    expect(isCollaborativeContentType('sheet')).toBe(true)
    expect(isCollaborativeContentType('plain')).toBe(false)
  })
})

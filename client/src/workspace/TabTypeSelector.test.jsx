import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TabTypeSelector from './TabTypeSelector'

const labels = {
  title: 'Choose tab type',
  description: 'Select how this tab should work.',
  stableGroup: 'Tab types',
  experimentalGroup: 'Under evaluation',
  sheetsGroup: 'Character sheets',
  experimental: 'Experimental',
  notion: 'Notion',
  notionHint: 'Block editor',
  markdown: 'Markdown/HTML',
  markdownHint: 'Source and preview',
  map: 'Map',
  mapHint: 'Collaborative map',
  board: 'Board',
  boardHint: 'Visual canvas',
  roninSheet: 'Ronin Sheet',
  roninSheetHint: 'Collaborative character sheet',
  creating: 'Creating tab...'
}

describe('TabTypeSelector', () => {
  afterEach(cleanup)

  it('offers Notion as a stable Tiptap-backed type', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(<TabTypeSelector labels={labels} onSelect={onSelect} />)

    const stableGroup = screen.getByRole('group', { name: 'Tab types' })
    expect(stableGroup).toBeTruthy()
    expect(stableGroup.querySelectorAll('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Notion/ }).className).toBe('tab-type-option')
    const experimentalGroup = screen.getByRole('group', { name: 'Under evaluation' })
    expect(experimentalGroup.querySelectorAll('button')).toHaveLength(3)
    for (const button of experimentalGroup.querySelectorAll('button')) {
      expect(button.className).toBe('tab-type-option is-experimental')
    }
    const sheetsGroup = screen.getByRole('group', { name: 'Character sheets' })
    expect(sheetsGroup.querySelectorAll('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Ronin Sheet/ }).className).toBe('tab-type-option is-experimental')
    expect(screen.getAllByText('Experimental')).toHaveLength(4)
    expect(screen.getByRole('button', { name: /Notion/ }).textContent).not.toContain('Experimental')
    expect(screen.getByRole('button', { name: /Markdown\/HTML/ }).textContent).toContain('Experimental')
    expect(screen.getByRole('button', { name: /Map/ }).textContent).toContain('Experimental')
    expect(screen.getByRole('button', { name: /Board/ }).textContent).toContain('Experimental')
    expect(screen.getByRole('button', { name: /Ronin Sheet/ }).textContent).toContain('Experimental')
    expect(screen.queryByText('Tiptap')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Markdown\/HTML/ }))
    await user.click(screen.getByRole('button', { name: /Notion/ }))
    await user.click(screen.getByRole('button', { name: /Ronin Sheet/ }))

    expect(onSelect).toHaveBeenNthCalledWith(1, { contentType: 'markdown' })
    expect(onSelect).toHaveBeenNthCalledWith(2, { contentType: 'wiki' })
    expect(onSelect).toHaveBeenNthCalledWith(3, { contentType: 'sheet', sheetType: 'ronin' })
  })

  it('disables every type and announces creation progress', () => {
    render(<TabTypeSelector labels={labels} creating onSelect={vi.fn()} />)

    for (const button of screen.getAllByRole('button')) expect(button.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('Creating tab...')
  })
})

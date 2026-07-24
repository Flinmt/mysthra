import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TabTypeSelector from './TabTypeSelector'

const labels = {
  title: 'Choose tab type',
  description: 'Select how this tab should work.',
  stableGroup: 'Tab types',
  notion: 'Notion',
  notionHint: 'Block editor',
  markdown: 'Markdown/HTML',
  markdownHint: 'Source and preview',
  map: 'Map',
  mapHint: 'Collaborative map',
  board: 'Board',
  boardHint: 'Visual canvas',
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
    for (const button of stableGroup.querySelectorAll('button')) {
      expect(button.className).toBe('tab-type-option')
    }
    expect(screen.getByRole('button', { name: /Notion/ }).className).toBe('tab-type-option')
    expect(screen.queryByText('Experimental')).toBeNull()
    expect(screen.queryByText('Tiptap')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Markdown\/HTML/ }))
    await user.click(screen.getByRole('button', { name: /Notion/ }))

    expect(onSelect).toHaveBeenNthCalledWith(1, 'markdown')
    expect(onSelect).toHaveBeenNthCalledWith(2, 'wiki')
  })

  it('disables every type and announces creation progress', () => {
    render(<TabTypeSelector labels={labels} creating onSelect={vi.fn()} />)

    for (const button of screen.getAllByRole('button')) expect(button.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('Creating tab...')
  })
})

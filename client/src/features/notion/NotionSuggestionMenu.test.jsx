import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotionSuggestionMenu } from './NotionSuggestionMenu'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key })
}))

describe('NotionSuggestionMenu', () => {
  afterEach(cleanup)

  const items = [
    { id: 'paragraph', title: 'Texto', group: 'Texto', icon: <span>p</span> },
    { id: 'heading', title: 'Título', group: 'Texto', icon: <span>h</span> },
    { id: 'image', title: 'Imagem', subtext: 'Descrição que não deve aparecer', group: 'Mídia', icon: <span>i</span> }
  ]

  it('renders grouped commands and the active item', () => {
    render(<NotionSuggestionMenu items={items} loadingState="loaded" selectedIndex={1} onItemClick={vi.fn()} />)

    expect(screen.getByText('workspace.notion_command_menu_title')).not.toBeNull()
    expect(screen.getAllByText('Texto')).not.toHaveLength(0)
    expect(screen.getByText('Título').closest('[role="option"]').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Mídia')).not.toBeNull()
    expect(screen.queryByText('Descrição que não deve aparecer')).toBeNull()
  })

  it('uses the BlockNote callback when a command is clicked', () => {
    const onItemClick = vi.fn()
    render(<NotionSuggestionMenu items={items} loadingState="loaded" selectedIndex={0} onItemClick={onItemClick} />)

    fireEvent.click(screen.getByText('Imagem').closest('[role="option"]'))
    expect(onItemClick).toHaveBeenCalledWith(items[2])
  })

  it('renders compact loading and empty states', () => {
    const { rerender } = render(<NotionSuggestionMenu items={[]} loadingState="loading" selectedIndex={undefined} />)
    expect(screen.getByRole('listbox').getAttribute('aria-busy')).toBe('true')

    rerender(<NotionSuggestionMenu items={[]} loadingState="loaded" selectedIndex={undefined} />)
    expect(screen.getByText('workspace.notion_command_empty')).not.toBeNull()
  })

  it('copies the active world palette into the portal menu', () => {
    const themeSource = document.createElement('div')
    themeSource.className = 'workspace-studio-shell'
    themeSource.style.setProperty('--theme-custom-surface', '#1a1014')
    themeSource.style.setProperty('--text-primary', '#f1e7dc')
    themeSource.style.setProperty('--workspace-theme-accent-border', 'rgba(143, 29, 44, 0.34)')
    document.body.appendChild(themeSource)

    render(<NotionSuggestionMenu items={items} loadingState="loaded" selectedIndex={0} />)

    expect(screen.getByRole('listbox').style.getPropertyValue('--notion-ui-surface')).toBe('#1a1014')
    themeSource.remove()
  })
})

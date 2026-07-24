import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TiptapSlashMenu from './TiptapSlashMenu'
import { TIPTAP_COMMANDS } from './tiptapCommands'

function getCommandOption(label) {
  return screen
    .getAllByText(label)
    .find(element => element.classList.contains('tiptap-slash-menu-label'))
    .closest('[role="option"]')
}

describe('TiptapSlashMenu', () => {
  afterEach(cleanup)

  const shortcutHints = [
    { label: 'Desfazer', shortcut: ['Mod', 'Z'] },
    { label: 'Refazer', shortcut: ['Mod', 'Shift', 'Z'] },
    { label: 'Limpar formatação', shortcut: ['Mod', '\\'] }
  ]

  it('shows subtle shortcut hints only for commands that support them', () => {
    render(
      <TiptapSlashMenu
        items={TIPTAP_COMMANDS}
        selectedIndex={0}
        shortcutHints={shortcutHints}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(getCommandOption('Texto').querySelectorAll('kbd')).toHaveLength(3)
    expect(getCommandOption('Lista numerada').querySelectorAll('kbd')).toHaveLength(3)
    expect(getCommandOption('Título 1').querySelectorAll('kbd')).toHaveLength(3)
    expect(getCommandOption('Título 6').querySelectorAll('kbd')).toHaveLength(3)
    expect(getCommandOption('Título expansível 1').querySelector('kbd')).toBeNull()
    expect(getCommandOption('Título expansível 6')).not.toBeNull()
    expect(getCommandOption('Citação').querySelector('kbd')).toBeNull()
    expect(screen.queryByText('Código')).toBeNull()
    expect(screen.queryByText('Expandir')).toBeNull()
    expect(screen.getByText('Desfazer')).toBeTruthy()
    expect(screen.getByText('Refazer')).toBeTruthy()
    expect(screen.getByText('Limpar formatação')).toBeTruthy()
    expect(getCommandOption('Texto').title).toContain('Ctrl')
  })

  it('keeps command selection unchanged', () => {
    const onSelect = vi.fn()
    render(
      <TiptapSlashMenu
        items={TIPTAP_COMMANDS}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(getCommandOption('Lista'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'bulletList' }))
  })
})

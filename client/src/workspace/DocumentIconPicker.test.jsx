import { useState } from 'react'
import { Folder, Map } from 'lucide-react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DocumentIconPicker from './DocumentIconPicker'

const categories = [{
  id: 'general',
  labelKey: 'general',
  icons: [
    { key: 'Folder', icon: Folder, aliases: ['pasta'] },
    { key: 'Map', icon: Map, aliases: ['mapa'] }
  ]
}]

const labels = {
  title: 'Mudar ícone',
  searchPlaceholder: 'Pesquisar ícones',
  empty: 'Nenhum ícone encontrado',
  emptyHint: 'Tente outro termo',
  saving: 'Salvando',
  clear: 'Limpar',
  close: 'Fechar'
}

function createAnchorRef() {
  const anchor = document.createElement('button')
  anchor.getBoundingClientRect = () => ({
    top: 40,
    bottom: 64,
    left: 24,
    right: 48,
    width: 24,
    height: 24,
    x: 24,
    y: 40,
    toJSON: () => ({})
  })
  return { current: anchor }
}

function PickerHarness({ onClose = vi.fn(), onSelect = vi.fn(), saving = false }) {
  const [query, setQuery] = useState('')
  return (
    <DocumentIconPicker
      anchorRef={createAnchorRef()}
      categories={categories}
      currentIcon="Folder"
      documentName="Atlas do mundo"
      query={query}
      saving={saving}
      labels={labels}
      getCategoryLabel={() => 'Geral'}
      onQueryChange={setQuery}
      onSelect={onSelect}
      onClose={onClose}
    />
  )
}

afterEach(cleanup)

describe('DocumentIconPicker', () => {
  it('renders grouped icons, focuses search and marks the current selection', () => {
    render(<PickerHarness />)

    expect(screen.getByRole('dialog', { name: 'Mudar ícone' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Geral' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Folder' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Pesquisar ícones' }))
  })

  it('filters by aliases and clears the query before closing with Escape', () => {
    const onClose = vi.fn()
    render(<PickerHarness onClose={onClose} />)
    const search = screen.getByRole('textbox', { name: 'Pesquisar ícones' })

    fireEvent.change(search, { target: { value: 'mapa' } })
    expect(screen.queryByRole('button', { name: 'Folder' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Map' })).toBeTruthy()

    fireEvent.keyDown(search, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Folder' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(search, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('selects an icon and prevents repeated selection while saving', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<PickerHarness onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(onSelect).toHaveBeenCalledWith('Map')

    rerender(<PickerHarness onSelect={onSelect} saving />)
    expect(screen.getByRole('button', { name: 'Map' }).disabled).toBe(true)
  })

  it('closes when the outside backdrop is pressed', () => {
    const onClose = vi.fn()
    const { container } = render(<PickerHarness onClose={onClose} />)

    fireEvent.mouseDown(container.querySelector('.document-icon-picker-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

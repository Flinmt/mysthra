import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TiptapTextToolbar from './TiptapTextToolbar'
import { getTextToolbarPosition } from './tiptapTextToolbarPosition'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, fallback) => fallback })
}))

afterEach(cleanup)

function createEditor(overrides = {}) {
  const listeners = new Map()
  const chain = {
    focus: vi.fn(() => chain),
    toggleBold: vi.fn(() => chain),
    toggleItalic: vi.fn(() => chain),
    toggleUnderline: vi.fn(() => chain),
    toggleStrike: vi.fn(() => chain),
    unsetLink: vi.fn(() => chain),
    setColor: vi.fn(() => chain),
    unsetColor: vi.fn(() => chain),
    run: vi.fn(() => true)
  }
  return {
    isDestroyed: false,
    isEditable: true,
    state: {
      selection: { empty: false, from: 1, to: 5 },
      doc: { nodesBetween: (_from, _to, callback) => callback({ isText: true, type: { name: 'text' }, marks: [] }) }
    },
    view: {
      dom: document.createElement('div'),
      coordsAtPos: position => position === 1
        ? { left: 100, right: 100, top: 100, bottom: 120 }
        : { left: 140, right: 160, top: 100, bottom: 120 }
    },
    isActive: name => name === 'bold',
    schema: { marks: { textHighlight: { name: 'textHighlight' } } },
    getAttributes: () => ({}),
    commands: { focus: vi.fn() },
    chain: () => chain,
    on: vi.fn((name, callback) => listeners.set(name, callback)),
    off: vi.fn((name) => listeners.delete(name)),
    chainCommands: chain,
    listeners,
    ...overrides
  }
}

describe('TiptapTextToolbar', () => {
  it('positions above a selection or below when the top space is insufficient', () => {
    expect(getTextToolbarPosition(
      { left: 100, top: 100, bottom: 120 },
      { right: 160, top: 100, bottom: 120 },
      { width: 500, height: 400 }
    )).toMatchObject({ placement: 'above', left: 130, top: 92 })
    expect(getTextToolbarPosition(
      { left: 100, top: 10, bottom: 30 },
      { right: 160, top: 10, bottom: 30 },
      { width: 500, height: 400 }
    )).toMatchObject({ placement: 'below', top: 38 })
  })

  it('shows formatting and link actions and reports active marks', () => {
    const editor = createEditor()
    render(<TiptapTextToolbar editor={editor} />)

    const toolbar = screen.getByRole('toolbar')
    const buttons = toolbar.querySelectorAll('button')
    expect(buttons).toHaveLength(7)
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true')
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false')
  })

  it('runs each inline formatting command without losing the editor selection', () => {
    const editor = createEditor()
    render(<TiptapTextToolbar editor={editor} />)

    screen.getAllByRole('button').slice(0, 4).forEach(button => fireEvent.click(button))

    expect(editor.chainCommands.focus).toHaveBeenCalledTimes(4)
    expect(editor.chainCommands.toggleBold).toHaveBeenCalledOnce()
    expect(editor.chainCommands.toggleItalic).toHaveBeenCalledOnce()
    expect(editor.chainCommands.toggleUnderline).toHaveBeenCalledOnce()
    expect(editor.chainCommands.toggleStrike).toHaveBeenCalledOnce()
    expect(editor.chainCommands.run).toHaveBeenCalledTimes(4)
  })

  it('opens the URL editor from the link action and Ctrl+K', () => {
    const editor = createEditor()
    render(<TiptapTextToolbar editor={editor} />)

    fireEvent.click(screen.getAllByRole('button')[4])
    expect(screen.getByRole('textbox').getAttribute('placeholder')).toBe('https://example.com')
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })

    const target = document.createElement('span')
    document.body.append(editor.view.dom)
    editor.view.dom.append(target)
    fireEvent.keyDown(target, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('textbox')).not.toBeNull()
    editor.view.dom.remove()
  })

  it('applies palette and custom colors and can restore the default color', () => {
    const editor = createEditor()
    render(<TiptapTextToolbar editor={editor} />)

    fireEvent.click(screen.getAllByRole('button')[5])
    fireEvent.click(screen.getByRole('button', { name: '#d89a5b' }))
    expect(editor.chainCommands.setColor).toHaveBeenCalledWith('#d89a5b')

    fireEvent.click(screen.getAllByRole('button')[5])
    fireEvent.change(screen.getByLabelText('Cor personalizada'), { target: { value: '#123456' } })
    expect(editor.chainCommands.setColor).toHaveBeenCalledWith('#123456')

    fireEvent.click(screen.getAllByRole('button')[5])
    fireEvent.click(screen.getByRole('button', { name: 'Cor padrão' }))
    expect(editor.chainCommands.unsetColor).toHaveBeenCalledOnce()
  })

  it('opens a separate marker palette', () => {
    const editor = createEditor()
    render(<TiptapTextToolbar editor={editor} />)

    fireEvent.click(screen.getAllByRole('button')[6])

    expect(screen.getByRole('group', { name: 'Cores do marca-texto' })).not.toBeNull()
    expect(screen.getByLabelText('Destaque personalizado').getAttribute('type')).toBe('color')
  })

  it('stays hidden without an editable text selection', () => {
    const editor = createEditor({
      isEditable: false,
      state: { selection: { empty: false, from: 1, to: 5 } }
    })
    const { rerender } = render(<TiptapTextToolbar editor={editor} />)
    expect(screen.queryByRole('toolbar')).toBeNull()

    editor.isEditable = true
    editor.state.selection = { empty: true, from: 1, to: 1 }
    rerender(<TiptapTextToolbar editor={editor} />)
    editor.listeners.get('transaction')?.()
    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})

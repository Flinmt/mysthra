import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import i18n from '../../i18n'
import RoninSheetEditor from './RoninSheetEditor'

const collaborationState = vi.hoisted(() => ({ value: null }))

vi.mock('../../hooks/useCollaborationRoom', () => ({
  useCollaborationRoom: () => collaborationState.value
}))

describe('RoninSheetEditor', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt')
    collaborationState.value = {
      doc: new Y.Doc(),
      provider: {},
      synced: true,
      readOnly: false,
      saveStatus: 'saved',
      dirty: false
    }
  })

  afterEach(() => {
    collaborationState.value.doc.destroy()
    cleanup()
  })

  function renderEditor(overrides) {
    return render(getEditor(overrides))
  }

  function getEditor(overrides = {}) {
    return (
      <RoninSheetEditor
        collaborationRoom="world:ronin-world:tab:ronin-sheet"
        currentUser={{ userId: 'admin', username: 'admin' }}
        assetImages={[]}
        getAssetUrl={path => `/asset/${path}`}
        onRequestMedia={overrides.onRequestMedia || vi.fn()}
        onCollaborationSaveState={vi.fn()}
      />
    )
  }

  it('initializes the fixed schema and starts dynamic lists empty', async () => {
    renderEditor()

    await screen.findByText('Personagem')
    const doc = collaborationState.value.doc

    expect(doc.getMap('sheetMeta').get('sheetType')).toBe('ronin')
    expect(doc.getMap('sheetMeta').get('schemaVersion')).toBe(1)
    expect(doc.getMap('roninVirtues').toJSON()).toMatchObject({
      reputation: 0,
      compassion: 0,
      determination: 0,
      condition: 'normal'
    })
    expect(doc.getMap('roninClans').size).toBe(4)
    expect(doc.getArray('roninAllies').length).toBe(0)
    expect(doc.getArray('roninEnemies').length).toBe(0)
    expect(doc.getMap('roninVillains').size).toBe(3)
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(3)
  })

  it('edits counters and adds and removes populated allies safely', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('Personagem')

    const reputation = screen.getByRole('slider', { name: 'Reputação' })
    await user.click(within(reputation).getByRole('button', { name: 'Reputação: 4' }))
    expect(collaborationState.value.doc.getMap('roninVirtues').get('reputation')).toBe(4)

    await user.click(screen.getByRole('button', { name: 'Adicionar aliado' }))
    const allies = collaborationState.value.doc.getArray('roninAllies')
    expect(allies.length).toBe(1)
    expect(allies.get(0).get('status')).toBe('possible')

    const allyCard = document.querySelector('.ronin-sheet-entry')
    const nameInput = within(allyCard).getByLabelText('Nome')
    fireEvent.change(nameInput, { target: { value: 'Akemi' } })
    await waitFor(() => expect(allies.get(0).get('name').toString()).toBe('Akemi'))

    await user.click(within(allyCard).getByRole('button', { name: 'Excluir' }))
    expect(screen.getByRole('alertdialog', { name: 'Remover registro' })).toBeTruthy()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }))
    expect(allies.length).toBe(0)
  })

  it('keeps the form mounted while local changes are waiting to persist', async () => {
    const view = renderEditor()
    await screen.findByText('Personagem')

    collaborationState.value = {
      ...collaborationState.value,
      synced: false,
      dirty: true,
      saveStatus: 'saving'
    }
    view.rerender(getEditor())

    expect(screen.getByText('Personagem')).toBeTruthy()
    expect(document.querySelector('.ronin-sheet-loading')).toBeNull()
  })

  it('uses the shared media explorer callback to choose images', async () => {
    const user = userEvent.setup()
    const onRequestMedia = vi.fn()
    renderEditor({ onRequestMedia })
    await screen.findByText('Personagem')

    await user.click(screen.getByRole('button', { name: 'Adicionar retrato' }))
    expect(onRequestMedia).toHaveBeenCalledWith('image', expect.any(Function))

    await act(async () => {
      onRequestMedia.mock.calls[0][1]({ path: 'characters/ronin.webp', mediaType: 'image' })
    })
    expect(collaborationState.value.doc.getMap('roninCharacter').get('assetPath')).toBe('characters/ronin.webp')
  })
})

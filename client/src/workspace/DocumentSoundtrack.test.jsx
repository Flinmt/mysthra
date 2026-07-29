import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DocumentSoundtrackDialog,
  DocumentSoundtrackPlayer
} from './DocumentSoundtrack'

const playerLabels = {
  player: 'Document soundtrack player',
  play: 'Play soundtrack',
  pause: 'Pause soundtrack',
  volume: 'Your volume',
  unavailable: 'Audio unavailable',
  autoplayBlocked: 'Click play to start'
}

describe('DocumentSoundtrackPlayer', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('attempts autoplay and streams through the selected document context', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    window.localStorage.setItem(
      'mysthra:document-soundtrack:world name:reader:document/uid',
      JSON.stringify({ paused: true, volume: 0.42 })
    )

    const { container } = render(
      <DocumentSoundtrackPlayer
        worldId="world name"
        documentUid="document/uid"
        documentName="Tavern"
        userScope="reader"
        soundtrack={{
          assetId: 'audio id',
          defaultVolume: 0.35,
          name: 'tavern.opus',
          unavailable: false
        }}
        labels={playerLabels}
      />
    )

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
    expect(container.querySelector('audio').volume).toBe(0.42)
    expect(screen.getByText('tavern.opus')).toBeTruthy()
    expect(screen.getByText('Tavern')).toBeTruthy()
    expect(container.querySelector('audio').getAttribute('src')).toBe(
      '/api/worlds/world%20name/assets/file?id=audio+id&documentUid=document%2Fuid'
    )
  })

  it('requires an explicit play action when browser autoplay is blocked', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'))
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    render(
      <DocumentSoundtrackPlayer
        worldId="world"
        documentUid="document"
        documentName="Tavern"
        userScope="visitor"
        soundtrack={{
          assetId: 'audio',
          defaultVolume: 0.35,
          name: 'tavern.opus',
          unavailable: false
        }}
        labels={playerLabels}
      />
    )

    await waitFor(() => expect(play).toHaveBeenCalled())
    expect(await screen.findByText('Click play to start')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play soundtrack' })).toBeTruthy()
  })

  it('resumes a pause event that did not come from the user control', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    const { container } = render(
      <DocumentSoundtrackPlayer
        worldId="world"
        documentUid="document"
        documentName="Tavern"
        userScope="reader"
        soundtrack={{
          assetId: 'audio',
          defaultVolume: 0.35,
          name: 'tavern.opus',
          unavailable: false
        }}
        labels={playerLabels}
      />
    )

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
    fireEvent.pause(container.querySelector('audio'))
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
  })
})

describe('DocumentSoundtrackDialog', () => {
  afterEach(cleanup)

  it('keeps an unavailable soundtrack removable while preventing it from being saved again', () => {
    render(
      <DocumentSoundtrackDialog
        isOpen
        asset={{ id: 'missing', name: '', unavailable: true }}
        volume={0.35}
        busy={false}
        error=""
        labels={{
          title: 'Document soundtrack',
          description: 'Description',
          close: 'Close',
          noTrack: 'No track',
          unavailable: 'Audio unavailable',
          chooseTrack: 'Choose track',
          changeTrack: 'Change track',
          defaultVolume: 'Default volume',
          volumeHint: 'Volume hint',
          remove: 'Remove soundtrack',
          cancel: 'Cancel',
          save: 'Save',
          saving: 'Saving'
        }}
        onChoose={vi.fn()}
        onVolumeChange={vi.fn()}
        onRemove={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Audio unavailable')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove soundtrack' }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(true)
  })
})

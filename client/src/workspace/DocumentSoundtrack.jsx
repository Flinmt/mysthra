import { useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, Trash2, Volume2, X } from 'lucide-react'
import {
  DEFAULT_DOCUMENT_SOUNDTRACK_VOLUME,
  getDocumentSoundtrackSource,
  readDocumentSoundtrackPreference,
  saveDocumentSoundtrackPreference
} from './documentSoundtrack'

export function DocumentSoundtrackDialog({
  isOpen,
  asset,
  volume,
  busy,
  error,
  labels,
  onChoose,
  onVolumeChange,
  onRemove,
  onSave,
  onClose
}) {
  if (!isOpen) return null

  return (
    <div className="document-soundtrack-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="document-soundtrack-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-soundtrack-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header>
          <span className="document-soundtrack-dialog-icon" aria-hidden="true"><Music size={17} /></span>
          <div>
            <strong id="document-soundtrack-title">{labels.title}</strong>
            <p>{labels.description}</p>
          </div>
          <button type="button" className="document-soundtrack-icon-button" onClick={onClose} aria-label={labels.close}>
            <X size={15} />
          </button>
        </header>

        <button type="button" className="document-soundtrack-file" onClick={onChoose} disabled={busy}>
          <span className={asset ? 'has-asset' : ''}><Music size={16} /></span>
          <span>
            <strong>{asset?.name || (asset?.unavailable ? labels.unavailable : labels.noTrack)}</strong>
            <small>{asset ? labels.changeTrack : labels.chooseTrack}</small>
          </span>
        </button>

        <label className="document-soundtrack-volume">
          <span>
            <Volume2 size={15} />
            <strong>{labels.defaultVolume}</strong>
            <output>{Math.round(volume * 100)}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(volume * 100)}
            onChange={event => onVolumeChange(Number(event.target.value) / 100)}
          />
          <small>{labels.volumeHint}</small>
        </label>

        {error && <p className="document-soundtrack-error" role="alert">{error}</p>}

        <footer>
          {asset && (
            <button type="button" className="document-soundtrack-remove" onClick={onRemove} disabled={busy}>
              <Trash2 size={14} />
              {labels.remove}
            </button>
          )}
          <span />
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{labels.cancel}</button>
          <button type="button" className="btn-primary" onClick={onSave} disabled={busy || !asset || asset.unavailable}>
            {busy ? labels.saving : labels.save}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function DocumentSoundtrackPlayer({
  worldId,
  documentUid,
  documentName,
  userScope,
  soundtrack,
  labels
}) {
  const audioRef = useRef(null)
  const preferenceRef = useRef({})
  const manuallyPausedRef = useRef(false)
  const shouldBePlayingRef = useRef(false)
  const [paused, setPaused] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [volume, setVolume] = useState(soundtrack?.defaultVolume ?? DEFAULT_DOCUMENT_SOUNDTRACK_VOLUME)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !soundtrack?.assetId || soundtrack.unavailable) return undefined

    const preference = readDocumentSoundtrackPreference(worldId, documentUid, userScope)
    const nextVolume = preference.volume ?? soundtrack.defaultVolume ?? DEFAULT_DOCUMENT_SOUNDTRACK_VOLUME
    preferenceRef.current = preference
    audio.volume = nextVolume
    audio.currentTime = 0
    manuallyPausedRef.current = false
    shouldBePlayingRef.current = true
    setVolume(nextVolume)
    setFailed(false)
    setBlocked(false)
    setPaused(false)
    audio.play().catch(() => {
      setBlocked(true)
      setPaused(true)
    })

    return () => {
      shouldBePlayingRef.current = false
      audio.pause()
      audio.currentTime = 0
    }
  }, [
    documentUid,
    soundtrack?.assetId,
    soundtrack?.defaultVolume,
    soundtrack?.unavailable,
    userScope,
    worldId
  ])

  if (!soundtrack) return null

  const persistPreference = next => {
    preferenceRef.current = { ...preferenceRef.current, ...next }
    saveDocumentSoundtrackPreference(worldId, documentUid, userScope, preferenceRef.current)
  }

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || failed || soundtrack.unavailable) return
    if (!audio.paused) {
      manuallyPausedRef.current = true
      shouldBePlayingRef.current = false
      audio.pause()
      setPaused(true)
      setBlocked(false)
      return
    }
    try {
      manuallyPausedRef.current = false
      shouldBePlayingRef.current = true
      await audio.play()
      setPaused(false)
      setBlocked(false)
    } catch {
      setPaused(true)
      setBlocked(true)
    }
  }

  const changeVolume = event => {
    const nextVolume = Number(event.target.value) / 100
    if (audioRef.current) audioRef.current.volume = nextVolume
    setVolume(nextVolume)
    persistPreference({ volume: nextVolume })
  }

  const unavailable = failed || soundtrack.unavailable
  return (
    <aside
      className={`document-soundtrack-player ${unavailable ? 'is-unavailable' : ''}`}
      aria-label={blocked ? `${labels.player}. ${labels.autoplayBlocked}` : labels.player}
    >
      {!soundtrack.unavailable && (
        <audio
          ref={audioRef}
          src={getDocumentSoundtrackSource(worldId, documentUid, soundtrack.assetId)}
          autoPlay
          loop
          preload="metadata"
          onCanPlay={() => {
            const audio = audioRef.current
            if (
              !audio
              || manuallyPausedRef.current
              || !shouldBePlayingRef.current
              || !audio.paused
            ) return
            audio.play().then(() => {
              setPaused(false)
              setBlocked(false)
            }).catch(() => {
              setPaused(true)
              setBlocked(true)
            })
          }}
          onPlay={() => setPaused(false)}
          onPause={() => {
            setPaused(true)
            const audio = audioRef.current
            if (!audio || manuallyPausedRef.current || !shouldBePlayingRef.current) return
            audio.play().then(() => {
              setPaused(false)
              setBlocked(false)
            }).catch(() => {
              setBlocked(true)
              setPaused(true)
            })
          }}
          onError={() => {
            shouldBePlayingRef.current = false
            setFailed(true)
            setPaused(true)
          }}
        />
      )}
      <button type="button" className="document-soundtrack-play" onClick={togglePlayback} disabled={unavailable} aria-label={paused ? labels.play : labels.pause}>
        {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
      </button>
      <span className="document-soundtrack-copy">
        <strong>{soundtrack.name || labels.unavailable}</strong>
        <small>{blocked ? labels.autoplayBlocked : documentName}</small>
      </span>
      <label className="document-soundtrack-player-volume">
        <Volume2 size={14} />
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(volume * 100)}
          onChange={changeVolume}
          aria-label={labels.volume}
          disabled={unavailable}
        />
      </label>
    </aside>
  )
}

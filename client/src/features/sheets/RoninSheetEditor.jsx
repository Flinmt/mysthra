import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import * as Y from 'yjs'
import { useCollaborationRoom } from '../../hooks/useCollaborationRoom'

const CHARACTER_FIELDS = ['name', 'technique', 'combat', 'block', 'family', 'nightmare', 'scar', 'meaning']
const ALLY_FIELDS = ['name', 'technique', 'occupation']
const ENEMY_FIELDS = ['name', 'combat', 'blocks']
const VILLAIN_FIELDS = ['name', 'technique', 'combat', 'block', 'advantage']
const CLAN_SYMBOLS = ['◉', '◬', '◆', '◇']
const VILLAIN_IDS = ['villain-1', 'villain-2', 'final-villain']

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getOrCreateText(map, key) {
  const current = map.get(key)
  if (current instanceof Y.Text) return current
  const text = new Y.Text()
  if (current !== undefined && current !== null) text.insert(0, String(current))
  map.set(key, text)
  return text
}

function replaceText(doc, map, key, value) {
  doc.transact(() => {
    const text = getOrCreateText(map, key)
    text.delete(0, text.length)
    if (value) text.insert(0, value)
  })
}

function readText(map, key) {
  const value = map?.get(key)
  return value instanceof Y.Text ? value.toString() : String(value || '')
}

function createRecord(fields, defaults = {}) {
  const record = new Y.Map()
  record.set('id', defaults.id || createId('sheet'))
  for (const field of fields) record.set(field, new Y.Text())
  for (const [key, value] of Object.entries(defaults)) {
    if (key !== 'id') record.set(key, value)
  }
  return record
}

function readRecord(record, fields) {
  return {
    id: String(record.get('id') || ''),
    ...Object.fromEntries(fields.map(field => [field, readText(record, field)])),
    status: String(record.get('status') || ''),
    assetPath: String(record.get('assetPath') || '')
  }
}

function initializeSheet(state) {
  const {
    doc,
    sheetMeta,
    character,
    virtues,
    clans,
    villains
  } = state

  doc.transact(() => {
    if (!sheetMeta.has('sheetType')) sheetMeta.set('sheetType', 'ronin')
    if (!sheetMeta.has('schemaVersion')) sheetMeta.set('schemaVersion', 1)
    for (const field of CHARACTER_FIELDS) getOrCreateText(character, field)
    if (!character.has('assetPath')) character.set('assetPath', '')
    for (const field of ['reputation', 'compassion', 'determination']) {
      if (!virtues.has(field)) virtues.set(field, 0)
    }
    if (!virtues.has('condition')) virtues.set('condition', 'normal')
    CLAN_SYMBOLS.forEach((_, index) => getOrCreateText(clans, `clan-${index + 1}`))
    VILLAIN_IDS.forEach((id, index) => {
      let villain = villains.get(id)
      if (!(villain instanceof Y.Map)) {
        villain = createRecord(VILLAIN_FIELDS, {
          id,
          status: '',
          assetPath: '',
          kind: index === 2 ? 'final' : 'regular'
        })
        villains.set(id, villain)
      }
      for (const field of VILLAIN_FIELDS) getOrCreateText(villain, field)
    })
  })
}

function readRoninSheetState(state) {
  return {
    character: {
      ...Object.fromEntries(CHARACTER_FIELDS.map(field => [field, readText(state.character, field)])),
      assetPath: String(state.character.get('assetPath') || '')
    },
    virtues: {
      reputation: Number(state.virtues.get('reputation') || 0),
      compassion: Number(state.virtues.get('compassion') || 0),
      determination: Number(state.virtues.get('determination') || 0),
      condition: String(state.virtues.get('condition') || 'normal')
    },
    clans: CLAN_SYMBOLS.map((symbol, index) => ({
      id: `clan-${index + 1}`,
      symbol,
      name: readText(state.clans, `clan-${index + 1}`)
    })),
    allies: state.allies.toArray().filter(item => item instanceof Y.Map).map(item => readRecord(item, ALLY_FIELDS)),
    enemies: state.enemies.toArray().filter(item => item instanceof Y.Map).map(item => readRecord(item, ENEMY_FIELDS)),
    villains: VILLAIN_IDS.map(id => {
      const villain = state.villains.get(id)
      return villain instanceof Y.Map
        ? { ...readRecord(villain, VILLAIN_FIELDS), id }
        : { id, name: '', technique: '', combat: '', block: '', advantage: '', status: '', assetPath: '' }
    })
  }
}

function findRecord(yArray, id) {
  return yArray.toArray().find(item => item instanceof Y.Map && item.get('id') === id) || null
}

function removeRecord(yArray, id) {
  const index = yArray.toArray().findIndex(item => item instanceof Y.Map && item.get('id') === id)
  if (index >= 0) yArray.delete(index, 1)
}

function isRecordPopulated(record) {
  return Boolean(
    record.assetPath
    || (record.status && record.status !== 'possible')
    || [...ALLY_FIELDS, ...ENEMY_FIELDS].some(field => String(record[field] || '').trim())
  )
}

function Field({ label, value, onChange, readOnly, multiline = false }) {
  const Control = multiline ? 'textarea' : 'input'
  return (
    <label className={`ronin-sheet-field ${multiline ? 'is-multiline' : ''}`}>
      <span>{label}</span>
      <Control value={value} onChange={event => onChange(event.target.value)} readOnly={readOnly} />
    </label>
  )
}

function Segments({ value, options, onChange, readOnly, label }) {
  return (
    <div className="ronin-sheet-segments" role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
          disabled={readOnly}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Counter({ label, value, onChange, readOnly }) {
  const handleKeyDown = event => {
    if (readOnly || !['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) return
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1
    onChange(Math.max(0, Math.min(6, value + delta)))
  }

  return (
    <div className="ronin-sheet-counter">
      <span>{label}</span>
      <div role="slider" tabIndex={readOnly ? -1 : 0} aria-label={label} aria-valuemin="0" aria-valuemax="6" aria-valuenow={value} onKeyDown={handleKeyDown}>
        {Array.from({ length: 6 }, (_, index) => index + 1).map(point => (
          <button
            key={point}
            type="button"
            className={point <= value ? 'active' : ''}
            onClick={() => onChange(point === value ? value - 1 : point)}
            disabled={readOnly}
            tabIndex={-1}
            aria-label={`${label}: ${point}`}
          />
        ))}
      </div>
    </div>
  )
}

function Portrait({ assetPath, alt, getAssetUrl, onOpen, readOnly, label }) {
  return (
    <button
      type="button"
      className={`ronin-sheet-portrait ${assetPath ? 'has-image' : ''}`}
      onClick={onOpen}
      aria-label={assetPath ? alt || label : label}
      disabled={readOnly && !assetPath}
    >
      {assetPath ? <img src={getAssetUrl(assetPath)} alt={alt} /> : <><ImageIcon size={24} /><span>{label}</span></>}
    </button>
  )
}

function ImageDialog({
  dialog,
  images,
  getAssetUrl,
  onRemove,
  onChange,
  onClose,
  readOnly
}) {
  const { t } = useTranslation()
  const closeRef = useRef(null)

  useEffect(() => {
    if (!dialog) return undefined
    closeRef.current?.focus()
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialog, onClose])

  if (!dialog) return null
  const selected = images.find(image => image.path === dialog.assetPath)

  return (
    <div className="ronin-sheet-dialog-backdrop" onPointerDown={event => event.target === event.currentTarget && onClose()}>
      <section className="ronin-sheet-image-dialog" role="dialog" aria-modal="true" aria-label={t('workspace.ronin_image_dialog')}>
        <header>
          <strong>{selected?.name || t('workspace.ronin_image')}</strong>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button>
        </header>
        <div className="ronin-sheet-image-stage"><img src={getAssetUrl(dialog.assetPath)} alt={selected?.name || ''} /></div>
        {!readOnly && (
          <footer>
            <button type="button" className="btn-secondary" onClick={onChange}>{t('workspace.ronin_change_image')}</button>
            <button type="button" className="ronin-sheet-danger" onClick={onRemove}>{t('workspace.ronin_remove_image')}</button>
          </footer>
        )}
      </section>
    </div>
  )
}

function ConfirmDialog({ onConfirm, onClose }) {
  const { t } = useTranslation()
  return (
    <div className="ronin-sheet-dialog-backdrop" onPointerDown={event => event.target === event.currentTarget && onClose()}>
      <section className="ronin-sheet-confirm" role="alertdialog" aria-modal="true" aria-label={t('workspace.ronin_remove_entry')}>
        <strong>{t('workspace.ronin_remove_entry')}</strong>
        <p>{t('workspace.ronin_remove_entry_hint')}</p>
        <footer>
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="ronin-sheet-danger" onClick={onConfirm}>{t('common.delete')}</button>
        </footer>
      </section>
    </div>
  )
}

function useIncrementalList(total, batchSize) {
  const [visible, setVisible] = useState(batchSize)
  const sentinelRef = useRef(null)

  useEffect(() => {
    setVisible(current => Math.max(batchSize, Math.min(current, Math.max(total, batchSize))))
  }, [batchSize, total])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || visible >= total || !globalThis.IntersectionObserver) return undefined
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(current => Math.min(total, current + batchSize))
      }
    }, { root: sentinel.parentElement, rootMargin: '120px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [batchSize, total, visible])

  const showMore = () => setVisible(current => Math.min(total, current + batchSize))
  return [visible, sentinelRef, showMore]
}

export default function RoninSheetEditor({
  collaborationRoom,
  currentUser,
  isVisitor = false,
  locked = false,
  assetImages = [],
  getAssetUrl,
  onRequestMedia,
  onCollaborationSaveState
}) {
  const { t } = useTranslation()
  const collaboration = useCollaborationRoom({
    roomName: collaborationRoom,
    currentUser,
    isVisitor,
    locked
  })
  const {
    doc,
    provider,
    readOnly: collaborationReadOnly,
    synced,
    saveStatus,
    dirty
  } = collaboration
  const readOnly = Boolean(isVisitor || locked || collaborationReadOnly)
  const [snapshot, setSnapshot] = useState(null)
  const [hasHydrated, setHasHydrated] = useState(false)
  const [expandedVillains, setExpandedVillains] = useState(() => new Set())
  const [imageDialog, setImageDialog] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const yState = useMemo(() => {
    if (!doc || !provider) return null
    return {
      doc,
      sheetMeta: doc.getMap('sheetMeta'),
      character: doc.getMap('roninCharacter'),
      virtues: doc.getMap('roninVirtues'),
      clans: doc.getMap('roninClans'),
      allies: doc.getArray('roninAllies'),
      enemies: doc.getArray('roninEnemies'),
      villains: doc.getMap('roninVillains')
    }
  }, [doc, provider])

  useEffect(() => {
    setHasHydrated(false)
  }, [doc])

  useEffect(() => {
    if (synced) setHasHydrated(true)
  }, [synced])

  useEffect(() => {
    onCollaborationSaveState?.({ status: saveStatus, dirty })
  }, [dirty, onCollaborationSaveState, saveStatus])

  useEffect(() => {
    if (!yState) return undefined
    const types = [
      yState.sheetMeta,
      yState.character,
      yState.virtues,
      yState.clans,
      yState.allies,
      yState.enemies,
      yState.villains
    ]
    const update = () => setSnapshot(readRoninSheetState(yState))
    types.forEach(type => type.observeDeep(update))
    if (synced && !readOnly) initializeSheet(yState)
    update()
    return () => types.forEach(type => type.unobserveDeep(update))
  }, [readOnly, synced, yState])

  const setMapValue = useCallback((map, key, value) => {
    if (readOnly || !yState) return
    yState.doc.transact(() => map.set(key, value))
  }, [readOnly, yState])

  const setTextValue = useCallback((map, key, value) => {
    if (readOnly || !yState) return
    replaceText(yState.doc, map, key, value)
  }, [readOnly, yState])

  const updateListText = (list, id, field, value) => {
    const record = findRecord(list, id)
    if (record) setTextValue(record, field, value)
  }

  const updateListValue = (list, id, key, value) => {
    const record = findRecord(list, id)
    if (record) setMapValue(record, key, value)
  }

  const addAlly = () => {
    if (readOnly || !yState) return
    yState.allies.push([createRecord(ALLY_FIELDS, { status: 'possible', assetPath: '' })])
  }

  const addEnemy = () => {
    if (readOnly || !yState) return
    yState.enemies.push([createRecord(ENEMY_FIELDS, { status: '', assetPath: '' })])
  }

  const requestRemove = (kind, record) => {
    if (readOnly || !yState) return
    const remove = () => {
      removeRecord(kind === 'ally' ? yState.allies : yState.enemies, record.id)
      setConfirmDelete(null)
    }
    if (isRecordPopulated(record)) setConfirmDelete({ remove })
    else remove()
  }

  const resolveImageTarget = useCallback((target) => {
    if (!target || !yState) return null
    const { kind, id } = target
    if (kind === 'character') return yState.character
    if (kind === 'ally') return findRecord(yState.allies, id)
    if (kind === 'enemy') return findRecord(yState.enemies, id)
    if (kind === 'villain') return yState.villains.get(id)
    return null
  }, [yState])

  const openImage = (target, assetPath = '') => {
    if (assetPath) {
      setImageDialog({ target, assetPath })
      return
    }
    if (readOnly) return
    requestImage(target)
  }

  const requestImage = target => {
    onRequestMedia?.('image', asset => {
      const imageTarget = resolveImageTarget(target)
      if (!imageTarget || !asset?.path) return
      setMapValue(imageTarget, 'assetPath', asset.path)
    })
  }

  const removeImage = () => {
    const target = resolveImageTarget(imageDialog?.target)
    if (target) setMapValue(target, 'assetPath', '')
    setImageDialog(null)
  }

  const changeImage = () => {
    const target = imageDialog?.target
    setImageDialog(null)
    if (target) requestImage(target)
  }

  const [visibleAllies, allySentinelRef, showMoreAllies] = useIncrementalList(snapshot?.allies.length || 0, 6)
  const [visibleEnemies, enemySentinelRef, showMoreEnemies] = useIncrementalList(snapshot?.enemies.length || 0, 10)

  if (!snapshot || !hasHydrated) {
    return <div className="ronin-sheet-loading"><span />{t('workspace.loading_content')}</div>
  }

  const allyStatusOptions = [
    { value: 'possible', label: t('workspace.ronin_possible') },
    { value: 'ally', label: t('workspace.ronin_ally') },
    { value: 'dead', label: t('workspace.ronin_dead') }
  ]
  const villainStatusOptions = [
    { value: '', label: t('workspace.ronin_no_status') },
    { value: 'defeated', label: t('workspace.ronin_defeated') },
    { value: 'dead', label: t('workspace.ronin_dead') }
  ]

  return (
    <div className="ronin-sheet">
      <section className="ronin-sheet-panel ronin-sheet-character">
        <div className="ronin-sheet-panel-heading"><h3>{t('workspace.ronin_character')}</h3></div>
        <div className="ronin-sheet-character-grid">
          <Portrait
            assetPath={snapshot.character.assetPath}
            alt={snapshot.character.name}
            getAssetUrl={getAssetUrl}
            onOpen={() => openImage({ kind: 'character' }, snapshot.character.assetPath)}
            readOnly={readOnly}
            label={t('workspace.ronin_add_portrait')}
          />
          <div className="ronin-sheet-character-fields">
            <Field label={t('workspace.ronin_name')} value={snapshot.character.name} onChange={value => setTextValue(yState.character, 'name', value)} readOnly={readOnly} />
            <Field label={t('workspace.ronin_technique')} value={snapshot.character.technique} onChange={value => setTextValue(yState.character, 'technique', value)} readOnly={readOnly} />
            <div className="ronin-sheet-field-row">
              <Field label={t('workspace.ronin_combat')} value={snapshot.character.combat} onChange={value => setTextValue(yState.character, 'combat', value)} readOnly={readOnly} />
              <Field label={t('workspace.ronin_block')} value={snapshot.character.block} onChange={value => setTextValue(yState.character, 'block', value)} readOnly={readOnly} />
            </div>
            <Field label={t('workspace.ronin_family')} value={snapshot.character.family} onChange={value => setTextValue(yState.character, 'family', value)} readOnly={readOnly} />
          </div>
          <div className="ronin-sheet-character-details">
            <Field label={t('workspace.ronin_nightmare')} value={snapshot.character.nightmare} onChange={value => setTextValue(yState.character, 'nightmare', value)} readOnly={readOnly} />
            <Field label={t('workspace.ronin_scar')} value={snapshot.character.scar} onChange={value => setTextValue(yState.character, 'scar', value)} readOnly={readOnly} />
            <Field label={t('workspace.ronin_meaning')} value={snapshot.character.meaning} onChange={value => setTextValue(yState.character, 'meaning', value)} readOnly={readOnly} />
          </div>
        </div>
      </section>

      <section className="ronin-sheet-panel">
        <div className="ronin-sheet-panel-heading"><h3>{t('workspace.ronin_virtues')}</h3></div>
        <div className="ronin-sheet-counters">
          {[
            ['reputation', t('workspace.ronin_reputation')],
            ['compassion', t('workspace.ronin_compassion')],
            ['determination', t('workspace.ronin_determination')]
          ].map(([key, label]) => (
            <Counter key={key} label={label} value={snapshot.virtues[key]} onChange={value => setMapValue(yState.virtues, key, value)} readOnly={readOnly} />
          ))}
        </div>
        <div className="ronin-sheet-condition">
          <Segments
            label={t('workspace.ronin_condition')}
            value={snapshot.virtues.condition}
            onChange={value => setMapValue(yState.virtues, 'condition', value)}
            readOnly={readOnly}
            options={[
              { value: 'wounded', label: t('workspace.ronin_wounded') },
              { value: 'normal', label: t('workspace.ronin_normal') },
              { value: 'dead', label: t('workspace.ronin_dead') }
            ]}
          />
        </div>
      </section>

      <section className="ronin-sheet-panel">
        <div className="ronin-sheet-panel-heading"><h3>{t('workspace.ronin_clans')}</h3></div>
        <div className="ronin-sheet-clans">
          {snapshot.clans.map((clan, index) => (
            <label key={clan.id}>
              <span aria-hidden="true">{clan.symbol}</span>
              <input value={clan.name} onChange={event => setTextValue(yState.clans, `clan-${index + 1}`, event.target.value)} readOnly={readOnly} placeholder={t('workspace.ronin_clan_name')} />
            </label>
          ))}
        </div>
      </section>

      <section className="ronin-sheet-panel">
        <div className="ronin-sheet-panel-heading">
          <h3>{t('workspace.ronin_allies')}</h3>
          {!readOnly && <button type="button" onClick={addAlly}><Plus size={14} />{t('workspace.ronin_add_ally')}</button>}
        </div>
        <div className="ronin-sheet-scroll-list">
          {snapshot.allies.length === 0 && <p className="ronin-sheet-empty">{t('workspace.ronin_allies_empty')}</p>}
          <div className="ronin-sheet-allies">
            {snapshot.allies.slice(0, visibleAllies).map((ally, index) => (
              <article key={ally.id} className="ronin-sheet-entry">
                <header>
                  <strong>{ally.name || `${t('workspace.ronin_ally')} ${index + 1}`}</strong>
                  <div>
                    <button type="button" onClick={() => openImage({ kind: 'ally', id: ally.id }, ally.assetPath)} disabled={readOnly && !ally.assetPath} aria-label={t('workspace.ronin_image')}><ImageIcon size={14} /></button>
                    {!readOnly && <button type="button" onClick={() => requestRemove('ally', ally)} aria-label={t('common.delete')}><Trash2 size={14} /></button>}
                  </div>
                </header>
                <Field label={t('workspace.ronin_name')} value={ally.name} onChange={value => updateListText(yState.allies, ally.id, 'name', value)} readOnly={readOnly} />
                <Field label={t('workspace.ronin_technique')} value={ally.technique} onChange={value => updateListText(yState.allies, ally.id, 'technique', value)} readOnly={readOnly} />
                <Field label={t('workspace.ronin_occupation')} value={ally.occupation} onChange={value => updateListText(yState.allies, ally.id, 'occupation', value)} readOnly={readOnly} />
                <Segments label={t('workspace.ronin_ally_status')} value={ally.status} options={allyStatusOptions} onChange={value => updateListValue(yState.allies, ally.id, 'status', value)} readOnly={readOnly} />
              </article>
            ))}
          </div>
          <div ref={allySentinelRef} className="ronin-sheet-sentinel">
            {visibleAllies < snapshot.allies.length && <button type="button" onClick={showMoreAllies}>{t('workspace.ronin_show_more')}</button>}
          </div>
        </div>
      </section>

      <section className="ronin-sheet-panel">
        <div className="ronin-sheet-panel-heading">
          <h3>{t('workspace.ronin_enemies')}</h3>
          {!readOnly && <button type="button" onClick={addEnemy}><Plus size={14} />{t('workspace.ronin_add_enemy')}</button>}
        </div>
        <div className="ronin-sheet-scroll-list">
          {snapshot.enemies.length === 0 && <p className="ronin-sheet-empty">{t('workspace.ronin_enemies_empty')}</p>}
          <div className="ronin-sheet-enemies">
            {snapshot.enemies.slice(0, visibleEnemies).map((enemy, index) => (
              <article key={enemy.id} className="ronin-sheet-enemy">
                <span>{index + 1}</span>
                <Field label={t('workspace.ronin_name')} value={enemy.name} onChange={value => updateListText(yState.enemies, enemy.id, 'name', value)} readOnly={readOnly} />
                <Field label={t('workspace.ronin_combat')} value={enemy.combat} onChange={value => updateListText(yState.enemies, enemy.id, 'combat', value)} readOnly={readOnly} />
                <Field label={t('workspace.ronin_blocks')} value={enemy.blocks} onChange={value => updateListText(yState.enemies, enemy.id, 'blocks', value)} readOnly={readOnly} />
                <button type="button" onClick={() => openImage({ kind: 'enemy', id: enemy.id }, enemy.assetPath)} disabled={readOnly && !enemy.assetPath} aria-label={t('workspace.ronin_image')}><ImageIcon size={14} /></button>
                {!readOnly && <button type="button" onClick={() => requestRemove('enemy', enemy)} aria-label={t('common.delete')}><Trash2 size={14} /></button>}
              </article>
            ))}
          </div>
          <div ref={enemySentinelRef} className="ronin-sheet-sentinel">
            {visibleEnemies < snapshot.enemies.length && <button type="button" onClick={showMoreEnemies}>{t('workspace.ronin_show_more')}</button>}
          </div>
        </div>
      </section>

      <section className="ronin-sheet-villains">
        {snapshot.villains.map((villain, index) => {
          const expanded = expandedVillains.has(villain.id)
          const isFinal = villain.id === 'final-villain'
          return (
            <article key={villain.id} className={`ronin-sheet-panel ronin-sheet-villain ${expanded ? 'is-expanded' : ''}`}>
              <button
                type="button"
                className="ronin-sheet-villain-toggle"
                onClick={() => setExpandedVillains(current => {
                  const next = new Set(current)
                  if (next.has(villain.id)) next.delete(villain.id)
                  else next.add(villain.id)
                  return next
                })}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <strong>{isFinal ? t('workspace.ronin_final_villain') : `${t('workspace.ronin_villain')} ${index + 1}`}</strong>
                <span>{villain.name || t('workspace.ronin_unnamed')}</span>
                {villain.status && <small>{villainStatusOptions.find(option => option.value === villain.status)?.label}</small>}
              </button>
              {expanded && (
                <div className="ronin-sheet-villain-body">
                  <Portrait
                    assetPath={villain.assetPath}
                    alt={villain.name}
                    getAssetUrl={getAssetUrl}
                    onOpen={() => openImage({ kind: 'villain', id: villain.id }, villain.assetPath)}
                    readOnly={readOnly}
                    label={t('workspace.ronin_add_image')}
                  />
                  <div>
                    <Field label={t('workspace.ronin_name')} value={villain.name} onChange={value => setTextValue(yState.villains.get(villain.id), 'name', value)} readOnly={readOnly} />
                    <Field label={t('workspace.ronin_technique')} value={villain.technique} onChange={value => setTextValue(yState.villains.get(villain.id), 'technique', value)} readOnly={readOnly} />
                    <div className="ronin-sheet-field-row">
                      <Field label={t('workspace.ronin_combat')} value={villain.combat} onChange={value => setTextValue(yState.villains.get(villain.id), 'combat', value)} readOnly={readOnly} />
                      <Field label={t('workspace.ronin_block')} value={villain.block} onChange={value => setTextValue(yState.villains.get(villain.id), 'block', value)} readOnly={readOnly} />
                    </div>
                    {isFinal && <Field label={t('workspace.ronin_advantage')} value={villain.advantage} onChange={value => setTextValue(yState.villains.get(villain.id), 'advantage', value)} readOnly={readOnly} />}
                    <Segments label={t('workspace.ronin_villain_status')} value={villain.status} options={villainStatusOptions} onChange={value => setMapValue(yState.villains.get(villain.id), 'status', value)} readOnly={readOnly} />
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </section>

      <ImageDialog
        dialog={imageDialog}
        images={assetImages}
        getAssetUrl={getAssetUrl}
        onRemove={removeImage}
        onChange={changeImage}
        onClose={() => setImageDialog(null)}
        readOnly={readOnly}
      />
      {confirmDelete && <ConfirmDialog onConfirm={confirmDelete.remove} onClose={() => setConfirmDelete(null)} />}
    </div>
  )
}

import { forwardRef, useId } from 'react'
import { FilePenLine, FileText, Map, Shapes } from 'lucide-react'

const STABLE_TAB_TYPES = [
  { id: 'wiki', icon: FileText, labelKey: 'notion', hintKey: 'notionHint' },
  { id: 'markdown', icon: FilePenLine, labelKey: 'markdown', hintKey: 'markdownHint' },
  { id: 'map', icon: Map, labelKey: 'map', hintKey: 'mapHint' },
  { id: 'board', icon: Shapes, labelKey: 'board', hintKey: 'boardHint' }
]

function TabTypeButton({ type, labels, disabled, onSelect, buttonRef }) {
  const Icon = type.icon
  const hintId = `${labels.idPrefix}-${type.id}-hint`

  return (
    <button
      ref={buttonRef}
      type="button"
      className="tab-type-option"
      data-tab-type={type.id}
      onClick={() => onSelect(type.id)}
      disabled={disabled}
      aria-describedby={hintId}
    >
      <span className="tab-type-option-icon" aria-hidden="true"><Icon size={17} /></span>
      <span className="tab-type-option-copy">
        <strong>
          {labels[type.labelKey]}
        </strong>
        <small id={hintId}>{labels[type.hintKey]}</small>
      </span>
    </button>
  )
}

const TabTypeSelector = forwardRef(function TabTypeSelector({ labels, creating = false, onSelect }, firstOptionRef) {
  const titleId = useId()
  const descriptionId = useId()
  const idPrefix = useId().replaceAll(':', '')
  const typeLabels = { ...labels, idPrefix }
  return (
    <section className="tab-type-selector" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={creating}>
      <header className="tab-type-selector-header">
        <h2 id={titleId}>{labels.title}</h2>
        <p id={descriptionId}>{labels.description}</p>
      </header>

      <div className="tab-type-stable-grid" role="group" aria-label={labels.stableGroup}>
        {STABLE_TAB_TYPES.map((type, index) => (
          <TabTypeButton
            key={type.id}
            type={type}
            labels={typeLabels}
            disabled={creating}
            onSelect={onSelect}
            buttonRef={index === 0 ? firstOptionRef : undefined}
          />
        ))}
      </div>

      {creating && <div className="tab-type-creating" role="status" aria-live="polite"><span aria-hidden="true" />{labels.creating}</div>}
    </section>
  )
})

export default TabTypeSelector

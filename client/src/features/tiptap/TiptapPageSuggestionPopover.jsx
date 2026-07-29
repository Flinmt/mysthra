import { FileText, Link2, X } from 'lucide-react'

export default function TiptapPageSuggestionPopover({
  suggestion,
  selectedTabUid,
  position,
  labels,
  onSelect,
  onCreateLink,
  onClose,
  onPointerEnter,
  onPointerLeave
}) {
  if (!suggestion) return null
  const candidates = suggestion.candidates || []
  const selected = candidates.find(candidate => candidate.tabUid === selectedTabUid) || candidates[0]
  if (!selected) return null
  const getContext = candidate => {
    const type = labels.tabTypes?.[candidate.contentType] || candidate.contentType
    return [candidate.documentPath, type].filter(Boolean).join(' · ')
  }

  return (
    <div
      className="tiptap-page-suggestion-popover"
      data-placement={position.placement}
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        transform: position.placement === 'above' ? 'translateY(-100%)' : undefined
      }}
      role="dialog"
      aria-label={labels.resultLabel}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="tiptap-page-suggestion-popover-header">
        <span>
          {candidates.length > 1
            ? labels.multiplePages.replace('{{count}}', candidates.length)
            : labels.resultLabel}
        </span>
        <button type="button" onClick={onClose} aria-label={labels.close}>
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="tiptap-page-suggestion-candidates" role="listbox" aria-label={labels.choosePage}>
        {candidates.map(candidate => (
          <button
            key={candidate.tabUid}
            type="button"
            className={candidate.tabUid === selected.tabUid ? 'is-selected' : ''}
            onClick={() => onSelect(candidate.tabUid)}
            role="option"
            aria-selected={candidate.tabUid === selected.tabUid}
          >
            <FileText size={13} aria-hidden="true" />
            <span>
              <strong>{candidate.title}</strong>
              <small>{getContext(candidate)}</small>
            </span>
          </button>
        ))}
      </div>

      <button
        className="tiptap-page-suggestion-create"
        type="button"
        onClick={() => onCreateLink(selected)}
      >
        <Link2 size={13} aria-hidden="true" />
        {labels.createLink}
      </button>
    </div>
  )
}

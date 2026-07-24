import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'
import {
  filterDocumentIconCategories,
  getDocumentIconPickerPosition
} from './documentIconPickerUtils'

export default function DocumentIconPicker({
  anchorRef,
  categories,
  currentIcon,
  documentName,
  query,
  saving,
  labels,
  getCategoryLabel,
  onQueryChange,
  onSelect,
  onClose
}) {
  const panelRef = useRef(null)
  const searchRef = useRef(null)
  const [position, setPosition] = useState(null)
  const filteredCategories = useMemo(
    () => filterDocumentIconCategories(categories, query),
    [categories, query]
  )
  const resultCount = filteredCategories.reduce(
    (total, category) => total + category.icons.length,
    0
  )
  const currentOption = categories
    .flatMap(category => category.icons)
    .find(option => option.key === currentIcon)
  const CurrentIcon = currentOption?.icon || categories[0]?.icons[0]?.icon

  const updatePosition = useCallback(() => {
    const trigger = anchorRef.current
    if (!trigger) return
    setPosition(getDocumentIconPickerPosition(
      trigger.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight }
    ))
  }, [anchorRef])

  useLayoutEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const handleKeyDown = event => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (query) onQueryChange('')
    else onClose()
  }

  return (
    <>
      <div className="document-icon-picker-backdrop" onMouseDown={onClose} />
      <section
        ref={panelRef}
        className="document-icon-picker"
        data-placement={position?.placement}
        role="dialog"
        aria-label={labels.title}
        aria-busy={saving}
        style={{
          top: position?.top,
          left: position?.left,
          width: position?.width,
          maxHeight: position?.maxHeight,
          visibility: position ? 'visible' : 'hidden'
        }}
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="document-icon-picker-header">
          <span className="document-icon-picker-preview" aria-hidden="true">
            {CurrentIcon && <CurrentIcon size={16} />}
          </span>
          <span className="document-icon-picker-heading">
            <strong>{labels.title}</strong>
            <small>{documentName}</small>
          </span>
          {saving && (
            <span className="document-icon-picker-saving" title={labels.saving}>
              <LoaderCircle size={14} />
            </span>
          )}
          <button
            type="button"
            className="document-icon-picker-close"
            onClick={onClose}
            aria-label={labels.close}
            title={labels.close}
          >
            <X size={14} />
          </button>
        </header>

        <div className="document-icon-picker-search">
          <Search size={14} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label={labels.clear}
              title={labels.clear}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="document-icon-picker-body">
          {resultCount === 0 ? (
            <div className="document-icon-picker-empty" role="status">
              <Search size={18} />
              <strong>{labels.empty}</strong>
              <span>{labels.emptyHint}</span>
            </div>
          ) : (
            filteredCategories.map(category => (
              <section key={category.id} className="document-icon-picker-category">
                <h3>{getCategoryLabel(category.labelKey)}</h3>
                <div className="document-icon-picker-grid">
                  {category.icons.map(({ key, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className="document-icon-picker-option"
                      aria-label={key}
                      aria-pressed={currentIcon === key}
                      title={key}
                      disabled={saving}
                      onClick={() => onSelect(key)}
                    >
                      <Icon size={17} />
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </>
  )
}

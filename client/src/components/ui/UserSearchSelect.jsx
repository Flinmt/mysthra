import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, UserRound } from 'lucide-react'

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function UserSearchSelect({ value, onChange, options, placeholder, emptyLabel, listLabel, openLabel, closeLabel, disabled = false }) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedOption = options.find(option => option.value === value) || null

  const filteredOptions = useMemo(() => {
    const normalized = normalizeSearch(query)
    if (!normalized) return options
    return options.filter(option => normalizeSearch(option.label).includes(normalized))
  }, [options, query])

  useEffect(() => {
    setQuery(selectedOption?.label || '')
  }, [selectedOption?.label])

  useEffect(() => {
    const handleOutsidePointer = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [])

  useEffect(() => {
    if (activeIndex >= filteredOptions.length) setActiveIndex(filteredOptions.length - 1)
  }, [activeIndex, filteredOptions.length])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current
      ?.querySelector(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const selectOption = option => {
    onChange(option.value)
    setQuery(option.label)
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = event => {
    if (disabled) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (filteredOptions.length > 0) setActiveIndex(index => index >= filteredOptions.length - 1 ? 0 : index + 1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (filteredOptions.length > 0) setActiveIndex(index => index <= 0 ? filteredOptions.length - 1 : index - 1)
      return
    }
    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault()
      selectOption(filteredOptions[activeIndex])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const activeOptionId = open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined

  return (
    <div ref={rootRef} className={`world-user-search${disabled ? ' is-disabled' : ''}`}>
      <div className={`world-user-search-control${open ? ' is-open' : ''}`}>
        <UserRound size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={activeOptionId}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onChange={event => {
            setQuery(event.target.value)
            if (value) onChange('')
            setOpen(true)
            setActiveIndex(-1)
          }}
          onClick={() => {
            if (!disabled) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? closeLabel : openLabel}
          onClick={() => {
            if (disabled) return
            setOpen(previous => !previous)
            setActiveIndex(-1)
            inputRef.current?.focus()
          }}
        >
          <ChevronDown size={14} className={open ? 'open' : ''} />
        </button>
      </div>

      {open && (
        <div ref={listRef} id={listId} className="world-user-search-list" role="listbox" aria-label={listLabel}>
          {filteredOptions.length === 0 ? (
            <div className="world-user-search-empty">{emptyLabel}</div>
          ) : filteredOptions.map((option, index) => {
            const selected = option.value === value
            return (
              <button
                id={`${listId}-option-${index}`}
                data-option-index={index}
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${selected ? 'selected' : ''}${activeIndex === index ? ' active' : ''}`}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span className="world-user-search-avatar" aria-hidden="true">{option.label.slice(0, 1).toUpperCase()}</span>
                <strong>{option.label}</strong>
                {selected && <Check size={13} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

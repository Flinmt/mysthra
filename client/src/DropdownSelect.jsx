import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export default function DropdownSelect({ value, onChange, options, placeholder, disabled, className }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const selected = options.find(opt => opt.value === value)

  return (
    <div ref={ref} className={`dropdown-select${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="dropdown-select-trigger"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className={`dropdown-select-chevron${isOpen ? ' open' : ''}`} />
      </button>
      {isOpen && (
        <div className="dropdown-select-menu" role="listbox">
          {options.length === 0 ? (
            <div className="dropdown-select-empty">—</div>
          ) : (
            options.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="option"
                className={`dropdown-select-option${opt.value === value ? ' active' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onChange(opt.value)
                  setIsOpen(false)
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

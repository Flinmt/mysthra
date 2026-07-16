import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function WorldDialog({ title, description, onClose, busy = false, tone = 'default', className = '', style, children }) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  const dialogRef = useRef(null)

  useEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  }, [busy, onClose])

  useEffect(() => {
    const opener = document.activeElement
    const handleDialogKeys = event => {
      if (event.key === 'Escape' && !busyRef.current) {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleDialogKeys)
    const initialFocus = dialogRef.current?.querySelector('input:not(:disabled)') || dialogRef.current?.querySelector('button:not(:disabled)')
    initialFocus?.focus()
    return () => {
      document.removeEventListener('keydown', handleDialogKeys)
      opener?.focus?.()
    }
  }, [])

  return (
    <div
      className="world-dialog-backdrop"
      onPointerDown={event => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className={`world-dialog ${tone === 'danger' ? 'is-danger' : ''} ${className}`.trim()}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="world-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button type="button" className="world-dialog-close" onClick={onClose} disabled={busy} aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

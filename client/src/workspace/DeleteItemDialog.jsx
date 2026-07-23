import { useEffect, useId, useRef } from 'react'
import { Trash2, X } from 'lucide-react'

export default function DeleteItemDialog({
  item,
  icon,
  deleting = false,
  labels,
  onCancel,
  onConfirm
}) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  const warningId = useId()

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        if (!deleting) onCancel()
        return
      }
      if (event.key !== 'Tab') return

      const controls = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled)') || [])
      if (controls.length === 0) return
      const firstControl = controls[0]
      const lastControl = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault()
        lastControl.focus()
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault()
        firstControl.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleting, onCancel])

  return (
    <div
      className="delete-item-dialog-overlay"
      onPointerDown={event => {
        if (event.target === event.currentTarget && !deleting) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        className="delete-item-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descriptionId} ${warningId}`}
        aria-busy={deleting}
      >
        <button
          type="button"
          className="delete-item-dialog-close"
          onClick={onCancel}
          disabled={deleting}
          aria-label={labels.close}
          title={labels.close}
        >
          <X size={15} />
        </button>

        <header className="delete-item-dialog-header">
          <span className="delete-item-dialog-mark" aria-hidden="true">
            <Trash2 size={17} />
          </span>
          <div>
            <h2 id={titleId}>{labels.title}</h2>
            <p id={descriptionId}>{labels.description}</p>
          </div>
        </header>

        <div className="delete-item-dialog-preview">
          <span aria-hidden="true">{icon}</span>
          <strong title={item.name}>{item.name}</strong>
        </div>

        <p id={warningId} className="delete-item-dialog-warning">{labels.warning}</p>

        <footer className="delete-item-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="delete-item-dialog-cancel"
            onClick={onCancel}
            disabled={deleting}
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            className="delete-item-dialog-confirm"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <span className="delete-item-dialog-spinner" aria-hidden="true" /> : <Trash2 size={14} />}
            <span>{deleting ? labels.deleting : labels.confirm}</span>
          </button>
        </footer>
      </section>
    </div>
  )
}

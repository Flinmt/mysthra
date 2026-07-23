import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CircleCheck, Info, X } from 'lucide-react'

const TOAST_EXIT_DURATION = 160

const TOAST_ICONS = {
  success: CircleCheck,
  error: AlertTriangle,
  info: Info
}

function WorkspaceToast({ toast, closeLabel, onDismiss }) {
  const [isHovered, setIsHovered] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const remainingRef = useRef(toast.duration)
  const startedAtRef = useRef(null)
  const paused = isHovered || hasFocus
  const ToastIcon = TOAST_ICONS[toast.type] || TOAST_ICONS.info

  const beginDismiss = useCallback(() => {
    setIsLeaving(true)
  }, [])

  useEffect(() => {
    if (paused || isLeaving) return undefined

    startedAtRef.current = Date.now()
    const timer = window.setTimeout(beginDismiss, remainingRef.current)
    return () => {
      window.clearTimeout(timer)
      if (startedAtRef.current !== null) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current))
        startedAtRef.current = null
      }
    }
  }, [beginDismiss, isLeaving, paused])

  useEffect(() => {
    if (!isLeaving) return undefined
    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_EXIT_DURATION)
    return () => window.clearTimeout(timer)
  }, [isLeaving, onDismiss, toast.id])

  return (
    <article
      className={`workspace-toast is-${toast.type} ${paused ? 'is-paused' : ''} ${isLeaving ? 'is-leaving' : ''}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      style={{ '--toast-duration': `${toast.duration}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false)
      }}
    >
      <span className="workspace-toast-icon" aria-hidden="true">
        <ToastIcon size={15} />
      </span>
      <span className="workspace-toast-message">{toast.message}</span>
      <button type="button" className="workspace-toast-close" onClick={beginDismiss} aria-label={closeLabel} title={closeLabel}>
        <X size={13} />
      </button>
      <span className="workspace-toast-progress" aria-hidden="true" />
    </article>
  )
}

export default function WorkspaceToastRegion({ toasts, closeLabel, onDismiss }) {
  return (
    <div className="workspace-toast-region">
      {toasts.map(toast => (
        <WorkspaceToast key={toast.id} toast={toast} closeLabel={closeLabel} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

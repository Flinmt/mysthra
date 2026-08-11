import { useLayoutEffect, useRef, useState } from 'react'

export function useStableTiptapControls(editor, document) {
  const nextIdRef = useRef(0)
  const [session, setSession] = useState(null)

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) {
      setSession(null)
      return undefined
    }

    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      if (cancelled || editor.isDestroyed) return
      setSession(current => current?.editor === editor
        ? current
        : { id: ++nextIdRef.current, editor })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [document, editor])

  return session
}

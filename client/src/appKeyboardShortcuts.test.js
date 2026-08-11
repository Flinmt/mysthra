import { describe, expect, it } from 'vitest'
import { preventNativeSelectAll } from './appKeyboardShortcuts'

function keyboardEvent(overrides = {}) {
  return new KeyboardEvent('keydown', {
    key: 'a', ctrlKey: true, cancelable: true, ...overrides
  })
}

describe('application keyboard shortcuts', () => {
  it('prevents the browser native Ctrl+A selection globally', () => {
    const event = keyboardEvent()

    preventNativeSelectAll(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('prevents the browser native Cmd+A selection globally', () => {
    const event = keyboardEvent({ ctrlKey: false, metaKey: true })

    preventNativeSelectAll(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not consume unrelated shortcuts', () => {
    const event = keyboardEvent({ key: 'c' })

    preventNativeSelectAll(event)

    expect(event.defaultPrevented).toBe(false)
  })
})

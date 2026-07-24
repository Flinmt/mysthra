import { describe, expect, it } from 'vitest'
import { getTiptapMenuPosition } from './tiptapMenuPosition'

describe('Tiptap slash menu positioning', () => {
  it('opens below the cursor when the menu fits', () => {
    expect(getTiptapMenuPosition(
      { top: 120, bottom: 140, left: 100 },
      { width: 1280, height: 800 }
    )).toEqual({
      placement: 'below',
      top: 146,
      left: 100,
      maxHeight: 220
    })
  })

  it('opens above the cursor near the bottom of the viewport', () => {
    expect(getTiptapMenuPosition(
      { top: 680, bottom: 700, left: 100 },
      { width: 1280, height: 720 }
    )).toEqual({
      placement: 'above',
      top: 674,
      left: 100,
      maxHeight: 220
    })
  })

  it('constrains the menu to the viewport on cramped screens', () => {
    expect(getTiptapMenuPosition(
      { top: 90, bottom: 110, left: 500 },
      { width: 320, height: 180 }
    )).toEqual({
      placement: 'above',
      top: 84,
      left: 26,
      maxHeight: 76
    })
  })
})

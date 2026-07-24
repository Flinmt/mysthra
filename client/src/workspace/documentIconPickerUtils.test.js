import { describe, expect, it } from 'vitest'
import {
  filterDocumentIconCategories,
  getDocumentIconPickerPosition
} from './documentIconPickerUtils'

const categories = [{
  id: 'world',
  labelKey: 'world',
  icons: [
    { key: 'Castle', aliases: ['castelo', 'fortaleza'] },
    { key: 'Map', aliases: ['mapa'] }
  ]
}]

describe('document icon picker utilities', () => {
  it('filters icons by normalized bilingual aliases', () => {
    expect(filterDocumentIconCategories(categories, 'castélo')[0].icons).toEqual([
      expect.objectContaining({ key: 'Castle' })
    ])
    expect(filterDocumentIconCategories(categories, 'mapa')[0].icons).toEqual([
      expect.objectContaining({ key: 'Map' })
    ])
  })

  it('opens below when space is available and clamps horizontally', () => {
    expect(getDocumentIconPickerPosition(
      { top: 40, bottom: 64, left: 760 },
      { width: 800, height: 700 }
    )).toMatchObject({
      placement: 'below',
      left: 430,
      top: 72,
      width: 360,
      maxHeight: 440
    })
  })

  it('flips above and limits its height to the viewport', () => {
    const position = getDocumentIconPickerPosition(
      { top: 500, bottom: 524, left: 20 },
      { width: 800, height: 560 }
    )

    expect(position.placement).toBe('above')
    expect(position.top).toBe(52)
    expect(position.maxHeight).toBe(440)
  })
})

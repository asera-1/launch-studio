import { describe, it, expect } from 'vitest'
import { darken, contrastRatio, themeFromColors } from './color'

describe('darken', () => {
  it('returns a hex string', () => {
    const out = darken('#5CA8FF', 0.4)
    expect(out).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('produces a darker color than the input', () => {
    const input = '#5CA8FF'
    const out = darken(input, 0.4)
    const sum = (h: string) => {
      const n = parseInt(h.replace('#', ''), 16)
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)
    }
    expect(sum(out)).toBeLessThan(sum(input))
  })
})

describe('contrastRatio', () => {
  it('black vs white is approximately 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#000000'),
      5,
    )
  })
})

describe('themeFromColors', () => {
  it('returns an object with the expected keys', () => {
    const theme = themeFromColors('#5CA8FF', '#16213A')
    expect(theme).toHaveProperty('fontFamily')
    expect(theme).toHaveProperty('headlineColor')
    expect(theme).toHaveProperty('gradient')
    expect(theme).toHaveProperty('background')
    expect(Array.isArray(theme.gradient)).toBe(true)
    expect(theme.gradient).toHaveLength(2)
    expect(theme.headlineColor).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

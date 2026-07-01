import { describe, it, expect } from 'vitest'
import { allTargets } from './targets'

describe('allTargets', () => {
  it('contains exactly 6 targets', () => {
    expect(allTargets).toHaveLength(6)
  })

  it('every target has positive dimensions and non-empty label/folder', () => {
    for (const t of allTargets) {
      expect(t.width).toBeGreaterThan(0)
      expect(t.height).toBeGreaterThan(0)
      expect(typeof t.label).toBe('string')
      expect(t.label.length).toBeGreaterThan(0)
      expect(typeof t.folder).toBe('string')
      expect(t.folder.length).toBeGreaterThan(0)
    }
  })

  it('has an App Store iPhone 6.9" entry sized 1290x2796', () => {
    const t = allTargets.find((x) => x.id === 'appstore-iphone-69')
    expect(t).toBeDefined()
    expect(t!.width).toBe(1290)
    expect(t!.height).toBe(2796)
  })
})

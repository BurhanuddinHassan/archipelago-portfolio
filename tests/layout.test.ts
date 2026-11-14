import { describe, expect, it } from 'vitest'
import { ISLANDS, MOOR_DIR, MOOR_DIST, STOPS, islandById, rimRadius, solidSpots } from '../src/world/layout'

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('world layout', () => {
  it('has eleven stops, each on an island that exists', () => {
    expect(STOPS).toHaveLength(11)
    for (const s of STOPS) expect(ISLANDS.some((i) => i.id === s.island)).toBe(true)
  })

  it('islands do not overlap', () => {
    for (const a of ISLANDS) for (const b of ISLANDS) if (a.id < b.id) expect(dist([a.position[0], a.position[2]], [b.position[0], b.position[2]]), `${a.id} / ${b.id}`).toBeGreaterThan((a.radius + b.radius) * 0.8)
  })

  it('every stop and its mooring are inside the island’s rim', () => {
    for (const s of STOPS) {
      const def = islandById(s.island), moor = [s.offset[0] + MOOR_DIR[0] * MOOR_DIST, s.offset[1] + MOOR_DIR[1] * MOOR_DIST]
      for (const p of [s.offset, moor]) expect(Math.hypot(p[0], p[1]), s.id).toBeLessThan(rimRadius(def, Math.atan2(p[1], p[0])) * 0.95)
    }
  })

  it('no stop is inside something solid (the Pilot must be able to stand there)', () => {
    for (const s of STOPS) for (const [x, z, r] of solidSpots(islandById(s.island))) expect(dist(s.offset, [x, z]), `${s.id} vs solid at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBeGreaterThan(r + 0.38)
  })

  it('every solid object is on its island, not floating past the rim', () => {
    for (const def of ISLANDS) for (const [x, z] of solidSpots(def)) expect(Math.hypot(x, z), def.id).toBeLessThan(rimRadius(def, Math.atan2(z, x)) * 1.02)
  })

  it('every island has things to bump into in Adventure Mode', () => {
    for (const def of ISLANDS) expect(solidSpots(def).length, def.id).toBeGreaterThan(2)
  })
})

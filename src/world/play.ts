import { create } from 'zustand'
import { STOPS, clearSpots, groundY, islandSeed, rimRadius, waterfallSpot, type IslandDef } from './layout'
import { useStore } from '../store'
import { sfx } from '../audio'

/**
 * The game layer of Adventure Mode: things to do on each island.
 *  - Spots: places where the action button does something ("Cast a line", "Strike the anvil").
 *  - Golden gears: five hidden on every island, picked up by walking into them.
 *  - Stamps: one per island, earned by finishing that island's activity.
 * Progress is saved in the browser, so it is still there on the next visit.
 */

/** How long the Harbor crane takes to lower its line and wind it back. */
export const CAST_MS = 3400
export const GEARS_PER_ISLAND = 5
export const ISLAND_COUNT = 9

/* ---------------- progress ---------------- */

type Saved = { gears: string[]; stamps: string[] }
const load = (): Saved => {
  try {
    const s = JSON.parse(localStorage.getItem('play2') ?? '{}')
    return { gears: Array.isArray(s.gears) ? s.gears : [], stamps: Array.isArray(s.stamps) ? s.stamps : [] }
  } catch {
    return { gears: [], stamps: [] }
  }
}
const save = (s: Saved) => {
  try {
    localStorage.setItem('play2', JSON.stringify(s))
  } catch {
    /* private browsing: progress just lasts for this visit */
  }
}

type Play = Saved & { collect: (id: string) => void; stamp: (island: string, message: string) => void; reset: () => void }

export const usePlay = create<Play>((set, get) => {
  const finish = () => {
    const { gears, stamps } = get()
    save({ gears, stamps })
    if (gears.length >= GEARS_PER_ISLAND * ISLAND_COUNT && stamps.length >= ISLAND_COUNT) {
      window.setTimeout(() => useStore.getState().showToast('Archipelago complete: every gear and every stamp. Thanks for exploring it all.'), 2600)
      emote('cheer', 3)
    }
  }
  return {
    ...load(),
    collect: (id) => {
      if (get().gears.includes(id)) return
      set({ gears: [...get().gears, id] })
      sfx('gear')
      const island = id.split(':')[0], have = get().gears.filter((g) => g.startsWith(island + ':')).length
      if (have === GEARS_PER_ISLAND) useStore.getState().showToast('All five gears on this island found.')
      finish()
    },
    stamp: (island, message) => {
      const first = !get().stamps.includes(island)
      if (first) set({ stamps: [...get().stamps, island] })
      useStore.getState().showToast(first ? `★ Stamp earned. ${message}` : message)
      if (first) sfx('stamp')
      finish()
    },
    reset: () => {
      set({ gears: [], stamps: [] })
      save({ gears: [], stamps: [] })
    },
  }
})

/* ---------------- things the action button can do ---------------- */

export type Spot = {
  island: string
  /** Island-local position. */
  xz: [number, number]
  /** How close the Pilot has to be. */
  reach: number
  /** What the button says right now; null hides the spot. */
  label: () => string | null
  use: () => void
}

const spots = new Set<Spot>()
export function addSpots(list: Spot[]) {
  list.forEach((s) => spots.add(s))
  return () => list.forEach((s) => spots.delete(s))
}
/** The closest usable spot to a point on an island, with its current label. */
export function spotNear(island: string, x: number, z: number): { spot: Spot; label: string; dist: number } | null {
  let best: { spot: Spot; label: string; dist: number } | null = null
  for (const s of spots) {
    if (s.island !== island) continue
    const d = Math.hypot(s.xz[0] - x, s.xz[1] - z)
    if (d > s.reach || (best && d >= best.dist)) continue
    const label = s.label()
    if (label) best = { spot: s, label, dist: d }
  }
  return best
}

/* ---------------- requests to the Pilot rig ---------------- */

export const game = {
  /** An animation to hold until the Pilot moves (sit) or the time runs out (cheer). */
  emote: null as null | { pose: 'cheer' | 'sit'; left: number },
  /** Put the Pilot somewhere on his current island (island-local), e.g. after being caught. */
  teleport: null as null | { island: string; xz: [number, number] },
  /** Merge Defence: a power-up (0 shield, 1 rapid fire, 2 fire power) the player just triggered at a shrine. */
  mergePower: -1,
  /** The Harbor: when the crane's line was last cast (performance.now()). */
  harborCast: -1e9,
}
export const emote = (pose: 'cheer' | 'sit', seconds = 2.4) => void (game.emote = { pose, left: pose === 'sit' ? Infinity : seconds })

const caughtListeners = new Set<(island: string) => void>()
export const onCaught = (fn: (island: string) => void) => {
  caughtListeners.add(fn)
  return () => void caughtListeners.delete(fn)
}
/** An enemy got the Pilot: back to where he landed. Only counts while the player is in control. */
export function caught(island: string) {
  if (useStore.getState().mode !== 'adventure') return
  const stop = STOPS.find((s) => s.island === island)
  if (!stop) return
  game.teleport = { island, xz: [stop.offset[0], stop.offset[1]] }
  useStore.getState().showToast('Spotted! The soldier marched you back to where you landed.')
  sfx('caught')
  caughtListeners.forEach((fn) => fn(island))
}

/* ---------------- where the gears hide ---------------- */

/**
 * Five places on an island for the gears: on open grass, away from buildings, props, paths, ponds, the tour stops and
 * each other. The same every visit. The clearings round landmarks are avoided too, so no gear ends up inside one.
 */
export function gearSpots(def: IslandDef, solids: [number, number, number][]): [number, number, number][] {
  let seed = islandSeed(def.id) * 7919 + 13
  const rnd = () => ((seed = (seed * 16807) % 2147483647) & 0xffff) / 0xffff
  const keepOut = clearSpots(def), pond = waterfallSpot(def)?.pond
  const out: [number, number, number][] = []
  for (let tries = 0; tries < 4000 && out.length < GEARS_PER_ISLAND; tries++) {
    const strict = tries < 3000 // if the island is too crowded for five strict spots, allow the clearings
    const a = rnd() * Math.PI * 2, r = rimRadius(def, a) * (0.25 + rnd() * 0.57), x = Math.cos(a) * r, z = Math.sin(a) * r
    if (solids.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + 1.1)) continue
    if (strict && keepOut.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + 0.3)) continue
    if (pond && Math.hypot(x - pond[0], z - pond[1]) < 3) continue
    if (STOPS.some((s) => s.island === def.id && Math.hypot(x - s.offset[0], z - s.offset[1]) < 3)) continue
    if (out.some(([ox, , oz]) => Math.hypot(x - ox, z - oz) < 4)) continue
    out.push([x, groundY(def, x, z), z])
  }
  return out
}

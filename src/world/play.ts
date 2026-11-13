import { create } from 'zustand'
import { STOPS, groundY, islandSeed, rimRadius, type IslandDef } from './layout'
import { useStore } from '../store'

/**
 * The game layer of Adventure Mode: things to do on each island.
 *  - Spots: places where the action button does something ("Cast a line", "Strike the anvil").
 *  - Golden gears: five hidden on every island, picked up by walking into them.
 *  - Stamps: one per island, earned by finishing that island's activity.
 * Progress is saved in the browser, so it is still there on the next visit.
 */

export const GEARS_PER_ISLAND = 5
export const ISLAND_COUNT = 9

/* ---------------- progress ---------------- */

type Saved = { gears: string[]; stamps: string[] }
const load = (): Saved => {
  try {
    const s = JSON.parse(localStorage.getItem('play') ?? '{}')
    return { gears: Array.isArray(s.gears) ? s.gears : [], stamps: Array.isArray(s.stamps) ? s.stamps : [] }
  } catch {
    return { gears: [], stamps: [] }
  }
}
const save = (s: Saved) => {
  try {
    localStorage.setItem('play', JSON.stringify(s))
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
      const island = id.split(':')[0], have = get().gears.filter((g) => g.startsWith(island + ':')).length
      if (have === GEARS_PER_ISLAND) useStore.getState().showToast('All five gears on this island found.')
      finish()
    },
    stamp: (island, message) => {
      const first = !get().stamps.includes(island)
      if (first) set({ stamps: [...get().stamps, island] })
      useStore.getState().showToast(first ? `★ Stamp earned. ${message}` : message)
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
  caughtListeners.forEach((fn) => fn(island))
}

/* ---------------- where the gears hide ---------------- */

/** Five walkable places on an island, clear of anything solid and of the tour stops; the same every visit. */
export function gearSpots(def: IslandDef, solids: [number, number, number][]): [number, number, number][] {
  let seed = islandSeed(def.id) * 7919 + 13
  const rnd = () => ((seed = (seed * 16807) % 2147483647) & 0xffff) / 0xffff
  const stops = STOPS.filter((s) => s.island === def.id).map((s) => s.offset)
  const out: [number, number, number][] = []
  for (let tries = 0; tries < 600 && out.length < GEARS_PER_ISLAND; tries++) {
    const a = rnd() * Math.PI * 2, r = rimRadius(def, a) * (0.2 + rnd() * 0.62), x = Math.cos(a) * r, z = Math.sin(a) * r
    if (solids.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + 0.7)) continue
    if (stops.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 3)) continue
    if (out.some(([ox, , oz]) => Math.hypot(x - ox, z - oz) < 4.5 - tries * 0.005)) continue
    out.push([x, groundY(def, x, z), z])
  }
  return out
}

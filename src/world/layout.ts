/** World layout: where each island floats and where each tour stop stands. */
import { islandSurface, makeOutline } from './islandGen'

export type IslandDef = {
  id: string
  name: string
  position: [number, number, number]
  radius: number
  accent: string
  /** Mostly round leafy trees, or pines (cooler, higher islands). */
  flora: 'leafy' | 'pine' | 'mixed'
}

/** Everything in the base layout is multiplied by this: bigger islands, wider gaps, same-sized Pilot. */
export const WORLD_SCALE = 1.7
const S = WORLD_SCALE
const v = (x: number, y: number, z: number): [number, number, number] => [x * S, y * S, z * S]

export const ISLANDS: IslandDef[] = [
  { id: 'home', name: 'Home Isle', position: v(0, 0, 0), radius: 7 * S, accent: '#F26B3A', flora: 'leafy' },
  { id: 'behind-the-smile', name: 'Behind the Smile', position: v(-20, 3, -18), radius: 4.8 * S, accent: '#C94F6D', flora: 'mixed' },
  { id: 'chrono-rebellion', name: 'Chrono Rebellion', position: v(2, 5, -32), radius: 5 * S, accent: '#7B61C9', flora: 'pine' },
  { id: 'sunken-greed', name: 'Sunken Greed', position: v(24, -1, -20), radius: 4.8 * S, accent: '#2F8F9D', flora: 'leafy' },
  { id: 'paper-plane-dash', name: 'Paper Plane Dash', position: v(32, 4, 2), radius: 4.8 * S, accent: '#F2B33D', flora: 'mixed' },
  { id: 'merge-defence', name: 'Merge Defence', position: v(20, 1, 22), radius: 4.8 * S, accent: '#5DA05A', flora: 'leafy' },
  { id: 'harbor', name: 'The Harbor', position: v(-4, -1.5, 18), radius: 4.4 * S, accent: '#3E6E8E', flora: 'leafy' },
  { id: 'workshop', name: 'Workshop Isle', position: v(-24, 2, 10), radius: 4.4 * S, accent: '#B07A45', flora: 'pine' },
  { id: 'journey', name: 'Journey Isle', position: v(-30, 0, -6), radius: 4.8 * S, accent: '#8C8C3A', flora: 'mixed' },
]

export type StopDef = {
  id: string
  label: string
  island: string
  /** Where the Pilot stands, relative to the island centre (x, z). */
  offset: [number, number]
}

export const STOPS: StopDef[] = [
  { id: 'home', label: 'Home', island: 'home', offset: [1.5 * S, 2 * S] },
  { id: 'behind-the-smile', label: 'Behind the Smile', island: 'behind-the-smile', offset: [0, 1.2 * S] },
  { id: 'chrono-rebellion', label: 'Chrono Rebellion', island: 'chrono-rebellion', offset: [0, 1.2 * S] },
  { id: 'sunken-greed', label: 'Sunken Greed', island: 'sunken-greed', offset: [0, 1.2 * S] },
  { id: 'paper-plane-dash', label: 'Paper Plane Dash', island: 'paper-plane-dash', offset: [0, 1.2 * S] },
  { id: 'merge-defence', label: 'Merge Defence', island: 'merge-defence', offset: [0, 1.2 * S] },
  { id: 'harbor', label: 'More work', island: 'harbor', offset: [0, 1.2 * S] },
  { id: 'workshop', label: 'Skills', island: 'workshop', offset: [0, 1.2 * S] },
  { id: 'journey', label: 'Journey', island: 'journey', offset: [0, 1.2 * S] },
  { id: 'cinema', label: 'Trailer', island: 'home', offset: [-4.2 * S, -1.2 * S] },
  { id: 'contact', label: 'Contact', island: 'home', offset: [3.2 * S, -2.2 * S] },
]

export const islandById = (id: string) => ISLANDS.find((i) => i.id === id)!

/** Height of the island rim above its centre point; hills and the dome rise from here. */
export const ISLAND_TOP = 0.6

/**
 * The sky-ship moors beside the Pilot, to the right on screen: this is the camera's
 * horizontal "right" direction (the camera sits at +x/+z and looks back at the Pilot).
 */
export const MOOR_DIR: [number, number] = [0.806, -0.591]
export const MOOR_DIST = 3.0
/** Horizontal direction from a stop towards the camera; kept free of trees so nothing blocks the view. */
export const CAM_DIR: [number, number] = [0.59, 0.806]
/** Yaw that turns a landmark's front (+Z) towards the camera. */
export const FACE_YAW = Math.atan2(CAM_DIR[0], CAM_DIR[1])

const stopById = (id: string) => STOPS.find((s) => s.id === id)!
/** A point near a stop: `side` along the screen-right direction, `back` away from the camera (island-local x, z). */
function nearStop(id: string, side: number, back: number): [number, number] {
  const o = stopById(id).offset
  return [o[0] + MOOR_DIR[0] * side - CAM_DIR[0] * back, o[1] + MOOR_DIR[1] * side - CAM_DIR[1] * back]
}

/** Where each Home Isle piece stands (island-local x, z). */
export const HOME_PIECES = {
  // behind the Pilot at the Home stop; kept out of the Trailer and Contact sight-lines
  cottage: nearStop('home', -0.8, 5.6),
  screen: nearStop('cinema', 0, 3.2),
  benchL: nearStop('cinema', -1.7, 1.0),
  benchR: nearStop('cinema', 1.7, 1.0),
  postbox: nearStop('contact', -1.7, 0.5),
  arcade: nearStop('home', 1.2, 2.2),
}

/** Where the centrepiece of every other island stands: behind the Pilot and a little to the left, clear of the ship. */
export const CENTREPIECE: [number, number] = [-2.0 * S, -0.6 * S]

export const islandSeed = (id: string) => id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 100000

/** Islands with a waterfall, and the direction (angle in the x/z plane) it spills towards. */
const WATERFALLS: Record<string, number> = { home: 0.1, 'sunken-greed': -0.5, journey: -0.45 }

/** Where an island's waterfall leaves the rim, and the pond that feeds it (island-local). */
export function waterfallSpot(def: IslandDef) {
  const t = WATERFALLS[def.id]
  if (t === undefined) return null
  const lip = makeOutline(def.radius, islandSeed(def.id))(t) * 1.03
  return { t, lip, pond: [Math.cos(t) * lip * 0.74, Math.sin(t) * lip * 0.74] as [number, number] }
}

/** Spots on an island where nothing may grow: stops, the ship's mooring, and landmark footprints (x, z, radius). */
export function clearSpots(def: IslandDef): [number, number, number][] {
  const spots: [number, number, number][] = []
  for (const st of STOPS.filter((s) => s.island === def.id)) {
    spots.push([st.offset[0], st.offset[1], 1.4])
    spots.push([st.offset[0] + MOOR_DIR[0] * MOOR_DIST, st.offset[1] + MOOR_DIR[1] * MOOR_DIST, 2.8])
    // sight-line to the camera: a widening corridor of clear ground in front of the Pilot
    for (const [d, r] of [[3, 2.2], [6, 3.0], [9.5, 3.8], [13.5, 4.6]])
      spots.push([st.offset[0] + CAM_DIR[0] * d, st.offset[1] + CAM_DIR[1] * d, r])
  }
  for (const l of landmarkSpots(def)) spots.push(l)
  const fall = waterfallSpot(def)
  if (fall) {
    spots.push([...fall.pond, 1.9])
    spots.push([fall.pond[0] * 1.2, fall.pond[1] * 1.2, 1.2])
  }
  return spots
}

/** Footprints of the landmark placeholders (x, z, radius), relative to the island centre. */
export function landmarkSpots(def: IslandDef): [number, number, number][] {
  if (def.id === 'home') {
    const h = HOME_PIECES
    return [
      [...h.cottage, 3.6],
      [...h.screen, 2.8],
      [...h.benchL, 1.0],
      [...h.benchR, 1.0],
      [...h.postbox, 1.0],
      [...h.arcade, 1.0],
    ]
  }
  return [[...CENTREPIECE, 3.3]]
}

const surfaces = new Map<string, (x: number, z: number) => number>()

/** Ground height (relative to the island centre) at a point on the island's top. */
export function groundY(def: IslandDef, x: number, z: number) {
  let f = surfaces.get(def.id)
  if (!f) {
    f = islandSurface({ radius: def.radius, seed: islandSeed(def.id), top: ISLAND_TOP, keepClear: clearSpots(def) })
    surfaces.set(def.id, f)
  }
  return f(x, z)
}

/** World position where the Pilot stands at a stop. */
export function stopAnchor(stop: StopDef): [number, number, number] {
  const i = islandById(stop.island)
  const [x, z] = stop.offset
  return [i.position[0] + x, i.position[1] + groundY(i, x, z), i.position[2] + z]
}

/** World position where the sky-ship hovers while moored at a stop. */
export function mooringAnchor(stop: StopDef): [number, number, number] {
  const i = islandById(stop.island)
  const x = stop.offset[0] + MOOR_DIR[0] * MOOR_DIST
  const z = stop.offset[1] + MOOR_DIR[1] * MOOR_DIST
  return [i.position[0] + x, i.position[1] + groundY(i, x, z) + 0.9, i.position[2] + z]
}

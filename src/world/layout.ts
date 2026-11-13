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
  { id: 'behind-the-smile', name: 'Behind the Smile', position: v(-20, 3, -18), radius: 6.2 * S, accent: '#C94F6D', flora: 'mixed' },
  { id: 'chrono-rebellion', name: 'Chrono Rebellion', position: v(2, 5, -32), radius: 6.6 * S, accent: '#7B61C9', flora: 'pine' },
  { id: 'sunken-greed', name: 'Sunken Greed', position: v(24, -1, -20), radius: 6.2 * S, accent: '#2F8F9D', flora: 'leafy' },
  { id: 'paper-plane-dash', name: 'Paper Plane Dash', position: v(32, 4, 2), radius: 6.0 * S, accent: '#F2B33D', flora: 'mixed' },
  { id: 'merge-defence', name: 'Merge Defence', position: v(20, 1, 22), radius: 6.4 * S, accent: '#5DA05A', flora: 'leafy' },
  { id: 'harbor', name: 'The Harbor', position: v(-4, -1.5, 19), radius: 5.8 * S, accent: '#3E6E8E', flora: 'leafy' },
  { id: 'workshop', name: 'Workshop Isle', position: v(-25, 2, 10), radius: 5.8 * S, accent: '#B07A45', flora: 'pine' },
  { id: 'journey', name: 'Journey Isle', position: v(-36, 0, -12), radius: 5.8 * S, accent: '#8C8C3A', flora: 'mixed' },
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
  { id: 'behind-the-smile', label: 'Behind the Smile', island: 'behind-the-smile', offset: [1.8 * S, 2.46 * S] },
  // stands nearer the front rim than on other islands: the diorama behind him needs the depth
  { id: 'chrono-rebellion', label: 'Chrono Rebellion', island: 'chrono-rebellion', offset: [1.91 * S, 2.6 * S] },
  { id: 'sunken-greed', label: 'Sunken Greed', island: 'sunken-greed', offset: [1.8 * S, 2.46 * S] },
  { id: 'paper-plane-dash', label: 'Paper Plane Dash', island: 'paper-plane-dash', offset: [1.8 * S, 2.46 * S] },
  { id: 'merge-defence', label: 'Merge Defence', island: 'merge-defence', offset: [1.8 * S, 2.46 * S] },
  { id: 'harbor', label: 'More work', island: 'harbor', offset: [1.8 * S, 2.46 * S] },
  { id: 'workshop', label: 'Skills', island: 'workshop', offset: [1.8 * S, 2.46 * S] },
  { id: 'journey', label: 'Journey', island: 'journey', offset: [1.8 * S, 2.46 * S] },
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
export function nearStop(id: string, side: number, back: number): [number, number] {
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
  // the lived-in extras: low things may stand in a sight-line, tall ones are kept clear of all three
  signpost: nearStop('home', -2.6, 1.2),
  garden: nearStop('home', -5.6, 4.2),
  campfire: nearStop('home', -3.0, -3.0),
  well: nearStop('contact', 1.4, 3.6),
  projector: nearStop('cinema', -1.8, -2.2),
  picnic: nearStop('cinema', -3.4, -3.6),
  studio: [1.0, -8.3] as [number, number],
  hammock: [-2.6, -8.0] as [number, number],
  paths: [
    [[-0.1, 1.13], [1.2, 2.5], [2.55, 3.4], [4.3, 1.2], [5.3, -1.5], [5.44, -3.74]],
    [[1.2, 2.5], [-2.3, 1.9], [-5.2, 0.2], [-7.14, -2.04]],
  ] as [number, number][][],
  lanterns: [nearStop('home', -2.6, 0.4), nearStop('home', 2.6, 3.8), nearStop('cinema', -3.1, 1.9), nearStop('contact', -0.5, 2.6), nearStop('contact', -3.4, 0.2)],
}

/**
 * Chrono Rebellion: the island is split by a glowing crack (the timeline split).
 * Left of it is 1944 (bunker, watchtower, a patrolling soldier), right of it is 2145 (Aiden's ship).
 */
export const CHRONO = (() => {
  const n = (side: number, back: number) => nearStop('chrono-rebellion', side, back)
  return {
    tower: n(1.2, 12.0),
    // runs from the tower past the Pilot's left, so he stands on the 2145 side with his ship
    crack: [[1.2, 10.6], [0.7, 9.4], [0.9, 8.2], [0.2, 7.0], [0.3, 5.8], [-0.5, 4.6], [-0.4, 3.4], [-1.1, 2.3], [-1.0, 1.2], [-1.7, 0.2], [-1.9, -1.1]].map(([a, b]) => n(a, b)),
    bunker: n(-5.2, 7.6),
    sandbags: n(-5.2, 5.9),
    watch: n(-2.6, 10.6),
    crate: n(-2.4, 7.2),
    wire: [n(-5.6, 0.9), n(-4.7, 0.3), n(-3.8, -0.3)],
    patrol: [n(-7.0, 4.4), n(-2.6, 2.0), n(-2.2, 5.0)],
    pad: n(6.2, 6.8),
    pylons: [n(3.9, 8.8), n(8.2, 4.2)],
    pods: n(7.0, 2.0),
    // open ground in front of each era, so trees never hide the scene from the camera
    views: [n(-4.5, -1.0), n(-2.0, -2.2), n(6.5, -0.5)],
  }
})()

/**
 * Merge Defence: the game board. Monsters walk the lane from their cave to the castle;
 * cannons of merge level 1 to 5 stand on the board and fire at them; three shrines are the power-ups.
 */
export const MERGE = (() => {
  const n = (side: number, back: number) => nearStop('merge-defence', side, back)
  return {
    castle: n(4.9, 9.2),
    cave: n(-6.3, 7.7),
    lane: [[-5.4, 7.1], [-3.9, 5.9], [-2.1, 5.6], [-0.3, 6.2], [1.2, 7.1], [2.6, 7.9], [3.7, 8.5]].map(([a, b]) => n(a, b)),
    board: n(-2.9, 3.3),
    mergePad: n(-6.5, 1.2),
    shrines: [n(5.4, 3.7), n(6.7, 5.0), n(7.7, 3.5)],
    views: [n(-4.0, -0.8), n(-1.8, -2.0), n(6.4, 0.2)],
  }
})()

/**
 * Behind the Smile: a town square where everyone wears the same smiling mask.
 * An angel (the player) lifts one villager's mask, sees he is scared of a spider, and helps.
 */
export const SMILE = (() => {
  const n = (side: number, back: number) => nearStop('behind-the-smile', side, back)
  return {
    plaza: n(-0.3, 5.2),
    gate: n(0.2, 11.4),
    houses: [n(-5.6, 8.8), n(5.6, 9.2)],
    statue: n(-0.2, 7.2),
    lamp: n(-3.6, 2.9),
    scared: n(-2.3, 2.3),
    basket: n(-1.2, 3.6),
    villagers: [n(-5.6, 5.0), n(-3.4, 6.4), n(2.4, 6.6), n(5.4, 5.4), n(4.0, 7.6)],
    cart: n(6.2, 3.0),
    views: [n(-4.2, -0.8), n(-1.8, -1.8), n(6.2, -0.2)],
  }
})()

/**
 * Sunken Greed: the dive, told in order. Base dome, three empty search spots, a whale crossing the path,
 * the treasure chest, and the mosasaurus that ends the run.
 */
export const SUNK = (() => {
  const n = (side: number, back: number) => nearStop('sunken-greed', side, back)
  return {
    sand: n(0.2, 6.0),
    base: n(-5.4, 8.6),
    spots: [n(-4.6, 3.4), n(-1.4, 6.6), n(2.4, 9.0)],
    chest: n(5.6, 6.2),
    beast: n(10.4, 7.6),
    reef: [n(-2.6, 9.6), n(0.6, 4.0), n(4.6, 9.4), n(-6.4, 5.8), n(6.6, 3.4), n(1.4, 11.2)],
    views: [n(-4.2, -0.8), n(-1.8, -1.8), n(6.2, -0.2)],
  }
})()

/**
 * Paper Plane Dash: a three-lane road through a low-poly Japanese town. The plane laps it, dodging fans and
 * picking up energy cells, and the run gets faster the longer it lasts (no boosters: speed climbs with time).
 */
export const DASH = (() => {
  const n = (side: number, back: number) => nearStop('paper-plane-dash', side, back)
  const A: [number, number] = [-7.2, 8.8], B: [number, number] = [7.4, 3.2]
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]), d = [(B[0] - A[0]) / len, (B[1] - A[1]) / len], perp = [-d[1], d[0]]
  /** A point `s` along the road and `off` to its far side (stage units). */
  const at = (s: number, off: number) => n(A[0] + d[0] * s + perp[0] * off, A[1] + d[1] * s + perp[1] * off)
  return {
    a: n(...A), b: n(...B), len, at,
    houses: [at(1.9, 3.1), at(5.4, 3.3), at(9.0, 3.1), at(12.6, 3.2)],
    poles: [at(3.6, 2.0), at(7.2, 2.0), at(10.8, 2.0)],
    trees: [at(0.6, -2.5), at(6.4, -2.4), at(13.6, -2.3), at(14.6, 2.6)],
    lanterns: [at(3.4, -2.0), at(9.6, -2.0)],
    vending: at(11.6, -2.3),
    bench: at(4.9, -2.3),
    views: [n(-4.2, -0.8), n(-1.8, -1.8), n(6.2, -0.2)],
  }
})()

/** The Harbor ("More work"): a market of stalls, one per kind of project, a lighthouse and a dock with a moored boat. */
export const HARBOR = (() => {
  const n = (side: number, back: number) => nearStop('harbor', side, back)
  return {
    plaza: n(-0.8, 6.2),
    stalls: [n(-6.0, 5.4), n(-3.0, 7.9), n(0.6, 8.6), n(3.9, 6.6)],
    lighthouse: n(5.2, 10.0),
    board: n(-1.4, 3.6),
    crates: n(5.8, 3.4),
    crane: n(-5.6, -1.2),
    lamps: [n(-4.6, 3.8), n(2.2, 4.4), n(-1.2, 10.4)],
    anchor: n(1.6, 2.6),
    /** The dock leaves the island towards this point: the front-left rim, in clear view of the camera. */
    dockTowards: n(-4.6, -9.0),
    views: [n(-4.2, -0.8), n(-1.8, -1.8), n(6.2, -0.2)],
  }
})()

/** Workshop Isle (skills): a labelled tool rack per skill group, a forge, a workbench shed and a windmill. */
export const WORKSHOP = (() => {
  const n = (side: number, back: number) => nearStop('workshop', side, back)
  return {
    yard: n(-0.4, 6.0),
    // racks stand in an arc along the back; everything in front of them is low enough not to hide a sign
    racks: [n(-7.0, 7.2), n(-4.3, 8.8), n(-1.5, 9.7), n(1.3, 9.6), n(4.0, 8.6)],
    shed: n(-5.6, 3.4),
    forge: n(-2.0, 4.2),
    anvil: n(-0.2, 3.3),
    windmill: n(6.9, 9.0),
    grind: n(2.4, 5.4),
    lumber: n(5.0, 4.6),
    views: [n(-4.2, -0.8), n(-1.8, -1.8), n(6.2, -0.2)],
  }
})()

/** Journey Isle: a path of milestones in the order they happened, ending at an empty camp ("Next stop: your team"). */
export const JOURNEY = (() => {
  const n = (side: number, back: number) => nearStop('journey', side, back)
  return {
    // points 1 and 3 only steer the path so that it runs straight through the gate (point 2)
    path: [[4.2, 11.6], [1.1, 12.3], [0.6, 10.7], [0.4, 9.0], [-3.2, 8.2], [-6.6, 6.6], [-3.4, 5.4], [0.8, 7.0], [4.6, 5.6], [-1.4, 3.5], [-3.2, 1.9]].map(([a, b]) => n(a, b)),
    camp: n(-4.4, 0.7),
    views: [n(-4.2, -0.8), n(-1.8, -1.8), n(6.2, -0.2)],
  }
})()

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
      [...h.signpost, 0.7], [...h.garden, 2.0], [...h.campfire, 1.8], [...h.well, 1.3], [...h.projector, 0.9], [...h.picnic, 1.5], [...h.studio, 2.0], [...h.hammock, 1.6],
      ...h.paths.flat().map((q): [number, number, number] => [q[0], q[1], 0.8]),
      ...h.lanterns.map((l): [number, number, number] => [...l, 0.7]),
    ]
  }
  if (def.id === 'chrono-rebellion') {
    const c = CHRONO
    const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const path = c.patrol.flatMap((w, i) => [w, mid(w, c.patrol[(i + 1) % c.patrol.length])])
    return [
      [...c.tower, 2.2], [...c.bunker, 2.2], [...c.sandbags, 1.3], [...c.watch, 1.0], [...c.crate, 0.8],
      [...c.pad, 2.2], [...c.pods, 0.8],
      ...[...c.wire, ...c.pylons].map((q): [number, number, number] => [...q, 0.6]),
      ...path.map((q): [number, number, number] => [...q, 0.9]),
      ...c.crack.map((q): [number, number, number] => [...q, 0.5]),
      ...c.views.map((q): [number, number, number] => [...q, 2.0]),
    ]
  }
  if (def.id === 'merge-defence') {
    const m = MERGE
    return [
      [...m.castle, 3.0], [...m.cave, 2.2], [...m.board, 3.4], [...m.mergePad, 1.5],
      ...m.shrines.map((q): [number, number, number] => [...q, 0.8]),
      ...m.lane.map((q): [number, number, number] => [...q, 0.9]),
      ...m.views.map((q): [number, number, number] => [...q, 2.0]),
    ]
  }
  const spots = (list: [[number, number], number][]): [number, number, number][] => list.map(([q, r]) => [q[0], q[1], r])
  if (def.id === 'behind-the-smile') {
    const t = SMILE
    return spots([
      [t.gate, 2.6], [t.statue, 1.6], [t.lamp, 0.7], [t.scared, 0.9], [t.basket, 0.8], [t.cart, 1.3], [t.plaza, 2.5],
      ...t.houses.map((q): [[number, number], number] => [q, 2.6]),
      ...t.villagers.map((q): [[number, number], number] => [q, 0.8]),
      ...t.views.map((q): [[number, number], number] => [q, 2.0]),
    ])
  }
  if (def.id === 'sunken-greed') {
    const t = SUNK
    return spots([
      [t.base, 2.8], [t.chest, 1.6], [t.sand, 3.0],
      ...t.spots.map((q): [[number, number], number] => [q, 1.4]),
      ...t.reef.map((q): [[number, number], number] => [q, 1.0]),
      ...t.views.map((q): [[number, number], number] => [q, 2.0]),
    ])
  }
  if (def.id === 'paper-plane-dash') {
    const t = DASH
    return spots([
      ...Array.from({ length: 9 }, (_, i): [[number, number], number] => [t.at((i / 8) * t.len, 0), 1.9]),
      // the near side of the road stays open so the camera can see the lanes
      ...Array.from({ length: 6 }, (_, i): [[number, number], number] => [t.at(1.5 + i * 2.5, -3.4), 2.1]),
      ...t.houses.map((q): [[number, number], number] => [q, 2.2]),
      ...[...t.poles, ...t.trees, ...t.lanterns, t.vending, t.bench].map((q): [[number, number], number] => [q, 0.9]),
      ...t.views.map((q): [[number, number], number] => [q, 2.0]),
    ])
  }
  if (def.id === 'harbor') {
    const t = HARBOR
    return spots([
      [t.plaza, 4.6], [t.lighthouse, 2.0], [t.board, 1.2], [t.crates, 1.4], [t.crane, 1.6], [t.anchor, 0.9],
      ...t.stalls.map((q): [[number, number], number] => [q, 2.0]),
      ...t.lamps.map((q): [[number, number], number] => [q, 0.7]),
      ...t.views.map((q): [[number, number], number] => [q, 2.0]),
    ])
  }
  if (def.id === 'workshop') {
    const t = WORKSHOP
    return spots([
      [t.yard, 4.4], [t.shed, 2.2], [t.forge, 1.8], [t.anvil, 1.0], [t.windmill, 2.0], [t.grind, 0.9], [t.lumber, 1.2],
      ...t.racks.map((q): [[number, number], number] => [q, 1.6]),
      ...t.views.map((q): [[number, number], number] => [q, 2.0]),
    ])
  }
  if (def.id === 'journey') {
    const t = JOURNEY
    const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    return spots([
      [t.camp, 2.2],
      ...t.path.flatMap((q, i): [[number, number], number][] => (i ? [[q, 1.7], [mid(q, t.path[i - 1]), 1.2]] : [[q, 1.7]])),
      ...t.views.map((q): [[number, number], number] => [q, 2.0]),
    ])
  }
  return []
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

/**
 * Solid things on an island (x, z, radius, island-local): what the Pilot can't walk through in Adventure Mode.
 * Unlike landmarkSpots these are the objects themselves, not the clearings kept around them.
 */
export function solidSpots(def: IslandDef): [number, number, number][] {
  const c = (list: [[number, number], number][]): [number, number, number][] => list.map(([q, r]) => [q[0], q[1], r])
  const each = (qs: [number, number][], r: number): [[number, number], number][] => qs.map((q) => [q, r])
  switch (def.id) {
    case 'home': {
      const h = HOME_PIECES
      return c([[h.cottage, 2.5], [h.screen, 2.2], [h.benchL, 0.7], [h.benchR, 0.7], [h.postbox, 0.45], [h.arcade, 0.6], [h.signpost, 0.3], [h.garden, 1.6], [h.campfire, 0.6], [h.well, 0.9], [h.projector, 0.5], [h.picnic, 1.1], [h.studio, 1.5], [h.hammock, 1.0], ...each(h.lanterns, 0.25)])
    }
    case 'chrono-rebellion':
      return c([[CHRONO.tower, 1.6], [CHRONO.bunker, 1.8], [CHRONO.sandbags, 1.0], [CHRONO.watch, 0.8], [CHRONO.crate, 0.6], [CHRONO.pad, 1.8], [CHRONO.pods, 0.7], ...each(CHRONO.pylons, 0.4)])
    case 'merge-defence':
      return c([[MERGE.castle, 2.4], [MERGE.cave, 1.8], ...each(MERGE.shrines, 0.6)])
    case 'behind-the-smile':
      return c([[SMILE.statue, 1.0], [SMILE.lamp, 0.3], [SMILE.cart, 1.0], [SMILE.basket, 0.5], ...each(SMILE.houses, 2.0), ...each(SMILE.villagers, 0.4)])
    case 'sunken-greed':
      return c([[SUNK.base, 2.4], [SUNK.chest, 0.9], ...each(SUNK.reef, 0.7)])
    case 'paper-plane-dash':
      return c([[DASH.vending, 0.5], [DASH.bench, 0.6], ...each(DASH.houses, 1.7), ...each(DASH.poles, 0.2), ...each(DASH.trees, 0.4), ...each(DASH.lanterns, 0.3)])
    case 'harbor':
      return c([[HARBOR.lighthouse, 1.6], [HARBOR.board, 0.9], [HARBOR.crates, 1.1], [HARBOR.crane, 0.4], [HARBOR.anchor, 0.5], ...each(HARBOR.stalls, 1.5), ...each(HARBOR.lamps, 0.25)])
    case 'workshop':
      return c([[WORKSHOP.shed, 1.8], [WORKSHOP.forge, 1.2], [WORKSHOP.anvil, 0.6], [WORKSHOP.windmill, 1.6], [WORKSHOP.grind, 0.6], [WORKSHOP.lumber, 1.0], ...each(WORKSHOP.racks, 1.2)])
    case 'journey': {
      const back = (q: [number, number]): [number, number] => [q[0] - CAM_DIR[0] * 1.25, q[1] - CAM_DIR[1] * 1.25]
      return c([[JOURNEY.camp, 0.9], ...each([0, 4, 5, 6, 7, 8, 9].map((i) => back(JOURNEY.path[i])), 1.3)])
    }
    default:
      return []
  }
}

/** The island's rim radius in a direction (island-local angle, atan2(z, x)). */
export const rimRadius = (def: IslandDef, angle: number) => makeOutline(def.radius, islandSeed(def.id))(angle)

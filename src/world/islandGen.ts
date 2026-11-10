import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural floating islands in a soft, cozy style (inspired by Aloft):
 * rolling grass tops with a rounded overhanging lip, a sandstone cliff band, and a layered
 * rock underside that tapers to a point, with hanging roots and a few tiny islets alongside.
 *
 * The island body is one merged, vertex-coloured geometry (one draw call).
 * Trees, bushes, rocks and flowers come back as placements; World.tsx draws them with
 * instanced CC0 props (Quaternius "Ultimate Nature", restyled into props.glb).
 */

// ---------- tiny seeded noise ----------
function rng(seed: number) {
  let s = Math.floor(Math.abs(seed)) % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Smooth periodic noise around a circle: a few random sines, roughly in [-1, 1]. */
function ringNoise(seed: number, octaves = 4) {
  const r = rng(seed)
  const waves = Array.from({ length: octaves }, (_, i) => ({ f: i + 2 + Math.floor(r() * 3), p: r() * Math.PI * 2, a: 1 / (i + 1.4) }))
  const norm = waves.reduce((s, w) => s + w.a, 0)
  return (theta: number) => waves.reduce((s, w) => s + Math.sin(theta * w.f + w.p) * w.a, 0) / norm
}

/** Smooth 2D noise from a handful of rotated sine waves, roughly in [-1, 1]. */
function fieldNoise(seed: number, scale: number) {
  const r = rng(seed)
  const waves = Array.from({ length: 4 }, (_, i) => {
    const a = r() * Math.PI
    return { dx: Math.cos(a), dz: Math.sin(a), f: (0.6 + r() * 0.8) * (i + 1) / scale, p: r() * Math.PI * 2, w: 1 / (i + 1) }
  })
  const norm = waves.reduce((s, w) => s + w.w, 0)
  return (x: number, z: number) => waves.reduce((s, w) => s + Math.sin((x * w.dx + z * w.dz) * w.f + w.p) * w.w, 0) / norm
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export type IslandStyle = {
  grass: string
  grassLight: string
  grassEdge: string
  dirt: string
  rockA: string
  rockB: string
  rockDeep: string
  root: string
}

export const DAY_STYLE: IslandStyle = {
  grass: '#93c556',
  grassLight: '#b5d86a',
  grassEdge: '#6a9f3e',
  dirt: '#8a6748',
  rockA: '#e6cca4',
  rockB: '#d2b089',
  rockDeep: '#9c8270',
  root: '#6b4b34',
}

const col = (hex: string) => new THREE.Color(hex)

export type SurfaceOpts = { radius: number; seed: number; top: number; keepClear?: [number, number, number][] }

/** The island's outline radius at angle theta. */
function makeOutline(R: number, seed: number) {
  const edge = ringNoise(seed, 5)
  return (t: number) => R * (1 + 0.14 * edge(t))
}

/**
 * Height of the grass top (relative to the island centre) at local (x, z).
 * Rolling hills and one big mound, flattened around every keep-clear spot so the Pilot,
 * the moored ship and the landmarks stand on level ground, and faded out towards the rim.
 */
export function islandSurface({ radius: R, seed, top, keepClear = [] }: SurfaceOpts) {
  const outline = makeOutline(R, seed)
  const hills = fieldNoise(seed + 3, R * 0.55)
  const r = rng(seed + 11)
  const ma = r() * Math.PI * 2
  const md = R * (0.35 + r() * 0.25)
  const mound = { x: Math.cos(ma) * md, z: Math.sin(ma) * md, h: R * 0.11, w: R * 0.32 }
  const dome = R * 0.05
  const hillAmp = R * 0.035
  return (x: number, z: number) => {
    const rho = Math.min(1, Math.hypot(x, z) / outline(Math.atan2(z, x)))
    const base = top + dome * (1 - rho * rho)
    const rim = 1 - smoothstep(0.72, 0.97, rho)
    let clear = 1
    for (const [cx, cz, cr] of keepClear) clear *= smoothstep(cr * 0.8, cr + 2.2, Math.hypot(x - cx, z - cz))
    const m = mound.h * Math.exp(-((x - mound.x) ** 2 + (z - mound.z) ** 2) / (mound.w * mound.w))
    return base + (hills(x, z) * hillAmp + m) * rim * clear
  }
}

type BodyOpts = {
  R: number
  seed: number
  top: number
  surface: (x: number, z: number) => number
  segments?: number
  topRings?: number
  depth?: number
}

/** Island body: grass top + rounded lip + cliff band + strata underside tapering to a point. */
function islandBody({ R, seed, top, surface, segments = 96, topRings = 10, depth = R * 1.35 }: BodyOpts, style: IslandStyle) {
  const SEG = segments
  const outline = makeOutline(R, seed)
  const strata = ringNoise(seed + 7, 3)
  const tint = fieldNoise(seed + 21, R * 0.3)
  const positions: number[] = []
  const colors: number[] = []
  const index: number[] = []
  const c = new THREE.Color()
  const grass = col(style.grass), grassLight = col(style.grassLight), grassEdge = col(style.grassEdge)

  type Ring = { pos: (t: number, s: number) => [number, number, number]; color: (t: number, x: number, y: number, z: number) => THREE.Color }
  const rings: Ring[] = []
  const jag = rng(seed + 99)
  const jagTable = Array.from({ length: 40 * SEG }, () => jag() - 0.5)

  // grass top: polar grid following the surface (hills, mound, flattened clear spots)
  for (let i = 0; i <= topRings; i++) {
    const rho = (i / topRings) * 0.97
    rings.push({
      pos: (t) => {
        const r = outline(t) * rho
        const x = Math.cos(t) * r, z = Math.sin(t) * r
        return [x, surface(x, z), z]
      },
      color: (_t, x, y, z) =>
        c.copy(grass).lerp(grassLight, Math.max(0, Math.min(1, (y - top) / (R * 0.12))) * 0.7 + tint(x, z) * 0.12).lerp(grassEdge, Math.pow(rho, 6) * 0.7),
    })
  }
  // rounded, slightly overhanging lip
  const lip: [number, number, string, number][] = [
    [1.0, -0.06, style.grassEdge, 1],
    [1.025, -0.3, style.grassEdge, 0.85],
    [1.0, -0.55, style.dirt, 1],
  ]
  for (const [scale, dy, hex, k] of lip) {
    rings.push({
      pos: (t) => {
        const r = outline(t) * scale
        return [Math.cos(t) * r, top + dy, Math.sin(t) * r]
      },
      color: () => c.copy(col(hex)).multiplyScalar(k),
    })
  }
  // cliff band: near-vertical sandstone with warm stripes
  const cliff = [
    [0.985, -0.9],
    [0.975, -1.5],
    [0.955, -2.2],
  ]
  cliff.forEach(([scale, dy], k) => {
    rings.push({
      pos: (t, s) => {
        const r = outline(t) * scale * (1 + jagTable[(k + 3) * SEG + s] * 0.03)
        return [Math.cos(t) * r, top + dy + 0.12 * strata(t * 3 + k), Math.sin(t) * r]
      },
      color: () => c.copy(col(k % 2 ? style.rockB : style.rockA)),
    })
  })
  // underside: a full, chunky body with big spurs running down it, stepped ledges, and an off-centre tip
  const LEVELS = 12
  const start = top - 2.2
  const spurs = ringNoise(seed + 13, 3)
  const leanA = jag() * Math.PI * 2, leanD = R * 0.2
  const profile = (f: number) => Math.pow(1 - f, 0.6)
  for (let k = 1; k <= LEVELS; k++) {
    const f = k / LEVELS
    const ledge = k % 2 ? 1.05 : 0.95
    rings.push({
      pos: (t, s) => {
        const r =
          outline(t) * (0.93 * profile(f) * ledge + 0.02) * (1 + spurs(t + f * 0.9) * (0.08 + 0.4 * f)) * (1 + jagTable[(k + 8) * SEG + s] * (0.06 + f * 0.14))
        const off = leanD * f * f
        return [Math.cos(t) * r + Math.cos(leanA) * off, start - depth * f + 0.25 * strata(t * 2 + k), Math.sin(t) * r + Math.sin(leanA) * off]
      },
      color: (_t, _x, y) => {
        const band = k % 2 === 0 ? style.rockA : style.rockB
        return c.copy(col(band)).lerp(col(style.rockDeep), Math.min(1, (start - y) / (depth * 1.05)) * 0.8)
      },
    })
  }

  rings.forEach((ring, ri) => {
    for (let s = 0; s < SEG; s++) {
      const t = (s / SEG) * Math.PI * 2
      const [x, y, z] = ring.pos(t, s)
      positions.push(x, y, z)
      const cc = ring.color(t, x, y, z)
      colors.push(cc.r, cc.g, cc.b)
    }
    if (ri > 0) {
      const a0 = (ri - 1) * SEG, b0 = ri * SEG
      for (let s = 0; s < SEG; s++) {
        const s1 = (s + 1) % SEG
        index.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s)
      }
    }
  })
  // (ring 0 sits at the centre, so the top is closed) bottom tip
  const tipIdx = positions.length / 3
  positions.push(Math.cos(leanA) * leanD, start - depth * 1.1, Math.sin(leanA) * leanD)
  const tipC = col(style.rockDeep).multiplyScalar(0.8)
  colors.push(tipC.r, tipC.g, tipC.b)
  const last = (rings.length - 1) * SEG
  for (let s = 0; s < SEG; s++) index.push(last + s, last + ((s + 1) % SEG), tipIdx)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return { geometry: g, outline, start, depth }
}

/** A blobby sphere with gently displaced vertices, flat-coloured, smooth-shaded. */
function blob(radius: number, color: THREE.Color, seed: number, detail = 1, squash = 0.7) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const p = g.attributes.position as THREE.BufferAttribute
  const r = rng(seed)
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (r() - 0.5) * 0.25
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k)
  }
  g.computeVertexNormals()
  return paint(g, color)
}

function paint(g: THREE.BufferGeometry, color: THREE.Color) {
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([color.r, color.g, color.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

/** A thin root dangling from under the lip. */
function root(x: number, y: number, z: number, len: number, lean: number, heading: number, color: THREE.Color) {
  const g = new THREE.CylinderGeometry(0.03, 0.07, len, 5, 3)
  g.translate(0, -len / 2, 0)
  g.rotateZ(lean)
  g.rotateY(heading)
  g.translate(x, y, z)
  return paint(g, color)
}

/** A rock spike hanging under an island (tip down), darker towards the tip. */
function spike(x: number, yTop: number, z: number, radius: number, length: number, seed: number, style: IslandStyle) {
  const g = new THREE.ConeGeometry(radius, length, 9, 4)
  g.rotateX(Math.PI)
  const p = g.attributes.position as THREE.BufferAttribute
  const r = rng(seed)
  const lean = (r() - 0.5) * 0.5, leanZ = (r() - 0.5) * 0.5
  const arr = new Float32Array(p.count * 3)
  const a = col(seed % 2 ? style.rockA : style.rockB), deep = col(style.rockDeep), c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const down = 0.5 - p.getY(i) / length // 0 at the base, 1 at the tip
    const k = 1 + (r() - 0.5) * 0.3
    p.setXYZ(i, p.getX(i) * k + lean * down * length * 0.4, p.getY(i), p.getZ(i) * k + leanZ * down * length * 0.4)
    c.copy(a).lerp(deep, down * 0.8)
    arr.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  g.translate(x, yTop - length / 2, z)
  g.computeVertexNormals()
  return g
}

/** Strip attributes so every part merges cleanly (position, normal, color only, non-indexed). */
function normalise(g: THREE.BufferGeometry) {
  const ng = g.index ? g.toNonIndexed() : g
  for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'color'].includes(name)) ng.deleteAttribute(name)
  if (!ng.attributes.normal) ng.computeVertexNormals()
  return ng
}

export type PropKind =
  | 'tree_a' | 'tree_b' | 'tree_c' | 'pine' | 'pine_b' | 'birch'
  | 'bush' | 'bush_berries' | 'rock' | 'rock_moss' | 'rock_moss_b'
  | 'flowers' | 'plant' | 'fern' | 'stump' | 'log'

export type Placement = { kind: PropKind; x: number; y: number; z: number; rot: number; scale: number; tint: number }

export type Flora = 'leafy' | 'pine' | 'mixed'

const TREES: Record<Flora, PropKind[]> = {
  leafy: ['tree_a', 'tree_c', 'tree_b', 'tree_a', 'birch'],
  pine: ['pine', 'pine_b', 'pine', 'tree_c'],
  mixed: ['tree_a', 'pine', 'tree_c', 'birch', 'pine_b'],
}

export type IslandOpts = SurfaceOpts & { flora?: Flora; density?: number; segments?: number; treesOnly?: boolean }

/** Build one island: merged body geometry (+ islets, roots, clinging boulders) and prop placements. */
export function buildIsland(opts: IslandOpts, style: IslandStyle = DAY_STYLE) {
  const R = opts.radius
  const surface = islandSurface(opts)
  const { geometry, outline, start, depth } = islandBody({ R, seed: opts.seed, top: opts.top, surface, segments: opts.segments ?? 96, topRings: opts.segments ? 5 : 10 }, style)
  const parts: THREE.BufferGeometry[] = [geometry]
  const r = rng(opts.seed + 31)
  const density = opts.density ?? 1

  // --- hanging roots and boulders under the lip (silhouette detail)
  const rootCol = col(style.root)
  for (let i = 0; i < Math.round(R * 0.9); i++) {
    const t = r() * Math.PI * 2
    const rr = outline(t) * (0.9 + r() * 0.05)
    parts.push(root(Math.cos(t) * rr, opts.top - 0.5, Math.sin(t) * rr, 0.8 + r() * 2.2, (r() - 0.5) * 0.4, t, rootCol))
  }
  for (let i = 0; i < 5; i++) {
    const t = r() * Math.PI * 2
    const rr = outline(t) * (0.6 + r() * 0.25)
    const b = blob(0.5 + r() * 0.7, col(i % 2 ? style.rockA : style.rockB), opts.seed + 500 + i)
    b.translate(Math.cos(t) * rr, opts.top - 2.6 - r() * R * 0.5, Math.sin(t) * rr)
    parts.push(b)
  }

  // --- rock spikes hanging from the underside
  const nSpikes = 3 + Math.floor(r() * 3)
  for (let i = 0; i < nSpikes; i++) {
    const t = r() * Math.PI * 2, q = 0.3 + r() * 0.4
    const f = 1 - Math.pow(q, 1 / 0.6) // how far down the body is at this distance from the centre
    const len = depth * (0.25 + r() * 0.3)
    parts.push(spike(Math.cos(t) * outline(t) * q, start - depth * f + len * 0.35, Math.sin(t) * outline(t) * q, R * (0.1 + r() * 0.08), len, opts.seed + 900 + i, style))
  }

  // --- a couple of tiny islets drifting alongside
  const islets = 2 + Math.floor(r() * 2)
  for (let i = 0; i < islets; i++) {
    const ir = 0.9 + r() * 1.0
    const t = r() * Math.PI * 2
    const d = R * (1.25 + r() * 0.3)
    const ox = Math.cos(t) * d, oz = Math.sin(t) * d, oy = -1.5 + r() * 4
    const iSurf = islandSurface({ radius: ir, seed: opts.seed + 70 + i, top: 0.3 })
    const islet = islandBody({ R: ir, seed: opts.seed + 70 + i, top: 0.3, surface: iSurf, segments: 24, topRings: 3, depth: ir * 1.6 }, style).geometry
    islet.translate(ox, oy, oz)
    parts.push(islet)
  }

  const body = mergeGeometries(parts.map(normalise), false)!
  body.computeBoundingSphere()

  // --- props: groves of trees towards the rim, undergrowth everywhere, nothing on keep-clear spots
  const placements: Placement[] = []
  const taken: [number, number, number][] = [...(opts.keepClear ?? [])]
  const free = (x: number, z: number, d: number) => taken.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + d)
  const pointAt = (rhoMin: number, rhoMax: number) => {
    const t = r() * Math.PI * 2
    const rho = rhoMin + r() * (rhoMax - rhoMin)
    const R0 = outline(t) * rho * 0.97
    return [Math.cos(t) * R0, Math.sin(t) * R0] as const
  }
  const place = (kind: PropKind, x: number, z: number, scale: number, spacing: number) => {
    placements.push({ kind, x, y: surface(x, z) - 0.05, z, rot: r() * Math.PI * 2, scale, tint: 0.92 + r() * 0.16 })
    taken.push([x, z, spacing])
  }

  const trees = TREES[opts.flora ?? 'leafy']
  const groves = Array.from({ length: 2 + Math.floor(r() * 2) }, () => pointAt(0.45, 0.8))
  const wantTrees = Math.round(R * 1.25 * density)
  for (let tries = 0, n = 0; tries < 400 && n < wantTrees; tries++) {
    let x: number, z: number
    if (r() < 0.65) {
      const [gx, gz] = groves[Math.floor(r() * groves.length)]
      const a = r() * Math.PI * 2, d = r() * R * 0.22
      x = gx + Math.cos(a) * d
      z = gz + Math.sin(a) * d
    } else [x, z] = pointAt(0.3, 0.9)
    const rho = Math.hypot(x, z) / outline(Math.atan2(z, x))
    if (rho > 0.9) continue
    const s = 1.35 + r() * 0.7
    if (!free(x, z, 1.1 * s)) continue
    place(trees[Math.floor(r() * trees.length)], x, z, s, 1.1 * s)
    n++
  }
  const scatter = (kinds: PropKind[], count: number, sMin: number, sMax: number, spacing: number, rho: [number, number]) => {
    for (let tries = 0, n = 0; tries < count * 6 && n < count; tries++) {
      const [x, z] = pointAt(rho[0], rho[1])
      const s = sMin + r() * (sMax - sMin)
      if (!free(x, z, spacing * s)) continue
      place(kinds[Math.floor(r() * kinds.length)], x, z, s, spacing * s)
      n++
    }
  }
  scatter(['bush', 'bush_berries', 'bush'], Math.round(R * 0.8 * density), 0.6, 0.95, 0.8, [0.25, 0.92])
  scatter(['rock_moss', 'rock_moss_b', 'rock'], Math.round(R * 0.45 * density), 1.2, 2.4, 0.6, [0.3, 0.95])
  if (!opts.treesOnly) {
    scatter(['flowers', 'flowers', 'plant'], Math.round(R * 2.4 * density), 0.9, 1.5, 0.3, [0.1, 0.95])
    scatter(['fern', 'plant', 'plant'], Math.round(R * 2.0 * density), 0.8, 1.3, 0.35, [0.15, 0.95])
  }
  if (!opts.treesOnly && r() < 0.6) scatter(['stump', 'log'], 1, 1.0, 1.3, 1.0, [0.4, 0.8])

  return { geometry: body, placements, surface }
}

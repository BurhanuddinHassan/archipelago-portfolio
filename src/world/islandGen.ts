import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural floating islands in a soft, cozy style (inspired by Aloft):
 * a rounded grass top with an overhanging lip, a layered rock underside tapering to a point,
 * and round puffy trees. Everything for one island is merged into a single vertex-coloured
 * geometry, so each island costs one draw call.
 */

// ---------- tiny seeded noise ----------
function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Smooth periodic 1D noise around a circle: sum of a few random sines. */
function ringNoise(seed: number, octaves = 4) {
  const r = rng(seed)
  const waves = Array.from({ length: octaves }, (_, i) => ({ f: i + 2 + Math.floor(r() * 3), p: r() * Math.PI * 2, a: 1 / (i + 1.4) }))
  const norm = waves.reduce((s, w) => s + w.a, 0)
  return (theta: number) => waves.reduce((s, w) => s + Math.sin(theta * w.f + w.p) * w.a, 0) / norm
}

export type IslandStyle = { grass: string; grassEdge: string; dirt: string; rockA: string; rockB: string; rockDeep: string }

export const DAY_STYLE: IslandStyle = {
  grass: '#a3c97a',
  grassEdge: '#7fae5c',
  dirt: '#9a7a5c',
  rockA: '#e0c7a8',
  rockB: '#cdb293',
  rockDeep: '#a08a78',
}

const col = (hex: string) => new THREE.Color(hex)

type Opts = { radius: number; seed: number; top: number; trees?: number; keepClear?: [number, number, number][] }

/** Island body: grass cap + lip + strata underside. Returns geometry centred on the island origin. */
function islandBody({ radius: R, seed, top }: Opts, style: IslandStyle) {
  const SEG = 56
  const edge = ringNoise(seed, 4)
  const outline = (t: number) => R * (1 + 0.1 * edge(t))
  const positions: number[] = []
  const colors: number[] = []
  const index: number[] = []
  const c = new THREE.Color()

  // rings from the centre of the top, out to the lip, then down the underside
  type Ring = { scale: number; y: (t: number) => number; color: (t: number, y: number) => THREE.Color; jag: number }
  const depth = R * 1.25
  const strata = ringNoise(seed + 7, 3)
  const rings: Ring[] = []
  const TOP_RINGS = 5
  for (let i = 0; i <= TOP_RINGS; i++) {
    const rho = i / TOP_RINGS
    rings.push({
      scale: rho * 0.94,
      y: () => top + 0.12 * (1 - rho * rho),
      color: () => c.copy(col(style.grass)).lerp(col(style.grassEdge), rho * rho * 0.6),
      jag: 0,
    })
  }
  // soft rounded lip
  rings.push({ scale: 1.0, y: () => top - 0.06, color: () => c.copy(col(style.grassEdge)), jag: 0 })
  rings.push({ scale: 1.02, y: () => top - 0.22, color: () => c.copy(col(style.grassEdge)).multiplyScalar(0.85), jag: 0 })
  rings.push({ scale: 0.97, y: () => top - 0.38, color: () => c.copy(col(style.dirt)), jag: 0.02 })
  // underside: stepped strata that taper to a point
  const LEVELS = 9
  for (let k = 1; k <= LEVELS; k++) {
    const f = k / LEVELS
    const taper = Math.pow(1 - f, 0.85)
    rings.push({
      scale: 0.95 * taper + 0.02,
      y: (t) => top - 0.38 - depth * f + 0.12 * strata(t * 2 + k),
      color: (_t, y) => {
        const band = k % 2 === 0 ? style.rockA : style.rockB
        return c.copy(col(band)).lerp(col(style.rockDeep), Math.min(1, (top - y) / (depth * 1.1)) * 0.75)
      },
      jag: 0.07 + f * 0.12,
    })
  }

  const jagNoise = rng(seed + 99)
  rings.forEach((ring, ri) => {
    for (let s = 0; s < SEG; s++) {
      const t = (s / SEG) * Math.PI * 2
      const jitter = ring.jag ? 1 + (jagNoise() - 0.5) * ring.jag * 2 : 1
      const r = outline(t) * ring.scale * jitter
      const y = ring.y(t)
      positions.push(Math.cos(t) * r, y, Math.sin(t) * r)
      const cc = ring.color(t, y)
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
  // bottom tip
  const tipIdx = positions.length / 3
  positions.push(0, top - 0.38 - depth * 1.12, 0)
  const tipC = col(style.rockDeep).multiplyScalar(0.8)
  colors.push(tipC.r, tipC.g, tipC.b)
  const last = (rings.length - 1) * SEG
  for (let s = 0; s < SEG; s++) index.push(last + s, last + ((s + 1) % SEG), tipIdx)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return { geometry: g, outline }
}

/** A blobby sphere with gently displaced vertices, flat-coloured. */
function blob(radius: number, color: THREE.Color, seed: number, detail = 2, squash = 0.85) {
  // weld the icosphere so normals are shared: smooth, soft shading instead of facets
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const p = g.attributes.position as THREE.BufferAttribute
  const r = rng(seed)
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (r() - 0.5) * 0.12
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

const TREE_GREENS = ['#7fb35a', '#8cbf63', '#6ea64f', '#9cc96c']

function tree(x: number, y: number, z: number, scale: number, seed: number) {
  const r = rng(seed)
  const parts: THREE.BufferGeometry[] = []
  const trunkH = 0.9 * scale
  const trunk = new THREE.CylinderGeometry(0.07 * scale, 0.12 * scale, trunkH, 7)
  trunk.translate(x, y + trunkH / 2, z)
  parts.push(paint(trunk, col('#7a5a43')))
  const green = col(TREE_GREENS[Math.floor(r() * TREE_GREENS.length)])
  const puffs = 3 + Math.floor(r() * 2)
  for (let i = 0; i < puffs; i++) {
    const a = r() * Math.PI * 2
    const d = i === 0 ? 0 : 0.28 * scale
    const pr = (i === 0 ? 0.55 : 0.38 + r() * 0.1) * scale
    const g = blob(pr, green.clone().offsetHSL(0, 0, (r() - 0.5) * 0.06), seed * 7 + i)
    g.translate(x + Math.cos(a) * d, y + trunkH + (i === 0 ? 0.25 : 0.05 + r() * 0.2) * scale, z + Math.sin(a) * d)
    parts.push(g)
  }
  return parts
}

function rock(x: number, y: number, z: number, s: number, seed: number) {
  const g = blob(s, col('#b8a38f'), seed, 1, 0.65)
  g.translate(x, y + s * 0.25, z)
  return [g]
}

function bush(x: number, y: number, z: number, s: number, seed: number) {
  const g = blob(s, col('#88b860'), seed, 1, 0.7)
  g.translate(x, y + s * 0.3, z)
  return [g]
}

/** Strip attributes so every part merges cleanly (position, normal, color only, non-indexed). */
function normalise(g: THREE.BufferGeometry) {
  const ng = g.index ? g.toNonIndexed() : g
  for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'color'].includes(name)) ng.deleteAttribute(name)
  if (!ng.attributes.normal) ng.computeVertexNormals()
  return ng
}

export function buildIsland(opts: Opts, style: IslandStyle = DAY_STYLE) {
  const { geometry, outline } = islandBody(opts, style)
  const parts: THREE.BufferGeometry[] = [geometry]
  const r = rng(opts.seed + 31)
  const clear = opts.keepClear ?? []
  const free = (x: number, z: number, d: number) => clear.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + d)
  const surface = (rho: number) => opts.top + 0.12 * (1 - rho * rho)

  const want = opts.trees ?? Math.round(opts.radius * 0.9)
  let placed = 0
  for (let tries = 0; tries < 200 && placed < want; tries++) {
    const t = r() * Math.PI * 2
    const rho = 0.55 + r() * 0.3
    const R = outline(t) * rho * 0.94
    const x = Math.cos(t) * R, z = Math.sin(t) * R
    if (!free(x, z, 0.9)) continue
    parts.push(...tree(x, surface(rho), z, 0.8 + r() * 0.5, opts.seed * 13 + placed))
    clear.push([x, z, 0.9])
    placed++
  }
  for (let i = 0; i < Math.round(opts.radius * 1.4); i++) {
    const t = r() * Math.PI * 2
    const rho = 0.3 + r() * 0.62
    const R = outline(t) * rho * 0.94
    const x = Math.cos(t) * R, z = Math.sin(t) * R
    if (!free(x, z, 0.35)) continue
    parts.push(...(i % 3 === 0 ? rock(x, surface(rho), z, 0.18 + r() * 0.18, opts.seed + i) : bush(x, surface(rho), z, 0.16 + r() * 0.14, opts.seed + i * 3)))
  }
  // a couple of boulders clinging to the underside for silhouette
  for (let i = 0; i < 3; i++) {
    const t = r() * Math.PI * 2
    const R = outline(t) * (0.55 + r() * 0.25)
    parts.push(...rock(Math.cos(t) * R, opts.top - 0.6 - r() * opts.radius * 0.5, Math.sin(t) * R, 0.25 + r() * 0.25, opts.seed + 500 + i))
  }
  const merged = mergeGeometries(parts.map(normalise), false)!
  merged.computeBoundingSphere()
  return merged
}

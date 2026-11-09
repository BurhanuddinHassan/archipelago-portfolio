import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Tiny modelling kit for the landmarks: every helper returns a vertex-coloured geometry,
 * and `merge` bakes a whole landmark into one mesh (one draw call, one Lambert material).
 */

export const hex = (h: string) => new THREE.Color(h)

export const C = {
  cream: hex('#f3ead8'),
  plaster: hex('#eadcc3'),
  wood: hex('#8a5a3b'),
  woodLight: hex('#c08a5a'),
  woodDark: hex('#5f402b'),
  stone: hex('#c9bcab'),
  stoneDark: hex('#a89a89'),
  roof: hex('#F26B3A'),
  roofDark: hex('#cf5530'),
  ink: hex('#2b2730'),
  metal: hex('#6d6a66'),
  gold: hex('#e8b04a'),
  glass: hex('#9fd0e8'),
  white: hex('#f8f5ee'),
  pink: hex('#f29ac0'),
  yellow: hex('#ffd75e'),
  leaf: hex('#7fb34a'),
  red: hex('#e0533d'),
}

export function paint(g: THREE.BufferGeometry, color: THREE.Color) {
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([color.r, color.g, color.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

type V3 = [number, number, number]

/** Apply rotation (Euler XYZ, radians) then translation. */
function place(g: THREE.BufferGeometry, at: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  if (rot[0] || rot[1] || rot[2]) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)))
  g.translate(...at)
  return g
}

export const box = (size: V3, color: THREE.Color, at?: V3, rot?: V3) => place(paint(new THREE.BoxGeometry(...size), color), at, rot)

export const cyl = (rTop: number, rBot: number, h: number, color: THREE.Color, at?: V3, rot?: V3, seg = 10) =>
  place(paint(new THREE.CylinderGeometry(rTop, rBot, h, seg), color), at, rot)

export const sphere = (r: number, color: THREE.Color, at?: V3, seg = 10) => place(paint(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), color), at)

export const cone = (r: number, h: number, color: THREE.Color, at?: V3, rot?: V3, seg = 10) => place(paint(new THREE.ConeGeometry(r, h, seg), color), at, rot)

/** A soft, slightly lumpy blob (bushes, flower clumps, stones). */
export function blob(r: number, color: THREE.Color, at: V3, squash = 0.75, seed = 1) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, 1)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const p = g.attributes.position as THREE.BufferAttribute
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (rnd() - 0.5) * 0.22
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k)
  }
  g.computeVertexNormals()
  return place(paint(g, color), at)
}

/** Triangular prism (gable ends, ramps): triangle in the x/y plane, extruded `depth` along z, centred. */
export function prism(width: number, height: number, depth: number, color: THREE.Color, at?: V3, rot?: V3) {
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, height)])
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  g.translate(0, 0, -depth / 2)
  return place(paint(g, color), at, rot)
}

/** A flat disc lying on the ground (path stones, rugs). */
export const disc = (r: number, color: THREE.Color, at: V3, seg = 9) => place(paint(new THREE.CylinderGeometry(r, r * 1.05, 0.08, seg), color), at)

/** Merge parts into one geometry (position, normal, colour only). */
export function merge(parts: THREE.BufferGeometry[]) {
  const clean = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g
    for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'color'].includes(name)) ng.deleteAttribute(name)
    if (!ng.attributes.normal) ng.computeVertexNormals()
    return ng
  })
  const m = mergeGeometries(clean, false)!
  m.computeBoundingSphere()
  return m
}

/** A canvas texture for signs and screens (drawn once). */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Torus (rings, smiles, portals); `arc` < 2π gives a partial ring. Lies in the x/y plane. */
export function torus(r: number, tube: number, color: THREE.Color, at?: [number, number, number], rot?: [number, number, number], arc = Math.PI * 2, seg = 24) {
  const g = new THREE.TorusGeometry(r, tube, 8, seg, arc)
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)))
  if (at) g.translate(...at)
  return paint(g, color)
}

/** A box stretched between two points (track segments, rails, struts). */
export function beam(from: THREE.Vector3, to: THREE.Vector3, width: number, thick: number, color: THREE.Color) {
  const len = from.distanceTo(to)
  const g = new THREE.BoxGeometry(width, thick, len)
  const m = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0))
  g.applyMatrix4(m)
  const mid = from.clone().add(to).multiplyScalar(0.5)
  g.translate(mid.x, mid.y, mid.z)
  return paint(g, color)
}

/** A cog: disc plus teeth, in the x/y plane (spins around z). */
export function gear(r: number, depth: number, teeth: number, color: THREE.Color) {
  const parts: THREE.BufferGeometry[] = [cyl(r, r, depth, color, [0, 0, 0], [Math.PI / 2, 0, 0], 24)]
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    parts.push(box([r * 0.28, r * 0.3, depth], color, [Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08, 0], [0, 0, a]))
  }
  parts.push(cyl(r * 0.28, r * 0.28, depth * 1.4, hex('#5f402b'), [0, 0, 0], [Math.PI / 2, 0, 0], 12))
  return merge(parts)
}

import { useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The Pilot's little sky-ship: a wooden hull, a canvas sail, fabric glider wings and a stern propeller.
 * Original design, built in code. Bow points along +Z. The hull's gunwale sits at y = 0.
 */

const L = 3.6 // length
const HALF_W = 0.72
const DEPTH = 0.78
export const DECK_Y = -0.14
const SEAT_TOP = DECK_Y + 0.32
/** The Sit clip's seat is 0.18 of the 1.2 m GLB, i.e. 0.27 at the Pilot's 1.8 size. */
const SIT_HEIGHT = 0.27
/** Where the Pilot's root (feet origin) goes when seated, in ship space. */
export const SEAT = new THREE.Vector3(0, SEAT_TOP - SIT_HEIGHT, -0.75)

const c = (hex: string) => new THREE.Color(hex)
const WOOD_A = c('#c08a5a'), WOOD_B = c('#ad7a4d'), TRIM = c('#6f4a30'), KEEL = c('#5f402b'), ACCENT = c('#F26B3A')
const DECK_A = c('#d9b07a'), DECK_B = c('#cfa36c'), CANVAS = c('#f7efe1'), METAL = c('#5b5650')

function paint(g: THREE.BufferGeometry, color: THREE.Color) {
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([color.r, color.g, color.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

/** Smooth normals from the indexed mesh, then one flat colour per triangle (crisp bands instead of smeared gradients). */
function faceColours(g: THREE.BufferGeometry, colourOf: (tri: number, cx: number, cy: number, cz: number) => THREE.Color) {
  if (!g.attributes.normal) g.computeVertexNormals()
  const ng = g.index ? g.toNonIndexed() : g
  const p = ng.attributes.position
  const arr = new Float32Array(p.count * 3)
  for (let t = 0; t < p.count / 3; t++) {
    const i = t * 3
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
    const col = colourOf(t, cx, cy, cz)
    for (let k = 0; k < 3; k++) arr.set([col.r, col.g, col.b], (i + k) * 3)
  }
  ng.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return ng
}

function clean(g: THREE.BufferGeometry) {
  const ng = g.index ? g.toNonIndexed() : g
  for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'color'].includes(name)) ng.deleteAttribute(name)
  if (!ng.attributes.normal) ng.computeVertexNormals()
  return ng
}

const width = (u: number) => HALF_W * (u > 0 ? Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.2))) : 1 - 0.32 * Math.pow(-u, 3))
const depth = (u: number) => DEPTH * (u > 0 ? 1 - Math.pow(u, 3) * 0.85 : 1 - 0.35 * u * u)
const sheer = (u: number) => 0.16 * u * u + (u > 0 ? 0.14 * Math.pow(u, 3) : 0.04 * -u)

function hull() {
  const NZ = 16, PJ = 10
  const pos: number[] = [], idx: number[] = []
  for (let i = 0; i <= NZ; i++) {
    const u = -1 + (2 * i) / NZ
    const z = (u * L) / 2
    const w = width(u), d = depth(u), y0 = sheer(u)
    for (let j = 0; j <= PJ; j++) {
      const phi = (j / PJ) * Math.PI
      pos.push(-w * Math.cos(phi), y0 - d * Math.pow(Math.sin(phi), 0.75), z)
    }
  }
  const row = PJ + 1
  for (let i = 0; i < NZ; i++)
    for (let j = 0; j < PJ; j++) {
      const a = i * row + j, b = (i + 1) * row + j
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  // transom: close the stern
  const centre = pos.length / 3
  pos.push(0, sheer(-1) - depth(-1) * 0.5, -L / 2)
  for (let j = 0; j < PJ; j++) idx.push(centre, j + 1, j)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const quads = NZ * PJ
  const band = (j: number) => {
    const e = Math.min(j, PJ - 1 - j) // 0 at the rails, growing towards the keel
    return e === 0 ? WOOD_B : e === 1 ? ACCENT : e >= 4 ? KEEL : e === 2 ? WOOD_A : WOOD_B
  }
  return faceColours(g, (t) => (t < quads * 2 ? band(Math.floor(t / 2) % PJ) : WOOD_B))
}

function deck() {
  const NZ = 14
  const pos: number[] = [], idx: number[] = []
  for (let i = 0; i <= NZ; i++) {
    const u = -0.98 + (1.9 * i) / NZ
    const z = (u * L) / 2
    const w = width(u) * 0.9
    pos.push(-w, DECK_Y + sheer(u) * 0.6, z, w, DECK_Y + sheer(u) * 0.6, z)
  }
  for (let i = 0; i < NZ; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return faceColours(g, (t) => (Math.floor(t / 2) % 2 ? DECK_A : DECK_B))
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return paint(g, color)
}

function cyl(r0: number, r1: number, h: number, color: THREE.Color, seg = 8) {
  return paint(new THREE.CylinderGeometry(r0, r1, h, seg), color)
}

/** Fabric glider wing on one side (side = -1 left, +1 right), swept back. */
function wing(side: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.5)
  shape.lineTo(1.35, -0.25)
  shape.lineTo(1.2, -0.55)
  shape.lineTo(0, -0.45)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
  // lay it flat (x outwards, z along the hull), tilt up a little
  g.rotateX(-Math.PI / 2)
  g.rotateZ(side * 0.18)
  if (side < 0) g.scale(-1, 1, 1)
  g.translate(side * HALF_W * 0.85, -0.22, -0.1)
  return faceColours(g, (_t, cx) => (Math.abs(cx) > HALF_W + 0.95 ? ACCENT : CANVAS))
}

function shipBody() {
  const parts: THREE.BufferGeometry[] = [hull(), deck()]
  // mast, yard and pennant
  const mast = cyl(0.05, 0.065, 2.9, TRIM)
  mast.translate(0, DECK_Y + 1.45, 0.45)
  parts.push(mast)
  const yard = cyl(0.03, 0.03, 1.8, TRIM, 6)
  yard.rotateZ(Math.PI / 2)
  yard.translate(0, DECK_Y + 2.62, 0.47)
  parts.push(yard)
  const pennantShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 0.28), new THREE.Vector2(-0.6, 0.14)])
  const pennant = paint(new THREE.ShapeGeometry(pennantShape), ACCENT)
  pennant.rotateY(Math.PI / 2)
  pennant.translate(0, DECK_Y + 2.72, 0.45)
  parts.push(pennant)
  // bench for the Pilot, and a little crate of cargo
  parts.push(box(0.9, 0.08, 0.42, 0, SEAT_TOP - 0.04, SEAT.z, DECK_A))
  parts.push(box(0.08, SEAT_TOP - DECK_Y - 0.08, 0.36, -0.36, (SEAT_TOP + DECK_Y) / 2 - 0.04, SEAT.z, TRIM))
  parts.push(box(0.08, SEAT_TOP - DECK_Y - 0.08, 0.36, 0.36, (SEAT_TOP + DECK_Y) / 2 - 0.04, SEAT.z, TRIM))
  parts.push(box(0.42, 0.36, 0.42, 0.18, DECK_Y + 0.18, 1.05, WOOD_B))
  // bow lantern post
  const post = cyl(0.025, 0.025, 0.45, TRIM, 6)
  post.translate(0, sheer(0.9) + 0.2, (0.88 * L) / 2)
  parts.push(post)
  // glider wings
  parts.push(wing(1), wing(-1))
  // propeller hub housing at the stern
  const hub = cyl(0.09, 0.12, 0.25, METAL)
  hub.rotateX(Math.PI / 2)
  hub.translate(0, -0.32, -L / 2 - 0.08)
  parts.push(hub)
  const merged = mergeGeometries(parts.map(clean), false)!
  merged.computeBoundingSphere()
  return merged
}

function sail() {
  const W = 1.55, H = 1.85, NX = 10, NY = 10
  const g = new THREE.PlaneGeometry(W, H, NX, NY)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / W + 0.5, v = p.getY(i) / H + 0.5
    p.setZ(i, 0.32 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)))
  }
  g.deleteAttribute('uv')
  g.computeVertexNormals()
  const out = faceColours(g, (_t, _x, cy) => {
    const v = cy / H + 0.5
    return v > 0.4 && v < 0.5 ? ACCENT : CANVAS
  })
  out.translate(0, DECK_Y + 2.62 - H / 2, 0.52)
  return out
}

function propeller() {
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 3; k++) {
    const blade = new THREE.BoxGeometry(0.09, 0.42, 0.02)
    blade.translate(0, 0.24, 0)
    blade.rotateZ((k * Math.PI * 2) / 3)
    parts.push(paint(blade, k === 0 ? ACCENT : WOOD_A))
  }
  return mergeGeometries(parts.map(clean), false)!
}

export function SkyShip({
  propRef,
  sailRef,
  lanternRef,
  night,
}: {
  propRef: RefObject<THREE.Group | null>
  sailRef: RefObject<THREE.Mesh | null>
  lanternRef: RefObject<THREE.MeshBasicMaterial | null>
  night: boolean
}) {
  const body = useMemo(shipBody, [])
  const sailGeo = useMemo(sail, [])
  const propGeo = useMemo(propeller, [])
  return (
    <group>
      <mesh geometry={body}>
        <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={sailGeo} ref={sailRef}>
        <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <group ref={propRef} position={[0, -0.32, -L / 2 - 0.22]}>
        <mesh geometry={propGeo}>
          <meshLambertMaterial vertexColors />
        </mesh>
      </group>
      <mesh position={[0, sheer(0.9) + 0.47, (0.88 * L) / 2]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshBasicMaterial ref={lanternRef} color={night ? '#ffd27a' : '#f3d9a4'} />
      </mesh>
      {night && <pointLight position={[0, sheer(0.9) + 0.6, (0.88 * L) / 2]} color="#ffcf7a" intensity={4} distance={6} />}
    </group>
  )
}

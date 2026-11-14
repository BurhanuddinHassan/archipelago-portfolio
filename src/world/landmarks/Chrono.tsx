import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CHRONO, FACE_YAW, groundY, type IslandDef } from '../layout'
import { player } from '../player'
import { caught } from '../play'
import { C, beam, blob, box, canvasTexture, cone, cyl, hex, merge, paint, sphere, torus } from './kit'

/**
 * Chrono Rebellion island: the story of the game as a diorama.
 * A glowing crack (the timeline split) runs from the clock tower through the island.
 * Left of it is 1944: a bunker, a watchtower, a crate of stolen alien tech, and a soldier running the
 * same patrol / chase / attack / return state machine as the game's enemy AI.
 * Right of it is 2145: Aiden's ship on its landing pad.
 */

type V3 = [number, number, number]
type XZ = [number, number]

const CONCRETE = hex('#a3a294'), CONCRETE_DARK = hex('#86867a'), FIELD = hex('#737a63'), FIELD_DARK = hex('#565c49')
const SAND = hex('#bfae82'), STEEL = hex('#565c78'), STEEL_DARK = hex('#3c4058'), HULL = hex('#e9edf5'), HULL_SHADE = hex('#c5cbda')
const CYAN = hex('#7de3ff'), ALIEN = hex('#7dffb0'), SKIN = hex('#e8b88f')

/** Squashed sphere. */
export function ell(rx: number, ry: number, rz: number, color: THREE.Color, at: V3, seg = 12) {
  const g = sphere(1, color, [0, 0, 0], seg)
  g.scale(rx, ry, rz)
  g.translate(...at)
  return g
}

export function Body({ g }: { g: THREE.BufferGeometry }) {
  return (
    <mesh geometry={g} castShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

export function Glow({ g, night, day = '#d8d0c4' }: { g: THREE.BufferGeometry; night: boolean; day?: string }) {
  return (
    <mesh geometry={g}>
      <meshBasicMaterial vertexColors color={night ? '#ffffff' : day} toneMapped={false} />
    </mesh>
  )
}

/** Puts children on the ground at an island-local spot, facing the camera (+Z towards the viewer, +X screen-right). */
export function At({ def, xz, turn = 0, scale = 1, lift = 0, children }: { def: IslandDef; xz: XZ; turn?: number; scale?: number; lift?: number; children: ReactNode }) {
  return (
    <group position={[xz[0], groundY(def, xz[0], xz[1]) + lift, xz[1]]} rotation={[0, FACE_YAW + turn, 0]} scale={scale}>
      {children}
    </group>
  )
}

/* ---------------- static pieces ---------------- */

function clockTower(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const brick = hex('#a8574a'), brickDark = hex('#8c463c')
  p.push(box([2.6, 0.3, 2.4], C.stone, [0, 0.15, 0]))
  p.push(box([0.82, 3.7, 1.6], brick, [-0.41, 2.15, 0]))
  p.push(box([0.82, 3.7, 1.6], STEEL, [0.41, 2.15, 0]))
  for (let i = 0; i < 8; i++) p.push(box([0.84, 0.04, 1.62], brickDark, [-0.41, 0.6 + i * 0.42, 0]))
  for (const x of [0.22, 0.6]) g.push(box([0.06, 1.85, 0.03], accent, [x, 1.38, 0.81])) // stop below the clock face
  p.push(box([0.3, 0.5, 0.05], hex('#2b2730'), [-0.42, 1.2, 0.81])) // an old window on the 1944 half
  p.push(box([1.9, 0.2, 1.9], C.stoneDark, [0, 4.08, 0]))
  p.push(cone(1.35, 1.4, hex('#4a3f6b'), [0, 4.88, 0], [0, Math.PI / 4, 0], 4))
  p.push(torus(0.62, 0.06, C.gold, [0, 3.1, 0.82], undefined, Math.PI * 2, 28))
  return { body: merge(p), glow: merge(g) }
}

function clockFace() {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#f6efe2'
    ctx.beginPath()
    ctx.arc(128, 128, 126, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b2730'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.fillRect(128 + Math.sin(a) * 100 - 4, 128 - Math.cos(a) * 100 - 4, 8, 8)
    }
  })
}

function bunker() {
  const p: THREE.BufferGeometry[] = []
  p.push(box([2.9, 1.25, 1.9], CONCRETE, [0, 0.62, 0]))
  p.push(box([3.2, 0.26, 2.2], CONCRETE_DARK, [0, 1.36, 0], [0.05, 0, 0])) // roof slab, tipped forward a little
  p.push(box([1.7, 0.2, 0.06], hex('#23211f'), [-0.3, 0.86, 0.96])) // firing slit
  p.push(box([1.9, 0.08, 0.2], CONCRETE_DARK, [-0.3, 0.72, 1.0]))
  p.push(box([0.56, 0.95, 0.07], hex('#4a4f3f'), [1.05, 0.48, 0.96])) // steel door
  p.push(sphere(0.04, C.metal, [0.86, 0.5, 1.01], 6))
  for (const x of [-1.47, 1.47]) p.push(box([0.1, 1.25, 1.94], CONCRETE_DARK, [x, 0.62, 0]))
  // earth and moss heaped on the roof and against the back
  ;[[-0.9, 1.5, -0.3, 0.6], [0.4, 1.52, 0.1, 0.5], [1.0, 1.48, -0.5, 0.45], [-1.5, 0.5, -0.9, 0.7], [1.5, 0.45, -0.8, 0.6]].forEach(([x, y, z, r], i) =>
    p.push(blob(r, i % 2 ? hex('#7fa650') : hex('#8a6748'), [x, y, z], 0.5, i + 4)),
  )
  // radio mast
  p.push(cyl(0.02, 0.03, 1.5, C.ink, [-1.2, 2.2, -0.6], undefined, 5))
  p.push(box([0.3, 0.02, 0.02], C.ink, [-1.2, 2.7, -0.6]))
  p.push(box([0.2, 0.02, 0.02], C.ink, [-1.2, 2.5, -0.6]))
  return merge(p)
}

function sandbags() {
  const p: THREE.BufferGeometry[] = []
  const bag = (x: number, y: number, z: number, i: number) => p.push(blob(0.3, i % 3 ? SAND : hex('#ab9a70'), [x, y, z], 0.5, i + 2))
  for (let i = 0; i < 6; i++) bag(-1.2 + i * 0.48, 0.14, Math.abs(i - 2.5) * 0.09, i)
  for (let i = 0; i < 5; i++) bag(-0.96 + i * 0.48, 0.4, Math.abs(i - 2) * 0.09, i + 7)
  for (let i = 0; i < 2; i++) bag(-0.3 + i * 0.5, 0.64, 0.04, i + 13)
  // a spare helmet and an ammo box
  p.push(ell(0.17, 0.12, 0.19, FIELD_DARK, [0.95, 0.72, 0.1]))
  p.push(box([0.42, 0.24, 0.26], FIELD_DARK, [1.75, 0.12, 0.25], [0, 0.4, 0]))
  return merge(p)
}

function watchtower() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const H = 2.7
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    p.push(beam(new THREE.Vector3(x * 0.7, 0, z * 0.7), new THREE.Vector3(x * 0.48, H, z * 0.48), 0.1, 0.1, C.woodDark))
  for (const z of [-0.6, 0.6]) {
    p.push(beam(new THREE.Vector3(-0.62, 0.5, z), new THREE.Vector3(0.52, 2.2, z), 0.06, 0.06, C.wood))
    p.push(beam(new THREE.Vector3(0.62, 0.5, z), new THREE.Vector3(-0.52, 2.2, z), 0.06, 0.06, C.wood))
  }
  p.push(box([1.3, 0.1, 1.3], C.woodLight, [0, H, 0]))
  for (const [x, z, w, d] of [[0, 0.62, 1.3, 0.06], [0, -0.62, 1.3, 0.06], [0.62, 0, 0.06, 1.3], [-0.62, 0, 0.06, 1.3]]) p.push(box([w, 0.42, d], C.wood, [x, H + 0.26, z]))
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) p.push(box([0.07, 1.0, 0.07], C.woodDark, [x, H + 0.55, z]))
  p.push(cone(1.05, 0.55, FIELD_DARK, [0, H + 1.3, 0], [0, Math.PI / 4, 0], 4))
  // ladder
  for (const x of [-0.16, 0.16]) p.push(beam(new THREE.Vector3(x, 0, 1.0), new THREE.Vector3(x, H, 0.66), 0.04, 0.04, C.wood))
  for (let i = 1; i < 8; i++) p.push(box([0.32, 0.035, 0.035], C.wood, [0, (i * H) / 8, 1.0 - (i / 8) * 0.34]))
  // searchlight
  p.push(cyl(0.16, 0.2, 0.24, C.metal, [0.3, H + 0.72, 0.5], [1.1, 0, 0], 10))
  g.push(cyl(0.15, 0.15, 0.03, C.yellow, [0.3, H + 0.67, 0.61], [1.1, 0, 0], 10))
  return { body: merge(p), glow: merge(g) }
}

function techCrate() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([0.8, 0.5, 0.6], C.wood, [0, 0.25, 0]))
  for (const x of [-0.36, 0.36]) p.push(box([0.07, 0.54, 0.64], C.woodDark, [x, 0.25, 0]))
  p.push(box([0.82, 0.06, 0.62], C.woodDark, [0.12, 0.6, -0.34], [-1.0, 0, 0.1])) // lid pushed open
  // what's inside is not from 1944
  g.push(sphere(0.19, ALIEN, [0, 0.56, 0], 10))
  for (const [x, z, h, r] of [[-0.2, 0.08, 0.5, 0.3], [0.2, -0.05, 0.42, -0.25], [0.02, 0.14, 0.34, 0.1]]) g.push(cone(0.07, h, ALIEN, [x, 0.5 + h / 2, z], [0.15, 0, r], 5))
  // a second, sealed crate
  p.push(box([0.6, 0.42, 0.5], C.woodLight, [0.95, 0.21, 0.25], [0, 0.35, 0]))
  p.push(box([0.62, 0.05, 0.1], C.metal, [0.95, 0.3, 0.25], [0, 0.35, 0]))
  return { body: merge(p), glow: merge(g) }
}

function wireFence(posts: THREE.Vector3[]) {
  const p: THREE.BufferGeometry[] = []
  posts.forEach((q, i) => {
    p.push(cyl(0.04, 0.05, 0.95, C.woodDark, [q.x, q.y + 0.47, q.z], [0.08 * (i % 2 ? 1 : -1), 0, 0.1], 6))
    if (i === 0) return
    const a = posts[i - 1]
    for (const h of [0.35, 0.62, 0.86]) p.push(beam(new THREE.Vector3(a.x, a.y + h, a.z), new THREE.Vector3(q.x, q.y + h, q.z), 0.02, 0.02, C.metal))
    for (let k = 1; k < 5; k++) {
      const m = a.clone().lerp(q, k / 5)
      p.push(torus(0.12, 0.012, C.metal, [m.x, m.y + 0.62, m.z], [0, k * 0.9, 0.5], Math.PI * 2, 8))
    }
  })
  return merge(p)
}

function landingPad(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(cyl(1.85, 2.0, 0.22, STEEL_DARK, [0, 0.11, 0], undefined, 10))
  p.push(cyl(1.55, 1.55, 0.03, STEEL, [0, 0.235, 0], undefined, 10))
  g.push(torus(1.68, 0.035, accent, [0, 0.24, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 10))
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3
    p.push(cyl(0.07, 0.09, 0.2, C.metal, [Math.cos(a) * 1.82, 0.3, Math.sin(a) * 1.82], undefined, 6))
    g.push(sphere(0.06, CYAN, [Math.cos(a) * 1.82, 0.43, Math.sin(a) * 1.82], 6))
  }
  // boarding ramp towards the crack
  p.push(box([0.7, 0.05, 1.0], STEEL, [-1.7, 0.12, 1.2], [0.18, -0.9, 0]))
  return { body: merge(p), glow: merge(g) }
}

/** Aiden's ship, nose along +Z. */
function ship(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const Y = 0.72
  p.push(ell(0.46, 0.34, 1.45, HULL, [0, Y, 0], 16))
  p.push(ell(0.3, 0.2, 0.52, hex('#27304a'), [0, Y + 0.2, 0.52], 12)) // canopy
  p.push(box([0.12, 0.05, 1.7], accent, [0, Y + 0.31, -0.35]))
  for (const s of [-1, 1]) {
    p.push(box([1.25, 0.07, 0.75], HULL_SHADE, [s * 0.85, Y - 0.05, -0.35], [0, s * 0.42, s * -0.1])) // swept wing
    p.push(box([0.12, 0.09, 0.8], accent, [s * 1.42, Y - 0.1, -0.62], [0, s * 0.42, 0]))
    p.push(cyl(0.17, 0.2, 0.75, STEEL, [s * 0.44, Y - 0.02, -1.15], [Math.PI / 2, 0, 0], 10)) // engine
    g.push(cyl(0.15, 0.15, 0.04, CYAN, [s * 0.44, Y - 0.02, -1.54], [Math.PI / 2, 0, 0], 10))
    p.push(box([0.05, 0.5, 0.5], HULL_SHADE, [s * 0.2, Y + 0.42, -1.0], [-0.5, 0, s * 0.3])) // tail fin
    p.push(beam(new THREE.Vector3(s * 0.4, Y - 0.2, -0.5), new THREE.Vector3(s * 0.62, 0, -0.62), 0.05, 0.05, C.metal)) // landing legs
    p.push(cyl(0.1, 0.1, 0.04, C.metal, [s * 0.62, 0.02, -0.62], undefined, 8))
  }
  p.push(beam(new THREE.Vector3(0, Y - 0.25, 0.7), new THREE.Vector3(0, 0, 0.85), 0.05, 0.05, C.metal))
  p.push(cyl(0.1, 0.1, 0.04, C.metal, [0, 0.02, 0.85], undefined, 8))
  g.push(box([0.05, 0.03, 0.5], CYAN, [0, Y - 0.33, 0.1]))
  return { body: merge(p), glow: merge(g) }
}

function pylon(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(cyl(0.2, 0.26, 0.2, STEEL_DARK, [0, 0.1, 0], undefined, 6))
  p.push(cyl(0.07, 0.12, 2.3, STEEL, [0, 1.35, 0], undefined, 6))
  g.push(box([0.04, 1.5, 0.04], accent, [0, 1.3, 0.1]))
  g.push(sphere(0.11, CYAN, [0, 2.6, 0], 8))
  p.push(torus(0.2, 0.025, C.metal, [0, 2.6, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 10))
  return { body: merge(p), glow: merge(g) }
}

function cargoPods(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  for (const [x, z, r] of [[0, 0, 0.2], [0.75, 0.2, -0.4]]) {
    p.push(cyl(0.28, 0.28, 0.75, HULL, [x, 0.3, z], [0, r, Math.PI / 2], 10))
    p.push(cyl(0.29, 0.29, 0.12, accent, [x, 0.3, z], [0, r, Math.PI / 2], 10))
    g.push(box([0.3, 0.04, 0.04], CYAN, [x, 0.58, z], [0, r, 0]))
  }
  p.push(cyl(0.26, 0.26, 0.7, HULL_SHADE, [0.35, 0.8, 0.1], [0, 0.1, Math.PI / 2], 10))
  return { body: merge(p), glow: merge(g) }
}

/* ---------------- the timeline crack ---------------- */

/** A flat ribbon on the ground along the crack, tapering to nothing at the near end. */
function crackStrip(def: IslandDef, width: number, lift: number) {
  const pts = CHRONO.crack, pos: number[] = [], idx: number[] = []
  pts.forEach(([x, z], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1
    const w = width * (1 - Math.pow(i / (pts.length - 1), 3) * 0.9) * (i % 2 ? 1.3 : 0.75)
    const y = groundY(def, x, z) + lift
    pos.push(x - (dz / len) * w, y, z + (dx / len) * w, x + (dz / len) * w, y, z - (dx / len) * w)
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

/** A sheet of light rising out of the crack. */
function crackCurtain(def: IslandDef) {
  const pts = CHRONO.crack, pos: number[] = [], uv: number[] = [], idx: number[] = []
  pts.forEach(([x, z], i) => {
    const y = groundY(def, x, z) + 0.05, h = 2.0 * (1 - (i / (pts.length - 1)) * 0.6)
    pos.push(x, y, z, x, y + h, z)
    uv.push(i / (pts.length - 1), 0, i / (pts.length - 1), 1)
    if (i) idx.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

function fadeTexture() {
  return canvasTexture(4, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, '#000000')
    g.addColorStop(0.55, '#3a3a3a')
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 64)
  })
}

/* ---------------- the patrol soldier ---------------- */

type Mode = 'patrol' | 'alert' | 'chase' | 'attack' | 'return'
const MODE_COLOUR: Record<Mode, string> = { patrol: '#8fe08a', alert: '#ffd75e', chase: '#ff7a5c', attack: '#ff4d4d', return: '#9fc4ff' }

const SIGHT_RANGE = 4.0
const SIGHT_HALF_ANGLE = 0.56 // ~32 degrees either side
const WALK = 1.0, RUN = 2.3

function soldierBody() {
  const p: THREE.BufferGeometry[] = []
  p.push(box([0.46, 0.46, 0.3], FIELD, [0, 0.62, 0]))
  p.push(box([0.48, 0.07, 0.32], hex('#3d3a33'), [0, 0.46, 0]))
  p.push(sphere(0.25, SKIN, [0, 1.05, 0], 12))
  p.push(ell(0.3, 0.2, 0.31, FIELD_DARK, [0, 1.17, -0.01], 12)) // plain helmet, no markings
  p.push(box([0.6, 0.03, 0.62], FIELD_DARK, [0, 1.1, -0.01]))
  for (const x of [-0.07, 0.07]) p.push(sphere(0.03, C.ink, [x, 1.04, 0.23], 6))
  p.push(box([0.13, 0.36, 0.14], FIELD, [-0.3, 0.62, 0.06], [-0.5, 0, 0]))
  p.push(box([0.13, 0.36, 0.14], FIELD, [0.3, 0.62, 0.1], [-0.9, 0, 0]))
  p.push(box([0.06, 0.07, 0.74], hex('#3a2c22'), [0.2, 0.6, 0.3])) // rifle
  p.push(box([0.04, 0.04, 0.3], C.ink, [0.2, 0.62, 0.72]))
  p.push(box([0.26, 0.3, 0.14], FIELD_DARK, [0, 0.66, -0.2])) // pack
  return merge(p)
}

function soldierLeg() {
  const g = merge([box([0.17, 0.34, 0.2], FIELD_DARK, [0, -0.17, 0]), box([0.19, 0.12, 0.27], hex('#2f2a25'), [0, -0.37, 0.03])])
  return g
}

function stateTag(mode: Mode) {
  return canvasTexture(256, 72, (ctx) => {
    ctx.fillStyle = 'rgba(30,27,36,0.92)'
    ctx.beginPath()
    ctx.roundRect(4, 6, 248, 60, 30)
    ctx.fill()
    ctx.fillStyle = MODE_COLOUR[mode]
    ctx.beginPath()
    ctx.arc(38, 36, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '700 30px "Inter", "Segoe UI", sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(mode.toUpperCase(), 62, 38)
  })
}

const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/**
 * The enemy AI from the game, running live:
 *   PATROL  walk the waypoint loop, watching a vision cone
 *   ALERT   the Pilot stepped into the cone: stop and turn to face him
 *   CHASE   run at him
 *   ATTACK  in range: fire a short burst
 *   RETURN  target lost or burst done: walk back to the route, then PATROL again (after a cooldown)
 */
function Soldier({ def, near }: { def: IslandDef; near: React.MutableRefObject<boolean> }) {
  const body = useMemo(soldierBody, [])
  const leg = useMemo(soldierLeg, [])
  const cone = useMemo(() => new THREE.CircleGeometry(SIGHT_RANGE, 16, -Math.PI / 2 - SIGHT_HALF_ANGLE, SIGHT_HALF_ANGLE * 2).rotateX(-Math.PI / 2), [])
  const tags = useMemo(() => Object.fromEntries((Object.keys(MODE_COLOUR) as Mode[]).map((m) => [m, stateTag(m)])) as unknown as Record<Mode, THREE.Texture>, [])
  useEffect(() => () => Object.values(tags).forEach((t) => t.dispose()), [tags])
  const root = useRef<THREE.Group>(null), legL = useRef<THREE.Mesh>(null), legR = useRef<THREE.Mesh>(null)
  const coneMat = useRef<THREE.MeshBasicMaterial>(null), tag = useRef<THREE.SpriteMaterial>(null), flash = useRef<THREE.Mesh>(null), mark = useRef<THREE.Mesh>(null)
  const route = CHRONO.patrol
  const s = useRef({ mode: 'patrol' as Mode, shown: '' as string, x: route[0][0], z: route[0][1], wp: 1, heading: 0, timer: 0, cooldown: 4, step: 0 })

  useFrame((state, rawDt) => {
    if (!near.current || !root.current) return
    const dt = Math.min(rawDt, 0.05), st = s.current
    // the Pilot, in this island's own coordinates
    const px = player.pos.x - def.position[0], pz = player.pos.z - def.position[2]
    const dx = px - st.x, dz = pz - st.z, dist = Math.hypot(dx, dz)
    const toPilot = Math.atan2(dx, dz)
    const reachable = player.grounded && dist < 7
    const inSight = reachable && dist < SIGHT_RANGE && Math.abs(angleDiff(st.heading, toPilot)) < SIGHT_HALF_ANGLE
    let moving = 0
    const walkTo = (tx: number, tz: number, speed: number) => {
      const ex = tx - st.x, ez = tz - st.z, d = Math.hypot(ex, ez)
      if (d < 0.08) return true
      st.heading += angleDiff(st.heading, Math.atan2(ex, ez)) * Math.min(1, dt * 7)
      const k = Math.min(1, (speed * dt) / d)
      st.x += ex * k
      st.z += ez * k
      moving = speed
      return false
    }
    st.cooldown = Math.max(0, st.cooldown - dt)
    st.timer -= dt
    switch (st.mode) {
      case 'patrol':
        if (walkTo(route[st.wp][0], route[st.wp][1], WALK)) st.wp = (st.wp + 1) % route.length
        if (inSight && st.cooldown === 0) {
          st.mode = 'alert'
          st.timer = 0.7
        }
        break
      case 'alert':
        st.heading += angleDiff(st.heading, toPilot) * Math.min(1, dt * 10)
        if (st.timer <= 0) st.mode = reachable ? 'chase' : 'return'
        break
      case 'chase':
        if (!reachable) st.mode = 'return'
        else if (dist < 2.3) {
          st.mode = 'attack'
          st.timer = 1.3
          caught(def.id) // Adventure Mode: the player is sent back to where he landed
        } else walkTo(px, pz, RUN)
        break
      case 'attack':
        st.heading += angleDiff(st.heading, toPilot) * Math.min(1, dt * 10)
        if (st.timer <= 0 || !reachable) st.mode = 'return'
        break
      case 'return':
        if (walkTo(route[st.wp][0], route[st.wp][1], WALK * 1.2)) {
          st.mode = 'patrol'
          st.cooldown = 6
        }
        break
    }
    // pose
    const g = root.current
    g.position.set(st.x, groundY(def, st.x, st.z), st.z)
    g.rotation.y = st.heading
    st.step += moving * dt * 7
    const swing = moving ? Math.sin(st.step) * 0.7 : 0
    if (legL.current) legL.current.rotation.x = swing
    if (legR.current) legR.current.rotation.x = -swing
    const hot = st.mode === 'alert' || st.mode === 'chase' || st.mode === 'attack'
    if (coneMat.current) {
      coneMat.current.color.set(hot ? '#ff5a4d' : '#fff3b0')
      coneMat.current.opacity = hot ? 0.42 : 0.3
    }
    if (flash.current) flash.current.visible = st.mode === 'attack' && Math.sin(state.clock.elapsedTime * 38) > 0.2
    if (mark.current) {
      mark.current.visible = st.mode === 'alert'
      mark.current.position.y = 1.75 + Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.12
    }
    if (tag.current && st.shown !== st.mode) {
      st.shown = st.mode
      tag.current.map = tags[st.mode]
      tag.current.needsUpdate = true
    }
  })

  return (
    <group ref={root} scale={1.25}>
      <mesh geometry={body} castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh ref={legL} geometry={leg} position={[-0.12, 0.43, 0]} castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh ref={legR} geometry={leg} position={[0.12, 0.43, 0]} castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      {/* vision cone on the ground */}
      <mesh geometry={cone} position={[0, 0.07, 0.1]} renderOrder={1}>
        <meshBasicMaterial ref={coneMat} color="#fff3b0" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh ref={flash} position={[0.2, 0.62, 0.95]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <coneGeometry args={[0.1, 0.3, 6]} />
        <meshBasicMaterial color="#ffe27a" toneMapped={false} />
      </mesh>
      <mesh ref={mark} position={[0, 1.75, 0]} visible={false}>
        <octahedronGeometry args={[0.13, 0]} />
        <meshBasicMaterial color="#ffd75e" toneMapped={false} />
      </mesh>
      {/* which state the AI is in, always readable */}
      <sprite position={[0, 1.72, 0]} scale={[1.3, 0.37, 1]}>
        <spriteMaterial ref={tag} map={tags.patrol} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

/* ---------------- the island ---------------- */

export function ChronoRebellion({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const g = useMemo(
    () => ({
      tower: clockTower(accent),
      face: clockFace(),
      bunker: bunker(),
      sandbags: sandbags(),
      watch: watchtower(),
      crate: techCrate(),
      wire: wireFence(CHRONO.wire.map(([x, z]) => new THREE.Vector3(x, groundY(def, x, z), z))),
      pad: landingPad(accent),
      ship: ship(accent),
      pylon: pylon(accent),
      pods: cargoPods(accent),
      scar: crackStrip(def, 0.42, 0.05),
      core: crackStrip(def, 0.17, 0.07),
      curtain: crackCurtain(def),
      fade: fadeTexture(),
      beam: new THREE.ConeGeometry(1.5, 6.5, 16, 1, true).translate(0, -3.25, 0), // apex at the origin, opening downwards
      shard: paint(new THREE.OctahedronGeometry(0.14, 0), hex('#5b4a86')),
    }),
    [def, accent],
  )
  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const near = useRef(true)
  const hour = useRef<THREE.Mesh>(null), minute = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.MeshBasicMaterial>(null), curtain = useRef<THREE.MeshBasicMaterial>(null)
  const shards = useRef<THREE.Group>(null), alien = useRef<THREE.Mesh>(null), beamRef = useRef<THREE.Group>(null)
  const shardSpots = useMemo(() => CHRONO.crack.filter((_, i) => i % 2 === 1).map(([x, z], i) => [x, groundY(def, x, z) + 0.7 + (i % 2) * 0.5, z] as V3), [def])

  useFrame((state, dt) => {
    // nothing here animates while the island is far from the camera
    near.current = state.camera.position.distanceTo(centre) < 80
    if (!near.current) return
    const t = state.clock.elapsedTime
    if (minute.current) minute.current.rotation.z += 1.2 * dt // the clock runs backwards
    if (hour.current) hour.current.rotation.z += 0.1 * dt
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2)
    if (core.current) core.current.color.setRGB(0.62 + pulse * 0.3, 0.5 + pulse * 0.35, 1)
    if (curtain.current) curtain.current.opacity = (night ? 0.5 : 0.34) + pulse * 0.16
    if (alien.current) alien.current.scale.setScalar(1 + Math.sin(t * 3) * 0.06)
    if (beamRef.current) beamRef.current.rotation.y = Math.sin(t * 0.5) * 0.9
    shards.current?.children.forEach((m, i) => {
      m.position.y = shardSpots[i][1] + Math.sin(t * 1.1 + i * 1.9) * 0.18
      m.rotation.x += dt * (0.5 + i * 0.13)
      m.rotation.y += dt * 0.7
    })
  })

  return (
    <>
      {/* ---- the split ---- */}
      <mesh geometry={g.scar} renderOrder={1}>
        <meshBasicMaterial color="#3d2d7a" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <mesh geometry={g.core} renderOrder={2}>
        <meshBasicMaterial ref={core} color="#d8ccff" side={THREE.DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-5} />
      </mesh>
      {!simple && (
        <>
          <mesh geometry={g.curtain} renderOrder={3}>
            <meshBasicMaterial ref={curtain} color={def.accent} alphaMap={g.fade} transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <group ref={shards}>
            {shardSpots.map((p, i) => (
              <mesh key={i} geometry={g.shard} position={p} scale={0.8 + (i % 3) * 0.35}>
                <meshLambertMaterial vertexColors emissive={def.accent} emissiveIntensity={0.5} />
              </mesh>
            ))}
          </group>
        </>
      )}
      <At def={def} xz={CHRONO.tower} scale={1.3}>
        <Body g={g.tower.body} />
        <Glow g={g.tower.glow} night={night} day="#b9a8e8" />
        <mesh position={[0, 3.1, 0.815]}>
          <circleGeometry args={[0.6, 32]} />
          <meshBasicMaterial map={g.face} toneMapped={false} />
        </mesh>
        <mesh ref={minute} position={[0, 3.1, 0.83]}>
          <planeGeometry args={[0.05, 0.9]} />
          <meshBasicMaterial color="#2b2730" />
        </mesh>
        <mesh ref={hour} position={[0, 3.1, 0.835]} rotation={[0, 0, 1.2]}>
          <planeGeometry args={[0.07, 0.6]} />
          <meshBasicMaterial color="#2b2730" />
        </mesh>
      </At>

      {/* ---- 1944 ---- */}
      <At def={def} xz={CHRONO.bunker} scale={1.3} turn={0.12}>
        <Body g={g.bunker} />
      </At>
      <At def={def} xz={CHRONO.sandbags} turn={0.1} scale={1.15}>
        <Body g={g.sandbags} />
      </At>
      <At def={def} xz={CHRONO.watch} turn={-0.2} scale={1.15}>
        <Body g={g.watch.body} />
        <Glow g={g.watch.glow} night={night} day="#efe2b0" />
        {night && (
          // a cone of light that starts at the lamp and sweeps the ground in front of the tower
          <group ref={beamRef} position={[0.3, 3.4, 0.62]}>
            <mesh geometry={g.beam} rotation={[-1.05, 0, 0]}>
              <meshBasicMaterial color="#fff2c4" transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </At>
      <At def={def} xz={CHRONO.crate} turn={0.5} scale={1.25}>
        <Body g={g.crate.body} />
        <mesh ref={alien} geometry={g.crate.glow}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      </At>
      {!simple && <Body g={g.wire} />}
      <Soldier def={def} near={near} />

      {/* ---- 2145 ---- */}
      <At def={def} xz={CHRONO.pad} scale={1.1}>
        <Body g={g.pad.body} />
        <Glow g={g.pad.glow} night={night} day="#b9d9e6" />
        <group position={[0, 0.24, 0]} rotation={[0, -0.75, 0]} scale={1.3}>
          <Body g={g.ship.body} />
          <Glow g={g.ship.glow} night={night} day="#a9dcee" />
        </group>
      </At>
      {CHRONO.pylons.map((xz, i) => (
        <At key={i} def={def} xz={xz}>
          <Body g={g.pylon.body} />
          <Glow g={g.pylon.glow} night={night} day="#b9d9e6" />
        </At>
      ))}
      {!simple && (
        <At def={def} xz={CHRONO.pods} turn={0.4}>
          <Body g={g.pods.body} />
          <Glow g={g.pods.glow} night={night} day="#b9d9e6" />
        </At>
      )}
    </>
  )
}

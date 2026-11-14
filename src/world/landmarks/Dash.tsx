import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DASH, groundY, type IslandDef } from '../layout'
import { Body, Glow, ell } from './Chrono'
import { C, blob, box, cone, cyl, hex, merge, paint, prism, sphere, torus } from './kit'
import { placer, ribbonGrid } from './parts'

/**
 * Paper Plane Dash island: the endless runner itself, playing on a loop.
 * A paper plane laps a three-lane road through a low-poly Japanese town, switching lanes to dodge the fans and pick up
 * energy cells. Nothing on the road speeds it up: the run simply gets faster the longer it lasts, as in the game.
 */

const ASPHALT = hex('#5b5f6b'), ASPHALT_B = hex('#555965'), TILE = hex('#3d4a66'), TILE_DARK = hex('#2f3a52'), BEAM = hex('#4a3426')
const RED = hex('#d8433a'), PAPER = hex('#fbf3df'), BLOSSOM = hex('#f7b6cf'), BLOSSOM_B = hex('#f29ac0')

const LANE = 0.78
const OFFSETS = [-1.4, -1.2, -0.42, -0.36, 0.36, 0.42, 1.2, 1.4]
/** What stands on the road: position along it (0..1) and lane (-1, 0, 1). */
const CELLS: [number, number][] = [[0.1, 0], [0.22, -1], [0.36, 1], [0.5, 1], [0.64, 0], [0.78, -1], [0.9, 0]]
const FANS: [number, number][] = [[0.22, 0], [0.36, -1], [0.5, 0], [0.64, 1], [0.8, 0]]
/** The lane the plane steers to from each point on. */
const STEER: [number, number][] = [[0, 0], [0.15, -1], [0.29, 1], [0.57, 0], [0.71, -1], [0.85, 0]]
const BASE_SPEED = 3.0, RUN = 26, MAX_BOOST = 1.9

function house(seed: number, accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const two = seed % 2 === 0, wall = seed % 3 ? C.cream : C.plaster
  p.push(box([2.6, 0.18, 2.0], C.stoneDark, [0, 0.09, 0]))
  p.push(box([2.3, 1.3, 1.7], wall, [0, 0.83, 0]))
  for (const x of [-1.15, 1.15]) for (const z of [-0.85, 0.85]) p.push(box([0.1, 1.3, 0.1], BEAM, [x, 0.83, z]))
  p.push(box([2.34, 0.08, 1.74], BEAM, [0, 1.12, 0]))
  // sliding paper door and a lit window, both on the side facing the camera
  p.push(box([0.72, 0.95, 0.04], PAPER, [-0.45, 0.66, 0.86]))
  for (const x of [-0.69, -0.45, -0.21]) p.push(box([0.03, 0.95, 0.05], BEAM, [x, 0.66, 0.87]))
  for (const y of [0.45, 0.85]) p.push(box([0.72, 0.03, 0.05], BEAM, [-0.45, y, 0.87]))
  g.push(box([0.6, 0.45, 0.04], hex('#ffe3a0'), [0.55, 0.82, 0.86]))
  p.push(box([0.03, 0.45, 0.05], BEAM, [0.55, 0.82, 0.88]), box([0.6, 0.03, 0.05], BEAM, [0.55, 0.82, 0.88]))
  // cloth strips over the door, and a paper lantern
  for (let i = 0; i < 3; i++) p.push(box([0.22, 0.26, 0.02], accent, [-0.69 + i * 0.24, 1.2, 0.9]))
  g.push(ell(0.11, 0.15, 0.11, hex('#ff8a5c'), [0.02, 1.2, 0.98], 8))
  // tiled roof with wide eaves; the ridge runs along the front
  p.push(box([3.1, 0.08, 2.5], TILE_DARK, [0, 1.52, 0]))
  p.push(prism(2.4, 0.8, 3.0, TILE, [0, 1.56, 0], [0, Math.PI / 2, 0]))
  p.push(box([3.12, 0.1, 0.16], TILE_DARK, [0, 2.38, 0]))
  if (two) {
    p.push(box([1.5, 0.8, 1.2], wall, [0.2, 2.2, -0.2]))
    g.push(box([0.5, 0.36, 0.04], hex('#ffe3a0'), [0.2, 2.24, 0.41]))
    p.push(box([2.1, 0.07, 1.8], TILE_DARK, [0.2, 2.63, -0.2]))
    p.push(prism(1.7, 0.6, 2.0, TILE, [0.2, 2.66, -0.2], [0, Math.PI / 2, 0]))
    p.push(box([2.1, 0.09, 0.14], TILE_DARK, [0.2, 3.28, -0.2]))
  } else {
    // a lean-to with a potted pine
    p.push(box([0.9, 0.06, 0.8], TILE_DARK, [1.55, 1.05, 0.3], [0, 0, -0.25]))
    p.push(cyl(0.16, 0.12, 0.22, hex('#7a8fa8'), [1.6, 0.11, 0.6], undefined, 8), blob(0.26, hex('#4f8a4a'), [1.6, 0.45, 0.6], 0.9, seed))
  }
  return { body: merge(p), glow: merge(g) }
}

/** A red gate spanning the road at each end; the plane flies out through one and back in through the other. */
function torii() {
  const p: THREE.BufferGeometry[] = []
  for (const x of [-1.75, 1.75]) {
    p.push(cyl(0.13, 0.16, 3.2, RED, [x, 1.6, 0], [0, 0, x > 0 ? 0.04 : -0.04], 10))
    p.push(cyl(0.2, 0.22, 0.25, C.ink, [x, 0.12, 0], undefined, 10))
  }
  p.push(box([4.0, 0.16, 0.2], RED, [0, 2.55, 0]))
  p.push(box([4.7, 0.2, 0.26], RED, [0, 3.15, 0]))
  p.push(box([4.9, 0.1, 0.34], C.ink, [0, 3.3, 0]))
  p.push(box([0.3, 0.45, 0.08], C.ink, [0, 2.85, 0]))
  return merge(p)
}

function cherry(seed: number) {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.07, 0.11, 1.0, BEAM, [0, 0.5, 0], [0, 0, 0.08], 6))
  p.push(cyl(0.04, 0.06, 0.6, BEAM, [0.18, 1.05, 0], [0, 0, -0.6], 5))
  p.push(blob(0.55, BLOSSOM, [0, 1.4, 0], 0.8, seed), blob(0.4, BLOSSOM_B, [0.42, 1.25, 0.1], 0.8, seed + 3), blob(0.36, BLOSSOM, [-0.36, 1.2, -0.12], 0.8, seed + 5))
  return merge(p)
}

function stoneLantern() {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.2, 0.24, 0.12, C.stoneDark, [0, 0.06, 0], undefined, 6), cyl(0.07, 0.09, 0.5, C.stone, [0, 0.37, 0], undefined, 6))
  p.push(box([0.3, 0.06, 0.3], C.stoneDark, [0, 0.65, 0]), cone(0.3, 0.2, C.stoneDark, [0, 1.04, 0], [0, Math.PI / 4, 0], 4))
  return { body: merge(p), glow: box([0.2, 0.24, 0.2], hex('#ffd98a'), [0, 0.8, 0]) }
}

function vending() {
  const p = [box([0.6, 1.3, 0.45], hex('#e9edf5'), [0, 0.65, 0]), box([0.62, 0.2, 0.47], RED, [0, 1.2, 0])]
  const g: THREE.BufferGeometry[] = [box([0.48, 0.5, 0.02], hex('#bfe9ff'), [0, 0.8, 0.23])]
  ;['#ff6b5c', '#ffd75e', '#7de3a0', '#7db4ff'].forEach((c, i) => g.push(cyl(0.04, 0.04, 0.14, hex(c), [-0.17 + i * 0.11, 0.86, 0.25], undefined, 6)))
  return { body: merge(p), glow: merge(g) }
}

function bench() {
  const p = [box([1.1, 0.07, 0.36], C.woodLight, [0, 0.38, 0]), box([1.1, 0.3, 0.06], C.woodLight, [0, 0.62, -0.17])]
  for (const x of [-0.45, 0.45]) p.push(box([0.07, 0.38, 0.32], BEAM, [x, 0.19, 0]))
  return merge(p)
}

function pole() {
  const p = [cyl(0.06, 0.08, 3.6, hex('#6b6258'), [0, 1.8, 0], undefined, 6), box([1.0, 0.07, 0.07], hex('#6b6258'), [0, 3.3, 0]), box([0.6, 0.06, 0.06], hex('#6b6258'), [0, 2.95, 0])]
  p.push(cyl(0.09, 0.09, 0.3, hex('#8f96a3'), [0.2, 3.05, 0.1], undefined, 8))
  return merge(p)
}

/** The fan's stand and cage, blowing along +Z. The blades are a separate spinning piece. */
function fanStand() {
  const p = [cyl(0.24, 0.28, 0.07, C.ink, [0, 0.04, 0], undefined, 10), cyl(0.04, 0.05, 0.62, C.metal, [0, 0.36, 0], undefined, 6)]
  p.push(torus(0.4, 0.035, hex('#d8dde6'), [0, 0.95, 0.06], undefined, Math.PI * 2, 18), torus(0.4, 0.03, hex('#d8dde6'), [0, 0.95, -0.08], undefined, Math.PI * 2, 18))
  p.push(cyl(0.1, 0.12, 0.2, C.metal, [0, 0.95, -0.14], [Math.PI / 2, 0, 0], 8))
  for (let i = 0; i < 4; i++) p.push(box([0.02, 0.8, 0.02], hex('#d8dde6'), [0, 0.95, 0.09], [0, 0, (i * Math.PI) / 4]))
  return merge(p)
}
const fanBlades = () => merge([0, 1, 2].map((i) => ell(0.11, 0.32, 0.02, hex('#7db4ff'), [0, 0, 0], 8).translate(0, 0.2, 0).rotateZ((i * Math.PI * 2) / 3)).concat(sphere(0.07, C.ink, [0, 0, 0.02], 6)))

/** An energy cell: a battery with a lightning bolt. */
function cell() {
  const p = [cyl(0.15, 0.15, 0.4, hex('#8dfcc0'), [0, 0, 0], undefined, 10), cyl(0.07, 0.07, 0.07, hex('#eafff4'), [0, 0.23, 0], undefined, 8)]
  for (const z of [0.155, -0.155]) p.push(box([0.07, 0.16, 0.01], C.yellow, [0.02, 0.05, z], [0, 0, 0.5]), box([0.07, 0.16, 0.01], C.yellow, [-0.02, -0.06, z], [0, 0, 0.5]))
  return merge(p)
}

function paperPlane() {
  const v = [[0, 0, 0.9], [-0.75, 0.06, -0.5], [0, 0, -0.5], [0.75, 0.06, -0.5], [0, -0.22, -0.5]]
  const tris = [[0, 1, 2], [0, 2, 3], [0, 2, 4]], pos: number[] = []
  for (const t of tris) for (const k of t) pos.push(...v[k])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return paint(g, C.white)
}

function drawHud(ctx: CanvasRenderingContext2D, speed: number, energy: number, metres: number, crashed: boolean) {
  ctx.clearRect(0, 0, 640, 96)
  ctx.fillStyle = 'rgba(30,27,36,0.9)'
  ctx.beginPath()
  ctx.roundRect(4, 8, 632, 80, 40)
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = '700 34px "Inter", "Segoe UI", sans-serif'
  ctx.fillStyle = crashed ? '#ff8a7a' : '#ffffff'
  ctx.fillText(crashed ? 'CRASHED' : `SPEED ${speed.toFixed(1)}x`, 34, 50)
  // energy bar
  ctx.fillStyle = '#8dfcc0'
  ctx.fillText('⚡', 262, 50)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.roundRect(300, 38, 150, 20, 10)
  ctx.fill()
  ctx.fillStyle = energy < 0.3 ? '#ff8a5c' : '#8dfcc0'
  ctx.beginPath()
  ctx.roundRect(300, 38, Math.max(20, 150 * energy), 20, 10)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'right'
  ctx.fillText(`${metres} m`, 606, 50)
}

export function PaperPlaneDash({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const road = useMemo(() => {
    const a = DASH.a, b = DASH.b, dx = (b[0] - a[0]) / DASH.len, dz = (b[1] - a[1]) / DASH.len
    /** Island-local position `u` (0..1) along the road, `off` across it, `h` above it. */
    const at = (u: number, off: number, h: number, out = new THREE.Vector3()) => {
      const x = a[0] + dx * DASH.len * u - dz * off, z = a[1] + dz * DASH.len * u + dx * off
      return out.set(x, groundY(def, x, z) + h, z)
    }
    return { a, b, at, yaw: Math.atan2(dx, dz) }
  }, [def])

  const g = useMemo(() => {
    const put = placer(def), p: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = []
    const kerb = accent.clone().lerp(C.white, 0.15)
    const strip = ribbonGrid(def, road.a, road.b, OFFSETS, 44, (i, k) => (k === 0 || k === 6 ? (i % 2 ? kerb : C.white) : k === 2 || k === 4 ? (i % 4 < 2 ? C.white : ASPHALT) : i % 2 ? ASPHALT : ASPHALT_B))
    DASH.houses.forEach((xz, i) => {
      const h = house(i + 1, [accent, RED, hex('#5d8fd6'), hex('#5fb37a')][i % 4])
      p.push(put(h.body, xz, [0.12, -0.05, 0.08, -0.1][i % 4], 1.12))
      glow.push(put(h.glow, xz, [0.12, -0.05, 0.08, -0.1][i % 4], 1.12))
    })
    for (const u of [0.015, 0.985]) p.push(put(torii(), [road.at(u, 0, 0).x, road.at(u, 0, 0).z], 0, 1, 0, road.yaw))
    DASH.trees.forEach((xz, i) => (simple && i > 1 ? null : p.push(put(cherry(i + 2), xz, i, 1.25 + (i % 2) * 0.2))))
    DASH.lanterns.forEach((xz) => {
      const l = stoneLantern()
      p.push(put(l.body, xz))
      glow.push(put(l.glow, xz))
    })
    const v = vending()
    p.push(put(v.body, DASH.vending, 0.2), put(bench(), DASH.bench, -0.1))
    glow.push(put(v.glow, DASH.vending, 0.2))
    // utility poles behind the houses, strung with wires
    const tops = DASH.poles.map((xz) => new THREE.Vector3(xz[0], groundY(def, xz[0], xz[1]) + 3.3, xz[1]))
    DASH.poles.forEach((xz) => p.push(put(pole(), xz, 0, 1, 0, road.yaw + Math.PI / 2)))
    for (let i = 0; i < tops.length - 1; i++)
      for (const s of [-0.4, 0.4]) {
        const A = tops[i], B = tops[i + 1], pts: THREE.Vector3[] = []
        for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector3().lerpVectors(A, B, k / 6).add(new THREE.Vector3(Math.cos(road.yaw) * s, -Math.sin((k / 6) * Math.PI) * 0.35, -Math.sin(road.yaw) * s)))
        for (let k = 0; k < 6; k++) {
          const seg = new THREE.CylinderGeometry(0.012, 0.012, pts[k].distanceTo(pts[k + 1]), 3)
          seg.rotateX(Math.PI / 2)
          seg.lookAt(pts[k + 1].clone().sub(pts[k]))
          seg.translate((pts[k].x + pts[k + 1].x) / 2, (pts[k].y + pts[k + 1].y) / 2, (pts[k].z + pts[k + 1].z) / 2)
          p.push(paint(seg, C.ink))
        }
      }
    FANS.forEach(([u, lane]) => {
      const q = road.at(u, lane * LANE, 0)
      p.push(put(fanStand(), [q.x, q.z], 0, 1, 0, road.yaw + Math.PI))
    })
    return { strip, town: merge(p), glow: merge(glow), blades: fanBlades(), cell: cell(), plane: paperPlane(), trail: new THREE.BoxGeometry(0.05, 0.012, 1).translate(0, 0, -0.5) }
  }, [def, accent, road, simple])

  const hud = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 96
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { ctx: c.getContext('2d')!, tex }
  }, [])
  useEffect(() => () => hud.tex.dispose(), [hud])
  const hudAt = useMemo(() => road.at(0.5, 2.2, 4.6).clone(), [road])

  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const plane = useRef<THREE.Group>(null), trail = useRef<THREE.Mesh>(null)
  const bladeRefs = useRef<(THREE.Mesh | null)[]>([]), cellRefs = useRef<(THREE.Mesh | null)[]>([])
  const s = useRef({ u: 0, run: 0, lat: 0, energy: 0.8, metres: 0, crash: -1, doom: -1, taken: CELLS.map(() => false), key: '' }).current
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dtRaw) => {
    if (state.camera.position.distanceTo(centre) > 80) return
    const dt = Math.min(dtRaw, 0.05), time = state.clock.elapsedTime
    // the only thing that makes the plane faster is how long the run has lasted
    const boost = 1 + MAX_BOOST * Math.min(1, s.run / RUN) ** 1.2
    bladeRefs.current.forEach((m) => m && (m.rotation.z += dt * 14))

    if (s.crash >= 0) {
      // hit a fan: tumble, drop, then start a fresh run at 1.0x
      s.crash += dt
      if (plane.current) {
        plane.current.rotation.z += dt * 14
        plane.current.position.y += (1.6 - s.crash * 3.2) * dt
        plane.current.scale.setScalar(Math.max(0.01, 0.8 * (1 - s.crash / 1.5)))
      }
      if (s.crash > 1.5) Object.assign(s, { u: 0, run: 0, lat: 0, energy: 0.8, metres: 0, crash: -1, doom: -1, taken: CELLS.map(() => false) })
    } else {
      s.run += dt
      const before = s.u
      s.u += (dt * BASE_SPEED * boost) / DASH.len
      s.metres += dt * BASE_SPEED * boost * 4
      s.energy = Math.max(0.12, s.energy - dt * 0.2 * boost)
      // once the run has gone on long enough, the next fan ahead is the one that ends it
      if (s.run > RUN && s.doom < 0) s.doom = FANS.findIndex(([u]) => u > s.u + 0.12)
      if (s.doom >= 0 && before < FANS[s.doom][0] && s.u >= FANS[s.doom][0]) s.crash = 0
      if (s.u >= 1) {
        s.u -= 1
        s.taken.fill(false)
        if (s.run > RUN && s.doom < 0) s.doom = 0
      }
      let lane = 0
      for (const [u, l] of STEER) if (s.u >= u) lane = l
      if (s.doom >= 0 && FANS[s.doom][0] - s.u < 0.13 && FANS[s.doom][0] > s.u) lane = FANS[s.doom][1]
      const target = lane * LANE
      s.lat += (target - s.lat) * (1 - Math.exp(-dt * 7 * boost))
      CELLS.forEach(([u, l], i) => {
        if (!s.taken[i] && s.u >= u && s.u - u < 0.05 && Math.abs(s.lat - l * LANE) < 0.4) {
          s.taken[i] = true
          s.energy = Math.min(1, s.energy + 0.17)
        }
      })
      if (plane.current) {
        road.at(s.u, s.lat, 0.95 + Math.sin(time * 5) * 0.05, plane.current.position)
        plane.current.rotation.set(-0.06, road.yaw, (s.lat - target) * 0.9, 'YXZ')
        // fades in and out of the gates so the lap never visibly jumps
        plane.current.scale.setScalar(0.8 * Math.min(1, s.u / 0.04, (1 - s.u) / 0.04))
      }
      if (trail.current) trail.current.scale.z = 0.4 + (boost - 1) * 1.3
    }

    cellRefs.current.forEach((m, i) => {
      if (!m) return
      m.rotation.y = time * 2.5 + i
      const k = s.taken[i] ? 0 : 1
      m.scale.setScalar(m.scale.x + (k - m.scale.x) * Math.min(1, dt * 12))
      road.at(CELLS[i][0], CELLS[i][1] * LANE, 0.95 + Math.sin(time * 2 + i) * 0.07, tmp)
      m.position.copy(tmp)
    })

    const key = `${boost.toFixed(1)}|${Math.round(s.energy * 20)}|${Math.round(s.metres / 5)}|${s.crash >= 0}`
    if (key !== s.key) {
      s.key = key
      drawHud(hud.ctx, boost, s.energy, Math.round(s.metres / 5) * 5, s.crash >= 0)
      hud.tex.needsUpdate = true
    }
  })

  return (
    <>
      <mesh geometry={g.strip} receiveShadow renderOrder={1}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <Body g={g.town} />
      <Glow g={g.glow} night={night} day="#f1dfb4" />
      {FANS.map(([u, lane], i) => {
        const q = road.at(u, lane * LANE, 0.95)
        return (
          <mesh key={i} ref={(el) => void (bladeRefs.current[i] = el)} geometry={g.blades} position={[q.x, q.y, q.z]} rotation={[0, road.yaw + Math.PI, 0]}>
            <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )
      })}
      {CELLS.map((_, i) => (
        <mesh key={i} ref={(el) => void (cellRefs.current[i] = el)} geometry={g.cell}>
          <meshBasicMaterial vertexColors color={night ? '#ffffff' : '#e4f5ea'} toneMapped={false} />
        </mesh>
      ))}
      <group ref={plane} scale={0.8}>
        <mesh geometry={g.plane} castShadow>
          <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={trail} position={[0, -0.02, -0.5]}>
          <primitive object={g.trail} attach="geometry" />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>
      <sprite position={hudAt} scale={[4.2, 0.63, 1]}>
        <spriteMaterial map={hud.tex} depthWrite={false} toneMapped={false} />
      </sprite>
      {night && DASH.lanterns.map((xz, i) => <pointLight key={i} position={[xz[0], groundY(def, xz[0], xz[1]) + 1, xz[1]]} color="#ffd98a" intensity={3} distance={5} />)}
    </>
  )
}

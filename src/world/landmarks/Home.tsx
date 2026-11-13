import { Suspense, useMemo, useRef, useState } from 'react'
import { Html, useTexture } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_YAW, HOME_PIECES, groundY, type IslandDef } from '../layout'
import { profile } from '../../content'
import { shadowTexture } from '../Ambient'
import { C, blob, box, canvasTexture, cone, cyl, disc, hex, merge, prism, sphere, torus } from './kit'
import { Board, labelTex, pathRibbon, placer } from './parts'
import { At } from './Chrono'

/**
 * Home Isle: a cosy cottage, an outdoor cinema for the trailer, a post box at the Contact stop,
 * and a Fruit Slice arcade cabinet you can click to play the real game.
 * Everything faces the camera (FACE_YAW) and is built in code; each piece is one or two meshes.
 */

type V3 = [number, number, number]

function Piece({ body }: { body: THREE.BufferGeometry }) {
  return (
    <mesh geometry={body} castShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

/** Windows, bulbs and lanterns: muted by day, lit by night. */
function GlowMesh({ geometry, night, day = '#bfc9cf', lit = '#ffffff' }: { geometry: THREE.BufferGeometry; night: boolean; day?: string; lit?: string }) {
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors color={night ? lit : day} toneMapped={false} />
    </mesh>
  )
}

function useSpot(def: IslandDef, xz: [number, number]): V3 {
  return [xz[0], groundY(def, xz[0], xz[1]), xz[1]]
}

/* ---------------- Cottage ---------------- */

function cottage() {
  const p: THREE.BufferGeometry[] = []
  const g: THREE.BufferGeometry[] = []
  const WALL_TOP = 2.4
  const RIDGE = WALL_TOP + 1.35
  p.push(box([3.7, 0.3, 3.0], C.stone, [0, 0.15, 0]))
  p.push(box([3.3, 2.1, 2.7], C.cream, [0, 0.3 + 1.05, 0]))
  for (const x of [-1.62, 1.62]) for (const z of [-1.32, 1.32]) p.push(box([0.2, 2.1, 0.2], C.wood, [x, 1.35, z]))
  for (const z of [-1.37, 1.37]) p.push(box([3.45, 0.18, 0.12], C.wood, [0, WALL_TOP - 0.02, z]))
  // gable ends with a round window
  for (const x of [-1.65, 1.65]) {
    p.push(prism(2.7, 1.35, 0.1, C.plaster, [x, WALL_TOP, 0], [0, Math.PI / 2, 0]))
    p.push(cyl(0.26, 0.26, 0.08, C.woodDark, [x * 1.03, WALL_TOP + 0.55, 0], [0, 0, Math.PI / 2], 14))
    g.push(cyl(0.19, 0.19, 0.1, C.white, [x * 1.04, WALL_TOP + 0.55, 0], [0, 0, Math.PI / 2], 14))
  }
  // roof: overlapping tile strips on both slopes, and a ridge cap
  const RUN = 1.75, L = Math.hypot(RUN, RUN), STRIPS = 4
  for (const side of [1, -1])
    for (let k = 0; k < STRIPS; k++) {
      const s = (k + 0.5) * (L / STRIPS)
      const col = k % 2 ? C.roofDark : C.roof
      p.push(box([4.0, 0.14, L / STRIPS + 0.08], col, [0, RIDGE - s * Math.SQRT1_2 + 0.08 + k * 0.015, side * s * Math.SQRT1_2], [side * Math.PI / 4, 0, 0]))
    }
  p.push(box([4.05, 0.18, 0.34], C.roofDark, [0, RIDGE + 0.1, 0]))
  // chimney
  p.push(box([0.5, 1.3, 0.5], C.stone, [1.0, RIDGE - 0.3, -0.6]))
  p.push(box([0.64, 0.12, 0.64], C.stoneDark, [1.0, RIDGE + 0.38, -0.6]))
  // front: door, awning, windows with flower boxes
  p.push(box([1.0, 1.62, 0.06], C.woodDark, [0, 0.3 + 0.8, 1.36]))
  p.push(box([0.82, 1.45, 0.1], C.wood, [0, 0.3 + 0.72, 1.39]))
  p.push(sphere(0.05, C.gold, [0.28, 1.0, 1.46], 8))
  p.push(box([1.25, 0.08, 0.55], C.roofDark, [0, 2.02, 1.6], [0.28, 0, 0]))
  for (const x of [-1.0, 1.0]) {
    p.push(box([0.76, 0.76, 0.08], C.woodDark, [x, 1.5, 1.37]))
    g.push(box([0.58, 0.58, 0.04], C.white, [x, 1.5, 1.41]))
    p.push(box([0.58, 0.05, 0.03], C.woodDark, [x, 1.5, 1.44]))
    p.push(box([0.05, 0.58, 0.03], C.woodDark, [x, 1.5, 1.44]))
    p.push(box([0.82, 0.18, 0.24], C.wood, [x, 1.03, 1.5]))
    ;[C.pink, C.yellow, C.leaf, C.pink].forEach((c, i) => p.push(blob(0.11, c, [x - 0.27 + i * 0.18, 1.17, 1.5], 0.8, i + 3)))
  }
  // side windows
  for (const x of [-1.66, 1.66]) {
    p.push(box([0.08, 0.7, 0.7], C.woodDark, [x, 1.5, 0]))
    g.push(box([0.04, 0.54, 0.54], C.white, [x * 1.025, 1.5, 0]))
  }
  // lantern beside the door
  p.push(box([0.05, 0.05, 0.32], C.woodDark, [0.68, 2.0, 1.52]))
  p.push(box([0.18, 0.26, 0.18], C.metal, [0.68, 1.8, 1.66]))
  g.push(box([0.12, 0.18, 0.2], C.white, [0.68, 1.8, 1.66]))
  // step, barrel planter, path of stones toward the Pilot
  p.push(box([1.05, 0.15, 0.5], C.stone, [0, 0.08, 1.75]))
  p.push(cyl(0.24, 0.22, 0.45, C.wood, [-0.85, 0.23, 1.75]))
  p.push(blob(0.28, C.leaf, [-0.85, 0.52, 1.75], 0.7, 7))
  ;[0.12, -0.1, 0.14, -0.05, 0.1].forEach((dx, i) => p.push(disc(0.26 - i * 0.01, i % 2 ? C.stoneDark : C.stone, [dx, 0.02, 2.3 + i * 0.62])))
  // a short picket fence on one side
  for (let i = 0; i < 6; i++) p.push(box([0.09, 0.55, 0.05], C.white, [2.1 + i * 0.28, 0.28, 0.9]))
  for (const y of [0.18, 0.42]) p.push(box([1.6, 0.06, 0.04], C.white, [2.8, y, 0.92]))
  return { body: merge(p), glow: merge(g) }
}

export function Cottage({ def, night }: { def: IslandDef; night: boolean }) {
  const at = useSpot(def, HOME_PIECES.cottage)
  const { body, glow } = useMemo(cottage, [])
  return (
    <group position={at} rotation={[0, FACE_YAW, 0]}>
      <Piece body={body} />
      <GlowMesh geometry={glow} night={night} day="#cfe3ee" lit="#ffcf73" />
      {night && <pointLight position={[0, 1.8, 2.2]} color="#ffcf7a" intensity={6} distance={7} />}
      <Smoke at={[1.0, 4.25, -0.6]} />
    </group>
  )
}

/* ---------------- Outdoor cinema ---------------- */

function screenTexture() {
  return canvasTexture(1024, 576, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, 576)
    grd.addColorStop(0, '#2c3550')
    grd.addColorStop(1, '#171b28')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, 1024, 576)
    ctx.fillStyle = '#F26B3A'
    ctx.beginPath()
    ctx.arc(512, 250, 92, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff8ee'
    ctx.beginPath()
    ctx.moveTo(482, 196)
    ctx.lineTo(482, 304)
    ctx.lineTo(572, 250)
    ctx.closePath()
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.font = '600 64px "Fredoka", "Trebuchet MS", sans-serif'
    ctx.fillText('THE TRAILER', 512, 432)
    ctx.font = '400 32px "Inter", "Segoe UI", sans-serif'
    ctx.fillStyle = 'rgba(255,248,238,0.7)'
    ctx.fillText('Now showing on Home Isle', 512, 486)
  })
}

function cinema() {
  const p: THREE.BufferGeometry[] = []
  for (const x of [-2.1, 2.1]) {
    p.push(cyl(0.12, 0.14, 3.5, C.wood, [x, 1.75, 0]))
    p.push(box([0.1, 2.7, 0.1], C.woodDark, [x * 0.78, 1.3, -0.62], [0.38, 0, 0]))
  }
  p.push(box([4.0, 2.45, 0.14], C.woodDark, [0, 2.1, -0.05]))
  p.push(prism(4.6, 0.55, 0.62, C.roof, [0, 3.32, -0.02]))
  p.push(box([4.6, 0.08, 0.64], C.roofDark, [0, 3.3, -0.02]))
  // string lights: wire sagging between the post tops
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-2.1, 3.12, 0.16), new THREE.Vector3(0, 2.55, 0.5), new THREE.Vector3(2.1, 3.12, 0.16))
  const wire = new THREE.TubeGeometry(curve, 24, 0.012, 4, false)
  p.push(paint2(wire, C.ink))
  const bulbs: THREE.BufferGeometry[] = []
  const colours = [hex('#ffd27a'), hex('#ff9e7a'), hex('#fff1c2'), hex('#a8e0ff')]
  for (let i = 1; i < 12; i++) {
    const q = curve.getPoint(i / 12)
    bulbs.push(sphere(0.06, colours[i % colours.length], [q.x, q.y - 0.07, q.z], 8))
  }
  // a little popcorn stand beside the screen
  p.push(box([0.5, 0.7, 0.4], C.red, [2.75, 0.35, 0.35]))
  for (let i = 0; i < 3; i++) p.push(box([0.06, 0.7, 0.41], C.white, [2.58 + i * 0.17, 0.35, 0.35]))
  p.push(blob(0.22, C.yellow, [2.75, 0.78, 0.35], 0.6, 5))
  return { body: merge(p), bulbs: merge(bulbs) }
}

/** Paint for geometries built outside the kit. */
function paint2(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

function bench() {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.2, 0.2, 1.4, C.woodLight, [0, 0.42, 0], [0, 0, Math.PI / 2], 9))
  for (const x of [-0.65, 0.65]) p.push(cyl(0.21, 0.21, 0.02, C.cream, [x * 1.08, 0.42, 0], [0, 0, Math.PI / 2], 9))
  for (const x of [-0.45, 0.45]) p.push(cyl(0.14, 0.16, 0.3, C.wood, [x, 0.15, 0], undefined, 8))
  return merge(p)
}

export function Cinema({ def, night }: { def: IslandDef; night: boolean }) {
  const at = useSpot(def, HOME_PIECES.screen)
  const l = useSpot(def, HOME_PIECES.benchL)
  const r = useSpot(def, HOME_PIECES.benchR)
  const { body, bulbs } = useMemo(cinema, [])
  const seat = useMemo(bench, [])
  const tex = useMemo(screenTexture, [])
  return (
    <>
      <group position={at} rotation={[0, FACE_YAW, 0]}>
        <Piece body={body} />
        <GlowMesh geometry={bulbs} night={night} day="#d9cfbf" />
        <mesh position={[0, 2.1, 0.035]}>
          <planeGeometry args={[3.7, 2.08]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        {night && <pointLight position={[0, 2.2, 1.6]} color="#9fb4ff" intensity={5} distance={7} />}
      </group>
      {[l, r].map((p, i) => (
        <mesh key={i} castShadow geometry={seat} position={p} rotation={[0, FACE_YAW, 0]}>
          <meshLambertMaterial vertexColors />
        </mesh>
      ))}
    </>
  )
}

/* ---------------- Post box ---------------- */

function postbox() {
  const p: THREE.BufferGeometry[] = []
  const red = C.red, redDark = hex('#b9402e')
  p.push(box([0.16, 1.05, 0.16], C.wood, [0, 0.52, 0]))
  p.push(box([0.5, 0.36, 0.78], red, [0, 1.22, 0]))
  p.push(cyl(0.25, 0.25, 0.78, red, [0, 1.4, 0], [Math.PI / 2, 0, 0], 16))
  p.push(box([0.44, 0.5, 0.04], redDark, [0, 1.3, 0.4]))
  p.push(sphere(0.035, C.gold, [0.15, 1.28, 0.43], 8))
  // flag up: mail waiting
  p.push(box([0.04, 0.46, 0.04], C.ink, [0.28, 1.5, 0.12]))
  p.push(box([0.035, 0.17, 0.24], C.yellow, [0.28, 1.66, 0.0]))
  // a letter poking out
  p.push(box([0.3, 0.2, 0.02], C.white, [0.02, 1.6, 0.41], [0.15, 0, 0.1]))
  // flower pot at its foot
  p.push(cyl(0.17, 0.13, 0.26, C.roofDark, [0.42, 0.13, 0.18]))
  p.push(blob(0.2, C.leaf, [0.42, 0.34, 0.18], 0.75, 11))
  p.push(blob(0.07, C.pink, [0.36, 0.45, 0.25], 0.9, 2))
  p.push(blob(0.07, C.yellow, [0.5, 0.43, 0.12], 0.9, 4))
  return merge(p)
}

export function PostBox({ def }: { def: IslandDef }) {
  const at = useSpot(def, HOME_PIECES.postbox)
  const g = useMemo(postbox, [])
  return (
    <mesh castShadow geometry={g} position={at} rotation={[0, FACE_YAW, 0]}>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

/* ---------------- Fruit Slice arcade cabinet ---------------- */

const PURPLE = hex('#3b2a55'), PURPLE_DARK = hex('#2a1e3e')

function cabinet() {
  const p: THREE.BufferGeometry[] = []
  for (const x of [-0.42, 0.42]) {
    p.push(box([0.08, 1.9, 0.8], PURPLE, [x, 0.95, 0]))
    p.push(box([0.012, 1.1, 0.12], C.roof, [x * 1.1, 0.85, 0.16]))
    p.push(box([0.012, 0.9, 0.06], C.pink, [x * 1.1, 0.95, 0.3]))
  }
  p.push(box([0.84, 1.9, 0.08], PURPLE_DARK, [0, 0.95, -0.38]))
  p.push(box([0.84, 0.86, 0.1], PURPLE_DARK, [0, 0.43, 0.34]))
  p.push(box([0.84, 0.05, 0.11], C.roof, [0, 0.62, 0.35]))
  // control panel, joystick and buttons
  p.push(box([0.84, 0.08, 0.4], PURPLE, [0, 0.93, 0.34], [0.25, 0, 0]))
  p.push(cyl(0.018, 0.018, 0.14, C.ink, [-0.2, 1.02, 0.36]))
  p.push(sphere(0.05, C.red, [-0.2, 1.1, 0.36], 10))
  ;[C.yellow, C.pink, hex('#5fd0c8')].forEach((c, i) => p.push(cyl(0.035, 0.035, 0.04, c, [0.04 + i * 0.12, 0.99, 0.37 - i * 0.01], [0.25, 0, 0], 12)))
  // screen housing, marquee box, top
  p.push(box([0.84, 0.66, 0.1], C.ink, [0, 1.36, 0.17], [-0.12, 0, 0]))
  p.push(box([0.86, 0.26, 0.34], PURPLE_DARK, [0, 1.78, 0.2]))
  p.push(box([0.88, 0.06, 0.84], PURPLE, [0, 1.93, 0]))
  return merge(p)
}

function marqueeTexture() {
  return canvasTexture(512, 128, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 512, 0)
    grd.addColorStop(0, '#F26B3A')
    grd.addColorStop(1, '#f29ac0')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = '#fff8ee'
    ctx.textAlign = 'center'
    ctx.font = '700 64px "Fredoka", "Trebuchet MS", sans-serif'
    ctx.fillText('FRUIT SLICE', 256, 86)
  })
}

function CabinetScreen() {
  const tex = useTexture('/images/fruit-slice-3d.webp')
  tex.colorSpace = THREE.SRGBColorSpace
  return (
    <mesh position={[0, 1.36, 0.228]} rotation={[-0.12, 0, 0]}>
      <planeGeometry args={[0.7, 0.52]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

export function Arcade({ def, interactive }: { def: IslandDef; interactive: boolean }) {
  const at = useSpot(def, HOME_PIECES.arcade)
  const g = useMemo(cabinet, [])
  const marquee = useMemo(marqueeTexture, [])
  const [hover, setHover] = useState(false)
  const url = profile.highlight?.url ?? 'https://fruit-slice-3d.netlify.app/'
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(true)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHover(false)
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return // that was a drag to look around, not a click
    window.open(url, '_blank', 'noopener')
  }
  const events = interactive ? { onPointerOver: over, onPointerOut: out, onClick: click } : {}
  return (
    // turned a little towards the Pilot (to its left on screen)
    <group position={at} rotation={[0, FACE_YAW - 0.35, 0]}>
      <mesh castShadow geometry={g} {...events}>
        <meshLambertMaterial vertexColors emissive={hover ? '#3b1f10' : '#000000'} />
      </mesh>
      <Suspense fallback={null}>
        <CabinetScreen />
      </Suspense>
      <mesh position={[0, 1.78, 0.372]}>
        <planeGeometry args={[0.8, 0.2]} />
        <meshBasicMaterial map={marquee} toneMapped={false} />
      </mesh>
      {interactive && (
        <Html position={[0, 2.35, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`arcade-tip${hover ? ' show' : ''}`}>Play Fruit Slice ↗</div>
        </Html>
      )}
    </group>
  )
}

/** Chimney smoke: a few soft puffs that rise, drift, grow and fade in a loop. */
function Smoke({ at }: { at: V3 }) {
  const group = useRef<THREE.Group>(null)
  const N = 6
  useFrame((state) => {
    group.current?.children.forEach((m, i) => {
      const f = (state.clock.elapsedTime * 0.16 + i / N) % 1
      m.position.set(f * f * 0.9, f * 2.6, Math.sin(f * 5 + i) * 0.12)
      m.scale.setScalar(0.16 + f * 0.42)
      ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(f * Math.PI) * 0.55
    })
  })
  return (
    <group ref={group} position={at}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial color="#f4efe6" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- Lantern posts ---------------- */

function lantern() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(cyl(0.1, 0.13, 0.12, C.stoneDark, [0, 0.06, 0], undefined, 8))
  p.push(cyl(0.04, 0.05, 2.0, C.woodDark, [0, 1.05, 0], undefined, 6))
  p.push(box([0.5, 0.05, 0.05], C.woodDark, [0.2, 2.02, 0]))
  p.push(box([0.02, 0.16, 0.02], C.ink, [0.4, 1.92, 0]))
  p.push(box([0.24, 0.05, 0.24], C.metal, [0.4, 1.84, 0]))
  p.push(box([0.2, 0.04, 0.2], C.metal, [0.4, 1.56, 0]))
  g.push(box([0.16, 0.24, 0.16], C.white, [0.4, 1.7, 0]))
  return { body: merge(p), glow: merge(g) }
}

/** Lantern posts along Home Isle's paths. At night they glow and throw a warm pool of light on the grass (no real lights). */
function Lanterns({ def, night }: { def: IslandDef; night: boolean }) {
  const { body, glow } = useMemo(lantern, [])
  const pool = useMemo(shadowTexture, [])
  return (
    <>
      {HOME_PIECES.lanterns.map(([x, z], i) => (
        <group key={i} position={[x, groundY(def, x, z), z]} rotation={[0, FACE_YAW + i * 1.3, 0]}>
          <Piece body={body} />
          <GlowMesh geometry={glow} night={night} day="#e9e2d2" lit="#ffd27a" />
          {night && (
            <mesh position={[0.4, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
              <circleGeometry args={[2.3, 20]} />
              <meshBasicMaterial color="#ffc266" alphaMap={pool} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} polygonOffset polygonOffsetFactor={-3} />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}

/* ---------------- The lived-in extras: paths, a signpost, garden, well, campfire, picnic table, studio, hammock ---------------- */

const IRONH = hex('#4a4d55'), SOIL = hex('#7a5a40')

function garden() {
  const p: THREE.BufferGeometry[] = []
  p.push(box([2.9, 0.1, 2.1], SOIL, [0, 0.05, 0]))
  for (let i = 0; i < 4; i++) p.push(box([2.7, 0.1, 0.3], hex('#8a6748'), [0, 0.12, -0.75 + i * 0.5]))
  // rows: cabbages, carrots, pumpkins, tomatoes on canes
  for (let i = 0; i < 5; i++) p.push(blob(0.17, hex('#8fc46a'), [-1.1 + i * 0.55, 0.26, -0.75], 0.8, i + 1))
  for (let i = 0; i < 6; i++) p.push(cone(0.07, 0.3, hex('#5fa04a'), [-1.15 + i * 0.46, 0.32, -0.25], undefined, 5), cone(0.05, 0.12, hex('#ff8a3c'), [-1.15 + i * 0.46, 0.2, -0.25], [Math.PI, 0, 0], 5))
  for (let i = 0; i < 3; i++) p.push(sphere(0.2, hex('#f2913d'), [-0.9 + i * 0.9, 0.3, 0.25], 8).scale(1, 0.75, 1).translate(0, 0.07, 0), cyl(0.02, 0.03, 0.1, hex('#5fa04a'), [-0.9 + i * 0.9, 0.5, 0.25], undefined, 4))
  for (let i = 0; i < 4; i++) p.push(cyl(0.015, 0.015, 0.8, C.woodLight, [-1.0 + i * 0.66, 0.5, 0.75], undefined, 4), blob(0.16, hex('#5fa04a'), [-1.0 + i * 0.66, 0.55, 0.75], 1.4, i + 7), sphere(0.05, C.red, [-0.92 + i * 0.66, 0.5, 0.83], 5), sphere(0.05, C.red, [-1.06 + i * 0.66, 0.68, 0.8], 5))
  // picket fence with a gap at the front, and a watering can
  for (let x = -1.6; x <= 1.61; x += 0.32) {
    p.push(box([0.08, 0.5, 0.04], C.white, [x, 0.25, -1.2]))
    if (Math.abs(x) > 0.4) p.push(box([0.08, 0.5, 0.04], C.white, [x, 0.25, 1.2]))
  }
  for (let z = -0.9; z <= 0.91; z += 0.3) for (const x of [-1.6, 1.6]) p.push(box([0.04, 0.5, 0.08], C.white, [x, 0.25, z]))
  p.push(box([3.2, 0.05, 0.03], C.white, [0, 0.33, -1.2]), box([0.03, 0.05, 2.4], C.white, [-1.6, 0.33, 0]), box([0.03, 0.05, 2.4], C.white, [1.6, 0.33, 0]))
  p.push(cyl(0.12, 0.12, 0.22, hex('#6fa8c9'), [1.95, 0.11, 0.9], undefined, 8), cyl(0.02, 0.03, 0.3, hex('#6fa8c9'), [2.12, 0.2, 0.9], [0, 0, -0.9], 5))
  return merge(p)
}

function well() {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.75, 0.8, 0.7, C.stone, [0, 0.35, 0], undefined, 12), torus(0.72, 0.09, C.stoneDark, [0, 0.72, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 14), cyl(0.6, 0.6, 0.02, hex('#3f6e8a'), [0, 0.6, 0], undefined, 12))
  for (const x of [-0.7, 0.7]) p.push(box([0.1, 1.7, 0.1], C.woodDark, [x, 1.2, 0]))
  p.push(cyl(0.05, 0.05, 1.5, C.wood, [0, 1.75, 0], [0, 0, Math.PI / 2], 6), prism(1.9, 0.6, 1.3, C.roof, [0, 2.0, 0]), box([2.0, 0.06, 1.4], C.roofDark, [0, 2.0, 0]))
  p.push(cyl(0.012, 0.012, 0.6, hex('#d9c08a'), [0.15, 1.45, 0], undefined, 4), cyl(0.14, 0.11, 0.22, C.wood, [0.15, 1.08, 0], undefined, 8), box([0.3, 0.06, 0.06], IRONH, [0.9, 1.75, 0]))
  return merge(p)
}

function projector() {
  const p: THREE.BufferGeometry[] = []
  for (const a of [0, 2.1, 4.2]) p.push(cyl(0.025, 0.025, 1.15, IRONH, [Math.cos(a) * 0.22, 0.52, Math.sin(a) * 0.22], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], 4))
  p.push(box([0.3, 0.3, 0.55], hex('#3a3f4c'), [0, 1.2, 0]), cyl(0.09, 0.11, 0.2, IRONH, [0, 1.2, -0.36], [Math.PI / 2, 0, 0], 8))
  for (const z of [-0.12, 0.2]) p.push(cyl(0.2, 0.2, 0.05, hex('#6d6a66'), [0.05, 1.52, z], [0, 0, Math.PI / 2], 12))
  return { body: merge(p), glow: cyl(0.07, 0.07, 0.02, hex('#fff2c4'), [0, 1.2, -0.47], [Math.PI / 2, 0, 0], 8) }
}

function picnic() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([1.9, 0.08, 0.9], C.woodLight, [0, 0.78, 0]))
  for (const z of [-0.75, 0.75]) p.push(box([1.9, 0.07, 0.3], C.woodLight, [0, 0.45, z]))
  for (const x of [-0.75, 0.75]) p.push(box([0.08, 0.8, 0.08], C.woodDark, [x, 0.4, 0], [0.5, 0, 0]), box([0.08, 0.8, 0.08], C.woodDark, [x, 0.4, 0], [-0.5, 0, 0]), box([0.08, 0.06, 1.8], C.woodDark, [x, 0.4, 0]))
  // a sketchbook, a mug and a game controller
  p.push(box([0.4, 0.03, 0.3], C.white, [-0.5, 0.84, 0.05], [0, 0.3, 0]), cyl(0.06, 0.05, 0.12, C.red, [0.0, 0.88, -0.2], undefined, 8))
  p.push(box([0.3, 0.05, 0.14], hex('#2b2730'), [0.5, 0.85, 0.1], [0, -0.3, 0]), sphere(0.07, hex('#2b2730'), [0.38, 0.84, 0.16], 6), sphere(0.07, hex('#2b2730'), [0.62, 0.84, 0.1], 6))
  g.push(sphere(0.025, hex('#7dffb0'), [0.55, 0.89, 0.08], 5))
  return { body: merge(p), glow: merge(g) }
}

function campfire() {
  const p: THREE.BufferGeometry[] = []
  for (let i = 0; i < 8; i++) p.push(sphere(0.13, i % 2 ? C.stone : C.stoneDark, [Math.cos(i * 0.785) * 0.5, 0.07, Math.sin(i * 0.785) * 0.5], 6))
  for (let i = 0; i < 3; i++) p.push(cyl(0.06, 0.06, 0.7, C.woodDark, [0, 0.14, 0], [0, (i * Math.PI) / 3, Math.PI / 2 - 0.25], 5))
  for (const [x, z, r] of [[-1.3, 0.3, 1.2], [0.2, -1.35, 0.1], [1.3, 0.4, 1.9]]) p.push(cyl(0.2, 0.2, 1.1, C.wood, [x, 0.2, z], [0, r, Math.PI / 2], 8))
  // a kettle on a hook
  p.push(cyl(0.02, 0.02, 1.0, IRONH, [-0.55, 0.5, -0.4], [0, 0, -0.25], 4), cyl(0.02, 0.02, 0.6, IRONH, [-0.2, 0.98, -0.4], [0, 0, Math.PI / 2 - 0.2], 4), sphere(0.13, IRONH, [0.05, 0.75, -0.4], 8))
  return merge(p)
}
const flameGeo = () => merge([cone(0.24, 0.6, hex('#ff8a3c'), [0, 0.3, 0], undefined, 6), cone(0.13, 0.4, C.yellow, [0.03, 0.22, 0.02], undefined, 6)])

/** An open-air studio: where the games get made. Desk, two screens, a chair, shelves, under a pergola. */
function studio(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([3.4, 0.12, 2.6], C.woodLight, [0, 0.06, 0]))
  for (const x of [-1.55, 1.55]) for (const z of [-1.15, 1.15]) p.push(box([0.13, 2.5, 0.13], C.woodDark, [x, 1.3, z]))
  for (let i = 0; i < 7; i++) p.push(box([0.14, 0.08, 3.0], i % 2 ? C.wood : accent, [-1.5 + i * 0.5, 2.6, 0]))
  for (const z of [-1.15, 1.15]) p.push(box([3.5, 0.1, 0.12], C.woodDark, [0, 2.52, z]))
  p.push(box([2.0, 0.08, 0.8], C.wood, [0, 0.9, -0.6]))
  for (const x of [-0.9, 0.9]) p.push(box([0.08, 0.8, 0.7], C.woodDark, [x, 0.5, -0.6]))
  for (const [x, r] of [[-0.42, 0.18], [0.42, -0.18]]) {
    p.push(box([0.78, 0.48, 0.05], C.ink, [x, 1.38, -0.8], [0, r, 0]), box([0.06, 0.2, 0.06], C.ink, [x, 1.04, -0.8]), box([0.3, 0.03, 0.2], C.ink, [x, 0.95, -0.8]))
    g.push(box([0.7, 0.4, 0.02], x < 0 ? hex('#7de3ff') : hex('#ffd9a0'), [x + (r > 0 ? 0.005 : -0.005), 1.38, -0.77], [0, r, 0]))
  }
  p.push(box([0.6, 0.03, 0.2], hex('#d8dde6'), [0, 0.96, -0.42]), box([0.1, 0.03, 0.14], hex('#d8dde6'), [0.5, 0.96, -0.42]))
  // chair, bookshelf, a plant, and a rug
  p.push(box([0.5, 0.08, 0.5], accent, [0, 0.6, 0.15]), box([0.5, 0.6, 0.08], accent, [0, 0.95, 0.38]), cyl(0.04, 0.04, 0.5, IRONH, [0, 0.35, 0.15], undefined, 5), cyl(0.28, 0.28, 0.04, IRONH, [0, 0.14, 0.15], undefined, 8))
  p.push(box([0.35, 1.5, 0.9], C.wood, [1.3, 0.87, -0.3]))
  ;['#e0533d', '#5d8fd6', '#ffd75e', '#5fb37a', '#b78ae0', '#f29ac0'].forEach((c, i) => p.push(box([0.3, 0.3, 0.1], hex(c), [1.28, 0.45 + Math.floor(i / 3) * 0.5, -0.6 + (i % 3) * 0.14], [0, 0, 0])))
  p.push(cyl(0.16, 0.12, 0.25, C.cream, [-1.25, 0.24, 0.7], undefined, 8), blob(0.32, hex('#5fa04a'), [-1.25, 0.65, 0.7], 1.2, 5))
  p.push(box([1.4, 0.02, 1.0], hex('#c94f6d'), [0, 0.13, 0.5]))
  return { body: merge(p), glow: merge(g) }
}

function hammock(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = []
  for (const x of [-1.25, 1.25]) p.push(cyl(0.07, 0.09, 1.7, C.woodDark, [x, 0.85, 0], [0, 0, x > 0 ? -0.12 : 0.12], 6))
  const cloth = torus(1.25, 0.05, accent, undefined, undefined, Math.PI, 16)
  cloth.scale(1, 0.45, 7).rotateZ(Math.PI).translate(0, 1.45, 0)
  p.push(cloth, box([0.4, 0.12, 0.3], C.white, [-0.75, 1.05, 0], [0, 0, -0.35]))
  return merge(p)
}

function Extras({ def, night }: { def: IslandDef; night: boolean }) {
  const h = HOME_PIECES
  const g = useMemo(() => {
    const put = placer(def), accent = hex(def.accent), p: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = []
    const stoneA = hex('#e2d3ae'), stoneB = hex('#d6c59c')
    const paths = h.paths.map((pts) => pathRibbon(def, pts, 0.95, stoneA, stoneB, 50).geometry)
    const pr = projector(), pi = picnic(), st = studio(accent)
    p.push(put(garden(), h.garden, 0.25), put(well(), h.well, -0.2, 1.1), put(campfire(), h.campfire, 0.4), put(hammock(hex('#2F8F9D')), h.hammock, 0.2))
    p.push(put(pr.body, h.projector, Math.PI * 0.82), put(pi.body, h.picnic, 0.5), put(st.body, h.studio, -0.25))
    glow.push(put(pr.glow, h.projector, Math.PI * 0.82), put(pi.glow, h.picnic, 0.5), put(st.glow, h.studio, -0.25))
    // signpost: a post with three arrow planks
    p.push(put(merge([cyl(0.07, 0.09, 2.9, C.woodDark, [0, 1.45, 0], undefined, 6), sphere(0.11, C.gold, [0, 2.95, 0], 6)]), h.signpost))
    return { paths, body: merge(p), glow: merge(glow), flame: flameGeo() }
  }, [def, h])
  const signs = useMemo(() => [labelTex('SCROLL DOWN', 'Project islands', '#F26B3A', 512, 150), labelTex('FURTHER ON', 'Skills · Journey', '#B07A45', 512, 150), labelTex('ON THIS ISLE', 'Trailer · Contact', '#3E6E8E', 512, 150)], [])
  const flame = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (flame.current) flame.current.scale.set(1 + Math.sin(t * 11) * 0.12, 1 + Math.sin(t * 7) * 0.2, 1 + Math.cos(t * 9) * 0.12)
  })
  return (
    <>
      {g.paths.map((geo, i) => (
        <mesh key={i} geometry={geo} receiveShadow renderOrder={1}>
          <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
      <Piece body={g.body} />
      <GlowMesh geometry={g.glow} night={night} day="#d9d2c4" />
      <At def={def} xz={h.signpost}>
        {signs.map((tex, i) => (
          <group key={i} position={[0.1, 2.55 - i * 0.5, 0.06]} rotation={[0, [0.25, -0.2, 0.1][i], 0]}>
            <group position={[0.62, 0, 0]}>
              <Board tex={tex} w={1.3} h={0.38} y={0} posts={false} />
            </group>
          </group>
        ))}
      </At>
      <At def={def} xz={h.campfire} turn={0.4}>
        <mesh ref={flame} geometry={g.flame} position={[0, 0.1, 0]}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
        {night && <pointLight position={[0, 0.8, 0]} color="#ff9a4a" intensity={5} distance={7} />}
      </At>
    </>
  )
}

export function HomeLandmarks({ def, night, interactive }: { def: IslandDef; night: boolean; interactive: boolean }) {
  return (
    <>
      <Cottage def={def} night={night} />
      <Cinema def={def} night={night} />
      <PostBox def={def} />
      <Arcade def={def} interactive={interactive} />
      <Lanterns def={def} night={night} />
      <Extras def={def} night={night} />
    </>
  )
}

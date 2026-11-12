import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CENTREPIECE, FACE_YAW, groundY, type IslandDef } from '../layout'
import { C, beam, blob, box, canvasTexture, cone, cyl, gear, hex, merge, paint, sphere, torus } from './kit'
import { ChronoRebellion } from './Chrono'
import { MergeDefence } from './Merge'
import { BehindTheSmile } from './Smile'
import { SunkenGreed } from './Sunken'

/**
 * One small diorama per island, each about what the project (or section) is:
 * built in code from simple shapes, one Lambert mesh plus a few glowing / animated parts each.
 */

type Parts = { body: THREE.BufferGeometry; glow?: THREE.BufferGeometry }

function Body({ g, side }: { g: THREE.BufferGeometry; side?: THREE.Side }) {
  return (
    <mesh geometry={g} castShadow>
      <meshLambertMaterial vertexColors side={side ?? THREE.FrontSide} />
    </mesh>
  )
}

function Glow({ g, night, day = '#d8d0c4' }: { g?: THREE.BufferGeometry; night: boolean; day?: string }) {
  if (!g) return null
  return (
    <mesh geometry={g}>
      <meshBasicMaterial vertexColors color={night ? '#ffffff' : day} toneMapped={false} />
    </mesh>
  )
}

/** Places a diorama on its island's centrepiece spot, facing the camera. */
function Spot({ def, children, turn = 0, scale = 1.4 }: { def: IslandDef; children: ReactNode; turn?: number; scale?: number }) {
  const [x, z] = CENTREPIECE
  return (
    <group position={[x, groundY(def, x, z), z]} rotation={[0, FACE_YAW + turn, 0]} scale={scale}>
      {children}
    </group>
  )
}

const spin = (ref: React.RefObject<THREE.Object3D | null>, axis: 'x' | 'y' | 'z', speed: number, dt: number) => {
  if (ref.current) ref.current.rotation[axis] += speed * dt
}

/* ---------------- Paper Plane Dash: an endless track curling into the sky ---------------- */

const TRACK = [
  [-1.6, 0.12, 1.0], [-0.6, 0.2, 0.6], [0.4, 0.45, 0.0], [1.1, 0.95, -0.8], [1.35, 1.7, -1.7], [1.0, 2.55, -2.4], [0.2, 3.3, -2.7], [-0.7, 3.9, -2.5],
].map(([x, y, z]) => new THREE.Vector3(x, y, z))

function dashTrack(accent: THREE.Color): Parts {
  const p: THREE.BufferGeometry[] = []
  const curve = new THREE.CatmullRomCurve3(TRACK)
  const pts = curve.getSpacedPoints(26)
  for (let i = 0; i < pts.length - 1; i++) {
    p.push(beam(pts[i], pts[i + 1], 1.0, 0.1, i % 2 ? C.white : hex('#f4efe4')))
    for (const side of [-1, 1]) {
      const dir = pts[i + 1].clone().sub(pts[i]).normalize()
      const off = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.52 * side)
      p.push(beam(pts[i].clone().add(off).setY(pts[i].y + 0.1), pts[i + 1].clone().add(off).setY(pts[i + 1].y + 0.1), 0.08, 0.14, accent))
    }
    if (i % 4 === 2 && pts[i].y > 0.3) p.push(cyl(0.05, 0.06, pts[i].y, C.woodDark, [pts[i].x, pts[i].y / 2, pts[i].z], undefined, 6))
  }
  // start gate
  for (const x of [-0.6, 0.6]) p.push(box([0.12, 1.6, 0.12], C.woodDark, [-1.6 + x * 0.6, 0.8, 1.0 + x * 0.8]))
  p.push(box([0.12, 0.3, 1.5], accent, [-1.6, 1.55, 1.0], [0, 0.55, 0]))
  return { body: merge(p) }
}

function paperPlane() {
  const v = [
    [0, 0, 0.9], [-0.75, 0.05, -0.5], [0, 0, -0.5], [0.75, 0.05, -0.5], [0, -0.22, -0.5],
  ]
  const tris = [[0, 1, 2], [0, 2, 3], [0, 2, 4]]
  const pos: number[] = []
  for (const t of tris) for (const k of t) pos.push(...v[k])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return paint(g, C.white)
}

function PaperPlaneDash({ def, night }: { def: IslandDef; night: boolean }) {
  const accent = hex(def.accent)
  const parts = useMemo(() => dashTrack(accent), [def.accent]) // eslint-disable-line react-hooks/exhaustive-deps
  const plane = useMemo(paperPlane, [])
  const coin = useMemo(() => torus(0.16, 0.05, C.gold, undefined, undefined, Math.PI * 2, 16), [])
  const coinSpots = useMemo(() => new THREE.CatmullRomCurve3(TRACK).getSpacedPoints(8).slice(2, 7), [])
  const coins = useRef<THREE.Group>(null), flyer = useRef<THREE.Group>(null)
  useFrame((s, dt) => {
    coins.current?.children.forEach((c) => (c.rotation.y += dt * 2))
    if (flyer.current) flyer.current.position.y = 4.6 + Math.sin(s.clock.elapsedTime * 1.4) * 0.15
  })
  return (
    <Spot def={def} turn={0.3}>
      <Body g={parts.body} />
      <group ref={coins}>
        {coinSpots.map((q, i) => (
          <mesh key={i} geometry={coin} position={[q.x, q.y + 0.45, q.z]}>
            <meshBasicMaterial vertexColors color={night ? '#ffffff' : '#e6d6a8'} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={flyer} position={[-1.2, 4.6, -2.2]} rotation={[-0.25, -1.4, 0.15]}>
        <mesh geometry={plane}>
          <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Spot>
  )
}

/* ---------------- The Harbor: a lighthouse and a pier with a notice board ---------------- */

function harbor(): Parts {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(cyl(1.0, 1.15, 0.4, C.stone, [0, 0.2, 0], undefined, 14))
  const H = 3.6
  for (let i = 0; i < 4; i++) {
    const y0 = 0.4 + (i * H) / 4, r0 = 0.75 - (i * 0.2) / 4, r1 = 0.75 - ((i + 1) * 0.2) / 4
    p.push(cyl(r1, r0, H / 4, i % 2 ? C.red : C.white, [0, y0 + H / 8, 0], undefined, 16))
  }
  p.push(cyl(0.85, 0.85, 0.1, C.ink, [0, 4.05, 0], undefined, 16))
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    p.push(box([0.04, 0.35, 0.04], C.ink, [Math.cos(a) * 0.8, 4.27, Math.sin(a) * 0.8]))
  }
  g.push(cyl(0.42, 0.42, 0.6, C.yellow, [0, 4.4, 0], undefined, 12))
  p.push(cone(0.6, 0.6, C.red, [0, 5.0, 0], undefined, 12))
  p.push(sphere(0.08, C.gold, [0, 5.35, 0], 8))
  // pier, crates, barrel and a notice board of projects
  p.push(box([1.0, 0.12, 2.6], C.woodLight, [1.6, 0.35, 0.6], [0, 0.5, 0]))
  for (const [x, z] of [[1.15, -0.3], [2.05, 1.5], [1.75, -0.05], [1.45, 1.25]]) p.push(cyl(0.07, 0.07, 0.6, C.woodDark, [x, 0.1, z], undefined, 6))
  p.push(box([0.45, 0.45, 0.45], C.wood, [-1.3, 0.22, 0.6]))
  p.push(box([0.35, 0.35, 0.35], C.woodLight, [-1.25, 0.62, 0.62], [0, 0.4, 0]))
  p.push(cyl(0.22, 0.22, 0.55, C.wood, [-1.0, 0.28, 1.15], undefined, 10))
  p.push(box([0.08, 1.4, 0.08], C.woodDark, [-0.55, 0.7, 1.35]))
  p.push(box([0.08, 1.4, 0.08], C.woodDark, [0.55, 0.7, 1.35]))
  p.push(box([1.3, 0.8, 0.06], C.wood, [0, 1.15, 1.37]))
  ;[[-0.38, 1.25, '#f4efe4'], [0.0, 1.05, '#ffd75e'], [0.35, 1.3, '#a8e0ff'], [-0.2, 0.92, '#f29ac0'], [0.32, 0.95, '#f4efe4']].forEach(([x, y, c]) =>
    p.push(box([0.3, 0.24, 0.02], hex(c as string), [x as number, y as number, 1.41], [0, 0, ((x as number) * 0.3)])),
  )
  return { body: merge(p), glow: merge(g) }
}

function Harbor({ def, night }: { def: IslandDef; night: boolean }) {
  const parts = useMemo(harbor, [])
  const beamRef = useRef<THREE.Group>(null)
  useFrame((_, dt) => spin(beamRef, 'y', 0.7, dt))
  return (
    <Spot def={def}>
      <Body g={parts.body} />
      <Glow g={parts.glow} night={night} day="#f3e3b0" />
      {night && (
        <group ref={beamRef} position={[0, 4.4, 0]}>
          <mesh position={[2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.7, 4.4, 16, 1, true]} />
            <meshBasicMaterial color="#fff2c4" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color="#ffe6a0" intensity={8} distance={9} />
        </group>
      )}
    </Spot>
  )
}

/* ---------------- Workshop Isle: a workbench under a canopy, with turning gears ---------------- */

function workshop(accent: THREE.Color): Parts {
  const p: THREE.BufferGeometry[] = []
  for (const x of [-1.4, 1.4]) for (const z of [-0.7, 0.7]) p.push(box([0.14, 2.6, 0.14], C.woodDark, [x, 1.3, z]))
  p.push(box([3.2, 0.12, 2.0], accent, [0, 2.65, 0], [0.12, 0, 0]))
  p.push(box([2.2, 0.12, 0.8], C.woodLight, [0, 0.95, 0.1]))
  for (const x of [-1.0, 1.0]) for (const z of [-0.2, 0.4]) p.push(box([0.1, 0.9, 0.1], C.wood, [x, 0.45, z]))
  // tools on the bench: hammer, toolbox, a screwdriver
  p.push(cyl(0.035, 0.035, 0.5, C.woodLight, [-0.6, 1.04, 0.2], [0, 0, Math.PI / 2], 6))
  p.push(box([0.12, 0.12, 0.25], C.metal, [-0.33, 1.06, 0.2]))
  p.push(box([0.6, 0.3, 0.3], C.red, [0.5, 1.16, 0.05]))
  p.push(box([0.4, 0.05, 0.05], C.ink, [0.5, 1.35, 0.05]))
  p.push(cyl(0.02, 0.03, 0.3, C.yellow, [0.0, 1.03, 0.35], [0, 0, Math.PI / 2], 6))
  // pegboard behind the bench
  p.push(box([2.4, 1.0, 0.06], C.wood, [0, 1.75, -0.65]))
  ;[[-0.8, 1.9], [-0.3, 1.6], [0.3, 1.95], [0.8, 1.7]].forEach(([x, y], i) => p.push(box([0.1, 0.4, 0.03], [C.metal, C.red, C.yellow, C.metal][i], [x, y, -0.6])))
  return { body: merge(p) }
}

function Workshop({ def }: { def: IslandDef }) {
  const accent = hex(def.accent)
  const parts = useMemo(() => workshop(accent), [def.accent]) // eslint-disable-line react-hooks/exhaustive-deps
  const big = useMemo(() => gear(0.55, 0.14, 12, hex('#c58a4a')), [])
  const small = useMemo(() => gear(0.32, 0.12, 8, hex('#8fa3b8')), [])
  const g1 = useRef<THREE.Mesh>(null), g2 = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    spin(g1, 'z', 0.6, dt)
    spin(g2, 'z', -0.6 * (12 / 8), dt)
  })
  return (
    <Spot def={def}>
      <Body g={parts.body} />
      <mesh ref={g1} geometry={big} position={[1.95, 1.0, 0.2]} rotation={[0, -0.6, 0]}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh ref={g2} geometry={small} position={[1.95, 1.0, 0.2]} rotation={[0, -0.6, 0]}>
        <meshLambertMaterial vertexColors />
      </mesh>
    </Spot>
  )
}

/* ---------------- Journey Isle: a signpost of milestones, books and a telescope ---------------- */

const MILESTONES: [string, string][] = [
  ['NED', '#F26B3A'],
  ['GGJ 2026', '#C94F6D'],
  ['KDA', '#2F8F9D'],
  ['CEGA', '#7B61C9'],
]

function signTexture(text: string, colour: string) {
  return canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#f4efe4'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, 12, 64)
    ctx.fillStyle = '#2b2730'
    ctx.textAlign = 'center'
    ctx.font = '700 34px "Fredoka", "Trebuchet MS", sans-serif'
    ctx.fillText(text, 134, 44)
  })
}

function journey(): Parts {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.08, 0.1, 3.2, C.woodDark, [0, 1.6, 0], undefined, 8))
  p.push(cone(0.14, 0.2, C.woodDark, [0, 3.3, 0], undefined, 8))
  // books with a graduation cap
  ;[[C.red, 0.1], [hex('#5d8fd6'), -0.15], [C.yellow, 0.2], [hex('#5fb37a'), 0]].forEach(([c, r], i) =>
    p.push(box([0.7, 0.14, 0.5], c as THREE.Color, [-1.3, 0.07 + i * 0.14, 0.4], [0, r as number, 0])),
  )
  p.push(box([0.55, 0.04, 0.55], C.ink, [-1.3, 0.68, 0.4], [0, 0.5, 0]))
  p.push(cyl(0.16, 0.18, 0.12, C.ink, [-1.3, 0.62, 0.4], undefined, 10))
  p.push(cyl(0.012, 0.012, 0.25, C.yellow, [-1.08, 0.58, 0.5], undefined, 4))
  // telescope on a tripod, pointing at the horizon
  for (const a of [0, 2.1, 4.2]) p.push(beam(new THREE.Vector3(1.4, 1.1, -0.2), new THREE.Vector3(1.4 + Math.cos(a) * 0.45, 0, -0.2 + Math.sin(a) * 0.45), 0.05, 0.05, C.woodDark))
  p.push(cyl(0.09, 0.13, 1.0, hex('#c99a4a'), [1.4, 1.25, -0.2], [0.9, 0.5, 0], 12))
  return { body: merge(p) }
}

function Journey({ def }: { def: IslandDef }) {
  const parts = useMemo(journey, [])
  const signs = useMemo(() => MILESTONES.map(([t, c]) => signTexture(t, c)), [])
  return (
    <Spot def={def} scale={1.7}>
      <Body g={parts.body} />
      {signs.map((tex, i) => (
        <group key={i} position={[0, 2.85 - i * 0.48, 0]} rotation={[0, -0.9 + i * 0.6, 0]}>
          <mesh position={[0.55, 0, 0]}>
            <boxGeometry args={[1.1, 0.3, 0.05]} />
            <meshLambertMaterial color="#c08a5a" />
          </mesh>
          <mesh position={[0.55, 0, 0.03]}>
            <planeGeometry args={[1.04, 0.26]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          <mesh position={[0.55, 0, -0.03]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[1.04, 0.26]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          <mesh position={[1.16, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.17, 0.2, 3]} />
            <meshLambertMaterial color="#c08a5a" />
          </mesh>
        </group>
      ))}
    </Spot>
  )
}

/* ---------------- router ---------------- */

export function IslandLandmark({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  switch (def.id) {
    case 'behind-the-smile':
      return <BehindTheSmile def={def} night={night} simple={simple} />
    case 'chrono-rebellion':
      return <ChronoRebellion def={def} night={night} simple={simple} />
    case 'sunken-greed':
      return <SunkenGreed def={def} night={night} simple={simple} />
    case 'paper-plane-dash':
      return <PaperPlaneDash def={def} night={night} />
    case 'merge-defence':
      return <MergeDefence def={def} night={night} simple={simple} />
    case 'harbor':
      return <Harbor def={def} night={night} />
    case 'workshop':
      return <Workshop def={def} />
    case 'journey':
      return <Journey def={def} />
    default:
      return null
  }
}

import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CENTREPIECE, FACE_YAW, groundY, type IslandDef } from '../layout'
import { C, beam, blob, box, canvasTexture, cone, cyl, gear, hex, merge, paint, sphere, torus } from './kit'

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

/* ---------------- Behind the Smile: a little stage and a smiling mask ---------------- */

function stage(accent: THREE.Color): Parts {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const dark = accent.clone().multiplyScalar(0.72)
  p.push(box([3.3, 0.38, 2.1], C.wood, [0, 0.19, 0]))
  p.push(box([3.4, 0.08, 0.08], accent, [0, 0.36, 1.06]))
  p.push(box([3.0, 2.7, 0.06], hex('#3a2a40'), [0, 1.7, -0.9]))
  for (const x of [-1.55, 1.55]) p.push(box([0.18, 3.0, 0.18], C.woodDark, [x, 1.85, -0.72]))
  p.push(box([3.4, 0.42, 0.16], accent, [0, 3.18, -0.7]))
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) p.push(cyl(0.14, 0.17, 2.7, i % 2 ? dark : accent, [side * (1.32 - i * 0.2), 1.73, -0.64 + i * 0.02], undefined, 8))
  // the mask: a big smiling face on a stand
  p.push(cyl(0.05, 0.07, 1.1, C.woodDark, [0, 0.9, -0.15]))
  const face = sphere(0.78, C.white, [0, 0, 0], 20)
  face.scale(1, 1.15, 0.32)
  face.translate(0, 2.0, -0.15)
  p.push(face)
  for (const x of [-0.28, 0.28]) {
    const eye = sphere(0.14, C.ink, [0, 0, 0], 12)
    eye.scale(1.1, 0.75, 0.35)
    eye.translate(x, 2.17, 0.08)
    p.push(eye)
    p.push(sphere(0.09, C.pink, [x * 1.55, 1.86, 0.03], 8))
  }
  p.push(torus(0.32, 0.05, C.ink, [0, 1.93, 0.09], [0, 0, Math.PI], Math.PI, 16))
  // a smaller sad mask left on the stage floor
  const sad = sphere(0.36, hex('#d9d2e6'), [0, 0, 0], 14)
  sad.scale(1, 1.1, 0.32)
  sad.rotateX(-1.2)
  sad.translate(0.95, 0.5, 0.45)
  p.push(sad)
  // footlights
  for (const x of [-1.1, 0, 1.1]) {
    p.push(cyl(0.1, 0.12, 0.12, C.metal, [x, 0.45, 0.85]))
    g.push(sphere(0.07, C.yellow, [x, 0.52, 0.85], 8))
  }
  return { body: merge(p), glow: merge(g) }
}

function BehindTheSmile({ def, night }: { def: IslandDef; night: boolean }) {
  const parts = useMemo(() => stage(hex(def.accent)), [def.accent])
  return (
    <Spot def={def}>
      <Body g={parts.body} />
      <Glow g={parts.glow} night={night} />
      {night && <pointLight position={[0, 1.6, 1.6]} color="#ffd9a0" intensity={5} distance={6} />}
    </Spot>
  )
}

/* ---------------- Chrono Rebellion: half-brick, half-future clock tower with a time portal ---------------- */

function clockTower(accent: THREE.Color): Parts {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const brick = hex('#a8574a'), brickDark = hex('#8c463c'), steel = hex('#565c78')
  p.push(box([2.6, 0.3, 2.4], C.stone, [0, 0.15, 0]))
  p.push(box([0.82, 3.7, 1.6], brick, [-0.41, 2.15, 0]))
  p.push(box([0.82, 3.7, 1.6], steel, [0.41, 2.15, 0]))
  for (let i = 0; i < 8; i++) p.push(box([0.84, 0.04, 1.62], brickDark, [-0.41, 0.6 + i * 0.42, 0]))
  for (const x of [0.22, 0.6]) g.push(box([0.06, 3.1, 0.03], accent, [x, 2.0, 0.81]))
  p.push(box([1.9, 0.2, 1.9], C.stoneDark, [0, 4.08, 0]))
  p.push(cone(1.35, 1.4, hex('#4a3f6b'), [0, 4.88, 0], [0, Math.PI / 4, 0], 4))
  p.push(torus(0.62, 0.06, C.gold, [0, 3.1, 0.82], undefined, Math.PI * 2, 28))
  // sandbags (the WWII side)
  ;[[-1.75, 0.25, 0.5], [-1.45, 0.25, 0.9], [-1.65, 0.55, 0.7], [-1.95, 0.25, 0.1]].forEach(([x, y, z], i) => p.push(blob(0.32, hex('#b8a77a'), [x, y, z], 0.55, i + 2)))
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

function ChronoRebellion({ def, night }: { def: IslandDef; night: boolean }) {
  const accent = hex(def.accent)
  const parts = useMemo(() => clockTower(accent), [def.accent]) // eslint-disable-line react-hooks/exhaustive-deps
  const ring = useMemo(() => torus(0.95, 0.09, accent, undefined, undefined, Math.PI * 2, 32), [def.accent]) // eslint-disable-line react-hooks/exhaustive-deps
  const face = useMemo(clockFace, [])
  const hour = useRef<THREE.Mesh>(null), minute = useRef<THREE.Mesh>(null), portal = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    spin(minute, 'z', 1.2, dt) // time runs backwards here
    spin(hour, 'z', 0.1, dt)
    spin(portal, 'z', -0.6, dt)
  })
  return (
    <Spot def={def}>
      <Body g={parts.body} />
      <Glow g={parts.glow} night={night} day="#b9a8e8" />
      <mesh position={[0, 3.1, 0.815]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial map={face} toneMapped={false} />
      </mesh>
      <mesh ref={minute} position={[0, 3.1, 0.83]}>
        <planeGeometry args={[0.05, 0.9]} />
        <meshBasicMaterial color="#2b2730" />
      </mesh>
      <mesh ref={hour} position={[0, 3.1, 0.835]} rotation={[0, 0, 1.2]}>
        <planeGeometry args={[0.07, 0.6]} />
        <meshBasicMaterial color="#2b2730" />
      </mesh>
      <group ref={portal} position={[2.05, 1.4, 0.2]}>
        <mesh geometry={ring}>
          <meshBasicMaterial vertexColors color={night ? '#ffffff' : '#d6ccf5'} toneMapped={false} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.88, 32]} />
          <meshBasicMaterial color={def.accent} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      {night && <pointLight position={[2.05, 1.4, 1]} color={def.accent} intensity={6} distance={6} />}
    </Spot>
  )
}

/* ---------------- Sunken Greed: an underwater globe with a treasure chest ---------------- */

function seaGlobe(): Parts {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const brass = hex('#c99a4a'), sand = hex('#ead8ab')
  p.push(cyl(1.5, 1.65, 0.35, brass, [0, 0.17, 0], undefined, 28))
  p.push(cyl(1.45, 1.45, 0.06, sand, [0, 0.37, 0], undefined, 28))
  // chest
  p.push(box([0.8, 0.45, 0.5], C.wood, [0, 0.62, 0]))
  p.push(cyl(0.25, 0.25, 0.8, C.woodLight, [0, 0.86, -0.02], [0, 0, Math.PI / 2], 12))
  p.push(box([0.84, 0.06, 0.06], C.gold, [0, 0.62, 0.26]))
  g.push(blob(0.2, C.gold, [0.1, 0.92, 0.12], 0.5, 3))
  ;[[-0.7, 0.45, 0.6], [0.75, 0.42, 0.5], [0.55, 0.42, -0.6]].forEach(([x, y, z], i) => g.push(sphere(0.07, C.gold, [x, y, z], 8)))
  // coral and seaweed
  ;[[-0.9, -0.3, '#f28a7a'], [-0.6, -0.8, '#f29ac0'], [0.9, -0.2, '#ffb35c']].forEach(([x, z, c]) => {
    for (let k = 0; k < 3; k++) p.push(cone(0.08, 0.5 + k * 0.12, hex(c as string), [(x as number) + k * 0.1, 0.62 + k * 0.05, (z as number) + (k - 1) * 0.08], [0, 0, (k - 1) * 0.3], 6))
  })
  for (let i = 0; i < 5; i++) p.push(cyl(0.03, 0.05, 1.0 + (i % 3) * 0.3, hex('#5f9e3a'), [-0.3 + i * 0.22, 0.9, -0.9 + (i % 2) * 0.2], [0.1 * (i % 2 ? 1 : -1), 0, 0.15 * (i - 2)], 5))
  // diving helmet outside the globe
  p.push(sphere(0.42, brass, [1.85, 0.42, 0.9], 16))
  p.push(cyl(0.2, 0.2, 0.08, C.metal, [1.85, 0.48, 1.32], [Math.PI / 2, 0, 0], 14))
  g.push(cyl(0.15, 0.15, 0.09, C.glass, [1.85, 0.48, 1.34], [Math.PI / 2, 0, 0], 14))
  p.push(torus(0.42, 0.05, C.metal, [1.85, 0.08, 0.9], [Math.PI / 2, 0, 0]))
  return { body: merge(p), glow: merge(g) }
}

function SunkenGreed({ def, night }: { def: IslandDef; night: boolean }) {
  const parts = useMemo(seaGlobe, [])
  const fish = useRef<THREE.Group>(null)
  const fishGeo = useMemo(() => {
    const body = sphere(0.12, hex('#ff9a3c'), [0, 0, 0], 10)
    body.scale(1.6, 1, 0.6)
    return merge([body, cone(0.08, 0.14, hex('#ff7a2c'), [-0.22, 0, 0], [0, 0, Math.PI / 2], 6)])
  }, [])
  useFrame((_, dt) => spin(fish, 'y', 0.8, dt))
  return (
    <Spot def={def}>
      <Body g={parts.body} />
      <Glow g={parts.glow} night={night} day="#efe6cf" />
      <group ref={fish} position={[0, 1.6, 0]}>
        {[0, 2.1, 4.2].map((a, i) => (
          <mesh key={i} geometry={fishGeo} position={[Math.cos(a) * 0.95, (i - 1) * 0.35, Math.sin(a) * 0.95]} rotation={[0, -a + Math.PI / 2, 0]}>
            <meshLambertMaterial vertexColors />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 1.75, 0]} renderOrder={2}>
        <sphereGeometry args={[1.5, 32, 24]} />
        <meshLambertMaterial color="#62c6d6" transparent opacity={0.32} depthWrite={false} emissive="#1a6f80" emissiveIntensity={night ? 0.6 : 0.15} />
      </mesh>
      {night && <pointLight position={[0, 1.6, 1.8]} color="#7fe0f0" intensity={5} distance={6} />}
    </Spot>
  )
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

/* ---------------- Merge Defence: two towers of different merge tiers, slimes on the way ---------------- */

function castle(accent: THREE.Color): Parts {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const stone = hex('#d8ccb8'), stoneDark = hex('#b9ab95')
  const crown = (r: number, y: number, x: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      p.push(box([0.2, 0.22, 0.2], stoneDark, [x + Math.cos(a) * r, y, Math.sin(a) * r]))
    }
  }
  // tier 1 tower (small) and tier 2 tower (big), joined by a wall with a gate
  p.push(cyl(0.48, 0.55, 1.5, stone, [-1.25, 0.75, 0], undefined, 12))
  crown(0.42, 1.6, -1.25, 6)
  p.push(cyl(0.75, 0.85, 2.7, stone, [1.2, 1.35, 0], undefined, 14))
  p.push(cone(0.95, 1.1, accent, [1.2, 3.25, 0], undefined, 12))
  p.push(box([1.6, 1.1, 0.4], stoneDark, [0, 0.55, 0]))
  for (let i = 0; i < 4; i++) p.push(box([0.22, 0.22, 0.42], stone, [-0.6 + i * 0.4, 1.2, 0]))
  p.push(box([0.6, 0.75, 0.42], C.woodDark, [0, 0.38, 0.02]))
  for (const [x, y] of [[-1.25, 2.3], [1.2, 4.3]]) {
    p.push(cyl(0.025, 0.025, 0.9, C.woodDark, [x, y - 0.4, 0]))
    p.push(box([0.02, 0.28, 0.42], accent, [x, y - 0.05, 0.22]))
  }
  // tier stars on the towers
  g.push(sphere(0.1, C.yellow, [-1.25, 1.0, 0.5], 8))
  for (const y of [1.8, 2.2]) g.push(sphere(0.1, C.yellow, [1.2, y, 0.8], 8))
  // two little defenders about to merge, and slimes coming up the path
  for (const x of [-0.45, 0.45]) {
    p.push(blob(0.22, hex('#5d8fd6'), [x, 0.22, 1.2], 0.9, x > 0 ? 3 : 5))
    p.push(sphere(0.12, hex('#f1c9a5'), [x, 0.55, 1.2], 10))
  }
  // (kept left of the path: the Pilot stands front-right of the castle)
  ;[[-1.5, 1.7], [-2.0, 2.2], [-1.7, 2.8]].forEach(([x, z], i) => p.push(blob(0.2 + i * 0.03, hex('#9b6fd0'), [x, 0.16, z], 0.6, i + 9)))
  return { body: merge(p), glow: merge(g) }
}

function MergeDefence({ def, night }: { def: IslandDef; night: boolean }) {
  const parts = useMemo(() => castle(hex(def.accent)), [def.accent])
  const spark = useRef<THREE.Mesh>(null)
  useFrame((s, dt) => {
    if (!spark.current) return
    spark.current.rotation.y += dt * 2
    spark.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 4) * 0.2)
  })
  return (
    <Spot def={def}>
      <Body g={parts.body} />
      <Glow g={parts.glow} night={night} day="#f0dc9a" />
      <mesh ref={spark} position={[0, 0.75, 1.2]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color="#ffd75e" toneMapped={false} />
      </mesh>
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

export function IslandLandmark({ def, night }: { def: IslandDef; night: boolean }) {
  switch (def.id) {
    case 'behind-the-smile':
      return <BehindTheSmile def={def} night={night} />
    case 'chrono-rebellion':
      return <ChronoRebellion def={def} night={night} />
    case 'sunken-greed':
      return <SunkenGreed def={def} night={night} />
    case 'paper-plane-dash':
      return <PaperPlaneDash def={def} night={night} />
    case 'merge-defence':
      return <MergeDefence def={def} night={night} />
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

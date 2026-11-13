import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORKSHOP, groundY, type IslandDef } from '../layout'
import { At, Body, Glow } from './Chrono'
import { groundPatch } from './ground'
import { C, blob, box, cone, cyl, gear, hex, merge, prism, sphere, torus } from './kit'
import { Board, listTex, placer } from './parts'

/**
 * Workshop Isle (skills): one labelled tool rack per skill group, each listing the tools in that group,
 * around a working yard: a forge with a hammer on the anvil, a workbench shed with turning gears, a grindstone and a windmill.
 */

/** The racks. Each lists a group of skills from content/skills.yaml (Blender is left out on purpose: rarely used). */
const RACKS: { heading: string; items: string[]; colour: string }[] = [
  { heading: 'ENGINES', items: ['Unity', 'Unreal Engine 5', 'Three.js'], colour: '#B07A45' },
  { heading: 'LANGUAGES', items: ['C#', 'C++', 'JavaScript', 'Python', 'GLSL shaders', 'HTML / CSS'], colour: '#5d7fb8' },
  { heading: 'XR & VISION', items: ['XR Interaction Toolkit', 'OpenXR', 'Vuforia', 'OpenCV', 'MediaPipe'], colour: '#7B61C9' },
  { heading: 'MOTION & DESIGN', items: ['After Effects', 'Photoshop', 'Illustrator'], colour: '#2F8F9D' },
  { heading: 'QA', items: ['Playtesting', 'Bug reporting'], colour: '#5DA05A' },
]

const IRON = hex('#4a4d55'), BRICK = hex('#9a6a55'), BRICK_DARK = hex('#7d5444'), EMBER = hex('#ff8a3c')

/** The frame a rack's sign hangs in, with a rail of hand tools under it. */
function rackFrame(seed: number) {
  const p: THREE.BufferGeometry[] = []
  for (const x of [-1.0, 1.0]) p.push(box([0.11, 2.75, 0.11], C.woodDark, [x, 1.375, -0.06]), box([0.5, 0.08, 0.5], C.woodDark, [x, 0.04, -0.06]))
  p.push(prism(2.4, 0.26, 0.4, C.roofDark, [0, 2.72, -0.04]))
  p.push(box([1.9, 0.05, 0.05], IRON, [0, 0.82, 0]))
  // three tools on hooks: which ones depends on the rack
  const tools = [
    () => merge([cyl(0.03, 0.03, 0.45, C.woodLight, [0, -0.22, 0], undefined, 6), box([0.24, 0.11, 0.1], IRON, [0, -0.47, 0])]), // hammer
    () => merge([cyl(0.025, 0.025, 0.4, IRON, [0, -0.2, 0], undefined, 6), torus(0.07, 0.025, IRON, [0, -0.45, 0], undefined, Math.PI * 1.5, 10)]), // wrench
    () => merge([box([0.07, 0.16, 0.05], C.red, [0, -0.08, 0]), cyl(0.014, 0.014, 0.34, IRON, [0, -0.33, 0], undefined, 5)]), // screwdriver
    () => merge([box([0.1, 0.14, 0.04], C.woodLight, [0, -0.07, 0]), box([0.3, 0.26, 0.012], hex('#c8ccd4'), [0.1, -0.27, 0])]), // saw
    () => merge([cyl(0.02, 0.02, 0.36, C.woodLight, [0, -0.18, 0], undefined, 5), box([0.07, 0.12, 0.03], hex('#f2b33d'), [0, -0.42, 0])]), // brush
  ]
  for (let i = 0; i < 3; i++) p.push(tools[(seed + i * 2) % tools.length]().translate(-0.6 + i * 0.6, 0.8, 0.03))
  return merge(p)
}

function shed(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = []
  p.push(box([3.0, 0.12, 0.95], C.woodLight, [0, 0.98, -0.1]))
  for (const x of [-1.35, 1.35]) for (const z of [-0.45, 0.25]) p.push(box([0.11, 0.95, 0.11], C.wood, [x, 0.47, z]))
  p.push(box([2.6, 0.06, 0.7], C.wood, [0, 0.3, -0.1]))
  // on the bench: a vice, a toolbox, a plan held down by a mug
  p.push(box([0.3, 0.2, 0.26], IRON, [-1.1, 1.14, 0]), box([0.1, 0.3, 0.3], IRON, [-0.9, 1.19, 0]), cyl(0.02, 0.02, 0.4, C.metal, [-0.82, 1.2, 0], [0, 0, Math.PI / 2], 5))
  p.push(box([0.7, 0.32, 0.34], C.red, [0.85, 1.2, -0.15]), box([0.5, 0.05, 0.05], C.ink, [0.85, 1.41, -0.15]))
  p.push(box([0.75, 0.01, 0.5], hex('#dfe9f5'), [-0.1, 1.05, 0.02], [0, 0.15, 0]), cyl(0.07, 0.06, 0.14, C.cream, [0.22, 1.12, 0.14], undefined, 8))
  // a low tool rail at the back of the bench
  p.push(box([3.0, 0.5, 0.07], accent, [0, 1.3, -0.55]))
  ;[[-1.2, C.metal], [-0.7, C.red], [-0.2, C.yellow], [0.35, C.metal], [0.9, hex('#5d8fd6')]].forEach(([x, c]) => p.push(box([0.1, 0.36, 0.04], c as THREE.Color, [x as number, 1.3, -0.5], [0, 0, ((x as number) % 0.5) - 0.2])))
  p.push(box([0.5, 0.5, 0.5], C.wood, [2.5, 0.25, 0.4]), cyl(0.26, 0.26, 0.62, C.woodLight, [-2.5, 0.31, 0.3], undefined, 10))
  return merge(p)
}

function forge() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([1.7, 0.9, 1.3], BRICK, [0, 0.45, 0]), box([1.8, 0.1, 1.4], BRICK_DARK, [0, 0.95, 0]))
  p.push(box([1.7, 1.1, 0.3], BRICK, [0, 1.55, -0.5]), box([0.3, 1.1, 1.0], BRICK, [-0.7, 1.55, 0]), box([0.3, 1.1, 1.0], BRICK, [0.7, 1.55, 0]))
  p.push(box([1.8, 0.14, 1.4], BRICK_DARK, [0, 2.17, 0]), cyl(0.3, 0.42, 0.7, BRICK, [0, 2.55, -0.2], undefined, 8), cyl(0.36, 0.36, 0.1, BRICK_DARK, [0, 2.9, -0.2], undefined, 8))
  g.push(blob(0.45, EMBER, [0, 1.1, 0.05], 0.45, 4), sphere(0.12, C.yellow, [0.1, 1.2, 0.1], 6), sphere(0.1, C.yellow, [-0.18, 1.17, 0.0], 6))
  // bellows and a bucket of water
  p.push(box([0.5, 0.2, 0.7], C.woodLight, [1.25, 0.75, 0.1], [0, 0, 0.1]), cone(0.1, 0.4, IRON, [0.95, 0.9, 0.1], [0, 0, Math.PI / 2], 6))
  p.push(cyl(0.24, 0.2, 0.36, C.wood, [-1.25, 0.18, 0.5], undefined, 10))
  g.push(cyl(0.21, 0.21, 0.02, hex('#9fd0e8'), [-1.25, 0.34, 0.5], undefined, 10))
  return { body: merge(p), glow: merge(g) }
}

function anvil() {
  const p = [cyl(0.38, 0.42, 0.6, C.wood, [0, 0.3, 0], undefined, 10), box([0.34, 0.2, 0.3], IRON, [0, 0.7, 0]), box([0.75, 0.16, 0.36], IRON, [0, 0.88, 0]), cone(0.14, 0.4, IRON, [0.55, 0.88, 0], [0, 0, -Math.PI / 2], 8)]
  return { body: merge(p), glow: box([0.36, 0.05, 0.1], EMBER, [-0.05, 0.99, 0]) }
}
/** The smith's hammer, swinging about the origin (the end of its handle). */
const hammer = () => merge([cyl(0.035, 0.035, 0.75, C.woodLight, [0.37, 0, 0], [0, 0, Math.PI / 2], 6), box([0.16, 0.3, 0.16], IRON, [0.74, 0, 0])])

function windmillTower() {
  const p = [cyl(0.75, 1.1, 3.6, C.stone, [0, 1.8, 0], undefined, 10), cyl(1.15, 1.2, 0.25, C.stoneDark, [0, 0.12, 0], undefined, 10), cone(0.95, 1.0, C.roofDark, [0, 4.1, 0], undefined, 10)]
  p.push(box([0.44, 0.8, 0.1], C.woodDark, [0, 0.6, 1.02]), cyl(0.08, 0.08, 0.7, C.woodDark, [0, 3.3, 0.95], [Math.PI / 2, 0, 0], 6))
  return { body: merge(p), glow: merge([box([0.3, 0.36, 0.05], hex('#ffe3a0'), [0, 2.1, 0.92])]) }
}
function windmillSails() {
  const p: THREE.BufferGeometry[] = [cyl(0.16, 0.16, 0.2, C.woodDark, [0, 0, 0], [Math.PI / 2, 0, 0], 8)]
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    p.push(merge([box([0.07, 2.3, 0.05], C.woodDark, [0, 1.15, 0]), box([0.55, 1.7, 0.02], C.cream, [0.3, 1.4, 0])]).rotateZ(a))
  }
  return merge(p)
}

function grindstone() {
  const p = [box([0.9, 0.08, 0.5], C.wood, [0, 0.5, 0])]
  for (const x of [-0.4, 0.4]) for (const z of [-0.2, 0.2]) p.push(box([0.07, 0.5, 0.07], C.woodDark, [x, 0.25, z]))
  for (const z of [-0.2, 0.2]) p.push(box([0.07, 0.4, 0.05], C.woodDark, [0, 0.72, z]))
  return merge(p)
}

function lumber() {
  const p: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) p.push(cyl(0.14, 0.14, 1.7, i % 2 ? C.woodLight : C.wood, [0, 0.14, -0.3 + i * 0.3], [0, 0, Math.PI / 2], 8))
  for (let i = 0; i < 2; i++) p.push(cyl(0.14, 0.14, 1.7, C.wood, [0, 0.4, -0.15 + i * 0.3], [0, 0, Math.PI / 2], 8))
  p.push(cyl(0.3, 0.34, 0.4, C.wood, [1.3, 0.2, 0.2], undefined, 10), box([0.06, 0.5, 0.2], IRON, [1.3, 0.55, 0.2], [0, 0, 0.3]), cyl(0.025, 0.025, 0.6, C.woodLight, [1.48, 0.86, 0.2], [0, 0, -0.5], 5))
  return merge(p)
}

export function Workshop({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const signs = useMemo(() => RACKS.map((r) => listTex(r.heading, r.items, r.colour, 512, r.items.length > 3 ? 448 : 448)), [])

  const g = useMemo(() => {
    const put = placer(def), p: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = []
    const dirtA = hex('#d6bd8e'), dirtB = hex('#cdb383')
    const yard = groundPatch(def, WORKSHOP.yard, 4.7, (rho, a) => (Math.sin(a * 7 + rho * 9) > 0.2 ? dirtA : dirtB))
    p.push(put(shed(accent), WORKSHOP.shed, 0.55, 1.1))
    const f = forge(), an = anvil(), w = windmillTower()
    p.push(put(f.body, WORKSHOP.forge, 0.3, 1.0), put(an.body, WORKSHOP.anvil, 0.3, 1.1), put(w.body, WORKSHOP.windmill, -0.2, 1.3))
    glow.push(put(f.glow, WORKSHOP.forge, 0.3, 1.0), put(an.glow, WORKSHOP.anvil, 0.3, 1.1), put(w.glow, WORKSHOP.windmill, -0.2, 1.3))
    p.push(put(grindstone(), WORKSHOP.grind, -0.3, 1.1), put(lumber(), WORKSHOP.lumber, -0.4, 1.1))
    return {
      yard, town: merge(p), glow: merge(glow), racks: RACKS.map((_, i) => rackFrame(i)), hammer: hammer(), sails: windmillSails(),
      big: gear(0.55, 0.14, 12, hex('#c58a4a')), small: gear(0.32, 0.12, 8, hex('#8fa3b8')),
      wheel: merge([cyl(0.34, 0.34, 0.14, hex('#b9bcc2'), [0, 0, 0], [Math.PI / 2, 0, 0], 16), box([0.1, 0.1, 0.16], C.woodDark, [0, 0.2, 0])]),
    }
  }, [def, accent])

  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const g1 = useRef<THREE.Mesh>(null), g2 = useRef<THREE.Mesh>(null), sails = useRef<THREE.Mesh>(null), wheel = useRef<THREE.Mesh>(null), ham = useRef<THREE.Mesh>(null)
  const sparks = useRef<(THREE.Mesh | null)[]>([]), fire = useRef<THREE.PointLight>(null)
  useFrame((state, dt) => {
    if (state.camera.position.distanceTo(centre) > 80) return
    const t = state.clock.elapsedTime
    if (g1.current) g1.current.rotation.z += dt * 0.6
    if (g2.current) g2.current.rotation.z -= dt * 0.9
    if (sails.current) sails.current.rotation.z += dt * 0.5
    if (wheel.current) wheel.current.rotation.z -= dt * 3
    // the hammer lifts slowly and comes down fast; sparks fly at each strike
    const beat = (t * 0.9) % 1, lift = beat < 0.75 ? Math.sin((beat / 0.75) * Math.PI * 0.5) : 1 - ((beat - 0.75) / 0.25) ** 2
    if (ham.current) ham.current.rotation.z = -0.15 + lift * 1.1
    sparks.current.forEach((m, i) => {
      if (!m) return
      const a = i * 1.7, k = beat * 3.2 // 0 at the strike
      m.visible = k < 1
      m.position.set(Math.cos(a) * k * 0.55, 0.05 + k * (0.7 + (i % 3) * 0.2) - k * k * 0.7, Math.sin(a) * k * 0.45)
      m.scale.setScalar(1 - k)
    })
    if (fire.current) fire.current.intensity = 5 + Math.sin(t * 9) * 1.2 + Math.sin(t * 23) * 0.6
  })

  return (
    <>
      <mesh geometry={g.yard} receiveShadow renderOrder={1}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <Body g={g.town} />
      <Glow g={g.glow} night={night} day="#f0cfa0" />
      {WORKSHOP.racks.map((xz, i) => (
        <At key={i} def={def} xz={xz} turn={[0.5, 0.28, 0.08, -0.1, -0.32][i]} scale={1.15}>
          <Body g={g.racks[i]} />
          <Board tex={signs[i]} w={1.78} h={1.56} y={1.75} posts={false} />
        </At>
      ))}
      {/* gears turning on the side of the shed */}
      <At def={def} xz={WORKSHOP.shed} turn={0.55} scale={1.1}>
        <mesh ref={g1} geometry={g.big} position={[2.2, 0.75, 0.2]}>
          <meshLambertMaterial vertexColors />
        </mesh>
        <mesh ref={g2} geometry={g.small} position={[2.2 + 0.72, 0.75 + 0.5, 0.2]}>
          <meshLambertMaterial vertexColors />
        </mesh>
      </At>
      <At def={def} xz={WORKSHOP.windmill} turn={-0.2} scale={1.3}>
        <mesh ref={sails} geometry={g.sails} position={[0, 3.3, 1.32]} castShadow>
          <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      </At>
      <At def={def} xz={WORKSHOP.grind} turn={-0.3} scale={1.1}>
        <mesh ref={wheel} geometry={g.wheel} position={[0, 0.82, 0]}>
          <meshLambertMaterial vertexColors />
        </mesh>
      </At>
      <At def={def} xz={WORKSHOP.anvil} turn={0.3} scale={1.1}>
        <mesh ref={ham} geometry={g.hammer} position={[-0.85, 1.2, 0]} castShadow>
          <meshLambertMaterial vertexColors />
        </mesh>
        {!simple && (
          <group position={[-0.05, 1.0, 0]}>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} ref={(el) => void (sparks.current[i] = el)}>
                <sphereGeometry args={[0.045, 5, 4]} />
                <meshBasicMaterial color="#ffd98a" toneMapped={false} />
              </mesh>
            ))}
          </group>
        )}
      </At>
      {night && <pointLight ref={fire} position={[WORKSHOP.forge[0], groundY(def, ...WORKSHOP.forge) + 1.4, WORKSHOP.forge[1]]} color="#ff9a4a" intensity={5} distance={8} />}
    </>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_YAW, HARBOR, groundY, islandSeed, type IslandDef } from '../layout'
import { makeOutline } from '../islandGen'
import { At, Body, Glow, ell } from './Chrono'
import { groundPatch } from './ground'
import { C, beam, blob, box, cone, cyl, hex, merge, prism, sphere, torus } from './kit'
import { Board, labelTex, placer } from './parts'

/**
 * The Harbor ("More work"): a small market where each stall is one kind of project, with a few props from those projects
 * on its counter. Behind it a lighthouse; off the island's edge a dock with a moored boat and a cargo crane.
 */

const ROPE = hex('#d9c08a'), HULL = hex('#a85a3a'), HULL_DARK = hex('#7c4029'), SAIL = hex('#fbf3df')

/** One stall per category: its sign, its colour, and which props stand on the counter. */
const STALLS: { tag: string; title: string; colour: string }[] = [
  { tag: 'WEB 3D · THREE.JS', title: 'Fruit Slice · Block Builder · Portal', colour: '#F26B3A' },
  { tag: '2D GAMES · UNITY', title: 'Card Solitaire · Flappy Bird', colour: '#5DA05A' },
  { tag: 'XR & COMPUTER VISION', title: 'VR lab · Hand-Tracked Shooter', colour: '#7B61C9' },
  { tag: 'MOTION & VIDEO', title: 'After Effects pieces', colour: '#2F8F9D' },
]

function stall(kind: number, colour: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([2.3, 0.85, 0.9], C.woodLight, [0, 0.42, 0]))
  p.push(box([2.45, 0.08, 1.05], C.wood, [0, 0.89, 0]))
  for (const x of [-1.12, 1.12]) {
    p.push(box([0.09, 2.3, 0.09], C.woodDark, [x, 1.15, -0.45]))
    p.push(box([0.09, 1.95, 0.09], C.woodDark, [x, 0.97, 0.45]))
  }
  // striped awning, sloping towards the customer
  for (let i = 0; i < 8; i++) p.push(box([0.32, 0.05, 1.5], i % 2 ? C.white : colour, [-1.12 + i * 0.32, 2.14, 0.05], [0.24, 0, 0]))
  for (let i = 0; i < 8; i++) p.push(box([0.32, 0.2, 0.03], i % 2 ? C.white : colour, [-1.12 + i * 0.32, 1.86, 0.79]))
  p.push(box([2.3, 1.1, 0.06], C.wood, [0, 1.5, -0.47]))
  const top = 0.93
  if (kind === 0) {
    // stacked blocks, a pile of fruit with a knife, and a glowing portal ring
    ;[[C.red, -0.85, 0], [C.yellow, -0.6, 0], [hex('#5d8fd6'), -0.72, 1], [hex('#5fb37a'), -0.35, 0]].forEach(([c, x, lvl]) => p.push(box([0.24, 0.24, 0.24], c as THREE.Color, [x as number, top + 0.12 + (lvl as number) * 0.24, 0.05], [0, (x as number) * 2, 0])))
    p.push(sphere(0.14, hex('#e0533d'), [0.05, top + 0.13, 0.1], 8), sphere(0.13, hex('#ffb347'), [0.28, top + 0.12, 0.05], 8), ell(0.2, 0.15, 0.16, hex('#5fb37a'), [0.15, top + 0.14, -0.15], 8))
    p.push(box([0.03, 0.02, 0.4], hex('#d8dde6'), [0.2, top + 0.3, 0.05], [0.5, 0.4, 0]))
    p.push(torus(0.24, 0.05, C.ink, [0.8, top + 0.3, 0]))
    g.push(cyl(0.2, 0.2, 0.02, hex('#b78aff'), [0.8, top + 0.3, 0], [Math.PI / 2, 0, 0], 14))
  } else if (kind === 1) {
    // a fan of playing cards, and the bird between two pipes
    for (let i = 0; i < 4; i++) {
      p.push(box([0.2, 0.3, 0.012], C.white, [-0.85 + i * 0.13, top + 0.2, 0.1 - i * 0.01], [-0.3, 0, 0.3 - i * 0.2]))
      p.push(box([0.06, 0.06, 0.014], i % 2 ? C.red : C.ink, [-0.85 + i * 0.13, top + 0.22, 0.11 - i * 0.01], [-0.3, 0, 0.3 - i * 0.2]))
    }
    for (const [x, h] of [[0.25, 0.3], [0.85, 0.5]]) p.push(cyl(0.11, 0.11, h, hex('#5fb37a'), [x, top + h / 2, 0], undefined, 10), cyl(0.14, 0.14, 0.08, hex('#4a9a63'), [x, top + h, 0], undefined, 10))
    p.push(ell(0.13, 0.11, 0.11, C.yellow, [0.55, top + 0.5, 0], 8), cone(0.04, 0.1, hex('#ff8a3c'), [0.69, top + 0.49, 0], [0, 0, -Math.PI / 2], 6), sphere(0.03, C.ink, [0.6, top + 0.54, 0.09], 5))
  } else if (kind === 2) {
    // a VR headset with its strap, two controllers, and a webcam watching a hand
    p.push(box([0.42, 0.22, 0.2], hex('#e9edf5'), [-0.6, top + 0.22, 0.1]), box([0.36, 0.14, 0.03], C.ink, [-0.6, top + 0.22, 0.21]))
    p.push(torus(0.2, 0.025, C.ink, [-0.6, top + 0.22, -0.06], [Math.PI / 2, 0, 0], Math.PI, 12))
    for (const x of [-0.15, 0.08]) p.push(cyl(0.035, 0.04, 0.2, hex('#e9edf5'), [x, top + 0.1, 0.15], [0.5, 0, 0], 6), torus(0.07, 0.015, hex('#e9edf5'), [x, top + 0.2, 0.08], [0.6, 0, 0], Math.PI * 2, 10))
    p.push(cyl(0.02, 0.02, 0.4, C.metal, [0.75, top + 0.2, -0.1], undefined, 5), box([0.2, 0.12, 0.1], C.ink, [0.75, top + 0.45, -0.1]))
    g.push(sphere(0.03, hex('#7de3ff'), [0.75, top + 0.45, -0.04], 6))
    p.push(box([0.16, 0.2, 0.04], hex('#e8b88f'), [0.45, top + 0.2, 0.2], [0, 0, 0.2]))
    for (let i = 0; i < 4; i++) p.push(box([0.03, 0.13, 0.03], hex('#e8b88f'), [0.38 + i * 0.045, top + 0.36, 0.2], [0, 0, 0.2 - i * 0.08]))
  } else {
    // a clapperboard, two film reels and a framed poster
    p.push(box([0.42, 0.3, 0.04], C.ink, [-0.6, top + 0.16, 0.1], [-0.2, 0.2, 0]), box([0.44, 0.07, 0.05], C.white, [-0.6, top + 0.36, 0.07], [-0.2, 0.2, 0.18]))
    for (const [x, r] of [[0.0, 0.2], [0.3, 0.15]]) p.push(cyl(r, r, 0.06, C.metal, [x, top + r, 0.05], [Math.PI / 2, 0, 0], 14), cyl(r * 0.3, r * 0.3, 0.08, C.ink, [x, top + r, 0.05], [Math.PI / 2, 0, 0], 8))
    p.push(box([0.46, 0.6, 0.04], C.woodDark, [0.8, top + 0.32, -0.1], [-0.15, -0.2, 0]))
    g.push(box([0.38, 0.52, 0.02], hex('#ffd9a0'), [0.795, top + 0.32, -0.075], [-0.15, -0.2, 0]))
  }
  return { body: merge(p), glow: g.length ? merge(g) : null }
}

function lighthouse() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(cyl(1.0, 1.15, 0.4, C.stone, [0, 0.2, 0], undefined, 14))
  const H = 3.6
  for (let i = 0; i < 4; i++) p.push(cyl(0.75 - ((i + 1) * 0.2) / 4, 0.75 - (i * 0.2) / 4, H / 4, i % 2 ? C.red : C.white, [0, 0.4 + (i * H) / 4 + H / 8, 0], undefined, 16))
  p.push(box([0.4, 0.7, 0.1], C.woodDark, [0, 0.75, 0.72]))
  p.push(cyl(0.85, 0.85, 0.1, C.ink, [0, 4.05, 0], undefined, 16))
  for (let i = 0; i < 10; i++) p.push(box([0.04, 0.35, 0.04], C.ink, [Math.cos((i / 10) * Math.PI * 2) * 0.8, 4.27, Math.sin((i / 10) * Math.PI * 2) * 0.8]))
  g.push(cyl(0.42, 0.42, 0.6, C.yellow, [0, 4.4, 0], undefined, 12))
  p.push(cone(0.6, 0.6, C.red, [0, 5.0, 0], undefined, 12), sphere(0.08, C.gold, [0, 5.35, 0], 8))
  return { body: merge(p), glow: merge(g) }
}

function lampPost() {
  const p = [cyl(0.05, 0.07, 2.2, C.ink, [0, 1.1, 0], undefined, 6), box([0.5, 0.05, 0.05], C.ink, [0.2, 2.2, 0]), cone(0.16, 0.14, C.ink, [0.42, 2.14, 0], undefined, 8)]
  return { body: merge(p), glow: sphere(0.1, hex('#ffe3a0'), [0.42, 2.02, 0], 8) }
}

function crates() {
  const p: THREE.BufferGeometry[] = []
  p.push(box([0.7, 0.7, 0.7], C.wood, [0, 0.35, 0]), box([0.55, 0.55, 0.55], C.woodLight, [0.7, 0.27, 0.2], [0, 0.4, 0]), box([0.5, 0.5, 0.5], C.woodLight, [0.05, 0.95, 0.02], [0, 0.3, 0]))
  for (const [x, z] of [[-0.8, 0.3], [-0.6, -0.5]]) p.push(cyl(0.26, 0.26, 0.6, C.wood, [x, 0.3, z], undefined, 10), torus(0.265, 0.02, C.metal, [x, 0.45, z], [Math.PI / 2, 0, 0], Math.PI * 2, 12), torus(0.265, 0.02, C.metal, [x, 0.15, z], [Math.PI / 2, 0, 0], Math.PI * 2, 12))
  // a coil of rope and a net float
  p.push(torus(0.22, 0.06, ROPE, [0.6, 0.06, -0.6], [Math.PI / 2, 0, 0], Math.PI * 2, 12), sphere(0.14, C.red, [1.1, 0.14, -0.3], 8))
  return merge(p)
}

function anchor() {
  const p = [cyl(0.05, 0.05, 1.1, C.metal, [0, 0.65, 0], [0, 0, 0.25], 6), torus(0.14, 0.035, C.metal, [-0.16, 1.25, 0]), box([0.5, 0.07, 0.07], C.metal, [-0.1, 1.0, 0], [0, 0, 0.25])]
  p.push(torus(0.42, 0.055, C.metal, [0.07, 0.42, 0], [0, 0, Math.PI + 0.25], Math.PI, 12))
  return merge(p)
}

function noticeBoard() {
  const p = [box([0.08, 1.5, 0.08], C.woodDark, [-0.7, 0.75, 0]), box([0.08, 1.5, 0.08], C.woodDark, [0.7, 0.75, 0]), box([1.6, 0.9, 0.06], C.wood, [0, 1.2, 0.02]), prism(1.8, 0.22, 0.3, C.roofDark, [0, 1.66, 0.02])]
  ;[[-0.5, 1.32, '#f4efe4'], [-0.08, 1.12, '#ffd75e'], [0.36, 1.36, '#a8e0ff'], [-0.3, 0.98, '#f29ac0'], [0.4, 1.0, '#f4efe4'], [0.02, 1.42, '#c8f0c0']].forEach(([x, y, c]) =>
    p.push(box([0.3, 0.24, 0.02], hex(c as string), [x as number, y as number, 0.06], [0, 0, (x as number) * 0.3]), sphere(0.025, C.red, [x as number, (y as number) + 0.09, 0.08], 5)),
  )
  return merge(p)
}

/** The boat, bow towards +Z. */
function boat(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = []
  const hull = ell(0.8, 0.55, 2.0, HULL, [0, 0, 0], 14)
  const pos = hull.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.12) pos.setY(i, 0.12) // slice the top off for a deck
  p.push(hull, box([1.2, 0.06, 2.9], C.woodLight, [0, 0.12, 0]), box([1.66, 0.12, 0.1], HULL_DARK, [0, 0.16, 0]))
  p.push(torus(0.8, 0.05, HULL_DARK, [0, 0.13, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 20).scale(1, 1, 2.5))
  p.push(box([0.7, 0.4, 0.8], C.cream, [0, 0.36, -0.9]), box([0.8, 0.06, 0.9], accent, [0, 0.58, -0.9]))
  p.push(cyl(0.05, 0.06, 3.0, C.woodDark, [0, 1.6, 0.1], undefined, 6), box([0.05, 0.05, 1.5], C.woodDark, [0, 0.75, 0.9]))
  p.push(prism(1.45, 2.2, 0.03, SAIL, [0, 0.8, 0.85], [0, -Math.PI / 2, 0]))
  p.push(box([0.02, 0.24, 0.4], accent, [0, 3.0, -0.1]))
  return merge(p)
}

const gull = () => merge([box([0.5, 0.03, 0.14], C.white, [-0.24, 0.05, 0], [0, 0, 0.3]), box([0.5, 0.03, 0.14], C.white, [0.24, 0.05, 0], [0, 0, -0.3]), ell(0.07, 0.06, 0.18, C.white, [0, 0, 0], 6)])

export function Harbor({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const signs = useMemo(() => STALLS.map((s) => labelTex(s.tag, s.title, s.colour)), [])
  const moreSign = useMemo(() => labelTex('THE HARBOR', 'Everything else I have shipped', def.accent, 512, 150), [def.accent])

  const g = useMemo(() => {
    const put = placer(def), p: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = []
    const stoneA = hex('#bfc5c9'), stoneB = hex('#aab2b8')
    const plaza = groundPatch(def, HARBOR.plaza, 4.9, (rho, a) => ((Math.floor(rho * 5 + 0.01) + Math.floor((a / (Math.PI * 2)) * 28 + 0.01)) % 2 ? stoneA : stoneB))
    const lh = lighthouse()
    p.push(put(lh.body, HARBOR.lighthouse, 0, 1.35))
    glow.push(put(lh.glow, HARBOR.lighthouse, 0, 1.35))
    HARBOR.lamps.forEach((xz, i) => {
      const l = lampPost()
      p.push(put(l.body, xz, i * 1.3))
      glow.push(put(l.glow, xz, i * 1.3))
    })
    p.push(put(crates(), HARBOR.crates, 0.3, 1.1), put(anchor(), HARBOR.anchor, -0.3, 1.1), put(noticeBoard(), HARBOR.board, 0.25, 1.1))

    // the dock: planks out over the edge, on posts, towards the moored boat
    const to = HARBOR.dockTowards, ang = Math.atan2(to[1], to[0]), rim = makeOutline(def.radius, islandSeed(def.id))(ang)
    const ux = Math.cos(ang), uz = Math.sin(ang), r0 = rim * 0.84, r1 = rim * 1.2
    const deckY = groundY(def, ux * r0, uz * r0) + 0.12, yaw = Math.atan2(ux, uz)
    for (let r = r0, i = 0; r < r1; r += 0.34, i++) p.push(box([1.5, 0.08, 0.3], i % 2 ? C.woodLight : C.wood, [ux * r, deckY, uz * r], [0, yaw, 0]))
    for (let r = r0 + 0.6; r < r1; r += 1.5) for (const s of [-0.7, 0.7]) p.push(cyl(0.08, 0.08, 1.6, C.woodDark, [ux * r - uz * s, deckY - 0.5, uz * r + ux * s], undefined, 6), torus(0.1, 0.03, ROPE, [ux * r - uz * s, deckY + 0.2, uz * r + ux * s], [Math.PI / 2, 0, 0], Math.PI * 2, 8))
    const end = new THREE.Vector3(ux * r1, deckY, uz * r1)
    const lamp = lampPost()
    p.push(lamp.body.rotateY(yaw).translate(end.x - ux * 0.3 - uz * 0.6, deckY, end.z - uz * 0.3 + ux * 0.6))
    glow.push(lamp.glow.rotateY(yaw).translate(end.x - ux * 0.3 - uz * 0.6, deckY, end.z - uz * 0.3 + ux * 0.6))

    // the cargo crane: a post and an arm reaching out over the edge
    const cr = HARBOR.crane, cy = groundY(def, cr[0], cr[1]), armTip = new THREE.Vector3(cr[0] + ux * 2.4, cy + 3.3, cr[1] + uz * 2.4)
    p.push(cyl(0.12, 0.16, 3.0, C.woodDark, [cr[0], cy + 1.5, cr[1]], undefined, 8), cyl(0.3, 0.34, 0.3, C.stoneDark, [cr[0], cy + 0.15, cr[1]], undefined, 10))
    p.push(beam(new THREE.Vector3(cr[0] - ux * 0.7, cy + 2.6, cr[1] - uz * 0.7), armTip, 0.12, 0.12, C.wood), beam(new THREE.Vector3(cr[0], cy + 1.5, cr[1]), new THREE.Vector3(cr[0] + ux * 1.2, cy + 2.95, cr[1] + uz * 1.2), 0.07, 0.07, C.woodDark))
    return {
      plaza, town: merge(p), glow: merge(glow), stalls: STALLS.map((s, i) => stall(i, hex(s.colour))), boat: boat(accent), gull: gull(),
      hook: merge([cyl(0.015, 0.015, 1.3, ROPE, [0, -0.65, 0], undefined, 4), box([0.5, 0.5, 0.5], C.woodLight, [0, -1.55, 0]), box([0.54, 0.06, 0.54], C.woodDark, [0, -1.55, 0])]),
      armTip, boatAt: new THREE.Vector3(ux * (r1 + 0.2) - uz * 1.7, deckY - 0.35, uz * (r1 + 0.2) + ux * 1.7), boatYaw: yaw + 0.15,
      lightAt: new THREE.Vector3(HARBOR.lighthouse[0], groundY(def, ...HARBOR.lighthouse) + 4.4 * 1.35, HARBOR.lighthouse[1]),
    }
  }, [def, accent])

  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const boatRef = useRef<THREE.Group>(null), hook = useRef<THREE.Mesh>(null), beamRef = useRef<THREE.Group>(null), gulls = useRef<(THREE.Mesh | null)[]>([])
  useFrame((state, dt) => {
    if (state.camera.position.distanceTo(centre) > 80) return
    const t = state.clock.elapsedTime
    if (boatRef.current) {
      boatRef.current.position.y = g.boatAt.y + Math.sin(t * 0.9) * 0.14
      boatRef.current.rotation.set(Math.sin(t * 0.7) * 0.04, g.boatYaw, Math.sin(t * 0.9 + 1) * 0.06, 'YXZ')
    }
    if (hook.current) hook.current.rotation.set(Math.sin(t * 1.1) * 0.12, 0, Math.cos(t * 0.8) * 0.1)
    if (beamRef.current) beamRef.current.rotation.y += dt * 0.7
    gulls.current.forEach((m, i) => {
      if (!m) return
      const a = t * (0.5 + i * 0.07) + i * 2.1, r = 2.6 + i * 0.9
      m.position.set(g.lightAt.x + Math.cos(a) * r, g.lightAt.y + 0.6 + i * 0.5 + Math.sin(t * 1.3 + i) * 0.3, g.lightAt.z + Math.sin(a) * r)
      m.rotation.set(0, -a, Math.sin(t * 6 + i) * 0.25)
    })
  })

  return (
    <>
      <mesh geometry={g.plaza} receiveShadow renderOrder={1}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <Body g={g.town} />
      <Glow g={g.glow} night={night} day="#f3e3b0" />
      {HARBOR.stalls.map((xz, i) => (
        <At key={i} def={def} xz={xz} turn={[0.5, 0.2, -0.1, -0.45][i]} scale={1.15}>
          <Body g={g.stalls[i].body} />
          {g.stalls[i].glow && <Glow g={g.stalls[i].glow!} night={night} day="#e9dcc0" />}
          <Board tex={signs[i]} w={2.3} h={0.79} y={2.85} posts={false} />
        </At>
      ))}
      <At def={def} xz={HARBOR.board} turn={0.25} scale={1.1} lift={2.05}>
        <Board tex={moreSign} w={1.9} h={0.56} y={0} posts={false} />
      </At>
      <group ref={boatRef} position={g.boatAt} scale={1.2}>
        <Body g={g.boat} />
      </group>
      <mesh ref={hook} geometry={g.hook} position={g.armTip} castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      {!simple &&
        [0, 1, 2].map((i) => (
          <mesh key={i} ref={(el) => void (gulls.current[i] = el)} geometry={g.gull}>
            <meshLambertMaterial vertexColors />
          </mesh>
        ))}
      {night && (
        <group ref={beamRef} position={g.lightAt}>
          <mesh position={[3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.9, 6, 16, 1, true]} />
            <meshBasicMaterial color="#fff2c4" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color="#ffe6a0" intensity={8} distance={10} />
        </group>
      )}
    </>
  )
}

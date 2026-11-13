import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_YAW, SUNK, groundY, type IslandDef } from '../layout'
import { At, Body, Glow, ell } from './Chrono'
import { groundPatch } from './ground'
import { C, beam, blob, box, cone, cyl, hex, merge, sphere, torus } from './kit'

/**
 * Sunken Greed island: the whole dive, told in order, on a loop.
 * The diver leaves the base, swims (real arm strokes) to three search spots and finds them empty,
 * has to wait while a whale crosses the path, reaches the treasure chest, opens it,
 * and the mosasaurus comes up from below the island's edge. Then the dive starts again.
 */

type V3 = [number, number, number]

const BRASS = hex('#c99a4a'), SAND = hex('#ead8ab'), SAND_DARK = hex('#d9c492'), SUIT = hex('#2c4a6e'), SUIT_LIGHT = hex('#f2b33d')
const WHALE = hex('#5b7fa6'), WHALE_BELLY = hex('#dfe9f2'), BEAST = hex('#3f6b5a'), BEAST_BELLY = hex('#cfe0c0')

function baseDome(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(cyl(1.9, 2.1, 0.4, BRASS, [0, 0.2, 0], undefined, 20))
  p.push(cyl(1.8, 1.8, 0.06, hex('#6d7480'), [0, 0.42, 0], undefined, 20))
  // inside: a console, a bunk and oxygen tanks
  p.push(box([0.9, 0.5, 0.4], hex('#56607a'), [-0.5, 0.7, -0.6]))
  g.push(box([0.7, 0.3, 0.03], hex('#7de3ff'), [-0.5, 1.1, -0.6]))
  p.push(box([1.0, 0.25, 0.5], accent, [0.7, 0.57, -0.4]))
  for (let i = 0; i < 3; i++) p.push(cyl(0.11, 0.11, 0.6, i % 2 ? C.yellow : hex('#d8dde6'), [0.2 + i * 0.26, 0.75, 0.7], undefined, 8))
  // airlock tube and ladder on the camera side
  p.push(cyl(0.5, 0.5, 0.9, BRASS, [0, 0.7, 1.95], [Math.PI / 2, 0, 0], 12))
  p.push(torus(0.5, 0.06, hex('#8a6a30'), [0, 0.7, 2.4], undefined, Math.PI * 2, 14))
  g.push(cyl(0.34, 0.34, 0.04, hex('#9fd0e8'), [0, 0.7, 2.42], [Math.PI / 2, 0, 0], 12))
  // ribs over the glass
  for (let i = 0; i < 4; i++) p.push(torus(1.82, 0.05, BRASS, [0, 0.42, 0], [0, (i * Math.PI) / 4, 0], Math.PI, 16))
  p.push(cyl(0.08, 0.08, 0.8, BRASS, [0, 2.6, 0], undefined, 6))
  g.push(sphere(0.13, C.red, [0, 3.05, 0], 8))
  return { body: merge(p), glow: merge(g) }
}

function chest(open: boolean, full: boolean) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([0.9, 0.5, 0.6], C.wood, [0, 0.25, 0]))
  for (const x of [-0.38, 0, 0.38]) p.push(box([0.07, 0.52, 0.62], BRASS, [x, 0.25, 0]))
  if (!open) return { body: merge(p), glow: merge([sphere(0.05, C.gold, [0, 0.36, 0.31], 6)]) }
  if (full) {
    g.push(blob(0.34, C.gold, [0, 0.52, 0], 0.5, 3))
    for (const [x, y, z] of [[-0.25, 0.62, 0.1], [0.2, 0.64, -0.05], [0.05, 0.7, 0.12]]) g.push(sphere(0.07, C.gold, [x, y, z], 6))
    g.push(sphere(0.08, hex('#ff5d8a'), [0.26, 0.6, 0.16], 6))
    g.push(sphere(0.07, hex('#5fd0c8'), [-0.12, 0.66, -0.12], 6))
  }
  return { body: merge(p), glow: g.length ? merge(g) : null }
}

/** Chest lid, hinged along its back edge (the hinge is at the origin). */
function lid() {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.3, 0.3, 0.86, C.woodLight, [0, 0, 0.3], [0, 0, Math.PI / 2], 12)) // a touch shorter than the box, so the end caps don't flicker against its sides
  for (const x of [-0.38, 0, 0.38]) p.push(cyl(0.31, 0.31, 0.07, BRASS, [x, 0, 0.3], [0, 0, Math.PI / 2], 12))
  return merge(p)
}

/** A red X on the sand where they searched and found nothing. */
function searchMark() {
  const p: THREE.BufferGeometry[] = []
  for (const r of [0.78, -0.78]) p.push(box([1.5, 0.05, 0.2], C.red, [0, 0.05, 0], [0, r, 0]))
  p.push(cyl(0.035, 0.04, 1.0, C.woodDark, [0.9, 0.5, -0.5], undefined, 5))
  p.push(box([0.02, 0.26, 0.4], C.red, [0.9, 0.85, -0.3]))
  return merge(p)
}

function reef(seed: number) {
  const p: THREE.BufferGeometry[] = []
  const tones = ['#f28a7a', '#f29ac0', '#ffb35c', '#b78ae0'].map(hex)
  let s = seed * 97 + 13
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  p.push(blob(0.5 + r() * 0.3, hex('#9aa0a8'), [0, 0.2, 0], 0.6, seed))
  for (let i = 0; i < 4; i++) {
    const x = (r() - 0.5) * 1.1, z = (r() - 0.5) * 1.1, c = tones[Math.floor(r() * tones.length)]
    for (let k = 0; k < 3; k++) p.push(cone(0.09, 0.5 + r() * 0.5, c, [x + (k - 1) * 0.13, 0.5 + k * 0.04, z], [0, 0, (k - 1) * 0.35], 6))
  }
  for (let i = 0; i < 4; i++) p.push(cyl(0.035, 0.06, 1.0 + r() * 0.8, hex('#5f9e3a'), [(r() - 0.5) * 1.4, 0.6, (r() - 0.5) * 1.4], [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.4], 5))
  return merge(p)
}

/** Diver without arms, lying along +Z (head first), centred on the chest. */
function diverBody() {
  const p: THREE.BufferGeometry[] = []
  p.push(ell(0.2, 0.16, 0.42, SUIT, [0, 0, 0], 10))
  p.push(sphere(0.17, SUIT, [0, 0.03, 0.5], 10))
  p.push(ell(0.13, 0.09, 0.05, hex('#9fd0e8'), [0, 0.01, 0.65], 8)) // mask glass
  p.push(torus(0.13, 0.025, SUIT_LIGHT, [0, 0.01, 0.63], undefined, Math.PI * 2, 10))
  p.push(cyl(0.1, 0.1, 0.5, SUIT_LIGHT, [0, 0.2, -0.02], [Math.PI / 2, 0, 0], 8)) // air tank
  p.push(cyl(0.02, 0.02, 0.36, C.ink, [0.07, 0.17, 0.36], [1.1, 0, 0], 4))
  return merge(p)
}

/** One arm, hanging from the shoulder at the origin, reaching forward (+Z). */
const diverArm = () => merge([cyl(0.05, 0.06, 0.5, SUIT, [0, 0, 0.25], [Math.PI / 2, 0, 0], 6), sphere(0.065, hex('#e8b88f'), [0, 0, 0.52], 6)])
/** One leg with its fin, from the hip at the origin, trailing back (-Z). */
const diverLeg = () => merge([cyl(0.07, 0.06, 0.5, SUIT, [0, 0, -0.25], [Math.PI / 2, 0, 0], 6), box([0.2, 0.03, 0.36], SUIT_LIGHT, [0, 0, -0.66])])

/** The whale, swimming along +Z, about 7 long. The tail is a separate piece so it can beat. */
function whaleBody() {
  const p: THREE.BufferGeometry[] = []
  p.push(ell(1.25, 1.1, 2.9, WHALE, [0, 0, 0], 18))
  p.push(ell(1.05, 0.7, 2.5, WHALE_BELLY, [0, -0.5, 0.25], 14))
  p.push(ell(0.75, 0.62, 1.5, WHALE, [0, 0.05, -2.9], 12))
  for (const s of [-1, 1]) {
    p.push(ell(0.9, 0.09, 0.42, WHALE, [s * 1.5, -0.55, 0.9], 8))
    p.push(sphere(0.09, C.ink, [s * 1.0, 0.1, 2.0], 6))
  }
  return merge(p)
}
const whaleTail = () => merge([ell(0.4, 0.3, 0.8, WHALE, [0, 0, -0.6], 8), ell(1.15, 0.08, 0.5, WHALE, [0, 0, -1.4], 10)])

/** Mosasaurus head and neck. The neck runs down -Y from the origin; the snout points +Z. */
function beastHead() {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.95, 1.25, 7, BEAST, [0, -3.6, -0.5], [0.1, 0, 0], 12))
  p.push(cyl(0.6, 0.8, 6.6, BEAST_BELLY, [0, -3.6, 0.05], [0.1, 0, 0], 8))
  p.push(ell(1.05, 0.7, 1.2, BEAST, [0, 0.1, 0], 12))
  p.push(ell(0.72, 0.36, 1.5, BEAST, [0, 0.22, 1.5], 12)) // upper jaw
  for (const s of [-1, 1]) {
    p.push(sphere(0.15, C.yellow, [s * 0.62, 0.42, 0.75], 8))
    p.push(sphere(0.07, C.ink, [s * 0.72, 0.42, 0.82], 6))
    for (let i = 0; i < 5; i++) p.push(cone(0.07, 0.24, C.white, [s * (0.56 - i * 0.07), -0.08, 0.9 + i * 0.4], [Math.PI, 0, 0], 4))
  }
  for (let i = 0; i < 5; i++) p.push(cone(0.16, 0.4, hex('#335848'), [0, 0.7 - i * 0.55, -0.75 - i * 0.07], [-0.6, 0, 0], 4)) // back ridge
  return merge(p)
}
/** Lower jaw, hinged at the origin, pointing +Z. */
function beastJaw() {
  const p: THREE.BufferGeometry[] = [ell(0.62, 0.24, 1.35, BEAST_BELLY, [0, -0.12, 1.25], 10)]
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) p.push(cone(0.06, 0.2, C.white, [s * (0.46 - i * 0.07), 0.12, 1.0 + i * 0.4], undefined, 4))
  return merge(p)
}

const ease = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

// the dive, in seconds: [arrive at, leave at] for base, three search spots, the whale wait, the chest
const LEG = [0, 4, 6, 10, 12, 16, 21.5, 25] // leave base 0-> spot1 4, look till 6 -> spot2 10, till 12 -> spot3 16, wait for the whale till 21.5 -> chest 25
const OPEN_AT = 25.6, BITE_AT = 27.6, LOOP = 32

export function SunkenGreed({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const g = useMemo(
    () => ({
      sand: groundPatch(def, SUNK.sand, 6.6, (rho, a) => (Math.sin(a * 7 + rho * 9) > 0.3 ? SAND_DARK : SAND)),
      base: baseDome(accent),
      empty: chest(true, false),
      treasure: chest(true, true),
      lid: lid(),
      mark: searchMark(),
      reefs: SUNK.reef.map((_, i) => reef(i + 2)),
      diver: diverBody(),
      arm: diverArm(),
      leg: diverLeg(),
      whale: whaleBody(),
      tail: whaleTail(),
      beast: beastHead(),
      jaw: beastJaw(),
    }),
    [def, accent],
  )
  const pts = useMemo(() => {
    const on = (q: [number, number], h = 0) => new THREE.Vector3(q[0], groundY(def, q[0], q[1]) + h, q[1])
    const doorway = on(SUNK.base, 1.0).add(new THREE.Vector3(Math.sin(FACE_YAW), 0, Math.cos(FACE_YAW)).multiplyScalar(3.4))
    const stops = [doorway, ...SUNK.spots.map((q) => on(q, 1.15)), on(SUNK.chest, 1.2)]
    // stop a little short of each target so the diver hovers beside it
    const chestAt = on(SUNK.chest)
    const centreXZ = on(SUNK.sand)
    return { stops, chestAt, beastAt: on(SUNK.beast), whaleCentre: new THREE.Vector3(centreXZ.x - Math.sin(FACE_YAW) * 6.5, centreXZ.y + 5.5, centreXZ.z - Math.cos(FACE_YAW) * 6.5) }
  }, [def])
  const bubbles = useMemo(() => Array.from({ length: simple ? 6 : 14 }, (_, i) => ({ x: SUNK.sand[0] + Math.sin(i * 2.4) * (1.5 + (i % 5)), z: SUNK.sand[1] + Math.cos(i * 1.7) * (1.5 + (i % 4)), speed: 0.5 + (i % 4) * 0.15, phase: i * 0.37 })), [simple])

  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const diver = useRef<THREE.Group>(null), armL = useRef<THREE.Mesh>(null), armR = useRef<THREE.Mesh>(null), legL = useRef<THREE.Mesh>(null), legR = useRef<THREE.Mesh>(null)
  const whale = useRef<THREE.Group>(null), tail = useRef<THREE.Mesh>(null), lidRef = useRef<THREE.Mesh>(null)
  const beast = useRef<THREE.Group>(null), jaw = useRef<THREE.Mesh>(null), bubbleRefs = useRef<(THREE.Mesh | null)[]>([])
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0 }), [])
  const beastYaw = useMemo(() => Math.atan2(pts.chestAt.x - pts.beastAt.x, pts.chestAt.z - pts.beastAt.z), [pts])

  useFrame((state) => {
    if (state.camera.position.distanceTo(centre) > 80) return
    const time = state.clock.elapsedTime, t = time % LOOP

    // ---- the diver swims leg by leg, hovering at each spot
    const d = diver.current
    if (d) {
      let k = 0, from = 0
      for (let i = 0; i < 4; i++) if (t >= LEG[i * 2]) { from = i; k = ease(LEG[i * 2], LEG[i * 2 + 1], t) }
      const A = pts.stops[from], B = pts.stops[from + 1]
      tmp.a.lerpVectors(A, B, k)
      const moving = k > 0.001 && k < 0.999
      if (moving) tmp.yaw = Math.atan2(B.x - A.x, B.z - A.z)
      const eaten = t > BITE_AT + 0.25
      d.visible = !eaten
      d.position.set(tmp.a.x, tmp.a.y + Math.sin(time * 1.4) * 0.1, tmp.a.z)
      d.rotation.y += (((tmp.yaw - d.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.08
      d.rotation.x = moving ? 0 : -0.5 // upright-ish while looking around
      // breaststroke: arms sweep out and back, legs kick in the gaps
      const stroke = moving ? (time * 2.6) % (Math.PI * 2) : Math.sin(time * 2) * 0.3 + 0.4
      const sweep = moving ? Math.max(0, Math.sin(stroke)) * 1.5 : stroke
      if (armL.current) armL.current.rotation.y = -sweep
      if (armR.current) armR.current.rotation.y = sweep
      const kick = moving ? Math.max(0, Math.sin(stroke + Math.PI)) * 0.5 : Math.sin(time * 3) * 0.12
      if (legL.current) legL.current.rotation.y = kick
      if (legR.current) legR.current.rotation.y = -kick
    }

    // ---- the whale drifts across the back of the island; it is over the path while the diver waits
    const w = whale.current
    if (w) {
      const a = ((t - 18.5) / LOOP) * Math.PI * 2 // crosses the middle at t = 18.5
      const side = Math.sin(a) * 15, back = (1 - Math.cos(a)) * 5.5
      const rx = Math.cos(FACE_YAW), rz = -Math.sin(FACE_YAW), bx = -Math.sin(FACE_YAW), bz = -Math.cos(FACE_YAW)
      w.position.set(pts.whaleCentre.x + rx * side + bx * (back - 5.5), pts.whaleCentre.y + Math.sin(time * 0.6) * 0.5, pts.whaleCentre.z + rz * side + bz * (back - 5.5))
      const vs = Math.cos(a) * 15, vb = Math.sin(a) * 5.5
      w.rotation.y = Math.atan2(rx * vs + bx * vb, rz * vs + bz * vb)
      w.rotation.z = Math.sin(time * 0.7) * 0.06
      if (tail.current) tail.current.rotation.x = Math.sin(time * 2.2) * 0.4
    }

    // ---- the chest opens, and greed is punished
    if (lidRef.current) lidRef.current.rotation.x = -ease(OPEN_AT, OPEN_AT + 0.7, t) * 1.9 + ease(LOOP - 1, LOOP - 0.2, t) * 1.9
    const b = beast.current
    if (b) {
      const up = ease(BITE_AT - 1.3, BITE_AT, t) - ease(BITE_AT + 1.2, BITE_AT + 3, t)
      b.visible = up > 0.01
      b.position.set(pts.beastAt.x, pts.chestAt.y - 9 + up * 10.2, pts.beastAt.z)
      b.rotation.set(up * 0.75, beastYaw, 0, 'YXZ') // lunges over the rim, towards the chest
      if (jaw.current) jaw.current.rotation.x = 0.85 * (1 - ease(BITE_AT - 0.1, BITE_AT + 0.25, t)) * ease(BITE_AT - 1.2, BITE_AT - 0.5, t) + 0.08
    }

    // ---- bubbles
    bubbleRefs.current.forEach((m, i) => {
      if (!m) return
      const bub = bubbles[i], f = (time * bub.speed * 0.25 + bub.phase) % 1
      m.position.set(bub.x + Math.sin(time * 2 + i) * 0.15, groundY(def, bub.x, bub.z) + f * 6, bub.z)
      m.scale.setScalar((0.5 + (i % 3) * 0.3) * Math.sin(f * Math.PI))
    })
  })

  const armMat = <meshLambertMaterial vertexColors />
  return (
    <>
      <mesh geometry={g.sand} receiveShadow renderOrder={1}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <At def={def} xz={SUNK.base} scale={1.25}>
        <Body g={g.base.body} />
        <Glow g={g.base.glow} night={night} day="#bfe6f2" />
        <mesh position={[0, 0.42, 0]} renderOrder={3}>
          <sphereGeometry args={[1.82, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color="#8fd8ec" transparent opacity={0.3} depthWrite={false} emissive="#1a6f80" emissiveIntensity={night ? 0.7 : 0.15} />
        </mesh>
        {night && <pointLight position={[0, 1.4, 0]} color="#7fe0f0" intensity={5} distance={7} />}
      </At>
      {SUNK.spots.map((xz, i) => (
        <At key={i} def={def} xz={xz} turn={i * 0.7 - 0.5}>
          <Body g={g.mark} />
          <group position={[-0.5, 0, -0.3]} rotation={[0, 0.5, 0]}>
            <Body g={g.empty.body} />
            <mesh geometry={g.lid} position={[0, 0.5, -0.3]} rotation={[-2.0, 0, 0]} castShadow>
              <meshLambertMaterial vertexColors />
            </mesh>
          </group>
        </At>
      ))}
      {SUNK.reef.map((xz, i) =>
        simple && i > 2 ? null : (
          <At key={i} def={def} xz={xz} turn={i} scale={1.1 + (i % 3) * 0.2}>
            <Body g={g.reefs[i]} />
          </At>
        ),
      )}
      {/* the treasure */}
      <At def={def} xz={SUNK.chest} scale={1.5} turn={-0.4}>
        <Body g={g.treasure.body} />
        {g.treasure.glow && <Glow g={g.treasure.glow} night={night} day="#f0dc9a" />}
        <mesh ref={lidRef} geometry={g.lid} position={[0, 0.5, -0.3]} castShadow>
          <meshLambertMaterial vertexColors />
        </mesh>
        {night && <pointLight position={[0, 1, 0.4]} color="#ffd75e" intensity={3} distance={4} />}
      </At>

      <group ref={diver} scale={1.5}>
        <Body g={g.diver} />
        <mesh ref={armL} geometry={g.arm} position={[-0.2, 0, 0.25]}>{armMat}</mesh>
        <mesh ref={armR} geometry={g.arm} position={[0.2, 0, 0.25]}>{armMat}</mesh>
        <mesh ref={legL} geometry={g.leg} position={[-0.09, 0, -0.36]}>{armMat}</mesh>
        <mesh ref={legR} geometry={g.leg} position={[0.09, 0, -0.36]}>{armMat}</mesh>
      </group>

      <group ref={whale}>
        <Body g={g.whale} />
        <mesh ref={tail} geometry={g.tail} position={[0, 0.05, -3.9]} castShadow>
          <meshLambertMaterial vertexColors />
        </mesh>
      </group>

      <group ref={beast} visible={false} scale={1.25}>
        <Body g={g.beast} />
        <mesh ref={jaw} geometry={g.jaw} position={[0, -0.1, 0.3]}>
          <meshLambertMaterial vertexColors />
        </mesh>
      </group>

      {bubbles.map((_, i) => (
        <mesh key={i} ref={(el) => void (bubbleRefs.current[i] = el)}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshBasicMaterial color="#e6f7ff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

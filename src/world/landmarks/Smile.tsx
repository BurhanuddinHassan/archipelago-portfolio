import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SMILE, groundY, type IslandDef } from '../layout'
import { At, Body, Glow, ell } from './Chrono'
import { groundPatch } from './ground'
import { MASK_TRIANGLES } from './maskData'
import { C, beam, blob, box, cone, cyl, hex, merge, paint, prism, sphere, torus } from './kit'

/**
 * Behind the Smile island: the game's idea as a little looping scene.
 * A town square where every villager wears the same smiling mask (the team's real mask model).
 * The angel (the player) flies to one villager and lifts his mask: he is terrified of a spider.
 * The angel deals with the spider, and the villager is happy for real. Then the loop starts again.
 */

type V3 = [number, number, number]

const MASK_YELLOW = hex('#e2b100')
const STONE = hex('#d9cfc0'), STONE_DARK = hex('#b8ac9a'), PLASTER = hex('#f3ead8')
const CLOTHES = ['#5d8fd6', '#c96a8a', '#6aa86a', '#d98a4a', '#8d74c9', '#4fa3a8'].map(hex)
const SKIN = hex('#e8b88f')

/** The real mask, painted. Height 1, facing +Z. */
function maskGeo() {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(MASK_TRIANGLES, 3))
  g.computeVertexNormals() // unshared corners, so it keeps the model's faceted look
  // the smile is painted on in the original texture; here it is a white arc on the model
  return merge([paint(g, MASK_YELLOW), torus(0.2, 0.028, C.white, [0, -0.13, 0.2], [0.25, 0, Math.PI + 0.35], Math.PI - 0.7, 12)])
}

/** A copy of the mask placed in a figure's own space. */
function maskAt(at: V3, scale: number, tilt = 0) {
  const g = maskGeo()
  g.scale(scale, scale, scale)
  if (tilt) g.rotateX(tilt)
  g.translate(...at)
  return g
}

const HEAD_Y = 0.98

/** A simple townsperson, 1.25 tall, facing +Z. */
function person(clothes: THREE.Color, masked: boolean) {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.2, 0.3, 0.62, clothes, [0, 0.43, 0], undefined, 10))
  p.push(sphere(0.2, clothes, [0, 0.72, 0], 10))
  for (const s of [-1, 1]) {
    p.push(cyl(0.065, 0.07, 0.4, clothes, [s * 0.27, 0.52, 0], [0, 0, s * 0.18], 6))
    p.push(sphere(0.07, SKIN, [s * 0.31, 0.32, 0], 6))
    p.push(box([0.13, 0.14, 0.2], hex('#4a3a30'), [s * 0.1, 0.07, 0.03]))
  }
  p.push(sphere(0.26, SKIN, [0, HEAD_Y, 0], 12))
  p.push(ell(0.27, 0.16, 0.27, hex('#3a2c22'), [0, HEAD_Y + 0.14, -0.03], 10)) // hair
  if (masked) p.push(maskAt([0, HEAD_Y - 0.02, 0.17], 0.5))
  return merge(p)
}

/** Face shown once the mask is off: wide eyes and an open mouth (scared) or a real smile (happy). */
function face(happy: boolean) {
  const p: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    p.push(sphere(happy ? 0.035 : 0.055, C.white, [s * 0.09, HEAD_Y + 0.03, 0.235], 8))
    p.push(sphere(happy ? 0.03 : 0.026, C.ink, [s * 0.09, HEAD_Y + 0.03, 0.26], 6))
    if (!happy) p.push(box([0.09, 0.02, 0.02], hex('#3a2c22'), [s * 0.09, HEAD_Y + 0.12, 0.24], [0, 0, s * 0.5])) // worried brows
    else p.push(sphere(0.035, hex('#f2a0a0'), [s * 0.15, HEAD_Y - 0.06, 0.2], 6)) // rosy cheeks
  }
  if (happy) p.push(torus(0.07, 0.016, C.ink, [0, HEAD_Y - 0.05, 0.245], [0, 0, Math.PI], Math.PI, 10))
  else p.push(ell(0.04, 0.055, 0.02, C.ink, [0, HEAD_Y - 0.09, 0.25], 8))
  return merge(p)
}

function house(roof: THREE.Color, flip: number) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([3.0, 0.24, 2.5], STONE_DARK, [0, 0.12, 0]))
  p.push(box([2.7, 1.9, 2.2], PLASTER, [0, 1.19, 0]))
  for (const x of [-1.32, 1.32]) for (const z of [-1.07, 1.07]) p.push(box([0.16, 1.9, 0.16], C.wood, [x, 1.19, z]))
  p.push(prism(2.2, 1.2, 2.9, roof, [0, 2.14, 0], [0, Math.PI / 2, 0]))
  p.push(box([3.0, 0.1, 2.5], roof.clone().multiplyScalar(0.82), [0, 2.16, 0]))
  p.push(box([0.4, 0.9, 0.4], STONE, [flip * 0.8, 2.9, -0.4]))
  p.push(box([0.74, 1.3, 0.08], C.woodDark, [flip * -0.55, 0.89, 1.11]))
  p.push(sphere(0.045, C.gold, [flip * -0.32, 0.9, 1.17], 6))
  p.push(box([0.72, 0.66, 0.07], C.woodDark, [flip * 0.6, 1.4, 1.11]))
  g.push(box([0.56, 0.5, 0.05], C.white, [flip * 0.6, 1.4, 1.14]))
  p.push(box([0.76, 0.14, 0.2], C.wood, [flip * 0.6, 1.0, 1.2]))
  ;[C.pink, C.yellow, C.leaf].forEach((c, i) => p.push(blob(0.1, c, [flip * 0.6 - 0.2 + i * 0.2, 1.12, 1.2], 0.8, i + 2)))
  // every door has the same smile hanging over it
  p.push(maskAt([flip * -0.55, 1.86, 1.16], 0.42))
  return { body: merge(p), glow: merge(g) }
}

/** Town gate: two pillars, an arch beam, low walls, and the big mask watching over the square. */
function gate(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    p.push(box([0.7, 3.0, 0.7], STONE, [s * 1.5, 1.5, 0]))
    p.push(box([0.86, 0.2, 0.86], STONE_DARK, [s * 1.5, 3.1, 0]))
    p.push(cone(0.5, 0.6, accent, [s * 1.5, 3.5, 0], [0, Math.PI / 4, 0], 4))
    p.push(box([2.6, 1.2, 0.4], STONE_DARK, [s * 3.1, 0.6, 0]))
    for (let i = 0; i < 4; i++) p.push(box([0.3, 0.22, 0.42], STONE, [s * (2.1 + i * 0.65), 1.3, 0]))
    p.push(box([0.06, 1.3, 0.5], accent, [s * 1.5, 2.2, 0.36])) // banners
  }
  p.push(box([3.7, 0.5, 0.6], STONE_DARK, [0, 3.0, 0]))
  p.push(maskAt([0, 4.0, 0.2], 1.9, 0.12))
  return merge(p)
}

function statue() {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(1.25, 1.35, 0.3, STONE_DARK, [0, 0.15, 0], undefined, 14))
  p.push(cyl(1.05, 1.05, 0.06, hex('#8fd8ec'), [0, 0.31, 0], undefined, 14)) // water
  p.push(cyl(0.34, 0.42, 0.9, STONE, [0, 0.7, 0], undefined, 8))
  // the angel, in stone
  p.push(cone(0.3, 0.8, STONE, [0, 1.55, 0], undefined, 10))
  p.push(sphere(0.18, STONE, [0, 2.05, 0], 10))
  for (const s of [-1, 1]) p.push(ell(0.3, 0.42, 0.06, STONE_DARK, [s * 0.34, 1.75, -0.12], 8))
  p.push(torus(0.16, 0.025, C.gold, [0, 2.32, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 12))
  return merge(p)
}

function lamp() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(cyl(0.11, 0.14, 0.14, STONE_DARK, [0, 0.07, 0], undefined, 8))
  p.push(cyl(0.045, 0.055, 2.5, C.ink, [0, 1.3, 0], undefined, 6))
  p.push(box([1.1, 0.05, 0.05], C.ink, [0.5, 2.52, 0]))
  p.push(box([0.22, 0.05, 0.22], C.ink, [0, 2.6, 0]))
  g.push(box([0.17, 0.26, 0.17], C.white, [0, 2.42, 0]))
  return { body: merge(p), glow: merge(g) }
}

function spider() {
  const p: THREE.BufferGeometry[] = []
  const dark = hex('#3a2a4a')
  p.push(sphere(0.2, dark, [0, 0, 0], 10))
  p.push(sphere(0.13, dark, [0, -0.02, 0.2], 8))
  for (const s of [-1, 1]) {
    p.push(sphere(0.035, C.red, [s * 0.05, 0.02, 0.31], 6))
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.4, knee = new THREE.Vector3(s * 0.32, 0.16, Math.sin(a) * 0.3)
      p.push(beam(new THREE.Vector3(s * 0.12, 0, Math.sin(a) * 0.1), knee, 0.03, 0.03, dark))
      p.push(beam(knee, new THREE.Vector3(s * 0.46, -0.22, Math.sin(a) * 0.42), 0.025, 0.025, dark))
    }
  }
  return merge(p)
}

function basket() {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.42, 0.32, 0.4, hex('#b98a52'), [0, 0.2, 0], undefined, 10))
  p.push(torus(0.42, 0.04, hex('#9a6f3c'), [0, 0.4, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 12))
  // masks already taken off
  p.push(maskAt([-0.1, 0.46, 0.02], 0.44, -1.2))
  p.push(maskAt([0.14, 0.52, -0.08], 0.44, -0.9))
  return merge(p)
}

function cart() {
  const p: THREE.BufferGeometry[] = []
  p.push(box([1.5, 0.5, 0.9], C.wood, [0, 0.75, 0]))
  for (const s of [-1, 1]) p.push(cyl(0.32, 0.32, 0.08, C.woodDark, [-0.4, 0.32, s * 0.5], [Math.PI / 2, 0, 0], 12))
  p.push(beam(new THREE.Vector3(0.75, 0.6, 0), new THREE.Vector3(1.4, 0.3, 0), 0.06, 0.06, C.woodDark))
  for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) p.push(box([0.05, 1.0, 0.05], C.woodDark, [x, 1.5, z]))
  for (let i = 0; i < 5; i++) p.push(box([0.31, 0.05, 1.0], i % 2 ? C.white : C.red, [-0.62 + i * 0.31, 2.02, 0], [0.12, 0, 0]))
  ;[C.pink, C.yellow, C.red, C.leaf, C.pink, C.yellow].forEach((c, i) => p.push(blob(0.17, c, [-0.55 + (i % 3) * 0.55, 1.08, -0.2 + Math.floor(i / 3) * 0.4], 0.8, i + 5)))
  return merge(p)
}

function angelBody() {
  const p: THREE.BufferGeometry[] = []
  p.push(cone(0.26, 0.62, C.white, [0, 0.31, 0], undefined, 10))
  p.push(sphere(0.17, SKIN, [0, 0.72, 0], 10))
  p.push(ell(0.18, 0.11, 0.18, hex('#f0d27a'), [0, 0.81, -0.02], 8))
  for (const s of [-1, 1]) p.push(sphere(0.022, C.ink, [s * 0.06, 0.73, 0.15], 6))
  return merge(p)
}

const lerp3 = (a: V3, b: V3, t: number, arc = 0): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * arc, a[2] + (b[2] - a[2]) * t]
const ease = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

const LOOP = 15

export function BehindTheSmile({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const g = useMemo(() => {
    const cobA = hex('#d6c9b4'), cobB = hex('#c4b59e')
    return {
      plaza: groundPatch(def, SMILE.plaza, 5.4, (rho, a) => ((Math.floor(rho * 5 + 0.01) + Math.floor((a / (Math.PI * 2)) * 28 + 0.01)) % 2 ? cobA : cobB)),
      gate: gate(accent),
      houses: [house(hex('#c9566f'), 1), house(hex('#7a6fc9'), -1)],
      statue: statue(),
      lamp: lamp(),
      spider: spider(),
      basket: basket(),
      cart: cart(),
      villagers: SMILE.villagers.map((_, i) => person(CLOTHES[i % CLOTHES.length], true)),
      hero: person(CLOTHES[5], false),
      mask: maskAt([0, 0, 0], 0.5),
      scared: face(false),
      happy: face(true),
      angel: angelBody(),
      wing: ell(0.2, 0.3, 0.04, C.white, [0.2, 0, 0], 8),
      halo: torus(0.14, 0.025, C.gold, undefined, [Math.PI / 2, 0, 0], Math.PI * 2, 12),
    }
  }, [def, accent])

  // key points of the scene, in island space
  const pts = useMemo(() => {
    const on = (q: [number, number], h = 0): V3 => [q[0], groundY(def, q[0], q[1]) + h, q[1]]
    const hero = on(SMILE.scared), lampBase = on(SMILE.lamp), basketAt = on(SMILE.basket, 0.75)
    // the lamp's arm points from the lamp towards the villager; the spider hangs from its end
    const dx = hero[0] - lampBase[0], dz = hero[2] - lampBase[2], len = Math.hypot(dx, dz)
    const armYaw = Math.atan2(-dz, dx)
    const spiderAt: V3 = [lampBase[0] + (dx / len) * 1.0, lampBase[1] + 1.55, lampBase[2] + (dz / len) * 1.0]
    const heroYaw = Math.atan2(spiderAt[0] - hero[0] + 0.9, spiderAt[2] - hero[2] + 1.2) // faces the camera, turned a little to the spider
    return {
      hero, heroYaw, lampBase, armYaw, spiderAt, basketAt,
      faceAt: [hero[0] + Math.sin(heroYaw) * 0.2, hero[1] + (HEAD_Y - 0.02) * 1.2, hero[2] + Math.cos(heroYaw) * 0.2] as V3,
      angelHome: [basketAt[0] + 0.9, basketAt[1] + 1.9, basketAt[2] - 0.6] as V3,
      angelHero: [hero[0] + 0.75, hero[1] + 1.75, hero[2] + 0.35] as V3,
      angelSpider: [spiderAt[0] + 0.7, spiderAt[1] + 0.35, spiderAt[2] + 0.3] as V3,
    }
  }, [def])

  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const hero = useRef<THREE.Group>(null), mask = useRef<THREE.Mesh>(null), scared = useRef<THREE.Mesh>(null), happy = useRef<THREE.Mesh>(null)
  const angel = useRef<THREE.Group>(null), wingL = useRef<THREE.Mesh>(null), wingR = useRef<THREE.Mesh>(null)
  const spiderRef = useRef<THREE.Group>(null), thread = useRef<THREE.Mesh>(null), spark = useRef<THREE.Mesh>(null), heart = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (state.camera.position.distanceTo(centre) > 80) return
    const time = state.clock.elapsedTime, t = time % LOOP
    const P = pts
    // ---- the angel: home -> villager -> spider -> home
    const a = angel.current
    if (a) {
      let p: V3 = P.angelHome
      if (t < 4.5) p = lerp3(P.angelHome, P.angelHero, ease(3, 4.5, t), 0.4)
      else if (t < 8.5) p = P.angelHero
      else if (t < 10) p = lerp3(P.angelHero, P.angelSpider, ease(8.5, 9.5, t), 0.3)
      else p = lerp3(P.angelSpider, P.angelHome, ease(10.5, 12.5, t), 0.5)
      a.position.set(p[0], p[1] + Math.sin(time * 2.2) * 0.08, p[2])
      const flap = Math.sin(time * 11) * 0.45
      if (wingL.current) wingL.current.rotation.y = Math.PI - 0.5 - flap
      if (wingR.current) wingR.current.rotation.y = 0.5 + flap
    }
    // ---- the mask: on his face, then lifted off into the basket
    const off = ease(4.5, 6, t)
    if (mask.current) {
      const p = lerp3(P.faceAt, P.basketAt, off, 0.9)
      mask.current.position.set(p[0], p[1], p[2])
      mask.current.rotation.set(-off * 1.1, P.heroYaw * (1 - off), off * 0.6)
      mask.current.scale.setScalar(1.2)
    }
    // ---- the villager: stiff -> scared and trembling -> happy and hopping
    const saved = t > 10
    if (scared.current) scared.current.visible = t > 4.6 && !saved
    if (happy.current) happy.current.visible = saved && t < 14.4
    if (hero.current) {
      const tremble = t > 4.8 && !saved ? Math.sin(time * 42) * 0.025 : 0
      const hop = saved && t < 14 ? Math.abs(Math.sin((t - 10) * 5.2)) * 0.28 : 0
      hero.current.position.set(P.hero[0] + tremble, P.hero[1] + hop, P.hero[2])
      hero.current.rotation.z = t > 4.8 && !saved ? -0.12 : 0 // leaning away from the spider
    }
    if (heart.current) {
      heart.current.visible = saved && t < 13.5
      heart.current.position.set(P.hero[0], P.hero[1] + 2.0 + (t - 10) * 0.18, P.hero[2])
      heart.current.rotation.y = time * 3
    }
    // ---- the spider: dangles, then gets sent away; it lowers itself back in for the next loop
    const gone = t > 9.6 ? 1 - ease(14, 14.9, t) : ease(9.3, 9.6, t)
    if (spiderRef.current) {
      const dangle = Math.sin(time * 1.6) * 0.14 + (t > 14 ? (1 - ease(14, 14.9, t)) * 0.8 : 0)
      spiderRef.current.position.set(P.spiderAt[0], P.spiderAt[1] + dangle, P.spiderAt[2])
      spiderRef.current.rotation.y = P.armYaw + Math.PI / 2 + Math.sin(time * 0.9) * 0.5
      spiderRef.current.scale.setScalar(Math.max(0.001, 1 - gone))
      if (thread.current) {
        const top = P.lampBase[1] + 2.5, len = Math.max(0.01, top - (P.spiderAt[1] + dangle) - 0.15)
        thread.current.visible = gone < 0.5
        thread.current.position.set(P.spiderAt[0], top - len / 2, P.spiderAt[2])
        thread.current.scale.set(1, len, 1)
      }
    }
    if (spark.current) {
      const k = 1 - Math.abs(t - 9.6) * 2.2
      spark.current.visible = k > 0
      spark.current.position.set(...P.spiderAt)
      spark.current.scale.setScalar(Math.max(0.01, k) * 1.3)
      spark.current.rotation.y = time * 6
    }
  })

  return (
    <>
      <mesh geometry={g.plaza} receiveShadow renderOrder={1}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <At def={def} xz={SMILE.gate} scale={1.15}>
        <Body g={g.gate} />
      </At>
      {SMILE.houses.map((xz, i) => (
        <At key={i} def={def} xz={xz} turn={i ? -0.45 : 0.45} scale={1.2}>
          <Body g={g.houses[i].body} />
          <Glow g={g.houses[i].glow} night={night} day="#cfe3ee" />
        </At>
      ))}
      <At def={def} xz={SMILE.statue} scale={1.15}>
        <Body g={g.statue} />
      </At>
      {SMILE.villagers.map((xz, i) =>
        simple && i > 2 ? null : (
          <At key={i} def={def} xz={xz} turn={[0.5, 0.25, -0.2, -0.55, -0.3][i]} scale={1.2}>
            <Body g={g.villagers[i]} />
          </At>
        ),
      )}
      {!simple && (
        <At def={def} xz={SMILE.cart} turn={-0.5}>
          <Body g={g.cart} />
        </At>
      )}
      <At def={def} xz={SMILE.basket} scale={1.2}>
        <Body g={g.basket} />
      </At>

      {/* ---- the looping scene ---- */}
      <group position={pts.lampBase} rotation={[0, pts.armYaw, 0]}>
        <Body g={g.lamp.body} />
        <Glow g={g.lamp.glow} night={night} day="#e9e2d2" />
      </group>
      <mesh ref={thread}>
        <cylinderGeometry args={[0.008, 0.008, 1, 4]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
      <group ref={spiderRef} scale={1.25}>
        <Body g={g.spider} />
      </group>
      <group ref={hero} rotation={[0, pts.heroYaw, 0]} scale={1.2}>
        <Body g={g.hero} />
        <mesh ref={scared} geometry={g.scared} visible={false}>
          <meshLambertMaterial vertexColors />
        </mesh>
        <mesh ref={happy} geometry={g.happy} visible={false}>
          <meshLambertMaterial vertexColors />
        </mesh>
      </group>
      <mesh ref={mask} geometry={g.mask} castShadow>
        <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <group ref={angel} rotation={[0, pts.heroYaw + 0.5, 0]} scale={1.15}>
        <Body g={g.angel} />
        <mesh ref={wingL} geometry={g.wing} position={[0, 0.5, -0.1]}>
          <meshLambertMaterial vertexColors side={THREE.DoubleSide} emissive="#ffffff" emissiveIntensity={0.25} />
        </mesh>
        <mesh ref={wingR} geometry={g.wing} position={[0, 0.5, -0.1]}>
          <meshLambertMaterial vertexColors side={THREE.DoubleSide} emissive="#ffffff" emissiveIntensity={0.25} />
        </mesh>
        <mesh geometry={g.halo} position={[0, 1.0, 0]}>
          <meshBasicMaterial color="#ffe27a" toneMapped={false} />
        </mesh>
        {night && <pointLight color="#fff0c0" intensity={3} distance={4} />}
      </group>
      <mesh ref={spark} visible={false}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshBasicMaterial color="#fff3b0" toneMapped={false} />
      </mesh>
      <mesh ref={heart} visible={false}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color="#ff7a9a" toneMapped={false} />
      </mesh>
    </>
  )
}

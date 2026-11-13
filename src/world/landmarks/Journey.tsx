import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_YAW, JOURNEY, groundY, type IslandDef } from '../layout'
import { At, Body, Glow } from './Chrono'
import { C, beam, blob, box, cone, cyl, hex, merge, prism, sphere, torus } from './kit'
import { Board, Fire, labelTex, pathRibbon } from './parts'

/**
 * Journey Isle: a footpath of milestones in the order they happened, each with a sign and a small object,
 * walked by a lantern. It ends at an empty camp with seats round the fire: "Next stop: your team".
 */

/** Which path point each milestone stands at (the others only steer the path). */
const AT = [0, 2, 4, 5, 6, 7, 8, 9]

/** One per stop on the path (content/journey.yaml, oldest first). */
const MILESTONES: { when: string; title: string; colour: string }[] = [
  { when: 'BEFORE 2023', title: 'O Levels & A Levels', colour: '#8C8C3A' },
  { when: '2023', title: 'NED University · BS CS', colour: '#F26B3A' },
  { when: 'OCT – DEC 2024', title: 'Graphic Design Intern', colour: '#C94F6D' },
  { when: '2026', title: 'Global Game Jam · 6th of 25', colour: '#E0A030' },
  { when: 'FEB – MAR 2026', title: 'IT Intern · KDA', colour: '#2F8F9D' },
  { when: '2026', title: 'CEGA · Unreal Engine', colour: '#7B61C9' },
  { when: 'MAY 2026', title: 'Freelance QA Tester', colour: '#5DA05A' },
  { when: '2026', title: 'Tech Lead · Gameverse', colour: '#3E6E8E' },
]

const PAPER = hex('#f6efe0')

type Piece = { body: THREE.BufferGeometry; glow?: THREE.BufferGeometry }

function books(): Piece {
  const p: THREE.BufferGeometry[] = []
  ;[[C.red, 0.1], [hex('#5d8fd6'), -0.15], [C.yellow, 0.2], [hex('#5fb37a'), 0]].forEach(([c, r], i) => p.push(box([0.8, 0.16, 0.56], c as THREE.Color, [0, 0.08 + i * 0.16, 0], [0, r as number, 0])))
  p.push(cyl(0.18, 0.2, 0.13, C.ink, [0, 0.7, 0], undefined, 10), box([0.6, 0.04, 0.6], C.ink, [0, 0.78, 0], [0, 0.5, 0]), cyl(0.014, 0.014, 0.28, C.yellow, [0.26, 0.66, 0.1], undefined, 4))
  return { body: merge(p) }
}

/** A university gate the path runs through (the opening is along Z). */
function gate(): Piece {
  const p: THREE.BufferGeometry[] = [], brick = hex('#b8684f'), trim = hex('#efe2c8')
  for (const x of [-1.25, 1.25]) p.push(box([0.6, 2.5, 0.6], brick, [x, 1.25, 0]), box([0.72, 0.16, 0.72], trim, [x, 2.56, 0]), box([0.72, 0.2, 0.72], trim, [x, 0.1, 0]), sphere(0.2, trim, [x, 2.82, 0], 8))
  p.push(box([3.1, 0.5, 0.5], brick, [0, 2.95, 0]), box([3.3, 0.12, 0.62], trim, [0, 3.25, 0]), prism(1.4, 0.5, 0.5, trim, [0, 3.3, 0]))
  return { body: merge(p) }
}

function easel(): Piece {
  const p: THREE.BufferGeometry[] = []
  for (const [x, z, r] of [[-0.35, 0.1, 0.12], [0.35, 0.1, -0.12]]) p.push(box([0.05, 1.6, 0.05], C.woodDark, [x, 0.8, z], [-0.12, 0, r]))
  p.push(box([0.05, 1.5, 0.05], C.woodDark, [0, 0.75, -0.3], [0.3, 0, 0]), box([0.9, 0.05, 0.1], C.woodDark, [0, 0.62, 0.14]))
  p.push(box([0.85, 0.65, 0.04], PAPER, [0, 1.0, 0.12], [-0.12, 0, 0]))
  ;[['#F26B3A', -0.2, 1.12, 0.26], ['#2F8F9D', 0.15, 1.0, 0.3], ['#ffd75e', -0.1, 0.86, 0.2]].forEach(([c, x, y, s]) => p.push(box([s as number, s as number, 0.02], hex(c as string), [x as number, y as number, 0.15 - ((y as number) - 1) * 0.12], [-0.12, 0, 0.2])))
  return { body: merge(p) }
}

function trophy(): Piece {
  const p = [box([0.9, 0.2, 0.9], C.stoneDark, [0, 0.1, 0]), box([0.66, 0.8, 0.66], C.stone, [0, 0.6, 0]), box([0.8, 0.1, 0.8], C.stoneDark, [0, 1.05, 0])]
  const g = [cyl(0.14, 0.2, 0.1, C.gold, [0, 1.15, 0], undefined, 10), cyl(0.04, 0.04, 0.22, C.gold, [0, 1.3, 0], undefined, 6), cyl(0.26, 0.12, 0.36, C.gold, [0, 1.58, 0], undefined, 12)]
  for (const s of [-1, 1]) g.push(torus(0.11, 0.025, C.gold, [s * 0.28, 1.6, 0], undefined, Math.PI * 2, 10))
  return { body: merge(p), glow: merge(g) }
}

/** Server racks: he observed the data centre at KDA. */
function servers(): Piece {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  for (const x of [-0.4, 0.4]) {
    p.push(box([0.66, 1.5, 0.6], hex('#3a3f4c'), [x, 0.75, 0]))
    for (let i = 0; i < 5; i++) {
      p.push(box([0.56, 0.2, 0.03], hex('#565c6e'), [x, 0.3 + i * 0.26, 0.3]))
      g.push(box([0.05, 0.05, 0.02], i % 2 ? hex('#7dffb0') : hex('#7de3ff'), [x - 0.2, 0.3 + i * 0.26, 0.32]), box([0.05, 0.05, 0.02], hex('#ffd75e'), [x - 0.1, 0.3 + i * 0.26, 0.32]))
    }
  }
  return { body: merge(p), glow: merge(g) }
}

/** Two framed certificates on stands. */
function certificates(): Piece {
  const p: THREE.BufferGeometry[] = []
  for (const [x, t] of [[-0.45, 0.2], [0.45, -0.2]]) {
    const piece = merge([box([0.05, 1.0, 0.05], C.woodDark, [0, 0.5, -0.1], [0.25, 0, 0]), box([0.74, 0.56, 0.05], C.gold, [0, 0.9, 0], [-0.15, 0, 0]), box([0.62, 0.44, 0.02], PAPER, [0, 0.9, 0.03], [-0.15, 0, 0]), cyl(0.07, 0.07, 0.02, C.red, [0.2, 0.78, 0.07], [Math.PI / 2 - 0.15, 0, 0], 8)])
    p.push(piece.rotateY(t).translate(x, 0, 0))
  }
  return { body: merge(p) }
}

/** A magnifying glass over a bug. */
function bugHunt(): Piece {
  const p = [box([0.9, 0.5, 0.7], C.woodLight, [0, 0.25, 0]), box([1.0, 0.06, 0.8], C.wood, [0, 0.53, 0])]
  p.push(sphere(0.1, hex('#b03a48'), [-0.1, 0.63, 0.05], 8), sphere(0.06, C.ink, [-0.1, 0.62, 0.17], 6))
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) p.push(box([0.14, 0.015, 0.015], C.ink, [-0.1 + s * 0.13, 0.59, -0.03 + i * 0.07], [0, 0, s * 0.4]))
  p.push(torus(0.22, 0.03, C.metal, [0.05, 0.95, 0.1], [-0.5, 0, 0]), cyl(0.03, 0.03, 0.4, C.woodDark, [0.3, 1.05, -0.02], [-0.5, 0, -0.9], 6))
  return { body: merge(p), glow: cyl(0.2, 0.2, 0.01, hex('#cfeeff'), [0.05, 0.95, 0.1], [Math.PI / 2 - 0.5, 0, 0], 12) }
}

function banner(accent: THREE.Color): Piece {
  const p = [cyl(0.05, 0.06, 2.6, C.woodDark, [0, 1.3, 0], undefined, 6), sphere(0.09, C.gold, [0, 2.65, 0], 6), box([0.9, 0.05, 0.05], C.woodDark, [0.4, 2.4, 0])]
  p.push(box([0.8, 1.1, 0.03], accent, [0.42, 1.82, 0]), prism(0.8, -0.3, 0.03, accent, [0.42, 1.27, 0]))
  p.push(box([0.3, 0.2, 0.04], C.white, [0.42, 2.0, 0.01]), box([0.1, 0.1, 0.05], C.white, [0.3, 1.7, 0.01]), box([0.1, 0.1, 0.05], C.white, [0.54, 1.7, 0.01])) // a little game controller
  return { body: merge(p) }
}

/** The camp at the end of the path: a tent, log seats round a fire, and a bare flagpole waiting for a flag. */
function camp(accent: THREE.Color): Piece {
  const p: THREE.BufferGeometry[] = []
  p.push(prism(2.0, 1.4, 2.0, accent, [-1.1, 0, -0.9], [0, 0.5, 0]), prism(0.7, 0.9, 0.04, C.ink, [-0.6, 0, -0.03], [0, 0.5, 0]))
  for (let i = 0; i < 6; i++) p.push(sphere(0.11, C.stoneDark, [0.9 + Math.cos(i) * 0.42, 0.06, 0.5 + Math.sin(i) * 0.42], 6))
  for (let i = 0; i < 3; i++) p.push(cyl(0.05, 0.05, 0.6, C.woodDark, [0.9, 0.12, 0.5], [0, (i * Math.PI) / 3, Math.PI / 2 - 0.25], 5))
  for (const [x, z, r] of [[0.9, 1.5, 0.1], [2.0, 0.7, 1.4], [1.9, -0.3, 2.2]]) p.push(cyl(0.17, 0.17, 0.9, C.wood, [x, 0.17, z], [0, r, Math.PI / 2], 8))
  p.push(cyl(0.04, 0.05, 3.0, C.woodDark, [-2.3, 1.5, 0.6], undefined, 6), sphere(0.07, C.gold, [-2.3, 3.03, 0.6], 6))
  return { body: merge(p) }
}

export function Journey({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const signs = useMemo(() => MILESTONES.map((m) => labelTex(m.when, m.title, m.colour)), [])
  const nedSign = useMemo(() => labelTex('', 'NED UNIVERSITY', '#b8684f', 512, 96), [])
  const nextSign = useMemo(() => labelTex('NEXT STOP', 'Your team', def.accent, 512, 200), [def.accent])

  const g = useMemo(() => {
    const path = pathRibbon(def, JOURNEY.path, 1.0, hex('#e4d3a6'), hex('#d8c594'), 80)
    const pieces: Piece[] = [books(), gate(), easel(), trophy(), servers(), certificates(), bugHunt(), banner(hex('#3E6E8E'))]
    // the gate straddles the path; everything else stands just behind its point on the path
    const t = new THREE.Vector3(JOURNEY.path[3][0] - JOURNEY.path[1][0], 0, JOURNEY.path[3][1] - JOURNEY.path[1][1]).normalize()
    return { path, pieces, camp: camp(accent), gateYaw: Math.atan2(t.x, t.z) }
  }, [def, accent])

  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const lantern = useRef<THREE.Group>(null), flag = useRef<THREE.Mesh>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    if (state.camera.position.distanceTo(centre) > 80) return
    const t = state.clock.elapsedTime
    // the lantern walks the path, pausing at each milestone
    const n = JOURNEY.path.length - 1, travel = (t / 2.2) % (n + 1.5), leg = Math.min(n - 1, Math.floor(travel)), k = Math.min(1, (travel - leg) * 1.6)
    const u = Math.min(1, (leg + k * k * (3 - 2 * k)) / n)
    if (lantern.current) {
      g.path.curve.getPointAt(travel > n ? 1 : u, tmp)
      lantern.current.position.set(tmp.x, groundY(def, tmp.x, tmp.z) + 0.75 + Math.sin(t * 3) * 0.06, tmp.z)
    }
    if (flag.current) flag.current.rotation.y = Math.sin(t * 2) * 0.25
  })

  return (
    <>
      <mesh geometry={g.path.geometry} receiveShadow renderOrder={1}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {AT.map((at, i) => {
        const xz = JOURNEY.path[at]
        if (i === 1)
          return (
            <group key={i}>
              <group position={[xz[0], groundY(def, xz[0], xz[1]), xz[1]]} rotation={[0, g.gateYaw, 0]} scale={1.05}>
                <Body g={g.pieces[1].body} />
              </group>
              <group position={[xz[0], groundY(def, xz[0], xz[1]) + 3.1, xz[1]]} rotation={[0, g.gateYaw, 0]} scale={1.05}>
                <group position={[0, 0, 0.26]}>
                  <Board tex={nedSign} w={2.4} h={0.45} y={0} posts={false} wood="#efe2c8" />
                </group>
              </group>
              <At def={def} xz={[xz[0] + Math.cos(FACE_YAW) * 3.1, xz[1] - Math.sin(FACE_YAW) * 3.1]} turn={-0.2}>
                <Board tex={signs[i]} w={2.2} h={0.76} y={1.45} />
              </At>
            </group>
          )
        // prop to the left of its sign, both set back from the path
        const back: [number, number] = [xz[0] - Math.sin(FACE_YAW) * 1.25, xz[1] - Math.cos(FACE_YAW) * 1.25]
        return (
          <At key={i} def={def} xz={back} turn={[0.3, 0, 0.2, 0.3, 0.15, 0, -0.25, 0.1][i]}>
            <group position={[-1.25, 0, 0.3]} scale={1.25}>
              <Body g={g.pieces[i].body} />
              {g.pieces[i].glow && <Glow g={g.pieces[i].glow!} night={night} day="#efe0b0" />}
            </group>
            <group position={[0.75, 0, 0]}>
              <Board tex={signs[i]} w={2.2} h={0.76} y={1.45} />
            </group>
          </At>
        )
      })}
      <At def={def} xz={JOURNEY.camp} turn={0.2} scale={1.15}>
        <Body g={g.camp.body} />
        <group position={[0.9, 0.05, 0.5]}>
          <Fire sparks={!simple} />
        </group>
        <mesh ref={flag} position={[-2.3, 2.7, 0.6]}>
          <boxGeometry args={[0.7, 0.42, 0.02]} />
          <meshLambertMaterial color="#f8f5ee" />
        </mesh>
        <group position={[0.4, 0, -1.3]}>
          <Board tex={nextSign} w={1.9} h={0.74} y={1.6} />
        </group>
        {night && <pointLight position={[0.9, 0.7, 0.5]} color="#ff9a4a" intensity={5} distance={7} />}
      </At>
      <group ref={lantern}>
        <mesh>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshBasicMaterial color="#fff0b8" toneMapped={false} />
        </mesh>
        {!simple && (
          <mesh>
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshBasicMaterial color="#ffd98a" transparent opacity={0.25} depthWrite={false} />
          </mesh>
        )}
        {night && <pointLight color="#ffd98a" intensity={4} distance={5} />}
      </group>
    </>
  )
}

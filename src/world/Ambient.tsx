import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ISLANDS, STOPS, mooringAnchor, stopAnchor } from './layout'
import { buildIsland, type Placement } from './islandGen'
import { C, box, cone, cyl, hex, merge, paint } from './landmarks/kit'

/**
 * Everything that makes the sky feel like a world: distant islands fading into the haze, small islets
 * between the main islands, clouds at island height and above, hot-air balloons and flocks of birds.
 * All of it is placed by a seeded generator that keeps clear of the islands, the flight paths and the camera.
 */

function rng(seed: number) {
  let s = seed % 2147483647
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const distToSegment = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(px - ax - dx * t, pz - az - dz * t)
}

/** True if a thing of radius r at (x, z) stays clear of every island, flight path and camera sight-line. */
function makeFree() {
  const moors = STOPS.map(mooringAnchor)
  const stands = STOPS.map(stopAnchor)
  return (x: number, z: number, r: number) => {
    for (const i of ISLANDS) if (Math.hypot(x - i.position[0], z - i.position[2]) < i.radius * 1.5 + r + 4) return false
    for (let k = 0; k < moors.length - 1; k++) if (distToSegment(x, z, moors[k][0], moors[k][2], moors[k + 1][0], moors[k + 1][2]) < r + 9) return false
    for (const s of stands) if (distToSegment(x, z, s[0], s[2], s[0] + 16, s[2] + 22) < r + 8) return false
    return true
  }
}

/* ---------------- Backdrop islands ---------------- */

export type Backdrop = { geometry: THREE.BufferGeometry; placements: Placement[] }

/** Far islands in a wide ring (they fade into the fog) plus small islets in the gaps between the main islands. */
export function buildBackdrop(mobile: boolean): Backdrop {
  const r = rng(4242)
  const free = makeFree()
  const parts: THREE.BufferGeometry[] = []
  const placements: Placement[] = []
  const add = (x: number, y: number, z: number, radius: number, seed: number, far: boolean) => {
    const flora = (['leafy', 'pine', 'mixed'] as const)[seed % 3]
    const isl = buildIsland({ radius, seed, top: 0.6, flora, density: far ? 0.45 : 0.8, segments: far ? 40 : 56, treesOnly: far })
    isl.geometry.translate(x, y, z)
    parts.push(isl.geometry)
    for (const p of isl.placements) placements.push({ ...p, x: p.x + x, y: p.y + y, z: p.z + z })
  }
  // far ring
  const farCount = mobile ? 9 : 16
  for (let i = 0; i < farCount; i++) {
    const a = (i / farCount) * Math.PI * 2 + r() * 0.3
    const d = 115 + r() * 75
    add(Math.cos(a) * d, -28 + r() * 60, Math.sin(a) * d - 8, 7 + r() * 15, 1000 + i * 37, true)
  }
  // islets in the gaps
  const want = mobile ? 5 : 10
  for (let tries = 0, n = 0; tries < 400 && n < want; tries++) {
    const x = (r() - 0.5) * 170, z = (r() - 0.5) * 160 - 8, radius = 2.4 + r() * 2.8
    if (!free(x, z, radius)) continue
    add(x, -9 + r() * 20, z, radius, 2000 + n * 53, false)
    n++
  }
  const geometry = mergeGeometries(parts, false)!
  geometry.computeBoundingSphere()
  return { geometry, placements }
}

/* ---------------- Clouds ---------------- */

function cloudGeometry() {
  const puffs: [number, number, number, number][] = [[-1.3, -0.1, 0, 0.9], [-0.4, 0.25, 0.1, 1.25], [0.6, 0.2, -0.1, 1.1], [1.5, -0.1, 0.1, 0.8], [0.1, -0.2, 0.5, 0.9], [-0.9, -0.25, -0.4, 0.7]]
  return mergeGeometries(
    puffs.map(([x, y, z, s]) => {
      const g = new THREE.IcosahedronGeometry(1, 2)
      g.scale(s, s * 0.78, s)
      g.translate(x, y, z)
      return g
    }),
    false,
  )!
}

type Cloud = { x: number; y: number; z: number; scale: number; drift: number; phase: number; rot: number }

/**
 * Clouds sit at island height (in the gaps), above the islands, and far off around the horizon.
 * One instanced mesh for all of them.
 */
export function Clouds({ count, night }: { count: number; night: boolean }) {
  const geo = useMemo(cloudGeometry, [])
  const clouds = useMemo(() => {
    const r = rng(77)
    const free = makeFree()
    const list: Cloud[] = []
    const level = Math.round(count * 0.4), high = Math.round(count * 0.25)
    for (let tries = 0; tries < 600 && list.length < level; tries++) {
      const x = (r() - 0.5) * 200, z = (r() - 0.5) * 180 - 8, scale = 3 + r() * 3.5
      if (!free(x, z, scale * 2.4)) continue
      list.push({ x, y: -8 + r() * 24, z, scale, drift: 0, phase: r() * 6.28, rot: r() * 6.28 })
    }
    for (let i = 0; i < high; i++) list.push({ x: (r() - 0.5) * 260, y: 44 + r() * 30, z: (r() - 0.5) * 240, scale: 5 + r() * 5, drift: 0.5 + r() * 0.6, phase: r() * 6.28, rot: r() * 6.28 })
    while (list.length < count) {
      const a = r() * Math.PI * 2, d = 130 + r() * 90
      list.push({ x: Math.cos(a) * d, y: -22 + r() * 70, z: Math.sin(a) * d, scale: 9 + r() * 11, drift: 0, phase: r() * 6.28, rot: r() * 6.28 })
    }
    return list
  }, [count])
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), [])
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    clouds.forEach((c, i) => {
      // level clouds sway gently in place; high clouds drift across and wrap around
      const x = c.drift ? ((c.x + t * c.drift + 130) % 260) - 130 : c.x + Math.sin(t * 0.07 + c.phase) * 2.5
      tmp.q.setFromAxisAngle(tmp.up, c.rot)
      tmp.m.compose(tmp.p.set(x, c.y + Math.sin(t * 0.11 + c.phase) * 0.6, c.z), tmp.q, tmp.s.set(c.scale, c.scale * 0.85, c.scale))
      mesh.setMatrixAt(i, tmp.m)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  const color = night ? '#3A4258' : '#F7F3EC'
  return (
    <instancedMesh ref={ref} args={[geo, undefined, clouds.length]} frustumCulled={false}>
      <meshLambertMaterial color={color} emissive={color} emissiveIntensity={night ? 0.05 : 0.32} />
    </instancedMesh>
  )
}

/* ---------------- Hot-air balloons ---------------- */

function balloonGeometry(a: THREE.Color, b: THREE.Color) {
  const env = new THREE.SphereGeometry(1.5, 14, 12).toNonIndexed()
  const p = env.attributes.position
  const arr = new Float32Array(p.count * 3)
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3
    const gore = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 14)
    const col = gore % 2 ? a : b
    for (let k = 0; k < 3; k++) arr.set([col.r, col.g, col.b], (t + k) * 3)
  }
  env.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  env.scale(1, 1.15, 1)
  env.translate(0, 3.2, 0)
  const parts = [env, cone(1.02, 1.3, a, [0, 1.55, 0], [Math.PI, 0, 0], 14), cyl(0.42, 0.42, 0.08, C.woodDark, [0, 0.98, 0], undefined, 12), box([0.62, 0.5, 0.62], C.woodLight, [0, 0.25, 0]), box([0.68, 0.08, 0.68], C.wood, [0, 0.5, 0])]
  for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) parts.push(cyl(0.012, 0.012, 0.55, C.ink, [x, 0.75, z], undefined, 4))
  return merge(parts)
}

const BALLOONS = [
  { a: '#F26B3A', b: '#f7efe1', radius: 92, angle: 0.6, y: 18, speed: 0.012 },
  { a: '#2F8F9D', b: '#ffd75e', radius: 104, angle: 2.9, y: 30, speed: -0.009 },
  { a: '#C94F6D', b: '#f7efe1', radius: 98, angle: 4.6, y: 9, speed: 0.01 },
]

export function Balloons({ night }: { night: boolean }) {
  const geos = useMemo(() => BALLOONS.map((b) => balloonGeometry(hex(b.a), hex(b.b))), [])
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current?.children.forEach((m, i) => {
      const b = BALLOONS[i], a = b.angle + t * b.speed
      m.position.set(Math.cos(a) * b.radius, b.y + Math.sin(t * 0.4 + i * 2) * 1.2, Math.sin(a) * b.radius - 8)
      m.rotation.y = t * 0.05 + i
    })
  })
  return (
    <group ref={group}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} scale={2.2}>
          <meshLambertMaterial vertexColors emissive="#ffb060" emissiveIntensity={night ? 0.35 : 0} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- Birds ---------------- */

function birdGeometry() {
  const v = [0, 0, 0.18, 0, 0, -0.14, -0.62, 0, -0.1, 0, 0, 0.18, 0.62, 0, -0.1, 0, 0, -0.14]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return paint(g, hex('#fbf7ee'))
}

/** Flocks circling above a few islands. One instanced mesh; the wing flap happens in the vertex shader. */
export function Birds({ flocks = 3 }: { flocks?: number }) {
  const geo = useMemo(birdGeometry, [])
  const PER = 5
  const data = useMemo(() => {
    const picks = [ISLANDS[0], ISLANDS[3], ISLANDS[7], ISLANDS[5]].slice(0, flocks)
    return picks.map((isl, i) => ({ cx: isl.position[0], cy: isl.position[1] + 15 + i * 2, cz: isl.position[2], radius: isl.radius + 7 + i * 2, speed: (i % 2 ? -1 : 1) * (0.16 + i * 0.03), phase: i * 2.1 }))
  }, [flocks])
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += abs(position.x) * sin(uTime * 9.0 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z) * 0.55;')
    }
    return m
  }, [uniforms])
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1.3, 1.3, 1.3) }), [])
  useEffect(() => () => material.dispose(), [material])
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    uniforms.uTime.value = t
    data.forEach((f, fi) => {
      for (let k = 0; k < PER; k++) {
        // V formation: the leader in front, the others trailing behind on alternating sides
        const row = Math.ceil(k / 2), side = k % 2 ? 1 : -1
        const a = f.phase + t * f.speed - Math.sign(f.speed) * row * (1.3 / f.radius)
        const rad = f.radius + (k ? side * row * 0.9 : 0)
        tmp.p.set(f.cx + Math.cos(a) * rad, f.cy + Math.sin(t * 0.5 + fi + k) * 0.5, f.cz + Math.sin(a) * rad)
        tmp.e.set(0, -a + (f.speed > 0 ? Math.PI : 0), Math.sign(f.speed) * 0.25)
        tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s)
        mesh.setMatrixAt(fi * PER + k, tmp.m)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, material, data.length * PER]} frustumCulled={false} />
}

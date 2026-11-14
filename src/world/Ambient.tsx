import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ISLANDS, ISLAND_TOP, STOPS, groundY, mooringAnchor, stopAnchor, waterfallSpot, type IslandDef } from './layout'
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

export type Backdrop = { geometry: THREE.BufferGeometry; placements: Placement[]; islets: [number, number, number, number][] }

/** Far islands in a wide ring (they fade into the fog) plus small islets in the gaps between the main islands. */
export function buildBackdrop(mobile: boolean): Backdrop {
  const r = rng(4242)
  const free = makeFree()
  const parts: THREE.BufferGeometry[] = []
  const placements: Placement[] = []
  const islets: [number, number, number, number][] = []
  const add = (x: number, y: number, z: number, radius: number, seed: number, far: boolean) => {
    islets.push([x, y, z, radius])
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
  return { geometry, placements, islets }
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

/* ---------------- Waterfalls ---------------- */

const FALL_LENGTH = 17

/**
 * Pond, stream and falling sheet as ONE mesh with one shader, so the water keeps the same colour and
 * the same moving streaks from the pond, along the stream, over the rim and down.
 * Per vertex: data = (across 0..1, distance along the flow, fall 0..1 down the sheet, edge 0 centre..1 bank).
 */
function waterGeometry(def: IslandDef, fall: NonNullable<ReturnType<typeof waterfallSpot>>) {
  const dir = new THREE.Vector2(Math.cos(fall.t), Math.sin(fall.t)), side = new THREE.Vector2(-dir.y, dir.x)
  const pos: number[] = [], data: number[] = [], idx: number[] = []
  const W = 0.75, r0 = Math.hypot(...fall.pond) + 1.25, streamLen = fall.lip - r0 // the stream starts at the pond's edge
  const rowAt = (cx: number, y: number, cz: number, half: number, along: number, f: number) => {
    const base = pos.length / 3
    for (const [k, across] of [[-1, 0], [0, 0.5], [1, 1]]) {
      pos.push(cx + side.x * half * k, y, cz + side.y * half * k)
      data.push(across, along, f, Math.abs(k))
    }
    return base
  }
  const stitch = (a: number, b: number) => {
    for (let k = 0; k < 2; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1)
  }
  // stream on the grass, from the pond to the rim
  const N = 8
  let prev = -1
  for (let i = 0; i <= N; i++) {
    const r = r0 + (streamLen * i) / N, cx = dir.x * r, cz = dir.y * r
    const y = (i === N ? ISLAND_TOP - 0.02 : groundY(def, cx, cz)) + 0.07
    const row = rowAt(cx, y, cz, W, (streamLen * i) / N, 0)
    if (prev >= 0) stitch(prev, row)
    prev = row
  }
  // the sheet: bends outwards over the rim, then drops and widens
  const M = 28
  for (let j = 1; j <= M; j++) {
    const v = j / M, out = fall.lip + 0.9 * (1 - Math.exp(-v * 7))
    const row = rowAt(dir.x * out, ISLAND_TOP + 0.05 - FALL_LENGTH * Math.pow(v, 1.15), dir.y * out, W * (1 + v * 0.5), streamLen + FALL_LENGTH * v, v)
    stitch(prev, row)
    prev = row
  }
  // pond: a fan around the start of the stream
  const c = pos.length / 3, py = groundY(def, fall.pond[0], fall.pond[1]) + 0.07
  pos.push(fall.pond[0], py, fall.pond[1])
  data.push(0.5, 0, 0, 0)
  for (let k = 0; k <= 22; k++) {
    const a = (k / 22) * Math.PI * 2, wob = 1 + Math.sin(a * 3 + def.radius) * 0.12
    pos.push(fall.pond[0] + Math.cos(a) * 1.6 * wob, py, fall.pond[1] + Math.sin(a) * 1.35 * wob)
    data.push(0.5 + Math.cos(a) * 0.5, Math.sin(a) * 1.3, 0, 1)
    if (k < 22) idx.push(c, c + 2 + k, c + 1 + k)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('data', new THREE.Float32BufferAttribute(data, 4))
  g.setIndex(idx)
  return g
}

export function Waterfalls({ night }: { night: boolean }) {
  const falls = useMemo(
    () =>
      ISLANDS.flatMap((def) => {
        const fall = waterfallSpot(def)
        return fall ? [{ def, geometry: waterGeometry(def, fall) }] : []
      }),
    [],
  )
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uDim: { value: 1 } }), [])
  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime
    uniforms.uDim.value = night ? 0.3 : 1
  })
  return (
    <>
      {falls.map(({ def, geometry }) => (
        <mesh key={def.id} geometry={geometry} position={def.position} renderOrder={2}>
          <shaderMaterial
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-2}
            uniforms={uniforms}
            vertexShader={'attribute vec4 data; varying vec4 vData; void main(){ vData = data; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'}
            fragmentShader={[
              'uniform float uTime; uniform float uDim; varying vec4 vData;',
              'void main() {',
              '  float across = vData.x, along = vData.y, fall = vData.z, edge = vData.w;',
              '  float streak = sin(across * 24.0 + sin(along * 0.7 - uTime * 1.6) * 1.5) * 0.5 + 0.5;',
              '  float flow = sin(along * 2.2 - uTime * 5.0 + across * 5.0) * 0.5 + 0.5;',
              '  float drop = smoothstep(0.0, 0.22, fall);', // 0 on the grass, 1 once the water is falling
              '  float white = (streak * 0.6 + flow * 0.25) * mix(0.06, 1.0, drop);', // calm on the grass, white water once it falls
              '  vec3 col = mix(vec3(0.45, 0.78, 0.9), vec3(1.0), white);',
                            '  float sheet = (1.0 - smoothstep(0.62, 1.0, edge)) * (0.6 + streak * 0.35);',
              '  float calm = 1.0 - smoothstep(0.86, 1.0, edge);', // (not named "flat": that is a reserved word in GLSL) pond and stream are opaque with soft banks, so where they overlap they read as one
              '  float alpha = mix(calm, sheet, drop) * (1.0 - smoothstep(0.4, 1.0, fall));',
              '  gl_FragColor = vec4(col * uDim, alpha);',
              '  #include <colorspace_fragment>',
              '}',
            ].join('\n')}
          />
        </mesh>
      ))}
    </>
  )
}

/* ---------------- Soft shadows ---------------- */

const SHADOW_SIZE: Record<string, number> = { tree_a: 1.5, tree_b: 1.3, tree_c: 1.4, pine: 1.0, pine_b: 1.1, birch: 1.0, bush: 0.75, bush_berries: 0.75, rock: 0.55, rock_moss: 0.55, rock_moss_b: 0.6, stump: 0.5, log: 0.7 }

export function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.75)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** A soft dark blob on the grass under every tree, bush and rock: one instanced mesh, no shadow maps. */
export function BlobShadows({ placements, night }: { placements: Placement[]; night: boolean }) {
  const list = useMemo(() => placements.filter((p) => SHADOW_SIZE[p.kind]), [placements])
  const tex = useMemo(shadowTexture, [])
  const geo = useMemo(() => new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    list.forEach((p, i) => {
      const s = SHADOW_SIZE[p.kind] * p.scale
      // nudged away from the sun so the blob reads as a cast shadow
      m.makeScale(s * 1.25, 1, s).setPosition(p.x + 0.45 * s, p.y + 0.13, p.z - 0.25 * s)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [list])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, list.length]} frustumCulled={false} renderOrder={1}>
      <meshBasicMaterial color="#12300f" alphaMap={tex} transparent opacity={night ? 0.2 : 0.3} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
    </instancedMesh>
  )
}

/* ---------------- Night sky ---------------- */

/** Stars and a moon, far away on the sky dome (night only). */
export function NightSky() {
  const stars = useMemo(() => {
    const r = rng(909), pos: number[] = []
    for (let i = 0; i < 1300; i++) {
      const a = r() * Math.PI * 2, y = -0.3 + r() * 1.3, h = Math.sqrt(1 - y * y)
      pos.push(Math.cos(a) * h * 320, y * 320, Math.sin(a) * h * 320)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [])
  const moonAt: [number, number, number] = [-190, 48, -230]
  return (
    <>
      <points geometry={stars} frustumCulled={false}>
        <pointsMaterial color="#fff6e0" size={2.6} sizeAttenuation={false} transparent opacity={0.85} fog={false} depthWrite={false} />
      </points>
      <mesh position={moonAt}>
        <sphereGeometry args={[13, 24, 16]} />
        <meshBasicMaterial color="#fff3d4" fog={false} />
      </mesh>
      <mesh position={moonAt}>
        <sphereGeometry args={[21, 24, 16]} />
        <meshBasicMaterial color="#cfd8ff" fog={false} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </>
  )
}

/** Fireflies drifting just above the grass of every main island (night only). */
export function Fireflies({ perIsland = 16 }: { perIsland?: number }) {
  const geo = useMemo(() => {
    const r = rng(31337), pos: number[] = [], seed: number[] = []
    for (const def of ISLANDS)
      for (let i = 0; i < perIsland; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * def.radius * 0.8
        const x = Math.cos(a) * d, z = Math.sin(a) * d
        pos.push(def.position[0] + x, def.position[1] + groundY(def, x, z) + 0.5 + r() * 2.4, def.position[2] + z)
        seed.push(r() * 100)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1))
    return g
  }, [perIsland])
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((s) => (uniforms.uTime.value = s.clock.elapsedTime))
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={[
          'attribute float seed; uniform float uTime; varying float vGlow;',
          'void main() {',
          '  vec3 p = position + vec3(sin(uTime * 0.6 + seed), sin(uTime * 0.9 + seed * 1.7) * 0.5, cos(uTime * 0.5 + seed * 2.3)) * 0.7;',
          '  vGlow = 0.35 + 0.65 * (sin(uTime * 2.0 + seed * 5.0) * 0.5 + 0.5);',
          '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
          '  gl_PointSize = clamp(260.0 / -mv.z, 3.0, 16.0);',
          '  gl_Position = projectionMatrix * mv;',
          '}',
        ].join('\n')}
        fragmentShader={[
          'varying float vGlow;',
          'void main() {',
          '  float d = length(gl_PointCoord - 0.5);',
          '  gl_FragColor = vec4(vec3(1.0, 0.92, 0.45), pow(smoothstep(0.5, 0.0, d), 1.6) * vGlow * 1.4);',
          '}',
        ].join('\n')}
      />
    </points>
  )
}

/* ---------------- Wind streaks ---------------- */

/** Thin white ribbons of wind that curl once and sweep through the gaps between islands. One mesh, one shader. */
export function WindStreaks({ count = 12 }: { count?: number }) {
  const geo = useMemo(() => {
    const r = rng(555), free = makeFree()
    const pos: number[] = [], data: number[] = [], idx: number[] = []
    const N = 48
    for (let tries = 0, n = 0; tries < 500 && n < count; tries++) {
      const x0 = (r() - 0.5) * 210, z0 = (r() - 0.5) * 190 - 8
      if (!free(x0, z0, 7)) continue
      const y0 = -4 + r() * 26, yaw = (r() - 0.5) * 0.9, len = 22 + r() * 16, loopAt = 0.3 + r() * 0.3, loopR = 1.2 + r() * 1.2
      const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), sideV = new THREE.Vector3(-dir.z, 0.9, dir.x).normalize().multiplyScalar(0.09)
      const base = pos.length / 3, phase = r()
      for (let i = 0; i <= N; i++) {
        const s = i / N
        const th = Math.min(1, Math.max(0, (s - loopAt) / 0.22)) * Math.PI * 2 // one curl partway along
        const along = (s - 0.5) * len - Math.sin(th) * loopR, up = Math.sin(s * Math.PI * 2) * 1.2 + (1 - Math.cos(th)) * loopR
        const cx = x0 + dir.x * along, cy = y0 + up, cz = z0 + dir.z * along
        pos.push(cx - sideV.x, cy - sideV.y, cz - sideV.z, cx + sideV.x, cy + sideV.y, cz + sideV.z)
        data.push(s, phase, s, phase)
        if (i < N) idx.push(base + i * 2, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2)
      }
      n++
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('data', new THREE.Float32BufferAttribute(data, 2))
    g.setIndex(idx)
    return g
  }, [count])
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((s) => (uniforms.uTime.value = s.clock.elapsedTime))
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        uniforms={uniforms}
        vertexShader={'attribute vec2 data; varying vec2 vData; void main(){ vData = data; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'}
        fragmentShader={[
          'uniform float uTime; varying vec2 vData;',
          'void main() {',
          // a bright head runs along the ribbon with a fading tail, then the ribbon rests before the next gust
          '  float head = fract(uTime * 0.09 + vData.y) * 2.4 - 0.2;',
          '  float d = head - vData.x;',
          '  float a = smoothstep(0.0, 0.03, d) * (1.0 - smoothstep(0.03, 0.4, d));',
          '  gl_FragColor = vec4(1.0, 1.0, 1.0, a * 0.75);',
          '}',
        ].join('\n')}
      />
    </mesh>
  )
}

/* ---------------- Butterflies ---------------- */

const BUTTERFLY_COLOURS = ['#f29ac0', '#ffd75e', '#8fd8ec', '#F26B3A', '#ffffff']

/** Butterflies fluttering around flower patches on the main islands. One instanced mesh; wings flap in the shader. */
export function Butterflies({ placements }: { placements: Placement[] }) {
  const spots = useMemo(() => {
    const near = (p: Placement) => ISLANDS.some((i) => Math.hypot(p.x - i.position[0], p.z - i.position[2]) < i.radius)
    return placements.filter((p) => p.kind === 'flowers' && near(p)).filter((_, k) => k % 6 === 0).slice(0, 40)
  }, [placements])
  const geo = useMemo(() => {
    const v = [0, 0, 0.07, 0, 0, -0.07, -0.16, 0, -0.02, 0, 0, 0.07, 0.16, 0, -0.02, 0, 0, -0.07]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    g.computeVertexNormals()
    return g
  }, [])
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += abs(position.x) * sin(uTime * 16.0 + instanceMatrix[3].x * 3.0 + instanceMatrix[3].z) * 0.9;')
    }
    return m
  }, [uniforms])
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), [])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new THREE.Color()
    spots.forEach((_, i) => mesh.setColorAt(i, c.set(BUTTERFLY_COLOURS[i % BUTTERFLY_COLOURS.length])))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [spots])
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    uniforms.uTime.value = t
    spots.forEach((p, i) => {
      // a lazy figure-of-eight around the flower patch
      const a = t * 0.5 + i * 1.7
      tmp.p.set(p.x + Math.sin(a) * 0.9, p.y + 0.8 + Math.sin(t * 1.3 + i) * 0.25, p.z + Math.sin(a * 2) * 0.45)
      tmp.e.set(0, Math.atan2(Math.cos(a) * 0.9, Math.cos(a * 2) * 0.9), 0)
      tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s)
      mesh.setMatrixAt(i, tmp.m)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  if (!spots.length) return null
  return <instancedMesh ref={ref} args={[geo, material, spots.length]} frustumCulled={false} />
}

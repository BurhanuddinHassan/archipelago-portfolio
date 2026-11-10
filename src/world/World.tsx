import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, PerformanceMonitor, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  ISLANDS, ISLAND_TOP, MOOR_DIR, STOPS, WORLD_SCALE, clearSpots, groundY, islandById, islandSeed,
  landmarkSpots, mooringAnchor, stopAnchor, type IslandDef,
} from './layout'
import { buildIsland, type Placement, type PropKind } from './islandGen'
import { SEAT, SkyShip } from './SkyShip'
import { HomeLandmarks } from './landmarks/Home'
import { IslandLandmark } from './landmarks/Islands'
import { Balloons, Birds, BlobShadows, Butterflies, Clouds, Fireflies, NightSky, Waterfalls, WindStreaks, buildBackdrop, shadowTexture } from './Ambient'
import { makeIslandMaterial } from './islandMaterial'
import { useStore } from '../store'

const PALETTE = {
  day: { top: '#79b4e0', horizon: '#f4e2cf', hemiSky: '#fff4e6', hemiGround: '#d8c6ae', sun: 2.4, sunColor: '#ffe3c2', hemi: 1.2 },
  night: { top: '#121a2e', horizon: '#3b3552', hemiSky: '#8aa0d0', hemiGround: '#3a3648', sun: 0.35, sunColor: '#b8c8ff', hemi: 0.75 },
}

/** Must match --panel-w in styles.css: clamp(440px, 44vw, 760px). */
export const panelWidth = (w: number) => Math.min(760, Math.max(440, w * 0.44))

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches

const DRACO_PATH = '/draco/'
const PROPS_URL = '/models/props.glb'

type WorldPlacement = Placement & { x: number; y: number; z: number }

export default function World() {
  const theme = useStore((s) => s.theme)
  const mobile = useMemo(isMobile, [])
  const c = PALETTE[theme]
  // Start at a safe resolution and let the FPS monitor raise or lower it for this device.
  const [dpr, setDpr] = useState(mobile ? 1.25 : 1.5)
  const maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2)
  // Graphics setting (button in the top bar, remembered): low = always lite, high = always full detail at full
  // resolution, auto = measured. Lite drops the extras: rock shader detail, waterfalls, shadows, balloons, birds,
  // wind, fireflies, butterflies. In auto it switches on only under sustained heavy lag and switches back off
  // when the device keeps up again (see AutoWatch).
  const graphics = useStore((s) => s.graphics)
  const [autoLite, setAutoLite] = useState(false)
  const lite = graphics === 'low' || (graphics === 'auto' && autoLite)
  const liveDpr = graphics === 'high' ? maxDpr : graphics === 'low' ? Math.min(1, maxDpr) : dpr
  useEffect(() => {
    try {
      localStorage.removeItem('lite') // an earlier build remembered lite mode too eagerly
    } catch {
      /* private mode */
    }
  }, [])
  // Islands are generated once: body geometry per island + prop placements for the instancer.
  const islands = useMemo(
    () =>
      ISLANDS.map((def) => ({
        def,
        ...buildIsland({ radius: def.radius, seed: islandSeed(def.id), top: ISLAND_TOP, keepClear: clearSpots(def), flora: def.flora, density: mobile ? 0.6 : 1 }),
      })),
    [mobile],
  )
  const backdrop = useMemo(() => buildBackdrop(mobile), [mobile])
  const islandMaterial = useMemo(() => (lite ? new THREE.MeshLambertMaterial({ vertexColors: true }) : makeIslandMaterial()), [lite])
  // Plants are drawn per island (so off-screen islands are skipped entirely), plus one group for the backdrop.
  const groups = useMemo<PropGroupDef[]>(
    () => [
      ...islands.map(({ def, placements }) => ({
        id: def.id,
        centre: def.position,
        list: placements
          // phones skip half the smallest undergrowth: many instances, little visual gain at that size
          .filter((p, k) => !mobile || !SMALL.has(p.kind) || k % 2 === 0)
          .map((p) => ({ ...p, x: p.x + def.position[0], y: p.y + def.position[1], z: p.z + def.position[2] })),
      })),
      // far islands and gap islets: trees, bushes and rocks only
      { id: 'backdrop', centre: null, list: backdrop.placements.filter((p) => !SMALL.has(p.kind)) },
    ],
    [islands, backdrop, mobile],
  )
  const placements = useMemo(() => groups.flatMap((g) => g.list), [groups])
  const activeIsland = useStore((s) => STOPS[s.activeStop]?.island ?? 'home')
  const activeList = useMemo(() => groups.find((g) => g.id === activeIsland)?.list ?? [], [groups, activeIsland])
  // Shadows exist only on the island the Pilot is on. Laptops/desktops get real cast shadows (trees, buildings,
  // the Pilot, the ship); phones get cheap soft blobs; lite mode gets none.
  const realShadows = !lite && !mobile
  return (
    <Canvas
      dpr={liveDpr}
      shadows
      camera={{ fov: mobile ? 50 : 38, near: 0.1, far: 420, position: [10, 7, 12] }}
      gl={{ antialias: !mobile, powerPreference: 'high-performance' }}
    >
      {graphics === 'auto' && (
        <>
          {/* resolution steps down below 30 fps and back up above 50 fps */}
          <PerformanceMonitor
            bounds={() => [30, 50]}
            onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
            onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
            flipflops={4}
            onFallback={() => setDpr(1)}
          />
          <AutoWatch lite={autoLite} atFloor={dpr <= 0.75} setLite={setAutoLite} />
        </>
      )}
      <SkyDome top={c.top} horizon={c.horizon} />
      <fog attach="fog" args={[c.horizon, 70, 240]} />
      <hemisphereLight args={[c.hemiSky, c.hemiGround, c.hemi]} />
      <Sun intensity={c.sun} color={c.sunColor} island={activeIsland} shadows={realShadows} />
      {islands.map(({ def, geometry }) => (
        <Island key={def.id} def={def} geometry={geometry} material={islandMaterial} night={theme === 'night'} labels={!mobile} />
      ))}
      <mesh geometry={backdrop.geometry} material={islandMaterial} frustumCulled={false} />
      {!lite && (
        <>
          {mobile && <BlobShadows placements={activeList} night={theme === 'night'} />}
          <Waterfalls night={theme === 'night'} />
          <Balloons night={theme === 'night'} />
          <Birds flocks={mobile ? 2 : 4} />
          <WindStreaks count={mobile ? 7 : 12} />
          {theme === 'night' && <Fireflies perIsland={mobile ? 10 : 16} />}
          <Butterflies placements={placements} />
        </>
      )}
      {theme === 'night' && <NightSky />}
      <ModelGuard fallback={null}>
        <Suspense fallback={null}>
          <Props groups={groups} sway={!lite} shadowIsland={realShadows ? activeIsland : null} />
        </Suspense>
      </ModelGuard>
      <Clouds count={lite ? 16 : mobile ? 26 : 56} night={theme === 'night'} />
      <PilotRig night={theme === 'night'} blobShadow={!realShadows} />
      <ViewOffset />
    </Canvas>
  )
}

/**
 * Auto graphics: measures the real frame rate once a second (ignoring loading and background tabs).
 * - Full -> lite: under 22 fps for 5 seconds in a row while already at the lowest resolution.
 * - Lite -> full: above 48 fps for 10 seconds in a row. Allowed twice per visit, so a device that can't
 *   hold full detail settles in lite instead of flipping back and forth.
 */
function AutoWatch({ lite, atFloor, setLite }: { lite: boolean; atFloor: boolean; setLite: (v: boolean) => void }) {
  const w = useRef({ frames: 0, time: 0, streak: 0, recoveries: 0 })
  useEffect(() => {
    w.current.streak = 0
  }, [lite])
  useFrame((state, dt) => {
    if (state.clock.elapsedTime < 8 || dt > 0.25 || document.hidden) return
    const s = w.current
    s.frames++
    s.time += dt
    if (s.time < 1) return
    const fps = s.frames / s.time
    s.frames = 0
    s.time = 0
    if (!lite) {
      s.streak = fps < 22 && atFloor ? s.streak + 1 : 0
      if (s.streak >= 5) setLite(true)
    } else if (s.recoveries < 2) {
      s.streak = fps > 48 ? s.streak + 1 : 0
      if (s.streak >= 10) {
        s.recoveries++
        setLite(false)
      }
    }
  })
  return null
}

/**
 * The canvas fills the whole window (so islands show through the see-through text panel),
 * but on desktop the Pilot should sit in the middle of the space right of the panel.
 * Shifting the camera's view offset moves the picture right by half the panel width.
 */
function ViewOffset() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    if (size.width <= 820) {
      // Phone: text cards cover the lower half, so lift the picture and keep the Pilot in the top third.
      cam.setViewOffset(size.width, size.height, 0, size.height * 0.2, size.width, size.height)
    } else {
      const panel = panelWidth(size.width)
      cam.setViewOffset(size.width, size.height, -panel / 2, 0, size.width, size.height)
    }
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

/* ---------------- Islands ---------------- */

function Island({ def, geometry, material, night, labels }: { def: IslandDef; geometry: THREE.BufferGeometry; material: THREE.Material; night: boolean; labels: boolean }) {
  const desktop = labels
  return (
    <group position={def.position}>
      <mesh geometry={geometry} material={material} receiveShadow />
      {def.id === 'home' ? <HomeLandmarks def={def} night={night} interactive={desktop} /> : <IslandLandmark def={def} night={night} />}
      {labels && <IslandLabel def={def} />}
    </group>
  )
}

/** The sun. Its shadow map covers only the island the Pilot is on, so the shadow pass stays small. */
function Sun({ intensity, color, island, shadows }: { intensity: number; color: string; island: string; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    const l = light.current
    if (!l) return
    const def = islandById(island)
    const reach = def.radius * 1.25 + 3
    l.target.position.set(...def.position)
    // the sun sits high on the camera's left, so shadows stretch across the grass to the right, in plain view
    l.position.set(def.position[0] - 44, def.position[1] + 60, def.position[2] + 28)
    l.target.updateMatrixWorld()
    const cam = l.shadow.camera
    cam.left = -reach
    cam.right = reach
    cam.top = reach
    cam.bottom = -reach
    cam.near = 20
    cam.far = 130
    cam.updateProjectionMatrix()
  }, [island])
  return (
    <directionalLight ref={light} intensity={intensity} color={color} castShadow={shadows} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04} shadow-radius={5} />
  )
}

type PropGroupDef = { id: string; centre: [number, number, number] | null; list: WorldPlacement[] }

/** Undergrowth: only drawn on islands near the camera. */
const SMALL = new Set<PropKind>(['flowers', 'plant', 'fern'])
const SMALL_RANGE = 62

/**
 * Trees, bushes, rocks and flowers: CC0 Quaternius "Ultimate Nature" models, restyled into props.glb
 * (warmer greens, sandstone rocks, smooth shading). Instanced per island and prop type, sharing one material.
 */
function Props({ groups, sway, shadowIsland }: { groups: PropGroupDef[]; sway: boolean; shadowIsland: string | null }) {
  const { nodes } = useGLTF(PROPS_URL, DRACO_PATH) as unknown as { nodes: Record<string, THREE.Mesh> }
  // Wind: every plant leans back and forth, more the higher up the vertex is (done in the vertex shader).
  const wind = useMemo(() => ({ uTime: { value: 0 } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true })
    if (sway)
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = wind.uTime
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
float swayH = max(transformed.y, 0.0);
float swayP = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
transformed.x += sin(uTime * 1.3 + swayP) * swayH * swayH * 0.012;
transformed.z += cos(uTime * 1.05 + swayP * 1.4) * swayH * swayH * 0.008;`,
          )
      }
    return m
  }, [sway, wind])
  useFrame((s) => (wind.uTime.value = s.clock.elapsedTime))
  return (
    <>
      {groups.map((g) => (
        <PropGroup key={g.id} group={g} nodes={nodes} material={material} cast={g.id === shadowIsland} />
      ))}
    </>
  )
}

function PropGroup({ group, nodes, material, cast }: { group: PropGroupDef; nodes: Record<string, THREE.Mesh>; material: THREE.Material; cast: boolean }) {
  const byKind = useMemo(() => {
    const m = new Map<PropKind, WorldPlacement[]>()
    for (const p of group.list) {
      if (!nodes[p.kind]) continue
      if (!m.has(p.kind)) m.set(p.kind, [])
      m.get(p.kind)!.push(p)
    }
    return [...m.entries()]
  }, [group, nodes])
  const small = useRef<THREE.Group>(null)
  const tick = useRef(0)
  const centre = useMemo(() => (group.centre ? new THREE.Vector3(...group.centre) : null), [group])
  useFrame(({ camera }) => {
    if (!small.current || !centre || tick.current++ % 15) return
    small.current.visible = camera.position.distanceTo(centre) < SMALL_RANGE
  })
  const render = (pick: (k: PropKind) => boolean, shadows: boolean) =>
    byKind.filter(([k]) => pick(k)).map(([kind, list]) => <PropInstances key={kind} geometry={nodes[kind].geometry} material={material} list={list} cast={shadows} />)
  return (
    <>
      {render((k) => !SMALL.has(k), cast)}
      <group ref={small}>{render((k) => SMALL.has(k), false)}</group>
    </>
  )
}

function PropInstances({ geometry, material, list, cast }: { geometry: THREE.BufferGeometry; material: THREE.Material; list: WorldPlacement[]; cast: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
    const col = new THREE.Color()
    list.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot)
      m.compose(p.set(it.x, it.y, it.z), q, s.setScalar(it.scale))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, col.setScalar(it.tint))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // a correct bounding sphere lets the renderer skip this whole batch when its island is off screen
    mesh.computeBoundingSphere()
  }, [list])
  // The material is a prop, not a constructor argument: when it changes (graphics mode switch) the mesh is kept,
  // so the instances keep their positions instead of all collapsing to the world origin.
  return <instancedMesh ref={ref} args={[geometry, undefined, list.length]} material={material} castShadow={cast} />
}
useGLTF.preload(PROPS_URL, DRACO_PATH)

/** Big inverted sphere with a vertical gradient: soft pastel sky by day, deep blue by night. */
function SkyDome({ top, horizon }: { top: string; horizon: string }) {
  const uniforms = useMemo(() => ({ top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    uniforms.top.value.set(top)
    uniforms.horizon.value.set(horizon)
  }, [top, horizon, uniforms])
  return (
    <mesh scale={340} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={[
          'uniform vec3 top;',
          'uniform vec3 horizon;',
          'varying vec3 vPos;',
          'void main() {',
          '  float h = clamp(normalize(vPos).y * 2.0 + 0.4, 0.0, 1.0);',
          '  gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 1.0, h)), 1.0);',
          '  #include <colorspace_fragment>',
          '}',
        ].join('\n')}
      />
    </mesh>
  )
}

function IslandLabel({ def }: { def: IslandDef }) {
  const active = useStore((s) => STOPS[s.activeStop]?.island === def.id)
  const el = useRef<HTMLDivElement>(null)
  // Hidden during the opening close-up (labels of far islands would float over the portrait).
  useFrame(() => {
    if (!el.current) return
    const show = !active && window.scrollY > window.innerHeight * 0.3
    el.current.style.visibility = show ? 'visible' : 'hidden'
  })
  // Keep the Html mounted and hide it: unmounting drei Html mid-frame throws a removeChild error.
  return (
    <Html position={[0, ISLAND_TOP + def.radius * 0.1 + 7, 0]} center zIndexRange={[10, 0]}>
      <div ref={el} className="island-label" style={{ borderColor: def.accent, visibility: 'hidden' }}>{def.name}</div>
    </Html>
  )
}

/* ---------------- Pilot, sky-ship and camera driven by scroll ---------------- */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerpAngle = (a: number, b: number, k: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * k
}

const CAM_DESKTOP = new THREE.Vector3(12, 8.5, 16.5)
const CAM_MOBILE = new THREE.Vector3(14, 11, 21)
/** Ship moored side-on to the camera, bow pointing to screen-right. */
const MOOR_YAW = Math.atan2(MOOR_DIR[0], MOOR_DIR[1])
/** Share of each flight spent hopping aboard, and hopping off. */
const HOP = 0.14

export type PilotPose = 'ground' | 'board' | 'sail' | 'land'

function PilotRig({ night, blobShadow }: { night: boolean; blobShadow: boolean }) {
  const stands = useMemo(() => STOPS.map((s) => new THREE.Vector3(...stopAnchor(s))), [])
  const moors = useMemo(() => STOPS.map((s) => new THREE.Vector3(...mooringAnchor(s))), [])
  const pilot = useRef<THREE.Group>(null)
  const ship = useRef<THREE.Group>(null)
  const propRef = useRef<THREE.Group>(null)
  const sailRef = useRef<THREE.Mesh>(null)
  const lanternRef = useRef<THREE.MeshBasicMaterial>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const shadowTex = useMemo(shadowTexture, [])
  const { camera, gl } = useThree()
  const orbit = useLookAround(gl.domElement)
  const sph = useMemo(() => new THREE.Spherical(), [])
  const camTarget = useRef(new THREE.Vector3())
  const tmp = useMemo(
    () => ({ pos: new THREE.Vector3(), shipPos: new THREE.Vector3(), seat: new THREE.Vector3(), look: new THREE.Vector3(), off: new THREE.Vector3() }),
    [],
  )
  const first = useRef(true)
  const pose = useRef<PilotPose>('ground')
  // The site opens on a close-up portrait of the Pilot, then pulls back to the travel framing as you start scrolling.
  // ?closeup in the URL keeps the close-up the whole way (handy for checking the model).
  const cam = useMemo(() => {
    const far = isMobile() ? CAM_MOBILE : CAM_DESKTOP
    const near = far.clone().multiplyScalar(0.24)
    near.y = 1.1
    return { far, near, offset: new THREE.Vector3(), hold: new URLSearchParams(window.location.search).has('closeup') }
  }, [])

  useFrame((state, dt) => {
    const time = state.clock.elapsedTime
    const p = useStore.getState().progress
    const last = stands.length - 1
    const i = Math.min(last, Math.max(0, Math.floor(p)))
    const t = i >= last ? 0 : smooth(0.45, 1, p - i)
    const j = Math.min(last, i + 1)
    const A = stands[i], B = stands[j], MA = moors[i], MB = moors[j]
    const sh = ship.current, pl = pilot.current
    if (!sh || !pl) return

    const faceCam = Math.atan2(camera.position.x - pl.position.x, camera.position.z - pl.position.z)
    const bob = Math.sin(time * 1.3) * 0.08
    const roll = Math.sin(time * 0.9) * 0.03

    // ---- ship: moored beside the stop, or sailing an arc to the next mooring
    let sailing = false
    let shipYaw = MOOR_YAW
    let pitch = 0
    if (t > 0 && t >= HOP && t <= 1 - HOP) {
      sailing = true
      const u = smooth(0, 1, (t - HOP) / (1 - 2 * HOP))
      const dist = MA.distanceTo(MB)
      tmp.shipPos.lerpVectors(MA, MB, u)
      tmp.shipPos.y += Math.sin(Math.PI * u) * (3 + dist * 0.1)
      const travelYaw = Math.atan2(MB.x - MA.x, MB.z - MA.z)
      const turn = smooth(0, 0.15, u) * (1 - smooth(0.85, 1, u))
      shipYaw = lerpAngle(MOOR_YAW, travelYaw, turn)
      pitch = -Math.cos(Math.PI * u) * 0.12 * turn
    } else {
      tmp.shipPos.copy(t > 1 - HOP ? MB : MA)
    }
    sh.position.set(tmp.shipPos.x, tmp.shipPos.y + bob, tmp.shipPos.z)
    sh.rotation.set(pitch, shipYaw, roll, 'YXZ')
    sh.updateMatrixWorld()
    tmp.seat.copy(SEAT).applyMatrix4(sh.matrixWorld)

    // ---- Pilot: stand, hop aboard, sit while sailing, hop off
    if (t <= 0) {
      pose.current = 'ground'
      tmp.pos.copy(A)
      pl.rotation.set(0, faceCam, 0)
    } else if (t < HOP) {
      pose.current = 'board'
      const k = smooth(0, 1, t / HOP)
      tmp.pos.lerpVectors(A, tmp.seat, k)
      tmp.pos.y += Math.sin(Math.PI * k) * 1.0
      pl.rotation.set(0, lerpAngle(faceCam, shipYaw, k), 0)
    } else if (sailing) {
      pose.current = 'sail'
      tmp.pos.copy(tmp.seat)
      pl.quaternion.copy(sh.quaternion)
    } else {
      pose.current = 'land'
      const k = smooth(0, 1, (t - (1 - HOP)) / HOP)
      tmp.pos.lerpVectors(tmp.seat, B, k)
      tmp.pos.y += Math.sin(Math.PI * k) * 1.0
      pl.rotation.set(0, lerpAngle(shipYaw, faceCam, k), 0)
    }
    pl.position.copy(tmp.pos)
    if (shadow.current) shadow.current.visible = blobShadow && pose.current === 'ground'
    if (!pilotLoaded && pose.current === 'ground') pl.position.y += Math.sin(time * 2) * 0.03

    // ---- ship details
    if (propRef.current) propRef.current.rotation.z += dt * (sailing ? 22 : 2.5)
    if (sailRef.current) sailRef.current.scale.z = 1 + Math.sin(time * 2.2) * (sailing ? 0.18 : 0.08)
    if (lanternRef.current) lanternRef.current.color.set(night ? '#ffd27a' : '#f3d9a4')

    // ---- camera follows the Pilot with damping; drag rotates the follow offset, then drifts back
    const o = orbit.current
    if (!o.dragging && (time - o.lastInput > 2.5 || sailing)) {
      const ease = 1 - Math.exp(-dt * 2)
      o.yaw += (0 - o.yaw) * ease
      o.pitch += (0 - o.pitch) * ease
    }
    // pulled back over the first third of a screen of scrolling, and always before the first hop aboard
    const pull = cam.hold ? 0 : i > 0 ? 1 : Math.max(smooth(0, window.innerHeight * 0.35, window.scrollY), smooth(0.3, 0.44, p))
    cam.offset.lerpVectors(cam.near, cam.far, pull)
    sph.setFromVector3(cam.offset)
    sph.theta += o.yaw
    sph.phi = Math.min(1.35, Math.max(0.35, sph.phi + o.pitch))
    const desired = tmp.look.copy(tmp.pos).add(tmp.off.setFromSpherical(sph))
    const k = first.current ? 1 : 1 - Math.exp(-dt * 3.5)
    camera.position.lerp(desired, k)
    camTarget.current.lerp(tmp.pos, k)
    camera.lookAt(camTarget.current.x, camTarget.current.y + 1.05 - 0.1 * pull, camTarget.current.z)
    first.current = false
  })

  return (
    <>
      <group ref={pilot}>
        <mesh ref={shadow} position={[-0.12, 0.04, -0.08]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <circleGeometry args={[0.75, 16]} />
          <meshBasicMaterial color="#12300f" alphaMap={shadowTex} transparent opacity={0.38} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
        {/* night fill light in front of the Pilot, so his face isn't lost against lit windows */}
        {night && <pointLight position={[0, 2.8, 2.4]} color="#ffe2b8" intensity={4.5} distance={5.5} decay={2} />}
        <ModelGuard fallback={<PilotPlaceholder />}>
          <Suspense fallback={<PilotPlaceholder />}>
            <PilotModel pose={pose} />
          </Suspense>
        </ModelGuard>
      </group>
      <group ref={ship}>
        <SkyShip propRef={propRef} sailRef={sailRef} lanternRef={lanternRef} night={night} />
      </group>
    </>
  )
}

/**
 * Desktop-only look-around: drag on the 3D view to orbit the camera around the Pilot.
 * The mouse wheel is left alone so it keeps scrolling the tour. Touch is ignored so phones scroll normally.
 */
function useLookAround(el: HTMLElement) {
  const orbit = useRef({ yaw: 0, pitch: 0, dragging: false, lastInput: -10, x: 0, y: 0 })
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    const o = orbit.current
    el.style.cursor = 'grab'
    el.style.touchAction = 'pan-y'
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      o.dragging = true
      o.x = e.clientX
      o.y = e.clientY
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!o.dragging) return
      o.yaw -= (e.clientX - o.x) * 0.006
      o.pitch -= (e.clientY - o.y) * 0.004
      o.yaw = Math.max(-2.2, Math.min(2.2, o.yaw))
      o.pitch = Math.max(-0.6, Math.min(0.5, o.pitch))
      o.x = e.clientX
      o.y = e.clientY
      o.lastInput = clock.elapsedTime
    }
    const up = (e: PointerEvent) => {
      if (!o.dragging) return
      o.dragging = false
      o.lastInput = clock.elapsedTime
      el.releasePointerCapture?.(e.pointerId)
      el.style.cursor = 'grab'
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [el, clock])
  return orbit
}

const PILOT_URL = '/models/chibi_character.glb'
const PILOT_HEIGHT = 1.8 // world units; the GLB is 1.2 tall
const FADE = 0.35

let pilotLoaded = false

/**
 * Burhanuddin's rigged character. Clips in the GLB: Idle, Idle_CheckWatch, Walk, Wave, Sit, Cheer.
 * On an island: Idle, with an occasional watch check. Hopping aboard and sailing: Sit on the ship's bench.
 * Hopping off: Idle, then one Wave on landing. Walk and Cheer are kept for Adventure Mode.
 */
function PilotModel({ pose }: { pose: React.MutableRefObject<PilotPose> }) {
  const { scene, animations } = useGLTF(PILOT_URL, DRACO_PATH)
  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, group)
  const state = useRef({ current: '' as string, lastPose: 'ground' as PilotPose, nextFidget: 9, greetAt: -1 })

  useEffect(() => {
    pilotLoaded = true
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.frustumCulled = false
      m.castShadow = true
      // (The texture atlas was re-packed with 8 px padding around every UV island by tools/rebake-character.mjs,
      // so normal mipmapping no longer bleeds skin colour into the hair.)
    })
    for (const name of ['Wave', 'Idle_CheckWatch']) {
      const a = actions[name]
      if (a) {
        a.setLoop(THREE.LoopOnce, 1)
        a.clampWhenFinished = true
      }
    }
  }, [scene, actions])

  const play = (name: string) => {
    const st = state.current
    const next = actions[name]
    if (!next || st.current === name) return
    const prev = st.current ? actions[st.current] : null
    next.reset().setEffectiveWeight(1).fadeIn(FADE).play()
    if (prev) prev.fadeOut(FADE)
    st.current = name
  }

  useFrame((s) => {
    const st = state.current
    const p = pose.current
    const time = s.clock.elapsedTime
    if (!st.current) {
      play('Idle')
      st.greetAt = time + 0.8 // once he's on screen, say hello
    }
    if (st.greetAt > 0 && time >= st.greetAt) {
      st.greetAt = -1
      if (p === 'ground') {
        const wave = actions.Wave
        if (wave) {
          wave.setLoop(THREE.LoopOnce, 1)
          wave.clampWhenFinished = true
        }
        play('Wave')
        st.nextFidget = time + 12 + Math.random() * 6
      }
    }
    if (p !== st.lastPose) {
      if (p === 'board' || p === 'sail') play('Sit')
      else if (p === 'land') play('Idle')
      else play(st.lastPose === 'land' ? 'Wave' : 'Idle') // just stepped off the ship: wave hello
      st.lastPose = p
      st.nextFidget = time + 10 + Math.random() * 6
      return
    }
    if (p !== 'ground') return
    const a = actions[st.current]
    // one-shot clips hand back to Idle just before they end
    if ((st.current === 'Wave' || st.current === 'Idle_CheckWatch') && a && a.time >= a.getClip().duration - FADE) play('Idle')
    if (st.current === 'Idle' && time > st.nextFidget) {
      play('Idle_CheckWatch')
      st.nextFidget = time + 12 + Math.random() * 8
    }
  })

  return (
    <group ref={group} scale={PILOT_HEIGHT / 1.2}>
      <primitive object={scene} />
    </group>
  )
}
useGLTF.preload(PILOT_URL, DRACO_PATH)

/** If a model file fails to load (missing, renamed, bad network), show the fallback instead of crashing the whole scene. */
class ModelGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('A model failed to load; showing the fallback.', err)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Simple stand-in shown while the character loads, or if it fails to load. */
function PilotPlaceholder() {
  return (
    <group scale={0.9}>
      <mesh position={[-0.14, 0.3, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.6, 6]} />
        <meshLambertMaterial color="#3B5A8C" flatShading />
      </mesh>
      <mesh position={[0.14, 0.3, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.6, 6]} />
        <meshLambertMaterial color="#3B5A8C" flatShading />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.38]} />
        <meshLambertMaterial color="#1F1F22" flatShading />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <icosahedronGeometry args={[0.45, 1]} />
        <meshLambertMaterial color="#A86F4C" flatShading />
      </mesh>
      <mesh position={[0, 1.78, -0.05]} scale={[1.05, 0.75, 1.05]}>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshLambertMaterial color="#17161A" flatShading />
      </mesh>
    </group>
  )
}

export { islandById }

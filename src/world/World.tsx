import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { ISLANDS, ISLAND_TOP, STOPS, islandById, stopAnchor, type IslandDef } from './layout'
import { useStore } from '../store'

const PALETTE = {
  day: { sky: '#A9C4CC', grass: '#8DB36B', rock: '#6B5E55', hemiSky: '#ffffff', hemiGround: '#c9b9a8', sun: 2.0, hemi: 1.6 },
  night: { sky: '#1C2333', grass: '#4F6B45', rock: '#3E3833', hemiSky: '#8aa0d0', hemiGround: '#4a4658', sun: 0.4, hemi: 0.9 },
}

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches

export default function World() {
  const theme = useStore((s) => s.theme)
  const mobile = useMemo(isMobile, [])
  const c = PALETTE[theme]
  // Start at a safe resolution and let the FPS monitor raise or lower it for this device.
  const [dpr, setDpr] = useState(mobile ? 1.25 : 1.5)
  const maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2)
  return (
    <Canvas
      dpr={dpr}
      camera={{ fov: mobile ? 50 : 38, near: 0.1, far: 220, position: [10, 7, 12] }}
      gl={{ antialias: !mobile, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
        onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
        flipflops={3}
        onFallback={() => setDpr(0.75)}
      />
      <color attach="background" args={[c.sky]} />
      <fog attach="fog" args={[c.sky, 30, 95]} />
      <hemisphereLight args={[c.hemiSky, c.hemiGround, c.hemi]} />
      <directionalLight position={[12, 20, 8]} intensity={c.sun} />
      {ISLANDS.map((i) => (
        <Island key={i.id} def={i} grass={c.grass} rock={c.rock} night={theme === 'night'} labels={!mobile} />
      ))}
      <Clouds count={mobile ? 6 : 16} night={theme === 'night'} />
      <PilotRig />
      <ViewOffset />
    </Canvas>
  )
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
      const panel = Math.min(600, Math.max(380, size.width * 0.4))
      cam.setViewOffset(size.width, size.height, -panel / 2, 0, size.width, size.height)
    }
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

/* ---------------- Islands (grey-box placeholders) ---------------- */

function Island({ def, grass, rock, night, labels }: { def: IslandDef; grass: string; rock: string; night: boolean; labels: boolean }) {
  const r = def.radius
  return (
    <group position={def.position}>
      <mesh position={[0, ISLAND_TOP / 2, 0]}>
        <cylinderGeometry args={[r, r * 0.92, ISLAND_TOP, 9]} />
        <meshLambertMaterial color={grass} flatShading />
      </mesh>
      <mesh position={[0, -r * 0.6, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[r * 0.92, r * 1.2, 7]} />
        <meshLambertMaterial color={rock} flatShading />
      </mesh>
      <Landmark def={def} night={night} />
      {labels && <IslandLabel def={def} />}
    </group>
  )
}

function IslandLabel({ def }: { def: IslandDef }) {
  const active = useStore((s) => STOPS[s.activeStop]?.island === def.id)
  // Keep the Html mounted and hide it: unmounting drei Html mid-frame throws a removeChild error.
  return (
    <Html position={[0, ISLAND_TOP + 3.6, 0]} center zIndexRange={[10, 0]}>
      <div className="island-label" style={{ borderColor: def.accent, visibility: active ? 'hidden' : 'visible' }}>{def.name}</div>
    </Html>
  )
}

/** One accent-coloured block per island so the greybox reads; replaced by real dioramas later. */
function Landmark({ def, night }: { def: IslandDef; night: boolean }) {
  const y = ISLAND_TOP
  const mat = <meshLambertMaterial color={def.accent} flatShading />
  const lamp = night ? (
    <mesh position={[0, y + 2.6, 0]}>
      <sphereGeometry args={[0.18, 8, 8]} />
      <meshBasicMaterial color="#ffd98a" />
    </mesh>
  ) : null
  if (def.id === 'home') {
    return (
      <group>
        <mesh position={[-1.5, y + 1, -1]}>
          <boxGeometry args={[2.6, 2, 2.2]} />
          <meshLambertMaterial color="#F4F1EA" flatShading />
        </mesh>
        <mesh position={[-1.5, y + 2.6, -1]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[2.1, 1.3, 4]} />
          {mat}
        </mesh>
        {/* cinema screen */}
        <mesh position={[-3.5, y + 1.3, -4]}>
          <boxGeometry args={[2.4, 1.4, 0.12]} />
          <meshLambertMaterial color="#2a2a30" />
        </mesh>
        {/* post box */}
        <mesh position={[4.5, y + 0.6, -3.2]}>
          <boxGeometry args={[0.5, 1.2, 0.5]} />
          {mat}
        </mesh>
        {/* launch pad */}
        <mesh position={[3, y + 0.03, 3]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 6]} />
          <meshLambertMaterial color="#F4F1EA" />
        </mesh>
        {lamp}
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, y + 1, -1.4]}>
        <boxGeometry args={[1.6, 2, 1.6]} />
        {mat}
      </mesh>
      {lamp}
    </group>
  )
}

/* ---------------- Clouds ---------------- */

function Clouds({ count, night }: { count: number; night: boolean }) {
  const clouds = useMemo(() => {
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: count }, () => ({
      pos: [(rnd() - 0.5) * 110, 8 + rnd() * 10, (rnd() - 0.5) * 100] as [number, number, number],
      scale: 1.2 + rnd() * 1.8,
      speed: 0.2 + rnd() * 0.3,
    }))
  }, [count])
  const group = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    group.current?.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * dt
      if (c.position.x > 60) c.position.x = -60
    })
  })
  const color = night ? '#3A4258' : '#F4F1EA'
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={c.pos} scale={c.scale}>
          {[[-1, 0, 0, 1], [0, 0.3, 0, 1.3], [1.1, 0, 0.2, 0.9]].map(([x, y, z, s], j) => (
            <mesh key={j} position={[x, y, z]} scale={s}>
              <icosahedronGeometry args={[1, 0]} />
              <meshLambertMaterial color={color} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/* ---------------- Pilot, plane and camera driven by scroll ---------------- */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const CAM_DESKTOP = new THREE.Vector3(11, 7.5, 15)
const CAM_MOBILE = new THREE.Vector3(13, 10, 19)

function PilotRig() {
  const anchors = useMemo(() => STOPS.map((s) => new THREE.Vector3(...stopAnchor(s))), [])
  const pilot = useRef<THREE.Group>(null)
  const plane = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const camTarget = useRef(new THREE.Vector3())
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), next: new THREE.Vector3(), look: new THREE.Vector3() }), [])
  const first = useRef(true)
  const camOffset = useMemo(() => (isMobile() ? CAM_MOBILE : CAM_DESKTOP), [])

  useFrame((state, dt) => {
    const p = useStore.getState().progress
    const last = anchors.length - 1
    const i = Math.min(last, Math.max(0, Math.floor(p)))
    const t = i >= last ? 0 : smooth(0.45, 1, p - i)
    const A = anchors[i]
    const B = anchors[Math.min(last, i + 1)]
    const dist = A.distanceTo(B)
    const arc = (k: number) => Math.sin(Math.PI * k) * (2.5 + dist * 0.12)

    tmp.pos.lerpVectors(A, B, t)
    tmp.pos.y += arc(t)
    const flying = t > 0.02 && t < 0.98

    if (pilot.current && plane.current) {
      const time = state.clock.elapsedTime
      pilot.current.position.copy(tmp.pos)
      if (flying) {
        const k = Math.min(1, t + 0.02)
        tmp.next.lerpVectors(A, B, k)
        tmp.next.y += arc(k)
        pilot.current.lookAt(tmp.next.x, pilot.current.position.y, tmp.next.z)
        pilot.current.position.y += 0.35
        plane.current.visible = true
        plane.current.position.copy(tmp.pos)
        plane.current.lookAt(tmp.next)
      } else {
        // idle: face the camera, gentle breathing bob
        pilot.current.lookAt(camera.position.x, pilot.current.position.y, camera.position.z)
        pilot.current.position.y += Math.sin(time * 2) * 0.03
        plane.current.visible = false
      }
    }

    // camera follows the pilot with damping
    const desired = tmp.look.copy(tmp.pos).add(camOffset)
    const k = first.current ? 1 : 1 - Math.exp(-dt * 3.5)
    camera.position.lerp(desired, k)
    camTarget.current.lerp(tmp.pos, k)
    camera.lookAt(camTarget.current.x, camTarget.current.y + 1, camTarget.current.z)
    first.current = false
  })

  return (
    <>
      <group ref={pilot}>
        <PilotPlaceholder />
      </group>
      <group ref={plane} visible={false}>
        <PaperPlane />
      </group>
    </>
  )
}

/** Chibi stand-in until the real Blender GLB arrives (8–11 Nov). */
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

function PaperPlane() {
  const geo = useMemo(() => {
    const v = [
      [0, 0, 1.4], [-1, 0.05, -0.9], [0, 0, -0.9], // left wing
      [0, 0, 1.4], [0, 0, -0.9], [1, 0.05, -0.9], // right wing
      [0, 0, 1.4], [0, -0.35, -0.9], [0, 0, -0.9], // keel
    ].flat()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} scale={1.1}>
      <meshLambertMaterial color="#FAF7F0" side={THREE.DoubleSide} flatShading />
    </mesh>
  )
}

export { islandById }

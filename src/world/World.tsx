import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, PerformanceMonitor, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ISLANDS, ISLAND_TOP, STOPS, islandById, stopAnchor, type IslandDef } from './layout'
import { buildIsland } from './islandGen'
import { useStore } from '../store'

const PALETTE = {
  day: { sky: '#A9C4CC', top: '#9ecbe0', horizon: '#f5e4d3', grass: '#8DB36B', rock: '#6B5E55', hemiSky: '#fff4e6', hemiGround: '#d8c6ae', sun: 1.9, sunColor: '#ffe3c2', hemi: 1.5 },
  night: { sky: '#1C2333', top: '#121a2e', horizon: '#3b3552', grass: '#4F6B45', rock: '#3E3833', hemiSky: '#8aa0d0', hemiGround: '#3a3648', sun: 0.35, sunColor: '#b8c8ff', hemi: 0.75 },
}

/** Must match --panel-w in styles.css: clamp(440px, 44vw, 760px). */
export const panelWidth = (w: number) => Math.min(760, Math.max(440, w * 0.44))

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
      <SkyDome top={c.top} horizon={c.horizon} />
      <fog attach="fog" args={[c.horizon, 40, 120]} />
      <hemisphereLight args={[c.hemiSky, c.hemiGround, c.hemi]} />
      <directionalLight position={[12, 20, 8]} intensity={c.sun} color={c.sunColor} />
      {ISLANDS.map((i) => (
        <Island key={i.id} def={i} night={theme === 'night'} labels={!mobile} />
      ))}
      <Clouds count={mobile ? 10 : 22} night={theme === 'night'} />
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
      const panel = panelWidth(size.width)
      cam.setViewOffset(size.width, size.height, -panel / 2, 0, size.width, size.height)
    }
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

/* ---------------- Islands (grey-box placeholders) ---------------- */

/** Where props must not grow: the landmark, and every spot the Pilot stands on this island. */
function clearSpots(def: IslandDef): [number, number, number][] {
  const spots: [number, number, number][] = STOPS.filter((st) => st.island === def.id).map((st) => [st.offset[0], st.offset[2], 1.0])
  if (def.id === 'home') spots.push([-1.5, -1, 2.2], [-3.5, -4, 1.6], [4.5, -3.2, 0.9], [3, 3, 1.3])
  else spots.push([0, -1.4, 1.4])
  return spots
}

function Island({ def, night, labels }: { def: IslandDef; night: boolean; labels: boolean }) {
  const geometry = useMemo(
    () => buildIsland({ radius: def.radius, seed: def.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 100000, top: ISLAND_TOP, keepClear: clearSpots(def) }),
    [def],
  )
  return (
    <group position={def.position}>
      <mesh geometry={geometry}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <Landmark def={def} night={night} />
      {labels && <IslandLabel def={def} />}
    </group>
  )
}

/** Big inverted sphere with a vertical gradient: soft pastel sky by day, deep blue by night. */
function SkyDome({ top, horizon }: { top: string; horizon: string }) {
  const uniforms = useMemo(() => ({ top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    uniforms.top.value.set(top)
    uniforms.horizon.value.set(horizon)
  }, [top, horizon, uniforms])
  return (
    <mesh scale={180} renderOrder={-1}>
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
          '  float h = clamp(normalize(vPos).y * 2.2 + 0.45, 0.0, 1.0);',
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
    // most clouds form a soft sea below the islands; a few drift high and far away
    return Array.from({ length: count }, (_, i) => {
      const low = i % 4 !== 0
      return {
        pos: [(rnd() - 0.5) * 120, low ? -16 + rnd() * 6 : 22 + rnd() * 8, (rnd() - 0.5) * 110] as [number, number, number],
        scale: low ? 3 + rnd() * 3 : 2 + rnd() * 2,
        speed: 0.2 + rnd() * 0.3,
      }
    })
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
          {[[-1.3, -0.1, 0, 0.9], [-0.4, 0.25, 0.1, 1.25], [0.6, 0.2, -0.1, 1.1], [1.5, -0.1, 0.1, 0.8], [0.1, -0.2, 0.5, 0.9]].map(([x, y, z, s], j) => (
            <mesh key={j} position={[x, y, z]} scale={[s, s * 0.8, s]}>
              <icosahedronGeometry args={[1, 2]} />
              <meshLambertMaterial color={color} emissive={color} emissiveIntensity={night ? 0.05 : 0.35} />
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
  const { camera, gl } = useThree()
  const orbit = useLookAround(gl.domElement)
  const sph = useMemo(() => new THREE.Spherical(), [])
  const camTarget = useRef(new THREE.Vector3())
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), next: new THREE.Vector3(), look: new THREE.Vector3() }), [])
  const first = useRef(true)
  const pose = useRef<PilotPose>('ground')
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
    pose.current = flying ? 'fly' : 'ground'

    if (pilot.current && plane.current) {
      const time = state.clock.elapsedTime
      pilot.current.position.copy(tmp.pos)
      if (flying) {
        const k = Math.min(1, t + 0.02)
        tmp.next.lerpVectors(A, B, k)
        tmp.next.y += arc(k)
        pilot.current.lookAt(tmp.next.x, pilot.current.position.y, tmp.next.z)
        pilot.current.position.y += 0.05 // feet on the wings
        plane.current.visible = true
        plane.current.position.copy(tmp.pos)
        plane.current.lookAt(tmp.next)
      } else {
        // on an island: face the camera; the Idle clip does the breathing
        pilot.current.lookAt(camera.position.x, pilot.current.position.y, camera.position.z)
        if (!pilotLoaded) pilot.current.position.y += Math.sin(time * 2) * 0.03
        plane.current.visible = false
      }
    }

    // camera follows the pilot with damping
    // look-around: rotate the follow offset around the Pilot, then drift back when idle or on the next stop
    const o = orbit.current
    if (!o.dragging && (state.clock.elapsedTime - o.lastInput > 2.5 || flying)) {
      const ease = 1 - Math.exp(-dt * 2)
      o.yaw += (0 - o.yaw) * ease
      o.pitch += (0 - o.pitch) * ease
    }
    sph.setFromVector3(camOffset)
    sph.theta += o.yaw
    sph.phi = Math.min(1.35, Math.max(0.35, sph.phi + o.pitch))
    const desired = tmp.look.copy(tmp.pos).add(new THREE.Vector3().setFromSpherical(sph))
    const k = first.current ? 1 : 1 - Math.exp(-dt * 3.5)
    camera.position.lerp(desired, k)
    camTarget.current.lerp(tmp.pos, k)
    camera.lookAt(camTarget.current.x, camTarget.current.y + 1, camTarget.current.z)
    first.current = false
  })

  return (
    <>
      <group ref={pilot}>
        <ModelGuard fallback={<PilotPlaceholder />}>
          <Suspense fallback={<PilotPlaceholder />}>
            <PilotModel pose={pose} />
          </Suspense>
        </ModelGuard>
      </group>
      <group ref={plane} visible={false}>
        <PaperPlane />
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
const DRACO_PATH = '/draco/'
const PILOT_HEIGHT = 1.8 // world units; the GLB is 1.2 tall
const FADE = 0.35

type PilotPose = 'ground' | 'fly'
let pilotLoaded = false

/**
 * Burhanuddin's rigged character. Clips in the GLB: Idle, Idle_CheckWatch, Walk, Wave, Sit, Cheer.
 * On an island: Idle, with an occasional watch check. Flying: Cheer (arms out on the plane).
 * Landing on a stop: one Wave, then back to Idle. Walk and Sit are kept for Adventure Mode and the cinema bench.
 */
function PilotModel({ pose }: { pose: React.MutableRefObject<PilotPose> }) {
  const { scene, animations } = useGLTF(PILOT_URL, DRACO_PATH)
  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, group)
  const state = useRef({ current: '' as string, lastPose: 'ground' as PilotPose, nextFidget: 9 })

  useEffect(() => {
    pilotLoaded = true
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) m.frustumCulled = false
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
    if (!st.current) play('Idle')
    if (p !== st.lastPose) {
      play(p === 'fly' ? 'Cheer' : 'Wave') // take off with arms out, land with a wave
      st.lastPose = p
      st.nextFidget = time + 10 + Math.random() * 6
      return
    }
    if (p === 'fly') return
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

/** If the character file fails to load (missing, renamed, bad network), show the stand-in instead of crashing the whole scene. */
class ModelGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('Character model failed to load; showing the stand-in.', err)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
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

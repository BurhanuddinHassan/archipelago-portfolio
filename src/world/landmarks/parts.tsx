import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_YAW, groundY, type IslandDef } from '../layout'
import { canvasTexture } from './kit'

/** Shared pieces for the island dioramas: placing geometry on the ground, ground-hugging ribbons, and signs. */

export type XZ = [number, number]

/** Returns `put(g, xz, turn, scale, lift)`: moves a geometry onto the island's ground at a spot, facing the camera. */
export function placer(def: IslandDef) {
  return (g: THREE.BufferGeometry, xz: XZ, turn = 0, scale = 1, lift = 0, absoluteYaw?: number) => {
    g.scale(scale, scale, scale)
    g.rotateY(absoluteYaw ?? FACE_YAW + turn)
    g.translate(xz[0], groundY(def, xz[0], xz[1]) + lift, xz[1])
    return g
  }
}

/**
 * A straight strip lying on the ground from `a` to `b`, cut into bands across its width.
 * `offsets` are the band edges (distance from the centre line); `colour(i, band)` paints each cell.
 */
export function ribbonGrid(def: IslandDef, a: XZ, b: XZ, offsets: number[], steps: number, colour: (i: number, band: number) => THREE.Color, lift = 0.06) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len
  const pos: number[] = [], col: number[] = [], nor: number[] = []
  const P = (i: number, off: number): [number, number, number] => {
    const x = a[0] + dx * (len * i) / steps - dz * off, z = a[1] + dz * (len * i) / steps + dx * off
    return [x, groundY(def, x, z) + lift, z]
  }
  for (let i = 0; i < steps; i++)
    for (let k = 0; k < offsets.length - 1; k++) {
      const c = colour(i, k), q = [P(i, offsets[k]), P(i + 1, offsets[k]), P(i, offsets[k + 1]), P(i + 1, offsets[k + 1])]
      for (const v of [q[0], q[2], q[1], q[1], q[2], q[3]]) {
        pos.push(...v)
        col.push(c.r, c.g, c.b)
        nor.push(0, 1, 0)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}

/** A winding footpath through the given points, lying on the ground. */
export function pathRibbon(def: IslandDef, pts: XZ[], width: number, a: THREE.Color, b: THREE.Color, steps = 60) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)))
  const sp = curve.getSpacedPoints(steps), pos: number[] = [], col: number[] = [], nor: number[] = [], idx: number[] = []
  sp.forEach((q, i) => {
    const t = curve.getTangentAt(i / steps), w = width / 2 + Math.sin(i * 1.7) * 0.06
    for (const k of [-1, 1]) {
      const x = q.x - t.z * w * k, z = q.z + t.x * w * k
      pos.push(x, groundY(def, x, z) + 0.05, z)
      const c = i % 2 ? a : b
      col.push(c.r, c.g, c.b)
      nor.push(0, 1, 0)
    }
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return { geometry: g, curve }
}

const FONT = '"Fredoka", "Inter", "Segoe UI", sans-serif'

/** Shrinks the font until the text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number) {
  do ctx.font = `${weight} ${size}px ${FONT}`
  while (ctx.measureText(text).width > max && (size -= 2) > 12)
}

/** A painted sign: a small coloured tag line over a title. */
export function labelTex(tag: string, title: string, accent: string, w = 512, h = 176) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#f6efe0'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, w, 14)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    fit(ctx, tag, 700, h * 0.24, w - 40)
    ctx.fillText(tag, w / 2, h * 0.34)
    ctx.fillStyle = '#2b2730'
    fit(ctx, title, 600, h * 0.3, w - 36)
    ctx.fillText(title, w / 2, h * 0.68)
  })
}

/** A sign with a heading and a list of items, each on its own plaque. */
export function listTex(heading: string, items: string[], accent: string, w = 512, h = 448) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#efe4cd'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, w, 96)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    fit(ctx, heading, 700, 54, w - 40)
    ctx.fillText(heading, w / 2, 50)
    const top = 112, rowH = (h - top - 12) / items.length
    items.forEach((it, i) => {
      const y = top + rowH * i
      ctx.fillStyle = '#fffaf0'
      ctx.beginPath()
      ctx.roundRect(22, y + 5, w - 44, rowH - 10, 12)
      ctx.fill()
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(52, y + rowH / 2, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2b2730'
      fit(ctx, it, 600, Math.min(40, rowH * 0.56), w - 130)
      ctx.fillText(it, w / 2 + 14, y + rowH / 2 + 2)
    })
  })
}

/** A wooden board showing a texture on its front (+Z), optionally standing on two posts. `y` is the board's centre height. */
export function Board({ tex, w, h, y, posts = true, wood = '#8a5a3b' }: { tex: THREE.Texture; w: number; h: number; y: number; posts?: boolean; wood?: string }) {
  return (
    <group>
      <mesh position={[0, y, 0]} castShadow>
        <boxGeometry args={[w + 0.14, h + 0.14, 0.08]} />
        <meshLambertMaterial color={wood} />
      </mesh>
      <mesh position={[0, y, 0.045]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {posts &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * (w / 2 - 0.08), (y - h / 2) / 2, -0.07]} castShadow>
            <boxGeometry args={[0.1, y - h / 2, 0.1]} />
            <meshLambertMaterial color="#5f402b" />
          </mesh>
        ))}
    </group>
  )
}


/**
 * A campfire flame: three soft sheets of fire drawn by a small shader (flickering edges, white-hot core fading to
 * red), plus sparks drifting up. Sits with its base at the origin.
 */
export function Fire({ scale = 1, sparks = true, lit = true }: { scale?: number; sparks?: boolean; lit?: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `uniform float uTime; varying vec2 vUv;
          void main() { vUv = uv; vec3 p = position;
            float h = uv.y; p.x += sin(uTime * 7.0 + h * 6.0 + position.z * 9.0) * 0.07 * h; p.x += sin(uTime * 13.0 + h * 11.0) * 0.03 * h;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          float n(vec2 p) { return sin(p.x * 9.0 + uTime * 5.0) * sin(p.y * 7.0 - uTime * 9.0) * 0.5 + 0.5; }
          void main() { float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y;
            float width = (1.0 - y) * (0.55 + 0.45 * y) + 0.12 * n(vUv * 1.7) * y;   // teardrop that licks about
            float body = smoothstep(width, width * 0.35, x) * smoothstep(1.0, 0.75, y + 0.18 * n(vUv * 2.3));
            vec3 col = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.72, 0.18), smoothstep(0.75, 0.2, y + x * 0.5));
            col = mix(col, vec3(1.0, 0.97, 0.8), smoothstep(0.45, 0.0, y + x) );
            gl_FragColor = vec4(col * body * 1.25, body); }`,
      }),
    [],
  )
  const embers = useRef<(THREE.Mesh | null)[]>([])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    mat.uniforms.uTime.value = t
    embers.current.forEach((m, i) => {
      if (!m) return
      const f = (t * (0.35 + (i % 3) * 0.08) + i * 0.37) % 1
      m.position.set(Math.sin(t * 2 + i * 2.1) * 0.12 * (1 + f * 2), 0.3 + f * 1.5, Math.cos(t * 1.6 + i * 1.3) * 0.12 * (1 + f * 2))
      m.scale.setScalar(1 - f)
    })
  })
  // by day the fire is out: charred wood and a bed of ash
  if (!lit)
    return (
      <group scale={scale}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.36, 12]} />
          <meshLambertMaterial color="#8c8a86" />
        </mesh>
        {[0, 1.2, 2.5].map((r, i) => (
          <mesh key={i} position={[Math.cos(r) * 0.08, 0.09, Math.sin(r) * 0.08]} rotation={[0, r, Math.PI / 2 - 0.2]}>
            <cylinderGeometry args={[0.055, 0.055, 0.5, 5]} />
            <meshLambertMaterial color={i ? '#2a2422' : '#3b322d'} />
          </mesh>
        ))}
      </group>
    )
  return (
    <group scale={scale}>
      {[0, Math.PI / 3, (2 * Math.PI) / 3].map((r, i) => (
        <mesh key={i} material={mat} rotation={[0, r, 0]} position={[0, 0.45, 0]} renderOrder={4}>
          <planeGeometry args={[0.75, 0.95, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 0.07, 0]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshBasicMaterial color="#ff7a2a" toneMapped={false} />
      </mesh>
      {sparks &&
        [0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} ref={(el) => void (embers.current[i] = el)}>
            <sphereGeometry args={[0.03, 5, 4]} />
            <meshBasicMaterial color="#ffc36b" toneMapped={false} />
          </mesh>
        ))}
    </group>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_YAW, MERGE, MOOR_DIR, groundY, type IslandDef } from '../layout'
import { At, Body, Glow, ell } from './Chrono'
import { C, blob, box, cone, cyl, hex, merge, sphere, torus } from './kit'

/**
 * Merge Defence island: the game, playing itself.
 * Monsters come out of the cave in waves and walk the lane to the castle. Cannons of merge level 1 to 5 stand
 * on the board and shoot the monster that is furthest along. Kills drop coins and fill the power-up meter;
 * a full meter triggers the next power-up (shield, rapid fire, fire power), each with its own shrine.
 * A monster that reaches the gate costs a life unless the shield is up. On the side pad, two level-1 cannons
 * keep merging into a level 2.
 */

type V3 = [number, number, number]

const STONE = hex('#d8ccb8'), STONE_DARK = hex('#b9ab95'), ROCK = hex('#8f8a86'), ROCK_DARK = hex('#6f6a68')
const LEVEL_COLOUR = ['#6a6d73', '#b98444', '#4f86c8', '#8d62d6', '#e9b443'].map(hex)

/* ---------------- game rules (small numbers, easy to read) ---------------- */

const CANNON_DAMAGE = [1, 1, 2, 2, 3] // by merge level
const CANNON_RANGE = 3.5
const CANNON_COOLDOWN = 1.7
const KINDS = [
  { name: 'slime', hp: 4, speed: 0.95, coins: 5, charge: 2 },
  { name: 'bat', hp: 6, speed: 1.3, coins: 10, charge: 3 },
  { name: 'ogre', hp: 16, speed: 0.6, coins: 25, charge: 5 },
] as const
const WAVE = [0, 0, 1, 0, 1, 2] // which kind each monster slot is
const SPAWN_GAP = 1.7
const WAVE_PAUSE = 3.5
const POWERUPS = ['shield', 'rapid', 'fire'] as const
const POWER_TIME = 7
const CHARGE_FULL = 12

/* ---------------- static pieces ---------------- */

function castle(accent: THREE.Color) {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  const roof = accent, roofDark = accent.clone().multiplyScalar(0.8)
  // keep
  p.push(box([1.9, 2.9, 1.5], STONE, [0, 1.45, -0.95]))
  p.push(cone(1.5, 1.2, roof, [0, 3.5, -0.95], [0, Math.PI / 4, 0], 4))
  g.push(box([0.28, 0.5, 0.04], C.yellow, [0, 2.2, -0.19]))
  // curtain wall with battlements and the gate
  p.push(box([3.7, 1.7, 0.7], STONE_DARK, [0, 0.85, 0]))
  for (let i = 0; i < 7; i++) p.push(box([0.32, 0.26, 0.74], STONE, [-1.5 + i * 0.5, 1.83, 0]))
  p.push(box([1.0, 1.2, 0.08], C.woodDark, [0, 0.6, 0.36]))
  p.push(cyl(0.5, 0.5, 0.08, C.woodDark, [0, 1.2, 0.36], [Math.PI / 2, 0, 0], 16))
  for (let i = 0; i < 4; i++) p.push(box([0.04, 1.5, 0.03], C.metal, [-0.3 + i * 0.2, 0.75, 0.41]))
  for (let i = 0; i < 3; i++) p.push(box([0.9, 0.04, 0.03], C.metal, [0, 0.35 + i * 0.4, 0.41]))
  // corner towers
  for (const s of [-1, 1]) {
    p.push(cyl(0.72, 0.82, 3.0, STONE, [s * 2.05, 1.5, 0.05], undefined, 14))
    p.push(cyl(0.86, 0.86, 0.22, STONE_DARK, [s * 2.05, 3.0, 0.05], undefined, 14))
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      p.push(box([0.24, 0.24, 0.24], STONE, [s * 2.05 + Math.cos(a) * 0.74, 3.23, 0.05 + Math.sin(a) * 0.74]))
    }
    p.push(cone(0.8, 1.15, s > 0 ? roof : roofDark, [s * 2.05, 3.92, 0.05], undefined, 12))
    p.push(cyl(0.02, 0.02, 0.8, C.woodDark, [s * 2.05, 4.8, 0.05], undefined, 4))
    p.push(box([0.02, 0.26, 0.42], C.red, [s * 2.05, 5.02, 0.27]))
    g.push(box([0.2, 0.36, 0.04], C.yellow, [s * 2.05, 1.9, 0.83]))
  }
  // stone path apron in front of the gate
  p.push(box([1.3, 0.08, 0.9], STONE, [0, 0.04, 0.8]))
  return { body: merge(p), glow: merge(g) }
}

function cave() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  // an arch of boulders around a dark mouth
  const arch: [number, number, number, number][] = [
    [-1.25, 0.45, 0, 0.85], [-1.1, 1.3, -0.1, 0.8], [-0.5, 1.95, -0.15, 0.85], [0.4, 2.0, -0.15, 0.9], [1.1, 1.4, -0.1, 0.8], [1.3, 0.5, 0, 0.9],
    [-0.6, 1.2, -1.1, 1.2], [0.6, 1.2, -1.1, 1.25], [0, 0.6, -1.6, 1.3],
  ]
  arch.forEach(([x, y, z, r], i) => p.push(blob(r, i % 2 ? ROCK : ROCK_DARK, [x, y, z], 0.85, i + 3)))
  p.push(ell(0.85, 1.05, 0.3, hex('#1a1420'), [0, 0.85, 0.28], 14))
  for (const x of [-0.25, 0.25]) g.push(sphere(0.07, hex('#c79bff'), [x, 1.15, 0.5], 8))
  // bones and a warning sign
  p.push(cyl(0.035, 0.035, 0.5, C.white, [1.2, 0.05, 1.1], [0, 0.6, Math.PI / 2], 5))
  p.push(cyl(0.05, 0.06, 1.0, C.woodDark, [-1.6, 0.5, 0.9], undefined, 5))
  p.push(box([0.6, 0.4, 0.05], C.wood, [-1.6, 1.0, 0.93]))
  p.push(box([0.07, 0.2, 0.02], C.red, [-1.6, 1.05, 0.97]))
  p.push(box([0.07, 0.06, 0.02], C.red, [-1.6, 0.88, 0.97]))
  return { body: merge(p), glow: merge(g) }
}

/** Dirt lane from the cave to the gate: a ribbon that follows the ground. */
function laneRibbon(def: IslandDef) {
  const curve = new THREE.CatmullRomCurve3(MERGE.lane.map(([x, z]) => new THREE.Vector3(x, 0, z)))
  const pts = curve.getSpacedPoints(40), pos: number[] = [], col: number[] = [], idx: number[] = []
  const a = hex('#c9a26a'), b = hex('#b98f58')
  pts.forEach((q, i) => {
    const t = curve.getTangent(i / 40), w = 0.72 + Math.sin(i * 1.7) * 0.07
    for (const k of [-1, 1]) {
      const x = q.x - t.z * w * k, z = q.z + t.x * w * k
      pos.push(x, groundY(def, x, z) + 0.05, z)
      const c = i % 2 ? a : b
      col.push(c.r, c.g, c.b)
    }
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return { geometry: g, curve }
}

const TILE = 1.2
const cannonX = (i: number) => (i - 2) * TILE

function board() {
  const p: THREE.BufferGeometry[] = [], g: THREE.BufferGeometry[] = []
  p.push(box([TILE * 5 + 0.5, 0.26, 1.7], STONE_DARK, [0, 0.13, 0]))
  for (let i = 0; i < 5; i++) {
    p.push(box([TILE - 0.1, 0.06, 1.3], i % 2 ? hex('#e3d8c5') : hex('#d2c5ae'), [cannonX(i), 0.28, 0]))
    // level pips on the front edge: one dot per merge level
    for (let k = 0; k <= i; k++) g.push(sphere(0.055, C.gold, [cannonX(i) + (k - i / 2) * 0.15, 0.13, 0.87], 6))
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) p.push(cyl(0.11, 0.13, 0.42, STONE, [x * (TILE * 2.5 + 0.2), 0.21, z * 0.8], undefined, 6))
  return { body: merge(p), glow: merge(g) }
}

/** A cannon of the given merge level (1 to 5), barrel along +Z. Higher levels are bigger and more ornate. */
function cannon(level: number) {
  const k = 0.68 + level * 0.11, col = LEVEL_COLOUR[level - 1], p: THREE.BufferGeometry[] = []
  p.push(box([0.5 * k, 0.2 * k, 0.72 * k], C.wood, [0, 0.2 * k, -0.05 * k]))
  for (const s of [-1, 1]) {
    p.push(cyl(0.22 * k, 0.22 * k, 0.09 * k, C.woodDark, [s * 0.3 * k, 0.22 * k, 0.02 * k], [0, 0, Math.PI / 2], 10))
    p.push(cyl(0.06 * k, 0.06 * k, 0.11 * k, C.metal, [s * 0.3 * k, 0.22 * k, 0.02 * k], [0, 0, Math.PI / 2], 6))
  }
  p.push(cyl(0.15 * k, 0.2 * k, 0.95 * k, col, [0, 0.46 * k, 0.12 * k], [Math.PI / 2, 0, 0], 12))
  p.push(sphere(0.2 * k, col, [0, 0.46 * k, -0.36 * k], 10))
  p.push(torus(0.165 * k, 0.035 * k, C.ink, [0, 0.46 * k, 0.58 * k], undefined, Math.PI * 2, 12))
  for (let i = 1; i < level; i++) p.push(torus(0.19 * k, 0.028 * k, C.gold, [0, 0.46 * k, (-0.2 + i * 0.17) * k], undefined, Math.PI * 2, 12))
  if (level === 5) for (const s of [-1, 0, 1]) p.push(cone(0.05, 0.16, C.gold, [s * 0.1, 0.72 * k, -0.2 * k], undefined, 5))
  return merge(p)
}

function monster(kind: number) {
  const p: THREE.BufferGeometry[] = []
  const eyes = (y: number, z: number, d: number, r: number) => {
    for (const x of [-d, d]) {
      p.push(sphere(r, C.white, [x, y, z], 8))
      p.push(sphere(r * 0.5, C.ink, [x, y, z + r * 0.7], 6))
    }
  }
  if (kind === 0) {
    p.push(blob(0.36, hex('#7ccf5a'), [0, 0.25, 0], 0.72, 5))
    eyes(0.32, 0.27, 0.12, 0.07)
  } else if (kind === 1) {
    p.push(ell(0.26, 0.24, 0.24, hex('#9b6fd0'), [0, 0.8, 0], 10))
    for (const s of [-1, 1]) {
      p.push(box([0.5, 0.03, 0.3], hex('#7a52b0'), [s * 0.42, 0.85, -0.02], [0, 0, s * 0.35]))
      p.push(cone(0.06, 0.16, hex('#7a52b0'), [s * 0.13, 1.06, 0], undefined, 4))
    }
    eyes(0.83, 0.2, 0.09, 0.055)
  } else {
    p.push(box([0.62, 0.66, 0.46], hex('#c8553d'), [0, 0.55, 0]))
    p.push(ell(0.3, 0.26, 0.28, hex('#d86a4f'), [0, 1.05, 0.02], 10))
    for (const s of [-1, 1]) {
      p.push(cone(0.07, 0.24, C.cream, [s * 0.2, 1.33, 0], [0, 0, s * -0.4], 5))
      p.push(box([0.18, 0.5, 0.2], hex('#c8553d'), [s * 0.42, 0.55, 0.05]))
      p.push(box([0.22, 0.24, 0.26], hex('#8a3a2a'), [s * 0.17, 0.12, 0]))
    }
    p.push(box([0.3, 0.05, 0.04], C.cream, [0, 0.94, 0.27]))
    eyes(1.1, 0.26, 0.11, 0.06)
  }
  return merge(p)
}

function shrine(kind: number) {
  const p: THREE.BufferGeometry[] = []
  p.push(cyl(0.5, 0.58, 0.18, STONE_DARK, [0, 0.09, 0], undefined, 8))
  p.push(cyl(0.3, 0.36, 0.7, STONE, [0, 0.53, 0], undefined, 8))
  p.push(cyl(0.44, 0.34, 0.14, STONE_DARK, [0, 0.95, 0], undefined, 8))
  p.push(torus(0.4, 0.03, hex(['#5aa9ff', '#ffd75e', '#ff6b4a'][kind]), [0, 1.03, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 8))
  return merge(p)
}

/** The floating symbol over each shrine. */
function icon(kind: number) {
  const p: THREE.BufferGeometry[] = []
  if (kind === 0) {
    // shield
    p.push(ell(0.3, 0.36, 0.09, hex('#5aa9ff'), [0, 0, 0], 12))
    p.push(ell(0.17, 0.21, 0.1, hex('#d9ecff'), [0, 0.02, 0.03], 10))
  } else if (kind === 1) {
    // rapid fire: three arrows
    for (let i = 0; i < 3; i++) p.push(cone(0.2, 0.26, hex('#ffd75e'), [0, -0.22 + i * 0.22, 0], undefined, 4))
  } else {
    // fire power: a flame
    p.push(cone(0.24, 0.6, hex('#ff6b4a'), [0, 0.05, 0], undefined, 7))
    p.push(cone(0.14, 0.36, hex('#ffd75e'), [0, -0.05, 0.06], undefined, 6))
    p.push(sphere(0.22, hex('#ff6b4a'), [0, -0.22, 0], 8))
  }
  return merge(p)
}

/* ---------------- the heads-up sign ---------------- */

function drawHud(ctx: CanvasRenderingContext2D, wave: number, lives: number, coins: number, charge: number, power: string) {
  ctx.clearRect(0, 0, 640, 96)
  ctx.fillStyle = 'rgba(30,27,36,0.9)'
  ctx.beginPath()
  ctx.roundRect(4, 8, 632, 80, 40)
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.font = '700 34px "Inter", "Segoe UI", sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`WAVE ${wave}`, 34, 50)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < lives ? '#ff5d6c' : 'rgba(255,255,255,0.2)'
    ctx.beginPath()
    ctx.arc(232 + i * 36, 48, 13, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#ffd75e'
  ctx.beginPath()
  ctx.arc(362, 48, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(coins), 386, 50)
  // power-up meter
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.roundRect(482, 38, 124, 20, 10)
  ctx.fill()
  ctx.fillStyle = power === 'shield' ? '#5aa9ff' : power === 'rapid' ? '#ffd75e' : power === 'fire' ? '#ff6b4a' : '#8fe08a'
  ctx.beginPath()
  ctx.roundRect(482, 38, Math.max(20, 124 * (power ? 1 : charge / CHARGE_FULL)), 20, 10)
  ctx.fill()
}

/* ---------------- the island ---------------- */

type Mob = { active: boolean; d: number; hp: number; dying: number; x: number; z: number }
type Shot = { active: boolean; t: number; fx: number; fy: number; fz: number; target: number; dmg: number }
type Coin = { t: number; x: number; y: number; z: number }

export function MergeDefence({ def, night, simple }: { def: IslandDef; night: boolean; simple: boolean }) {
  const accent = useMemo(() => hex(def.accent), [def.accent])
  const g = useMemo(() => {
    const lane = laneRibbon(def)
    return {
      castle: castle(accent),
      cave: cave(),
      lane: lane.geometry,
      curve: lane.curve,
      length: lane.curve.getLength(),
      board: board(),
      cannons: [1, 2, 3, 4, 5].map(cannon),
      monsters: [0, 1, 2].map(monster),
      shrines: [0, 1, 2].map(shrine),
      icons: [0, 1, 2].map(icon),
      pad: merge([box([2.9, 0.22, 1.5], STONE_DARK, [0, 0.11, 0]), box([1.25, 0.06, 1.2], hex('#e3d8c5'), [-0.7, 0.24, 0]), box([1.25, 0.06, 1.2], hex('#d2c5ae'), [0.7, 0.24, 0])]),
      coin: cyl(0.16, 0.16, 0.05, C.gold, [0, 0, 0], [Math.PI / 2, 0, 0], 12),
    }
  }, [def, accent])

  // cannon positions on the island (the board faces the camera, so its local x runs along MOOR_DIR)
  const boardY = groundY(def, MERGE.board[0], MERGE.board[1])
  const cannonAt = useMemo(() => [0, 1, 2, 3, 4].map((i) => [MERGE.board[0] + MOOR_DIR[0] * cannonX(i), boardY + 0.75, MERGE.board[1] + MOOR_DIR[1] * cannonX(i)] as V3), [boardY])
  const castleXZ = MERGE.castle, castleY = groundY(def, castleXZ[0], castleXZ[1])

  const hud = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 96
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return { ctx: canvas.getContext('2d')!, tex }
  }, [])
  useEffect(() => () => hud.tex.dispose(), [hud])

  const sim = useRef({
    mobs: WAVE.map((): Mob => ({ active: false, d: 0, hp: 0, dying: 0, x: 0, z: 0 })),
    shots: Array.from({ length: 8 }, (): Shot => ({ active: false, t: 0, fx: 0, fy: 0, fz: 0, target: 0, dmg: 0 })),
    coinsFx: Array.from({ length: 4 }, (): Coin => ({ t: 1, x: 0, y: 0, z: 0 })),
    cool: [0.4, 0.9, 0.2, 1.2, 0.7],
    recoil: [0, 0, 0, 0, 0],
    aim: [Math.PI, Math.PI, Math.PI, Math.PI, Math.PI],
    spawned: 0, spawnIn: 1, pause: 0,
    wave: 1, lives: 3, coins: 0, charge: 0, power: -1, powerLeft: 0, nextPower: 0,
    hudKey: '',
  })
  const centre = useMemo(() => new THREE.Vector3(...def.position), [def])
  const mobRefs = useRef<(THREE.Mesh | null)[]>([]), shotRefs = useRef<(THREE.Mesh | null)[]>([]), coinRefs = useRef<(THREE.Mesh | null)[]>([])
  const cannonRefs = useRef<(THREE.Mesh | null)[]>([]), iconRefs = useRef<(THREE.Mesh | null)[]>([])
  const bubble = useRef<THREE.Mesh>(null), shotMat = useRef<THREE.MeshBasicMaterial>(null)
  const m1 = useRef<THREE.Mesh>(null), m2 = useRef<THREE.Mesh>(null), m3 = useRef<THREE.Mesh>(null), spark = useRef<THREE.Mesh>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, rawDt) => {
    if (state.camera.position.distanceTo(centre) > 80) return // paused while the island is far away
    const dt = Math.min(rawDt, 0.05), s = sim.current, time = state.clock.elapsedTime
    const powerName = s.power >= 0 ? POWERUPS[s.power] : ''

    // ---- waves: spawn the monsters one by one, pause when the wave is cleared, then the next wave
    if (s.spawned < WAVE.length) {
      s.spawnIn -= dt
      if (s.spawnIn <= 0) {
        const mob = s.mobs[s.spawned]
        mob.active = true
        mob.d = 0
        mob.dying = 0
        mob.hp = KINDS[WAVE[s.spawned]].hp + Math.floor((s.wave - 1) / 2)
        s.spawned++
        s.spawnIn = SPAWN_GAP
      }
    } else if (s.mobs.every((mob) => !mob.active)) {
      s.pause += dt
      if (s.pause > WAVE_PAUSE) {
        s.pause = 0
        s.spawned = 0
        s.spawnIn = 0.5
        s.wave++
      }
    }

    // ---- monsters walk the lane
    s.mobs.forEach((mob, i) => {
      const mesh = mobRefs.current[i]
      if (!mesh) return
      if (!mob.active) {
        mesh.visible = false
        return
      }
      const kind = KINDS[WAVE[i]]
      if (mob.dying > 0) {
        mob.dying -= dt * 4
        mesh.scale.setScalar(Math.max(0.001, mob.dying))
        if (mob.dying <= 0) mob.active = false
        return
      }
      mob.d += kind.speed * dt
      if (mob.d >= g.length) {
        // reached the gate: the shield absorbs it, otherwise the castle loses a life
        mob.active = false
        if (powerName !== 'shield') s.lives--
        if (s.lives <= 0) {
          s.lives = 3
          s.wave = 1
          s.coins = 0
        }
        return
      }
      g.curve.getPointAt(mob.d / g.length, tmp)
      mob.x = tmp.x
      mob.z = tmp.z
      const tan = g.curve.getTangentAt(mob.d / g.length)
      const hop = WAVE[i] === 1 ? Math.sin(time * 9 + i) * 0.08 : Math.abs(Math.sin(time * (WAVE[i] === 2 ? 4 : 7) + i)) * 0.12
      mesh.visible = true
      mesh.scale.setScalar(1)
      mesh.position.set(mob.x, groundY(def, mob.x, mob.z) + hop, mob.z)
      mesh.rotation.y = Math.atan2(tan.x, tan.z)
    })

    // ---- cannons: each one aims at the monster furthest along the lane that is in range, and fires
    cannonAt.forEach((at, i) => {
      s.cool[i] -= dt * (powerName === 'rapid' ? 2 : 1)
      s.recoil[i] = Math.max(0, s.recoil[i] - dt * 5)
      let target = -1
      s.mobs.forEach((mob, k) => {
        if (!mob.active || mob.dying > 0 || mob.hp <= 0) return
        if (Math.hypot(mob.x - at[0], mob.z - at[2]) < CANNON_RANGE && (target < 0 || mob.d > s.mobs[target].d)) target = k
      })
      if (target >= 0) {
        const mob = s.mobs[target]
        s.aim[i] = Math.atan2(mob.x - at[0], mob.z - at[2]) - FACE_YAW
        if (s.cool[i] <= 0) {
          const shot = s.shots.find((q) => !q.active)
          if (shot) {
            Object.assign(shot, { active: true, t: 0, fx: at[0], fy: at[1], fz: at[2], target, dmg: CANNON_DAMAGE[i] * (powerName === 'fire' ? 2 : 1) })
            s.cool[i] = CANNON_COOLDOWN
            s.recoil[i] = 1
          }
        }
      }
      const mesh = cannonRefs.current[i]
      if (mesh) {
        mesh.rotation.y += (((s.aim[i] - mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8)
        mesh.scale.set(1, 1, 1 - s.recoil[i] * 0.22)
      }
    })

    // ---- cannonballs fly to their target and deal damage
    if (shotMat.current) shotMat.current.color.set(powerName === 'fire' ? '#ff6b4a' : '#2b2730')
    s.shots.forEach((shot, i) => {
      const mesh = shotRefs.current[i]
      if (!mesh) return
      mesh.visible = shot.active
      if (!shot.active) return
      shot.t += dt * 3.6
      const mob = s.mobs[shot.target], ty = groundY(def, mob.x, mob.z) + 0.45
      mesh.position.set(shot.fx + (mob.x - shot.fx) * shot.t, shot.fy + (ty - shot.fy) * shot.t + Math.sin(Math.PI * shot.t) * 0.7, shot.fz + (mob.z - shot.fz) * shot.t)
      if (shot.t < 1) return
      shot.active = false
      if (!mob.active || mob.dying > 0) return
      mob.hp -= shot.dmg
      if (mob.hp > 0) return
      // killed: drop a coin, add to the score, charge the power-up meter
      const kind = KINDS[WAVE[shot.target]]
      mob.dying = 1
      s.coins += kind.coins
      if (s.power < 0) s.charge = Math.min(CHARGE_FULL, s.charge + kind.charge)
      const fx = s.coinsFx.find((c) => c.t >= 1) ?? s.coinsFx[0]
      Object.assign(fx, { t: 0, x: mob.x, y: ty, z: mob.z })
    })

    // ---- power-ups: a full meter starts the next one in the cycle
    if (s.power >= 0) {
      s.powerLeft -= dt
      if (s.powerLeft <= 0) s.power = -1
    } else if (s.charge >= CHARGE_FULL) {
      s.power = s.nextPower
      s.nextPower = (s.nextPower + 1) % POWERUPS.length
      s.powerLeft = POWER_TIME
      s.charge = 0
    }
    iconRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const on = s.power === i
      mesh.rotation.y += dt * (on ? 5 : 1)
      mesh.position.y = 1.65 + Math.sin(time * 2 + i * 2) * 0.08 + (on ? 0.25 : 0)
      mesh.scale.setScalar(on ? 1.5 + Math.sin(time * 8) * 0.1 : 1)
    })
    if (bubble.current) {
      bubble.current.visible = powerName === 'shield'
      bubble.current.scale.setScalar(1 + Math.sin(time * 4) * 0.025)
    }

    // ---- coins pop up where monsters fall
    s.coinsFx.forEach((c, i) => {
      const mesh = coinRefs.current[i]
      if (!mesh) return
      mesh.visible = c.t < 1
      if (c.t >= 1) return
      c.t += dt * 1.3
      mesh.position.set(c.x, c.y + c.t * 1.3, c.z)
      mesh.rotation.y = c.t * 12
      mesh.scale.setScalar(1 - c.t * c.t * 0.6)
    })

    // ---- the merge demo: two level 1 cannons slide together and become a level 2
    const ph = time % 5.4
    const slide = Math.min(1, Math.max(0, (ph - 1) / 1.3)), merged = ph > 2.4 && ph < 4.8
    if (m1.current && m2.current && m3.current) {
      m1.current.visible = m2.current.visible = !merged && ph <= 2.4
      m1.current.position.x = -0.7 + slide * slide * 0.7
      m2.current.position.x = 0.7 - slide * slide * 0.7
      m3.current.visible = merged
      m3.current.scale.setScalar(1 + Math.max(0, 1 - (ph - 2.4) * 3) * 0.5)
    }
    if (spark.current) {
      const k = 1 - Math.abs(ph - 2.45) * 4
      spark.current.visible = k > 0
      spark.current.scale.setScalar(Math.max(0.01, k) * 1.1)
    }

    // ---- redraw the sign only when something on it changed
    const key = `${s.wave}|${s.lives}|${s.coins}|${s.charge}|${powerName}`
    if (key !== s.hudKey) {
      s.hudKey = key
      drawHud(hud.ctx, s.wave, s.lives, s.coins, s.charge, powerName)
      hud.tex.needsUpdate = true
    }
  })

  const away = Math.PI // cannons rest pointing away from the camera, at the lane
  return (
    <>
      <mesh geometry={g.lane} receiveShadow renderOrder={1}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-3} side={THREE.DoubleSide} />
      </mesh>
      <At def={def} xz={MERGE.cave} turn={0.98} scale={1.15}>
        <Body g={g.cave.body} />
        <Glow g={g.cave.glow} night={night} day="#d9c2ff" />
      </At>
      <At def={def} xz={MERGE.castle} scale={1.3} turn={-0.25}>
        <Body g={g.castle.body} />
        <Glow g={g.castle.glow} night={night} day="#e6d9a8" />
      </At>
      {/* the shield power-up */}
      <mesh ref={bubble} position={[castleXZ[0], castleY + 1.6, castleXZ[1]]} visible={false} renderOrder={3}>
        <sphereGeometry args={[4.4, 24, 16]} />
        <meshBasicMaterial color="#6fb6ff" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <At def={def} xz={MERGE.board}>
        <Body g={g.board.body} />
        <Glow g={g.board.glow} night={night} day="#e8c56a" />
        {g.cannons.map((geo, i) => (
          <mesh key={i} ref={(el) => void (cannonRefs.current[i] = el)} geometry={geo} position={[cannonX(i), 0.31, 0]} rotation={[0, away, 0]} castShadow>
            <meshLambertMaterial vertexColors />
          </mesh>
        ))}
        <sprite position={[0, 3.0, 0]} scale={[4.2, 0.63, 1]}>
          <spriteMaterial map={hud.tex} depthWrite={false} toneMapped={false} />
        </sprite>
      </At>

      {WAVE.map((kind, i) => (
        <mesh key={i} ref={(el) => void (mobRefs.current[i] = el)} geometry={g.monsters[kind]} visible={false} castShadow>
          <meshLambertMaterial vertexColors />
        </mesh>
      ))}
      {sim.current.shots.map((_, i) => (
        <mesh key={i} ref={(el) => void (shotRefs.current[i] = el)} visible={false}>
          <sphereGeometry args={[0.11, 8, 6]} />
          {i === 0 ? <meshBasicMaterial ref={shotMat} color="#2b2730" /> : <meshBasicMaterial color="#2b2730" />}
        </mesh>
      ))}
      {sim.current.coinsFx.map((_, i) => (
        <mesh key={i} ref={(el) => void (coinRefs.current[i] = el)} geometry={g.coin} visible={false}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      ))}

      {!simple && (
        <>
          {MERGE.shrines.map((xz, i) => (
            <At key={i} def={def} xz={xz}>
              <Body g={g.shrines[i]} />
              <mesh ref={(el) => void (iconRefs.current[i] = el)} geometry={g.icons[i]} position={[0, 1.65, 0]}>
                <meshLambertMaterial vertexColors emissive={['#2a5fa0', '#a07a10', '#a0301a'][i]} emissiveIntensity={night ? 1 : 0.45} />
              </mesh>
            </At>
          ))}
          <At def={def} xz={MERGE.mergePad} turn={0.25}>
            <Body g={g.pad} />
            <mesh ref={m1} geometry={g.cannons[0]} position={[-0.7, 0.27, 0]} rotation={[0, away, 0]} castShadow>
              <meshLambertMaterial vertexColors />
            </mesh>
            <mesh ref={m2} geometry={g.cannons[0]} position={[0.7, 0.27, 0]} rotation={[0, away, 0]} castShadow>
              <meshLambertMaterial vertexColors />
            </mesh>
            <mesh ref={m3} geometry={g.cannons[1]} position={[0, 0.27, 0]} rotation={[0, away, 0]} visible={false} castShadow>
              <meshLambertMaterial vertexColors />
            </mesh>
            <mesh ref={spark} position={[0, 0.8, 0]} visible={false}>
              <octahedronGeometry args={[0.5, 0]} />
              <meshBasicMaterial color="#fff3b0" toneMapped={false} />
            </mesh>
          </At>
        </>
      )}
    </>
  )
}

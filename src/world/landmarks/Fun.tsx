import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CHRONO, DASH, FACE_YAW, HARBOR, HOME_PIECES, JOURNEY, MERGE, SMILE, SUNK, WORKSHOP, groundY, type IslandDef } from '../layout'
import { player } from '../player'
import { CAST_MS, GEARS_PER_ISLAND, addSpots, emote, game, onCaught, sitAt, usePlay, type Spot } from '../play'
import { useStore } from '../../store'
import { sfx } from '../../audio'
import { profile } from '../../content'
import { C, box, gear, hex, merge } from './kit'

/**
 * Things to do on each island in Adventure Mode. Every island has one activity that earns its stamp, and five golden
 * gears to find. Nothing here shows or runs in the scroll tour.
 */

type XZ = [number, number]
const toast = (m: string) => useStore.getState().showToast(m)
const stamp = (island: string, m: string) => usePlay.getState().stamp(island, m)

/** Registers this island's action spots for as long as the island is on screen. */
function useSpots(island: string, make: () => Omit<Spot, 'island'>[]) {
  useEffect(() => addSpots(make().map((s) => ({ ...s, island }))), []) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Where a point in a landmark's own space (x right, z towards the camera) ends up on the island. */
function placed(origin: XZ, turn: number, scale: number, x: number, z: number): XZ {
  const a = FACE_YAW + turn, c = Math.cos(a), s = Math.sin(a)
  return [origin[0] + (x * c + z * s) * scale, origin[1] + (-x * s + z * c) * scale]
}

/* ---------------- golden gears ---------------- */

const gearGeo = gear(0.3, 0.1, 8, hex('#ffc93d'))

export function Gears({ def, at }: { def: IslandDef; at: [number, number, number][] }) {
  const adventure = useStore((s) => s.mode === 'adventure')
  const found = usePlay((s) => s.gears)
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame((state) => {
    if (!adventure) return
    const t = state.clock.elapsedTime, px = player.pos.x - def.position[0], py = player.pos.y - def.position[1], pz = player.pos.z - def.position[2]
    at.forEach(([x, y, z], i) => {
      const m = refs.current[i]
      if (!m || !m.visible) return
      m.rotation.y = t * 2 + i
      m.position.y = y + 1.0 + Math.sin(t * 2.4 + i) * 0.12
      if (player.grounded && Math.hypot(px - x, pz - z) < 1.0 && Math.abs(py - y) < 2.4) usePlay.getState().collect(`${def.id}:${i}`)
    })
  })
  if (!adventure) return null
  return (
    <>
      {at.slice(0, GEARS_PER_ISLAND).map(([x, y, z], i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} geometry={gearGeo} position={[x, y + 1, z]} visible={!found.includes(`${def.id}:${i}`)}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

/* ---------------- one activity per island ---------------- */

function HomeFun({ def }: { def: IslandDef }) {
  const h = HOME_PIECES
  useSpots(def.id, () => [
    { xz: h.campfire, reach: 2.6, label: () => 'Sit by the fire', use: () => (sitAt(def.id, placed(h.campfire, 0.4, 1, 1.3, 0.4), h.campfire), stamp(def.id, 'Home Isle: you took a break by the fire.')) }, // on the log seat
    { xz: h.arcade, reach: 2.0, label: () => 'Play Fruit Slice 3D (opens a new tab)', use: () => profile.highlight?.url && window.open(profile.highlight.url, '_blank', 'noopener') },
    { xz: h.postbox, reach: 1.9, label: () => 'Send Burhanuddin a message', use: () => useStore.setState({ advRead: 'contact' }) },
    { xz: h.screen, reach: 3.6, label: () => 'Watch the trailer', use: () => useStore.setState({ advRead: 'cinema' }) },
  ])
  return null
}

/** Chrono Rebellion: steal the future tech from the 1944 side and get it to the ship without the soldier catching you. */
function ChronoFun({ def }: { def: IslandDef }) {
  const carrying = useRef(false), crate = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => merge([box([0.5, 0.5, 0.5], hex('#3a3f4c')), box([0.52, 0.08, 0.52], hex('#7de3ff')), box([0.3, 0.3, 0.02], hex('#7de3ff'), [0, 0, 0.26])]), [])
  useSpots(def.id, () => [
    { xz: CHRONO.crate, reach: 2.1, label: () => (carrying.current ? null : 'Grab the future tech'), use: () => ((carrying.current = true), toast('Got it. Carry it to the ship on the landing pad, and stay out of the soldier’s sight.')) },
    {
      xz: CHRONO.pad, reach: 3.4, label: () => (carrying.current ? 'Load the tech onto the ship' : null),
      use: () => ((carrying.current = false), emote('cheer'), stamp(def.id, 'Chrono Rebellion: the future tech is back in 2145.')),
    },
  ])
  useEffect(() => onCaught((island) => island === def.id && carrying.current && ((carrying.current = false), toast('Spotted! The soldier took the tech back. Try again.'))), [def.id])
  useFrame((s) => {
    if (!crate.current) return
    crate.current.visible = carrying.current
    crate.current.position.set(player.pos.x - def.position[0], player.pos.y - def.position[1] + 2.5 + Math.sin(s.clock.elapsedTime * 3) * 0.06, player.pos.z - def.position[2])
    crate.current.rotation.y += 0.02
  })
  return (
    <mesh ref={crate} geometry={geo} visible={false}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  )
}

function MergeFun({ def }: { def: IslandDef }) {
  const names = ['the shield', 'rapid fire', 'fire power']
  useSpots(def.id, () =>
    MERGE.shrines.map((xz, i) => ({
      xz, reach: 2.0, label: () => `Trigger ${names[i]}`,
      use: () => ((game.mergePower = i), stamp(def.id, `Merge Defence: ${names[i]} is active. Watch the cannons.`)),
    })),
  )
  return null
}

/**
 * Behind the Smile: do what the angel does in the game. Find out what the scared villager is hiding behind his mask,
 * deal with it, lift the mask and bin it. The other villagers can be greeted too; their smiles don't move.
 */
function SmileFun({ def }: { def: IslandDef }) {
  const step = useRef(0)
  const lines = ['“Lovely day! Everything is fine.” The painted smile doesn’t move.', '“No complaints here.” You can’t see his eyes behind the mask.', '“We always smile in this town.” Her voice is very quiet.', '“Busy, busy! All good!” He hurries past.', '“Smile! It’s easier.” She adjusts her mask.']
  useSpots(def.id, () => [
    {
      xz: SMILE.scared, reach: 1.9,
      label: () => (step.current === 0 ? 'Ask this villager what’s wrong' : step.current === 2 ? 'Lift his mask' : null),
      use: () => {
        if (step.current === 0) return void ((step.current = 1), toast('He points a shaking hand at the street lamp. “The… the spider.” Go and deal with it.'))
        step.current = 3
        toast('The mask comes off. He’s smiling for real this time. Take the mask to the basket.')
      },
    },
    { xz: SMILE.lamp, reach: 2.0, label: () => (step.current === 1 ? 'Shoo the spider away' : null), use: () => ((step.current = 2), sfx('hop'), toast('The spider scuttles off. Go back and tell him it’s safe.')) },
    {
      xz: SMILE.basket, reach: 2.0,
      label: () => (step.current === 3 ? 'Drop the mask in the basket' : null),
      use: () => ((step.current = 0), emote('cheer'), stamp(def.id, 'Behind the Smile: one real smile, one less mask.')),
    },
    ...SMILE.villagers.map((xz, i) => ({ xz, reach: 1.7, label: () => 'Say hello', use: () => toast(lines[i % lines.length]) })),
  ])
  return null
}

/** Sunken Greed: search the three marked spots (all empty), then the chest opens. */
function SunkenFun({ def }: { def: IslandDef }) {
  const searched = useRef([false, false, false])
  const empty = ['Nothing but sand.', 'An empty chest. Someone got here first.', 'Just an old boot.']
  useSpots(def.id, () => [
    ...SUNK.spots.map((xz, i) => ({ xz, reach: 2.0, label: () => (searched.current[i] ? null : 'Search this spot'), use: () => ((searched.current[i] = true), toast(empty[i])) })),
    {
      xz: SUNK.chest, reach: 2.4,
      label: () => (searched.current.every(Boolean) ? 'Open the treasure chest' : `Chest is locked: search the marked spots first (${searched.current.filter(Boolean).length}/3)`),
      use: () => {
        if (!searched.current.every(Boolean)) return toast('The chest won’t budge. Search the three marked spots first.')
        searched.current = [false, false, false]
        emote('cheer')
        stamp(def.id, 'Sunken Greed: treasure found, after three empty spots.')
      },
    },
  ])
  return null
}

/** Paper Plane Dash: a sprint along the street, timed. */
function DashFun({ def }: { def: IslandDef }) {
  const start: XZ = DASH.at(1.4, -2.3), finish: XZ = DASH.at(DASH.len - 1.2, -2.3)
  const race = useRef({ on: false, t: 0, best: Infinity })
  const flag = useMemo(() => merge([box([0.06, 2.2, 0.06], C.ink, [0, 1.1, 0]), box([0.7, 0.45, 0.03], hex('#ffffff'), [0.36, 1.95, 0]), box([0.35, 0.22, 0.035], C.ink, [0.19, 2.06, 0]), box([0.35, 0.22, 0.035], C.ink, [0.54, 1.84, 0])]), [])
  const adventure = useStore((s) => s.mode === 'adventure')
  useSpots(def.id, () => [
    { xz: start, reach: 2.0, label: () => (race.current.on ? null : 'Start a sprint down the street'), use: () => ((race.current.on = true), (race.current.t = 0), toast('Go! Run to the chequered flag at the far gate. Hold Shift (RT / R2) to run.')) },
  ])
  useFrame((_, dt) => {
    const r = race.current
    if (!r.on) return
    r.t += dt
    const d = Math.hypot(player.pos.x - def.position[0] - finish[0], player.pos.z - def.position[2] - finish[1])
    if (d < 1.7) {
      r.on = false
      const record = r.t < r.best
      r.best = Math.min(r.best, r.t)
      emote('cheer')
      stamp(def.id, `Paper Plane Dash: ${r.t.toFixed(2)} s${record ? ' (a new best)' : `, best ${r.best.toFixed(2)} s`}.`)
    } else if (r.t > 40) {
      r.on = false
      toast('Sprint timed out. Head back to the start to try again.')
    }
  })
  if (!adventure) return null
  return (
    <>
      {[start, finish].map((q, i) => (
        <mesh key={i} geometry={flag} position={[q[0], groundY(def, q[0], q[1]), q[1]]}>
          <meshLambertMaterial vertexColors />
        </mesh>
      ))}
    </>
  )
}

/** The Harbor: fishing with the cargo crane. Its line goes down over the edge and comes back with something on it. */
function HarborFun({ def }: { def: IslandDef }) {
  const busy = useRef(false)
  const catches = ['a Cloud Trout', 'a Sky Sardine', 'a slightly soggy paper plane', 'a lost energy cell', 'an old boot', 'a Moonfish', 'a tangle of kite string', 'a Gilded Koi']
  useEffect(() => () => void (busy.current = false), [])
  useSpots(def.id, () => [
    {
      xz: HARBOR.crane, reach: 2.4, label: () => (busy.current ? 'Waiting for a bite…' : 'Cast the crane’s line'),
      use: () => {
        if (busy.current) return
        busy.current = true
        game.harborCast = performance.now()
        window.setTimeout(() => sfx('splash'), CAST_MS * 0.45)
        window.setTimeout(() => {
          if (!busy.current) return
          busy.current = false
          stamp(def.id, `The Harbor: you caught ${catches[Math.floor(Math.random() * catches.length)]}.`)
        }, CAST_MS)
      },
    },
  ])
  return null
}

function WorkshopFun({ def }: { def: IslandDef }) {
  const hits = useRef(0)
  useSpots(def.id, () => [
    {
      xz: WORKSHOP.anvil, reach: 2.0, label: () => `Strike the anvil (${hits.current}/5)`,
      use: () => {
        sfx('clank')
        if (++hits.current < 5) return
        hits.current = 0
        emote('cheer')
        stamp(def.id, 'Workshop Isle: five strikes, one freshly forged gear.')
      },
    },
  ])
  return null
}

function JourneyFun({ def }: { def: IslandDef }) {
  useSpots(def.id, () => [{ xz: JOURNEY.camp, reach: 3.0, label: () => 'Take a seat by the fire', use: () => (sitAt(def.id, placed(JOURNEY.camp, 0.2, 1.15, 2.0, 0.7), placed(JOURNEY.camp, 0.2, 1.15, 0.9, 0.5)), stamp(def.id, 'Journey Isle: this seat was saved for your team.')) }])
  return null
}

export function Fun({ def }: { def: IslandDef }) {
  switch (def.id) {
    case 'home': return <HomeFun def={def} />
    case 'chrono-rebellion': return <ChronoFun def={def} />
    case 'merge-defence': return <MergeFun def={def} />
    case 'behind-the-smile': return <SmileFun def={def} />
    case 'sunken-greed': return <SunkenFun def={def} />
    case 'paper-plane-dash': return <DashFun def={def} />
    case 'harbor': return <HarborFun def={def} />
    case 'workshop': return <WorkshopFun def={def} />
    case 'journey': return <JourneyFun def={def} />
    default: return null
  }
}

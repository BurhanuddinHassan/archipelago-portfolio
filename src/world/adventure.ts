import * as THREE from 'three'
import { ISLANDS, MOOR_DIR, STOPS, groundY, rimRadius, solidSpots, type IslandDef } from './layout'
import type { Placement } from './islandGen'
import { SEAT } from './SkyShip'
import { player } from './player'
import { useStore } from '../store'
import { readInput } from './input'

/**
 * Adventure Mode: the Pilot is driven directly instead of by scrolling.
 * On foot he walks an island (kept inside its rim and out of buildings, trees and rocks); beside the ship he can board;
 * the ship sails anywhere between the islands (it can't pass through one) and he can land on any island it is next to.
 */

type Circle = [number, number, number]
type Hop = { from: THREE.Vector3; to: THREE.Vector3; t: number; then: 'foot' | 'ship'; island: number }

const WALK = 2.7, RUN = 5.2, JUMP = 7.5, GRAVITY = 22, BODY = 0.38
const SHIP_SPEED = 12, SHIP_BOOST = 1.7, SHIP_TURN = 1.7, SHIP_GAP = 1.9, HOVER = 0.9
const BOARD_REACH = 5.5, LAND_REACH = 5.0, WORLD_EDGE = 92, HOP_TIME = 0.55
const MOOR_YAW = Math.atan2(MOOR_DIR[0], MOOR_DIR[1])

const lerpAngle = (a: number, b: number, k: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * k
}

/** Everything solid on each island: landmarks plus the trees, rocks, stumps and logs that grew there. */
export function buildColliders(placements: Record<string, Placement[]>): Circle[][] {
  return ISLANDS.map((def) => {
    const list: Circle[] = solidSpots(def)
    for (const p of placements[def.id] ?? []) {
      const k = p.kind
      const r = k.startsWith('tree') || k.startsWith('pine') || k === 'birch' ? 0.34 : k.startsWith('rock') ? 0.5 : k === 'stump' ? 0.3 : k === 'log' ? 0.45 : k.startsWith('bush') ? 0.38 : 0
      if (r) list.push([p.x, p.z, Math.min(0.85, Math.max(0.25, r * p.scale))])
    }
    return list
  })
}

export type AdventureCtx = {
  dt: number
  time: number
  camera: THREE.Camera
  pilot: THREE.Group
  ship: THREE.Group
  /** Mouse-drag deltas since the last frame (radians), consumed here. */
  drag: { dx: number; dy: number }
  /** Where the tour had the Pilot and the ship when Adventure Mode began. */
  start: { stand: THREE.Vector3; moor: THREE.Vector3; island: string }
}

export type AdventureOut = { pose: 'ground' | 'walk' | 'board' | 'sail' | 'land'; sailing: boolean; onShip: boolean }

export function createAdventure(colliders: Circle[][], islets: [number, number, number, number][] = []) {
  /** Where the ship drifts to after a landing: tucked against the rim, so it is always in reach to board again. */
  let dock: THREE.Vector3 | null = null
  const pos = new THREE.Vector3(), shipPos = new THREE.Vector3(), seat = new THREE.Vector3(), tmp = new THREE.Vector3(), camTarget = new THREE.Vector3()
  const s = { ready: false, on: 'foot' as 'foot' | 'ship', island: 0, yaw: 0, vy: 0, air: false, shipYaw: MOOR_YAW, shipSpeed: 0, camYaw: 0.62, camPitch: 1.12, camDist: 9, lastLook: -10, hop: null as Hop | null, key: '' }
  const centre = (i: number) => ISLANDS[i].position
  const local = (i: number, v: THREE.Vector3): [number, number] => [v.x - centre(i)[0], v.z - centre(i)[2]]
  const floor = (i: number, lx: number, lz: number) => centre(i)[1] + groundY(ISLANDS[i], lx, lz)

  /** Pushes a point (island-local) inside the rim and out of every solid thing. */
  const resolve = (i: number, lx: number, lz: number): [number, number] => {
    for (let pass = 0; pass < 3; pass++) {
      for (const [cx, cz, cr] of colliders[i]) {
        const dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz), min = cr + BODY
        if (d < min) {
          const k = d > 0.001 ? min / d : 1
          lx = cx + (d > 0.001 ? dx * k : min)
          lz = cz + dz * k
        }
      }
      const r = Math.hypot(lx, lz), max = rimRadius(ISLANDS[i], Math.atan2(lz, lx)) * 0.9
      if (r > max) {
        lx *= max / r
        lz *= max / r
      }
    }
    return [lx, lz]
  }

  /** The island whose rim is nearest to a point, and how far outside that rim the point is. */
  const nearest = (v: THREE.Vector3) => {
    let best = 0, gap = Infinity
    ISLANDS.forEach((def, i) => {
      const [lx, lz] = local(i, v), g = Math.hypot(lx, lz) - rimRadius(def, Math.atan2(lz, lx))
      if (g < gap) {
        gap = g
        best = i
      }
    })
    return { island: best, gap }
  }

  const publish = (place: string, act: string | null, tip: string | null, read: string | null, pad: boolean, island: string, ship: boolean) => {
    const key = `${place}|${act}|${tip}|${read}|${pad}|${island}|${ship}`
    if (key === s.key) return
    s.key = key
    useStore.setState({ adv: { place, act, tip, read, pad, island, ship } })
  }

  function begin(c: AdventureCtx) {
    s.ready = true
    s.on = 'foot'
    s.island = Math.max(0, ISLANDS.findIndex((d) => d.id === c.start.island))
    pos.copy(c.start.stand)
    shipPos.copy(c.start.moor)
    s.shipYaw = MOOR_YAW
    s.shipSpeed = 0
    s.vy = 0
    s.air = false
    s.hop = null
    s.yaw = c.pilot.rotation.y
    s.camYaw = Math.atan2(c.camera.position.x - pos.x, c.camera.position.z - pos.z)
    s.camPitch = 1.12
    camTarget.copy(pos)
    s.key = ''
  }

  function step(c: AdventureCtx): AdventureOut {
    if (!s.ready) begin(c)
    const { dt, time } = c, input = readInput(), store = useStore.getState()
    let pose: AdventureOut['pose'] = 'ground', sailing = false

    // ---- look: mouse drag, arrow keys, right stick
    const look = input.lx * dt + c.drag.dx, tilt = input.ly * dt + c.drag.dy
    c.drag.dx = 0
    c.drag.dy = 0
    if (look || tilt) s.lastLook = time
    s.camYaw -= look
    s.camPitch = Math.min(1.42, Math.max(0.45, s.camPitch - tilt))

    // ---- the info card is open: everything else waits; F, Esc or B closes it
    if (store.advRead) {
      if (input.read || input.exit) useStore.setState({ advRead: null })
      input.mx = input.my = 0
      input.jump = input.act = input.read = input.exit = false
    }
    if (input.exit) {
      store.setMode('tour')
      return { pose: 'ground', sailing: false, onShip: s.on === 'ship' }
    }

    // ---- the ship bobs wherever it is
    const bob = Math.sin(time * 1.3) * 0.08
    const def: IslandDef = ISLANDS[s.island]
    let act: string | null = null, read: string | null = null, tip: string | null = null, place = def.name

    if (s.hop) {
      // mid-hop between the ground and the ship's bench
      const h = s.hop
      h.t = Math.min(1, h.t + dt / HOP_TIME)
      const k = h.t * h.t * (3 - 2 * h.t)
      if (h.then === 'ship') h.to.copy(seat)
      else h.from.copy(seat)
      pos.lerpVectors(h.from, h.to, k)
      pos.y += Math.sin(Math.PI * k) * 1.0
      pose = h.then === 'ship' ? 'board' : 'land'
      if (h.t >= 1) {
        s.on = h.then
        s.island = h.island
        s.hop = null
        s.air = false
        s.vy = 0
      }
    } else if (s.on === 'foot') {
      // ---- walking: move relative to the camera, slide along anything solid
      let [lx, lz] = local(s.island, pos)
      const moving = Math.hypot(input.mx, input.my) > 0.05
      if (moving) {
        const fx = -Math.sin(s.camYaw), fz = -Math.cos(s.camYaw), rx = Math.cos(s.camYaw), rz = -Math.sin(s.camYaw)
        const vx = rx * input.mx + fx * input.my, vz = rz * input.mx + fz * input.my, speed = input.run ? RUN : WALK
        lx += vx * speed * dt
        lz += vz * speed * dt
        s.yaw = lerpAngle(s.yaw, Math.atan2(vx, vz), 1 - Math.exp(-dt * 12))
        ;[lx, lz] = resolve(s.island, lx, lz)
        pose = 'walk'
      }
      const ground = floor(s.island, lx, lz)
      if (input.jump && !s.air) {
        s.air = true
        s.vy = JUMP
      }
      let y = ground
      if (s.air) {
        s.vy -= GRAVITY * dt
        y = pos.y + s.vy * dt
        if (y <= ground) {
          y = ground
          s.air = false
        }
      }
      pos.set(centre(s.island)[0] + lx, y, centre(s.island)[2] + lz)
      c.pilot.rotation.set(0, s.yaw, 0)
      // what can he do here?
      const stop = STOPS.filter((st) => st.island === def.id).sort((a, b) => Math.hypot(a.offset[0] - lx, a.offset[1] - lz) - Math.hypot(b.offset[0] - lx, b.offset[1] - lz))[0]
      if (stop) read = stop.id
      if (Math.hypot(pos.x - shipPos.x, pos.z - shipPos.z) < BOARD_REACH) {
        act = 'Board the ship'
        if (input.act) s.hop = { from: pos.clone(), to: new THREE.Vector3(), t: 0, then: 'ship', island: s.island }
      }
      if (input.read && stop) useStore.setState({ advRead: stop.id })
      player.running = moving && input.run
      if (dock) {
        shipPos.lerp(dock, 1 - Math.exp(-dt * 1.6))
        s.shipYaw = lerpAngle(s.shipYaw, Math.atan2(-(dock.z - centre(s.island)[2]), dock.x - centre(s.island)[0]), 1 - Math.exp(-dt * 1.6))
      }
    } else {
      // ---- sailing: W/S throttle, A/D steer; the ship rides at the height of whichever island it is near
      const top = SHIP_SPEED * (input.run ? SHIP_BOOST : 1)
      const want = input.my >= 0 ? input.my * top : input.my * top * 0.45
      s.shipSpeed += (want - s.shipSpeed) * (1 - Math.exp(-dt * 1.8))
      s.shipYaw -= input.mx * SHIP_TURN * dt * (0.35 + 0.65 * Math.min(1, Math.abs(s.shipSpeed) / 4 + 0.3))
      shipPos.x += Math.sin(s.shipYaw) * s.shipSpeed * dt
      shipPos.z += Math.cos(s.shipYaw) * s.shipSpeed * dt
      // islands are solid: slide round the rim
      let wy = 0, wsum = 0
      ISLANDS.forEach((d, i) => {
        const [lx, lz] = local(i, shipPos), dist = Math.hypot(lx, lz), min = rimRadius(d, Math.atan2(lz, lx)) + SHIP_GAP
        if (dist < min && dist > 0.001) {
          // eased, so a ship that was moored over the grass drifts out to the rim instead of jumping there
          const push = Math.min(min - dist, Math.max(SHIP_SPEED * 1.5 * dt, (min - dist) * 0.2))
          shipPos.x += (lx / dist) * push
          shipPos.z += (lz / dist) * push
        }
        const w = 1 / (Math.max(0.5, dist - min + 1.5) ** 2)
        wy += w * (centre(i)[1] + 0.6 + HOVER)
        wsum += w
      })
      // the small islets between the islands are solid too (unless the ship is well above or below one)
      for (const [ix, iy, iz, ir] of islets) {
        const dx = shipPos.x - ix, dz = shipPos.z - iz, dist = Math.hypot(dx, dz), min = ir * 1.12 + SHIP_GAP * 0.8
        if (dist < min && dist > 0.001 && shipPos.y - iy < 4 && shipPos.y - iy > -ir * 2.4) {
          shipPos.x = ix + (dx / dist) * min
          shipPos.z = iz + (dz / dist) * min
        }
      }
      dock = null
      const out = Math.hypot(shipPos.x, shipPos.z)
      if (out > WORLD_EDGE) {
        shipPos.x *= WORLD_EDGE / out
        shipPos.z *= WORLD_EDGE / out
      }
      shipPos.y += (wy / wsum - shipPos.y) * (1 - Math.exp(-dt * 1.4))
      sailing = Math.abs(s.shipSpeed) > 0.6
      pose = 'sail'
      const near = nearest(shipPos)
      place = near.gap < LAND_REACH ? `Sailing near ${ISLANDS[near.island].name}` : 'Sailing the open sky'
      if (near.gap < LAND_REACH && Math.abs(s.shipSpeed) < 5) {
        act = `Land on ${ISLANDS[near.island].name}`
        if (input.act) {
          const i = near.island, [lx, lz] = local(i, shipPos), ang = Math.atan2(lz, lx), r = rimRadius(ISLANDS[i], ang) * 0.82
          const [tx, tz] = resolve(i, Math.cos(ang) * r, Math.sin(ang) * r)
          s.hop = { from: new THREE.Vector3(), to: new THREE.Vector3(centre(i)[0] + tx, floor(i, tx, tz), centre(i)[2] + tz), t: 0, then: 'foot', island: i }
          s.shipSpeed = 0
          const dr = rimRadius(ISLANDS[i], ang) + SHIP_GAP
          dock = new THREE.Vector3(centre(i)[0] + Math.cos(ang) * dr, centre(i)[1] + 0.6 + HOVER, centre(i)[2] + Math.sin(ang) * dr)
          s.yaw = Math.atan2(-lx, -lz) // face inland
        }
      } else if (near.gap < LAND_REACH) tip = 'Slow down to land'
      if (!look && time - s.lastLook > 1.2) s.camYaw = lerpAngle(s.camYaw, s.shipYaw + Math.PI, 1 - Math.exp(-dt * 2.2))
    }

    // ---- place the ship, then the Pilot on it if he's aboard
    c.ship.position.set(shipPos.x, shipPos.y + bob, shipPos.z)
    c.ship.rotation.set(0, s.shipYaw, Math.sin(time * 0.9) * 0.03 - (s.on === 'ship' ? input.mx * 0.12 * Math.min(1, Math.abs(s.shipSpeed) / 6) : 0), 'YXZ')
    c.ship.updateMatrixWorld()
    seat.copy(SEAT).applyMatrix4(c.ship.matrixWorld)
    if (s.on === 'ship' && !s.hop) {
      pos.copy(seat)
      c.pilot.quaternion.copy(c.ship.quaternion)
    } else if (s.hop) c.pilot.rotation.set(0, lerpAngle(c.pilot.rotation.y, s.hop.then === 'ship' ? s.shipYaw : s.yaw, 1 - Math.exp(-dt * 10)), 0)
    c.pilot.position.copy(pos)
    player.pos.copy(pos)
    player.grounded = s.on === 'foot' && !s.hop

    // ---- camera: behind and above, further back when sailing
    s.camDist += ((s.on === 'ship' ? 18 : 11.5) - s.camDist) * (1 - Math.exp(-dt * 2.5))
    tmp.setFromSphericalCoords(s.camDist, s.camPitch, s.camYaw).add(pos)
    const k = 1 - Math.exp(-dt * 6)
    c.camera.position.lerp(tmp, k)
    camTarget.lerp(pos, 1 - Math.exp(-dt * 10))
    c.camera.lookAt(camTarget.x, camTarget.y + 1.2, camTarget.z)

    const hereIsland = s.on === 'ship' ? ISLANDS[nearest(shipPos).island].id : ISLANDS[s.island].id
    publish(place, s.hop ? null : act, tip, s.on === 'foot' && !s.hop ? read : null, input.pad, hereIsland, s.on === 'ship')
    return { pose, sailing, onShip: s.on === 'ship' }
  }

  return { step, reset: () => void (s.ready = false) }
}

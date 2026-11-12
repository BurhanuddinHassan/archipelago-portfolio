import * as THREE from 'three'
import { groundY, type IslandDef } from '../layout'

/**
 * A round patch that hugs the island's ground (paving, sand, a pond): a polar grid whose every vertex sits on
 * the surface. `colour(rho, angle)` picks the colour per vertex; the rim wobbles a little so it doesn't look stamped.
 */
export function groundPatch(def: IslandDef, centre: [number, number], radius: number, colour: (rho: number, angle: number) => THREE.Color, lift = 0.05) {
  const SEG = 28, RINGS = 5, pos: number[] = [], col: number[] = [], idx: number[] = []
  for (let r = 0; r <= RINGS; r++)
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2, rho = r / RINGS
      const rad = radius * rho * (1 + (r === RINGS ? Math.sin(a * 5 + radius) * 0.06 + Math.sin(a * 9) * 0.03 : 0))
      const x = centre[0] + Math.cos(a) * rad, z = centre[1] + Math.sin(a) * rad
      pos.push(x, groundY(def, x, z) + lift, z)
      const c = colour(rho, a)
      col.push(c.r, c.g, c.b)
      if (r > 0) {
        const a0 = (r - 1) * SEG + s, a1 = (r - 1) * SEG + ((s + 1) % SEG), b0 = r * SEG + s, b1 = r * SEG + ((s + 1) % SEG)
        idx.push(a0, a1, b0, a1, b1, b0)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  // lit as flat ground whichever way the triangles wind
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  return g
}

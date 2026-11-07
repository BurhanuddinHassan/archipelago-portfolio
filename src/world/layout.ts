/** World layout: where each island floats and where each tour stop stands. */

export type IslandDef = {
  id: string
  name: string
  position: [number, number, number]
  radius: number
  accent: string
}

export const ISLANDS: IslandDef[] = [
  { id: 'home', name: 'Home Isle', position: [0, 0, 0], radius: 7, accent: '#F26B3A' },
  { id: 'behind-the-smile', name: 'Behind the Smile', position: [-20, 3, -18], radius: 4.5, accent: '#C94F6D' },
  { id: 'chrono-rebellion', name: 'Chrono Rebellion', position: [2, 5, -32], radius: 5, accent: '#7B61C9' },
  { id: 'sunken-greed', name: 'Sunken Greed', position: [24, -1, -20], radius: 4.5, accent: '#2F8F9D' },
  { id: 'paper-plane-dash', name: 'Paper Plane Dash', position: [32, 4, 2], radius: 4.5, accent: '#F2B33D' },
  { id: 'merge-defence', name: 'Merge Defence', position: [20, 1, 22], radius: 4.5, accent: '#5DA05A' },
  { id: 'harbor', name: 'The Harbor', position: [-4, -1.5, 18], radius: 4, accent: '#3E6E8E' },
  { id: 'workshop', name: 'Workshop Isle', position: [-24, 2, 10], radius: 4, accent: '#B07A45' },
  { id: 'journey', name: 'Journey Isle', position: [-30, 0, -6], radius: 4.5, accent: '#8C8C3A' },
]

export type StopDef = {
  id: string
  label: string
  island: string
  /** Where the Pilot stands, relative to the island centre. */
  offset: [number, number, number]
}

export const STOPS: StopDef[] = [
  { id: 'home', label: 'Home', island: 'home', offset: [1.5, 0, 2] },
  { id: 'behind-the-smile', label: 'Behind the Smile', island: 'behind-the-smile', offset: [0, 0, 1] },
  { id: 'chrono-rebellion', label: 'Chrono Rebellion', island: 'chrono-rebellion', offset: [0, 0, 1] },
  { id: 'sunken-greed', label: 'Sunken Greed', island: 'sunken-greed', offset: [0, 0, 1] },
  { id: 'paper-plane-dash', label: 'Paper Plane Dash', island: 'paper-plane-dash', offset: [0, 0, 1] },
  { id: 'merge-defence', label: 'Merge Defence', island: 'merge-defence', offset: [0, 0, 1] },
  { id: 'harbor', label: 'More work', island: 'harbor', offset: [0, 0, 1] },
  { id: 'workshop', label: 'Skills', island: 'workshop', offset: [0, 0, 1] },
  { id: 'journey', label: 'Journey', island: 'journey', offset: [0, 0, 1] },
  { id: 'cinema', label: 'Trailer', island: 'home', offset: [-3.5, 0, -2] },
  { id: 'contact', label: 'Contact', island: 'home', offset: [3.5, 0, -2.5] },
]

export const islandById = (id: string) => ISLANDS.find((i) => i.id === id)!

/** Top surface height of an island (the grass sits this far above its centre). */
export const ISLAND_TOP = 0.6

export function stopAnchor(stop: StopDef): [number, number, number] {
  const i = islandById(stop.island)
  return [i.position[0] + stop.offset[0], i.position[1] + ISLAND_TOP + stop.offset[1], i.position[2] + stop.offset[2]]
}

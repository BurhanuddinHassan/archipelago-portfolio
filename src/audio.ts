import { HOME_PIECES, ISLANDS, JOURNEY, islandById, waterfallSpot } from './world/layout'

/**
 * All sound, made in the browser with the Web Audio API: no audio files to download or license.
 *  - Ambience: wind, a slow generative melody, crickets at night.
 *  - Places: campfires crackle and waterfalls rush, louder as the Pilot gets closer.
 *  - The ship: an engine hum that follows its speed.
 *  - Effects: footsteps, jump and landing, hopping aboard, gear pickups, stamps, buttons.
 * Browsers only allow sound after the visitor has clicked or pressed a key, so nothing plays before that.
 */

export type Sfx = 'step' | 'jump' | 'land' | 'hop' | 'use' | 'gear' | 'stamp' | 'caught' | 'open' | 'close' | 'clank' | 'splash' | 'mode'

let ctx: AudioContext | null = null
let master: GainNode, noise: AudioBuffer, musicBus: GainNode
let enabled = true
let night = false
const level = { ship: null as GainNode | null, fire: null as GainNode | null, water: null as GainNode | null, crickets: null as GainNode | null }
let shipOsc: OscillatorNode[] = []
let fireLevel = 0

const VOLUME = 0.5

try {
  enabled = localStorage.getItem('sound') !== 'off'
} catch {
  /* private browsing */
}
export const soundEnabled = () => enabled

/** Where the campfires and waterfalls are, in world space. */
const emitters: { kind: 'fire' | 'water'; x: number; y: number; z: number; range: number }[] = (() => {
  const out: { kind: 'fire' | 'water'; x: number; y: number; z: number; range: number }[] = []
  const home = islandById('home'), journey = islandById('journey')
  out.push({ kind: 'fire', x: home.position[0] + HOME_PIECES.campfire[0], y: home.position[1], z: home.position[2] + HOME_PIECES.campfire[1], range: 9 })
  out.push({ kind: 'fire', x: journey.position[0] + JOURNEY.camp[0], y: journey.position[1], z: journey.position[2] + JOURNEY.camp[1], range: 9 })
  for (const def of ISLANDS) {
    const w = waterfallSpot(def)
    if (w) out.push({ kind: 'water', x: def.position[0] + w.pond[0], y: def.position[1], z: def.position[2] + w.pond[1], range: 15 })
  }
  return out
})()

function loop(buffer: AudioBuffer) {
  const src = ctx!.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.start()
  return src
}
function filter(type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx!.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}
function gain(v: number, to: AudioNode = master) {
  const g = ctx!.createGain()
  g.gain.value = v
  g.connect(to)
  return g
}

/** Starts the audio engine. Safe to call many times; does nothing until the first real click or key press. */
export function initAudio() {
  if (ctx) return void (enabled && ctx.state === 'suspended' && ctx.resume())
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = enabled ? VOLUME : 0
  master.connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

  // wind: band-passed noise that slowly swells and shifts
  const wind = filter('bandpass', 420, 0.5), windGain = gain(0.02)
  loop(noise).connect(wind).connect(windGain)
  const swell = ctx.createOscillator(), swellDepth = ctx.createGain(), drift = ctx.createOscillator(), driftDepth = ctx.createGain()
  swell.frequency.value = 0.07
  swellDepth.gain.value = 0.011
  swell.connect(swellDepth).connect(windGain.gain)
  drift.frequency.value = 0.045
  driftDepth.gain.value = 180
  drift.connect(driftDepth).connect(wind.frequency)
  swell.start()
  drift.start()

  // the ship: two detuned low oscillators and some propeller wash
  level.ship = gain(0)
  const shipTone = filter('lowpass', 260)
  shipTone.connect(level.ship)
  shipOsc = [55, 82.6].map((f, i) => {
    const o = ctx!.createOscillator()
    o.type = i ? 'triangle' : 'sawtooth'
    o.frequency.value = f
    o.connect(shipTone)
    o.start()
    return o
  })
  const wash = filter('bandpass', 900, 0.8), washGain = gain(0.5, level.ship), chop = ctx.createOscillator(), chopDepth = ctx.createGain()
  loop(noise).connect(wash).connect(washGain)
  chop.frequency.value = 11
  chopDepth.gain.value = 0.3
  chop.connect(chopDepth).connect(washGain.gain)
  chop.start()

  // waterfalls and campfires: one voice each, as loud as the nearest one deserves
  level.water = gain(0)
  loop(noise).connect(filter('highpass', 250)).connect(filter('lowpass', 2400)).connect(level.water)
  level.fire = gain(0)
  loop(noise).connect(filter('lowpass', 520)).connect(level.fire)

  // crickets: a high tone chopped fast, in bursts
  level.crickets = gain(0)
  const chirp = ctx.createOscillator(), chirpAm = ctx.createGain(), fast = ctx.createOscillator(), burst = ctx.createOscillator(), burstAm = ctx.createGain()
  chirp.frequency.value = 4300
  // each gain sits at 0.5 and its square wave adds ±0.5, so the tone is switched fully on and off
  const half = (osc: OscillatorNode, target: GainNode) => {
    const depth = ctx!.createGain()
    depth.gain.value = 0.5
    target.gain.value = 0.5
    osc.connect(depth).connect(target.gain)
  }
  fast.type = 'square'
  fast.frequency.value = 19
  half(fast, chirpAm)
  burst.type = 'square'
  burst.frequency.value = 0.8
  half(burst, burstAm)
  chirp.connect(chirpAm).connect(burstAm).connect(level.crickets)
  chirp.start()
  fast.start()
  burst.start()

  // music: slow notes from a five-note scale through an echo
  musicBus = gain(0.045)
  const echo = ctx.createDelay(1), feedback = ctx.createGain()
  echo.delayTime.value = 0.42
  feedback.gain.value = 0.38
  musicBus.connect(echo)
  echo.connect(feedback).connect(echo)
  echo.connect(master)
  window.setTimeout(melody, 1500)
  window.setInterval(crackle, 110)

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else if (enabled) void ctx.resume()
  })
}

const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]
let lastNote = 3
function melody() {
  if (!ctx) return
  if (enabled && ctx.state === 'running') {
    // wander up and down the scale by small steps, now and then adding a harmony note
    lastNote = Math.max(0, Math.min(SCALE.length - 1, lastNote + Math.round((Math.random() - 0.5) * 4)))
    const f = SCALE[lastNote] * (night ? 0.5 : 1)
    pluck(f, 0.5)
    if (Math.random() < 0.3) pluck(SCALE[Math.max(0, lastNote - 2)] * (night ? 0.5 : 1), 0.3, 0.12)
    if (Math.random() < 0.18) pluck(f / 2, 0.35)
  }
  window.setTimeout(melody, (night ? 2600 : 1700) + Math.random() * 2600)
}
function pluck(freq: number, vol: number, delay = 0) {
  const t = ctx!.currentTime + delay, g = ctx!.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.04)
  g.gain.exponentialRampToValueAtTime(0.001, t + 3.2)
  g.connect(musicBus)
  ;(['sine', 'triangle'] as const).forEach((type, i) => {
    const o = ctx!.createOscillator(), og = ctx!.createGain()
    o.type = type
    o.frequency.value = freq * (i ? 2 : 1)
    og.gain.value = i ? 0.18 : 1
    o.connect(og).connect(g)
    o.start(t)
    o.stop(t + 3.3)
  })
}
function crackle() {
  if (!ctx || !enabled || fireLevel < 0.03 || Math.random() > 0.45) return
  burstOf(0.012 + Math.random() * 0.03, 1800 + Math.random() * 3500, fireLevel * (0.25 + Math.random() * 0.5), 'highpass')
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0, slideTo?: number) {
  const t = ctx!.currentTime + delay, o = ctx!.createOscillator(), g = ctx!.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}
function burstOf(dur: number, freq: number, vol: number, type: BiquadFilterType = 'bandpass', delay = 0) {
  const t = ctx!.currentTime + delay, src = ctx!.createBufferSource(), g = ctx!.createGain()
  src.buffer = noise
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(filter(type, freq, 1)).connect(g).connect(master)
  src.start(t, Math.random() * 1.5, dur + 0.05)
}

let stepFlip = false
/** Plays a one-off effect. Silent until the audio engine has started. */
export function sfx(name: Sfx) {
  if (!ctx || !enabled || ctx.state !== 'running') return
  switch (name) {
    case 'step':
      stepFlip = !stepFlip
      burstOf(0.07, stepFlip ? 620 : 480, 0.2, 'lowpass')
      break
    case 'jump':
      tone(240, 0.16, 0.12, 'sine', 0, 520)
      break
    case 'land':
      burstOf(0.12, 220, 0.4, 'lowpass')
      tone(110, 0.12, 0.2, 'sine', 0, 60)
      break
    case 'hop':
      burstOf(0.3, 1200, 0.12, 'bandpass')
      tone(330, 0.22, 0.08, 'triangle', 0, 660)
      break
    case 'use':
      tone(660, 0.08, 0.12, 'triangle')
      tone(880, 0.1, 0.1, 'triangle', 0.06)
      break
    case 'gear':
      tone(988, 0.12, 0.16, 'triangle')
      tone(1319, 0.3, 0.16, 'triangle', 0.09)
      break
    case 'stamp':
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.2, 0.16, 'triangle', i * 0.11))
      break
    case 'caught':
      tone(440, 0.2, 0.16, 'sawtooth', 0, 220)
      tone(220, 0.4, 0.16, 'sawtooth', 0.2, 110)
      break
    case 'open':
      tone(520, 0.1, 0.1, 'sine', 0, 780)
      break
    case 'close':
      tone(780, 0.1, 0.1, 'sine', 0, 520)
      break
    case 'clank':
      tone(1850, 0.35, 0.14, 'square')
      tone(2470, 0.25, 0.08, 'square')
      burstOf(0.05, 3000, 0.3, 'highpass')
      break
    case 'splash':
      burstOf(0.35, 1400, 0.25, 'bandpass')
      tone(300, 0.25, 0.08, 'sine', 0.02, 120)
      break
    case 'mode':
      tone(392, 0.15, 0.12, 'triangle')
      tone(587.33, 0.3, 0.12, 'triangle', 0.1)
      break
  }
}

const ease = (g: GainNode | null, v: number, t = 0.25) => g && ctx && g.gain.setTargetAtTime(v, ctx.currentTime, t)

/** How hard the ship is working, 0 (moored) to 1 (full speed). */
export function setShip(v: number) {
  if (!ctx) return
  ease(level.ship, Math.min(1, v) * 0.07, 0.35)
  shipOsc.forEach((o, i) => o.frequency.setTargetAtTime((i ? 82.6 : 55) * (1 + Math.min(1, v) * 0.45), ctx!.currentTime, 0.4))
}

/** Where the listener (the Pilot) is: sets how loud the nearby campfires and waterfalls are. */
export function listenAt(x: number, y: number, z: number) {
  if (!ctx) return
  let fire = 0, water = 0
  for (const e of emitters) {
    const k = Math.max(0, 1 - Math.hypot(x - e.x, (y - e.y) * 0.5, z - e.z) / e.range) ** 2
    if (e.kind === 'fire') fire = Math.max(fire, k)
    else water = Math.max(water, k)
  }
  if (!night) fire = 0 // the campfires only burn at night
  fireLevel = fire
  ease(level.fire, fire * 0.07)
  ease(level.water, water * 0.08)
}

export function setNight(v: boolean) {
  night = v
  ease(level.crickets, v ? 0.005 : 0, 1.5)
}

export function setSoundEnabled(v: boolean) {
  enabled = v
  try {
    localStorage.setItem('sound', v ? 'on' : 'off')
  } catch {
    /* private browsing */
  }
  if (!ctx) return void (v && initAudio())
  if (v) void ctx.resume()
  master.gain.setTargetAtTime(v ? VOLUME : 0, ctx.currentTime, 0.08)
}

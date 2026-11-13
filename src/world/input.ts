/**
 * Adventure Mode input: keyboard and gamepad read into one small state each frame.
 * Keyboard: WASD move, arrows or mouse-drag look, Shift run, Space jump, E board/land, F read, Esc leave.
 * Gamepad (standard layout): left stick move, right stick look, A jump, X board/land, Y read, B leave, RT or L3 run.
 */

export type Input = {
  /** Move: x is right, y is forward, each -1..1. */
  mx: number
  my: number
  /** Look, in radians per second. */
  lx: number
  ly: number
  run: boolean
  jump: boolean
  act: boolean
  read: boolean
  exit: boolean
  /** True when the last thing touched was a gamepad (the on-screen hints follow it). */
  pad: boolean
}

const held = new Set<string>()
const tapped = new Set<string>()
let padButtons: boolean[] = []
let lastPad = false

const typing = () => {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'])

/** Starts listening; returns the function that stops. */
export function attachInput() {
  const down = (e: KeyboardEvent) => {
    if (typing() || !GAME_KEYS.has(e.code)) return
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault() // don't scroll the page or press a focused button
    if (!e.repeat) tapped.add(e.code)
    held.add(e.code)
    lastPad = false
  }
  const up = (e: KeyboardEvent) => held.delete(e.code)
  const clear = () => held.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', clear)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', clear)
    held.clear()
    tapped.clear()
  }
}

const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82)

export function readInput(): Input {
  const k = (c: string) => (held.has(c) ? 1 : 0)
  let mx = k('KeyD') - k('KeyA'), my = k('KeyW') - k('KeyS')
  let lx = (k('ArrowRight') - k('ArrowLeft')) * 1.9, ly = (k('ArrowDown') - k('ArrowUp')) * 1.1
  let run = held.has('ShiftLeft') || held.has('ShiftRight')
  let jump = tapped.has('Space'), act = tapped.has('KeyE'), read = tapped.has('KeyF'), exit = tapped.has('Escape')
  tapped.clear()

  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
  for (const pad of pads) {
    if (!pad || !pad.connected) continue
    const ax = (i: number) => dead(pad.axes[i] ?? 0), b = (i: number) => !!pad.buttons[i]?.pressed
    const once = (i: number) => b(i) && !padButtons[i]
    const px = ax(0), py = -ax(1), rx = ax(2), ry = ax(3)
    if (px || py || rx || ry || pad.buttons.some((x) => x.pressed)) lastPad = true
    if (px || py) {
      mx = px
      my = py
    }
    // d-pad moves too
    if (b(12) || b(13) || b(14) || b(15)) {
      mx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0)
      my = (b(12) ? 1 : 0) - (b(13) ? 1 : 0)
    }
    lx += rx * 2.4
    ly += ry * 1.4
    run = run || b(7) || b(10) || (pad.buttons[7]?.value ?? 0) > 0.3
    jump = jump || once(0)
    exit = exit || once(1)
    act = act || once(2)
    read = read || once(3)
    padButtons = pad.buttons.map((x) => x.pressed)
    break // first connected pad only
  }
  const len = Math.hypot(mx, my)
  if (len > 1) {
    mx /= len
    my /= len
  }
  return { mx, my, lx, ly, run, jump, act, read, exit, pad: lastPad }
}

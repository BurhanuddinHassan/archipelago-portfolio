/**
 * Controller support for the whole site (secondary input, for presenting without touching the laptop).
 * Adventure Mode keeps its own controls (world/input.ts); here only Start works there, to go back to the tour.
 *
 * Tour (standard Xbox / PlayStation layout):
 *   LB / RB (L1 / R1)       previous / next stop (the ship sails there)
 *   Left stick up / down    scroll smoothly (inside an open panel, scrolls that panel)
 *   Right stick             look around the island
 *   D-pad                   move the highlight between buttons and links on screen
 *   A (✕)                   press the highlighted button or link
 *   B (○)                   close what's open (Echo, a project sheet, a certificate) or clear the highlight
 *   Y (△)                   open / close Echo
 *   X (□)                   day / night
 *   Start / Options         Adventure Mode on / off
 *   Back / View / Share     sound on / off
 */
import { STOPS } from './world/layout'
import { travelTo, useStore } from './store'
import { initAudio } from './audio'

/** Right-stick look, read by the 3D view each frame (radians per second). */
export const padLook = { x: 0, y: 0, active: false }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
const dead = (v: number) => (Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8)

let current: HTMLElement | null = null
function mark(el: HTMLElement | null) {
  current?.classList.remove('pad-focus')
  current = el
  if (!el) return
  el.classList.add('pad-focus')
  el.focus({ preventScroll: true })
  const r = el.getBoundingClientRect()
  if (r.top < 70 || r.bottom > window.innerHeight - 20) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/** The open dialog, if any: highlight and scrolling stay inside it. */
function scope(): HTMLElement {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter((d) => d.offsetParent !== null || getComputedStyle(d).position === 'fixed')
  return dialogs[dialogs.length - 1] ?? document.body
}

function candidates(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.closest('[aria-hidden="true"]') || el.closest('.world')) return false
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    if (getComputedStyle(el).visibility === 'hidden') return false
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
  })
}

/** Spatial navigation: the nearest candidate in the pressed direction. */
function step(dir: 'up' | 'down' | 'left' | 'right') {
  const root = scope(), list = candidates(root)
  if (!list.length) return
  if (!current || !document.contains(current) || !list.includes(current)) {
    // start on the first thing in the main content (or the dialog), not the top bar
    const main = list.filter((el) => !el.closest('.topbar') && !el.closest('.rail'))
    return mark((main.length ? main : list).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0])
  }
  const c = current.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2
  let best: HTMLElement | null = null, bestScore = Infinity
  for (const el of list) {
    if (el === current) continue
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const dx = x - cx, dy = y - cy
    const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy)
    if (along <= 4) continue
    const score = along + across * 2.2
    if (score < bestScore) (bestScore = score), (best = el)
  }
  if (best) mark(best)
  else if (dir === 'down' || dir === 'up') scrollBy(dir === 'down' ? 0.5 : -0.5) // nothing further that way: move the page on
}

function scrollTarget(): HTMLElement | Window {
  const root = scope()
  if (root === document.body) return window
  // the scrollable box inside the dialog (Echo's log, a sheet's body)
  const boxes = [root, ...root.querySelectorAll<HTMLElement>('*')].filter((el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))
  return boxes[0] ?? window
}
function scrollBy(screens: number) {
  const t = scrollTarget(), h = t === window ? window.innerHeight : (t as HTMLElement).clientHeight
  t.scrollBy({ top: h * screens, behavior: 'smooth' })
}

const press = (el: Element | null) => (el as HTMLElement | null)?.click()
const escape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))

/** Starts polling the first connected controller; returns the function that stops. */
export function startPadNav() {
  let raf = 0, last = performance.now(), prev: boolean[] = [], repeatAt = 0, heldDir = -1
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.12, (now - last) / 1000)
    last = now
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected)
    if (!pad) return (padLook.active = false)
    const b = (i: number) => !!pad.buttons[i]?.pressed
    const once = (i: number) => b(i) && !prev[i]
    const state = useStore.getState()
    const anything = pad.buttons.some((x) => x.pressed) || pad.axes.some((a) => Math.abs(a) > 0.3)
    if (anything) initAudio() // the first controller input counts as the click that allows sound

    if (state.mode === 'adventure') {
      // Adventure Mode reads the pad itself; Start returns to the tour
      if (once(9)) state.setMode('tour')
      padLook.active = false
      prev = pad.buttons.map((x) => x.pressed)
      return
    }

    // ---- stops
    if (once(4) || once(5)) {
      const i = Math.max(0, Math.min(STOPS.length - 1, state.activeStop + (once(5) ? 1 : -1)))
      mark(null)
      travelTo(STOPS[i].id)
    }
    // ---- highlight (d-pad, with auto-repeat while held)
    const dirs = [12, 13, 14, 15] as const, names = ['up', 'down', 'left', 'right'] as const
    const d = dirs.findIndex((i) => b(i))
    if (d >= 0 && (d !== heldDir || now >= repeatAt)) {
      step(names[d])
      repeatAt = now + (d !== heldDir ? 380 : 140)
    }
    heldDir = d
    if (once(0) && current && document.contains(current)) {
      const el = current
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.focus()
      else press(el)
    }
    if (once(1)) {
      if (scope() !== document.body) escape()
      else mark(null)
    }
    // ---- shortcuts
    if (once(3)) {
      press(document.querySelector('button.echo'))
      mark(null)
    }
    if (once(2)) state.toggleTheme()
    if (once(8)) state.toggleSound()
    if (once(9)) {
      mark(null)
      state.setMode('adventure')
      state.showToast('Adventure Mode: find 5 golden gears and earn a stamp on every island. Press X / □ at the ship to sail.')
    }
    // ---- scrolling (left stick) and looking (right stick)
    const sy = dead(pad.axes[1] ?? 0)
    if (sy) {
      const t = scrollTarget()
      t.scrollBy({ top: sy * Math.abs(sy) * 1400 * dt, behavior: 'instant' as ScrollBehavior })
    }
    padLook.x = dead(pad.axes[2] ?? 0) * 1.8
    padLook.y = dead(pad.axes[3] ?? 0) * 1.0
    padLook.active = !!(padLook.x || padLook.y)
    prev = pad.buttons.map((x) => x.pressed)
  }
  raf = requestAnimationFrame(loop)
  // the mouse or keyboard takes over again: drop the controller highlight
  const off = () => mark(null)
  window.addEventListener('pointerdown', off)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointerdown', off)
    mark(null)
  }
}

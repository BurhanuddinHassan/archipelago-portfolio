import { create } from 'zustand'

type Theme = 'day' | 'night'
/** low = always lite, high = always full detail, auto = decided by the measured frame rate */
export type Graphics = 'low' | 'auto' | 'high'

/** What Adventure Mode shows on screen: where you are, and what the action and read buttons would do. */
export type AdvHud = { place: string; act: string | null; tip: string | null; read: string | null; pad: boolean; island: string; ship: boolean }

type State = {
  /** tour = driven by scrolling; adventure = you walk and sail yourself */
  mode: 'tour' | 'adventure'
  adv: AdvHud | null
  /** Switch mode. Leaving Adventure Mode with a stop id scrolls the tour to that stop. */
  setMode: (mode: 'tour' | 'adventure', stop?: string) => void
  /** Continuous tour position: 0 = first stop, 1 = second stop, … */
  progress: number
  activeStop: number
  theme: Theme
  graphics: Graphics
  toast: string | null
  cycleGraphics: () => Graphics
  setProgress: (p: number) => void
  toggleTheme: () => void
  showToast: (msg: string) => void
}

const savedTheme = (): Theme => {
  try {
    return localStorage.getItem('theme') === 'night' ? 'night' : 'day'
  } catch {
    return 'day'
  }
}

const savedGraphics = (): Graphics => {
  try {
    const g = localStorage.getItem('graphics')
    return g === 'low' || g === 'high' ? g : 'auto'
  } catch {
    return 'auto'
  }
}

export const useStore = create<State>((set, get) => ({
  mode: 'tour',
  adv: null,
  setMode: (mode, stop) => {
    if (mode === get().mode) return
    set({ mode, adv: null })
    if (mode === 'tour' && stop) window.setTimeout(() => document.getElementById(stop)?.scrollIntoView(), 60)
  },
  progress: 0,
  activeStop: 0,
  theme: savedTheme(),
  graphics: savedGraphics(),
  cycleGraphics: () => {
    const order: Graphics[] = ['auto', 'high', 'low']
    const graphics = order[(order.indexOf(get().graphics) + 1) % order.length]
    try {
      localStorage.setItem('graphics', graphics)
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
    set({ graphics })
    return graphics
  },
  toast: null,
  setProgress: (p) => {
    const active = Math.round(p)
    if (active !== get().activeStop) set({ progress: p, activeStop: active })
    else set({ progress: p })
  },
  toggleTheme: () => {
    const theme = get().theme === 'day' ? 'night' : 'day'
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable: theme just won't persist */
    }
    set({ theme })
  },
  showToast: (msg) => {
    set({ toast: msg })
    window.setTimeout(() => {
      if (get().toast === msg) set({ toast: null })
    }, 3200)
  },
}))

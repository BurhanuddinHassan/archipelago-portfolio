import { create } from 'zustand'

type Theme = 'day' | 'night'

type State = {
  /** Continuous tour position: 0 = first stop, 1 = second stop, … */
  progress: number
  activeStop: number
  theme: Theme
  toast: string | null
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

export const useStore = create<State>((set, get) => ({
  progress: 0,
  activeStop: 0,
  theme: savedTheme(),
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

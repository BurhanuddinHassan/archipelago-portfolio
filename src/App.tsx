import Echo from './tour/Echo'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { STOPS } from './world/layout'
import { Section, stopContent } from './tour/Sections'
import { islandById } from './world/layout'
import { GEARS_PER_ISLAND, ISLAND_COUNT, usePlay } from './world/play'
import { useStore } from './store'
import { profile } from './content'

const World = lazy(() => import('./world/World'))

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Reads scroll position and turns it into a continuous stop index. */
function useTourProgress(refs: React.MutableRefObject<(HTMLElement | null)[]>) {
  const setProgress = useStore((s) => s.setProgress)
  useEffect(() => {
    let tops: number[] = []
    const measure = () => {
      tops = refs.current.map((el) => (el ? el.getBoundingClientRect().top + window.scrollY : 0))
    }
    const update = () => {
      const y = window.scrollY + window.innerHeight * 0.25
      let i = 0
      while (i < tops.length - 1 && y >= tops[i + 1]) i++
      const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1
      const frac = i < tops.length - 1 ? Math.min(1, Math.max(0, (y - tops[i]) / span)) : 0
      setProgress(i + frac)
    }
    const onResize = () => {
      measure()
      update()
    }
    measure()
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    refs.current.forEach((el) => el && ro.observe(el))
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [refs, setProgress])
}

export default function App() {
  const refs = useRef<(HTMLElement | null)[]>([])
  useTourProgress(refs)
  const theme = useStore((s) => s.theme)
  const webgl = useMemo(hasWebGL, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  const mode = useStore((s) => s.mode)
  // ?film: every piece of UI is hidden so the 3D scene can be screen-recorded clean (promo video footage).
  // Scrolling still drives the tour; Adventure Mode is toggled with the P key or a controller's Start button.
  const film = useMemo(() => new URLSearchParams(window.location.search).has('film'), [])
  useEffect(() => {
    document.documentElement.classList.toggle('film', film)
    if (!film) return
    const go = (e: KeyboardEvent) => e.code === 'KeyP' && useStore.getState().setMode(useStore.getState().mode === 'adventure' ? 'tour' : 'adventure')
    let raf = 0, was = false
    const poll = () => {
      const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected)
      const start = !!pad?.buttons[9]?.pressed
      if (start && !was) useStore.getState().setMode(useStore.getState().mode === 'adventure' ? 'tour' : 'adventure')
      was = start
      raf = requestAnimationFrame(poll)
    }
    window.addEventListener('keydown', go)
    raf = requestAnimationFrame(poll)
    return () => {
      window.removeEventListener('keydown', go)
      cancelAnimationFrame(raf)
    }
  }, [film])
  useEffect(() => {
    // Adventure Mode: the page stops scrolling and the tour text steps aside
    document.documentElement.classList.toggle('adventure', mode === 'adventure')
  }, [mode])

  return (
    <div className="app">
      <TopBar />
      <div className="world" aria-hidden="true">
        {webgl ? (
          <Suspense fallback={<div className="world-loading">Folding the paper plane…</div>}>
            <World />
          </Suspense>
        ) : (
          <div className="world-fallback">The 3D world needs WebGL. The tour still works.</div>
        )}
      </div>
      <main className="tour">
        {STOPS.map((s, i) => {
          const c = stopContent(s.id)
          return (
            <Section key={s.id} id={s.id} eyebrow={c.eyebrow} accent={c.accent} ref={(el) => { refs.current[i] = el }}>
              {c.body}
            </Section>
          )
        })}
        <footer className="foot">© {new Date().getFullYear()} {profile.name}. Built with Three.js and React.</footer>
      </main>
      <ProgressRail />
      <p className="drag-hint" aria-hidden="true">Drag to look around</p>
      <Echo />
      {mode === 'adventure' && <AdventureHud />}
      <MobileNotice />
      <Toast />
    </div>
  )
}

function TopBar() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const showToast = useStore((s) => s.showToast)
  const graphics = useStore((s) => s.graphics)
  const cycleGraphics = useStore((s) => s.cycleGraphics)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const GFX = { auto: 'Auto', high: 'High', low: 'Low' }
  const GFX_HINT = {
    auto: 'Graphics: Auto. Detail adjusts to how well your device keeps up.',
    high: 'Graphics: High. Full detail, always.',
    low: 'Graphics: Low. Lighter scene for smoother motion.',
  }
  return (
    <header className="topbar">
      <a className="mark" href="#home">{profile.name}</a>
      <div className="topbar-actions">
        <button
          className={mode === 'adventure' ? 'btn small on' : 'btn small'}
          onClick={(e) => {
            e.currentTarget.blur() // otherwise Space (jump) would press this button again
            if (mode === 'adventure') return setMode('tour')
            if (window.matchMedia('(max-width: 820px)').matches) return showToast('Adventure Mode needs a keyboard or a controller. Try it on a laptop.')
            setMode('adventure')
            showToast('Adventure Mode: find 5 golden gears and earn a stamp on every island. Press E at the ship to sail.')
          }}
        >
          <span className="long">{mode === 'adventure' ? 'Back to the tour' : 'Explore freely'}</span>
          <span className="short">{mode === 'adventure' ? 'Tour' : 'Explore'}</span>
        </button>
        <button
          className="btn small"
          onClick={() => showToast(GFX_HINT[cycleGraphics()])}
          aria-label={`Graphics quality: ${GFX[graphics]}. Click to change.`}
          title="Graphics quality"
        >
          <span className="long">Graphics: </span>
          {GFX[graphics]}
        </button>
        <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'day' ? 'Switch to night' : 'Switch to day'}>
          {theme === 'day' ? '☾' : '☀'}
        </button>
      </div>
    </header>
  )
}

/** Adventure Mode overlay: where you are, what the buttons do right now, and the controls for the device in use. */
function AdventureHud() {
  const adv = useStore((s) => s.adv)
  const pad = adv?.pad ?? false
  const sailing = adv?.ship ?? false
  const key = (k: string, p: string) => <kbd>{pad ? p : k}</kbd>
  const controls: [string, string, string][] = sailing
    ? [['W S', 'Left stick', 'Speed'], ['A D', 'Left stick', 'Steer'], ['Shift', 'RT / R2', 'Boost'], ['Drag / arrows', 'Right stick', 'Look']]
    : [['W A S D', 'Left stick', 'Walk'], ['Shift', 'RT / R2', 'Run'], ['Space', 'A / ✕', 'Jump'], ['Drag / arrows', 'Right stick', 'Look']]
  // controller buttons are named for both Xbox and PlayStation pads: the same physical button on each
  const reading = useStore((s) => s.advRead)
  const gears = usePlay((s) => s.gears.length), stamps = usePlay((s) => s.stamps.length)
  const closeCard = () => useStore.setState({ advRead: null })
  const card = reading ? stopContent(reading) : null
  return (
    <div className="adv-hud" role="status" aria-live="polite">
      <div className="adv-place">{adv?.place ?? 'Adventure Mode'}</div>
      <div className="adv-score" title="Golden gears found, and island stamps earned">
        <span>⚙ {gears} / {GEARS_PER_ISLAND * ISLAND_COUNT}</span>
        <span>★ {stamps} / {ISLAND_COUNT}</span>
      </div>
      <div className="adv-prompts">
        {adv?.act && (
          <div className="adv-prompt">
            {key('E', 'X / □')} {adv.act}
          </div>
        )}
        {adv?.tip && <div className="adv-prompt">{adv.tip}</div>}
        {adv?.read && (
          <button className="adv-prompt" onClick={() => useStore.setState({ advRead: reading ? null : adv.read })}>
            {key('F', 'Y / △')} {reading ? 'Close' : 'Read about this place'}
          </button>
        )}
      </div>
      {reading && card && (
        <div className="adv-card-wrap" onClick={closeCard}>
          <article className="adv-card panel" style={{ '--accent': card.accent ?? islandById(STOPS.find((s) => s.id === reading)!.island).accent } as React.CSSProperties} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="About this place">
            <button className="adv-card-close" onClick={closeCard} aria-label="Close">
              ✕
            </button>
            {card.eyebrow && <p className="eyebrow">{card.eyebrow}</p>}
            {card.body}
          </article>
        </div>
      )}
      <ul className="adv-controls">
        {controls.map(([k, p, what]) => (
          <li key={what}>
            {key(k, p)} {what}
          </li>
        ))}
        <li>
          {key('Esc', 'B / ○')} Back to the tour
        </li>
      </ul>
    </div>
  )
}

function ProgressRail() {
  const active = useStore((s) => s.activeStop)
  return (
    <nav className="rail" aria-label="Tour stops">
      <ol>
        {STOPS.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={i === active ? 'on' : undefined} aria-current={i === active ? 'step' : undefined}>
              <span className="dot" />
              <span className="rail-label">{s.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function MobileNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      if (window.matchMedia('(max-width: 820px)').matches && !localStorage.getItem('mobileNotice')) setShow(true)
    } catch {
      /* ignore */
    }
  }, [])
  if (!show) return null
  const close = () => {
    try {
      localStorage.setItem('mobileNotice', '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }
  return (
    <div className="mobile-notice" role="status">
      <span>Best explored on a laptop. The tour works great here.</span>
      <button onClick={close} aria-label="Dismiss">✕</button>
    </div>
  )
}

function Toast() {
  const toast = useStore((s) => s.toast)
  return (
    <div className="toast" role="status" aria-live="polite">
      {toast}
    </div>
  )
}

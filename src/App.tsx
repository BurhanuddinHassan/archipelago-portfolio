import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { STOPS } from './world/layout'
import { Section, stopContent } from './tour/Sections'
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
      <EchoButton />
      <MobileNotice />
      <Toast />
    </div>
  )
}

function TopBar() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const showToast = useStore((s) => s.showToast)
  return (
    <header className="topbar">
      <a className="mark" href="#home">{profile.name}</a>
      <div className="topbar-actions">
        <button className="btn small" onClick={() => showToast('Adventure Mode is coming soon. The tour is live now.')}>
          <span className="long">Explore freely</span>
          <span className="short">Explore</span>
        </button>
        <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'day' ? 'Switch to night' : 'Switch to day'}>
          {theme === 'day' ? '☾' : '☀'}
        </button>
      </div>
    </header>
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

function EchoButton() {
  const showToast = useStore((s) => s.showToast)
  return (
    <button className="echo" onClick={() => showToast('Echo, my portfolio chatbot, is coming soon.')} aria-label="Ask Echo, the portfolio chatbot">
      <span aria-hidden="true">✦</span> Ask Echo
    </button>
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

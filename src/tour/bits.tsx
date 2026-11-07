import { useState } from 'react'
import type { Project } from '../content'

/** YouTube embed that loads nothing until clicked (keeps the first load light). */
export function LiteYouTube({ id, title, poster }: { id: string; title: string; poster?: string }) {
  const [on, setOn] = useState(false)
  if (on)
    return (
      <div className="video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  return (
    <button className="video video-poster" onClick={() => setOn(true)} aria-label={`Play video: ${title}`}>
      <img src={poster || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
      <span className="play" aria-hidden="true">▶</span>
    </button>
  )
}

export function Chips({ items }: { items: (string | undefined)[] }) {
  return (
    <ul className="chips">
      {items.filter(Boolean).map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function ProjectLinks({ p }: { p: Project }) {
  const l = p.links || {}
  if (!l.play && !l.live && !l.code) return null
  return (
    <div className="actions">
      {l.live && <a className="btn primary" href={l.live} target="_blank" rel="noreferrer">Play in browser ↗</a>}
      {l.play && <a className="btn primary" href={l.play} target="_blank" rel="noreferrer">Play on itch.io ↗</a>}
      {l.code && <a className="btn" href={l.code} target="_blank" rel="noreferrer">Source ↗</a>}
    </div>
  )
}

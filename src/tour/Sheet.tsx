import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Project } from '../content'
import { Chips, LiteYouTube, ProjectLinks } from './bits'

/** Bottom sheet with a project's full details (mobile Harbor). */
export default function Sheet({ p, onClose }: { p: Project; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={p.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <button className="sheet-close" onClick={onClose} aria-label="Close">✕</button>
        <h3>{p.title}</h3>
        <p className="lead">{p.summary}</p>
        <Chips items={[p.team, p.role, ...p.engine]} />
        <ProjectLinks p={p} />
        {p.video && <LiteYouTube id={p.video} title={p.title} poster={p.thumbnail} />}
        {!p.video && p.thumbnail && <img className="sheet-cover" src={p.thumbnail} alt="" />}
        <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
      </div>
    </div>,
    document.body,
  )
}

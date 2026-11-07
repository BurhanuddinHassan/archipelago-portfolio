import { useMemo, useState } from 'react'
import { projects, type Project } from '../content'
import { useIsMobile } from '../hooks'
import { Chips, LiteYouTube, ProjectLinks } from './bits'
import Sheet from './Sheet'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Web 3D' },
  { id: '2d', label: '2D' },
  { id: 'xr', label: 'XR & vision' },
  { id: 'ae', label: 'Motion' },
] as const

const Thumb = ({ p }: { p: Project }) =>
  p.thumbnail ? <img src={p.thumbnail} alt="" loading="lazy" /> : <div className="thumb-fallback">{p.engine[0]}</div>

export default function Harbor() {
  const mobile = useIsMobile()
  const [filter, setFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Project | null>(null)

  const items = useMemo(() => {
    const query = q.trim().toLowerCase()
    return projects
      .filter((p) => p.island === 'harbor')
      .filter((p) => filter === 'all' || p.category === filter)
      .filter((p) => !query || [p.title, p.summary, ...p.tags, ...p.engine].join(' ').toLowerCase().includes(query))
  }, [filter, q])

  const tools = (
    <div className="harbor-tools">
      <div className="filters" role="group" aria-label="Filter projects">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'chip-btn on' : 'chip-btn'} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <input type="search" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
    </div>
  )

  if (mobile)
    return (
      <>
        {tools}
        <div className="carousel" role="list">
          {items.map((p) => (
            <button key={p.slug} role="listitem" className="slide" onClick={() => setOpen(p)}>
              <Thumb p={p} />
              <span className="slide-cat">{p.engine[0]}</span>
              <strong>{p.title}</strong>
              <span className="slide-sum">{p.summary}</span>
              {p.links.live && <span className="slide-live">Playable ↗</span>}
            </button>
          ))}
          {items.length === 0 && <p className="muted">No projects match.</p>}
        </div>
        {items.length > 1 && <p className="muted small swipe-hint">Swipe for more · tap to open</p>}
        {open && <Sheet p={open} onClose={() => setOpen(null)} />}
      </>
    )

  return (
    <>
      {tools}
      <div className="cards">
        {items.map((p) => (
          <details key={p.slug} id={`project-${p.slug}`} className="card">
            <summary>
              <Thumb p={p} />
              <div className="card-text">
                <h4>{p.title}</h4>
                <p>{p.summary}</p>
              </div>
            </summary>
            <div className="card-body">
              <Chips items={[p.team, p.role, ...p.engine]} />
              <ProjectLinks p={p} />
              {p.video && <LiteYouTube id={p.video} title={p.title} poster={p.thumbnail} />}
              <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
            </div>
          </details>
        ))}
        {items.length === 0 && <p className="muted">No projects match.</p>}
      </div>
    </>
  )
}

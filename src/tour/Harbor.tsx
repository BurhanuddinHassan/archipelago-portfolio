import { useMemo, useState } from 'react'
import { projects } from '../content'
import { Chips, LiteYouTube, ProjectLinks } from './bits'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Web' },
  { id: '2d', label: '2D' },
  { id: 'xr', label: 'XR & vision' },
  { id: 'ae', label: 'Motion' },
] as const

export default function Harbor() {
  const [filter, setFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const items = useMemo(() => {
    const query = q.trim().toLowerCase()
    return projects
      .filter((p) => p.island === 'harbor')
      .filter((p) => filter === 'all' || p.category === filter)
      .filter(
        (p) =>
          !query ||
          [p.title, p.summary, ...p.tags, ...p.engine].join(' ').toLowerCase().includes(query),
      )
  }, [filter, q])

  return (
    <>
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
      <div className="cards">
        {items.map((p) => (
          <details key={p.slug} id={`project-${p.slug}`} className="card">
            <summary>
              {p.thumbnail ? <img src={p.thumbnail} alt="" loading="lazy" /> : <div className="thumb-fallback">{p.engine[0]}</div>}
              <div className="card-text">
                <h4>{p.title}</h4>
                <p>{p.summary}</p>
              </div>
            </summary>
            <div className="card-body">
              <Chips items={[p.team, p.role, ...p.engine]} />
              {p.video && <LiteYouTube id={p.video} title={p.title} poster={p.thumbnail} />}
              <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
              <ProjectLinks p={p} />
            </div>
          </details>
        ))}
        {items.length === 0 && <p className="muted">No projects match.</p>}
      </div>
    </>
  )
}

import { forwardRef, useState, type ReactNode } from 'react'
import { useIsMobile } from '../hooks'
import { journey, profile, projectBySlug, skills, projects } from '../content'
import { STOPS, islandById } from '../world/layout'
import { Chips, LiteYouTube, ProjectLinks } from './bits'
import Harbor from './Harbor'
import ContactForm from './ContactForm'
import Lightbox, { CertThumbs } from './Lightbox'
import type { Cert } from '../content'

const ISLAND_PROJECTS = projects.filter((p) => p.island === p.slug)

export const Section = forwardRef<HTMLElement, { id: string; eyebrow?: string; accent?: string; children: ReactNode }>(
  ({ id, eyebrow, accent, children }, ref) => (
    <section ref={ref} id={id} className="stop" style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}>
      <div className="panel">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {children}
      </div>
    </section>
  ),
)

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

export function HomeStop() {
  return (
    <>
      <h1>{profile.name}</h1>
      <p className="headline">{profile.headline}</p>
      {profile.tagline && <p className="tagline">{profile.tagline}</p>}
      <p className="subline">{profile.subline}</p>
      <p>{profile.intro}</p>
      <p className="availability">{profile.availability}</p>
      <div className="actions">
        <a className="btn primary" href={profile.cv} target="_blank" rel="noreferrer">Download CV</a>
        <button className="btn" onClick={() => jump('contact')}>Contact</button>
        <button className="btn" onClick={() => jump('cinema')}>Watch the trailer</button>
      </div>
      <a className="highlight" href={profile.highlight.url} target="_blank" rel="noreferrer">
        <strong>{profile.highlight.title} ↗</strong>
        <span>{profile.highlight.text}</span>
      </a>
      <p className="hint">Scroll to fly to the next island</p>
    </>
  )
}

export function ProjectStop({ slug, n }: { slug: string; n: number }) {
  const p = projectBySlug(slug)
  const mobile = useIsMobile()
  const [show, setShow] = useState<'none' | 'video' | 'story'>('none')
  if (!p) return null
  const toggle = (k: 'video' | 'story') => setShow(show === k ? 'none' : k)

  if (mobile)
    return (
      <>
        <h2>{p.title}</h2>
        <p className="lead">{p.summary}</p>
        <Chips items={[p.team, p.role, p.engine[0]]} />
        <div className="actions tight">
          {p.video && (
            <button className={show === 'video' ? 'btn primary' : 'btn'} aria-expanded={show === 'video'} onClick={() => toggle('video')}>
              ▶ Watch
            </button>
          )}
          <button className={show === 'story' ? 'btn primary' : 'btn'} aria-expanded={show === 'story'} onClick={() => toggle('story')}>
            How I built it
          </button>
        </div>
        {show === 'video' && p.video && <LiteYouTube id={p.video} title={p.title} poster={p.thumbnail} />}
        {show === 'story' && <div className="prose reveal" dangerouslySetInnerHTML={{ __html: p.html }} />}
        <ProjectLinks p={p} />
        <p className="muted small">Island {n} of {ISLAND_PROJECTS.length}</p>
      </>
    )

  return (
    <>
      <h2>{p.title}</h2>
      <p className="lead">{p.summary}</p>
      <Chips items={[p.team, p.role, ...p.engine, p.year ? String(p.year) : undefined]} />
      {p.video && <LiteYouTube id={p.video} title={p.title} poster={p.thumbnail} />}
      <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
      <ProjectLinks p={p} />
      <p className="muted small">Island {n} of {ISLAND_PROJECTS.length}</p>
    </>
  )
}

function ProofLinks({ proof }: { proof: string[] }) {
  return (
    <span className="proof">
      {proof.map((slug) => {
        const p = projectBySlug(slug)
        if (!p) return null
        const target = p.island === 'harbor' ? 'harbor' : p.slug
        return (
          <button key={slug} className="proof-link" onClick={() => jump(target)}>
            {p.title}
          </button>
        )
      })}
    </span>
  )
}

export function WorkshopStop() {
  const mobile = useIsMobile()
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <>
      <h2>Skills and tools</h2>
      <p className="lead">{mobile ? 'Tap a skill to see where I used it.' : 'Every skill links to the work that shows it.'}</p>
      {skills.map((g) => {
        if (mobile) {
          const sel = g.skills.find((s) => s.name === picked)
          return (
            <div key={g.name} className="skill-group">
              <h3>{g.name}</h3>
              <div className="skill-cloud">
                {g.skills.map((s) => (
                  <button
                    key={s.name}
                    className={picked === s.name ? 'chip-btn on' : 'chip-btn'}
                    aria-pressed={picked === s.name}
                    onClick={() => setPicked(picked === s.name ? null : s.name)}
                  >
                    {s.name}
                    {s.proof.length > 0 && <sup>{s.proof.length}</sup>}
                  </button>
                ))}
              </div>
              {sel && (
                <div className="skill-proof reveal">
                  {sel.proof.length ? <>Seen in <ProofLinks proof={sel.proof} /></> : <span className="muted">Project link coming soon.</span>}
                </div>
              )}
            </div>
          )
        }
        return (
          <div key={g.name} className="skill-group">
            <h3>{g.name}</h3>
            <ul className="skills">
              {g.skills.map((s) => (
                <li key={s.name}>
                  <span className="skill-name">{s.name}</span>
                  {s.proof.length > 0 && <ProofLinks proof={s.proof} />}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </>
  )
}

export function JourneyStop() {
  const mobile = useIsMobile()
  const [cert, setCert] = useState<Cert | null>(null)
  const certCount = journey.reduce((n, e) => n + (e.certs?.length ?? 0), 0)
  return (
    <>
      <h2>Journey</h2>
      <p className="lead">Education, leadership and work, newest first. {certCount} certificates inside.</p>
      <ol className="timeline">
        {journey.map((e) =>
          mobile ? (
            <li key={e.title} className={`kind-${e.kind}`}>
              <details>
                <summary>
                  {e.when && <span className="when">{e.when}</span>}
                  <strong>{e.title}</strong>
                  <span className="where">{e.where}</span>
                </summary>
                {e.text && <p>{e.text}</p>}
              </details>
              <CertThumbs certs={e.certs} onOpen={setCert} />
            </li>
          ) : (
            <li key={e.title} className={`kind-${e.kind}`}>
              {e.when && <span className="when">{e.when}</span>}
              <strong>{e.title}</strong>
              <span className="where">{e.where}</span>
              {e.text && <p>{e.text}</p>}
              <CertThumbs certs={e.certs} onOpen={setCert} />
            </li>
          ),
        )}
      </ol>
      {cert && <Lightbox cert={cert} onClose={() => setCert(null)} />}
    </>
  )
}

export function CinemaStop() {
  return (
    <>
      <h2>The trailer</h2>
      <p className="lead">A 45-second tour of who I am and what I build.</p>
      <div className="video video-placeholder">
        <span>Trailer in production</span>
      </div>
    </>
  )
}

export function ContactStop() {
  return (
    <>
      <h2>Let's talk</h2>
      <p className="lead">{profile.availability}</p>
      <ContactForm />
      <ul className="contact-links">
        <li><a href={`mailto:${profile.links.email}`}>{profile.links.email}</a></li>
        <li><a href={profile.links.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></li>
        <li><a href={profile.links.github} target="_blank" rel="noreferrer">GitHub ↗</a></li>
        <li><a href={profile.links.itch} target="_blank" rel="noreferrer">itch.io ↗</a></li>
      </ul>
    </>
  )
}

export function stopContent(id: string): { eyebrow?: string; accent?: string; body: ReactNode } {
  const stop = STOPS.find((s) => s.id === id)!
  const accent = islandById(stop.island).accent
  const projectIndex = ISLAND_PROJECTS.findIndex((p) => p.slug === id)
  if (projectIndex >= 0) return { eyebrow: 'Project island', accent, body: <ProjectStop slug={id} n={projectIndex + 1} /> }
  switch (id) {
    case 'home':
      return { accent, body: <HomeStop /> }
    case 'harbor':
      return { eyebrow: 'The Harbor', accent, body: (<><h2>More work</h2><p className="lead">Smaller games, experiments, motion work and web builds.</p><Harbor /></>) }
    case 'workshop':
      return { eyebrow: 'Workshop Isle', accent, body: <WorkshopStop /> }
    case 'journey':
      return { eyebrow: 'Journey Isle', accent, body: <JourneyStop /> }
    case 'cinema':
      return { eyebrow: 'Home Isle · Cinema', accent, body: <CinemaStop /> }
    case 'contact':
      return { eyebrow: 'Home Isle · Post box', accent, body: <ContactStop /> }
  }
  return { body: null }
}

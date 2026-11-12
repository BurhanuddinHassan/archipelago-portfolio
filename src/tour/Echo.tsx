import { useEffect, useRef, useState, type FormEvent } from 'react'

/**
 * Echo: the portfolio chatbot. A small chat panel that asks /api/chat, which answers only from this
 * portfolio's content (retrieval + Gemini) and returns the sections it used, shown as links into the tour.
 */

type Source = { title: string; href: string }
type Turn = { role: 'user' | 'assistant'; content: string; sources?: Source[]; error?: boolean }

const STARTERS = ['What games has he made?', 'What did he build in Chrono Rebellion?', 'Is he open to internships?', 'How can I contact him?']

/** Turns "text [1][3]" into text plus small citation numbers. */
function Answer({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\[\d+\]$/.test(p) ? (
          <sup key={i} className="cite">
            {p.slice(1, -1)}
          </sup>
        ) : (
          <span key={i}>{p.replace(/\*\*/g, '')}</span>
        ),
      )}
    </>
  )
}

export default function Echo() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  const ask = async (question: string) => {
    question = question.trim()
    if (!question || busy) return
    const history = turns.filter((t) => !t.error).map(({ role, content }) => ({ role, content }))
    setTurns((t) => [...t, { role: 'user', content: question }])
    setDraft('')
    setBusy(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, history }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.answer) throw new Error(data.error ?? 'Echo is unavailable right now.')
      setTurns((t) => [...t, { role: 'assistant', content: data.answer, sources: data.sources }])
    } catch (e) {
      setTurns((t) => [...t, { role: 'assistant', content: e instanceof Error && e.message !== 'Failed to fetch' ? e.message : "I couldn't connect. Please try again, or use the contact form.", error: true }])
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(draft)
  }

  return (
    <>
      <button className="echo" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="echo-panel" aria-label={open ? 'Close Echo' : 'Ask Echo, the portfolio chatbot'}>
        <span aria-hidden="true">{open ? '×' : '✦'}</span> {open ? 'Close' : 'Ask Echo'}
      </button>
      {open && (
        <section id="echo-panel" className="echo-panel" role="dialog" aria-label="Echo, the portfolio chatbot">
          <header>
            <strong>
              <span aria-hidden="true">✦</span> Echo
            </strong>
            <span className="muted">Answers from this portfolio only</span>
          </header>
          <div className="echo-log" ref={log} aria-live="polite">
            {turns.length === 0 && (
              <div className="echo-hello">
                <p>Hi, I'm Echo. Ask me anything about Burhanuddin's games, skills and experience.</p>
                <div className="echo-starters">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`msg ${t.role}${t.error ? ' error' : ''}`}>
                <p>{t.role === 'assistant' ? <Answer text={t.content} /> : t.content}</p>
                {!!t.sources?.length && (
                  <ul className="echo-sources" aria-label="Sources">
                    {t.sources.map((s, k) => (
                      <li key={k}>
                        <a href={s.href} onClick={() => window.matchMedia('(max-width: 820px)').matches && setOpen(false)}>
                          {s.title} ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {busy && (
              <div className="msg assistant typing" aria-label="Echo is typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <form onSubmit={submit}>
            <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about his work…" maxLength={500} aria-label="Your question" />
            <button className="btn primary small" type="submit" disabled={busy || !draft.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
    </>
  )
}

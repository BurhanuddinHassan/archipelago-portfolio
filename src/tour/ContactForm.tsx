import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { profile } from '../content'
import { validateContact, type ContactErrors } from '../../api/_lib/validate'

/**
 * Contact form. Validates in the browser for instant feedback, then POSTs to /api/contact, which validates again,
 * runs the spam checks (honeypot, timing, rate limit, Cloudflare Turnstile) and emails the message with Resend.
 */

type Fields = { name: string; email: string; subject: string; message: string; website: string }
type Status = 'idle' | 'sending' | 'sent' | 'error' | 'offline'

export const validate = (f: Fields) => validateContact(f)

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void }
  }
}

/** Cloudflare Turnstile: loads its script only when a site key is configured. */
function useTurnstile(box: React.RefObject<HTMLDivElement | null>, onToken: (t: string) => void) {
  const id = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!SITE_KEY || !box.current) return
    const render = () => {
      if (!box.current || id.current || !window.turnstile) return
      id.current = window.turnstile.render(box.current, { sitekey: SITE_KEY, callback: onToken, 'expired-callback': () => onToken(''), theme: 'auto', size: 'flexible' })
    }
    if (window.turnstile) return render()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = render
    document.head.appendChild(s)
  }, [box, onToken])
  return () => window.turnstile?.reset(id.current)
}

export default function ContactForm() {
  const [f, setF] = useState<Fields>({ name: '', email: '', subject: '', message: '', website: '' })
  const [errors, setErrors] = useState<ContactErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [note, setNote] = useState('')
  const [token, setToken] = useState('')
  const startedAt = useRef(Date.now())
  const box = useRef<HTMLDivElement>(null)
  const resetCaptcha = useTurnstile(box, setToken)

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (k !== 'website' && errors[k]) setErrors({ ...errors, [k]: undefined })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (SITE_KEY && !token) {
      setStatus('error')
      setNote('Please complete the spam check above the button.')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, startedAt: startedAt.current, token }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('sent')
        setF({ name: '', email: '', subject: '', message: '', website: '' })
        return
      }
      if (data.errors) setErrors(data.errors)
      setStatus(data.notConfigured ? 'offline' : 'error')
      setNote(data.error ?? 'Something went wrong.')
      resetCaptcha()
      setToken('')
    } catch {
      setStatus('offline')
    }
  }

  const field = (k: keyof ContactErrors, label: string, el: ReactElement) => (
    <label className="field">
      <span>{label}</span>
      {el}
      {errors[k] && <em role="alert">{errors[k]}</em>}
    </label>
  )

  if (status === 'sent')
    return (
      <div className="contact sent" role="status">
        <p>
          <strong>Thanks, your message is on its way.</strong> I'll reply to your email soon.
        </p>
        <button className="btn small" type="button" onClick={() => setStatus('idle')}>
          Send another
        </button>
      </div>
    )

  return (
    <form className="contact" onSubmit={submit} noValidate>
      {field('name', 'Name', <input value={f.name} onChange={set('name')} autoComplete="name" maxLength={80} />)}
      {field('email', 'Email', <input type="email" value={f.email} onChange={set('email')} autoComplete="email" maxLength={254} />)}
      {field('subject', 'Subject', <input value={f.subject} onChange={set('subject')} maxLength={120} />)}
      {field('message', 'Message', <textarea rows={5} value={f.message} onChange={set('message')} maxLength={2000} />)}
      {/* honeypot: hidden from people, bots fill it */}
      <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden="true" name="website" />
      {SITE_KEY && <div ref={box} className="turnstile" />}
      <button className="btn primary" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      {status === 'error' && (
        <p className="notice" role="alert">
          {note}
        </p>
      )}
      {status === 'offline' && (
        <p className="notice" role="status">
          The form can't send right now. Please email me directly at{' '}
          <a href={`mailto:${profile.links.email}?subject=${encodeURIComponent(f.subject)}`}>{profile.links.email}</a>.
        </p>
      )}
    </form>
  )
}

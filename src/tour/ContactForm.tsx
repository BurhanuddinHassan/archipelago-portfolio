import { useState, type FormEvent, type ReactElement } from 'react'
import { profile } from '../content'

type Fields = { name: string; email: string; subject: string; message: string; website: string }
type Errors = Partial<Record<keyof Fields, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validate(f: Fields): Errors {
  const e: Errors = {}
  if (f.name.trim().length < 2 || f.name.length > 80) e.name = 'Enter your name (2–80 characters).'
  if (!EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address.'
  if (f.subject.trim().length < 3 || f.subject.length > 120) e.subject = 'Subject needs 3–120 characters.'
  if (f.message.trim().length < 10 || f.message.length > 2000) e.message = 'Message needs 10–2,000 characters.'
  return e
}

export default function ContactForm() {
  const [f, setF] = useState<Fields>({ name: '', email: '', subject: '', message: '', website: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'pending'>('idle')

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    // Backend (/api/contact with Resend + Turnstile) lands on 15 Nov. Until then, be honest.
    setStatus('pending')
  }

  const field = (k: keyof Fields, label: string, el: ReactElement) => (
    <label className="field">
      <span>{label}</span>
      {el}
      {errors[k] && <em role="alert">{errors[k]}</em>}
    </label>
  )

  return (
    <form className="contact" onSubmit={submit} noValidate>
      {field('name', 'Name', <input value={f.name} onChange={set('name')} autoComplete="name" />)}
      {field('email', 'Email', <input type="email" value={f.email} onChange={set('email')} autoComplete="email" />)}
      {field('subject', 'Subject', <input value={f.subject} onChange={set('subject')} />)}
      {field('message', 'Message', <textarea rows={5} value={f.message} onChange={set('message')} />)}
      {/* honeypot: hidden from people, bots fill it */}
      <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden="true" />
      <button className="btn primary" type="submit">Send message</button>
      {status === 'pending' && (
        <p className="notice" role="status">
          The form isn't connected yet. Please email me directly at{' '}
          <a href={`mailto:${profile.links.email}?subject=${encodeURIComponent(f.subject)}`}>{profile.links.email}</a>.
        </p>
      )}
    </form>
  )
}

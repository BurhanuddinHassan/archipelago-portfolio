/**
 * Contact form: POST /api/contact  { name, email, subject, message, website, startedAt, token }
 * Spam protection, in order: honeypot field, too-fast-to-be-human check, per-IP rate limit,
 * Cloudflare Turnstile (when TURNSTILE_SECRET_KEY is set), then server-side validation.
 * Sends the message to CONTACT_TO with Resend (RESEND_API_KEY), with the visitor as reply-to.
 * Environment variables (set in Vercel, never in code): RESEND_API_KEY, TURNSTILE_SECRET_KEY, CONTACT_TO, CONTACT_FROM.
 */
import { validateContact, type ContactFields } from './_lib/validate.js'

const hits = new Map<string, number[]>()
function limited(ip: string) {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > 5 // 5 messages per 10 minutes per IP
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()

export async function POST(req: Request) {
  if (!(req.headers.get('content-type') ?? '').includes('application/json') || Number(req.headers.get('content-length') ?? 0) > 20_000) return json({ error: 'Invalid request.' }, 400)
  let b: Record<string, unknown>
  try {
    b = await req.json()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '')
  const f: ContactFields = { name: oneLine(str('name')), email: oneLine(str('email')), subject: oneLine(str('subject')), message: str('message').trim() }

  // bots fill the hidden field, or submit faster than a person can type; pretend it worked
  const startedAt = Number(b.startedAt)
  if (str('website') || !Number.isFinite(startedAt) || Date.now() - startedAt < 3000) return json({ ok: true })

  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  if (limited(ip)) return json({ error: 'Too many messages from your connection. Please try again later.' }, 429)

  const errors = validateContact(f)
  if (Object.keys(errors).length) return json({ error: 'Please fix the highlighted fields.', errors }, 422)

  // Turnstile fails closed on the live site: if the secret is missing there, the form refuses rather than sending unchecked mail
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  if (!turnstileSecret && process.env.VERCEL_ENV === 'production') return json({ error: 'The contact form is not configured yet.', notConfigured: true }, 503)
  if (turnstileSecret) {
    const token = str('token')
    if (!token || token.length > 2048) return json({ error: 'Please complete the spam check.' }, 403)
    const form = new URLSearchParams({ secret: turnstileSecret, response: token, remoteip: ip })
    const check = (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) })
      .then((r) => r.json())
      .catch(() => ({ success: false }))) as { success?: boolean; hostname?: string }
    // a token solved on someone else's page that reuses this site key doesn't count
    const host = process.env.SITE_HOSTNAME ?? 'burhanuddin-hassan.vercel.app'
    if (!check.success || (process.env.VERCEL_ENV === 'production' && check.hostname && check.hostname !== host)) return json({ error: 'The spam check failed. Please refresh the page and try again.' }, 403)
  }

  const key = process.env.RESEND_API_KEY
  if (!key) return json({ error: 'The contact form is not configured yet.', notConfigured: true }, 503)
  const to = process.env.CONTACT_TO ?? 'burhanuddinhantela@gmail.com'
  const from = process.env.CONTACT_FROM ?? 'Portfolio contact <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: f.email,
      subject: `Portfolio: ${f.subject}`,
      text: `From: ${f.name} <${f.email}>\n\n${f.message}`,
      html: `<p><strong>From:</strong> ${esc(f.name)} &lt;${esc(f.email)}&gt;</p><p><strong>Subject:</strong> ${esc(f.subject)}</p><p style="white-space:pre-wrap">${esc(f.message)}</p>`,
    }),
  }).catch(() => null)
  if (!res?.ok) {
    console.error('resend', res?.status, res && (await res.text()).slice(0, 300))
    return json({ error: "Your message couldn't be sent right now. Please email me directly." }, 502)
  }
  return json({ ok: true })
}

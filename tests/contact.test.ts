import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateContact } from '../api/_lib/validate'
import { POST } from '../api/contact'

const good = { name: 'Studio Recruiter', email: 'hr@studio.com', subject: 'Junior developer role', message: 'Hello, we liked your portfolio and would like to talk.' }

describe('contact form rules', () => {
  it('accepts a normal message', () => expect(validateContact(good)).toEqual({}))
  it('rejects a bad email address', () => expect(validateContact({ ...good, email: 'not-an-email' })).toHaveProperty('email'))
  it('rejects a name that is too short', () => expect(validateContact({ ...good, name: 'A' })).toHaveProperty('name'))
  it('rejects a message that is too short or too long', () => {
    expect(validateContact({ ...good, message: 'Hi' })).toHaveProperty('message')
    expect(validateContact({ ...good, message: 'x'.repeat(2001) })).toHaveProperty('message')
  })
  it('reports every broken field at once', () => expect(Object.keys(validateContact({ name: '', email: '', subject: '', message: '' })).sort()).toEqual(['email', 'message', 'name', 'subject']))
})

/** Sends the form to the server function, as the browser would. `startedAt` defaults to ten seconds ago (a human pace). */
let ipCounter = 0
const send = (body: Record<string, unknown>, ip = `10.0.0.${++ipCounter}`) =>
  POST(new Request('http://test/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ startedAt: Date.now() - 10_000, ...body }) }))

describe('contact form server: spam checks', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
  })

  it('honeypot: a filled hidden field gets a fake success and sends nothing', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await send({ ...good, website: 'http://spam.example' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('timing: a form submitted within three seconds gets a fake success and sends nothing', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await send({ ...good, startedAt: Date.now() })
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('server-side validation: bad fields are refused with per-field messages', async () => {
    const res = await send({ ...good, email: 'nope' })
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toHaveProperty('email')
  })

  it('rate limit: the sixth message from one address in ten minutes is refused', async () => {
    let last: Response | undefined
    for (let i = 0; i < 6; i++) last = await send(good, '203.0.113.9')
    expect(last!.status).toBe(429)
  })

  it('Turnstile: a failed human check is refused', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }))))
    expect((await send({ ...good, token: 'bad' })).status).toBe(403)
  })

  it('says so when the email service is not configured, instead of pretending', async () => {
    const res = await send(good)
    expect(res.status).toBe(503)
    expect((await res.json()).notConfigured).toBe(true)
  })

  it('sends through Resend with the visitor as reply-to, and escapes HTML in the message', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const res = await send({ ...good, message: 'Hello <script>alert(1)</script> there, nice work.' })
    expect(res.status).toBe(200)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const mail = JSON.parse(String(init!.body))
    expect(mail.reply_to).toBe(good.email)
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('strips line breaks from the subject, so headers cannot be injected', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    await send({ ...good, subject: 'Hello\r\nBcc: victim@example.com' })
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]!.body)).subject).not.toMatch(/[\r\n]/)
  })
})

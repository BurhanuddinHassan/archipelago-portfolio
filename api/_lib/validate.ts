/** Contact form rules, shared by the browser form and the server (the server never trusts the browser). */
export type ContactFields = { name: string; email: string; subject: string; message: string }
export type ContactErrors = Partial<Record<keyof ContactFields, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateContact(f: ContactFields): ContactErrors {
  const e: ContactErrors = {}
  if (f.name.trim().length < 2 || f.name.length > 80) e.name = 'Enter your name (2–80 characters).'
  if (!EMAIL.test(f.email.trim()) || f.email.length > 254) e.email = 'Enter a valid email address.'
  if (f.subject.trim().length < 3 || f.subject.length > 120) e.subject = 'Subject needs 3–120 characters.'
  if (f.message.trim().length < 10 || f.message.length > 2000) e.message = 'Message needs 10–2,000 characters.'
  return e
}

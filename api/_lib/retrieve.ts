/**
 * Retrieval for Echo: BM25 keyword ranking over the portfolio passages in kb.json.
 * Small, fast and dependency-free; the knowledge base is a few dozen passages.
 */
import kb from './kb.json' with { type: 'json' }

export type Passage = { id: number; title: string; href: string; text: string }
const PASSAGES = kb as Passage[]

const STOP = new Set('a an and are as at be by did do does for from has have he him his how i in is it its me my of on or that the their them they this to was what when where which who why will with you your about can tell'.split(' '))
// a few synonyms so plain-language questions still find the right passages
const ALIAS: Record<string, string[]> = {
  game: ['games', 'project', 'projects'], games: ['game', 'project', 'projects'], made: ['projects', 'built'], built: ['projects'], projects: ['games'], work: ['experience', 'intern', 'internship', 'projects'],
  job: ['internship', 'role', 'junior'], hire: ['internship', 'role', 'available'], contact: ['email', 'touch', 'linkedin'],
  email: ['contact'], skills: ['skill', 'engines', 'languages'], education: ['university', 'ned', 'degree', 'levels'],
  ai: ['enemy', 'state', 'machine', 'patrol'], vr: ['xr', 'virtual'], unity: ['c#'], unreal: ['blueprints'],
  study: ['university', 'education', 'degree', 'bs'], studied: ['university', 'education', 'degree'], award: ['jam', 'place', 'teams'], three: ['three.js', 'web'],
}

const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9#.+ ]/g, ' ').split(/\s+/).map((w) => w.replace(/\.$/, '')).filter((w) => w.length > 1 && !STOP.has(w))

const docs = PASSAGES.map((p) => {
  const t = [...tokens(p.title), ...tokens(p.title), ...tokens(p.text)] // titles count double
  const tf = new Map<string, number>()
  for (const w of t) tf.set(w, (tf.get(w) ?? 0) + 1)
  return { p, tf, len: t.length }
})
const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length
const df = new Map<string, number>()
for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) ?? 0) + 1)

export function retrieve(query: string, k = 8): Passage[] {
  const q = tokens(query)
  const terms = new Set(q.flatMap((w) => [w, ...(ALIAS[w] ?? [])]))
  const K1 = 1.4, B = 0.7, N = docs.length
  const scored = docs.map((d) => {
    let s = 0
    for (const w of terms) {
      const f = d.tf.get(w)
      if (!f) continue
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5))
      s += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avgLen)) * (q.includes(w) ? 1 : 0.5)
    }
    return { p: d.p, s }
  })
  const hits = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.p)
  // always give the model the basics, so "who is he?" style questions work
  if (hits.length < 3) for (const p of PASSAGES.slice(0, 3)) if (!hits.includes(p)) hits.push(p)
  return hits
}

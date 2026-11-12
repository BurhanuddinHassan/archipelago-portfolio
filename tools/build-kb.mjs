// Builds api/_lib/kb.json: the passages Echo (the portfolio chatbot) searches before answering.
// Sources: content/profile.yaml, journey.yaml, skills.yaml, echo.yaml and every content/projects/*.md.
// Run: node tools/build-kb.mjs   (also runs automatically before every build)
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const clean = (s) =>
  String(s ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
const noTodo = (v) => (typeof v === 'string' && /TODO/.test(v) ? '' : v)
const out = []
const add = (title, href, text) => {
  text = clean(text)
  if (text.length > 20) out.push({ id: out.length, title, href, text })
}

const profile = YAML.parse(read('content/profile.yaml'))
add('Who Burhanuddin is', '#home', `${profile.name} is a ${profile.headline}. ${noTodo(profile.tagline) ?? ''} ${profile.intro} ${noTodo(profile.availability) ?? ''} Based in ${noTodo(profile.location) || 'Karachi, Pakistan'}.`)

for (const e of YAML.parse(read('content/journey.yaml')).entries) {
  const when = noTodo(e.when) ? `${e.when}: ` : ''
  add(e.title, '#journey', `${when}${e.title}, ${e.where}. ${e.text ?? ''}`)
}

const skills = YAML.parse(read('content/skills.yaml'))
for (const g of skills.groups) add(`Skills: ${g.name}`, '#workshop', `${g.name}: ${g.skills.map((s) => s.name).join(', ')}.`)

for (const f of YAML.parse(read('content/echo.yaml')).facts) add(f.title, f.href, f.text)

const overview = []
const islandStops = new Set(['behind-the-smile', 'chrono-rebellion', 'sunken-greed', 'paper-plane-dash', 'merge-defence'])
for (const file of fs.readdirSync(path.join(root, 'content/projects'))) {
  const raw = read(`content/projects/${file}`)
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) continue
  const d = YAML.parse(m[1])
  if (d.draft) continue
  const href = islandStops.has(d.slug) ? `#${d.slug}` : '#harbor'
  const facts = [
    d.summary,
    noTodo(d.team) && `Team: ${d.team}.`,
    noTodo(d.role) && `Burhanuddin's role: ${d.role}.`,
    d.engine?.length && `Built with ${d.engine.join(', ')}.`,
    noTodo(d.year) && `Year: ${d.year}.`,
    d.links?.play && `Play it: ${d.links.play}`,
    d.links?.live && `Live: ${d.links.live}`,
  ].filter(Boolean)
  add(d.title, href, `${d.title}. ${facts.join(' ')}`)
  overview.push({ order: d.order ?? 99, line: `${d.title} (${[noTodo(d.team), d.engine?.join(', ')].filter(Boolean).join('; ')}): ${d.summary}` })
  // one passage per section of the write-up
  for (const sec of m[2].split(/^## /m).slice(1)) {
    const [head, ...rest] = sec.split('\n')
    add(`${d.title}: ${head.trim()}`, href, `${d.title}, ${head.trim()}. ${rest.join(' ').replace(/^- /gm, '')}`)
  }
}

overview.sort((a, b) => a.order - b.order)
add('All of his games and projects', '#harbor', `Games, projects and work Burhanuddin has made. Main game projects, each with its own island: ${overview.slice(0, 5).map((o) => o.line).join(' ')} Other projects and websites in The Harbor: ${overview.slice(5).map((o) => o.line).join(' ')}`)

fs.mkdirSync(path.join(root, 'api/_lib'), { recursive: true })
fs.writeFileSync(path.join(root, 'api/_lib/kb.json'), JSON.stringify(out))
console.log(`Echo knowledge base: ${out.length} passages`)

import YAML from 'yaml'
import { marked } from 'marked'
import profileRaw from '../../content/profile.yaml?raw'
import skillsRaw from '../../content/skills.yaml?raw'
import journeyRaw from '../../content/journey.yaml?raw'

export type Project = {
  title: string
  slug: string
  island: string
  order: number
  featured?: boolean
  year?: string | number
  team?: string
  role?: string
  engine: string[]
  tags: string[]
  category: '3d' | '2d' | 'xr' | 'ae' | 'web'
  summary: string
  video?: string
  thumbnail?: string
  links: { play?: string; code?: string; live?: string }
  html: string
}

export type Profile = {
  name: string
  headline: string
  subline: string
  location: string
  intro: string
  availability: string
  cv: string
  links: { email: string; linkedin: string; github: string; itch: string }
  highlight: { title: string; text: string; url: string }
}

export type SkillGroup = { name: string; skills: { name: string; proof: string[] }[] }
export type Cert = { title: string; file: string }
export type JourneyEntry = { kind: string; when: string; title: string; where: string; text: string; certs?: Cert[] }

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/** Strip "TODO" values so placeholders never reach the page. */
const clean = (v: unknown) => (typeof v === 'string' && /TODO/.test(v) ? undefined : v)

const files = import.meta.glob('../../content/projects/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const projects: Project[] = Object.values(files)
  .map((raw) => {
    const m = raw.match(FRONTMATTER)
    if (!m) throw new Error('Project file is missing frontmatter')
    const data = YAML.parse(m[1]) as Record<string, unknown>
    for (const k of Object.keys(data)) data[k] = clean(data[k])
    return {
      engine: [],
      tags: [],
      links: {},
      ...data,
      html: marked.parse(m[2]) as string,
    } as unknown as Project
  })
  .filter((p) => !(p as Project & { draft?: boolean }).draft)
  .sort((a, b) => a.order - b.order)

export const profile = YAML.parse(profileRaw) as Profile
export const skills = (YAML.parse(skillsRaw) as { groups: SkillGroup[] }).groups
export const journey = (YAML.parse(journeyRaw) as { entries: JourneyEntry[] }).entries.map((e) => ({
  ...e,
  when: clean(e.when) as string | undefined,
}))

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug)

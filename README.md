# Project Archipelago

The interactive 3D portfolio of **Burhanuddin Hassan**, Game Developer & Technical Environment Artist.
Live: **https://burhanuddin-hassan.vercel.app**

A world of floating islands, one per project. Scroll and a small sky-ship carries the Pilot (Burhanuddin's own rigged
character) from island to island while the story of each project appears beside it. Or press **Explore freely** and
walk and sail the archipelago yourself, with a keyboard or a game controller.

Built for the Web3D course at NED University, and used as a real job-hunting portfolio.

---

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # rebuild the chatbot index, type-check, production build into dist/
npm run preview  # serve the production build
npm test         # automated tests (Vitest)
```

The chatbot and the contact form are Vercel Functions (`api/`). They run on Vercel; under plain `npm run dev`
Echo falls back to search-only answers and the contact form shows the email address instead.

### Environment variables (set in Vercel, never committed)

| Variable | Used by | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `api/chat.ts` | Google Gemini API key for Echo (free tier) |
| `GEMINI_MODEL` | `api/chat.ts` | Optional. Model name, default `gemini-3.5-flash-lite` |
| `AI_GATEWAY_API_KEY` | `api/chat.ts` | Optional. Use Vercel AI Gateway instead of Gemini directly |
| `RESEND_API_KEY` | `api/contact.ts` | Sends contact form email through Resend |
| `CONTACT_TO`, `CONTACT_FROM` | `api/contact.ts` | Optional. Recipient and sender addresses |
| `TURNSTILE_SECRET_KEY` | `api/contact.ts` | Cloudflare Turnstile check, server side |
| `VITE_TURNSTILE_SITE_KEY` | `ContactForm.tsx` | Turnstile widget, browser side (public, built into the page) |

### URL flags

| Flag | Effect |
|---|---|
| `?film` | Filming mode: hides every piece of UI for clean screen recording. Scroll drives the tour; **P** (or a controller's Start) toggles Adventure Mode. |
| `?closeup` | Keeps the opening close-up camera on the Pilot. |
| `#<stop>` | Deep link to a stop, e.g. `/#contact`, `/#chrono-rebellion`. |

---

## Two ways to explore

**Tour Mode (default).** Eleven stops: Home, five project islands, More work (the Harbor), Skills (Workshop Isle),
Journey, Trailer and Contact. Scrolling is mapped to a continuous tour position; each step boards the ship, flies an
arc to the next island and lands. Drag the scene to look around.

**Adventure Mode.** Press *Explore freely*.

| Action | Keyboard | Controller (Xbox / PlayStation) |
|---|---|---|
| Walk / steer the ship | W A S D | Left stick or d-pad |
| Look | Mouse drag or arrow keys | Right stick |
| Run / boost | Shift | RT / R2 |
| Jump | Space | A / ✕ |
| Board or land | E | X / □ |
| Read about this place | F | Y / △ |
| Back to the tour | Esc | B / ○ |

Controllers are read through the browser Gamepad API in its *standard* layout, which maps Xbox and PlayStation pads
to the same physical buttons. The on-screen hints switch to controller labels when a pad is used.

---

## Folder structure

```
content/                 everything you edit to change the site's text
  profile.yaml           name, headline, intro, links
  skills.yaml            skills, each linked to the projects that prove it
  journey.yaml           education, leadership, work (newest first)
  echo.yaml              extra facts for the chatbot (contact, what he is looking for)
  projects/*.md          one file per project: frontmatter + case study
api/
  chat.ts                Echo: retrieval + LLM answer with citations
  contact.ts             contact form: spam checks + email
  _lib/retrieve.ts       BM25 search over the knowledge base
  _lib/kb.json           knowledge base, generated at build time from content/
  _lib/validate.ts       contact form rules, shared by browser and server
tools/build-kb.mjs       builds api/_lib/kb.json from content/
src/
  App.tsx                layout, scroll tracking, top bar, Adventure HUD
  store.ts               shared state (tour position, mode, theme, graphics)
  world/
    World.tsx            the scene: islands, props, sky, sun, Pilot rig, camera
    layout.ts            island positions, the 11 stops, landmark layouts, colliders
    islandGen.ts         procedural island bodies and prop placement
    islandMaterial.ts    rock strata shader
    Ambient.tsx          clouds, birds, balloons, waterfalls, night sky, backdrop islands
    SkyShip.tsx          the ship, built in code
    adventure.ts         Adventure Mode: walking, collision, sailing, landing, camera
    input.ts             keyboard + gamepad input
    landmarks/           one diorama per island (all modelled in code)
  tour/                  the text panels, Harbor filter/search, Echo, contact form
public/
  models/                chibi_character.glb (the Pilot), props.glb (nature props)
  draco/                 Draco decoder
  images/, certs/        thumbnails and certificate scans (WebP)
```

## Add a project

1. Create `content/projects/<slug>.md`, copying an existing file's frontmatter.
2. Add its thumbnail as `public/images/<slug>.webp` (16:9, about 960 px wide).
3. Set `island: harbor` to list it in the Harbor, or give it an island in `src/world/layout.ts`.
4. Push. It appears on the site and in Echo's knowledge base automatically.

Any value containing `TODO` is hidden from the page and from Echo. If a YAML value contains `: `, wrap it in quotes.

---

## How it works (short version)

- **Rendering:** React 19 + React Three Fiber 9 + drei, Three.js r187, Vite 8, TypeScript. State in zustand.
- **World:** islands are generated from a seed (rolling hilltop, rounded lip, cliff band, strata underside);
  every building and diorama is assembled in code from simple shapes and merged into one mesh per piece.
- **Echo chatbot:** BM25 retrieval over 57 passages built from the site's own content, then Gemini answers using
  only those passages and cites them `[1]`, `[2]`; each citation links to the island it came from. If the model
  can't be reached, Echo answers with the best-matching passage instead of failing.
- **Contact form:** validated in the browser and again on the server; five spam checks (honeypot, timing,
  rate limit, Cloudflare Turnstile, server validation); delivered with Resend, reply-to set to the sender.
- **Performance:** Auto / High / Low graphics setting; instanced props; small plants culled by distance;
  real shadows only on the island the Pilot is on; Draco-compressed models.

The full write-up is in the project report.

---

## Credits

- **Nature props** (trees, bushes, rocks, flowers, ferns, stump, log): *Ultimate Nature Pack* by **Quaternius**,
  CC0 1.0 (public domain), https://quaternius.com. Recoloured, smooth-shaded and merged into `public/models/props.glb`.
- **Islands, sky, clouds, the sky-ship and every landmark**: generated in code for this project
  (`src/world/islandGen.ts`, `src/world/SkyShip.tsx`, `src/world/landmarks/`).
- **The Pilot character**: base mesh generated from a photo with an AI image-to-3D tool, then rigged and
  animated with automated tools and prepared for the web by Burhanuddin. Texture atlas re-packed by `tools/rebake-character.mjs`.
- **Behind the Smile mask**: Burhanuddin's own model from the game (Blockbench), converted to code in `maskData.ts`.
- **Sound recordings** (`public/audio/`, trimmed and looped from the [AmbientSounds](https://github.com/Muges/ambientsounds) collection):
  *Wind* by felix.blume (CC0), *Fireplace* by inchadney (CC0), *Stream* by mystiscool (CC BY 3.0), all from freesound.org.
  The ship, melody, crickets and effects are synthesised in code (`src/audio.ts`).
- **Draco decoder**: Google Draco, Apache 2.0 (`public/draco/`).
- **Fonts**: Inter and Fredoka, SIL Open Font License.
- **AI assistance**: much of the code was written with an AI coding assistant (Claude) under Burhanuddin's direction,
  design decisions and review.

© Burhanuddin Hassan. Code for coursework and portfolio use.

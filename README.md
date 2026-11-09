# Project Archipelago: Burhanuddin Hassan's portfolio

An interactive 3D portfolio. **Tour Mode** (default) is a scrollable story: text on the left, the archipelago on the right, and every scroll step flies the Pilot by paper plane to the next island. **Adventure Mode** (free exploration) arrives after 20 Nov.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

To test on your phone, run `npm run dev -- --host` and open the "Network" URL on a phone on the same Wi-Fi.

## Folder structure

```
content/               <- everything you edit to change the site's text
  profile.yaml         name, headline, intro, links, Fruit Slice highlight
  skills.yaml          skills, each linked to the projects that prove it
  journey.yaml         education, leadership, work (newest first)
  projects/*.md        one file per project (frontmatter + case study)
public/images/         project thumbnails (WebP, 960 px wide)
src/
  content/index.ts     loads and parses the content files
  world/layout.ts      island positions and the 11 tour stops
  world/World.tsx      the 3D scene: islands, clouds, Pilot, paper plane, camera
  tour/Sections.tsx    the left-hand panel for each stop
  tour/Harbor.tsx      "More work": filter + search
  tour/ContactForm.tsx contact form with validation (backend lands 15 Nov)
  App.tsx              layout, scroll tracking, progress rail, top bar
  store.ts             shared state (tour progress, theme, toasts)
```

## Add a project

1. Create `content/projects/<slug>.md`, copying an existing file's frontmatter.
2. Put its thumbnail in `public/images/<slug>.webp` (16:9, about 960 px wide).
3. Set `island: harbor` to show it in the Harbor, or give it its own island in `src/world/layout.ts`.
4. Push. It appears automatically.

Any value containing `TODO` is hidden from the page, so placeholders never show publicly. Search the `content/` folder for `TODO` to find what still needs your answers.

YAML tip: if a value contains `: ` (colon + space), wrap it in quotes.

## Status (9 Nov)

- [x] Scroll tour with 11 stops, progress rail, deep links (`/#contact`)
- [x] Real content for 15 projects, skills, journey
- [x] Harbor filter + search, lazy YouTube embeds, day/night theme, mobile stacked layout
- [x] Procedural Aloft-style islands (rolling hills, cliff band, strata underside, roots, islets)
- [x] Sky-ship travel: the Pilot hops aboard, sits while sailing, hops off and waves
- [x] Rigged, animated Pilot (`public/models/chibi_character.glb`, Draco)
- [x] Island landmarks: Home Isle (cottage, outdoor cinema, post box, clickable Fruit Slice arcade) and one diorama per island
  (`src/world/landmarks/`), with night lighting and small animations
- [ ] Echo chatbot (14 Nov), contact backend (15 Nov), promo video (17–18 Nov)

## Credits

- Trees, bushes, rocks, flowers, ferns, stump and log: **Ultimate Nature Pack by Quaternius**, CC0 1.0 (public domain),
  https://quaternius.com. Recoloured to the site's palette, smooth-shaded and merged into `public/models/props.glb`.
- Island bodies, clouds, sky, the sky-ship and all landmarks are generated in code (`src/world/islandGen.ts`, `src/world/SkyShip.tsx`, `src/world/landmarks/`).
- Pilot character: base mesh generated from a photo with an AI image-to-3D tool, then rigged and animated in Blender by Burhanuddin.
- Draco decoder: Google Draco, Apache 2.0 (`public/draco/`).

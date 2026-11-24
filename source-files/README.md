# Source files

Working files behind the portfolio, kept here for review. This folder is **not part of the website**: Vite only
publishes `public/` and the built app, and `.vercelignore` keeps this folder out of every Vercel deployment.

| File | What it is | Open with |
|---|---|---|
| `promo.aep` | After Effects project of the promo video: the logbook animation, page turns, camera moves, hook and audio. | Adobe After Effects 2024 or newer |
| `Chibi_ME.blend` | Blender file of the Pilot character (mesh, rig and animations) that the site exports to `public/models/chibi_character.glb`. | Blender 3.0 or newer |

**Note on `promo.aep`:** an After Effects project stores links to its footage rather than the footage itself (gameplay
clips, textures, fonts). Opened on another machine it shows the compositions, layers, keyframes and expressions, but
footage appears as missing placeholders. The rendered promo is on YouTube: https://youtu.be/LX2jkcONnhI

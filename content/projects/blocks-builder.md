---
title: Block Builder
slug: blocks-builder
island: harbor
order: 7
featured: true
year: 2026
team: Solo project
role: Developer and pixel artist
engine: [Three.js, JavaScript, Web Audio API]
tags: [Web, 3D, Sandbox]
category: web
summary: A Minecraft-style block-building sandbox in the browser, with hand-drawn pixel textures and two camera modes.
thumbnail: /images/blocks-builder.webp
links:
  live: https://blocks-builder.netlify.app
---

## What it is
Place and break blocks on a floating 20 × 20 world. Switch between an orbit camera for building and a first-person fly mode, pick from six blocks with the number keys or mouse wheel, and your world is saved in the browser.

## How I built it
- **Raycast placement with grid snapping:** a translucent ghost block previews where the next block goes, and an outline shows what right-click will remove.
- **Two cameras:** damped orbit controls for building, pointer-lock fly controls for exploring, with a smooth hand-off between them.
- **One draw call for the clouds:** hundreds of cloud boxes in a single InstancedMesh; a shader-driven gradient sky dome and fog give the world a soft horizon.
- **Sounds made in code** with the Web Audio API, so no audio files: soft blocks thud, glass gets a high "tink".
- **Break particles** that reuse the broken block's material, and **saving** to localStorage that still works when storage is blocked.
- **Hand-drawn pixel textures** for every block.

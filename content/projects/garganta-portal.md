---
title: Garganta Portal (course lab)
slug: garganta-portal
island: harbor
order: 8
year: 2026
team: Solo project
role: Developer
engine: [Three.js, GLSL, GLTF]
tags: [Web, 3D, Shaders]
category: web
summary: A Bleach fan scene for a Web3D lab. A live portal shows a second world, and walking through it moves you there.
thumbnail: /images/garganta-portal.webp
links:
  live: https://garganta-portal.netlify.app
---

## What it is
A Web3D course lab: a character runs down a street in Karakura Town toward a Garganta, the torn black portal from *Bleach*, and arrives in Hueco Mundo on the other side.

## How I built it
- **Portal as a live window:** the second scene is rendered every frame into a `WebGLRenderTarget` and shown on the portal plane.
- **Custom shader** that cuts the plane into the Garganta's almond-shaped tear with needle spikes and fades its edges into black smoke.
- **Animated GLTF character** with an `AnimationMixer` cross-fading idle and run clips, driven by W/S movement.
- **Scene hand-off:** reaching the portal fades to black, moves the player into the second scene and plays an arrival animation.

Character model: "Mugetsu Ichigo" by Witsanu Superball, CC BY 4.0.

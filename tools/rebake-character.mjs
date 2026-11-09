// Re-pack the character's texture atlas with padding (fixes skin colour bleeding into the hair).
// Needs: npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf sharp
// Run:   node tools/rebake-character.mjs <exported.glb> public/models/chibi_character.glb
// Re-pack the character's texture atlas with padding so skin never bleeds into hair.
// Islands are only translated (no rotation/scale), so the tangent-space normal map stays valid and is copied as-is.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { draco, prune } from '@gltf-transform/functions'
import { EXTTextureWebP } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
const [,, IN, OUT] = process.argv
const PAD = 8, STRETCH = 64, W = 2048
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() })
const doc = await io.read(IN)
const mat = doc.getRoot().listMaterials()[0]
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
const texSlots = [['base', mat.getBaseColorTexture()], ['normal', mat.getNormalTexture()], ['mr', mat.getMetallicRoughnessTexture()]].filter(([, t]) => t)
const [SW, SH] = texSlots[0][1].getSize()
const src = {}
for (const [k, t] of texSlots) src[k] = (await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data

// ---- geometry: split off stretched triangles (they smear a streak across the atlas)
const sems = prim.listSemantics()
const attrs = Object.fromEntries(sems.map((s) => [s, prim.getAttribute(s)]))
const vcount = attrs.POSITION.getCount()
const data = Object.fromEntries(sems.map((s) => [s, Array.from({ length: vcount }, (_, i) => attrs[s].getElement(i, []))]))
const idx = Array.from(prim.getIndices().getArray())
const uvpx = (v) => [data.TEXCOORD_0[v][0] * SW, data.TEXCOORD_0[v][1] * SH]
const stretched = []
for (let t = 0; t < idx.length; t += 3) {
  const p = [0, 1, 2].map((k) => uvpx(idx[t + k]))
  const w = Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0])), h = Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]))
  if (w > STRETCH || h > STRETCH) stretched.push(t)
}
const stretchedSet = new Set(stretched)
// ---- islands of the remaining triangles (UV seams are already split, so shared vertex index = same island)
const par = Array.from({ length: vcount }, (_, i) => i)
const find = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x }
for (let t = 0; t < idx.length; t += 3) if (!stretchedSet.has(t)) { const a = find(idx[t]); par[find(idx[t + 1])] = a; par[find(idx[t + 2])] = a }
const islands = new Map()
for (let t = 0; t < idx.length; t += 3) {
  if (stretchedSet.has(t)) continue
  const r = find(idx[t])
  if (!islands.has(r)) islands.set(r, { tris: [], minx: 1e9, miny: 1e9, maxx: -1e9, maxy: -1e9 })
  const I = islands.get(r); I.tris.push(t)
  for (let k = 0; k < 3; k++) { const [x, y] = uvpx(idx[t + k]); I.minx = Math.min(I.minx, x); I.miny = Math.min(I.miny, y); I.maxx = Math.max(I.maxx, x); I.maxy = Math.max(I.maxy, y) }
}
// ---- pack: islands + a tiny solid patch per stretched triangle, shelf-packed into a W-wide atlas
const rects = [...islands.values()].map((I) => ({ I, w: Math.ceil(I.maxx) - Math.floor(I.minx) + 2 * PAD, h: Math.ceil(I.maxy) - Math.floor(I.miny) + 2 * PAD }))
for (const t of stretched) rects.push({ patch: t, w: 4 + 2 * PAD, h: 4 + 2 * PAD })
rects.sort((a, b) => b.h - a.h)
let x = 0, y = 0, shelf = 0
for (const r of rects) { if (x + r.w > W) { x = 0; y += shelf; shelf = 0 } r.x = x; r.y = y; x += r.w; shelf = Math.max(shelf, r.h) }
const H = Math.ceil((y + shelf) / 128) * 128
console.log(`islands ${islands.size}, stretched tris ${stretched.length}, atlas ${W}x${H}`)

const out = Object.fromEntries(texSlots.map(([k]) => [k, Buffer.alloc(W * H * 4)]))
const filled = new Uint8Array(W * H)
const sample = (k, sx, sy) => { const i = (Math.min(SH - 1, Math.max(0, sy)) * SW + Math.min(SW - 1, Math.max(0, sx))) * 4; return [src[k][i], src[k][i + 1], src[k][i + 2], src[k][i + 3]] }
const put = (k, nx, ny, c) => { const i = (ny * W + nx) * 4; out[k][i] = c[0]; out[k][i + 1] = c[1]; out[k][i + 2] = c[2]; out[k][i + 3] = 255 }

// ---- copy each island's texels (pixel-exact translation), masked to its triangles
const newUV = new Map() // vertex -> [u, v]
const EXP = 0.75
for (const r of rects) {
  if (!r.I) continue
  const I = r.I, dx = r.x + PAD - Math.floor(I.minx), dy = r.y + PAD - Math.floor(I.miny)
  for (const t of I.tris) {
    const p = [0, 1, 2].map((k) => uvpx(idx[t + k]))
    for (let k = 0; k < 3; k++) { const v = idx[t + k]; const [ux, uy] = uvpx(v); newUV.set(v, [(ux + dx) / W, (uy + dy) / H]) }
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])
    const sgn = area >= 0 ? 1 : -1
    const edges = [[p[0], p[1]], [p[1], p[2]], [p[2], p[0]]].map(([a, b]) => { const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1; return { a, ex, ey, len } })
    const x0 = Math.floor(Math.min(p[0][0], p[1][0], p[2][0]) - 1), x1 = Math.ceil(Math.max(p[0][0], p[1][0], p[2][0]) + 1)
    const y0 = Math.floor(Math.min(p[0][1], p[1][1], p[2][1]) - 1), y1 = Math.ceil(Math.max(p[0][1], p[1][1], p[2][1]) + 1)
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5, cy = py + 0.5
        let inside = true
        for (const e of edges) { const d = (sgn * (e.ex * (cy - e.a[1]) - e.ey * (cx - e.a[0]))) / e.len; if (d < -EXP) { inside = false; break } }
        if (!inside) continue
        const nx = px + dx, ny = py + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        for (const [k] of texSlots) put(k, nx, ny, sample(k, px, py))
        filled[ny * W + nx] = 1
      }
  }
}
// ---- stretched triangles: own vertices, UVs pointing at a solid patch of their corners' average colour
const extra = []
for (const r of rects) {
  if (r.patch === undefined) continue
  const t = r.patch
  const corners = [0, 1, 2].map((k) => uvpx(idx[t + k]).map(Math.floor))
  const avg = (k) => [0, 1, 2, 3].map((c) => Math.round(corners.reduce((s, q) => s + sample(k, q[0], q[1])[c], 0) / 3))
  for (const [k] of texSlots) { const col = k === 'normal' ? [128, 128, 255, 255] : avg(k); for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { put(k, r.x + PAD + xx, r.y + PAD + yy, col); filled[(r.y + PAD + yy) * W + r.x + PAD + xx] = 1 } }
  const uvc = [(r.x + PAD + 2) / W, (r.y + PAD + 2) / H]
  for (let k = 0; k < 3; k++) { const v = idx[t + k]; const nv = vcount + extra.length; extra.push({ from: v, uv: uvc }); idx[t + k] = nv }
}
// ---- dilate into the padding so bilinear filtering and mipmaps only ever see an island's own colour
for (let pass = 0; pass < PAD; pass++) {
  const add = []
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    if (filled[yy * W + xx]) continue
    let n = 0; const acc = Object.fromEntries(texSlots.map(([k]) => [k, [0, 0, 0]]))
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const X = xx + ox, Y = yy + oy
      if (X < 0 || Y < 0 || X >= W || Y >= H || !filled[Y * W + X]) continue
      n++; for (const [k] of texSlots) { const i = (Y * W + X) * 4; acc[k][0] += out[k][i]; acc[k][1] += out[k][i + 1]; acc[k][2] += out[k][i + 2] }
    }
    if (n) add.push([xx, yy, Object.fromEntries(texSlots.map(([k]) => [k, acc[k].map((v) => Math.round(v / n))]))])
  }
  for (const [xx, yy, cols] of add) { for (const [k] of texSlots) put(k, xx, yy, cols[k]); filled[yy * W + xx] = 1 }
}
// ---- rebuild vertex attributes (originals + duplicated vertices for stretched triangles)
const total = vcount + extra.length
for (const s of sems) {
  const a = attrs[s], size = a.getElementSize(), Arr = a.getArray().constructor
  const arr = new Arr(total * size)
  for (let i = 0; i < vcount; i++) { const v = s === 'TEXCOORD_0' ? (newUV.get(i) ?? [0, 0]) : data[s][i]; arr.set(v, i * size) }
  extra.forEach((e, j) => arr.set(s === 'TEXCOORD_0' ? e.uv : data[s][e.from], (vcount + j) * size))
  a.setArray(arr)
}
prim.getIndices().setArray(new Uint32Array(idx))
// ---- write the new textures
const enc = { base: (b) => b.webp({ quality: 92 }), normal: (b) => b.webp({ quality: 95 }), mr: (b) => b.webp({ quality: 90 }) }
for (const [k, t] of texSlots) {
  const buf = await enc[k](sharp(out[k], { raw: { width: W, height: H, channels: 4 } }).removeAlpha()).toBuffer()
  t.setImage(new Uint8Array(buf)).setMimeType('image/webp')
  console.log(k, (buf.length / 1024).toFixed(0), 'KB')
}
await sharp(out.base, { raw: { width: W, height: H, channels: 4 } }).removeAlpha().png().toFile('atlas-new.png')
doc.createExtension(EXTTextureWebP).setRequired(true)
await doc.transform(prune(), draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }))
await io.write(OUT, doc)

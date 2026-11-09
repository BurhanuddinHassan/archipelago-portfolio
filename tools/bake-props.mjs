// Rebuild public/models/props.glb from the CC0 Quaternius Ultimate Nature Pack (glTF folder).
// Needs: npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf
// Run:   node tools/bake-props.mjs <path-to-pack-gltf-folder> public/models/props.glb
// Bake selected CC0 Quaternius "Ultimate Nature" models into one restyled props.glb:
// one single-primitive, vertex-coloured mesh per prop, recoloured to the archipelago palette, smooth-shaded.
import { NodeIO, Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, normals, draco, prune, dedup, flatten, join, clearNodeTransform, getBounds } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
const SRC = process.argv[2], OUT = process.argv[3]
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() })
const PALETTE = {
  Brown: '#8a5a3b', Green: '#8cc152', DarkGreen: '#64a33f', White: '#efe9dc', Black: '#4a403a', Red: '#e0533d',
  Gray: '#dcc6a6', Cyan: '#f4a6c4', Yellow: '#ffd75e', Mushroom_Top: '#e8573f', Mushroom_Bottom: '#f6ead6', Pink: '#f29ac0',
}
const PROPS = {
  tree_a: 'CommonTree_1', tree_b: 'CommonTree_3', tree_c: 'CommonTree_5', pine: 'PineTree_1', pine_b: 'PineTree_3', birch: 'BirchTree_1',
  bush: 'Bush_1', bush_berries: 'BushBerries_1', rock: 'Rock_3', rock_moss: 'Rock_Moss_1', rock_moss_b: 'Rock_Moss_5',
  flowers: 'Flowers', plant: 'Plant_1', fern: 'Plant_3', stump: 'TreeStump_Moss', log: 'WoodLog_Moss',
}
const lin = (h) => { const c = [1,3,5].map(i => parseInt(h.slice(i, i+2), 16) / 255); return c.map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)) }
const out = new Document(); const buf = out.createBuffer(); const scene = out.createScene('props')
const mat = out.createMaterial('props').setBaseColorFactor([1,1,1,1]).setRoughnessFactor(1).setMetallicFactor(0)
for (const [key, file] of Object.entries(PROPS)) {
  const doc = await io.read(`${SRC}/${file}.gltf`)
  await doc.transform(flatten())
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) clearNodeTransform(n)
  const prims = []
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) prims.push(p)
  // collect into flat arrays
  const P = [], C = [], I = []
  for (const p of prims) {
    const name = p.getMaterial()?.getName() ?? 'Green'
    const col = lin(PALETTE[name] ?? '#ff00ff'); if (!PALETTE[name]) console.log('unmapped', file, name)
    const pos = p.getAttribute('POSITION'), base = P.length / 3
    for (let i = 0; i < pos.getCount(); i++) { const v = pos.getElement(i, []); P.push(...v); C.push(...col) }
    const idx = p.getIndices(); if (idx) for (const j of idx.getArray()) I.push(base + j); else for (let i = 0; i < pos.getCount(); i++) I.push(base + i)
  }
  // ground the prop: base at y=0, centred in x/z
  let minY = Infinity, cx = 0, cz = 0; const n = P.length / 3
  for (let i = 0; i < n; i++) { minY = Math.min(minY, P[3*i+1]); cx += P[3*i]; cz += P[3*i+2] }
  cx /= n; cz /= n
  for (let i = 0; i < n; i++) { P[3*i] -= cx; P[3*i+1] -= minY; P[3*i+2] -= cz }
  // smooth normals: average face normals over every vertex sharing a (quantised) position
  const N = new Float32Array(P.length), acc = new Map(), keyOf = (i) => [0,1,2].map(k => Math.round(P[3*i+k] * 2000)).join(',')
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t+1], I[t+2]]
    const ux = P[3*b]-P[3*a], uy = P[3*b+1]-P[3*a+1], uz = P[3*b+2]-P[3*a+2]
    const vx = P[3*c]-P[3*a], vy = P[3*c+1]-P[3*a+1], vz = P[3*c+2]-P[3*a+2]
    const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx
    for (const v of [a, b, c]) { const k = keyOf(v); const e = acc.get(k) || [0,0,0]; e[0]+=nx; e[1]+=ny; e[2]+=nz; acc.set(k, e) }
  }
  for (let i = 0; i < n; i++) { const e = acc.get(keyOf(i)); const l = Math.hypot(...e) || 1; N[3*i]=e[0]/l; N[3*i+1]=e[1]/l; N[3*i+2]=e[2]/l }
  const prim = out.createPrimitive()
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(N).setBuffer(buf))
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf))
    .setAttribute('COLOR_0', out.createAccessor().setType('VEC3').setArray(new Float32Array(C)).setBuffer(buf))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buf))
    .setMaterial(mat)
  const mesh = out.createMesh(key).addPrimitive(prim)
  scene.addChild(out.createNode(key).setMesh(mesh))
}
// soft, rounded shading like Aloft: weld shared corners, then smooth normals
await out.transform(weld(), dedup(), prune())
for (const node of scene.listChildren()) { const b = getBounds(node); console.log(node.getName().padEnd(14), 'size', b.max.map((v,i)=>(v-b.min[i]).toFixed(2)).join(' x '), 'tris', (()=>{const p=node.getMesh().listPrimitives()[0]; return p.getIndices()? p.getIndices().getCount()/3 : p.getAttribute('POSITION').getCount()/3})()) }
await out.transform(draco({ method: 'edgebreaker', quantizePosition: 12, quantizeNormal: 8, quantizeColor: 8 }))
await io.write(OUT, out)

import * as THREE from 'three'

/**
 * Lambert material for island bodies with procedural surface detail added in the shader:
 * - rock (any vertex colour that is more red than green): warped strata layers, thin bedding lines,
 *   vertical grain, and chunky low-poly facets;
 * - grass: soft light/dark mottling.
 * No textures are downloaded; everything is computed from the island-local position.
 */
export function makeIslandMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vLocal;
float rockMask = 0.0;
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ return vnoise(p) * 0.6 + vnoise(p * 2.1 + 7.0) * 0.3 + vnoise(p * 4.3 + 13.0) * 0.1; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  rockMask = smoothstep(-0.02, 0.05, vColor.r - vColor.g);
  float n = fbm(vLocal * 0.45);
  // rock: layers of slightly different tone, thin dark bedding lines, vertical grain
  float yy = vLocal.y + n * 2.2;
  float layer = h13(vec3(floor(yy * 0.8), 3.0, 7.0));
  float lines = smoothstep(0.82, 0.98, sin(yy * 5.0)) * 0.22 + smoothstep(0.9, 1.0, sin(yy * 13.0 + n * 6.0)) * 0.1;
  float grain = fbm(vec3(vLocal.x * 2.2, vLocal.y * 0.35, vLocal.z * 2.2));
  vec3 rock = diffuseColor.rgb * (0.88 + layer * 0.22) * (0.9 + grain * 0.22) * (1.0 - lines);
  // grass: soft mottling
  vec3 grass = diffuseColor.rgb * (0.92 + n * 0.17);
  diffuseColor.rgb = mix(grass, rock, rockMask);
}`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
{
  vec3 facet = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  normal = normalize(mix(normal, facet, rockMask * 0.75));
}`,
      )
  }
  return m
}

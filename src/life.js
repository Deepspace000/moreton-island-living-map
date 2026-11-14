// Life on and around the island: shells, sea stars and driftwood on the beaches, 4WDs on the beach
// highway, snorkelers at the wrecks, fish, turtles and stingrays under the water, seabirds, raptors,
// shorebirds and butterflies. Small things are grown by the GPU in a grid that follows the viewer;
// animals that swim or fly are instanced and animated in their vertex shaders.
import * as THREE from 'three';
import { U, VEX, MOBILE, LOW, makeMat, objectMat, LOGV, LOGF, rng, clamp } from './common.js';
import { T, meshY, heightAt, maskAt } from './terrain.js';
import { waveAt } from './water.js';
import { GB, makeLights } from './geo.js';
import { swimmers, PAINT, PELICAN, CORMORANT, BREAM, DAMSEL, ROUND, SLIM, FLATHEAD, SHARK, RAY, SHOVEL, TURTLE, DOLPHIN, DUGONG, WHALE } from './creatures.js';

const FAR = new THREE.Sphere(new THREE.Vector3(), 1e6);
const LIT_FS = /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }`;
// colour of something seen down through the water
const WATER_GLSL = /* glsl */`
vec3 throughWater(vec3 col, vec3 wp){
  float dw = (uSeaM * uVex - wp.y) / uVex; if(dw <= 0.0) return col;
  vec3 Tm = exp(-vec3(0.42, 0.082, 0.105) * dw * 2.3);
  return col * Tm + vec3(0.012, 0.20, 0.18) * (uLightCol * 0.3 + uAmbSky * 0.8) * (1.0 - Tm);
}`;
const attr = (g, name, arr, n, inst) => g.setAttribute(name, inst ? new THREE.InstancedBufferAttribute(new Float32Array(arr), n) : new THREE.Float32BufferAttribute(arr, n));

// ---------------------------------------------------------------- things lying on the beach
// One instance per grid cell around the viewer; the shader decides from the map what, if anything, lies there.
function scatter(scene, n, cs, build, body, range) {
  const cells = new Float32Array(n * n * 2); let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { cells[k++] = i - n / 2; cells[k++] = j - n / 2; }
  const g = new THREE.InstancedBufferGeometry(); build(g);
  g.setAttribute('iCell', new THREE.InstancedBufferAttribute(cells, 2)); g.instanceCount = n * n; g.boundingSphere = FAR;
  const uni = { uCentre: { value: new THREE.Vector2() }, uCS: { value: cs }, uRange: { value: n / 2 * cs } };
  const mat = makeMat({
    uniforms: uni, side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec2 iCell; attribute float aK; uniform vec2 uCentre; uniform float uCS, uRange, uRain; varying vec3 vCol, vW;
      void main(){
        vec2 cell = uCentre + iCell;
        float h1 = hash12(cell), h2 = hash12(cell + 17.3), h3 = hash12(cell * 1.7 + 5.1), h4 = hash12(cell * 0.37 + 91.0);
        vec2 xz = (cell + vec2(h1, h2)) * uCS, uv = worldUV(xz);
        vec3 mk = texture2D(uMask, uv).rgb, ov = texture2D(uOver, uv).rgb; float hgt = texture2D(uHeight, uv).r;
        float sandy = step(0.9, mk.r) * smoothstep(0.3, 0.65, mk.g) * step(0.003, uv.x) * step(uv.x, 0.997) * step(0.003, uv.y) * step(uv.y, 0.997);
        float fade = 1.0 - smoothstep(uRange * 0.7, uRange * 0.95, length(xz - (uCentre + 0.5) * uCS));
        float ca = cos(h4 * 6.2832), sa = sin(h4 * 6.2832);
        vec3 lp, nrm, c; float s = 0.0;
        ${body}
        vec3 wp = vec3(xz.x + (lp.x * ca - lp.z * sa) * s, 0.0, xz.y + (lp.x * sa + lp.z * ca) * s);
        wp.y = groundY(wp.xz) + lp.y * s;
        nrm = normalize(vec3(nrm.x * ca - nrm.z * sa, nrm.y, nrm.x * sa + nrm.z * ca));
        vCol = c * (uLightCol * (max(dot(nrm, uLightDir), 0.0) * 0.8 + 0.1) * cloudShadow(wp) + mix(uAmbGnd, uAmbSky, nrm.y * 0.5 + 0.5));
        vW = wp;
        gl_Position = s * fade <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: LIT_FS,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
  return { m, range, set(x, z) { uni.uCentre.value.set(Math.floor(x / cs), Math.floor(z / cs)); } };
}
function buildBeachLife(scene) {
  // shells and sea stars: a little fan of ten triangles, shaped by the shader into a ribbed shell or a five-armed star
  const shells = scatter(scene, LOW ? 72 : 110, 0.8, (g) => {
    const pos = [0, 1, 0], k = [-1], idx = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; pos.push(Math.cos(a), 0, Math.sin(a)); k.push(i); idx.push(0, 1 + (i + 1) % 10, 1 + i); }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float wash = smoothstep(-0.25, 0.25, hgt) * (1.0 - smoothstep(2.3, 3.4, hgt));              // from the wet sand to the high-tide line
        float star = step(h3, 0.012 * (1.0 - smoothstep(0.7, 1.6, hgt))), shell = (1.0 - star) * step(h3, 0.15);
        float odd = mod(max(aK, 0.0), 2.0), rim = step(0.0, aK);
        if(star > 0.5){
          s = 0.10 + 0.07 * h1; float r = mix(1.0, 0.36, odd);
          lp = rim > 0.5 ? vec3(position.x * r, 0.03, position.z * r) : vec3(0.0, 0.24, 0.0);
          c = mix(vec3(0.85, 0.36, 0.10), mix(vec3(0.62, 0.20, 0.12), vec3(0.80, 0.62, 0.40), step(0.5, h2)), step(0.45, h1)) * (0.75 + 0.35 * (1.0 - rim));
        } else {
          s = 0.035 + 0.045 * h1;
          // a fan with its hinge at one end, ribs marked by alternating shades
          float open = 0.55 + 0.45 * position.x;
          lp = rim > 0.5 ? vec3(position.x * 0.9, 0.02, position.z * (0.55 + 0.45 * open)) : vec3(-0.35, 0.42, 0.0);
          vec3 tone = h2 < 0.45 ? vec3(0.93, 0.90, 0.84) : h2 < 0.7 ? vec3(0.90, 0.74, 0.66) : h2 < 0.88 ? vec3(0.62, 0.56, 0.62) : vec3(0.86, 0.66, 0.36);
          c = tone * (rim > 0.5 ? mix(1.0, 0.72, odd) : 1.05);
        }
        s *= (star + shell) * sandy * wash;
        nrm = rim > 0.5 ? normalize(vec3(position.x, 0.8, position.z)) : vec3(0.0, 1.0, 0.0);`, 150);
  // sticks and logs of driftwood along the high-tide line: a six-sided cylinder laid on the sand
  const stickGeo = (g) => {
    const pos = [], k = [], idx = [], S = 6, RN = 4;
    for (let r = 0; r <= RN; r++) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2; pos.push(r / RN - 0.5, Math.cos(a), Math.sin(a)); k.push(r); }
    for (let r = 0; r < RN; r++) for (let i = 0; i < S; i++) { const j = (i + 1) % S, q = r * S; idx.push(q + i, q + S + i, q + j, q + j, q + S + i, q + S + j); }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  };
  const wood = scatter(scene, LOW ? 48 : 72, 3.4, stickGeo, /* glsl */`
        float line = smoothstep(0.7, 1.1, hgt) * (1.0 - smoothstep(2.5, 3.6, hgt));                  // where the last high tide left things
        float logK = step(h3, 0.016), stick = (1.0 - logK) * step(h3, 0.10);
        float len = logK > 0.5 ? 2.4 + 3.4 * h1 : 0.45 + 1.1 * h1, rad = logK > 0.5 ? 0.11 + 0.12 * h2 : 0.012 + 0.02 * h2;
        float taper = 1.0 - 0.45 * (position.x + 0.5), crook = sin((position.x + 0.5) * 3.1416) * (h2 - 0.5) * 0.22;
        s = (logK + stick) * sandy * line;
        lp = vec3(position.x * len, (position.y * taper + 0.75) * rad, position.z * rad * taper + crook * len);
        nrm = vec3(0.0, position.y, position.z);
        float grain = texture2D(uNoise, vec2(position.x * len * 0.35 + h1, aK * 0.07 + h2 + atan(position.z, position.y) * 0.4)).r;
        c = mix(vec3(0.58, 0.54, 0.48), vec3(0.34, 0.27, 0.20), smoothstep(0.35, 0.8, h4)) * (0.65 + 0.6 * grain);`, 420);
  // ---- the forest floor ----
  const WOODED = 'step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * step(1.5, hgt)';
  // fallen branches and sticks
  const sticks = scatter(scene, LOW ? 44 : 64, 2.1, stickGeo, /* glsl */`
        float logK = step(h3, 0.012), stick = (1.0 - logK) * step(h3, 0.3);
        float len = logK > 0.5 ? 1.8 + 2.6 * h1 : 0.35 + 1.3 * h1, rad = logK > 0.5 ? 0.07 + 0.08 * h2 : 0.01 + 0.022 * h2;
        float taper = 1.0 - 0.5 * (position.x + 0.5), crook = sin((position.x + 0.5) * 3.1416) * (h2 - 0.5) * 0.3;
        s = (logK + stick) * ${WOODED};
        lp = vec3(position.x * len, (position.y * taper + 0.8) * rad, position.z * rad * taper + crook * len);
        nrm = vec3(0.0, position.y, position.z);
        float grain = texture2D(uNoise, vec2(position.x * len * 0.35 + h1, aK * 0.07 + h2)).r;
        c = mix(mix(vec3(0.26, 0.21, 0.16), vec3(0.14, 0.10, 0.07), smoothstep(0.3, 0.7, h4)), vec3(0.04, 0.035, 0.03), step(0.82, h1) * 0.85) * (0.65 + 0.6 * grain);`, 300);
  // leaves and curls of bark: one small flat piece, long and narrow
  const litter = scatter(scene, LOW ? 84 : 128, 0.5, (g) => {
    attr(g, 'position', [-0.5, 0, 0, 0, 0, 0.5, 0.5, 0, 0, 0, 0, -0.5], 3); attr(g, 'aK', [0, 1, 0, 1], 1); g.setIndex([0, 1, 2, 0, 2, 3]);
  }, /* glsl */`
        float bark = step(h3, 0.05), leaf = (1.0 - bark) * step(h3, 0.75);
        s = (bark + leaf) * ${WOODED} * smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(xz - uCape.xy));
        float len = bark > 0.5 ? 0.16 + 0.26 * h1 : 0.07 + 0.07 * h1, wid = bark > 0.5 ? 0.025 + 0.02 * h2 : 0.02;
        lp = vec3(position.x * len, 0.012 + abs(position.x) * len * (0.06 + 0.3 * h2 * bark) + aK * 0.006, position.z * wid * 2.0);       // lying nearly flat, bark curled up at the ends
        nrm = vec3(0.0, 1.0, 0.0);
        c = bark > 0.5 ? mix(vec3(0.22, 0.18, 0.14), vec3(0.13, 0.10, 0.08), h2)
          : (h2 < 0.35 ? vec3(0.16, 0.09, 0.045) : h2 < 0.65 ? vec3(0.24, 0.16, 0.08) : h2 < 0.85 ? vec3(0.10, 0.085, 0.07) : vec3(0.30, 0.15, 0.06));
        c *= 0.7 + 0.35 * h1;`, 120);
  // tufts of grass and sedge coming up through the litter
  const tufts = scatter(scene, LOW ? 60 : 92, 1.15, (g) => {
    const pos = [], k = [], idx = [];
    for (let b = 0; b < 9; b++) {            // each blade rises, then bends over under its own weight
      const a = b * 0.71 + 0.3, ca = Math.cos(a), sa = Math.sin(a), lean = 0.2 + 0.55 * ((b * 37) % 10) / 10, tall = 0.75 + 0.35 * ((b * 13) % 7) / 6, q = pos.length / 3;
      for (const [out, up, w, u] of [[0.03, 0, 0.022, 0], [0.03 + lean * 0.3, 0.55 * tall, 0.016, 0.55], [0.03 + lean * 0.75, 0.9 * tall, 0.009, 0.85]]) for (const sd of [-1, 1]) { pos.push(ca * out - sa * w * sd, up, sa * out + ca * w * sd); k.push(u); }
      pos.push(ca * (0.03 + lean * 1.15), 0.86 * tall, sa * (0.03 + lean * 1.15)); k.push(1);
      idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3, q + 2, q + 3, q + 4, q + 4, q + 3, q + 5, q + 4, q + 5, q + 6);
    }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float headland = 1.0 - smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(xz - uCape.xy));        // long grass all over the cape
        s = (0.3 + 0.5 * h1) * (1.0 + 0.8 * headland) * step(h3, mix(0.035, 0.95, headland)) * step(0.92, mk.r) * (1.0 - smoothstep(0.45, 0.8, mk.g)) * step(1.2, hgt);
        lp = position * vec3(1.0, 0.7 + 0.6 * h2, 1.0) + vec3(sin(uTime * 1.7 + h1 * 20.0), 0.0, cos(uTime * 1.3 + h2 * 20.0)) * 0.06 * aK * aK;
        nrm = vec3(0.0, 1.0, 0.0);
        c = mix(vec3(0.20, 0.32, 0.11), vec3(0.52, 0.50, 0.24), step(0.6, h2)) * (0.55 + 0.6 * aK) * (0.8 + 0.4 * h4);`, 200);
  // ferns: on the low wet flats they cover the ground knee to waist high, each a ring of arching fronds
  const ferns = scatter(scene, LOW ? 70 : 104, 1.0, (g) => {
    const pos = [], k = [], idx = [];
    for (let f = 0; f < 10; f++) {
      const a = f * 0.628 + (f % 2) * 0.25, ca = Math.cos(a), sa = Math.sin(a), q = pos.length / 3, len = 0.8 + 0.3 * ((f * 5) % 4) / 3;
      for (const [out, up, w, u] of [[0.03, 0.03, 0.02, 0], [0.5, 0.56, 0.085, 0.55], [1.0, 0.3, 0.012, 1]]) for (const sd of [-1, 1]) { pos.push(ca * out * len - sa * w * sd, up * len, sa * out * len + ca * w * sd); k.push(u); }
      idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3, q + 2, q + 3, q + 4, q + 4, q + 3, q + 5);
    }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float wet = (1.0 - smoothstep(7.0, 11.0, hgt)) * smoothstep(120.0, 260.0, (mk.b - 0.5) * 3000.0) * step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * (1.0 - smoothstep(0.05, 0.13, max(ov.r, max(ov.g, ov.b))));
        s = (0.5 + 0.55 * h1) * step(h3, 0.9) * wet;
        lp = position * vec3(0.85 + 0.3 * h4, 0.7 + 0.6 * fract(h2 * 9.0), 0.85 + 0.3 * h1) + vec3(0.0, sin(uTime * 1.4 + h1 * 20.0 + position.x * 3.0) * 0.035 * aK, 0.0);       // no two ferns the same
        nrm = vec3(0.0, 1.0, 0.0);
        c = mix(mix(vec3(0.035, 0.13, 0.02), vec3(0.11, 0.25, 0.045), h2), vec3(0.17, 0.11, 0.05), step(0.93, fract(h1 * 7.0))) * (0.45 + 0.75 * aK);`, 260);
  // soldier crabs: when the tide is well out they come up on the bared flats in armies, small round sky-blue crabs that
  // walk a little way together and then screw themselves back down into the wet sand
  const crabs = scatter(scene, LOW ? 100 : 140, 0.24, (g) => {
    const pos = [0, 1, 0], k = [0], idx = [], S = 8;                       // a rounded shell (two rings and a crown), then four bent legs a side
    for (const [r, y] of [[0.62, 0.86], [1.0, 0.48], [0.8, 0.16]]) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r * 0.9); k.push(0); }
    for (let i = 0; i < S; i++) { const j = (i + 1) % S; idx.push(0, 1 + j, 1 + i); for (const o of [1, 1 + S]) idx.push(o + i, o + j, o + S + i, o + j, o + S + j, o + S + i); }
    for (const sd of [-1, 1]) for (let l = 0; l < 4; l++) { const q = pos.length / 3, x = 0.55 - l * 0.36, z = 0.8 * sd; pos.push(x - 0.09, 0.4, z, x + 0.09, 0.4, z, x + 0.05 * (1.5 - l), 0.62, z + 0.55 * sd, x + 0.1 * (1.5 - l), 0, z + 0.95 * sd); k.push(1, 1, 1, 1); idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3); }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float lowT = smoothstep(-0.2, -0.55, uSeaM);
        float bare = step(uSeaM + 0.05, hgt) * (1.0 - smoothstep(0.15, 0.6, hgt));                 // on the flat the tide has left
        float army = smoothstep(0.5, 0.64, texture2D(uNoise, xz / 31.0).r) * step(h3, 0.7);        // thousands here, none there
        float go = fract(uTime * 0.035 * (0.7 + 0.6 * h2) + h1 * 5.0);
        vec2 way = normalize(vec2(texture2D(uNoise, xz / 90.0).g - 0.5, texture2D(uNoise, xz / 90.0 + 0.3).b - 0.5) + 0.001), walk = way * (go - 0.5) * 1.1;
        s = (0.024 + 0.018 * h1) * lowT * bare * army * smoothstep(0.0, 0.25, sin(go * 3.1416));
        lp = position * vec3(1.0, 0.85, 1.0) + vec3(walk.x * ca + walk.y * sa, 0.0, -walk.x * sa + walk.y * ca) / max(s, 0.0005);
        nrm = normalize(vec3(position.x, 0.7, position.z));
        c = aK > 0.5 ? vec3(0.50, 0.38, 0.46) * (0.6 + 0.6 * position.y) : mix(vec3(0.30, 0.20, 0.38), mix(vec3(0.20, 0.42, 0.80), vec3(0.50, 0.72, 0.95), smoothstep(0.4, 0.95, position.y)), smoothstep(0.15, 0.45, position.y));`, 60);
  return [shells, wood, sticks, litter, tufts, ferns, crabs];
}

// ---------------------------------------------------------------- 4WDs on the beach
const GLASS = [.06, .09, .13], TYRE = [.07, .07, .075], DARK = [.13, .13, .14];
// A 4WD wagon. Besides its colour every vertex is told which part of the car it belongs to (0 body, 1 cabin, 2 wheel, 3 trim, 4 lamp),
// which way its face looks, and where on the car it sits in metres: from that the material paints doors, glass, grille, rims and beach dust.
export function fourWD(col) {
  const g = new GB(), M = new THREE.Matrix4(); let from = 0;
  const mark = (part, xy) => {
    for (let i = from; i < g.p.length / 3; i++) {
      const nx = g.n[i * 3], ny = g.n[i * 3 + 1], nz = g.n[i * 3 + 2], face = Math.abs(nz) > 0.7 ? 0 : nx > 0.7 ? 1 : ny > 0.7 ? 2 : nx < -0.7 ? 4 : ny < -0.7 ? 5 : 3;
      g.f[i * 3] = part * 8 + face + 1; g.f[i * 3 + 1] = xy || face === 0 || face === 2 || face === 5 ? g.p[i * 3] : g.p[i * 3 + 2]; g.f[i * 3 + 2] = g.p[i * 3 + 1];
    }
    from = g.p.length / 3;
  };
  g.box(0, 0.42, 0, 4.7, 0.72, 1.86, col); mark(0);                           // body
  const zc = 0.88, y0 = 1.14, y1 = 1.87, xb = -2.3, xf0 = 0.95, xf1 = 0.55;    // cabin, with a raked windscreen
  for (const sg of [1, -1]) g.quad([xb, y0, zc * sg], [xf0, y0, zc * sg], [xf1, y1, zc * sg], [xb, y1, zc * sg], col);
  g.quad([xf0, y0, zc], [xf0, y0, -zc], [xf1, y1, -zc], [xf1, y1, zc], col); g.quad([xb, y0, -zc], [xb, y0, zc], [xb, y1, zc], [xb, y1, -zc], col);
  g.quad([xb, y1, zc], [xf1, y1, zc], [xf1, y1, -zc], [xb, y1, -zc], col); mark(1);
  g.box(-0.75, 1.9, 0, 2.3, 0.06, 1.5, DARK); g.box(2.42, 0.36, 0, 0.12, 0.16, 1.82, DARK);                 // roof rack; bull bar: a bumper, two uprights and a top rail
  for (const z of [-0.46, 0.46]) g.box(2.46, 0.52, z, 0.06, 0.62, 0.06, DARK);
  g.box(2.46, 1.12, 0, 0.06, 0.06, 0.98, DARK); mark(3);
  g.box(-1.1, 1.96, 0, 1.3, 0.28, 1.2, [.25, .33, .42]); from = g.p.length / 3;                             // a swag on the rack
  g.box(2.36, 0.82, 0.62, 0.05, 0.16, 0.3, [.95, .93, .8]); g.box(2.36, 0.82, -0.62, 0.05, 0.16, 0.3, [.95, .93, .8]);
  g.box(-2.36, 0.85, 0.7, 0.05, 0.2, 0.25, [.7, .08, .06]); g.box(-2.36, 0.85, -0.7, 0.05, 0.2, 0.25, [.7, .08, .06]); mark(4);
  for (const x of [1.5, -1.55]) for (const sg of [1, -1]) {                    // wheels: a ring of tread and a disc on the outside
    const S = 14, r = 0.45, zo = 1.0 * sg, zi = 0.72 * sg, P = (i, z, rr = r) => [x + Math.cos(i / S * 6.2832) * rr, 0.44 + Math.sin(i / S * 6.2832) * rr, z];
    for (let i = 0; i < S; i++) { g.quad(P(i, zi), P(i + 1, zi), P(i + 1, zo), P(i, zo), TYRE); g.tri([x, 0.44, zo], P(i, zo), P(i + 1, zo), TYRE); }
  }
  mark(2, true);
  g.at(M.clone().makeRotationZ(Math.PI / 2).setPosition(-2.4, 1.0, 0)); g.cyl(0, 0, 0, 0.42, 0.42, 0.24, 12, TYRE, TYRE); g.at(null); mark(3);     // spare wheel on the back
  return g.build();
}
function buildCars(scene, F, lights) {
  const routes = (F.beach || []).filter(r => r.p.length > 30);
  if (!routes.length) return () => {};
  const R = rng(4004), S = 1.45, mat = objectMat({ side: THREE.DoubleSide, defines: { CAR: 1 } });
  const COLS = [[.90, .90, .88], [.80, .81, .82], [.16, .18, .16], [.62, .12, .10], [.72, .66, .50], [.13, .22, .40], [.86, .84, .70]], geos = COLS.map(fourWD);
  const cars = [];
  routes.forEach((r, ri) => {
    const cum = [0]; for (let i = 1; i < r.p.length; i++) cum.push(cum[i - 1] + Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1]));
    const len = cum[cum.length - 1], n = clamp(Math.round(len / (MOBILE ? 4200 : 2600)), 1, MOBILE ? 5 : 9);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geos[(R() * geos.length) | 0], mat); m.name = 'car'; m.rotation.order = 'YZX'; m.scale.setScalar(S); m.frustumCulled = false; scene.add(m);
      const dir = R() < 0.5 ? 1 : -1;
      cars.push({ m, p: r.p, cum, len, s: (k + R()) / n * len, dir, lane: dir * (1.6 + R()), sp: 8 + R() * 6, i: 1, y: 0, li: [lights.add([0, 0, 0], [1, .93, .75], 0, 1, 0, 1.3), lights.add([0, 0, 0], [1, .93, .75], 0, 1, 0, 1.3)] });
    }
  });
  // fresh tyre marks: each car lays two ribbons of tread behind it, which fade over a couple of minutes and wash out near the water
  const NT = 110, tp = new Float32Array(cars.length * NT * 4 * 3), td = new Float32Array(cars.length * NT * 4 * 3), ti = [];
  cars.forEach((c, k) => { c.k = k; c.lx = 1e9; c.lz = 0; c.run = 0; for (let j = 0; j < NT - 1; j++) for (const h of [0, 2]) { const o = (k * NT + j) * 4 + h; ti.push(o, o + 1, o + 4, o + 4, o + 1, o + 5); } });
  td.fill(-1e6);
  const tg = new THREE.BufferGeometry(), tpa = new THREE.BufferAttribute(tp, 3).setUsage(THREE.DynamicDrawUsage), tda = new THREE.BufferAttribute(td, 3).setUsage(THREE.DynamicDrawUsage);
  tg.setAttribute('position', tpa); tg.setAttribute('aD', tda); tg.setIndex(ti); tg.boundingSphere = FAR;
  const tmesh = new THREE.Mesh(tg, makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vs: /* glsl */`attribute vec3 aD; varying vec3 vD, vW; void main(){ vD = aD; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`varying vec3 vD, vW;
      void main(){ ${LOGF}
        float age = uTime - vD.z, a = clamp(1.0 - age / 150.0, 0.0, 1.0) * step(-1e5, vD.z) * smoothstep(0.15, 0.7, (vW.y - uSeaM * uVex) / uVex);
        float across = abs(vD.y), blocks = step(0.42, fract(vD.x * 2.6 + across * 0.9 * sign(vD.y))) ;          // chevrons of tread, pressed into the sand
        float press = mix(0.55, 1.0, blocks) * smoothstep(1.0, 0.8, across) + 0.35 * smoothstep(0.25, 0.0, abs(across - 0.9));    // and a ridge pushed up at each edge
        float crumble = 0.6 + 0.4 * texture2D(uNoise, vW.xz * 0.9).r;
        vec3 c = vec3(0.34, 0.28, 0.18) * (uLightCol * (0.2 + 0.5 * max(uLightDir.y, 0.0)) * cloudShadow(vW) + uAmbSky * 0.7);
        gl_FragColor = vec4(applyFog(c, vW), a * press * crumble * 0.62); }`,
  }));
  tmesh.name = 'tyremarks'; tmesh.frustumCulled = false; tmesh.renderOrder = 3; scene.add(tmesh);
  return (dt) => {
    let laid = false;
    for (const c of cars) {
      c.s += c.sp * c.dir * dt;
      if (c.s > c.len - 40 || c.s < 40) { c.dir *= -1; c.lane *= -1; c.s = clamp(c.s, 40, c.len - 40); }
      while (c.i < c.cum.length - 1 && c.cum[c.i] < c.s) c.i++;
      while (c.i > 1 && c.cum[c.i - 1] > c.s) c.i--;
      const a = c.p[c.i - 1], b = c.p[c.i], f = (c.s - c.cum[c.i - 1]) / Math.max(1, c.cum[c.i] - c.cum[c.i - 1]);
      let tx = (b[0] - a[0]) * c.dir, tz = (b[1] - a[1]) * c.dir; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const x = a[0] + (b[0] - a[0]) * f + tz * c.lane, z = a[1] + (b[1] - a[1]) * f - tx * c.lane;
      const y = Math.max(meshY(x, z), U.uSeaM.value * VEX - 0.2), yf = meshY(x + tx * 3, z + tz * 3), yb = meshY(x - tx * 3, z - tz * 3);
      c.y += (y - c.y) * Math.min(1, dt * 8);
      c.m.position.set(x, c.y, z);
      const hd = Math.atan2(-tz, tx); let d = ((hd - c.m.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      c.m.rotation.set(0, c.m.rotation.y + clamp(d, -dt * 2.5, dt * 2.5), Math.atan2(yf - yb, 6 * S));
      const fx = x + tx * 3.5 * S, fz = z + tz * 3.5 * S;
      lights.move(c.li[0], fx - tz * 0.9, c.y + 1.2 * S, fz + tx * 0.9); lights.move(c.li[1], fx + tz * 0.9, c.y + 1.2 * S, fz - tx * 0.9);
      const step = Math.hypot(x - c.lx, z - c.lz);
      if (step > 1.4) {               // another length of track under the back wheels
        const o = c.k * NT * 12; tp.copyWithin(o + 12, o, o + (NT - 1) * 12); td.copyWithin(o + 12, o, o + (NT - 1) * 12);
        const jump = step > 30; c.run += jump ? 0 : step; c.lx = x; c.lz = z;
        const bx = x - tx * 1.5 * S, bz = z - tz * 1.5 * S, now = jump ? -1e6 : U.uTime.value;
        [-1, 1].forEach((sd, h) => { const cx = bx - tz * sd * 0.86 * S, cz = bz + tx * sd * 0.86 * S; for (const e of [-1, 1]) { const q = o + (h * 2 + (e + 1) / 2) * 3, px = cx - tz * e * 0.21 * S, pz = cz + tx * e * 0.21 * S; tp[q] = px; tp[q + 1] = meshY(px, pz) + 0.035; tp[q + 2] = pz; td[q] = c.run; td[q + 1] = e * sd; td[q + 2] = now; } });
        laid = true;
      }
    }
    if (laid) { tpa.needsUpdate = true; tda.needsUpdate = true; }
  };
}

// ---------------------------------------------------------------- snorkelers at the wrecks
function snorkeler(suit, fin) {
  const g = new GB(), SKIN = [.82, .64, .52];
  g.box(0, -0.14, 0, 0.62, 0.22, 0.4, suit); g.box(-0.62, -0.13, 0.1, 0.66, 0.15, 0.15, suit); g.box(-0.62, -0.13, -0.1, 0.66, 0.15, 0.15, suit);   // body and legs, face down
  g.box(-1.15, -0.1, 0.1, 0.42, 0.04, 0.2, fin); g.box(-1.15, -0.1, -0.1, 0.42, 0.04, 0.2, fin);
  g.box(0.25, -0.12, 0.3, 0.5, 0.1, 0.1, SKIN); g.box(0.25, -0.12, -0.3, 0.5, 0.1, 0.1, SKIN);
  g.box(0.45, -0.1, 0, 0.24, 0.24, 0.22, [.2, .16, .12]); g.box(0.56, -0.12, 0, 0.06, 0.12, 0.2, [.1, .3, .6]);       // head and mask
  g.cyl(0.42, 0.1, 0.13, 0.022, 0.022, 0.3, 5, [1, .45, .05], [1, .45, .05]);                                         // snorkel
  return g.build();
}
function buildSnorkelers(scene, F) {
  const R = rng(909), mat = objectMat({ side: THREE.DoubleSide }), S = 1.5;
  const geos = [snorkeler([.08, .1, .14], [.95, .8, .1]), snorkeler([.1, .25, .55], [.1, .1, .1]), snorkeler([.7, .15, .25], [.2, .7, .9]), snorkeler([.1, .1, .1], [.9, .3, .6])];
  const near = F.wrecks.filter(w => Math.hypot(w.c[0] + 2262, w.c[1] + 2174) < 900), list = [];
  const n = Math.min(MOBILE ? 10 : 18, near.length * 2);
  for (let i = 0; i < n; i++) {
    const w = near[i % near.length].c, m = new THREE.Mesh(geos[i % geos.length], mat); m.name = 'snorkeler'; m.rotation.order = 'YZX'; m.scale.setScalar(S); m.frustumCulled = false; scene.add(m);
    list.push({ m, cx: w[0] + (R() - .5) * 30, cz: w[1] + (R() - .5) * 30, r: 9 + R() * 16, ph: R() * 6.283, sp: (0.18 + R() * 0.2) * (R() < .5 ? 1 : -1) });
  }
  return (dt, t) => {
    const sea = U.uSeaM.value * VEX;
    for (const s of list) {
      const a = s.ph + t * s.sp / s.r * 4, rr = s.r * (1 + 0.3 * Math.sin(a * 2.3 + s.ph)), x = s.cx + Math.cos(a) * rr, z = s.cz + Math.sin(a) * rr;
      s.m.visible = U.uSeaM.value - heightAt(x, z) > 0.7;
      s.m.position.set(x, sea + waveAt(x, z, t) * VEX, z);
      s.m.rotation.set(Math.sin(t * 1.7 + s.ph) * 0.12, -(a + Math.sign(s.sp) * Math.PI / 2), Math.sin(t * 0.8 + s.ph) * 0.05);
    }
  };
}

// ---------------------------------------------------------------- fish, sharks, rays, turtles and jellyfish
// Each animal swims a wobbly loop around a home point. list: [cx, cz, radius, depth, phase, speed, size, seed] per animal.
// Blue blubber jellyfish: a pulsing bell with a bunch of short arms under it, drifting in swarms. list: [x, z, depth, phase, size] each.
function jellyfish(scene, list) {
  const pos = [0, 0.5, 0], pr = [0, 0], idx = [], S = 8, RN = 4;
  for (let j = 1; j <= RN; j++) for (let i = 0; i < S; i++) { const t = j / RN * 1.75, a = i / S * Math.PI * 2, r = Math.sin(Math.min(t, 1.57)) * (j === RN ? 0.92 : 1) * 0.5; pos.push(Math.cos(a) * r, 0.5 * Math.cos(Math.min(t, 1.75)), Math.sin(a) * r); pr.push(j / RN, 0); }
  for (let i = 0; i < S; i++) idx.push(0, 1 + (i + 1) % S, 1 + i);
  for (let j = 0; j < RN - 1; j++) for (let i = 0; i < S; i++) { const p = 1 + j * S, k = (i + 1) % S; idx.push(p + i, p + k, p + S + i, p + k, p + S + k, p + S + i); }
  for (let f = 0; f < 6; f++) {
    const a = f / 6 * Math.PI * 2, q = pos.length / 3, ca = Math.cos(a) * 0.16, sa = Math.sin(a) * 0.16;
    for (let j = 0; j <= 3; j++) { const d = j / 3, w = 0.07 * (1 - 0.5 * d); pos.push(ca - Math.sin(a) * w, -0.05 - d * 0.75, sa + Math.cos(a) * w, ca + Math.sin(a) * w, -0.05 - d * 0.75, sa - Math.cos(a) * w); pr.push(0.4, d, 0.4, d); if (j) { const p = q + j * 2; idx.push(p - 2, p - 1, p, p, p - 1, p + 1); } }
  }
  const n = list.length / 5, g = new THREE.InstancedBufferGeometry(), a = new Float32Array(n * 4), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { a.set(list.slice(i * 5, i * 5 + 4), i * 4); b[i] = list[i * 5 + 4]; }
  attr(g, 'position', pos, 3); attr(g, 'aPR', pr, 2); g.setIndex(idx);
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iS', new THREE.InstancedBufferAttribute(b, 1)); g.instanceCount = n; g.boundingSphere = FAR;
  const mat = makeMat({
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vs: /* glsl */`
      attribute vec2 aPR; attribute vec4 iA; attribute float iS; varying vec3 vCol, vW; varying float vA;
      ${WATER_GLSL}
      void main(){
        float ph = iA.w, pulse = sin(uTime * 1.7 + ph * 6.2832), drift = uTime * 0.05 + ph * 6.2832;
        vec2 c = iA.xy + vec2(cos(drift), sin(drift * 0.7)) * 2.5;
        float sea = uSeaM * uVex, bed = groundY(c);
        float y = max(bed + 0.9 * iS, sea - (iA.z + 0.25 * sin(uTime * 0.31 + ph * 20.0)) * uVex);
        vec3 lp = position;
        lp.xz *= 1.0 + 0.2 * pulse * aPR.x * step(aPR.y, 0.001);                                   // the bell opens and closes
        lp.y += 0.07 * pulse * aPR.x * step(aPR.y, 0.001) + 0.06 * pulse * aPR.y;
        lp.xz += vec2(sin(uTime * 1.2 + ph * 9.0 + aPR.y * 3.0), cos(uTime * 0.9 + ph * 5.0 + aPR.y * 2.6)) * 0.09 * aPR.y;   // the arms trail and sway
        vec3 wp = vec3(c.x, y, c.y) + lp * iS;
        float ok = step(bed, sea - 0.8 * uVex) * (1.0 - smoothstep(260.0, 380.0, length(wp - cameraPosition)));
        vec3 col = mix(vec3(0.50, 0.66, 0.92), vec3(0.62, 0.50, 0.38), step(0.7, fract(ph * 5.3))) * (aPR.y > 0.001 ? 0.75 : 1.0 - 0.25 * aPR.x);
        col *= uLightCol * (0.3 + 0.5 * max(uLightDir.y, 0.0)) + uAmbSky;
        vCol = throughWater(col, wp); vW = wp; vA = aPR.y > 0.001 ? 0.75 : 0.5 + 0.3 * aPR.x;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vW; varying float vA; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), vA); }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = 'jellyfish'; m.frustumCulled = false; m.renderOrder = 6; scene.add(m);
}
function buildSeaLife(scene, F) {
  const R = rng(5150), depth = (x, z) => -heightAt(x, z), K = MOBILE ? 0.6 : 1;          // depths at mean sea level
  // a spot of water of the wanted depth near a point
  const spot = (cx, cz, rad, d0, d1) => { for (let t = 0; t < 40; t++) { const a = R() * 6.283, r = Math.sqrt(R()) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (Math.abs(x) < T.sx / 2 - 300 && Math.abs(z) < T.sz / 2 - 300) { const d = depth(x, z); if (d > d0 && d < d1) return [x, z, d]; } } return null; };
  // a spot anywhere round the island, in water of the wanted depth and within reach of the shore or a bank
  const anywhere = (d0, d1) => { for (let t = 0; t < 400; t++) { const x = (R() - 0.5) * (T.sx - 800), z = (R() - 0.5) * (T.sz - 800), d = depth(x, z); if (d > d0 && d < d1 && maskAt(x, z).shore > -900) return [x, z, d]; } return null; };
  const school = (out, x, z, d, n, r0, size) => { const ph = R() * 6.283, sp = 0.5 + R() * 0.5, way = R() < 0.5 ? 0.2 : 0.8; for (let i = 0; i < n; i++) out.push(x + (R() - .5) * 3, z + (R() - .5) * 3, r0 + R() * 2.5, Math.min(d - 0.3, 0.45 + R() * 1.3), ph + i * 0.11 + R() * 0.2, sp, size * (0.8 + R() * 0.4), way + R() * 0.15); };
  const bream = [], stripey = [], blue = [], small = [], whiting = [], flathead = [], turtles = [], rays = [], sharks = [], shovels = [], jelly = [];
  const tg = F.places.find(p => /^Tangalooma/.test(p.n || ''))?.p || [-1744, -540];
  // every wreck is a reef: striped sergeants close in, a cloud of small blue-green fish over the hull, bream and trevally circling wider
  for (const w of F.wrecks) {
    const d = Math.max(depth(w.c[0], w.c[1]), 2.2); if (depth(w.c[0], w.c[1]) < 0.6) continue;
    school(stripey, w.c[0], w.c[1], d, Math.round(18 * K), 5 + R() * 5, 0.8); school(stripey, w.c[0] + (R() - .5) * 20, w.c[1] + (R() - .5) * 20, d, Math.round(10 * K), 9 + R() * 6, 0.8);
    school(blue, w.c[0], w.c[1], d, Math.round(26 * K), 3 + R() * 4, 0.5); school(blue, w.c[0] + (R() - .5) * 24, w.c[1] + (R() - .5) * 24, d, Math.round(16 * K), 6 + R() * 5, 0.5);
    school(bream, w.c[0] + 8, w.c[1], d, Math.round(14 * K), 12 + R() * 9, 1.15);
  }
  for (let i = 0; i < 26 * K; i++) { const s = spot(tg[0] - 250, tg[1] - 600, 1900, 1.5, 6); if (s) school(i % 2 ? bream : stripey, s[0], s[1], s[2], 9, 5 + R() * 9, i % 2 ? 0.95 : 0.7); }
  // schools of small fish (whiting, hardyheads, baitfish) all round the island, in the shallows and over the banks
  for (let i = 0; i < 190 * K; i++) { const s = anywhere(0.5, 4); if (s) school(small, s[0], s[1], s[2], 8 + ((R() * 9) | 0), 3 + R() * 8, 0.28 + R() * 0.16); }
  // whiting: slim sand-coloured fish working the edge of the beaches in schools, in water barely knee deep
  for (let i = 0; i < 150 * K; i++) { const s = anywhere(0.3, 1.5); if (s) school(whiting, s[0], s[1], s[2], 8 + ((R() * 7) | 0), 3 + R() * 6, 0.3 + R() * 0.1); }
  // dusky flathead lying on the sand in the lagoons and the sheltered shallows, shifting a little now and then
  const lag = F.lakes.filter(l => /Lagoon/.test(l.n || '')).map(l => l.c);
  for (let i = 0; i < 110 * K; i++) { const s = i < 30 && lag.length ? spot(lag[i % lag.length][0], lag[i % lag.length][1], 500, 0.3, 3.5) : anywhere(0.4, 2.6); if (s && (i < 30 || maskAt(s[0], s[1]).expo < 0.5)) flathead.push(s[0], s[1], 2 + R() * 5, 0, R() * 6.283, 0.05 + R() * 0.12, 0.5 + R() * 0.35, R()); }
  const coast = (n, rad, d0, d1, f) => { for (let i = 0; i < n; i++) { const z = (R() - 0.5) * T.sz * 0.8; let x = -T.sx / 2 + 400; while (x < T.sx / 2 && depth(x, z) > 0.2) x += 40; const s = spot(i % 3 === 0 ? tg[0] - 300 : x - rad * 0.6, i % 3 === 0 ? tg[1] - 800 + (R() - .5) * 2600 : z, rad, d0, d1); if (s) f(s); } };
  coast(60 * K, 900, 1.6, 7, (s) => turtles.push(s[0], s[1], 12 + R() * 24, 0.5 + R() * 1.3, R() * 6.283, 0.45 + R() * 0.35, 1.3 + R() * 0.6, R()));     // green turtles over the seagrass on the bay side
  // stingrays over the sand: in water that is shallow at some state of the tide; more of them come in when it is low
  for (let i = 0; i < 260 * K; i++) { const s = anywhere(0.35, 2.8); if (s) rays.push(s[0], s[1], 5 + R() * 12, 0, R() * 6.283, 0.3 + R() * 0.35, 0.9 + R() * 0.8, R()); }
  // shovelnose rays lying and cruising on the sand flats; small sharks patrolling the shallows and the wrecks
  for (let i = 0; i < 60 * K; i++) { const s = anywhere(0.6, 3.5); if (s) shovels.push(s[0], s[1], 8 + R() * 16, 0, R() * 6.283, 0.25 + R() * 0.3, 1.0 + R() * 0.7, R()); }
  for (let i = 0; i < 34 * K; i++) { const s = i % 4 === 0 ? spot(tg[0] - 400, tg[1] - 1400, 1200, 1.5, 6) : anywhere(1.2, 5); if (s) sharks.push(s[0], s[1], 18 + R() * 40, 0.35 + R() * 0.9, R() * 6.283, 0.8 + R() * 0.6, 1.1 + R() * 0.7, R()); }
  // jellyfish in swarms on the bay side
  for (let i = 0; i < 30 * K; i++) { const s = anywhere(1.5, 9); if (!s || maskAt(s[0], s[1]).expo > 0.5) continue; for (let j = 0; j < 11; j++) jelly.push(s[0] + (R() - .5) * 40, s[1] + (R() - .5) * 40, 0.3 + R() * 1.1, R(), 0.22 + R() * 0.2); }
  // damselfish of the Queensland coast, close in round every wreck: neon damsels in a blue cloud, humbugs hanging over the plates
  const neon = [], humbug = [], dolphins = [], dugongs = [], whales = [];
  for (const w of F.wrecks) {
    const d = Math.max(depth(w.c[0], w.c[1]), 2.2); if (depth(w.c[0], w.c[1]) < 0.6) continue;
    school(neon, w.c[0] + (R() - .5) * 10, w.c[1] + (R() - .5) * 10, d, Math.round(22 * K), 2.5 + R() * 3, 0.42); school(humbug, w.c[0] + (R() - .5) * 14, w.c[1] + (R() - .5) * 14, d, Math.round(12 * K), 2 + R() * 2.5, 0.4);
  }
  // bottlenose dolphins: a pod that keeps to the water off the Tangalooma jetty, others ranging the bay side
  const pod = (out, s, n, size, r0) => { const ph = R() * 6.283, sp = 2.2 + R() * 1.2, way = R() < 0.5 ? 0.2 : 0.8; for (let i = 0; i < n; i++) out.push(s[0] + (R() - .5) * 14, s[1] + (R() - .5) * 14, r0 + R() * 14, 0.9 + R() * 1.2, ph + i * 0.09 + R() * 0.08, sp, size * (0.85 + R() * 0.3), way + R() * 0.15); };
  { const s = spot(tg[0] - 420, tg[1] - 150, 380, 2.5, 9); if (s) pod(dolphins, s, 6, 3.1, 45); }
  for (let i = 0; i < 5 * K; i++) { const s = anywhere(3, 12); if (s && maskAt(s[0], s[1]).expo < 0.6) pod(dolphins, s, 3 + ((R() * 4) | 0), 3.1, 60); }
  // dugongs grazing the seagrass on the sheltered banks west and south of the island
  for (let i = 0; i < 14 * K; i++) { const s = anywhere(1.8, 4.5); if (s && maskAt(s[0], s[1]).expo < 0.4) for (let j = 0; j < 1 + ((R() * 3) | 0); j++) dugongs.push(s[0] + (R() - .5) * 30, s[1] + (R() - .5) * 30, 14 + R() * 20, 1.2 + R(), R() * 6.283, 0.5 + R() * 0.3, 3.2 * (0.8 + R() * 0.4), R()); }
  // humpback whales passing Cape Moreton on the open sea side (they migrate past from June to November)
  const cape = F.lights.find(l => /Cape/.test(l.n || ''))?.p || [7400, -16800];
  for (let i = 0; i < 5; i++) { const s = spot(cape[0] + 1500, cape[1] + 1500 + i * 900, 2200, 12, 200); if (s) for (let j = 0; j < 1 + (i % 2); j++) whales.push(s[0] + j * 30, s[1] + j * 22, 160 + R() * 120, 3 + R() * 3, R() * 6.283 + j * 0.05, 2.2, 14 * (j ? 0.45 : 1), R() * 0.4); }
  const SILV = [0.86, 0.89, 0.9];
  swimmers(scene, { ...BREAM, paint: PAINT.bream, name: 'bream', amp: 0.13, rate: 8, colA: [0.34, 0.38, 0.36], colB: SILV, colC: [0.45, 0.47, 0.42], see: 420 }, bream);
  swimmers(scene, { ...SLIM, paint: PAINT.bait, name: 'blue', amp: 0.15, rate: 13, colA: [0.10, 0.42, 0.50], colB: [0.80, 0.92, 0.80], colC: [0.5, 0.7, 0.6], eye: [0.39, 0.012, 0.02], see: 300, min: 0.5 }, blue);
  swimmers(scene, { ...DAMSEL, paint: PAINT.sergeant, name: 'stripey', amp: 0.13, rate: 10, colA: [0.62, 0.70, 0.72], colB: [0.90, 0.92, 0.90], colC: [0.55, 0.6, 0.55], see: 420 }, stripey);
  swimmers(scene, { ...DAMSEL, paint: PAINT.neon, name: 'neon', amp: 0.14, rate: 14, colA: [0.02, 0.25, 0.95], colB: [0.1, 0.5, 1.0], colC: [0.04, 0.3, 1.0], see: 260, min: 0.6 }, neon);
  swimmers(scene, { ...ROUND, paint: PAINT.humbug, name: 'humbug', amp: 0.12, rate: 12, colA: [0.86, 0.87, 0.84], colB: [0.9, 0.9, 0.88], colC: [0.05, 0.05, 0.05], see: 260, min: 0.6 }, humbug);
  swimmers(scene, { ...SLIM, paint: PAINT.bait, name: 'small', amp: 0.16, rate: 14, colA: [0.30, 0.38, 0.30], colB: [0.90, 0.92, 0.88], colC: [0.6, 0.62, 0.55], eye: [0.39, 0.012, 0.02], see: 260, min: 0.3 }, small);
  swimmers(scene, { ...SLIM, paint: PAINT.whiting, name: 'whiting', amp: 0.15, rate: 13, colA: [0.56, 0.52, 0.36], colB: [0.94, 0.93, 0.88], colC: [0.7, 0.66, 0.4], eye: [0.39, 0.012, 0.02], see: 240, min: 0.22 }, whiting);
  swimmers(scene, { ...FLATHEAD, paint: PAINT.flathead, name: 'flathead', bottom: 1, amp: 0.05, rate: 2.2, colA: [0.42, 0.34, 0.2], colB: [0.84, 0.8, 0.68], colC: [0.5, 0.42, 0.26], eye: [0.37, 0.055, 0.016], see: 500, min: 0.25 }, flathead);
  swimmers(scene, { ...TURTLE, paint: PAINT.turtle, name: 'turtles', vertical: 1, amp: 0.2, rate: 1.7, colA: [0.30, 0.25, 0.12], colB: [0.7, 0.66, 0.44], eye: [0.735, 0.06, 0.015], rise: [0.02, 0.07], see: 1100 }, turtles);
  swimmers(scene, { ...RAY, paint: PAINT.ray, name: 'rays', vertical: 1, bottom: 1, tidal: 1, amp: 0.1, rate: 2.2, colA: [0.36, 0.31, 0.22], colB: [0.80, 0.76, 0.66], eye: [0.3, 0.085, 0.02], see: 900, min: 0.25 }, rays);
  swimmers(scene, { ...SHOVEL, paint: PAINT.shovel, name: 'shovelnose', bottom: 1, amp: 0.07, rate: 3, colA: [0.46, 0.4, 0.26], colB: [0.84, 0.8, 0.7], colC: [0.4, 0.34, 0.22], eye: [0.31, 0.075, 0.014], see: 900, min: 0.3 }, shovels);
  swimmers(scene, { ...SHARK, paint: PAINT.shark, name: 'sharks', amp: 0.1, rate: 3.2, colA: [0.20, 0.20, 0.19], colB: [0.86, 0.86, 0.83], colC: [0.2, 0.2, 0.19], eye: [0.43, 0.0, 0.011], see: 1200, min: 0.7 }, sharks);
  swimmers(scene, { ...DOLPHIN, paint: PAINT.dolphin, name: 'dolphins', vertical: 1, amp: 0.1, rate: 3.4, colA: [0.17, 0.19, 0.22], colB: [0.80, 0.76, 0.74], colC: [0.16, 0.18, 0.2], eye: [0.385, -0.008, 0.011], rise: [0.07, 0.75], see: 2600, min: 1.5 }, dolphins);
  swimmers(scene, { ...DUGONG, paint: PAINT.dugong, name: 'dugongs', vertical: 1, amp: 0.07, rate: 1.5, colA: [0.36, 0.33, 0.29], colB: [0.62, 0.58, 0.52], colC: [0.33, 0.3, 0.27], eye: [0.4, 0.0, 0.009], rise: [0.03, 0.16], see: 2200, min: 1.3 }, dugongs);
  swimmers(scene, { ...WHALE, paint: PAINT.whale, name: 'whales', vertical: 1, amp: 0.06, rate: 0.8, colA: [0.045, 0.05, 0.06], colB: [0.86, 0.86, 0.82], colC: [0.5, 0.5, 0.5], eye: [0.3, -0.035, 0.007], rise: [0.045, 0.22], see: 9000, min: 6 }, whales);
  jellyfish(scene, jelly);
}

// ---------------------------------------------------------------- birds
// Flying birds circle a home point, flapping or soaring. list per bird: [x, alt, z, radius, phase, speed, size, follow(0/1) + flap(0..0.9)] then two colours.
const BIRD = (() => {
  const pos = [0.5, 0, 0, -0.45, 0, 0, 0, 0.08, 0, 0, -0.07, 0, 0, 0, 0.09, 0, 0, -0.09, -0.75, 0.01, 0.12, -0.75, 0.01, -0.12];
  const wing = [0, 0, 0, 0, 0, 0, 0, 0], tone = [0, 0, 0, 0.2, 0, 0, 0.6, 0.6];
  const idx = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 4, 2, 1, 3, 4, 1, 5, 3, 1, 2, 5, 1, 6, 7];
  for (const s of [-1, 1]) {
    const k = pos.length / 3;
    pos.push(0.16, 0.03, 0.08 * s, -0.16, 0.03, 0.08 * s, 0.14, 0.03, 0.55 * s, -0.12, 0.03, 0.5 * s, -0.04, 0.03, 1.0 * s);
    wing.push(0.08 * s, 0.08 * s, 0.55 * s, 0.5 * s, s); tone.push(0.6, 0.6, 0.6, 0.6, 1);
    idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3, k + 2, k + 3, k + 4);
  }
  return { pos, wing, tone, idx };
})();
function buildBirds(scene, F) {
  const R = rng(2468), list = [], cols = [];
  const WHITE = [.95, .95, .93], GREY = [.62, .65, .68], BLACK = [.08, .08, .09];
  // height of the ground under a bird's whole circuit, so it never flies through a dune
  const clear = (x, z, rad) => { let y = 0; for (let i = 0; i < 8; i++) y = Math.max(y, meshY(x + Math.cos(i * 0.785) * rad, z + Math.sin(i * 0.785) * rad * 0.8)); return y; };
  const add = (x, alt, z, rad, sp, size, follow, flap, a, b, ph = R() * 6.283) => { if (!follow) alt += clear(x, z, rad); list.push(x, alt, z, rad, ph, sp * (R() < 0.5 ? 1 : -1), size, follow + flap); cols.push(...a, ...b); };
  const places = [...F.places.map(p => p.p), ...F.views.map(v => v.c || v.p)].filter(Boolean);
  // silver gulls and crested terns over the settlements, the wrecks and the headlands
  for (const p of places) for (let i = 0; i < 7; i++) { const tern = i > 4; add(p[0] - 150 + (R() - .5) * 500, 7 + R() * 26, p[1] + (R() - .5) * 500, 18 + R() * 55, 8 + R() * 4, tern ? 0.85 : 1.0, 0, tern ? 0.9 : 0.75, WHITE, tern ? [.75, .78, .8] : GREY); }
  // a few always near whoever is looking
  for (let i = 0; i < 9; i++) add((R() - .5) * 260, 9 + R() * 30, (R() - .5) * 260, 20 + R() * 50, 8 + R() * 4, 1.0, 1, 0.75, WHITE, GREY);
  // cormorants flying fast and low over the water by the resort and the wrecks
  for (const p of places.slice(0, 5)) for (let i = 0; i < 3; i++) add(p[0] - 420 + (R() - .5) * 300, 2.5 + R() * 5, p[1] + (R() - .5) * 600, 120 + R() * 200, 13, 1.1, 0, 0.9, [.07, .07, .08], [.1, .1, .11]);
  // pelicans gliding low in a line along the bay shore
  for (const p of places.slice(0, 6)) { const ph = R() * 6.283, rad = 160 + R() * 160, alt = 4 + R() * 6; for (let i = 0; i < 4; i++) add(p[0] - 500, alt, p[1], rad, 9, 2.6, 0, 0.3, WHITE, BLACK, ph + i * 16 / rad); }
  // whistling kites, brahminy kites and sea eagles soaring over the dunes and the shore
  for (let i = 0; i < 22; i++) { const x = (R() - .5) * T.sx * 0.6, z = (R() - .5) * T.sz * 0.8; if (maskAt(x, z).land < 0.5 && R() < 0.6) continue; const k = i % 4; add(x, 60 + R() * 110, z, 90 + R() * 160, 9, k === 2 ? 2.2 : 1.5, 0, 0.08, [[.42, .33, .24], [.55, .25, .12], [.9, .9, .88], [.88, .86, .8]][k], [[.3, .24, .18], [.5, .22, .1], [.38, .4, .43], [.3, .25, .2]][k]); }      // whistling kite, brahminy kite, sea eagle, osprey
  add(0, 110, 0, 140, 9, 1.6, 1, 0.08, [.55, .25, .12], [.5, .22, .1]);
  const n = list.length / 8, g = new THREE.InstancedBufferGeometry(), a = new Float32Array(n * 4), b = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a.set(list.slice(i * 8, i * 8 + 4), i * 4); b.set(list.slice(i * 8 + 4, i * 8 + 8), i * 4); }
  attr(g, 'position', BIRD.pos, 3); attr(g, 'aWing', BIRD.wing, 1); attr(g, 'aTone', BIRD.tone, 1); g.setIndex(BIRD.idx);
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(b, 4));
  const cc = new Float32Array(cols), ca = new Float32Array(n * 3), cb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { ca.set(cc.subarray(i * 6, i * 6 + 3), i * 3); cb.set(cc.subarray(i * 6 + 3, i * 6 + 6), i * 3); }
  g.setAttribute('iCa', new THREE.InstancedBufferAttribute(ca, 3)); g.setAttribute('iCb', new THREE.InstancedBufferAttribute(cb, 3)); g.instanceCount = n; g.boundingSphere = FAR;
  const uni = { uFollow: { value: new THREE.Vector3() } };
  const mat = makeMat({
    uniforms: uni, side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute float aWing, aTone; attribute vec4 iA, iB; attribute vec3 iCa, iCb; uniform vec3 uFollow; varying vec3 vCol, vW;
      void main(){
        float follow = floor(iB.w), flap = fract(iB.w), size = iB.z * 1.5, way = sign(iB.y);
        vec3 home = iA.xyz + follow * vec3(uFollow.x, uFollow.y, uFollow.z);
        float ang = iB.x + uTime * iB.y / iA.w;
        vec3 c = home + vec3(cos(ang) * iA.w, sin(ang * 2.0 + iB.x) * iA.w * 0.06, sin(ang) * iA.w * 0.8);
        vec2 fwd = normalize(vec2(-sin(ang), cos(ang) * 0.8)) * way, right = vec2(-fwd.y, fwd.x);
        float night = 1.0 - smoothstep(0.55, 0.9, uNight);                     // birds roost after dark
        float ok = night * (1.0 - smoothstep(2600.0, 3600.0, length(c - cameraPosition)));
        // wings beat about the body line; gliders hold them out and only flex
        float beat = sin(uTime * (22.0 - 6.0 * iB.z) * (0.35 + flap) + iB.x * 9.0 - abs(aWing) * 0.9) * (0.12 + 0.75 * flap) + 0.18;
        vec3 lp = position;
        lp.y += abs(aWing) * beat; lp.z *= 1.0 - 0.3 * abs(aWing) * abs(beat);
        float bank = -way * 0.28;
        lp = vec3(lp.x, lp.y * cos(bank) - lp.z * sin(bank), lp.y * sin(bank) + lp.z * cos(bank)) * size;
        vec3 wp = c + vec3(fwd.x, 0.0, fwd.y) * lp.x + vec3(0.0, 1.0, 0.0) * lp.y + vec3(right.x, 0.0, right.y) * lp.z;
        vec3 col = mix(iCa, iCb, aTone);
        vCol = col * (uLightCol * (0.3 + 0.55 * max(uLightDir.y, 0.0)) * cloudShadow(wp) + uAmbSky * 1.2); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: LIT_FS,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);

  // shorebirds on the sand: pied oystercatchers in pairs and silver gulls, pacing along the tide line
  const sg = new GB(), ob = [.06, .06, .07], RED = [.85, .2, .08];
  sg.box(0, 0.16, 0, 0.3, 0.14, 0.14, WHITE); sg.box(-0.02, 0.2, 0, 0.3, 0.12, 0.15, [0, 0, 0]); sg.box(0.16, 0.28, 0, 0.1, 0.1, 0.1, [0, 0, 0]);     // black marks the part that takes the bird's own colour
  sg.box(0.26, 0.3, 0, 0.14, 0.025, 0.025, RED); sg.box(0.02, 0, 0.03, 0.015, 0.16, 0.015, RED); sg.box(0.02, 0, -0.03, 0.015, 0.16, 0.015, RED);
  const geo = sg.build(), ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.setAttribute('position', geo.attributes.position); ig.setAttribute('normal', geo.attributes.normal); ig.setAttribute('color', geo.attributes.color);
  const sp = [], sc = [];
  for (const r of F.beach || []) for (let i = 8; i < r.p.length - 8; i += MOBILE ? 9 : 5) {
    if (R() < 0.45) continue;
    const p = r.p[i], q = r.p[i + 1], gull = R() < 0.35, k = gull ? 2 + ((R() * 4) | 0) : 2, side = r.side || 1;
    for (let j = 0; j < k; j++) { sp.push(p[0] + side * (5 + R() * 5) + (R() - .5) * 4, p[1] + (R() - .5) * 8, Math.atan2(-(q[1] - p[1]), q[0] - p[0]) + (R() < .5 ? 0 : Math.PI), R()); sc.push(...(gull ? GREY : ob)); }
  }
  ig.setAttribute('iP', new THREE.InstancedBufferAttribute(new Float32Array(sp), 4)); ig.setAttribute('iC', new THREE.InstancedBufferAttribute(new Float32Array(sc), 3)); ig.instanceCount = sp.length / 4; ig.boundingSphere = FAR;
  const smat = makeMat({
    side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec3 color, iC; attribute vec4 iP; varying vec3 vCol, vW;
      void main(){
        float ca = cos(iP.z), sa = sin(iP.z), walk = sin(uTime * 0.23 + iP.w * 40.0), step2 = cos(uTime * 0.23 + iP.w * 40.0);
        vec2 dir = vec2(ca, -sa) * (step2 < 0.0 ? -1.0 : 1.0);                     // it turns round at each end of its beat
        vec2 xz = iP.xy + vec2(ca, -sa) * walk * (2.0 + 4.0 * iP.w);
        vec3 lp = position * 1.7; lp.y += abs(sin(uTime * 7.0 + iP.w * 9.0)) * 0.02 * step(0.25, position.x);     // the head bobs as it walks
        vec3 wp = vec3(xz.x + dir.x * lp.x - dir.y * lp.z, groundY(xz) + lp.y, xz.y + dir.y * lp.x + dir.x * lp.z);
        float ok = step(uSeaM * uVex - 0.05, groundY(xz)) * (1.0 - smoothstep(0.6, 0.9, uNight)) * (1.0 - smoothstep(500.0, 700.0, length(wp - cameraPosition)));
        vec3 col = dot(color, vec3(1.0)) < 0.01 ? iC : color;
        vCol = col * (uLightCol * (0.25 + 0.6 * max(uLightDir.y, 0.0)) * cloudShadow(wp) + uAmbSky); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: LIT_FS,
  });
  const sm = new THREE.Mesh(ig, smat); sm.name = 'shorebirds'; sm.frustumCulled = false; scene.add(sm);
  // pelicans and cormorants sitting on the water, paddling about: most of them by the resort jetty, where they wait for the fish feed
  const wet = (x, z) => U.uSeaM.value - heightAt(x, z) > 0.9;
  const afloat = (geo2, spots, per) => {
    const fg = new THREE.InstancedBufferGeometry(), ip = [];
    fg.index = geo2.index; fg.setAttribute('position', geo2.attributes.position); fg.setAttribute('normal', geo2.attributes.normal); fg.setAttribute('color', geo2.attributes.color);
    for (const [p, n] of spots) for (let i = 0, t = 0; i < n * per && t < 400; t++) { const x = p[0] - 40 - R() * 160, z = p[1] + (R() - .5) * 260; if (wet(x, z)) { ip.push(x, z, 3 + R() * 9, R()); i++; } }
    fg.setAttribute('iP', new THREE.InstancedBufferAttribute(new Float32Array(ip), 4)); fg.instanceCount = ip.length / 4; fg.boundingSphere = FAR;
    const fm = new THREE.Mesh(fg, fmat); fm.name = 'afloat'; fm.frustumCulled = false; scene.add(fm);
  };
  const fmat = makeMat({
    side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec3 color; attribute vec4 iP; varying vec3 vCol, vW;
      void main(){
        float way = iP.w < 0.5 ? 1.0 : -1.0, ang = iP.w * 40.0 + uTime * 0.22 / iP.z * way;
        vec2 c = iP.xy + vec2(cos(ang), sin(ang)) * iP.z, fwd = vec2(-sin(ang), cos(ang)) * way;
        vec3 lp = position * 1.9 - vec3(0.0, 0.17, 0.0);                 // it sits in the water, not on it
        vec3 wp = vec3(c.x + fwd.x * lp.x - fwd.y * lp.z, uSeaM * uVex + lp.y + sin(uTime * 1.3 + iP.w * 30.0) * 0.06, c.y + fwd.y * lp.x + fwd.x * lp.z);
        vec3 nw = normalize(vec3(fwd.x * normal.x - fwd.y * normal.z, normal.y, fwd.y * normal.x + fwd.x * normal.z));
        float ok = step(groundY(c), uSeaM * uVex - 0.5) * (1.0 - smoothstep(900.0, 1200.0, length(wp - cameraPosition)));
        vCol = color * (uLightCol * (0.12 + 0.75 * max(dot(nw, uLightDir), 0.0)) * cloudShadow(wp) + uAmbSky * (0.6 + 0.4 * nw.y)); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: LIT_FS,
  });
  const tgl = F.places.find(p => /^Tangalooma/.test(p.n || ''))?.p, wv = F.views.find(v => /Tangalooma Wrecks/.test(v.n || '')), wrk = wv && (wv.c || wv.p), others = F.places.filter(p => !/^Tangalooma/.test(p.n || '')).map(p => [p.p, 1]);
  const spots = [...(tgl ? [[[tgl[0] - 230, tgl[1] + 340], 3]] : []), ...(wrk ? [[[wrk[0] + 60, wrk[1]], 2]] : []), ...others];
  afloat(PELICAN(), spots, 3);
  afloat(CORMORANT(), spots, 2);

  const f = new THREE.Vector3(); let first = true;
  return (dt, target) => {
    // the nearby flock drifts after the viewer instead of jumping
    if (first || f.distanceTo(target) > 1500) { f.copy(target); first = false; } else f.lerp(target, Math.min(1, dt * 0.5));
    uni.uFollow.value.set(f.x, Math.max(meshY(f.x, f.z), U.uSeaM.value * VEX), f.z);
  };
}

// ---------------------------------------------------------------- butterflies
function buildInsects(scene) {
  return scatter(scene, LOW ? 26 : 38, 4.6, (g) => {
    attr(g, 'position', [0, 0, 0, 0.9, 0, 1, -0.7, 0, 0.8, 0, 0, 0, -0.7, 0, -0.8, 0.9, 0, -1], 3); attr(g, 'aK', [0, 1, 1, 0, -1, -1], 1); g.setIndex([0, 1, 2, 3, 4, 5]);
  }, /* glsl */`
        // blue tigers, common crows, common browns and tiny grass-blues over the heath and forest edge, by day, out of the rain
        float veg = step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * step(1.5, hgt) * step(h3, 0.36) * (1.0 - smoothstep(0.15, 0.5, uNight)) * (1.0 - smoothstep(0.05, 0.4, uRain));
        float t = uTime * (0.6 + 0.5 * h1), fl = abs(sin(uTime * (9.0 + 6.0 * h2) + h1 * 20.0));
        float small = step(0.78, h2);                                            // grass-blues are small and keep low
        s = mix(0.055 + 0.03 * h2, 0.03, small) * veg;
        vec3 drift = vec3(sin(t * 0.7 + h1 * 6.0) * 2.4, mix(1.0 + 2.2 * h2, 0.35, small) + sin(t * 1.9 + h3 * 60.0) * mix(0.5, 0.15, small), cos(t * 0.53 + h4 * 6.0) * 2.4) / max(s, 0.001);
        lp = vec3(position.x, abs(aK) * (0.25 + 1.1 * fl), position.z * (1.0 - 0.6 * fl)) + drift;
        nrm = vec3(0.0, 1.0, 0.0);
        float tip = step(0.5, abs(aK));
        c = (h2 < 0.3 ? mix(vec3(0.05, 0.05, 0.06), vec3(0.45, 0.72, 0.95), tip * 0.9)                // blue tiger: black, streaked pale blue
           : h2 < 0.55 ? mix(vec3(0.10, 0.07, 0.05), vec3(0.85, 0.85, 0.8), tip * 0.35)               // common crow: dark brown with white spots at the edge
           : h2 < 0.78 ? mix(vec3(0.75, 0.42, 0.10), vec3(0.35, 0.22, 0.10), tip * 0.5)               // common brown: orange and brown
           : vec3(0.62, 0.66, 0.92)) * 1.3;`, 90);
}

// dragonflies over the low, wet country (wallum darner, Australian tiger, blue-spotted hawker): they hang in the air, then dart
function buildDragonflies(scene) {
  return scatter(scene, LOW ? 20 : 28, 7, (g) => {
    const pos = [-0.7, 0, 0.03, 0.4, 0, 0.03, 0.4, 0, -0.03, -0.7, 0, -0.03], k = [0, 0, 0, 0], idx = [0, 1, 2, 0, 2, 3];
    for (const x of [0.2, -0.02]) { const q = pos.length / 3; pos.push(x, 0.02, -1, x + 0.16, 0.02, -1, x + 0.1, 0.02, 0, x, 0.02, 0, x, 0.02, 1, x + 0.16, 0.02, 1); k.push(-1, -1, 0.01, 0.01, 1, 1); idx.push(q, q + 1, q + 2, q, q + 2, q + 3, q + 3, q + 2, q + 5, q + 3, q + 5, q + 4); }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float wetland = step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * step(0.8, hgt) * (1.0 - smoothstep(9.0, 16.0, hgt)) * step(h3, 0.14) * (1.0 - smoothstep(0.15, 0.5, uNight)) * (1.0 - smoothstep(0.05, 0.4, uRain));
        float tt = uTime * (0.3 + 0.25 * h1) + h2 * 10.0, leg = floor(tt), go = smoothstep(0.72, 1.0, fract(tt));
        vec3 pa = vec3(hash12(cell + leg * 1.31) - 0.5, hash12(cell * 1.7 + leg * 0.77), hash12(cell * 0.6 + leg * 2.3) - 0.5);
        vec3 pb = vec3(hash12(cell + (leg + 1.0) * 1.31) - 0.5, hash12(cell * 1.7 + (leg + 1.0) * 0.77), hash12(cell * 0.6 + (leg + 1.0) * 2.3) - 0.5);
        vec3 at = mix(pa, pb, go) * vec3(7.0, 1.8, 7.0) + vec3(0.0, 0.7 + sin(uTime * 3.0 + h1 * 9.0) * 0.04, 0.0);
        s = (0.07 + 0.03 * h2) * wetland;
        lp = vec3(position.x, position.y + abs(aK) * sin(uTime * 55.0 + h1 * 30.0) * 0.12, position.z) + at / max(s, 0.001);
        nrm = vec3(0.0, 1.0, 0.0);
        c = abs(aK) > 0.005 ? vec3(0.78, 0.84, 0.88) : (h4 < 0.35 ? vec3(0.50, 0.36, 0.10) : h4 < 0.7 ? vec3(0.80, 0.68, 0.10) : vec3(0.12, 0.35, 0.75));`, 90);
}

// clouds of small flies and midges hanging in the still air between the bushes
function buildGnats(scene) {
  return scatter(scene, LOW ? 56 : 84, 0.8, (g) => {
    attr(g, 'position', [-1, 0, 0, 1, 0, 0, 0, 1.6, 0], 3); attr(g, 'aK', [0, 0, 0], 1); g.setIndex([0, 1, 2]);
  }, /* glsl */`
        float swarm = smoothstep(0.6, 0.72, texture2D(uNoise, xz / 17.0).g) * step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * step(1.5, hgt) * (1.0 - smoothstep(0.2, 0.6, uNight)) * (1.0 - smoothstep(0.05, 0.3, uRain));
        float t = uTime * (2.0 + 2.0 * h1);
        s = 0.012 * swarm * step(h3, 0.6);
        lp = position + vec3(sin(t * 1.3 + h1 * 40.0) + sin(t * 3.1 + h2 * 20.0) * 0.5, 1.3 + 1.2 * h2 + sin(t * 2.2 + h3 * 50.0) * 0.5, cos(t * 1.7 + h4 * 30.0) + cos(t * 2.7 + h1 * 9.0) * 0.5) * 0.45 / max(s, 0.0005);
        nrm = vec3(0.0, 1.0, 0.0); c = vec3(0.03, 0.03, 0.03);`, 40);
}
// Rounded animal bodies: each part is a tube through a few stations [x, y, z, radius], closed at both ends.
// kk marks the part for the shader (which colours and moves it).
function tubes(parts, S = 5) {
  const pos = [], k = [], idx = [], V = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], N = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, X = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (const { st, kk } of parts) {
    const base = pos.length / 3, n = st.length;
    st.forEach((c, i) => {
      const t = N(V(st[Math.min(n - 1, i + 1)], st[Math.max(0, i - 1)])), side = N(X(t, Math.abs(t[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0])), up = X(side, t);
      for (let j = 0; j < S; j++) { const a = j / S * Math.PI * 2, ca = Math.cos(a) * c[3], sa = Math.sin(a) * c[3]; pos.push(c[0] + side[0] * ca + up[0] * sa, c[1] + side[1] * ca + up[1] * sa, c[2] + side[2] * ca + up[2] * sa); k.push(kk); }
    });
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < S; j++) { const q = base + i * S, j2 = (j + 1) % S; idx.push(q + j, q + S + j, q + j2, q + j2, q + S + j, q + S + j2); }
    const e0 = pos.length / 3; pos.push(st[0][0], st[0][1], st[0][2], st[n - 1][0], st[n - 1][1], st[n - 1][2]); k.push(kk, kk);
    for (let j = 0; j < S; j++) { const j2 = (j + 1) % S; idx.push(e0, base + j2, base + j, e0 + 1, base + (n - 1) * S + j, base + (n - 1) * S + j2); }
  }
  return (g) => { attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx); };
}
// wallabies in the scrub: mostly still, now and then a few hops along and back
function buildWallabies(scene) {
  const parts = [
    { kk: 0, st: [[-0.2, 0.3, 0, 0.15], [-0.05, 0.36, 0, 0.18], [0.16, 0.44, 0, 0.14], [0.3, 0.55, 0, 0.085], [0.38, 0.63, 0, 0.07]] },     // rump, back, chest, neck
    { kk: 4, st: [[0.36, 0.64, 0, 0.065], [0.45, 0.65, 0, 0.06], [0.56, 0.61, 0, 0.03]] },                                             // head and muzzle
    { kk: 3, st: [[-0.28, 0.27, 0, 0.075], [-0.6, 0.13, 0, 0.05], [-0.98, 0.04, 0, 0.022]] },                                           // tail
  ];
  for (const z of [-0.11, 0.11]) {
    parts.push({ kk: 2, st: [[-0.14, 0.3, z, 0.075], [0.02, 0.14, z * 1.2, 0.05], [-0.06, 0.04, z * 1.2, 0.035], [0.2, 0.025, z * 1.2, 0.03]] });      // hind leg and long foot
    parts.push({ kk: 1, st: [[0.2, 0.42, z * 0.7, 0.035], [0.3, 0.26, z * 0.8, 0.022]] });                                                   // forearm
    parts.push({ kk: 4, st: [[0.4, 0.69, z * 0.4, 0.022], [0.37, 0.8, z * 0.6, 0.014]] });                                                   // ear
  }
  return scatter(scene, LOW ? 16 : 22, 24, tubes(parts), /* glsl */`
        float scrub = step(0.92, mk.r) * (1.0 - smoothstep(0.25, 0.5, mk.g)) * step(2.5, hgt) * (1.0 - smoothstep(0.02, 0.1, max(ov.r, ov.g))) * step(h3, 0.07);
        float f = fract(uTime * 0.012 * (0.7 + 0.6 * h2) + h1 * 5.0), tri = abs(2.0 * f - 1.0), fwd = f < 0.5 ? -1.0 : 1.0;
        float go = smoothstep(0.3, 0.7, tri), moving = smoothstep(0.3, 0.34, tri) * (1.0 - smoothstep(0.66, 0.7, tri));           // long rests at each end, a short run of hops between
        float hop = abs(sin(go * 12.0)) * moving;
        s = (1.1 + 0.35 * h2) * scrub;
        lp = vec3(position.x * fwd, position.y, position.z);
        if(aK > 1.5 && aK < 2.5) lp.x += hop * 0.1 * fwd * (0.3 - position.y);                                                   // the hind legs kick back in the hop
        if(aK > 2.5 && aK < 3.5) lp.y += hop * 0.12 * (-position.x - 0.25);                                                      // the tail lifts as a balance
        lp += vec3((go - 0.5) * 9.0, hop * 0.3, 0.0) / max(s, 0.001);
        nrm = normalize(vec3(0.0, 0.5, position.z * 6.0));
        c = aK < 0.5 ? vec3(0.115, 0.09, 0.07) : aK < 1.5 ? vec3(0.055, 0.045, 0.04) : aK < 2.5 ? vec3(0.12, 0.095, 0.07) : aK < 3.5 ? vec3(0.075, 0.06, 0.05) : vec3(0.10, 0.075, 0.065);
        c *= 0.75 + 0.5 * smoothstep(0.1, 0.5, position.y) * (0.8 + 0.4 * h4);`, 420);
}
// lizards: goannas walking the sand between the bushes, and smaller skinks and blue-tongues that sit, then dart
function buildLizards(scene) {
  const parts = [{ kk: 0, st: [[0.5, 0.05, 0, 0.022], [0.4, 0.065, 0, 0.045], [0.3, 0.06, 0.01, 0.04], [0.17, 0.075, 0.02, 0.065], [0.0, 0.07, 0, 0.075], [-0.16, 0.065, -0.02, 0.06], [-0.45, 0.04, 0.02, 0.032], [-0.75, 0.025, -0.03, 0.018], [-1.0, 0.015, 0, 0.006]] }];
  for (const [x, sg] of [[0.17, 1], [0.17, -1], [-0.14, 1], [-0.14, -1]]) parts.push({ kk: 2, st: [[x, 0.06, 0.05 * sg, 0.024], [x + 0.03, 0.05, 0.15 * sg, 0.02], [x + 0.07, 0.008, 0.19 * sg, 0.016]] });
  const body = (big) => /* glsl */`
        float ok = step(0.92, mk.r) * step(1.5, hgt) * (1.0 - smoothstep(0.02, 0.1, ov.r)) * step(h3, ${big ? '0.05' : '0.04'});
        float f = fract(uTime * ${big ? '0.02' : '0.05'} * (0.7 + 0.6 * h2) + h1 * 5.0), tri = abs(2.0 * f - 1.0), fwd = f < 0.5 ? -1.0 : 1.0;
        float go = smoothstep(${big ? '0.15, 0.85' : '0.42, 0.58'}, tri), moving = smoothstep(${big ? '0.15, 0.2' : '0.42, 0.44'}, tri) * (1.0 - smoothstep(${big ? '0.8, 0.85' : '0.56, 0.58'}, tri));
        s = ${big ? '(0.8 + 0.45 * h2)' : '(0.22 + 0.2 * h2)'} * ok;
        float wag = sin(position.x * 7.0 - uTime * ${big ? '5.0' : '14.0'}) * moving;                                          // the body snakes from side to side as it walks
        lp = vec3(position.x * fwd, position.y, position.z + wag * 0.045 * (0.3 + abs(position.x)));
        if(aK > 1.5) lp.x += sin(uTime * ${big ? '5.0' : '14.0'} + position.x * 20.0 + position.z * 30.0) * 0.04 * moving;
        lp += vec3((go - 0.5) * ${big ? '14.0' : '3.0'}, 0.0, 0.0) / max(s, 0.001);
        nrm = normalize(vec3(0.0, 0.6, position.z * 8.0));
        float band = step(0.5, fract(position.x * ${big ? '9.0' : '5.0'} + h4));
        c = ${big ? 'mix(vec3(0.06, 0.065, 0.06), vec3(0.30, 0.27, 0.13), band * 0.55)' : 'mix(mix(vec3(0.36, 0.28, 0.18), vec3(0.20, 0.16, 0.12), band), vec3(0.42, 0.44, 0.40), step(0.6, h4) * 0.6)'} * (0.8 + 0.4 * smoothstep(0.02, 0.1, position.y));`;
  return [scatter(scene, LOW ? 14 : 20, 28, tubes(parts), body(true), 300), scatter(scene, LOW ? 30 : 44, 3.6, tubes(parts, 4), body(false), 70)];
}

export function buildLife(scene, F) {
  const lights = makeLights(64); scene.add(lights.pts); lights.pts.material.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2);
  const near = [...buildBeachLife(scene), buildInsects(scene), buildDragonflies(scene), buildGnats(scene), buildWallabies(scene), ...buildLizards(scene)];
  const cars = buildCars(scene, F, lights), snork = buildSnorkelers(scene, F), birds = buildBirds(scene, F);
  buildSeaLife(scene, F);
  return {
    update(dt, t, target, camDist) {
      for (const s of near) { s.m.visible = camDist < s.range; if (s.m.visible) s.set(target.x, target.z); }
      cars(dt); snork(dt, t); birds(dt, target);
    },
  };
}

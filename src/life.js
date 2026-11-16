// Life on and around the island: shells, sea stars and driftwood on the beaches, 4WDs on the beach
// highway, snorkelers at the wrecks, fish, turtles and stingrays under the water, seabirds, raptors,
// shorebirds and butterflies. Small things are grown by the GPU in a grid that follows the viewer;
// animals that swim or fly are instanced and animated in their vertex shaders.
import * as THREE from 'three';
import { U, VEX, MOBILE, LOW, makeMat, objectMat, blobShadowMat, FEATHER_GLSL, LOGV, LOGF, rng, clamp } from './common.js';
// birds drawn many at a time: lit at each corner, feathered at each pixel
const BIRD_FS = /* glsl */`varying vec3 vCol, vW, vLight, vFx; ${FEATHER_GLSL} void main(){ ${LOGF} vec3 c = featherPaint(vCol, vFx); gl_FragColor = vec4(applyFog(c * vLight, vW), 1.0); }`;
import { T, meshY, groundH, heightAt, maskAt } from './terrain.js';
import { waveAt } from './water.js';
import { GB, makeLights } from './geo.js';
import { wallaby, WALLABY_PAINT, goanna, bluetongue, LIZARD_PAINT } from './bodies.js';
const loftGeo = (m) => (g) => { attr(g, 'position', m.pos, 3); attr(g, 'normal', m.nrm, 3); attr(g, 'aK', m.part, 1); g.setIndex(m.idx); };
import { swimmers, PAINT, PELICAN, PELICAN_STAND, CORMORANT, PELICAN_FLY, PELICAN_WING, EAGLE_FLY, EAGLE_WING, EAGLE_PERCH, BREAM, DAMSEL, ROUND, SLIM, FLATHEAD, SHARK, RAY, SHOVEL, TURTLE, DOLPHIN, DUGONG, WHALE } from './creatures.js';

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
function scatter(scene, n, cs, build, body, range, paint) {
  const cells = new Float32Array(n * n * 2); let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { cells[k++] = i - n / 2; cells[k++] = j - n / 2; }
  const g = new THREE.InstancedBufferGeometry(); build(g);
  g.setAttribute('iCell', new THREE.InstancedBufferAttribute(cells, 2)); g.instanceCount = n * n; g.boundingSphere = FAR;
  const uni = { uCentre: { value: new THREE.Vector2() }, uCS: { value: cs }, uRange: { value: n / 2 * cs } };
  const mat = makeMat({
    uniforms: uni, side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec2 iCell; attribute float aK; uniform vec2 uCentre; uniform float uCS, uRange, uRain; varying vec3 vCol, vW;
      ${paint ? 'varying vec3 vObj, vNo, vLight; varying float vK; varying vec4 vH;' : ''}
      void main(){
        vec2 cell = uCentre + iCell;
        float h1 = hash12(cell), h2 = hash12(cell + 17.3), h3 = hash12(cell * 1.7 + 5.1), h4 = hash12(cell * 0.37 + 91.0);
        vec2 jt = fract(vec2(h1, h2) + texture2D(uNoise, cell * 0.37 + 0.11).rg + texture2D(uNoise, cell / 41.0).gb * 2.0);      // scattered, never in rows
        vec2 xz = (cell + jt) * uCS, uv = worldUV(xz);
        vec3 mk = texture2D(uMask, uv).rgb, ov = texture2D(uOver, uv).rgb; float hgt = texture2D(uHeight, uv).r;
        float sandy = step(0.9, mk.r) * smoothstep(0.3, 0.65, mk.g) * step(0.003, uv.x) * step(uv.x, 0.997) * step(0.003, uv.y) * step(uv.y, 0.997);
        float fade = 1.0 - smoothstep(uRange * 0.7, uRange * 0.95, length(xz - (uCentre + 0.5) * uCS));
        float ca = cos(h4 * 6.2832), sa = sin(h4 * 6.2832);
        vec3 lp, nrm, c; float s = 0.0;
        ${body}
        s *= 1.0 - sandBlow(xz);                      // nothing grows or lies on the open faces of the great sand blows
        vec3 wp = vec3(xz.x + (lp.x * ca - lp.z * sa) * s, 0.0, xz.y + (lp.x * sa + lp.z * ca) * s);
        wp.y = groundY(wp.xz) + lp.y * s;
        nrm = normalize(vec3(nrm.x * ca - nrm.z * sa, nrm.y, nrm.x * sa + nrm.z * ca));
        vec3 light = uLightCol * (max(dot(nrm, uLightDir), 0.0) * 0.8 + 0.1) * cloudShadow(wp) + mix(uAmbGnd, uAmbSky, nrm.y * 0.5 + 0.5) + carLamps(wp) * 1.2;
        vCol = c * light;
        ${paint ? 'vCol = c; vLight = light; vObj = position; vNo = normal; vK = aK; vH = vec4(h1, h2, h3, h4);' : ''}
        vW = wp;
        gl_Position = s * fade <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    // (things with a painted skin work their colour out per pixel, from where on the body the pixel is)
    fs: paint ? /* glsl */`varying vec3 vCol, vW, vObj, vNo, vLight; varying float vK; varying vec4 vH; void main(){ ${LOGF} vec3 c = vCol; ${paint} gl_FragColor = vec4(applyFog(c * vLight, vW), 1.0); }` : LIT_FS,
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
        float taper = (1.0 - 0.6 * (position.x + 0.5)) * (1.0 + 0.55 * logK * smoothstep(0.3, 0.5, -position.x)) * (0.9 + 0.2 * sin(position.x * 9.0 + h1 * 20.0) * logK), crook = (sin((position.x + 0.5) * 3.1416) * (h2 - 0.5) * 0.22 + sin((position.x + 0.5) * 7.0 + h4 * 6.0) * 0.035 * logK);     // a log swells to its butt, wanders, and thins to a broken end
        s = (logK + stick) * sandy * line;
        lp = vec3(position.x * len, (position.y * taper + 0.75) * rad, position.z * rad * taper + crook * len);
        nrm = vec3(0.0, position.y, position.z);
        float grain = texture2D(uNoise, vec2(position.x * len * 0.35 + h1, aK * 0.07 + h2 + atan(position.z, position.y) * 0.4)).r;
        float crack = texture2D(uNoise, vec2(position.x * len * 0.12 + h2, atan(position.z, position.y) * 1.7 + h1 * 3.0)).g;
        c = mix(vec3(0.58, 0.54, 0.48), vec3(0.34, 0.27, 0.20), smoothstep(0.35, 0.8, h4)) * (0.6 + 0.65 * grain) * (1.0 - 0.55 * logK * smoothstep(0.6, 0.72, crack));     // long dark checks along the grain
        c *= 0.6 + 0.4 * smoothstep(-0.6, 0.4, position.y);                                                       // dark where it lies on the sand`, 420);
  // ---- the forest floor ----
  const WOODED = 'step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * step(1.5, hgt)';
  // fallen branches and sticks
  const sticks = scatter(scene, LOW ? 44 : 64, 2.1, stickGeo, /* glsl */`
        float logK = step(h3, 0.012), stick = (1.0 - logK) * step(h3, 0.3);
        float len = logK > 0.5 ? 2.4 + 2.4 * h1 : 0.35 + 1.3 * h1, rad = logK > 0.5 ? 0.08 + 0.08 * h2 : 0.01 + 0.022 * h2;
        float taper = 1.0 - mix(0.5, 0.72, logK) * (position.x + 0.5), crook = sin((position.x + 0.5) * 3.1416) * (h2 - 0.5) * mix(0.3, 0.07, logK);      // a fallen trunk lies long and nearly straight; only thin sticks are bowed
        s = (logK * (1.0 - smoothstep(0.3, 0.5, mk.g)) * (1.0 - smoothstep(0.03, 0.1, ov.r)) + stick) * step(0.92, mk.r) * (1.0 - smoothstep(0.72, 0.93, mk.g)) * step(1.5, hgt);                 // under the trees, and out over the sandy edge where the dune is falling away
        lp = vec3(position.x * len, (position.y * taper + 0.8) * rad, position.z * rad * taper + crook * len);
        nrm = vec3(0.0, position.y, position.z);
        float grain = texture2D(uNoise, vec2(position.x * len * 0.35 + h1, aK * 0.07 + h2)).r;
        c = mix(mix(vec3(0.26, 0.21, 0.16), vec3(0.14, 0.10, 0.07), smoothstep(0.3, 0.7, h4)), vec3(0.04, 0.035, 0.03), step(0.82, h1) * 0.85) * (0.65 + 0.6 * grain);
        c = mix(c, vec3(0.50, 0.48, 0.44) * (0.6 + 0.6 * grain), smoothstep(0.35, 0.65, mk.g));                      // out in the sun they bleach silver`, 300);
  // leaves and curls of bark: one small flat piece, long and narrow
  const litter = scatter(scene, LOW ? 84 : 128, 0.5, (g) => {
    attr(g, 'position', [-0.5, 0, 0, 0, 0, 0.5, 0.5, 0, 0, 0, 0, -0.5], 3); attr(g, 'aK', [0, 1, 0, 1], 1); g.setIndex([0, 1, 2, 0, 2, 3]);
  }, /* glsl */`
        float bark = step(h3, 0.05), leaf = (1.0 - bark) * step(h3, 0.75);
        s = (bark + leaf) * ${WOODED} * smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(xz - uCape.xy));
        { // round the houses too: fallen leaves lie in drifts in the yards, thick in places and swept thin in others
          float yardK = smoothstep(0.05, 0.11, ov.r) * (1.0 - smoothstep(0.3, 0.7, ov.g)) * step(0.92, mk.r) * step(2.0, hgt) * (1.0 - smoothstep(0.6, 0.8, mk.g)) * smoothstep(40.0, 80.0, (mk.b - 0.5) * 3000.0);      // (not on the open beach in front of a beachfront building)
          float drift = smoothstep(0.36, 0.6, texture2D(uNoise, xz / 9.0).r * 0.7 + texture2D(uNoise, xz / 2.3 + 0.4).g * 0.3);
          s = max(s, yardK * step(h3, 0.12 + 0.72 * drift)); }
        float len = bark > 0.5 ? 0.16 + 0.26 * h1 : 0.07 + 0.07 * h1, wid = bark > 0.5 ? 0.025 + 0.02 * h2 : 0.02;
        lp = vec3(position.x * len, 0.012 + abs(position.x) * len * (0.06 + 0.3 * h2 * bark) + aK * 0.006, position.z * wid * 2.0);       // lying nearly flat, bark curled up at the ends
        nrm = vec3(0.0, 1.0, 0.0);
        c = bark > 0.5 ? mix(vec3(0.22, 0.18, 0.14), vec3(0.13, 0.10, 0.08), h2)
          : (h2 < 0.35 ? vec3(0.16, 0.09, 0.045) : h2 < 0.65 ? vec3(0.24, 0.16, 0.08) : h2 < 0.85 ? vec3(0.10, 0.085, 0.07) : vec3(0.30, 0.15, 0.06));
        c *= 0.7 + 0.35 * h1;`, 120);
  // tufts of grass and sedge coming up through the litter
  const tuftGeo = (g) => {
    const pos = [], k = [], idx = [];
    for (let b = 0; b < 9; b++) {            // each blade rises, then bends over under its own weight
      const a = b * 0.71 + 0.3, ca = Math.cos(a), sa = Math.sin(a), lean = 0.2 + 0.55 * ((b * 37) % 10) / 10, tall = 0.75 + 0.35 * ((b * 13) % 7) / 6, q = pos.length / 3;
      for (const [out, up, w, u] of [[0.03, 0, 0.012, 0], [0.03 + lean * 0.3, 0.55 * tall, 0.009, 0.55], [0.03 + lean * 0.75, 0.9 * tall, 0.005, 0.85]]) for (const sd of [-1, 1]) { pos.push(ca * out - sa * w * sd, up, sa * out + ca * w * sd); k.push(u); }
      pos.push(ca * (0.03 + lean * 1.15), 0.86 * tall, sa * (0.03 + lean * 1.15)); k.push(1);
      idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3, q + 2, q + 3, q + 4, q + 4, q + 3, q + 5, q + 4, q + 5, q + 6);
    }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  };
  const tufts = scatter(scene, LOW ? 60 : 92, 1.15, tuftGeo, /* glsl */`
        float headland = 1.0 - smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(xz - uCape.xy));        // long grass all over the cape
        s = (0.3 + 0.5 * h1) * (1.0 + 0.8 * headland) * step(h3, mix(0.035, 0.95, headland)) * step(0.92, mk.r) * (1.0 - smoothstep(0.45, 0.8, mk.g)) * step(1.2, hgt);
        float oakHere = 0.0;
        { // Long grass grows thick round the foot of every tall she-oak and up through its lower limbs (the owner's photo). The trees stand where a hash of
          // their 11 m grid cell puts them (see buildTrees in features.js), so each tuft can ask whether one of them is within a few steps.
          float oakG = 0.0; vec2 tc = floor(xz / 11.0 - 0.5);
          for(int j = 0; j < 2; j++) for(int i = 0; i < 2; i++){
            vec2 c2 = tc + vec2(float(i), float(j)); float a1 = hash12(c2), a2 = hash12(c2 + 17.3), a3 = hash12(c2 * 1.7 + 5.1), a4 = hash12(c2 * 0.37 + 91.0), hsT = hash12(c2 * 2.3 + 40.0);
            vec2 t = (c2 + vec2(a1, a2)) * 11.0, tuv = worldUV(t); vec3 mkT = texture2D(uMask, tuv).rgb; float hT = texture2D(uHeight, tuv).r, shoreT = (mkT.b - 0.5) * 3000.0;
            float isOak = (shoreT < 170.0 && hT < 22.0) ? step(hsT, 0.45) : step(0.82, hsT), tall = step(0.5, smoothstep(45.0, 110.0, shoreT) + (hash12(c2 * 0.71 + 7.7) - 0.5) * 0.4);
            float densT = (1.0 - smoothstep(0.1, 0.5, mkT.g + (a4 - 0.5) * 0.45)) * step(0.92, mkT.r) * step(1.5, hT) * smoothstep(0.46, 0.26, dot(texture2D(uAlbedo, tuv).rgb, vec3(0.3, 0.55, 0.15))) * mix(0.4, 1.3, smoothstep(0.38, 0.62, texture2D(uNoise, t / 60.0 + 0.17).b));
            oakG = max(oakG, isOak * tall * step(a3, densT * 1.15) * (1.0 - smoothstep(2.0, 5.5, length(xz - t))));
          }
          float sOak = (0.85 + 0.75 * h1) * step(h3, 1.1 * oakG) * step(0.92, mk.r) * step(1.2, hgt) * (1.0 - smoothstep(0.03, 0.1, ov.g));
          oakHere = step(0.001, sOak) * step(s, sOak); s = max(s, sOak);
        }
        lp = position * vec3(1.0 + 0.35 * oakHere, 0.7 + 0.6 * h2, 1.0 + 0.35 * oakHere) + vec3(sin(uTime * 1.7 + h1 * 20.0), 0.0, cos(uTime * 1.3 + h2 * 20.0)) * 0.06 * aK * aK;      // (under a she-oak the tufts spread till they meet)
        nrm = vec3(0.0, 1.0, 0.0);
        c = mix(vec3(0.22, 0.27, 0.12), vec3(0.50, 0.48, 0.28), step(0.4, h2)) * (0.4 + 0.75 * aK) * (0.8 + 0.4 * h4);
        c = mix(c, vec3(0.17, 0.215, 0.095) * (0.4 + 0.75 * aK) * (0.8 + 0.4 * h4), oakHere * step(h2, 0.62));                 // the grass under a she-oak is mostly green`, 200);
  // The grass belt: between the open beach and the first trees there is nearly always a strip of dune grass (the owner's photo): green tussocks,
  // and among them older ones gone to straw, grey-brown and lying over; thick by the scrub, thinning out onto the sand.
  const fineGeo = (g) => {              // dune grass: many thin blades, each a gentle curve that tips over at the end
    const pos = [], k = [], idx = [];
    for (let b = 0; b < 20; b++) {        // a clump a hand-span or two across, so neighbouring clumps close up into a sward
      const a = b * 2.4 + 0.3, ca = Math.cos(a), sa = Math.sin(a), lean = 0.12 + 0.5 * ((b * 37) % 10) / 10, tall = 0.55 + 0.45 * ((b * 13) % 7) / 6, r0 = 0.02 + 0.2 * ((b * 7) % 9) / 8, q = pos.length / 3, N = 3;
      for (let i = 0; i <= N; i++) { const t = i / N, out = r0 + lean * t * t * 0.9, up = tall * (t - 0.28 * t * t * t), w = 0.007 * (1 - 0.8 * t); pos.push(ca * out - sa * w, up, sa * out + ca * w, ca * out + sa * w, up, sa * out - ca * w); k.push(t, t); }
      for (let i = 0; i < N; i++) { const o = q + i * 2; idx.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); }
    }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  };
  const belt = scatter(scene, LOW ? 80 : 130, 0.5, fineGeo, /* glsl */`
        float band = smoothstep(0.25, 0.4, mk.g) * (1.0 - smoothstep(0.68, 0.84, mk.g));                // the map's sand value is mid-way here: neither bush nor bare beach
        float dry = step(0.7, h2), thick = mix(1.0, 0.1, smoothstep(0.55, 0.8, mk.g));                     // near-solid by the scrub, a few scattered tufts out on the sand
        s = (0.55 + 0.5 * h1) * step(h3, thick * band * smoothstep(2.5, 3.4, hgt)) * step(0.92, mk.r) * (1.0 - smoothstep(170.0, 250.0, (mk.b - 0.5) * 3000.0)) * (1.0 - smoothstep(0.02, 0.1, ov.r));       // behind the beach only, starting at the foot of the dune: the lower beach is bare
        // and round the houses: low grass, ankle high, in patches with bare sand and leaf drifts between (the same patches the ground is tinted with)
        float yardK = smoothstep(0.05, 0.11, ov.r) * (1.0 - smoothstep(0.3, 0.7, ov.g)) * step(0.92, mk.r) * step(2.0, hgt) * (1.0 - smoothstep(0.6, 0.8, mk.g)) * smoothstep(40.0, 80.0, (mk.b - 0.5) * 3000.0);      // (not on the open beach in front of a beachfront building)
        float sYard = (0.55 + 0.4 * h1) * step(h3, 0.95 * yardK * smoothstep(0.30, 0.46, texture2D(uNoise, xz / 13.0 + 0.3).g)), low = step(s, 0.001) * step(0.001, sYard);
        s = max(s, sYard); dry = mix(dry, step(0.82, h2), low);
        lp = position * mix(mix(vec3(1.0, 0.8 + 0.5 * h4, 1.0), vec3(1.5, 0.5 + 0.2 * h4, 1.5), dry), vec3(1.15, 0.26 + 0.16 * h4, 1.15), low) + vec3(sin(uTime * 1.7 + h1 * 20.0), 0.0, cos(uTime * 1.3 + h2 * 20.0)) * 0.07 * aK * aK * (1.0 - 0.6 * dry) * (1.0 - 0.7 * low);
        nrm = vec3(0.0, 1.0, 0.0);
        vec3 green = mix(vec3(0.13, 0.25, 0.08), vec3(0.20, 0.30, 0.17), step(0.5, h4)), straw = mix(vec3(0.50, 0.46, 0.33), vec3(0.36, 0.33, 0.27), h1);
        c = mix(green, straw, dry) * (0.45 + 0.7 * aK);
        c = mix(c, straw, (1.0 - dry) * smoothstep(0.75, 1.0, aK) * 0.5);                               // green blades dry off toward their tips`, 130);
  // ferns: on the low wet flats they cover the ground knee to waist high, each a ring of arching fronds
  const ferns = scatter(scene, LOW ? 60 : 88, 1.0, (g) => {
    const pos = [], k = [], idx = [];
    for (let f = 0; f < 5; f++) {          // bracken: each frond a thin arching stem with pairs of leaflets down its length, long near the base and short at the drooping tip
      const a = f * 1.26 + (f % 2) * 0.35, ca = Math.cos(a), sa = Math.sin(a), len = 0.8 + 0.3 * ((f * 5) % 4) / 3, bend = ((f * 3) % 5 - 2) * 0.07;
      const P = (t) => { const out = (0.03 + t) * len, sw = bend * t * t * len; return [ca * out - sa * sw, (0.03 + 0.62 * Math.sin(t * 2.25)) * len, sa * out + ca * sw]; };
      const q = pos.length / 3, N = 3;
      for (let i = 0; i <= N; i++) { const t = i / N, c = P(t), w = 0.008 * len * (1 - 0.6 * t); pos.push(c[0] - sa * w, c[1], c[2] + ca * w, c[0] + sa * w, c[1], c[2] - ca * w); k.push(t * 0.5, t * 0.5); }
      for (let i = 0; i < N; i++) { const o = q + i * 2; idx.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); }
      for (let i = 0; i < 6; i++) {
        const t = 0.2 + i * 0.145, c0 = P(t - 0.05), c1 = P(t + 0.05), L = (0.05 + 0.36 * Math.pow(1 - t, 0.8)) * len;
        for (const sd of [-1, 1]) { const b = pos.length / 3; pos.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], (c0[0] + c1[0]) / 2 - sa * L * sd + ca * L * 0.3, c0[1] - L * 0.22, (c0[2] + c1[2]) / 2 + ca * L * sd + sa * L * 0.3); k.push(t, t, 1); idx.push(b, b + 1, b + 2); }
      }
    }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float wet = (1.0 - smoothstep(7.0, 11.0, hgt)) * smoothstep(120.0, 260.0, (mk.b - 0.5) * 3000.0) * step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * (1.0 - smoothstep(0.05, 0.13, max(ov.r, max(ov.g, ov.b))));
        // ...and bracken stands in patches along the back of the beaches too, just where the grass gives way to the scrub: fresh green fronds, and whole
        // patches of brown ones where a fire has been through or the old fronds have died off (as the owner describes)
        float edge = smoothstep(0.2, 0.33, mk.g) * (1.0 - smoothstep(0.5, 0.66, mk.g)) * smoothstep(2.4, 3.2, hgt) * step(0.92, mk.r) * (1.0 - smoothstep(0.02, 0.1, ov.r)) * smoothstep(0.38, 0.55, texture2D(uNoise, xz / 23.0).b);
        float atEdge = step(wet, 0.5) * step(0.01, edge), burntPatch = step(0.64, texture2D(uNoise, xz / 70.0 + 0.3).g), brown = atEdge * step(mix(0.85, 0.25, burntPatch), fract(h1 * 7.0));
        s = (0.5 + 0.55 * h1) * max(step(h3, 0.62) * wet, step(h3, 0.62 * edge)) * smoothstep(60.0, 85.0, (mk.b - 0.5) * 3000.0) * (1.0 - smoothstep(0.03, 0.1, ov.g));      // (never out on the open beach or in a wheel track)
        lp = position * vec3(0.85 + 0.3 * h4, (0.7 + 0.6 * fract(h2 * 9.0)) * (1.0 - 0.35 * brown), 0.85 + 0.3 * h1) + vec3(0.0, sin(uTime * 1.4 + h1 * 20.0 + position.x * 3.0) * 0.035 * aK, 0.0);       // no two ferns the same; the dead ones sag
        nrm = vec3(0.0, 1.0, 0.0);
        c = mix(mix(vec3(0.065, 0.09, 0.03), vec3(0.12, 0.135, 0.05), h2), vec3(0.16, 0.115, 0.06), step(0.68, fract(h1 * 7.0))) * (0.35 + 0.8 * aK) * (0.75 + 0.5 * texture2D(uNoise, xz / 110.0).r);
        if(atEdge > 0.5) c = mix(mix(vec3(0.09, 0.19, 0.045), vec3(0.16, 0.27, 0.08), h2), mix(vec3(0.30, 0.17, 0.07), vec3(0.19, 0.11, 0.055), h4), brown) * (0.4 + 0.75 * aK);`, 260);        // bracken: olive, a quarter of the fronds dead and brown, dark at the base
  // soldier crabs: when the tide is well out they come up on the bared flats in armies, small round sky-blue crabs that
  // walk a little way together and then screw themselves back down into the wet sand
  const crabs = scatter(scene, LOW ? 100 : 140, 0.24, (g) => {
    const pos = [0, 1, 0], k = [0], idx = [], S = 8;                       // a rounded shell (two rings and a crown), then four bent legs a side
    for (const [r, y] of [[0.62, 0.86], [1.0, 0.48], [0.8, 0.16]]) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r * 0.9); k.push(0); }
    for (let i = 0; i < S; i++) { const j = (i + 1) % S; idx.push(0, 1 + j, 1 + i); for (const o of [1, 1 + S]) idx.push(o + i, o + j, o + S + i, o + j, o + S + j, o + S + i); }
    for (const sd of [-1, 1]) for (let l = 0; l < 4; l++) { const q = pos.length / 3, x = 0.55 - l * 0.36, z = 0.8 * sd; pos.push(x - 0.09, 0.4, z, x + 0.09, 0.4, z, x + 0.05 * (1.5 - l), 0.62, z + 0.55 * sd, x + 0.1 * (1.5 - l), 0, z + 0.95 * sd); k.push(1, 1, 1, 1); idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3); }
    for (const sd of [-1, 1]) { const q = pos.length / 3; pos.push(0.7, 0.42, 0.25 * sd, 0.72, 0.2, 0.3 * sd, 1.25, 0.3, 0.2 * sd, 1.2, 0.05, 0.12 * sd, 1.05, 0.5, 0.42 * sd); k.push(2, 2, 2, 2, 2); idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2, q, q + 2, q + 4); }      // two claws, held down in front
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float lowT = smoothstep(-0.2, -0.55, uSeaM);
        float bare = step(uSeaM + 0.05, hgt) * (1.0 - smoothstep(0.15, 0.6, hgt));                 // on the flat the tide has left
        float army = smoothstep(0.5, 0.64, texture2D(uNoise, xz / 31.0).r) * step(h3, 0.7);        // thousands here, none there
        float go = fract(uTime * 0.035 * (0.7 + 0.6 * h2) + h1 * 5.0);
        vec2 way = normalize(vec2(texture2D(uNoise, xz / 90.0).g - 0.5, texture2D(uNoise, xz / 90.0 + 0.3).b - 0.5) + 0.001), walk = way * (go - 0.5) * 1.1;
        s = (0.024 + 0.014 * h1) * lowT * bare * army * smoothstep(0.0, 0.25, sin(go * 3.1416));
        lp = position * vec3(1.0, 0.85, 1.0) + vec3(walk.x * ca + walk.y * sa, 0.0, -walk.x * sa + walk.y * ca) / max(s, 0.0005);
        nrm = normalize(vec3(position.x, 0.7, position.z));
        c = aK > 0.5 ? vec3(0.85, 0.78, 0.65) * (0.55 + 0.6 * position.y) : mix(vec3(0.35, 0.25, 0.45), mix(vec3(0.20, 0.42, 0.80), vec3(0.50, 0.72, 0.95), smoothstep(0.4, 0.95, position.y)), smoothstep(0.15, 0.45, position.y));`, 60);
  return [shells, wood, sticks, litter, tufts, belt, ferns, crabs];
}

// ---------------------------------------------------------------- 4WDs on the beach
const GLASS = [.06, .09, .13], TYRE = [.07, .07, .075], DARK = [.13, .13, .14];
// A 4WD wagon, lofted through rounded cross-sections so it has no flat slabs: a body shell (bonnet, raked windscreen, cabin), four
// wheels with rounded tyres, a bull bar and roof rack of tube, lamps, a swag on the roof and the spare on the back. Every vertex
// carries its part number (0 body, 2 wheel, 3 trim, 4 lamp, 5 canvas) and its place on the car in metres; the material paints glass,
// door seams, grille, plates, rims and beach dust from that.
export function fourWD(col) {
  const pos = [], colr = [], fx = [], idx = [], PI = Math.PI;
  const V = (p, part, c) => { pos.push(p[0], p[1], p[2]); colr.push(c[0], c[1], c[2]); fx.push(part + 0.5 + p[2] * 0.2, p[0], p[1]); return pos.length / 3 - 1; };
  // a curved sheet of nu by nv quads; its triangles are wound so they face away from the given centre
  const grid = (nu, nv, f, part, c, centre) => {
    const id = [], i0 = idx.length; for (let i = 0; i <= nu; i++) { id.push([]); for (let j = 0; j <= nv; j++) id[i].push(V(f(i / nu, j / nv), part, c)); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) idx.push(id[i][j], id[i + 1][j], id[i][j + 1], id[i][j + 1], id[i + 1][j], id[i + 1][j + 1]);
    let out = 0; for (let k = i0; k < idx.length; k += 3) { const A = idx[k] * 3, B = idx[k + 1] * 3, C = idx[k + 2] * 3, ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2], vx = pos[C] - pos[A], vy = pos[C + 1] - pos[A + 1], vz = pos[C + 2] - pos[A + 2];
      out += (uy * vz - uz * vy) * (pos[A] - centre[0]) + (uz * vx - ux * vz) * (pos[A + 1] - centre[1]) + (ux * vy - uy * vx) * (pos[A + 2] - centre[2]); }
    if (out < 0) for (let k = i0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  };
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  // body: stations from nose to tail, each [x, sill height, top height, half width]; the section is a rounded box that leans in above the belt line
  const ST = [[2.37, 0.62, 0.9, 0.5], [2.34, 0.46, 1.02, 0.86], [2.2, 0.42, 1.1, 0.92], [1.6, 0.42, 1.15, 0.93], [0.98, 0.42, 1.17, 0.93], [0.55, 0.42, 1.86, 0.93], [0.1, 0.42, 1.9, 0.93], [-1.2, 0.42, 1.9, 0.93], [-2.12, 0.42, 1.87, 0.93], [-2.3, 0.44, 1.78, 0.91], [-2.37, 0.6, 1.5, 0.6]];
  const NS = ST.length - 1, sect = (st, v) => { const an = v * PI * 2, yc = (st[1] + st[2]) / 2, hh = (st[2] - st[1]) / 2, y = yc + hh * sp(Math.sin(an), 0.34), lean = 1 - 0.11 * Math.min(1, Math.max(0, (y - 1.17) / 0.7)); return [st[0], y, st[3] * lean * sp(Math.cos(an), 0.34)]; };
  grid(NS * 3, 28, (u, v) => { const f = u * NS, k = Math.min(NS - 1, Math.floor(f)), t = f - k, a = sect(ST[k], v), b = sect(ST[k + 1], v), e = t * t * (3 - 2 * t), te = k === 4 ? t : e;       // the windscreen is a straight rake; elsewhere the stations blend smoothly
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * te, a[2] + (b[2] - a[2]) * te]; }, 0, col, [0, 1.1, 0]);
  for (const k of [0, NS]) grid(2, 28, (u, v) => { const p = sect(ST[k], v), c = [ST[k][0] + (k ? -0.02 : 0.02), (ST[k][1] + ST[k][2]) / 2, 0]; return [p[0] + (c[0] - p[0]) * u, p[1] + (c[1] - p[1]) * u, p[2] * (1 - u)]; }, 0, col, [0, 1.1, 0]);      // the nose and the tail closed off, gently domed
  // a wheel turned about the given axis (2: across the car, 0: along it): rim dish, rounded shoulder, tread, inner shoulder
  const PROF = [[0.0, 0.001], [0.035, 0.1], [0.03, 0.26], [0.0, 0.3], [-0.015, 0.395], [0.03, 0.44], [0.07, 0.452], [0.2, 0.452], [0.24, 0.44], [0.27, 0.39], [0.275, 0.2], [0.275, 0.001]];
  const wheel = (cx, cy, cz, sg, axis, part) => grid(PROF.length - 1, 18, (u, v) => { const q = PROF[Math.round(u * (PROF.length - 1))], an = v * PI * 2, o = -q[0] * sg, r = q[1] * (axis === 0 ? 0.93 : 1);
    return axis === 2 ? [cx + Math.cos(an) * r, cy + Math.sin(an) * r, cz + o] : [cx + o, cy + Math.sin(an) * r, cz + Math.cos(an) * r]; }, part, TYRE, [cx + (axis === 0 ? -sg * 0.14 : 0), cy, cz + (axis === 2 ? sg * -0.14 : 0)]);
  for (const x of [1.5, -1.55]) for (const sg of [1, -1]) wheel(x, 0.44, 1.0 * sg, sg, 2, 2);
  wheel(-2.64, 1.02, 0, -1, 0, 3);                                                   // the spare, on the tail door
  // round bar along a path: bull bar, roof rack
  const bar = (path, r, part, c) => grid(path.length - 1, 8, (u, v) => { const k = u * (path.length - 1), i = Math.min(path.length - 2, Math.floor(k)), t = k - i, p = path[i], q = path[i + 1], d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(...d) || 1;
    const ref = Math.abs(d[1]) / l > 0.9 ? [1, 0, 0] : [0, 1, 0], s1 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]], sl = Math.hypot(...s1) || 1, s2 = [(d[1] * s1[2] - d[2] * s1[1]) / l / sl, (d[2] * s1[0] - d[0] * s1[2]) / l / sl, (d[0] * s1[1] - d[1] * s1[0]) / l / sl], an = v * PI * 2;
    return [0, 1, 2].map(m => p[m] + d[m] * t + (s1[m] / sl * Math.cos(an) + s2[m] * Math.sin(an)) * r); }, part, c, path[0].map((v, m) => (v + path[path.length - 1][m]) / 2));
  bar([[2.47, 0.46, -0.93], [2.5, 0.46, -0.5], [2.52, 0.46, 0], [2.5, 0.46, 0.5], [2.47, 0.46, 0.93]], 0.075, 3, DARK);                              // bumper bar, bowed
  bar([[2.5, 0.5, -0.5], [2.5, 0.95, -0.5], [2.47, 1.12, -0.42], [2.47, 1.15, 0], [2.47, 1.12, 0.42], [2.5, 0.95, 0.5], [2.5, 0.5, 0.5]], 0.032, 3, DARK);   // the hoop above it
  for (const z of [-0.72, 0.72]) bar([[0.3, 1.9, z], [0.3, 1.98, z], [-1.9, 1.98, z], [-1.9, 1.9, z]], 0.025, 3, DARK);                                // roof rack rails
  for (const x of [0.2, -0.5, -1.2, -1.8]) bar([[x, 1.98, -0.72], [x, 1.98, 0.72]], 0.02, 3, DARK);
  // rounded lumps: lamps, and the rolled swag strapped to the rack
  const lump = (c, r, part, colr2) => grid(6, 10, (u, v) => { const a = u * PI, b = v * PI * 2; return [c[0] + r[0] * Math.sin(a) * Math.cos(b), c[1] + r[1] * Math.cos(a), c[2] + r[2] * Math.sin(a) * Math.sin(b)]; }, part, colr2, c);
  for (const z of [-0.62, 0.62]) { lump([2.345, 0.9, z], [0.05, 0.085, 0.13], 4, [.95, .93, .8]); lump([-2.345, 0.9, z * 1.16], [0.04, 0.12, 0.09], 4, [.7, .08, .06]); }
  lump([-1.0, 2.14, 0], [0.24, 0.17, 0.66], 5, [.33, .38, .30]); lump([-0.35, 2.12, 0.1], [0.3, 0.14, 0.42], 5, [.2, .28, .40]);
  // smooth normals, shared by vertices that sit at the same point
  const n = pos.length / 3, nr = new Float32Array(n * 3), key = new Map();
  for (let k = 0; k < idx.length; k += 3) { const A = idx[k] * 3, B = idx[k + 1] * 3, C = idx[k + 2] * 3, ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2], vx = pos[C] - pos[A], vy = pos[C + 1] - pos[A + 1], vz = pos[C + 2] - pos[A + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [A, B, C]) { nr[q] += nx; nr[q + 1] += ny; nr[q + 2] += nz; } }
  for (let i = 0; i < n; i++) { const k = Math.round(pos[i * 3] * 1000) + ',' + Math.round(pos[i * 3 + 1] * 1000) + ',' + Math.round(pos[i * 3 + 2] * 1000) + ',' + Math.floor(fx[i * 3]), o = key.get(k) || [0, 0, 0, []]; o[0] += nr[i * 3]; o[1] += nr[i * 3 + 1]; o[2] += nr[i * 3 + 2]; o[3].push(i); key.set(k, o); }
  for (const o of key.values()) { const l = Math.hypot(o[0], o[1], o[2]) || 1; for (const i of o[3]) { nr[i * 3] = o[0] / l; nr[i * 3 + 1] = o[1] / l; nr[i * 3 + 2] = o[2] / l; } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setAttribute('aFx', new THREE.Float32BufferAttribute(fx, 3)); g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
// The shaft of light in front of a car at night: a faint glowing fan from the two lamps, dipping to the ground, seen from outside the car.
const beamGeo = (() => { const g = new THREE.BufferGeometry(), p = [], u = [], ix = [], N = 10;
  for (let i = 0; i <= N; i++) { const t = i / N, x = 2.45 + t * 15, w = 0.95 + t * 3.6, y = 0.82 - t * 0.5; p.push(x, y, -w, x, y, w); u.push(t, -1, t, 1); }
  for (let i = 0; i < N; i++) { const o = i * 2; ix.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.setIndex(ix); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); return g; })();
const beamMat = makeMat({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  vs: /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGV} }`,
  fs: /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ ${LOGF}
    float two = exp(-pow((abs(vUv.y) - 0.55 + 0.3 * vUv.x) * 3.2, 2.0)) + 0.35 * (1.0 - vUv.y * vUv.y);      // two shafts that merge as they spread
    float a = two * pow(1.0 - vUv.x, 1.6) * smoothstep(0.0, 0.04, vUv.x) * smoothstep(0.25, 0.6, uNight) * 0.3;
    gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a, a); }` });
export const rideable = [];            // the moving 4WDs, for riding along in (see ride.js)
// the dark patch a car throws on the sand under itself
export function carShadow() { const g = new THREE.PlaneGeometry(6.2, 3.0); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, blobShadowMat()); m.position.y = 0.05; m.frustumCulled = false; m.renderOrder = 4; return m; }
function buildCars(scene, F, lights) {
  const routes = (F.beach || []).filter(r => r.p.length > 30);
  if (!routes.length) return () => {};
  const R = rng(4004), S = 1.45, mat = objectMat({ side: THREE.DoubleSide, defines: { CAR: 1 } });
  const COLS = [[.90, .90, .88], [.80, .81, .82], [.16, .18, .16], [.62, .12, .10], [.72, .66, .50], [.13, .22, .40], [.86, .84, .70]], geos = COLS.map(fourWD);
  { // the 4WDs parked beside the houses (see the yards in features.js): they stay where they are
    const P = rng(909);
    for (const [x, z, ang] of F.parked || []) { const m = new THREE.Mesh(geos[(P() * geos.length) | 0], mat); m.name = 'parkedCar'; m.scale.setScalar(S); const tx = Math.cos(ang), tz = -Math.sin(ang), yf = meshY(x + tx * 3, z + tz * 3), yb = meshY(x - tx * 3, z - tz * 3); m.rotation.order = 'YZX'; m.rotation.set(0, ang, Math.atan2(yf - yb, 6 * S)); m.position.set(x, Math.max(meshY(x, z), (yf + yb) / 2), z); const sh = carShadow(); sh.frustumCulled = true; m.add(sh); scene.add(m); }      // (culled when out of view: there are many)
  }
  const cars = [];
  routes.forEach((r, ri) => {
    const cum = [0]; for (let i = 1; i < r.p.length; i++) cum.push(cum[i - 1] + Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1]));
    const len = cum[cum.length - 1], n = clamp(Math.round(len / (MOBILE ? 4200 : 2600)), 1, MOBILE ? 5 : 9);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geos[(R() * geos.length) | 0], mat); m.name = 'car'; m.rotation.order = 'YZX'; m.scale.setScalar(S); m.frustumCulled = false; m.add(carShadow()); scene.add(m);
      const dir = R() < 0.5 ? 1 : -1;
      cars.push({ m, side: r.side, p: r.p, cum, len, s: (k + R()) / n * len, dir, lane: dir * (1.6 + R()), sp: 8 + R() * 6, i: 1, y: 0, li: [lights.add([0, 0, 0], [1, .93, .75], 0, 1, 0, 2.1), lights.add([0, 0, 0], [1, .93, .75], 0, 1, 0, 2.1)] });
      m.add(new THREE.Mesh(beamGeo, beamMat));
    }
  });
  rideable.push(...cars);
  // taking the wheel and giving it back: a car left close to its beach run picks the run up again; one left elsewhere stays parked there
  for (const c of cars) c.setDrive = (on) => {
    if (on) { c.drive = { turn: 0, throttle: clamp(c.sp / 15, 0.2, 1), v: c.sp }; c.parked = false; return; }
    c.drive = null; let bi = 1, bd = 1e9; for (let i = 1; i < c.p.length; i++) { const d = Math.hypot(c.p[i][0] - c.m.position.x, c.p[i][1] - c.m.position.z); if (d < bd) { bd = d; bi = i; } }
    if (bd < 45) {
      c.s = clamp(c.cum[bi], 41, c.len - 41); c.i = bi; c.parked = false; const sx = c.p[bi][0] - c.p[bi - 1][0], sz = c.p[bi][1] - c.p[bi - 1][1], sl = Math.hypot(sx, sz) || 1, fwd = Math.cos(c.m.rotation.y) * sx - Math.sin(c.m.rotation.y) * sz; c.dir = fwd >= 0 ? 1 : -1; c.lane = Math.abs(c.lane) * c.dir;
      // it does not jump back onto its lane: it starts from where you left it and works its way over
      const tx = sx / sl * c.dir, tz = sz / sl * c.dir; c.laneS = clamp((c.m.position.x - c.p[bi][0]) * tz - (c.m.position.z - c.p[bi][1]) * tx, -50, 50);
    } else c.parked = true;
  };
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
        vec3 c = vec3(0.6, 0.5, 0.32) * (uLightCol * (0.2 + 0.5 * max(uLightDir.y, 0.0)) * cloudShadow(vW) + uAmbSky * 0.7);
        gl_FragColor = vec4(applyFog(c, vW), a * press * crumble * 0.45); }`,
  }));
  tmesh.name = 'tyremarks'; tmesh.frustumCulled = false; tmesh.renderOrder = 3; scene.add(tmesh);
  // The Micat's cars. While she lies with her bow on the beach, 4WDs come down her ramp one after another, up the sand and away along the beach,
  // and others come back along the beach and drive aboard. (She keeps her own clock: see boats.js.)
  const mc = [];
  if (F.micat) {
    const M = F.micat, [dx, dz] = M.dir, at = (d) => [M.bow[0] + dx * d * M.S, M.bow[1] + dz * d * M.S], P0 = at(18), P1 = at(36.5);
    let best = null, bd = 1e9; for (const r of routes) for (let i = 0; i < r.p.length; i++) { const d = Math.hypot(r.p[i][0] - P1[0], r.p[i][1] - P1[1]); if (d < bd) { bd = d; best = [r, i]; } }
    if (best && bd < 150) {
      const path = (sgn) => { const pts = [P0, P1, [P1[0] + dx * 9, P1[1] + dz * 9]]; for (let k = 1; k <= 12; k++) { const j = best[1] + sgn * k; if (j < 0 || j >= best[0].p.length) break; pts.push([best[0].p[j][0] + sgn * 2.2, best[0].p[j][1]]); }
        const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; };
      const paths = [path(1), path(-1)].filter(q => q.len > 150), P = rng(606);
      for (let k = 0; k < (MOBILE ? 4 : 6) && paths.length; k++) { const m = new THREE.Mesh(geos[(P() * geos.length) | 0], mat); m.name = 'micatCar'; m.rotation.order = 'YZX'; m.scale.setScalar(S); m.frustumCulled = false; m.visible = false; m.add(carShadow()); scene.add(m); mc.push({ m, path: paths[k % paths.length], off: k * 14, k }); }
      M.clock = 0;
    }
  }
  const shuttle = (dt) => {
    const M = F.micat; if (!mc.length) return;
    if (!M.beached) { M.clock = 0; for (const c of mc) c.m.visible = false; return; }
    M.clock += dt;
    const SPD = 7, sea = U.uSeaM.value * VEX;
    for (const c of mc) {
      const { pts, cum, len } = c.path, period = len / SPD + 12, tt = M.clock - c.off; if (tt < 0) { c.m.visible = false; continue; }
      const lap = Math.floor(tt / period), u = tt - lap * period, off = (lap + c.k) % 2 === 0, s = off ? u * SPD : len - u * SPD;      // one lap she drives off, the next she drives aboard
      if (s < 0 || s > len) { c.m.visible = false; c.hd = undefined; continue; }
      const posAt = (q) => { q = clamp(q, 0, len); let i = 1; while (i < cum.length - 1 && cum[i] < q) i++; const f = (q - cum[i - 1]) / Math.max(0.01, cum[i] - cum[i - 1]), a = pts[i - 1], b = pts[i]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
      // on the deck and the ramp the car is carried by the ship; beyond the ramp's foot it is on the sand
      const yAt = (q) => { const p = posAt(q), g = Math.max(meshY(p[0], p[1]), sea - 0.2); if (q >= cum[1]) return g; const lx = 18 + q / M.S, ly = lx < 28.4 ? 3.0 : 2.98 - 2.08 * (lx - 28.4) / 8.1; return Math.max(g, (M.y ?? sea) + ly * M.S); };
      const sg = off ? 1 : -1, p = posAt(s), pf = posAt(s + 3 * sg), pb = posAt(s - 3 * sg), want = Math.atan2(-(pf[1] - pb[1]), pf[0] - pb[0]);
      if (c.hd === undefined) c.hd = want; let d = want - c.hd; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); c.hd += d * (1 - Math.exp(-dt * 3));
      c.m.visible = true; c.m.position.set(p[0], yAt(s), p[1]); c.m.rotation.set(0, c.hd, Math.atan2(yAt(s + 3 * sg) - yAt(s - 3 * sg), 6));
    }
  };
  return (dt) => {
    shuttle(dt);
    let laid = false;
    for (const c of cars) {
      let tx, tz, x, z;
      if (c.drive || c.parked) {            // someone aboard has the wheel (or left it parked where they stopped): it goes where it is steered, over any ground but not into the sea
        const dr = c.drive || { turn: 0, throttle: 0, v: 0 }; let hd = c.m.rotation.y;
        dr.v = (dr.v || 0) + (dr.throttle * 15 - (dr.v || 0)) * Math.min(1, dt * 1.3);
        hd -= dr.turn * 0.75 * dt * clamp(Math.abs(dr.v) / 4, 0, 1) * (dr.v < 0 ? -1 : 1);
        tx = Math.cos(hd); tz = -Math.sin(hd); x = c.m.position.x; z = c.m.position.z;
        const nx = x + tx * dr.v * dt, nz = z + tz * dr.v * dt;
        // it will not climb a dune face head on, and off the sand, in the bush, it can only crawl
        const way = dr.v < 0 ? -1 : 1, rise = (groundH(nx + tx * 3 * way, nz + tz * 3 * way) - groundH(x, z)) / 3;
        if (maskAt(x, z).sand < 0.3) dr.v = clamp(dr.v, -3, 5.5);
        if (rise < 0.42 && groundH(nx + tx * 2, nz + tz * 2) > U.uSeaM.value - 0.45 && Math.abs(nx) < T.sx / 2 - 200 && Math.abs(nz) < T.sz / 2 - 200) { x = nx; z = nz; } else dr.v *= 0.6;
        c.sp = Math.abs(dr.v); c.m.rotation.y = hd;
      } else {
        c.sp = c.sp0 || (c.sp0 = c.sp);
        c.s += c.sp * c.dir * dt;
        if (c.s > c.len - 40 || c.s < 40) { c.dir *= -1; c.lane *= -1; c.s = clamp(c.s, 40, c.len - 40); }
        while (c.i < c.cum.length - 1 && c.cum[c.i] < c.s) c.i++;
        while (c.i > 1 && c.cum[c.i - 1] > c.s) c.i--;
        const a = c.p[c.i - 1], b = c.p[c.i], f = (c.s - c.cum[c.i - 1]) / Math.max(1, c.cum[c.i] - c.cum[c.i - 1]);
        tx = (b[0] - a[0]) * c.dir; tz = (b[1] - a[1]) * c.dir; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        // The track is a chain of straight pieces, but a car does not kink at each joint: it keeps to its lane on the heading it actually has
        // (which swings round smoothly, below), and when it turns back at the end of the beach it crosses over to the other lane as it comes about.
        if (c.laneS === undefined) { c.laneS = c.lane; c.m.rotation.y = Math.atan2(-tz, tx); }
        c.laneS += (c.lane - c.laneS) * (1 - Math.exp(-dt * 0.9));
        const yw = c.m.rotation.y; x = a[0] + (b[0] - a[0]) * f - Math.sin(yw) * c.laneS; z = a[1] + (b[1] - a[1]) * f - Math.cos(yw) * c.laneS;
      }
      const y = Math.max(meshY(x, z), U.uSeaM.value * VEX - 0.2), yf = meshY(x + tx * 3, z + tz * 3), yb = meshY(x - tx * 3, z - tz * 3);
      c.y += (y - c.y) * Math.min(1, dt * 8);
      c.m.position.set(x, c.y, z);
      const hd = Math.atan2(-tz, tx); let d = hd - c.m.rotation.y; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
      // the wheel is turned in and taken off gradually, so the turning speed never jumps; the nose rises and dips over the sand without snatching
      c.w = (c.w ?? 0) + (clamp(d * 2.2, -1.5, 1.5) - (c.w ?? 0)) * (1 - Math.exp(-dt * 5));
      const ptT = Math.atan2(yf - yb, 6 * S); c.pt = (c.pt ?? ptT) + (ptT - (c.pt ?? ptT)) * (1 - Math.exp(-dt * 5));
      c.m.rotation.set(0, c.drive ? hd : c.m.rotation.y + clamp(c.w * dt, -Math.abs(d), Math.abs(d)), c.pt);
      const fx = x + tx * 3.5 * S, fz = z + tz * 3.5 * S;
      const ly = c.m.visible ? c.y + 1.2 * S : -1e4;          // sat inside the car you do not see its own lamps, only what they light
      lights.move(c.li[0], fx - tz * 0.9, ly, fz + tx * 0.9); lights.move(c.li[1], fx + tz * 0.9, ly, fz - tx * 0.9);
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
  swimmers(scene, { ...FLATHEAD, paint: PAINT.flathead, name: 'flathead', bottom: 1, amp: 0.05, rate: 2.2, colA: [0.45, 0.38, 0.25], colB: [0.84, 0.8, 0.68], colC: [0.5, 0.42, 0.26], eye: [0.37, 0.05, 0.016], see: 500, min: 0.25 }, flathead);
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
  // (a rounded body, back and head, not boxes; black marks the parts that take the bird's own colour)
  const ell = (cx, cy, cz, rx, ry, rz, col, N = 6, Mm = 8) => { const P = (i, j) => { const th = i / N * Math.PI, ph = j / Mm * 2 * Math.PI; return [cx + Math.cos(th) * rx, cy + Math.sin(th) * Math.cos(ph) * ry, cz + Math.sin(th) * Math.sin(ph) * rz]; };
    for (let i = 0; i < N; i++) for (let j = 0; j < Mm; j++) sg.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), col); };
  ell(0.01, 0.225, 0, 0.15, 0.062, 0.066, WHITE); ell(-0.035, 0.252, 0, 0.165, 0.05, 0.072, [0, 0, 0]); ell(-0.2, 0.25, 0, 0.07, 0.016, 0.036, [0, 0, 0], 4, 6);      // breast and belly, back and folded wings, tail
  ell(0.115, 0.285, 0, 0.05, 0.045, 0.04, WHITE, 4, 6); ell(0.15, 0.33, 0, 0.046, 0.042, 0.04, [0, 0, 0]);                                                      // neck and head
  ell(0.215, 0.322, 0, 0.05, 0.011, 0.011, RED, 4, 5); sg.box(0.02, 0, 0.03, 0.013, 0.17, 0.013, RED); sg.box(0.02, 0, -0.03, 0.013, 0.17, 0.013, RED);        // bill and legs
  const geo = sg.build(), ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.setAttribute('position', geo.attributes.position); ig.setAttribute('normal', geo.attributes.normal); ig.setAttribute('color', geo.attributes.color);
  const sp = [], sc = [];
  for (const r of F.beach || []) for (let i = 8; i < r.p.length - 8; i += MOBILE ? 9 : 5) {
    if (R() < 0.45) continue;
    const p = r.p[i], q = r.p[i + 1], gull = R() < 0.35, k = gull ? 2 + ((R() * 4) | 0) : 2, side = r.side || 1;
    for (let j = 0; j < k; j++) { sp.push(p[0] + side * (5 + R() * 5) + (R() - .5) * 4, p[1] + (R() - .5) * 8, Math.atan2(-(q[1] - p[1]), q[0] - p[0]) + (R() < .5 ? 0 : Math.PI), R()); sc.push(...(gull ? GREY : ob)); }
  }
  if (F.micat) { const M = F.micat, [dx, dz] = M.dir;            // a flock of silver gulls stands about on the sand beside the Micat's landing (the owner's photograph)
    for (let j = 0; j < 16; j++) { const up = 20 + R() * 16, out = 12 + R() * 26; sp.push(M.land[0] + dx * up - dz * out, M.land[1] + dz * up + dx * out, R() * 6.283, R()); sc.push(...GREY); } }
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
    fg.index = geo2.index; fg.setAttribute('position', geo2.attributes.position); fg.setAttribute('normal', geo2.attributes.normal); fg.setAttribute('color', geo2.attributes.color); fg.setAttribute('aFx', geo2.attributes.aFx);
    for (const [p, n] of spots) for (let i = 0, t = 0; i < n * per && t < 400; t++) { const x = p[0] - 40 - R() * 160, z = p[1] + (R() - .5) * 260; if (wet(x, z)) { ip.push(x, z, 3 + R() * 9, R()); i++; } }
    fg.setAttribute('iP', new THREE.InstancedBufferAttribute(new Float32Array(ip), 4)); fg.instanceCount = ip.length / 4; fg.boundingSphere = FAR;
    const fm = new THREE.Mesh(fg, fmat); fm.name = 'afloat'; fm.frustumCulled = false; scene.add(fm);
  };
  const fmat = makeMat({
    side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec3 color, aFx; attribute vec4 iP; varying vec3 vCol, vW, vLight, vFx;
      void main(){
        float way = iP.w < 0.5 ? 1.0 : -1.0, ang = iP.w * 40.0 + uTime * 0.22 / iP.z * way;
        vec2 c = iP.xy + vec2(cos(ang), sin(ang)) * iP.z, fwd = vec2(-sin(ang), cos(ang)) * way;
        vec3 lp = position * 1.9 - vec3(0.0, 0.29, 0.0);                 // it sits in the water, not on it
        vec3 wp = vec3(c.x + fwd.x * lp.x - fwd.y * lp.z, uSeaM * uVex + lp.y + sin(uTime * 1.3 + iP.w * 30.0) * 0.06, c.y + fwd.y * lp.x + fwd.x * lp.z);
        vec3 nw = normalize(vec3(fwd.x * normal.x - fwd.y * normal.z, normal.y, fwd.y * normal.x + fwd.x * normal.z));
        float ok = step(groundY(c), uSeaM * uVex - 0.5) * (1.0 - smoothstep(900.0, 1200.0, length(wp - cameraPosition)));
        vCol = color; vFx = aFx; vLight = uLightCol * (0.12 + 0.75 * max(dot(nw, uLightDir), 0.0)) * cloudShadow(wp) + uAmbSky * (0.6 + 0.4 * nw.y); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: BIRD_FS,
  });
  const tgl = F.places.find(p => /^Tangalooma/.test(p.n || ''))?.p, wv = F.views.find(v => /Tangalooma Wrecks/.test(v.n || '')), wrk = wv && (wv.c || wv.p), others = F.places.filter(p => !/^Tangalooma/.test(p.n || '')).map(p => [p.p, 1]);
  const spots = [...(tgl ? [[[tgl[0] - 230, tgl[1] + 340], 3]] : []), ...(wrk ? [[[wrk[0] + 60, wrk[1]], 2]] : []), ...others];
  afloat(PELICAN(), spots, 3);
  // pelicans ashore: groups of them standing together on the sand spits and beaches of the sheltered side, all facing into the wind,
  // most of them toward the south end (Kooringal and the banks by the Big Sandhills), as the owner photographed them
  {
    const st = [], Rp = rng(9090), gh = (x, z) => heightAt(x, z);
    const group = (x, z, n) => {      // a loose knot of birds a wing-length apart, strung along the shore, each one on sand that stays dry
      for (let i = 0; i < n; i++) {
        const pz = z + (Rp() - 0.5) * (2.2 + n * 0.75), ok = [];
        for (let dx = -9; dx <= 9; dx += 0.4) { const h = gh(x + dx, pz); if (h > 0.45 && h < 1.15) ok.push(x + dx); }
        if (ok.length) st.push(ok[(Rp() * ok.length) | 0], pz, Rp(), 0.9 + Rp() * 0.22);
      }
    };
    let made = 0;
    for (const r of (F.beach || []).filter(q => q.side < 0)) for (let i = 6; i < r.p.length - 6 && made < (MOBILE ? 9 : 16); i += 5 + ((Rp() * 9) | 0)) {
      const p = r.p[i]; if (Rp() > (p[1] > 6000 ? 0.75 : 0.2)) continue;                 // far more of them in the south
      let x = p[0], ok = false; for (let t = 0; t < 60 && !ok; t++) { x -= 2; const h = gh(x, p[1]); ok = h < 0.95 && h > 0.6; }      // down the beach to just above the water
      if (ok) { group(x, p[1], 7 + ((Rp() * 9) | 0)); made++; }
    }
    const sg = PELICAN_STAND(), ig2 = new THREE.InstancedBufferGeometry();
    ig2.index = sg.index; for (const k of ['position', 'normal', 'color', 'aFx']) ig2.setAttribute(k, sg.attributes[k]);
    ig2.setAttribute('iP', new THREE.InstancedBufferAttribute(new Float32Array(st), 4)); ig2.instanceCount = st.length / 4; ig2.boundingSphere = FAR;
    const smat2 = makeMat({
      side: THREE.DoubleSide, uniforms: { },
      vs: /* glsl */`
        attribute vec3 color, aFx; attribute vec4 iP; uniform vec2 uWindDir; varying vec3 vCol, vW, vLight, vFx;
        void main(){
          // each stands facing the wind (give or take), shifting its weight and turning its head a little now and then
          vec2 up = -normalize(uWindDir + 1e-4); float a = (iP.z - 0.5) * 0.9 + sin(uTime * 0.13 + iP.z * 40.0) * 0.12, ca = cos(a), sa = sin(a);
          vec2 fwd = vec2(up.x * ca - up.y * sa, up.x * sa + up.y * ca);
          vec3 lp = position * 1.9 * iP.w; lp.y += sin(uTime * 0.7 + iP.z * 30.0) * 0.012 * step(0.25, position.y);
          vec3 wp = vec3(iP.x + fwd.x * lp.x - fwd.y * lp.z, groundY(iP.xy) + lp.y, iP.y + fwd.y * lp.x + fwd.x * lp.z);
          vec3 nw = normalize(vec3(fwd.x * normal.x - fwd.y * normal.z, normal.y, fwd.y * normal.x + fwd.x * normal.z));
          float ok = step(uSeaM * uVex - 0.35, groundY(iP.xy)) * (1.0 - smoothstep(1100.0, 1500.0, length(wp - cameraPosition)));       // when the tide covers their spit they are gone (out fishing)
          vCol = color; vFx = aFx; vLight = uLightCol * (0.12 + 0.75 * max(dot(nw, uLightDir), 0.0)) * cloudShadow(wp) + uAmbSky * (0.6 + 0.4 * nw.y); vW = wp;
          gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
          ${LOGV}
        }`,
      fs: BIRD_FS,
    });
    const sm2 = new THREE.Mesh(ig2, smat2); sm2.name = 'ashore'; sm2.frustumCulled = false; scene.add(sm2);
  }
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
// Goat's-foot vine and beach bean: runners of round, bright green leaves creeping out over the sand from the foot of the scrub,
// with a pink-purple or a yellow flower here and there (the owner's photo from the beach near Kooringal).
function buildCreeper(scene) {
  const R = rng(5150), pos = [], k = [], idx = [];
  const fan = (cx, cy, cz, r, kk, dir, cup, lobes) => {      // a rounded leaf or flower: a centre and a rim, dished a little, notched at the tip like a goat's hoof
    const b = pos.length / 3, N = 8; pos.push(cx, cy, cz); k.push(kk);
    for (let i = 0; i < N; i++) { const a = i / N * 6.283, rr = r * (1 - lobes * Math.pow(Math.max(0, Math.cos(a)), 6) * 0.45) * (0.75 + 0.25 * Math.abs(Math.sin(a))), ca = Math.cos(a + dir), sa = Math.sin(a + dir); pos.push(cx + ca * rr, cy + cup * r, cz + sa * rr); k.push(kk); }
    for (let i = 0; i < N; i++) idx.push(b, b + 1 + i, b + 1 + (i + 1) % N);
  };
  for (let arm = 0; arm < 3; arm++) {
    const a0 = arm / 3 * 6.283 + R() * 0.8, bend = (R() - 0.5) * 1.6, len = 0.36 + R() * 0.2; let px = 0, pz = 0;
    for (let j = 0; j < 5; j++) {
      const a = a0 + bend * j / 5, nx = px + Math.cos(a) * len / 5, nz = pz + Math.sin(a) * len / 5, sx = -Math.sin(a) * 0.006, sz = Math.cos(a) * 0.006, b = pos.length / 3;
      pos.push(px - sx, 0.006, pz - sz, px + sx, 0.006, pz + sz, nx + sx, 0.006, nz + sz, nx - sx, 0.006, nz - sz); k.push(1, 1, 1, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);       // the runner
      const side = j % 2 ? 1 : -1, lx = nx - Math.sin(a) * 0.045 * side, lz = nz + Math.cos(a) * 0.045 * side;
      fan(lx, 0.03 + R() * 0.06, lz, 0.045 + R() * 0.02, 0, a + side * 1.3, 0.45, 1);       // the leaves stand up off the sand on short stalks
      px = nx; pz = nz;
    }
    if (arm < 2) fan(px * 0.6 + 0.02, 0.1, pz * 0.6, 0.028, 2, 0, 0.55, 0);
    for (let e = 0; e < 2; e++) fan((R() - 0.5) * 0.16, 0.06 + R() * 0.06, (R() - 0.5) * 0.16, 0.05 + R() * 0.02, 0, R() * 6.28, 0.5, 1);      // a knot of leaves where the runners start
  }
  return scatter(scene, LOW ? 44 : 64, 1.5, (g) => { attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx); }, /* glsl */`
        float edge = smoothstep(0.45, 0.55, mk.g) * (1.0 - smoothstep(0.66, 0.8, mk.g));                             // it creeps out from the foot of the scrub onto the edge of the open sand
        float here = step(0.9, mk.r) * smoothstep(2.6, 3.4, hgt) * (1.0 - smoothstep(6.0, 9.0, hgt)) * (1.0 - smoothstep(170.0, 250.0, (mk.b - 0.5) * 3000.0)) * edge * step(h3, mix(0.6, 0.2, smoothstep(0.55, 0.8, mk.g))) * smoothstep(0.3, 0.5, texture2D(uNoise, xz / 19.0).g) * (1.0 - smoothstep(0.02, 0.1, ov.r));      // thick mats in places near the scrub, thinner further out
        s = (1.7 + 1.8 * h2) * here;
        lp = position; nrm = normalize(vec3(position.x * 0.6, 1.0, position.z * 0.6));
        c = aK < 0.5 ? mix(vec3(0.11, 0.25, 0.055), vec3(0.21, 0.37, 0.09), h1) * (0.85 + 0.3 * fract(h4 * 7.0 + position.x * 9.0))
          : aK < 1.5 ? vec3(0.22, 0.13, 0.09)
          : (h4 > 0.45 ? vec3(0.60, 0.24, 0.52) : vec3(0.86, 0.72, 0.10));
        if(aK > 1.5 && fract(h1 * 9.0) > 0.45) s = 0.0;                    // not every runner is in flower`, 110);
}
// Fallen trees: where the sea and the wind eat a dune away, the trees on it come down and lie bleached silver on the sand,
// root plate at one end, bare limbs at the other (as in the owner's photo by the Big Sandhills).
function buildSnags(scene) {
  const R = rng(4141), parts = [];
  parts.push({ kk: 0, st: [[-0.5, 0.05, 0, 0.05], [-0.33, 0.04, 0.012, 0.04], [-0.1, 0.036, -0.016, 0.035], [0.14, 0.04, 0.006, 0.029], [0.36, 0.06, 0.03, 0.021], [0.56, 0.1, 0.02, 0.011]] });
  for (let i = 0; i < 6; i++) {                       // the root plate: stubs splayed out from the butt, torn off short
    const a = i / 6 * 6.283 + R() * 0.6, l = 0.09 + R() * 0.09, cy = Math.max(-0.02, Math.sin(a)), cz = Math.cos(a);
    parts.push({ kk: 2, st: [[-0.47, 0.05, 0, 0.028], [-0.53, 0.05 + cy * l * 0.55, cz * l * 0.55, 0.017], [-0.55 - R() * 0.04, 0.05 + cy * l + 0.01, cz * l * (1 + R() * 0.3), 0.005]] });
  }
  for (let i = 0; i < 5; i++) {                       // limbs: each leaves the trunk, kinks, forks once and ends in a broken point
    const x0 = -0.05 + i * 0.12 + R() * 0.05, sg = i % 2 ? 1 : -1, up = 0.06 + R() * 0.2, out = (0.1 + R() * 0.18) * sg, l = 0.16 + R() * 0.16, r0 = 0.02 - i * 0.002;
    const a = [x0, 0.04, 0, r0], b = [x0 + l * 0.35, 0.04 + up * 0.5, out * 0.45, r0 * 0.75], c = [x0 + l * 0.6 + R() * 0.05, 0.04 + up * 0.72, out * 0.85, r0 * 0.5], d = [x0 + l, 0.04 + up + R() * 0.05, out * 1.15, 0.003];
    parts.push({ kk: 1, st: [a, b, c, d] });
    parts.push({ kk: 1, st: [b, [b[0] + l * 0.2, b[1] + 0.05 + R() * 0.07, b[2] - out * 0.25, r0 * 0.4], [b[0] + l * 0.42, b[1] + 0.1 + R() * 0.1, b[2] - out * 0.5, 0.003]] });
  }
  const tb = tubes(parts, 5), build = (g) => { tb(g); g.computeVertexNormals(); };
  return scatter(scene, LOW ? 28 : 44, 12, build, /* glsl */`
        // the map's sand value falls away gently from open beach (near 1) to bush (near 0): the ragged ground between is where the mid values are
        float edgeBand = max(smoothstep(0.45, 0.58, mk.g) * (1.0 - smoothstep(0.76, 0.87, mk.g)), smoothstep(0.8, 0.9, mk.g) * smoothstep(1.2, 1.8, hgt) * (1.0 - smoothstep(3.0, 4.5, hgt)) * step(h1, 0.07));     // ...and now and then one lies out on the open beach
        float here = step(0.9, mk.r) * step(0.7, hgt) * edgeBand * step(h3, 0.3) * (1.0 - smoothstep(0.02, 0.1, ov.r));        // (the whole beach counts as a track on the map, so only buildings keep them away)
        float flip = h1 > 0.5 ? 1.0 : -1.0;
        s = (4.5 + 5.5 * h2) * here;
        lp = position * vec3(1.0, 0.7 + 0.6 * h1, flip); lp.y -= 0.012;                                           // half sunk in the sand
        nrm = normal * vec3(1.0, 1.0, flip);
        float grain = texture2D(uNoise, vec2(position.x * 2.6 + h1, position.y * 11.0 + position.z * 9.0 + h2)).r, check = texture2D(uNoise, position.xz * 21.0 + h2).g;
        c = mix(vec3(0.64, 0.62, 0.58), vec3(0.34, 0.31, 0.28), smoothstep(0.42, 0.78, grain)) * (0.86 + 0.28 * check);     // silver wood, darker in the cracks
        c *= aK > 1.5 ? 0.72 : 1.0; c *= 0.72 + 0.28 * smoothstep(-0.3, 0.5, normal.y);`, 520);
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
  return scatter(scene, LOW ? 16 : 22, 24, loftGeo(wallaby()), /* glsl */`
        float scrub = step(0.92, mk.r) * (1.0 - smoothstep(0.25, 0.5, mk.g)) * step(2.5, hgt) * (1.0 - smoothstep(0.02, 0.1, max(ov.r, ov.g))) * step(h3, 0.012);      // only a few: the owner says there are some on the island, not many
        float f = fract(uTime * 0.012 * (0.7 + 0.6 * h2) + h1 * 5.0), tri = abs(2.0 * f - 1.0), fwd = f < 0.5 ? -1.0 : 1.0;
        float go = smoothstep(0.3, 0.7, tri), moving = smoothstep(0.3, 0.34, tri) * (1.0 - smoothstep(0.66, 0.7, tri));           // long rests at each end, a short run of hops between
        float hop = abs(sin(go * 12.0)) * moving;
        s = (1.1 + 0.35 * h2) * scrub;
        lp = vec3(position.x * fwd, position.y, position.z);
        if(aK > 1.5 && aK < 2.5) lp.x += hop * 0.1 * fwd * (0.3 - position.y);                                                   // the hind legs kick back in the hop
        if(aK > 2.5 && aK < 3.5) lp.y += hop * 0.12 * (-position.x - 0.25);                                                      // the tail lifts as a balance
        lp += vec3((go - 0.5) * 9.0, hop * 0.3, 0.0) / max(s, 0.001);
        if(aK > 3.5) lp.y += sin(uTime * 0.5 + h1 * 30.0) * 0.012 * (1.0 - moving);                                               // at rest the head lifts and turns, listening
        nrm = normal * vec3(fwd, 1.0, 1.0);
        c = vec3(0.2);`, 420, WALLABY_PAINT);
}
// lizards: goannas walking the sand between the bushes, and smaller skinks and blue-tongues that sit, then dart
function buildLizards(scene) {
  const parts = [{ kk: 0, st: [[0.5, 0.05, 0, 0.022], [0.4, 0.065, 0, 0.045], [0.3, 0.06, 0.01, 0.04], [0.17, 0.075, 0.02, 0.065], [0.0, 0.07, 0, 0.075], [-0.16, 0.065, -0.02, 0.06], [-0.45, 0.04, 0.02, 0.032], [-0.75, 0.025, -0.03, 0.018], [-1.0, 0.015, 0, 0.006]] }];
  for (const [x, sg] of [[0.17, 1], [0.17, -1], [-0.14, 1], [-0.14, -1]]) parts.push({ kk: 2, st: [[x, 0.06, 0.05 * sg, 0.024], [x + 0.03, 0.05, 0.15 * sg, 0.02], [x + 0.07, 0.008, 0.19 * sg, 0.016]] });
  const body = (big) => /* glsl */`
        float ok = step(0.92, mk.r) * step(1.5, hgt) * (1.0 - smoothstep(0.02, 0.1, ov.r)) * step(h3, ${big ? '0.05' : '0.04'});
        float f = fract(uTime * ${big ? '0.02' : '0.05'} * (0.7 + 0.6 * h2) + h1 * 5.0), tri = abs(2.0 * f - 1.0), fwd = f < 0.5 ? -1.0 : 1.0;
        float go = smoothstep(${big ? '0.15, 0.85' : '0.42, 0.58'}, tri), moving = smoothstep(${big ? '0.15, 0.2' : '0.42, 0.44'}, tri) * (1.0 - smoothstep(${big ? '0.8, 0.85' : '0.56, 0.58'}, tri));
        s = ${big ? '(0.8 + 0.45 * h2)' : '(0.32 + 0.23 * h2)'} * ok;
        float wag = sin(position.x * 7.0 - uTime * ${big ? '5.0' : '14.0'}) * moving;                                          // the body snakes from side to side as it walks
        lp = vec3(position.x * fwd, position.y, position.z + wag * 0.045 * (0.3 + abs(position.x)));
        if(aK > 1.5) lp.x += sin(uTime * ${big ? '5.0' : '14.0'} + position.x * 20.0 + position.z * 30.0) * 0.04 * moving;
        lp += vec3((go - 0.5) * ${big ? '14.0' : '3.0'}, 0.0, 0.0) / max(s, 0.001);
        nrm = normal * vec3(fwd, 1.0, 1.0);
        float band = step(0.5, fract(position.x * ${big ? '9.0' : '5.0'} + h4));
        c = ${big ? 'mix(vec3(0.06, 0.065, 0.06), vec3(0.30, 0.27, 0.13), band * 0.55)' : 'mix(mix(vec3(0.36, 0.28, 0.18), vec3(0.20, 0.16, 0.12), band), vec3(0.42, 0.44, 0.40), step(0.6, h4) * 0.6)'} * (0.8 + 0.4 * smoothstep(0.02, 0.1, position.y));`;
  return [scatter(scene, LOW ? 14 : 20, 28, loftGeo(goanna()), body(true), 300, LIZARD_PAINT(true)), scatter(scene, LOW ? 30 : 44, 3.6, loftGeo(bluetongue()), body(false), 70, LIZARD_PAINT(false))];
}

// ---------------------------------------------------------------- pelicans on the wing
// Australian pelicans in loose lines low over the water: a few slow beats, then a long glide. Each is its own object (body and two
// hinged wings), so one can be followed, and flown: when it is, it goes where it is steered, and settles on the water if brought down to it.
export const flyers = [];
function buildPelicans(scene, F) {
  const R = rng(7117), mat = objectMat({ side: THREE.DoubleSide, defines: { BIRD: 1 } }), body = PELICAN_FLY(), wing = PELICAN_WING(), S = 1.4;
  const homes = [...F.places.filter(p => /hamlet|village/.test(p.k)).map(p => [p.p[0] - 500, p.p[1]]), ...F.views.filter(v => /Wrecks/.test(v.n || '')).map(v => [(v.c || v.p)[0] - 200, (v.c || v.p)[1]])];
  const N = MOBILE ? 9 : 16;
  const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);
  const make = (bodyG, wingG, scale, sh, o) => {
    const g = new THREE.Group(), b = new THREE.Mesh(bodyG, mat), wl = new THREE.Mesh(wingG, mat), wr = new THREE.Mesh(wingG, mat);
    wl.position.set(sh[0], sh[1], sh[2]); wr.position.set(sh[0], sh[1], -sh[2]); wr.scale.z = -1; g.add(b, wl, wr); g.scale.setScalar(scale); g.rotation.order = 'YZX';
    for (const m of [b, wl, wr]) m.frustumCulled = false;
    scene.add(g);
    const shade = new THREE.Mesh(shGeo, blobShadowMat()); shade.frustumCulled = false; shade.renderOrder = 4; scene.add(shade);        // its shadow on the ground or the water below
    const p = { m: g, wl, wr, sh: shade, span: scale * 2.9, ph: R() * 6.283, x: o.home[0], z: o.home[1], y: 8, hd: 0, ctl: null, afloat: false, len: 5, way: 1, ...o }; flyers.push(p); return p;
  };
  for (let i = 0; i < N && homes.length; i++) {
    const h = homes[(i / 3 | 0) % homes.length], lead = i % 3 === 0;
    make(body, wing, S, [0.06, 0.1, 0.12], { kind: 'pelican', home: h, rad: 260 + ((i / 3 | 0) * 97) % 240, ang: (lead ? R() * 6.283 : flyers[flyers.length - 1].ang - 0.045), way: (i / 3 | 0) % 2 ? 1 : -1, alt: 5 + ((i / 3 | 0) * 3.7) % 9 + (i % 3) * 0.6, sp: 11.5, glide: 0.06, beats: 0.25, rate: 7.0, sweep: 0.55 });
  }
  // white-bellied sea eagles: singly or in pairs, soaring in slow circles high over the headlands and the wooded hills, hardly beating a wing
  const eb = EAGLE_FLY(), ew = EAGLE_WING(), cape = F.lights.find(l => /Cape/.test(l.n || ''))?.p, peaks = F.peaks.slice(0, 3).map(q => q.p);
  const roosts = [cape, ...F.places.filter(p => /hamlet|village/.test(p.k)).map(p => [p.p[0] + 500, p.p[1] - 300]), ...peaks].filter(Boolean);
  for (let i = 0; i < (MOBILE ? 5 : 8) && roosts.length; i++) {
    const h = roosts[i % roosts.length];
    make(eb, ew, 1.4, [0.05, 0.085, 0.1], { kind: 'eagle', home: [h[0] + (R() - .5) * 300, h[1] + (R() - .5) * 300], rad: 110 + R() * 170, ang: R() * 6.283, way: R() < 0.5 ? 1 : -1, alt: 45 + R() * 70, sp: 12.5, glide: 0.2, beats: 0.82, rate: 5.0, sweep: 0.5, round: 1 });
  }
  // A pair of sea eagles sitting in a dead tree, as the owner saw them: a bare grey stag with two long limbs, one bird on each, at a few places
  // round the island (by the Little and the Big Sandhills, near the wrecks, and on the cape).
  {
    const tg = new THREE.BufferGeometry();
    tubes([{ kk: 0, st: [[0, -0.5, 0, 0.34], [0.1, 2.5, 0.05, 0.27], [-0.05, 5, 0.1, 0.21], [0.2, 7.6, 0, 0.14], [0.1, 9.8, -0.15, 0.04]] },
      { kk: 0, st: [[0, 4.1, 0.05, 0.15], [-1.2, 4.9, 0.25, 0.12], [-2.6, 5.05, 0.3, 0.09], [-3.5, 5.7, 0.15, 0.03]] }, { kk: 0, st: [[0.05, 5.6, 0, 0.13], [1.0, 6.3, -0.3, 0.1], [2.2, 6.45, -0.5, 0.07], [3.0, 7.3, -0.35, 0.02]] },
      { kk: 0, st: [[-0.02, 6.6, 0.05, 0.09], [-0.7, 7.7, 0.5, 0.05], [-0.9, 8.9, 0.6, 0.015]] }, { kk: 0, st: [[0.1, 3.0, 0.02, 0.1], [0.6, 3.4, 0.5, 0.05], [0.8, 3.5, 0.9, 0.015]] }, { kk: 0, st: [[-2.0, 5.0, 0.28, 0.07], [-2.3, 5.9, 0.6, 0.015]] }], 7)(tg);
    tg.computeVertexNormals(); const n = tg.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const k = 0.8 + 0.25 * Math.sin(tg.attributes.position.getY(i) * 3.1 + tg.attributes.position.getX(i) * 7); col[i * 3] = 0.5 * k; col[i * 3 + 1] = 0.47 * k; col[i * 3 + 2] = 0.43 * k; }
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const perch = EAGLE_PERCH(), find = (list, re) => { const q = (list || []).find(o => re.test(o.n || '')); return q ? (q.c || q.p) : null; };
    const sites = [find(F.sandnames, /Little Sand/), find(F.sandnames, /Big Sand/), find(F.views, /Tangalooma Wrecks/), find(F.lights, /Cape/), find(F.places, /Kooringal/)].filter(Boolean);
    sites.forEach((c, k) => {
      let at = null; for (let r = 60; r < 900 && !at; r += 45) for (let a = 0; a < 12 && !at; a++) { const x = c[0] + Math.cos(a * 0.524 + k) * r, z = c[1] + Math.sin(a * 0.524 + k) * r, h = heightAt(x, z), mk = maskAt(x, z); if (h > 2 && h < 40 && mk.sand < 0.75 && mk.land > 0.9) at = [x, z]; }
      if (!at) return;
      const g = new THREE.Group(), tree = new THREE.Mesh(tg, mat); g.add(tree);
      for (const [px, py, pz, ry] of [[-2.0, 5.13, 0.28, 0.4], [1.65, 6.5, -0.42, 2.6]]) { const e = new THREE.Mesh(perch, mat); e.position.set(px, py, pz); e.rotation.y = ry + k; e.scale.setScalar(0.74); g.add(e); }
      g.userData.birds = g.children.slice(1);
      g.position.set(at[0], meshY(at[0], at[1]), at[1]); g.rotation.y = k * 1.7; g.scale.setScalar(1.35); for (const m of g.children) m.frustumCulled = false; scene.add(g); (flyers.stags ||= []).push(g);
    });
  }
  // How high a bird must be to clear what stands on the ground below it: nothing over the water, a little over open sand, and the height of
  // the forest (with room to spare) over the bush. Birds fly over the trees, never through them.
  const clearY = (x, z, sea) => { const h = heightAt(x, z); if (h < 0.5) return sea; const mk = maskAt(x, z); return Math.max(sea, meshY(x, z)) + (mk.sand > 0.8 ? 3 : 38); };
  return (dt, t) => {
    const sea = U.uSeaM.value * VEX;
    for (const g of flyers.stags || []) g.userData.birds.forEach((e, i) => { const q = t * 0.23 + i * 2.1 + g.position.x; e.rotation.y += (Math.sin(q) * Math.sin(q * 0.37) > 0.55 ? 0.5 : -0.5) * dt * 0.6 * Math.sign(Math.sin(q * 1.9)); e.rotation.z = Math.sin(t * 0.9 + i) * 0.02; });       // they shift and look about now and then
    for (const p of flyers) {
      let bank = 0, flap;
      // the ground it must clear, here and a few seconds ahead along its course, so it starts to rise before the hill or the tree line arrives
      const cs0 = Math.cos(p.hd), sn0 = Math.sin(p.hd), sp0 = p.v ?? p.sp, flNow = clearY(p.x, p.z, sea);
      const flT = Math.max(flNow, clearY(p.x + cs0 * sp0 * 2.5, p.z - sn0 * sp0 * 2.5, sea), clearY(p.x + cs0 * sp0 * 6, p.z - sn0 * sp0 * 6, sea));
      p.fl = p.fl === undefined ? flT : p.fl + (flT - p.fl) * (1 - Math.exp(-dt * (flT > p.fl ? 2.2 : 0.7)));
      if (p.ctl) {                      // flown by hand: turn, climb and sink; down on the water it folds its wings and paddles
        const c = p.ctl; p.hd -= c.turn * 0.85 * dt; bank = c.turn * 0.5;
        const eagle = p.kind === 'eagle';
        p.y += c.climb * (eagle ? 8 + Math.max(0, p.y - sea) * 0.05 : 5) * dt; const floor = sea + 0.25;       // an eagle climbs fast, and faster the higher it is (it has the whole sky to cross)
        if (p.kind !== 'pelican') { p.y = Math.max(p.y, floor + 0.7); p.afloat = false; }       // only a pelican settles on the water; an eagle can skim it
        else if (p.y <= floor) { p.y = floor; p.afloat = c.climb <= 0; } else p.afloat = false;
        p.y = Math.min(p.y, sea + (eagle ? 1000 : 300)); p.v = (p.v ?? p.sp) + ((p.afloat ? 0.8 : p.sp) - (p.v ?? p.sp)) * Math.min(1, dt * 1.5);
        const nx = p.x + Math.cos(p.hd) * p.v * dt, nz = p.z - Math.sin(p.hd) * p.v * dt; if (Math.abs(nx) < T.sx / 2 - 100 && Math.abs(nz) < T.sz / 2 - 100) { p.x = nx; p.z = nz; }
        p.y = Math.max(p.y, meshY(p.x, p.z) + (p.afloat ? 0.25 : eagle ? 0.9 : 1.2), p.afloat ? -1e9 : p.fl - (p.fl > sea + 10 ? 5 : 0));       // over the bush it is held above the treetops
        flap = c.climb > 0.1 || p.y < sea + 3;
      } else {                          // on its own: a wide circle off the shore, in line astern, rising and falling a little
        p.afloat = false; p.v = (p.v ?? p.sp) + (p.sp - (p.v ?? p.sp)) * (1 - Math.exp(-dt * 1.2)); p.ang += p.way * p.v / p.rad * dt;       // left to itself on the water, it gathers way and lifts off; it does not leap to full speed
        const tx = p.home[0] + Math.cos(p.ang) * p.rad, tz = p.home[1] + Math.sin(p.ang) * p.rad * (p.round ? 1 : 1.6), want = Math.atan2(-(tz - p.z), tx - p.x);
        let d = want - p.hd; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); const turn = clamp(d, -dt * 0.9, dt * 0.9); p.hd += turn; bank = -turn / Math.max(dt, 1e-3) * 0.5;
        p.x += Math.cos(p.hd) * p.v * dt; p.z -= Math.sin(p.hd) * p.v * dt;
        // a pelican keeps its height; a sea eagle rides the rising air up in its circles until it is a speck, then slides all the way down again to treetop height
        // (heights are above whatever is below: the sea, the sand, or the treetops). Pelicans mostly skim the water but go up every so often too.
        const swing = 0.5 - 0.5 * Math.cos(t * 0.045 + p.ph), up = Math.max(0, Math.sin(t * 0.027 + p.ph * 2));
        const goalAlt = p.kind === 'eagle' ? 18 + p.alt * 3.2 * swing * swing : p.alt + Math.sin(t * 0.13 + p.ph) * 2.5 + 55 * up * up * up;
        const goal = p.fl + goalAlt; p.vy = (p.vy ?? 0) + (clamp((goal - p.y) * 0.3, -6, 14) - (p.vy ?? 0)) * (1 - Math.exp(-dt * 1.0)); p.y += p.vy * dt;
        p.y = Math.max(p.y, flNow - 5);
        flap = Math.sin(t * 0.21 + p.ph * 3) > p.beats;     // beats in bursts, glides between (an eagle hardly beats at all)
      }
      p.beat = (p.beat ?? 0) + ((flap ? 1 : 0) - (p.beat ?? 0)) * Math.min(1, dt * 2.5);
      const w = p.afloat ? 1.25 : 0.1 + p.beat * Math.sin(t * p.rate + p.ph) * p.sweep + (1 - p.beat) * p.glide;      // wings folded to the body, beating, or held out in the glide
      p.fold = (p.fold ?? 0) + ((p.afloat ? 1 : 0) - (p.fold ?? 0)) * Math.min(1, dt * 3);
      p.wl.rotation.set(-w * (1 - p.fold) - 0.2 * p.fold, -1.25 * p.fold, 0); p.wr.rotation.set(w * (1 - p.fold) + 0.2 * p.fold, 1.25 * p.fold, 0);
      p.m.position.set(p.x, p.y + (p.afloat ? 0 : p.beat * Math.sin(t * p.rate + p.ph + 1.2) * 0.06), p.z);
      p.roll = (p.roll ?? 0) + (bank - (p.roll ?? 0)) * Math.min(1, dt * 3);
      p.nose = (p.nose ?? 0) + ((p.afloat ? 0 : p.ctl ? p.ctl.climb * 0.18 : clamp((p.vy ?? 0) * 0.04, -0.2, 0.2)) - (p.nose ?? 0)) * (1 - Math.exp(-dt * 3));      // nose up in the climb, down in the slide
      p.m.rotation.set(p.roll, p.hd, p.nose);
      { // the shadow falls where the sun puts it: straight below at noon, well off to one side when the sun is low; it fades out as the bird climbs
        const L = U.uLightDir.value, gy0 = Math.max(sea, meshY(p.x, p.z)), hgt = p.y - gy0, k = L.y > 0.12 ? hgt / L.y : 0, sx = p.x - L.x * k, sz = p.z - L.z * k, gy = Math.max(sea, meshY(sx, sz));
        const show = L.y > 0.12 && hgt < 160 && p.m.visible !== false; p.sh.visible = show;
        if (show) { const f = 1 + hgt * 0.012, a = Math.max(0.15, 1 - hgt / 160); p.sh.position.set(sx, gy + 0.12, sz); p.sh.rotation.y = p.hd; p.sh.scale.set(1.3 * f * a, 1, p.span * f * a); } }
    }
  };
}

export function buildLife(scene, F) {
  const lights = makeLights(64); scene.add(lights.pts); lights.pts.material.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2);
  const near = [...buildBeachLife(scene), buildInsects(scene), buildDragonflies(scene), buildGnats(scene), buildWallabies(scene), ...buildLizards(scene), buildSnags(scene), buildCreeper(scene)];
  const cars = buildCars(scene, F, lights), snork = buildSnorkelers(scene, F), birds = buildBirds(scene, F);
  const pelicans = buildPelicans(scene, F);
  buildSeaLife(scene, F);
  return {
    update(dt, t, target, camDist) {
      for (const s of near) { s.m.visible = camDist < s.range; if (s.m.visible) s.set(target.x, target.z); }
      cars(dt); snork(dt, t); birds(dt, target); pelicans(dt, t);
      { // which cars' headlamps light the ground: the eight nearest to the view that are under way, once it is getting dark
        const L = U.uCarL.value, dark = U.uNight.value > 0.2, list = dark ? rideable.filter(c => !c.parked || c.drive).map(c => [c, (c.m.position.x - target.x) ** 2 + (c.m.position.z - target.z) ** 2]).sort((a, b) => a[1] - b[1]) : [];
        for (let i = 0; i < 8; i++) { const c = list[i] && list[i][0]; if (!c) { L[i].set(0, 0, 0, 0); continue; } const yaw = c.m.rotation.y, fx = Math.cos(yaw), fz = -Math.sin(yaw); L[i].set(c.m.position.x + fx * 3.4, c.m.position.z + fz * 3.4, fx, fz); } }
    },
  };
}

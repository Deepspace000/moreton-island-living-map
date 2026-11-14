// Life on and around the island: shells, sea stars and driftwood on the beaches, 4WDs on the beach
// highway, snorkelers at the wrecks, fish, turtles and stingrays under the water, seabirds, raptors,
// shorebirds and butterflies. Small things are grown by the GPU in a grid that follows the viewer;
// animals that swim or fly are instanced and animated in their vertex shaders.
import * as THREE from 'three';
import { U, VEX, MOBILE, LOW, makeMat, objectMat, LOGV, LOGF, rng, clamp } from './common.js';
import { T, meshY, heightAt, maskAt } from './terrain.js';
import { waveAt } from './water.js';
import { GB, makeLights } from './geo.js';

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
        vec3 mk = texture2D(uMask, uv).rgb; float hgt = texture2D(uHeight, uv).r;
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
  const wood = scatter(scene, LOW ? 48 : 72, 3.4, (g) => {
    const pos = [], k = [], idx = [], S = 6, RN = 4;
    for (let r = 0; r <= RN; r++) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2; pos.push(r / RN - 0.5, Math.cos(a), Math.sin(a)); k.push(r); }
    for (let r = 0; r < RN; r++) for (let i = 0; i < S; i++) { const j = (i + 1) % S, q = r * S; idx.push(q + i, q + S + i, q + j, q + j, q + S + i, q + S + j); }
    attr(g, 'position', pos, 3); attr(g, 'aK', k, 1); g.setIndex(idx);
  }, /* glsl */`
        float line = smoothstep(0.7, 1.1, hgt) * (1.0 - smoothstep(2.5, 3.6, hgt));                  // where the last high tide left things
        float logK = step(h3, 0.016), stick = (1.0 - logK) * step(h3, 0.10);
        float len = logK > 0.5 ? 2.4 + 3.4 * h1 : 0.45 + 1.1 * h1, rad = logK > 0.5 ? 0.11 + 0.12 * h2 : 0.012 + 0.02 * h2;
        float taper = 1.0 - 0.45 * (position.x + 0.5), crook = sin((position.x + 0.5) * 3.1416) * (h2 - 0.5) * 0.22;
        s = (logK + stick) * sandy * line;
        lp = vec3(position.x * len, (position.y * taper + 0.75) * rad, position.z * rad * taper + crook * len);
        nrm = vec3(0.0, position.y, position.z);
        float grain = texture2D(uNoise, vec2(position.x * len * 0.35 + h1, aK * 0.07 + h2 + atan(position.z, position.y) * 0.4)).r;
        c = mix(vec3(0.58, 0.54, 0.48), vec3(0.34, 0.27, 0.20), smoothstep(0.35, 0.8, h4)) * (0.65 + 0.6 * grain);`, 420);
  return [shells, wood];
}

// ---------------------------------------------------------------- 4WDs on the beach
const GLASS = [.06, .09, .13], TYRE = [.07, .07, .075], DARK = [.13, .13, .14];
function fourWD(col) {
  const g = new GB(), M = new THREE.Matrix4();
  g.box(0, 0.42, 0, 4.7, 0.72, 1.86, col);                                   // body
  g.box(-0.55, 1.14, 0, 3.0, 0.72, 1.72, col); g.box(-0.55, 1.22, 0, 3.04, 0.48, 1.76, GLASS);     // cabin and windows
  g.box(-0.55, 1.86, 0, 2.3, 0.07, 1.5, DARK); g.box(-0.9, 1.93, 0, 1.3, 0.28, 1.2, [.25, .33, .42]);   // roof rack with a swag
  g.box(2.43, 0.4, 0, 0.1, 0.55, 1.75, DARK);                                // bull bar
  g.box(2.36, 0.82, 0.62, 0.05, 0.16, 0.3, [.95, .93, .8]); g.box(2.36, 0.82, -0.62, 0.05, 0.16, 0.3, [.95, .93, .8]);
  g.box(-2.36, 0.85, 0.7, 0.05, 0.2, 0.25, [.7, .08, .06]); g.box(-2.36, 0.85, -0.7, 0.05, 0.2, 0.25, [.7, .08, .06]);
  for (const x of [1.5, -1.55]) for (const z of [-0.98, 0.72]) { g.at(M.clone().makeRotationX(Math.PI / 2).setPosition(x, 0.44, z)); g.cyl(0, 0, 0, 0.45, 0.45, 0.28, 10, TYRE, TYRE); }
  g.at(M.clone().makeRotationZ(Math.PI / 2).setPosition(-2.4, 1.0, 0)); g.cyl(0, 0, 0, 0.42, 0.42, 0.24, 10, TYRE, TYRE);     // spare wheel on the back
  g.at(null);
  return g.build();
}
function buildCars(scene, F, lights) {
  const routes = (F.beach || []).filter(r => r.p.length > 30);
  if (!routes.length) return () => {};
  const R = rng(4004), S = 1.45, mat = objectMat({ side: THREE.DoubleSide });
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
  return (dt) => {
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
    }
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

// ---------------------------------------------------------------- fish, turtles and stingrays
// Each animal swims a wobbly loop around a home point. list: [cx, cz, radius, depth, phase, speed, size, seed] per animal.
function swimmers(scene, o, list) {
  const g = new THREE.InstancedBufferGeometry(), n = list.length / 8, a = new Float32Array(n * 4), b = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a.set(list.slice(i * 8, i * 8 + 4), i * 4); b.set(list.slice(i * 8 + 4, i * 8 + 8), i * 4); }
  attr(g, 'position', o.pos, 3); attr(g, 'aFlex', o.flex, 1); attr(g, 'aTone', o.tone, 1); g.setIndex(o.idx);
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(b, 4)); g.instanceCount = n; g.boundingSphere = FAR;
  const mat = makeMat({
    side: THREE.DoubleSide,
    uniforms: { uFlap: { value: new THREE.Vector4(o.vertical ? 1 : 0, o.amp, o.rate, o.bottom ? 1 : 0) }, uColA: { value: new THREE.Vector3(...o.colA) }, uColB: { value: new THREE.Vector3(...o.colB) }, uSee: { value: o.see } },
    vs: /* glsl */`
      attribute float aFlex, aTone; attribute vec4 iA, iB; uniform vec4 uFlap; uniform vec3 uColA, uColB; uniform float uSee; varying vec3 vCol, vW;
      ${WATER_GLSL}
      void main(){
        float way = iB.w < 0.5 ? 1.0 : -1.0, ang = iB.x + uTime * iB.y / iA.z * way, wob = ang * 3.0 + iB.w * 9.0;
        float rr = iA.z * (1.0 + 0.25 * sin(wob));
        vec2 c = iA.xy + vec2(cos(ang), sin(ang)) * rr;
        vec2 fwd = normalize(vec2(-sin(ang), cos(ang)) * rr + vec2(cos(ang), sin(ang)) * iA.z * 0.75 * cos(wob)) * way, right = vec2(-fwd.y, fwd.x);
        float sea = uSeaM * uVex, bed = groundY(c), size = iB.z;
        float y = uFlap.w > 0.5 ? bed + 0.1 * size : max(bed + 0.45 * size, sea - iA.w * uVex);
        float ok = step(bed, sea - (uFlap.w > 0.5 ? 0.3 : 0.9) * uVex) * (1.0 - smoothstep(uSee * 0.7, uSee, length(vec3(c.x, y, c.y) - cameraPosition)));
        vec3 lp = position * size;
        float beat = sin(uTime * uFlap.z * (0.8 + 0.4 * iB.w) + iB.x * 7.0 + (uFlap.x > 0.5 ? -abs(position.z) * 3.0 : position.x * 5.0)) * aFlex * uFlap.y * size;
        if(uFlap.x > 0.5) lp.y += beat; else lp.z += beat;
        vec3 wp = vec3(c.x, y, c.y) + vec3(fwd.x, 0.0, fwd.y) * lp.x + vec3(0.0, 1.0, 0.0) * lp.y + vec3(right.x, 0.0, right.y) * lp.z;
        vec3 col = mix(uColA, uColB, aTone) * (0.8 + 0.4 * fract(iB.w * 7.3));
        col *= uLightCol * (0.25 + 0.6 * max(uLightDir.y, 0.0)) * cloudShadow(wp) * (0.6 + 0.4 * step(0.0, position.y)) + uAmbSky;
        vCol = throughWater(col, wp); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: LIT_FS,
  });
  const m = new THREE.Mesh(g, mat); m.name = o.name; m.frustumCulled = false; scene.add(m);
}
// shapes: x is forward, y up, z to the side; flex says how much a point takes part in the swimming beat; tone picks between two colours
const FISH = (() => {
  const pos = [0.5, 0, 0, 0.12, 0.2, 0, 0.12, -0.18, 0, 0.12, 0, 0.07, 0.12, 0, -0.07, -0.3, 0, 0, -0.5, 0.2, 0, -0.5, -0.2, 0];
  return { pos, flex: [0, 0.1, 0.1, 0.1, 0.1, 0.7, 1, 1], tone: [0, 0, 1, 0.5, 0.5, 0.3, 1, 1], idx: [0, 1, 3, 0, 3, 2, 1, 5, 3, 2, 3, 5, 0, 4, 1, 0, 2, 4, 1, 4, 5, 2, 5, 4, 5, 6, 7] };
})();
const TURTLE = (() => {
  const pos = [0, 0.17, 0, 0, -0.07, 0], flex = [0, 0], tone = [0, 1], idx = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; pos.push(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.4); flex.push(0); tone.push(0.25); }
  for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; idx.push(0, 2 + j, 2 + i, 1, 2 + i, 2 + j); }
  const tri = (p, f) => { const k = pos.length / 3; pos.push(...p); flex.push(...f); tone.push(0.6, 0.6, 0.6); idx.push(k, k + 1, k + 2); };
  tri([0.48, 0.02, 0.08, 0.48, 0.02, -0.08, 0.74, 0.04, 0], [0, 0, 0]);                                     // head
  for (const s of [-1, 1]) { tri([0.36, 0, 0.3 * s, 0.14, 0, 0.36 * s, -0.05, 0, 1.0 * s], [0, 0, 1]); tri([-0.36, 0, 0.26 * s, -0.46, 0, 0.12 * s, -0.72, 0, 0.36 * s], [0, 0, 0.35]); }   // flippers
  return { pos, flex, tone, idx };
})();
const RAY = (() => {
  const pos = [0.08, 0.07, 0, 0.5, 0, 0, 0, 0, 0.62, -0.36, 0, 0, 0, 0, -0.62, -1.25, 0, 0, -0.36, 0, 0.03, -0.36, 0, -0.03];
  return { pos, flex: [0, 0, 1, 0, 1, 0.2, 0, 0], tone: [0, 0.2, 0.5, 0.2, 0.5, 1, 1, 1], idx: [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 5, 6, 7] };
})();
function buildSeaLife(scene, F) {
  const R = rng(5150), depth = (x, z) => U.uSeaM.value - heightAt(x, z), K = MOBILE ? 0.6 : 1;
  // a spot of water of the wanted depth near a point
  const spot = (cx, cz, rad, d0, d1) => { for (let t = 0; t < 40; t++) { const a = R() * 6.283, r = Math.sqrt(R()) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (Math.abs(x) < T.sx / 2 - 300 && Math.abs(z) < T.sz / 2 - 300) { const d = depth(x, z); if (d > d0 && d < d1) return [x, z, d]; } } return null; };
  const school = (out, x, z, d, n, r0, size) => { const ph = R() * 6.283, sp = 0.5 + R() * 0.5, way = R() < 0.5 ? 0.2 : 0.8; for (let i = 0; i < n; i++) out.push(x + (R() - .5) * 3, z + (R() - .5) * 3, r0 + R() * 2.5, Math.min(d - 0.5, 0.45 + R() * 1.3), ph + i * 0.11 + R() * 0.2, sp, size * (0.8 + R() * 0.4), way + R() * 0.15); };
  const bream = [], stripey = [], blue = [], turtles = [], rays = [];
  const tg = F.places.find(p => /^Tangalooma/.test(p.n || ''))?.p || [-1744, -540];
  // every wreck is a reef: striped sergeants close in, a cloud of small blue-green fish over the hull, bream and trevally circling wider
  for (const w of F.wrecks) {
    const d = Math.max(depth(w.c[0], w.c[1]), 2.2); if (depth(w.c[0], w.c[1]) < 0.6) continue;
    school(stripey, w.c[0], w.c[1], d, Math.round(18 * K), 5 + R() * 5, 0.8); school(stripey, w.c[0] + (R() - .5) * 20, w.c[1] + (R() - .5) * 20, d, Math.round(10 * K), 9 + R() * 6, 0.8);
    school(blue, w.c[0], w.c[1], d, Math.round(26 * K), 3 + R() * 4, 0.5); school(blue, w.c[0] + (R() - .5) * 24, w.c[1] + (R() - .5) * 24, d, Math.round(16 * K), 6 + R() * 5, 0.5);
    school(bream, w.c[0] + 8, w.c[1], d, Math.round(14 * K), 12 + R() * 9, 1.15);
  }
  for (let i = 0; i < 26 * K; i++) { const s = spot(tg[0] - 250, tg[1] - 600, 1900, 1.5, 6); if (s) school(i % 2 ? bream : stripey, s[0], s[1], s[2], 9, 5 + R() * 9, i % 2 ? 0.95 : 0.7); }
  const coast = (n, rad, d0, d1, f) => { for (let i = 0; i < n; i++) { const z = (R() - 0.5) * T.sz * 0.8; let x = -T.sx / 2 + 400; while (x < T.sx / 2 && depth(x, z) > 0.2) x += 40; const s = spot(i % 3 === 0 ? tg[0] - 300 : x - rad * 0.6, i % 3 === 0 ? tg[1] - 800 + (R() - .5) * 2600 : z, rad, d0, d1); if (s) f(s); } };
  coast(60 * K, 900, 1.6, 7, (s) => turtles.push(s[0], s[1], 12 + R() * 24, 0.5 + R() * 1.3, R() * 6.283, 0.45 + R() * 0.35, 1.3 + R() * 0.6, R()));     // green turtles over the seagrass on the bay side
  coast(110 * K, 500, 0.45, 1.7, (s) => rays.push(s[0], s[1], 5 + R() * 12, 0, R() * 6.283, 0.3 + R() * 0.35, 1.0 + R() * 0.7, R()));                 // stingrays gliding over the sand in the shallows
  swimmers(scene, { ...FISH, name: 'bream', amp: 0.16, rate: 9, colA: [0.62, 0.66, 0.68], colB: [0.86, 0.88, 0.86], see: 420 }, bream);
  swimmers(scene, { ...FISH, name: 'blue', amp: 0.18, rate: 13, colA: [0.16, 0.62, 0.78], colB: [0.75, 0.9, 0.5], see: 300 }, blue);
  swimmers(scene, { ...FISH, name: 'stripey', amp: 0.16, rate: 11, colA: [0.92, 0.78, 0.16], colB: [0.12, 0.13, 0.16], see: 420 }, stripey);
  swimmers(scene, { ...TURTLE, name: 'turtles', vertical: 1, amp: 0.22, rate: 1.8, colA: [0.30, 0.27, 0.16], colB: [0.62, 0.58, 0.42], see: 1100 }, turtles);
  swimmers(scene, { ...RAY, name: 'rays', vertical: 1, bottom: 1, amp: 0.13, rate: 2.2, colA: [0.36, 0.31, 0.24], colB: [0.22, 0.19, 0.16], see: 900 }, rays);
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
  const afloat = (g, spots, per) => {
    const geo2 = g.build(), fg = new THREE.InstancedBufferGeometry(), ip = [];
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
        vec3 lp = position * 1.6;
        vec3 wp = vec3(c.x + fwd.x * lp.x - fwd.y * lp.z, uSeaM * uVex + lp.y + sin(uTime * 1.3 + iP.w * 30.0) * 0.06, c.y + fwd.y * lp.x + fwd.x * lp.z);
        float ok = step(groundY(c), uSeaM * uVex - 0.5) * (1.0 - smoothstep(900.0, 1200.0, length(wp - cameraPosition)));
        vCol = color * (uLightCol * (0.25 + 0.6 * max(uLightDir.y, 0.0)) * cloudShadow(wp) * (0.7 + 0.3 * normal.y) + uAmbSky); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: LIT_FS,
  });
  const tgl = F.places.find(p => /^Tangalooma/.test(p.n || ''))?.p, wrk = F.views.find(v => /Tangalooma Wrecks/.test(v.n || ''))?.c, others = F.places.filter(p => !/^Tangalooma/.test(p.n || '')).map(p => [p.p, 1]);
  const spots = [...(tgl ? [[[tgl[0] - 230, tgl[1] + 340], 3]] : []), ...(wrk ? [[[wrk[0] + 60, wrk[1]], 2]] : []), ...others];
  const pel = new GB(), PINK = [.92, .68, .6];
  pel.box(0, 0.02, 0, 0.8, 0.34, 0.42, WHITE); pel.box(-0.12, 0.3, 0, 0.5, 0.1, 0.44, BLACK); pel.box(0.34, 0.3, 0, 0.12, 0.42, 0.12, WHITE);      // body low in the water, black along the wings, neck
  pel.box(0.38, 0.66, 0, 0.2, 0.16, 0.14, WHITE); pel.box(0.7, 0.6, 0, 0.5, 0.06, 0.08, PINK); pel.box(0.66, 0.5, 0, 0.4, 0.1, 0.07, [.95, .8, .62]);         // head, long bill and pouch
  afloat(pel, spots, 3);
  const cor = new GB(), CB = [.06, .06, .07];
  cor.box(0, 0.0, 0, 0.5, 0.14, 0.2, CB); cor.box(0.24, 0.12, 0, 0.07, 0.3, 0.07, CB); cor.box(0.3, 0.4, 0, 0.14, 0.07, 0.07, CB); cor.box(0.42, 0.41, 0, 0.12, 0.03, 0.03, [.8, .65, .2]);
  afloat(cor, spots, 2);

  const f = new THREE.Vector3(); let first = true;
  return (dt, target) => {
    // the nearby flock drifts after the viewer instead of jumping
    if (first || f.distanceTo(target) > 1500) { f.copy(target); first = false; } else f.lerp(target, Math.min(1, dt * 0.5));
    uni.uFollow.value.set(f.x, Math.max(meshY(f.x, f.z), U.uSeaM.value * VEX), f.z);
  };
}

// ---------------------------------------------------------------- butterflies
function buildInsects(scene) {
  return scatter(scene, LOW ? 22 : 30, 5.5, (g) => {
    attr(g, 'position', [0, 0, 0, 0.9, 0, 1, -0.7, 0, 0.8, 0, 0, 0, -0.7, 0, -0.8, 0.9, 0, -1], 3); attr(g, 'aK', [0, 1, 1, 0, -1, -1], 1); g.setIndex([0, 1, 2, 3, 4, 5]);
  }, /* glsl */`
        // blue tigers, common crows, common browns and tiny grass-blues over the heath and forest edge, by day, out of the rain
        float veg = step(0.92, mk.r) * (1.0 - smoothstep(0.3, 0.6, mk.g)) * step(1.5, hgt) * step(h3, 0.16) * (1.0 - smoothstep(0.15, 0.5, uNight)) * (1.0 - smoothstep(0.05, 0.4, uRain));
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

export function buildLife(scene, F) {
  const lights = makeLights(64); scene.add(lights.pts); lights.pts.material.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2);
  const near = [...buildBeachLife(scene), buildInsects(scene), buildDragonflies(scene)];
  const cars = buildCars(scene, F, lights), snork = buildSnorkelers(scene, F), birds = buildBirds(scene, F);
  buildSeaLife(scene, F);
  return {
    update(dt, t, target, camDist) {
      for (const s of near) { s.m.visible = camDist < s.range; if (s.m.visible) s.set(target.x, target.z); }
      cars(dt); snork(dt, t); birds(dt, target);
    },
  };
}

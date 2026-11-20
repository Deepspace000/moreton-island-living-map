// Small life on the sea bed. Round every wreck, round the reef patches and at many spots in the shallows all round the island:
//   - rocks and pebbles, with barnacles on them and small tufts of weed; barnacles and weed on the plating of the wrecks too
//   - small pieces of coral (branching, rounded and plate), sea stars, shells and sea snails on the sand
//   - crabs that scuttle sideways and stop, and small octopuses that crawl, wave their arms and change colour
//   - schools of very small fish, close in, and stingrays over the sand beside the wrecks
// The things that do not move are one drawing per stretch of sea (so what is out of view costs nothing); crabs and octopuses are moved in the shader.
import * as THREE from 'three';
import { U, VEX, MOBILE, dq, makeMat, LOGV, LOGF, rng } from './common.js';
import { T, meshY, heightAt, maskAt } from './terrain.js';
import { swimmers, SLIM, DAMSEL, BREAM, RAY, PAINT } from './creatures.js';

const SEEN = 420;          // metres: beyond this none of it is drawn
// the colour of something under water: the red goes first, and the water's own colour comes in with depth
const WET = /* glsl */`float dw = (uSeaM * uVex - wp.y) / uVex; if(dw > 0.0){ vec3 Tm = exp(-vec3(0.42, 0.082, 0.105) * dw * 1.15);          /* (half the sea's own rate, so a sea star still reads as orange a few metres down) */ col = col * Tm + vec3(0.012, 0.20, 0.18) * (uLightCol * 0.3 + uAmbSky * 0.8) * (1.0 - Tm); }`;
const LIT = /* glsl */`(uLightCol * (0.25 + 0.55 * max(uLightDir.y, 0.0)) * (0.45 + 0.55 * max(dot(nn, normalize(uLightDir + vec3(0.0, 1.0, 0.0))), 0.0)) * cloudShadow(wp) + uAmbSky * 0.8)`;
const FS = /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }`;

export function buildSeabed(scene, F, o) {
  const R = rng(8088), K = MOBILE ? 0.5 : dq(0.5, 0.75, 1), depth = (x, z) => -heightAt(x, z), CH = 2600, chunks = new Map();
  const ICO1 = new THREE.IcosahedronGeometry(1, 1).attributes.position, ICO0 = new THREE.IcosahedronGeometry(1, 0).attributes.position;
  let A = null;            // the stretch of sea being added to
  const at = (x, z) => { const k = Math.floor(x / CH) + ',' + Math.floor(z / CH); A = chunks.get(k); if (!A) chunks.set(k, A = { pos: [], nrm: [], col: [], sway: [], idx: [], cx: (Math.floor(x / CH) + 0.5) * CH, cz: (Math.floor(z / CH) + 0.5) * CH }); };
  const V = (x, y, z, nx, ny, nz, c, k = 1, sw = 0) => { A.pos.push(x, y, z); A.nrm.push(nx, ny, nz); A.col.push(c[0] * k, c[1] * k, c[2] * k); A.sway.push(sw); return A.pos.length / 3 - 1; };
  const pick = (list) => list[(R() * list.length) | 0];
  // ---- rocks ----
  const lump = (nx, ny, nz, seed) => 1 + 0.16 * Math.sin(nx * 2.6 + seed) * Math.sin(ny * 2.1 + seed * 1.7) + 0.10 * Math.sin(nz * 3.4 + seed * 2.3) + 0.05 * Math.sin(nx * 7.0 + nz * 6.0 + seed);
  const onRock = (k, nx, ny, nz) => { const l = lump(nx, ny, nz, k.seed), n = Math.hypot(nx * 0.7, ny * 1.4, nz * 0.7); return [k.x + nx * k.r * l, k.y + (ny * 0.5 + 0.2) * k.r * l, k.z + nz * k.r * l * k.zs, nx * 0.7 / n, ny * 1.4 / n, nz * 0.7 / n]; };
  const rock = (x, z, r, tone) => {
    const k = { x, z, r, y: meshY(x, z) - r * 0.15, seed: R() * 20, zs: 0.8 + 0.4 * R() }, ico = r > 0.13 ? ICO1 : ICO0, b = A.pos.length / 3;
    for (let i = 0; i < ico.count; i++) { const nx = ico.getX(i), ny = ico.getY(i), nz = ico.getZ(i), p = onRock(k, nx, ny, nz), top = Math.max(0, ny), m = 0.8 + 0.2 * Math.sin(nx * 5 + k.seed * 3) * Math.sin(nz * 4 + k.seed);
      V(p[0], p[1], p[2], p[3], p[4], p[5], [(tone[0] + 0.02 * top) * m, (tone[1] + 0.1 * top) * m, (tone[2] + 0.02 * top) * m]); A.idx.push(b + i); }
    return k;
  };
  // ---- barnacles: a low cone with a dark mouth, standing off whatever it grows on ----
  const barnacle = (p, s) => {
    const n = [p[3], p[4], p[5]], ref = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let t1 = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]]; const l1 = Math.hypot(...t1) || 1; t1 = t1.map(v => v / l1);
    const t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]], c = [0.74 + R() * 0.14, 0.72 + R() * 0.12, 0.64 + R() * 0.12], b = A.pos.length / 3, N = 5, h = s * (0.55 + R() * 0.4);
    for (let i = 0; i < N; i++) { const a = i / N * 6.2832 + R() * 0.3, ca = Math.cos(a), sa = Math.sin(a), dx = t1[0] * ca + t2[0] * sa, dy = t1[1] * ca + t2[1] * sa, dz = t1[2] * ca + t2[2] * sa;
      V(p[0] + dx * s, p[1] + dy * s, p[2] + dz * s, dx * 0.8 + n[0] * 0.6, dy * 0.8 + n[1] * 0.6, dz * 0.8 + n[2] * 0.6, c, 0.72);
      V(p[0] + dx * s * 0.45 + n[0] * h, p[1] + dy * s * 0.45 + n[1] * h, p[2] + dz * s * 0.45 + n[2] * h, dx * 0.5 + n[0], dy * 0.5 + n[1], dz * 0.5 + n[2], c, 1.05); }
    const mid = V(p[0] + n[0] * h * 0.6, p[1] + n[1] * h * 0.6, p[2] + n[2] * h * 0.6, n[0], n[1], n[2], [0.12, 0.1, 0.09]);
    for (let i = 0; i < N; i++) { const q = b + i * 2, q2 = b + ((i + 1) % N) * 2; A.idx.push(q, q + 1, q2, q2, q + 1, q2 + 1, q + 1, mid, q2 + 1); }
  };
  const crust = (surf, n, s0) => { for (let i = 0; i < n; i++) { const p = surf(i); if (p) barnacle(p, s0 * (0.6 + R() * 0.8)); } };
  // ---- a small tuft of weed: a few ribbons from one hold, leaning the way the thing it grows on faces ----
  const WEEDS = [[0.46, 0.33, 0.11], [0.14, 0.38, 0.14], [0.22, 0.52, 0.18], [0.5, 0.14, 0.16], [0.3, 0.42, 0.1]];
  const tuft = (x, y, z, h, ox = 0, oz = 0) => {
    const c = pick(WEEDS), N = 3;
    for (let f = 0, fr = 2 + ((R() * 3) | 0); f < fr; f++) {
      const b = A.pos.length / 3, a = R() * 6.283, out = (0.2 + R() * 0.5) * h, w = 0.02 + R() * 0.035, fh = h * (0.6 + R() * 0.5), tw = R() * 6.283, sh = 0.75 + R() * 0.4;
      for (let j = 0; j <= N; j++) { const u = j / N, ww = w * Math.sin(Math.min(1, u * 1.1 + 0.15) * Math.PI) ** 0.6, d = out * u * u, px = x + Math.cos(a) * d + ox * u * h * 0.7, pz = z + Math.sin(a) * d + oz * u * h * 0.7, yy = y + fh * (u - 0.2 * u * u), ta = tw + u * 1.4;
        for (const sd of [-1, 1]) V(px + Math.cos(ta) * ww * sd, yy, pz + Math.sin(ta) * ww * sd, 0, 1, 0, c, sh * (0.6 + 0.6 * u), u * u * fh);
        if (j) { const q = b + j * 2; A.idx.push(q - 2, q - 1, q, q, q - 1, q + 1); } }
    }
  };
  // ---- sea stars, shells and snails on the sand ----
  const STARS = [[0.95, 0.45, 0.12], [0.75, 0.13, 0.1], [0.16, 0.3, 0.78], [0.86, 0.74, 0.52], [0.55, 0.25, 0.6], [0.9, 0.62, 0.2]];
  const star = (x, z, r) => {
    const y = meshY(x, z) + 0.015, c = pick(STARS), a0 = R() * 6.283, b = A.pos.length / 3, arms = R() < 0.92 ? 5 : 6; V(x, y + r * 0.22, z, 0, 1, 0, c, 1.1);
    for (let i = 0; i < arms * 2; i++) { const a = a0 + i / (arms * 2) * 6.2832, rr = i % 2 ? r * 0.3 : r * (0.9 + R() * 0.2); V(x + Math.cos(a) * rr, y + (i % 2 ? r * 0.06 : 0), z + Math.sin(a) * rr, Math.cos(a) * 0.4, 0.9, Math.sin(a) * 0.4, c, i % 2 ? 0.8 : 0.95); A.idx.push(b, b + 1 + i, b + 1 + (i + 1) % (arms * 2)); }
  };
  const SHELLS = [[0.92, 0.86, 0.76], [0.9, 0.66, 0.56], [0.86, 0.72, 0.5], [0.6, 0.52, 0.56], [0.95, 0.93, 0.9]];
  const shell = (x, z, s) => {
    const y = meshY(x, z) + 0.01, c = pick(SHELLS), a0 = R() * 6.283, b = A.pos.length / 3;
    if (R() < 0.55) {            // a scallop or cockle: a ribbed fan, a little domed
      V(x, y + s * 0.05, z, 0, 1, 0, c, 0.8); const N = 8;
      for (let i = 0; i <= N; i++) { const a = a0 + (i / N - 0.5) * 2.5, e = i % 2 ? 1 : 0.93; V(x + Math.cos(a) * s * e, y + s * 0.04, z + Math.sin(a) * s * e, Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3, c, i % 2 ? 1.05 : 0.8); if (i) A.idx.push(b, b + i, b + i + 1); }
      const m = V(x + Math.cos(a0) * s * 0.45, y + s * 0.3, z + Math.sin(a0) * s * 0.45, 0, 1, 0, c, 1.1); for (let i = 1; i <= N; i++) A.idx.push(m, b + i, b + i + 1);
    } else {                     // a whelk or cone shell lying on its side: a spire tapering to a point
      const dx = Math.cos(a0), dz = Math.sin(a0), N = 6, r = s * 0.42;
      for (let i = 0; i < N; i++) { const a = i / N * 6.2832, ca = Math.cos(a), sa = Math.sin(a); V(x - dz * ca * r, y + r + sa * r, z + dx * ca * r, -dz * ca, sa, dx * ca, c, i % 2 ? 1 : 0.75); }
      const tip = V(x + dx * s * 1.5, y + r * 0.5, z + dz * s * 1.5, dx, 0.3, dz, c, 1.1), mouth = V(x - dx * s * 0.3, y + r, z - dz * s * 0.3, -dx, 0, -dz, c, 0.5);
      for (let i = 0; i < N; i++) A.idx.push(b + i, b + (i + 1) % N, tip, b + (i + 1) % N, b + i, mouth);
    }
  };
  const SNAILS = [[0.5, 0.4, 0.28], [0.72, 0.66, 0.5], [0.3, 0.26, 0.22], [0.62, 0.36, 0.2]];
  const snail = (x, y, z, s) => {            // a turban shell: a coiled dome in bands, with the animal's foot showing under it
    const c = pick(SNAILS), a0 = R() * 6.283, b = A.pos.length / 3, N = 7, RG = 3;
    for (let k = 0; k <= RG; k++) for (let i = 0; i < N; i++) { const e = k / RG * 1.45, a = a0 + i / N * 6.2832 + k * 0.5, rr = s * Math.cos(e) * (k ? 1 : 1.12), yy = y + s * 1.1 * Math.sin(e) + (k ? 0 : 0.005);
      V(x + Math.cos(a) * rr + Math.cos(a0) * s * 0.18 * k / RG, yy, z + Math.sin(a) * rr + Math.sin(a0) * s * 0.18 * k / RG, Math.cos(a) * Math.cos(e), Math.sin(e) + 0.2, Math.sin(a) * Math.cos(e), k ? c : [0.75, 0.7, 0.6], k % 2 ? 1.1 : 0.7);
      if (k) { const q = b + (k - 1) * N, i2 = (i + 1) % N; A.idx.push(q + i, q + N + i, q + i2, q + i2, q + N + i, q + N + i2); } }
  };
  // ---- small pieces of coral ----
  const CORALS = [[0.72, 0.6, 0.42], [0.6, 0.48, 0.75], [0.86, 0.5, 0.56], [0.45, 0.62, 0.8], [0.7, 0.72, 0.3], [0.8, 0.42, 0.25], [0.5, 0.7, 0.55]];
  const branch = (p, d, len, r, deep, c) => {            // a four-sided stem, forking as it goes, paler at the tips
    const e = [p[0] + d[0] * len, p[1] + d[1] * len * VEX * 0.75, p[2] + d[2] * len], b = A.pos.length / 3, S = 4, k0 = deep ? 0.75 : 0.9, k1 = deep ? 0.95 : 1.35;
    for (const [q, rr, k] of [[p, r, k0], [e, r * 0.6, k1]]) for (let i = 0; i < S; i++) { const a = i / S * 6.2832; V(q[0] + Math.cos(a) * rr, q[1], q[2] + Math.sin(a) * rr, Math.cos(a), 0.5, Math.sin(a), c, k); }
    for (let i = 0; i < S; i++) { const i2 = (i + 1) % S; A.idx.push(b + i, b + S + i, b + i2, b + i2, b + S + i, b + S + i2); }
    if (deep > 0) for (let n = 0; n < 2; n++) { const a = R() * 6.283, sp = 0.55 + R() * 0.35, nd = [d[0] + Math.cos(a) * sp, d[1] + 0.25, d[2] + Math.sin(a) * sp], l = Math.hypot(...nd); branch(e, nd.map(v => v / l), len * 0.72, r * 0.62, deep - 1, c); }
    else A.idx.push(b + S, b + S + 1, b + S + 2, b + S, b + S + 2, b + S + 3);
  };
  const coral = (x, z, s) => {
    const y = meshY(x, z) - 0.02, c = pick(CORALS), kind = R();
    if (kind < 0.5) { for (let n = 0, roots = 3 + ((R() * 3) | 0); n < roots; n++) { const a = R() * 6.283, d = [Math.cos(a) * 0.45, 0.9, Math.sin(a) * 0.45], l = Math.hypot(...d); branch([x + Math.cos(a) * s * 0.15, y, z + Math.sin(a) * s * 0.15], d.map(v => v / l), s * 0.55, s * 0.085, R() < 0.25 ? 2 : 1, c); } }
    else if (kind < 0.8) {            // a rounded head, like a small brain coral
      const b = A.pos.length / 3, seed = R() * 20, sq = 0.55 + R() * 0.3;
      for (let i = 0; i < ICO1.count; i++) { const nx = ICO1.getX(i), ny = ICO1.getY(i), nz = ICO1.getZ(i), l = 1 + 0.1 * Math.sin(nx * 6 + seed) * Math.sin(nz * 5 + seed) + 0.06 * Math.sin(ny * 9 + seed); V(x + nx * s * 0.5 * l, y + (ny * sq + sq * 0.6) * s * 0.5 * l * 1.3, z + nz * s * 0.5 * l, nx, ny + 0.3, nz, c, 0.7 + 0.45 * Math.max(0, ny) + 0.12 * Math.sin(nx * 23 + nz * 19)); A.idx.push(b + i); }
    } else {                         // a plate on a short stalk
      const b = A.pos.length / 3, N = 9, h = s * (0.35 + R() * 0.3) * VEX * 0.6, tx = (R() - 0.5) * 0.3, tz = (R() - 0.5) * 0.3; V(x, y, z, 0, -1, 0, c, 0.5); V(x, y + h * 0.8, z, 0, 1, 0, c, 0.9);
      for (let i = 0; i < N; i++) { const a = i / N * 6.2832, rr = s * 0.6 * (0.85 + 0.25 * Math.sin(a * 3 + tx * 9)); V(x + Math.cos(a) * rr, y + h + (Math.cos(a) * tx + Math.sin(a) * tz) * rr, z + Math.sin(a) * rr, Math.cos(a) * 0.2, 1, Math.sin(a) * 0.2, c, 1.15); const i2 = (i + 1) % N; A.idx.push(b + 1, b + 2 + i, b + 2 + i2, b, b + 2 + i2, b + 2 + i); }
    }
  };
  // ---- the moving ones: where each lives ----
  const crabs = [], octos = [], fry = [], chromis = [], rays = [], sergeants = [], bream = [];
  const school = (out, x, z, d, n, r0, size) => { const ph = R() * 6.283, sp = 0.35 + R() * 0.4, way = R() < 0.5 ? 0.2 : 0.8; for (let i = 0; i < n; i++) out.push(x + (R() - .5) * 1.6, z + (R() - .5) * 1.6, r0 + R() * 1.2, Math.min(d - 0.25, Math.max(0.3, d - 0.3 - R() * 1.4)), ph + i * 0.07 + R() * 0.15, sp, size * (0.8 + R() * 0.4), way + R() * 0.1); };
  const ROCKS = [[0.2, 0.18, 0.15], [0.26, 0.23, 0.18], [0.16, 0.16, 0.15], [0.3, 0.25, 0.19]];
  // one place on the sea bed, rad metres across, k how much of everything; wreck: it is at a wreck (which has its own reef fish: see life.js)
  const site = (x, z, rad, k, rich, wreck = false) => {
    const spot = (r0 = 0, r1 = rad) => { for (let t = 0; t < 6; t++) { const a = R() * 6.283, r = r0 + Math.sqrt(R()) * (r1 - r0), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (Math.abs(px) < T.sx / 2 - 200 && Math.abs(pz) < T.sz / 2 - 200 && depth(px, pz) > 0.35) return [px, pz]; } return null; };
    const n = (a, b) => Math.round((a + R() * (b - a)) * k * K), tone = pick(ROCKS), rocks = [];
    for (let i = n(2, 5); i > 0; i--) { const p = spot(); if (!p) continue; at(p[0], p[1]); const rk = rock(p[0], p[1], 0.22 + R() * R() * 1.0, tone); rocks.push(rk);
      const wet = (q) => q && q[1] < 0.5 * VEX;            // barnacles and weed grow where the tide covers
      crust(() => { const a = R() * 6.283, e = 0.15 + R() * 1.2, q = onRock(rk, Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); return wet(q) ? q : null; }, Math.round((3 + R() * 6) * Math.min(2, 0.6 + rk.r)), 0.035 + rk.r * 0.03);
      for (let w = 0; w < 2 + R() * 3; w++) { const a = R() * 6.283, e = 0.5 + R() * 0.9, q = onRock(rk, Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); if (wet(q)) tuft(q[0], q[1] - 0.02, q[2], (0.14 + R() * 0.28) * VEX, q[3], q[5]); } }
    for (let i = n(4, 7); i > 0; i--) { const p = spot(); if (p) { at(p[0], p[1]); rock(p[0], p[1], 0.05 + R() * 0.08, tone); } }                    // pebbles
    for (let i = n(3, 7); i > 0; i--) { const p = spot(); if (p && depth(p[0], p[1]) > 0.8) { at(p[0], p[1]); coral(p[0], p[1], 0.16 + R() * 0.34); } }
    for (let i = n(4, 8); i > 0; i--) { const p = spot(); if (p) { at(p[0], p[1]); star(p[0], p[1], 0.06 + R() * 0.1); } }
    for (let i = n(5, 10); i > 0; i--) { const p = spot(); if (p) { at(p[0], p[1]); shell(p[0], p[1], 0.035 + R() * 0.06); } }
    for (let i = n(3, 6); i > 0; i--) { const rk = rocks.length && R() < 0.45 ? pick(rocks) : null, p = rk ? null : spot(); if (rk) { const a = R() * 6.283, q = onRock(rk, Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6); at(rk.x, rk.z); snail(q[0], q[1] - 0.01, q[2], 0.03 + R() * 0.03); } else if (p) { at(p[0], p[1]); snail(p[0], meshY(p[0], p[1]), p[1], 0.03 + R() * 0.035); } }
    for (let i = n(4, 7); i > 0; i--) { const p = spot(); if (p) { at(p[0], p[1]); tuft(p[0], meshY(p[0], p[1]) - 0.02, p[1], (0.12 + R() * 0.2) * VEX); } }
    for (let i = n(2, 4); i > 0; i--) { const p = spot(); if (p) crabs.push(p[0], p[1], R() * 6.283, 0.09 + R() * 0.11, R() * 6.283, 0.5 + R() * 1.6, 0.25 + R() * 0.35, R()); }
    if (R() < 0.45 * k) { const rk = rocks.length ? pick(rocks) : null, p = rk ? [rk.x + rk.r * 1.5 + 0.6, rk.z + rk.r * 0.5] : spot(); if (p && depth(p[0], p[1]) > 0.7) octos.push(p[0], p[1], R() * 6.283, 0.3 + R() * 0.2, R() * 6.283, 0.25 + R() * 0.35, 0.6 + R() * 0.8, R()); }          // beside its rock, never far from it
    for (let i = rich ? 2 : R() < 0.3 * k ? 1 : 0; i > 0; i--) { const p = spot(0, rad * 0.8); if (!p) continue; const d = depth(p[0], p[1]); if (d < 0.7) continue; school(R() < 0.6 ? fry : chromis, p[0], p[1], d, Math.round((10 + R() * 10) * K), 0.8 + R() * 1.6, 0.09 + R() * 0.06); }
    // away from the wrecks, reef fish round the rocks too: a school of sergeant majors close over them, and a few bream cruising wider
    if (!wreck) { const p = spot(0, rad * 0.7), d = p ? depth(p[0], p[1]) : 0;
      if (p && d > 1.0 && (rich || R() < 0.6)) school(sergeants, p[0], p[1], d, Math.round((6 + R() * 9) * (rich ? 1.6 : 1) * K), 1.5 + R() * 2.5, 0.7);
      if (p && d > 1.2 && (rich || R() < 0.35)) school(bream, p[0] + (R() - 0.5) * rad, p[1] + (R() - 0.5) * rad, d, Math.round((3 + R() * 5) * K), 4 + R() * 5, 1.0); }
    if (rich || R() < 0.2) for (let i = rich ? 2 : 1; i > 0; i--) { const p = spot(rad * 0.5, rad * 1.6); if (p && depth(p[0], p[1]) > 0.6) rays.push(p[0], p[1], 4 + R() * 9, 0, R() * 6.283, 0.25 + R() * 0.3, 0.7 + R() * 0.7, R()); }
  };
  // ---- the wrecks: barnacles and weed on the plating between the sea bed and the high-water mark, and a rich patch of bed round each ----
  for (const w of o.wrecks || []) {
    if (w.hull) { at(w.x, w.z);
      const surf = () => { const q = w.hull(0.03 + R() * 0.94, 0.04 + R() * 0.56, R() < 0.5 ? -1 : 1);          /* (never up into the top third of the side, which the rust eats away unevenly: see RUST in common.js) */ return q[1] < 0.55 * VEX ? [q[0] + q[3] * 0.02, q[1], q[2] + q[4] * 0.02, q[3], 0.15, q[4]] : null; };
      for (let c = Math.round(55 * K); c > 0; c--) { const p0 = surf(); if (!p0) continue; barnacle(p0, 0.05 + R() * 0.05); for (let j = 3 + ((R() * 6) | 0); j > 0; j--) barnacle([p0[0] - p0[5] * (R() - 0.5) * 0.5, p0[1] + (R() - 0.5) * 0.4, p0[2] + p0[3] * (R() - 0.5) * 0.5, p0[3], p0[4], p0[5]], 0.03 + R() * 0.05); }
      for (let c = Math.round(60 * K); c > 0; c--) { const q = surf(); if (q && q[1] < 0.15 * VEX) tuft(q[0], q[1], q[2], (0.15 + R() * 0.35) * VEX, q[3] * 0.9, q[5] * 0.9); } }
    if (depth(w.x, w.z) > 0.2) for (const u of [0.2, 0.8]) { const q = w.hull ? w.hull(u, 0, 1) : [w.x, 0, w.z]; site(q[0], q[2], 10, 1.7, true, true); }          // close in, at each end of the hull
  }
  // The Bulwer hulks: barnacles and weed only on the panels of plating that still stand (features.js lists them), between the sand and the
  // high-water mark, on the outer face or the inner. Where the plating has rusted away there is nothing for them to grow on.
  const plates = o.plates || [];
  const onPlate = (pl, inner) => {          // a point on a panel's face, under water at high tide and above the sand, and the way the face looks there
    const { a, b, lo, th } = pl, f = R(), x0 = a.x + (b.x - a.x) * f, z0 = a.z + (b.z - a.z) * f, t = a.t + (b.t - a.t) * f;
    let nx = a.nx + (b.nx - a.nx) * f, nz = a.nz + (b.nz - a.nz) * f; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;          // (into the hull)
    const gy = meshY(x0 + nx * 0.25, z0 + nz * 0.25), y0 = Math.max(gy + 0.04, lo), y1 = Math.min(t - 0.15, 0.55 * VEX);
    if (y1 <= y0) return null;
    const y = y0 + R() * (y1 - y0), k = (y - lo) / (t - lo), inset = 0.5 * (1 - k) + (inner ? th + 0.015 : -0.015), sd = inner ? 1 : -1;
    return [x0 + nx * inset, y, z0 + nz * inset, nx * sd, 0.15, nz * sd, gy];
  };
  const shipBy = new Map();          // which hull each panel belongs to, for a rich patch of sea bed round each hull
  for (const b of F.buildings) { if (b.k !== 'ship' || b.p.length < 3) continue; let mx = 0, mz = 0; for (const p of b.p) { mx += p[0] / b.p.length; mz += p[1] / b.p.length; } shipBy.set(b, [mx, mz]); }
  if (plates.length) for (let c = Math.round(110 * K * shipBy.size); c > 0; c--) {
    const pl = plates[(R() * plates.length) | 0], q = onPlate(pl, R() < 0.4); if (!q) continue; at(q[0], q[2]);
    if (c % 3) { barnacle(q, 0.05 + R() * 0.05); const q2 = onPlate(pl, q[3] * pl.a.nx + q[5] * pl.a.nz > 0); if (q2) barnacle(q2, 0.04 + R() * 0.04); }
    else tuft(q[0], Math.max(q[6], pl.lo), q[2], (0.15 + R() * 0.3) * VEX, q[3], q[5]);          // weed from the foot of the plate
  }
  for (const [, c] of shipBy) if (depth(c[0], c[1]) > 0.2) site(c[0], c[1], 11, 1.6, true, true);
  for (const s of o.reefs || []) site(s[0], s[1], 9, 1.3, true);
  for (const p of F.fishPatches || []) site(p[0], p[1], 6 + R() * 3, 0.9, false);          // the patch reefs whose fish life.js placed: rocks, weed and a little coral under them
  // and many smaller places in the shallows all round the island
  for (let t = 0, made = 0; t < 9000 && made < 120 * K; t++) { const x = (R() - 0.5) * (T.sx - 1200), z = (R() - 0.5) * (T.sz - 1200), d = depth(x, z); if (d < 0.7 || d > 7 || maskAt(x, z).shore < -900) continue; made++; site(x, z, 3.5 + R() * 4, 0.5 + R() * 0.5, false); }

  // The small life of the shallows is everywhere, not only at the rocky places: loose groups on the sand, in water up to 3 m deep all round the island and
  // over the banks, and a group just off every stretch of beach. Each has sea stars, shells and a sea snail or two; often a crab or two; sometimes sea
  // urchins, a sea cucumber, a tight group of very small fish, and now and then an octopus.
  const URCHINS = [[0.12, 0.08, 0.14], [0.08, 0.07, 0.08], [0.3, 0.1, 0.12]], CUCUMBERS = [[0.1, 0.09, 0.08], [0.32, 0.2, 0.12], [0.42, 0.34, 0.22]];
  const urchin = (x, z, r) => {            // a small dark ball, half sunk in the sand, with spines standing out all round
    const y = meshY(x, z) + r * 0.6, c = pick(URCHINS), b = A.pos.length / 3;
    for (let i = 0; i < ICO0.count; i++) { const nx = ICO0.getX(i), ny = ICO0.getY(i), nz = ICO0.getZ(i); V(x + nx * r, y + ny * r * 0.7, z + nz * r, nx, ny, nz, c, 0.8 + 0.3 * Math.max(0, ny)); A.idx.push(b + i); }
    for (let k = 0; k < 12; k++) { const an = R() * 6.283, e = R() * 1.4, dx = Math.cos(an) * Math.cos(e), dy = Math.sin(e), dz = Math.sin(an) * Math.cos(e), L = r * (1.6 + R() * 1.2), w = r * 0.12, q = A.pos.length / 3;
      V(x + dx * r * 0.8 - dz * w, y + dy * r * 0.6, z + dz * r * 0.8 + dx * w, dx, dy + 0.3, dz, c, 0.9); V(x + dx * r * 0.8 + dz * w, y + dy * r * 0.6, z + dz * r * 0.8 - dx * w, dx, dy + 0.3, dz, c, 0.9); V(x + dx * (r + L), y + dy * (r * 0.7 + L), z + dz * (r + L), dx, dy + 0.3, dz, c, 1.3); A.idx.push(q, q + 1, q + 2); }
  };
  const cucumber = (x, z, len) => {            // a sea cucumber: a fat, lumpy sausage lying on the sand
    const y = meshY(x, z) + len * 0.16, an = R() * 6.283, ca = Math.cos(an), sa = Math.sin(an), c = pick(CUCUMBERS), b = A.pos.length / 3, seed = R() * 20;
    for (let i = 0; i < ICO1.count; i++) { const nx = ICO1.getX(i), ny = ICO1.getY(i), nz = ICO1.getZ(i), l = 1 + 0.12 * Math.sin(nx * 9 + seed), lx = nx * len * 0.5, lz = nz * len * 0.2 * l;
      V(x + ca * lx - sa * lz, y + ny * len * 0.18 * l, z + sa * lx + ca * lz, nx * 0.4, ny + 0.2, nz, c, 0.75 + 0.35 * Math.max(0, ny) + 0.1 * Math.sin(nx * 31)); A.idx.push(b + i); }
  };
  const starField = (x, z) => {
    const near = (f) => { const px = x + (R() - .5) * 5, pz = z + (R() - .5) * 5, d = depth(px, pz); if (d > 0.25) { at(px, pz); f(px, pz, d); } };
    for (let j = 3 + ((R() * 6) | 0); j > 0; j--) near((px, pz) => star(px, pz, 0.1 + R() * 0.13));
    for (let j = 4 + ((R() * 6) | 0); j > 0; j--) near((px, pz) => shell(px, pz, 0.05 + R() * 0.07));
    for (let j = 1 + ((R() * 2) | 0); j > 0; j--) near((px, pz) => snail(px, meshY(px, pz), pz, 0.03 + R() * 0.035));
    if (R() < 0.45) for (let j = 1 + ((R() * 2) | 0); j > 0; j--) near((px, pz) => crabs.push(px, pz, R() * 6.283, 0.09 + R() * 0.11, R() * 6.283, 0.5 + R() * 1.6, 0.25 + R() * 0.35, R()));
    if (R() < 0.12) for (let j = 2 + ((R() * 3) | 0); j > 0; j--) near((px, pz) => urchin(px, pz, 0.035 + R() * 0.03));
    if (R() < 0.12) near((px, pz) => cucumber(px, pz, 0.18 + R() * 0.14));
    if (R() < 0.15) near((px, pz, d) => { if (d > 0.6) school(fry, px, pz, d, Math.round((8 + R() * 8) * K), 0.8 + R() * 1.6, 0.09 + R() * 0.06); });
    if (R() < 0.03) near((px, pz, d) => { if (d > 0.7) octos.push(px, pz, R() * 6.283, 0.3 + R() * 0.2, R() * 6.283, 0.25 + R() * 0.35, 0.6 + R() * 0.8, R()); });
  };
  for (let t = 0, made = 0; t < 90000 && made < 2500 * K; t++) { const x = (R() - 0.5) * (T.sx - 1200), z = (R() - 0.5) * (T.sz - 1200), d = depth(x, z); if (d < 0.3 || d > 3 || maskAt(x, z).shore < -900) continue; made++; starField(x, z); }
  for (const r of F.beach || []) for (let i = 4; i < r.p.length - 4; i += MOBILE ? 2 : 1) { const p = r.p[i]; for (let t = 0; t < 6; t++) { const x = p[0] + (r.side || 1) * (10 + R() * 70), z = p[1] + (R() - .5) * 30, d = depth(x, z); if (d > 0.3 && d < 2) { starField(x, z); break; } } }

  // ---- the drawings ----
  const still = makeMat({ side: THREE.DoubleSide,
    vs: /* glsl */`attribute vec3 aCol; attribute float aSway; varying vec3 vCol, vW;
      void main(){
        vec3 wp = position; wp.xz += vec2(sin(uTime * 1.1 + position.x * 1.3 + position.z * 0.7), cos(uTime * 0.8 + position.z * 1.1)) * aSway * 0.2;          // weed leans and comes back with the surge
        vec3 nn = normalize(normal), col = aCol * ${LIT}; ${WET}
        vCol = col; vW = wp;
        gl_Position = length(wp - cameraPosition) > ${SEEN}.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`, fs: FS });
  const meshes = []; let verts = 0;
  for (const c of chunks.values()) {
    if (!c.idx.length) continue; const g = new THREE.BufferGeometry(), F32 = (a, k) => new THREE.Float32BufferAttribute(a, k);
    g.setAttribute('position', F32(c.pos, 3)); g.setAttribute('normal', F32(c.nrm, 3)); g.setAttribute('aCol', F32(c.col, 3)); g.setAttribute('aSway', F32(c.sway, 1)); g.setIndex(c.idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(c.cx, 0, c.cz), CH * 0.75); verts += c.pos.length / 3;
    const m = new THREE.Mesh(g, still); m.name = 'seabed'; scene.add(m); meshes.push(m);
  }
  // crabs: iA = x, z, phase, size; iB = the way it faces, how far it runs, how often, tint. It runs sideways between two spots and rests at each.
  const inst = (geo, list) => { const n = list.length / 8, a = new Float32Array(n * 4), b = new Float32Array(n * 4); for (let i = 0; i < n; i++) { a.set(list.slice(i * 8, i * 8 + 4), i * 4); b.set(list.slice(i * 8 + 4, i * 8 + 8), i * 4); } geo.setAttribute('iA', new THREE.InstancedBufferAttribute(a, 4)); geo.setAttribute('iB', new THREE.InstancedBufferAttribute(b, 4)); geo.instanceCount = n; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); return geo; };
  const build = (f) => { const P = [], C = [], X = [], I = [], g = new THREE.InstancedBufferGeometry(); f((x, y, z, c, k = 1, a = 0, b = 0, e = 0) => { P.push(x, y, z); C.push(c[0] * k, c[1] * k, c[2] * k); X.push(a, b, e); return P.length / 3 - 1; }, I);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aX', new THREE.Float32BufferAttribute(X, 3)); g.setIndex(I); return g; };
  const crabGeo = build((v, I) => {
    const SH = [1, 0.62, 0.42], N = 8, c0 = v(0, 0.2, 0, SH, 1.1);
    for (let i = 0; i < N; i++) { const a = i / N * 6.2832; v(Math.cos(a) * 0.36, 0.09, Math.sin(a) * 0.5, SH, 0.75 + 0.2 * Math.cos(a)); I.push(c0, c0 + 1 + i, c0 + 1 + (i + 1) % N); }
    for (const sd of [-1, 1]) {
      for (let l = 0; l < 4; l++) { const x = 0.24 - l * 0.16, b = v(x - 0.03, 0.1, sd * 0.42, SH, 0.7), ph = l * 1.7 + (sd > 0 ? 0 : 3.1); v(x + 0.03, 0.1, sd * 0.42, SH, 0.7); v(x - 0.03 - l * 0.02, 0.27, sd * 0.78, SH, 0.9, ph, 0.05); v(x + 0.03 - l * 0.02, 0.27, sd * 0.78, SH, 0.9, ph, 0.05); v(x - 0.05 - l * 0.04, 0, sd * 1.08, SH, 0.6, ph, 0.14); I.push(b, b + 1, b + 2, b + 2, b + 1, b + 3, b + 2, b + 3, b + 4); }
      const b = v(0.26, 0.1, sd * 0.3, SH, 0.85); v(0.34, 0.1, sd * 0.42, SH, 0.85); v(0.6, 0.16, sd * 0.2, SH, 1.15); v(0.62, 0.12, sd * 0.4, SH, 1.15); v(0.86, 0.1, sd * 0.24, [1, 0.95, 0.85], 1.1); I.push(b, b + 1, b + 2, b + 2, b + 1, b + 3, b + 2, b + 3, b + 4);            // a claw
      const e = v(0.33, 0.12, sd * 0.12, [0.05, 0.05, 0.05]); v(0.36, 0.26, sd * 0.13, [0.05, 0.05, 0.05]); v(0.39, 0.12, sd * 0.14, [0.05, 0.05, 0.05]); I.push(e, e + 1, e + 2);            // an eye on its stalk
    }
  });
  const crawl = (geo, list, body) => { if (!list.length) return null; const m = new THREE.Mesh(inst(geo, list), makeMat({ side: THREE.DoubleSide,
    vs: /* glsl */`attribute vec3 aCol, aX; attribute vec4 iA, iB; varying vec3 vCol, vW;
      void main(){ vec3 lp = position, tint = vec3(1.0); vec2 home = iA.xy; float face = iB.x;
        ${body}
        vec2 fw = vec2(cos(face), sin(face)), sd = vec2(-fw.y, fw.x), xz = home + (fw * lp.x + sd * lp.z) * iA.w;
        vec3 wp = vec3(xz.x, groundY(home) + lp.y * iA.w + 0.012, xz.y), nn = normalize(vec3(fw.x * lp.x + sd.x * lp.z, 1.2, fw.y * lp.x + sd.y * lp.z)), col = aCol * tint * ${LIT}; ${WET}
        vCol = col; vW = wp;
        gl_Position = length(wp - cameraPosition) > ${SEEN * 0.6}.0 || groundY(home) > uSeaM * uVex - 0.1 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV} }`, fs: FS })); m.frustumCulled = false; scene.add(m); meshes.push(m); return m; };
  const CRAB_BODY = /* glsl */`float s = sin(uTime * iB.z + iA.z), going = 1.0 - smoothstep(0.3, 0.55, abs(s)); vec2 side = vec2(-sin(face), cos(face));
        home += side * (smoothstep(-0.45, 0.45, s) * 2.0 - 1.0) * iB.y; lp.y += abs(sin(uTime * 15.0 + aX.x)) * aX.y * going;
        tint = iB.w < 0.35 ? vec3(0.62, 0.5, 0.36) : iB.w < 0.7 ? vec3(0.3, 0.42, 0.62) : vec3(0.5, 0.2, 0.12);            // sand crab, blue swimmer, red-brown rock crab`;
  crawl(crabGeo, crabs, CRAB_BODY);
  // octopuses: a round mantle, a head with two eyes, eight arms that lie on the bed and curl. aX = arm's phase, how far along the arm (below 0: the body), the arm's bearing
  const octoGeo = build((v, I) => {
    const SK = [1, 1, 1], b = ICO1.count; for (let i = 0; i < b; i++) { const nx = ICO1.getX(i), ny = ICO1.getY(i), nz = ICO1.getZ(i); I.push(v(-0.3 + nx * 0.3, 0.24 + ny * 0.22, nz * 0.22, SK, 0.75 + 0.35 * Math.max(0, ny) + 0.12 * Math.sin(nx * 17 + nz * 13), 0, -1, 0)); }
    for (let i = 0; i < ICO0.count; i++) I.push(v(ICO0.getX(i) * 0.13, 0.15 + ICO0.getY(i) * 0.12, ICO0.getZ(i) * 0.15, SK, 0.9, 0, -1, 0));
    for (const sd of [-1, 1]) { const e = v(0.02, 0.27, sd * 0.1, [0.02, 0.02, 0.02], 1, 0, -1, 0); v(0.1, 0.25, sd * 0.11, [0.9, 0.8, 0.3], 1, 0, -1, 0); v(0.05, 0.2, sd * 0.15, [0.02, 0.02, 0.02], 1, 0, -1, 0); I.push(e, e + 1, e + 2); }
    for (let k = 0; k < 8; k++) { const an = (k + 0.5) / 8 * 6.2832, dx = Math.cos(an), dz = Math.sin(an), N = 6, S = 4, base = [];
      for (let j = 0; j <= N; j++) { const u = j / N, r = 0.055 * (1 - u) + 0.008, d = 0.1 + u * 0.9, y = 0.06 * (1 - u) + r; for (let q = 0; q < S; q++) { const a = q / S * 6.2832; base.push(v(dx * d - dz * Math.cos(a) * r, y + Math.sin(a) * r, dz * d + dx * Math.cos(a) * r, SK, (0.7 + 0.3 * Math.sin(a)) * (0.85 + 0.25 * ((j + k) % 2)), k * 0.9, u, an)); } }
      for (let j = 0; j < N; j++) for (let q = 0; q < S; q++) { const a0 = base[j * S + q], a1 = base[j * S + (q + 1) % S], b0 = base[(j + 1) * S + q], b1 = base[(j + 1) * S + (q + 1) % S]; I.push(a0, b0, a1, a1, b0, b1); } }
  });
  const OCTO_BODY = /* glsl */`home += vec2(sin(uTime * 0.07 * iB.z + iA.z), cos(uTime * 0.05 * iB.z + iA.z * 1.3)) * iB.y; face += sin(uTime * 0.11 + iA.z) * 0.8;
        if(aX.y < 0.0){ lp.xyz = vec3(-0.3, 0.24, 0.0) + (lp - vec3(-0.3, 0.24, 0.0)) * (1.0 + 0.07 * sin(uTime * 2.2 + iA.z) * step(lp.x, -0.05)); }
        else { float u = aX.y, wv = sin(uTime * 1.4 + aX.x + u * 5.0 + iA.z) * 0.17 * u; lp.xz += vec2(-sin(aX.z), cos(aX.z)) * wv; lp.y += max(0.0, sin(uTime * 0.9 + aX.x * 1.7 + u * 3.0 + iA.z)) * 0.14 * u * u; }
        tint = mix(vec3(0.55, 0.2, 0.12), vec3(0.62, 0.5, 0.36), 0.5 + 0.5 * sin(uTime * 0.23 + iA.z * 3.0)) * (0.8 + 0.4 * iB.w);            // it changes colour as it goes`;
  crawl(octoGeo, octos, OCTO_BODY);
  // very small fish in tight groups, and rays on the sand by the wrecks
  if (fry.length) swimmers(scene, { ...SLIM, paint: PAINT.bait, name: 'fry', amp: 0.18, rate: 17, colA: [0.36, 0.44, 0.34], colB: [0.92, 0.94, 0.9], colC: [0.6, 0.66, 0.56], eye: [0.39, 0.012, 0.02], see: 150, min: 0.3 }, fry);
  if (chromis.length) swimmers(scene, { ...DAMSEL, paint: PAINT.neon, name: 'chromis', amp: 0.16, rate: 16, colA: [0.1, 0.62, 0.55], colB: [0.5, 0.9, 0.7], colC: [0.1, 0.5, 0.6], see: 150, min: 0.3 }, chromis);
  // the reef fish of the rocky patches and reefs away from the wrecks: yellow-barred sergeant majors and silver bream
  if (sergeants.length) swimmers(scene, { ...DAMSEL, paint: PAINT.sergeant, name: 'sergeants', amp: 0.13, rate: 10, colA: [0.74, 0.72, 0.36], colB: [0.92, 0.92, 0.84], colC: [0.6, 0.62, 0.42], see: 320, min: 0.6 }, sergeants);
  if (bream.length) swimmers(scene, { ...BREAM, paint: PAINT.bream, name: 'reefbream', amp: 0.13, rate: 8, colA: [0.36, 0.4, 0.38], colB: [0.86, 0.89, 0.9], colC: [0.46, 0.48, 0.43], see: 420, min: 0.8 }, bream);
  if (rays.length) swimmers(scene, { ...RAY, paint: PAINT.ray, name: 'wreckrays', vertical: 1, bottom: 1, amp: 0.1, rate: 2.2, colA: [0.36, 0.31, 0.22], colB: [0.80, 0.76, 0.66], eye: [0.3, 0.085, 0.02], see: 600, min: 0.25 }, rays);
  return { studio: { crab: (list) => crawl(crabGeo, list, CRAB_BODY), octo: (list) => crawl(octoGeo, list, OCTO_BODY) }, meshes, lists: { crabs, octos }, count: { verts, sergeants: sergeants.length / 8, bream: bream.length / 8, crabs: crabs.length / 8, octopus: octos.length / 8, fry: fry.length / 8, chromis: chromis.length / 8, rays: rays.length / 8, chunks: chunks.size },
    update(camDist) { const on = camDist < 1600; for (const m of meshes) if (m.visible !== on) m.visible = on; } };
}

// What the ground is like to drive on, kept where both the picture and the 4WDs can read it:
//   - how rough each place is (the inland tracks have bumpy stretches; the beach is hard near the water and soft higher up)
//   - the pools of water lying on the inland tracks, with the spray and rings a car makes going through one
//   - where the big driftwood logs lie on the beach (a table the drawing of the logs is made from too), so the cars can steer round them
//   - where trees and big bushes stand close to a car (read back from a small picture of them drawn from above), so a car driven into one stops
import * as THREE from 'three';
import { U, VEX, makeMat, GLSL_COMMON, LOGV, LOGF, LOGF_PARS, rng, clamp } from './common.js';
import { T, meshY, groundH, heightAt, maskAt, maskBi } from './terrain.js';

export const carPace = { kmh: 40 };
// The ground a wheel has just gone over: grass, ferns and whatever else stands there lie down (the shaders ask flatK, in common.js).
// The last 24 places are kept, so about 60 m of track behind a car stays pressed.
let flatI = 0;
export function pressGround(x, z, r) {
  const F = U.uFlat.value, C = U.uFlatC.value; F[flatI].set(x, z, 0, r); flatI = (flatI + 1) % F.length;
  let sx = 0, sz = 0, n = 0; for (const p of F) if (p.w > 0) { sx += p.x; sz += p.y; n++; } sx /= n; sz /= n; let far = 0; for (const p of F) if (p.w > 0) far = Math.max(far, Math.hypot(p.x - sx, p.y - sz) + p.w); C.set(sx, sz, far, n);
}
export const OPT = { invX: 1, invY: 1 };          // -1 turns an axis of control round (Settings): left and right, up and down          // what a 4WD does on a clear straight (the Travel menu sets it)
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const FARS = new THREE.Sphere(new THREE.Vector3(), 1e6);

// ---------------------------------------------------------------- rough ground
// stretches a few hundred metres long: 0 an easy one, 1 a rough one
export const sectionK = (x, z) => sst(0.3, 0.7, 0.5 + 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.007) * 2.0) * Math.sin(z * 0.011 + 1.7));
export function roughAt(x, z) {
  const m = maskAt(x, z); if (m.land < 0.5) return 0.1;
  if (m.sand < 0.3) return 0.4 + 0.6 * sectionK(x, z);                                    // inland: roots, washouts and corrugations
  return 0.1 + 0.55 * sst(0.9, 2.4, heightAt(x, z) - U.uSeaM.value) * (0.45 + 0.55 * sectionK(x * 1.7 + 40, z * 1.7));      // beach: packed hard by the tide low down, soft and churned higher up
}
// the bumps themselves, in the range -0.8 to 0.8: short ones a wheel drops into, and longer swells
const bh = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), a = bh(i, j), b = bh(i + 1, j), c = bh(i, j + 1), d = bh(i + 1, j + 1); return a + (b - a) * ux + (c - a + (a - b - c + d) * ux) * uz - 0.5; };
export const bumpAt = (x, z) => vn(x / 2.3, z / 2.3) * 0.6 + vn(x / 6.5 + 9.3, z / 6.5 + 4.1);

// ---------------------------------------------------------------- driftwood logs
export const LOG_CS = 3.4, LOGN = 256;
const logTab = new Uint8Array(LOGN * LOGN * 4);
{ const R = rng(5150); for (let i = 0; i < LOGN * LOGN; i++) if (R() < 0.016) { logTab[i * 4] = (R() * 256) | 0; logTab[i * 4 + 1] = (R() * 256) | 0; logTab[i * 4 + 2] = (R() * 256) | 0; logTab[i * 4 + 3] = 1 + ((R() * 255) | 0); } }
let logTex = null;
export function logTexture() { if (!logTex) { logTex = new THREE.DataTexture(logTab, LOGN, LOGN, THREE.RGBAFormat); logTex.wrapS = logTex.wrapT = THREE.RepeatWrapping; logTex.magFilter = logTex.minFilter = THREE.NearestFilter; logTex.needsUpdate = true; } return logTex; }
// the shader lines that take a log's place, lie and length from the table (see the driftwood in life.js)
export const LOG_PRE = /* glsl */`vec4 lg = texture2D(uLogs, (cell + 0.5) / ${LOGN}.0); float logK = step(0.002, lg.a);
        for (int q = 0; q < 24; q++) { vec2 dg = cell - uGone[q]; if (dot(dg, dg) < 0.25) logK = 0.0; }          // (a log a car has broken up is no longer drawn here: its pieces are)
        if (logK > 0.5) { jt = lg.rg; h4 = lg.b; h1 = lg.a; }`;
// the logs within r of a place: x, z of the middle, the half-length along x and z, and the cell it is in, six numbers a log (broken ones left out)
export function logsNear(x, z, r, out) {
  out.length = 0;
  const i0 = Math.floor((x - r) / LOG_CS), i1 = Math.floor((x + r) / LOG_CS), j0 = Math.floor((z - r) / LOG_CS), j1 = Math.floor((z + r) / LOG_CS);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const q = ((j & 255) * LOGN + (i & 255)) * 4, a = logTab[q + 3]; if (!a || logBroken(i, j)) continue;
    const lx = (i + logTab[q] / 255) * LOG_CS, lz = (j + logTab[q + 1] / 255) * LOG_CS, m = maskAt(lx, lz); if (m.land < 0.9) continue;
    const h = heightAt(lx, lz), s = sst(0.3, 0.65, m.sand) * sst(0.7, 1.1, h) * (1 - sst(2.5, 3.6, h)); if (s < 0.25) continue;
    const ang = logTab[q + 2] / 255 * 6.2832, half = (2.4 + 3.4 * a / 255) * s / 2;
    out.push(lx, lz, Math.cos(ang) * half, Math.sin(ang) * half, i, j);
  }
  return out;
}

// ---------------------------------------------------------------- logs that are driven into
// A log a car hits is taken out of the drawing of the driftwood (the shader skips the cells listed in logGone) and comes back as loose
// pieces: lengths of the log, broken at random places so they come out all sizes, knocked aside by the bumper, and some splinters. They fly,
// land, roll a little and lie where they stop. (The fallen trees on the beach break the same way: see below.)
const GONE = 24;
export const logGone = Array.from({ length: GONE }, () => new THREE.Vector2(1e9, 1e9));
const goneKey = new Array(GONE).fill(''), goneSet = new Set(); let goneI = 0;
// mark the log in cell i, j as broken; gives the slot its pieces use, or -1 if it was broken already
export function breakLog(i, j) { const k = i + ',' + j; if (goneSet.has(k)) return -1; const s = goneI; goneI = (goneI + 1) % GONE; if (goneKey[s]) goneSet.delete(goneKey[s]); goneKey[s] = k; goneSet.add(k); logGone[s].set(i, j); return s; }
export const logBroken = (i, j) => goneSet.has(i + ',' + j);

// ---------------------------------------------------------------- the fallen trees on the beach
// The big silver trees that lie where a dune has fallen away (drawn in life.js) are placed from a table too, so that a car can find the one in
// its way and break it up. One cell of their grid is 12 m; a cell's entry is where in the cell the tree lies, which way it points, and how long
// it is (nothing in two cells out of three). The rest is read from the map exactly as the shader reads it: only on the ragged ground between
// the open beach and the bush, now and then out on the beach itself, never on the great sand blows or beside a building.
export const SNAG_CS = 12;
const snagTab = new Uint8Array(LOGN * LOGN * 4);
{ const R = rng(4141); for (let i = 0; i < LOGN * LOGN; i++) { snagTab[i * 4] = (R() * 256) | 0; snagTab[i * 4 + 1] = (R() * 256) | 0; snagTab[i * 4 + 2] = (R() * 256) | 0; snagTab[i * 4 + 3] = R() < 0.3 ? 1 + ((R() * 255) | 0) : 0; } }
let snagTex = null;
export function snagTexture() { if (!snagTex) { snagTex = new THREE.DataTexture(snagTab, LOGN, LOGN, THREE.RGBAFormat); snagTex.wrapS = snagTex.wrapT = THREE.RepeatWrapping; snagTex.magFilter = snagTex.minFilter = THREE.NearestFilter; snagTex.needsUpdate = true; } return snagTex; }
const SGONE = 12;
export const snagGone = Array.from({ length: SGONE }, () => new THREE.Vector2(1e9, 1e9));
const sKey = new Array(SGONE).fill(''), sSet = new Set(); let sI = 0;
// mark the tree in cell i, j as broken; gives the slot its pieces use (after the logs' slots), or -1 if it was broken already
export function breakSnag(i, j) { const k = i + ',' + j; if (sSet.has(k)) return -1; const n = sI; sI = (sI + 1) % SGONE; if (sKey[n]) sSet.delete(sKey[n]); sKey[n] = k; sSet.add(k); snagGone[n].set(i, j); return GONE + n; }
export const SNAG_PRE = /* glsl */`vec4 lg = texture2D(uLogs, (cell + 0.5) / ${LOGN}.0); jt = lg.rg; h4 = lg.b; h2 = lg.a; h1 = texture2D(uLogs, (cell + vec2(77.5, 131.5)) / ${LOGN}.0).r; h3 = step(lg.a, 0.002);
        for (int q = 0; q < ${SGONE}; q++) { vec2 dg = cell - uGone[q]; if (dot(dg, dg) < 0.25) h3 = 1.0; }          // (a tree a car has broken up is no longer drawn here: its pieces are)`;
const noSnag = new Set();
// no tree lies within about a hundred metres of a building (the shader keeps them out of the yards): told the buildings once, at the start
export function snagKeepOut(list) { for (const b of list || []) { if (!b.p || !b.p[0]) continue; const gx = Math.floor(b.p[0][0] / 96), gz = Math.floor(b.p[0][1] / 96); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) noSnag.add((gx + i) + ',' + (gz + j)); } }
function snagLen(i, j, sx, sz, a) {            // how long the tree of cell i, j is, lying at sx, sz (0: none is drawn there)
  const m = maskBi(sx, sz); if (m.land < 0.9) return 0; const h = heightAt(sx, sz); if (h < 0.7 || noSnag.has(Math.floor(sx / 96) + ',' + Math.floor(sz / 96))) return 0;
  for (const b of U.uBlow.value) { const dx = sx - b.x, dz = sz - b.y - dx * 0.55; if (Math.hypot(dx / b.w, dz / b.z) < 1.3) return 0; }
  const h1 = snagTab[(((j + 131) & 255) * LOGN + ((i + 77) & 255)) * 4] / 255;
  const band = Math.max(sst(0.45, 0.58, m.sand) * (1 - sst(0.76, 0.87, m.sand)), h1 <= 0.07 ? sst(0.8, 0.9, m.sand) * sst(1.2, 1.8, h) * (1 - sst(3, 4.5, h)) : 0);
  return (4.5 + 5.5 * a / 255) * band;
}
// the fallen trees within r of a place, as logsNear gives logs: x, z of the middle of the trunk, half its length along x and z, and its cell
// (broken ones and little ones under 2.5 m left out). keep: add them to what is in out already.
export function snagsNear(x, z, r, out, keep) {
  if (!keep) out.length = 0;
  const i0 = Math.floor((x - r) / SNAG_CS), i1 = Math.floor((x + r) / SNAG_CS), j0 = Math.floor((z - r) / SNAG_CS), j1 = Math.floor((z + r) / SNAG_CS);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const q = ((j & 255) * LOGN + (i & 255)) * 4, a = snagTab[q + 3]; if (!a || sSet.has(i + ',' + j)) continue;
    const sx = (i + snagTab[q] / 255) * SNAG_CS, sz = (j + snagTab[q + 1] / 255) * SNAG_CS, len = snagLen(i, j, sx, sz, a); if (len < 2.5) continue;
    const ang = snagTab[q + 2] / 255 * 6.2832, c = Math.cos(ang), sn = Math.sin(ang);
    out.push(sx + c * len * 0.03, sz + sn * len * 0.03, c * len * 0.53, sn * len * 0.53, i, j);          // (the trunk runs from 0.5 of its size behind the middle to 0.56 ahead)
  }
  return out;
}
export function buildLogBits(scene) {
  const PER = 14, NP = (GONE + SGONE) * PER, S = 6, VP = S * 2 + 2, pos = new Float32Array(NP * VP * 3).fill(-1e5), nrm = new Float32Array(NP * VP * 3), col = new Float32Array(NP * VP * 3), idx = [];
  for (let p = 0; p < NP; p++) { const b = p * VP; for (let i = 0; i < S; i++) { const j = (i + 1) % S; idx.push(b + i, b + S + i, b + j, b + j, b + S + i, b + S + j, b + S * 2, b + j, b + i, b + S * 2 + 1, b + S + i, b + S + j); } }
  const g = new THREE.BufferGeometry(), pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), na = new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage), ca = new THREE.BufferAttribute(col, 3);
  g.setAttribute('position', pa); g.setAttribute('normal', na); g.setAttribute('aCol', ca); g.setIndex(idx); g.boundingSphere = FARS;
  const mesh = new THREE.Mesh(g, makeMat({ side: THREE.DoubleSide,
    vs: /* glsl */`attribute vec3 aCol; varying vec3 vCol, vW; void main(){ vec3 nn = normalize(normal), wp = position;
        vCol = aCol * (uLightCol * (max(dot(nn, uLightDir), 0.0) * 0.8 + 0.1) * cloudShadow(wp) + mix(uAmbGnd, uAmbSky, nn.y * 0.5 + 0.5)); vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); ${LOGV} }`,
    fs: /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }` }));
  mesh.name = 'logbits'; mesh.frustumCulled = false; scene.add(mesh);
  const bits = Array.from({ length: NP }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, tip: 0, wy: 0, wt: 0, len: 1, r: 0.1 }));
  let live = 0;
  const lay = (b, p) => {            // write one piece's corners where it is now
    const ct = Math.cos(b.tip), ax = Math.cos(b.yaw) * ct, ay = Math.sin(b.tip), az = Math.sin(b.yaw) * ct, ux = -Math.sin(b.yaw), uz = Math.cos(b.yaw), wx = ay * uz, wy = az * ux - ax * uz, wz = -ay * ux, o = p * VP * 3;
    for (let e = 0; e < 2; e++) { const h = (e ? 0.5 : -0.5) * b.len, cx = b.x + ax * h, cy = b.y + ay * h, cz = b.z + az * h;
      for (let i = 0; i < S; i++) { const a = i / S * 6.2832, c = Math.cos(a), s = Math.sin(a), q = o + (e * S + i) * 3, rx = ux * c + wx * s, ry = wy * s, rz = uz * c + wz * s; pos[q] = cx + rx * b.r; pos[q + 1] = cy + ry * b.r; pos[q + 2] = cz + rz * b.r; nrm[q] = rx; nrm[q + 1] = ry; nrm[q + 2] = rz; }
      const q = o + (S * 2 + e) * 3; pos[q] = cx; pos[q + 1] = cy; pos[q + 2] = cz; nrm[q] = ax * (e ? 1 : -1); nrm[q + 1] = ay * (e ? 1 : -1) + 0.3; nrm[q + 2] = az * (e ? 1 : -1); }
  };
  return {
    // the log at lx, lz (half its length along hx, hz) is hit by a car at cx, cz going vx, vz: slot is what breakLog (or breakSnag) gave.
    // opt, for a fallen tree: r0, r1 how thick it is at its two ends, tone its colour, limbs: some of the loose bits are its branches
    burst(slot, lx, lz, hx, hz, cx, cz, vx, vz, opt = {}) {
      const L = Math.hypot(hx, hz) * 2 || 1, ax = hx * 2 / L, az = hz * 2 / L, sp = Math.hypot(vx, vz) || 1, fx = vx / sp, fz = vz / sp, tone = 0.8 + Math.random() * 0.4, rad = 0.13 + Math.random() * 0.08;
      const r0 = opt.r0 || rad * 1.15, r1 = opt.r1 || rad * 0.62, base = opt.tone || [0.46, 0.41, 0.35];
      // Where it breaks: at places picked at random along its length, so the pieces come out all sizes (a long length here, two short ones
      // beside it). Two breaks closer together than a hand's length count as one.
      const cuts = []; for (let k = 2 + ((Math.random() * Math.min(6, 2 + L / 1.2)) | 0); k > 0; k--) cuts.push(0.04 + Math.random() * 0.92); cuts.sort((p, q) => p - q);
      const ends = [0]; for (const c of cuts) if ((c - ends[ends.length - 1]) * L > 0.22 && (1 - c) * L > 0.22 && ends.length < PER - 4) ends.push(c); ends.push(1);
      const n = ends.length - 1, nl = opt.limbs ? Math.min(4, PER - n - 2) : 0;
      for (let k = 0; k < PER; k++) {
        const p = slot * PER + k, b = bits[p], chunk = k < n, limb = !chunk && k < n + nl;
        if (k >= n + nl + 5) { b.on = false; pos.fill(-1e5, p * VP * 3, (p + 1) * VP * 3); continue; }          // (five splinters at most: the rest of the slot is not used this time)
        const t = chunk ? (ends[k] + ends[k + 1]) / 2 - 0.5 : limb ? Math.random() * 0.55 - 0.08 : Math.random() - 0.5;          // (a fallen tree's branches are at its top end)
        b.on = true;
        b.len = chunk ? (ends[k + 1] - ends[k]) * L * (0.86 + Math.random() * 0.1) : limb ? 0.5 + Math.random() * 0.16 * L : 0.25 + Math.random() * 0.45;
        b.r = chunk ? (r0 + (r1 - r0) * (t + 0.5)) * (0.9 + Math.random() * 0.2) : limb ? r1 * (0.7 + Math.random() * 0.9) : 0.015 + Math.random() * 0.02;
        b.x = lx + ax * t * L; b.z = lz + az * t * L; b.y = meshY(b.x, b.z) + b.r + (chunk ? 0 : 0.2); b.yaw = Math.atan2(az, ax) + (Math.random() - 0.5) * (chunk ? 0.3 : limb ? 1.4 : 2); b.tip = 0;
        const light = 1 - 0.6 * clamp((b.r - 0.12) / 0.3, 0, 1);            // (a thick length of trunk is heavy: it is shoved aside, not thrown)
        const side = ((b.x - cx) * -fz + (b.z - cz) * fx) >= 0 ? 1 : -1, out = (chunk ? 1.2 + Math.random() * 2.2 : 2 + Math.random() * 4) * Math.min(1.6, 0.5 + sp / 8) * light;            // knocked to whichever side of the car it lay on
        b.vx = fx * sp * (chunk ? 0.4 : 0.7) * (0.6 + Math.random() * 0.6) * light - fz * side * out; b.vz = fz * sp * (chunk ? 0.4 : 0.7) * (0.6 + Math.random() * 0.6) * light + fx * side * out; b.vy = (chunk ? 1.5 + Math.random() * 2 : 2.5 + Math.random() * 3.5) * Math.min(1.5, 0.4 + sp / 9) * VEX * light;
        b.wy = (Math.random() - 0.5) * (chunk ? 5 : 14) * light; b.wt = (Math.random() - 0.5) * (chunk ? 4 : 12) * light;
        const c = chunk || limb ? [base[0] * tone, base[1] * tone, base[2] * tone] : [0.7, 0.6, 0.44], end = [0.74, 0.62, 0.42], o = p * VP * 3;            // weathered outside, pale new wood where it broke
        for (let i = 0; i < VP; i++) { const q = o + i * 3, e = i >= S * 2 ? end : c, d = 0.85 + 0.3 * ((i * 7) % 5) / 5; col[q] = e[0] * d; col[q + 1] = e[1] * d; col[q + 2] = e[2] * d; }
        lay(b, p);
      }
      ca.needsUpdate = true; pa.needsUpdate = true; na.needsUpdate = true; live = 4;
    },
    update(dt) {
      if (live <= 0) return; live -= dt; const h = Math.min(dt, 0.05);
      for (let p = 0; p < NP; p++) { const b = bits[p]; if (!b.on) continue;
        b.vy -= 9.8 * VEX * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; b.yaw += b.wy * h; b.tip += b.wt * h;
        const gy = meshY(b.x, b.z) + b.r;
        if (b.y <= gy) { b.y = gy; b.vy = b.vy < -2.5 ? -b.vy * 0.28 : 0; const f = Math.exp(-h * 5); b.vx *= f; b.vz *= f; b.wy *= f; b.wt = 0; b.tip *= Math.exp(-h * 9);            // down: it skids, turns a little and lies flat
          if (Math.abs(b.vx) + Math.abs(b.vz) + Math.abs(b.vy) < 0.08 && Math.abs(b.tip) < 0.02) { b.on = false; b.tip = 0; } else live = Math.max(live, 0.5); }
        else live = Math.max(live, 0.5);
        lay(b, p); }
      pa.needsUpdate = true; na.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- ruts on the inland tracks
// Every inland track carries the two deep wheel ruts the 4WDs have worn into it: dark grooves with a pale crumbled lip, a wheel's width,
// one car's track apart. They are also kept as short pieces in a grid, so a car can ask where the nearest rut line runs: a car in the
// ruts is steered along them and rides more smoothly than one beside them.
export function buildRuts(scene, F) {
  const pos = [], ad = [], idx = [], grid = new Map(), G = 12, HALF = 1.25, W = 0.3, STEP = 3;
  const inland = (x, z) => { const m = maskAt(x, z); return m.land > 0.9 && m.sand < 0.3; };
  for (const r of F.roads) {
    if (r.c !== 1 || r.p.length < 2) continue;
    const a0 = r.p[0], a1 = r.p[r.p.length >> 1], a2 = r.p[r.p.length - 1]; if (!inland(a0[0], a0[1]) && !inland(a1[0], a1[1]) && !inland(a2[0], a2[1])) continue;      // (a run along the beach: no ruts kept there, the tide takes them)
    let last = null, run = 0;
    for (let i = 1; i < r.p.length; i++) {
      const a = r.p[i - 1], b = r.p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue; const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, n = Math.max(1, Math.round(L / STEP));
      for (let k = (i === 1 ? 0 : 1); k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; run += L / n;
        if (!inland(x, z) || pos.length > 900000) { last = null; continue; }
        const base = pos.length / 3;
        for (const sd of [-1, 1]) for (const e of [-1, 1]) { const px = x + tz * (sd * HALF + e * W), pz = z - tx * (sd * HALF + e * W); pos.push(px, meshY(px, pz) + 0.05, pz); ad.push(run, e); }
        if (last !== null) { for (const o of [0, 2]) idx.push(last + o, last + o + 1, base + o, base + o, last + o + 1, base + o + 1);
          const key = Math.floor((x + last.x) / 2 / G) + ',' + Math.floor((z + last.z) / 2 / G); let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(last.x, last.z, x, z); }
        last = Object.assign(new Number(base), { x, z });
      }
    }
  }
  if (idx.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aD', new THREE.Float32BufferAttribute(ad, 2)); g.setIndex(idx); g.boundingSphere = FARS;
    const m = new THREE.Mesh(g, makeMat({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      vs: /* glsl */`attribute vec2 aD; varying vec2 vD; varying vec3 vW; void main(){ vD = aD; vec3 p = position; bool far = length(p - cameraPosition) > 520.0; if(!far) p.y += drawnY(p.xz) - groundY(p.xz); vW = p; gl_Position = far ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(p, 1.0); ${LOGV} }`,          // (on the ground as it is drawn: see drawnY)
      fs: /* glsl */`varying vec2 vD; varying vec3 vW;
        void main(){ ${LOGF}
          float e = abs(vD.y), n = texture2D(uNoise, vW.xz * 0.37).r, groove = 1.0 - smoothstep(0.5, 0.8, e + (n - 0.5) * 0.25), lip = smoothstep(0.55, 0.82, e) * (1.0 - smoothstep(0.86, 1.0, e));
          float tread = 0.8 + 0.2 * step(0.45, fract(vD.x * 2.4 + e * 0.8));            // the last tyre's pattern in the floor of the groove
          vec3 lit = uLightCol * (0.18 + 0.5 * max(uLightDir.y, 0.0)) * cloudShadow(vW) + uAmbSky * 0.65;
          vec3 c = mix(vec3(0.62, 0.53, 0.37), vec3(0.17, 0.135, 0.095) * tread, groove) * lit;
          float a = max(groove * 0.72, lip * 0.5) * (1.0 - smoothstep(330.0, 500.0, length(vW - cameraPosition)));
          gl_FragColor = vec4(applyFog(c, vW), a); }` }));
    m.name = 'ruts'; m.frustumCulled = false; m.renderOrder = 4.5; scene.add(m);
  }
  return scene.userData.ruts = {
    count: idx.length / 12,
    // the rut line nearest a place, if one runs within 3 m: d how far the place is to its left (below 0: to its right), tx, tz the way it runs
    near(x, z) {
      const gx = Math.floor(x / G), gz = Math.floor(z / G); let best = null, bd = 9;
      for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) { const l = grid.get(i + ',' + j); if (!l) continue;
        for (let q = 0; q < l.length; q += 4) { const dx = l[q + 2] - l[q], dz = l[q + 3] - l[q + 1], ll = dx * dx + dz * dz || 1, t = clamp(((x - l[q]) * dx + (z - l[q + 1]) * dz) / ll, 0, 1), ex = x - l[q] - dx * t, ez = z - l[q + 1] - dz * t, d2 = ex * ex + ez * ez;
          if (d2 < bd) { bd = d2; const len = Math.sqrt(ll), tx = dx / len, tz = dz / len; best = { d: ex * tz - ez * tx, tx, tz }; } } }
      return best;
    },
  };
}

// ---------------------------------------------------------------- pools on the tracks, and potholes
// Water lies on the inland tracks where the ground is level and low, more of it in the rough stretches; the same stretches are pitted
// with potholes. Each is a patch laid on the ground. list holds the pools: x, z, cos and sin of the way it lies, half-length, half-width, depth.
export function buildPuddles(scene, F) {
  const R = rng(7331), pos = [], ae = [], idx = [], pools = [], grid = new Map(), G = 40;
  const patch = (x, z, ca, sa, a, b, kind, depth) => {
    const base = pos.length / 3, N = kind ? 8 : 18; pos.push(x, meshY(x, z) + 0.05, z); ae.push(0, 0, kind);
    const RG = kind ? 1 : 4;            // a pool is laid in rings, each lying on the ground, so no part of it sinks under a rise
    for (let k = 1; k <= RG; k++) for (let i = 0; i < N; i++) { const t = i / N * 6.2832, u = Math.cos(t) * k / RG, v = Math.sin(t) * k / RG, px = x + ca * u * a - sa * v * b, pz = z + sa * u * a + ca * v * b; pos.push(px, meshY(px, pz) + 0.05, pz); ae.push(u, v, kind);
      const j = (i + 1) % N, o = base + 1 + (k - 1) * N; if (k === 1) idx.push(base, o + i, o + j); else idx.push(o - N + i, o + i, o + j, o - N + i, o + j, o - N + j); }
    if (!kind) { const p = [x, z, ca, sa, a, b, depth]; pools.push(p); for (let gx = Math.floor((x - a) / G); gx <= Math.floor((x + a) / G); gx++) for (let gz = Math.floor((z - a) / G); gz <= Math.floor((z + a) / G); gz++) { const k = gx + ',' + gz; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(p); } }
  };
  for (const r of F.roads) {
    if (r.c !== 1 || r.p.length < 2) continue;
    let next = 20 + R() * 60, hole = 5 + R() * 10, run = 0;
    for (let i = 1; i < r.p.length; i++) {
      const a = r.p[i - 1], b = r.p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue; const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
      for (let d = 0; d < L; d += 4) {
        run += 4; const x = a[0] + tx * d, z = a[1] + tz * d;
        if (run >= hole) {            // potholes, in the rough stretches
          hole = run + 4 + R() * 14; const sk = sectionK(x, z);
          if (sk > 0.45 && pos.length < 150000) { const m = maskAt(x, z); if (m.land > 0.9 && m.sand < 0.3) for (let k = 0, n = 1 + ((R() * 3) | 0); k < n; k++) { const o = (R() - 0.5) * 3.2, s2 = (R() - 0.5) * 5, rr = 0.45 + R() * 0.6, an = R() * 6.28; patch(x + tx * s2 - tz * o, z + tz * s2 + tx * o, Math.cos(an), Math.sin(an), rr * (1 + R() * 0.5), rr, 1, 0); } }
        }
        if (run < next) continue;
        const m = maskAt(x, z), sk = sectionK(x, z); next = run + (sk > 0.5 ? 45 : 140) + R() * 160;
        if (m.land < 0.9 || m.sand > 0.3) continue;
        const len = 3.5 + R() * 6.5, wid = 1.5 + R() * 1.2, h0 = groundH(x, z);
        if (h0 < 2.2 || Math.abs(groundH(x + tx * len, z + tz * len) - h0) > 0.22 || Math.abs(groundH(x - tx * len, z - tz * len) - h0) > 0.22 || Math.abs(groundH(x - tz * 3, z + tx * 3) - groundH(x + tz * 3, z - tx * 3)) > 0.3) continue;      // only where the ground is level enough to hold water
        const o = (R() - 0.5) * 1.2; patch(x - tz * o, z + tx * o, tx, tz, len, wid, 0, 0.1 + R() * 0.22);
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aE', new THREE.Float32BufferAttribute(ae, 3)); g.setIndex(idx); g.boundingSphere = FARS;
  const rip = []; for (let i = 0; i < 8; i++) rip.push(new THREE.Vector4(0, 0, -1e6, 0)); let ripI = 0;
  const mesh = new THREE.Mesh(g, makeMat({
    uniforms: { uRip: { value: rip } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    vs: /* glsl */`attribute vec3 aE; varying vec3 vE, vW; void main(){ vE = aE; vec3 p = position; p.y += drawnY(p.xz) - groundY(p.xz); vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); ${LOGV} }`,          // (the puddles lie in the ruts, on the ground as it is drawn)
    fs: /* glsl */`varying vec3 vE, vW; uniform vec4 uRip[8];
      void main(){ ${LOGF}
        float r = length(vE.xy), lit = max(uLightDir.y, 0.0) * cloudShadow(vW);
        if (vE.z > 0.5) {            // a pothole: a damp dark hollow with a pale crumbled lip
          float a = (1.0 - smoothstep(0.75, 1.0, r)) * 0.62;
          vec3 c = mix(vec3(0.13, 0.105, 0.075), vec3(0.5, 0.44, 0.33), smoothstep(0.5, 0.9, r)) * (uLightCol * (0.15 + 0.55 * lit) + uAmbSky * 0.7);
          gl_FragColor = vec4(applyFog(c, vW), a); return;
        }
        float edge = r + (texture2D(uNoise, vW.xz * 0.09).r - 0.5) * 0.55;            // a ragged shore
        float a = 1.0 - smoothstep(0.6, 0.86, edge); if (a < 0.01) discard;
        vec3 V = normalize(cameraPosition - vW);
        vec2 n2 = (texture2D(uNoise, vW.xz * 0.31 + uTime * 0.025).rg - 0.5) * 0.05;          // the wind's own ripples
        for (int i = 0; i < 8; i++) {            // rings spreading from where wheels went in
          vec2 d = vW.xz - uRip[i].xy; float l = length(d), age = uTime - uRip[i].z, ring = l - age * 1.5, k = uRip[i].w * exp(-age * 0.8) * exp(-ring * ring * 2.4) * step(0.0, age);
          n2 += d / max(l, 0.05) * sin(ring * 8.0) * k * 0.4;
        }
        vec3 N = normalize(vec3(n2.x, 1.0, n2.y)), Rf = reflect(-V, N); Rf.y = abs(Rf.y) + 0.03;
        float fres = 0.1 + 0.9 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 body = mix(vec3(0.5, 0.4, 0.26), vec3(0.2, 0.135, 0.07), smoothstep(0.75, 0.25, edge)) * (uLightCol * (0.15 + 0.6 * lit) + uAmbSky * 0.8);      // tea-brown water, the sand showing through at its edge
        vec3 c = mix(body, skyColor(normalize(Rf)) * 1.1, fres) + uLightCol * pow(max(dot(normalize(Rf), uLightDir), 0.0), 220.0) * 1.6 * lit;
        gl_FragColor = vec4(applyFog(c, vW), a * 0.93); }`,
  }));
  mesh.name = 'puddles'; mesh.userData.pools = pools; mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh);          // (over the track's own ribbon, which is 4)
  // spray: drops thrown up and out from the wheels
  const NP = 340, pk = new Float32Array(NP), pp = new Float32Array(NP * 3).fill(-1e5), pa = new Float32Array(NP), pv = new Float32Array(NP * 3), pl = new Float32Array(NP); let pi = 0, live = 0;
  const pg = new THREE.BufferGeometry(), ppa = new THREE.BufferAttribute(pp, 3).setUsage(THREE.DynamicDrawUsage), paa = new THREE.BufferAttribute(pa, 1).setUsage(THREE.DynamicDrawUsage);
  const pka = new THREE.BufferAttribute(pk, 1).setUsage(THREE.DynamicDrawUsage); pg.setAttribute('position', ppa); pg.setAttribute('aA', paa); pg.setAttribute('aK', pka); pg.boundingSphere = FARS;          // aK: 0 water, 1 dry sand
  const spray = new THREE.Points(pg, makeMat({
    transparent: true, depthWrite: false,
    vs: /* glsl */`attribute float aA, aK; varying float vA, vK; varying vec3 vW; void main(){ vA = aA; vK = aK; vW = position; vec4 mv = viewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(150.0 * (0.6 + 0.8 * aA) * (1.0 + 0.9 * aK * (1.0 - aA)) / max(-mv.z, 0.5), 1.5, 46.0); ${LOGV} }`,
    fs: /* glsl */`varying float vA, vK; varying vec3 vW; void main(){ ${LOGF} float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        vec3 c = mix(vec3(0.62, 0.55, 0.44), vec3(0.86, 0.78, 0.58), vK) * (uLightCol * (0.25 + 0.6 * max(uLightDir.y, 0.0)) + uAmbSky * 0.9); gl_FragColor = vec4(applyFog(c, vW), (1.0 - d * d) * vA * mix(0.75, 0.5, vK)); }`,
  }));
  spray.name = 'spray'; spray.frustumCulled = false; spray.renderOrder = 6; scene.add(spray);
  const near = (x, z) => grid.get(Math.floor(x / G) + ',' + Math.floor(z / G));
  return {
    pools, mesh,
    // how deep the water is at a place (0: dry)
    at(x, z) { const l = near(x, z); if (!l) return 0; for (const p of l) { const dx = x - p[0], dz = z - p[1], u = (dx * p[2] + dz * p[3]) / p[4], v = (-dx * p[3] + dz * p[2]) / p[5], r = u * u + v * v; if (r < 0.55) return p[6] * (1 - r / 0.55); } return 0; },
    // a wheel goes through at this speed, heading tx, tz: rings on the water, and spray to both sides
    splash(x, z, y, tx, tz, v, depth) {
      rip[ripI].set(x, z, U.uTime.value, clamp(v / 6, 0.3, 1.4)); ripI = (ripI + 1) % 8;
      const n = Math.min(14, Math.round(2 + v * 1.2));
      for (let k = 0; k < n; k++) { const q = pi * 3, sd = k % 2 ? 1 : -1, out = (1.2 + Math.random() * 2.6) * Math.min(1.6, v / 5), up = (1.6 + Math.random() * 2.8) * Math.min(1.5, v / 5) * (0.6 + depth * 3);
        pp[q] = x - tz * sd * 1.2; pp[q + 1] = y + 0.15; pp[q + 2] = z + tx * sd * 1.2; pv[q] = -tz * sd * out + tx * v * 0.35 + (Math.random() - 0.5); pv[q + 1] = up; pv[q + 2] = tx * sd * out + tz * v * 0.35 + (Math.random() - 0.5); pl[pi] = 0.75 + Math.random() * 0.5; pk[pi] = 0; pi = (pi + 1) % NP; }
      live = 1.4; pka.needsUpdate = true;
    },
    // dry sand thrown up and back by the two rear wheels (soft: 0 packed sand, 1 loose)
    dust(x, z, y, tx, tz, v, soft) {
      const n = Math.min(6, Math.round((1 + v * 0.22) * (0.5 + soft)));
      for (let k = 0; k < n; k++) { const q = pi * 3, sd = k % 2 ? 1 : -1, out = (0.3 + Math.random() * 1.1) * (0.6 + soft), up = (0.7 + Math.random() * 1.5) * Math.min(1.6, v / 6) * (0.6 + soft) * VEX;
        pp[q] = x - tz * sd * 1.25 + (Math.random() - 0.5) * 0.3; pp[q + 1] = y + 0.1; pp[q + 2] = z + tx * sd * 1.25 + (Math.random() - 0.5) * 0.3; pv[q] = -tz * sd * out - tx * v * 0.12; pv[q + 1] = up; pv[q + 2] = tx * sd * out - tz * v * 0.12; pl[pi] = 0.45 + Math.random() * 0.5; pk[pi] = 1; pi = (pi + 1) % NP; }
      live = 1.4; pka.needsUpdate = true;
    },
    update(dt) {
      if (live <= 0) return; live -= dt; const h = Math.min(dt, 0.05);
      for (let i = 0; i < NP; i++) { if (pl[i] <= 0) { pa[i] = 0; continue; } pl[i] -= h; const q = i * 3; pv[q + 1] -= 9.8 * VEX * h; pp[q] += pv[q] * h; pp[q + 1] += pv[q + 1] * h; pp[q + 2] += pv[q + 2] * h; pa[i] = clamp(pl[i] * 1.6, 0, 1); if (pl[i] <= 0) { pp[q + 1] = -1e5; pa[i] = 0; } }
      ppa.needsUpdate = true; paa.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- trees, big bushes and logs close to the view
// The forest and the litter under it are grown in the shaders, so nothing on this side knows where a trunk stands. To find out, the same
// trees, bushes and logs are drawn again from straight above into a small picture, 48 m across, round the place being looked at: tree trunks
// and bushes taller than a metre in red, logs in green. The picture is read back, and anything that walks or drives asks it what is in the
// way. (Grass, ferns, small bushes and the smallest trees are not drawn into it: those can be walked and driven through.)
const PN = 192, PSPAN = 48;
export const probe = {
  scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-PSPAN / 2, PSPAN / 2, PSPAN / 2, -PSPAN / 2, 1, 2000), rt: null, buf: new Uint8Array(PN * PN * 4), data: null, cx: 0, cz: 0, busy: false, tick: 0, last: 0, n: 0,
  // m: a mesh whose shader hands on its world position in the varying named wp. trunkOnly: only the parts marked vTrunk count (a tree: you can
  // pass under its crown); lo: how far above the ground a part must stand to count, in metres; log: 1 for the green picture
  add(m, { wp = 'vWp', trunkOnly = false, lo = 0.9, log = 0, cs = 11 } = {}) {
    const src = m.material, mat = new THREE.ShaderMaterial({
      uniforms: src.uniforms, defines: src.defines, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
      vertexShader: src.vertexShader.replace(LOGV, '\ngl_Position.z = 0.0;\n'),
      fragmentShader: LOGF_PARS + GLSL_COMMON + /* glsl */`varying vec3 ${wp}; ${trunkOnly ? 'varying float vTrunk;' : ''}
        void main(){ float up = (${wp}.y - groundY(${wp}.xz)) / uVex; if (up < ${lo.toFixed(2)} || up > 1.9${trunkOnly ? ' || vTrunk < 0.5' : ''}) discard; gl_FragColor = vec4(${log ? '0.0, 1.0' : '1.0, 0.0'}, 0.0, 1.0); }`,
    });
    // Only the few cells round the middle are drawn here (cs: the size of one cell of the thing's grid), not the whole forest: the picture is
    // 48 m across, and drawing every tree again for it made every third frame slow.
    const g = new THREE.InstancedBufferGeometry(), k = Math.ceil(30 / cs) + 1, cells = [];
    for (const [name, a] of Object.entries(m.geometry.attributes)) if (name !== 'iCell') g.setAttribute(name, a);
    g.setIndex(m.geometry.index); for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) cells.push(i, j);
    g.setAttribute('iCell', new THREE.InstancedBufferAttribute(new Float32Array(cells), 2)); g.instanceCount = cells.length / 2; g.boundingSphere = FARS;
    const p = new THREE.Mesh(g, mat); p.frustumCulled = false; this.scene.add(p); this.n++;
  },
  // draw and read the picture round x, z (called every frame while the view is close to the ground; it works every third frame)
  look(renderer, x, z) {
    if (!this.n || this.busy || (this.tick++ % 4)) return;
    if (this.data && Math.hypot(x - this.cx, z - this.cz) < 1.2 && this.tick - this.last < 60) return; this.last = this.tick;          // nothing has moved: the last picture still holds
    if (!this.rt) { this.rt = new THREE.WebGLRenderTarget(PN, PN, { depthBuffer: false }); this.cam.up.set(0, 0, -1); }
    const y = meshY(x, z); this.cam.position.set(x, y + 300, z); this.cam.lookAt(x, y, z); this.cam.updateMatrixWorld();
    const old = renderer.getRenderTarget(); renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.cam); renderer.setRenderTarget(old);
    const done = () => { this.data = this.buf; this.cx = x; this.cz = z; this.busy = false; };
    this.busy = true;
    if (renderer.readRenderTargetPixelsAsync) renderer.readRenderTargetPixelsAsync(this.rt, 0, 0, PN, PN, this.buf).then(done, () => { this.busy = false; });
    else { renderer.readRenderTargetPixels(this.rt, 0, 0, PN, PN, this.buf); done(); }
  },
  // is a trunk or a big bush (and, with logs, a log) standing within r of this place?
  hit(x, z, r = 0.3, logs = false) {
    if (!this.data) return false;
    const k = PN / PSPAN, u = Math.floor((x - this.cx + PSPAN / 2) * k), v = Math.floor((this.cz + PSPAN / 2 - z) * k), n = Math.ceil(r * k), d = this.data;
    for (let j = v - n; j <= v + n; j++) for (let i = u - n; i <= u + n; i++) if (i >= 0 && j >= 0 && i < PN && j < PN) { const q = (j * PN + i) * 4; if (d[q] > 127 || (logs && d[q + 1] > 127)) return true; }
    return false;
  },
  // For someone on foot at x, z heading hd (0 east, turning left as it grows): 0 if the way ahead is clear, else +1 or -1 for the side to turn to
  way(x, z, hd, logs = true) {
    const clear = (a) => { const c = Math.cos(hd + a), s = -Math.sin(hd + a); return !this.hit(x + c * 0.9, z + s * 0.9, 0.32, logs) && !this.hit(x + c * 1.8, z + s * 1.8, 0.32, logs); };
    if (clear(0)) return 0;
    for (const a of [0.6, 1.1, 1.6]) { if (clear(a)) return 1; if (clear(-a)) return -1; }
    return 1;
  },
};

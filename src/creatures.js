// Sea animals as smooth bodies: each is lofted through a row of cross-sections (so there are no flat facets or straight
// edges), given curved fins, and painted per pixel: countershading, scales, bars and spots, an eye, fin rays, the
// dancing light of the surface on its back, and the colour of the water it is seen through.
import * as THREE from 'three';
import { makeMat, LOGV, LOGF } from './common.js';

const FAR = new THREE.Sphere(new THREE.Vector3(), 1e6), PI = Math.PI;
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
const rows = (prof, n) => {                  // a smooth run of n+1 cross-sections through the given ones: [x, half height, half width, y of the centre]
  const m = prof.length - 1, P = (j) => prof[Math.max(0, Math.min(m, j))], out = [];
  for (let i = 0; i <= n; i++) { const f = i / n * m, k = Math.min(m - 1, Math.floor(f)), t = f - k, r = []; for (let c = 0; c < 4; c++) r.push(cr(P(k - 1)[c] || 0, P(k)[c] || 0, P(k + 1)[c] || 0, P(k + 2)[c] || 0, t)); r[1] = Math.max(r[1], 0.0005); r[2] = Math.max(r[2], 0.0005); out.push(r); }
  return out;
};
class Shape {
  constructor(flex) { this.pos = []; this.uv = []; this.fx = []; this.part = []; this.idx = []; this.flexAt = flex || ((x) => Math.pow(Math.min(1, Math.max(0, (0.18 - x) / 0.7)), 1.4)); }
  v(p, u, v, part, flex) { this.pos.push(p[0], p[1], p[2]); this.uv.push(u, v); this.part.push(part); this.fx.push(flex ?? this.flexAt(p[0], p[1], p[2])); return this.pos.length / 3 - 1; }
  // a curved sheet: f(t, s) gives the point for t and s from 0 to 1
  surf(nt, ns, f, part, flex) {
    const id = []; for (let i = 0; i <= nt; i++) { id.push([]); for (let j = 0; j <= ns; j++) { const p = f(i / nt, j / ns); id[i].push(this.v(p, i / nt, j / ns, part, flex ? flex(i / nt, j / ns, p) : undefined)); } }
    for (let i = 0; i < nt; i++) for (let j = 0; j < ns; j++) this.idx.push(id[i][j], id[i + 1][j], id[i][j + 1], id[i][j + 1], id[i + 1][j], id[i + 1][j + 1]);
  }
  // a body lofted along x. belly < 1 flattens the underside; u runs from the nose (0) to the tail (1), v from the back (0) round to the belly (1)
  body(prof, { NR = 18, NS = 12, belly = 1, part = 0, flex } = {}) {
    const R = rows(prof, NR), x0 = R[0][0], x1 = R[NR][0]; this.R = R;
    this.surf(NR, NS, (t, s) => { const r = R[Math.round(t * NR)], an = s * PI * 2, cy = Math.cos(an); return [r[0], r[3] + cy * r[1] * (cy < 0 ? belly : 1), Math.sin(an) * r[2]]; }, part, flex);
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NS; j++) { const k = (this.pos.length / 3 - (NR + 1) * (NS + 1)) + i * (NS + 1) + j; this.uv[k * 2] = (x0 - R[i][0]) / (x0 - x1); this.uv[k * 2 + 1] = 0.5 - 0.5 * Math.cos(j / NS * PI * 2); }
    return this;
  }
  row(x) { const R = this.R; for (let i = 0; i < R.length - 1; i++) if (x <= R[i][0] && x >= R[i + 1][0]) { const f = (R[i][0] - x) / (R[i][0] - R[i + 1][0] || 1); return R[i].map((v, c) => v + (R[i + 1][c] - v) * f); } return x > R[0][0] ? R[0] : R[R.length - 1]; }
  top(x) { const r = this.row(x); return r[3] + r[1]; }
  bot(x, belly = 1) { const r = this.row(x); return r[3] - r[1] * belly; }
  // a fin standing on the back (dir 1) or hanging under the belly (dir -1): spiny in front, soft and rounded behind
  ridge(x0, x1, h, { dir = 1, sweep = 0.5, spines = 0, lobe = 0.6, belly = 1, nt = 14 } = {}) {
    this.surf(nt, 4, (t, s) => {
      const x = x0 + (x1 - x0) * t, base = dir > 0 ? this.top(x) - 0.012 : this.bot(x, belly) + 0.012;
      const shape = Math.pow(Math.sin(PI * Math.pow(t, lobe)), 0.55) * (1 - (spines ? 0.14 * Math.abs(Math.sin(t * PI * spines)) * (1 - t) : 0));
      return [x - sweep * h * shape * s * s, base + dir * h * shape * s, 0];
    }, 1);
  }
  // the tail fin: a fan off the end of the body, forked or rounded, upper and lower lobes of their own length
  tail(len, { low = len, spread = 0.8, fork = 0.4, nt = 14 } = {}) {
    const e = this.R[this.R.length - 1];
    this.surf(nt, 5, (t, s) => {
      const k = t * 2 - 1, th = k * spread, L = (k > 0 ? len : low) * (1 - fork * Math.pow(1 - Math.abs(k), 1.6)) * (1 - 0.1 * Math.pow(Math.abs(k), 8));
      return [e[0] + 0.03 - Math.cos(th * 0.9) * L * s, e[3] + e[1] * k * (1 - s) + Math.sin(th) * L * s, 0];
    }, 1, () => 1);
  }
  // a leaf-shaped fin or flipper from a point: along a (bending by curl), spread across c
  leaf(base, a, c, len, wid, { curl = [0, 0, 0], part = 1, flex, nt = 6, ns = 8, tip = 0.7 } = {}) {
    this.surf(nt, ns, (t, s) => {
      const w = wid * Math.pow(Math.sin(PI * Math.pow(s * 0.97 + 0.015, tip)), 0.8) * (t * 2 - 1);
      return [0, 1, 2].map(i => base[i] + a[i] * len * s + curl[i] * len * s * s + c[i] * w);
    }, part, flex);
  }
  // a round limb along a curve: path(t) gives [x, y, z, radius]
  tube(path, nt, ns, part) {
    this.surf(nt, ns, (t, s) => {
      const p = path(t), a = path(Math.max(0, t - 0.02)), b = path(Math.min(1, t + 0.02)); let d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l = Math.hypot(...d) || 1; d = d.map(v => v / l);
      const side = [0, 0, 1], up = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]], an = s * PI * 2;      // the curve lies in the x-y plane
      return [p[0] + (up[0] * Math.cos(an)) * p[3], p[1] + (up[1] * Math.cos(an)) * p[3], p[2] + Math.sin(an) * p[3]];
    }, part, () => 0);
  }
  done() {              // smooth normals, shared by every vertex that sits at the same point (so the seam along the back does not show)
    const n = this.pos.length / 3, nr = new Float32Array(n * 3), p = this.pos, key = new Map();
    for (let i = 0; i < this.idx.length; i += 3) {
      const a = this.idx[i], b = this.idx[i + 1], c = this.idx[i + 2], ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { nr[k * 3] += nx; nr[k * 3 + 1] += ny; nr[k * 3 + 2] += nz; }
    }
    for (let i = 0; i < n; i++) { if (this.part[i] !== 0 && this.part[i] !== 2 && !this.weld) continue; const k = Math.round(p[i * 3] * 2000) + ',' + Math.round(p[i * 3 + 1] * 2000) + ',' + Math.round(p[i * 3 + 2] * 2000), o = key.get(k) || [0, 0, 0, []]; o[0] += nr[i * 3]; o[1] += nr[i * 3 + 1]; o[2] += nr[i * 3 + 2]; o[3].push(i); key.set(k, o); }
    for (const o of key.values()) for (const i of o[3]) { nr[i * 3] = o[0]; nr[i * 3 + 1] = o[1]; nr[i * 3 + 2] = o[2]; }
    for (let i = 0; i < n; i++) { const l = Math.hypot(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]) || 1; nr[i * 3] /= l; nr[i * 3 + 1] /= l; nr[i * 3 + 2] /= l; }
    return { pos: this.pos, nrm: nr, uv: this.uv, flex: this.fx, part: this.part, idx: this.idx };
  }
}

// ---------------------------------------------------------------- the animals
// A bony fish from its outline. x runs from the nose (+0.5) to the tail (-0.42).
function fish({ prof, tail, dorsal, anal, pect = [0.2, -0.04, 0.12, 0.04], pelv, NS = 12 }) {
  const m = new Shape().body(prof, { NS });
  m.tail(tail.len, tail);
  for (const d of dorsal || []) m.ridge(d[0], d[1], d[2], d[3]);
  if (anal) m.ridge(anal[0], anal[1], anal[2], { dir: -1, sweep: 0.7, ...anal[3] });
  for (const sd of [-1, 1]) {
    const [x, y, len, wid] = pect, w = m.row(x)[2] * 0.92;
    m.leaf([x, y, sd * w], [-0.8, -0.3, sd * 0.52], [0.25, -0.95, sd * 0.1], len, wid, { curl: [0, 0.1, sd * 0.25] });
    if (pelv) m.leaf([pelv[0], m.bot(pelv[0]) + 0.02, sd * 0.02], [-0.75, -0.62, sd * 0.2], [0.6, -0.5, sd * 0.6], pelv[1], pelv[2]);
  }
  return m.done();
}
const DEEP = (L = 1) => [[0.50, 0.004, 0.004, 0], [0.46, 0.05 * L, 0.03, -0.01], [0.38, 0.115 * L, 0.05, 0], [0.24, 0.185 * L, 0.068, 0.005], [0.08, 0.21 * L, 0.074, 0.005], [-0.08, 0.19 * L, 0.066, 0], [-0.22, 0.13 * L, 0.048, 0], [-0.33, 0.062 * L, 0.028, 0], [-0.40, 0.036, 0.016, 0], [-0.43, 0.034, 0.01, 0]];
export const BREAM = fish({ prof: DEEP(0.86), tail: { len: 0.2, fork: 0.42, spread: 0.85 }, dorsal: [[0.2, -0.3, 0.085, { spines: 9, sweep: 0.5 }]], anal: [-0.08, -0.31, 0.06, { spines: 3 }], pelv: [0.14, 0.11, 0.035] });
export const DAMSEL = fish({ prof: DEEP(1.05), tail: { len: 0.2, fork: 0.5, spread: 0.9 }, dorsal: [[0.24, -0.31, 0.09, { spines: 11, sweep: 0.45, lobe: 0.75 }]], anal: [-0.05, -0.31, 0.08, { spines: 2 }], pelv: [0.16, 0.13, 0.03] });
export const ROUND = fish({ prof: DEEP(1.2), tail: { len: 0.17, fork: 0.25, spread: 0.9 }, dorsal: [[0.26, -0.3, 0.11, { spines: 10, sweep: 0.4, lobe: 0.8 }]], anal: [-0.04, -0.3, 0.09, { spines: 2 }], pelv: [0.16, 0.15, 0.035] });
const SLENDER = [[0.50, 0.004, 0.004, 0], [0.45, 0.032, 0.026, 0], [0.34, 0.066, 0.046, 0], [0.18, 0.09, 0.058, 0], [0.0, 0.098, 0.06, 0], [-0.16, 0.085, 0.05, 0], [-0.3, 0.052, 0.03, 0], [-0.39, 0.03, 0.016, 0], [-0.43, 0.028, 0.009, 0]];
export const SLIM = fish({ prof: SLENDER, tail: { len: 0.17, fork: 0.5, spread: 0.75 }, dorsal: [[0.14, -0.02, 0.06, { spines: 6, sweep: 0.8 }], [-0.08, -0.3, 0.045, { sweep: 0.8 }]], anal: [-0.1, -0.3, 0.04, {}], pelv: [0.1, 0.07, 0.022], pect: [0.24, -0.02, 0.1, 0.035], NS: 10 });
export const FLATHEAD = (() => {
  const m = new Shape().body([[0.50, 0.004, 0.01, 0], [0.46, 0.02, 0.07, 0], [0.36, 0.034, 0.125, 0], [0.22, 0.046, 0.135, 0], [0.06, 0.052, 0.1, 0], [-0.12, 0.046, 0.07, 0], [-0.28, 0.034, 0.042, 0], [-0.4, 0.022, 0.02, 0], [-0.44, 0.02, 0.01, 0]], { belly: 0.55 });
  m.tail(0.15, { fork: 0.08, spread: 0.7 }); m.ridge(0.12, -0.04, 0.05, { spines: 6 }); m.ridge(-0.08, -0.36, 0.045, {}); m.ridge(-0.08, -0.36, 0.035, { dir: -1, belly: 0.55 });
  for (const sd of [-1, 1]) m.leaf([0.2, -0.01, sd * 0.12], [-0.55, 0, sd * 0.83], [0.83, 0.05, sd * 0.55], 0.13, 0.06);
  return m.done();
})();
export const SHARK = (() => {
  const m = new Shape().body([[0.52, 0.003, 0.004, -0.01], [0.48, 0.024, 0.034, -0.012], [0.4, 0.05, 0.062, -0.006], [0.26, 0.078, 0.086, 0], [0.08, 0.09, 0.092, 0], [-0.1, 0.078, 0.072, 0], [-0.26, 0.05, 0.042, 0.004], [-0.38, 0.028, 0.02, 0.008], [-0.44, 0.022, 0.01, 0.012]], { NS: 14, belly: 0.85 });
  m.tail(0.26, { low: 0.12, spread: 0.95, fork: 0.72 });
  m.surf(8, 6, (t, s) => { const x0 = 0.12 - 0.13 * t, lead = 0.2 * s * s, h = 0.15 * s * (1 - 0.25 * t * s); return [x0 - lead - 0.05 * t * s * (1 - s), m.top(x0) - 0.01 + h, 0]; }, 1);      // first dorsal: swept, with a curved trailing edge
  m.ridge(-0.24, -0.33, 0.04, { sweep: 1.2 }); m.ridge(-0.25, -0.33, 0.035, { dir: -1, sweep: 1.2, belly: 0.85 });
  for (const sd of [-1, 1]) { m.leaf([0.2, -0.045, sd * 0.07], [-0.5, -0.22, sd * 0.84], [0.86, 0, sd * 0.5], 0.23, 0.06, { curl: [-0.25, 0, 0], tip: 0.55 }); m.leaf([-0.14, -0.05, sd * 0.03], [-0.7, -0.5, sd * 0.5], [0.7, -0.2, sd * 0.6], 0.07, 0.03); }
  return m.done();
})();
// rays are a body pressed flat: the wings flap, the tail is a whip
const wing = (x, y, z) => Math.pow(Math.min(1, Math.abs(z) / 0.45), 1.6);
export const RAY = (() => {
  const m = new Shape(wing).body([[0.50, 0.003, 0.004, 0], [0.46, 0.018, 0.13, 0], [0.36, 0.04, 0.31, 0], [0.2, 0.06, 0.45, 0], [0.04, 0.066, 0.5, 0], [-0.12, 0.056, 0.42, 0], [-0.26, 0.04, 0.24, 0], [-0.36, 0.026, 0.06, 0], [-0.5, 0.016, 0.018, 0], [-0.8, 0.01, 0.01, 0], [-1.15, 0.005, 0.005, 0], [-1.45, 0.002, 0.002, 0]], { NR: 26, NS: 16, belly: 0.4 });
  return m.done();
})();
export const SHOVEL = (() => {
  const m = new Shape((x, y, z) => Math.pow(Math.min(1, Math.max(0, (0.0 - x) / 0.5)), 1.3)).body([[0.56, 0.003, 0.004, 0], [0.5, 0.012, 0.045, 0], [0.4, 0.022, 0.12, 0], [0.26, 0.036, 0.215, 0], [0.12, 0.046, 0.245, 0], [0.0, 0.05, 0.16, 0], [-0.1, 0.05, 0.075, 0.004], [-0.24, 0.042, 0.05, 0.006], [-0.38, 0.028, 0.03, 0.008], [-0.47, 0.02, 0.012, 0.01]], { NR: 22, NS: 14, belly: 0.4 });
  m.tail(0.15, { low: 0.08, spread: 0.85, fork: 0.5 });
  m.surf(6, 5, (t, s) => { const x0 = -0.12 - 0.07 * t; return [x0 - 0.1 * s * s, m.top(x0) - 0.008 + 0.075 * s * (1 - 0.3 * t * s), 0]; }, 1);
  m.surf(6, 5, (t, s) => { const x0 = -0.28 - 0.06 * t; return [x0 - 0.08 * s * s, m.top(x0) - 0.008 + 0.06 * s * (1 - 0.3 * t * s), 0]; }, 1);
  return m.done();
})();
// green turtle: a domed shell, flat underneath; the head and the four flippers are skin (part 2 and 3)
export const TURTLE = (() => {
  const m = new Shape(() => 0).body([[0.5, 0.004, 0.01, 0], [0.47, 0.05, 0.17, 0.0], [0.36, 0.115, 0.3, 0.015], [0.2, 0.17, 0.38, 0.03], [0.02, 0.19, 0.41, 0.03], [-0.16, 0.17, 0.39, 0.022], [-0.32, 0.12, 0.31, 0.008], [-0.44, 0.06, 0.17, 0], [-0.5, 0.01, 0.03, 0]], { NR: 20, NS: 18, belly: 0.3 });
  const shell = m.R; m.body([[0.83, 0.003, 0.003, 0.02], [0.8, 0.04, 0.045, 0.022], [0.72, 0.062, 0.07, 0.03], [0.62, 0.06, 0.068, 0.03], [0.52, 0.045, 0.055, 0.015], [0.42, 0.04, 0.05, 0.0]], { NR: 10, NS: 10, part: 2, flex: () => 0 }); m.R = shell;
  for (const sd of [-1, 1]) {
    m.leaf([0.34, -0.01, sd * 0.3], [0.1, 0, sd * 1], [1, 0, sd * -0.1], 0.78, 0.17, { curl: [-0.55, 0, sd * -0.25], part: 3, flex: (t, s) => s * s, nt: 6, ns: 12, tip: 0.5 });
    m.leaf([-0.36, -0.01, sd * 0.24], [-0.75, 0, sd * 0.66], [0.66, 0, sd * 0.75], 0.3, 0.085, { part: 3, flex: (t, s) => 0.25 * s, tip: 0.6 });
  }
  return m.done();
})();
// dolphins, dugongs and whales beat their tails up and down: the flukes lie flat
function cetacean({ prof, NS = 14, belly = 1, dorsal, flip, fluke, hump }) {
  const m = new Shape().body(prof, { NR: 24, NS, belly });
  if (dorsal) m.surf(10, 8, (t, s) => { const [x0, len, h, sw] = dorsal, x = x0 - len * t; return [x - sw * s * s - len * 0.35 * t * s * (1 - s) * 2, m.top(x) - 0.006 + h * s * (1 - 0.45 * t * s), 0]; }, 1);
  if (hump) m.ridge(hump[0], hump[1], hump[2], { sweep: 1.4, lobe: 1.2 });
  const e = m.R[m.R.length - 1];
  for (const sd of [-1, 1]) {
    m.leaf([e[0] + 0.03, e[3], 0], [-0.42, 0, sd * 0.9], [1, 0, sd * 0.2], fluke[0], fluke[1], { curl: [-0.5, 0, sd * -0.15], flex: () => 1, tip: 0.5, ns: 10 });
    m.leaf([flip[0], m.bot(flip[0], belly) + 0.03, sd * m.row(flip[0])[2] * 0.85], [-0.5, -0.45, sd * 0.74], [0.8, -0.1, sd * 0.55], flip[1], flip[2], { curl: [-0.35, -0.05, 0], flex: (t, s) => 0, tip: 0.55, ns: 10 });
  }
  return m.done();
}
export const DOLPHIN = cetacean({ prof: [[0.56, 0.003, 0.003, -0.02], [0.53, 0.018, 0.02, -0.02], [0.45, 0.026, 0.028, -0.018], [0.4, 0.062, 0.058, 0], [0.3, 0.092, 0.084, 0.006], [0.14, 0.108, 0.098, 0.006], [-0.02, 0.1, 0.09, 0.004], [-0.18, 0.076, 0.064, 0], [-0.32, 0.048, 0.034, 0], [-0.42, 0.028, 0.016, 0], [-0.47, 0.016, 0.02, 0]], dorsal: [0.02, 0.15, 0.12, 0.12], flip: [0.24, 0.17, 0.045], fluke: [0.17, 0.05] });
export const DUGONG = cetacean({ prof: [[0.5, 0.004, 0.004, -0.06], [0.47, 0.055, 0.06, -0.05], [0.4, 0.08, 0.075, -0.02], [0.3, 0.1, 0.1, 0.0], [0.14, 0.14, 0.145, 0.0], [-0.02, 0.15, 0.155, 0], [-0.18, 0.125, 0.12, 0], [-0.32, 0.075, 0.06, 0], [-0.42, 0.036, 0.024, 0], [-0.47, 0.018, 0.03, 0]], belly: 0.9, flip: [0.22, 0.15, 0.05], fluke: [0.19, 0.06] });
export const WHALE = cetacean({ prof: [[0.5, 0.004, 0.006, -0.03], [0.47, 0.04, 0.05, -0.025], [0.38, 0.078, 0.082, -0.015], [0.24, 0.1, 0.1, -0.005], [0.08, 0.108, 0.102, 0], [-0.08, 0.094, 0.084, 0], [-0.22, 0.066, 0.054, 0], [-0.34, 0.04, 0.028, 0], [-0.43, 0.022, 0.014, 0], [-0.47, 0.012, 0.02, 0]], NS: 16, belly: 1.15, hump: [-0.1, -0.2, 0.03], flip: [0.2, 0.3, 0.04], fluke: [0.2, 0.055] });

// ---------------------------------------------------------------- water birds sitting on the sea
// Built from the same smooth pieces; returned as a plain coloured geometry (colours: one per part number).
function bird(build, colours) {
  const m = new Shape(() => 0); m.weld = true; build(m); const d = m.done(), g = new THREE.BufferGeometry(), col = [];
  for (const p of d.part) col.push(...colours[p]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(d.idx);
  return g;
}
// Australian pelican: a big white bird low in the water, black along the folded wings, the neck in an S, a long pink bill with its pouch
export const PELICAN = () => bird((m) => {
  m.body([[0.44, 0.01, 0.02, 0.2], [0.38, 0.09, 0.11, 0.17], [0.22, 0.17, 0.2, 0.13], [0.0, 0.2, 0.235, 0.11], [-0.22, 0.18, 0.2, 0.13], [-0.4, 0.1, 0.11, 0.18], [-0.52, 0.01, 0.02, 0.24]], { NR: 14, NS: 12, belly: 0.75 });
  for (const sd of [-1, 1]) m.leaf([0.12, 0.25, sd * 0.13], [-1, 0.02, sd * 0.1], [0, -0.72, sd * 0.69], 0.66, 0.12, { part: 1, flex: () => 0, curl: [0, -0.08, sd * -0.06] });
  m.tube((t) => [0.3 + 0.075 * Math.sin(t * 3.4) - 0.03 * t, 0.2 + 0.55 * t, 0, 0.068 - 0.022 * t], 10, 8, 0);                                    // neck
  m.tube((t) => [0.27 + 0.22 * t, 0.755 + 0.01 * Math.sin(t * PI), 0, 0.012 + 0.062 * Math.pow(Math.sin(PI * (0.12 + 0.86 * t)), 0.6)], 8, 8, 0);     // head
  m.tube((t) => [0.45 + 0.5 * t, 0.745 - 0.16 * t - 0.03 * t * t, 0, 0.03 - 0.02 * t], 8, 6, 2);                                                   // upper bill
  m.tube((t) => [0.44 + 0.46 * t, 0.705 - 0.15 * t, 0, 0.008 + 0.042 * Math.pow(Math.sin(PI * (0.08 + 0.9 * t)), 0.7)], 8, 6, 3);                  // pouch
  m.tube((t) => [0.415 + 0.012 * t, 0.775, 0, 0.074 * Math.sin(PI * t)], 3, 6, 4);                                                                 // eye ring (a dark band round the head)
}, [[.93, .93, .9], [.04, .04, .045], [.92, .62, .56], [.95, .8, .62], [.75, .65, .2]]);
// the same bird on the wing: neck folded back so the head rides on the shoulders, the long bill out ahead, feet trailing
export const PELICAN_FLY = () => bird((m) => {
  m.body([[0.5, 0.01, 0.02, 0.05], [0.42, 0.09, 0.1, 0.04], [0.24, 0.15, 0.17, 0.02], [0.0, 0.16, 0.19, 0.0], [-0.24, 0.13, 0.15, 0.0], [-0.44, 0.07, 0.09, 0.02], [-0.6, 0.01, 0.05, 0.03]], { NR: 14, NS: 12 });
  m.tube((t) => [0.34 + 0.16 * t, 0.1 + 0.1 * Math.sin(t * PI), 0, 0.07 - 0.015 * t], 6, 8, 0);                                                      // the folded neck
  m.tube((t) => [0.44 + 0.2 * t, 0.12 + 0.01 * Math.sin(t * PI), 0, 0.012 + 0.06 * Math.pow(Math.sin(PI * (0.12 + 0.86 * t)), 0.6)], 8, 8, 0);     // head
  m.tube((t) => [0.6 + 0.5 * t, 0.115 - 0.07 * t, 0, 0.028 - 0.019 * t], 8, 6, 2);                                                                 // bill
  m.tube((t) => [0.6 + 0.44 * t, 0.075 - 0.06 * t, 0, 0.008 + 0.036 * Math.pow(Math.sin(PI * (0.08 + 0.9 * t)), 0.7)], 8, 6, 3);                   // pouch
  for (const sd of [-1, 1]) m.tube((t) => [-0.5 - 0.3 * t, -0.03 - 0.02 * t, sd * 0.05, 0.022 - 0.008 * t], 4, 5, 4);                               // legs trailing
  m.leaf([-0.52, 0.03, 0], [-1, 0.02, 0], [0, 0, 1], 0.22, 0.12, { part: 1, flex: () => 0 });                                                      // tail
}, [[.93, .93, .9], [.04, .04, .045], [.92, .62, .56], [.95, .8, .62], [.45, .5, .55]]);
// one wing, hinged at the shoulder (the origin) and reaching out along +z: white coverts in front, black flight feathers behind and at the tip
export const PELICAN_WING = () => bird((m) => {
  m.leaf([0.1, 0, 0.02], [-0.08, 0.02, 1], [1, 0, 0.04], 1.28, 0.17, { part: 0, flex: () => 0, curl: [-0.28, -0.1, 0], ns: 12, tip: 0.6 });
  m.leaf([-0.12, -0.005, 0.02], [-0.1, 0.02, 1], [1, 0, 0.0], 1.36, 0.2, { part: 1, flex: () => 0, curl: [-0.34, -0.1, 0], ns: 12, tip: 0.55 });
}, [[.93, .93, .9], [.04, .04, .045]]);
// little pied / pied cormorant: black above, low in the water, the thin neck up and the hooked bill tilted
export const CORMORANT = () => bird((m) => {
  m.body([[0.3, 0.01, 0.015, 0.07], [0.24, 0.05, 0.07, 0.06], [0.1, 0.08, 0.1, 0.04], [-0.08, 0.08, 0.1, 0.04], [-0.24, 0.05, 0.06, 0.05], [-0.42, 0.01, 0.03, 0.05]], { NR: 12, NS: 10, belly: 0.8 });
  m.tube((t) => [0.2 + 0.07 * Math.sin(t * 3.2) + 0.04 * t, 0.07 + 0.36 * t, 0, 0.036 - 0.012 * t], 9, 7, 0);
  m.tube((t) => [0.21 + 0.13 * t, 0.435 + 0.03 * t, 0, 0.008 + 0.03 * Math.pow(Math.sin(PI * (0.12 + 0.86 * t)), 0.6)], 6, 7, 0);
  m.tube((t) => [0.32 + 0.13 * t, 0.46 + 0.035 * t - 0.03 * t * t * t, 0, 0.013 - 0.008 * t], 6, 5, 1);
}, [[.05, .05, .06], [.75, .6, .2]]);

// ---------------------------------------------------------------- how each kind is painted
// body: GLSL run for the skin of the body (u nose to tail, tone back to belly, n and n2 are noise, alb the colour so far); fin: the same for fins.
const BARS = (n, from, step, w) => `{ float bu = (u + (tone - 0.5) * 0.05 - ${from}) / ${step}; float bar = smoothstep(${w}, ${w} - 0.12, abs(fract(bu) - 0.5) * (1.0 + 0.9 * tone)) * step(0.0, bu) * step(bu, ${n}.0) * smoothstep(0.97, 0.7, tone); alb = mix(alb, vec3(0.025, 0.03, 0.045), bar); }`;
export const PAINT = {
  // yellowfin bream: silver, darker along the back, faint bars, yellow lower fins
  bream: { body: `alb *= 1.0 - 0.12 * smoothstep(0.32, 0.0, abs(fract(u * 6.0) - 0.5)) * (1.0 - tone); alb = mix(alb, vec3(0.75, 0.66, 0.3), 0.25 * smoothstep(0.6, 0.9, tone));`, fin: `if(vL.y < -0.02 && !side) alb = mix(alb, vec3(0.85, 0.68, 0.12), 0.75);`, scales: 44 },
  // Indo-Pacific sergeant (Abudefduf vaigiensis): pale blue-silver, a yellow wash over the back, five black bars
  sergeant: { body: `alb = mix(alb, vec3(0.90, 0.78, 0.10), smoothstep(0.45, 0.05, tone) * smoothstep(0.12, 0.3, u) * (1.0 - smoothstep(0.62, 0.9, u)) * 0.85); ${BARS(5, '0.185', '0.142', '0.3')}`, fin: `alb = mix(alb, vec3(0.04), smoothstep(0.5, 1.0, vUV.y) * 0.6 * float(!side));`, scales: 38 },
  // neon damsel (Pomacentrus coelestis): electric blue, yellow under the tail end and on the tail
  neon: { body: `alb = mix(vec3(0.02, 0.22, 0.95), vec3(0.08, 0.55, 1.0), n) * 1.25; alb = mix(alb, vec3(0.98, 0.82, 0.08), clamp(smoothstep(0.55, 0.85, tone) * smoothstep(0.3, 0.62, u) + smoothstep(0.84, 0.94, u), 0.0, 1.0)); glow = 0.35;`, fin: `alb = side ? vec3(0.45, 0.68, 1.0) : (vL.x < -0.32 || vL.y < -0.02) ? vec3(0.98, 0.82, 0.08) : vec3(0.04, 0.3, 1.0); glow = 0.3;`, scales: 44 },
  // humbug dascyllus (Dascyllus aruanus): white with three black bars
  humbug: { body: `{ float uu = u + (tone - 0.5) * 0.09; float b = max(max(smoothstep(0.035, 0.065, uu) * smoothstep(0.235, 0.2, uu), smoothstep(0.38, 0.41, uu) * smoothstep(0.6, 0.57, uu)), smoothstep(0.74, 0.77, uu) * smoothstep(0.93, 0.9, uu)); alb = mix(vec3(0.86, 0.87, 0.84), vec3(0.02, 0.022, 0.03), b); }`, fin: `alb = side ? vec3(0.7, 0.72, 0.7) : (vL.x > -0.3) ? vec3(0.03) : vec3(0.8, 0.82, 0.8);`, scales: 36 },
  // hardyheads and other baitfish: glassy, with a bright stripe along the side
  bait: { body: `alb = mix(alb, vec3(0.92, 0.97, 1.0), smoothstep(0.1, 0.02, abs(tone - 0.48)) * 0.9);`, fin: `alb *= 1.2;`, scales: 40 },
  whiting: { body: `alb *= 0.86 + 0.28 * n; alb = mix(alb, alb * 0.75, smoothstep(0.55, 0.75, n2) * (1.0 - tone) * 0.6);`, fin: `alb = mix(alb, vec3(0.86, 0.72, 0.22), 0.55);`, scales: 44 },
  // dusky flathead: mottled like the sand it lies on
  flathead: { body: `alb = mix(alb, vec3(0.16, 0.12, 0.07), smoothstep(0.45, 0.7, n) * (1.0 - tone) * 0.8); alb *= 0.75 + 0.5 * n2; alb *= 1.0 - 0.25 * smoothstep(0.3, 0.1, abs(fract(u * 4.0 + 0.2) - 0.5)) * (1.0 - tone);`, fin: `alb *= 0.6 + 0.6 * step(0.5, fract(vUV.y * 3.0));`, scales: 50, top: 1 },
  // a small whaler shark: bronze-grey above, white below, dark tips to the fins, five gill slits
  shark: { body: `alb = mix(uColA, uColB, smoothstep(0.50, 0.58, tone + (n - 0.5) * 0.05)); { float gu = (u - 0.215) / 0.022; alb *= 1.0 - 0.5 * smoothstep(0.2, 0.08, abs(fract(gu) - 0.5)) * step(0.0, gu) * step(gu, 5.0) * smoothstep(0.2, 0.35, tone) * smoothstep(0.62, 0.5, tone); }`, fin: `alb = mix(alb, vec3(0.03, 0.035, 0.04), smoothstep(0.62, 0.96, vUV.y));`, shade: [0.5, 0.58], gill: 0 },
  shovel: { body: `alb *= 0.85 + 0.3 * n; alb = mix(alb, uColB, smoothstep(0.6, 1.0, abs(vL.z) / 0.25) * 0.5 * (1.0 - tone)); alb = mix(alb, vec3(0.85, 0.82, 0.7), smoothstep(0.6, 0.85, n2) * 0.25 * (1.0 - tone));`, fin: ``, top: 1 },
  // bluespotted maskray: sandy grey-brown with scattered blue spots and a dark band across the eyes
  ray: { body: `{ vec2 q = vL.xz * 8.0; vec2 f = fract(q) - 0.5; float hs = hash12(floor(q) + 3.0); float spot = smoothstep(0.2, 0.13, length(f + (vec2(hs, fract(hs * 7.3)) - 0.5) * 0.45)) * step(0.5, hs) * (1.0 - tone) * step(-0.3, vL.x); alb *= 0.82 + 0.36 * n; alb = mix(alb, vec3(0.16, 0.42, 0.85), spot * 0.9); alb = mix(alb, uColA * 0.45, smoothstep(0.06, 0.02, abs(vL.x - 0.3)) * smoothstep(0.2, 0.1, abs(vL.z)) * (1.0 - tone)); alb = mix(alb, uColB, smoothstep(0.8, 1.0, abs(vL.z) / 0.5) * 0.4); }`, fin: ``, top: 1 },
  // green turtle: shell of scutes, each with a sunburst of streaks, dark seams between; scaly skin with pale edges
  turtle: {
    body: `if(vPart < 0.5){ if(tone < 0.62){ vec2 q = vec2(vL.x * 4.6 + 0.2, abs(vL.z) * 4.4); float side = step(0.6, q.y); q.x += 0.5 * side; vec2 c = vec2(fract(q.x) - 0.5, side > 0.5 ? (q.y - 1.15) / 1.1 : q.y / 1.2);
        float seam = min(0.5 - abs(c.x), abs(q.y - 0.6)); float rim = smoothstep(0.86, 0.93, length(vec2(vL.x / 0.5, vL.z / 0.41)));
        float burst = 0.5 + 0.5 * sin(atan(c.y, c.x) * 13.0 + n * 6.0);
        alb = mix(vec3(0.13, 0.10, 0.05), vec3(0.30, 0.23, 0.10), burst * burst * (0.3 + 0.7 * n2) * smoothstep(0.02, 0.3, length(c))); alb = mix(alb, vec3(0.17, 0.16, 0.07), 0.5 * n);
        alb *= 0.45 + 0.55 * smoothstep(0.0, 0.07, seam); alb = mix(alb, vec3(0.12, 0.09, 0.05), rim * 0.6); alb *= 0.6; gloss = 0.5; }
      else alb = vec3(0.72, 0.66, 0.42) * (0.8 + 0.3 * n); }
      else { vec2 q = vUV * (vPart > 2.5 ? vec2(6.0, 17.0) : vec2(11.0, 9.0)) + (n2 - 0.5) * 0.35; q.x += 0.5 * floor(q.y); vec2 f = abs(fract(q) - 0.5); float edge = smoothstep(0.455, 0.497, max(f.x, f.y));
        alb = mix(vec3(0.075, 0.062, 0.036) * (0.7 + 0.6 * n), vec3(0.30, 0.27, 0.17), edge); if(vPart < 2.5 && tone > 0.6) alb = vec3(0.7, 0.66, 0.46); }`, fin: ``, top: 1,
  },
  // bottlenose dolphin: dark grey cape, paler flanks, pinkish-white belly
  dolphin: { body: `alb = mix(uColA, mix(uColA, uColB, 0.45), smoothstep(0.26, 0.42, tone + 0.07 * sin(u * 9.0))); alb = mix(alb, uColB, smoothstep(0.6, 0.82, tone)); alb *= 0.93 + 0.14 * n; gloss = 0.9;`, fin: `alb = uColA * 0.9; gloss = 0.7;`, shade: [0.3, 0.8], gill: 0 },
  dugong: { body: `alb *= 0.82 + 0.36 * n; alb = mix(alb, uColB * 1.05, smoothstep(0.6, 0.85, n2) * 0.25); alb *= 1.0 - 0.05 * smoothstep(0.2, 0.0, abs(fract(u * 9.0 + n * 0.9) - 0.5)) * smoothstep(0.2, 0.6, u); alb = mix(alb, uColB, 0.3 * smoothstep(0.12, 0.0, u)); gloss = 0.5;`, fin: `alb = uColA * 0.85;`, shade: [0.35, 0.9], gill: 0 },
  // humpback: black above, white below with a ragged edge, long grooves down the throat
  whale: { body: `alb = mix(uColA, uColB, smoothstep(0.56, 0.62, tone + (n - 0.5) * 0.22 + (n2 - 0.5) * 0.08)); alb *= 1.0 - 0.22 * smoothstep(0.25, 0.05, abs(fract(vL.z * 46.0) - 0.5)) * smoothstep(0.62, 0.75, tone) * smoothstep(0.6, 0.45, u); alb = mix(alb, vec3(0.5, 0.5, 0.46), smoothstep(0.74, 0.84, n2) * smoothstep(0.3, 0.05, u) * 0.4); gloss = 0.9;`, fin: `alb = mix(uColB, uColA, smoothstep(0.3, 0.7, n + (vUV.y - 0.5) * 0.6)); gloss = 0.7;`, shade: [0.5, 0.6], gill: 0 },
};

// Each animal swims a wobbly loop around a home point. list: [cx, cz, radius, depth, phase, speed, size, seed] per animal.
// o: mesh, paint, colA (back), colB (belly), colC (fins), eye [x, y, radius], amp and rate of the swimming beat, vertical (beats up and down),
// bottom (lies on the sand), tidal, min (water it needs), rise [how far out of the water, how often], see (how far away it is drawn).
export function swimmers(scene, o, list) {
  const g = new THREE.InstancedBufferGeometry(), n = list.length / 8, a = new Float32Array(n * 4), b = new Float32Array(n * 4), F = (arr, k) => new THREE.Float32BufferAttribute(arr, k), P = o.paint || {};
  for (let i = 0; i < n; i++) { a.set(list.slice(i * 8, i * 8 + 4), i * 4); b.set(list.slice(i * 8 + 4, i * 8 + 8), i * 4); }
  g.setAttribute('position', F(o.pos, 3)); g.setAttribute('normal', F(o.nrm, 3)); g.setAttribute('aUV', F(o.uv, 2)); g.setAttribute('aFlex', F(o.flex, 1)); g.setAttribute('aPart', F(o.part, 1)); g.setIndex(o.idx);
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(b, 4)); g.instanceCount = n; g.boundingSphere = FAR;
  const V3 = (c) => new THREE.Vector3(...c), sh = P.shade || [0.2, 0.66], eye = o.eye || [0.37, 0.035, 0.03];
  const mat = makeMat({
    side: THREE.DoubleSide,
    uniforms: { uFlap: { value: new THREE.Vector4(o.vertical ? 1 : 0, o.amp, o.rate, o.bottom ? 1 : 0) }, uColA: { value: V3(o.colA) }, uColB: { value: V3(o.colB) }, uColC: { value: V3(o.colC || o.colA) }, uSee: { value: o.see }, uNeed: { value: new THREE.Vector2(o.min ?? 0.9, o.tidal ? 1 : 0) }, uRise: { value: new THREE.Vector2(...(o.rise || [0, 0])) }, uEye: { value: V3(eye) } },
    vs: /* glsl */`
      attribute float aFlex, aPart; attribute vec2 aUV; attribute vec4 iA, iB; uniform vec4 uFlap; uniform float uSee; uniform vec2 uNeed, uRise;
      varying vec3 vW, vN, vL; varying vec2 vUV; varying float vPart, vSeed;
      void main(){
        float way = iB.w < 0.5 ? 1.0 : -1.0, ang = iB.x + uTime * iB.y / iA.z * way, wob = ang * 3.0 + iB.w * 9.0;
        float rr = iA.z * (1.0 + 0.25 * sin(wob));
        vec2 c = iA.xy + vec2(cos(ang), sin(ang)) * rr;
        vec2 fwd = normalize(vec2(-sin(ang), cos(ang)) * rr + vec2(cos(ang), sin(ang)) * iA.z * 0.75 * cos(wob)) * way, right = vec2(-fwd.y, fwd.x);
        float sea = uSeaM * uVex, bed = groundY(c), size = iB.z;
        float y = uFlap.w > 0.5 ? bed + 0.06 * size : min(max(bed + 0.4 * size, sea - iA.w * uVex), sea - 0.16 * size);
        // now and then it arcs up until its back breaks the surface, nose first, then slides under again
        float rp = uTime * uRise.y * (0.8 + 0.4 * iB.w) + iB.x * 5.0, up = pow(max(sin(rp), 0.0), 3.0) * step(0.0001, uRise.x);
        y = mix(y, sea + uRise.x * size, up);
        float pitch = cos(rp) * sqrt(up) * 0.5;
        // it needs enough water over the sand at this state of the tide; some kinds come into the shallows mostly when the tide is out
        float ok = step(bed, sea - uNeed.x * uVex) * (1.0 - smoothstep(uSee * 0.7, uSee, length(vec3(c.x, y, c.y) - cameraPosition)));
        ok *= mix(1.0, step(fract(iB.w * 13.7), mix(0.3, 1.0, smoothstep(0.1, -0.6, uSeaM))), uNeed.y);
        vec3 lp = position * size, nr = normal;
        // the swimming beat runs down the body as a wave, so it curves from head to tail (wings and flippers beat from the root out)
        float ph = uTime * uFlap.z * (0.8 + 0.4 * iB.w) + iB.x * 7.0, wave = aPart > 2.5 ? -aUV.y * 2.2 : uFlap.x > 0.5 && uFlap.w < 0.5 && aPart < 1.5 ? position.x * 5.5 : uFlap.x > 0.5 ? -abs(position.z) * 3.0 : position.x * 5.5;
        float beat = sin(ph + wave) * aFlex * uFlap.y * size, lean = cos(ph + wave) * aFlex * uFlap.y;
        if(uFlap.x > 0.5){ lp.y += beat; nr.x -= lean * 2.0; } else { lp.z += beat + position.x * position.x * size * size * 0.45 / rr * way; nr.x -= lean * 2.0 * sign(nr.z + 1e-4); }       // and it bends into its turn
        float cp = cos(pitch), sp = sin(pitch);
        lp.xy = vec2(lp.x * cp - lp.y * sp, lp.x * sp + lp.y * cp); nr.xy = vec2(nr.x * cp - nr.y * sp, nr.x * sp + nr.y * cp);
        vec3 wp = vec3(c.x, y, c.y) + vec3(fwd.x, 0.0, fwd.y) * lp.x + vec3(0.0, 1.0, 0.0) * lp.y + vec3(right.x, 0.0, right.y) * lp.z;
        vN = vec3(fwd.x, 0.0, fwd.y) * nr.x + vec3(0.0, 1.0, 0.0) * nr.y + vec3(right.x, 0.0, right.y) * nr.z;
        vW = wp; vL = position; vUV = aUV; vPart = aPart; vSeed = iB.w;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`
      uniform vec3 uColA, uColB, uColC, uEye; varying vec3 vW, vN, vL; varying vec2 vUV; varying float vPart, vSeed;
      void main(){
        ${LOGF}
        vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
        float u = vUV.x, tone = vUV.y, gloss = 0.3, glow = 0.0;
        float n = texture2D(uNoise, vL.xy * 0.9 + vL.z * 0.6 + vSeed).r, n2 = texture2D(uNoise, vL.xz * 2.7 + vL.y * 2.1 + vSeed * 3.0).g;
        vec3 alb;
        if(vPart < 0.5 || vPart > 1.5){
          alb = mix(uColA, uColB, smoothstep(${sh[0].toFixed(2)}, ${sh[1].toFixed(2)}, tone)) * (0.88 + 0.24 * fract(vSeed * 7.3));
          ${P.body || ''}
          ${P.scales ? `{ vec2 sc = vec2(u * ${P.scales}.0, tone * ${Math.round(P.scales * 0.42)}.0); sc.x += 0.5 * floor(sc.y); vec2 sf = fract(sc) - vec2(0.62, 0.5);
            alb *= 1.0 - 0.12 * smoothstep(0.3, 0.52, length(sf * vec2(1.0, 1.15))) * (1.0 - smoothstep(0.25, 0.8, fwidth(sc.x) + fwidth(sc.y))) * step(0.16, u);
            gloss += 0.5; }` : ''}
          if(vPart < 0.5 || (vPart > 1.5 && vPart < 2.5)){                 // the eye: a dark pupil in a pale ring; and the edge of the gill cover behind it
            vec2 e = (${P.top ? 'vec2(vL.x, abs(vL.z))' : 'vL.xy'} - uEye.xy) / uEye.z; float er = length(e);
            if(er < 1.0){ alb = er < 0.55 ? vec3(0.008) : mix(vec3(0.75, 0.68, 0.45), vec3(0.2, 0.17, 0.1), smoothstep(0.6, 1.0, er)); gloss = 1.6; }
            ${P.top || P.gill === 0 ? '' : 'alb *= 1.0 - 0.3 * smoothstep(0.012, 0.004, abs(vL.x - uEye.x + 0.11 + vL.y * vL.y * 3.5)) * step(abs(vL.y), 0.11);'}
          }
        } else {
          // fins: fine rays running out from the root, thin enough for the light to come through
          bool side = abs(vL.z) > 0.07;                                 // the fins at the sides are clearer than the rest
          alb = uColC * (0.72 + 0.28 * sin(vUV.x * 70.0)) * (0.85 + 0.3 * n); if(side) alb = mix(alb, vec3(0.62, 0.66, 0.64), 0.5);
          ${P.fin || ''}
        }
        float cs = cloudShadow(vW), dw = max((uSeaM * uVex - vW.y) / uVex, 0.0);
        vec3 light = uLightCol * (0.16 + 0.6 * max(dot(N, normalize(uLightDir + vec3(0.0, 0.7, 0.0))), 0.0)) * cs + uAmbSky * (0.6 + 0.4 * N.y);
        float ca = texture2D(uNoise, vW.xz * 0.23 + uTime * vec2(0.031, 0.02)).r * texture2D(uNoise, vW.xz * 0.17 - uTime * vec2(0.024, 0.03)).g;       // ripples of light from the surface
        light += uLightCol * smoothstep(0.16, 0.42, ca) * 0.8 * max(N.y, 0.0) * step(0.001, dw) * exp(-dw * 0.3) * cs * smoothstep(0.0, 0.2, uLightDir.y);
        vec3 col = alb * light + alb * glow * (uLightCol * 0.2 + uAmbSky);
        vec3 V = normalize(cameraPosition - vW);
        col += gloss * (uLightCol * pow(max(dot(reflect(-V, N), normalize(uLightDir + vec3(0.0, 0.5, 0.0))), 0.0), 22.0) * 0.22 * cs + uAmbSky * 0.25 * pow(1.0 - max(dot(N, V), 0.0), 3.0));
        if(dw > 0.0){ vec3 Tm = exp(-vec3(0.42, 0.082, 0.105) * dw * 2.3); col = col * Tm + vec3(0.012, 0.20, 0.18) * (uLightCol * 0.3 + uAmbSky * 0.8) * (1.0 - Tm); }
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = o.name; m.frustumCulled = false; scene.add(m);
  return m;
}

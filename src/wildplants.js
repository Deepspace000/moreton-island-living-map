// The island's wildflowers and bush-tucker plants (the owner's list): wallum banksia, saw banksia, heathy parrot pea, beaked parrot pea, wedding bush,
// devil's rice, showy guinea flower, native sarsaparilla, wallum geebung, mat rush, blue flax lily, cotton tree, and the weed asparagus fern.
// Each is built from curved branches, strap leaves, needle leaves and real flowers (petals, cones, sprays, berries), then planted by the GPU in a grid that
// follows the viewer, the way the grass trees are: a species is chosen for each cell from where it is (dune, heath, damp ground, the back of a beach).
import * as THREE from 'three';
import { makeMat, gridBlocks, rng, dq, MOBILE, LOGV, LOGF } from './common.js';

const PI = Math.PI;
// ---- a tiny mesh builder: everything is triangles with a colour per corner, a species number and the height up the plant (for the sway in the wind)
class Kit {
  constructor() { this.pos = []; this.col = []; this.sp = []; this.hh = []; this.idx = []; this.cur = 0; }
  v(p, c, hgt = 0) { this.pos.push(p[0], p[1], p[2]); this.col.push(c[0], c[1], c[2]); this.sp.push(this.cur); this.hh.push(hgt); return this.pos.length / 3 - 1; }
  tri(a, b, c, ca, cb, cc, ha = 0, hb = 0, hc = 0) { const i = this.v(a, ca, ha), j = this.v(b, cb || ca, hb), k = this.v(c, cc || ca, hc); this.idx.push(i, j, k); }
  quad(a, b, c, d, col, h = 0) { const i = this.v(a, col, h), j = this.v(b, col, h), k = this.v(c, col, h), l = this.v(d, col, h); this.idx.push(i, j, k, i, k, l); }
  // a round stem along path(t) -> [x, y, z, radius], with sides of its own and a colour that runs from the first to the second
  tube(path, nt, ns, c0, c1) {
    const rows = [];
    for (let i = 0; i <= nt; i++) { const t = i / nt, p = path(t), q = path(Math.min(1, t + 0.02)), r = path(Math.max(0, t - 0.02)); let d = [q[0] - r[0], q[1] - r[1], q[2] - r[2]]; const l = Math.hypot(...d) || 1; d = d.map(x => x / l);
      let a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let u = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]]; const ul = Math.hypot(...u) || 1; u = u.map(x => x / ul); const w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
      const row = []; for (let k = 0; k < ns; k++) { const an = k / ns * PI * 2, cs = Math.cos(an) * p[3], sn = Math.sin(an) * p[3]; row.push(this.v([p[0] + u[0] * cs + w[0] * sn, p[1] + u[1] * cs + w[1] * sn, p[2] + u[2] * cs + w[2] * sn], mixc(c0, c1, t) , p[1])); } rows.push(row); }
    for (let i = 0; i < nt; i++) for (let k = 0; k < ns; k++) { const k2 = (k + 1) % ns; this.idx.push(rows[i][k], rows[i + 1][k], rows[i][k2], rows[i][k2], rows[i + 1][k], rows[i + 1][k2]); }
  }
  // a strap leaf or blade: from a base point along a curve that arches and droops, tapering to a tip; width is the full width at its broadest
  blade(base, az, el, len, wid, cA, cB, droop = 0.5, segs = 3) {
    const ca = Math.cos(az), sa = Math.sin(az); let prev = null;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs, out = len * t * Math.cos(el), y = len * t * Math.sin(el) - droop * len * t * t, w = wid * 0.5 * Math.pow(Math.sin(PI * Math.min(0.98, 0.08 + t * 0.92)), 0.55) * (j === segs ? 0 : 1);
      const px = base[0] + ca * out, pz = base[2] + sa * out, py = base[1] + y, c = mixc(cA, cB, t), nx = -sa * w, nz = ca * w;
      const a = this.v([px - nx, py, pz - nz], c, py), b = this.v([px + nx, py, pz + nz], c, py); if (prev) this.idx.push(prev[0], prev[1], a, a, prev[1], b); prev = [a, b];
    }
  }
  // a flower of n petals lying open about a point, the face tilted toward dir, with a centre of another colour
  flower(c, size0, n, col, mid, tilt = [0, 1, 0], pw = 0.45) {
    const size = size0 * 3.0;
    const t = tilt, l = Math.hypot(...t) || 1, N = [t[0] / l, t[1] / l, t[2] / l]; let u = Math.abs(N[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let X = [N[1] * u[2] - N[2] * u[1], N[2] * u[0] - N[0] * u[2], N[0] * u[1] - N[1] * u[0]]; const xl = Math.hypot(...X) || 1; X = X.map(x => x / xl); const Y = [N[1] * X[2] - N[2] * X[1], N[2] * X[0] - N[0] * X[2], N[0] * X[1] - N[1] * X[0]];
    const P = (r, an, lift = 0) => [c[0] + (X[0] * Math.cos(an) + Y[0] * Math.sin(an)) * r + N[0] * lift, c[1] + (X[1] * Math.cos(an) + Y[1] * Math.sin(an)) * r + N[1] * lift, c[2] + (X[2] * Math.cos(an) + Y[2] * Math.sin(an)) * r + N[2] * lift];
    for (let i = 0; i < n; i++) { const a1 = (i + 0.5) / n * PI * 2, w = PI * 2 / n * 0.5, cc = mixc(col, [0.5, 0.45, 0.2], 0.25), lf = size * 0.14, c0 = P(size * 0.1, a1), Lq = P(size * 0.62, a1 - w, lf * 0.5), L2 = P(size * 0.96, a1 - w * 0.5, lf), Tq = P(size, a1, lf * 1.2), R2 = P(size * 0.96, a1 + w * 0.5, lf), Rq = P(size * 0.62, a1 + w, lf * 0.5); this.tri(c0, Lq, L2, cc, col, col); this.tri(c0, L2, Tq, cc, col, col); this.tri(c0, Tq, R2, cc, col, col); this.tri(c0, R2, Rq, cc, col, col); }
    this.tri(P(size * 0.2, 0, 0.004), P(size * 0.2, 2.1, 0.004), P(size * 0.2, 4.2, 0.004), mid, mid, mid);
  }
  // a cylinder of flower, like a banksia's: rings of colour from its base to its tip
  spike(base, dir, len, r, cA, cB, ns = 7, nt = 4, taper = 0.7) { const d = dir, l = Math.hypot(...d); this.tube((t) => [base[0] + d[0] / l * len * t, base[1] + d[1] / l * len * t, base[2] + d[2] / l * len * t, r * (t < 0.1 ? 0.6 + 4 * t : t > 0.9 ? Math.max(0.1, 1 - (t - 0.9) * 8 * (1 - taper)) : 1)], nt, ns, cA, cB); }
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const jit = (c, R, k = 0.12) => { const f = 1 + (R() - 0.5) * k * 2; return [c[0] * f, c[1] * f, c[2] * f]; };

export const SPECIES = ['wallum banksia', 'saw banksia', 'heathy parrot pea', 'beaked parrot pea', 'wedding bush', "devil's rice", 'showy guinea flower', 'native sarsaparilla', 'wallum geebung', 'mat rush', 'blue flax lily', 'cotton tree', 'asparagus fern'];
export function build() {
  const K = new Kit(), R = rng(2026);
  const LEAF = [0.07, 0.15, 0.05], LEAF2 = [0.14, 0.24, 0.08], BARK = [0.1, 0.085, 0.075], WOOD = [0.16, 0.12, 0.08];
  // a bundle of fine needle leaves along a stem: thin triangles
  const FT = () => { const q = R() * 6.283; return [Math.cos(q), 0.3 + 0.3 * R(), Math.sin(q)]; };
  const needles = (p0, p1, n0, len, col, wd = 0.011) => { const n = Math.round(n0 * 3.4); for (let i = 0; i < n; i++) { const t = (i + R()) / n, b = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t], a = R() * 6.283, el = 0.3 + R() * 0.7, l = len * 1.4 * (0.7 + R() * 0.6);
    if (i % 4 === 0) { const L2 = len * 2.4, e2 = 0.5 + R() * 0.6, tp = [b[0] + Math.cos(a) * L2 * Math.cos(e2), b[1] + L2 * Math.sin(e2), b[2] + Math.sin(a) * L2 * Math.cos(e2)]; K.tube((t) => [b[0] + (tp[0] - b[0]) * t, b[1] + (tp[1] - b[1]) * t, b[2] + (tp[2] - b[2]) * t, 0.003 * (1 - 0.7 * t)], 2, 3, [0.17, 0.14, 0.08], [0.13, 0.17, 0.08]); for (let q = 0; q < 6; q++) { const t2 = 0.2 + q * 0.14, c2 = [b[0] + (tp[0] - b[0]) * t2, b[1] + (tp[1] - b[1]) * t2, b[2] + (tp[2] - b[2]) * t2], a3 = a + (q % 2 ? 1.2 : -1.2), t3 = [c2[0] + Math.cos(a3) * len * 0.9, c2[1] + len * 0.5, c2[2] + Math.sin(a3) * len * 0.9]; K.tri([c2[0] - wd, c2[1], c2[2]], [c2[0] + wd, c2[1], c2[2] + wd], t3, jit(col, R, 0.18), jit(col, R, 0.18), mixc(col, [0.4, 0.5, 0.2], 0.4), c2[1], c2[1], t3[1]); } }
    const tip = [b[0] + Math.cos(a) * l * Math.cos(el), b[1] + l * Math.sin(el), b[2] + Math.sin(a) * l * Math.cos(el)]; K.tri([b[0] - wd, b[1], b[2]], [b[0] + wd, b[1], b[2] + wd], tip, jit(col, R, 0.18), jit(col, R, 0.18), mixc(col, [0.4, 0.5, 0.2], 0.4), b[1], b[1], tip[1]); } };
  // a stem that rises, leans and bows: returns its path
  const stem = (x, z, h, lean, az, r0, bow = 0.4) => (t) => [x + Math.cos(az) * lean * h * (0.6 * t + 0.4 * t * t), h * t - bow * h * t * t * 0.4, z + Math.sin(az) * lean * h * (0.6 * t + 0.4 * t * t), r0 * (1 - 0.8 * t)];
  // ---- 0 wallum banksia: a gnarled, many-limbed small tree, stiff dark toothed leaves in rosettes, golden cone-flowers standing up from the ends of the twigs
  K.cur = 0;
  { K.tube((t) => { const q = stem(0, 0, 1.5, 0.3, 0.4, 0.1, 0.1)(t); q[3] += 0.07 * Math.exp(-10 * t); return q; }, 9, 8, BARK, BARK); for (let l = 0; l < 6; l++) { const az = l * 1.05 + 0.3, h0 = 1.0 + l * 0.1, top = [Math.cos(az) * (0.7 + R() * 0.3), 2.4 + R() * 0.9, Math.sin(az) * (0.7 + R() * 0.3)];
      { const q = stem(0, 0, 1.5, 0.3, 0.4, 0.1, 0.1)(h0 / 1.5); K.tube((t) => [q[0] + (top[0] - q[0]) * t * t + 0.06 * Math.sin(t * 6), q[1] + (top[1] - q[1]) * t, q[2] + (top[2] - q[2]) * t * t + 0.05 * Math.cos(t * 5), 0.06 * (1 - 0.85 * t)], 6, 6, BARK, WOOD); }
      for (let k = 0; k < 55; k++) { const a = R() * 6.283, el = 0.25 + R() * 0.9; K.blade([top[0], top[1] - 0.04, top[2]], a, el, 0.3 + R() * 0.14, 0.07, jit(LEAF, R), mixc(LEAF2, [0.3, 0.28, 0.1], 0.3), 0.15, 2); }                                  // the rosette of leaves
      K.spike([top[0], top[1] + 0.02, top[2]], [0.05 * (R() - 0.5), 1, 0.05 * (R() - 0.5)], 0.4 + R() * 0.08, 0.08, [0.7, 0.55, 0.04], [0.9, 0.72, 0.08], 10, 6, 0.5); for (let j = 0; j < 50; j++) { const t = 0.05 + R() * 0.85, an = R() * 6.283, c0 = [top[0] + Math.cos(an) * 0.07, top[1] + 0.02 + 0.42 * t, top[2] + Math.sin(an) * 0.07], tp = [c0[0] + Math.cos(an) * 0.04, c0[1] + 0.014, c0[2] + Math.sin(an) * 0.04]; K.tri([c0[0] - 0.006, c0[1], c0[2]], [c0[0] + 0.006, c0[1] + 0.01, c0[2]], tp, [0.6, 0.45, 0.03], [0.85, 0.7, 0.08], [0.95, 0.85, 0.3]); } }                  // the golden flower
    { const tq = stem(0, 0, 1.5, 0.3, 0.4, 0.1, 0.1)(0.82); K.spike([tq[0] + 0.05, tq[1], tq[2] + 0.04], [0.5, 0.6, 0.3], 0.14, 0.04, [0.12, 0.09, 0.07], [0.2, 0.15, 0.1], 7, 3, 0.8); const t2 = stem(0, 0, 1.5, 0.3, 0.4, 0.1, 0.1)(0.62); K.spike([t2[0] - 0.05, t2[1], t2[2] - 0.03], [-0.6, 0.6, -0.2], 0.12, 0.036, [0.12, 0.09, 0.07], [0.2, 0.15, 0.1], 7, 3, 0.8); } }   // old brown cones
  // ---- 1 saw banksia: the same build, lighter leaves with sawtooth edges, grey-green flower spikes, fat grey woody cones
  K.cur = 1;
  { K.tube(stem(0, 0, 1.3, -0.2, 2.1, 0.09, 0.1), 7, 7, [0.2, 0.17, 0.14], [0.14, 0.12, 0.1]); for (let l = 0; l < 6; l++) { const az = l * 1.05 + 1.1, h0 = 0.95 + l * 0.09, top = [Math.cos(az) * (0.55 + R() * 0.3), 2.0 + R() * 0.7, Math.sin(az) * (0.55 + R() * 0.3)];
      { const q = stem(0, 0, 1.3, -0.2, 2.1, 0.09, 0.1)(h0 / 1.3); K.tube((t) => [q[0] + (top[0] - q[0]) * t * t, q[1] + (top[1] - q[1]) * t, q[2] + (top[2] - q[2]) * t * t, 0.05 * (1 - 0.8 * t)], 6, 6, [0.2, 0.17, 0.14], [0.14, 0.12, 0.1]); }
      for (let k = 0; k < 40; k++) { const a = R() * 6.283, el = 0.3 + R() * 0.8, len = 0.3 + R() * 0.14, base = [top[0], top[1] - 0.04, top[2]];                                                     // a saw-edged leaf: a strip with a zigzag edge
        let prev = null; for (let j = 0; j <= 5; j++) { const t = j / 5, out = len * t * Math.cos(el), y = len * t * Math.sin(el) - 0.15 * len * t * t, w = (0.014 + (j % 2 ? 0.014 : 0)) * (1 - t * 0.7), nx = -Math.sin(a) * w, nz = Math.cos(a) * w, px = base[0] + Math.cos(a) * out, pz = base[2] + Math.sin(a) * out;
          const c = mixc([0.12, 0.22, 0.1], [0.22, 0.3, 0.14], t), A = K.v([px - nx, base[1] + y, pz - nz], c, base[1] + y), B = K.v([px + nx, base[1] + y, pz + nz], c, base[1] + y); if (prev) K.idx.push(prev[0], prev[1], A, A, prev[1], B); prev = [A, B]; } }
      K.spike([top[0], top[1] + 0.02, top[2]], [0, 1, 0.05], 0.32, 0.08, [0.5, 0.55, 0.3], [0.72, 0.74, 0.34], 10, 6, 0.6); }
    for (let c = 0; c < 3; c++) K.spike([0.2 * Math.cos(c * 2), 1.7 + c * 0.15, 0.2 * Math.sin(c * 2)], [Math.cos(c * 2.4), 0.9, Math.sin(c * 2.4)], 0.1, 0.045, [0.28, 0.25, 0.21], [0.36, 0.3, 0.24], 7, 3, 0.9); }
  // ---- 2 heathy parrot pea: a low wiry shrub, fine needle leaves, orange-yellow pea flowers with a red keel scattered along the stems
  K.cur = 2;
  { for (let s = 0; s < 15; s++) { const az = s * 0.7, h = 0.45 + R() * 0.3, path = stem((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, h, 0.5 * (0.2 + 1.6 * R()), az, 0.006, 0.3); K.tube(path, 4, 4, [0.17, 0.12, 0.07], [0.12, 0.15, 0.07]);
      const top = path(1), mid = path(0.5); needles(mid, top, 10, 0.07, [0.1, 0.2, 0.07]);
      for (let f = 0; f < 7; f++) { const t = 0.35 + f * 0.09, p = path(t); K.flower([p[0], p[1] + 0.012, p[2]], 0.016, 5, [0.7, 0.45, 0.03], [0.5, 0.06, 0.04], FT()); } } }
  // ---- 3 beaked parrot pea: a heath shrub with stiff leaves and clusters of yellow and orange flowers at the stem tips
  K.cur = 3;
  { for (let s = 0; s < 14; s++) { const az = s * 0.8 + 0.3, h = 0.5 + R() * 0.45, path = stem((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, h, 0.35 * (0.2 + 1.6 * R()), az, 0.007, 0.2); K.tube(path, 4, 4, [0.18, 0.13, 0.08], [0.12, 0.17, 0.07]);
      needles(path(0.2), path(1), 14, 0.06, [0.12, 0.22, 0.08]); const top = path(1);
      for (let f = 0; f < 6; f++) K.flower([top[0] + (R() - 0.5) * 0.05, top[1] + (R() - 0.2) * 0.05, top[2] + (R() - 0.5) * 0.05], 0.014, 5, f % 2 ? [0.72, 0.5, 0.04] : [0.7, 0.32, 0.03], [0.4, 0.05, 0.04], FT()); } }
  // ---- 4 wedding bush: a tall slim shrub with fine needles and masses of small white five-petalled flowers
  K.cur = 4;
  { for (let s = 0; s < 16; s++) { const az = s * 0.63, h = 0.9 + R() * 0.7, path = stem((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, h, 0.22 * (0.2 + 1.6 * R()), az, 0.009, 0.15); K.tube(path, 5, 4, [0.2, 0.15, 0.1], [0.14, 0.17, 0.08]);
      needles(path(0.15), path(1), 18, 0.08, [0.09, 0.2, 0.07]);
      for (let f = 0; f < 11; f++) { const t = 0.3 + f * 0.065, p = path(t); K.flower([p[0] + (R() - 0.5) * 0.05, p[1] + 0.02, p[2] + (R() - 0.5) * 0.05], 0.021, 5, [0.78, 0.78, 0.72], [0.55, 0.42, 0.08], FT()); } } }
  // ---- 5 devil's rice: a rounded shrub, thin grey-green leaves, loose branched heads of small cream-white flowers
  K.cur = 5;
  { for (let s = 0; s < 14; s++) { const az = s * 0.8, h = 0.8 + R() * 0.6, path = stem((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, h, 0.3 * (0.2 + 1.6 * R()), az, 0.008, 0.2); K.tube(path, 4, 4, [0.18, 0.14, 0.1], [0.14, 0.16, 0.09]);
      needles(path(0.1), path(1), 14, 0.1, [0.16, 0.24, 0.12], 0.007);
      for (let f = 0; f < 3; f++) { const t = 0.55 + f * 0.17, p = path(t); for (let k = 0; k < 6; k++) K.flower([p[0] + (R() - 0.5) * 0.07, p[1] + 0.03 + R() * 0.05, p[2] + (R() - 0.5) * 0.07], 0.012, 4, [0.8, 0.78, 0.66], [0.6, 0.5, 0.2], FT()); } } }
  // ---- 6 showy guinea flower: a low spreading shrub with bright yellow flowers like small buttercups
  K.cur = 6;
  { for (let s = 0; s < 14; s++) { const az = s * 0.8, h = 0.28 + R() * 0.25, path = stem((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, h, 0.9 * (0.2 + 1.6 * R()), az, 0.005, 0.2); K.tube(path, 3, 4, [0.18, 0.13, 0.08], [0.13, 0.17, 0.07]);
      needles(path(0.1), path(1), 12, 0.045, [0.1, 0.21, 0.08]); const top = path(1), mid = path(0.7);
      K.flower([top[0], top[1] + 0.012, top[2]], 0.03, 5, [0.85, 0.7, 0.02], [0.55, 0.4, 0.02], FT(), 0.5); K.flower([mid[0], mid[1] + 0.012, mid[2]], 0.026, 5, [0.85, 0.7, 0.02], [0.55, 0.4, 0.02], FT()); } }
  // ---- 7 native sarsaparilla: a twining vine over a tangle of its own stems, glossy leaves of three leaflets, hanging racemes of purple pea flowers
  K.cur = 7;
  { for (let s = 0; s < 5; s++) { const az = s * 1.2, path = (t) => [Math.cos(az + t * 4) * (0.06 + 0.22 * t), 0.05 + 0.75 * t + 0.06 * Math.sin(t * 9), Math.sin(az + t * 4) * (0.06 + 0.22 * t), 0.008 * (1 - 0.4 * t)]; K.tube(path, 14, 4, [0.2, 0.12, 0.1], [0.16, 0.14, 0.08]);
      for (let l = 0; l < 22; l++) { const p = path(0.08 + l * 0.04), a = R() * 6.283; for (const da of [-0.55, 0, 0.55]) K.blade([p[0], p[1], p[2]], a + da, 0.1 + R() * 0.5, 0.13, 0.05, [0.05, 0.17, 0.06], [0.15, 0.3, 0.1], 0.3, 2); }
      for (let r = 0; r < 2; r++) { const p = path(0.5 + r * 0.28); for (let f = 0; f < 8; f++) K.flower([p[0] + (R() - 0.5) * 0.07, p[1] - 0.035 * f + 0.06, p[2] + (R() - 0.5) * 0.07], 0.014, 5, [0.38, 0.14, 0.5], [0.8, 0.8, 0.3], FT()); } } }
  // ---- 8 wallum geebung: a small shrub with narrow, pointed leaves in whorls, and small yellow tubular flowers
  K.cur = 8;
  { for (let s = 0; s < 22; s++) { const az = s * 0.8, h = 0.55 + R() * 0.45, path = stem((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, h, 0.35 * (0.2 + 1.6 * R()), az, 0.008, 0.15); K.tube(path, 4, 4, [0.18, 0.14, 0.1], [0.13, 0.17, 0.08]);
      for (let k = 0; k < 14; k++) { const p = path(0.15 + k * 0.06); K.blade([p[0], p[1], p[2]], R() * 6.283, 0.2 + R() * 0.8, 0.09 + R() * 0.03, 0.012, [0.09, 0.2, 0.08], [0.2, 0.3, 0.12], 0.1, 2); }
      for (let f = 0; f < 3; f++) { const p = path(0.5 + f * 0.2); K.flower([p[0], p[1] + 0.02, p[2]], 0.012, 4, [0.78, 0.65, 0.04], [0.6, 0.45, 0.02], FT()); } } }
  // ---- 9 mat rush: a dense clump of long, strap-like leaves arching out and over, tan at the tips; some plants carry a branching head of cream flowers
  K.cur = 9;
  { for (let k = 0; k < 40; k++) { const el = 0.7 + R() * 0.7, c = mixc([0.12, 0.22, 0.07], [0.28, 0.27, 0.12], R() * 0.4); K.blade([0, 0, 0], R() * 6.283, el, 0.5 + R() * 0.8, 0.024, c, mixc(c, [0.5, 0.42, 0.22], 0.7), 0.7 + R() * 0.5, 5); }
    for (let f = 0; f < 1; f++) { const top = [0, 0.78, 0]; K.tube((t) => [0, 0.05 + 0.75 * t, 0, 0.004], 3, 3, [0.2, 0.22, 0.1], [0.22, 0.25, 0.12]); for (let k = 0; k < 5; k++) { const a = k * 1.3; K.tube((t) => [Math.cos(a) * 0.06 * t, 0.7 + 0.07 * t, Math.sin(a) * 0.06 * t, 0.003], 2, 3, [0.3, 0.3, 0.14], [0.3, 0.3, 0.14]); for (let q = 0; q < 4; q++) K.flower([Math.cos(a) * 0.06 + (R() - 0.5) * 0.02, 0.76 + q * 0.012, Math.sin(a) * 0.06 + (R() - 0.5) * 0.02], 0.01, 5, [0.72, 0.68, 0.4], [0.5, 0.4, 0.1], FT()); } } }
  // ---- 10 blue flax lily: a fan of upright strap leaves, and a branching spray of small blue-violet flowers, with shining blue berries
  K.cur = 10;
  { for (let k = 0; k < 36; k++) { const el = 1.0 + R() * 0.5, c = mixc([0.1, 0.2, 0.08], [0.2, 0.3, 0.12], R() * 0.5); K.blade([0, 0, 0], R() * 6.283, el, 0.55 + R() * 0.3, 0.035, c, mixc(c, [0.28, 0.32, 0.14], 0.4), 0.45, 3); }
    const top = [0, 0.85, 0]; K.tube((t) => [0.05 * Math.sin(t * 3), 0.08 + 0.78 * t, 0, 0.006], 5, 4, [0.18, 0.2, 0.12], [0.2, 0.24, 0.14]);
    for (let b = 0; b < 8; b++) { const a = b * 1.5, base = [0.04 * Math.sin(2.4), 0.6 + b * 0.04, 0]; K.tube((t) => [base[0] + Math.cos(a) * 0.2 * t, base[1] + 0.12 * t, Math.sin(a) * 0.2 * t, 0.002], 2, 3, [0.22, 0.24, 0.16], [0.22, 0.24, 0.16]);
      for (let f = 0; f < 6; f++) { const p = [base[0] + Math.cos(a) * 0.09 * (0.3 + f * 0.14), base[1] + 0.08 * (0.4 + f * 0.2), Math.sin(a) * 0.09 * (0.4 + f * 0.2)]; if ((b + f) % 3) K.flower(p, 0.017, 6, [0.32, 0.3, 0.72], [0.8, 0.7, 0.1], FT()); else K.spike([p[0], p[1] - 0.006, p[2]], [R() - 0.5, 0.5, R() - 0.5], 0.02, 0.012, [0.12, 0.2, 0.7], [0.18, 0.3, 0.9], 6, 2, 1); } } }
  // ---- 11 cotton tree: a spreading coastal tree with a leaning trunk, heart-shaped leaves in layers, and big yellow hibiscus flowers with a dark eye
  K.cur = 11;
  { const trunk = (t) => [0.4 * t * t + 0.03 * Math.sin(t * 17), 2.4 * t, 0.2 * Math.sin(t * 3) + 0.03 * Math.cos(t * 13), 0.2 * (1 - 0.7 * t) + 0.07 * Math.exp(-12 * t)]; K.tube(trunk, 16, 9, [0.2, 0.17, 0.14], [0.16, 0.13, 0.1]);
    for (let l = 0; l < 6; l++) { const az = l * 1.05, top = [0.4 + Math.cos(az) * 1.6, 3.0 + R() * 0.9, Math.sin(az) * 1.6]; K.tube((t) => [0.4 + (top[0] - 0.4) * t, 2.0 + (top[1] - 2.0) * t + 0.18 * Math.sin(t * PI), top[2] * t, 0.07 * (1 - 0.8 * t)], 5, 5, [0.2, 0.17, 0.14], [0.14, 0.12, 0.1]);
      for (let k = 0; k < 120; k++) { const t = 0.3 + R() * 0.7, p = [0.4 + (top[0] - 0.4) * t + (R() - 0.5) * 0.4, 2.0 + (top[1] - 2.0) * t + 0.18 * Math.sin(t * PI) + R() * 0.3, top[2] * t + (R() - 0.5) * 0.4], a = R() * 6.283, s = 0.12 + R() * 0.09;
        const c = mixc([0.07, 0.2, 0.07], [0.16, 0.32, 0.12], R()), H = [Math.cos(a) * s, 0, Math.sin(a) * s], Pp = [-Math.sin(a) * s * 0.8, 0, Math.cos(a) * s * 0.8];                                       // a heart-shaped leaf lying roughly flat
        { const pt = (f, g, y) => [p[0] + H[0] * f + Pp[0] * g, p[1] + y, p[2] + H[2] * f + Pp[2] * g], c2 = mixc(c, [0.3, 0.4, 0.15], 0.4), L1 = pt(0.5, 1.0, -0.04), L2 = pt(0.95, 0.62, -0.08), Tt = pt(1.3, 0, -0.1), R2 = pt(0.95, -0.62, -0.08), R1 = pt(0.5, -1.0, -0.04); K.tri(p, L1, L2, c, c, c2, p[1], p[1], p[1]); K.tri(p, L2, Tt, c, c2, c2, p[1], p[1], p[1]); K.tri(p, Tt, R2, c, c2, c2, p[1], p[1], p[1]); K.tri(p, R2, R1, c, c2, c, p[1], p[1], p[1]); } }
      for (let f = 0; f < 5; f++) { const t = 0.6 + R() * 0.4, p = [0.4 + (top[0] - 0.4) * t, 2.0 + (top[1] - 2.0) * t + 0.18 * Math.sin(t * PI) + 0.18, top[2] * t]; K.flower([p[0] + (R() - 0.5) * 0.5, p[1] + 0.1 * R(), p[2] + (R() - 0.5) * 0.5], 0.09, 5, [0.82, 0.68, 0.03], [0.42, 0.06, 0.04], FT(), 0.5); } } }
  // ---- 12 asparagus fern (the weed): a sprawling mound of arching green stems with feathery tufts and small red berries
  K.cur = 12;
  { for (let s = 0; s < 30; s++) { const az = s * 0.21 + R() * 0.3, el = 0.5 + R() * 0.7, len = 0.7 + R() * 0.6, path = (t) => [Math.cos(az) * len * t * Math.cos(el), len * t * Math.sin(el) - 0.5 * len * t * t, Math.sin(az) * len * t * Math.cos(el), 0.004 * (1 - 0.5 * t)];
      K.tube(path, 4, 3, [0.16, 0.2, 0.1], [0.2, 0.28, 0.12]);
      for (let k = 0; k < 10; k++) { const p = path(0.25 + k * 0.075), a = az + (k % 2 ? 1.2 : -1.2); for (let q = 0; q < 3; q++) { const aa = a + (q - 1) * 0.5, tip = [p[0] + Math.cos(aa) * 0.07, p[1] + 0.02 + q * 0.01, p[2] + Math.sin(aa) * 0.07]; K.tri([p[0] - 0.004, p[1], p[2]], [p[0] + 0.004, p[1], p[2] + 0.004], tip, [0.14, 0.28, 0.1], [0.14, 0.28, 0.1], [0.28, 0.4, 0.16], p[1], p[1], tip[1]); } }
      if (s % 3 === 0) { const p = path(0.75); K.spike([p[0], p[1] - 0.01, p[2]], [0, -0.2, 0], 0.01, 0.006, [0.7, 0.08, 0.05], [0.8, 0.12, 0.06], 5, 2, 1); } } }
  return K;
}

// ---------------------------------------------------------------- planted by the GPU
export function buildWildPlants(scene) {
  const K = build(), n = MOBILE ? 18 : dq(22, 26, 30), cs = 5.8;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(K.pos, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(K.col, 3)); g.setAttribute('aSp', new THREE.Float32BufferAttribute(K.sp, 1)); g.setAttribute('aH', new THREE.Float32BufferAttribute(K.hh, 1)); g.setIndex(K.idx);
  const uni = { uCentre: { value: new THREE.Vector2() }, uCS: { value: cs }, uRange: { value: n / 2 * cs } };
  const mat = makeMat({
    uniforms: uni, side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec2 iCell; attribute vec3 aCol; attribute float aSp, aH; uniform vec2 uCentre, uWindDir; uniform float uCS, uRange; varying vec3 vCol, vW;
      void main(){
        vec2 cell = uCentre + iCell;
        float h1 = hash12(cell + 3.7), h2 = hash12(cell + 29.3), h3 = hash12(cell * 1.7 + 11.1), h4 = hash12(cell * 0.37 + 71.0);
        vec2 xz = (cell + vec2(h1, h2)) * uCS, uv = worldUV(xz);
        vec3 mk = texture2D(uMask, uv).rgb, ov = texture2D(uOver, uv).rgb; float hgt = texture2D(uHeight, uv).r;
        float thick = smoothstep(0.3, 0.6, texture2D(uNoise, xz / 190.0 + 0.37).r), wet = smoothstep(0.4, 0.7, texture2D(uNoise, xz / 340.0 + 0.71).g);
        float open = step(0.92, mk.r) * step(1.8, hgt) * (1.0 - smoothstep(0.35, 0.75, mk.g)) * (1.0 - smoothstep(0.06, 0.3, max(max(ov.r, ov.g), ov.b)));
        float on = open * step(h3, 0.05 + 0.3 * thick);
        // which plant grows here: the wallum heath mix, with tussocks in the damper ground, cotton trees low down near the coast, the weed where the sand has been disturbed
        float r = fract(h2 * 7.31 + h4 * 3.7), sp;
        if(wet > 0.5){ sp = r < 0.35 ? 9.0 : r < 0.62 ? 10.0 : r < 0.75 ? 7.0 : r < 0.88 ? 6.0 : 4.0; }
        else { sp = r < 0.09 ? 0.0 : r < 0.15 ? 1.0 : r < 0.27 ? 2.0 : r < 0.37 ? 3.0 : r < 0.48 ? 4.0 : r < 0.56 ? 5.0 : r < 0.67 ? 6.0 : r < 0.74 ? 7.0 : r < 0.82 ? 8.0 : r < 0.9 ? 9.0 : 10.0; }
        if(hgt < 9.0 && mk.g < 0.5 && h4 < 0.12 && thick > 0.3) sp = 11.0;
        if(mk.g > 0.25 && mk.g < 0.8 && h1 < 0.1) sp = 12.0;
        float dist = length(xz - (uCentre + 0.5) * uCS); on *= 1.0 - smoothstep(uRange * 0.72, uRange * 0.96, dist);
        if(on <= 0.002 || abs(aSp - sp) > 0.5){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        float size = (0.8 + 0.5 * h1) * on, lean = 0.12 * (h3 * 9.0 - floor(h3 * 9.0) - 0.5);
        vec3 lp = position;
        lp.xz += uWindDir * aH * aH * (0.03 + 0.025 * sin(uTime * 2.1 + h1 * 30.0 + position.y * 2.0)) * (aSp > 8.5 && aSp < 10.5 ? 0.6 : 1.0);
        lp.xz += vec2(lean, -lean * 0.6) * lp.y;
        float ca = cos(h1 * 6.2832), sa = sin(h1 * 6.2832);
        lp = vec3(lp.x * ca - lp.z * sa, lp.y, lp.x * sa + lp.z * ca) * size;
        vec3 wp = vec3(xz.x, groundY(xz), xz.y) + lp;
        vCol = aCol * (0.82 + 0.36 * fract(h2 * 5.1)) * (uLightCol * (0.4 + 0.5 * max(uLightDir.y, 0.0)) * cloudShadow(wp) + uAmbSky * 0.9); vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }`,
  });
  const grid = gridBlocks(scene, g, mat, n, cs, 12); for (const b of grid.blocks) b.m.name = 'wildplants';
  return (target, camDist) => { grid.on = camDist < 500; uni.uCentre.value.set(Math.floor(target.x / cs), Math.floor(target.z / cs)); };
}

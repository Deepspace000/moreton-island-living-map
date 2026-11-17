// Everything that sits on the island: buildings, tracks and walking paths, trees,
// the wrecks, lighthouses, jetty, navigation marks, lakes and the name labels.
import * as THREE from 'three';
import { U, VEX, MOBILE, LOW, dq, Q, makeMat, objectMat, gridBlocks, nearOnly, LOGV, LOGF, rng, clamp } from './common.js';
import { T, meshY, groundH, heightAt, maskAt, albedoAt, tideLimit } from './terrain.js';
import { probe } from './drive.js';
import { GB, makeLights } from './geo.js';

const seaY = () => U.uSeaM.value * VEX;
const HK = VEX * 0.74;            // buildings are drawn a little taller than true (as the people and cars are a little larger), but far less than the hills are
const cellKey = (x, z, s) => (Math.floor(x / s) + 8192) * 16384 + (Math.floor(z / s) + 8192);

// ---------------------------------------------------------------- buildings
const WALLS = [[.93, .90, .83], [.90, .84, .70], [.84, .77, .62], [.95, .94, .91], [.76, .68, .55], [.86, .82, .73], [.80, .88, .88], [.92, .85, .60]];
const ROOFS = [[.58, .60, .60], [.36, .46, .40], [.52, .21, .15], [.66, .62, .53], [.28, .38, .48], [.70, .70, .68], [.50, .52, .53], [.56, .28, .20], [.50, .56, .52]];
// ---- houses of the island townships ----
// Bulwer, Cowan Cowan and Kooringal are off the grid: small fibro and weatherboard beach shacks, highset timber
// houses on stumps with a verandah, newer two-storey places with skillion roofs, tin sheds and the odd shipping
// container, all under corrugated iron, each with its rainwater tanks and many with solar panels.
const PASTEL = [[.93, .92, .88], [.90, .85, .72], [.72, .82, .88], [.74, .86, .78], [.92, .87, .64], [.64, .62, .57], [.86, .76, .70], [.80, .86, .90]];
const MODERN = [[.30, .32, .34], [.78, .72, .60], [.93, .93, .91], [.52, .56, .54], [.40, .46, .50]];
const IRON = [[.56, .58, .59], [.36, .42, .38], [.45, .17, .13], [.64, .61, .52], [.27, .29, .31], [.47, .54, .58], [.44, .34, .27], [.52, .54, .53], [.56, .58, .59]];      // weathered zinc, grey-green, old red: no roof stays bright
const TRIM = [.84, .83, .78];
const TANKS = [[.70, .72, .72], [.50, .60, .52], [.82, .78, .66], [.45, .50, .52]];
const pickC = (R, a) => a[(R() * a.length) | 0];
function houseStyle(R, area, cape) {
  const r = R(), r2 = R();
  if (cape) return { stump: 0.4, wallH: 2.8, roofT: 'gable', pitch: 0.2, wall: [.94, .93, .89], roof: [.50, .52, .54], ver: area > 60, verD: 2.2, tank: area > 60, solar: false, win: 1, clad: 1 };
  if (area < 34) return r < 0.25
    ? { stump: 0.1, wallH: 2.5, roofT: 'skillion', pitch: 0.01, wall: pickC(R, [[.16, .32, .50], [.55, .20, .14], [.20, .42, .30], [.50, .34, .24], [.80, .80, .78]]), roof: [.5, .5, .5], ver: false, tank: false, solar: r2 < 0.4, win: 0, clad: 6 }      // a shipping container
    : { stump: 0, wallH: 2.5, roofT: r2 < 0.5 ? 'skillion' : 'gable', pitch: 0.13, wall: pickC(R, IRON), roof: pickC(R, IRON), ver: false, tank: r2 < 0.3, solar: false, win: 0, clad: 5 };                                                              // a tin shed
  if (area < 95) return { stump: 0.5, wallH: 2.5, roofT: r < 0.45 ? 'skillion' : 'gable', pitch: r < 0.45 ? 0.1 : 0.17, wall: pickC(R, PASTEL), roof: pickC(R, IRON), ver: r2 < 0.6, verD: 2.0, tank: true, solar: r2 > 0.6, win: 1, clad: r < 0.6 ? 2 : 1 };              // a beach shack
  if (r < 0.45) return { stump: 1.9, wallH: 2.7, roofT: 'gable', pitch: 0.2, wall: pickC(R, PASTEL), roof: pickC(R, IRON), ver: true, verD: 2.4, tank: true, solar: r2 < 0.55, under: r2 > 0.5, win: 1, clad: r < 0.3 ? 1 : 2 };                                         // a highset house on stumps
  if (r < 0.9) return { stump: 0.6, wallH: 2.6, roofT: 'gable', pitch: 0.19, wall: pickC(R, PASTEL), roof: pickC(R, IRON), ver: r2 < 0.75, verD: 2.4, tank: true, solar: r2 > 0.5, win: 1, clad: r < 0.56 ? 1 : r < 0.7 ? 2 : 3 };                                                    // a lowset house
  return { stump: 0.3, wallH: 5.4, roofT: 'skillion', pitch: 0.09, wall: pickC(R, MODERN), roof: pickC(R, [[.28, .30, .32], [.72, .74, .75], [.82, .78, .66]]), ver: true, verD: 3.0, tank: true, solar: r2 < 0.75, win: 1, clad: 4 };                  // a newer two-storey beach house
}
function buildHouse(g, pts, base, hi, st, R, free = () => true, street = null) {
  const K = HK, POST = [.42, .37, .30], TIMBER = [.55, .47, .38], H2 = Math.hypot;
  const [p0, p1, p2, p3] = pts, e0 = H2(p1[0] - p0[0], p1[1] - p0[1]), e1 = H2(p2[0] - p1[0], p2[1] - p1[1]);
  const [oa, ob, , od] = e0 >= e1 ? [p0, p1, p2, p3] : [p1, p2, p3, p0];
  // The outline on the town map is what you see from the air: the edge of the roof. So the whole house is built INSIDE it, as it stands on its lot:
  // the walls are set in by the width of the eaves, and the verandah sits under the same roofline rather than being added on outside.
  const Lo = H2(ob[0] - oa[0], ob[1] - oa[1]), Wo = H2(od[0] - oa[0], od[1] - oa[1]), u = [(ob[0] - oa[0]) / Lo, (ob[1] - oa[1]) / Lo], v = [(od[0] - oa[0]) / Wo, (od[1] - oa[1]) / Wo];
  const EAVE = st.clad === 6 ? 0.04 : st.clad === 5 ? 0.2 : Math.min(0.45, Wo * 0.06);
  // the front (verandah, stairs, glass doors) faces the street the house stands on; with no street close by it faces west, to the bay
  let tv = v[0] > 0 ? 0 : 1;
  if (street) { const ds = v[0] * street[0] + v[1] * street[1]; if (Math.abs(ds) > 0.4) tv = ds < 0 ? 0 : 1; }
  const w = tv === 0 ? [-v[0], -v[1]] : v;
  if (st.ver && Wo - 2 * EAVE < 6.2) st.ver = false;                               // too shallow a house to have a verandah under its roof
  if (st.ver) st.verD = Math.min(st.verD, 2.2, (Wo - 2 * EAVE) * 0.3);
  const dvIn = st.ver ? st.verD : 0, t0m = EAVE + (tv === 0 ? dvIn : 0);
  const a = [oa[0] + u[0] * EAVE + v[0] * t0m, oa[1] + u[1] * EAVE + v[1] * t0m], L = Lo - 2 * EAVE, Wd = Wo - 2 * EAVE - dvIn;
  const P = (s, t, y, k = 0, w = [0, 0]) => [a[0] + u[0] * s * L + v[0] * t * Wd + w[0] * k, y, a[1] + u[1] * s * L + v[1] * t * Wd + w[1] * k];      // a point of the plan: s along, t across, k metres out along w
  const yG = base, yF = hi + st.stump * K, yT = yF + st.wallH * K, high = st.stump > 1.2, yLow = high ? yF : yG - 1.2;
  const es = EAVE / L, et = EAVE / Wd, rf = (s, up = 0) => [-1, s * L, up], cl = st.clad, gb = (t, y) => [cl + 0.25, 50 + t * Wd, (y - yF) / K];      // eaves; roof sheets and walls are marked so the shader can rib and clad them
  // walls, with windows
  const C = [[0, 0], [1, 0], [1, 1], [0, 1]]; let along = 0;
  for (let i = 0; i < 4; i++) {
    const [s0, t0] = C[i], [s1, t1] = C[(i + 1) % 4], len = i % 2 ? Wd : L, f0 = (yLow - yF) / K, f1 = st.wallH;
    const yE = yT - 0.5 * K, fE = f1 - 0.5, shade = [st.wall[0] * 0.74, st.wall[1] * 0.74, st.wall[2] * 0.78];       // under the eave the wall is in shadow
    const front = i === (tv === 0 ? 0 : 2), wc = cl + (front && st.ver ? 0.05 : high || (front && st.stump > 0.25) ? 0.1 : 0);      // the wall onto the verandah has sliding glass doors; a wall high off the ground has no door in it
    g.quad(P(s1, t1, yLow), P(s0, t0, yLow), P(s0, t0, yE), P(s1, t1, yE), st.wall, [wc, along + len, f0], [wc, along, f0], [wc, along, fE], [wc, along + len, fE]);
    g.quad(P(s1, t1, yE), P(s0, t0, yE), P(s0, t0, yT), P(s1, t1, yT), shade, [wc, along + len, fE], [wc, along, fE], [wc, along, f1], [wc, along + len, f1]);
    along += len + 1.3;
  }
  if (high) {            // stumps, the dark underside of the floor, and sometimes a room built in underneath
    const ns = Math.max(2, Math.round(L / 3.5) + 1), nt = Wd > 6.5 ? 3 : 2;
    for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) { const q = P(0.03 + 0.94 * i / (ns - 1), 0.04 + 0.92 * j / (nt - 1), 0); g.box(q[0], yG - 0.6, q[2], 0.24, yF - yG + 0.6, 0.24, POST); }
    g.quad(P(0, 0, yF), P(1, 0, yF), P(1, 1, yF), P(0, 1, yF), [.28, .26, .23]);
    if (st.under) { const dk = [.44, .39, .32], Q = [[0.5, 0.05], [0.98, 0.05], [0.98, 0.95], [0.5, 0.95]]; let al = 0; for (let i = 0; i < 4; i++) { const [s0, t0] = Q[i], [s1, t1] = Q[(i + 1) % 4], ln = (i % 2 ? Wd * 0.9 : L * 0.48), z0 = (yG - 1 - yF) / K; g.quad(P(s1, t1, yG - 1), P(s0, t0, yG - 1), P(s0, t0, yF), P(s1, t1, yF), dk, [4.25, al + ln, z0], [4.25, al, z0], [4.25, al, 0], [4.25, al + ln, 0]); al += ln; } }      // a room under the house, closed in with upright timber battens
  }
  // roof of corrugated iron
  let top = yT;
  if (st.roofT === 'gable') {
    const rh = Wd * st.pitch * K, ye = yT - 0.12; top = yT + rh;
    const r0 = P(-es, 0.5, top), r1 = P(1 + es, 0.5, top);
    g.quad(P(-es, -et, ye), P(1 + es, -et, ye), r1, r0, st.roof, rf(-es), rf(1 + es), rf(1 + es, Wd / 2), rf(-es, Wd / 2));
    g.quad(P(1 + es, 1 + et, ye), P(-es, 1 + et, ye), r0, r1, st.roof, rf(1 + es), rf(-es), rf(-es, Wd / 2), rf(1 + es, Wd / 2));
    g.tri(P(0, 0, yT), P(0, 1, yT), P(0, 0.5, top), st.wall, gb(0, yT), gb(1, yT), gb(0.5, top)); g.tri(P(1, 1, yT), P(1, 0, yT), P(1, 0.5, top), st.wall, gb(1, yT), gb(0, yT), gb(0.5, top));
    { const fh = 0.2 * K, t0 = -et, t1 = 1 + et, sa = -es, sb = 1 + es, cap = [st.roof[0] * .8, st.roof[1] * .8, st.roof[2] * .8], cw = 0.3 / Wd, yc = top - (top - ye) * cw / (0.5 + et);
      g.quad(P(sa, t0, ye - fh), P(sb, t0, ye - fh), P(sb, t0, ye), P(sa, t0, ye), TRIM); g.quad(P(sb, t1, ye - fh), P(sa, t1, ye - fh), P(sa, t1, ye), P(sb, t1, ye), TRIM);
      g.quad(P(sa, t0, ye - fh), P(sa, 0.5, top - fh), P(sa, 0.5, top), P(sa, t0, ye), TRIM); g.quad(P(sa, 0.5, top - fh), P(sa, t1, ye - fh), P(sa, t1, ye), P(sa, 0.5, top), TRIM);
      g.quad(P(sb, t1, ye - fh), P(sb, 0.5, top - fh), P(sb, 0.5, top), P(sb, t1, ye), TRIM); g.quad(P(sb, 0.5, top - fh), P(sb, t0, ye - fh), P(sb, t0, ye), P(sb, 0.5, top), TRIM);
      g.quad(P(sa, 0.5 - cw, yc + 0.07), P(sb, 0.5 - cw, yc + 0.07), P(sb, 0.5, top + 0.1), P(sa, 0.5, top + 0.1), cap); g.quad(P(sb, 0.5 + cw, yc + 0.07), P(sa, 0.5 + cw, yc + 0.07), P(sa, 0.5, top + 0.1), P(sb, 0.5, top + 0.1), cap); }
    if (st.solar) {      // panels on the slope that faces north
      const tn = v[1] > 0 ? 0 : 1, T = (f) => tn === 0 ? 0.5 * f : 1 - 0.5 * f, Y = (f) => yT + rh * f + 0.14, s0 = 0.2 + R() * 0.15, s1 = s0 + 0.4;
      g.quad(P(s0, T(0.2), Y(0.2)), P(s1, T(0.2), Y(0.2)), P(s1, T(0.8), Y(0.8)), P(s0, T(0.8), Y(0.8)), [.15, .19, .29]);
    }
  } else {               // a skillion: one slope, high at the front
    const rise = Wd * st.pitch * K, Y = (t) => yT + rise * (tv === 0 ? 1 - t : t) + 0.05; top = yT + rise;
    g.quad(P(-es, -et, Y(-et)), P(1 + es, -et, Y(-et)), P(1 + es, 1 + et, Y(1 + et)), P(-es, 1 + et, Y(1 + et)), st.roof, rf(-es), rf(1 + es), rf(1 + es, Wd), rf(-es, Wd));
    g.quad(P(0, tv, yT), P(1, tv, yT), P(1, tv, yT + rise), P(0, tv, yT + rise), st.wall, [cl + 0.25, 0, st.wallH], [cl + 0.25, L, st.wallH], [cl + 0.25, L, st.wallH + rise / K], [cl + 0.25, 0, st.wallH + rise / K]);
    for (const s of [0, 1]) g.tri(P(s, tv, yT), P(s, 1 - tv, yT), P(s, tv, yT + rise), st.wall, gb(tv, yT), gb(1 - tv, yT), gb(tv, yT + rise));
    { const fh = 0.2 * K, t0 = -et, t1 = 1 + et, sa = -es, sb = 1 + es;
      g.quad(P(sa, t0, Y(t0) - fh), P(sb, t0, Y(t0) - fh), P(sb, t0, Y(t0)), P(sa, t0, Y(t0)), TRIM); g.quad(P(sb, t1, Y(t1) - fh), P(sa, t1, Y(t1) - fh), P(sa, t1, Y(t1)), P(sb, t1, Y(t1)), TRIM);
      g.quad(P(sa, t0, Y(t0) - fh), P(sa, t1, Y(t1) - fh), P(sa, t1, Y(t1)), P(sa, t0, Y(t0)), TRIM); g.quad(P(sb, t1, Y(t1) - fh), P(sb, t0, Y(t0) - fh), P(sb, t0, Y(t0)), P(sb, t1, Y(t1)), TRIM); }
    if (st.solar) g.quad(P(0.25, 0.25, Y(0.25) + 0.12), P(0.7, 0.25, Y(0.25) + 0.12), P(0.7, 0.75, Y(0.75) + 0.12), P(0.25, 0.75, Y(0.75) + 0.12), [.15, .19, .29]);
  }
  if (st.ver) {          // verandah or deck along the front: boards, posts, a rail, its own strip of roof, and steps down from a highset house
    const dv = st.verD, yV = yT - 0.45 * K, m = Math.max(2, Math.round(L / 3) + 1);
    g.quad(P(0, tv, yF, 0, w), P(1, tv, yF, 0, w), P(1, tv, yF, dv, w), P(0, tv, yF, dv, w), TIMBER);
    g.quad(P(0, tv, yF - 0.3, dv, w), P(1, tv, yF - 0.3, dv, w), P(1, tv, yF, dv, w), P(0, tv, yF, dv, w), POST);
    for (let i = 0; i < m; i++) { const q = P(0.02 + 0.96 * i / (m - 1), tv, 0, dv - 0.12, w), y0 = high ? yG - 0.6 : yF - 0.4; g.box(q[0], y0, q[2], 0.16, yV - y0, 0.16, [.90, .89, .85]); }
    const RAIL = [.90, .89, .85], stairs = yF - yG > 1, runEst = Math.max(4, Math.round((yF - yG) / (0.19 * K))) * 0.27, g0 = [0.1, 0.72, 0.42].find(f => { const q = P(f + 0.57 / L, tv, 0, dv + runEst + 0.4, w); return free(q[0], q[2], 0.9); }) ?? 0.1, g1 = g0 + 1.15 / L, spans = stairs ? [[0, g0], [g1, 1]] : [[0, 1]];      // the rail leaves a gap at the head of the stairs
    for (const [sa, sb] of spans) {
      for (const hgt of [0.08, 1.0]) g.quad(P(sa, tv, yF + (hgt - 0.04) * K, dv, w), P(sb, tv, yF + (hgt - 0.04) * K, dv, w), P(sb, tv, yF + (hgt + 0.03) * K, dv, w), P(sa, tv, yF + (hgt + 0.03) * K, dv, w), RAIL);
      const nb = Math.round((sb - sa) * L / 0.17), ds = 0.035 / L;
      for (let i = 1; i < nb; i++) { const sx = sa + (sb - sa) * i / nb; g.quad(P(sx - ds / 2, tv, yF + 0.08 * K, dv, w), P(sx + ds / 2, tv, yF + 0.08 * K, dv, w), P(sx + ds / 2, tv, yF + 1.0 * K, dv, w), P(sx - ds / 2, tv, yF + 1.0 * K, dv, w), RAIL); }
    }
    for (const sx of [0, 1]) {                                                         // and across both ends
      for (const hgt of [0.08, 1.0]) g.quad(P(sx, tv, yF + (hgt - 0.04) * K, 0, w), P(sx, tv, yF + (hgt - 0.04) * K, dv, w), P(sx, tv, yF + (hgt + 0.03) * K, dv, w), P(sx, tv, yF + (hgt + 0.03) * K, 0, w), RAIL);
      const nb = Math.round(dv / 0.17); for (let i = 1; i < nb; i++) { const k = dv * i / nb; g.quad(P(sx, tv, yF + 0.08 * K, k - 0.018, w), P(sx, tv, yF + 0.08 * K, k + 0.018, w), P(sx, tv, yF + 1.0 * K, k + 0.018, w), P(sx, tv, yF + 1.0 * K, k - 0.018, w), RAIL); }
    }
    g.quad(P(-es, tv, yT - 0.08, 0, w), P(1 + es, tv, yT - 0.08, 0, w), P(1 + es, tv, yV, dv + EAVE, w), P(-es, tv, yV, dv + EAVE, w), st.roof, rf(-es, dv), rf(1 + es, dv), rf(1 + es), rf(-es));
    if (stairs) {        // open timber stairs: treads between two stringers, a handrail on posts
      const rise = yF - yG, nst = Math.max(4, Math.round(rise / (0.19 * K))), td = 0.27, run = nst * td;
      for (let i = 0; i < nst; i++) { const y = yF - (i + 1) * rise / nst, k0 = dv + i * td; g.quad(P(g0, tv, y, k0, w), P(g1, tv, y, k0, w), P(g1, tv, y, k0 + td + 0.03, w), P(g0, tv, y, k0 + td + 0.03, w), TIMBER); g.quad(P(g0, tv, y - 0.05 * K, k0, w), P(g1, tv, y - 0.05 * K, k0, w), P(g1, tv, y, k0, w), P(g0, tv, y, k0, w), POST); }
      for (const sx of [g0, g1]) {
        g.quad(P(sx, tv, yF - 0.3 * K, dv, w), P(sx, tv, yG - 0.3 * K, dv + run, w), P(sx, tv, yG + 0.02, dv + run, w), P(sx, tv, yF, dv, w), POST);
        g.quad(P(sx, tv, yF + 0.9 * K, dv, w), P(sx, tv, yG + 0.9 * K, dv + run, w), P(sx, tv, yG + 0.98 * K, dv + run, w), P(sx, tv, yF + 0.98 * K, dv, w), RAIL);
        for (const f of [0, 0.5, 1]) { const q = P(sx, tv, 0, dv + run * f, w), y = yF - rise * f; g.box(q[0], y - 0.1, q[2], 0.09, 0.98 * K + 0.1, 0.09, RAIL); }
      }
    }
  }
  if (st.tank) {         // rainwater tanks at the end of the house: there is no town water
    const n = R() < 0.35 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const r = 1.2 + R() * 0.55, c = pickC(R, TANKS), tt = 0.3 + 0.4 * R(), back = [-w[0], -w[1]];
      // a tank stands at one end of the house, or behind it, wherever there is room between the neighbours
      const q = [P(i ? 0 : 1, tt, 0, r + EAVE + 0.3, i ? [-u[0], -u[1]] : u), P(i ? 1 : 0, tt, 0, r + EAVE + 0.3, i ? u : [-u[0], -u[1]]), P(i ? 0.25 : 0.75, 1 - tv, 0, r + EAVE + 0.3, back)].find(q => free(q[0], q[2], r + 0.5));
      if (!q) continue;
      g.tank(q[0], yG - 0.4, q[2], r, (1.75 + R() * 0.45) * K + (hi - base) + 0.4, 24, c, K);
    }
  }
  if (st.tank && st.clad < 4.5 && R() < 0.7) {      // gas bottles against the back wall: the stove and the fridge run on gas out here
    const bk = [-w[0], -w[1]], s0 = 0.12 + 0.7 * R();
    for (const ds of [0, 0.42 / L]) { const q = P(s0 + ds, 1 - tv, 0, 0.24, bk); g.cyl(q[0], yG - 0.3, q[2], 0.17, 0.17, 1.2 * K + 0.3 + (hi - base), 10, [.74, .76, .74], [.62, .63, .62]); g.cyl(q[0], yG + 1.2 * K + (hi - base), q[2], 0.07, 0.07, 0.14 * K, 6, [.35, .36, .36], [.3, .3, .3]); }
  }
  return top;
}
// A rotary clothes hoist: a steel pole, four arms, lines strung round them, and some of the washing out to dry.
function clothesHoist(g, x, y, z, R) {
  const K = HK, STEEL = [.60, .62, .62], top = y + 1.95 * K, a0 = R() * 1.57, arm = [];
  g.box(x, y - 0.3, z, 0.08, 1.95 * K + 0.3, 0.08, STEEL);
  for (let i = 0; i < 4; i++) { const a = a0 + i * 1.5708, c = Math.cos(a), s = Math.sin(a); arm.push((f) => [x + c * 1.55 * f, top + 0.22 * K * f, z + s * 1.55 * f]);
    const p0 = arm[i](0), p1 = arm[i](1); g.quad(p0, p1, [p1[0], p1[1] + 0.07, p1[2]], [p0[0], p0[1] + 0.07, p0[2]], STEEL); g.quad([p0[0] - s * 0.03, p0[1] + 0.07, p0[2] + c * 0.03], [p1[0] - s * 0.03, p1[1] + 0.07, p1[2] + c * 0.03], [p1[0] + s * 0.03, p1[1] + 0.07, p1[2] - c * 0.03], [p0[0] + s * 0.03, p0[1] + 0.07, p0[2] - c * 0.03], STEEL); }
  for (const f of [0.45, 0.72, 1.0]) for (let i = 0; i < 4; i++) {
    const p0 = arm[i](f), p1 = arm[(i + 1) % 4](f); g.quad(p0, p1, [p1[0], p1[1] + 0.03, p1[2]], [p0[0], p0[1] + 0.03, p0[2]], [.80, .80, .78]);
    if (f > 0.5 && R() < 0.6) {            // a towel, a shirt, a sheet
      const u0 = 0.08 + R() * 0.45, u1 = u0 + 0.18 + R() * 0.2, drop = (0.45 + R() * 0.45) * K, c = [[.86, .86, .84], [.42, .55, .70], [.74, .46, .42], [.86, .80, .58], [.48, .64, .58], [.84, .70, .74], [.80, .80, .76], [.55, .60, .66]][(R() * 8) | 0];      // sun-faded towels, shirts and sheets
      const A = p0.map((v, k) => v + (p1[k] - v) * u0), B = p0.map((v, k) => v + (p1[k] - v) * u1); g.quad([A[0], A[1] - drop, A[2]], [B[0], B[1] - drop, B[2]], B, A, c);
    }
  }
}
// An aluminium dinghy on its trailer, the outboard tilted up: there is one beside half the houses on the island.
// Built in metres and scaled up like the 4WDs it is towed by.
function tinnyOnTrailer(g, x, y, z, ang, R) {
  const ALU = [.74, .76, .77], BOT = [.50, .52, .54], IN = [.56, .58, .59], DARK = [.07, .07, .08], GAL = [.52, .54, .54], HUB = [.70, .70, .68];
  g.at(new THREE.Matrix4().makeRotationY(ang).multiply(new THREE.Matrix4().makeScale(1.4, 1.4, 1.4)).setPosition(x, y, z));
  g.box(0.7, 0.36, 0, 5.6, 0.09, 0.09, GAL); g.box(-0.5, 0.28, 0, 0.09, 0.08, 1.8, GAL);                                      // drawbar and axle
  g.box(3.45, 0.02, 0, 0.07, 0.36, 0.07, GAL);                                                                                // the jockey leg under the coupling
  for (const sd of [-1, 1]) {                                                                                                 // wheels (round), each under a guard
    const N = 12, zc = sd * 0.92, r = 0.3, w = 0.09, P = (i, rr, dz) => { const a = i / N * 6.2832; return [-0.5 + Math.cos(a) * rr, 0.3 + Math.sin(a) * rr, zc + dz]; };
    for (let i = 0; i < N; i++) { g.quad(P(i, r, -w), P(i + 1, r, -w), P(i + 1, r, w), P(i, r, w), DARK); for (const dz of [-w, w]) { g.tri([-0.5, 0.3, zc + dz], P(i, r * 0.55, dz), P(i + 1, r * 0.55, dz), HUB); g.quad(P(i, r * 0.55, dz), P(i + 1, r * 0.55, dz), P(i + 1, r, dz), P(i, r, dz), DARK); } }
    g.box(-0.5, 0.63, zc, 0.78, 0.035, 0.24, GAL); g.box(-0.5, 0.42, sd * 0.55, 3.4, 0.06, 0.07, GAL);                          // guard, and a side rail the hull rests on
  }
  const y0 = 0.5, N = 12, st = [];
  for (let i = 0; i <= N; i++) { const t = i / N, half = 0.80 * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, (t - 0.38) / 0.62), 2.4)), 0.55) * (0.93 + 0.07 * Math.min(1, t * 4)), lift = 0.40 * Math.pow(Math.max(0, (t - 0.5) / 0.5), 2.2); st.push([-2.1 + 4.2 * t, half, lift, 0.10 * t * t]); }
  // keel, chine and gunwale at each station: a shallow vee bottom, flared sides, the sheer rising to the bow
  const pt = (i, sd, lvl) => { const [bx, half, lift, sheer] = st[i]; return lvl === 0 ? [bx, y0 + lift, 0] : lvl === 1 ? [bx, y0 + 0.13 + lift * 0.75, sd * half * 0.8] : lvl === 2 ? [bx, y0 + 0.56 + sheer + lift * 0.2, sd * half] : [bx, y0 + 0.56 + sheer + lift * 0.2, sd * Math.max(0, half - 0.07)]; };
  for (let i = 0; i < N; i++) for (const sd of [-1, 1]) {
    g.quad(pt(i, sd, 0), pt(i + 1, sd, 0), pt(i + 1, sd, 1), pt(i, sd, 1), BOT); g.quad(pt(i, sd, 1), pt(i + 1, sd, 1), pt(i + 1, sd, 2), pt(i, sd, 2), ALU);
    g.quad(pt(i, sd, 2), pt(i + 1, sd, 2), pt(i + 1, sd, 3), pt(i, sd, 3), [.86, .87, .87]);                                   // the rolled gunwale catches the light
    const a = pt(i, sd, 3), b = pt(i + 1, sd, 3), c = pt(i + 1, sd, 1), d = pt(i, sd, 1); g.quad(a, b, [c[0], c[1] + 0.03, c[2] * 0.96], [d[0], d[1] + 0.03, d[2] * 0.96], IN);      // inside of the topsides
  }
  g.quad(pt(0, -1, 1), pt(0, 1, 1), pt(0, 1, 2), pt(0, -1, 2), ALU); g.tri(pt(0, -1, 1), pt(0, 1, 1), pt(0, 1, 0), BOT);                        // transom
  for (let i = 0; i < N - 1; i++) { const a = pt(i, -1, 1), b = pt(i + 1, -1, 1), c = pt(i + 1, 1, 1), d = pt(i, 1, 1); g.quad([a[0], a[1] + 0.03, a[2]], [b[0], b[1] + 0.03, b[2]], [c[0], c[1] + 0.03, c[2]], [d[0], d[1] + 0.03, d[2]], [.44, .46, .47]); }      // the floor inside
  for (const i of [3, 6]) { const a = pt(i, -1, 3), b = pt(i, 1, 3), yy = a[1] - 0.14; g.quad([a[0] - 0.13, yy, a[2]], [a[0] + 0.13, yy, a[2]], [b[0] + 0.13, yy, b[2]], [b[0] - 0.13, yy, b[2]], [.80, .81, .81]); g.quad([a[0] + 0.13, yy, a[2]], [a[0] + 0.13, yy - 0.22, a[2] * 0.9], [b[0] + 0.13, yy - 0.22, b[2] * 0.9], [b[0] + 0.13, yy, b[2]], IN); }   // two thwarts
  // the outboard, tilted up for the road: cowl, leg and propeller end
  g.box(-2.22, y0 + 0.62, 0, 0.3, 0.26, 0.24, DARK); g.box(-2.22, y0 + 0.84, 0, 0.34, 0.07, 0.26, [.16, .17, .2]);
  g.quad([-2.3, y0 + 0.62, -0.05], [-2.3, y0 + 0.62, 0.05], [-2.78, y0 + 0.28, 0.05], [-2.78, y0 + 0.28, -0.05], [.3, .31, .33]); g.quad([-2.2, y0 + 0.62, -0.05], [-2.2, y0 + 0.62, 0.05], [-2.68, y0 + 0.24, 0.05], [-2.68, y0 + 0.24, -0.05], [.24, .25, .27]);
  g.at(null);
}
function buildBuildings(F, g, occ, casters, lights) {
  const R = rng(11); let nl = 0;
  const cape = F.lights.find(l => /Cape/.test(l.n || ''))?.p;
  // every outline with its centre and reach, so a house can ask whether a spot beside it is clear of its neighbours
  const plans = F.buildings.filter(b => b.p.length >= 3 && !b.lh && b.k !== 'ship').map(b => {
    let x = 0, z = 0, r = 0, a = 0; const n = b.p.length;
    for (let i = 0; i < n; i++) { const p = b.p[i], q = b.p[(i + 1) % n]; x += p[0]; z += p[1]; a += p[0] * q[1] - q[0] * p[1]; }
    x /= n; z /= n; for (const p of b.p) r = Math.max(r, Math.hypot(p[0] - x, p[1] - z));
    return { b, p: b.p, x, z, r, a: Math.abs(a) / 2 };
  });
  const within = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const reach = (x, z, p) => { let d = 1e9; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)); } return d; };
  const freeOf = (self) => (x, z, r) => plans.every(q => q.b === self || Math.hypot(x - q.x, z - q.z) > q.r + r || (!within(x, z, q.p) && reach(x, z, q.p) > r));
  { // the two sand blows stand just north of where the Micat lands (the end of her charted route); each is set against the beach as it lies there
    const fr = (F.ferries || []).find(f => /MICAT/i.test(f.n || ''));
    if (fr) { const E = [fr.p[0], fr.p[fr.p.length - 1]].sort((a, b) => Math.hypot(a[0], a[1] / 2) - Math.hypot(b[0], b[1] / 2))[0];
      const shoreX = (z) => { let x = E[0] - 400; for (let k = 0; k < 400 && groundH(x, z) < 1.2; k++) x += 3; return x; };
      const put = (i, dz, half, depth) => { const z = E[1] + dz; U.uBlow.value[i].set(shoreX(z) + depth * 0.82, z, half, depth); };
      put(0, -390, 130, 112); put(1, -150, 66, 128); } }
  const streets = new Set(), cells = new Map(), streetPts = []; let CS = 11;
  const resort = F.places.find(o => /^Tangalooma Resort/.test(o.n || ''))?.p || F.places.find(o => /^Tangalooma/.test(o.n || ''))?.p;
  if (resort) U.uResort.value.set(resort[0] + 100, resort[1] - 20, 850, 0);            // the resort's grounds: lawns, and trees thick between the buildings (the owner's aerial photograph)
  // which way the street lies from a house: the nearest point of any street or track within 70 m
  const toStreet = (x, z) => { let bd = 70 * 70, bx = 0, bz = 0; for (let i = 0; i < streetPts.length; i += 2) { const dx = streetPts[i] - x, dz = streetPts[i + 1] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bx = dx; bz = dz; } } const l = Math.hypot(bx, bz); return l > 0.5 ? [bx / l, bz / l, l] : null; };
  const onStreet = (x, z) => { for (let dx = -4; dx <= 4; dx += 4) for (let dz = -4; dz <= 4; dz += 4) if (streets.has(cellKey(x + dx, z + dz, 4))) return true; return false; };
  const anyFree = freeOf(null);
  { // Garden trees. The forest's trees stand one to a cell of an 11 m grid (see buildTrees). In the townships a cell beside a house gets a tree too,
    // if a circle round its middle is clear of every building, verandah, tank and street. The cells are handed to the tree shader as a small map.
    CS = 11;
    for (const r of F.roads) { if (r.c === 3) continue; for (let i = 1; i < r.p.length; i++) { const a = r.p[i - 1], b = r.p[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; streets.add(cellKey(x, z, 4)); if (r.c < 2 && k % 2 === 0) streetPts.push(x, z); } } }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const q of plans) {
      if (q.a < 25) continue;
      const pad = resort && Math.hypot(q.x - resort[0] - 100, q.z - resort[1] + 20) < 900 ? 60 : 18;
      for (let cz = Math.floor((q.z - q.r - pad) / CS); cz <= Math.floor((q.z + q.r + pad) / CS); cz++) for (let cx = Math.floor((q.x - q.r - pad) / CS); cx <= Math.floor((q.x + q.r + pad) / CS); cx++) {
        const key = cx + ',' + cz; if (cells.has(key)) continue;
        const x = (cx + 0.5) * CS, z = (cz + 0.5) * CS, inResort = resort && Math.hypot(x - resort[0] - 100, z - resort[1] + 20) < 800, ok = reach(x, z, q.p) < (inResort ? 60 : 18) && anyFree(x, z, 4.8) && !onStreet(x, z) && maskAt(x, z).land > 0.9;
        if (!ok) continue;
        cells.set(key, [cx, cz]); x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); z0 = Math.min(z0, cz); z1 = Math.max(z1, cz);
      }
    }
    if (cells.size) {
      const w = x1 - x0 + 1, h = z1 - z0 + 1, data = new Uint8Array(w * h);
      for (const [cx, cz] of cells.values()) { data[(cz - z0) * w + (cx - x0)] = 255; }
      const t = new THREE.DataTexture(data, w, h, THREE.RedFormat); t.unpackAlignment = 1; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
      U.uYard.value = t; U.uYardO.value.set(x0, z0, 1 / w, 1 / h);
    }
  }
  const swallowed = new Set(plans.filter(s => plans.some(q => q !== s && q.a > s.a && Math.hypot(s.x - q.x, s.z - q.z) < q.r && within(s.x, s.z, q.p))).map(s => s.b));
  const Y = rng(77), things = [], parked = F.parked = [], drives = F.drives = [];
  for (const b of F.buildings) {
    let pts = b.p; const n = pts.length; if (n < 3 || b.lh || b.k === 'ship' || swallowed.has(b)) continue;      // outlines of wrecked ships are not houses: see the Bulwer wrecks; nor is a shed drawn inside a bigger building
    let A2 = 0, cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A2 += p[0] * q[1] - q[0] * p[1]; cx += p[0]; cz += p[1]; }
    if (A2 < 0) pts = pts.slice().reverse();
    const area = Math.abs(A2) / 2; cx /= n; cz /= n;
    if (area < 6) continue;
    let base = meshY(cx, cz), hi = base;
    for (let i = 0; i < n; i++) {             // the floor goes on the highest ground under the walls (felt every few metres along them, not only at the corners), so no wall is buried
      const p = pts[i], q = pts[(i + 1) % n], m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4));
      for (let k = 0; k < m; k++) { const x = p[0] + (q[0] - p[0]) * k / m, z = p[1] + (q[1] - p[1]) * k / m, y = Math.max(meshY(x, z), meshY((x + cx) / 2, (z + cz) / 2)); base = Math.min(base, y); hi = Math.max(hi, y); }
      occ.add(cellKey(p[0], p[1], 6));
    }
    occ.add(cellKey(cx, cz, 6));
    let h = b.ht > 0 ? b.ht : b.lv > 0 ? b.lv * 3.1 : area < 45 ? 2.5 : area < 300 ? (R() < 0.12 ? 5.4 : 2.7) : area < 900 ? (R() < 0.22 ? 5.6 : 3.0) : 7.6;
    h *= HK;
    let wall = WALLS[(R() * WALLS.length) | 0], roof = ROOFS[(R() * ROOFS.length) | 0];
    const inResort = resort && Math.hypot(cx - resort[0] - 100, cz - resort[1] + 20) < 800;
    if (inResort && area > 340) { if (!(b.ht > 0) && !(b.lv > 0)) h = (area > 700 ? 4 : 3) * 3.1 * HK; wall = [[.90, .86, .76], [.88, .83, .72], [.92, .89, .80]][(R() * 3) | 0]; }      // the resort's apartment blocks: three and four storeys, cream and white (the owner's photograph from the jetty)
    if (cape && Math.hypot(cx - cape[0], cz - cape[1]) < 350) { wall = [.94, .93, .89]; roof = [.50, .52, .54]; }       // the lighthouse keepers' cottages and sheds: white walls, grey roofs
    const isCape = cape && Math.hypot(cx - cape[0], cz - cape[1]) < 350, st = n === 4 && area < 340 ? houseStyle(R, area, isCape) : null;
    if (st) h = (st.stump + st.wallH) * HK;
    const y0 = base - 1.5, y1 = hi + h;
    let win = area > 30 ? 3 : 5;                 // rendered block for the larger buildings, iron for small sheds
    if (!st && !isCape && area > 30 && area < 340 && !(b.lv > 1)) { wall = pickC(R, PASTEL); roof = pickC(R, IRON); win = R() < 0.55 ? 1 : 2; }      // a house with an L or T plan: weatherboard or fibro like its neighbours
    casters.push({ pts, y: hi, h: h + Math.min(Math.sqrt(area) * 0.12, 2) * VEX });
    if (area > 55 && nl < 230 && R() < 0.7) { nl++; const q = pts[(R() * n) | 0]; lights.add([q[0] + (q[0] - cx) * 0.15, hi + 2.4 * VEX, q[1] + (q[1] - cz) * 0.15], [1, .74, .42], 0, 1, 0, 0.75); }
    if (st) {
      if (inResort) { st.wall = [[.95, .93, .86], [.93, .89, .78], [.96, .95, .92]][(R() * 3) | 0]; st.roof = [[.46, .50, .47], [.84, .84, .82], [.52, .54, .55]][(R() * 3) | 0]; st.tank = false; if (st.clad > 4.5) st.clad = 2; }      // the resort's own villas and units: cream and white, all of a kind, on town water
      buildHouse(g, pts, base, hi, st, R, freeOf(b), toStreet(cx, cz));
      // what stands in the yard: the 4WD, a clothes hoist with the washing out, the tinny on its trailer
      if (area >= 45 && !isCape && !inResort) {
        const rr = Math.sqrt(area) * 0.75, e0 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]], e1 = [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]], ax = Math.hypot(...e0) >= Math.hypot(...e1) ? e0 : e1, ang = Math.atan2(-ax[1], ax[0]);
        const spot = (rad) => { for (let t = 0; t < 14; t++) { const a = Y() * 6.283, d = rr + rad + 1.5 + Y() * 5, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, c = cells.get(Math.floor(x / CS) + ',' + Math.floor(z / CS));
          if (!anyFree(x, z, rad + 1.0) || onStreet(x, z) || maskAt(x, z).land < 0.9 || Math.abs(meshY(x + 2.5, z) - meshY(x - 2.5, z)) > 0.9 || Math.abs(meshY(x, z + 2.5) - meshY(x, z - 2.5)) > 0.9) continue;      // on ground that is close to level
          if (c && Math.hypot(x - (c[0] + 0.5) * CS, z - (c[1] + 0.5) * CS) < rad + 2.4) continue;
          if (things.some(q => Math.hypot(x - q[0], z - q[1]) < rad + q[2] + 0.6)) continue;
          things.push([x, z, rad]); return [x, z]; } return null; };
        if (Y() < 0.5) { const q = spot(3.3); if (q) { parked.push([q[0], q[1], ang + (Y() < 0.5 ? Math.PI : 0) + (Y() - 0.5) * 0.3]);
          // and the wheel tracks it has worn from the street to where it stands, if the way is clear of the neighbours
          const ts = toStreet(q[0], q[1]); if (ts && ts[2] > 6 && ts[2] < 60) { const n = Math.ceil(ts[2] / 3), pts = []; let clear = true;
            for (let k = 0; k <= n && clear; k++) { const x = q[0] + ts[0] * ts[2] * k / n, z = q[1] + ts[1] * ts[2] * k / n; clear = anyFree(x, z, 1.6); pts.push([x + Math.sin(k * 1.3) * 0.5, z + Math.cos(k * 1.7) * 0.5]); }
            if (clear) drives.push({ p: pts, c: 4 }); } } }
        if (Y() < 0.4) { const q = spot(1.9); if (q) { clothesHoist(g, q[0], meshY(q[0], q[1]), q[1], Y); (F.hoists ||= []).push(q); } }
        if (Y() < 0.22) { const q = spot(2.9); if (q) { tinnyOnTrailer(g, q[0], meshY(q[0], q[1]), q[1], ang + (Y() - 0.5) * 0.5, Y); (F.tinnies ||= []).push(q); } }
      }
      continue;
    }
    let along = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      // a big block's wall that looks to the sea: glass doors on every floor, each opening on a balcony with a balustrade
      const ex = (q[0] - p[0]) / (len || 1), ez = (q[1] - p[1]) / (len || 1), sgn = ((p[0] + q[0]) / 2 - cx) * ez - ((p[1] + q[1]) / 2 - cz) * ex > 0 ? 1 : -1, ox = ez * sgn, oz = -ex * sgn;
      const storeys = Math.round(h / HK / 3.1), sea = area > 340 && storeys >= 2 && win === 3 && len > 9 && maskAt(cx + ox * 45, cz + oz * 45).shore < maskAt(cx, cz).shore - 12, wk = sea ? win + 0.05 : win;
      g.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]], wall,
        [wk, along + len, (y0 - hi) / HK], [wk, along, (y0 - hi) / HK], [wk, along, h / HK], [wk, along + len, h / HK]);
      if (sea) for (let k = 1; k < storeys; k++) {
        const yk = hi + k * 3.1 * HK, D = 1.7, a0 = [p[0] + ex * 0.4, p[1] + ez * 0.4], a1 = [q[0] - ex * 0.4, q[1] - ez * 0.4], SLAB = [.80, .79, .75], BAL = [.90, .92, .93];
        const P = (e, out, y) => [e[0] + ox * out, y, e[1] + oz * out];
        g.quad(P(a0, 0, yk), P(a1, 0, yk), P(a1, D, yk), P(a0, D, yk), SLAB); g.quad(P(a0, 0, yk - 0.22), P(a0, D, yk - 0.22), P(a1, D, yk - 0.22), P(a1, 0, yk - 0.22), [.5, .5, .48]);
        g.quad(P(a0, D, yk - 0.22), P(a1, D, yk - 0.22), P(a1, D, yk + 1.05 * HK), P(a0, D, yk + 1.05 * HK), BAL);                                        // the balustrade along the front
        for (const e of [a0, a1]) g.quad(P(e, 0, yk - 0.22), P(e, D, yk - 0.22), P(e, D, yk + 1.05 * HK), P(e, 0, yk + 1.05 * HK), BAL);
        for (let d = 7.2; d < len - 4; d += 7.2) { const e = [p[0] + ex * d, p[1] + ez * d]; g.quad(P(e, 0, yk), P(e, D, yk), P(e, D, yk + 2.4 * HK), P(e, 0, yk + 2.4 * HK), wall); }      // a screen wall between one apartment's balcony and the next
        const dk = [wall[0] * 0.36, wall[1] * 0.36, wall[2] * 0.42]; g.quad(P(a0, 0.05, yk - 0.22 - 1.7 * HK), P(a1, 0.05, yk - 0.22 - 1.7 * HK), P(a1, 0.05, yk - 0.22), P(a0, 0.05, yk - 0.22), dk);      // the wall under each balcony lies in its shadow
        if (k === 1) for (let d = 0.4; d <= len - 0.3; d += 3.6) { const e = P([p[0] + ex * d, p[1] + ez * d], D - 0.15, 0); g.box(e[0], hi - 0.6, e[2], 0.24, yk - 0.22 - hi + 0.6, 0.24, [.92, .91, .88]); }      // the first balcony stands on posts: a verandah along the ground floor
      }
      if (sea) { const dk = [wall[0] * 0.36, wall[1] * 0.36, wall[2] * 0.42], Pw = (e, y) => [e[0] + ox * 0.05, y, e[1] + oz * 0.05]; g.quad(Pw(p, y1 - 1.0 * HK), Pw(q, y1 - 1.0 * HK), Pw(q, y1), Pw(p, y1), dk); }
      if (sea) { const yk = y1 + 0.05, a0 = [p[0], p[1]], a1 = [q[0], q[1]]; g.quad([a0[0], yk, a0[1]], [a1[0], yk, a1[1]], [a1[0] + ox * 1.9, yk - 0.1, a1[1] + oz * 1.9], [a0[0] + ox * 1.9, yk - 0.1, a0[1] + oz * 1.9], [.82, .82, .80]); }      // the roof carries out over the top balconies
      along += len + 1.3;
    }
    if (n === 4 && area < 700) {
      const [p0, p1, p2, p3] = pts, e0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), e1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const [a, b2, c, d] = e0 >= e1 ? [p0, p1, p2, p3] : [p1, p2, p3, p0];
      const rh = Math.min(Math.min(e0, e1) * 0.19, 2.3) * HK, yr = y1 + rh;
      const r0 = [(a[0] + d[0]) / 2, yr, (a[1] + d[1]) / 2], r1 = [(b2[0] + c[0]) / 2, yr, (b2[1] + c[1]) / 2];
      const ev = (q) => [cx + (q[0] - cx) * 1.03, y1 - 0.25, cz + (q[1] - cz) * 1.03];
      const A = ev(a), B = ev(b2), C = ev(c), D = ev(d);
      const rl = Math.max(e0, e1), rv = Math.min(e0, e1) / 2;
      g.quad(B, A, r0, r1, roof, [-1, rl, 0], [-1, 0, 0], [-1, 0, rv], [-1, rl, rv]); g.quad(D, C, r1, r0, roof, [-1, 0, 0], [-1, rl, 0], [-1, rl, rv], [-1, 0, rv]);
      g.tri(A, D, r0, wall); g.tri(C, B, r1, wall);
    } else {
      const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
      if (inResort && area > 340) roof = [.86, .86, .84];
      if (area > 520 && !inResort) { for (const t of tri) g.tri([pts[t[0]][0], y1, pts[t[0]][1]], [pts[t[2]][0], y1, pts[t[2]][1]], [pts[t[1]][0], y1, pts[t[1]][1]], [.70, .70, .68]); }
      else {      // hipped roof: slopes rising to a smaller copy of the outline
        const rh = Math.min(Math.sqrt(area) * 0.15, 2.4) * HK, yr = y1 + rh, inn = pts.map(p => [cx + (p[0] - cx) * 0.42, cz + (p[1] - cz) * 0.42]);
        const es = inResort ? 1.07 : 1.03, eav = pts.map(q => [cx + (q[0] - cx) * es, cz + (q[1] - cz) * es]);
        for (let i = 0; i < n; i++) { const j = (i + 1) % n, el = Math.hypot(eav[j][0] - eav[i][0], eav[j][1] - eav[i][1]), ev2 = Math.hypot(inn[i][0] - eav[i][0], inn[i][1] - eav[i][1]); g.quad([eav[j][0], y1 - 0.25, eav[j][1]], [eav[i][0], y1 - 0.25, eav[i][1]], [inn[i][0], yr, inn[i][1]], [inn[j][0], yr, inn[j][1]], roof, [-1, el, 0], [-1, 0, 0], [-1, el * 0.3, ev2], [-1, el * 0.7, ev2]); }
        for (const t of tri) g.tri([inn[t[0]][0], yr, inn[t[0]][1]], [inn[t[2]][0], yr, inn[t[2]][1]], [inn[t[1]][0], yr, inn[t[1]][1]], roof);
      }
    }
  }
  for (const p of F.pools) {
    const pts = p.p.slice(0, -1); if (pts.length < 3) continue;
    let y = -1e9; for (const q of pts) y = Math.max(y, meshY(q[0], q[1]));
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(q => new THREE.Vector2(q[0], q[1])), []);
    for (const t of tri) g.tri([pts[t[0]][0], y + 0.5, pts[t[0]][1]], [pts[t[2]][0], y + 0.5, pts[t[2]][1]], [pts[t[1]][0], y + 0.5, pts[t[1]][1]], [.10, .62, .78]);
  }
}

// ---------------------------------------------------------------- tracks and walking paths
function buildRoads(F, scene, occ) {
  const pos = [], dir = [], par = [], idx = [];
  for (const r of F.roads) {
    const pts = r.p; let L = 0;
    const hw = r.c === 4 ? 1.25 : r.c === 3 ? 1.25 : r.c === 2 ? 1.5 : r.c === 1 ? 2.4 : 3.2;
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 12));
      for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    out.push(pts[pts.length - 1]);
    const base = pos.length / 3;
    for (let i = 0; i < out.length; i++) {
      const p = out[i], a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (i > 0) L += Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]);
      const m = maskAt(p[0], p[1]);
      const y = Math.max(meshY(p[0], p[1]), meshY(p[0] - tz * 3, p[1] + tx * 3), meshY(p[0] + tz * 3, p[1] - tx * 3)) + 1.7;
      const vis = m.land > 0.5 ? 1 : 0;
      for (const s of [-1, 1]) { pos.push(p[0], y, p[1]); dir.push(tx, tz); par.push(s, L, hw, r.c + vis * 0.5); }
      if (r.c < 2) occ.add(cellKey(p[0], p[1], 6));
      if (i > 0) { const k = base + i * 2; idx.push(k - 2, k - 1, k, k, k - 1, k + 1); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  geo.setAttribute('aPar', new THREE.Float32BufferAttribute(par, 4));
  geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60000);
  const mat = makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec2 aDir; attribute vec4 aPar; varying vec3 vW; varying vec4 vP; varying float vD;
      void main(){
        float d = length(position - cameraPosition);
        float w = max(aPar.z, d * 0.0007);
        vec3 wp = position + vec3(-aDir.y, 0.0, aDir.x) * aPar.x * w;
        wp.y -= 1.45 * (1.0 - smoothstep(40.0, 320.0, d));
        vW = wp; vP = aPar; vD = d;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`
      varying vec3 vW; varying vec4 vP; varying float vD;
      void main(){
        ${LOGF}
        float cls = floor(vP.w + 0.01), on = step(0.25, fract(vP.w));
        float edge = smoothstep(1.0, 0.55, abs(vP.x));
        vec3 sand = vec3(0.66, 0.58, 0.42);
        float n = texture2D(uNoise, vW.xz / 14.0).r;
        vec3 col; float a;
        if(cls > 3.5){            // a driveway: two wheel tracks worn through the grass to bare sand, with a grassy strip left between
          float rut = smoothstep(0.3, 0.5, abs(vP.x)) * smoothstep(1.0, 0.8, abs(vP.x));
          col = vec3(0.80, 0.72, 0.52) * (0.9 + 0.2 * n); a = 0.7 * rut * (0.6 + 0.4 * texture2D(uNoise, vec2(vP.y / 23.0, 0.7)).g) * (1.0 - smoothstep(600.0, 1500.0, vD));
        } else if(cls > 2.5){            // wheel ruts pressed into the beach
          float rut = smoothstep(0.5, 0.62, abs(vP.x)) * smoothstep(0.98, 0.86, abs(vP.x));
          col = vec3(0.38, 0.31, 0.2); a = 0.55 * rut * (0.45 + 0.55 * texture2D(uNoise, vec2(vP.y / 90.0, 0.3)).g) * (0.7 + 0.3 * texture2D(uNoise, vW.xz / 5.0).b);   // tracks darken the sand a little, in sun or in shade, and are broken along their length
          a *= mix(1.0, 0.6 + 0.8 * step(0.5, fract(vP.y * 3.6 + abs(vP.x) * 3.0)), 1.0 - smoothstep(12.0, 40.0, vD));          // up close each rut shows the chevrons of the tyre's tread   // old tracks only darken the sand a little, in sun or in shade, and are broken along their length
        } else if(cls > 1.5){     // walking path: pale dashes
          float dash = mix(step(fract(vP.y / 16.0), 0.6), 1.0, smoothstep(2500.0, 6000.0, vD));
          col = vec3(0.92, 0.84, 0.66); a = 0.75 * dash * edge;
        } else if(cls > 0.5){     // sand 4WD track with wheel ruts
          float rut = smoothstep(0.25, 0.45, abs(vP.x)) * smoothstep(0.85, 0.6, abs(vP.x));
          col = sand * (0.88 + 0.2 * n) * (1.0 - 0.14 * rut * (1.0 - smoothstep(300.0, 1500.0, vD))); a = 0.82 * edge;
        } else {                  // village street
          col = vec3(0.66, 0.62, 0.53) * (0.9 + 0.15 * n); a = 0.9 * edge;
        }
        if(cls < 2.5) a *= mix(1.0 - 0.9 * smoothstep(500.0, 2200.0, vD), 1.0, smoothstep(0.1, 0.4, normalize(cameraPosition - vW).y));          // seen low across the forest, the canopy hides the tracks
        a *= on * mix(1.0, 0.38, smoothstep(6000.0, 35000.0, vD)) * (cls > 2.5 ? 1.0 - smoothstep(1500.0, 4000.0, vD) : mix(1.0, smoothstep(50.0, 450.0, vD), uDetRect.w));   // up close the photo itself shows the track
        float cs = cloudShadow(vW);
        col *= uLightCol * max(uLightDir.y, 0.0) * 0.85 * cs + uAmbSky * 1.1;
        col += vec3(0.5, 0.45, 0.36) * carLamps(vW) * 1.2;
        gl_FragColor = vec4(applyFog(col, vW), a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 4; scene.add(m);
}

// ---------------------------------------------------------------- cast shadows
// Each building's outline is swept along the sun direction onto the ground; the stencil
// buffer makes overlapping pieces darken a pixel only once.
function buildShadows(casters, scene) {
  const pos = [], ah = [], idx = [];
  for (const c of casters) {
    const n = c.pts.length, b = pos.length / 3;
    for (const p of c.pts) { pos.push(p[0], c.y, p[1]); ah.push(0); }
    for (const p of c.pts) { pos.push(p[0], c.y, p[1]); ah.push(c.h); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(b + i, b + j, b + n + j, b + i, b + n + j, b + n + i); }
    for (const t of THREE.ShapeUtils.triangulateShape(c.pts.map(p => new THREE.Vector2(p[0], p[1])), [])) idx.push(b + n + t[0], b + n + t[1], b + n + t[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aH', new THREE.Float32BufferAttribute(ah, 1)); geo.setIndex(idx);
  const mat = makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    stencilWrite: true, stencilFunc: THREE.EqualStencilFunc, stencilRef: 0, stencilZPass: THREE.IncrementStencilOp,
    vs: /* glsl */`attribute float aH; varying vec3 vW;
      void main(){ vec3 p = position; p.xz -= uLightDir.xz / max(uLightDir.y, 0.17) * aH; p.y = max(texture2D(uHeight, worldUV(p.xz)).r, uSeaM - 0.4) * uVex + 1.1; vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); ${LOGV} }`,
    fs: /* glsl */`varying vec3 vW; void main(){ ${LOGF} float a = 0.6 * clamp(dot(uLightCol, vec3(0.14)), 0.0, 1.0) * smoothstep(0.02, 0.12, uLightDir.y) * cloudShadow(vW); gl_FragColor = vec4(uAmbSky * 0.04, a * (1.0 - fogAmount(vW))); }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
}

// ---------------------------------------------------------------- trees
// Dense forest generated on the GPU in two rings that follow the view: every grid cell
// around the camera target grows a tree where the imagery is wooded, coloured from the
// satellite picture, standing on the real ground, and kept off tracks and buildings.
function buildOverlay(F) {
  const cw = 2048, ch = Math.round(cw * T.sz / T.sx), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch); c.lineCap = c.lineJoin = 'round'; c.globalCompositeOperation = 'lighter';
  const X = (x) => (x / T.sx + .5) * cw, Z = (z) => (z / T.sz + .5) * ch;
  c.strokeStyle = '#00ff00';
  for (const r of F.roads) { c.lineWidth = r.c === 2 ? 0.9 : 1.5; c.beginPath(); r.p.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.stroke(); }
  // the two airstrips: a broad cleared lane, run on well past each end, so that no tree, bush or fern stands on the strip or in the way of a take-off
  { const mpp = T.sx / cw; c.strokeStyle = '#00ff00';
    for (const r of F.runways || []) { if (!r.p || r.p.length < 2) continue; const a = r.p[0], b = r.p[r.p.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (const [ext, wid] of [[260, 46], [90, 78]]) { c.lineWidth = Math.max(2.5, wid / mpp); c.lineCap = 'butt'; c.beginPath(); c.moveTo(X(a[0] - ux * ext), Z(a[1] - uz * ext)); c.lineTo(X(b[0] + ux * ext), Z(b[1] + uz * ext)); c.stroke(); } }
    c.lineCap = 'round'; }
  c.globalCompositeOperation = 'lighten'; c.fillStyle = '#240000';             // a faint red halo round every building: the yards of a settlement
  for (const b of F.buildings) { if (b.k === 'ship') continue; c.beginPath(); c.arc(X(b.p[0][0]), Z(b.p[0][1]), 5, 0, 6.2832); c.fill(); }
  c.globalCompositeOperation = 'lighter';
  c.filter = 'blur(1.2px)'; c.fillStyle = c.strokeStyle = '#ff0000'; c.lineWidth = 2.4;
  for (const b of F.buildings) { c.beginPath(); b.p.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.closePath(); c.fill(); c.stroke(); }
  c.filter = 'none'; c.fillStyle = '#0000ff';                    // blue: open fresh water, where no tree stands
  for (const l of F.lakes) { c.beginPath(); l.p.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.closePath(); c.fill(); }
  // the 4WDs' own ways (the beach runs, and the inland tracks they take round a beach the tide has shut): a wider lane in which no tree or big bush stands
  c.strokeStyle = '#000070'; c.lineWidth = 2.3;
  for (const r of F.drive || []) for (const p of [r.p, ...(r.tidal || []).map(q => q.path).filter(Boolean)]) { c.beginPath(); p.forEach((q, i) => i ? c.lineTo(X(q[0]), Z(q[1])) : c.moveTo(X(q[0]), Z(q[1]))); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  U.uOver.value = t;
}
function crown(detail, blobs, trunk) {
  const ico = new THREE.IcosahedronGeometry(1, detail), P = ico.attributes.position, pos = [], nrm = [], idx = [], part = [];
  const ix = ico.index ? Array.from(ico.index.array) : Array.from({ length: P.count }, (_, i) => i);
  blobs.forEach((b) => {
    const base = pos.length / 3;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); pos.push(b[0] + x * b[3], b[1] + y * b[3], b[2] + z * b[3]); nrm.push(x, y, z); part.push(0); }
    for (const i of ix) idx.push(base + i);
  });
  if (trunk) {                                   // a tapering stem from the ground (y = 0) up into the crown (y = 1)
    const base = pos.length / 3, S = 6;
    for (let k = 0; k <= 1; k++) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2, r = k ? 0.05 : 0.11; pos.push(Math.cos(a) * r, k, Math.sin(a) * r); nrm.push(Math.cos(a), 0, Math.sin(a)); part.push(1); }
    for (let i = 0; i < S; i++) { const j = (i + 1) % S; idx.push(base + i, base + S + i, base + j, base + j, base + S + i, base + S + j); }
  }
  return { pos: new THREE.Float32BufferAttribute(pos, 3), nrm: new THREE.Float32BufferAttribute(nrm, 3), part: new THREE.Float32BufferAttribute(part, 1), idx };
}
// The parts of a tree, all placed and bent by the tree shader: clumps of leaves (unit spheres), a trunk
// tube up to the fork, a few limb tubes from the fork, and thin twigs from the limbs out to the other clumps.
function speciesTree(K, B) {
  const ico = new THREE.IcosahedronGeometry(1, 0), P = ico.attributes.position, pos = [], nrm = [], idx = [], part = [], blob = [];
  const ix = ico.index ? Array.from(ico.index.array) : Array.from({ length: P.count }, (_, i) => i);
  for (let k = 0; k < K; k++) {
    const base = pos.length / 3;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); pos.push(x, y, z); nrm.push(x, y, z); part.push(0); blob.push(k); }
    for (const i of ix) idx.push(base + i);
  }
  const tube = (rings, S, kind, which) => {
    const base = pos.length / 3;
    for (let k = 0; k <= rings; k++) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2; pos.push(Math.cos(a), k / rings, Math.sin(a)); nrm.push(Math.cos(a), 0, Math.sin(a)); part.push(kind); blob.push(which); }
    for (let k = 0; k < rings; k++) for (let i = 0; i < S; i++) { const j = (i + 1) % S, q = base + k * S; idx.push(q + i, q + S + i, q + j, q + j, q + S + i, q + S + j); }
  };
  tube(7, B > 3 ? 6 : 4, 1, 0);                           // many short sections, so every bend reads as a curve; enough sides to read as round, not as a ribbon
  for (let i = 0; i < B; i++) tube(5, B > 3 ? 4 : 3, 2, i);
  for (let k = B; k < K; k++) tube(3, 3, 3, k);          // a twig out to every clump that does not sit on a limb end
  return { pos: new THREE.Float32BufferAttribute(pos, 3), nrm: new THREE.Float32BufferAttribute(nrm, 3), part: new THREE.Float32BufferAttribute(part, 1), blob: new THREE.Float32BufferAttribute(blob, 1), idx, K, B };
}
// Grass trees (Xanthorrhoea): a black trunk, a ball of long thin leaves, green above with a skirt of dead brown ones
// hanging round the trunk, and on some a flower spike standing far above. One plant is modelled here; the shader
// sets its height, lean and whether it carries a spike.
function buildGrassTrees(scene) {
  const pos = [], col = [], pt = [], idx = [], R = rng(606);
  for (let k = 0; k <= 4; k++) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, r = 0.15 - 0.04 * k / 4; pos.push(Math.cos(a) * r, k / 4, Math.sin(a) * r); col.push(0.035, 0.033, 0.035); pt.push(0, k / 4); }
  for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++) { const j = (i + 1) % 5, q = k * 5; idx.push(q + i, q + 5 + i, q + j, q + j, q + 5 + i, q + 5 + j); }
  const NB = dq(48, 68, 90);                       // a grass tree's head is a ball of a hundred or more wiry leaves, each no wider than a finger
  for (let i = 0; i < NB; i++) {
    const az = i * 2.39996, el = 1.4 - 2.6 * Math.pow(i / (NB - 1), 0.85) + (R() - 0.5) * 0.25, L = 0.85 + 0.45 * R(), dead = el < -0.15, base = pos.length / 3;
    const g = dead ? [0.40 + R() * 0.1, 0.29 + R() * 0.06, 0.17] : [0.17 + R() * 0.06, 0.30 + R() * 0.08, 0.15];
    for (let j = 0; j <= 2; j++) {
      const u = j / 2, out = L * u * Math.cos(el), y = L * u * Math.sin(el) - 0.4 * u * u * L * (dead ? 0.6 : 1), w = 0.016 * (1 - u) + 0.004;
      for (const sd of [-1, 1]) { pos.push(Math.cos(az) * out - Math.sin(az) * w * sd, y, Math.sin(az) * out + Math.cos(az) * w * sd); const f = 0.75 + 0.5 * u; col.push(g[0] * f, g[1] * f, g[2] * f); pt.push(1, u); }
      if (j) { const q = base + j * 2; idx.push(q - 2, q - 1, q, q, q - 1, q + 1); }
    }
  }
  const sb = pos.length / 3;
  for (const [y, r] of [[0.1, 0.02], [1.5, 0.02], [1.55, 0.045], [3.1, 0.035], [3.2, 0.0]]) for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); col.push(...(y > 1.5 ? [0.17, 0.12, 0.08] : [0.33, 0.36, 0.2])); pt.push(2, y / 3.2); }
  for (let k = 0; k < 4; k++) for (let i = 0; i < 3; i++) { const j = (i + 1) % 3, q = sb + k * 3; idx.push(q + i, q + 3 + i, q + j, q + j, q + 3 + i, q + 3 + j); }
  const n = dq(44, 54, 64), cs = 6.5;
  const g = new THREE.InstancedBufferGeometry();          // (one grass tree; gridBlocks below lays the grid of them out)
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aPT', new THREE.Float32BufferAttribute(pt, 2)); g.setIndex(idx);
  const uni = { uCentre: { value: new THREE.Vector2() }, uCS: { value: cs }, uRange: { value: n / 2 * cs } };
  const mat = makeMat({
    uniforms: uni, side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec2 iCell, aPT; attribute vec3 aCol; uniform vec2 uCentre, uWindDir; uniform float uCS, uRange; varying vec3 vCol, vW;
      void main(){
        vec2 cell = uCentre + iCell;
        float h1 = hash12(cell), h2 = hash12(cell + 17.3), h3 = hash12(cell * 1.7 + 5.1), h4 = hash12(cell * 0.37 + 91.0);
        vec2 xz = (cell + vec2(h1, h2)) * uCS, uv = worldUV(xz);
        vec3 mk = texture2D(uMask, uv).rgb, ov = texture2D(uOver, uv).rgb; float hgt = texture2D(uHeight, uv).r;
        // on the heath and under open forest, in clumps (thick in some places, none in others)
        float thick = smoothstep(0.35, 0.6, texture2D(uNoise, xz / 260.0).r);
        float on = step(0.92, mk.r) * step(1.8, hgt) * (1.0 - smoothstep(0.35, 0.7, mk.g)) * (1.0 - smoothstep(0.06, 0.3, max(max(ov.r, ov.g), ov.b))) * step(h3, 0.03 + 0.22 * thick);
        on *= 1.0 - smoothstep(uRange * 0.75, uRange * 0.97, length(xz - (uCentre + 0.5) * uCS));
        if(on <= 0.002){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        float trunkH = 0.25 + 2.0 * h4 * h4, size = (0.8 + 0.5 * h1) * 1.25, spike = step(0.72, h2), part = aPT.x;
        vec3 lp = position;
        if(part < 0.5) lp.y *= trunkH; else lp.y += trunkH;
        if(part > 1.5 && spike < 0.5) lp = vec3(0.0, trunkH, 0.0);
        if(part > 0.5 && part < 1.5) lp.xz += uWindDir * aPT.y * aPT.y * (0.05 + 0.04 * sin(uTime * 2.3 + h1 * 30.0 + position.y * 3.0));       // the leaves shiver in the wind
        if(part > 1.5) lp.xz += vec2(h1 - 0.5, fract(h3 * 9.0) - 0.5) * 0.12 * aPT.y * aPT.y * 3.2;                                              // spikes are never quite straight
        lp.xz += vec2(cos(h2 * 6.2832), sin(h2 * 6.2832)) * (h3 * 20.0 - floor(h3 * 20.0) - 0.3) * 0.25 * lp.y * lp.y / max(trunkH + 1.0, 1.0);   // trunks lean and bend
        float ca = cos(h1 * 6.2832), sa = sin(h1 * 6.2832);
        lp = vec3(lp.x * ca - lp.z * sa, lp.y, lp.x * sa + lp.z * ca) * size * on;
        vec3 wp = vec3(xz.x, groundY(xz), xz.y) + lp;
        float lit = part > 0.5 && part < 1.5 ? 0.35 + 0.5 * max(uLightDir.y, 0.0) : 0.2 + 0.6 * max(uLightDir.y, 0.0);
        vCol = aCol * (0.8 + 0.4 * h2) * (uLightCol * lit * cloudShadow(wp) + uAmbSky * 0.9); vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }`,
  });
  const grid = gridBlocks(scene, g, mat, n, cs, 12); for (const b of grid.blocks) b.m.name = 'grassTrees';
  return (target, camDist) => { grid.on = camDist < 900; uni.uCentre.value.set(Math.floor(target.x / cs), Math.floor(target.z / cs)); };
}
function buildTrees(F, scene) {
  const rings = [];
  const ring = (n, cs, rmin, rmax, squash, dmax, inner, base, leafy, mode = 0) => {
    const geo = new THREE.InstancedBufferGeometry(); geo.setIndex(base.idx);          // (one tree or bush; gridBlocks below lays the grid of them out) geo.setAttribute('position', base.pos); geo.setAttribute('normal', base.nrm); geo.setAttribute('aPart', base.part); if (base.blob) geo.setAttribute('aBlob', base.blob);
    const uni = { uCentre: { value: new THREE.Vector2() }, uCS: { value: cs }, uRange: { value: n / 2 * cs }, uRad: { value: new THREE.Vector3(rmin, rmax, squash) }, uDmax: { value: dmax }, uInner: { value: inner }, uMode: { value: mode }, uPorous: { value: mode === 2 ? 0.74 : 0.6 }, uForceSp: { value: -1 } };       // (scrub sets its own porosity per bush)
    const mat = makeMat({
      uniforms: uni, defines: { ...(leafy ? { LEAFY: 1 } : {}), ...(base.blob ? { SPECIES: 1, NLIMB: base.B.toFixed(1) } : {}) }, side: leafy ? THREE.DoubleSide : THREE.FrontSide,
      vs: /* glsl */`
        attribute vec2 iCell; attribute float aPart; uniform vec2 uCentre; uniform float uForceSp, uCS, uRange, uDmax, uInner, uMode; uniform vec3 uRad;
        varying vec3 vCol, vDir, vN, vObj, vWp; varying float vFog, vTrunk, vPor, vSp, vLs; varying vec2 vBark; uniform float uPorous;
        #ifdef SPECIES
        attribute float aBlob;            // crown: which clump; limb: which limb
        // a point along a limb, in units of the tree's height: from the fork P to its end E, bowed up by arch and kinked sideways
        vec3 limbAt(vec3 P, vec3 E, float u, float arch, float kink){
          vec3 d = E - P; float len = length(d), v = 1.0 - u;
          vec3 side = normalize(vec3(-d.z, 0.0, d.x) + vec3(0.001, 0.0, 0.0));
          vec3 C = P + vec3(d.x * 0.12, d.y * 0.6, d.z * 0.12);                 // it leaves the fork still heading up the trunk, then curves away: no sharp elbow
          return v * v * P + 2.0 * u * v * C + u * u * E + vec3(0.0, sin(3.1416 * u) * arch * len * 0.6, 0.0) + side * sin(3.1416 * u) * kink * (fract(len * 37.0) > 0.5 ? 1.0 : -1.0) * len;      // one long bow up and one to the side: a limb sweeps, it does not zigzag
        }
        #endif
        void main(){
          vec2 cell = uCentre + iCell;
          float h1 = hash12(cell), h2 = hash12(cell + 17.3), h3 = hash12(cell * 1.7 + 5.1), h4 = hash12(cell * 0.37 + 91.0);
          float yard = 0.0;
          #ifdef SPECIES
          { vec2 yuv = (cell - uYardO.xy + 0.5) * uYardO.zw; if(yuv.x > 0.0 && yuv.x < 1.0 && yuv.y > 0.0 && yuv.y < 1.0) yard = step(0.5, texture2D(uYard, yuv).r); }      // a garden tree stands near the middle of its cell, which is known to be clear of the houses
          #endif
          vec2 jit = vec2(h1, h2);
          if(uMode > 0.5) jit = fract(jit + texture2D(uNoise, cell * 0.37 + 0.11).rg + texture2D(uNoise, cell / 41.0).gb * 2.0);      // low plants are scattered, never in rows
          vec2 xz = (cell + mix(jit, 0.5 + (jit - 0.5) * 0.3, yard)) * uCS;
          vec2 uv = worldUV(xz);
          vec3 mk = texture2D(uMask, uv).rgb;
          float hgt = texture2D(uHeight, uv).r;
          vec3 alb = texture2D(uAlbedo, uv).rgb;
          vec3 ov = texture2D(uOver, uv).rgb;
          float lum = dot(alb, vec3(0.3, 0.55, 0.15));
          float sandm = smoothstep(0.1, 0.5, mk.g + (h4 - 0.5) * 0.45), clr = 1.0 - smoothstep(0.06, 0.3, max(max(ov.r, ov.g), ov.b));
          // where trees grow: anywhere the photograph is clearly darker than bare sand (forest here photographs olive-brown, never bright).
          // Near the view the sharp aerial photograph is used, so small sand patches among the scrub stay bare.
          vec2 duv = (xz - uDetRect.xy) * uDetRect.z; vec4 dtx = texture2D(uDetail, clamp(duv, 0.0, 1.0));
          float dIn = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0) * dtx.a * uDetRect.w;
          float lumP = mix(lum, dot(dtx.rgb / max(dtx.a, 0.01), vec3(0.3, 0.55, 0.15)), dIn);
          float treeK = smoothstep(0.46, 0.26, lumP), rkR = 0.0;
          { // round Tangalooma resort the forest stands right behind and between the buildings (the owner's aerial photograph), whatever the coarse sand map says
            float rk = (1.0 - smoothstep(uResort.z * 0.8, uResort.z, length(xz - uResort.xy))) * step(2.6, hgt) * smoothstep(60.0, 95.0, (mk.b - 0.5) * 3000.0);
            sandm *= 1.0 - rk; treeK = max(treeK, rk); rkR = rk; }
          { // The sides of the island are always dense (the owner's photographs of the western shore): the slopes that rise from the beaches carry a
            // closed wall of tall forest right down to the sand, broken only by real sand blows (bright in the photograph), tracks and buildings.
            float coastK = (1.0 - smoothstep(380.0, 750.0, (mk.b - 0.5) * 3000.0)) * smoothstep(3.0, 7.0, hgt) * mix(0.55, 1.0, 1.0 - smoothstep(0.25, 0.5, texture2D(uHeight, uv).g))
                         * (1.0 - smoothstep(0.52, 0.64, lumP)) * smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(xz - uCape.xy));
            coastK *= 1.0 - smoothstep(0.55, 0.85, mk.g);          // (a sand blow is open sand on the map as well as bright in the photograph)
            if(coastK > 0.01){ float hx = texture2D(uHeight, worldUV(xz + vec2(22.0, 0.0))).r, hz = texture2D(uHeight, worldUV(xz + vec2(0.0, 22.0))).r; coastK *= smoothstep(0.05, 0.14, length(vec2(hx - hgt, hz - hgt)) / 22.0); }      // (slopes, not the low flats behind the beaches)
            sandm *= 1.0 - coastK; treeK = max(treeK, coastK); rkR = max(rkR, coastK); }          // (the island's forest photographs mid-dark, about 0.3: it must count as forest, or the hills stand half bare)
          float dens = uMode > 1.5 ? step(0.92, mk.r) * step(0.9, hgt) * clr * mix(0.5, 0.07, sandm) * step(0.508, mk.b)        // low plants: everywhere but bare beach
                                   : (1.0 - sandm) * step(0.92, mk.r) * step(1.5, hgt) * clr * treeK;          // (trees start at the back of the berm, clear of the highest tide)
          #ifdef SPECIES
          // which tree grows here (0 eucalypt, 1 she-oak, 2 banksia, 3 paperbark, 4 mangrove), from how far inland and how high the spot is
          float shoreD = (mk.b - 0.5) * 3000.0, hs = hash12(cell * 2.3 + 40.0), hs2 = hash12(cell * 0.71 + 7.7);
          float sp = hs < 0.6 ? 0.0 : hs < 0.82 ? 2.0 : 1.0;                         // dune forest: scribbly gum and bloodwood, banksia, forest she-oak
          // low wet flats: paperbarks and swamp gums over a carpet of fern; fire goes through often, so trunks are dark and many trees stand dead
          float wetland = (1.0 - smoothstep(7.0, 11.0, hgt)) * smoothstep(120.0, 260.0, shoreD) * (1.0 - smoothstep(0.05, 0.13, ov.r)) * (1.0 - rkR);          // (the forest wall of the island's sides is gum forest, not swamp)
          if(wetland > 0.5) sp = hs < 0.55 ? 3.0 : hs < 0.8 ? 0.0 : 1.0;
          if(shoreD < 170.0 && hgt < 22.0) sp = rkR > 0.5 ? (hs < 0.14 ? 1.0 : hs < 0.26 ? 2.0 : 0.0) : hs < 0.45 ? 1.0 : hs < 0.75 ? 2.0 : 0.0;   // behind the beach: coastal she-oak, coast banksia, and the forest coming down to the sand
          float swept = 1.0 - smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(xz - uCape.xy));          // on the cape the wind shapes everything
          if(swept > 0.5){ sp = hs < 0.82 ? 2.0 : 1.0; dens *= 0.55; }
          if(hgt < 1.7 && shoreD < 130.0){                                               // dark growth at the tide line: mangroves
            sp = 4.0; dens = step(0.92, mk.r) * step(0.2, hgt) * clr * smoothstep(0.2, 0.07, lum) * (1.0 - sandm);
          }
          { // and on the sheltered south-western shore (below the sandhills, as the owner photographed) clumps of mangroves stand out in the shallows, their feet in the water
            float bay = 1.0 - smoothstep(0.25, 0.4, texture2D(uHeight, uv).g), stand = step(0.6, texture2D(uNoise, xz / 240.0 + 0.4).r);
            if(hgt > -0.5 && hgt < 0.9 && shoreD > -70.0 && shoreD < 40.0 && xz.y > 9000.0 && bay * stand > 0.5){ sp = 4.0; dens = 0.55 * clr; } }
          if(yard > 0.5){ dens = mix(0.5, 0.82, 1.0 - smoothstep(uResort.z * 0.85, uResort.z, length(xz - uResort.xy))) * step(0.92, mk.r) * step(1.5, hgt) * smoothstep(40.0, 70.0, shoreD); sp = hs < 0.58 ? 0.0 : hs < 0.8 ? 1.0 : hs < 0.9 ? 2.0 : 3.0; }      // in the yards: a gum, a she-oak, a banksia or a paperbark by the house
          if(uForceSp > -0.5) sp = uForceSp;          // (for looking at one kind of tree on its own)
          if(uForceSp < -1.5 && !(sp > 0.5 && sp < 1.5)) dens = 0.0;      // (or at the she-oaks alone, where they really stand)
          #endif
          if(uMode > 2.5) dens = step(0.92, mk.r) * step(1.2, hgt) * clr * (1.0 - sandm) * (1.0 - smoothstep(0.36, 0.52, lumP)) * 0.82 * step(0.51, mk.b) * (1.0 - 0.65 * (1.0 - smoothstep(7.0, 11.0, hgt)) * smoothstep(120.0, 260.0, (mk.b - 0.5) * 3000.0));       // scrub fills the country between the trees
          if(uMode > 1.5){ float th = texture2D(uNoise, xz / 85.0 + 0.37).g * 0.7 + texture2D(uNoise, xz / 23.0 + 0.11).r * 0.3; dens *= mix(0.07, 1.7, smoothstep(0.43, 0.57, th)); }      // low growth stands in thickets some metres across, with open sand between them
          dens *= step(0.003, uv.x) * step(uv.x, 0.997) * step(0.003, uv.y) * step(uv.y, 0.997) * (1.0 - sandBlow(xz));
          float dc0 = length(vec3(xz.x, hgt * uVex, xz.y) - cameraPosition);
          float s = (1.0 - smoothstep(uRange * 0.72, uRange * 0.98, max(abs(xz.x - (uCentre.x + 0.5) * uCS), abs(xz.y - (uCentre.y + 0.5) * uCS)))) * (1.0 - smoothstep(uDmax * 0.55, uDmax, dc0));
          #ifdef SPECIES
          if(yard < 0.5) dens *= mix(mix(0.4, 1.3, smoothstep(0.38, 0.62, texture2D(uNoise, xz / 60.0 + 0.17).b)), 1.3, rkR);      // trees stand in groves with open ground between, not evenly like an orchard
          #endif
          s *= step(h3, dens * 1.15) * smoothstep(uInner * 0.75, uInner, length(xz - (uCentre + 0.5) * uCS));
          if(uInner > 1.0) s *= max(smoothstep(0.42, 0.24, lum), rkR);
          if(s <= 0.002){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }      // nothing grows in this cell: skip the rest
          vec3 base = vec3(xz.x, groundY(xz), xz.y);                    // the drawn ground, so nothing floats or sinks
          float ang = h1 * 6.2832, ca = cos(ang), sa = sin(ang);
          vec3 q = vec3(position.x * ca - position.z * sa, position.y, position.x * sa + position.z * ca);
          if(uMode > 1.5 && uMode < 2.5) q.y *= 1.0 - 0.82 * flatK(xz);          // the low plants lie down where a wheel has just been
          vec3 nrm = normalize(vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca));
          vec3 c = alb * 1.3 + vec3(0.002, 0.006, 0.0);
          c = mix(c, vec3(lum * 1.35, lum * 1.65, lum * 0.7), 0.28) * (0.9 + 0.5 * h2);
          c = mix(c, c * vec3(1.25, 1.1, 0.7), step(0.8, h3) * 0.5);
          if(uMode < 0.5) c = mix(c, vec3(0.168, 0.20, 0.08) * (0.85 + 0.4 * h2) * (1.0 - 0.22 * yard), max(smoothstep(0.2, 0.36, lum), yard));      // a tree standing on pale sand or in a yard is as green as one in the forest: its leaves do not take the colour of the ground
          float ao; vec3 lp; vPor = uPorous; vBark = vec2(0.0); vSp = 0.0; vLs = 2.53;
          #ifdef SPECIES
            // Each kind of tree has its own build, and each tree its own form: where the trunk forks, how far the limbs
            // spread and bow, how much it leans and wanders. form picks between the distinct forms of a kind.
            float big = (0.75 + 0.45 * smoothstep(0.12, 0.03, lum)) * (0.8 + 0.4 * h4), form = hash12(cell * 3.1 + 11.0);
            float H, tr, lean, wig, fork, spread, top0, top1 = 0.98, arch, kink, twig, rbK, hang = 0.2; vec3 sc = vec3(1.0), bark, tint;
            if(sp < 0.5){ H = 14.0; tr = 0.0165; vPor = 0.67; rbK = 0.115; sc.y = 1.05; twig = 0.2;                      // eucalypt: pale scribbly gum or dark rough bloodwood
              bark = hs2 < 0.45 ? vec3(0.50, 0.47, 0.41) : vec3(0.29, 0.23, 0.18); tint = vec3(0.90, 1.0, 0.86);
              if(form < 0.38){ fork = 0.46; spread = 0.24; top0 = 0.76; arch = 0.12; kink = 0.09; lean = 0.16; wig = 0.07; }           // tall, forking high
              else if(form < 0.74){ fork = 0.22; spread = 0.4; top0 = 0.62; arch = 0.24; kink = 0.13; lean = 0.14; wig = 0.09; }     // forking low into wide, twisting limbs
              else { fork = 0.34; spread = 0.3; top0 = 0.66; arch = 0.15; kink = 0.14; lean = 0.38; wig = 0.13; } }                 // leaning and crooked
            else if(sp < 1.5){                                                          // she-oak (casuarina), in the two forms the owner photographed:
              bark = vec3(0.20, 0.17, 0.15); tint = vec3(0.82, 0.98, 0.78); kink = 0.07; wig = 0.05;          // grey-green; (a bluer, paler mix read from a distance as grey boulders)
              float tallOak = step(0.5, smoothstep(45.0, 110.0, shoreD) + (hs2 - 0.5) * 0.4 + yard);
              if(tallOak > 0.5){                                                       // the tall one, standing behind the beach-front trees and through the forest: several thin dark stems that climb steeply
                H = 14.0; tr = 0.012; vPor = 0.68; rbK = 0.085; sc = vec3(0.9, 1.3, 0.9); twig = 0.12; hang = -0.45;      // from near the ground, an open see-through crown, a tuft of long drooping needles at every twig end
                top0 = 0.26; top1 = 1.0; arch = 0.07; fork = 0.09 + 0.12 * form; spread = 0.2; lean = 0.1;
              } else {                                                                 // the low one at the back of the beach: limbs that reach out and droop over the sand, hung with plumes of needles
                H = 8.5; tr = 0.017; vPor = 0.42; rbK = 0.13; sc = vec3(0.85, 1.6, 0.85); twig = 0.14; hang = -0.8;
                top0 = 0.12; top1 = 0.8; arch = 0.24; fork = 0.16 + 0.1 * form; spread = 0.42; lean = form > 0.8 ? 0.42 : 0.12;
              } }
            else if(sp < 2.5){ H = 6.0; tr = 0.029; vPor = 0.58; rbK = 0.2; sc.y = 0.8; twig = 0.24; bark = vec3(0.19, 0.15, 0.12); tint = vec3(0.72, 0.88, 0.66);    // banksia: low, gnarled, dense and dark
              fork = 0.14 + 0.2 * form; spread = 0.46; top0 = 0.55; arch = 0.1; kink = 0.2; lean = 0.38; wig = 0.14; }
            else if(sp < 3.5){ H = 10.0; tr = 0.021; vPor = 0.62; rbK = 0.13; sc.y = 1.15; twig = 0.09; bark = vec3(0.70, 0.68, 0.62); tint = vec3(0.92, 1.0, 0.84);     // paperbark: white papery stems, often several
              fork = 0.1 + 0.3 * form; spread = 0.18; top0 = 0.8; arch = 0.04; kink = 0.05; lean = 0.12; wig = 0.05; }
            else { H = 4.2; tr = 0.026; vPor = 0.48; rbK = 0.3; sc.y = 0.7; twig = 0.18; bark = vec3(0.24, 0.21, 0.17); tint = vec3(0.95, 1.22, 0.62);                  // mangrove: low and spreading, bright green
              fork = 0.18; spread = 0.45; top0 = 0.6; arch = 0.1; kink = 0.08; lean = 0.15; wig = 0.06; }
            if(wetland > 0.5) bark = mix(bark, vec3(0.15, 0.115, 0.09), 0.8);          // in the wet country every trunk is dark, rough and often scorched
            float dense = max(smoothstep(0.30, 0.12, lum), rkR);                         // closed forest: crowns spread until they meet
            rbK *= 1.0 + 1.0 * dense; spread *= 1.0 + 0.3 * dense; twig *= 1.0 + 0.3 * dense; vPor -= 0.09 * dense;
            rbK *= 1.0 + 0.45 * rkR; spread *= 1.0 + 0.25 * rkR; vPor -= 0.15 * rkR;          // in the forest wall of the island's sides the crowns are broad and full, and close up one into the next
            wig = clamp(wig * 0.4, 0.02, 0.034) * (0.7 + 0.6 * h4) * (hash12(cell * 4.7 + 3.0) < 0.17 ? 2.6 : 1.0); kink = max(kink * 0.5, 0.03); arch *= 0.6; lean *= mix(0.3, 0.2, yard); spread *= 1.0 + 0.2 * yard; rbK *= 1.0 + 0.25 * yard; H *= 1.0 + 0.25 * yard;
            { float gir = hash12(cell * 5.3 + 8.0); tr *= 0.62 + 0.9 * gir * gir; vSp = sp; if(NLIMB > 3.5) rbK *= 0.84; }            // saplings, grown trees and the odd old giant; with more clumps on a tree each is smaller            // no tree grows straight, but real trunks and limbs bend in long, easy curves
            fork *= 0.85 + 0.3 * h3; if(yard > 0.5 && sp < 0.5) fork = max(fork, 0.42);          // a garden gum has a clear trunk to above the roof before it forks
            H *= big * 1.25 * (1.0 + 0.4 * rkR * step(sp, 0.5));          // (the gums of the coastal wall are tall)                                  // trees share the relief's exaggeration
            if(swept > 0.5){ lean = 0.6; if(sp > 1.5){ vPor = 0.46; rbK = 0.26; H *= 1.2; } }          // dense dark crowns, trunks laid over to the north-west
            vec2 ld = (swept > 0.5 ? normalize(vec2(-0.8, -0.6) + (vec2(h2, h1) - 0.5) * 0.7) : vec2(cos(h2 * 6.2832), sin(h2 * 6.2832))) * lean * (0.4 + 0.6 * h3);
            float wph = h1 * 6.2832;
            // centre of the trunk at fraction t of the way up to the fork: it leans, and sways once or twice on the way up
            #define TRUNK(t) vec3(ld.x * (t) * (t) * fork + (sin((t) * 2.4 + wph) + 0.16 * sin((t) * 5.5 + wph * 1.7)) * wig * (t), (t) * fork, ld.y * (t) * (t) * fork + (cos((t) * 2.0 + wph) + 0.16 * cos((t) * 4.9 + wph * 2.3)) * wig * (t))
            vec3 P = TRUNK(1.0);
            float li = (aPart > 1.5 && aPart < 2.5) ? aBlob : mod(aBlob, NLIMB);          // the limb this vertex belongs to, or the limb its clump and twig grow from
            float hb = hash12(cell + li * 13.7), hb2 = hash12(cell * 1.3 + li * 5.1 + 2.0), la = 6.2832 * (li / NLIMB + 0.3 * hb + h1), reach = spread * (0.55 + 0.6 * hb);
            vec3 E = vec3(P.x + cos(la) * reach, mix(top0, top1, hb2), P.z + sin(la) * reach);
            E.xz += ld * (E.y - fork);                                                  // the crown carries on the lean
            // the clump of leaves this vertex belongs to (for a twig: the clump it carries). One sits at the end of each limb;
            // the rest hang out on twigs that leave the limbs every which way, and some twigs have lost their leaves.
            float k = aBlob, sec = step(NLIMB - 0.5, k), hk = hash12(cell + k * 7.9 + 3.0), hk2 = hash12(cell * 0.9 + k * 3.3 + 1.0), hk3 = hash12(cell * 1.9 + k * 2.1 + 6.0);
            vec3 Q = limbAt(P, E, 1.0 - sec * (0.25 + 0.5 * hk), arch, kink);
            vec3 tw = normalize(vec3(cos(hk * 6.2832 + la), 0.35 + 1.1 * (hk2 - 0.35), sin(hk * 6.2832 + la))) * twig * (0.6 + 0.8 * hk3);
            vec3 bc = Q + sec * tw;
            // some country has burnt: trunks there are charred black from the ground up
            float burnt = max(smoothstep(0.5, 0.62, texture2D(uNoise, xz / 900.0).b), wetland * 0.8) * step(sp, 3.5), deadTree = step(hash12(cell * 0.31 + 2.0), 0.3 * wetland), mott = (sp < 0.5 && hs2 < 0.45) || (sp > 2.5 && sp < 3.5) ? 1.0 : 0.3;
            if(aPart > 2.5){                 // twig
              float u = position.y;
              vec3 c0 = Q + tw * u + vec3(0.0, sin(3.1416 * u) * 0.16 * length(tw), 0.0) + normalize(vec3(-tw.z, 0.0, tw.x) + 0.0001) * sin(3.1416 * u) * (hk - 0.5) * 0.24 * length(tw), dir = normalize(tw + vec3(0.0, 0.0001, 0.0));
              vec3 ax = normalize(cross(dir, vec3(0.31, 0.0, 0.95))), ay = cross(dir, ax), ring = ax * position.x + ay * position.z;
              lp = (c0 + ring * tr * mix(0.3, 0.07, u)) * H * s; nrm = ring;
              c = bark * (0.7 + 0.5 * h2); ao = 0.7; vBark = vec2(mott, burnt * 0.1);
            } else if(aPart > 1.5){          // limb
              float u = position.y;
              vec3 c0 = limbAt(P, E, u, arch, kink), dir = normalize(limbAt(P, E, u + 0.06, arch, kink) - c0);
              vec3 ax = normalize(cross(dir, vec3(0.31, 0.0, 0.95))), ay = cross(dir, ax), ring = ax * position.x + ay * position.z;
              lp = (c0 + ring * tr * mix(0.62, 0.2, u)) * H * s; nrm = ring;
              c = bark * (0.75 + 0.5 * h2) * mix(1.0, 0.5, smoothstep(250.0, 700.0, dc0)); ao = 0.6 + 0.3 * u; vBark = vec2(mott, burnt * 0.25 * (1.0 - u));
            } else if(aPart > 0.5){          // trunk
              float t = position.y;
              lp = (TRUNK(t) + vec3(q.x, 0.0, q.z) * tr * mix(1.0, 0.52, t) * (1.0 + 0.3 * (1.0 - t) * (1.0 - t) * (1.0 - t))) * H * s;
              c = bark * (0.75 + 0.5 * h2) * mix(1.0, 0.5, smoothstep(250.0, 700.0, dc0)); ao = 0.5 + 0.35 * t;      // (far off, pale trunks sink into the shade of the forest instead of sparkling) vBark = vec2(mott, burnt * (1.0 - smoothstep(0.15, 0.85, t + (h3 - 0.5) * 0.4)));
            } else {                         // clump of leaves
              float rb = rbK * (0.8 + 0.45 * hk2) * (1.0 - 0.15 * sec) * (1.0 - sec * step(hk3, 0.16)) * (1.0 - deadTree);
              vLs = max(rb * H * s, 0.5);                 // the clump's size in metres, so its leaves can be drawn at their true size
              bc.y += rb * sc.y * hang;
              vec3 ol = bc + q * sc * rb * (1.0 + 0.7 * (texture2D(uNoise, xz * 0.13 + bc.xz * 3.1 + q.xz * 0.33 + q.y * 0.21).g - 0.5));      // each clump billows unevenly: no ball, no facets
              lp = ol * H * s;
              c *= tint; if(sp > 0.5 && sp < 1.5) c = mix(c, vec3(dot(c, vec3(0.33))) * vec3(0.9, 1.0, 0.9), 0.2);
              c = mix(c, vec3(0.078, 0.108, 0.05) * (0.8 + 0.35 * h2), 0.72 * rkR);          // the forest wall of the island's sides is dark, deep green (the owner's photographs from the ferry)
              ao = 0.58 + 0.42 * smoothstep(-0.9, 0.9, nrm.y + (ol.y - 0.75) * 1.6);
            }
            vObj = (aPart > 0.5 ? position : q + (aBlob + 1.0) * vec3(0.9, 0.4, 0.7)) * 2.6 + vec3(h1, h2, h3) * 9.0;
          #else
            float tall = step(0.84, h2);                                   // slender she-oaks and pines among the round crowns
            float r = mix(uRad.x, uRad.y, h4 * h4) * (0.7 + 0.6 * smoothstep(0.12, 0.03, lum)) * (1.0 - 0.3 * tall);
            float sq = uRad.z * (0.8 + 0.5 * h1) * (1.0 + 0.9 * tall);
            float stem = uMode < 0.5 ? r * sq * (0.75 + 0.9 * h3) : 0.0;                  // bare trunk under the crown
            // a bush is no ball: each is stretched its own way and its surface billows unevenly
            vec3 qq = q * vec3(0.8 + 0.5 * h2, sq, 0.8 + 0.5 * h3) * (1.0 + 0.75 * (texture2D(uNoise, xz * 0.21 + q.xz * 0.37 + q.y * 0.19).r - 0.5));
            lp = aPart > 0.5 ? vec3(q.x * r, position.y * (stem + r * sq * 0.45), q.z * r) * s : qq * r * s + vec3(0.0, (stem + r * sq * 0.6) * s, 0.0);
            c = mix(c, c * vec3(0.78, 0.9, 0.85), tall * 0.6);
            if(uMode > 0.5 && uMode < 1.5) c = mix(vec3(0.048, 0.060, 0.029), vec3(lum * 0.38, lum * 0.46, lum * 0.2), 0.25) * (0.8 + 0.45 * h1);          // (from the sea the island's forest is very dark: the owner's photographs)          // distant crowns are forest green, a little lighter than the canopy floor they stand on, never the colour of one dark spot in the photograph
            if(uMode > 1.5) c = mix(alb * 1.1, vec3(lum * 1.2, lum * 1.5, lum * 0.7), 0.3) * (1.25 + 0.6 * h2) * mix(vec3(1.0), vec3(0.62, 0.66, 0.42), sandm);
            if(uMode > 2.5){ float inLeaf = step(0.28, h2 + (lum - 0.1) * 2.0); c = mix(mix(vec3(0.30, 0.25, 0.20), alb * 1.3, 0.55), c * vec3(0.8, 0.95, 0.75), inLeaf) * (0.8 + 0.5 * h3); vPor = mix(0.76, 0.62, inLeaf) + 0.08 * h1; }     // half of it bare brown twigs, half in leaf
            if(aPart > 0.5) c = mix(vec3(0.17, 0.11, 0.065), vec3(0.36, 0.28, 0.19), step(0.55, h3)) * (0.7 + 0.6 * h2);
            ao = aPart > 0.5 ? 0.45 + 0.3 * position.y : mix(0.42, 0.72, step(0.5, uMode) * step(uMode, 1.5)) + 0.58 * smoothstep(-0.9, 0.9, nrm.y + (position.y - 0.2) * 0.5) * mix(1.0, 0.5, step(0.5, uMode) * step(uMode, 1.5));
            vObj = position * 2.6 + vec3(h1, h2, h3) * 9.0;
          #endif
          vec3 wp = base + lp;
          float cs = cloudShadow(wp);
          float wrap = aPart > 0.5 ? 0.12 : uMode > 0.5 && uMode < 1.5 ? 1.0 : 0.5, nl = max((dot(nrm, uLightDir) + wrap) / (1.0 + wrap), 0.0);      // light wraps round a crown of leaves
          // no leaf is greener than nature allows; and the green varies by the patch of bush, not by the single plant
          if(aPart < 0.5){ c.g = min(c.g, 1.4 * c.r + 0.015); c = mix(vec3(dot(c, vec3(0.3, 0.5, 0.2))), c, 0.82) * (0.8 + 0.42 * texture2D(uNoise, base.xz / 130.0).g); }
          if(uMode > 0.5 && uMode < 1.5){ ao = mix(0.62, 1.15, smoothstep(-0.25, 0.85, nrm.y)); lp.y += step(0.8, h3) * (2.5 + 3.5 * h1) * s; }      // sunlit tops over dark skirts; one crown in five stands above its neighbours, so the skyline is ragged        // a distant crown is lit from the top down: bright cap, dim skirt
          vCol = c * (uLightCol * (nl * 0.85 + 0.08) * cs * ao + mix(uAmbGnd, uAmbSky, nrm.y * 0.5 + 0.5) * ao);
          vFog = fogAmount(wp); vDir = normalize(wp - cameraPosition); vN = nrm; vWp = wp; vTrunk = aPart;
          gl_Position = s <= 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
          ${LOGV}
        }`,
      fs: /* glsl */`varying vec3 vCol, vDir, vN, vObj, vWp; varying float vFog, vTrunk, vPor, vSp, vLs; varying vec2 vBark;
        // one layer of leaves: a leaf in each cell of a grid, each hanging at its own angle, slim and a little sickle-curved.
        // returns x: how much of the pixel a leaf covers, y: a number that differs from leaf to leaf, z: where across the leaf (the midrib is at 0)
        // Leaves come in sprays: a dozen or so on one twig end, all hanging much the same way, each spray turned its own way, with thin places between
        // one spray and the next. m and o say how this layer's grid sits on the surface, so that all three layers agree where the sprays are.
        vec3 leafLayer(vec2 p, float seed, vec2 slim, float dens, float turn, float m, float o){
          if(turn < 0.3) p.y += fract(sin(floor(p.x) * 12.9898 + seed) * 43758.5453);         // needles: each column of strands starts at its own height, so no lattice shows
          vec2 id = floor(p), f = fract(p) - 0.5; float h = hash12(id + seed), h2 = fract(h * 13.7);
          float sh = hash12(floor((id + 0.5 - o) / m / vec2(3.4, 3.0)) + 7.7), a = (fract(sh * 7.3) - 0.5) * turn * 0.9 + (h - 0.5) * turn * 0.45;
          dens *= mix(0.14, 1.0, step(0.3, sh));
          f += (vec2(h2, fract(h * 31.1)) - 0.5) * vec2(turn < 0.3 ? 0.6 : 0.34, 0.34);
          vec2 q = vec2(f.x * cos(a) - f.y * sin(a), f.x * sin(a) + f.y * cos(a));
          q.x += q.y * q.y * (h2 - 0.5) * 2.2;
          float d = length(q * slim), w = fwidth(d) * 0.8 + 0.006;      // a hard edge: leaves are crisp, not smudges
          return vec3((1.0 - smoothstep(0.5 - w, 0.5 + w, d)) * step(fract(h * 5.3), dens), h2, q.x * slim.x);
        }
        void main(){
          ${LOGF}
          vec3 col = vCol; float alpha = 1.0;
          #ifdef LEAFY
          if(vTrunk < 0.5){
            #ifdef SPECIES
            // foliage stands in clumps a couple of metres across at the ends of the branches, with sky between them (not in stripes down the crown)
            // (looked up from three sides and blended, so the pattern is the same grain whichever way the surface faces: no stripes down a crown)
            vec3 tw = abs(normalize(vN)); tw *= tw; tw /= tw.x + tw.y + tw.z;
            vec3 vO = vSp > 0.5 && vSp < 1.5 ? vObj * vec3(2.6, 0.45, 2.6) : vObj;            // a she-oak's foliage hangs: its pattern is drawn out downward into streaks
            float n = (texture2D(uNoise, vO.zy * 0.2).g * tw.x + texture2D(uNoise, vO.xz * 0.2).g * tw.y + texture2D(uNoise, vO.xy * 0.2).g * tw.z) * 0.66
                    + (texture2D(uNoise, vO.zy * 0.47 + 0.21).r * tw.x + texture2D(uNoise, vO.xz * 0.47 + 0.21).r * tw.y + texture2D(uNoise, vO.xy * 0.47 + 0.21).r * tw.z) * 0.34, n2 = texture2D(uNoise, vO.xy * 1.3 + 0.3).b;
            #else
            vec3 tw = abs(normalize(vN)); tw *= tw; tw /= tw.x + tw.y + tw.z;        // (three-sided lookup, as for the trees: no stripes round a bush)
            float n = texture2D(uNoise, vObj.zy * 0.3).g * tw.x + texture2D(uNoise, vObj.xz * 0.3).g * tw.y + texture2D(uNoise, vObj.xy * 0.3).g * tw.z, n2 = texture2D(uNoise, vObj.xy * 1.3 + 0.3).b;
            #endif
            float rim = 1.0 - abs(dot(normalize(vN), -vDir));
            float clump = smoothstep(vPor - 0.07, vPor + 0.07, n - rim * 0.55 + (n2 - 0.5) * 0.36);   // clusters of leaves with gaps; the outline is eaten ragged, so no straight facet edge shows
            // near the eye the clusters resolve into single leaves (three layers of them, at different sizes); far away only the clusters are drawn
            vec3 an = abs(normalize(vN)); vec2 lp = an.y > 0.75 ? vObj.xz : an.x > an.z ? vObj.zy : vObj.xy;
            #ifdef SPECIES
            // gum leaves a hand long, hanging; she-oaks carry no leaves but curtains of long thin needles that hang plumb
            bool oak = vSp > 0.5 && vSp < 1.5;
            // (leaves keep their true size whatever the size of the clump; on the top of a clump, seen from above, they lie every way round)
            vec2 slim = oak ? vec2(1.9, 1.0) : vec2(4.7, 1.06), lsc = (oak ? vec2(20.0, 1.45) : vec2(2.96)) * vLs; float turn = an.y > 0.75 ? 6.28 : oak ? 0.16 : 1.25, lw = oak ? fwidth(lp.x * lsc.x * 0.4) + fwidth(lp.y * lsc.y * 3.0) : fwidth(lp.x * lsc.x) + fwidth(lp.y * lsc.y);
            #else
            vec2 slim = vPor > 0.7 ? vec2(8.0, 1.05) : vec2(2.7, 1.5), lsc = vec2(20.0); float turn = 3.6, lw = fwidth(lp.x * 20.0) + fwidth(lp.y * 20.0);        // bare scrub shows thin twigs, not leaves
            #endif
            float nearL = 1.0 - smoothstep(0.18, 0.6, lw), dens = clamp(clump * 1.1, 0.0, 1.0);
            #ifdef SPECIES
            if(oak) dens = clamp(dens * 1.5 + 0.15 * clump, 0.0, 1.0);          // needles hang thick
            #endif
            alpha = clump;
            if(nearL > 0.0){
              vec3 l1 = leafLayer(lp * lsc, 1.0, slim, dens, turn, 1.0, 0.0), l2 = leafLayer(lp * lsc * 1.37 + 3.7, 7.0, slim, dens, turn, 1.37, 3.7), l3 = leafLayer(lp * lsc * 0.83 + 9.2, 13.0, slim, dens * 0.8, turn, 0.83, 9.2);
              vec3 lf = l1.x > 0.5 ? l1 : l2.x > 0.5 ? l2 : l3;
              // leaves grow in sprays on the twigs: none hang loose in the sky outside a clump, and the heart of a clump is full, leaf behind leaf
              float la = max(l1.x, max(l2.x, l3.x)) * smoothstep(0.1, 0.35, clump) * (1.0 - smoothstep(0.66, 0.9, rim)),      // (and none are drawn where the clump's surface is seen edge-on, where they would smear into streaks)
                     core = smoothstep(vPor + 0.05, vPor + 0.2, n - rim * 0.55 + (n2 - 0.5) * 0.36) * 0.94;
              #ifdef SPECIES
              if(oak) core *= 0.45;                    // a curtain of needles lets the light through
              #endif
              alpha = mix(clump, max(la, core), nearL);
              col *= mix(1.0, mix(0.5, (0.78 + 0.6 * lf.y) * (1.0 + 0.18 * smoothstep(0.12, 0.0, abs(lf.z))), la), nearL);
              #ifdef SPECIES
              if(oak) col = mix(col, col * vec3(1.22, 1.14, 0.95), la * nearL * smoothstep(0.45, 0.1, fract(lp.y * lsc.y)));      // the needle tips are paler, yellow-green
              else col = mix(col, vec3(dot(col, vec3(0.3333))) * vec3(1.85, 2.0, 1.65), step(0.9, lf.y) * la * nearL * 0.55);      // one gum leaf in ten turns its glossy face to the light
              #endif        // every leaf its own shade of green, a paler midrib; the leaves behind are in shade
            }
            if(alpha < 0.03 || length(vWp - cameraPosition) < 1.1) discard;       // leaves right in front of the eye are not drawn, rather than fill the view
            col *= mix(0.5 + 1.0 * n * n + 0.4 * (n2 - 0.5), 0.9 + 0.3 * n, nearL);
            col *= (0.7 + 0.45 * smoothstep(-0.3, 0.75, normalize(vN).y)) * (0.78 + 0.34 * smoothstep(vPor, vPor + 0.22, n));      // lit on top, dark underneath; the heart of each clump fuller than its ragged edge
            if(!gl_FrontFacing) col *= 0.72;                                 // the shaded inside of the crown seen through the gaps
            col += vCol * 0.5 * pow(max(dot(vDir, uLightDir), 0.0), 3.0) * rim * (vSp > 0.5 && vSp < 1.5 ? 0.0 : 1.0);
            if(vSp > 0.5 && vSp < 1.5) col *= 1.0 - 0.6 * pow(max(dot(vDir, uLightDir), 0.0), 1.5);          // seen against the sun a she-oak is a dark veil, not a bright one      // (she-oak needles are too fine to glow much)   // leaves glow when the sun is behind them
            col = max(col, vec3(0.035, 0.06, 0.022) * (uLightCol * 0.12 + uAmbSky));        // a leaf in the shade is dark green, never black
          }
          #endif
          #ifdef SPECIES
          if(vTrunk > 0.5){              // bark: blotched and streaked, creamy patches where it has shed, soot where fire has been
            float b1 = texture2D(uNoise, vObj.xy * vec2(0.13, 0.5)).r, b2 = texture2D(uNoise, vObj.zy * vec2(0.3, 0.8) + 0.4).b;
            col *= 0.7 + 0.6 * b1;
            col = mix(col, col * vec3(1.3, 1.16, 0.82), smoothstep(0.5, 0.7, b2) * vBark.x);
            col = mix(col, col * vec3(0.62, 0.64, 0.7), smoothstep(0.62, 0.8, b1) * vBark.x);
            col = mix(col, vCol * 0.07, clamp(vBark.y * (0.75 + 0.5 * b2), 0.0, 1.0));
          }
          #endif
          col += vCol * carLamps(vWp) * 0.9;            // trunks and leaves caught in the headlamps
          gl_FragColor = vec4(mix(col, fogColor(vDir), vFog), alpha);
        }`,
    });
    mat.alphaToCoverage = !!leafy;
    // drawn in blocks, so that those out of view are skipped; and not at all once the eye is further off than the shader draws any of it
    const grid = gridBlocks(scene, geo, mat, n, cs, rmax * 4 + 6), m = grid.m; rings.push({ g: grid, m, uni, cs, mode, far: dmax + 1.42 * (n / 2 + 1) * cs + 600 });
    if (mode === 0 || mode === 3) probe.add(m, { trunkOnly: mode === 0, cs });          // trunks and the big bushes are in the way of cars and walkers (see drive.js)
  };
  const n = +(Q.get('trees') || dq(108, 136, 164));
  ring(n, 11, 2.5, 6.0, 1.0, 5200, 0, speciesTree(dq(5, 8, 11), dq(2, 3, 4)), true);          // single trees close to the view, each its own kind
  ring(n, 30, 6.5, 12, 0.75, 15000, n * 11 * 0.36, crown(0, [[0, 0, 0, 1], [0.7, 0.1, 0.4, 0.75], [-0.5, 0.15, -0.55, 0.7]]), false, 1);   // beyond them the canopy as overlapping clumps
  ring(dq(90, 120, 150), 1.45, 0.18, 0.62, 0.5, 300, 0, crown(LOW ? 0 : 1, [[0, 0, 0, 1], [0.5, 0.25, 0.3, 0.6]]), true, 2);   // shrubs, ferns and tussocks at your feet
  ring(dq(70, 88, 104), 3.1, 0.5, 1.45, 1.0, 700, 0, crown(LOW ? 0 : 1, [[0, 0, 0, 0.8], [0.6, 0.35, 0.3, 0.6], [-0.45, 0.5, -0.45, 0.55]]), true, 3);      // scrub: twiggy bushes head-high and lower
  const grass = buildGrassTrees(scene);
  return (target, camDist) => {
    for (const r of rings) { r.uni.uCentre.value.set(Math.floor(target.x / r.cs), Math.floor(target.z / r.cs)); r.g.on = r.mode === 2 ? camDist < 420 : r.mode === 3 ? camDist < 1400 : camDist < r.far; }
    grass(target, camDist);
  };
}

// ---------------------------------------------------------------- palms and pandanus
// Plants with fronds are few, so each one is placed here: coconut palms around the resort and the
// villages, pandanus (screw pine, on its prop roots) on the dunes just behind the beaches.
function frondPlant(o) {
  const pos = [], nrm = [], uv = [], idx = [], S = 6;           // uv.x: 0..1 along a frond, or -1 on wood; uv.y: across the frond, or height on wood
  const stick = (a, b, r0, r1, rings) => {
    const base = pos.length / 3;
    for (let k = 0; k <= rings; k++) for (let i = 0; i < S; i++) {
      const t = k / rings, an = i / S * Math.PI * 2, r = r0 + (r1 - r0) * t, bend = o.bend * t * t * (b[1] - a[1]) * (rings > 1 ? 1 : 0);
      pos.push(a[0] + (b[0] - a[0]) * t + bend + Math.cos(an) * r, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + Math.sin(an) * r);
      nrm.push(Math.cos(an), 0, Math.sin(an)); uv.push(-1, t);
    }
    for (let k = 0; k < rings; k++) for (let i = 0; i < S; i++) { const j = (i + 1) % S, q = base + k * S; idx.push(q + i, q + S + i, q + j, q + j, q + S + i, q + S + j); }
  };
  stick([0, 0, 0], [0, o.h, 0], o.r * 1.5, o.r * 0.75, o.rings);
  const top = [o.bend * o.h, o.h, 0];
  for (let i = 0; i < (o.roots || 0); i++) { const a = i / o.roots * 6.283 + 0.4; stick([Math.cos(a) * o.h * 0.3, 0, Math.sin(a) * o.h * 0.3], [0, o.h * 0.38, 0], o.r * 0.3, o.r * 0.3, 1); }
  o.heads.forEach((hd, hi) => {
    const c = [top[0] + hd.at[0], top[1] + hd.at[1], hd.at[2]];
    if (hi) stick([o.bend * o.h * 0.5, o.h * 0.7, 0], c, o.r * 0.5, o.r * 0.4, 1);
    for (let f = 0; f < hd.n; f++) {
      const a = f / hd.n * Math.PI * 2 + hi * 1.3, el = hd.up - (f % 4) / 3 * (hd.up - hd.down), ca = Math.cos(a), sa = Math.sin(a), base = pos.length / 3;
      for (let j = 0; j <= hd.seg; j++) {
        const u = j / hd.seg, out = hd.L * u * Math.cos(el) * (1 - 0.12 * u * u), y = hd.L * (Math.sin(el) * u - hd.droop * u * u), w = hd.W * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + u * 0.94)), 0.45);
        for (const sd of [-1, 1]) { pos.push(c[0] + ca * out - sa * w * sd, c[1] + y - Math.abs(sd) * w * hd.vee, c[2] + sa * out + ca * w * sd); nrm.push(ca * 0.3, 0.95, sa * 0.3); uv.push(u, sd); }
        if (j) { const q = base + j * 2; idx.push(q - 2, q - 1, q, q, q - 1, q + 1); }
      }
    }
  });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
function buildPalms(F, scene, occ) {
  const R = rng(4711), taken = new Set();
  const free = (x, z, d) => { const k = cellKey(x, z, d); if (taken.has(k) || occ.has(cellKey(x, z, 6))) return false; taken.add(k); return true; };
  const palms = [], pands = [];
  const find = (re) => F.places.find(o => re.test(o.n || ''))?.p;
  for (const [re, n, rad] of [[/^Tangalooma/, 260, 560], [/Bulwer/, 36, 380], [/Cowan/, 22, 320], [/Kooringal/, 40, 420]]) {
    const c = find(re); if (!c) continue;
    const bigs = /Tangalooma/.test(re.source) ? F.buildings.filter(b => b.k !== 'ship' && b.p.length >= 4 && Math.hypot(b.p[0][0] - c[0], b.p[0][1] - c[1]) < 800 && Math.abs(b.p.reduce((a, q, i) => { const r = b.p[(i + 1) % b.p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2 > 340).map(b => b.p[0]) : null;
    for (let t = 0, k = 0; t < n * 60 && k < n; t++) {
      const a = R() * 6.283, r = Math.sqrt(R()) * rad, x = c[0] + Math.cos(a) * r, z = c[1] + Math.sin(a) * r * 1.6, m = maskAt(x, z), y = meshY(x, z) / VEX;
      if (m.land < 0.9 || y < 1.7 || y > 16 || m.shore < 10 || m.shore > 240) continue;
      if (bigs && !bigs.some(q => Math.hypot(q[0] - x, q[1] - z) < 75) && R() > 0.22) continue;            // at the resort the palms stand in clumps round the main buildings
      if (!free(x, z, bigs ? 5 : 7)) continue;
      palms.push(x, meshY(x, z) - 0.15, z, R() * 6.283, 0.8 + R() * 0.55, R()); k++;
    }
  }
  for (let t = 0; t < 420000 && pands.length < (MOBILE ? 800 : 1500) * 6; t++) {
    const x = (R() - 0.5) * T.sx * 0.96, z = (R() - 0.5) * T.sz * 0.96, m = maskAt(x, z);
    if (m.land < 0.9 || m.shore < 20 || m.shore > 120 || m.sand > 0.8) continue;
    const y = meshY(x, z) / VEX; if (y < 2 || y > 32 || !free(x, z, 7)) continue;
    pands.push(x, meshY(x, z) - 0.1, z, R() * 6.283, 0.7 + R() * 0.7, R());
  }
  const mat = (cut, leaf, wood) => makeMat({
    side: THREE.DoubleSide, uniforms: { uCut: { value: cut }, uLeaf: { value: new THREE.Vector3(...leaf) }, uWood: { value: new THREE.Vector3(...wood) } },
    vs: /* glsl */`
      attribute vec2 aUV; attribute vec4 iPos; attribute vec2 iPar; uniform vec3 uLeaf, uWood; uniform vec2 uWindDir;
      varying vec3 vCol, vDir; varying vec2 vUV; varying float vFog;
      void main(){
        float ca = cos(iPos.w), sa = sin(iPos.w), sc = iPar.x * 1.25, lf = step(0.0, aUV.x);
        vec3 p = position * sc; p.xz = vec2(p.x * ca - p.z * sa, p.x * sa + p.z * ca);
        vec3 n = vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca);
        // fronds stream and flutter in the wind, the trunk leans a little
        float gust = sin(uTime * 1.3 + iPar.y * 40.0 + aUV.x * 2.5) + 0.5 * sin(uTime * 3.1 + iPar.y * 17.0 + aUV.x * 6.0);
        p.xz += uWindDir * (lf * aUV.x * aUV.x * (0.25 + 0.2 * gust) + (1.0 - lf) * aUV.y * aUV.y * 0.05 * gust) * sc;
        vec3 wp = iPos.xyz + p;
        float far = 1.0 - smoothstep(3200.0, 4200.0, length(wp - cameraPosition));
        float nl = mix(dot(n, uLightDir) * 0.4 + 0.55, 0.35 + 0.5 * max(uLightDir.y, 0.0), lf * 0.6);
        vec3 c = mix(uWood * (0.8 + 0.3 * sin(aUV.y * 60.0)), uLeaf * (0.75 + 0.5 * iPar.y) * (0.75 + 0.45 * aUV.x), lf);
        float ao = mix(0.55 + 0.4 * aUV.y, 0.6 + 0.4 * aUV.x, lf);
        vCol = c * (uLightCol * nl * cloudShadow(wp) * ao + mix(uAmbGnd, uAmbSky, n.y * 0.5 + 0.5) * ao);
        vUV = aUV; vFog = fogAmount(wp); vDir = normalize(wp - cameraPosition);
        gl_Position = far <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vDir; varying vec2 vUV; varying float vFog; uniform float uCut;
      void main(){
        ${LOGF}
        if(vUV.x >= 0.0 && uCut > 0.0){                       // cut the blade into leaflets on both sides of the rib
          float v = abs(vUV.y);
          if(v > 0.1 && fract(vUV.x * uCut + v * 0.9) > 0.6) discard;
        }
        gl_FragColor = vec4(mix(vCol, fogColor(vDir), vFog), 1.0);
      }`,
  });
  const add = (g, list, m) => {
    const n = list.length / 6, a = new Float32Array(n * 4), b = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a.set(list.slice(i * 6, i * 6 + 4), i * 4); b[i * 2] = list[i * 6 + 4]; b[i * 2 + 1] = list[i * 6 + 5]; }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iPar', new THREE.InstancedBufferAttribute(b, 2)); g.instanceCount = n;
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh); nearOnly(mesh, list, 6, 4200, 30, 560, 2);          // (palms and pandanus are not drawn from further off than that)
  };
  // coconut palm: a tall, slightly curved ringed trunk and a head of long arching fronds
  add(frondPlant({ h: 9.5, r: 0.17, bend: 0.14, rings: 5, heads: [{ at: [0, 0, 0], n: 12, L: 4.2, W: 0.62, up: 1.05, down: -0.35, droop: 0.75, seg: 5, vee: 0.25 }] }), palms, mat(16, [0.17, 0.27, 0.075], [0.50, 0.45, 0.38]));
  // pandanus: a short trunk standing on prop roots, a few branches, each ending in a tuft of long narrow leaves
  add(frondPlant({ h: 2.8, r: 0.12, bend: 0.1, rings: 2, roots: 5, heads: [{ at: [0, 0.2, 0], n: 10, L: 1.5, W: 0.07, up: 1.2, down: -0.2, droop: 0.95, seg: 3, vee: 0.3 }, { at: [0.9, -0.5, 0.3], n: 9, L: 1.35, W: 0.07, up: 1.1, down: -0.3, droop: 1.0, seg: 3, vee: 0.3 }, { at: [-0.6, -0.7, -0.7], n: 9, L: 1.3, W: 0.07, up: 1.1, down: -0.3, droop: 1.0, seg: 3, vee: 0.3 }] }), pands, mat(0, [0.20, 0.36, 0.15], [0.40, 0.35, 0.27]));
}

// ---------------------------------------------------------------- the Bulwer wrecks
// Three hulks were scuttled off Bulwer in the 1930s to shelter small boats. They have rusted down to open
// shells and ribs, red-brown all over. The map data holds the outline of each hull (traced from aerial
// photographs), so the walls here follow those outlines exactly: two hulls lie across the beach, the
// southern one long, low and broken, and the third lies along the shore, awash, with only its boiler,
// a leaning plate and a few frames standing clear.
const BULWER = [-2450.8, -11947.1];
function buildBulwerWrecks(F, g) {
  const TONES = [[.60, .29, .16], [.47, .21, .11], [.70, .36, .18], [.54, .24, .12]];
  const tone = (R, k = 1) => { const b = TONES[(R() * TONES.length) | 0], f = (0.85 + R() * 0.3) * k; return [b[0] * f, b[1] * f, b[2] * f]; };
  // Stand a rusted hull wall along an outline. top: height of the upper edge above mean sea level (m); show: least height
  // above the sand; gaps: share of plating rusted away; rag: how ragged the upper edge is; ribs: share of frames still standing.
  const shell = (outline, seed, o) => {
    const R = rng(seed), pts = [];
    let cx = 0, cz = 0; for (const p of outline) { cx += p[0]; cz += p[1]; } cx /= outline.length; cz /= outline.length;
    for (let i = 0; i < outline.length; i++) {                 // a point about every 1.6 m round the hull
      const a = outline[i], b = outline[(i + 1) % outline.length], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.6));
      for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    const N = pts.length, far = Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cz)));
    const P = pts.map((p, i) => {
      const q = pts[(i + 1) % N], r = pts[(i + N - 1) % N]; let nx = -(q[1] - r[1]), nz = q[0] - r[0]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      if (nx * (cx - p[0]) + nz * (cz - p[1]) < 0) { nx = -nx; nz = -nz; }                    // nx, nz point into the hull
      const gy = meshY(p[0], p[1]), mid = 1 - Math.hypot(p[0] - cx, p[1] - cz) / far;           // mid: 0 at the ends, towards 1 amidships
      const t = R() < o.gaps ? -99 : Math.max(o.top + (R() - 0.5) * o.rag - (o.sag || 0) * mid, gy / VEX + o.show * (0.6 + 0.8 * R()));
      return { x: p[0], z: p[1], nx, nz, gy, t: t * VEX };
    });
    for (let i = 0; i < N; i++) {
      const a = P[i], b = P[(i + 1) % N], col = tone(R), inner = [col[0] * .6, col[1] * .6, col[2] * .62], TH = 0.16, lo = Math.min(a.gy, b.gy) - 1.6;
      if (a.t > a.gy + 0.25 && b.t > b.gy + 0.25) {             // a panel of plating still standing out of the sand or the water
        const A = [a.x + a.nx * 0.5, lo, a.z + a.nz * 0.5], B = [b.x + b.nx * 0.5, lo, b.z + b.nz * 0.5], C = [b.x, b.t, b.z], D = [a.x, a.t, a.z];
        const Ai = [A[0] + a.nx * TH, lo, A[2] + a.nz * TH], Bi = [B[0] + b.nx * TH, lo, B[2] + b.nz * TH], Ci = [b.x + b.nx * TH, b.t - 0.05, b.z + b.nz * TH], Di = [a.x + a.nx * TH, a.t - 0.05, a.z + a.nz * TH];
        g.quad(A, B, C, D, col); g.quad(Bi, Ai, Di, Ci, inner); g.quad(D, C, Ci, Di, [col[0] * 1.12, col[1] * 1.08, col[2]]);
      }
      // a frame at each station: where the plating has gone, the bare rib is all that stands
      if (R() < o.ribs) { const h = Math.max(a.t, (o.top - 0.7 + R() * 1.0) * VEX); if (h > a.gy + 0.3) g.box(a.x + a.nx * 0.34, a.gy - 0.8, a.z + a.nz * 0.34, 0.24, h - a.gy + 0.8, 0.24, tone(R, 0.8)); }
    }
    // low down, the stumps of floors and bulkheads cross from side to side
    for (let i = 3; i < N / 2 - 2; i += 4) {
      const a = P[i]; let best = null, bd = 1e9;
      for (let j = 0; j < N; j++) { const b = P[j], dx = b.x - a.x, dz = b.z - a.z, along = Math.abs(dx * a.nz - dz * a.nx), across = dx * a.nx + dz * a.nz; if (across > 2 && along < bd) { bd = along; best = b; } }
      if (!best || R() < 0.25) continue;
      const y = Math.max(Math.min(a.gy, best.gy), -1.3 * VEX) - 0.2, h = 0.5 + R() * 0.6, w = 0.12, col = tone(R, 0.75), tx = a.nz * w, tz = -a.nx * w;
      g.quad([a.x - tx, y, a.z - tz], [best.x - tx, y, best.z - tz], [best.x - tx, y + h, best.z - tz], [a.x - tx, y + h, a.z - tz], col);
      g.quad([best.x + tx, y, best.z + tz], [a.x + tx, y, a.z + tz], [a.x + tx, y + h, a.z + tz], [best.x + tx, y + h, best.z + tz], col);
      g.quad([a.x - tx, y + h, a.z - tz], [best.x - tx, y + h, best.z - tz], [best.x + tx, y + h, best.z + tz], [a.x + tx, y + h, a.z + tz], col);
    }
  };
  const hulls = F.buildings.filter(b => b.k === 'ship' && Math.hypot(b.p[0][0] - BULWER[0], b.p[0][1] - BULWER[1]) < 300);
  for (const b of hulls) {
    const xs = b.p.map(p => p[0]), zs = b.p.map(p => p[1]), wide = Math.max(...xs) - Math.min(...xs), tall = Math.max(...zs) - Math.min(...zs), seed = Math.round(xs[0] * 7 + zs[0]);
    if (tall > wide) shell(b.p, seed, { top: 0.15, show: -9, gaps: 0.5, rag: 1.2, ribs: 0.45 });                    // lying along the shore: the third hull, awash
    else if (wide < 40) shell(b.p, seed, { top: 2.3, show: 1.3, gaps: 0.07, rag: 0.7, ribs: 0.9 });                 // the northern hull, the most complete
    else shell(b.p, seed, { top: 1.8, show: 1.0, gaps: 0.26, rag: 1.0, ribs: 0.9, sag: 0.5 });                      // the southern hull: long, low and broken
  }
  if (!hulls.length) return;
  // the pieces of the third hull that still show: its boiler, a leaning plate, a clump of frames
  const R = rng(75), y0 = (x, z) => meshY(x, z);
  g.at(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(-2455.5, y0(-2457.3, -11962.0) + 1.7, -11962.0)); g.cyl(0, 0, 0, 1.7, 1.7, 3.6, 12, tone(R), tone(R, 0.8)); g.at(null);
  g.at(new THREE.Matrix4().makeRotationY(-1.35).multiply(new THREE.Matrix4().makeRotationX(0.5)).setPosition(-2455.5, y0(-2455.5, -11946.1) - 0.3, -11946.1)); g.box(0, 0, 0, 6.2, 2.4 * VEX, 0.14, tone(R)); g.at(null);
  for (let i = 0; i < 5; i++) { const x = -2452.6 + (R() - .5) * 1.2, z = -11936.6 + i * 1.1; g.box(x, y0(x, z) - 0.5, z, 0.2, (1.6 + R() * 1.0) * VEX + 0.5, 0.26, tone(R, 0.85)); }
  g.at(new THREE.Matrix4().makeRotationY(-1.3).multiply(new THREE.Matrix4().makeRotationX(-0.35)).setPosition(-2451.6, y0(-2451.6, -11922.5) - 0.3, -11922.5)); g.box(0, 0, 0, 5.5, 1.9 * VEX, 0.14, tone(R)); g.at(null);
}

// ---------------------------------------------------------------- wrecks
const RUST = [[.42, .24, .14], [.37, .21, .13], [.46, .28, .16], [.33, .20, .14], [.40, .27, .20]];
function buildWrecks(F, g) {
  const R = rng(2024), list = [];
  F.wrecks.forEach((w) => {
    let L, B, th, cx = w.c[0], cz = w.c[1];
    if (Math.hypot(cx - BULWER[0], cz - BULWER[1]) < 200) return;       // the Bulwer wrecks are modelled on their own, below
    if (w.p && w.p.length > 3) {
      // principal axis of the charted outline
      let sxx = 0, szz = 0, sxz = 0; const pts = w.p;
      cx = 0; cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
      for (const p of pts) { const dx = p[0] - cx, dz = p[1] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
      th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
      let l0 = 1e9, l1 = -1e9, b0 = 1e9, b1 = -1e9; const c = Math.cos(th), s = Math.sin(th);
      for (const p of pts) { const dx = p[0] - cx, dz = p[1] - cz, u = dx * c + dz * s, v = -dx * s + dz * c; l0 = Math.min(l0, u); l1 = Math.max(l1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
      L = clamp(l1 - l0, 14, 90); B = clamp(b1 - b0, 5, 16);
    } else { L = 26 + R() * 22; B = 6.5 + R() * 3; th = R() * Math.PI; }
    // The two hulls charted on the bay beach north of the Big Sandhills lie right at the water's edge, along the shore (the owner photographed one from
    // the beach track): a long, low run of rusted side with its frames standing, a tall post left at one end and the bow a little higher at the other.
    const beached = !w.p && cx < 0 && cz > 5000 && cz < 10600;
    if (beached) {
      let found = false;                                    // the nearest spot to the charted position where the sand is just under the water
      for (let r = 0; r <= 1500 && !found; r += 5) for (let k = 0; k < 28 && !found; k++) { const a = k / 28 * 6.2832, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, h = heightAt(x, z); if (h < -0.25 && h > -0.65 && [0, 1, 2, 3, 4, 5, 6, 7].some(q => heightAt(x + Math.cos(q * 0.785) * 32, z + Math.sin(q * 0.785) * 32) > 0.9)) { cx = x; cz = z; found = true; } }      // ...and with dry beach within a few boat-lengths
      const gx = heightAt(cx + 25, cz) - heightAt(cx - 25, cz), gz = heightAt(cx, cz + 25) - heightAt(cx, cz - 25), gl = Math.hypot(gx, gz) || 1, ux = gx / gl, uz = gz / gl;     // uphill, toward the land
      th = Math.atan2(ux, -uz) + (R() - 0.5) * 0.5; L = 44 + R() * 8; B = 7.5;
    }
    const sunk = /dangerous/.test(w.k) && !/non/.test(w.k) ? R() < 0.45 : /non/.test(w.k);
    const bed = Math.min(heightAt(cx, cz), -1.2);
    const H = beached ? 1.5 + R() * 0.5 : sunk ? -(0.5 + R() * 1.2) : 2.0 + R() * 2.6;                 // top above the sea, metres
    const m = new THREE.Matrix4().makeRotationY(-th).setPosition(cx, 0, cz);
    g.at(m);
    const S = 16, rs = rng((cx * 13 + cz * 7) | 0), col = RUST[(rs() * RUST.length) | 0];
    const brk = Array.from({ length: S + 1 }, () => rs()), heel = (rs() - .5) * 0.25;
    const prof = (u) => { const t = Math.abs(2 * u - 1); return B / 2 * Math.pow(1 - Math.pow(t, u > 0.5 ? 2.4 : 4.5), 0.6) + 0.15; };
    const top = (i) => { const u = i / S, sm = (brk[Math.max(0, i - 1)] + brk[i] * 2 + brk[Math.min(S, i + 1)]) / 4; const hh = (H - bed) * (0.55 + 0.45 * sm) * (0.85 + 0.3 * (2 * u - 1) ** 2); return (bed + hh) * VEX; };
    const yb = Math.max(bed, -1.7) * VEX;
    for (let i = 0; i < S; i++) {
      const x0 = (i / S - .5) * L, x1 = ((i + 1) / S - .5) * L, b0 = prof(i / S), b1 = prof((i + 1) / S), t0 = top(i), t1 = top(i + 1);
      const c2 = [col[0] * (0.8 + 0.4 * brk[i]), col[1] * (0.8 + 0.4 * brk[i]), col[2] * (0.8 + 0.4 * brk[i])];
      const cin = [c2[0] * .55, c2[1] * .55, c2[2] * .6], TH = 0.55;
      for (const sd of [-1, 1]) {
        const o0 = b0 * sd * 1.12, o1 = b1 * sd * 1.12, i0 = o0 - TH * sd, i1 = o1 - TH * sd, ty0 = t0 + heel * sd * b0 * VEX, ty1 = t1 + heel * sd * b1 * VEX;
        // the plating is a single skin now, so where it has rusted through you see into the hull; its top edge is eaten ragged by the shader
        // (the last number given to each corner says how far up the plate it is)
        const ym0 = yb + (ty0 - yb) * 0.5, ym1 = yb + (ty1 - yb) * 0.5, m0 = b0 * sd * 1.0, m1 = b1 * sd * 1.0;        // the side bulges at half height: a ship's hull, not a slab
        g.quad([x0, yb, b0 * sd * 0.7], [x1, yb, b1 * sd * 0.7], [x1, ym1, m1], [x0, ym0, m0], c2, [0, x0, 0], [0, x1, 0], [0, x1, 0.5], [0, x0, 0.5]);
        g.quad([x0, ym0, m0], [x1, ym1, m1], [x1, ty1, o1], [x0, ty0, o0], c2, [0, x0, 0.5], [0, x1, 0.5], [0, x1, 1], [0, x0, 1]);
        g.box(x0, -0.3 * VEX, o0 - TH * sd * 1.2, 0.22, Math.max(0.1, ty0 + 0.3 * VEX - 0.4) * (0.75 + 0.3 * brk[i]), 0.42, cin);                          // a rib at every station, standing inside the plating
      }
      if (i % 3 === 1 && i < S - 1) g.quad([x0, yb, -b0], [x0, yb, b0], [x0, t0 * 0.9, b0], [x0, t0 * 0.9, -b0], [col[0] * .7, col[1] * .7, col[2] * .7]);
      if (!sunk && brk[i] > 0.2 && i > 0 && i < S - 1) { const yd = Math.min(t0, t1) - (0.7 + 0.5 * brk[i]) * VEX; g.quad([x0, yd, -b0 * .92], [x1, yd, -b1 * .92], [x1, yd, b1 * .92], [x0, yd, b0 * .92], [col[0] * .85, col[1] * .8, col[2] * .8]); }
    }
    if (beached) {
      g.cyl(-0.485 * L, bed * VEX, 0, 0.34, 0.24, (H - bed + 2.9) * VEX, 7, [col[0] * .7, col[1] * .7, col[2] * .7]);                                      // the stern post
      g.cyl(-0.19 * L, bed * VEX, B * 0.42, 0.22, 0.16, (H - bed + 1.1) * VEX, 6, [col[0] * .7, col[1] * .7, col[2] * .7]);                                // a stub of a frame standing proud amidships
    } else {
    if (!sunk && rs() < 0.5) { const x = (0.3 + rs() * 0.15) * L; g.cyl(x, top(S - 3) - VEX, 0, 0.9, 0.8, (2.5 + rs() * 2) * VEX, 8, [col[0] * .8, col[1] * .8, col[2] * .8]); }
    if (!sunk && rs() < 0.8) { const x = (rs() - .5) * L * 0.5; g.at(m.clone().multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((rs() - .5) * 0.5, 0, (rs() - .5) * 0.4)))); g.cyl(x, bed * VEX, 0, 0.3, 0.14, (H - bed + 3 + rs() * 4) * VEX, 7, [.2, .1, .06]); g.at(m); }      // what is left of a mast, leaning
    }
    g.at(null);
    // hull(u, v, sd): a point on the plating (u along the ship 0..1, v up the side 0..1, sd -1 or 1) and the way the plating faces there: x, y, z, nx, nz
    const hull = (u, v, sd) => { const fi = Math.min(0.999, Math.max(0, u)) * S, i = Math.floor(fi), b = prof(u), t = top(i) + (top(i + 1) - top(i)) * (fi - i) + heel * sd * b * VEX, k = v < 0.5 ? 0.7 + 0.6 * v : 1.0 + 0.24 * (v - 0.5), lx = (u - 0.5) * L, lz = b * sd * k, c = Math.cos(th), s = Math.sin(th); return [cx + lx * c - lz * s, yb + (t - yb) * v, cz + lx * s + lz * c, -sd * s, sd * c]; };
    list.push({ x: cx, z: cz, sunk, hull });
  });
  return list;
}

// ---------------------------------------------------------------- lighthouses, jetty, marks, camps
function buildStructures(F, g, lights, scene, casters) {
  const W = [.93, .92, .88], RED = [.72, .12, .09];
  const beams = [];
  for (const l of F.lights) {
    const x = l.p[0], z = l.p[1], y = meshY(x, z) - 1, big = /Cape/.test(l.n || '');
    const H = (big ? 23 : 9) * HK * 1.1, r0 = big ? 3.6 : 1.8, r1 = big ? 2.5 : 1.3, bands = big ? 5 : 1, STONE = [.93, .92, .88];        // Cape Moreton: a white tower with two broad red bands
    for (let i = 0; i < bands; i++) {
      const a = i / bands, b = (i + 1) / bands;
      g.cyl(x, y + H * a, z, r0 + (r1 - r0) * a, r0 + (r1 - r0) * b, H / bands, 14, big ? (i === 1 || i === 3 ? RED : STONE) : W);
    }
    g.cyl(x, y + H, z, r1 + 1.0, r1 + 1.0, 0.5 * VEX, 14, [.3, .3, .3], [.3, .3, .3]);
    g.cyl(x, y + H + 0.5 * VEX, z, r1 * 0.72, r1 * 0.72, 2.6 * VEX, 10, [.85, .9, .9]);
    g.cyl(x, y + H + 3.1 * VEX, z, r1 * 0.85, 0.15, 1.6 * VEX, 10, RED);
    casters.push({ pts: Array.from({ length: 8 }, (_, i) => [x + Math.cos(-i * 0.785) * r0, z + Math.sin(-i * 0.785) * r0]), y: y + 1, h: H + 3 * VEX });
    const ly = y + H + 1.8 * VEX;
    lights.add([x, ly, z], [1, .95, .75], 0, 1, 0, big ? 5 : 2.2);
    if (big) beams.push({ x, y: ly, z });
    if (big) U.uCape.value.set(x, z, 750, 0);
  }
  // sweeping lighthouse beams
  const cone = new THREE.CylinderGeometry(42, 2.5, 2600, 24, 1, true); cone.rotateZ(-Math.PI / 2); cone.translate(1300, 0, 0);     // narrow at the lamp, widening outward
  const bm = makeMat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vs: /* glsl */`varying float vL; varying vec3 vW, vNb; void main(){ vL = position.x / 2600.0; vNb = normalize(mat3(modelMatrix) * vec3(0.0, position.y, position.z)); vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGV} }`,
    fs: /* glsl */`varying float vL; varying vec3 vW, vNb; void main(){ ${LOGF} float core = pow(abs(dot(normalize(vNb), normalize(cameraPosition - vW))), 2.5); float a = pow(max(1.0 - vL, 0.0), 2.4) * 0.045 * core * uNight; gl_FragColor = vec4(vec3(1.0, 0.92, 0.7) * a, 1.0); }`,
  });
  const beamGroups = beams.map((b) => { const grp = new THREE.Group(); grp.position.set(b.x, b.y, b.z); const a = new THREE.Mesh(cone, bm), c = new THREE.Mesh(cone, bm); c.rotation.y = Math.PI; grp.add(a, c); grp.renderOrder = 45; a.renderOrder = c.renderOrder = 45; a.frustumCulled = c.frustumCulled = false; scene.add(grp); return grp; });

  // jetty
  const TIM = [.50, .40, .30];
  { // The Tangalooma jetty (the owner's aerial photograph): it is not in the map data, but the resort ferry's charted route ends at its head. From there
    // it runs in over the shallows and across the beach to the back of the sand, with a wider head at the seaward end where the ferry lies alongside.
    const fr = (F.ferries || []).find(f => /Tangalooma/.test(f.n || '')), res = F.places.find(o => /^Tangalooma/.test(o.n || ''))?.p;
    if (fr && res) {
      const head = [fr.p[0], fr.p[fr.p.length - 1]].sort((a, b) => Math.hypot(a[0] - res[0], a[1] - res[1]) - Math.hypot(b[0] - res[0], b[1] - res[1]))[0];
      const dx = 0.972, dz = 0.233, o = [head[0] + dx * 6, head[1] + dz * 6 + 12], pts = [o];        // (the bearing of the real jetty, a little north of east)
      for (let d = 22; d <= 400; d += 22) { const q = [o[0] + dx * d, o[1] + dz * d]; pts.push(q); if (groundH(q[0], q[1]) > 1.7) break; }      // it lands at the back of the beach
      F.piers.push({ p: pts, n: 'Tangalooma Jetty' }, { p: [[o[0] + dz * 16, o[1] - dx * 16], [o[0] - dz * 16, o[1] + dx * 16]], n: 'Tangalooma Jetty head', wide: 5.5 });
    }
  }
  for (const p of F.piers) {
    const pts = p.p, yd = 2.7 * VEX;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.5) continue;
      const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len, w = p.wide || (/Tangalooma/.test(p.n || '') ? 3.0 : 2.6), nx = -tz * w, nz = tx * w;
      g.quad([a[0] - nx, yd, a[1] - nz], [a[0] + nx, yd, a[1] + nz], [b[0] + nx, yd, b[1] + nz], [b[0] - nx, yd, b[1] - nz], [.60, .57, .52], [1.35, -w, i * 40], [1.35, w, i * 40], [1.35, w, i * 40 + len], [1.35, -w, i * 40 + len]);      // weathered grey planks laid across the deck
      g.quad([a[0] - nx, yd - 0.9, a[1] - nz], [b[0] - nx, yd - 0.9, b[1] - nz], [b[0] - nx, yd, b[1] - nz], [a[0] - nx, yd, a[1] - nz], TIM);
      g.quad([b[0] + nx, yd - 0.9, b[1] + nz], [a[0] + nx, yd - 0.9, a[1] + nz], [a[0] + nx, yd, a[1] + nz], [b[0] + nx, yd, b[1] + nz], TIM);
      for (let d = 0; d < len; d += 11) for (const s of [-1, 1]) {
        const x = a[0] + tx * d + nx * s * 0.85, z = a[1] + tz * d + nz * s * 0.85, bed = Math.min(meshY(x, z), 0) - 1;
        if (meshY(x, z) < yd - 1) { g.box(x, bed, z, 0.55, yd - bed, 0.55, [.60, .58, .54]); if (bed < -0.5) g.box(x, -1.9, z, 0.6, 3.3, 0.6, [.56, .40, .22]); }      // concrete piles, stained brown-orange through the tide range
      }
      { // a rail down each side, on posts, and a lamp standard now and then
        const RAILC = [.92, .92, .90], hr = 1.1 * VEX * 0.74;
        for (const sd of [-1, 1]) {
          const ex = nx * sd * 0.96, ez = nz * sd * 0.96;
          g.quad([a[0] + ex, yd + hr - 0.09, a[1] + ez], [b[0] + ex, yd + hr - 0.09, b[1] + ez], [b[0] + ex, yd + hr, b[1] + ez], [a[0] + ex, yd + hr, a[1] + ez], RAILC);
          for (const f of [0.66, 0.36, 0.1]) g.quad([a[0] + ex, yd + hr * f - 0.05, a[1] + ez], [b[0] + ex, yd + hr * f - 0.05, b[1] + ez], [b[0] + ex, yd + hr * f, b[1] + ez], [a[0] + ex, yd + hr * f, a[1] + ez], RAILC);
          for (let d = 0; d <= len; d += 2.2) g.box(a[0] + tx * d + ex, yd, a[1] + tz * d + ez, 0.1, hr, 0.1, RAILC);
        }
        if (i % 2 === 0) { g.box(a[0] + nx * 0.9, yd, a[1] + nz * 0.9, 0.14, 4.8 * VEX * 0.74, 0.14, [.3, .3, .32]); g.box(a[0] + nx * 0.9, yd + 4.8 * VEX * 0.74, a[1] + nz * 0.9, 0.5, 0.22, 0.5, [.9, .88, .8]); }
      }
      if (p.wide) for (const sd of [-1, 1]) for (const d of [2, len / 2, len - 2]) {            // fender piles at the head, standing above the deck: black caps, a yellow band
        const x = a[0] + tx * d + nx * sd * 1.08, z = a[1] + tz * d + nz * sd * 1.08, bed = Math.min(meshY(x, z), 0) - 1;
        g.cyl(x, bed, z, 0.34, 0.34, yd + 1.3 - bed, 10, [.42, .34, .26]); g.cyl(x, yd + 0.5, z, 0.36, 0.36, 0.45, 10, [.92, .74, .12]); g.cyl(x, yd + 1.3, z, 0.37, 0.37, 0.22, 10, [.08, .08, .09], [.08, .08, .09]);
      }
      if (i % 3 === 0) lights.add([a[0], yd + 5, a[1]], [1, .8, .5], 0, 1, 0, 1.1);
    }
  }
  // navigation marks
  const floaters = [];
  const colOf = (s) => /red|port/.test(s) ? [.85, .1, .08] : /green|starboard/.test(s) ? [.08, .6, .2] : /yellow|black/.test(s) ? [.95, .8, .1] : [.9, .9, .9];
  F.marks.forEach((mk, i) => {
    const x = mk.p[0], z = mk.p[1], c = colOf(mk.c + ' ' + mk.k), bed = Math.min(meshY(x, z), 0) - 1, S = 1.5;
    if (meshY(x, z) > 0.5) return;
    const lc = /red/.test(mk.l) ? [1, .15, .1] : /green/.test(mk.l) ? [.1, 1, .35] : /yellow/.test(mk.l) ? [1, .8, .15] : /white/.test(mk.l) ? [1, 1, .9] : c.map(v => Math.min(1, v * 1.4));
    if (/buoy/.test(mk.k)) floaters.push({ x, z, c, lc, ph: (i * 0.37) % 1 });
    else {
      g.cyl(x, bed, z, 0.45 * S, 0.4 * S, 5.5 * VEX * S - bed, 6, [.35, .3, .26]);
      g.box(x, 5.5 * VEX * S, z, 1.5 * S, 1.6 * S * VEX, 1.5 * S, c);
      lights.add([x, 7.4 * VEX * S, z], lc, 2.5 + (i % 4), 0.3, (i * 0.37) % 1, 1.2);
    }
  });
  // tents at the camping areas
  const R = rng(5), TENT = [[.85, .35, .15], [.2, .45, .7], [.3, .6, .35], [.9, .75, .2], [.75, .75, .7], [.55, .25, .5]];
  for (const c of F.camps) {
    let fx = 0, fz = 0, k = 0;
    for (let i = 0; i < 9; i++) {
      const x = c.p[0] + (R() - .5) * 90, z = c.p[1] + (R() - .5) * 90, m = maskAt(x, z); if (m.land < 0.95 || m.shore < 8) continue;
      const y = meshY(x, z) + 0.2, a = R() * 3.14, cs = Math.cos(a), sn = Math.sin(a), col = TENT[(R() * TENT.length) | 0], l = 2.2, w = 1.6, h = 2.1 * VEX;
      const P = (u, v, yy) => [x + u * cs - v * sn, y + yy, z + u * sn + v * cs];
      fx += x; fz += z; k++;
    }
    if (k) lights.add([fx / k + 3, meshY(fx / k + 3, fz / k) + 1.5, fz / k], [1, .5, .15], -1, 1, R(), 1.6);
  }
  return { beamGroups, floaters };
}

function buildFloaters(floaters, scene, lights) {
  const g = new GB(), S = 1.5, idx = [];
  for (const f of floaters) {
    g.cyl(f.x, -0.6, f.z, 1.2 * S, 1.0 * S, 1.6 * S, 8, f.c, f.c);
    g.cyl(f.x, 1.0 * S, f.z, 0.5 * S, 0.12 * S, 3.2 * S, 6, f.c);
    idx.push(lights.add([f.x, 4.6 * S, f.z], f.lc, 3 + f.ph * 3, 0.28, f.ph, 1.1));
  }
  const m = new THREE.Mesh(g.build(), objectMat({ side: THREE.DoubleSide })); m.frustumCulled = false; scene.add(m);
  return { mesh: m, idx, floaters, S };
}

// ---------------------------------------------------------------- lakes
function buildLakes(F, scene) {
  const pos = [], idx = [];
  for (const l of F.lakes) {
    let pts = l.p; if (pts.length < 4) continue;
    if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
    let y = 1e9; for (const p of pts) y = Math.min(y, meshY(p[0], p[1]));
    y = Math.max(y, meshY(l.c[0], l.c[1])) + 0.7; l.y = y;
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []), b = pos.length / 3;
    for (const p of pts) pos.push(p[0], y, p[1]);
    for (const t of tri) idx.push(b + t[0], b + t[2], b + t[1]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const mat = makeMat({
    side: THREE.DoubleSide,
    vs: /* glsl */`varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`
      varying vec3 vW; uniform vec2 uWindDir;
      void main(){
        ${LOGF}
        vec3 V = normalize(cameraPosition - vW);
        vec2 n = (texture2D(uWaterTex, vW.xz / 17.0 + uWindDir * uTime * 0.04).rg - 0.5) + (texture2D(uWaterTex, vW.xz / 41.0 - uWindDir * uTime * 0.02).rg - 0.5);
        vec3 N = normalize(vec3(-n.x * 0.25, 1.0, -n.y * 0.25));
        float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        float cs = cloudShadow(vW);
        vec3 body = vec3(0.012, 0.055, 0.07) * (uLightCol * 0.35 * cs + uAmbSky * 1.2);
        vec3 col = mix(body, skyColor(R), F) + uLightCol * pow(max(dot(R, uLightDir), 0.0), 500.0) * 3.0 * cs;
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; scene.add(m);
}

// ---------------------------------------------------------------- labels
function buildLabels(F, flyTo) {
  const host = document.getElementById('labels'), L = [];
  const add = (x, z, n, cls, pri, maxD, sub, yOff = 30, fd = 2200) => {
    if (!n) return;
    const el = document.createElement('div'); el.className = 'lb ' + cls; el.textContent = n;
    if (sub) { const i = document.createElement('i'); i.textContent = sub; el.appendChild(i); }
    el.style.opacity = 0; host.appendChild(el);
    const o = { x, z, y: Math.max(meshY(x, z), 0) + yOff, el, pri, maxD, w: n.length * (cls === 'town' ? 9.5 : 7.4) + 16, h: sub ? 30 : 17, on: false };
    el.addEventListener('click', () => flyTo(x, z, fd, null, 62));
    L.push(o);
  };
  for (const p of F.places) if (p.n !== 'Tallallebela' && p.n !== 'The Nek') add(p.p[0], p.p[1], p.n, 'town', 10, 130000, null, 60, 2400);
  for (const p of F.peaks) add(p.p[0], p.p[1], p.n, 'peak', p.e > 280 ? 9 : 5, p.e > 280 ? 90000 : 22000, `${Math.round(p.e)} m`, 25, 3200);
  for (const p of F.sandnames) add(p.p[0], p.p[1], p.n, 'sand', 7, 60000, null, 30, 3000);
  for (const p of F.seanames) add(p.p[0], p.p[1], p.n, 'sea', 4, 42000, null, 10, 7000);
  const seen = new Set();
  for (const p of F.lakes) if (p.n && !seen.has(p.n)) { seen.add(p.n); add(p.c[0], p.c[1], p.n, 'lake', 5, 26000, null, 20, 1800); }
  for (const p of F.views) add(p.p[0], p.p[1], p.n === 'Ship Wrecks' ? 'Bulwer Wrecks' : p.n, /Wreck/.test(p.n) ? 'wreck' : 'view', /Wreck/.test(p.n) ? 8 : 3, /Wreck/.test(p.n) ? 60000 : 11000, null, 40, 900);
  for (const p of F.camps) if (!/Sunrover|Escapes|WBS/.test(p.n || '')) add(p.p[0], p.p[1], p.n, 'camp', 2, 9000, null, 20, 900);
  for (const p of F.lights) add(p.p[0], p.p[1], p.n, 'view', 8, 50000, null, 90, 1100);
  for (const p of F.misc) add(p.p[0], p.p[1], p.n, 'view', 3, 12000, null, 25, 900);
  L.sort((a, b) => b.pri - a.pri);
  const v = new THREE.Vector3(), placed = [];
  let tick = 0;
  return function update(camera, show) {
    if (tick++ % 2) return;
    const w = window.innerWidth, h = window.innerHeight; placed.length = 0;
    for (const o of L) {
      let on = false, sx = 0, sy = 0;
      if (show) {
        v.set(o.x, o.y, o.z); const d = v.distanceTo(camera.position);
        if (d < o.maxD) {
          v.project(camera);
          if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) {
            sx = (v.x * .5 + .5) * w; sy = (-v.y * .5 + .5) * h; on = true;
            for (const p of placed) if (sx < p.x + p.w && sx + o.w > p.x - 12 && sy < p.y + p.h && sy + o.h > p.y) { on = false; break; }
            if (on) placed.push({ x: sx, y: sy, w: o.w, h: o.h });
          }
        }
      }
      if (on) o.el.style.transform = `translate(${sx.toFixed(1)}px,${(sy - 8).toFixed(1)}px)`;
      if (on !== o.on) { o.on = on; o.el.style.opacity = on ? 1 : 0; o.el.style.pointerEvents = on ? 'auto' : 'none'; }
    }
  };
}

// ---------------------------------------------------------------- assemble
// The beaches are the island's highways. Follow the firm sand just above the tide down each coast
// (side +1: the ocean beach on the east, -1: the bay beach on the west) and return the runs of open sand.
function beachRoutes() {
  const out = [];
  for (const side of [1, -1]) {
    let run = [];
    const close = () => { if (run.length > 30) { for (let k = 0; k < 3; k++) run = run.map((p, i) => i && i < run.length - 1 ? [(run[i - 1][0] + p[0] * 2 + run[i + 1][0]) / 4, p[1]] : p); out.push({ p: run, side }); } run = []; };
    for (let z = -T.sz / 2 + 500; z < T.sz / 2 - 500; z += 45) {
      let x = side * (T.sx / 2 - 150), hit = null;
      for (let i = 0; i < 2400 && Math.abs(x) < T.sx / 2; i++, x -= side * 9) if (groundH(x, z) > 0.9) { hit = x; break; }
      let xd = hit; if (hit !== null) for (let k = 0; k < 30 && groundH(xd, z) < 2.0; k++) xd -= side * 2;          // the foot of the dune behind
      const bx = hit === null ? 0 : hit - side * Math.max(4, Math.abs(xd - hit) * 0.5), m = hit === null ? null : { sand: Math.max(maskAt(hit - side * 12, z).sand, maskAt(hit - side * 24, z).sand, maskAt(hit - side * 36, z).sand) };      // the route runs along the berm, just above the highest tide; the sand is judged across the open beach (the map of it is patchy, so the best of three spots counts)
      // keep only real beach: sand, open ground behind it, and no jump sideways from the last point (headlands, creek mouths, offshore banks)
      if (!m || m.sand < 0.45 || groundH(hit - side * 70, z) < 1.2 || (run.length && Math.abs(bx - run[run.length - 1][0]) > 60)) { close(); continue; }
      run.push([bx, z]);
    }
    close();
  }
  return out;
}

// Beaches closed to vehicles. In front of Tangalooma resort and of Cowan Cowan the beach is shut off by a barrier at each end: 4WDs cannot drive
// through, and take the bypass track that runs inland behind the settlement instead. So the beach route is cut there (no wheel ruts, no cars),
// and the cars' own route leaves the beach by the nearest track before the barrier, follows the mapped tracks round, and rejoins the beach beyond.
function closeBeaches(F) {
  const H = Math.hypot, closed = [];
  for (const [re, rad] of [[/^Tangalooma/, 950], [/Cowan/, 480]]) {
    const c = F.places.find(o => re.test(o.n || ''))?.p; if (!c) continue;
    let z0 = 1e9, z1 = -1e9;
    for (const b of F.buildings) { if (b.k === 'ship') continue; const q = b.p[0]; if (H(q[0] - c[0], q[1] - c[1]) > rad || maskAt(q[0], q[1]).shore > 230) continue; z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    if (z1 > z0) closed.push([z0 - 70, z1 + 70]);
  }
  const inC = (p) => closed.some(([z0, z1]) => p[1] > z0 && p[1] < z1);
  // the tracks as a network (village streets count as slow going, so through traffic keeps to the bypass)
  const nodes = new Map(), node = (p) => { const k = Math.round(p[0] / 5) + ',' + Math.round(p[1] / 5); let n = nodes.get(k); if (!n) nodes.set(k, n = { p, e: [] }); return n; };
  for (const r of F.roads) { if (r.c > 1) continue; for (let i = 1; i < r.p.length; i++) { const a = node(r.p[i - 1]), b = node(r.p[i]), d = H(a.p[0] - b.p[0], a.p[1] - b.p[1]) * (r.c === 0 ? 8 : 1); if (a !== b) { a.e.push([b, d]); b.e.push([a, d]); } } }
  const list = [...nodes.values()];
  const bypass = (pts, i, j) => {            // pts[i .. j-1] are closed: find the way round, from the beach before to the beach after
    const near = (lo, hi, from) => { const m = new Map(); for (const n of list) { let best = null; for (let k = lo; k <= hi; k++) { const d = H(n.p[0] - pts[k][0], n.p[1] - pts[k][1]); if (d < 90 && (!best || d < best[1])) best = [k, d]; } if (best) m.set(n, { k: best[0], cost: best[1] + Math.abs(best[0] - from) * 22 }); } return m; };
    const A = near(Math.max(0, i - 34), i - 1, i - 1), B = near(j, Math.min(pts.length - 1, j + 34), j); if (!A.size || !B.size) return null;
    for (const n of list) { n.d = Infinity; n.prev = null; n.done = false; } const open = []; for (const [n, v] of A) { n.d = v.cost; open.push(n); }
    while (open.length) { let bi = 0; for (let k = 1; k < open.length; k++) if (open[k].d < open[bi].d) bi = k; const n = open.splice(bi, 1)[0]; if (n.done) continue; n.done = true; if (n.d > 30000) break;
      for (const [m, d] of n.e) if (!m.done && n.d + d < m.d) { m.d = n.d + d; m.prev = n; open.push(m); } }
    let end = null, bestD = Infinity; for (const [n, v] of B) if (n.d + v.cost < bestD) { bestD = n.d + v.cost; end = n; } if (!end) return null;
    const path = []; let n = end; while (n) { path.unshift(n.p); if (!n.prev) break; n = n.prev; }
    return { a: A.get(n).k, b: B.get(end).k, path };
  };
  const beach = [], drive = [], gates = [];
  for (const r of F.beach) {
    if (r.side > 0 || !r.p.some(inC)) { beach.push(r); drive.push(r); continue; }
    let run = []; const flush = () => { if (run.length > 6) beach.push({ p: run, side: r.side }); run = []; };
    r.p.forEach((p, i) => { if (inC(p)) { if (run.length) gates.push({ p: run[run.length - 1], side: r.side }); flush(); } else { if (!run.length && i > 0 && inC(r.p[i - 1])) gates.push({ p, side: r.side }); run.push(p); } }); flush();
    let cur = [], i = 0; const done = () => { if (cur.length > 30) drive.push({ p: cur.map(q => [q[0], q[1]]), side: r.side, lim: cur.map(q => q[2] >= 0 ? tideLimit(q[0], q[1]) : null) }); cur = []; };
    while (i < r.p.length) {
      if (!inC(r.p[i])) { cur.push([r.p[i][0], r.p[i][1], i]); i++; continue; }
      let j = i; while (j < r.p.length && inC(r.p[j])) j++;
      const by = i > 0 && j < r.p.length ? bypass(r.p, i, j) : null;
      if (by) { while (cur.length && cur[cur.length - 1][2] > by.a) cur.pop(); for (const q of by.path) cur.push([q[0], q[1], -1]); i = by.b; F.bypassed = (F.bypassed || 0) + 1; }
      else { done(); i = j; }
    }
    done();
  }
  // The tide. Each stretch of narrow beach is shut to 4WDs while the sea stands above its limit; where the mapped tracks give a way round inland
  // (the high tide access tracks), the cars take it, and where they do not, the cars turn back.
  for (const d of drive) {
    if (!d.lim) d.lim = d.p.map(q => tideLimit(q[0], q[1]));
    d.tidal = []; const n = d.p.length;
    for (let i = 0; i < n; i++) { if (d.lim[i] === null) continue; let j = i; while (j < n && d.lim[j] !== null && d.lim[j] === d.lim[i]) j++;
      const by = i > 0 && j < n ? bypass(d.p, i, j) : null;
      d.tidal.push({ a: by ? by.a : Math.max(0, i - 1), b: by ? by.b : Math.min(n - 1, j), thr: d.lim[i], path: by ? [d.p[by.a], ...by.path, d.p[by.b]] : null });
      i = j - 1; }
  }
  for (const r of beach) r.w = r.p.map(q => { let w = 0; while (w < 40 && groundH(q[0] - r.side * w, q[1]) < 2.0) w += 1.5; return w; });          // how far the sand runs back to the dune from each point of the route
  F.beach = beach; F.drive = drive; F.gates = gates;
}
// The barriers themselves: a row of stout timber bollards across the beach from the foot of the dune to the water, and a sign.
function drawGates(F, g) {
  const TIM = [.46, .39, .30], CAP = [.36, .30, .23];
  for (const gt of F.gates || []) {
    const z = gt.p[1], sea = gt.side; let x0 = gt.p[0], x1 = gt.p[0];
    for (let k = 0; k < 80 && groundH(x0, z) > 0.95; k++) x0 += sea * 1.5;                 // down to about the high-water mark
    for (let k = 0; k < 40 && groundH(x1, z) < 2.6; k++) x1 -= sea * 1.5;                  // up to the foot of the dune
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 1.6));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = meshY(x, z); g.cyl(x, y - 0.4, z, 0.14, 0.12, 0.95 * HK + 0.4, 8, TIM, CAP); }
    const sx = x1 + sea * 2.5, sy = meshY(sx, z);                                          // the sign: no vehicles beyond this point
    for (const d of [-0.55, 0.55]) g.box(sx + d, sy - 0.3, z, 0.09, 2.1 * HK + 0.3, 0.09, [.55, .56, .56]);
    g.box(sx, sy + 1.25 * HK, z, 1.3, 0.85 * HK, 0.06, [.95, .95, .93]); g.box(sx, sy + 1.82 * HK, z, 1.3, 0.24 * HK, 0.08, [.75, .12, .1]); g.box(sx, sy + 1.42 * HK, z, 0.5, 0.3 * HK, 0.08, [.12, .12, .13]);
  }
}

export function buildFeatures(scene, F, flyTo) {
  const occ = new Set(), g = new GB(), lights = makeLights(700);
  const casters = [];
  F.beach = beachRoutes(); closeBeaches(F);
  for (const r of F.beach) for (const [off, wig] of [[0, 0], [-6, 1.7], [-11, 2.6], [4, 3.9], [-3, 0.8], [-8.5, 4.4], [1.8, 5.1], [-1.5, 2.2], [-4.4, 3.1], [-7.3, 0.4], [-9.6, 5.7], [2.9, 1.1], [-13, 2.0]]) F.roads.push({ p: r.p.map((p, i) => [p[0] + r.side * Math.min(1, Math.max(0.2, (r.w ? r.w[i] : 20) / 18)) * (off + Math.sin(i * 0.37 + wig) * 1.5 + Math.sin(i * 0.11 + wig * 3) * 1.8 + Math.sin(i * 0.031 + wig * 2) * 2.5), p[1]]), c: 3, n: 'Beach' });      // many sets of wheel ruts wandering along the sand and crossing one another: the beaches are the island's roads (the owner's photo at Tangalooma)
  buildOverlay(F);
  buildBuildings(F, g, occ, casters, lights); drawGates(F, g);
  buildRoads(F, scene, occ);
  if (F.drives.length) buildRoads({ roads: F.drives }, scene, new Set());          // the driveways worn from each street to the cars parked by the houses
  const st = buildStructures(F, g, lights, scene, casters);
  buildShadows(casters, scene);
  const solid = new THREE.Mesh(g.build(), objectMat({ side: THREE.DoubleSide, defines: { WINDOWS: 1 } })); solid.frustumCulled = false; scene.add(solid);
  const gw = new GB(); const wrecks = buildWrecks(F, gw);
  const wm = new THREE.Mesh(gw.build(), objectMat({ side: THREE.DoubleSide, defines: { RUST: 1 } })); wm.frustumCulled = false; scene.add(wm);
  const gbw = new GB(); buildBulwerWrecks(F, gbw);
  const bwm = new THREE.Mesh(gbw.build(), objectMat({ side: THREE.DoubleSide, defines: { RUST: 1, DRYRUST: 1 } })); bwm.name = 'bulwerWrecks'; bwm.frustumCulled = false; scene.add(bwm);
  const fl = buildFloaters(st.floaters, scene, lights);
  buildLakes(F, scene);
  const trees = buildTrees(F, scene);
  buildPalms(F, scene, occ);
  scene.add(lights.pts);
  const labels = buildLabels(F, flyTo);

  const find = (arr, re) => arr.find(o => re.test(o.n || ''));
  const P = (n, o, d, az, pol, dx = 0, dz = 0) => o && { n, x: (o.c || o.p)[0] + dx, z: (o.c || o.p)[1] + dz, d, az, pol };
  const places = [
    { n: 'Whole island', x: 1200, z: 300, d: 44000, az: 40, pol: 52 },
    P('Tangalooma Wrecks', find(F.views, /Tangalooma Wrecks/), 900, 70, 66),
    P('Tangalooma Resort', find(F.places, /^Tangalooma/), 1500, 80, 64),
    P('The Desert', find(F.sandnames, /Desert/), 2400, 110, 62),
    P('Mount Tempest', find(F.peaks, /Tempest/), 5200, 60, 70),
    P('Cape Moreton Lighthouse', find(F.lights, /Cape/), 1300, 200, 72),
    P('Blue Lagoon', find(F.lakes, /Blue Lagoon/), 2600, 300, 62),
    P('Bulwer', find(F.places, /Bulwer/), 1700, 80, 64),
    P('Bulwer Wrecks', find(F.views, /^Ship Wrecks/), 380, 75, 66),
    P('Cowan Cowan', find(F.places, /Cowan/), 1500, 80, 64),
    P('Big Sandhills', find(F.sandnames, /Big Sand/), 4200, 60, 64),
    P('Kooringal', find(F.places, /Kooringal/), 2000, 30, 62),
  ].filter(Boolean);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  lights.pts.material.uniforms.uPx.value = dpr;
  return {
    places, wrecks,
    update(dt, t, camera, showLabels, target) {
      for (const b of st.beamGroups) b.rotation.y = t * 0.55;
      const sy = seaY();
      fl.mesh.position.y = sy;
      fl.floaters.forEach((f, i) => lights.move(fl.idx[i], f.x, sy + 4.6 * fl.S, f.z));
      trees(target, camera.position.distanceTo(target));
      labels(camera, showLabels);
    },
  };
}

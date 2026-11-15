// Boats: yachts and cruisers at anchor (swinging to the real wind), yachts under sail,
// the island ferries on their charted routes, wakes and navigation lights.
import * as THREE from 'three';
import { U, VEX, MOBILE, makeMat, objectMat, LOGV, LOGF, rng, clamp } from './common.js';
import { T, heightAt, maskAt } from './terrain.js';
import { waveAt } from './water.js';
import { GB, makeLights } from './geo.js';
import { wx } from './weather.js';

const WHITE = [.93, .93, .91], NAVY = [.07, .13, .26], ANTI = [.25, .08, .07], DECK = [.80, .76, .66], GLASS = [.06, .09, .13];
const METAL = [.78, .79, .82], TEAK = [.6, .5, .4];
// a thin rod between two points (a stay, a rail, a stanchion): four flat sides are enough at this size
function rod(g, a, b, r, col) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1, ref = Math.abs(d[1]) / l > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let s1 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]; const sl = Math.hypot(...s1) || 1; s1 = s1.map(v => v / sl * r);
  const s2 = [(d[1] * s1[2] - d[2] * s1[1]) / l, (d[2] * s1[0] - d[0] * s1[2]) / l, (d[0] * s1[1] - d[1] * s1[0]) / l], P = (p, i) => { const c = Math.cos(i * Math.PI / 2), s = Math.sin(i * Math.PI / 2); return [p[0] + s1[0] * c + s2[0] * s, p[1] + s1[1] * c + s2[1] * s, p[2] + s1[2] * c + s2[2] * s]; };
  for (let i = 0; i < 4; i++) g.quad(P(a, i), P(a, i + 1), P(b, i + 1), P(b, i), col);
}
// fit: { rub: colour of the rubbing strake along the gunwale, rail: height of the lifelines, from/to: the part of the length they run (0 stern, 1 bow), pulpit: close them across the bow }
function hull(g, L, B, D, free, col, deck, zoff = 0, bot = ANTI, fit = {}) {
  (g.bots ||= []).push(bot); (g.decks ||= []).push(deck);
  const S = 14, st = [], style = fit.style || 7, bowX = L / 2;        // style: 3 yacht, 4 motor cruiser, 5 aluminium dinghy, 6 steel work boat, 7 plain
  for (let i = 0; i <= S; i++) {
    const u = i / S, x = (u - .5) * L;
    const hb = B / 2 * (u < 0.55 ? 0.84 + 0.16 * Math.sin(u / 0.55 * Math.PI / 2) : Math.pow(Math.cos((u - 0.55) / 0.45 * Math.PI / 2), 0.75)) + 0.02;
    st.push({ x, xd: x + (u > 0.55 ? Math.pow((u - 0.55) / 0.45, 2.2) * L * 0.06 : 0) - (u < 0.12 ? (0.12 - u) * L * 0.12 : 0), hb, yd: free * (0.9 + 0.6 * Math.pow(Math.abs(u - 0.36), 1.9)), yk: -D * (1 - 0.7 * u * u * u) });      // the stem rakes forward and the transom leans aft
  }
  for (let i = 0; i < S; i++) {
    const a = st[i], b = st[i + 1];
    for (const s of [-1, 1]) {
      const A = [a.xd, a.yd, zoff + a.hb * s * 1.04], Bq = [b.xd, b.yd, zoff + b.hb * s * 1.04], Aw = [a.x, 0.05, zoff + a.hb * s * 0.96], Bw = [b.x, 0.05, zoff + b.hb * s * 0.96];
      const Ak = [a.x, a.yk, zoff + a.hb * s * 0.45], Bk = [b.x, b.yk, zoff + b.hb * s * 0.45];
      const fl = (o) => 1.0 + 0.1 * Math.sin(Math.PI * Math.min(1, o.x / L + 0.5)), Am = [(a.x + a.xd) / 2, (a.yd + 0.05) * 0.5, zoff + a.hb * s * fl(a)], Bm = [(b.x + b.xd) / 2, (b.yd + 0.05) * 0.5, zoff + b.hb * s * fl(b)];      // the side swells out between the waterline and the deck
      // the topsides carry their own map for the paintwork: how far aft of the bow, and how far up from the waterline (0) to the gunwale (1)
      const T = (q, v) => [-style, bowX - q.x, v], a0 = T(a, 0), b0 = T(b, 0), a5 = T(a, 0.5), b5 = T(b, 0.5), a1 = T(a, 1), b1 = T(b, 1);
      if (s > 0) { g.quad(Aw, Bw, Bm, Am, col, a0, b0, b5, a5); g.quad(Am, Bm, Bq, A, col, a5, b5, b1, a1); g.quad(Ak, Bk, Bw, Aw, bot); } else { g.quad(Bw, Aw, Am, Bm, col, b0, a0, a5, b5); g.quad(Bm, Am, A, Bq, col, b5, a5, a1, b1); g.quad(Bk, Ak, Aw, Bw, bot); }
      if (fit.rub) {            // a rubbing strake standing a little proud along the gunwale, and a low toe rail on the deck edge above it
        const o = 0.045 * s, lo = 0.1, P = (q, y, k) => [q[0], q[1] + y, q[2] + o * k];
        if (s > 0) { g.quad(P(A, -lo, 1), P(Bq, -lo, 1), P(Bq, 0.01, 1), P(A, 0.01, 1), fit.rub); g.quad(P(A, 0.01, 1), P(Bq, 0.01, 1), P(Bq, 0.06, -0.6), P(A, 0.06, -0.6), fit.rub); }
        else { g.quad(P(Bq, -lo, 1), P(A, -lo, 1), P(A, 0.01, 1), P(Bq, 0.01, 1), fit.rub); g.quad(P(Bq, 0.01, 1), P(A, 0.01, 1), P(A, 0.06, -0.6), P(Bq, 0.06, -0.6), fit.rub); }
      }
    }
    g.quad([a.xd, a.yd, zoff - a.hb * 1.04], [a.xd, a.yd, zoff + a.hb * 1.04], [b.xd, b.yd, zoff + b.hb * 1.04], [b.xd, b.yd, zoff - b.hb * 1.04], deck);
    g.quad([a.x, a.yk, zoff + a.hb * .45], [a.x, a.yk, zoff - a.hb * .45], [b.x, b.yk, zoff - b.hb * .45], [b.x, b.yk, zoff + b.hb * .45], bot);
  }
  const a = st[0];
  g.quad([a.x, a.yk, zoff + a.hb * .45], [a.x, a.yk, zoff - a.hb * .45], [a.xd, a.yd, zoff - a.hb * 1.04], [a.xd, a.yd, zoff + a.hb * 1.04], col);
  if (fit.rail) {               // stanchions round the deck edge with two wires through them; closed across the stern, and across the bow as a pulpit
    const i0 = Math.round((fit.from ?? 0) * S), i1 = Math.round((fit.to ?? 1) * S), top = (q, s, f) => [q.xd, q.yd + fit.rail * f, zoff + (q.hb * 1.04 - 0.07) * s];
    for (const s of [-1, 1]) for (let i = i0; i <= i1; i++) {
      rod(g, top(st[i], s, 0), top(st[i], s, 1), 0.022, METAL);
      if (i < i1) for (const f of [1, 0.55]) rod(g, top(st[i], s, f), top(st[i + 1], s, f), 0.012, METAL);
    }
    if (i0 === 0) for (const f of [1, 0.55]) rod(g, top(st[0], -1, f), top(st[0], 1, f), 0.012, METAL);
    if (fit.pulpit && i1 === S) rod(g, top(st[S], -1, 1), top(st[S], 1, 1), 0.02, METAL);
  }
  return st;
}
// A deckhouse: its front rakes back, its rear a little forward, its sides lean in; with a band of glass let in between heights g0 and g1 (as fractions).
function house(g, cx, y0, cz, sx, sy, sz, col, rake = 0.45, g0 = 0, g1 = 0) {
  const sec = (f, grow) => { const xf = cx + sx / 2 - rake * sy * f + grow, xb = cx - sx / 2 + rake * 0.35 * sy * f - grow, hz = sz / 2 * (1 - 0.1 * f) + grow, y = y0 + sy * f; return [[xb, y, cz - hz], [xf, y, cz - hz], [xf, y, cz + hz], [xb, y, cz + hz]]; };
  const band = (f0, f1, c, grow) => { const a = sec(f0, grow), b = sec(f1, grow); for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; g.quad(a[j], a[i], b[i], b[j], c); } return b; };
  const t = band(0, 1, col, 0); g.quad(t[0], t[1], t[2], t[3], col);
  if (g1 > g0) band(g0, g1, GLASS, 0.025);
}
// A sail between its three corners, bellied out by the wind: cut into a fine grid so the cloth curves (roach: how far the leech bows out).
function sail(g, tack, head, clew, belly, col, roach) {
  (g.sails ||= []).push(col);
  const N = 8, mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const P = (a, b) => { const lu = mix(tack, head, a), le = mix(clew, head, a), p = mix(lu, le, b * (1 + roach * Math.sin(Math.PI * a))); p[2] += belly * Math.sin(Math.PI * Math.pow(b, 0.75)) * Math.pow(1 - a, 0.55) * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, a + 0.25))); return p; };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) g.quad(P(i / N, j / N), P(i / N, (j + 1) / N), P((i + 1) / N, (j + 1) / N), P((i + 1) / N, j / N), col);
}
// Finish a boat: every vertex is told what it is part of (0 paint, 1 bottom paint, 2 glass, 3 deck, 4 sail), which way its face
// looks, and where on the boat it sits, so the material can paint boot stripes, window frames, deck planks, sail seams and weed.
function finish(g) {
  const same = (i, c) => Math.abs(g.c[i * 3] - c[0]) + Math.abs(g.c[i * 3 + 1] - c[1]) + Math.abs(g.c[i * 3 + 2] - c[2]) < 0.015, any = (i, l) => (l || []).some(c => same(i, c)), n = g.p.length / 3, key = new Map();
  for (let i = 0; i < n; i++) {
    const nx = g.n[i * 3], ny = g.n[i * 3 + 1], y = g.p[i * 3 + 1];
    if (g.f[i * 3] < 0) { g.f[i * 3] = -g.f[i * 3] + 1; continue; }             // topsides, already mapped by hull()
    const zone = any(i, g.sails) ? 4 : same(i, GLASS) ? 2 : any(i, g.bots) && y < 0.12 ? 1 : any(i, g.decks) && Math.abs(ny) > 0.75 ? 3 : 0, face = zone === 4 ? 0 : Math.abs(ny) > 0.75 ? 2 : Math.abs(nx) > 0.75 ? 1 : 0;
    g.f[i * 3] = zone * 8 + face + 1; g.f[i * 3 + 1] = face === 1 ? g.p[i * 3 + 2] : g.p[i * 3]; g.f[i * 3 + 2] = face === 2 ? g.p[i * 3 + 2] : y;
    if (zone === 4) { const k = Math.round(g.p[i * 3] * 500) + ',' + Math.round(y * 500) + ',' + Math.round(g.p[i * 3 + 2] * 500), o = key.get(k) || [0, 0, 0, []]; o[0] += nx; o[1] += ny; o[2] += g.n[i * 3 + 2]; o[3].push(i); key.set(k, o); }
  }
  for (const o of key.values()) { const l = Math.hypot(o[0], o[1], o[2]) || 1; for (const i of o[3]) { g.n[i * 3] = o[0] / l; g.n[i * 3 + 1] = o[1] / l; g.n[i * 3 + 2] = o[2] / l; } }      // cloth is smooth: the facets of a sail share their normals
  // the rest: where facets meet at a gentle angle (the run of a hull, the round of a cylinder) they share their normals and the surface reads as curved;
  // where they meet sharply (deck edge, cabin corner) the edge stays crisp
  const at = new Map(), n0 = g.n.slice();
  for (let i = 0; i < n; i++) { if (Math.floor((g.f[i * 3] - 1) / 8) === 4) continue; const k = Math.round(g.p[i * 3] * 400) + ',' + Math.round(g.p[i * 3 + 1] * 400) + ',' + Math.round(g.p[i * 3 + 2] * 400); (at.get(k) || at.set(k, []).get(k)).push(i); }
  for (const list of at.values()) if (list.length > 1) for (const i of list) {
    let x = 0, y = 0, z = 0; for (const j of list) if (n0[i * 3] * n0[j * 3] + n0[i * 3 + 1] * n0[j * 3 + 1] + n0[i * 3 + 2] * n0[j * 3 + 2] > 0.72) { x += n0[j * 3]; y += n0[j * 3 + 1]; z += n0[j * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1; g.n[i * 3] = x / l; g.n[i * 3 + 1] = y / l; g.n[i * 3 + 2] = z / l;
  }
  return g.build();
}
function yacht(sails, hc) {
  const g = new GB();
  const st = hull(g, 11.5, 3.5, 0.8, 1.0, hc, DECK, 0, ANTI, { rub: TEAK, rail: 0.62, pulpit: 1, style: 3 }), bow = st[st.length - 1], stern = st[0], NAVYC = [.1, .17, .32];
  house(g, 0.4, 1.0, 0, 4.4, 0.62, 2.1, WHITE, 0.9, 0.35, 0.72);
  g.box(1.3, 1.62, 0.45, 0.55, 0.05, 0.55, [.16, .19, .22]); g.box(0.2, 1.62, -0.4, 0.5, 0.05, 0.5, [.16, .19, .22]);          // hatches in the coachroof
  house(g, -1.75, 1.62, 0, 0.9, 0.5, 1.85, NAVYC, 0.7);                                                                    // spray hood over the companionway
  g.box(-3.6, 1.0, 0, 2.2, 0.3, 2.3, [.7, .66, .58]);                                                                      // cockpit, its coamings, winches, the wheel on its pedestal
  for (const z of [-1.2, 1.2]) { g.box(-3.6, 1.3, z, 2.3, 0.14, 0.12, WHITE); g.cyl(-2.8, 1.44, z, 0.1, 0.075, 0.17, 8, METAL, METAL); }
  g.box(-4.1, 1.3, 0, 0.14, 0.62, 0.14, WHITE);
  for (let i = 0; i < 12; i++) { const a0 = i / 12 * 6.2832, a1 = (i + 1) / 12 * 6.2832, P = (a) => [-4.02, 1.98 + Math.sin(a) * 0.42, Math.cos(a) * 0.42]; rod(g, P(a0), P(a1), 0.018, METAL); if (i % 2 === 0) rod(g, [-4.02, 1.98, 0], P(a0), 0.01, METAL); }
  g.cyl(1.4, 1.0, 0, 0.1, 0.07, 14.5, 8, [.82, .82, .84]);                                                                 // mast, boom, spreaders and the standing rigging
  g.box(-1.3, 2.25, 0, 5.2, 0.16, 0.16, [.82, .82, .84]);
  const head = [1.4, 15.4, 0];
  rod(g, [bow.xd - 0.1, bow.yd + 0.05, 0], head, 0.014, METAL); rod(g, [stern.xd + 0.1, stern.yd + 0.05, 0], head, 0.014, METAL);
  for (const s of [-1, 1]) { const tip = [1.4, 9.6, 0.95 * s], plate = [1.25, 1.02, 1.7 * s]; rod(g, [1.4, 9.6, 0], tip, 0.03, METAL); rod(g, head, tip, 0.012, METAL); rod(g, tip, plate, 0.012, METAL); rod(g, [1.4, 9.3, 0], [0.9, 1.02, 1.68 * s], 0.012, METAL); }
  g.box(bow.xd - 0.35, bow.yd + 0.02, 0, 0.55, 0.1, 0.22, [.2, .2, .22]);                                                  // anchor on the bow roller
  rod(g, [stern.xd + 0.05, stern.yd, 0.9], [stern.xd - 0.25, stern.yd + 1.3, 0.9], 0.015, METAL);                          // ensign staff and flag
  g.quad([stern.xd - 0.14, stern.yd + 0.8, 0.9], [stern.xd - 0.72, stern.yd + 0.72, 0.98], [stern.xd - 0.8, stern.yd + 1.12, 0.95], [stern.xd - 0.24, stern.yd + 1.22, 0.9], [.7, .08, .08]);
  if (sails) {
    const S1 = [.97, .96, .92], S2 = [.92, .91, .86];
    sail(g, [1.3, 2.45, 0], [1.35, 15.2, 0], [-3.8, 2.45, 0.9], 0.75, S1, 0.07);        // mainsail, full of wind
    sail(g, [5.6, 1.35, 0], [1.45, 13.4, 0], [0.9, 1.8, 1.25], 0.9, S2, 0.0);            // jib
  } else g.box(-1.3, 2.33, 0, 4.9, 0.34, 0.36, [.12, .22, .42]);
  return finish(g);
}
function cruiser(hc) {
  const g = new GB();
  const st = hull(g, 10.5, 3.6, 0.6, 1.25, hc, DECK, 0, ANTI, { rub: [.2, .2, .22], rail: 0.7, from: 0.55, pulpit: 1, style: 4 }), bow = st[st.length - 1], stern = st[0];
  g.box(stern.x - 0.45, 0.12, 0, 0.9, 0.07, 2.6, TEAK);                                                                    // swim platform, anchor, fenders hung along one side, a dome on the roof
  g.box(bow.xd - 0.35, bow.yd + 0.02, 0, 0.55, 0.1, 0.22, [.2, .2, .22]);
  for (const x of [-1.5, 1.2]) g.cyl(x, 0.45, 1.98, 0.13, 0.13, 0.6, 8, WHITE, WHITE);
  g.cyl(0.4, 3.53, 0, 0.32, 0.22, 0.2, 10, WHITE, WHITE);
  house(g, 0.3, 1.3, 0, 5.4, 1.25, 2.9, WHITE, 0.55, 0.36, 0.78);
  house(g, -0.6, 2.55, 0, 3.0, 0.9, 2.3, WHITE, 0.5, 0.3, 0.8); g.box(-0.2, 3.45, 0, 2.6, 0.08, 2.6, [.85, .85, .85]);
  g.box(-4.0, 1.3, 0, 1.6, 0.25, 2.8, [.6, .5, .4]);
  g.cyl(-0.6, 3.5, 0, 0.04, 0.03, 1.8, 4, [.8, .8, .8]);
  return finish(g);
}
function tinny() {
  const g = new GB(), AL = [.66, .69, .70];
  hull(g, 4.8, 1.9, 0.22, 0.55, AL, [.5, .53, .54], 0, [.45, .47, .48], { style: 5 });
  g.box(-2.5, 0.25, 0, 0.45, 0.9, 0.4, [.12, .12, .13]);
  g.box(-0.9, 0.5, 0, 0.35, 0.12, 1.6, AL); g.box(0.7, 0.5, 0, 0.35, 0.12, 1.5, AL);
  { const SH = [.72, .2, .15], SK = [.82, .64, .52], HAT = [.78, .72, .5];            // whoever is at the tiller: a rounded body, a head and a wide straw hat, one arm back to the outboard
    g.cyl(-1.4, 0.62, 0.2, 0.25, 0.2, 0.72, 10, SH, SH); g.cyl(-1.4, 1.34, 0.2, 0.08, 0.08, 0.08, 8, SK); g.cyl(-1.4, 1.41, 0.2, 0.14, 0.125, 0.25, 10, SK, SK);
    g.cyl(-1.4, 1.62, 0.2, 0.3, 0.29, 0.025, 12, HAT, HAT); g.cyl(-1.4, 1.645, 0.2, 0.15, 0.13, 0.1, 10, HAT, HAT);
    rod(g, [-1.42, 1.22, 0.42], [-2.25, 0.95, 0.1], 0.055, SK); rod(g, [-1.4, 1.22, -0.02], [-1.15, 0.8, -0.1], 0.055, SK); }
  return finish(g);
}
function flybridge(hc) {     // a flybridge cruiser: saloon below, a second helm up top under a hardtop
  const g = new GB();
  const st = hull(g, 14, 4.4, 0.9, 1.5, hc, DECK, 0, ANTI, { rub: [.2, .2, .22], rail: 0.75, from: 0.5, pulpit: 1, style: 4 }), bow = st[st.length - 1], stern = st[0];
  g.box(stern.x - 0.55, 0.12, 0, 1.1, 0.08, 3.4, TEAK); g.box(bow.xd - 0.4, bow.yd + 0.02, 0, 0.6, 0.11, 0.25, [.2, .2, .22]);       // swim platform, anchor
  for (const x of [-2.5, 0.5, 3.0]) g.cyl(x, 0.5, 2.42, 0.15, 0.15, 0.7, 8, WHITE, WHITE);                                             // fenders
  for (const z of [-1.7, 1.7]) for (const f of [1, 0.55]) rod(g, [-2.8, 3.25 + 0.8 * f, z], [1.4, 3.25 + 0.8 * f, z], 0.014, METAL);   // rails round the flybridge
  g.cyl(-1.6, 5.6, 0, 0.36, 0.26, 0.22, 10, WHITE, WHITE);                                                                            // radar dome on the hardtop
  house(g, 0.2, 1.5, 0, 7.6, 1.5, 3.7, WHITE, 0.6, 0.34, 0.78);                                            // saloon and its windows
  house(g, 4.0, 1.5, 0, 3.0, 0.8, 3.0, WHITE, 1.3);                                                                // foredeck cabin
  g.box(-0.6, 3.0, 0, 4.6, 0.25, 3.5, WHITE); g.box(0.9, 3.25, 0, 1.2, 0.75, 2.6, WHITE); g.box(1.5, 3.5, 0, 0.1, 0.6, 2.4, GLASS);       // flybridge deck, helm, screen
  for (const [x, z] of [[1.2, 1.5], [1.2, -1.5], [-2.4, 1.5], [-2.4, -1.5]]) g.box(x, 3.25, z, 0.07, 2.25, 0.07, [.82, .82, .84]);
  g.box(-0.6, 5.5, 0, 4.2, 0.1, 3.4, WHITE);                                                               // hardtop, high enough to stand under and see out all round
  g.box(-5.2, 1.5, 0, 3.2, 0.12, 3.9, [.6, .5, .4]); g.cyl(-0.6, 5.6, 0, 0.05, 0.03, 1.7, 4, [.8, .8, .8]);  // cockpit sole, aerial
  return finish(g);
}
function jetski(col) {       // a jet ski and its rider
  const g = new GB(), SKIN = [.82, .64, .52];
  hull(g, 3.2, 1.15, 0.18, 0.42, col, col, 0, [.15, .15, .16]);
  g.box(0.5, 0.42, 0, 1.3, 0.3, 0.8, WHITE); g.box(-0.5, 0.42, 0, 1.3, 0.34, 0.5, [.1, .1, .11]);          // cowl and seat
  g.box(0.55, 0.72, 0, 0.12, 0.35, 0.7, [.1, .1, .11]);                                                     // handlebar
  g.cyl(-0.35, 0.76, 0, 0.23, 0.2, 0.6, 10, [.95, .5, .1], [.95, .5, .1]); g.cyl(-0.3, 1.36, 0, 0.075, 0.075, 0.07, 8, SKIN); g.cyl(-0.28, 1.42, 0, 0.13, 0.12, 0.24, 10, SKIN, [.16, .12, .1]);     // rider in a life jacket: rounded body, neck, head
  for (const z of [-1, 1]) rod(g, [-0.3, 1.26, 0.22 * z], [0.52, 1.02, 0.3 * z], 0.05, SKIN);                                                                                          // arms out to the handlebar
  if (0) g.box(0, 0, 0, 0, 0, 0, SKIN); g.box(-0.3, 0.42, 0.3, 0.6, 0.36, 0.16, [.1, .2, .5]); g.box(-0.3, 0.42, -0.3, 0.6, 0.36, 0.16, [.1, .2, .5]);
  return finish(g);
}
function flyer() {            // fast passenger catamaran
  const g = new GB();
  for (const z of [-3.6, 3.6]) hull(g, 35, 2.8, 1.1, 1.7, WHITE, WHITE, z, NAVY, { style: 6 });
  g.box(-0.5, 1.7, 0, 31, 0.9, 10.2, WHITE);
  g.box(-1.5, 2.6, 0, 25, 2.6, 9.6, WHITE); g.box(-1.3, 3.4, 0, 24.6, 0.9, 9.66, GLASS);
  g.box(-1.5, 2.62, 0, 25.1, 0.35, 9.7, [.05, .35, .6]);
  g.box(2.5, 5.2, 0, 13, 2.2, 7.4, WHITE); g.box(3.0, 5.9, 0, 12.6, 0.8, 7.46, GLASS);
  g.box(6.8, 7.4, 0, 3.4, 0.25, 5.5, WHITE); g.cyl(4, 7.4, 0, 0.08, 0.05, 3.2, 5, [.8, .8, .8]);
  return finish(g);
}
function barge() {            // vehicle ferry
  const g = new GB(), HB = [.10, .28, .50];
  for (const z of [-5.5, 5.5]) hull(g, 58, 5, 1.6, 2.2, HB, [.3, .3, .32], z, [.2, .08, .07], { style: 6 });
  g.box(0, 2.2, 0, 56, 0.6, 16.5, [.36, .37, .38]);
  for (const z of [-8, 8]) g.box(0, 2.8, z, 54, 1.5, 0.4, WHITE);
  g.box(19, 2.8, 0, 9, 3.2, 16, WHITE); g.box(19.3, 6.0, 0, 8, 2.8, 14, WHITE); g.box(19.6, 6.9, 0, 7.9, 1.0, 14.06, GLASS);
  g.box(19, 8.8, 0, 5, 0.3, 10, HB); g.cyl(18, 8.8, 0, 0.5, 0.4, 3.5, 6, HB);
  g.box(-28.5, 2.6, 0, 3.5, 0.3, 11, [.5, .5, .5]);
  const R = rng(8), CARS = [[.85, .85, .85], [.15, .15, .17], [.6, .1, .08], [.12, .25, .5], [.75, .7, .55], [.3, .35, .3]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) if (R() < 0.8) { const x = -22 + c * 5.6, z = (r - 1) * 4.6; g.box(x, 2.8, z, 4.4, 1.3, 2.0, CARS[(R() * CARS.length) | 0]); g.box(x - 0.3, 4.1, z, 2.4, 0.7, 1.8, GLASS); }
  return finish(g);
}

export function buildBoats(scene, F) {
  const R = rng(31337), S = 1.55;
  const mat = objectMat({ side: THREE.DoubleSide, defines: { BOAT: 1 } });
  const HC = [WHITE, WHITE, [.12, .18, .32], [.9, .88, .8], [.55, .1, .1], [.1, .3, .28]];
  const geo = {
    sail: [yacht(true, WHITE), yacht(true, HC[2])], moor: HC.map(c => yacht(false, c)),
    cru: [cruiser(WHITE), cruiser(HC[3])], tin: [tinny()], flyer: flyer(), barge: barge(),
    fly: [flybridge(WHITE), flybridge(HC[2])], jet: [[.9, .15, .1], [.1, .45, .8], [.95, .8, .1], [.1, .1, .1]].map(jetski),
  };
  const pick = (a) => a[(R() * a.length) | 0];
  // where you stand when you go aboard each kind of boat (metres forward of midships, and above the keel line)
  const EYES = new Map(); const eyes = (list, e) => [].concat(list).forEach(g => EYES.set(g, e));
  // where you stand aboard each kind. Yacht: at the rail, clear of the sail. Cruiser: on the coachroof ahead of the wheelhouse. Flybridge: at the upper helm.
  // Small craft: just behind and above whoever is driving, so you can see the boat you are on. Ferries: on the bridge.
  eyes(geo.sail, [-4.6, 3.6, -1.6]); eyes(geo.moor, [-4.6, 3.6, -1.6]); eyes(geo.cru, [1.5, 3.85]); eyes(geo.fly, [0.2, 4.55]);
  eyes(geo.tin, [-2.5, 2.1]); eyes(geo.jet, [-2.4, 2.45]); eyes(geo.flyer, [7.4, 8.7]); eyes(geo.barge, [19.5, 9.9]);
  const boats = [], lights = makeLights(260);
  const mk = (g, x, z, o = {}) => {
    const m = new THREE.Mesh(g, mat); m.rotation.order = 'YZX'; m.scale.setScalar(S * (o.scale || 1)); m.frustumCulled = false; scene.add(m);
    const b = { m, x, z, ax: x, az: z, hd: R() * 6.28, sp: 0, ph: R() * 10, mast: o.mast || 3, ...o };
    b.li = lights.add([x, 0, z], [1, 1, .92], 0, 1, 0, o.big ? 1.6 : 0.9);
    if (o.move) { b.lr = lights.add([x, 0, z], [1, .1, .08], 0, 1, 0, 0.8); b.lg = lights.add([x, 0, z], [.1, 1, .3], 0, 1, 0, 0.8); }
    b.eye = EYES.get(g) || [-3, 3]; if (!g.boundingBox) g.computeBoundingBox(); b.len = (g.boundingBox.max.x - g.boundingBox.min.x) * S * (o.scale || 1);
    boats.push(b); return b;
  };
  const depth = (x, z) => U.uSeaM.value - heightAt(x, z);
  const inRect = (x, z, pad = 300) => Math.abs(x) < T.sx / 2 - pad && Math.abs(z) < T.sz / 2 - pad;

  // ---- at anchor ----
  const wrecks = F.wrecks.map(w => w.c);
  const clearOf = (x, z, d) => boats.every(b => Math.hypot(b.x - x, b.z - z) > d) && wrecks.every(w => Math.hypot(w[0] - x, w[1] - z) > 42);
  const moor = (cx, cz, n, rad, types, dmin = 1.8, dmax = 11) => {
    let k = 0;
    for (let t = 0; t < n * 40 && k < n; t++) {
      const a = R() * 6.283, r = Math.sqrt(R()) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, d = depth(x, z);
      if (d < dmin || d > dmax || !clearOf(x, z, 46) || !inRect(x, z)) continue;
      const ty = pick(types);
      if (ty === 'moor') mk(pick(geo.moor), x, z, { anchor: 1, mast: 15.5, scope: 16 });
      else if (ty === 'cru') mk(pick(geo.cru), x, z, { anchor: 1, mast: 5.3, scope: 14 });
      else if (ty === 'fly') mk(pick(geo.fly), x, z, { anchor: 1, mast: 7.4, scope: 18 });
      else mk(geo.tin[0], x, z, { anchor: 1, mast: 1.2, scope: 7, small: 1 });
      k++;
    }
  };
  const find = (arr, re) => arr.find(o => re.test(o.n || ''));
  const at = (o) => o && (o.c || o.p);
  const tw = at(find(F.views, /Tangalooma Wrecks/)), tg = at(find(F.places, /^Tangalooma/)), bw = at(find(F.places, /Bulwer/)), cc = at(find(F.places, /Cowan/)), ko = at(find(F.places, /Kooringal/)), dg = at(find(F.seanames, /Days Gutter/));
  const M3 = ['moor', 'moor', 'cru', 'cru', 'tin'];
  if (tw) { moor(tw[0] - 60, tw[1], MOBILE ? 9 : 16, 330, M3, 1.6, 9); }
  if (tg) moor(tg[0] - 350, tg[1] + 100, MOBILE ? 7 : 12, 480, M3);
  if (bw) moor(bw[0] - 350, bw[1], 6, 420, M3);
  if (cc) moor(cc[0] - 300, cc[1], 4, 350, M3);
  if (ko) moor(ko[0] - 250, ko[1], 7, 520, ['moor', 'cru', 'tin', 'tin'], 1.2, 9);
  if (dg) moor(dg[0], dg[1], 6, 600, M3);
  for (const a of F.anchor) moor(a.p[0], a.p[1], 3, 300, M3);
  for (const s of F.seanames) if (/Bank/.test(s.n)) moor(s.p[0], s.p[1], 3, 900, ['tin', 'tin', 'cru'], 0.8, 5);

  // ---- under way ----
  const NAV = MOBILE ? 6 : 10;
  const homes = [[-6500, -9000, 3500], [-7000, 0, 3800], [-5500, 8000, 3000], [-3500, -14000, 3000], [7500, -6000, 2800], [8500, 6000, 2800], [-7500, -4000, 3500], [-6000, 13000, 2800], [-8000, 5000, 3000], [2000, -20500, 1500]];
  for (let i = 0; i < NAV; i++) {
    const h = homes[i % homes.length], sail = i % 3 !== 2;
    let x = h[0], z = h[1];
    for (let t = 0; t < 60; t++) { const px = h[0] + (R() - .5) * h[2], pz = h[1] + (R() - .5) * h[2]; if (depth(px, pz) > 5) { x = px; z = pz; break; } }
    mk(sail ? pick(geo.sail) : pick(geo.cru), x, z, { move: 1, sail, home: h, tx: x, tz: z, tt: 0, tack: R() < .5 ? 1 : -1, mast: sail ? 15.5 : 5.3, cruise: sail ? 0 : 8 + R() * 5 });
  }
  // flybridge cruisers working up and down the west coast, and a few lying at anchor off the settlements
  for (let i = 0; i < (MOBILE ? 3 : 5); i++) {
    const h = [[-6000, -9500, 3200], [-6500, -3000, 3500], [-5500, 4500, 3200], [-4500, 10500, 2600], [-6800, -6000, 3000]][i];
    let x = h[0], z = h[1];
    for (let t = 0; t < 60; t++) { const px = h[0] + (R() - .5) * h[2], pz = h[1] + (R() - .5) * h[2]; if (depth(px, pz) > 5) { x = px; z = pz; break; } }
    mk(pick(geo.fly), x, z, { move: 1, sail: false, home: h, tx: x, tz: z, tt: 0, tack: 1, mast: 7.4, cruise: 7 + R() * 4 });
  }
  if (tg) moor(tg[0] - 500, tg[1] - 300, 2, 500, ['fly'], 2.5, 12);
  if (bw) moor(bw[0] - 450, bw[1], 1, 420, ['fly'], 2.5, 12);
  if (cc) moor(cc[0] - 400, cc[1], 1, 400, ['fly'], 2.5, 12);
  // jet skis tearing about off Tangalooma
  if (tg) for (let i = 0; i < (MOBILE ? 3 : 5); i++) {
    const h = [tg[0] - 700, tg[1] - 500, 1500];
    let x = h[0], z = h[1];
    for (let t = 0; t < 60; t++) { const px = h[0] + (R() - .5) * h[2], pz = h[1] + (R() - .5) * h[2]; if (depth(px, pz) > 3) { x = px; z = pz; break; } }
    mk(geo.jet[i % geo.jet.length], x, z, { move: 1, sail: false, jet: 1, home: h, tx: x, tz: z, tt: 0, tack: 1, mast: 1.4, small: 1, cruise: 8 + R() * 3 });
  }
  // small boats pottering between the resort and the wrecks
  if (tg) for (let i = 0; i < (MOBILE ? 3 : 5); i++) {
    const h = [tg[0] - 1000, tg[1] - 900, 1700], tin = i % 2 === 0;
    let x = h[0], z = h[1];
    for (let t = 0; t < 60; t++) { const px = h[0] + (R() - .5) * h[2], pz = h[1] + (R() - .5) * h[2]; if (depth(px, pz) > 5) { x = px; z = pz; break; } }
    mk(tin ? geo.tin[0] : pick(geo.cru), x, z, { move: 1, sail: false, home: h, tx: x, tz: z, tt: 0, tack: 1, mast: tin ? 1.2 : 5.3, small: tin ? 1 : 0, cruise: tin ? 5 + R() * 3 : 7 + R() * 4 });
  }
  // ---- ferries on their charted routes ----
  for (const f of F.ferries) {
    let pts = f.p.filter(p => p[0] > -T.sx / 2 - 9000 && Math.abs(p[1]) < T.sz / 2 + 5000);
    if (pts.length < 2) continue;
    const big = /MICAT/i.test(f.n), trader = /Trader/i.test(f.n);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // the island end of each route: the resort jetty, the wrecks landing, Kooringal
    const end = cum[cum.length - 1], e0 = pts[0], e1 = pts[pts.length - 1], islandFirst = Math.hypot(e0[0], e0[1] / 2) < Math.hypot(e1[0], e1[1] / 2);
    const out = big ? 2600 : trader ? 900 : 1500;                       // metres still to run when the map opens
    mk(big || trader ? geo.barge : geo.flyer, pts[0][0], pts[0][1], { ferry: 1, move: 1, big: 1, pts, cum, s: islandFirst ? out : end - out, dir: islandFirst ? -1 : 1, wait: 0, scale: trader ? 0.55 : 1, cruise: big ? 9 : trader ? 6 : 15, mast: big ? 12.5 : 10.8 });
  }

  // ---- wakes ----
  const movers = boats.filter(b => b.move), NW = 44;
  const wp = new Float32Array(movers.length * NW * 2 * 3), wa = new Float32Array(movers.length * NW * 2 * 2), wi = [];
  movers.forEach((b, k) => { b.hist = []; b.wk = k; for (let j = 0; j < NW - 1; j++) { const o = (k * NW + j) * 2; wi.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); } });
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(wp, 3).setUsage(THREE.DynamicDrawUsage));
  wg.setAttribute('aA', new THREE.BufferAttribute(wa, 2).setUsage(THREE.DynamicDrawUsage));
  wg.setIndex(wi); wg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const wmat = makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vs: /* glsl */`attribute vec2 aA; varying vec2 vA; varying vec3 vW; void main(){ vA = aA; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`varying vec2 vA; varying vec3 vW;
      void main(){ ${LOGF}
        float n = texture2D(uNoise, vW.xz / 4.3).b * 0.55 + texture2D(uNoise, vW.xz / 13.0 + uTime * 0.02).g * 0.5 + texture2D(uNoise, vW.xz / 37.0).r * 0.3;
        float e = abs(vA.y);
        float arms = smoothstep(1.0, 0.8, e) * smoothstep(0.45, 0.85, e);                     // the two foaming edges of the V
        float churn = (1.0 - e) * vA.x * vA.x;                                                // prop wash, strongest right behind the boat
        float a = vA.x * smoothstep(0.55 - vA.x * 0.35, 0.95, n + arms * 0.45 + churn * 0.5) * (arms + churn * 0.9 + 0.12);
        vec3 c = vec3(0.93, 0.96, 0.97) * (uLightCol * 0.3 * cloudShadow(vW) + uAmbSky * 0.9);
        gl_FragColor = vec4(applyFog(c, vW), a * 0.8); }`,
  });
  const wm = new THREE.Mesh(wg, wmat); wm.frustumCulled = false; wm.renderOrder = 12; scene.add(wm);
  scene.add(lights.pts);
  lights.pts.material.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2);

  const wo = {}; let recT = 0;
  const turn = (b, want, rate, dt) => { let d = ((want - b.hd + Math.PI * 3) % (Math.PI * 2)) - Math.PI; b.hd += clamp(d, -rate * dt, rate * dt); return d; };
  return {
    boats,
    update(dt, t, camera) {
      const wt = U.uWindDir.value, sea = U.uSeaM.value * VEX, upwind = Math.atan2(wt.y, -wt.x);
      recT += dt; const rec = recT > 0.28; if (rec) recT = 0;
      for (const b of boats) {
        let roll = 0;
        if (b.anchor) {
          const yaw = upwind + Math.sin(t * 0.07 + b.ph) * 0.28 + Math.sin(t * 0.19 + b.ph * 3) * 0.1;
          turn(b, yaw, 0.12, dt);
          b.x = b.ax - Math.cos(b.hd) * b.scope; b.z = b.az + Math.sin(b.hd) * b.scope;
        } else if (b.ferry) {
          const end = b.cum[b.cum.length - 1];
          if (b.wait > 0) { b.wait -= dt; b.sp += (0 - b.sp) * Math.min(1, dt); }
          else {
            const toEnd = b.dir > 0 ? end - b.s : b.s;
            b.sp += (Math.min(b.cruise, 1.5 + toEnd * 0.05) * 1.6 - b.sp) * Math.min(1, dt * 0.5);
            b.s += b.sp * b.dir * dt;
            if (b.s >= end || b.s <= 0) { b.s = clamp(b.s, 0, end); b.dir *= -1; b.wait = 75; }
          }
          let i = 1; while (i < b.cum.length - 1 && b.cum[i] < b.s) i++;
          const a = b.pts[i - 1], c = b.pts[i], f = (b.s - b.cum[i - 1]) / Math.max(1, b.cum[i] - b.cum[i - 1]);
          b.x = a[0] + (c[0] - a[0]) * f; b.z = a[1] + (c[1] - a[1]) * f;
          if (b.sp > 0.5) turn(b, Math.atan2(-(c[1] - a[1]) * b.dir, (c[0] - a[0]) * b.dir), 0.25, dt);
        } else {
          // free-roaming yacht or cruiser: wander inside its home water, keep off the banks
          b.tt -= dt;
          const dx = b.tx - b.x, dz = b.tz - b.z, dd = Math.hypot(dx, dz);
          const ahead = (d, off) => depth(b.x + Math.cos(b.hd + off) * d, b.z - Math.sin(b.hd + off) * d);
          const shoal = ahead(120, 0) < 3.2 || ahead(260, 0) < 2.6 || !inRect(b.x + Math.cos(b.hd) * 400, b.z - Math.sin(b.hd) * 400, 500);
          if (dd < 150 || b.tt < 0 || shoal) {
            for (let k = 0; k < 20; k++) { const px = b.home[0] + (Math.random() - .5) * b.home[2] * 2, pz = b.home[1] + (Math.random() - .5) * b.home[2] * 2; if (depth(px, pz) > 5 && inRect(px, pz, 600)) { b.tx = px; b.tz = pz; break; } }
            b.tt = b.jet ? 8 + Math.random() * 14 : 60 + Math.random() * 80;
          }
          let want = Math.atan2(-dz, dx);
          if (shoal) want = b.hd + (ahead(200, 0.7) > ahead(200, -0.7) ? 1.2 : -1.2);
          const helm = b.helm;                        // someone aboard has taken the wheel: the boat goes where it is steered
          if (helm) want = b.hd;
          let cruise = b.cruise * (helm ? helm.throttle : 1);
          if (b.sail) {
            let off = ((want - upwind + Math.PI * 3) % (Math.PI * 2)) - Math.PI;      // angle off the wind
            if (!helm && Math.abs(off) < 0.75) { if (Math.random() < dt / 45) b.tack *= -1; want = upwind + 0.78 * b.tack; off = 0.78 * b.tack; }
            const pt = clamp(Math.abs(off) / 1.6, helm ? 0.06 : 0.45, 1);         // steered too close to the wind, the sails empty and she stops
            cruise = clamp(1.6 + wx.wind * 0.13, 1.6, 6.5) * pt * (helm ? Math.min(helm.throttle, 1.15) : 1);
            const side = Math.sin(((b.hd - upwind + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0 ? 1 : -1;
            roll = side * clamp(wx.wind * 0.011, 0.03, 0.42) * (1.25 - pt * 0.5);
            b.m.scale.z = S * (side > 0 ? 1 : -1);                                    // boom and sails set to leeward
          }
          turn(b, want, b.sail ? 0.16 : b.jet ? 1.0 : 0.3, dt);
          if (b.jet) roll = clamp(((want - b.hd + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1) * 0.32;      // a jet ski leans hard into its turns
          if (helm) {
            b.hd -= helm.turn * (b.sail ? 0.3 : b.jet ? 0.8 : 0.45) * dt * clamp(b.sp / 3, 0.25, 1); if (b.jet) roll = helm.turn * 0.32; else if (!b.sail) roll = helm.turn * 0.08;
            if (depth(b.x + Math.cos(b.hd) * 9, b.z - Math.sin(b.hd) * 9) < (b.sail ? 1.5 : 0.6)) { cruise = 0; b.sp *= Math.max(0, 1 - dt * 3); }      // she takes the ground in the shallows
          }
          b.sp += (cruise * 1.6 - b.sp) * Math.min(1, dt * 0.4);
          b.x += Math.cos(b.hd) * b.sp * dt; b.z -= Math.sin(b.hd) * b.sp * dt;
        }
        const wy = waveAt(b.x, b.z, t, wo) * VEX;
        const cs = Math.cos(b.hd), sn = Math.sin(b.hd);
        const sb = (wo.sx * cs - wo.sz * sn) * VEX, sr = (wo.sx * sn + wo.sz * cs) * VEX, k = b.big ? 0.25 : b.small ? 1 : 0.7;
        // A hull has weight: it does not follow every ripple that passes under one point of it. Its rise and fall, pitch and roll ease toward what the
        // sea asks of it, a ferry slowly, a yacht or cruiser more quickly, a dinghy or jet ski almost at once.
        const ty = Math.max(sea + wy * (b.big ? 0.4 : 1) - (b.small ? 0.05 : 0.1), heightAt(b.x, b.z) * VEX + 0.3), trx = -Math.atan(sr) * k + roll + Math.sin(t * 0.9 + b.ph) * 0.02, trz = Math.atan(sb) * k;      // when the tide leaves a boat, it sits on the sand
        const kk = b.py === undefined ? 1 : 1 - Math.exp(-dt * (b.big ? 1.1 : b.small ? 4.5 : 2.0));
        b.py = (b.py ?? ty) + (ty - (b.py ?? ty)) * kk; b.rx = (b.rx ?? trx) + (trx - (b.rx ?? trx)) * kk; b.rz = (b.rz ?? trz) + (trz - (b.rz ?? trz)) * kk;
        b.m.position.set(b.x, b.py, b.z);
        b.m.rotation.set(b.rx, b.hd, b.rz);
        const my = b.m.position.y + b.mast * S * (b.scale || 1);
        lights.move(b.li, b.x, my, b.z);
        if (b.move) {
          lights.move(b.lg, b.x + sn * 2.4, b.m.position.y + 3, b.z + cs * 2.4); lights.move(b.lr, b.x - sn * 2.4, b.m.position.y + 3, b.z - cs * 2.4);
          if (rec) { b.hist.unshift({ x: b.x - cs * 4 * S, z: b.z + sn * 4 * S, nx: sn, nz: cs, t, sp: b.sp }); if (b.hist.length > NW) b.hist.length = NW; }
          const w0 = b.big ? 7 : 1.6, life = b.big ? 26 : 9;
          for (let j = 0; j < NW; j++) {
            const h = b.hist[Math.min(j, b.hist.length - 1)] || { x: b.x, z: b.z, nx: sn, nz: cs, t, sp: 0 };
            const age = t - h.t, w = w0 + age * (b.big ? 1.5 : 0.75), o = (b.wk * NW + j) * 2, al = j >= b.hist.length ? 0 : clamp(1 - age / life, 0, 1) * clamp(h.sp / 5, 0, 1) * (j === 0 ? 0 : 1);
            const y = sea + 0.45 + (j < 3 ? wy : 0);
            wp[o * 3] = h.x - h.nx * w; wp[o * 3 + 1] = y; wp[o * 3 + 2] = h.z - h.nz * w;
            wp[o * 3 + 3] = h.x + h.nx * w; wp[o * 3 + 4] = y; wp[o * 3 + 5] = h.z + h.nz * w;
            wa[o * 2] = al; wa[o * 2 + 1] = -1; wa[o * 2 + 2] = al; wa[o * 2 + 3] = 1;
          }
        }
      }
      wg.attributes.position.needsUpdate = true; wg.attributes.aA.needsUpdate = true;
    },
  };
}

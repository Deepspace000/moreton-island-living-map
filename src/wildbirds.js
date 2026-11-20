// More of Moreton's birds, each its own anatomy (not a recoloured pelican): five raptors on the wing (osprey, brahminy kite, whistling kite,
// wedge-tailed eagle, peregrine), the waders that walk the tide line (far eastern curlew, bar-tailed godwit, pied oystercatcher, beach
// stone-curlew), and the water birds (black swan, great cormorant). Same smooth lofted parts as creatures.js; colour comes from a function
// of the surface's own coordinates, so a head can have its stripes, a belly its white and a tail its bars.
import * as THREE from 'three';
import { spotWalk } from './spot.js';
import { Shape, bird } from './creatures.js';
import { makeMat, nearOnly, byPlace, FEATHER_GLSL, LOGV, LOGF } from './common.js';

const PI = Math.PI, FAR = new THREE.Sphere(new THREE.Vector3(), 1e6);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hs = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
// feather mottling: every patch of feathers a little lighter or darker than its neighbours
const spot = (base, dark, kx, ky, amt = 0.7) => (u, v) => { const row = Math.floor(v * ky), uu = u * kx + 0.5 * (row & 1), fu = uu - Math.floor(uu), fv = v * ky - row, d = Math.hypot(fu - 0.5, (fv - 0.5) * 1.3); return mx(base, dark, amt * sm(0.35, 0.85, hs(Math.floor(uu), row)) * (1 - 0.55 * sm(0.28, 0.55, d))); };
const dvOf = (v) => Math.cos(2 * PI * (v - 0.75));
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const bars = (a, b, n, k = 0.5) => (u, v) => mx(a, b, sm(0.2, 0.8, 0.5 + 0.5 * Math.sin(v * n * Math.PI * 0.5)));      // bars across a tail or a flight feather (v runs along it)

// ---------------------------------------------------------------- raptors on the wing
// One body and one wing (hinged at the shoulder, reaching along +z), like EAGLE_FLY and EAGLE_WING. The wing is a pair of curved sheets,
// the leading coverts and the trailing flight feathers, stacked top and bottom so the upper side and the underside can be different
// colours; a curl bends the span (up from the shoulder, down at the tip: the gull-wing of an osprey), and spread fingers end it.
const BODY = [[0.34, 0.01, 0.015, 0.0], [0.27, 0.065, 0.07, 0.004], [0.1, 0.11, 0.125, 0.0], [-0.12, 0.115, 0.13, 0.0], [-0.34, 0.075, 0.09, 0.005], [-0.5, 0.015, 0.04, 0.01]];
function raptorBody(s) {
  const [bx, by, bz] = s.sc || [1, 1, 1], pr = BODY.map(r => [r[0] * bx, r[1] * by, r[2] * bz, r[3]]);
  return bird((m) => {
    m.body(pr, { NR: 14, NS: 12 });
    const hx = 0.24 * bx, hr = s.headR || 0.08;
    m.tube((t) => [hx + (0.2 * bx) * t, 0.04 + 0.02 * Math.sin(t * PI), 0, 0.012 + hr * Math.pow(Math.sin(PI * (0.14 + 0.84 * t)), 0.6)], 8, 12, 2);                  // head
    m.tube((t) => [hx + 0.2 * bx + 0.085 * t, 0.045 - 0.075 * t * t - 0.02 * t, 0, (s.billR || 0.026) - 0.022 * t], 6, 8, 3);                                      // hooked bill
    for (const sd of [-1, 1]) {
      m.tube((t) => [hx + 0.115 * bx + 0.004 * t, 0.06, sd * (hr * 0.92), 0.011 * Math.sin(PI * t)], 3, 6, 5);                                                      // the eye
      m.tube((t) => [-0.12 - 0.2 * t, -0.09 - 0.03 * t, sd * 0.05, 0.016 - 0.006 * t], 4, 6, 4);                                                                     // feet tucked back
    }
    // the tail: two sheets, barred
    { const n = 11, wedge = s.tailTip < 1; for (const [dy, part] of [[0.007, 6], [-0.007, 7]]) for (let k = 0; k < n; k++) { const u = (k / (n - 1) - 0.5) * 2, ang = u * (wedge ? 0.22 : 0.34), len = s.tailLen * (1 - (wedge ? 0.55 * Math.abs(u) : 0.3 * Math.pow(Math.abs(u), 1.8))) * (0.94 + 0.12 * hs(k, 7));
        m.leaf([-0.44 * bx, 0.02 + dy, u * 0.03], [-Math.cos(ang), 0.02, Math.sin(ang)], [Math.sin(ang), 0, Math.cos(ang)], len, s.tailW / n * 2.7, { part, flex: () => 0, ns: 6, nt: 3, blunt: true }); } }
  }, [(u, v) => mx(s.top, typeof s.under === 'function' ? s.under(u, v) : s.under, sm(0.36, 0.62, v)), null, s.head, s.bill, s.feet || [0.82, 0.74, 0.3], [0.05, 0.04, 0.03], s.tailTop, s.tailUnder], [1, 1, 1, 3, 4, 3, 5, 5]);
}
function raptorWing(s) {
  const ax = s.a, cu = s.curl, L = s.len, C0 = 2 * (s.covW + s.secW), tc = s.covW / (s.covW + s.secW), n = s.fingers, s0 = n ? s.fs ?? 0.72 : 1, front = s.front || 0.1, NSEC = n ? 12 : 15;
  const chordAt = (sp) => C0 * (1 - s.taper * Math.pow(sp, s.tp)) * (1 + 0.16 * Math.sin(Math.PI * Math.min(1, sp / 0.9))) * (n ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(sp, 10))));
  const feather = (cov, fl) => (u, v) => mx(typeof cov === 'function' ? cov(0.95, 0.5) : cov, typeof fl === 'function' ? fl(u, v) : fl, sm(0, 0.3, v));
  const col = (c) => (typeof c === 'function' ? c(0.5, 0.8) : c), tipC = (fl, dk) => (u, v) => mx(typeof fl === 'function' ? fl(u, v) : fl, dk, 0.2 + 0.5 * sm(0.4, 1, v));
  // a point on the arm: t across it (0 leading edge, 1 trailing edge), sp along it (0 shoulder, 1 the wrist, or the tip of a falcon's wing), dy the layer
  const P = (t, sp, dy) => {
    const c = chordAt(sp), le = front + s.lead * Math.sin(Math.PI * Math.min(1, sp * 1.1)) + ax[0] * L * sp + cu[0] * L * sp * sp - 0.22 * L * sp * sp;
    return [le - t * c, dy * Math.min(1, t * 6) + ax[1] * L * sp + cu[1] * L * sp * sp + 0.03 * C0 * Math.sin(Math.PI * t) * (1 - sp), -0.03 + L * sp];
  };
  return bird((m) => {
    for (const [dy, pc, pf, pg] of [[0.008, 0, 1, 2], [-0.008, 3, 4, 5]]) {
      m.surf(6, 20, (t, sp) => P(t * tc, sp * s0, dy), pc, () => 0);                                   // the coverts along the leading edge
      for (const [tt, ln] of [[0.45, 0.5], [0.85, 0.42]]) for (let i = 0; i < 14; i++) { const sp = (i + 0.5) / 14 * s0 * 0.96, b0 = P(tc * tt, sp, dy * 1.15); m.leaf(b0, norm([-1, ax[1] * 0.1, 0.1 + 0.25 * sp + 0.2 * (hs(i, tt * 9) - 0.5)]), [0, 0, 1], chordAt(sp) * tc * ln * (0.8 + 0.4 * hs(i, tt * 7)), L * s0 / 14 * 0.8, { part: pc, flex: () => 0, ns: 4, nt: 2, blunt: true }); }          // rows of short covert feathers
      for (let i = 0; i < NSEC; i++) {                                                                // the secondaries (and a falcon's primaries): one feather each, lapping the next
        const sp = (i + 0.5) / NSEC * s0, b0 = P(tc - 0.03, sp, dy * 0.9), len = chordAt(sp) * (1 - tc) * 1.12 * (0.9 + 0.2 * hs(i, 11)), dz = L * s0 / NSEC;
        m.leaf([b0[0], b0[1], b0[2]], norm([-1, ax[1] * 0.15 - 0.04, 0.16 + 0.35 * sp + 0.35 * (hs(i, 13) - 0.5)]), [0, 0, 1], len, dz * 1.9, { part: pf, flex: () => 0, ns: 6, nt: 3, blunt: true, curl: [0, -0.04 - 0.04 * hs(i, 9), 0] });
      }
      if (n) {                                                                                        // the primaries: separate fingers fanned out from the wrist
        const tg = norm([ax[0] + 2 * cu[0] * s0, ax[1] + 2 * cu[1] * s0, 1]), cw = chordAt(s0);
        for (let i = 0; i < n; i++) {
          const k = n > 1 ? i / (n - 1) : 0.5, b0 = P(0.06 + k * 0.88, s0, dy), dx = s.fan * (0.45 - k), a = norm([tg[0] + dx, tg[1] + 0.05 * k, tg[2]]);
          m.leaf([b0[0] - a[0] * 0.05, b0[1], b0[2] - 0.05], a, norm([a[2], 0, -a[0]]), s.fLen * (1 - 0.3 * Math.abs(k - 0.25)) * (0.75 + 0.5 * hs(i, 3)), cw / n * 0.85, { part: pg, flex: () => 0, ns: 8, nt: 4, blunt: true, curl: [-0.03 - 0.05 * k, 0.05 + 0.06 * k, 0] });
        }
      }
    }
  }, [s.topCov, feather(s.topCov, s.topFl), tipC(s.topFl, s.topFg), s.botCov, feather(s.botCov, s.botFl), tipC(s.botFl, s.botFg), null], [1, 5, 5, 1, 5, 5, 1]);
}
// Osprey: white head with a dark mask, dark brown above, white below with a brown breast band, long narrow wings crooked at the wrist
const OSPREY_S = {
  sc: [1.0, 1.0, 0.95], headR: 0.086, tailLen: 0.4, tailW: 0.168, tailTip: 2.0, top: [0.2, 0.14, 0.1], under: [0.94, 0.93, 0.9],
  head: (u, v) => { const dv = dvOf(v); return mx([0.95, 0.94, 0.9], [0.1, 0.07, 0.05], (1 - sm(0.2, 0.45, Math.abs(dv))) * sm(0.15, 0.4, u) * (1 - sm(0.8, 0.95, u))); },
  bill: [0.07, 0.07, 0.08], tailTop: bars([0.3, 0.24, 0.19], [0.14, 0.1, 0.08], 6), tailUnder: bars([0.78, 0.76, 0.7], [0.48, 0.42, 0.36], 6),
  a: [-0.02, 0.48, 1], curl: [-0.03, -0.86, 0], front: 0.07, covW: 0.1, secW: 0.15, len: 1.06, secLen: 0.96, tipC: 0.5, tipS: 0.48, fingers: 6, fan: 0.7, fLen: 0.34, lead: 0.07, fs: 0.7, taper: 0.62, tp: 1.25,
  topCov: spot([0.24, 0.17, 0.12], [0.34, 0.26, 0.2], 7, 7, 0.6), topFl: (u, v) => mx([0.2, 0.14, 0.1], [0.3, 0.23, 0.17], sm(0.4, 0.6, Math.sin(v * 9) * 0.5 + 0.5) * 0.22), topFg: [0.07, 0.05, 0.045],
  botCov: (u, v) => mx(spot([0.94, 0.93, 0.9], [0.8, 0.72, 0.62], 6, 6, 0.5)(u, v), [0.22, 0.15, 0.1], sm(0.3, 0.4, v) * (1 - sm(0.5, 0.6, v)) * sm(0.15, 0.3, u) * (1 - sm(0.75, 0.9, u))), botFl: bars([0.78, 0.76, 0.72], [0.38, 0.33, 0.3], 7), botFg: [0.12, 0.1, 0.1],
};
export const OSPREY_FLY = () => raptorBody(OSPREY_S);
export const OSPREY_WING = () => raptorWing(OSPREY_S);
// Brahminy kite: a chestnut kite with a white head and breast, black wing tips, short rounded tail, wings broad and rounded
const BRAH_S = {
  sc: [0.95, 1.0, 0.98], headR: 0.080, tailLen: 0.3, tailW: 0.154, tailTip: 1.8, top: [0.36, 0.17, 0.09], under: (u, v) => mx([0.94, 0.93, 0.9], [0.4, 0.2, 0.11], sm(0.32, 0.52, u)),
  head: [0.96, 0.95, 0.92], bill: [0.78, 0.74, 0.5], tailTop: (u, v) => mx([0.48, 0.21, 0.09], [0.95, 0.93, 0.88], sm(0.78, 0.95, v)), tailUnder: (u, v) => mx([0.52, 0.24, 0.1], [0.95, 0.93, 0.88], sm(0.78, 0.95, v)),
  a: [-0.02, 0.24, 1], curl: [-0.05, -0.32, 0], front: 0.1, covW: 0.15, secW: 0.19, len: 0.98, secLen: 0.9, tipC: 0.45, tipS: 0.42, fingers: 6, fan: 0.7, fLen: 0.36, lead: 0.07, fs: 0.7, taper: 0.62, tp: 1.25,
  topCov: spot([0.36, 0.17, 0.09], [0.26, 0.12, 0.07], 8, 6, 0.6), topFl: spot([0.32, 0.15, 0.08], [0.22, 0.1, 0.06], 5, 14, 0.7), topFg: [0.07, 0.06, 0.06],
  botCov: spot([0.4, 0.2, 0.11], [0.3, 0.14, 0.08], 8, 6, 0.6), botFl: spot([0.34, 0.16, 0.09], [0.24, 0.11, 0.07], 5, 14, 0.7), botFg: [0.08, 0.07, 0.07],
};
export const BRAHMINY_FLY = () => { const g = raptorBody({ ...BRAH_S, top: BRAH_S.top, under: BRAH_S.under }); return g; };
export const BRAHMINY_WING = () => raptorWing(BRAH_S);
// Whistling kite: pale cinnamon-buff, the long wings paler on the coverts and dark along the trailing edge, a long rounded tail
const WHIST_S = {
  sc: [1.0, 1.0, 1.12], headR: 0.080, tailLen: 0.46, tailW: 0.154, tailTip: 2.0, top: [0.55, 0.42, 0.28], under: [0.8, 0.7, 0.54],
  head: (u, v) => mx(mx([0.7, 0.58, 0.42], [0.46, 0.34, 0.22], sm(0.1, -0.5, dvOf(v)) * 0.5), [0.2, 0.14, 0.1], (1 - sm(0.2, 0.4, Math.abs(dvOf(v)))) * sm(0.2, 0.4, u) * (1 - sm(0.8, 0.95, u))), bill: [0.2, 0.18, 0.16], tailTop: bars([0.5, 0.38, 0.26], [0.36, 0.27, 0.19], 7), tailUnder: bars([0.8, 0.7, 0.54], [0.62, 0.52, 0.38], 7),
  a: [-0.02, 0.3, 1], curl: [-0.05, -0.5, 0], front: 0.1, covW: 0.13, secW: 0.17, len: 1.06, secLen: 0.96, tipC: 0.5, tipS: 0.46, fingers: 6, fan: 0.7, fLen: 0.36, lead: 0.07, fs: 0.7, taper: 0.62, tp: 1.25,
  topCov: spot([0.6, 0.47, 0.3], [0.44, 0.33, 0.21], 7, 6, 0.6), topFl: (u, v) => mx([0.46, 0.34, 0.22], [0.26, 0.19, 0.13], sm(0.3, 0.9, v)), topFg: [0.12, 0.09, 0.07],
  botCov: spot([0.72, 0.63, 0.49], [0.6, 0.5, 0.36], 7, 6, 0.5), botFl: (u, v) => mx([0.58, 0.5, 0.38], [0.24, 0.17, 0.12], sm(0.35, 0.8, v)), botFg: [0.14, 0.1, 0.08],
};
export const WHISTLING_FLY = () => raptorBody(WHIST_S);
export const WHISTLING_WING = () => raptorWing(WHIST_S);
// Wedge-tailed eagle: all dark brown with a golden nape, the biggest of them, very broad fingered wings and a long diamond of a tail
const WEDGE_S = {
  sc: [1.05, 0.98, 0.95], headR: 0.085, billR: 0.022, tailLen: 0.72, tailW: 0.196, tailTip: 0.55, top: [0.17, 0.12, 0.09], under: [0.19, 0.14, 0.1],
  head: (u, v) => mx([0.2, 0.14, 0.1], [0.42, 0.3, 0.15], sm(0.3, 0.6, u) * (1 - sm(0.1, 0.4, ((v + 0.5) % 1 > 0.5 ? 1 - ((v + 0.5) % 1) : ((v + 0.5) % 1)) * 2))), bill: [0.5, 0.45, 0.3], tailTop: (u, v) => mx([0.2, 0.14, 0.1], [0.3, 0.22, 0.16], sm(0.5, 1, v)), tailUnder: [0.22, 0.17, 0.13],
  a: [-0.02, 0.2, 1], curl: [-0.07, -0.22, 0], front: 0.1, covW: 0.19, secW: 0.21, len: 1.2, secLen: 0.96, tipC: 0.4, tipS: 0.38, fingers: 7, fan: 0.7, fLen: 0.46, lead: 0.09, fs: 0.66, taper: 0.62, tp: 1.25,
  topCov: spot([0.28, 0.2, 0.13], [0.16, 0.11, 0.08], 8, 6, 0.7), topFl: spot([0.16, 0.11, 0.08], [0.24, 0.17, 0.12], 6, 16, 0.6), topFg: [0.09, 0.07, 0.06],
  botCov: spot([0.22, 0.16, 0.11], [0.15, 0.1, 0.07], 8, 6, 0.7), botFl: spot([0.14, 0.1, 0.075], [0.24, 0.18, 0.13], 6, 16, 0.6), botFg: [0.09, 0.07, 0.06],
};
export const WEDGETAIL_FLY = () => raptorBody(WEDGE_S);
export const WEDGETAIL_WING = () => raptorWing(WEDGE_S);
// Peregrine falcon: slate-blue above, barred cream below, a dark hood and moustache, stiff pointed wings swept back, a short barred tail
const PERE_S = {
  sc: [0.9, 1.15, 1.08], headR: 0.1, billR: 0.02, tailLen: 0.34, tailW: 0.105, tailTip: 1.7, top: [0.26, 0.3, 0.36], under: [0.86, 0.82, 0.74],
  head: (u, v) => { const dv = dvOf(v), dk = [0.09, 0.1, 0.12], pale = [0.9, 0.87, 0.8]; return mx(mx(dk, pale, sm(-0.25, -0.65, dv) * sm(0.25, 0.45, u)), dk, sm(0.45, 0.6, u) * (1 - sm(0.7, 0.85, u)) * (1 - sm(-0.15, -0.4, Math.abs(dv + 0.4))) * 0.0 + (u > 0.5 && u < 0.85 && dv < -0.3 && dv > -0.62 ? 0.8 : 0)); },
  bill: [0.32, 0.34, 0.36], tailTop: bars([0.28, 0.32, 0.38], [0.15, 0.17, 0.21], 8), tailUnder: bars([0.8, 0.77, 0.7], [0.46, 0.44, 0.42], 8),
  a: [0.0, 0.1, 1], curl: [-0.34, -0.1, 0], front: 0.08, covW: 0.09, secW: 0.12, len: 0.94, secLen: 0.9, tipC: 0.55, tipS: 0.5, fingers: 5, fan: 0.25, fLen: 0.2, lead: 0.01, fs: 0.82, taper: 0.8, tp: 1.25,
  topCov: spot([0.27, 0.31, 0.38], [0.18, 0.21, 0.27], 8, 7, 0.6), topFl: (u, v) => mx([0.22, 0.25, 0.31], [0.12, 0.13, 0.16], sm(0.4, 1, v)), topFg: [0.08, 0.09, 0.1],
  botCov: bars([0.86, 0.82, 0.74], [0.5, 0.48, 0.46], 12), botFl: bars([0.7, 0.68, 0.64], [0.36, 0.34, 0.33], 9), botFg: [0.22, 0.22, 0.24],
};
export const PEREGRINE_FLY = () => raptorBody(PERE_S);
export const PEREGRINE_WING = () => raptorWing(PERE_S);

// ---------------------------------------------------------------- waders and other birds that stand
// A bird on its feet, built in metres: a body tilted up at the front, a neck rising from the breast to the head, a bill, two legs with a bent
// joint and toes on the ground (y = 0). p.tilt is the pitch of the body; p.by the height of its centre; p.head [x, y] the centre of the head.
function standing(p) {
  const ct = Math.cos(p.tilt), st = Math.sin(p.tilt), T = (x, y) => [x * ct - y * st, p.by + x * st + y * ct], C = p.cols;
  return bird((m) => {
    m.body(p.body, { NR: 18, NS: 14, belly: p.belly || 0.9 });
    for (let i = 0; i < m.pos.length; i += 3) { const x = m.pos[i], y = m.pos[i + 1]; m.pos[i] = x * ct - y * st; m.pos[i + 1] = p.by + x * st + y * ct; }
    const n0 = T(p.neck[0], p.neck[1]), [hx, hy] = p.head, hl = p.hl, hr = p.hr, hd = p.hd || 0, nr0 = p.neck[2], nr1 = p.neck[3], bow = p.neck[4] || 0;
    m.tube((t) => [n0[0] + (hx - hl * 0.45 - n0[0]) * t + bow * Math.sin(PI * t) + 0.5 * bow * Math.sin(2 * PI * t) * (1 - t), n0[1] + (hy - n0[1]) * t + 0.012 * Math.sin(2 * PI * t), 0, (nr0 * 1.25) + (nr1 * 1.1 - nr0 * 1.25) * Math.pow(t, 0.8)], 14, 12, 8);                                  // the neck
    m.tube((t) => [hx - hl * 0.5 + hl * t, hy - hd * t, 0, hr * (0.35 + 0.65 * Math.pow(Math.sin(PI * (0.1 + 0.88 * t)), 0.6))], 8, 14, 2);                                                                               // the head
    const bx0 = hx + hl * 0.5, by0 = hy - hd, b = p.bill;
    m.tube((t) => [bx0 - 0.004 + b.len * t, by0 - b.len * (b.drop * t + b.bend * t * t), 0, b.r0 + (b.r1 - b.r0) * Math.pow(t, 0.9)], 12, 8, 3);                                                                          // the bill
    for (const sd of [-1, 1]) {
      m.tube((t) => [hx + hl * 0.08 + 0.002 * t, hy + hr * 0.2, sd * hr * 0.9, p.eye * Math.sin(PI * t)], 4, 8, 5);                                                                                                  // the eye
      if (p.pupil) m.tube((t) => [hx + hl * 0.1 + 0.002 * t, hy + hr * 0.2, sd * hr * 0.99, p.pupil * Math.sin(PI * t)], 3, 6, 7);
      const hip = T(p.leg.x, -p.body[2][1] * 0.8), lt = Math.max(0.02, hip[1] - 0.012);
      m.tube((t) => [hip[0] - p.leg.knee * Math.sin(PI * t) + p.leg.lean * t, hip[1] - lt * t, sd * p.leg.z, p.leg.r * (1 - 0.35 * t) * (1 + (p.leg.knob || 0) * Math.exp(-Math.pow((t - 0.5) / 0.1, 2)))], 10, 7, 4);       // the leg
      for (const [dx, dz, ln] of [[1, 0, p.leg.toe], [0.8, 0.45 * sd, p.leg.toe * 0.9], [0.8, -0.45 * sd, p.leg.toe * 0.9], [-1, 0, p.leg.toe * 0.45]]) m.leaf([hip[0] + p.leg.lean, 0.006, sd * p.leg.z], [dx, 0, dz], [0, 1, 0], ln, 0.004, { part: 4, flex: () => 0, ns: 3, nt: 2, tip: 0.9 });      // toes on the ground
    }
    // folded wings along the flanks, their tips crossing over the tail, and the tail itself
    const tl = T(p.body[p.body.length - 1][0] * 0.85, 0);
    for (const sd of [-1, 1]) {
      const w0 = T(p.wing[0], p.body[2][1] * 0.6);
      if (p.spread) {                                  // wings held out to the sides and drooping, a front sheet and a trailing sheet of flight feathers
        { m.leaf([w0[0], w0[1], sd * 0.06], [-0.05, -0.55, sd], [ct, st, 0], p.spread[0] * 0.8, p.spread[1] * 0.9, { part: 1, flex: () => 0, ns: 10, nt: 5, tip: 0.5, curl: [-0.05, -0.28, 0] }); const an0 = norm([-0.05, -0.55, sd]); for (let k = 0; k < 8; k++) { const f = (k + 0.5) / 8, bb = [w0[0] + an0[0] * p.spread[0] * 0.7 * f - ct * 0.07, w0[1] + an0[1] * p.spread[0] * 0.7 * f - st * 0.07, sd * 0.06 + an0[2] * p.spread[0] * 0.7 * f]; m.leaf(bb, norm([-ct * 0.9 - 0.05, -st * 0.9 - 0.05 - 0.1 * f, sd * 0.1]), [0, 0, 1], 0.26 * (1.05 - 0.4 * f) + 0.04, 0.04, { part: 1, flex: () => 0, ns: 5, nt: 3, blunt: true }); } }
        { const an = norm([-0.05, -0.55, sd]), L0 = p.spread[0] * 0.85, tb = [w0[0] + an[0] * L0, w0[1] + an[1] * L0, sd * 0.06 + an[2] * L0]; for (let k = 0; k < 5; k++) m.leaf([tb[0] + (k - 2) * 0.022 * ct, tb[1] + (k - 2) * 0.022 * st, tb[2]], norm([an[0] + (k - 2) * 0.02, an[1] - 0.12, an[2]]), [ct, st, 0], 0.17, 0.03, { part: 1, flex: () => 0, ns: 6, nt: 3, tip: 0.7 }); }
      } else m.leaf([w0[0], w0[1], sd * p.body[2][2] * 0.78], [-ct, -st, sd * 0.03], [st * 0.2, -0.75, sd * 0.62], p.wing[1], p.wing[2], { part: 1, flex: () => 0, ns: 10, nt: 5, tip: 0.55, curl: [0, -0.03, sd * -0.1] });
    }
    for (const sd of [-1, 1]) { const w0 = T(p.wing[0], p.body[2][1] * 0.6); for (let k = 0; k < 5; k++) m.leaf([w0[0] - ct * p.wing[1] * 0.78 + (k - 2) * 0.014 * st, w0[1] - st * p.wing[1] * 0.78 - 0.004 * k - (k - 2) * 0.014 * ct * 0.2, sd * (p.body[2][2] * 0.8 + 0.004 * k)], [-ct, -st, sd * 0.05], [st * 0.2, -0.75, sd * 0.62], p.wing[1] * 0.3, 0.013, { part: 1, flex: () => 0, ns: 4, nt: 2, blunt: true }); }
    for (const [dy, part] of [[0.004, 6]]) m.leaf([tl[0], tl[1] + dy, 0], [-ct, -st * 0.9, 0], [0, 0, 1], p.tail[0], p.tail[1], { part, flex: () => 0, ns: 8, nt: 6, tip: 1.2 });
  }, [C.body, C.wing, C.head, C.bill, C.leg, C.eye, C.tail, C.pupil || [0.02, 0.02, 0.02], C.neck || C.head], [1, 2, 1, 3, 4, 3, 2, 3, 1]);
}
// the wader's bill: a base colour running to a dark tip (t along the bill)
const billTo = (a, b, k) => (u, v) => mx(a, b, sm(k - 0.12, k + 0.12, u));
// Far eastern curlew: the biggest wader, buff-brown streaked like the mud, the long neck, and the very long bill curving down
export const CURLEW = () => standing({
  body: [[0.2, 0.012, 0.016, 0], [0.16, 0.05, 0.045, 0.006], [0.07, 0.078, 0.066, 0.01], [-0.05, 0.082, 0.07, 0.008], [-0.15, 0.06, 0.052, 0], [-0.23, 0.03, 0.03, -0.012], [-0.3, 0.01, 0.014, -0.02]],
  tilt: 0.34, by: 0.3, neck: [0.15, 0.04, 0.026, 0.017, 0.045], head: [0.285, 0.545], hl: 0.075, hr: 0.019, hd: 0.01, eye: 0.0055, bill: { len: 0.165, r0: 0.0115, r1: 0.0035, drop: 0.1, bend: 0.55 },
  leg: { x: -0.01, knee: 0.012, lean: -0.006, z: 0.03, r: 0.011, toe: 0.055 }, wing: [0.1, 0.34, 0.075], tail: [0.12, 0.05],
  cols: { body: (u, v) => mx(spot([0.62, 0.5, 0.36], [0.28, 0.2, 0.14], 22, 9, 0.9)(u, v), [0.84, 0.76, 0.62], sm(0.55, 0.8, v)), wing: spot([0.5, 0.38, 0.26], [0.22, 0.16, 0.11], 5, 12, 0.9), head: spot([0.72, 0.62, 0.48], [0.3, 0.22, 0.15], 10, 14, 0.8), bill: billTo([0.76, 0.56, 0.48], [0.18, 0.12, 0.09], 0.7), leg: [0.38, 0.42, 0.45], eye: [0.04, 0.03, 0.025], tail: bars([0.52, 0.4, 0.28], [0.3, 0.22, 0.15], 6) },
});
// Bar-tailed godwit: neat and long-legged, pale below, mottled grey-brown above, the long bill tipped a little upward, pink at the base
export const GODWIT = () => standing({
  body: [[0.17, 0.011, 0.015, 0], [0.135, 0.044, 0.04, 0.005], [0.06, 0.068, 0.058, 0.008], [-0.04, 0.072, 0.06, 0.006], [-0.13, 0.052, 0.046, 0], [-0.2, 0.026, 0.026, -0.01], [-0.26, 0.009, 0.012, -0.018]],
  tilt: 0.3, by: 0.27, neck: [0.12, 0.035, 0.022, 0.014, 0.03], head: [0.235, 0.455], hl: 0.062, hr: 0.016, hd: 0.0, eye: 0.0048, bill: { len: 0.14, r0: 0.0095, r1: 0.0032, drop: -0.02, bend: -0.16 },
  leg: { x: -0.01, knee: 0.011, lean: -0.005, z: 0.026, r: 0.0095, toe: 0.045 }, wing: [0.09, 0.29, 0.06], tail: [0.1, 0.04],
  cols: { body: (u, v) => mx(spot([0.52, 0.47, 0.4], [0.26, 0.23, 0.2], 20, 8, 0.8)(u, v), [0.92, 0.88, 0.8], sm(0.5, 0.72, v)), wing: spot([0.46, 0.42, 0.36], [0.22, 0.2, 0.17], 5, 12, 0.9), head: (u, v) => mx([0.7, 0.64, 0.55], [0.4, 0.36, 0.3], sm(0.3, 0.1, Math.abs(((v + 0.5) % 1) - 0.5)) * 0.6), bill: billTo([0.86, 0.56, 0.5], [0.08, 0.07, 0.07], 0.6), leg: [0.14, 0.14, 0.16], eye: [0.03, 0.025, 0.02], tail: (u, v) => (Math.floor(v * 7) % 2 && v < 0.85 ? [0.1, 0.09, 0.09] : [0.92, 0.9, 0.86]) },
});
// Pied oystercatcher: stocky, black above and white below with a sharp line between, a bright orange-red chisel of a bill, red eye, pink legs
export const OYSTERCATCHER = () => standing({
  body: [[0.18, 0.015, 0.02, 0], [0.145, 0.06, 0.056, 0.004], [0.06, 0.09, 0.082, 0.008], [-0.05, 0.095, 0.085, 0.006], [-0.14, 0.07, 0.06, 0], [-0.21, 0.035, 0.03, -0.01], [-0.26, 0.012, 0.014, -0.02]],
  tilt: 0.26, by: 0.22, belly: 0.95, neck: [0.14, 0.05, 0.047, 0.038, 0.02], head: [0.215, 0.36], hl: 0.095, hr: 0.03, hd: 0.0, eye: 0.0072, bill: { len: 0.09, r0: 0.0155, r1: 0.0055, drop: 0.08, bend: 0.04 },
  leg: { x: -0.01, knee: 0.008, lean: -0.004, z: 0.032, r: 0.0125, toe: 0.05 }, wing: [0.1, 0.27, 0.07], tail: [0.08, 0.05],
  cols: { body: (u, v) => mx([0.96, 0.96, 0.94], [0.04, 0.04, 0.05], Math.max(1 - sm(0.46, 0.58, v), 1 - sm(0.12, 0.24, u))), wing: (u, v) => mx([0.04, 0.04, 0.05], [0.95, 0.95, 0.93], sm(0.38, 0.55, u) * (1 - sm(0.6, 0.76, u)) * sm(0.15, 0.35, v)), head: [0.04, 0.04, 0.05], bill: [0.96, 0.34, 0.07], leg: [0.86, 0.5, 0.54], eye: [0.9, 0.1, 0.04], tail: (u, v) => mx([0.95, 0.95, 0.92], [0.05, 0.05, 0.06], sm(0.45, 0.7, v)) },
});
// Beach stone-curlew: a tall, upright, big-headed bird with a huge yellow eye, a thick bill, a black-and-white face and long yellow legs with knobbly knees
export const STONECURLEW = () => standing({
  body: [[0.2, 0.015, 0.02, 0], [0.16, 0.06, 0.05, 0.004], [0.07, 0.088, 0.07, 0.01], [-0.05, 0.09, 0.072, 0.006], [-0.16, 0.065, 0.054, 0], [-0.26, 0.03, 0.03, -0.012], [-0.34, 0.01, 0.014, -0.02]],
  tilt: 0.5, by: 0.37, neck: [0.15, 0.04, 0.034, 0.026, 0.0], head: [0.21, 0.6], hl: 0.1, hr: 0.042, hd: 0.012, eye: 0.0145, pupil: 0.0075, bill: { len: 0.068, r0: 0.0175, r1: 0.007, drop: 0.0, bend: -0.28 },
  leg: { x: -0.02, knee: 0.007, lean: 0.0, z: 0.034, r: 0.0125, toe: 0.055, knob: 0.8 }, wing: [0.1, 0.3, 0.075], tail: [0.12, 0.05],
  cols: { body: (u, v) => mx(spot([0.52, 0.46, 0.36], [0.28, 0.24, 0.18], 20, 8, 0.8)(u, v), [0.9, 0.88, 0.82], sm(0.55, 0.78, v)), wing: (u, v) => mx(spot([0.44, 0.4, 0.32], [0.24, 0.21, 0.17], 5, 12, 0.7)(u, v), [0.92, 0.9, 0.86], sm(0.3, 0.4, u) * (1 - sm(0.5, 0.6, u)) * 0.8), head: (u, v) => { const dv = dvOf(v); return mx(mx(mx([0.95, 0.94, 0.9], [0.46, 0.4, 0.32], sm(0.6, 0.88, dv)), [0.08, 0.07, 0.07], (1 - sm(0.18, 0.42, Math.abs(dv))) * sm(0.05, 0.25, u)), [0.94, 0.92, 0.88], sm(-0.45, -0.7, dv)); }, neck: spot([0.5, 0.45, 0.36], [0.3, 0.26, 0.2], 16, 12, 0.8), bill: billTo([0.88, 0.8, 0.22], [0.06, 0.06, 0.06], 0.42), leg: [0.78, 0.82, 0.4], eye: [0.97, 0.88, 0.18], pupil: [0.02, 0.02, 0.02], tail: bars([0.42, 0.37, 0.3], [0.22, 0.19, 0.15], 5) },
});
// Bush stone-curlew: the "curlew" of the townships. Slimmer and longer in the leg than the beach bird, grey-brown streaked with dark, a pale brow over
// the big yellow eye, a dark stripe from the eye down the neck, a short dark bill
export const BUSHCURLEW = () => standing({
  body: [[0.2, 0.013, 0.018, 0], [0.16, 0.052, 0.044, 0.004], [0.07, 0.078, 0.062, 0.01], [-0.05, 0.08, 0.064, 0.006], [-0.16, 0.058, 0.048, 0], [-0.27, 0.027, 0.027, -0.012], [-0.36, 0.009, 0.013, -0.02]],
  tilt: 0.5, by: 0.4, neck: [0.15, 0.036, 0.03, 0.023, 0.0], head: [0.21, 0.62], hl: 0.092, hr: 0.039, hd: 0.012, eye: 0.0145, pupil: 0.0075, bill: { len: 0.05, r0: 0.012, r1: 0.005, drop: 0.0, bend: -0.1 },
  leg: { x: -0.02, knee: 0.007, lean: 0.0, z: 0.03, r: 0.011, toe: 0.05, knob: 0.8 }, wing: [0.1, 0.3, 0.07], tail: [0.14, 0.045],
  cols: { body: (u, v) => mx(spot([0.6, 0.56, 0.5], [0.2, 0.18, 0.15], 7, 20, 0.85)(u, v), spot([0.92, 0.89, 0.8], [0.3, 0.26, 0.22], 6, 18, 0.6)(u, v), sm(0.5, 0.72, v)), wing: (u, v) => mx(spot([0.5, 0.47, 0.42], [0.2, 0.18, 0.16], 4, 14, 0.8)(u, v), [0.86, 0.84, 0.78], sm(0.3, 0.38, u) * (1 - sm(0.46, 0.54, u)) * 0.6), head: (u, v) => { const dv = dvOf(v); return mx(mx(mx([0.94, 0.92, 0.86], [0.52, 0.49, 0.44], sm(0.55, 0.8, dv)), [0.16, 0.14, 0.13], (1 - sm(0.08, 0.24, Math.abs(dv + 0.12))) * sm(0.05, 0.25, u)), [0.93, 0.91, 0.86], sm(-0.5, -0.75, dv)); }, neck: spot([0.68, 0.64, 0.57], [0.24, 0.21, 0.18], 5, 16, 0.8), bill: billTo([0.5, 0.48, 0.3], [0.07, 0.07, 0.07], 0.25), leg: [0.62, 0.63, 0.46], eye: [0.97, 0.88, 0.18], pupil: [0.02, 0.02, 0.02], tail: bars([0.5, 0.47, 0.42], [0.2, 0.18, 0.15], 5) },
});
// Great cormorant standing on the sand: bolt upright, the long hooked bill pointing down, black with a bronze scalloped back, a yellow
// throat pouch and a white chin patch. dry: wings held out to dry in the sun, the pose all cormorants take.
export const CORMORANT_STAND = (dry = false) => {
  const g = standing({
    body: [[0.22, 0.012, 0.02, 0], [0.18, 0.075, 0.07, 0.005], [0.08, 0.105, 0.11, 0.01], [-0.06, 0.11, 0.115, 0.008], [-0.2, 0.085, 0.09, 0], [-0.34, 0.05, 0.05, -0.01], [-0.44, 0.014, 0.02, -0.02]],
    tilt: 0.8, by: 0.34, neck: [0.15, 0.05, 0.042, 0.03, 0.12], head: [0.24, 0.78], hl: 0.1, hr: 0.04, hd: 0.01, eye: 0.0075, bill: { len: 0.1, r0: 0.022, r1: 0.008, drop: 0.05, bend: 0.4 },
    leg: { x: -0.03, knee: 0.004, lean: 0.0, z: 0.04, r: 0.015, toe: 0.11 }, wing: [0.1, 0.4, 0.085], spread: dry ? [0.62, 0.1] : null, tail: [0.13, 0.06],
    cols: { body: (u, v) => mx(spot([0.1, 0.09, 0.08], [0.3, 0.23, 0.13], 24, 11, 1.0)(u, v), [0.07, 0.065, 0.06], sm(0.5, 0.7, v)), wing: (u, v) => mx([0.18, 0.14, 0.09], [0.05, 0.045, 0.045], sm(0.35, 0.85, hs(Math.floor(u * 12), Math.floor(v * 16)))), head: (u, v) => { const a = Math.abs(((v + 0.5) % 1) - 0.5); return u > 0.7 && a > 0.3 ? [0.92, 0.62, 0.12] : u > 0.45 && a > 0.38 ? [0.94, 0.93, 0.9] : [0.06, 0.055, 0.05]; }, bill: billTo([0.5, 0.5, 0.46], [0.22, 0.2, 0.18], 0.7), leg: [0.07, 0.065, 0.065], eye: [0.2, 0.7, 0.55], tail: [0.05, 0.045, 0.045] },
  });
  return g;
};

// ---------------------------------------------------------------- water birds
// Great cormorant swimming: low in the water, only the back and the long snaky neck out of it, the hooked bill tipped up, the pouch yellow
export const GREAT_CORMORANT = () => {
  const neck = (t) => [0.2 + 0.18 * t + 0.04 * Math.sin(t * PI) + 0.03 * Math.sin(2 * PI * t), 0.06 + 0.3 * t, 0, 0.052 - 0.012 * t];
  const g = bird((m) => {
    m.body([[0.32, 0.012, 0.018, 0.05], [0.25, 0.058, 0.08, 0.05], [0.1, 0.09, 0.112, 0.04], [-0.08, 0.09, 0.112, 0.04], [-0.26, 0.058, 0.07, 0.04], [-0.5, 0.01, 0.032, 0.035]], { NR: 14, NS: 12, belly: 0.8 });
    m.tube(neck, 10, 10, 2);
    m.tube((t) => [0.37 + 0.12 * t, 0.36 + 0.03 * t, 0, 0.014 + 0.036 * Math.pow(Math.sin(PI * (0.12 + 0.86 * t)), 0.6)], 7, 10, 2);                         // the head, flat-crowned
    m.tube((t) => [0.43 + 0.04 * t, 0.345 + 0.004 * t, 0, 0.026 * Math.sin(PI * t) * (t > 0.0 ? 1 : 0)], 4, 8, 4);                                          // the yellow skin about the face
    m.tube((t) => [0.47 + 0.115 * t, 0.37 + 0.03 * t - 0.04 * t * t * t * 2, 0, 0.0145 - 0.0095 * t], 8, 7, 3);                                                // the stout bill, hooked at the tip
    m.tube((t) => [0.4 + 0.07 * t, 0.335 - 0.012 * t, 0, 0.012 + 0.014 * Math.sin(PI * t)], 5, 8, 5);                                                         // white chin
    m.leaf([-0.4, 0.04, 0], [-1, 0.0, 0], [0, 0, 1], 0.22, 0.065, { part: 1, flex: () => 0, ns: 6, nt: 4 });                                                 // the stiff tail on the water
    for (const sd of [-1, 1]) { m.tube((t) => [0.457 + 0.004 * t, 0.378, sd * 0.034, 0.0065 * Math.sin(PI * t)], 3, 6, 6); m.leaf([0.1, 0.1, sd * 0.1], [-1, 0.0, sd * 0.1], [0, -0.6, sd * 0.5], 0.42, 0.075, { part: 1, flex: () => 0, ns: 8, nt: 4, tip: 0.6 }); }                                      // the green eyes
  }, [(u, v) => mx(spot([0.04, 0.04, 0.045], [0.24, 0.18, 0.1], 22, 10, 1.0)(u, v), [0.04, 0.04, 0.045], sm(0.45, 0.65, v)), [0.05, 0.045, 0.045], [0.05, 0.045, 0.05], billTo([0.5, 0.5, 0.46], [0.2, 0.18, 0.16], 0.7), [0.9, 0.62, 0.12], [0.93, 0.92, 0.88], [0.1, 0.6, 0.5]], [1, 2, 1, 3, 3, 3, 3]);
  g.scale(0.95, 0.95, 0.95); g.translate(0, 0.11, 0); return g;
};
// Black swan swimming: all black but the white flight feathers that show when the wings are folded, the back feathers curled up over the rump,
// a very long S-curved neck, and a red bill with a white band near the tip
export const BLACK_SWAN = () => {
  const neck = (t) => [0.22 + 0.2 * Math.sin(t * PI * 1.0) + 0.04 * Math.sin(t * PI * 3) - 0.06 * t, 0.12 + 0.72 * t, 0, 0.06 - 0.034 * t];
  const g = bird((m) => {
    m.body([[0.32, 0.03, 0.06, 0.06], [0.25, 0.09, 0.11, 0.062], [0.1, 0.125, 0.15, 0.062], [-0.08, 0.13, 0.16, 0.066], [-0.24, 0.105, 0.125, 0.085], [-0.36, 0.06, 0.07, 0.118], [-0.43, 0.012, 0.022, 0.15]], { NR: 16, NS: 14, belly: 0.75 });
    m.tube(neck, 14, 10, 2);
    m.tube((t) => [0.205 + 0.075 * t, 0.84 - 0.01 * t, 0, 0.012 + 0.03 * Math.pow(Math.sin(PI * (0.12 + 0.86 * t)), 0.6)], 7, 10, 2);                          // the head
    m.tube((t) => [0.28 + 0.1 * t, 0.835 - 0.04 * t, 0, 0.0185 - 0.01 * t], 8, 8, 3);                                                                         // the bill, red, white-banded, black-nailed
    for (const sd of [-1, 1]) {
      m.tube((t) => [0.252 + 0.004 * t, 0.848, sd * 0.03, 0.0065 * Math.sin(PI * t)], 3, 6, 5);                                                              // the red eye
      m.leaf([0.12, 0.13, sd * 0.13], [-1, 0.06, sd * 0.1], [0, -0.7, sd * 0.7], 0.34, 0.06, { part: 1, flex: () => 0, ns: 10, nt: 4, tip: 0.65, curl: [0, -0.04, sd * -0.04] });          // the folded wing: white flight feathers along the flank
      m.leaf([-0.06, 0.2, sd * 0.07], [-1, 0.1, sd * 0.05], [0, -0.6, sd * 0.2], 0.16, 0.045, { part: 0, flex: () => 0, ns: 8, nt: 4, tip: 0.8, curl: [-0.02, 0.12, sd * 0.05] });         // the curled back feathers
    }
    m.leaf([-0.4, 0.14, 0], [-1, 0.2, 0], [0, 0, 1], 0.14, 0.05, { part: 0, flex: () => 0, ns: 5, nt: 4 });
  }, [(u, v) => mx([0.05, 0.045, 0.05], [0.14, 0.12, 0.11], 0.7 * sm(0.4, 0.9, hs(Math.floor(u * 18), Math.floor(v * 10)))), (u, v) => mx([0.07, 0.065, 0.065], [0.92, 0.9, 0.86], sm(0.5, 0.75, v) * (1 - sm(0.85, 1.0, v))), [0.05, 0.045, 0.05], (u, v) => (u > 0.8 ? [0.05, 0.05, 0.05] : u > 0.68 ? [0.95, 0.94, 0.9] : [0.82, 0.16, 0.1]), null, [0.72, 0.1, 0.08]], [1, 2, 1, 3, 3, 3]);
  g.translate(0, 0.045, 0); return g;
};

// ---------------------------------------------------------------- flocks of birds on foot
// Birds that stand and pace on the sand: list is [x, z, heading, random] for each. o: scale, pace (metres each way), see (how far off they are drawn),
// night (1: out at night too, a stone-curlew), step (how fast they walk). They stay on dry sand: when the tide covers it they are gone.
const BIRD_FS = /* glsl */`varying vec3 vCol, vW, vLight, vFx; ${FEATHER_GLSL} void main(){ ${LOGF} vec3 c = featherPaint(vCol, vFx); gl_FragColor = vec4(applyFog(c * vLight, vW), 1.0); }`;
export function walkers(scene, geo, list, o) {
  if (!list.length) return null;
  spotWalk(o.name, list);
  const geoOf = (part) => { const g = new THREE.InstancedBufferGeometry(); g.index = geo.index; for (const k of ['position', 'normal', 'color', 'aFx']) g.setAttribute(k, geo.attributes[k]);
    g.setAttribute('iP', new THREE.InstancedBufferAttribute(new Float32Array(part), 4)); g.instanceCount = part.length / 4; g.boundingSphere = FAR; return g; };
  const mat = makeMat({
    side: THREE.DoubleSide, uniforms: { uK: { value: new THREE.Vector4(o.scale || 1, o.pace ?? 3, o.step ?? 0.23, o.night ? 1 : 0) } },
    vs: /* glsl */`
      attribute vec3 color, aFx; attribute vec4 iP; uniform vec4 uK; varying vec3 vCol, vW, vLight, vFx;
      void main(){
        float ca = cos(iP.z), sa = sin(iP.z), ph = uTime * uK.z + iP.w * 40.0, walk = sin(ph), turn = cos(ph);
        vec2 dir = vec2(ca, -sa) * (turn < 0.0 ? -1.0 : 1.0);                                     // it turns round at each end of its beat
        vec2 xz = iP.xy + vec2(ca, -sa) * walk * uK.y * (0.5 + iP.w);
        float sz = uK.x * (0.92 + 0.16 * fract(iP.w * 7.0));
        vec3 lp = position * sz; lp.y += abs(sin(uTime * 6.0 + iP.w * 9.0)) * 0.012 * sz * step(0.12, position.x) * step(0.01, uK.y);          // the head bobs as it walks
        lp.y += sin(uTime * 0.8 + iP.w * 30.0) * 0.004 * sz;
        vec3 wp = vec3(xz.x + dir.x * lp.x - dir.y * lp.z, groundY(xz) + lp.y, xz.y + dir.y * lp.x + dir.x * lp.z);
        vec3 nw = normalize(vec3(dir.x * normal.x - dir.y * normal.z, normal.y, dir.y * normal.x + dir.x * normal.z));
        float day = mix(1.0 - smoothstep(0.6, 0.9, uNight), 1.0, uK.w);
        float ok = step(uSeaM * uVex - 0.08, groundY(xz)) * day * (1.0 - smoothstep(${(o.see || 600).toFixed(1)} * 0.7, ${(o.see || 600).toFixed(1)}, length(wp - cameraPosition)));
        vCol = color; vFx = aFx; vLight = uLightCol * (0.12 + 0.75 * max(dot(nw, uLightDir), 0.0)) * cloudShadow(wp) + uAmbSky * (0.6 + 0.4 * nw.y); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: BIRD_FS,
  });
  // (a long list is cut up by where on the island the birds are: each part is its own draw, made only when the viewer is near it)
  let first = null;
  for (const part of (list.length > 600 ? byPlace(list, 4, 900) : [list])) {
    const m = new THREE.Mesh(geoOf(part), mat); m.name = o.name || 'walkers'; m.frustumCulled = false; scene.add(m); nearOnly(m, part, 4, o.see || 600, 14); first = first || m;
  }
  return first;
}

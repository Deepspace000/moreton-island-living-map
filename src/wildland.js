// More of Moreton's land animals: ten reptiles (eastern water dragon, major skink, land mullet, garden skink, Burton's legless lizard, carpet
// python, green tree snake, red-bellied black snake, yellow-faced whipsnake, eastern long-necked turtle) and the mammals (northern brown and long-nosed
// bandicoots, common brushtail and common ringtail possums, water rat, grey-headed flying-fox and a small bat). Each is a lofted body (smooth cross-sections
// along a curve, like the wallaby and the goanna in bodies.js) with a skin or coat worked out per pixel from where on the body the pixel is.
import * as THREE from 'three';
import { spotCritter } from './spot.js';
import { Loft } from './bodies.js';
import { bird } from './creatures.js';
import { makeMat, nearOnly, LOGV, LOGF } from './common.js';

const PI = Math.PI, FAR = new THREE.Sphere(new THREE.Vector3(), 1e6);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hs = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const UP = [0, 0, 1];

// ---------------------------------------------------------------- lizards
// One generator for the lizards: x forward, y up. L is snout to vent, T the tail, h the height of the belly, g the half width and half depth of the trunk,
// hd the head [length, half width, half depth], raise how far the head and shoulders are lifted, leg [length of the limb, how thick], tail [flat (side to side
// compression, 1 round), how fast it tapers].
function lizard(s) {
  const m = new Loft(), L = s.L, T = s.T, h = s.h, [gw, gd] = s.g, [hl, hw, hdp] = s.hd, r = s.raise || 0, tf = s.tail ? s.tail[0] : 1, tp = s.tail ? s.tail[1] : 1;
  const st = [[0.5 * L, h + r * 0.85, 0, hw * 0.28, hdp * 0.3], [0.5 * L - hl * 0.12, h + r * 0.88, 0, hw * 0.72, hdp * 0.62], [0.5 * L - hl * 0.5, h + r * 0.9, 0, hw, hdp], [0.5 * L - hl, h + r * 0.85, 0, hw * 0.92, hdp * 0.98],
    [0.5 * L - hl * 1.35, h + r * 0.74, 0, (hw + gw) * 0.5 * 0.66, (hdp + gd) * 0.5 * 0.8], [0.24 * L, h + r * 0.4, 0, gw * 0.92, gd * 0.98], [0.06 * L, h + r * 0.12, 0, gw, gd], [-0.16 * L, h + r * 0.02, 0, gw * 0.98, gd * 0.96], [-0.36 * L, h, 0, gw * 0.92, gd * 0.94], [-0.5 * L, h * 0.9, 0, gw * 0.7 * tf, gd * 0.82]];
  for (let i = 1; i <= 5; i++) { const f = i / 5, k = Math.pow(1 - f, 1.0 / tp * 1.1); st.push([-0.5 * L - T * f, Math.max(0.006, h * 0.8 * (1 - f * 0.78)), s.tailSway ? Math.sin(f * 3.2) * T * 0.05 : 0, Math.max(0.002, gw * 0.7 * tf * k), Math.max(0.002, gd * 0.8 * k)]); }
  m.limb(st, 0, { S: 14, sub: 3, ref: UP });
  const [ll, lt] = s.leg;
  for (const [x, sg, hind] of [[0.22 * L, 1, 0], [0.22 * L, -1, 0], [-0.34 * L, 1, 1], [-0.34 * L, -1, 1]]) {
    const d = hind ? -1 : 1, hh = h * (hind ? 0.95 : 0.9), q = hind ? 1.15 : 1;
    m.limb([[x, hh, gw * 0.6 * sg, lt * 1.2, lt * 1.1], [x + d * 0.02, hh * 1.05, (gw + ll * 0.32) * sg, lt, lt * 0.9], [x + d * ll * 0.2 * (hind ? -1.4 : 1), hh * 0.34, (gw + ll * 0.6 * q) * sg, lt * 0.72, lt * 0.62], [x + d * ll * 0.4 * (hind ? 0.2 : 1), 0.012 + lt * 0.4, (gw + ll * 0.7 * q) * sg, lt * 0.8, lt * 0.38], [x + d * ll * (hind ? -0.55 : 0.7), 0.005, (gw + ll * 0.78 * q) * sg, lt * 0.5, 0.004]], 2, { S: 8, sub: 3, ref: [1, 0, 0] });
    if (s.toes) for (const a of [-0.35, 0, 0.35]) m.limb([[x + d * ll * (hind ? -0.2 : 0.4), 0.008, (gw + ll * 0.72 * q) * sg, lt * 0.18, 0.005], [x + d * ll * (hind ? -0.2 : 0.4) + d * ll * 0.5 * Math.cos(a) * (hind ? -1 : 1), 0.005, (gw + ll * 0.72 * q) * sg + sg * ll * 0.5 * Math.sin(a), lt * 0.1, 0.003]], 2, { S: 5, sub: 2, ref: [1, 0, 0] });
  }
  return m;
}
// Eastern water dragon: slim, raised on its forelegs, a long laterally flattened tail, long toes, a head with a small crest and a bold dark stripe through the eye
export const WATER_DRAGON = () => { const m = lizard({ L: 0.4, T: 0.62, h: 0.1, g: [0.038, 0.046], hd: [0.09, 0.03, 0.027], raise: 0.085, leg: [0.12, 0.021], tail: [0.55, 0.8], toes: 1, tailSway: 1 });
  m.limb([[0.2, 0.19, 0, 0.005, 0.02], [0.1, 0.178, 0, 0.007, 0.024], [-0.02, 0.152, 0, 0.007, 0.022], [-0.2, 0.13, 0, 0.006, 0.018], [-0.3, 0.108, 0, 0.004, 0.012]], 5, { S: 4, sub: 3, ref: [1, 0, 0] }); return m; };       // the low crest down the neck and back
// Major skink (Bellatorias frerei): a glossy, stout bronze skink with short legs and a thick tail that tapers to a point
export const MAJOR_SKINK = () => lizard({ L: 0.24, T: 0.26, h: 0.037, g: [0.038, 0.032], hd: [0.06, 0.026, 0.02], raise: 0.012, leg: [0.075, 0.015], tail: [1.0, 0.9], toes: 1 });
// Land mullet (Bellatorias major): the biggest skink, heavy and wide-headed, a thick tail
export const LAND_MULLET = () => lizard({ L: 0.34, T: 0.34, h: 0.055, g: [0.058, 0.05], hd: [0.08, 0.04, 0.032], raise: 0.012, leg: [0.1, 0.023], tail: [1.0, 0.8], toes: 1 });
// Garden skink: a quarter of a hand long, slim, with a pointed snout and a long thin tail
export const GARDEN_SKINK = () => lizard({ L: 0.045, T: 0.06, h: 0.007, g: [0.0075, 0.0065], hd: [0.014, 0.0055, 0.0045], raise: 0.002, leg: [0.009, 0.003], tail: [1.0, 1.3] });
// Burton's legless lizard: a snake in all but its little flaps for hind limbs, with a very long pointed snout
function snake(s) {
  const m = new Loft(), L = s.L, g = s.g, n = s.n || 16, st = [];
  const w = (f) => (f < 0.07 ? s.head[0] + (s.head[1] - s.head[0]) * sm(0, 0.07, f) : f < 0.13 ? s.head[1] + (g * 0.38 - s.head[1]) * sm(0.07, 0.13, f) : f < 0.38 ? g * 0.38 + g * 0.62 * sm(0.2, 0.38, f) : g * (f < 0.78 ? 1 : Math.pow(1 - (f - 0.78) / 0.22, 0.85)));
  for (let i = 0; i <= n; i++) { const f = i / n, x = L * 0.5 - L * f, cur = s.rest ? Math.sin(f * s.rest + 0.6 * Math.sin(f * 7)) * s.restW * (0.6 + 0.5 * Math.sin(f * 3.7 + 1)) : 0, r = Math.max(0.0015, w(f) * (f < 0.1 ? 1 : 1)); st.push([x, s.h + r * 0.9 + (f < 0.1 ? s.headUp * (0.1 - f) * 10 : 0), cur, r * (f < 0.1 ? s.headW : 1), r * (f < 0.1 ? s.headD : s.flat || 0.92)]); }
  m.limb(st, 0, { S: 14, sub: 3, ref: UP });
  return m;
}
export const LEGLESS = () => { const m = snake({ rest: 8, restW: 0.03, L: 0.5, g: 0.012, h: 0.0, head: [0.0035, 0.0085], n: 18, headUp: 0.0, headW: 1.6, headD: 0.7, flat: 0.88 });
  for (const sg of [-1, 1]) m.limb([[-0.14, 0.003, 0.006 * sg, 0.0015, 0.0015], [-0.16, 0.003, 0.014 * sg, 0.0035, 0.0012], [-0.175, 0.003, 0.018 * sg, 0.002, 0.001]], 2, { S: 5, sub: 2, ref: [1, 0, 0] }); return m; };
// Carpet python: heavy-bodied, a flat triangular head clear of the neck, a long thick tail, laid in S-bends
export const CARPET_PYTHON = () => snake({ rest: 9.4, restW: 0.18, L: 1.9, g: 0.044, h: 0.0, head: [0.016, 0.052], n: 34, headUp: 0.02, headW: 1.6, headD: 0.62, flat: 0.9 });
export const GREEN_TREE_SNAKE = () => snake({ rest: 12.5, restW: 0.1, L: 1.15, g: 0.0125, h: 0.0, head: [0.007, 0.011], n: 30, headUp: 0.012, headW: 1.6, headD: 0.7, flat: 0.95 });
export const BLACK_SNAKE = () => snake({ rest: 12.5, restW: 0.12, L: 1.45, g: 0.0235, h: 0.0, head: [0.011, 0.021], n: 30, headUp: 0.0, headW: 1.1, headD: 0.85, flat: 0.92 });
export const WHIPSNAKE = () => snake({ rest: 12.5, restW: 0.08, L: 0.85, g: 0.0095, h: 0.0, head: [0.0055, 0.0085], n: 26, headUp: 0.012, headW: 1.6, headD: 0.7, flat: 0.95 });

// Eastern long-necked turtle: a flat oval shell, a very long neck, a small head with a pale chin, paddle feet; swims at the surface of the lakes
export const LONGNECK_TURTLE = () => {
  const m = new Loft();
  m.limb([[0.2, 0.02, 0, 0.04, 0.03], [0.16, 0.05, 0, 0.09, 0.07], [0.06, 0.07, 0, 0.125, 0.085], [-0.06, 0.07, 0, 0.13, 0.085], [-0.16, 0.05, 0, 0.1, 0.07], [-0.21, 0.022, 0, 0.045, 0.03]], 0, { S: 18, sub: 3, ref: UP });                  // the shell: a domed oval, narrow at the front
  m.limb([[0.19, 0.05, 0, 0.028, 0.028], [0.25, 0.08, 0, 0.022, 0.022], [0.3, 0.105, 0, 0.02, 0.02], [0.36, 0.09, 0, 0.019, 0.019], [0.4, 0.078, 0, 0.02, 0.019], [0.44, 0.066, 0, 0.0185, 0.014], [0.475, 0.062, 0, 0.006, 0.006]], 3, { S: 10, sub: 3, ref: UP });   // the long S of the neck, the head and beak
  for (const sg of [-1, 1]) {
    m.limb([[0.12, 0.026, 0.07 * sg, 0.03, 0.022], [0.15, 0.02, 0.1 * sg, 0.026, 0.016], [0.18, 0.012, 0.135 * sg, 0.04, 0.009], [0.21, 0.008, 0.16 * sg, 0.052, 0.006]], 2, { S: 8, sub: 3, ref: [1, 0, 0] });
    m.limb([[-0.12, 0.02, 0.08 * sg, 0.028, 0.014], [-0.16, 0.01, 0.115 * sg, 0.036, 0.009], [-0.19, 0.008, 0.135 * sg, 0.024, 0.006]], 2, { S: 8, sub: 3, ref: [1, 0, 0] });
  }
  m.limb([[-0.2, 0.02, 0, 0.012, 0.012], [-0.26, 0.015, 0, 0.005, 0.005]], 3, { S: 5, sub: 2, ref: UP });
  return m;
};

// ---------------------------------------------------------------- mammals
// Quadruped generator: x forward, y up. Parts: 0 body, 1 forelimbs, 2 hind limbs, 3 tail, 4 head, ears and snout.
function furry(s) {
  const m = new Loft(), L = s.L, h = s.h, [bw, bd] = s.g, hl = s.head[0];
  m.limb([[-0.5 * L, h * 0.95, 0, bw * 0.55, bd * 0.62], [-0.38 * L, h * 1.05, 0, bw * 0.9, bd * 0.95], [-0.12 * L, h * 1.08 + s.hump, 0, bw, bd], [0.14 * L, h * 1.03, 0, bw * 0.9, bd * 0.92], [0.34 * L, h * 1.04 + s.lift * 0.3, 0, bw * 0.68, bd * 0.76]], 0, { S: 14, sub: 3, ref: UP });                    // rump, back, chest
  m.limb([[0.24 * L, h * 1.04 + s.lift * 0.15, 0, bw * 0.84, bd * 0.9], [0.38 * L, h * 1.03 + s.lift * 0.4, 0, bw * 0.6, bd * 0.68], [0.5 * L, h * 1.04 + s.lift * 0.75, 0, s.head[1] * 1.0, s.head[2] * 1.02], [0.5 * L + hl * 0.55, h * 1.0 + s.lift, 0, s.head[1] * 0.76, s.head[2] * 0.8], [0.5 * L + hl, h * 0.96 + s.lift * 0.9, 0, s.head[1] * 0.28, s.head[2] * 0.3], [0.5 * L + hl * 1.08, h * 0.95 + s.lift * 0.85, 0, s.head[1] * 0.1, s.head[2] * 0.12]], 4, { S: 12, sub: 3, ref: UP });     // neck, head, snout
  const tl = s.tail, tr = s.tailR;
  m.limb(s.tailPts || [[-0.46 * L, h * 0.95, 0, tr, tr], [-0.5 * L - tl * 0.35, h * 0.8, 0, tr * 0.9, tr * 0.9], [-0.5 * L - tl * 0.7, h * 0.5, 0, tr * 0.75, tr * 0.75], [-0.5 * L - tl, h * 0.28, 0, tr * 0.4, tr * 0.4]], 3, { S: 10, sub: 3, ref: UP });
  for (const sg of [-1, 1]) {
    const z = bw * 0.78 * sg, fl = s.leg;
    m.limb([[0.26 * L, h * 0.9, z, bw * 0.4, bd * 0.44], [0.24 * L, h * 0.62, z * 1.08, bw * 0.27, bd * 0.3], [0.28 * L, h * 0.3, z * 1.08, bw * 0.2, bd * 0.2], [0.3 * L + 0.02, 0.012, z * 1.08, bw * 0.32, 0.012], [0.3 * L + 0.065, 0.007, z * 1.08, bw * 0.18, 0.007]], 1, { S: 12, sub: 8, ref: [1, 0, 0] });                     // forelimb
    m.limb([[-0.28 * L, h * 0.95, z * 1.05, bw * 0.8, bd * 0.8], [-0.24 * L, h * 0.5, z * 1.08, bw * 0.34, bd * 0.36], [-0.3 * L, h * 0.15, z * 1.08, bw * 0.17, bd * 0.12], [-0.2 * L, 0.01, z * 1.08, bw * 0.3, 0.014]], 2, { S: 12, sub: 8, ref: [1, 0, 0] });    // thigh, shin, hock, long foot
    m.limb([[0.5 * L + hl * 0.12, h * 1.06 + s.lift * 0.95, 0.03 * sg, s.ear[0], s.ear[1]], [0.5 * L + hl * 0.1, h * 1.06 + s.lift * 0.95 + s.ear[2], 0.05 * sg, s.ear[0] * 0.9, s.ear[1] * 0.5], [0.5 * L + hl * 0.06, h * 1.06 + s.lift * 0.95 + s.ear[2] * 1.7, 0.055 * sg, s.ear[0] * 0.3, s.ear[1] * 0.25]], 4, { S: 8, sub: 3, ref: [1, 0, 0] });      // an ear
  }
  return m;
}
// Northern brown bandicoot: a rounded, hunched, coarse-furred body, a short pointed snout, small round ears, a short tail
export const BANDICOOT = () => furry({ L: 0.36, h: 0.105, g: [0.065, 0.085], hump: 0.018, lift: 0.012, head: [0.12, 0.034, 0.038], leg: 0.1, tail: 0.13, tailR: 0.011, ear: [0.028, 0.012, 0.03] });
// Long-nosed bandicoot: leaner and longer, a very long narrow snout, big upright ears, a thin tail
export const LONGNOSE_BANDICOOT = () => furry({ L: 0.4, h: 0.11, g: [0.055, 0.078], hump: 0.025, lift: 0.014, head: [0.17, 0.03, 0.034], leg: 0.11, tail: 0.14, tailR: 0.008, ear: [0.036, 0.013, 0.05] });
// Common brushtail possum: a fox-like head, big pointed ears, a thick body, a bushy tail
export const BRUSHTAIL = () => furry({ L: 0.45, h: 0.12, g: [0.085, 0.1], hump: 0.01, lift: 0.04, head: [0.1, 0.04, 0.045], leg: 0.12, tail: 0.36, tailR: 0.032, ear: [0.036, 0.013, 0.055], tailPts: [[-0.46 * 0.45, 0.115, 0, 0.03, 0.03], [-0.5 * 0.45 - 0.1, 0.1, 0, 0.058, 0.058], [-0.5 * 0.45 - 0.22, 0.075, 0, 0.066, 0.066], [-0.5 * 0.45 - 0.32, 0.045, 0, 0.048, 0.048], [-0.5 * 0.45 - 0.38, 0.03, 0, 0.012, 0.012]] });
// Common ringtail possum: smaller, a rounded head with small ears, a long thin tail curled up, white at its tip
export const RINGTAIL = () => furry({ L: 0.3, h: 0.095, g: [0.052, 0.065], hump: 0.012, lift: 0.025, head: [0.075, 0.034, 0.036], leg: 0.09, tail: 0.3, tailR: 0.011, ear: [0.016, 0.007, 0.016], tailPts: [[-0.46 * 0.3, 0.09, 0, 0.012, 0.012], [-0.5 * 0.3 - 0.08, 0.09, 0, 0.011, 0.011], [-0.5 * 0.3 - 0.17, 0.12, 0, 0.0095, 0.0095], [-0.5 * 0.3 - 0.2, 0.17, 0, 0.0085, 0.0085], [-0.5 * 0.3 - 0.17, 0.2, 0, 0.0075, 0.0075], [-0.5 * 0.3 - 0.12, 0.185, 0, 0.0035, 0.0035]] });
// Water rat: long and low and dark, a blunt head with small ears and white whiskers, the thick tail tipped white
export const WATER_RAT = () => furry({ L: 0.3, h: 0.06, g: [0.045, 0.05], hump: 0.006, lift: 0.006, head: [0.09, 0.034, 0.034], leg: 0.06, tail: 0.28, tailR: 0.011, ear: [0.011, 0.0035, 0.012] });

// ---------------------------------------------------------------- bats
// Grey-headed flying-fox: a fox-like head, a dark furred body with a russet collar, and wings of membrane stretched between the long finger bones.
// FLYINGFOX_FLY is the body, FLYINGFOX_WING one wing hinged at the shoulder reaching out along +z (like the raptors in wildbirds.js).
export const FLYINGFOX_FLY = () => bird((m) => {
  m.body([[0.2, 0.012, 0.016, 0], [0.15, 0.05, 0.045, 0.002], [0.05, 0.075, 0.07, 0.004], [-0.08, 0.07, 0.066, 0.002], [-0.2, 0.04, 0.042, -0.004], [-0.27, 0.01, 0.014, -0.008]], { NR: 12, NS: 12 });
  m.tube((t) => [0.16 + 0.1 * t, 0.045 + 0.006 * Math.sin(PI * t), 0, 0.012 + 0.034 * Math.pow(Math.sin(PI * (0.1 + 0.82 * t)), 0.7)], 8, 12, 2);               // the head
  m.tube((t) => [0.255 + 0.07 * t, 0.045 - 0.01 * t, 0, 0.022 - 0.017 * t], 6, 10, 2);                                                                       // the muzzle
  for (const sg of [-1, 1]) {
    m.tube((t) => [0.22 + 0.004 * t, 0.06, sg * 0.036, 0.0085 * Math.sin(PI * t)], 3, 6, 4);                                                                 // an eye
    m.leaf([0.2, 0.082, 0.02 * sg], [0.06, 1, 0.5 * sg], [1, 0, 0], 0.07, 0.011, { part: 2, flex: () => 0, ns: 6, nt: 3, tip: 0.8 });                            // an ear
    m.tube((t) => [-0.12 - 0.07 * t, -0.07, sg * 0.03, 0.017 - 0.006 * t], 4, 6, 3);                                                                          // the feet
  }
}, [(u, v) => mx([0.1, 0.085, 0.075], [0.3, 0.26, 0.24], 0.7 * sm(0.5, 0.9, v)), null, [0.16, 0.13, 0.11], [0.12, 0.1, 0.09], [0.03, 0.02, 0.02]], [3, 3, 3, 3, 3]);
export const FLYINGFOX_WING = () => {
  const L = 0.78, C0 = 0.2, n = 4, s0 = 0.42;
  const P = (t, sp, dy) => {
    let c = C0 * (1 - 0.35 * sp), u = sp;
    if (sp > s0) { const h = (sp - s0) / (1 - s0), q = h * n, f = q - Math.floor(q); c = C0 * (1 - 0.35 * s0) * (1 - 0.35 * h) * (0.5 + 0.5 * Math.pow(1 - Math.sin(PI * Math.min(0.999, f)), 0.9)) + 0.04; }
    c *= Math.sqrt(Math.max(0, 1 - Math.pow(sp, 16)));
    const arm = sp < s0 ? sp / s0 : 1, wy = 0.2 * Math.sin(PI * Math.min(1, sp / 0.5)) * 0.5 - 0.1 * Math.max(0, sp - s0);
    return [0.02 - 0.14 * sp * sp - t * c, dy + wy, 0.02 + L * sp];
  };
  return bird((m) => {
    for (const [dy, part] of [[0.003, 0], [-0.003, 1]]) m.surf(6, 56, (t, sp) => P(t, sp, dy), part, () => 0);
    m.limb && 0;
  }, [(u, v) => { const h = (v - 0.42) / 0.58, f = h * 4 - Math.floor(h * 4), rib = v > 0.42 ? 1 - sm(0.02, 0.07, Math.min(f, 1 - f)) : 0, edge = 1 - sm(0.0, 0.1, u); return mx(mx([0.13, 0.1, 0.1], [0.07, 0.05, 0.05], rib), [0.06, 0.05, 0.05], edge); }, (u, v) => { const h = (v - 0.42) / 0.58, f = h * 4 - Math.floor(h * 4), rib = v > 0.42 ? 1 - sm(0.02, 0.07, Math.min(f, 1 - f)) : 0; return mx([0.15, 0.12, 0.11], [0.07, 0.05, 0.05], rib); }], [3, 3]);
};
// A small insect-eating bat: just a dark flutter with a body the size of a thumb
export const MICROBAT_FLY = () => bird((m) => { m.body([[0.1, 0.008, 0.01, 0], [0.07, 0.025, 0.022, 0], [0.0, 0.034, 0.03, 0], [-0.07, 0.02, 0.02, -0.002], [-0.12, 0.005, 0.008, -0.004]], { NR: 8, NS: 8 }); m.leaf([0.1, 0.03, 0.0], [0.2, 1, 0.7], [1, 0, 0], 0.03, 0.007, { part: 0, flex: () => 0, ns: 3, nt: 2 }); }, [[0.1, 0.085, 0.075]], [3]);
export const MICROBAT_WING = () => {
  const L = 0.2, C0 = 0.09;
  const P = (t, sp, dy) => { const c = C0 * (1 - 0.5 * sp) * (0.8 + 0.2 * Math.pow(1 - Math.sin(PI * Math.min(0.999, (sp * 4) % 1)), 0.8)) * Math.sqrt(Math.max(0, 1 - Math.pow(sp, 10))); return [0.01 - 0.04 * sp - t * c, dy, 0.012 + L * sp]; };
  return bird((m) => { for (const [dy, part] of [[0.001, 0], [-0.001, 0]]) m.surf(4, 20, (t, sp) => P(t, sp, dy), part, () => 0); }, [[0.1, 0.085, 0.078]], [3]);
};

// ---------------------------------------------------------------- skins and coats
// GLSL run for each pixel: p is the point on the body (model space), vK the part, vNo the normal, vH four random numbers for this animal, c the colour so far.
const SCALES = (k) => `float under = 1.0 - smoothstep(-0.8, -0.3, normalize(vNo).y), a = atan(p.z, p.y - 0.04); vec2 sc = vec2(p.x * ${k}.0, a * ${Math.round(k / 11)}.0); float scale = 0.82 + 0.2 * smoothstep(0.1, 0.4, abs(fract(sc.x + step(0.5, fract(sc.y * 0.5)) * 0.5) - 0.5)) * smoothstep(0.1, 0.4, abs(fract(sc.y) - 0.5));`;
const F = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const EYE = (x, y, z, r) => `c = mix(c, vec3(0.02), 1.0 - smoothstep(${(r * 0.7).toFixed(4)}, ${r.toFixed(4)}, length(vec3(p.x - ${F(x)}, p.y - ${F(y)}, abs(p.z) - ${F(z)}))));`;
export const WILD_PAINT = {
  // water dragon: olive-grey with dark bars across the back and tail, a black stripe through the eye, a pale throat and an orange-flushed chest
  waterdragon: `{ vec3 p = vObj; ${SCALES(150)} float bar = smoothstep(0.34, 0.46, abs(fract(p.x * 7.0 + vH.y) - 0.5)) * (1.0 - under);
    c = mix(vec3(0.36, 0.38, 0.22), vec3(0.14, 0.16, 0.1), bar * 0.8); c = mix(c, vec3(0.5, 0.52, 0.34), smoothstep(0.35, 0.0, abs(p.y - 0.17)) * 0.0);
    c = mix(c, vec3(0.74, 0.7, 0.5), under * 0.8); c = mix(c, vec3(0.78, 0.34, 0.12), under * smoothstep(0.12, 0.02, abs(p.x - 0.1)) * 0.6 * step(0.5, vH.z));
    c = mix(c, vec3(0.05, 0.05, 0.04), (1.0 - smoothstep(0.0, 0.007, abs(p.y - 0.19 - (p.x - 0.12) * 0.06))) * step(0.1, p.x) * step(p.x, 0.215) * 0.9);
    if(vK > 4.5) c = vec3(0.3, 0.32, 0.2); if(vK > 1.5 && vK < 2.5) c = mix(c, vec3(0.2, 0.2, 0.12), 0.5); ${EYE(0.19, 0.188, 0.024, 0.008)} c *= scale; }`,
  // major skink: bronze-brown, glossy, a dark band down each side edged with cream, a pale belly
  majorskink: `{ vec3 p = vObj; ${SCALES(220)} c = mix(vec3(0.42, 0.28, 0.14), vec3(0.3, 0.2, 0.1), smoothstep(0.0, 0.03, p.y - 0.04));
    float side = smoothstep(0.014, 0.0, abs(p.y - 0.033 - (p.x - 0.1) * 0.01)) * smoothstep(0.07, 0.03, abs(p.z)) * (1.0 - under); c = mix(c, vec3(0.1, 0.07, 0.05), side * 0.8); c = mix(c, vec3(0.76, 0.68, 0.5), smoothstep(0.018, 0.0, abs(p.y - 0.047)) * 0.5 * smoothstep(-0.12, 0.02, p.x));
    c = mix(c, vec3(0.8, 0.72, 0.58), under * 0.85); ${EYE(0.1, 0.03, 0.014, 0.0045)} c *= (0.9 + 0.2 * scale); }`,
  // land mullet: near black to dark brown, the flanks mottled with orange-brown, cream spots, a stout pale-lipped head
  landmullet: `{ vec3 p = vObj; ${SCALES(160)} float mot = smoothstep(0.45, 0.8, texture2D(uNoise, vec2(p.x * 9.0, atan(p.z, p.y) * 1.4) + vH.x).r);
    c = mix(vec3(0.12, 0.09, 0.07), vec3(0.42, 0.22, 0.08), mot * smoothstep(0.1, 0.5, 1.0 - under) * 0.8); c = mix(c, vec3(0.62, 0.55, 0.38), step(0.86, texture2D(uNoise, vec2(p.x * 31.0, atan(p.z, p.y) * 4.0) + vH.y).g) * 0.7);
    c = mix(c, vec3(0.6, 0.52, 0.38), under * 0.8); ${EYE(0.16, 0.058, 0.03, 0.0065)} c *= scale; }`,
  // garden skink: bronze above with a thin dark band down each side, silver-cream below, glossy
  gardenskink: `{ vec3 p = vObj; c = vec3(0.36, 0.26, 0.14); float under = 1.0 - smoothstep(-0.6, -0.2, normalize(vNo).y); c = mix(c, vec3(0.08, 0.06, 0.04), smoothstep(0.003, 0.0, abs(p.y - 0.0075)) * (1.0 - under) * 0.9); c = mix(c, vec3(0.82, 0.8, 0.7), under * 0.9); ${EYE(0.02, 0.009, 0.0045, 0.0017)} }`,
  // Burton's legless lizard: pale grey-brown, dark lengthwise lines, a streaked head
  legless: `{ vec3 p = vObj; float a = atan(p.z, p.y); c = mix(vec3(0.5, 0.42, 0.32), vec3(0.22, 0.17, 0.12), smoothstep(0.7, 0.9, sin(a * 5.0 + 0.4)) * 0.8); c = mix(c, vec3(0.85, 0.8, 0.68), (1.0 - smoothstep(-0.8, -0.3, normalize(vNo).y)) * 0.85); c = mix(c, vec3(0.1, 0.08, 0.06), smoothstep(0.215, 0.235, p.x) * 0.3 * 0.0); ${EYE(0.2, 0.0, 0.0045, 0.002)} }`,
  // carpet python: cream and olive-brown in a broken lattice of blotches down the back, a pale belly, a dark-lined face
  python: `{ vec3 p = vObj; float a = atan(p.z, p.y), blot = smoothstep(0.1, 0.36, texture2D(uNoise, vec2(p.x * 5.0 + sin(a * 2.0) * 0.2, a * 0.5) + vH.x).r) * (1.0 - smoothstep(0.95, 1.5, abs(a)));
    c = mix(vec3(0.62, 0.55, 0.32), vec3(0.2, 0.18, 0.09), blot * 0.9); c = mix(c, vec3(0.8, 0.74, 0.5), smoothstep(0.6, 0.95, texture2D(uNoise, vec2(p.x * 7.0, a * 1.5) + vH.y).g) * 0.35); c = mix(c, vec3(0.86, 0.82, 0.66), smoothstep(1.8, 2.3, abs(a)));
    c *= 0.82 + 0.3 * smoothstep(0.2, 0.7, texture2D(uNoise, vec2(p.x * 80.0, a * 9.0)).r); c = mix(c, vec3(0.1, 0.08, 0.05), (1.0 - smoothstep(0.0, 0.004, abs(p.y - 0.0 - 0.0))) * 0.0); ${EYE(0.88, 0.011, 0.012, 0.0038)} }`,
  // green tree snake: olive-green above shading to yellow-green, a rich yellow belly, large eyes and a black line behind them
  treesnake: `{ vec3 p = vObj; float a = atan(p.z, p.y); c = mix(vec3(0.2, 0.34, 0.14), vec3(0.45, 0.5, 0.16), smoothstep(0.4, 1.6, abs(a))); c = mix(c, vec3(0.9, 0.82, 0.3), smoothstep(1.9, 2.5, abs(a)));
    c *= 0.88 + 0.22 * texture2D(uNoise, vec2(p.x * 160.0, a * 9.0)).r; c = mix(c, vec3(0.05, 0.05, 0.04), smoothstep(0.012, 0.004, abs(p.x - 0.5)) * 0.0); ${EYE(0.555, 0.0, 0.0085, 0.0034)} }`,
  // red-bellied black snake: glossy blue-black above, brick-red along the flanks and belly
  blacksnake: `{ vec3 p = vObj; float a = atan(p.z, p.y); c = vec3(0.03, 0.034, 0.042) + vec3(0.06, 0.08, 0.11) * smoothstep(0.8, 0.0, abs(a)); c = mix(c, vec3(0.62, 0.12, 0.08), smoothstep(1.25, 1.55, abs(a))); c = mix(c, vec3(0.75, 0.2, 0.14), smoothstep(2.1, 2.5, abs(a)) * 0.6);
    c = mix(c, c * 1.8 + 0.03, smoothstep(0.8, 1.0, texture2D(uNoise, vec2(p.x * 120.0, a * 9.0)).r) * 0.3); ${EYE(0.655, 0.0, 0.0105, 0.0035)} }`,
  // yellow-faced whipsnake: olive-brown with a pale ring about the eye and a dark comma behind it, a yellow-white belly
  whipsnake: `{ vec3 p = vObj; float a = atan(p.z, p.y); c = mix(vec3(0.34, 0.27, 0.15), vec3(0.5, 0.42, 0.22), smoothstep(0.3, 1.5, abs(a))); c = mix(c, vec3(0.86, 0.8, 0.5), smoothstep(1.9, 2.4, abs(a)));
    c = mix(c, vec3(0.9, 0.82, 0.4), smoothstep(0.035, 0.0, abs(p.x - 0.4)) * 0.0); c = mix(c, vec3(0.08, 0.06, 0.04), smoothstep(0.018, 0.0, length(vec2(p.x - 0.41, abs(p.z) - 0.0085))) * 0.7); ${EYE(0.425, 0.0, 0.0072, 0.0034)} c *= 0.9 + 0.15 * texture2D(uNoise, vec2(p.x * 140.0, a * 8.0)).r; }`,
  // eastern long-necked turtle: a brown-black shell with fine lines in the scutes and a pale rim; the neck grey above and white below
  turtle: `{ vec3 p = vObj; if(vK < 0.5){ vec2 q = vec2(p.x * 5.0, p.z * 5.0) + (texture2D(uNoise, p.xz * 2.5 + vH.x).rg - 0.5) * 0.3; vec2 f = fract(q) - 0.5; float seam = min(abs(f.x), abs(f.y)); c = mix(vec3(0.2, 0.15, 0.07), vec3(0.4, 0.3, 0.14), smoothstep(0.0, 0.2, seam) * (0.5 + 0.5 * texture2D(uNoise, p.xz * 6.0 + vH.x).r)); c = mix(c, vec3(0.5, 0.45, 0.3), (1.0 - smoothstep(-0.8, -0.2, normalize(vNo).y)) * 0.9); }
    else { c = mix(vec3(0.3, 0.32, 0.28), vec3(0.8, 0.78, 0.68), (1.0 - smoothstep(-0.7, -0.1, normalize(vNo).y)) * 0.8); if(vK > 2.5) c = mix(c, vec3(0.04, 0.04, 0.035), 1.0 - smoothstep(0.0045, 0.006, length(vec3(p.x - 0.445, p.y - 0.07, abs(p.z) - 0.0135)))); } }`,
};
// Fur: the coat is worked out from the grain of the noise along the body, so it looks combed in the direction the animal faces
const FUR = (f) => `float fur = texture2D(uNoise, vec2(p.x * 14.0 + p.y * 6.0 + ${f}.0, p.z * 14.0 + p.y * 9.0)).r * 0.6 + texture2D(uNoise, vec2(p.x * 7.0, p.z * 9.0 + p.y * 5.0)).g * 0.4, fine = texture2D(uNoise, vec2(p.x * 190.0, p.y * 170.0 + p.z * 150.0)).g, under = 1.0 - smoothstep(-0.7, -0.15, normalize(vNo).y), dorsal = smoothstep(0.7, 0.98, normalize(vNo).y);`;
WILD_PAINT.bandicoot = `{ vec3 p = vObj; ${FUR(5)} c = mix(vec3(0.3, 0.22, 0.14), vec3(0.45, 0.35, 0.22), fur); c = mix(c, vec3(0.7, 0.62, 0.5), under * 0.8 * (1.0 - step(2.5, vK) * 0.0)); c = mix(c, vec3(0.28, 0.26, 0.24), step(2.5, vK) * step(vK, 3.5)); if(vK > 3.5){ c = mix(c, vec3(0.5, 0.4, 0.28), 0.4 * smoothstep(0.18, 0.1, p.x)); c = mix(c, vec3(0.06, 0.04, 0.035), smoothstep(0.012, 0.009, length(vec3(p.x - 0.19, p.y - 0.13, abs(p.z) - 0.027)))); c = mix(c, vec3(0.05, 0.04, 0.04), smoothstep(0.268, 0.28, p.x)); } c = mix(c, c * 0.55, dorsal * 0.45); c *= (0.8 + 0.35 * fur) * (0.9 + 0.2 * fine); }`;
WILD_PAINT.longnose = `{ vec3 p = vObj; ${FUR(5)} c = mix(vec3(0.34, 0.3, 0.24), vec3(0.5, 0.45, 0.36), fur); c = mix(c, vec3(0.9, 0.86, 0.8), under * 0.9); c = mix(c, vec3(0.25, 0.22, 0.18), step(2.5, vK) * step(vK, 3.5)); if(vK > 3.5){ c = mix(c, vec3(0.1, 0.08, 0.07), smoothstep(0.012, 0.009, length(vec3(p.x - 0.215, p.y - 0.135, abs(p.z) - 0.025)))); c = mix(c, vec3(0.05, 0.04, 0.04), smoothstep(0.375, 0.395, p.x)); c = mix(c, vec3(0.4, 0.3, 0.26), 0.5 * step(0.18, abs(p.z)) * 0.0); } c = mix(c, c * 0.6, dorsal * 0.4); c *= (0.8 + 0.35 * fur) * (0.9 + 0.2 * fine); }`;
WILD_PAINT.brushtail = `{ vec3 p = vObj; ${FUR(4)} c = mix(vec3(0.5, 0.5, 0.47), vec3(0.66, 0.65, 0.6), fur); c = mix(c, vec3(0.88, 0.85, 0.78), under * 0.85); if(vK > 2.5 && vK < 3.5) c = mix(vec3(0.3, 0.28, 0.25), vec3(0.46, 0.43, 0.38), fur) * (1.0 - 0.45 * smoothstep(-0.55, -0.7, p.x)); if(vK > 3.5){ c = mix(c, vec3(0.8, 0.5, 0.45), 0.25 * smoothstep(0.015, 0.03, p.y - 0.2) * step(0.4, p.x)); c = mix(c, vec3(0.04, 0.03, 0.03), smoothstep(0.012, 0.008, length(vec3(p.x - 0.28, p.y - 0.18, abs(p.z) - 0.03)))); c = mix(c, vec3(0.05, 0.04, 0.04), smoothstep(0.31, 0.325, p.x)); } c = mix(c, c * 0.6, dorsal * 0.4); c *= (0.8 + 0.35 * fur) * (0.9 + 0.2 * fine); }`;
WILD_PAINT.ringtail = `{ vec3 p = vObj; ${FUR(5)} c = mix(vec3(0.24, 0.2, 0.17), vec3(0.4, 0.34, 0.28), fur); c = mix(c, vec3(0.72, 0.62, 0.5), under * 0.7); if(vK > 2.5 && vK < 3.5) c = mix(vec3(0.2, 0.17, 0.14), vec3(0.96, 0.95, 0.92), smoothstep(0.16, 0.18, p.y)); if(vK > 3.5){ c = mix(c, vec3(0.95, 0.93, 0.88), smoothstep(0.012, 0.0, abs(p.y - 0.165 - (p.x - 0.2) * 0.1)) * step(0.2, p.x) * 0.0); c = mix(c, vec3(0.03), smoothstep(0.011, 0.007, length(vec3(p.x - 0.2, p.y - 0.15, abs(p.z) - 0.03)))); c = mix(c, vec3(0.9, 0.9, 0.86), 0.9 * smoothstep(0.008, 0.002, length(vec3(p.x - 0.18, p.y - 0.165, abs(p.z) - 0.03)))); } c = mix(c, c * 0.6, dorsal * 0.4); c *= (0.8 + 0.35 * fur) * (0.9 + 0.2 * fine); }`;
WILD_PAINT.waterrat = `{ vec3 p = vObj; ${FUR(6)} c = mix(vec3(0.12, 0.1, 0.09), vec3(0.22, 0.18, 0.14), fur); c = mix(c, vec3(0.62, 0.52, 0.38), under * 0.8); if(vK > 2.5 && vK < 3.5) c = mix(vec3(0.1, 0.09, 0.08), vec3(0.95, 0.94, 0.9), smoothstep(-0.36, -0.46, p.x)); if(vK > 3.5){ c = mix(c, vec3(0.8, 0.78, 0.7), 0.4 * smoothstep(0.015, 0.03, abs(p.y - 0.075)) * step(0.3, p.x)); c = mix(c, vec3(0.03), smoothstep(0.011, 0.007, length(vec3(p.x - 0.16, p.y - 0.07, abs(p.z) - 0.028)))); c = mix(c, vec3(0.05), smoothstep(0.235, 0.245, p.x)); } c = mix(c, c * 0.6, dorsal * 0.4); c *= (0.8 + 0.35 * fur) * (0.9 + 0.2 * fine); }`;

// ---------------------------------------------------------------- how they are put on the map and made to move
// list: [x, z, heading, random, y] for each animal (y below -500: stand on the ground). o: scale, pace (how far it goes each way), step (speed of the beat), gait
// (0 rest, 1 slither, 2 walk with a hunched scurry, 3 swim), night (0 by day, 1 at night, 2 both), see (how far off it is drawn), water (a lake or a pool: no
// ground test), paint (GLSL). The same shader draws every kind: only the numbers and the paint change.
export function critters(scene, loft, list, o) {
  const n = list.length / 5; if (!n) return null;
  spotCritter(o.name, list);
  const g = new THREE.InstancedBufferGeometry(), P4 = new Float32Array(n * 4), Y = new Float32Array(n);
  for (let k = 0; k < n; k++) { P4.set(list.slice(k * 5, k * 5 + 4), k * 4); Y[k] = list[k * 5 + 4]; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(loft.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(loft.nrm, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(loft.part, 1)); g.setIndex(loft.idx);
  g.setAttribute('iP', new THREE.InstancedBufferAttribute(P4, 4)); g.setAttribute('iY', new THREE.InstancedBufferAttribute(Y, 1)); g.instanceCount = n; g.boundingSphere = FAR;
  const W = o.wave || [6, 0.03, 8], see = (o.see || 300).toFixed(1);
  const mat = makeMat({
    side: THREE.DoubleSide, uniforms: { uK: { value: new THREE.Vector4(o.scale || 1, o.pace ?? 2, o.step ?? 0.2, o.gait || 0) }, uN: { value: new THREE.Vector2(o.night ?? 0, o.water ? 1 : 0) }, uG: { value: new THREE.Vector3(W[0], W[1], W[2]) } },
    vs: /* glsl */`
      attribute float aK, iY; attribute vec4 iP; uniform vec4 uK; uniform vec2 uN; uniform vec3 uG; varying vec3 vCol, vW, vObj, vNo, vLight; varying float vK; varying vec4 vH;
      void main(){
        float ca = cos(iP.z), sa = sin(iP.z), ph = uTime * uK.z + iP.w * 40.0, walk = sin(ph), turn = cos(ph);
        float sz = uK.x * (0.88 + 0.24 * fract(iP.w * 7.0)), mv = uK.y > 0.01 ? smoothstep(0.12, 0.6, abs(turn)) : 0.0;      // it pauses at each end of its beat
        vec2 dir = vec2(ca, -sa) * (turn < 0.0 ? -1.0 : 1.0), xz = iP.xy + vec2(ca, -sa) * walk * uK.y * (0.5 + iP.w);
        vec3 lp = position * sz; float gait = uK.w, along = position.x;
        if(gait < 1.5 && gait > 0.5) lp.z += sin(along * uG.x - uTime * uG.z * (0.15 + mv) + iP.w * 30.0) * uG.y * (0.7 + 0.3 * mv) * sz;        // a snake pours itself along: an S-bend that travels down the body
        else if(gait > 1.5 && gait < 2.5){ lp.y += abs(sin(uTime * 9.0 + iP.w * 9.0)) * 0.035 * sz * mv; if(aK > 0.5 && aK < 2.5) lp.x += sin(uTime * 9.0 + position.z * 40.0 + along * 20.0) * 0.03 * sz * mv; lp.z += sin(along * 12.0 - uTime * 9.0) * 0.01 * sz * mv; }          // a scurry
        else if(gait > 3.5){ lp.z += sin(along * uG.x - uTime * uG.z * mv + iP.w * 30.0) * uG.y * (0.3 + 0.7 * mv) * (0.3 + abs(along)) * sz; if(aK > 1.5 && aK < 2.5) lp.x += sin(uTime * uG.z * 1.2 + position.z * 30.0 + along * 25.0) * 0.03 * sz * mv; }          // a lizard's walk: the body bends side to side, the legs paddle
        else if(gait > 2.5){ lp.y += sin(uTime * 1.3 + iP.w * 20.0) * 0.004 * sz; lp.z += sin(uTime * 2.0 + iP.w * 9.0 + along * 4.0) * 0.004 * sz; }
        lp.y *= 1.0 + 0.012 * sin(uTime * 1.6 + iP.w * 20.0) * (1.0 - mv);                                               // breathing
        float gy = uN.y > 0.5 ? iY : groundY(xz);
        vec3 wp = vec3(xz.x + dir.x * lp.x - dir.y * lp.z, gy + lp.y, xz.y + dir.y * lp.x + dir.x * lp.z);
        vec3 nw = normalize(vec3(dir.x * normal.x - dir.y * normal.z, normal.y, dir.y * normal.x + dir.x * normal.z));
        float nt = smoothstep(0.55, 0.9, uNight), vis = mix(mix(1.0 - nt, smoothstep(0.35, 0.6, uNight), step(0.5, uN.x)), 1.0, step(1.5, uN.x));
        float ok = vis * mix(step(uSeaM * uVex - 0.1, groundY(xz)), 1.0, uN.y) * (1.0 - smoothstep(${see} * 0.7, ${see}, length(wp - cameraPosition)));
        vLight = uLightCol * (max(dot(nw, uLightDir), 0.0) * 0.8 + 0.1) * cloudShadow(wp) + mix(uAmbGnd, uAmbSky, nw.y * 0.5 + 0.5);
        vCol = vec3(1.0); vObj = position; vNo = normal; vK = aK; vH = vec4(fract(iP.w * 13.7), fract(iP.w * 7.3), fract(iP.w * 3.1), fract(iP.w * 5.9)); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vW, vObj, vNo, vLight; varying float vK; varying vec4 vH; void main(){ ${LOGF} vec3 c = vCol * 0.3; ${o.paint} c *= 0.34; gl_FragColor = vec4(applyFog(c * vLight, vW), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = o.name || 'critters'; m.frustumCulled = false; scene.add(m); nearOnly(m, list, 5, o.see || 300, 12);
  return m;
}

// More of Moreton's fish, each built from its own outline (so no two share a silhouette) and painted to match: tailor, dart, trevally, jewfish,
// longtom, tarwhine, snapper, squire, sweetlip, cod, Moses perch, tuskfish, morwong and the moray eel. Same smooth lofted bodies as creatures.js.
import { Shape, fish } from './creatures.js';

// ---------------------------------------------------------------- shapes
// profile rows: [x (nose +0.5 to tail -0.43), half height, half width, height of the centre line]
// Tailor: a blue-backed, silver, muscular torpedo with a big mouth and a deeply forked tail; two dorsal fins, the first short and spiny.
export const TAILOR = fish({
  prof: [[0.50, 0.005, 0.005, 0], [0.465, 0.034, 0.028, -0.006], [0.37, 0.076, 0.05, 0.002], [0.2, 0.1, 0.062, 0.006], [0.02, 0.108, 0.066, 0.004], [-0.14, 0.09, 0.054, 0], [-0.28, 0.054, 0.03, 0], [-0.38, 0.03, 0.016, 0], [-0.43, 0.026, 0.009, 0]],
  tail: { len: 0.2, fork: 0.58, spread: 0.85 }, dorsal: [[0.12, -0.02, 0.05, { spines: 7, sweep: 0.75 }], [-0.07, -0.29, 0.045, { sweep: 0.8, lobe: 0.7 }]], anal: [-0.09, -0.29, 0.045, { sweep: 0.8, lobe: 0.7 }], pelv: [0.1, 0.07, 0.022], pect: [0.24, -0.03, 0.1, 0.035],
});
// Dart: a flat, high-bodied, silver rhomboid; the front of the second dorsal and the anal fin drawn out into long lobes, and a tail with long, thin tips.
export const DART = fish({
  prof: [[0.5, 0.004, 0.004, 0], [0.46, 0.06, 0.03, -0.012], [0.36, 0.122, 0.045, 0], [0.22, 0.17, 0.055, 0.005], [0.06, 0.188, 0.058, 0.006], [-0.1, 0.16, 0.05, 0], [-0.24, 0.1, 0.036, 0], [-0.34, 0.05, 0.02, 0], [-0.4, 0.03, 0.012, 0], [-0.43, 0.028, 0.01, 0]],
  tail: { len: 0.26, fork: 0.7, spread: 1.05 }, dorsal: [[0.14, 0.04, 0.05, { spines: 5, sweep: 0.5 }], [0.02, -0.3, 0.15, { sweep: 1.1, lobe: 0.38 }]], anal: [0.0, -0.3, 0.13, { sweep: 1.1, lobe: 0.38 }], pelv: [0.12, 0.09, 0.03],
});
// Trevally: deep-shouldered, blunt-headed and powerful, a steep brow, a scooped tail with scutes along its stem.
export const TREVALLY = fish({
  prof: [[0.5, 0.006, 0.01, -0.012], [0.47, 0.062, 0.04, -0.004], [0.4, 0.13, 0.06, 0.012], [0.26, 0.19, 0.076, 0.02], [0.08, 0.205, 0.08, 0.012], [-0.1, 0.17, 0.07, 0], [-0.24, 0.1, 0.044, 0], [-0.34, 0.046, 0.02, 0], [-0.4, 0.027, 0.012, 0], [-0.43, 0.026, 0.01, 0]],
  tail: { len: 0.27, fork: 0.62, spread: 1.0 }, dorsal: [[0.17, 0.05, 0.045, { spines: 7, sweep: 0.5 }], [0.0, -0.31, 0.07, { sweep: 1.0, lobe: 0.45 }]], anal: [-0.02, -0.31, 0.06, { sweep: 1.0, lobe: 0.45, spines: 2 }], pelv: [0.15, 0.1, 0.03], pect: [0.2, -0.02, 0.17, 0.05],
});
// Jewfish (mulloway): long, heavy-headed and bronze, a big eye, a short first dorsal and a long second, a square tail.
export const JEWFISH = fish({
  prof: [[0.5, 0.006, 0.006, 0], [0.46, 0.046, 0.036, -0.006], [0.36, 0.086, 0.056, 0], [0.2, 0.112, 0.066, 0.006], [0.0, 0.116, 0.068, 0.006], [-0.16, 0.1, 0.058, 0], [-0.3, 0.066, 0.036, 0], [-0.38, 0.042, 0.02, 0], [-0.43, 0.038, 0.012, 0]],
  tail: { len: 0.17, fork: 0.04, spread: 0.72 }, dorsal: [[0.15, -0.03, 0.065, { spines: 9, sweep: 0.8 }], [-0.04, -0.34, 0.046, { sweep: 0.5, lobe: 1.0 }]], anal: [-0.27, -0.38, 0.032, { sweep: 0.6, lobe: 1.0 }], pelv: [0.12, 0.08, 0.026],
});
// Longtom: a green needle with a long toothy beak, its fins set far back, the tail forked with a longer lower lobe.
export const LONGTOM = (() => {
  const m = new Shape().body([[0.62, 0.002, 0.002, 0], [0.5, 0.007, 0.007, 0], [0.38, 0.013, 0.012, 0], [0.26, 0.026, 0.02, 0], [0.1, 0.034, 0.025, 0], [-0.1, 0.036, 0.026, 0], [-0.26, 0.033, 0.022, 0], [-0.37, 0.024, 0.014, 0], [-0.43, 0.02, 0.01, 0]], { NR: 22, NS: 10 });
  m.tail(0.1, { low: 0.15, fork: 0.35, spread: 0.7 }); m.ridge(-0.3, -0.4, 0.05, { sweep: 0.9 }); m.ridge(-0.3, -0.4, 0.045, { dir: -1, sweep: 0.9 });
  for (const sd of [-1, 1]) m.leaf([0.18, -0.01, sd * 0.02], [-0.8, -0.2, sd * 0.56], [0.2, -0.97, sd * 0.1], 0.07, 0.014);
  return m.done();
})();
// Tarwhine: a bream's shape, a little rounder, with gold stripes and yellow lower fins.
export const TARWHINE = fish({
  prof: [[0.5, 0.004, 0.004, 0], [0.46, 0.05, 0.03, -0.01], [0.38, 0.116, 0.052, 0], [0.24, 0.19, 0.07, 0.006], [0.08, 0.215, 0.076, 0.006], [-0.08, 0.19, 0.066, 0], [-0.22, 0.126, 0.047, 0], [-0.33, 0.06, 0.027, 0], [-0.4, 0.036, 0.015, 0], [-0.43, 0.034, 0.01, 0]],
  tail: { len: 0.2, fork: 0.44, spread: 0.85 }, dorsal: [[0.2, -0.3, 0.085, { spines: 11, sweep: 0.5 }]], anal: [-0.06, -0.31, 0.062, { spines: 3 }], pelv: [0.14, 0.11, 0.035],
});
// Snapper (and its young, the squire): a high, rounded brow and a steep face, the back rising to the dorsal; blue spots over a pink coat.
export const SNAPPER = fish({
  prof: [[0.5, 0.004, 0.01, -0.024], [0.46, 0.07, 0.04, -0.012], [0.38, 0.14, 0.06, 0.016], [0.24, 0.206, 0.076, 0.03], [0.06, 0.216, 0.08, 0.016], [-0.1, 0.18, 0.068, 0], [-0.24, 0.11, 0.044, 0], [-0.34, 0.056, 0.024, 0], [-0.4, 0.036, 0.015, 0], [-0.43, 0.034, 0.01, 0]],
  tail: { len: 0.22, fork: 0.5, spread: 0.9 }, dorsal: [[0.28, -0.3, 0.094, { spines: 12, sweep: 0.5, lobe: 0.8 }]], anal: [-0.1, -0.3, 0.052, { spines: 3 }], pelv: [0.13, 0.11, 0.035], pect: [0.2, -0.03, 0.16, 0.05],
});
// Sweetlip (red-throat emperor): long in the snout, a sloping profile, big pectorals, a long spiny dorsal.
export const SWEETLIP = fish({
  prof: [[0.5, 0.008, 0.012, -0.008], [0.46, 0.045, 0.034, -0.008], [0.36, 0.092, 0.054, 0.006], [0.2, 0.13, 0.067, 0.01], [0.02, 0.14, 0.07, 0.004], [-0.14, 0.12, 0.06, 0], [-0.28, 0.08, 0.04, 0], [-0.38, 0.045, 0.022, 0], [-0.43, 0.04, 0.012, 0]],
  tail: { len: 0.2, fork: 0.4, spread: 0.85 }, dorsal: [[0.3, -0.3, 0.07, { spines: 10, sweep: 0.45 }]], anal: [-0.1, -0.3, 0.05, { spines: 3 }], pelv: [0.12, 0.09, 0.03], pect: [0.22, -0.03, 0.17, 0.05],
});
// Cod: thick and wide-mouthed, a broad flat head, rounded fins everywhere and a round tail like a spade.
export const COD = fish({
  prof: [[0.5, 0.012, 0.022, 0], [0.45, 0.08, 0.072, 0.002], [0.34, 0.14, 0.11, 0.01], [0.18, 0.162, 0.126, 0.01], [0.0, 0.158, 0.122, 0], [-0.16, 0.13, 0.1, 0], [-0.3, 0.086, 0.066, 0], [-0.38, 0.058, 0.04, 0], [-0.43, 0.052, 0.022, 0]],
  tail: { len: 0.2, fork: 0.0, spread: 0.8 }, dorsal: [[0.26, -0.36, 0.08, { spines: 11, sweep: 0.25, lobe: 1.0 }]], anal: [-0.12, -0.36, 0.065, { sweep: 0.25, lobe: 1.0 }], pelv: [0.14, 0.12, 0.05], pect: [0.18, -0.05, 0.19, 0.07],
});
// Moses perch: a snapper's cousin, a plain silver oval with a sloping face and a black thumbprint under the dorsal fin.
export const MOSES = fish({
  prof: [[0.5, 0.006, 0.012, -0.006], [0.46, 0.06, 0.04, -0.004], [0.38, 0.12, 0.058, 0.01], [0.24, 0.17, 0.07, 0.016], [0.06, 0.18, 0.073, 0.008], [-0.1, 0.15, 0.064, 0], [-0.24, 0.1, 0.04, 0], [-0.34, 0.055, 0.022, 0], [-0.4, 0.036, 0.012, 0], [-0.43, 0.034, 0.01, 0]],
  tail: { len: 0.19, fork: 0.4, spread: 0.85 }, dorsal: [[0.24, -0.29, 0.072, { spines: 10, sweep: 0.4, lobe: 0.8 }]], anal: [-0.1, -0.3, 0.052, { spines: 3 }], pelv: [0.13, 0.1, 0.03],
});
// Tuskfish: a wrasse, long and deep, the forehead steep, thick lips; a long low dorsal fin and a fan tail with trailing tips.
export const TUSK = fish({
  prof: [[0.5, 0.006, 0.014, -0.01], [0.46, 0.07, 0.04, -0.01], [0.38, 0.13, 0.062, 0.0], [0.24, 0.166, 0.072, 0.012], [0.06, 0.172, 0.075, 0.01], [-0.1, 0.15, 0.066, 0], [-0.24, 0.1, 0.044, 0], [-0.34, 0.066, 0.026, 0], [-0.4, 0.056, 0.016, 0], [-0.43, 0.054, 0.012, 0]],
  tail: { len: 0.24, fork: 0.14, spread: 0.9 }, dorsal: [[0.3, -0.34, 0.062, { spines: 11, sweep: 0.3, lobe: 1.0 }]], anal: [-0.06, -0.31, 0.05, { sweep: 0.3, lobe: 1.0 }], pelv: [0.13, 0.1, 0.035], pect: [0.2, -0.03, 0.13, 0.05],
});
// Morwong: an oval, thick-lipped bottom fish, with a long swept-back dorsal and a pectoral fin with long free tips.
export const MORWONG = fish({
  prof: [[0.5, 0.006, 0.012, -0.01], [0.46, 0.058, 0.036, -0.01], [0.38, 0.12, 0.056, 0.0], [0.22, 0.17, 0.068, 0.01], [0.04, 0.182, 0.07, 0.01], [-0.12, 0.146, 0.06, 0], [-0.26, 0.09, 0.04, 0], [-0.36, 0.05, 0.02, 0], [-0.41, 0.036, 0.012, 0], [-0.43, 0.034, 0.01, 0]],
  tail: { len: 0.2, fork: 0.3, spread: 0.85 }, dorsal: [[0.27, -0.31, 0.1, { spines: 16, sweep: 0.95, lobe: 0.6 }]], anal: [-0.1, -0.3, 0.052, { spines: 3 }], pelv: [0.12, 0.1, 0.03], pect: [0.22, -0.08, 0.21, 0.05],
});
// Moray eel: a muscle that undulates from head to tail, a low fin running down the back, round the tail and up the belly, no pectoral fins.
export const MORAY = (() => {
  const m = new Shape((x) => 0.14 + 0.86 * Math.min(1, Math.max(0, (0.38 - x) / 0.85)));
  m.body([[0.5, 0.008, 0.012, -0.004], [0.475, 0.034, 0.03, 0], [0.42, 0.055, 0.05, 0.006], [0.34, 0.07, 0.062, 0.004], [0.2, 0.062, 0.056, 0], [0.0, 0.046, 0.04, 0], [-0.25, 0.044, 0.036, 0], [-0.5, 0.046, 0.032, 0], [-0.72, 0.034, 0.02, 0], [-0.9, 0.018, 0.009, 0], [-0.98, 0.006, 0.003, 0]], { NR: 40, NS: 12 });
  m.ridge(0.3, -0.98, 0.05, { sweep: 0.05, lobe: 1.0, nt: 30 }); m.ridge(-0.1, -0.98, 0.036, { dir: -1, sweep: 0.05, lobe: 0.9, nt: 24 });
  return m.done();
})();

// ---------------------------------------------------------------- paint (the same language as PAINT in creatures.js)
const SPOTS = (sx, sy, thr, size, col, mix = 0.8) => `{ vec2 q = vec2(u * ${sx}.0, tone * ${sy}.0); q.x += 0.5 * floor(q.y); vec2 f = fract(q) - 0.5; float h = hash12(floor(q) + vSeed); alb = mix(alb, ${col}, step(${thr}, h) * smoothstep(${size}, ${size} * 0.55, length(f + (vec2(h, fract(h * 7.1)) - 0.5) * 0.3)) * ${mix}); }`;
export const WPAINT = {
  // tailor (Pomatomus saltatrix): blue-green back, bright silver flanks and belly, a black blotch where the pectoral fin joins, the mouth full of teeth
  tailor: { body: `alb *= 1.0 - 0.12 * smoothstep(0.012, 0.0, abs(tone - 0.4)) * smoothstep(0.2, 0.3, u); alb = mix(alb, vec3(0.12, 0.34, 0.36), smoothstep(0.36, 0.1, tone + (n - 0.5) * 0.06) * 0.85); alb *= 1.0 - 0.7 * smoothstep(0.04, 0.012, length(vec2((u - 0.285) * 1.6, (tone - 0.43) * 0.8))); alb *= 1.0 - 0.14 * smoothstep(0.25, 0.0, abs(fract(u * 9.0 + n * 0.3) - 0.5)) * (1.0 - tone) * 0.5; gloss = 0.9;`, fin: `alb = mix(alb, vec3(0.1, 0.32, 0.34), smoothstep(0.55, 1.0, vUV.y) * 0.5); if(!side && vL.y > 0.0) alb = mix(alb, vec3(0.1, 0.12, 0.13), 0.35);`, scales: 66 },
  // dart (Trachinotus): silver with a gold wash, a short row of black spots, yellow in the lower fins and the front of the lobes
  dart: { body: `alb = mix(alb, vec3(0.88, 0.8, 0.56), smoothstep(0.55, 0.9, tone) * 0.4); alb = mix(alb, vec3(0.34, 0.42, 0.44), smoothstep(0.3, 0.05, tone) * 0.6); alb *= 1.0 - 0.8 * smoothstep(0.05, 0.026, length(vec2((u - 0.4) * 1.1, (tone - 0.4) * 0.6))); gloss = 1.0;`, fin: `alb = mix(alb, vec3(0.9, 0.8, 0.26), 0.55 * smoothstep(0.6, 0.0, vUV.y) * float(!side)); alb = mix(alb, vec3(0.1), smoothstep(0.82, 1.0, vUV.y) * 0.5);`, scales: 62 },
  // trevally (Caranx): bluish back, silver sides with a golden wash, a black spot on the gill cover, dark scutes along the tail stem, yellow tail
  trevally: { body: `alb *= 1.0 - 0.12 * smoothstep(0.012, 0.0, abs(tone - 0.4)) * smoothstep(0.2, 0.3, u); alb = mix(alb, vec3(0.25, 0.4, 0.45), smoothstep(0.34, 0.08, tone) * 0.7); alb = mix(alb, vec3(0.85, 0.72, 0.36), smoothstep(0.4, 0.7, tone) * 0.3 * smoothstep(0.1, 0.3, u)); alb *= 1.0 - 0.8 * smoothstep(0.03, 0.012, length(vec2((u - 0.215) * 1.4, (tone - 0.24) * 0.6))); alb *= 1.0 - 0.45 * smoothstep(0.78, 0.84, u) * smoothstep(0.1, 0.0, abs(tone - 0.42)) * (0.5 + 0.5 * step(0.5, fract(u * 80.0))); gloss = 0.9;`, fin: `alb = mix(alb, vec3(0.88, 0.7, 0.2), 0.6 * float(!side)); alb = mix(alb, vec3(0.1, 0.1, 0.12), smoothstep(0.85, 1.0, vUV.y) * 0.45);`, scales: 54 },
  // jewfish / mulloway: brown-bronze back, silver-pink flanks, scales edged dark, a bronze sheen, pale lower fins
  jewfish: { body: `alb *= 1.0 - 0.12 * smoothstep(0.012, 0.0, abs(tone - 0.4)) * smoothstep(0.2, 0.3, u); alb = mix(alb, vec3(0.3, 0.26, 0.2), smoothstep(0.45, 0.06, tone) * 0.95); alb *= 1.0 - 0.3 * smoothstep(0.03, 0.0, abs(tone - 0.42)) * smoothstep(0.2, 0.3, u); alb = mix(alb, vec3(0.1, 0.07, 0.05), smoothstep(0.04, 0.0, u) * 0.6); alb = mix(alb, vec3(0.9, 0.78, 0.72), smoothstep(0.5, 0.82, tone) * 0.4); alb *= 0.9 + 0.2 * n; gloss = 1.0;`, fin: `alb = mix(alb, vec3(0.5, 0.42, 0.34), 0.45); if(vL.y < -0.02 && !side) alb = mix(alb, vec3(0.8, 0.72, 0.6), 0.5);`, scales: 76 },
  // longtom: green-blue back, a silver belly, a bright line of blue-green along the bone, the beak dark with a pale tip
  longtom: { body: `alb = mix(vec3(0.1, 0.36, 0.36), vec3(0.86, 0.9, 0.9), smoothstep(0.34, 0.58, tone + (n - 0.5) * 0.05)); alb = mix(alb, vec3(0.2, 0.55, 0.6), smoothstep(0.06, 0.0, abs(tone - 0.38)) * 0.6); alb = mix(alb, vec3(0.2, 0.22, 0.2), smoothstep(0.42, 0.34, u) * 0.6); gloss = 1.1;`, fin: `alb = mix(alb, vec3(0.12, 0.3, 0.32), 0.7);`, scales: 90, gill: 0 },
  // tarwhine: silver, with thin gold lines along every row of scales, yellow-orange under the belly fins
  tarwhine: { body: `{ float s = abs(fract(tone * 8.5) - 0.5); alb = mix(alb, vec3(0.9, 0.68, 0.2), smoothstep(0.14, 0.03, s) * smoothstep(0.15, 0.3, u) * smoothstep(0.96, 0.8, u) * smoothstep(0.85, 0.7, tone) * 0.9); } alb = mix(alb, vec3(0.36, 0.4, 0.4), smoothstep(0.2, 0.0, tone) * 0.6);`, fin: `if(vL.y < -0.02 && !side) alb = mix(alb, vec3(0.95, 0.62, 0.12), 0.8); alb = mix(alb, vec3(0.3), smoothstep(0.85, 1.0, vUV.y) * 0.35);`, scales: 62 },
  // snapper (Chrysophrys auratus): rose-pink back fading to white below, a scatter of electric-blue spots over the upper flanks, the tail's edge dark
  snapper: { body: `alb = mix(alb, vec3(0.76, 0.42, 0.4), smoothstep(0.55, 0.05, tone) * 0.62); alb = mix(alb, vec3(0.97, 0.9, 0.88), smoothstep(0.58, 0.85, tone) * 0.7); ${SPOTS(34, 14, 0.5, 0.4, 'vec3(0.1, 0.4, 1.0)', 0.9).replace('smoothstep(0.3', '(1.0 - smoothstep(0.45, 0.6, tone)) * smoothstep(0.2, 0.28, u) * smoothstep(0.3').replace('* 0.9;', '* 0.9;')} gloss = 0.8;`, fin: `alb = mix(alb, vec3(0.9, 0.42, 0.4), 0.65); alb = mix(alb, vec3(0.2, 0.1, 0.12), smoothstep(0.86, 1.0, vUV.y) * 0.6 * float(vL.x < -0.3));`, scales: 58 },
  // squire: the young snapper, silvery-pink with brighter blue spots
  squire: { body: `alb = mix(alb, vec3(0.8, 0.58, 0.58), smoothstep(0.5, 0.05, tone) * 0.55); alb = mix(alb, vec3(0.97, 0.94, 0.92), smoothstep(0.55, 0.85, tone) * 0.8); ${SPOTS(28, 12, 0.3, 0.32, 'vec3(0.05, 0.35, 1.0)', 0.95).replace('smoothstep(0.32', '(1.0 - smoothstep(0.5, 0.65, tone)) * smoothstep(0.2, 0.28, u) * smoothstep(0.32')} gloss = 0.9;`, fin: `alb = mix(alb, vec3(0.92, 0.62, 0.58), 0.55);`, scales: 60 },
  // sweetlip (red-throat emperor): coral-red over silver, red lips, a deep red throat, pale blue blotches, red fins
  sweetlip: { body: `alb = mix(alb, vec3(0.8, 0.34, 0.3), smoothstep(0.62, 0.1, tone) * 0.75); alb = mix(alb, vec3(0.96, 0.88, 0.84), smoothstep(0.62, 0.9, tone) * 0.6); alb = mix(alb, vec3(0.86, 0.12, 0.1), smoothstep(0.6, 0.85, tone) * smoothstep(0.34, 0.2, u) * 0.9); alb = mix(alb, vec3(0.7, 0.14, 0.12), smoothstep(0.07, 0.0, u) * 0.9); ${SPOTS(14, 6, 0.55, 0.3, 'vec3(0.55, 0.72, 0.85)', 0.5)} gloss = 0.7;`, fin: `alb = mix(alb, vec3(0.88, 0.3, 0.26), 0.75); alb = mix(alb, vec3(0.2, 0.06, 0.06), smoothstep(0.88, 1.0, vUV.y) * 0.35);`, scales: 58 },
  // cod (estuary cod): brown-olive, darker blotches and broken bars, scattered brown-orange spots, a pale belly, a black rim to the soft fins
  cod: { body: `alb = mix(alb, vec3(0.26, 0.2, 0.12), smoothstep(0.45, 0.75, n) * (1.0 - tone) * 0.7); { float b = smoothstep(0.1, 0.0, abs(fract(u * 5.5 + n * 0.25) - 0.5) - 0.17) * (1.0 - smoothstep(0.45, 0.8, tone)); alb = mix(alb, vec3(0.1, 0.08, 0.05), b * 0.55); } ${SPOTS(20, 9, 0.4, 0.3, 'vec3(0.62, 0.3, 0.1)', 0.8)} alb *= 0.85 + 0.3 * n2; gloss = 0.4;`, fin: `alb *= 0.8 + 0.4 * step(0.5, fract(vUV.x * 4.0 + vSeed)); alb = mix(alb, vec3(0.05), smoothstep(0.85, 1.0, vUV.y) * 0.55);`, scales: 44 },
  // Moses perch: pale silver, faint gold streaks, a black spot below the end of the dorsal fin, yellow in the fins
  moses: { body: `alb *= 1.0 - 0.12 * smoothstep(0.012, 0.0, abs(tone - 0.4)) * smoothstep(0.2, 0.3, u); alb = mix(alb, vec3(0.44, 0.46, 0.44), smoothstep(0.3, 0.05, tone) * 0.65); { float s = abs(fract(tone * 7.0 + 0.3) - 0.5); alb = mix(alb, vec3(0.85, 0.7, 0.3), smoothstep(0.14, 0.03, s) * smoothstep(0.2, 0.3, u) * smoothstep(0.9, 0.78, u) * smoothstep(0.7, 0.5, tone) * 0.75); } alb *= 1.0 - 0.9 * smoothstep(0.07, 0.04, length(vec2((u - 0.63) * 1.25, (tone - 0.25) * 0.8)));`, fin: `alb = mix(alb, vec3(0.92, 0.78, 0.3), 0.6 * float(!side));`, scales: 58 },
  // tuskfish (Choerodon): green-blue scales each outlined darker, a flame-orange band behind the head, orange spots, lips pale blue, a blue-edged tail
  tusk: { body: `alb = mix(vec3(0.1, 0.46, 0.4), vec3(0.62, 0.78, 0.8), smoothstep(0.3, 0.8, tone)); alb = mix(alb, vec3(0.95, 0.5, 0.12), smoothstep(0.045, 0.0, abs(u - 0.24 - 0.12 * (tone - 0.5))) * 0.85 * smoothstep(0.0, 0.1, tone)); ${SPOTS(18, 8, 0.45, 0.28, 'vec3(0.95, 0.5, 0.14)', 0.8)} alb = mix(alb, vec3(0.5, 0.75, 0.85), smoothstep(0.06, 0.0, u) * 0.8); alb *= 0.9 + 0.2 * n; gloss = 0.7;`, fin: `alb = mix(vec3(0.1, 0.5, 0.48), vec3(0.95, 0.52, 0.14), smoothstep(0.2, 0.7, vUV.y)); alb = mix(alb, vec3(0.1, 0.38, 0.7), smoothstep(0.88, 1.0, vUV.y) * 0.8);`, scales: 48 },
  // morwong: pale silver-grey with two broad dark bands, one through the eye and one across the middle, dark first dorsal and tail
  morwong: { body: `{ float uu = u + (tone - 0.5) * 0.1; float b = max(smoothstep(0.06, 0.2, uu) * smoothstep(0.26, 0.14, uu), smoothstep(0.38, 0.5, uu) * smoothstep(0.66, 0.52, uu) * (0.55 + 0.45 * smoothstep(0.1, 0.4, tone))); alb = mix(alb, vec3(0.1, 0.1, 0.12), b * 0.75); } alb = mix(alb, vec3(0.9, 0.7, 0.62), smoothstep(0.7, 0.95, tone) * 0.4); alb *= 0.9 + 0.2 * n;`, fin: `alb = mix(alb, vec3(0.12, 0.12, 0.14), 0.55); if(side) alb = mix(alb, vec3(0.85, 0.7, 0.5), 0.5);`, scales: 56 },
  // moray eel: olive-brown, covered in dark blotches like a leopard's, the underside and throat paler, a dark line along the gape
  moray: { body: `{ vec2 q = vec2(u * 40.0, tone * 8.0); q.x += 0.5 * floor(q.y); vec2 f = fract(q) - 0.5; float h = hash12(floor(q) + vSeed); alb = mix(vec3(0.30, 0.23, 0.08), vec3(0.56, 0.46, 0.18), n); alb = mix(alb, vec3(0.06, 0.045, 0.02), smoothstep(0.46, 0.3, length(f)) * step(0.2, h) * 0.95); alb = mix(alb, vec3(0.74, 0.66, 0.42), smoothstep(0.62, 0.95, tone) * 0.55); alb = mix(alb, vec3(0.05, 0.04, 0.02), smoothstep(0.02, 0.006, abs(tone - 0.5)) * smoothstep(0.1, 0.05, u)); gloss = 0.9; }`, fin: `alb = mix(vec3(0.42, 0.33, 0.12), vec3(0.06, 0.045, 0.02), smoothstep(0.4, 1.0, vUV.y));`, scales: 0, gill: 0 },
  moray: { body: `{ vec2 q = vec2(u * 34.0, tone * 7.0); q.x += 0.5 * floor(q.y); vec2 f = fract(q) - 0.5; float h = hash12(floor(q) + vSeed); float ring = smoothstep(0.34, 0.25, length(f)) - smoothstep(0.2, 0.1, length(f)); alb = mix(vec3(0.5, 0.4, 0.14), vec3(0.62, 0.55, 0.3), n); alb = mix(alb, vec3(0.12, 0.09, 0.05), clamp(ring * step(0.25, h), 0.0, 1.0) * 0.8); alb *= 0.8 + 0.4 * n2; alb = mix(alb, vec3(0.72, 0.66, 0.5), smoothstep(0.62, 0.9, tone) * 0.5); alb *= 1.0 - 0.8 * (1.0 - smoothstep(0.004, 0.012, abs(tone - 0.62 - 0.4 * smoothstep(0.1, 0.0, u) * 0.0))) * smoothstep(0.075, 0.06, u) * smoothstep(0.0, 0.01, u) * 0.4; alb = mix(alb, vec3(0.08, 0.06, 0.04), smoothstep(0.012, 0.004, abs(tone - 0.5)) * smoothstep(0.07, 0.04, u) * 0.8); gloss = 0.9; }`, fin: `alb = mix(vec3(0.5, 0.4, 0.14), vec3(0.08, 0.06, 0.04), smoothstep(0.5, 1.0, vUV.y));`, scales: 0, gill: 0 },
};

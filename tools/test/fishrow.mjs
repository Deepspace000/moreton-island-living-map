// paste into the page: lays the new fish in a row above the water, side on, for a close look
const W = await import('/src/wildlife.js'), C = await import('/src/creatures.js'), TR = await import('/src/terrain.js');
const sea = MAP.U.uSeaM.value * 1; // metres; VEX applied in shader
if (window.__row) { for (const m of window.__row) { MAP.scene.remove(m); } }
window.__row = [];
const specs = [
  ['TAILOR', 'tailor', 0.6, [0.2, 0.36, 0.38], [0.86, 0.9, 0.9], [0.5, 0.58, 0.55], [0.39, 0.015, 0.02]],
  ['DART', 'dart', 0.5, [0.62, 0.68, 0.66], [0.92, 0.9, 0.8], [0.8, 0.74, 0.4], [0.38, 0.03, 0.022]],
  ['TREVALLY', 'trevally', 0.85, [0.4, 0.52, 0.55], [0.88, 0.84, 0.66], [0.7, 0.62, 0.3], [0.37, 0.04, 0.027]],
  ['JEWFISH', 'jewfish', 0.9, [0.46, 0.4, 0.3], [0.88, 0.8, 0.74], [0.5, 0.44, 0.36], [0.385, 0.02, 0.024]],
  ['LONGTOM', 'longtom', 0.9, [0.12, 0.36, 0.34], [0.86, 0.9, 0.88], [0.14, 0.3, 0.3], [0.37, 0.011, 0.011]],
  ['TARWHINE', 'tarwhine', 0.6, [0.46, 0.48, 0.46], [0.86, 0.89, 0.9], [0.6, 0.55, 0.4], [0.37, 0.04, 0.028]],
  ['SNAPPER', 'snapper', 0.8, [0.78, 0.42, 0.4], [0.96, 0.88, 0.86], [0.9, 0.46, 0.44], [0.36, 0.04, 0.03]],
  ['SNAPPER', 'squire', 0.6, [0.84, 0.6, 0.6], [0.97, 0.94, 0.92], [0.92, 0.62, 0.58], [0.36, 0.04, 0.03]],
  ['SWEETLIP', 'sweetlip', 0.7, [0.82, 0.36, 0.32], [0.96, 0.88, 0.84], [0.9, 0.3, 0.26], [0.37, 0.025, 0.026]],
  ['COD', 'cod', 0.8, [0.36, 0.28, 0.16], [0.7, 0.62, 0.46], [0.42, 0.32, 0.2], [0.38, 0.045, 0.03]],
  ['MOSES', 'moses', 0.6, [0.62, 0.62, 0.58], [0.92, 0.9, 0.84], [0.9, 0.78, 0.34], [0.375, 0.03, 0.026]],
  ['TUSK', 'tusk', 0.7, [0.1, 0.46, 0.4], [0.6, 0.78, 0.8], [0.1, 0.5, 0.48], [0.37, 0.035, 0.026]],
  ['MORWONG', 'morwong', 0.7, [0.62, 0.62, 0.6], [0.9, 0.86, 0.82], [0.5, 0.5, 0.5], [0.37, 0.035, 0.026]],
  ['MORAY', 'moray', 0.7, [0.5, 0.4, 0.16], [0.7, 0.62, 0.46], [0.4, 0.3, 0.1], [0.44, 0.02, 0.011]],
];
// find open deep water on the bay side
let base = null; const T = MAP.T;
for (let t = 0; t < 4000 && !base; t++) { const x = -T.sx / 2 + 600 + Math.random() * 400, z = (Math.random() - .5) * T.sz * 0.6; if (-TR.heightAt(x, z) > 3 && -TR.heightAt(x - 40, z) > 3 && -TR.heightAt(x + 40, z) > 3) base = [x, z]; }
window.__base = base;
const a = 0.314159, R0 = 30, rr = R0 * (1 + 0.25 * Math.sin(a * 3)), px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
const mk = (name, i, o) => {
  const [shape, nm, size0, A, B, Cc, eye] = o, size = size0 * 1.8, P = [base[0], base[1] + i * 40];
  const list = [P[0] - px, P[1] - pz, R0, 0, a, 0.00001, size, 0];
  const m = C.swimmers(MAP.scene, { ...W[shape], paint: W.WPAINT[nm], name: 'row_' + nm, amp: 0.0, rate: 1, colA: A, colB: B, colC: Cc, eye, see: 5000, min: 0, rise: [0.5, 0] }, list);
  window.__row.push(m); return P;
};
specs.forEach((s, i) => mk(s[1], i, s));
const mid = [base[0], base[1] + 3.2 * 6.5];
MAP.flyTo(mid[0], mid[1], 30, 90, 80, 0.01);
for (let i = 0; i < 4; i++) { MAP.frame(); await new Promise(r => setTimeout(r, 80)); }
MAP.controls.target.set(mid[0], MAP.U.uSeaM.value + 0.6, mid[1]);
MAP.camera.position.set(mid[0] + 20, MAP.U.uSeaM.value + 3, mid[1]);
for (let i = 0; i < 6; i++) { MAP.frame(); await new Promise(r => setTimeout(r, 80)); }
window.__res = ({ base, sea: MAP.U.uSeaM.value, cam: MAP.camera.position.toArray(), n: window.__row.length });

window.__fishShots = async (only) => { const b = window.__base, out = [];
  for (let i = 0; i < specs.length; i++) { const nm = specs[i][1]; if (only && !only.includes(nm)) continue; const fz = b[1] + i * 40, fx = b[0] + 0.5, S = specs[i][2] * 1.8, D = 1.3 + 1.7 * S;
    out.push(await MAP.shot('fish_' + nm + '.jpg', { walk: [fx + D, fz + 0.3, -Math.PI / 2 + 0.12, -0.05], min: 690, wx: 'clear' })); }
  return out.length; };

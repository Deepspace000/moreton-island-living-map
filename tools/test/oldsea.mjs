// The sea animals that were in the map before the new wildlife, laid out one by one for the glossary pictures (use inside the studio, see studio.mjs).
//   const mark = S.begin(); await import('/tools/test/oldsea.mjs?' + Date.now()); S.tag(mark); S.on(); await window.__oldSeaShots();
// Same way as fishrow.mjs: each one is a stationary instance of the map's own swimmer, with the colours the map gives it (life.js buildSeaLife).
const C = await import('/src/creatures.js'), TR = await import('/src/terrain.js');
if (window.__orow) for (const m of window.__orow) MAP.scene.remove(m);
window.__orow = [];
const SILV = [0.86, 0.89, 0.9];
// [id, shape, paint, size, extra options, colA, colB, colC, eye, view: 'side' | 'top' | 'three']
const SP = [
  ['bream', 'BREAM', 'bream', 0.95, {}, [0.34, 0.38, 0.36], SILV, [0.45, 0.47, 0.42], undefined, 'side'],
  ['baitfish', 'SLIM', 'bait', 0.55, {}, [0.10, 0.42, 0.50], [0.80, 0.92, 0.80], [0.5, 0.7, 0.6], [0.39, 0.012, 0.02], 'side'],
  ['sergeant', 'DAMSEL', 'sergeant', 0.8, {}, [0.62, 0.70, 0.72], [0.90, 0.92, 0.90], [0.55, 0.6, 0.55], undefined, 'side'],
  ['neon', 'DAMSEL', 'neon', 0.5, {}, [0.02, 0.25, 0.95], [0.1, 0.5, 1.0], [0.04, 0.3, 1.0], undefined, 'side'],
  ['humbug', 'ROUND', 'humbug', 0.5, {}, [0.86, 0.87, 0.84], [0.9, 0.9, 0.88], [0.05, 0.05, 0.05], undefined, 'side'],
  ['hardyhead', 'SLIM', 'bait', 0.45, {}, [0.30, 0.38, 0.30], [0.90, 0.92, 0.88], [0.6, 0.62, 0.55], [0.39, 0.012, 0.02], 'side'],
  ['whiting', 'SLIM', 'whiting', 0.5, {}, [0.56, 0.52, 0.36], [0.94, 0.93, 0.88], [0.7, 0.66, 0.4], [0.39, 0.012, 0.02], 'side'],
  ['flathead', 'FLATHEAD', 'flathead', 0.75, {}, [0.45, 0.38, 0.25], [0.84, 0.8, 0.68], [0.5, 0.42, 0.26], [0.37, 0.05, 0.016], 'top'],
  ['greenturtle', 'TURTLE', 'turtle', 1.3, { vertical: 1, rise: [0.5, 0] }, [0.30, 0.25, 0.12], [0.7, 0.66, 0.44], undefined, [0.735, 0.06, 0.015], 'top'],
  ['maskray', 'RAY', 'ray', 1.0, { vertical: 1 }, [0.36, 0.31, 0.22], [0.80, 0.76, 0.66], undefined, [0.3, 0.085, 0.02], 'top'],
  ['shovelnose', 'SHOVEL', 'shovel', 1.2, {}, [0.46, 0.4, 0.26], [0.84, 0.8, 0.7], [0.4, 0.34, 0.22], [0.31, 0.075, 0.014], 'top'],
  ['whaler', 'SHARK', 'shark', 1.5, {}, [0.20, 0.20, 0.19], [0.86, 0.86, 0.83], [0.2, 0.2, 0.19], [0.43, 0.0, 0.011], 'side'],
  ['tigershark', 'SHARK', 'shark', 1.9, {}, [0.24, 0.24, 0.22], [0.84, 0.84, 0.8], [0.18, 0.18, 0.17], [0.43, 0.0, 0.011], 'side'],
  ['dolphin', 'DOLPHIN', 'dolphin', 2.2, { vertical: 1, rise: [0.5, 0] }, [0.17, 0.19, 0.22], [0.80, 0.76, 0.74], [0.16, 0.18, 0.2], [0.385, -0.008, 0.011], 'side'],
  ['dugong', 'DUGONG', 'dugong', 2.2, { vertical: 1, rise: [0.5, 0] }, [0.36, 0.33, 0.29], [0.62, 0.58, 0.52], [0.33, 0.3, 0.27], [0.4, 0.0, 0.009], 'side'],
  ['humpback', 'WHALE', 'whale', 4.5, { vertical: 1, rise: [0.5, 0] }, [0.045, 0.05, 0.06], [0.86, 0.86, 0.82], [0.5, 0.5, 0.5], [0.3, -0.035, 0.007], 'side'],
];
let base = null; const T = MAP.T;
for (let t = 0; t < 4000 && !base; t++) { const x = -T.sx / 2 + 600 + Math.random() * 400, z = (Math.random() - .5) * T.sz * 0.6; if (-TR.heightAt(x, z) > 4 && -TR.heightAt(x - 40, z) > 4 && -TR.heightAt(x + 40, z) > 4) base = [x, z]; }
window.__obase = base;
const a = 0.314159, R0 = 30, rr = R0 * (1 + 0.25 * Math.sin(a * 3)), px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
SP.forEach(([id, shape, paint, size0, extra, A, B, Cc, eye], i) => {
  const view = SP[i][9], size = size0 * 1.8 * (view === 'top' ? ({ flathead: 6, greenturtle: 2.6, maskray: 3.2, shovelnose: 3.2 }[id] || 4) : 1), P = [base[0], base[1] + i * 40], list = [P[0] - px, P[1] - pz, R0, extra.vertical ? 0.2 : 0, a, 0.00001, size, 0];
  const m = C.swimmers(MAP.scene, { ...C[shape], paint: C.PAINT[paint], name: 'orow_' + id, amp: 0.0, rate: 1, colA: A, colB: B, colC: Cc || B, eye, see: 5000, min: 0, rise: [0.5, 0], ...extra }, list);
  window.__orow.push(m);
});
window.__oldSeaShots = async (only) => { const out = [];
  for (let i = 0; i < SP.length; i++) { const [id, , , size0, , , , , , view] = SP[i]; if (only && !only.includes(id)) continue; const fz = base[1] + i * 40, fx = base[0] + 0.5, S = size0 * 1.8, D = 1.3 + 1.7 * S;
    if (view === 'top') { const Y = MAP.U.uSeaM.value * 1.7; out.push(await MAP.shot('sea_' + id + '.jpg', { cam: [fx - 0.5 + 0.01, Y + 16, fz + 0.01, fx - 0.5, Y, fz], min: 690, wx: 'clear' })); }
    else out.push(await MAP.shot('sea_' + id + '.jpg', { walk: [fx + D, fz + 0.3, -Math.PI / 2 + 0.12, -0.05], min: 690, wx: 'clear' })); }
  return out.length; };
'ok';

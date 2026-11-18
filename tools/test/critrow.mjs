// Lays the new reptiles and mammals out over the open sea, large, and takes a shot of each (needs tools/shot_server.py).
// In the page: await import('/tools/test/critrow.mjs?' + Date.now()); then await window.__critShots()
const WL = await import('/src/wildland.js?' + Date.now()), TR = await import('/src/terrain.js');
MAP.controls.minDistance = 1; MAP.controls.maxPolarAngle = 3.1;
if (window.__ct) for (const m of window.__ct) MAP.scene.remove(m);
window.__ct = [];
const sea = MAP.U.uSeaM.value, T = MAP.T; let base = null;
for (let t = 0; t < 4000 && !base; t++) { const x = -T.sx / 2 + 600 + Math.random() * 400, z = (Math.random() - .5) * T.sz * 0.6; if (-TR.heightAt(x, z) > 3 && -TR.heightAt(x - 80, z) > 3 && -TR.heightAt(x + 80, z) > 3) base = [x, z]; }
window.__cbase = base;
// name, model, paint, real length (m), wave settings, gait
const S = [
  ['waterdragon', 'WATER_DRAGON', 'waterdragon', 1.0, 4], ['majorskink', 'MAJOR_SKINK', 'majorskink', 0.5, 4], ['landmullet', 'LAND_MULLET', 'landmullet', 0.7, 4], ['gardenskink', 'GARDEN_SKINK', 'gardenskink', 0.11, 4],
  ['legless', 'LEGLESS', 'legless', 0.5, 1], ['python', 'CARPET_PYTHON', 'python', 1.9, 1], ['treesnake', 'GREEN_TREE_SNAKE', 'treesnake', 1.15, 1], ['blacksnake', 'BLACK_SNAKE', 'blacksnake', 1.45, 1], ['whipsnake', 'WHIPSNAKE', 'whipsnake', 0.85, 1],
  ['turtle', 'LONGNECK_TURTLE', 'turtle', 0.65, 3], ['bandicoot', 'BANDICOOT', 'bandicoot', 0.5, 2], ['longnose', 'LONGNOSE_BANDICOOT', 'longnose', 0.6, 2], ['brushtail', 'BRUSHTAIL', 'brushtail', 0.9, 2], ['ringtail', 'RINGTAIL', 'ringtail', 0.6, 2], ['waterrat', 'WATER_RAT', 'waterrat', 0.6, 2],
];
S.forEach(([n, f, p, len, gait], i) => {
  const sc = 7 / len, z = base[1] + i * 40, a = 0; // heading 0: the animal walks along +x
  const list = [base[0], z, 0, 0.0, sea + 3];
  const m = WL.critters(MAP.scene, WL[f](), list, { name: 'crit_' + n, scale: sc, pace: 0, step: 0, gait, night: 2, water: 1, see: 5000, wave: [gait === 1 ? 5 : 8, gait === 1 ? 0.08 : 0.03, 3], paint: WL.WILD_PAINT[p] });
  window.__ct.push(m);
});
window.__cnames = S.map(s => s[0]);
window.__critShots = async (only) => {
  const out = [];
  for (let i = 0; i < S.length; i++) { const n = S[i][0]; if (only && !only.includes(n)) continue; const z = base[1] + i * 40, D = 7;
    out.push(await MAP.shot(`crit_${n}.jpg`, { cam: [base[0] + 4, sea + 14, z - 10, base[0], sea + 3, z], min: 690, wx: 'clear' })); }
  return out.length;
};
window.__cnames.join(',');

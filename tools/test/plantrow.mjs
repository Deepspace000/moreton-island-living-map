// Lays each wildflower out over the open sea at life size, one every 40 m, and takes a first-person shot of each (needs tools/shot_server.py).
// In the page: await import('/tools/test/plantrow.mjs?' + Date.now()); then await window.__plantShots()
import * as THREE from '/lib/three.module.min.js';
const WP = await import('/src/wildplants.js?' + Date.now()), CM = await import('/src/common.js'), TR = await import('/src/terrain.js');
if (window.__pt) for (const m of window.__pt) MAP.scene.remove(m);
window.__pt = [];
const sea = MAP.U.uSeaM.value, T = MAP.T; let base = null;
for (let t = 0; t < 4000 && !base; t++) { const x = -T.sx / 2 + 600 + Math.random() * 400, z = (Math.random() - .5) * T.sz * 0.6; if (-TR.heightAt(x, z) > 3 && -TR.heightAt(x - 80, z) > 3 && -TR.heightAt(x + 80, z) > 3) base = [x, z]; }
window.__pbase = base;
const K = WP.build(), mat = CM.objectMat({ side: THREE.DoubleSide, defines: {} });
for (let sp = 0; sp < 13; sp++) {
  const idx = []; for (let i = 0; i < K.idx.length; i += 3) if (K.sp[K.idx[i]] === sp) idx.push(K.idx[i], K.idx[i + 1], K.idx[i + 2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(K.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(K.col.map(v => Math.min(1, v * 1.6)), 3)); g.setAttribute('aFx', new THREE.Float32BufferAttribute(new Float32Array(K.pos.length), 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.position.set(base[0], sea * 1.7 + 0.05, base[1] + sp * 40); m.frustumCulled = false; MAP.scene.add(m); window.__pt.push(m);
}
const HGT = [3.3, 3, 0.8, 1.1, 1.5, 1.4, 0.5, 0.7, 0.9, 1, 1.0, 4.5, 1.3];
window.__plantShots = async (only) => { const out = [];
  for (let sp = 0; sp < 13; sp++) { if (only && !only.includes(sp)) continue; const z = base[1] + sp * 40, H = HGT[sp], D = 1.2 + 0.9 * H;
    out.push(await MAP.shot(`plant_${sp}.jpg`, { walk: [base[0] + 0.05, z + D, 0.0, H > 2 ? 0.3 : H > 1.2 ? 0.0 : -0.25], min: 690, wx: 'clear' })); }
  return out.length; };
'ok';

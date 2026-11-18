// Lays each wildflower out over the open sea, large, and takes a shot of each (needs tools/shot_server.py).
// In the page: await import('/tools/test/plantrow.mjs?' + Date.now()); then await window.__plantShots()
import * as THREE from '/lib/three.module.min.js';
const WP = await import('/src/wildplants.js?' + Date.now()), CM = await import('/src/common.js'), TR = await import('/src/terrain.js');
MAP.controls.minDistance = 1; MAP.controls.maxPolarAngle = 3.1;
if (window.__pt) for (const m of window.__pt) MAP.scene.remove(m);
window.__pt = [];
const sea = MAP.U.uSeaM.value, T = MAP.T; let base = null;
for (let t = 0; t < 4000 && !base; t++) { const x = -T.sx / 2 + 600 + Math.random() * 400, z = (Math.random() - .5) * T.sz * 0.6; if (-TR.heightAt(x, z) > 3 && -TR.heightAt(x - 80, z) > 3 && -TR.heightAt(x + 80, z) > 3) base = [x, z]; }
window.__pbase = base;
const K = WP.build(), mat = CM.objectMat({ side: THREE.DoubleSide, defines: {} });
const SC = [0.6, 0.65, 2.0, 1.7, 1.2, 1.3, 2.6, 1.7, 1.5, 1.2, 1.4, 0.55, 1.2];
for (let sp = 0; sp < 13; sp++) {
  const idx = []; for (let i = 0; i < K.idx.length; i += 3) if (K.sp[K.idx[i]] === sp) idx.push(K.idx[i], K.idx[i + 1], K.idx[i + 2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(K.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(K.col.map(v => Math.min(1, v * 3.2)), 3)); g.setAttribute('aFx', new THREE.Float32BufferAttribute(new Float32Array(K.pos.length), 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.scale.setScalar(SC[sp] * 3); m.position.set(base[0], sea + 2, base[1] + sp * 40); m.frustumCulled = false; MAP.scene.add(m); window.__pt.push(m);
}
window.__plantShots = async (only) => { const out = [];
  for (let sp = 0; sp < 13; sp++) { if (only && !only.includes(sp)) continue; const z = base[1] + sp * 40, S = SC[sp] * 3;
    out.push(await MAP.shot(`plant_${sp}.jpg`, { cam: [base[0] + 6 + S * 2.4, sea + 15, z + 0.5, base[0], sea + 2 + S * 0.4, z], min: 690, wx: 'clear' })); }
  return out.length; };
'ok';

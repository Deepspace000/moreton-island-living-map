// The trees and the wildflowers for the glossary pictures (use inside the studio, see studio.mjs; the dome wants a radius of 80 here).
//   const S = ...; S.on(undefined, undefined, 80); const mark = S.begin(); await import('/tools/test/treerow.mjs?' + Date.now()); S.tag(mark); await window.__treeShots();
// Species trees and grass trees are the map's own tree shaders, asked (uStudio) to draw one tree at a chosen spot; palms and pandanus are placed one at a time.
import * as THREE from '/lib/three.module.min.js';
const FE = await import('/src/features.js'), TR = await import('/src/terrain.js'), WP = await import('/src/wildplants.js?' + Date.now()), CM = await import('/src/common.js');
for (const m of window.__tr || []) MAP.scene.remove(m);
window.__tr = [];
const T = MAP.T;
const find = (ok) => { for (let t = 0; t < 40000; t++) { const x = (Math.random() - .5) * (T.sx - 1000), z = (Math.random() - .5) * (T.sz - 1000); if (ok(x, z)) return [x, z]; } return null; };
const flat = (x, z) => { const h = TR.heightAt(x, z); return h > 5 && h < 14 && [[30, 0], [-30, 0], [0, 30], [0, -30], [0, 60]].every(([dx, dz]) => Math.abs(TR.heightAt(x + dx, z + dz) - h) < 1.2); };
const spot = find(flat), [X, Z] = spot;
window.__tspot = spot;
const ST = FE.STUDIO.trees, r0 = ST.rings[0];
const trees = (on) => { for (const b of r0.g.blocks) { if (on) b.m.layers.enable(1); else b.m.layers.disable(1); } };          // (the ordinary forest must not show in the other pictures)
trees(false);
const gtree = ST.grass; gtree.uni.uStudio.value.set(0, 0, 0); const gt = (on) => { for (const b of gtree.grid.blocks) { if (on) b.m.layers.enable(1); else b.m.layers.disable(1); } }; gt(false);
// palms and pandanus
const palm = FE.STUDIO.palm([X + 300, TR.meshY(X + 300, Z) - 0.15, Z, 0.6, 1.0, 0.3]), pand = FE.STUDIO.pandanus([X + 150, TR.meshY(X + 150, Z + 150) - 0.1, Z + 150, 0.6, 1.0, 0.3]);
window.__tr.push(palm, pand);
// wildflowers: at sea, as plantrow.mjs does, but out of the way
const sea = MAP.U.uSeaM.value;
let base = find((x, z) => -TR.heightAt(x, z) > 3 && -TR.heightAt(x - 80, z) > 3 && -TR.heightAt(x + 80, z) > 3);
const K = WP.build(), mat = CM.objectMat({ side: THREE.DoubleSide, defines: {} });
for (let sp = 0; sp < 13; sp++) {
  const idx = []; for (let i = 0; i < K.idx.length; i += 3) if (K.sp[K.idx[i]] === sp) idx.push(K.idx[i], K.idx[i + 1], K.idx[i + 2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(K.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(K.col.map(v => Math.min(1, v * 1.6)), 3)); g.setAttribute('aFx', new THREE.Float32BufferAttribute(K.fx || new Float32Array(K.pos.length), 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.position.set(base[0], sea * 1.7 + 0.05, base[1] + sp * 40); m.frustumCulled = false; MAP.scene.add(m); window.__tr.push(m);
}
const HGT = [3.3, 3, 0.8, 1.1, 1.5, 1.4, 0.5, 0.7, 0.9, 1, 1.0, 4.5, 1.3];
const TREES = [['eucalypt', 0, 36], ['sheoak', 1, 30], ['banksia', 2, 22], ['paperbark', 3, 30], ['mangrove', 4, 24]];
window.__treeShots = async (only) => { const out = [], ok = (id) => !only || only.includes(id);
  gtree.uni.uStudio.value.set(0, 0, 0);
  for (const [id, sp, D] of TREES) { if (!ok(id)) continue; trees(true); r0.uni.uForceSp.value = sp; r0.uni.uStudio.value.set(X, Z, 1);
    out.push(await MAP.shot(`tree_${id}.jpg`, { walk: [X, Z + D, 0.0, 0.28], min: 690, wx: 'clear' })); }
  trees(false); r0.uni.uStudio.value.set(0, 0, 0); r0.uni.uForceSp.value = -1;
  if (ok('grasstree')) { gt(true); gtree.uni.uStudio.value.set(X, Z, 1); out.push(await MAP.shot('tree_grasstree.jpg', { walk: [X, Z + 6, 0.0, 0.12], min: 690, wx: 'clear' })); gtree.uni.uStudio.value.set(0, 0, 0); gt(false); }
  if (ok('coconutpalm')) out.push(await MAP.shot('tree_coconutpalm.jpg', { walk: [X + 300, Z + 22, 0.0, 0.3], min: 690, wx: 'clear' }));
  if (ok('pandanus')) out.push(await MAP.shot('tree_pandanus.jpg', { walk: [X + 150, Z + 157, 0.0, 0.1], min: 690, wx: 'clear' }));
  for (let sp = 0; sp < 13; sp++) { if (!ok('plant' + sp)) continue; const z = base[1] + sp * 40, H = HGT[sp], D = 1.2 + 0.9 * H;
    out.push(await MAP.shot(`plant_${sp}.jpg`, { walk: [base[0] + 0.05, z + D, 0.0, H > 2 ? 0.3 : H > 1.2 ? 0.0 : -0.25], min: 690, wx: 'clear' })); }
  return out.length; };
'ok';

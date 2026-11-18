// Lays the new birds out over the open sea, large, for a close look; then takes two shots of each (needs the shot receiver, tools/shot_server.py).
// In the page: await import('/tools/test/birdrow.mjs?' + Date.now()); then window.__birdShots()
import * as THREE from '/lib/three.module.min.js';
const WB = await import('/src/wildbirds.js?' + Date.now()), CM = await import('/src/common.js'), TR = await import('/src/terrain.js');
if (window.__bt) for (const g of window.__bt) MAP.scene.remove(g);
window.__bt = [];
const sea = MAP.U.uSeaM.value; MAP.controls.minDistance = 1; MAP.controls.maxPolarAngle = 3.1;
let base = null; const T = MAP.T;
for (let t = 0; t < 4000 && !base; t++) { const x = -T.sx / 2 + 600 + Math.random() * 400, z = (Math.random() - .5) * T.sz * 0.6; if (-TR.heightAt(x, z) > 3 && -TR.heightAt(x - 80, z) > 3 && -TR.heightAt(x + 80, z) > 3) base = [x, z]; }
window.__bbase = base;
const mat = CM.objectMat({ side: THREE.DoubleSide, defines: { BIRD: 1 } });
const FLY = [['osprey', 'OSPREY', 1.2, [0.05, 0.07, 0.09]], ['brahminy', 'BRAHMINY', 0.95, [0.05, 0.07, 0.09]], ['whistling', 'WHISTLING', 1.0, [0.05, 0.07, 0.09]], ['wedgetail', 'WEDGETAIL', 1.65, [0.05, 0.085, 0.1]], ['peregrine', 'PEREGRINE', 0.8, [0.05, 0.085, 0.09]]];
const GROUND = [['curlew', () => WB.CURLEW(), 10], ['godwit', () => WB.GODWIT(), 10], ['oystercatcher', () => WB.OYSTERCATCHER(), 10], ['stonecurlew', () => WB.STONECURLEW(), 10], ['cormorant_stand', () => WB.CORMORANT_STAND(false), 10], ['cormorant_dry', () => WB.CORMORANT_STAND(true), 10], ['swan', () => WB.BLACK_SWAN(), 7], ['cormorant_swim', () => WB.GREAT_CORMORANT(), 7]];
const names = [];
FLY.forEach(([n, k, sc, sh], i) => {
  for (const flip of [0, 1]) {
    const body = WB[k + '_FLY'](), wing = WB[k + '_WING'](), g = new THREE.Group(), b = new THREE.Mesh(body, mat), wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat);
    wl.position.set(sh[0], sh[1], sh[2]); wr.position.set(sh[0], sh[1], -sh[2]); wr.scale.z = -1; wl.rotation.x = -0.12; wr.rotation.x = 0.12; g.add(b, wl, wr); g.scale.setScalar(sc * 4);
    g.position.set(base[0], sea + 3, base[1] + i * 600 + flip * 80); g.rotation.x = flip ? Math.PI : 0; for (const m of [b, wl, wr]) m.frustumCulled = false; MAP.scene.add(g); window.__bt.push(g);
  }
  names.push(n);
});
GROUND.forEach(([n, f, sc], i) => {
  const g = new THREE.Group(), m = new THREE.Mesh(f(), mat); g.add(m); g.scale.setScalar(sc * 0.16); g.position.set(base[0] + 300, sea * 1.7 + 0.05, base[1] + i * 60); m.frustumCulled = false; MAP.scene.add(g); window.__bt.push(g); names.push(n);
});
window.__bnames = names;
window.__birdShots = async (only) => {
  const out = [];
  for (let i = 0; i < FLY.length; i++) { const n = FLY[i][0]; if (only && !only.includes(n)) continue; const sc = FLY[i][2] * 4, D = sc * 2.2;
    for (const [tag, dz, cx, cy, cz] of [["under", 80, 0.55, 20, -0.8], ['over', 0, 0.55, 20, -0.8], ['plan', 0, 0.02, 30, -0.02]]) { const z = base[1] + i * 600 + dz; out.push(await MAP.shot(`bird_${n}_${tag}.jpg`, { cam: [base[0] + D * cx, sea + cy, z + D * cz, base[0], sea + 3, z], min: 690, wx: 'clear' })); }
  }
  for (let i = 0; i < GROUND.length; i++) { const n = GROUND[i][0]; if (only && !only.includes(n)) continue; const z = base[1] + i * 60, D = 2.2;
    out.push(await MAP.shot(`bird_${n}_side.jpg`, { walk: [base[0] + 300 + 0.1, z + D, 0.0, 0.02], min: 690, wx: 'clear' }));
    out.push(await MAP.shot(`bird_${n}_front.jpg`, { walk: [base[0] + 300 + D, z + 0.1, -Math.PI / 2, 0.02], min: 690, wx: 'clear' })); }
  return out.length;
};
names.join(',');

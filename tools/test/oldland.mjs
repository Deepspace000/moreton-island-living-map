// The animals that were in the map before the new wildlife, other than the fish: laid out one by one for the glossary pictures (use inside the studio, see studio.mjs).
//   const mark = S.begin(); await import('/tools/test/oldland.mjs?' + Date.now()); S.tag(mark); S.on(); await window.__oldLandShots();
import * as THREE from '/lib/three.module.min.js';
const CR = await import('/src/creatures.js'), CM = await import('/src/common.js'), TR = await import('/src/terrain.js'), WB = await import('/src/wildbirds.js'), WL = await import('/src/wildland.js'), LF = await import('/src/life.js'), GEO = await import('/src/geo.js');
for (const g of window.__ol || []) MAP.scene.remove(g);
window.__ol = [];
const sea = MAP.U.uSeaM.value, T = MAP.T, add = (o) => { MAP.scene.add(o); window.__ol.push(o); return o; };
const find = (ok) => { for (let t = 0; t < 20000; t++) { const x = (Math.random() - .5) * (T.sx - 1000), z = (Math.random() - .5) * (T.sz - 1000); if (ok(x, z)) return [x, z]; } return null; };
const deep = find((x, z) => -TR.heightAt(x, z) > 4 && -TR.heightAt(x - 600, z) > 4 && -TR.heightAt(x + 600, z) > 4);
const shallow = find((x, z) => { const d = -TR.heightAt(x, z); return d > 0.7 && d < 1.0 && -TR.heightAt(x + 8, z) > 0.5 && -TR.heightAt(x - 8, z) > 0.5 && -TR.heightAt(x, z + 8) > 0.5 && -TR.heightAt(x, z - 8) > 0.5; });
const land = find((x, z) => { const h = TR.heightAt(x, z); return h > 4 && h < 12 && Math.abs(TR.heightAt(x + 12, z) - h) < 1 && Math.abs(TR.heightAt(x, z + 12) - h) < 1 && Math.abs(TR.heightAt(x - 12, z) - h) < 1 && Math.abs(TR.heightAt(x, z - 12) - h) < 1; });
window.__ob = { deep, shallow, land };
const mat = CM.objectMat({ side: THREE.DoubleSide, defines: { BIRD: 1 } });
const matV = CM.objectMat({ side: THREE.DoubleSide });
const E = [];          // [id, kind, ...] each laid out at its own place; shots are taken by __oldLandShots

// ---- birds with one body (standing or afloat): a mesh scaled for the picture, 60 m apart in z, at the sea
const STAND = [['pelican', () => CR.PELICAN_STAND(), 0.5, 3.2], ['pelicanafloat', () => CR.PELICAN(), 0.5, 3.0], ['seaeagle', () => CR.EAGLE_PERCH(), 0.5, 2.0], ['cormorant', () => CR.CORMORANT(), 0.5, 2.6]];
STAND.forEach(([id, f, , D], i) => { const g = new THREE.Group(), m = new THREE.Mesh(f(), mat); m.frustumCulled = false; g.add(m); g.scale.setScalar(1.0); g.position.set(deep[0], sea * 1.7 + 0.05, deep[1] + i * 60); add(g); E.push({ id, kind: 'stand', x: deep[0], z: deep[1] + i * 60, D }); });
// ---- the silver gull as it stands on the sand (life.js buildBirds, copied here: it is made in place there)
{ const sg = new GEO.GB(), WHITE = [.95, .95, .93], RED = [.85, .2, .08];
  const ell = (cx, cy, cz, rx, ry, rz, col, N = 6, Mm = 8) => { const P = (i, j) => { const th = i / N * Math.PI, ph = j / Mm * 2 * Math.PI; return [cx + Math.cos(th) * rx, cy + Math.sin(th) * Math.cos(ph) * ry, cz + Math.sin(th) * Math.sin(ph) * rz]; }; for (let i = 0; i < N; i++) for (let j = 0; j < Mm; j++) sg.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), col); };
  const GREY = [.62, .65, .68];
  // (in the map the black parts take the bird's own grey: here that grey is put in)
  ell(0.01, 0.225, 0, 0.15, 0.062, 0.066, WHITE); ell(-0.035, 0.252, 0, 0.165, 0.05, 0.072, GREY); ell(-0.2, 0.25, 0, 0.07, 0.016, 0.036, GREY, 4, 6);
  ell(0.115, 0.285, 0, 0.05, 0.045, 0.04, WHITE, 4, 6); ell(0.15, 0.33, 0, 0.046, 0.042, 0.04, WHITE);
  ell(0.215, 0.322, 0, 0.05, 0.011, 0.011, RED, 4, 5); sg.box(0.02, 0, 0.03, 0.013, 0.17, 0.013, RED); sg.box(0.02, 0, -0.03, 0.013, 0.17, 0.013, RED);
  const g = new THREE.Group(), m = new THREE.Mesh(sg.build(), matV); m.frustumCulled = false; g.add(m); g.scale.setScalar(3); g.position.set(deep[0], sea * 1.7 + 0.05, deep[1] + 4 * 60); add(g); E.push({ id: 'silvergull', kind: 'stand', x: deep[0], z: deep[1] + 4 * 60, D: 3.0 }); }

// ---- flyers made of a body and two wings, seen from below and from above (as birdrow.mjs does)
const FLY = [['pelicanfly', 'PELICAN', 1.6, [0.06, 0.1, 0.12], CR], ['seaeaglefly', 'EAGLE', 1.4, [0.05, 0.085, 0.1], CR], ['flyingfox', 'FLYINGFOX', 3.5, [0.0, 0.07, 0.05], WL], ['microbat', 'MICROBAT', 12.0, [0.0, 0.034, 0.03], WL]];
FLY.forEach(([id, k, sc, sh, M], i) => {
  const body = M[k + '_FLY'](), wing = M[k + '_WING'](), g = new THREE.Group(), b = new THREE.Mesh(body, mat), wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat);
  wl.position.set(sh[0], sh[1], sh[2]); wr.position.set(sh[0], sh[1], -sh[2]); wr.scale.z = -1; wl.rotation.x = -0.12; wr.rotation.x = 0.12; g.add(b, wl, wr); g.scale.setScalar(sc * 4);
  g.position.set(deep[0], sea + 3, deep[1] + 1500 + i * 600); for (const m of [b, wl, wr]) m.frustumCulled = false; add(g); E.push({ id, kind: 'fly', x: deep[0], z: deep[1] + 1500 + i * 600, sc: sc * 4, k: /bat|fox/.test(id) || id === 'microbat' ? 0.9 : 2.2 });
});

// ---- a tern in the air: the map draws every flying gull and tern as a small bird of fourteen triangles (life.js BIRD); the same shape here
{ const pos = [0.5, 0, 0, -0.45, 0, 0, 0, 0.08, 0, 0, -0.07, 0, 0, 0, 0.09, 0, 0, -0.09, -0.75, 0.01, 0.12, -0.75, 0.01, -0.12], tone = [0, 0, 0, 0.2, 0, 0, 0.6, 0.6], idx = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 4, 2, 1, 3, 4, 1, 5, 3, 1, 2, 5, 1, 6, 7];
  for (const s of [-1, 1]) { const k = pos.length / 3; pos.push(0.16, 0.03, 0.08 * s, -0.16, 0.03, 0.08 * s, 0.14, 0.03, 0.55 * s, -0.12, 0.03, 0.5 * s, -0.04, 0.03, 1.0 * s); tone.push(0.6, 0.6, 0.6, 0.6, 1); idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3, k + 2, k + 3, k + 4); }
  for (const [id, b2] of [['cresttern', [.75, .78, .8]], ['silvergullfly', [.62, .65, .68]]]) {
    const g = new THREE.BufferGeometry(), col = []; for (const t of tone) for (let c = 0; c < 3; c++) col.push([.95, .95, .93][c] * (1 - t) + b2[c] * t);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const gr = new THREE.Group(), m = new THREE.Mesh(g, matV); m.frustumCulled = false; gr.add(m); gr.scale.setScalar(14); const i = E.filter(e => e.kind === 'fly').length;
    gr.position.set(deep[0], sea + 3, deep[1] + 1500 + i * 600); add(gr); E.push({ id, kind: 'fly', x: deep[0], z: deep[1] + 1500 + i * 600, sc: 14, k: 1.2 }); } }

// ---- land animals of the map's own scatter system, one at a time (life.js STUDIO)
const F = (v) => v.toFixed(3);
const scat = (id, geoFn, paint, bodyFor, scale, range, at) => {
  const X = land[0] + at * 80, Z = land[1];
  const body = `float one = 1.0 - step(0.5, length(iCell)); s = ${F(scale)} * one; xz = vec2(${F(X)}, ${F(Z)}); ca = 1.0; sa = 0.0; lp = position; nrm = normal; ${bodyFor}`;
  const sc = LF.STUDIO.scatter(MAP.scene, 10, 24, LF.STUDIO.loftGeo(geoFn()), body, range, paint); sc.set(X, Z); sc.m.name = 'studio_' + id; window.__ol.push(sc.m); window.__ols = window.__ols || []; window.__ols.push(sc);
  E.push({ id, kind: 'land', x: X, z: Z, sc: scale });
};
const BD = await import('/src/bodies.js');
scat('wallaby', BD.wallaby, BD.WALLABY_PAINT, 'c = vec3(0.2);', 1.3, 420, 0);
scat('goanna', BD.goanna, BD.LIZARD_PAINT(true), 'float band = step(0.5, fract(position.x * 9.0 + 0.3)); c = mix(vec3(0.06, 0.065, 0.06), vec3(0.30, 0.27, 0.13), band * 0.55) * (0.8 + 0.4 * smoothstep(0.02, 0.1, position.y));', 1.1, 300, 1);
scat('bluetongue', BD.bluetongue, BD.LIZARD_PAINT(false), 'float band = step(0.5, fract(position.x * 5.0 + 0.3)); c = mix(mix(vec3(0.36, 0.28, 0.18), vec3(0.20, 0.16, 0.12), band), vec3(0.42, 0.44, 0.40), 0.3) * (0.8 + 0.4 * smoothstep(0.02, 0.1, position.y));', 0.45, 70, 2);

// ---- sea bed animals (seabed.js): three crabs, an octopus; and a jellyfish
const loose = (m) => { const a = MAP.seabed.meshes, k = a.indexOf(m); if (k >= 0) a.splice(k, 1); };          // (the sea bed switches its own meshes off when the eye is far away)
{ const sx = shallow[0], sz = shallow[1];
  const crabs = [['sandcrab', 0.1], ['bluecrab', 0.5], ['rockcrab', 0.9]], cl = [];          // (one call for all three: they share one shape, and a second call would take the first one's places)
  crabs.forEach(([id, tint], i) => { cl.push(sx + (i - 1) * 6, sz, 0.5, 0.55, 0.0, 0.0, 0.5, tint); E.push({ id, kind: 'sea', x: sx + (i - 1) * 6, z: sz, sc: 0.55 }); });
  { const m = MAP.seabed.studio.crab(cl); loose(m); window.__ol.push(m); }
  const mo = MAP.seabed.studio.octo([sx, sz + 6, 0.5, 0.8, 0.0, 0.0, 0.5, 0.5]); loose(mo); window.__ol.push(mo); E.push({ id: 'octopus', kind: 'sea', x: sx, z: sz + 6, sc: 0.8 });
  LF.STUDIO.jellyfish(MAP.scene, [deep[0], deep[1] + 3000, 0.9, 0.2, 3.0]); E.push({ id: 'jellyfish', kind: 'deepsea', x: deep[0], z: deep[1] + 3000, sc: 3.0 }); }

// ---- butterflies and dragonflies: the same shapes the map draws (life.js buildInsects, buildDragonflies), wings lifted a little, flat colours as in the shader
{ const mk = (pos, col, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const bp = [0, 0, 0, 0.9, 0, 1, -0.7, 0, 0.8, 0, 0, 0, -0.7, 0, -0.8, 0.9, 0, -1], bk = [0, 1, 1, 0, -1, -1], bi = [0, 1, 2, 3, 4, 5];
  const BUT = { bluetiger: (t) => { const a = [0.05, 0.05, 0.06], b = [0.45, 0.72, 0.95]; return a.map((v, i) => v + (b[i] - v) * t * 0.9); }, crow: (t) => { const a = [0.10, 0.07, 0.05], b = [0.85, 0.85, 0.8]; return a.map((v, i) => v + (b[i] - v) * t * 0.35); }, brown: (t) => { const a = [0.75, 0.42, 0.10], b = [0.35, 0.22, 0.10]; return a.map((v, i) => v + (b[i] - v) * t * 0.5); }, grassblue: () => [0.62, 0.66, 0.92] };
  let i = 0; for (const [id, f] of Object.entries(BUT)) { const pos = bp.slice(), col = []; for (let v = 0; v < 6; v++) { if (bk[v]) pos[v * 3 + 1] = 0.85; col.push(...f(Math.abs(bk[v]) > 0.5 ? 1 : 0).map(c => c * 1.3)); }
    const g = new THREE.Group(), m = new THREE.Mesh(mk(pos, col, bi), matV); m.frustumCulled = false; g.add(m); g.scale.setScalar(16); const z = deep[1] + 9000 + i * 600; g.position.set(deep[0], sea + 3, z); add(g); E.push({ id, kind: 'fly', x: deep[0], z, sc: 16, k: 1.0, only: 'plan' }); i++; }
  const dp = [-0.7, 0, 0.03, 0.4, 0, 0.03, 0.4, 0, -0.03, -0.7, 0, -0.03], dk = [0, 0, 0, 0], di = [0, 1, 2, 0, 2, 3];
  for (const x of [0.2, -0.02]) { const q = dp.length / 3; dp.push(x, 0.02, -1, x + 0.16, 0.02, -1, x + 0.1, 0.02, 0, x, 0.02, 0, x, 0.02, 1, x + 0.16, 0.02, 1); dk.push(-1, -1, 0.01, 0.01, 1, 1); di.push(q, q + 1, q + 2, q, q + 2, q + 3, q + 3, q + 2, q + 5, q + 3, q + 5, q + 4); }
  const DRG = { darner: [0.50, 0.36, 0.10], aussietiger: [0.80, 0.68, 0.10], hawker: [0.12, 0.35, 0.75] }; let j = 0;
  for (const [id, body] of Object.entries(DRG)) { const col = []; for (let v = 0; v < dk.length; v++) col.push(...(Math.abs(dk[v]) > 0.005 ? [0.78, 0.84, 0.88] : body));
    const g = new THREE.Group(), m = new THREE.Mesh(mk(dp, col, di), matV); m.frustumCulled = false; g.add(m); g.scale.setScalar(16); const z = deep[1] + 9000 + (4 + j) * 600; g.position.set(deep[0], sea + 3, z); add(g); E.push({ id, kind: 'fly', x: deep[0], z, sc: 16, k: 1.0, only: 'plan' }); j++; } }
window.__oe = E;
window.__crabShot = async (id, tint) => { const e = E.find(x => x.id === 'sandcrab'); const m = MAP.seabed.studio.crab([e.x, e.z, 0.5, 0.55, 0.0, 0.0, 0.5, tint]); loose(m); m.layers.set(1); const r = await MAP.shot('old_' + id + '.jpg', { walk: [e.x, e.z + 1.5, 0.0, -0.66], min: 690, wx: 'clear' }); MAP.scene.remove(m); return r; };
window.__oldLandShots = async (only) => { const out = [], Y = sea * 1.7;
  for (const e of E) { if (only && !only.includes(e.id)) continue; const n = 'old_' + e.id + '.jpg';
    if (e.kind === 'stand') out.push(await MAP.shot(n, { walk: [e.x + 0.1, e.z + e.D, 0.0, 0.02], min: 690, wx: 'clear' }));
    else if (e.kind === 'fly') { const D = e.sc * (e.k || 2.2), y = sea + 3; if (e.only !== 'plan') out.push(await MAP.shot(n.replace('.jpg', '_under.jpg'), { cam: [e.x + D * 0.55, y + D * 0.9, e.z - D * 0.8, e.x, y, e.z], min: 690, wx: 'clear' })); out.push(await MAP.shot(n.replace('.jpg', '_plan.jpg'), { cam: [e.x + D * 0.02, y + D * 1.3, e.z - D * 0.02, e.x, y, e.z], min: 690, wx: 'clear' })); }
    else if (e.kind === 'land') { const D = 1.2 + 2.2 * e.sc; out.push(await MAP.shot(n, { walk: [e.x, e.z + D, 0.0, -Math.atan(1.65 / D) + 0.06], min: 690, wx: 'clear' })); }
    else if (e.kind === 'sea') out.push(await MAP.shot(n, { walk: [e.x, e.z + 1.5, 0.0, -0.66], min: 690, wx: 'clear' }));
    else out.push(await MAP.shot(n, { walk: [e.x + 9, e.z + 0.1, -Math.PI / 2, -0.05], min: 690, wx: 'clear' })); }
  return out.length; };
'ok';

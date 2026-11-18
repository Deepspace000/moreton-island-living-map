// Studio for the wildlife pictures: only the things made for the picture are drawn (layer 1), against a plain graded backdrop,
// so the sea, the sky and the island are left out. In the page:
//   const S = (await import('/tools/test/studio.mjs?' + Date.now())).default;  const mark = S.begin(); ...build the subjects...; S.tag(mark); S.on();
//   ...MAP.shot(...); S.off() puts the map back.
import * as THREE from '/lib/three.module.min.js';
const S = {};
S.begin = () => new Set(MAP.scene.children);
S.tag = (mark) => { for (const c of MAP.scene.children) if (!mark.has(c)) c.traverse(o => o.layers.set(1)); };
S.on = (top = [1.0, 0.97, 0.9], bottom = [0.86, 0.82, 0.72], R = 28) => {          // (a warm paper grey: nothing like water or sky)
  const g = new THREE.SphereGeometry(R, 24, 16), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1, (p.getY(i) / R + 1) / 2)); col.push(bottom[0] + (top[0] - bottom[0]) * t, bottom[1] + (top[1] - bottom[1]) * t, bottom[2] + (top[2] - bottom[2]) * t); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
  m.frustumCulled = false; m.renderOrder = -10; m.layers.set(1); m.onBeforeRender = (r, s, cam) => m.position.copy(cam.position);
  MAP.scene.add(m); S.dome = m; MAP.camera.layers.set(1);
};
S.off = () => { if (S.dome) { MAP.scene.remove(S.dome); S.dome = null; } MAP.camera.layers.set(0); MAP.camera.layers.enable(0); };
export default S;

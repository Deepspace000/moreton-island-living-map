// People and what they bring: walkers in the townships and on the beaches, people fishing at the water's edge,
// camps dotted behind the beaches (tent, 4WD, a fire at night), name signs on the tracks and at the towns,
// and, out in deeper water, patches of reef: rocks, weed and sea cucumbers.
import * as THREE from 'three';
import { U, VEX, MOBILE, makeMat, objectMat, LOGV, LOGF, rng } from './common.js';
import { T, meshY, groundH, heightAt, maskAt } from './terrain.js';
import { GB, makeLights } from './geo.js';
import { fourWD } from './life.js';

const FAR = new THREE.Sphere(new THREE.Vector3(), 1e6);
const near = (F, re) => F.places.find(p => re.test(p.n || ''))?.p;
const TOWNS = [[/^Tangalooma/, 26, 650], [/Bulwer/, 14, 520], [/Kooringal/, 16, 560], [/Cowan/, 8, 420]];

// ---------------------------------------------------------------- people
// One rounded figure, drawn many times. Parts: 0 shirt, 1 trousers, 2 skin, 3 hat, 4 fishing rod.
// swing says how far a point of a leg or arm moves in the stride (legs and arms on opposite sides swing together).
function figure() {
  const pos = [], nrm = [], part = [], swing = [], idx = [], S = 6;
  const tube = (st, pt, sw) => {
    const base = pos.length / 3, n = st.length;
    st.forEach((c, i) => {
      const a = st[Math.min(n - 1, i + 1)], b = st[Math.max(0, i - 1)]; let t = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const l = Math.hypot(...t) || 1; t = t.map(v => v / l);
      const ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; let sd = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]]; const sl = Math.hypot(...sd) || 1; sd = sd.map(v => v / sl);
      const up = [sd[1] * t[2] - sd[2] * t[1], sd[2] * t[0] - sd[0] * t[2], sd[0] * t[1] - sd[1] * t[0]];
      for (let j = 0; j < S; j++) { const an = j / S * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), nx = sd[0] * ca + up[0] * sa, ny = sd[1] * ca + up[1] * sa, nz = sd[2] * ca + up[2] * sa; pos.push(c[0] + nx * c[3], c[1] + ny * c[3], c[2] + nz * c[3]); nrm.push(nx, ny, nz); part.push(pt); swing.push(sw ? sw(c[1]) : 0); }
    });
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < S; j++) { const q = base + i * S, j2 = (j + 1) % S; idx.push(q + j, q + S + j, q + j2, q + j2, q + S + j, q + S + j2); }
  };
  tube([[0, 0.9, 0, 0.15], [0, 1.18, 0, 0.16], [0, 1.4, 0, 0.17], [0, 1.5, 0, 0.08]], 0);                                  // trunk
  tube([[0, 1.48, 0, 0.06], [0.01, 1.58, 0, 0.105], [0.01, 1.69, 0, 0.1], [0, 1.77, 0, 0.045]], 2);                         // head
  tube([[0, 1.7, 0, 0.19], [0, 1.73, 0, 0.19], [0, 1.8, 0, 0.1], [0, 1.83, 0, 0.03]], 3);                                   // hat
  for (const sg of [-1, 1]) {
    tube([[0, 0.94, 0.09 * sg, 0.085], [0.01, 0.5, 0.09 * sg, 0.065], [0, 0.1, 0.09 * sg, 0.05], [0.11, 0.04, 0.09 * sg, 0.045]], 1, (y) => sg * Math.max(0, 0.94 - y) / 0.9);
    tube([[0, 1.4, 0.21 * sg, 0.05], [0.02, 1.12, 0.23 * sg, 0.042], [0.06, 0.86, 0.23 * sg, 0.035]], 2, (y) => -sg * Math.max(0, 1.4 - y) / 0.55);
  }
  tube([[0.1, 0.95, 0.22, 0.012], [1.2, 1.9, 0.22, 0.009], [2.4, 3.0, 0.22, 0.004]], 4);                                    // rod, held by those who fish
  return { pos, nrm, part, swing, idx };
}
function buildPeople(scene, list) {
  const f = figure(), n = list.length / 11, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(f.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(f.nrm, 3));
  g.setAttribute('aPS', new THREE.Float32BufferAttribute(f.part.flatMap((p, i) => [p, f.swing[i]]), 2)); g.setIndex(f.idx);
  const a = new Float32Array(n * 4), b = new Float32Array(n * 4), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a.set(list.slice(i * 11, i * 11 + 4), i * 4); b.set(list.slice(i * 11 + 4, i * 11 + 8), i * 4); c.set(list.slice(i * 11 + 8, i * 11 + 11), i * 3); }
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(b, 4)); g.setAttribute('iC', new THREE.InstancedBufferAttribute(c, 3)); g.instanceCount = n; g.boundingSphere = FAR;
  const mat = makeMat({
    vs: /* glsl */`
      attribute vec2 aPS; attribute vec4 iA, iB; attribute vec3 iC; varying vec3 vCol, vW;
      void main(){
        // iA: the two ends of a beat; iB: start, pace (m/s), kind (0 walks the beat, 1 stands fishing, 2 just stands), size
        float len = max(distance(iA.xy, iA.zw), 1.0), f = fract(iB.x + uTime * iB.y / len * 0.5), tri = abs(2.0 * f - 1.0), walks = step(iB.z, 0.5);
        vec2 p = mix(iA.xy, mix(iA.xy, iA.zw, smoothstep(0.03, 0.97, tri)), walks);
        vec2 dir = normalize(iA.zw - iA.xy + 1e-4) * mix(1.0, f < 0.5 ? -1.0 : 1.0, walks), side = vec2(-dir.y, dir.x);
        float stride = sin(uTime * 5.0 * iB.y + iB.x * 40.0) * walks, part = aPS.x;
        vec3 lp = position;
        lp.x += aPS.y * stride * 0.34; lp.y += abs(aPS.y * stride) * 0.05;                    // legs and arms swing as it walks
        if(part > 3.5 && (iB.z < 0.5 || iB.z > 1.5)) lp = vec3(0.0, 1.0, 0.0);                // only those fishing hold a rod
        if(part > 3.5) lp.y += sin(uTime * 0.7 + iB.x * 9.0) * 0.06 * lp.x;
        float gy = max(groundY(p), uSeaM * uVex - 0.5 * iB.w);                                // on the sand, or wading no deeper than the thigh
        // most people are indoors or in their swags after dark
        float awake = 1.0 - smoothstep(0.55, 0.85, uNight) * step(0.2, fract(iB.x * 7.7));
        float ok = awake * (1.0 - smoothstep(700.0, 1000.0, length(vec3(p.x, gy, p.y) - cameraPosition)));
        lp *= iB.w;
        vec3 wp = vec3(p.x + dir.x * lp.x + side.x * lp.z, gy + lp.y, p.y + dir.y * lp.x + side.y * lp.z);
        vec3 n = normalize(vec3(dir.x * normal.x + side.x * normal.z, normal.y, dir.y * normal.x + side.y * normal.z));
        float h1 = fract(iB.x * 3.3), h2 = fract(iB.x * 5.9);
        vec3 col = part < 0.5 ? iC : part < 1.5 ? mix(vec3(0.16, 0.2, 0.3), vec3(0.55, 0.5, 0.4), step(0.5, h1)) : part < 2.5 ? mix(vec3(0.58, 0.40, 0.30), vec3(0.33, 0.22, 0.16), step(0.7, h2))
                 : part < 3.5 ? mix(vec3(0.62, 0.56, 0.40), vec3(0.14, 0.2, 0.17), step(0.5, h2)) : vec3(0.1, 0.1, 0.1);
        vCol = col * 0.8 * (uLightCol * (max(dot(n, uLightDir), 0.0) * 0.8 + 0.12) * cloudShadow(wp) + mix(uAmbGnd, uAmbSky, n.y * 0.5 + 0.5)); vW = wp;
        gl_Position = ok <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = 'people'; m.frustumCulled = false; scene.add(m);
}

// ---------------------------------------------------------------- signs
// Each sign is two posts and a board; the names are painted once into one picture that all the boards share.
function buildSigns(scene, signs) {
  const texts = [...new Set(signs.map(s => s.text + '|' + (s.town ? 1 : 0)))].slice(0, 128), slot = new Map(texts.map((t, i) => [t, i]));
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 2048; const c = cv.getContext('2d');
  c.textAlign = 'center'; c.textBaseline = 'middle';
  texts.forEach((key, i) => {
    const [text, town] = key.split('|'), x = (i % 4) * 512, y = Math.floor(i / 4) * 64;
    c.fillStyle = town === '1' ? '#f4f1e6' : '#1d4a36'; c.fillRect(x, y, 512, 64);
    c.strokeStyle = town === '1' ? '#222' : '#e9e4cf'; c.lineWidth = 3; c.strokeRect(x + 4, y + 4, 504, 56);
    c.fillStyle = town === '1' ? '#1a1a1a' : '#f2edd8';
    let px = town === '1' ? 40 : 34; do { c.font = `600 ${px}px "Avenir Next", "Segoe UI", system-ui, sans-serif`; px -= 2; } while (c.measureText(text).width > 480 && px > 12);
    c.fillText(text, x + 256, y + 34);
  });
  const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [], col = [], idx = [], K = 1.3;
  const quad = (a, b, cc, d, u, color) => { const q = pos.length / 3; pos.push(...a, ...b, ...cc, ...d); uv.push(...(u || [-1, -1, -1, -1, -1, -1, -1, -1])); for (let i = 0; i < 4; i++) col.push(...color); idx.push(q, q + 1, q + 2, q, q + 2, q + 3); };
  for (const s of signs) {
    const i = slot.get(s.text + '|' + (s.town ? 1 : 0)); if (i === undefined) continue;
    const y = meshY(s.x, s.z); if (y < U.uSeaM.value * VEX + 0.4) continue;
    const W = (s.town ? 3.4 : 2.6) * K, Hh = (s.town ? 0.72 : 0.5) * K, y0 = y + 1.45 * K + (s.lift || 0) * (Hh + 0.1), dx = Math.cos(s.yaw), dz = Math.sin(s.yaw), nx = -dz, nz = dx;      // the board runs along (dx, dz) and faces (nx, nz)
    const u0 = (i % 4) / 4, u1 = u0 + 0.25, v0 = Math.floor(i / 4) / 32, v1 = v0 + 1 / 32;
    const P = (t, h, o) => [s.x + dx * t + nx * o, y0 + h, s.z + dz * t + nz * o];
    quad(P(-W / 2, 0, 0.05), P(W / 2, 0, 0.05), P(W / 2, Hh, 0.05), P(-W / 2, Hh, 0.05), [u0, v1, u1, v1, u1, v0, u0, v0], [1, 1, 1]);
    quad(P(W / 2, 0, -0.05), P(-W / 2, 0, -0.05), P(-W / 2, Hh, -0.05), P(W / 2, Hh, -0.05), [u0, v1, u1, v1, u1, v0, u0, v0], [1, 1, 1]);
    for (const t of [-W / 2 + 0.25, W / 2 - 0.25]) for (const [ax, az] of [[0.07, 0], [0, 0.07]]) {               // each post as two crossed slats
      const p = (h, k) => [s.x + dx * t + dx * ax * k + nx * az * k, y - 0.3 + h, s.z + dz * t + dz * ax * k + nz * az * k];
      quad(p(0, -1), p(0, 1), p(y0 - y + Hh + 0.5, 1), p(y0 - y + Hh + 0.5, -1), null, [0.34, 0.27, 0.2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.boundingSphere = FAR;
  const mat = makeMat({
    side: THREE.DoubleSide, uniforms: { uMap: { value: tex } },
    vs: /* glsl */`attribute vec2 aUV; attribute vec3 aCol; varying vec2 vUV; varying vec3 vC, vW;
      void main(){ vUV = aUV; vC = aCol; vW = position; float far = 1.0 - step(1500.0, length(position - cameraPosition)); gl_Position = far < 0.5 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`uniform sampler2D uMap; varying vec2 vUV; varying vec3 vC, vW;
      void main(){ ${LOGF} vec3 c = vUV.x < 0.0 ? vC : texture2D(uMap, vUV).rgb; c *= uLightCol * (0.25 + 0.5 * max(uLightDir.y, 0.0)) * cloudShadow(vW) + uAmbSky * 0.9; gl_FragColor = vec4(applyFog(c, vW), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = 'signs'; m.frustumCulled = false; scene.add(m);
}
function collectSigns(F) {
  const out = [], seen = new Set(), put = (text, x, z, yaw, town) => { const k = text + Math.round(x / 40) + ',' + Math.round(z / 40); if (!text || seen.has(k)) return; seen.add(k);
    const o = town ? null : out.find(s => !s.town && Math.hypot(s.x - x, s.z - z) < 9);       // tracks that meet share one post, boards stacked
    if (o) { if (o.n < 4) out.push({ text, x: o.x, z: o.z, yaw: o.yaw, town, lift: o.n++ }); } else out.push({ text, x, z, yaw, town, lift: 0, n: 1 }); };
  const ends = new Map();                       // a name can run over several pieces of track: sign its two far ends
  for (const r of F.roads) { if (!r.n || r.n === 'Beach' || r.p.length < 2) continue; const e = ends.get(r.n) || { a: r, b: r }; e.b = r; ends.set(r.n, e); }
  for (const [name, e] of ends) {
    const A = e.a.p[0], A2 = e.a.p[1], B = e.b.p[e.b.p.length - 1], B2 = e.b.p[e.b.p.length - 2];
    const at = (p, q) => { const tx = q[0] - p[0], tz = q[1] - p[1], l = Math.hypot(tx, tz) || 1; put(name, p[0] - tz / l * 4, p[1] + tx / l * 4, Math.atan2(tx, -tz), false); };       // beside the track, board square across it
    at(A, A2); if (Math.hypot(B[0] - A[0], B[1] - A[1]) > 150) at(B, B2);
  }
  const roadPt = (p, r) => { let best = null, bd = r; for (const rd of F.roads) for (const q of rd.p) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } return best; };
  for (const p of F.places) if (/hamlet|village/.test(p.k)) { const q = roadPt(p.p, 500) || p.p; put(p.n.toUpperCase(), q[0] + 5, q[1] + 3, 0.3, true); }
  const point = (list, fix) => { for (const o of list) { let p = o.c || o.p; if (!o.n || !p) continue;
    if (typeof p[0] !== 'number') { const c = p.reduce((a, v) => [a[0] + v[0] / p.length, a[1] + v[1] / p.length], [0, 0]), r = roadPt(c, 900) || p[0]; let e = p[0]; for (const v of p) if (Math.hypot(v[0] - r[0], v[1] - r[1]) < Math.hypot(e[0] - r[0], e[1] - r[1])) e = v; const l = Math.hypot(e[0] - c[0], e[1] - c[1]) || 1; p = [e[0] + (e[0] - c[0]) / l * 22, e[1] + (e[1] - c[1]) / l * 22]; }
    const q = roadPt(p, 250); put(fix ? fix(o.n) : o.n, p[0] + 3, p[1] + 3, q ? Math.atan2(q[0] - p[0], -(q[1] - p[1])) : 0.5, false); } };
  point(F.views, (n) => n === 'Ship Wrecks' ? 'Bulwer Wrecks' : n); point(F.lakes, (n) => n.replace(/ \(.*\)/, '')); point(F.peaks); point(F.sandnames); point(F.misc);
  point(F.camps.filter(c => !/Sunrover|Escapes|WBS/.test(c.n || '')));
  return out;
}

// ---------------------------------------------------------------- camps
function buildCamps(scene, F, people, R) {
  const g = new GB(), lights = makeLights(90), K = VEX * 0.9, cars = []; let fires = 0;
  const TENT = [[.85, .35, .15], [.2, .45, .7], [.3, .6, .35], [.9, .75, .2], [.75, .75, .7], [.55, .25, .5], [.2, .3, .25]];
  const dome = (x, z, r, col) => {            // a dome tent: rounded, with a darker door panel
    const y = meshY(x, z) - 0.05, rings = 4, S = 10, a0 = R() * 6.283, P = (i, j) => { const e = i / rings * Math.PI / 2, a = a0 + j / S * Math.PI * 2; return [x + Math.cos(a) * Math.cos(e) * r, y + Math.sin(e) * r * 0.78 * K, z + Math.sin(a) * Math.cos(e) * r]; };
    for (let i = 0; i < rings; i++) for (let j = 0; j < S; j++) g.quad(P(i, j + 1), P(i, j), P(i + 1, j), P(i + 1, j + 1), j === 0 && i < 2 ? [col[0] * .45, col[1] * .45, col[2] * .45] : [col[0] * (0.9 + 0.1 * (j % 2)), col[1] * (0.9 + 0.1 * (j % 2)), col[2] * (0.9 + 0.1 * (j % 2))]);
  };
  const stander = (x, z) => people.push(x, z, x + R() - 0.5, z + R() - 0.5, R(), 0, 2, 1.25 + R() * 0.12, 0.3 + R() * 0.6, 0.3 + R() * 0.5, 0.25 + R() * 0.5);
  const spots = [];
  const camp = (x, z, big) => {
    spots.push([x, z]);
    const n = big ? 3 + ((R() * 3) | 0) : 1 + ((R() * 2) | 0);
    for (let i = 0; i < n; i++) dome(x + (R() - .5) * (big ? 30 : 9), z + (R() - .5) * (big ? 30 : 9), 1.3 + R() * 0.7, TENT[(R() * TENT.length) | 0]);
    for (let i = 0; i < (big ? 3 : 1 + (R() < 0.5 ? 1 : 0)); i++) stander(x + (R() - .5) * 10, z + (R() - .5) * 10);
    if (R() < (big ? 1 : 0.65)) cars.push([x + (R() - .5) * 5, z + (R() < 0.5 ? -1 : 1) * (7 + R() * 4), R() * 6.283]);
    if (fires++ < 88) lights.add([x + 2, meshY(x + 2, z) + 0.8, z + 2], [1, .5, .15], -1, 1, R(), 1.5);
  };
  for (const c of F.camps) camp(c.p[0] + 12, c.p[1] + 8, true);
  // and here and there behind the beaches, wherever a 4WD could pull off the sand
  for (const r of F.beach || []) for (let i = 14 + ((R() * 20) | 0); i < r.p.length - 10; i += 26 + ((R() * 40) | 0)) {
    const p = r.p[i], z = p[1]; let x = p[0], ok = false;
    for (let t = 0; t < 26 && !ok; t++) { x -= r.side * 6; const m = maskAt(x, z), h = groundH(x, z); ok = m.land > 0.9 && m.sand < 0.45 && h > 2.2; }      // walk inland to where the bush starts
    const h = groundH(x, z); if (!ok || h > 14 || Math.abs(groundH(x + 6, z) - h) > 2.2 || Math.abs(groundH(x, z + 6) - h) > 2.2) continue;
    camp(x, z, false);
  }
  const mesh = new THREE.Mesh(g.build(), objectMat({ side: THREE.DoubleSide })); mesh.name = 'camps'; mesh.frustumCulled = false; scene.add(mesh);
  const carMat = objectMat({ side: THREE.DoubleSide }), COLS = [[.9, .9, .88], [.16, .18, .16], [.62, .12, .10], [.72, .66, .50], [.13, .22, .40]], geos = COLS.map(fourWD);
  for (const [x, z, a] of cars) { const m = new THREE.Mesh(geos[(R() * geos.length) | 0], carMat); m.position.set(x, meshY(x, z), z); m.rotation.y = a; m.scale.setScalar(1.45); m.frustumCulled = false; scene.add(m); }
  scene.add(lights.pts); lights.pts.material.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2);
  return spots;
}

// ---------------------------------------------------------------- reef patches
// In deeper water off the bay shore: a few rounded rocks grown over with weed, fronds swaying in the current,
// and sea cucumbers lying on the sand between them.
function buildReefs(scene, R) {
  const pos = [], nrm = [], col = [], sway = [], idx = [];
  const ico = new THREE.IcosahedronGeometry(1, 2).attributes.position;
  const rock = (x, y, z, r, seed) => {
    const b = pos.length / 3;
    for (let i = 0; i < ico.count; i++) {
      const nx = ico.getX(i), ny = ico.getY(i), nz = ico.getZ(i), lump = 1 + 0.16 * Math.sin(nx * 2.6 + seed) * Math.sin(ny * 2.1 + seed * 1.7) + 0.10 * Math.sin(nz * 3.4 + seed * 2.3) + 0.05 * Math.sin(nx * 7.0 + nz * 6.0 + seed);
      pos.push(x + nx * r * lump, y + (ny * 0.5 + 0.2) * r * lump, z + nz * r * lump * (0.8 + 0.4 * Math.sin(seed))); nrm.push(nx * 0.7, ny * 1.4, nz * 0.7); sway.push(0);
      const top = Math.max(0, ny), m = 0.8 + 0.2 * Math.sin(nx * 5 + seed * 3) * Math.sin(nz * 4 + seed); col.push((0.20 + 0.02 * top) * m, (0.18 + 0.13 * top) * m, (0.15 + 0.02 * top) * m);
      idx.push(b + i);
    }
  };
  // one plant: a bunch of fronds from one holdfast, each a ribbon that curves outward and tapers to a rounded tip
  const weed = (x, y, z, h, kind) => {
    const c = kind === 2 ? [0.22, 0.52, 0.18] : kind ? [0.14, 0.38, 0.14] : [0.46, 0.33, 0.11], fronds = kind === 2 ? 5 : 4 + ((R() * 3) | 0), N = 5;
    for (let f = 0; f < fronds; f++) {
      const b = pos.length / 3, a = R() * 6.283, out = (kind === 2 ? 0.7 : 0.25 + R() * 0.3) * h, w = (kind === 2 ? 0.04 : 0.09 + R() * 0.09), fh = h * (0.6 + R() * 0.4), tw = R() * 6.283, sh = 0.75 + R() * 0.4;
      for (let j = 0; j <= N; j++) {
        const u = j / N, ww = w * Math.sin(Math.min(1, u * 1.15 + 0.12) * Math.PI) ** 0.6, o = out * u * u, ta = tw + u * 1.6, px = x + Math.cos(a) * o, pz = z + Math.sin(a) * o, yy = y + fh * (u - 0.25 * u * u);
        for (const sd of [-1, 1]) { pos.push(px + Math.cos(ta) * ww * sd, yy, pz + Math.sin(ta) * ww * sd); nrm.push(0, 1, 0); sway.push(u * u * fh); const k = sh * (0.6 + 0.6 * u); col.push(c[0] * k, c[1] * k, c[2] * k); }
        if (j) { const q = b + j * 2; idx.push(q - 2, q - 1, q, q, q - 1, q + 1); }
      }
    }
  };
  const cucumber = (x, y, z) => {
    const b = pos.length / 3, a = R() * 6.283, L = 0.5 + R() * 0.4, r = 0.07 + R() * 0.05, bend = (R() - 0.5) * 0.3, S = 6, N = 5, dark = 0.04 + R() * 0.08;
    for (let i = 0; i <= N; i++) { const u = i / N - 0.5, rr = r * Math.sqrt(Math.max(0.05, 1 - 4 * u * u * 0.9)), cx = x + Math.cos(a) * u * L - Math.sin(a) * bend * (0.25 - u * u), cz = z + Math.sin(a) * u * L + Math.cos(a) * bend * (0.25 - u * u);
      for (let j = 0; j < S; j++) { const an = j / S * Math.PI * 2; pos.push(cx - Math.sin(a) * Math.cos(an) * rr, y + r + Math.sin(an) * rr, cz + Math.cos(a) * Math.cos(an) * rr); nrm.push(-Math.sin(a) * Math.cos(an), Math.sin(an), Math.cos(a) * Math.cos(an)); sway.push(0); const k = 1 + 0.4 * ((i + j) % 2); col.push(dark * k * 1.2, dark * k, dark * k * 0.8); } }
    for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) { const q = b + i * S, j2 = (j + 1) % S; idx.push(q + j, q + S + j, q + j2, q + j2, q + S + j, q + S + j2); }
  };
  let patches = 0; const spots = [];
  for (let t = 0; t < 6000 && patches < (MOBILE ? 22 : 40); t++) {
    const x = (R() - 0.5) * (T.sx - 1200), z = (R() - 0.5) * (T.sz - 1200), d = -heightAt(x, z), m = maskAt(x, z);
    if (d < 3 || d > 10 || m.shore < -1400 || m.expo > 0.6) continue;
    patches++; spots.push([x, z]);
    const rocks = [];
    for (let i = 0; i < 5 + ((R() * 6) | 0); i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * 8, rx = x + Math.cos(a) * rr, rz = z + Math.sin(a) * rr, r = 0.6 + R() * R() * 2.2; rocks.push([rx, rz, r]); rock(rx, meshY(rx, rz) - r * 0.15, rz, r, R() * 20); }
    for (let i = 0; i < 30; i++) { const k = rocks[(R() * rocks.length) | 0], a = R() * 6.283, rr = k[2] * (0.5 + R() * 1.3), wx = k[0] + Math.cos(a) * rr, wz = k[1] + Math.sin(a) * rr; weed(wx, meshY(wx, wz) + (rr < k[2] ? k[2] * 0.3 * VEX : -0.05), wz, (0.5 + R() * 1.1) * VEX, R() < 0.45 ? 1 : 0); }
    for (let i = 0; i < 18; i++) { const a = R() * 6.283, rr = 2 + Math.sqrt(R()) * 12, wx = x + Math.cos(a) * rr, wz = z + Math.sin(a) * rr; weed(wx, meshY(wx, wz) - 0.03, wz, (0.25 + R() * 0.3) * VEX, 2); }       // tufts of sea grass on the sand around
    for (let i = 0; i < 5 + ((R() * 5) | 0); i++) { const a = R() * 6.283, rr = 2 + R() * 8, cx = x + Math.cos(a) * rr, cz = z + Math.sin(a) * rr; cucumber(cx, meshY(cx, cz), cz); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx); g.boundingSphere = FAR;
  const mat = makeMat({
    side: THREE.DoubleSide,
    vs: /* glsl */`attribute vec3 aCol; attribute float aSway; varying vec3 vCol, vW;
      void main(){
        vec3 wp = position;
        wp.xz += vec2(sin(uTime * 0.9 + position.x * 0.7 + position.z * 0.4), cos(uTime * 0.7 + position.z * 0.6)) * aSway * 0.22;     // fronds lean and return with the surge
        vec3 col = aCol * (uLightCol * (0.25 + 0.55 * max(uLightDir.y, 0.0)) * (0.45 + 0.55 * max(dot(normalize(normal), normalize(uLightDir + vec3(0.0, 1.0, 0.0))), 0.0)) * cloudShadow(wp) + uAmbSky * 0.8);
        float dw = (uSeaM * uVex - wp.y) / uVex;
        if(dw > 0.0){ vec3 Tm = exp(-vec3(0.42, 0.082, 0.105) * dw * 2.3); col = col * Tm + vec3(0.012, 0.20, 0.18) * (uLightCol * 0.3 + uAmbSky * 0.8) * (1.0 - Tm); }
        vCol = col; vW = wp;
        gl_Position = length(wp - cameraPosition) > 900.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = 'reefs'; m.frustumCulled = false; scene.add(m);
  return spots;
}

export function buildFolk(scene, F) {
  const R = rng(8642), K = MOBILE ? 0.6 : 1, people = [];
  const shirt = () => { const c = [[.85, .2, .15], [.15, .35, .7], [.9, .85, .8], [.2, .55, .35], [.95, .7, .15], [.3, .3, .32], [.8, .4, .6], [.25, .6, .75]][(R() * 8) | 0]; return c; };
  // walkers on the streets of each township, and along its beach
  for (const [re, n, rad] of TOWNS) {
    const c = near(F, re); if (!c) continue;
    const streets = F.roads.filter(r => r.n !== 'Beach' && r.p.length > 1 && r.p.some(p => Math.hypot(p[0] - c[0], p[1] - c[1]) < rad));
    for (let i = 0; i < n * K && streets.length; i++) {
      const r = streets[(R() * streets.length) | 0], k = (R() * (r.p.length - 1)) | 0, a = r.p[k]; let j = k + 1;
      while (j < r.p.length - 1 && Math.hypot(r.p[j][0] - a[0], r.p[j][1] - a[1]) < 25 + R() * 40) j++;
      const b = r.p[j], ox = (R() - .5) * 3, oz = (R() - .5) * 3;
      if (Math.hypot(a[0] - c[0], a[1] - c[1]) > rad * 1.3 || meshY(a[0], a[1]) < 0.5) continue;
      people.push(a[0] + ox, a[1] + oz, b[0] + ox, b[1] + oz, R(), 1.1 + R() * 0.5, 0, 1.25 + R() * 0.15, ...shirt());
    }
    // the water's edge in front of the town: find where the sand meets the sea, then people fishing along it and others strolling
    for (let i = 0; i < 9 * K; i++) {
      const z = c[1] + (R() - .5) * rad * 1.6; let x = c[0];
      for (let t = 0; t < 240 && groundH(x, z) > 0.75; t++) x -= 3;
      if (groundH(x, z) > 0.75 || groundH(x + 30, z) < 0.6) continue;
      if (i % 3) people.push(x, z, x - 8, z, R(), 0, 1, 1.25 + R() * 0.15, ...shirt());                                  // fishing, facing the water
      else people.push(x + 7, z - 20 - R() * 30, x + 7, z + 20 + R() * 30, R(), 1.0 + R() * 0.4, 0, 1.25 + R() * 0.15, ...shirt());   // walking the beach
    }
  }
  const camps = buildCamps(scene, F, people, R), signs = collectSigns(F);
  buildPeople(scene, people);
  buildSigns(scene, signs);
  return { people, camps, signs, reefs: buildReefs(scene, R) };
}

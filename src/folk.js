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
// Signposts stand only where tracks meet. Each has one pointed board for every way on from there, naming what that
// way leads to and how far it is (worked out along the tracks and the beach highways, not as the crow flies).
function trackGraph(F) {
  const nodes = new Map(), list = [], H = Math.hypot;
  const node = (p) => { const k = Math.round(p[0] / 4) + ',' + Math.round(p[1] / 4); let n = nodes.get(k); if (!n) { n = { i: list.length, p, e: [] }; nodes.set(k, n); list.push(n); } return n; };
  const link = (a, b, o) => { if (a === b || a.e.some(e => e.to === b)) return; const d = H(a.p[0] - b.p[0], a.p[1] - b.p[1]); a.e.push({ to: b, d, ...o }); b.e.push({ to: a, d, ...o }); };
  for (const r of F.roads) { if (r.c === 3 || r.p.length < 2) continue; for (let i = 1; i < r.p.length; i++) link(node(r.p[i - 1]), node(r.p[i]), { n: r.n || '', c: r.c }); }
  const roadN = list.length;
  for (const r of F.beach || []) for (let i = 1; i < r.p.length; i++) link(node(r.p[i - 1]), node(r.p[i]), { n: r.side > 0 ? 'Eastern Beach' : 'Western Beach', c: 3 });
  for (let i = 0; i < roadN; i++) {                 // a track that ends at the back of a beach joins the beach highway there
    const a = list[i]; if (a.e.length !== 1) continue;
    let best = null, bd = 170; for (let j = roadN; j < list.length; j++) { const d = H(list[j].p[0] - a.p[0], list[j].p[1] - a.p[1]); if (d < bd) { bd = d; best = list[j]; } }
    if (best) link(a, best, { n: a.e[0].n, c: a.e[0].c });
  }
  return list;
}
function shortest(list, src) {                      // how far every point of the network is, and which way out of src the shortest route takes
  const dist = new Float64Array(list.length).fill(Infinity), first = new Int16Array(list.length).fill(-1), hd = [], hi = [];
  const push = (d, i) => { let k = hd.length; hd.push(d); hi.push(i); while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= d) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = d; hi[k] = i; };
  const pop = () => { const top = hi[0], d = hd.pop(), i = hi.pop(), n = hd.length; if (n) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && hd[c + 1] < hd[c]) c++; if (hd[c] >= d) break; hd[k] = hd[c]; hi[k] = hi[c]; k = c; } hd[k] = d; hi[k] = i; } return top; };
  dist[src.i] = 0; src.e.forEach((e, k) => { if (e.d < dist[e.to.i]) { dist[e.to.i] = e.d; first[e.to.i] = k; push(e.d, e.to.i); } });
  const done = new Uint8Array(list.length); done[src.i] = 1;
  while (hd.length) { const i = pop(); if (done[i]) continue; done[i] = 1; for (const e of list[i].e) { const d = dist[i] + e.d; if (d < dist[e.to.i]) { dist[e.to.i] = d; first[e.to.i] = first[i]; push(d, e.to.i); } } }
  return { dist, first };
}
function collectSigns(F) {
  const list = trackGraph(F), H = Math.hypot, pois = [];
  const poi = (name, p, r, major) => {
    if (!name || !p) return;
    let best = null, bd = r; for (const n of list) { const d = H(n.p[0] - p[0], n.p[1] - p[1]); if (d < bd) { bd = d; best = n; } }
    if (best && !pois.some(q => H(q.node.p[0] - best.p[0], q.node.p[1] - best.p[1]) < 90)) pois.push({ name, node: best, major });
  };
  const mid = (pl) => pl.reduce((a, v) => [a[0] + v[0] / pl.length, a[1] + v[1] / pl.length], [0, 0]);
  for (const p of F.places) if (/hamlet|village/.test(p.k) || p.n === 'Cape Moreton') poi(p.n, p.p, 600, 1);
  for (const v of F.views) poi(v.n === 'Ship Wrecks' ? 'Bulwer Wrecks' : v.n.replace(' Viewing', ''), v.c || v.p, 350, 0);
  for (const c of F.camps) if (!/Sunrover|Escapes|WBS/.test(c.n || '')) poi(c.n.replace('camping area', 'Camping Area'), c.p, 350, 0);
  for (const l of F.lakes) if (l.n) poi(l.n.replace(/ \(.*\)/, ''), mid(l.p), 600, 0);
  for (const s of F.sandnames) poi(s.n, s.p, 500, 0);
  for (const s of F.misc) poi(s.n, s.p, 350, 0);
  const wet = [...F.lakes, ...(F.pools || [])].map(l => l.p), inside = (pl, x, z) => { let c = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const a = pl[i], b = pl[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const far = (d) => d < 950 ? Math.max(50, Math.round(d / 50) * 50) + ' m' : d < 9950 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 1000) + ' km';
  const posts = [];
  const tracks = (J) => J.e.filter(e => e.c >= 1).length;
  for (const J of list.filter(J => J.e.length > 2 && tracks(J)).sort((a, b) => tracks(b) - tracks(a) || b.e.length - a.e.length)) {       // the bigger meetings of tracks first
    if (posts.some(q => H(q.jx - J.p[0], q.jz - J.p[1]) < 160)) continue;       // street corners inside the towns carry no signposts
    const { dist, first } = shortest(list, J), boards = [], dirs = [];
    J.e.forEach((e, k) => {
      let a = J, b = e.to, g = 0; while (H(b.p[0] - J.p[0], b.p[1] - J.p[1]) < 18 && b.e.length === 2 && g++ < 8) { const nx = b.e[0].to === a ? b.e[1].to : b.e[0].to; a = b; b = nx; }
      const l = H(b.p[0] - J.p[0], b.p[1] - J.p[1]) || 1, dir = [(b.p[0] - J.p[0]) / l, (b.p[1] - J.p[1]) / l]; dirs.push(Math.atan2(dir[1], dir[0]));
      const mine = pois.filter(q => first[q.node.i] === k && dist[q.node.i] > 250).sort((p, q) => dist[p.node.i] - dist[q.node.i]);
      const town = mine.find(q => q.major), minor = mine.filter(q => !q.major && dist[q.node.i] < 12000).slice(0, town ? 1 : 2);
      const pick = [...minor, town].filter(Boolean).sort((p, q) => dist[p.node.i] - dist[q.node.i]);
      if (!pick.length && e.n && e.c >= 1 && !/Street|Lane|Place|Close|Crescent|Drive/.test(e.n) && !boards.some(b => b.text === e.n)) boards.push({ text: e.n, dir, c: e.c, d: 9e8 });
      for (const q of pick) boards.push({ text: q.name + '  ' + far(dist[q.node.i]), dir, c: e.c, d: dist[q.node.i] });
    });
    if (!boards.some(b => b.d < 9e8)) continue;
    while (boards.length > 5) boards.splice(boards.reduce((m, b, i) => b.d > boards[m].d ? i : m, 0), 1);
    dirs.sort((a, b) => a - b);                    // the post stands in the widest gap between the ways that meet
    let ga = 0, gw = -1; dirs.forEach((a, i) => { const nx = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + Math.PI * 2; if (nx - a > gw) { gw = nx - a; ga = a + (nx - a) / 2; } });
    const off = Math.min(7, 3.2 / Math.max(0.3, Math.sin(Math.min(gw, Math.PI) / 2))), x = J.p[0] + Math.cos(ga) * off, z = J.p[1] + Math.sin(ga) * off;
    if (meshY(x, z) < 2.2 * VEX || wet.some(pl => inside(pl, x, z))) continue;
    posts.push({ x, z, jx: J.p[0], jz: J.p[1], boards });
  }
  return posts;
}
function buildSigns(scene, posts) {
  // one small picture of the alphabet; every board is spelled out of it letter by letter
  const COLS = 12, CW = 42, CH = 64, EM = 40, cv = document.createElement('canvas'); cv.width = cv.height = 512; const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `700 ${EM}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const adv = {}; for (let i = 32; i < 127; i++) { const ch = String.fromCharCode(i), k = i - 32; adv[ch] = Math.min(CW - 2, c.measureText(ch).width) / EM; c.fillText(ch, (k % COLS) * CW + CW / 2, Math.floor(k / COLS) * CH + 46); }
  const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [], col = [], nr = [], idx = [], K = 1.3, WOOD = [0.16, 0.12, 0.085], INK = [-1, -1, -1, -1, -1, -1, -1, -1];
  const quad = (a, b, cc, d, u, color, n) => { const q = pos.length / 3; pos.push(...a, ...b, ...cc, ...d); uv.push(...u); for (let i = 0; i < 4; i++) { col.push(...color); nr.push(n ? n[0] : 0, n ? n[1] : 0); } idx.push(q, q + 1, q + 2, q, q + 2, q + 3); };
  const width = (s, size) => { let w = 0; for (const ch of s) w += (adv[ch] ?? 0.5) * size; return w; };
  const write = (s, o, r, n, size, color) => {     // o: where the text starts (its baseline), r: the way it reads, n: the side it faces
    let pen = 0;
    for (const ch of s) {
      const k = ch.charCodeAt(0) - 32, a = adv[ch] ?? 0.5, w = a * size;
      if (k > 0 && k < 95) {
        const uc = ((k % COLS) * CW + CW / 2) / 512, hw = a * EM / 2 / 512, v0 = Math.floor(k / COLS) * CH / 512, v1 = v0 + CH / 512, yb = o[1] - (CH - 46) / EM * size, yt = yb + CH / EM * size;
        const A = [o[0] + r[0] * pen + n[0] * 0.025, yb, o[2] + r[1] * pen + n[1] * 0.025], B = [A[0] + r[0] * w, yb, A[2] + r[1] * w];
        quad(A, B, [B[0], yt, B[2]], [A[0], yt, A[2]], [uc - hw, v1, uc + hw, v1, uc + hw, v0, uc - hw, v0], color, n);
      }
      pen += w;
    }
  };
  for (const p of posts) {
    const y = meshY(p.x, p.z), Hb = 0.36 * K, gap = 0.06 * K, size = 0.2 * K, top = y + (2.0 + p.boards.length * 0.42) * K, pw = 0.07 * K;
    for (const [ax, az] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const bx = -az, bz = ax, P = (h, s) => [p.x + ax * pw + bx * pw * s, y - 0.4 + h, p.z + az * pw + bz * pw * s]; quad(P(0, -1), P(0, 1), P(top - y + 0.55, 1), P(top - y + 0.55, -1), INK, WOOD); }
    p.boards.forEach((b, i) => {
      const y1 = top - i * (Hb + gap), y0 = y1 - Hb, tw = width(b.text, size), pad = 0.14 * K, s0 = -0.12 * K, s1 = pw + pad * 2 + tw, tip = Hb * 0.55, d = b.dir;
      const color = b.c === 2 ? [0.13, 0.065, 0.025] : b.c === 3 ? [0.015, 0.075, 0.17] : [0.012, 0.085, 0.04];        // brown for walking tracks, blue along the beach, green for vehicle tracks
      const P = (s, h) => [p.x + d[0] * s, h, p.z + d[1] * s];
      quad(P(s0, y0), P(s1, y0), P(s1, y1), P(s0, y1), INK, color);
      quad(P(s1, y0), P(s1 + tip, (y0 + y1) / 2), P(s1 + tip, (y0 + y1) / 2), P(s1, y1), INK, color);
      const base = y0 + Hb * 0.5 - size * 0.36;
      write(b.text, P(pw + pad, base), d, [-d[1], d[0]], size, color);                    // from one side it reads away from the post
      write(b.text, P(s1 - pad, base), [-d[0], -d[1]], [d[1], -d[0]], size, color);       // from the other, toward it
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nr, 2));
  g.setIndex(idx); g.boundingSphere = FAR;
  const mat = makeMat({
    side: THREE.DoubleSide, uniforms: { uMap: { value: tex } },
    vs: /* glsl */`attribute vec2 aUV, aN; attribute vec3 aCol; varying vec2 vUV, vN; varying vec3 vC, vW;
      void main(){ vUV = aUV; vC = aCol; vN = aN; vW = position; gl_Position = length(position - cameraPosition) > 1200.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`uniform sampler2D uMap; varying vec2 vUV, vN; varying vec3 vC, vW;
      void main(){ ${LOGF}
        if(dot(vN, vN) > 0.5 && dot(vN, cameraPosition.xz - vW.xz) < 0.0) discard;                     // lettering shows only from the side it is painted on
        vec3 c = vUV.x < 0.0 ? vC : mix(vC, vec3(0.86, 0.86, 0.80), smoothstep(0.25, 0.65, texture2D(uMap, vUV).r));
        c *= uLightCol * (0.25 + 0.5 * max(uLightDir.y, 0.0)) * cloudShadow(vW) + uAmbSky * 0.9; gl_FragColor = vec4(applyFog(c, vW), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = 'signs'; m.frustumCulled = false; scene.add(m);
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
  const carMat = objectMat({ side: THREE.DoubleSide, defines: { CAR: 1 } }), COLS = [[.9, .9, .88], [.16, .18, .16], [.62, .12, .10], [.72, .66, .50], [.13, .22, .40]], geos = COLS.map(fourWD);
  for (const [x, z, a] of cars) {             // parked on its four wheels: it takes the slope of the ground it stands on
    const m = new THREE.Mesh(geos[(R() * geos.length) | 0], carMat), S = 1.45, fx = Math.cos(a), fz = -Math.sin(a), Y = (f, s) => meshY(x + (fx * f * 1.5 + -fz * s * 0.9) * S, z + (fz * f * 1.5 + fx * s * 0.9) * S);
    const yFL = Y(1, -1), yFR = Y(1, 1), yBL = Y(-1, -1), yBR = Y(-1, 1), pitch = Math.atan2((yFL + yFR - yBL - yBR) / 2, 3 * S), roll = -Math.atan2((yFR + yBR - yFL - yBL) / 2, 1.8 * S);
    m.rotation.order = 'YZX'; m.position.set(x, (yFL + yFR + yBL + yBR) / 4 + 0.02, z); m.rotation.set(roll, a, pitch); m.scale.setScalar(S); m.frustumCulled = false; scene.add(m);
  }
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

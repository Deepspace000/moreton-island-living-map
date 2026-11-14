// Everything that sits on the island: buildings, tracks and walking paths, trees,
// the wrecks, lighthouses, jetty, navigation marks, lakes and the name labels.
import * as THREE from 'three';
import { U, VEX, MOBILE, LOW, Q, makeMat, objectMat, LOGV, LOGF, rng, clamp } from './common.js';
import { T, meshY, groundH, heightAt, maskAt, albedoAt } from './terrain.js';
import { GB, makeLights } from './geo.js';

const seaY = () => U.uSeaM.value * VEX;
const cellKey = (x, z, s) => (Math.floor(x / s) + 8192) * 16384 + (Math.floor(z / s) + 8192);

// ---------------------------------------------------------------- buildings
const WALLS = [[.93, .90, .83], [.90, .84, .70], [.84, .77, .62], [.95, .94, .91], [.76, .68, .55], [.86, .82, .73], [.80, .88, .88], [.92, .85, .60]];
const ROOFS = [[.70, .72, .72], [.38, .52, .44], [.68, .27, .18], [.78, .73, .62], [.28, .40, .54], [.86, .86, .84], [.52, .54, .55], [.74, .36, .24], [.58, .65, .60]];
function buildBuildings(F, g, occ, casters, lights) {
  const R = rng(11); let nl = 0;
  for (const b of F.buildings) {
    let pts = b.p; const n = pts.length; if (n < 3 || b.lh || b.k === 'ship') continue;      // outlines of wrecked ships are not houses: see the Bulwer wrecks
    let A2 = 0, cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A2 += p[0] * q[1] - q[0] * p[1]; cx += p[0]; cz += p[1]; }
    if (A2 < 0) pts = pts.slice().reverse();
    const area = Math.abs(A2) / 2; cx /= n; cz /= n;
    if (area < 6) continue;
    let base = meshY(cx, cz), hi = base;
    for (const p of pts) { const y = meshY(p[0], p[1]); base = Math.min(base, y); hi = Math.max(hi, y); occ.add(cellKey(p[0], p[1], 6)); }
    occ.add(cellKey(cx, cz, 6));
    let h = b.ht > 0 ? b.ht : b.lv > 0 ? b.lv * 3.1 : area < 45 ? 2.5 : area < 300 ? (R() < 0.3 ? 5.6 : 3.0) : area < 900 ? (R() < 0.5 ? 6.2 : 3.6) : 7.6;
    h *= VEX * 0.9;
    const y0 = base - 1.5, y1 = hi + h, wall = WALLS[(R() * WALLS.length) | 0], roof = ROOFS[(R() * ROOFS.length) | 0];
    const win = area > 30 ? 1 : 0;
    casters.push({ pts, y: hi, h: h + Math.min(Math.sqrt(area) * 0.12, 2) * VEX });
    if (area > 55 && nl < 230 && R() < 0.7) { nl++; const q = pts[(R() * n) | 0]; lights.add([q[0] + (q[0] - cx) * 0.15, hi + 2.4 * VEX, q[1] + (q[1] - cz) * 0.15], [1, .74, .42], 0, 1, 0, 0.75); }
    let along = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      g.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]], wall,
        [win, along + len, (y0 - hi) / VEX / 0.9], [win, along, (y0 - hi) / VEX / 0.9], [win, along, h / VEX / 0.9], [win, along + len, h / VEX / 0.9]);
      along += len + 1.3;
    }
    if (n === 4 && area < 700) {
      const [p0, p1, p2, p3] = pts, e0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), e1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const [a, b2, c, d] = e0 >= e1 ? [p0, p1, p2, p3] : [p1, p2, p3, p0];
      const rh = Math.min(Math.min(e0, e1) * 0.3, 3.4) * VEX * 0.9, yr = y1 + rh;
      const r0 = [(a[0] + d[0]) / 2, yr, (a[1] + d[1]) / 2], r1 = [(b2[0] + c[0]) / 2, yr, (b2[1] + c[1]) / 2];
      const ev = (q) => [cx + (q[0] - cx) * 1.09, y1 - 0.25, cz + (q[1] - cz) * 1.09];
      const A = ev(a), B = ev(b2), C = ev(c), D = ev(d);
      g.quad(B, A, r0, r1, roof); g.quad(D, C, r1, r0, roof);
      g.tri(A, D, r0, wall); g.tri(C, B, r1, wall);
    } else {
      const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
      if (area > 520) { for (const t of tri) g.tri([pts[t[0]][0], y1, pts[t[0]][1]], [pts[t[2]][0], y1, pts[t[2]][1]], [pts[t[1]][0], y1, pts[t[1]][1]], [.70, .70, .68]); }
      else {      // hipped roof: slopes rising to a smaller copy of the outline
        const rh = Math.min(Math.sqrt(area) * 0.22, 3.2) * VEX * 0.9, yr = y1 + rh, inn = pts.map(p => [cx + (p[0] - cx) * 0.42, cz + (p[1] - cz) * 0.42]);
        const eav = pts.map(q => [cx + (q[0] - cx) * 1.07, cz + (q[1] - cz) * 1.07]);
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; g.quad([eav[j][0], y1 - 0.25, eav[j][1]], [eav[i][0], y1 - 0.25, eav[i][1]], [inn[i][0], yr, inn[i][1]], [inn[j][0], yr, inn[j][1]], roof); }
        for (const t of tri) g.tri([inn[t[0]][0], yr, inn[t[0]][1]], [inn[t[2]][0], yr, inn[t[2]][1]], [inn[t[1]][0], yr, inn[t[1]][1]], roof);
      }
    }
  }
  for (const p of F.pools) {
    const pts = p.p.slice(0, -1); if (pts.length < 3) continue;
    let y = -1e9; for (const q of pts) y = Math.max(y, meshY(q[0], q[1]));
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(q => new THREE.Vector2(q[0], q[1])), []);
    for (const t of tri) g.tri([pts[t[0]][0], y + 0.5, pts[t[0]][1]], [pts[t[2]][0], y + 0.5, pts[t[2]][1]], [pts[t[1]][0], y + 0.5, pts[t[1]][1]], [.10, .62, .78]);
  }
}

// ---------------------------------------------------------------- tracks and walking paths
function buildRoads(F, scene, occ) {
  const pos = [], dir = [], par = [], idx = [];
  for (const r of F.roads) {
    const pts = r.p; let L = 0;
    const hw = r.c === 3 ? 1.25 : r.c === 2 ? 1.5 : r.c === 1 ? 2.4 : 3.2;
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 12));
      for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    out.push(pts[pts.length - 1]);
    const base = pos.length / 3;
    for (let i = 0; i < out.length; i++) {
      const p = out[i], a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (i > 0) L += Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]);
      const m = maskAt(p[0], p[1]);
      const y = Math.max(meshY(p[0], p[1]), meshY(p[0] - tz * 3, p[1] + tx * 3), meshY(p[0] + tz * 3, p[1] - tx * 3)) + 1.7;
      const vis = m.land > 0.5 ? 1 : 0;
      for (const s of [-1, 1]) { pos.push(p[0], y, p[1]); dir.push(tx, tz); par.push(s, L, hw, r.c + vis * 0.5); }
      if (r.c < 2) occ.add(cellKey(p[0], p[1], 6));
      if (i > 0) { const k = base + i * 2; idx.push(k - 2, k - 1, k, k, k - 1, k + 1); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  geo.setAttribute('aPar', new THREE.Float32BufferAttribute(par, 4));
  geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60000);
  const mat = makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vs: /* glsl */`
      attribute vec2 aDir; attribute vec4 aPar; varying vec3 vW; varying vec4 vP; varying float vD;
      void main(){
        float d = length(position - cameraPosition);
        float w = max(aPar.z, d * 0.0007);
        vec3 wp = position + vec3(-aDir.y, 0.0, aDir.x) * aPar.x * w;
        wp.y -= 1.45 * (1.0 - smoothstep(40.0, 320.0, d));
        vW = wp; vP = aPar; vD = d;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`
      varying vec3 vW; varying vec4 vP; varying float vD;
      void main(){
        ${LOGF}
        float cls = floor(vP.w + 0.01), on = step(0.25, fract(vP.w));
        float edge = smoothstep(1.0, 0.55, abs(vP.x));
        vec3 sand = vec3(0.66, 0.58, 0.42);
        float n = texture2D(uNoise, vW.xz / 14.0).r;
        vec3 col; float a;
        if(cls > 2.5){            // wheel ruts pressed into the beach
          float rut = smoothstep(0.5, 0.62, abs(vP.x)) * smoothstep(0.98, 0.86, abs(vP.x));
          col = vec3(0.40, 0.34, 0.23) * (0.8 + 0.3 * n); a = 0.85 * rut * (0.55 + 0.45 * texture2D(uNoise, vec2(vP.y / 90.0, 0.3)).g);
        } else if(cls > 1.5){     // walking path: pale dashes
          float dash = mix(step(fract(vP.y / 16.0), 0.6), 1.0, smoothstep(2500.0, 6000.0, vD));
          col = vec3(0.92, 0.84, 0.66); a = 0.75 * dash * edge;
        } else if(cls > 0.5){     // sand 4WD track with wheel ruts
          float rut = smoothstep(0.25, 0.45, abs(vP.x)) * smoothstep(0.85, 0.6, abs(vP.x));
          col = sand * (0.88 + 0.2 * n) * (1.0 - 0.14 * rut * (1.0 - smoothstep(300.0, 1500.0, vD))); a = 0.82 * edge;
        } else {                  // village street
          col = vec3(0.66, 0.62, 0.53) * (0.9 + 0.15 * n); a = 0.9 * edge;
        }
        a *= on * mix(1.0, 0.38, smoothstep(6000.0, 35000.0, vD)) * (cls > 2.5 ? 1.0 - smoothstep(1500.0, 4000.0, vD) : mix(1.0, smoothstep(50.0, 450.0, vD), uDetRect.w));   // up close the photo itself shows the track
        float cs = cloudShadow(vW);
        col *= uLightCol * max(uLightDir.y, 0.0) * 0.85 * cs + uAmbSky * 1.1;
        gl_FragColor = vec4(applyFog(col, vW), a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 4; scene.add(m);
}

// ---------------------------------------------------------------- cast shadows
// Each building's outline is swept along the sun direction onto the ground; the stencil
// buffer makes overlapping pieces darken a pixel only once.
function buildShadows(casters, scene) {
  const pos = [], ah = [], idx = [];
  for (const c of casters) {
    const n = c.pts.length, b = pos.length / 3;
    for (const p of c.pts) { pos.push(p[0], c.y, p[1]); ah.push(0); }
    for (const p of c.pts) { pos.push(p[0], c.y, p[1]); ah.push(c.h); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(b + i, b + j, b + n + j, b + i, b + n + j, b + n + i); }
    for (const t of THREE.ShapeUtils.triangulateShape(c.pts.map(p => new THREE.Vector2(p[0], p[1])), [])) idx.push(b + n + t[0], b + n + t[1], b + n + t[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aH', new THREE.Float32BufferAttribute(ah, 1)); geo.setIndex(idx);
  const mat = makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    stencilWrite: true, stencilFunc: THREE.EqualStencilFunc, stencilRef: 0, stencilZPass: THREE.IncrementStencilOp,
    vs: /* glsl */`attribute float aH; varying vec3 vW;
      void main(){ vec3 p = position; p.xz -= uLightDir.xz / max(uLightDir.y, 0.17) * aH; p.y = max(texture2D(uHeight, worldUV(p.xz)).r, uSeaM - 0.4) * uVex + 1.1; vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); ${LOGV} }`,
    fs: /* glsl */`varying vec3 vW; void main(){ ${LOGF} float a = 0.6 * clamp(dot(uLightCol, vec3(0.14)), 0.0, 1.0) * smoothstep(0.02, 0.12, uLightDir.y) * cloudShadow(vW); gl_FragColor = vec4(uAmbSky * 0.04, a * (1.0 - fogAmount(vW))); }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
}

// ---------------------------------------------------------------- trees
// Dense forest generated on the GPU in two rings that follow the view: every grid cell
// around the camera target grows a tree where the imagery is wooded, coloured from the
// satellite picture, standing on the real ground, and kept off tracks and buildings.
function buildOverlay(F) {
  const cw = 2048, ch = Math.round(cw * T.sz / T.sx), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch); c.lineCap = c.lineJoin = 'round'; c.globalCompositeOperation = 'lighter';
  const X = (x) => (x / T.sx + .5) * cw, Z = (z) => (z / T.sz + .5) * ch;
  c.strokeStyle = '#00ff00';
  for (const r of F.roads) { c.lineWidth = r.c === 2 ? 0.9 : 1.5; c.beginPath(); r.p.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.stroke(); }
  c.filter = 'blur(1.2px)'; c.fillStyle = c.strokeStyle = '#ff0000'; c.lineWidth = 2.4;
  for (const b of F.buildings) { c.beginPath(); b.p.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.closePath(); c.fill(); c.stroke(); }
  c.filter = 'none'; c.fillStyle = '#0000ff';                    // blue: open fresh water, where no tree stands
  for (const l of F.lakes) { c.beginPath(); l.p.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.closePath(); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  U.uOver.value = t;
}
function crown(detail, blobs, trunk) {
  const ico = new THREE.IcosahedronGeometry(1, detail), P = ico.attributes.position, pos = [], nrm = [], idx = [], part = [];
  const ix = ico.index ? Array.from(ico.index.array) : Array.from({ length: P.count }, (_, i) => i);
  blobs.forEach((b) => {
    const base = pos.length / 3;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); pos.push(b[0] + x * b[3], b[1] + y * b[3], b[2] + z * b[3]); nrm.push(x, y, z); part.push(0); }
    for (const i of ix) idx.push(base + i);
  });
  if (trunk) {                                   // a tapering stem from the ground (y = 0) up into the crown (y = 1)
    const base = pos.length / 3, S = 6;
    for (let k = 0; k <= 1; k++) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2, r = k ? 0.05 : 0.11; pos.push(Math.cos(a) * r, k, Math.sin(a) * r); nrm.push(Math.cos(a), 0, Math.sin(a)); part.push(1); }
    for (let i = 0; i < S; i++) { const j = (i + 1) % S; idx.push(base + i, base + S + i, base + j, base + j, base + S + i, base + S + j); }
  }
  return { pos: new THREE.Float32BufferAttribute(pos, 3), nrm: new THREE.Float32BufferAttribute(nrm, 3), part: new THREE.Float32BufferAttribute(part, 1), idx };
}
// The parts of a tree, all placed and bent by the tree shader: crown clumps (unit spheres), a trunk
// tube up to the fork, and a few limb tubes from the fork out to the clumps.
function speciesTree(K, B) {
  const ico = new THREE.IcosahedronGeometry(1, 0), P = ico.attributes.position, pos = [], nrm = [], idx = [], part = [], blob = [];
  const ix = ico.index ? Array.from(ico.index.array) : Array.from({ length: P.count }, (_, i) => i);
  for (let k = 0; k < K; k++) {
    const base = pos.length / 3;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); pos.push(x, y, z); nrm.push(x, y, z); part.push(0); blob.push(k); }
    for (const i of ix) idx.push(base + i);
  }
  const tube = (rings, S, kind, which) => {
    const base = pos.length / 3;
    for (let k = 0; k <= rings; k++) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2; pos.push(Math.cos(a), k / rings, Math.sin(a)); nrm.push(Math.cos(a), 0, Math.sin(a)); part.push(kind); blob.push(which); }
    for (let k = 0; k < rings; k++) for (let i = 0; i < S; i++) { const j = (i + 1) % S, q = base + k * S; idx.push(q + i, q + S + i, q + j, q + j, q + S + i, q + S + j); }
  };
  tube(3, 5, 1, 0);
  for (let i = 0; i < B; i++) tube(2, 4, 2, i);
  return { pos: new THREE.Float32BufferAttribute(pos, 3), nrm: new THREE.Float32BufferAttribute(nrm, 3), part: new THREE.Float32BufferAttribute(part, 1), blob: new THREE.Float32BufferAttribute(blob, 1), idx, K, B };
}
function buildTrees(F, scene) {
  const rings = [];
  const ring = (n, cs, rmin, rmax, squash, dmax, inner, base, leafy, mode = 0) => {
    const cells = new Float32Array(n * n * 2); let k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { cells[k++] = i - n / 2; cells[k++] = j - n / 2; }
    const geo = new THREE.InstancedBufferGeometry(); geo.setIndex(base.idx); geo.setAttribute('position', base.pos); geo.setAttribute('normal', base.nrm); geo.setAttribute('aPart', base.part); if (base.blob) geo.setAttribute('aBlob', base.blob);
    geo.setAttribute('iCell', new THREE.InstancedBufferAttribute(cells, 2)); geo.instanceCount = n * n; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const uni = { uCentre: { value: new THREE.Vector2() }, uCS: { value: cs }, uRange: { value: n / 2 * cs }, uRad: { value: new THREE.Vector3(rmin, rmax, squash) }, uDmax: { value: dmax }, uInner: { value: inner }, uMode: { value: mode }, uPorous: { value: mode === 2 ? 0.74 : 0.6 } };
    const mat = makeMat({
      uniforms: uni, defines: { ...(leafy ? { LEAFY: 1 } : {}), ...(base.blob ? { SPECIES: 1, NLIMB: base.B.toFixed(1) } : {}) }, side: leafy ? THREE.DoubleSide : THREE.FrontSide,
      vs: /* glsl */`
        attribute vec2 iCell; attribute float aPart; uniform vec2 uCentre; uniform float uCS, uRange, uDmax, uInner, uMode; uniform vec3 uRad;
        varying vec3 vCol, vDir, vN, vObj, vWp; varying float vFog, vTrunk, vPor; uniform float uPorous;
        #ifdef SPECIES
        attribute float aBlob;            // crown: which clump; limb: which limb
        // a point along a limb, in units of the tree's height: from the fork P to its end E, bowed up by arch and kinked sideways
        vec3 limbAt(vec3 P, vec3 E, float u, float arch, float kink){
          vec3 d = E - P; float len = length(d);
          vec3 side = normalize(vec3(-d.z, 0.0, d.x) + vec3(0.001, 0.0, 0.0));
          return P + d * u + vec3(0.0, sin(3.1416 * u) * arch * len, 0.0) + side * sin(6.2832 * u) * kink * len;
        }
        #endif
        void main(){
          vec2 cell = uCentre + iCell;
          float h1 = hash12(cell), h2 = hash12(cell + 17.3), h3 = hash12(cell * 1.7 + 5.1), h4 = hash12(cell * 0.37 + 91.0);
          vec2 xz = (cell + vec2(h1, h2)) * uCS;
          vec2 uv = worldUV(xz);
          vec3 mk = texture2D(uMask, uv).rgb;
          float hgt = texture2D(uHeight, uv).r;
          vec3 alb = texture2D(uAlbedo, uv).rgb;
          vec3 ov = texture2D(uOver, uv).rgb;
          float lum = dot(alb, vec3(0.3, 0.55, 0.15));
          float sandm = smoothstep(0.1, 0.5, mk.g + (h4 - 0.5) * 0.45), clr = 1.0 - smoothstep(0.06, 0.3, max(max(ov.r, ov.g), ov.b));
          float dens = uMode > 1.5 ? step(0.92, mk.r) * step(0.9, hgt) * clr * mix(0.5, 0.07, sandm) * step(0.508, mk.b)        // low plants: everywhere but bare beach
                                   : (1.0 - sandm) * step(0.92, mk.r) * step(1.4, hgt) * clr * smoothstep(0.24, 0.07, lum);
          #ifdef SPECIES
          // which tree grows here (0 eucalypt, 1 she-oak, 2 banksia, 3 paperbark, 4 mangrove), from how far inland and how high the spot is
          float shoreD = (mk.b - 0.5) * 3000.0, hs = hash12(cell * 2.3 + 40.0), hs2 = hash12(cell * 0.71 + 7.7);
          float sp = hs < 0.6 ? 0.0 : hs < 0.82 ? 2.0 : 1.0;                         // dune forest: scribbly gum and bloodwood, banksia, forest she-oak
          if(hgt < 5.5 && shoreD > 260.0) sp = hs < 0.6 ? 3.0 : hs < 0.8 ? 1.0 : 0.0;     // swampy flats: paperbark
          if(shoreD < 170.0 && hgt < 22.0) sp = hs < 0.7 ? 1.0 : 2.0;                     // behind the beach: coastal she-oak and coast banksia
          if(hgt < 1.7 && shoreD < 130.0){                                               // dark growth at the tide line: mangroves
            sp = 4.0; dens = step(0.92, mk.r) * step(0.2, hgt) * clr * smoothstep(0.2, 0.07, lum) * (1.0 - sandm);
          }
          #endif
          dens *= step(0.003, uv.x) * step(uv.x, 0.997) * step(0.003, uv.y) * step(uv.y, 0.997);
          float dc0 = length(vec3(xz.x, hgt * uVex, xz.y) - cameraPosition);
          float s = (1.0 - smoothstep(uRange * 0.72, uRange * 0.98, max(abs(xz.x - (uCentre.x + 0.5) * uCS), abs(xz.y - (uCentre.y + 0.5) * uCS)))) * (1.0 - smoothstep(uDmax * 0.55, uDmax, dc0));
          s *= step(h3, dens * 1.15) * smoothstep(uInner * 0.75, uInner, length(xz - (uCentre + 0.5) * uCS));
          if(uInner > 1.0) s *= smoothstep(0.13, 0.07, lum);
          if(s <= 0.002){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }      // nothing grows in this cell: skip the rest
          vec3 base = vec3(xz.x, groundY(xz), xz.y);                    // the drawn ground, so nothing floats or sinks
          float ang = h1 * 6.2832, ca = cos(ang), sa = sin(ang);
          vec3 q = vec3(position.x * ca - position.z * sa, position.y, position.x * sa + position.z * ca);
          vec3 nrm = normalize(vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca));
          vec3 c = alb * 1.3 + vec3(0.002, 0.006, 0.0);
          c = mix(c, vec3(lum * 1.15, lum * 1.8, lum * 0.75), 0.28) * (0.9 + 0.5 * h2);
          c = mix(c, c * vec3(1.25, 1.1, 0.7), step(0.8, h3) * 0.5);
          float ao; vec3 lp; vPor = uPorous;
          #ifdef SPECIES
            // Each kind of tree has its own build, and each tree its own form: where the trunk forks, how far the limbs
            // spread and bow, how much it leans and wanders. form picks between the distinct forms of a kind.
            float big = (0.75 + 0.45 * smoothstep(0.12, 0.03, lum)) * (0.8 + 0.4 * h4), form = hash12(cell * 3.1 + 11.0);
            float H, tr, lean, wig, fork, spread, top0, arch, kink, fill, rbK; vec3 sc = vec3(1.0), bark, tint;
            if(sp < 0.5){ H = 15.0; tr = 0.011; vPor = 0.64; rbK = 0.17; sc.y = 0.8; fill = 0.0;                      // eucalypt: pale scribbly gum or dark rough bloodwood
              bark = hs2 < 0.45 ? vec3(0.62, 0.60, 0.54) : vec3(0.29, 0.23, 0.18); tint = vec3(0.90, 1.0, 0.86);
              if(form < 0.38){ fork = 0.5; spread = 0.22; top0 = 0.8; arch = 0.10; kink = 0.04; lean = 0.10; wig = 0.035; }           // tall, forking high
              else if(form < 0.74){ fork = 0.25; spread = 0.36; top0 = 0.68; arch = 0.22; kink = 0.07; lean = 0.08; wig = 0.05; }     // forking low into wide, twisting limbs
              else { fork = 0.38; spread = 0.27; top0 = 0.72; arch = 0.13; kink = 0.08; lean = 0.36; wig = 0.08; } }                 // leaning and crooked
            else if(sp < 1.5){ H = 12.0; tr = 0.010; vPor = 0.72; rbK = 0.13; sc.y = 1.6; fill = 0.8; bark = vec3(0.21, 0.18, 0.15); tint = vec3(0.70, 0.80, 0.72);    // she-oak: slender, wispy, grey-green
              top0 = 0.84; arch = -0.03; kink = 0.03; wig = 0.035;
              if(form < 0.5){ fork = 0.55; spread = 0.07; lean = 0.07; }                // one straight-ish stem
              else if(form < 0.8){ fork = 0.22; spread = 0.16; lean = 0.08; }           // two or three stems from low down
              else { fork = 0.45; spread = 0.1; lean = 0.4; } }                        // bent over by the sea wind
            else if(sp < 2.5){ H = 6.0; tr = 0.022; vPor = 0.52; rbK = 0.28; sc.y = 0.72; fill = 0.0; bark = vec3(0.19, 0.15, 0.12); tint = vec3(0.72, 0.88, 0.66);    // banksia: low, gnarled, dense and dark
              fork = 0.18 + 0.2 * form; spread = 0.42; top0 = 0.6; arch = 0.07; kink = 0.12; lean = 0.28; wig = 0.1; }
            else if(sp < 3.5){ H = 10.0; tr = 0.016; vPor = 0.6; rbK = 0.16; sc.y = 1.15; fill = 0.6; bark = vec3(0.70, 0.68, 0.62); tint = vec3(0.92, 1.0, 0.84);     // paperbark: white papery stems, often several
              fork = 0.1 + 0.3 * form; spread = 0.18; top0 = 0.8; arch = 0.04; kink = 0.05; lean = 0.12; wig = 0.05; }
            else { H = 4.2; tr = 0.02; vPor = 0.48; rbK = 0.36; sc.y = 0.7; fill = 0.0; bark = vec3(0.24, 0.21, 0.17); tint = vec3(0.95, 1.22, 0.62);                  // mangrove: low and spreading, bright green
              fork = 0.18; spread = 0.45; top0 = 0.6; arch = 0.1; kink = 0.08; lean = 0.15; wig = 0.06; }
            fork *= 0.85 + 0.3 * h3; H *= big * 1.25;                                  // trees share the relief's exaggeration
            vec2 ld = vec2(cos(h2 * 6.2832), sin(h2 * 6.2832)) * lean * (0.4 + 0.6 * h3);
            float wph = h1 * 6.2832;
            // centre of the trunk at fraction t of the way up to the fork: it leans and wanders
            #define TRUNK(t) vec3(ld.x * (t) * (t) * fork + sin((t) * 4.7 + wph) * wig * (t), (t) * fork, ld.y * (t) * (t) * fork + cos((t) * 3.9 + wph) * wig * (t))
            vec3 P = TRUNK(1.0);
            float li = aPart > 1.5 ? aBlob : mod(aBlob, NLIMB);                         // the limb this vertex belongs to, or the limb its clump sits on
            float hb = hash12(cell + li * 13.7), hb2 = hash12(cell * 1.3 + li * 5.1 + 2.0), la = 6.2832 * (li / NLIMB + 0.3 * hb + h1), reach = spread * (0.55 + 0.6 * hb);
            vec3 E = vec3(P.x + cos(la) * reach, mix(top0, 0.98, hb2), P.z + sin(la) * reach);
            E.xz += ld * (E.y - fork);                                                  // the crown carries on the lean
            if(aPart > 1.5){                 // limb
              float u = position.y;
              vec3 c0 = limbAt(P, E, u, arch, kink), dir = normalize(limbAt(P, E, u + 0.06, arch, kink) - c0);
              vec3 ax = normalize(cross(dir, vec3(0.31, 0.0, 0.95))), ay = cross(dir, ax), ring = ax * position.x + ay * position.z;
              lp = (c0 + ring * tr * mix(0.62, 0.2, u)) * H * s; nrm = ring;
              c = bark * (0.75 + 0.5 * h2); ao = 0.6 + 0.3 * u;
            } else if(aPart > 0.5){          // trunk
              float t = position.y;
              lp = (TRUNK(t) + vec3(q.x, 0.0, q.z) * tr * mix(1.0, 0.66, t) * (1.0 + 0.6 * (1.0 - t) * (1.0 - t))) * H * s;
              c = bark * (0.75 + 0.5 * h2); ao = 0.5 + 0.35 * t;
            } else {                         // crown clump: one at the end of each limb, the others beside it or back along it
              float k = aBlob, sec = step(NLIMB - 0.5, k), hk = hash12(cell + k * 7.9 + 3.0), hk2 = hash12(cell * 0.9 + k * 3.3 + 1.0);
              float rb = rbK * (0.8 + 0.45 * hk2) * (1.0 - 0.25 * sec);
              vec3 bc = limbAt(P, E, 1.0 - sec * fill * (0.3 + 0.45 * hk), arch, kink);
              bc += sec * (1.0 - fill) * vec3(cos(hk * 6.2832), 0.5 * (hk2 - 0.3), sin(hk * 6.2832)) * rb * 0.9;
              bc.y += rb * sc.y * 0.3;
              vec3 ol = bc + q * rb * sc;
              lp = ol * H * s;
              c *= tint; if(sp > 0.5 && sp < 1.5) c = mix(c, vec3(dot(c, vec3(0.33))) * vec3(0.9, 1.0, 0.9), 0.4);
              ao = 0.42 + 0.58 * smoothstep(-0.9, 0.9, nrm.y + (ol.y - 0.75) * 1.6);
            }
            vObj = (aPart > 0.5 ? position : q + (aBlob + 1.0) * vec3(0.9, 0.4, 0.7)) * 2.6 + vec3(h1, h2, h3) * 9.0;
          #else
            float tall = step(0.84, h2);                                   // slender she-oaks and pines among the round crowns
            float r = mix(uRad.x, uRad.y, h4 * h4) * (0.7 + 0.6 * smoothstep(0.12, 0.03, lum)) * (1.0 - 0.3 * tall);
            float sq = uRad.z * (0.8 + 0.5 * h1) * (1.0 + 0.9 * tall);
            float stem = uMode < 0.5 ? r * sq * (0.75 + 0.9 * h3) : 0.0;                  // bare trunk under the crown
            lp = aPart > 0.5 ? vec3(q.x * r, position.y * (stem + r * sq * 0.45), q.z * r) * s : q * vec3(1.0, sq, 1.0) * r * s + vec3(0.0, (stem + r * sq * 0.6) * s, 0.0);
            c = mix(c, c * vec3(0.78, 0.9, 0.85), tall * 0.6);
            if(uMode > 1.5) c = mix(alb * 1.1, vec3(lum * 1.2, lum * 1.5, lum * 0.7), 0.3) * (1.25 + 0.6 * h2) * mix(vec3(1.0), vec3(0.62, 0.66, 0.42), sandm);
            if(aPart > 0.5) c = mix(vec3(0.17, 0.11, 0.065), vec3(0.36, 0.28, 0.19), step(0.55, h3)) * (0.7 + 0.6 * h2);
            ao = aPart > 0.5 ? 0.45 + 0.3 * position.y : 0.42 + 0.58 * smoothstep(-0.9, 0.9, nrm.y + (position.y - 0.2) * 0.5);
            vObj = position * 2.6 + vec3(h1, h2, h3) * 9.0;
          #endif
          vec3 wp = base + lp;
          float cs = cloudShadow(wp);
          float nl = max(dot(nrm, uLightDir), 0.0);
          vCol = c * (uLightCol * (nl * 0.85 + 0.08) * cs * ao + mix(uAmbGnd, uAmbSky, nrm.y * 0.5 + 0.5) * ao);
          vFog = fogAmount(wp); vDir = normalize(wp - cameraPosition); vN = nrm; vWp = wp; vTrunk = aPart;
          gl_Position = s <= 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
          ${LOGV}
        }`,
      fs: /* glsl */`varying vec3 vCol, vDir, vN, vObj, vWp; varying float vFog, vTrunk, vPor;
        void main(){
          ${LOGF}
          vec3 col = vCol; float alpha = 1.0;
          #ifdef LEAFY
          if(vTrunk < 0.5){
            float n = texture2D(uNoise, vObj.xz * 0.3 + vObj.yy * 0.2).g, n2 = texture2D(uNoise, vObj.xy * 1.3 + 0.3).b;
            float rim = 1.0 - abs(dot(normalize(vN), -vDir));
            alpha = smoothstep(vPor - 0.07, vPor + 0.07, n - rim * 0.3 + (n2 - 0.5) * 0.3);   // clusters of leaves with gaps, thinner toward the outline
            if(alpha < 0.03) discard;
            col *= 0.5 + 1.0 * n * n + 0.4 * (n2 - 0.5);
            if(!gl_FrontFacing) col *= 0.4;                                   // the shaded inside of the crown seen through the gaps
            col += vCol * 0.7 * pow(max(dot(vDir, uLightDir), 0.0), 3.0) * rim;   // leaves glow when the sun is behind them
          }
          #endif
          gl_FragColor = vec4(mix(col, fogColor(vDir), vFog), alpha);
        }`,
    });
    mat.alphaToCoverage = !!leafy;
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; scene.add(m); rings.push({ m, uni, cs, mode });
  };
  const n = +(Q.get('trees') || (LOW ? 120 : 200));
  ring(n, 11, 2.5, 6.0, 1.0, 5200, 0, speciesTree(LOW ? 4 : 6, LOW ? 2 : 3), true);          // single trees close to the view, each its own kind
  ring(n, 30, 7, 13, 0.7, 15000, n * 11 * 0.42, crown(0, [[0, 0, 0, 1], [0.7, 0.1, 0.4, 0.7]]), false, 1);   // canopy clumps beyond them
  ring(LOW ? 90 : 160, 1.45, 0.18, 0.62, 0.5, 300, 0, crown(0, [[0, 0, 0, 1], [0.5, 0.25, 0.3, 0.6]]), true, 2);   // shrubs, ferns and tussocks at your feet
  return (target, camDist) => { for (const r of rings) { r.uni.uCentre.value.set(Math.floor(target.x / r.cs), Math.floor(target.z / r.cs)); if (r.mode === 2) r.m.visible = camDist < 420; } };
}

// ---------------------------------------------------------------- palms and pandanus
// Plants with fronds are few, so each one is placed here: coconut palms around the resort and the
// villages, pandanus (screw pine, on its prop roots) on the dunes just behind the beaches.
function frondPlant(o) {
  const pos = [], nrm = [], uv = [], idx = [], S = 6;           // uv.x: 0..1 along a frond, or -1 on wood; uv.y: across the frond, or height on wood
  const stick = (a, b, r0, r1, rings) => {
    const base = pos.length / 3;
    for (let k = 0; k <= rings; k++) for (let i = 0; i < S; i++) {
      const t = k / rings, an = i / S * Math.PI * 2, r = r0 + (r1 - r0) * t, bend = o.bend * t * t * (b[1] - a[1]) * (rings > 1 ? 1 : 0);
      pos.push(a[0] + (b[0] - a[0]) * t + bend + Math.cos(an) * r, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + Math.sin(an) * r);
      nrm.push(Math.cos(an), 0, Math.sin(an)); uv.push(-1, t);
    }
    for (let k = 0; k < rings; k++) for (let i = 0; i < S; i++) { const j = (i + 1) % S, q = base + k * S; idx.push(q + i, q + S + i, q + j, q + j, q + S + i, q + S + j); }
  };
  stick([0, 0, 0], [0, o.h, 0], o.r * 1.5, o.r * 0.75, o.rings);
  const top = [o.bend * o.h, o.h, 0];
  for (let i = 0; i < (o.roots || 0); i++) { const a = i / o.roots * 6.283 + 0.4; stick([Math.cos(a) * o.h * 0.3, 0, Math.sin(a) * o.h * 0.3], [0, o.h * 0.38, 0], o.r * 0.3, o.r * 0.3, 1); }
  o.heads.forEach((hd, hi) => {
    const c = [top[0] + hd.at[0], top[1] + hd.at[1], hd.at[2]];
    if (hi) stick([o.bend * o.h * 0.5, o.h * 0.7, 0], c, o.r * 0.5, o.r * 0.4, 1);
    for (let f = 0; f < hd.n; f++) {
      const a = f / hd.n * Math.PI * 2 + hi * 1.3, el = hd.up - (f % 4) / 3 * (hd.up - hd.down), ca = Math.cos(a), sa = Math.sin(a), base = pos.length / 3;
      for (let j = 0; j <= hd.seg; j++) {
        const u = j / hd.seg, out = hd.L * u * Math.cos(el) * (1 - 0.12 * u * u), y = hd.L * (Math.sin(el) * u - hd.droop * u * u), w = hd.W * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + u * 0.94)), 0.45);
        for (const sd of [-1, 1]) { pos.push(c[0] + ca * out - sa * w * sd, c[1] + y - Math.abs(sd) * w * hd.vee, c[2] + sa * out + ca * w * sd); nrm.push(ca * 0.3, 0.95, sa * 0.3); uv.push(u, sd); }
        if (j) { const q = base + j * 2; idx.push(q - 2, q - 1, q, q, q - 1, q + 1); }
      }
    }
  });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
function buildPalms(F, scene, occ) {
  const R = rng(4711), taken = new Set();
  const free = (x, z, d) => { const k = cellKey(x, z, d); if (taken.has(k) || occ.has(cellKey(x, z, 6))) return false; taken.add(k); return true; };
  const palms = [], pands = [];
  const find = (re) => F.places.find(o => re.test(o.n || ''))?.p;
  for (const [re, n, rad] of [[/^Tangalooma/, 150, 560], [/Bulwer/, 36, 380], [/Cowan/, 22, 320], [/Kooringal/, 40, 420]]) {
    const c = find(re); if (!c) continue;
    for (let t = 0, k = 0; t < n * 60 && k < n; t++) {
      const a = R() * 6.283, r = Math.sqrt(R()) * rad, x = c[0] + Math.cos(a) * r, z = c[1] + Math.sin(a) * r * 1.6, m = maskAt(x, z), y = meshY(x, z) / VEX;
      if (m.land < 0.9 || y < 1.7 || y > 16 || m.shore < 10 || m.shore > 240 || !free(x, z, 7)) continue;
      palms.push(x, meshY(x, z) - 0.15, z, R() * 6.283, 0.8 + R() * 0.55, R()); k++;
    }
  }
  for (let t = 0; t < 420000 && pands.length < (MOBILE ? 800 : 1500) * 6; t++) {
    const x = (R() - 0.5) * T.sx * 0.96, z = (R() - 0.5) * T.sz * 0.96, m = maskAt(x, z);
    if (m.land < 0.9 || m.shore < 20 || m.shore > 120 || m.sand > 0.8) continue;
    const y = meshY(x, z) / VEX; if (y < 2 || y > 32 || !free(x, z, 7)) continue;
    pands.push(x, meshY(x, z) - 0.1, z, R() * 6.283, 0.7 + R() * 0.7, R());
  }
  const mat = (cut, leaf, wood) => makeMat({
    side: THREE.DoubleSide, uniforms: { uCut: { value: cut }, uLeaf: { value: new THREE.Vector3(...leaf) }, uWood: { value: new THREE.Vector3(...wood) } },
    vs: /* glsl */`
      attribute vec2 aUV; attribute vec4 iPos; attribute vec2 iPar; uniform vec3 uLeaf, uWood; uniform vec2 uWindDir;
      varying vec3 vCol, vDir; varying vec2 vUV; varying float vFog;
      void main(){
        float ca = cos(iPos.w), sa = sin(iPos.w), sc = iPar.x * 1.25, lf = step(0.0, aUV.x);
        vec3 p = position * sc; p.xz = vec2(p.x * ca - p.z * sa, p.x * sa + p.z * ca);
        vec3 n = vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca);
        // fronds stream and flutter in the wind, the trunk leans a little
        float gust = sin(uTime * 1.3 + iPar.y * 40.0 + aUV.x * 2.5) + 0.5 * sin(uTime * 3.1 + iPar.y * 17.0 + aUV.x * 6.0);
        p.xz += uWindDir * (lf * aUV.x * aUV.x * (0.25 + 0.2 * gust) + (1.0 - lf) * aUV.y * aUV.y * 0.05 * gust) * sc;
        vec3 wp = iPos.xyz + p;
        float far = 1.0 - smoothstep(3200.0, 4200.0, length(wp - cameraPosition));
        float nl = mix(max(dot(n, uLightDir), 0.0), 0.35 + 0.5 * max(uLightDir.y, 0.0), lf * 0.6);
        vec3 c = mix(uWood * (0.8 + 0.3 * sin(aUV.y * 60.0)), uLeaf * (0.75 + 0.5 * iPar.y) * (0.75 + 0.45 * aUV.x), lf);
        float ao = mix(0.55 + 0.4 * aUV.y, 0.6 + 0.4 * aUV.x, lf);
        vCol = c * (uLightCol * nl * cloudShadow(wp) * ao + mix(uAmbGnd, uAmbSky, n.y * 0.5 + 0.5) * ao);
        vUV = aUV; vFog = fogAmount(wp); vDir = normalize(wp - cameraPosition);
        gl_Position = far <= 0.0 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`varying vec3 vCol, vDir; varying vec2 vUV; varying float vFog; uniform float uCut;
      void main(){
        ${LOGF}
        if(vUV.x >= 0.0 && uCut > 0.0){                       // cut the blade into leaflets on both sides of the rib
          float v = abs(vUV.y);
          if(v > 0.1 && fract(vUV.x * uCut + v * 0.9) > 0.6) discard;
        }
        gl_FragColor = vec4(mix(vCol, fogColor(vDir), vFog), 1.0);
      }`,
  });
  const add = (g, list, m) => {
    const n = list.length / 6, a = new Float32Array(n * 4), b = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a.set(list.slice(i * 6, i * 6 + 4), i * 4); b[i * 2] = list[i * 6 + 4]; b[i * 2 + 1] = list[i * 6 + 5]; }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iPar', new THREE.InstancedBufferAttribute(b, 2)); g.instanceCount = n;
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
  };
  // coconut palm: a tall, slightly curved ringed trunk and a head of long arching fronds
  add(frondPlant({ h: 9.5, r: 0.17, bend: 0.14, rings: 5, heads: [{ at: [0, 0, 0], n: 12, L: 4.2, W: 0.62, up: 1.05, down: -0.35, droop: 0.75, seg: 5, vee: 0.25 }] }), palms, mat(16, [0.26, 0.40, 0.10], [0.46, 0.41, 0.34]));
  // pandanus: a short trunk standing on prop roots, a few branches, each ending in a tuft of long narrow leaves
  add(frondPlant({ h: 2.8, r: 0.12, bend: 0.1, rings: 2, roots: 5, heads: [{ at: [0, 0.2, 0], n: 10, L: 1.5, W: 0.07, up: 1.2, down: -0.2, droop: 0.95, seg: 3, vee: 0.3 }, { at: [0.9, -0.5, 0.3], n: 9, L: 1.35, W: 0.07, up: 1.1, down: -0.3, droop: 1.0, seg: 3, vee: 0.3 }, { at: [-0.6, -0.7, -0.7], n: 9, L: 1.3, W: 0.07, up: 1.1, down: -0.3, droop: 1.0, seg: 3, vee: 0.3 }] }), pands, mat(0, [0.20, 0.36, 0.15], [0.40, 0.35, 0.27]));
}

// ---------------------------------------------------------------- the Bulwer wrecks
// Three hulks were scuttled off Bulwer in the 1930s to shelter small boats. They have rusted down to open
// shells and ribs, red-brown all over. The map data holds the outline of each hull (traced from aerial
// photographs), so the walls here follow those outlines exactly: two hulls lie across the beach, the
// southern one long, low and broken, and the third lies along the shore, awash, with only its boiler,
// a leaning plate and a few frames standing clear.
const BULWER = [-2450.8, -11947.1];
function buildBulwerWrecks(F, g) {
  const TONES = [[.60, .29, .16], [.47, .21, .11], [.70, .36, .18], [.54, .24, .12]];
  const tone = (R, k = 1) => { const b = TONES[(R() * TONES.length) | 0], f = (0.85 + R() * 0.3) * k; return [b[0] * f, b[1] * f, b[2] * f]; };
  // Stand a rusted hull wall along an outline. top: height of the upper edge above mean sea level (m); show: least height
  // above the sand; gaps: share of plating rusted away; rag: how ragged the upper edge is; ribs: share of frames still standing.
  const shell = (outline, seed, o) => {
    const R = rng(seed), pts = [];
    let cx = 0, cz = 0; for (const p of outline) { cx += p[0]; cz += p[1]; } cx /= outline.length; cz /= outline.length;
    for (let i = 0; i < outline.length; i++) {                 // a point about every 1.6 m round the hull
      const a = outline[i], b = outline[(i + 1) % outline.length], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.6));
      for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    const N = pts.length, far = Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cz)));
    const P = pts.map((p, i) => {
      const q = pts[(i + 1) % N], r = pts[(i + N - 1) % N]; let nx = -(q[1] - r[1]), nz = q[0] - r[0]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      if (nx * (cx - p[0]) + nz * (cz - p[1]) < 0) { nx = -nx; nz = -nz; }                    // nx, nz point into the hull
      const gy = meshY(p[0], p[1]), mid = 1 - Math.hypot(p[0] - cx, p[1] - cz) / far;           // mid: 0 at the ends, towards 1 amidships
      const t = R() < o.gaps ? -99 : Math.max(o.top + (R() - 0.5) * o.rag - (o.sag || 0) * mid, gy / VEX + o.show * (0.6 + 0.8 * R()));
      return { x: p[0], z: p[1], nx, nz, gy, t: t * VEX };
    });
    for (let i = 0; i < N; i++) {
      const a = P[i], b = P[(i + 1) % N], col = tone(R), inner = [col[0] * .6, col[1] * .6, col[2] * .62], TH = 0.16, lo = Math.min(a.gy, b.gy) - 1.6;
      if (a.t > a.gy + 0.25 && b.t > b.gy + 0.25) {             // a panel of plating still standing out of the sand or the water
        const A = [a.x + a.nx * 0.5, lo, a.z + a.nz * 0.5], B = [b.x + b.nx * 0.5, lo, b.z + b.nz * 0.5], C = [b.x, b.t, b.z], D = [a.x, a.t, a.z];
        const Ai = [A[0] + a.nx * TH, lo, A[2] + a.nz * TH], Bi = [B[0] + b.nx * TH, lo, B[2] + b.nz * TH], Ci = [b.x + b.nx * TH, b.t - 0.05, b.z + b.nz * TH], Di = [a.x + a.nx * TH, a.t - 0.05, a.z + a.nz * TH];
        g.quad(A, B, C, D, col); g.quad(Bi, Ai, Di, Ci, inner); g.quad(D, C, Ci, Di, [col[0] * 1.12, col[1] * 1.08, col[2]]);
      }
      // a frame at each station: where the plating has gone, the bare rib is all that stands
      if (R() < o.ribs) { const h = Math.max(a.t, (o.top - 0.7 + R() * 1.0) * VEX); if (h > a.gy + 0.3) g.box(a.x + a.nx * 0.34, a.gy - 0.8, a.z + a.nz * 0.34, 0.24, h - a.gy + 0.8, 0.24, tone(R, 0.8)); }
    }
    // low down, the stumps of floors and bulkheads cross from side to side
    for (let i = 3; i < N / 2 - 2; i += 4) {
      const a = P[i]; let best = null, bd = 1e9;
      for (let j = 0; j < N; j++) { const b = P[j], dx = b.x - a.x, dz = b.z - a.z, along = Math.abs(dx * a.nz - dz * a.nx), across = dx * a.nx + dz * a.nz; if (across > 2 && along < bd) { bd = along; best = b; } }
      if (!best || R() < 0.25) continue;
      const y = Math.max(Math.min(a.gy, best.gy), -1.3 * VEX) - 0.2, h = 0.5 + R() * 0.6, w = 0.12, col = tone(R, 0.75), tx = a.nz * w, tz = -a.nx * w;
      g.quad([a.x - tx, y, a.z - tz], [best.x - tx, y, best.z - tz], [best.x - tx, y + h, best.z - tz], [a.x - tx, y + h, a.z - tz], col);
      g.quad([best.x + tx, y, best.z + tz], [a.x + tx, y, a.z + tz], [a.x + tx, y + h, a.z + tz], [best.x + tx, y + h, best.z + tz], col);
      g.quad([a.x - tx, y + h, a.z - tz], [best.x - tx, y + h, best.z - tz], [best.x + tx, y + h, best.z + tz], [a.x + tx, y + h, a.z + tz], col);
    }
  };
  const hulls = F.buildings.filter(b => b.k === 'ship' && Math.hypot(b.p[0][0] - BULWER[0], b.p[0][1] - BULWER[1]) < 300);
  for (const b of hulls) {
    const xs = b.p.map(p => p[0]), zs = b.p.map(p => p[1]), wide = Math.max(...xs) - Math.min(...xs), tall = Math.max(...zs) - Math.min(...zs), seed = Math.round(xs[0] * 7 + zs[0]);
    if (tall > wide) shell(b.p, seed, { top: 0.15, show: -9, gaps: 0.5, rag: 1.2, ribs: 0.45 });                    // lying along the shore: the third hull, awash
    else if (wide < 40) shell(b.p, seed, { top: 2.3, show: 1.3, gaps: 0.07, rag: 0.7, ribs: 0.9 });                 // the northern hull, the most complete
    else shell(b.p, seed, { top: 1.8, show: 1.0, gaps: 0.26, rag: 1.0, ribs: 0.9, sag: 0.5 });                      // the southern hull: long, low and broken
  }
  if (!hulls.length) return;
  // the pieces of the third hull that still show: its boiler, a leaning plate, a clump of frames
  const R = rng(75), y0 = (x, z) => meshY(x, z);
  g.at(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(-2455.5, y0(-2457.3, -11962.0) + 1.7, -11962.0)); g.cyl(0, 0, 0, 1.7, 1.7, 3.6, 12, tone(R), tone(R, 0.8)); g.at(null);
  g.at(new THREE.Matrix4().makeRotationY(-1.35).multiply(new THREE.Matrix4().makeRotationX(0.5)).setPosition(-2455.5, y0(-2455.5, -11946.1) - 0.3, -11946.1)); g.box(0, 0, 0, 6.2, 2.4 * VEX, 0.14, tone(R)); g.at(null);
  for (let i = 0; i < 5; i++) { const x = -2452.6 + (R() - .5) * 1.2, z = -11936.6 + i * 1.1; g.box(x, y0(x, z) - 0.5, z, 0.2, (1.6 + R() * 1.0) * VEX + 0.5, 0.26, tone(R, 0.85)); }
  g.at(new THREE.Matrix4().makeRotationY(-1.3).multiply(new THREE.Matrix4().makeRotationX(-0.35)).setPosition(-2451.6, y0(-2451.6, -11922.5) - 0.3, -11922.5)); g.box(0, 0, 0, 5.5, 1.9 * VEX, 0.14, tone(R)); g.at(null);
}

// ---------------------------------------------------------------- wrecks
const RUST = [[.42, .24, .14], [.37, .21, .13], [.46, .28, .16], [.33, .20, .14], [.40, .27, .20]];
function buildWrecks(F, g) {
  const R = rng(2024), list = [];
  F.wrecks.forEach((w) => {
    let L, B, th, cx = w.c[0], cz = w.c[1];
    if (Math.hypot(cx - BULWER[0], cz - BULWER[1]) < 200) return;       // the Bulwer wrecks are modelled on their own, below
    if (w.p && w.p.length > 3) {
      // principal axis of the charted outline
      let sxx = 0, szz = 0, sxz = 0; const pts = w.p;
      cx = 0; cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
      for (const p of pts) { const dx = p[0] - cx, dz = p[1] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
      th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
      let l0 = 1e9, l1 = -1e9, b0 = 1e9, b1 = -1e9; const c = Math.cos(th), s = Math.sin(th);
      for (const p of pts) { const dx = p[0] - cx, dz = p[1] - cz, u = dx * c + dz * s, v = -dx * s + dz * c; l0 = Math.min(l0, u); l1 = Math.max(l1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
      L = clamp(l1 - l0, 14, 90); B = clamp(b1 - b0, 5, 16);
    } else { L = 26 + R() * 22; B = 6.5 + R() * 3; th = R() * Math.PI; }
    const sunk = /dangerous/.test(w.k) && !/non/.test(w.k) ? R() < 0.45 : /non/.test(w.k);
    const bed = Math.min(heightAt(cx, cz), -1.2);
    const H = sunk ? -(0.5 + R() * 1.2) : 2.0 + R() * 2.6;                 // top above the sea, metres
    const m = new THREE.Matrix4().makeRotationY(-th).setPosition(cx, 0, cz);
    g.at(m);
    const S = 16, rs = rng((cx * 13 + cz * 7) | 0), col = RUST[(rs() * RUST.length) | 0];
    const brk = Array.from({ length: S + 1 }, () => rs()), heel = (rs() - .5) * 0.25;
    const prof = (u) => { const t = Math.abs(2 * u - 1); return B / 2 * Math.pow(1 - Math.pow(t, u > 0.5 ? 2.4 : 4.5), 0.6) + 0.15; };
    const top = (i) => { const u = i / S, sm = (brk[Math.max(0, i - 1)] + brk[i] * 2 + brk[Math.min(S, i + 1)]) / 4; const hh = (H - bed) * (0.55 + 0.45 * sm) * (0.85 + 0.3 * (2 * u - 1) ** 2); return (bed + hh) * VEX; };
    const yb = Math.max(bed, -1.7) * VEX;
    for (let i = 0; i < S; i++) {
      const x0 = (i / S - .5) * L, x1 = ((i + 1) / S - .5) * L, b0 = prof(i / S), b1 = prof((i + 1) / S), t0 = top(i), t1 = top(i + 1);
      const c2 = [col[0] * (0.8 + 0.4 * brk[i]), col[1] * (0.8 + 0.4 * brk[i]), col[2] * (0.8 + 0.4 * brk[i])];
      const cin = [c2[0] * .55, c2[1] * .55, c2[2] * .6], TH = 0.55;
      for (const sd of [-1, 1]) {
        const o0 = b0 * sd * 1.12, o1 = b1 * sd * 1.12, i0 = o0 - TH * sd, i1 = o1 - TH * sd, ty0 = t0 + heel * sd * b0 * VEX, ty1 = t1 + heel * sd * b1 * VEX;
        g.quad([x0, yb, b0 * sd * 0.7], [x1, yb, b1 * sd * 0.7], [x1, ty1, o1], [x0, ty0, o0], c2);                       // outer plating
        g.quad([x1, yb, b1 * sd * 0.7 - TH * sd], [x0, yb, b0 * sd * 0.7 - TH * sd], [x0, ty0 - 0.3, i0], [x1, ty1 - 0.3, i1], cin);   // inner skin
        g.quad([x0, ty0, o0], [x1, ty1, o1], [x1, ty1 - 0.3, i1], [x0, ty0 - 0.3, i0], [c2[0] * 1.15, c2[1] * 1.1, c2[2]]);          // gunwale
        if (i % 2 === 0) g.box(x0, -0.3 * VEX, o0 - TH * sd * 1.6, 0.35, Math.max(0.1, ty0 + 0.3 * VEX - 0.4), 0.5, cin);                                // frames
      }
      if (i % 3 === 1 && i < S - 1) g.quad([x0, yb, -b0], [x0, yb, b0], [x0, t0 * 0.9, b0], [x0, t0 * 0.9, -b0], [col[0] * .7, col[1] * .7, col[2] * .7]);
      if (!sunk && brk[i] > 0.36 && i > 0 && i < S - 1) { const yd = Math.min(t0, t1) - 0.9 * VEX; g.quad([x0, yd, -b0 * .92], [x1, yd, -b1 * .92], [x1, yd, b1 * .92], [x0, yd, b0 * .92], [col[0] * .85, col[1] * .8, col[2] * .8]); }
    }
    if (!sunk && rs() < 0.75) { const u = 0.22 + rs() * 0.2, x = (u - .5) * L; g.box(x, top(Math.round(u * S)) - 1.2 * VEX, 0, L * 0.11, (2.2 + rs() * 1.5) * VEX, B * 0.5, [col[0] * .9, col[1] * .9, col[2]]); }
    if (!sunk && rs() < 0.5) { const x = (0.3 + rs() * 0.15) * L; g.cyl(x, top(S - 3) - VEX, 0, 0.9, 0.8, (2.5 + rs() * 2) * VEX, 8, [col[0] * .8, col[1] * .8, col[2] * .8]); }
    if (!sunk && rs() < 0.8) { const x = (rs() - .5) * L * 0.5; g.cyl(x, bed * VEX, 0, 0.32, 0.2, (H - bed + 4 + rs() * 5) * VEX, 6, [.25, .13, .08]); }
    g.at(null);
    list.push({ x: cx, z: cz, sunk });
  });
  return list;
}

// ---------------------------------------------------------------- lighthouses, jetty, marks, camps
function buildStructures(F, g, lights, scene, casters) {
  const W = [.93, .92, .88], RED = [.72, .12, .09];
  const beams = [];
  for (const l of F.lights) {
    const x = l.p[0], z = l.p[1], y = meshY(x, z) - 1, big = /Cape/.test(l.n || '');
    const H = (big ? 23 : 9) * VEX * 1.15, r0 = big ? 3.6 : 1.8, r1 = big ? 2.5 : 1.3, bands = big ? 7 : 1;
    for (let i = 0; i < bands; i++) {
      const a = i / bands, b = (i + 1) / bands;
      g.cyl(x, y + H * a, z, r0 + (r1 - r0) * a, r0 + (r1 - r0) * b, H / bands, 14, big && (i === 2 || i === 5) ? RED : W);
    }
    g.cyl(x, y + H, z, r1 + 1.0, r1 + 1.0, 0.5 * VEX, 14, [.3, .3, .3], [.3, .3, .3]);
    g.cyl(x, y + H + 0.5 * VEX, z, r1 * 0.72, r1 * 0.72, 2.6 * VEX, 10, [.85, .9, .9]);
    g.cyl(x, y + H + 3.1 * VEX, z, r1 * 0.85, 0.15, 1.6 * VEX, 10, RED);
    casters.push({ pts: Array.from({ length: 8 }, (_, i) => [x + Math.cos(-i * 0.785) * r0, z + Math.sin(-i * 0.785) * r0]), y: y + 1, h: H + 3 * VEX });
    const ly = y + H + 1.8 * VEX;
    lights.add([x, ly, z], [1, .95, .75], 0, 1, 0, big ? 5 : 2.2);
    if (big) beams.push({ x, y: ly, z });
    if (big) { g.box(x + 14, y, z + 6, 12, 4.2 * VEX, 8, W, [.6, .2, .15]); g.box(x - 13, y, z - 9, 10, 4 * VEX, 7, W, [.6, .2, .15]); }
  }
  // sweeping lighthouse beams
  const cone = new THREE.CylinderGeometry(42, 2.5, 2600, 24, 1, true); cone.rotateZ(-Math.PI / 2); cone.translate(1300, 0, 0);     // narrow at the lamp, widening outward
  const bm = makeMat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vs: /* glsl */`varying float vL; varying vec3 vW, vNb; void main(){ vL = position.x / 2600.0; vNb = normalize(mat3(modelMatrix) * vec3(0.0, position.y, position.z)); vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGV} }`,
    fs: /* glsl */`varying float vL; varying vec3 vW, vNb; void main(){ ${LOGF} float core = pow(abs(dot(normalize(vNb), normalize(cameraPosition - vW))), 2.5); float a = pow(max(1.0 - vL, 0.0), 2.4) * 0.045 * core * uNight; gl_FragColor = vec4(vec3(1.0, 0.92, 0.7) * a, 1.0); }`,
  });
  const beamGroups = beams.map((b) => { const grp = new THREE.Group(); grp.position.set(b.x, b.y, b.z); const a = new THREE.Mesh(cone, bm), c = new THREE.Mesh(cone, bm); c.rotation.y = Math.PI; grp.add(a, c); grp.renderOrder = 45; a.renderOrder = c.renderOrder = 45; a.frustumCulled = c.frustumCulled = false; scene.add(grp); return grp; });

  // jetty
  const TIM = [.50, .40, .30];
  for (const p of F.piers) {
    const pts = p.p, yd = 2.7 * VEX;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.5) continue;
      const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len, w = 2.6, nx = -tz * w, nz = tx * w;
      g.quad([a[0] - nx, yd, a[1] - nz], [a[0] + nx, yd, a[1] + nz], [b[0] + nx, yd, b[1] + nz], [b[0] - nx, yd, b[1] - nz], [.62, .54, .42]);
      g.quad([a[0] - nx, yd - 0.9, a[1] - nz], [b[0] - nx, yd - 0.9, b[1] - nz], [b[0] - nx, yd, b[1] - nz], [a[0] - nx, yd, a[1] - nz], TIM);
      g.quad([b[0] + nx, yd - 0.9, b[1] + nz], [a[0] + nx, yd - 0.9, a[1] + nz], [a[0] + nx, yd, a[1] + nz], [b[0] + nx, yd, b[1] + nz], TIM);
      for (let d = 0; d < len; d += 11) for (const s of [-1, 1]) {
        const x = a[0] + tx * d + nx * s * 0.85, z = a[1] + tz * d + nz * s * 0.85, bed = Math.min(meshY(x, z), 0) - 1;
        if (meshY(x, z) < yd - 1) g.box(x, bed, z, 0.6, yd - bed, 0.6, TIM);
      }
      if (i % 3 === 0) lights.add([a[0], yd + 5, a[1]], [1, .8, .5], 0, 1, 0, 1.1);
    }
  }
  // navigation marks
  const floaters = [];
  const colOf = (s) => /red|port/.test(s) ? [.85, .1, .08] : /green|starboard/.test(s) ? [.08, .6, .2] : /yellow|black/.test(s) ? [.95, .8, .1] : [.9, .9, .9];
  F.marks.forEach((mk, i) => {
    const x = mk.p[0], z = mk.p[1], c = colOf(mk.c + ' ' + mk.k), bed = Math.min(meshY(x, z), 0) - 1, S = 1.5;
    if (meshY(x, z) > 0.5) return;
    const lc = /red/.test(mk.l) ? [1, .15, .1] : /green/.test(mk.l) ? [.1, 1, .35] : /yellow/.test(mk.l) ? [1, .8, .15] : /white/.test(mk.l) ? [1, 1, .9] : c.map(v => Math.min(1, v * 1.4));
    if (/buoy/.test(mk.k)) floaters.push({ x, z, c, lc, ph: (i * 0.37) % 1 });
    else {
      g.cyl(x, bed, z, 0.45 * S, 0.4 * S, 5.5 * VEX * S - bed, 6, [.35, .3, .26]);
      g.box(x, 5.5 * VEX * S, z, 1.5 * S, 1.6 * S * VEX, 1.5 * S, c);
      lights.add([x, 7.4 * VEX * S, z], lc, 2.5 + (i % 4), 0.3, (i * 0.37) % 1, 1.2);
    }
  });
  // tents at the camping areas
  const R = rng(5), TENT = [[.85, .35, .15], [.2, .45, .7], [.3, .6, .35], [.9, .75, .2], [.75, .75, .7], [.55, .25, .5]];
  for (const c of F.camps) {
    let fx = 0, fz = 0, k = 0;
    for (let i = 0; i < 9; i++) {
      const x = c.p[0] + (R() - .5) * 90, z = c.p[1] + (R() - .5) * 90, m = maskAt(x, z); if (m.land < 0.95 || m.shore < 8) continue;
      const y = meshY(x, z) + 0.2, a = R() * 3.14, cs = Math.cos(a), sn = Math.sin(a), col = TENT[(R() * TENT.length) | 0], l = 2.2, w = 1.6, h = 2.1 * VEX;
      const P = (u, v, yy) => [x + u * cs - v * sn, y + yy, z + u * sn + v * cs];
      g.quad(P(-l, -w, 0), P(l, -w, 0), P(l, 0, h), P(-l, 0, h), col); g.quad(P(l, w, 0), P(-l, w, 0), P(-l, 0, h), P(l, 0, h), col);
      g.tri(P(-l, w, 0), P(-l, -w, 0), P(-l, 0, h), col); g.tri(P(l, -w, 0), P(l, w, 0), P(l, 0, h), col);
      fx += x; fz += z; k++;
    }
    if (k) lights.add([fx / k + 3, meshY(fx / k + 3, fz / k) + 1.5, fz / k], [1, .5, .15], -1, 1, R(), 1.6);
  }
  return { beamGroups, floaters };
}

function buildFloaters(floaters, scene, lights) {
  const g = new GB(), S = 1.5, idx = [];
  for (const f of floaters) {
    g.cyl(f.x, -0.6, f.z, 1.2 * S, 1.0 * S, 1.6 * S, 8, f.c, f.c);
    g.cyl(f.x, 1.0 * S, f.z, 0.5 * S, 0.12 * S, 3.2 * S, 6, f.c);
    idx.push(lights.add([f.x, 4.6 * S, f.z], f.lc, 3 + f.ph * 3, 0.28, f.ph, 1.1));
  }
  const m = new THREE.Mesh(g.build(), objectMat({ side: THREE.DoubleSide })); m.frustumCulled = false; scene.add(m);
  return { mesh: m, idx, floaters, S };
}

// ---------------------------------------------------------------- lakes
function buildLakes(F, scene) {
  const pos = [], idx = [];
  for (const l of F.lakes) {
    let pts = l.p; if (pts.length < 4) continue;
    if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
    let y = 1e9; for (const p of pts) y = Math.min(y, meshY(p[0], p[1]));
    y = Math.max(y, meshY(l.c[0], l.c[1])) + 0.7; l.y = y;
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []), b = pos.length / 3;
    for (const p of pts) pos.push(p[0], y, p[1]);
    for (const t of tri) idx.push(b + t[0], b + t[2], b + t[1]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const mat = makeMat({
    side: THREE.DoubleSide,
    vs: /* glsl */`varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`
      varying vec3 vW; uniform vec2 uWindDir;
      void main(){
        ${LOGF}
        vec3 V = normalize(cameraPosition - vW);
        vec2 n = (texture2D(uWaterTex, vW.xz / 17.0 + uWindDir * uTime * 0.04).rg - 0.5) + (texture2D(uWaterTex, vW.xz / 41.0 - uWindDir * uTime * 0.02).rg - 0.5);
        vec3 N = normalize(vec3(-n.x * 0.25, 1.0, -n.y * 0.25));
        float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        float cs = cloudShadow(vW);
        vec3 body = vec3(0.012, 0.055, 0.07) * (uLightCol * 0.35 * cs + uAmbSky * 1.2);
        vec3 col = mix(body, skyColor(R), F) + uLightCol * pow(max(dot(R, uLightDir), 0.0), 500.0) * 3.0 * cs;
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; scene.add(m);
}

// ---------------------------------------------------------------- labels
function buildLabels(F, flyTo) {
  const host = document.getElementById('labels'), L = [];
  const add = (x, z, n, cls, pri, maxD, sub, yOff = 30, fd = 2200) => {
    if (!n) return;
    const el = document.createElement('div'); el.className = 'lb ' + cls; el.textContent = n;
    if (sub) { const i = document.createElement('i'); i.textContent = sub; el.appendChild(i); }
    el.style.opacity = 0; host.appendChild(el);
    const o = { x, z, y: Math.max(meshY(x, z), 0) + yOff, el, pri, maxD, w: n.length * (cls === 'town' ? 9.5 : 7.4) + 16, h: sub ? 30 : 17, on: false };
    el.addEventListener('click', () => flyTo(x, z, fd, null, 62));
    L.push(o);
  };
  for (const p of F.places) if (p.n !== 'Tallallebela' && p.n !== 'The Nek') add(p.p[0], p.p[1], p.n, 'town', 10, 130000, null, 60, 2400);
  for (const p of F.peaks) add(p.p[0], p.p[1], p.n, 'peak', p.e > 280 ? 9 : 5, p.e > 280 ? 90000 : 22000, `${Math.round(p.e)} m`, 25, 3200);
  for (const p of F.sandnames) add(p.p[0], p.p[1], p.n, 'sand', 7, 60000, null, 30, 3000);
  for (const p of F.seanames) add(p.p[0], p.p[1], p.n, 'sea', 4, 42000, null, 10, 7000);
  const seen = new Set();
  for (const p of F.lakes) if (p.n && !seen.has(p.n)) { seen.add(p.n); add(p.c[0], p.c[1], p.n, 'lake', 5, 26000, null, 20, 1800); }
  for (const p of F.views) add(p.p[0], p.p[1], p.n === 'Ship Wrecks' ? 'Bulwer Wrecks' : p.n, /Wreck/.test(p.n) ? 'wreck' : 'view', /Wreck/.test(p.n) ? 8 : 3, /Wreck/.test(p.n) ? 60000 : 11000, null, 40, 900);
  for (const p of F.camps) if (!/Sunrover|Escapes|WBS/.test(p.n || '')) add(p.p[0], p.p[1], p.n, 'camp', 2, 9000, null, 20, 900);
  for (const p of F.lights) add(p.p[0], p.p[1], p.n, 'view', 8, 50000, null, 90, 1100);
  for (const p of F.misc) add(p.p[0], p.p[1], p.n, 'view', 3, 12000, null, 25, 900);
  L.sort((a, b) => b.pri - a.pri);
  const v = new THREE.Vector3(), placed = [];
  let tick = 0;
  return function update(camera, show) {
    if (tick++ % 2) return;
    const w = window.innerWidth, h = window.innerHeight; placed.length = 0;
    for (const o of L) {
      let on = false, sx = 0, sy = 0;
      if (show) {
        v.set(o.x, o.y, o.z); const d = v.distanceTo(camera.position);
        if (d < o.maxD) {
          v.project(camera);
          if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) {
            sx = (v.x * .5 + .5) * w; sy = (-v.y * .5 + .5) * h; on = true;
            for (const p of placed) if (sx < p.x + p.w && sx + o.w > p.x - 12 && sy < p.y + p.h && sy + o.h > p.y) { on = false; break; }
            if (on) placed.push({ x: sx, y: sy, w: o.w, h: o.h });
          }
        }
      }
      if (on) o.el.style.transform = `translate(${sx.toFixed(1)}px,${(sy - 8).toFixed(1)}px)`;
      if (on !== o.on) { o.on = on; o.el.style.opacity = on ? 1 : 0; o.el.style.pointerEvents = on ? 'auto' : 'none'; }
    }
  };
}

// ---------------------------------------------------------------- assemble
// The beaches are the island's highways. Follow the firm sand just above the tide down each coast
// (side +1: the ocean beach on the east, -1: the bay beach on the west) and return the runs of open sand.
function beachRoutes() {
  const out = [];
  for (const side of [1, -1]) {
    let run = [];
    const close = () => { if (run.length > 30) { for (let k = 0; k < 3; k++) run = run.map((p, i) => i && i < run.length - 1 ? [(run[i - 1][0] + p[0] * 2 + run[i + 1][0]) / 4, p[1]] : p); out.push({ p: run, side }); } run = []; };
    for (let z = -T.sz / 2 + 500; z < T.sz / 2 - 500; z += 45) {
      let x = side * (T.sx / 2 - 150), hit = null;
      for (let i = 0; i < 2400 && Math.abs(x) < T.sx / 2; i++, x -= side * 9) if (groundH(x, z) > 0.9) { hit = x; break; }
      const bx = hit === null ? 0 : hit - side * 14, m = hit === null ? null : maskAt(bx, z);
      // keep only real beach: sand, open ground behind it, and no jump sideways from the last point (headlands, creek mouths, offshore banks)
      if (!m || m.sand < 0.5 || groundH(hit - side * 70, z) < 1.2 || (run.length && Math.abs(bx - run[run.length - 1][0]) > 60)) { close(); continue; }
      run.push([bx, z]);
    }
    close();
  }
  return out;
}

export function buildFeatures(scene, F, flyTo) {
  const occ = new Set(), g = new GB(), lights = makeLights(700);
  const casters = [];
  F.beach = beachRoutes();
  for (const r of F.beach) for (const [off, wig] of [[0, 0], [-6, 1.7], [-11, 2.6], [4, 3.9]]) F.roads.push({ p: r.p.map((p, i) => [p[0] + r.side * (off + Math.sin(i * 0.11 + wig) * 1.8 + Math.sin(i * 0.031 + wig * 2) * 2.5), p[1]]), c: 3, n: 'Beach' });      // several sets of wheel ruts wandering along the sand
  buildOverlay(F);
  buildBuildings(F, g, occ, casters, lights);
  buildRoads(F, scene, occ);
  const st = buildStructures(F, g, lights, scene, casters);
  buildShadows(casters, scene);
  const solid = new THREE.Mesh(g.build(), objectMat({ side: THREE.DoubleSide, defines: { WINDOWS: 1 } })); solid.frustumCulled = false; scene.add(solid);
  const gw = new GB(); const wrecks = buildWrecks(F, gw);
  const wm = new THREE.Mesh(gw.build(), objectMat({ side: THREE.DoubleSide, defines: { RUST: 1 } })); wm.frustumCulled = false; scene.add(wm);
  const gbw = new GB(); buildBulwerWrecks(F, gbw);
  const bwm = new THREE.Mesh(gbw.build(), objectMat({ side: THREE.DoubleSide, defines: { RUST: 1, DRYRUST: 1 } })); bwm.name = 'bulwerWrecks'; bwm.frustumCulled = false; scene.add(bwm);
  const fl = buildFloaters(st.floaters, scene, lights);
  buildLakes(F, scene);
  const trees = buildTrees(F, scene);
  buildPalms(F, scene, occ);
  scene.add(lights.pts);
  const labels = buildLabels(F, flyTo);

  const find = (arr, re) => arr.find(o => re.test(o.n || ''));
  const P = (n, o, d, az, pol, dx = 0, dz = 0) => o && { n, x: (o.c || o.p)[0] + dx, z: (o.c || o.p)[1] + dz, d, az, pol };
  const places = [
    { n: 'Whole island', x: 1200, z: 300, d: 44000, az: 40, pol: 52 },
    P('Tangalooma Wrecks', find(F.views, /Tangalooma Wrecks/), 900, 70, 66),
    P('Tangalooma Resort', find(F.places, /^Tangalooma/), 1500, 80, 64),
    P('The Desert', find(F.sandnames, /Desert/), 2400, 110, 62),
    P('Mount Tempest', find(F.peaks, /Tempest/), 5200, 60, 70),
    P('Cape Moreton Lighthouse', find(F.lights, /Cape/), 1300, 200, 72),
    P('Blue Lagoon', find(F.lakes, /Blue Lagoon/), 2600, 300, 62),
    P('Bulwer', find(F.places, /Bulwer/), 1700, 80, 64),
    P('Bulwer Wrecks', find(F.views, /^Ship Wrecks/), 380, 75, 66),
    P('Cowan Cowan', find(F.places, /Cowan/), 1500, 80, 64),
    P('Big Sandhills', find(F.sandnames, /Big Sand/), 4200, 60, 64),
    P('Kooringal', find(F.places, /Kooringal/), 2000, 30, 62),
  ].filter(Boolean);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  lights.pts.material.uniforms.uPx.value = dpr;
  return {
    places, wrecks,
    update(dt, t, camera, showLabels, target) {
      for (const b of st.beamGroups) b.rotation.y = t * 0.55;
      const sy = seaY();
      fl.mesh.position.y = sy;
      fl.floaters.forEach((f, i) => lights.move(fl.idx[i], f.x, sy + 4.6 * fl.S, f.z));
      trees(target, camera.position.distanceTo(target));
      labels(camera, showLabels);
    },
  };
}

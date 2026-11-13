// Everything that sits on the island: buildings, tracks and walking paths, trees,
// the wrecks, lighthouses, jetty, navigation marks, lakes and the name labels.
import * as THREE from 'three';
import { U, VEX, MOBILE, Q, makeMat, objectMat, LOGV, LOGF, rng, clamp } from './common.js';
import { T, meshY, heightAt, maskAt, albedoAt } from './terrain.js';
import { GB, makeLights } from './geo.js';

const seaY = () => U.uSeaM.value * VEX;
const cellKey = (x, z, s) => (Math.floor(x / s) + 8192) * 16384 + (Math.floor(z / s) + 8192);

// ---------------------------------------------------------------- buildings
const WALLS = [[.93, .90, .83], [.90, .84, .70], [.84, .77, .62], [.95, .94, .91], [.76, .68, .55], [.86, .82, .73], [.80, .88, .88], [.92, .85, .60]];
const ROOFS = [[.70, .72, .72], [.38, .52, .44], [.68, .27, .18], [.78, .73, .62], [.28, .40, .54], [.86, .86, .84], [.52, .54, .55], [.74, .36, .24], [.58, .65, .60]];
function buildBuildings(F, g, occ, casters, lights) {
  const R = rng(11); let nl = 0;
  for (const b of F.buildings) {
    let pts = b.p; const n = pts.length; if (n < 3 || b.lh) continue;
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
    const hw = r.c === 2 ? 1.5 : r.c === 1 ? 2.4 : 3.2;
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
        if(cls > 1.5){            // walking path: pale dashes
          float dash = mix(step(fract(vP.y / 16.0), 0.6), 1.0, smoothstep(2500.0, 6000.0, vD));
          col = vec3(0.92, 0.84, 0.66); a = 0.75 * dash * edge;
        } else if(cls > 0.5){     // sand 4WD track with wheel ruts
          float rut = smoothstep(0.25, 0.45, abs(vP.x)) * smoothstep(0.85, 0.6, abs(vP.x));
          col = sand * (0.88 + 0.2 * n) * (1.0 - 0.14 * rut * (1.0 - smoothstep(300.0, 1500.0, vD))); a = 0.82 * edge;
        } else {                  // village street
          col = vec3(0.66, 0.62, 0.53) * (0.9 + 0.15 * n); a = 0.9 * edge;
        }
        a *= on * mix(1.0, 0.38, smoothstep(6000.0, 35000.0, vD));
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
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  U.uOver.value = t;
}
function crown(detail, blobs) {
  const ico = new THREE.IcosahedronGeometry(1, detail), P = ico.attributes.position, pos = [], nrm = [], idx = [];
  const ix = ico.index ? Array.from(ico.index.array) : Array.from({ length: P.count }, (_, i) => i);
  blobs.forEach((b) => {
    const base = pos.length / 3;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); pos.push(b[0] + x * b[3], b[1] + y * b[3], b[2] + z * b[3]); nrm.push(x, y, z); }
    for (const i of ix) idx.push(base + i);
  });
  return { pos: new THREE.Float32BufferAttribute(pos, 3), nrm: new THREE.Float32BufferAttribute(nrm, 3), idx };
}
function buildTrees(F, scene) {
  const rings = [];
  const ring = (n, cs, rmin, rmax, squash, dmax, inner, base, leafy) => {
    const cells = new Float32Array(n * n * 2); let k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { cells[k++] = i - n / 2; cells[k++] = j - n / 2; }
    const geo = new THREE.InstancedBufferGeometry(); geo.setIndex(base.idx); geo.setAttribute('position', base.pos); geo.setAttribute('normal', base.nrm);
    geo.setAttribute('iCell', new THREE.InstancedBufferAttribute(cells, 2)); geo.instanceCount = n * n; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const uni = { uCentre: { value: new THREE.Vector2() }, uCS: { value: cs }, uRange: { value: n / 2 * cs }, uRad: { value: new THREE.Vector3(rmin, rmax, squash) }, uDmax: { value: dmax }, uInner: { value: inner } };
    const mat = makeMat({
      uniforms: uni, defines: leafy ? { LEAFY: 1 } : {},
      vs: /* glsl */`
        attribute vec2 iCell; uniform vec2 uCentre; uniform float uCS, uRange, uDmax, uInner; uniform vec3 uRad;
        varying vec3 vCol, vDir, vN, vObj, vWp; varying float vFog;
        void main(){
          vec2 cell = uCentre + iCell;
          float h1 = hash12(cell), h2 = hash12(cell + 17.3), h3 = hash12(cell * 1.7 + 5.1), h4 = hash12(cell * 0.37 + 91.0);
          vec2 xz = (cell + vec2(h1, h2)) * uCS;
          vec2 uv = worldUV(xz);
          vec3 mk = texture2D(uMask, uv).rgb;
          float hgt = texture2D(uHeight, uv).r;
          vec3 alb = texture2D(uAlbedo, uv).rgb;
          vec2 ov = texture2D(uOver, uv).rg;
          float lum = dot(alb, vec3(0.3, 0.55, 0.15));
          float dens = (1.0 - smoothstep(0.1, 0.5, mk.g + (h4 - 0.5) * 0.45)) * step(0.92, mk.r) * step(1.4, hgt) * (1.0 - smoothstep(0.06, 0.3, max(ov.r, ov.g))) * smoothstep(0.2, 0.06, lum);
          dens *= step(0.003, uv.x) * step(uv.x, 0.997) * step(0.003, uv.y) * step(uv.y, 0.997);
          float tall = step(0.84, h2);                                   // slender she-oaks and pines among the round crowns
          float r = mix(uRad.x, uRad.y, h4 * h4) * (0.7 + 0.6 * smoothstep(0.12, 0.03, lum)) * (1.0 - 0.3 * tall);
          vec3 base = vec3(xz.x, hgt * uVex, xz.y);
          float dc = length(base - cameraPosition);
          float s = (1.0 - smoothstep(uRange * 0.72, uRange * 0.98, max(abs(xz.x - (uCentre.x + 0.5) * uCS), abs(xz.y - (uCentre.y + 0.5) * uCS)))) * (1.0 - smoothstep(uDmax * 0.55, uDmax, dc));
          s *= step(h3, dens * 1.15) * smoothstep(uInner * 0.75, uInner, length(xz - (uCentre + 0.5) * uCS));
          if(uInner > 1.0) s *= smoothstep(0.13, 0.07, lum);
          float ang = h1 * 6.2832, ca = cos(ang), sa = sin(ang);
          vec3 q = vec3(position.x * ca - position.z * sa, position.y, position.x * sa + position.z * ca);
          vec3 nrm = normalize(vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca));
          float sq = uRad.z * (0.8 + 0.5 * h1) * (1.0 + 0.9 * tall);
          vec3 lp = q * vec3(1.0, sq, 1.0) * r * s;
          vec3 wp = base + lp + vec3(0.0, r * sq * 0.6 * s, 0.0);
          vec3 c = alb * 1.45 + vec3(0.003, 0.009, 0.0);
          c = mix(c, vec3(lum * 1.2, lum * 2.0, lum * 0.75), 0.4) * (0.66 + 0.6 * h2);
          c = mix(c, c * vec3(1.3, 1.12, 0.66), step(0.8, h3) * 0.6);
          c = mix(c, c * vec3(0.75, 0.9, 0.85), tall * 0.6);
          float cs = cloudShadow(wp);
          float nl = max(dot(nrm, uLightDir), 0.0);
          float ao = 0.3 + 0.7 * smoothstep(-0.9, 0.9, nrm.y + (position.y - 0.2) * 0.5);
          vCol = c * (uLightCol * (nl * 0.85 + 0.08) * cs * ao + mix(uAmbGnd, uAmbSky, nrm.y * 0.5 + 0.5) * ao);
          vFog = fogAmount(wp); vDir = normalize(wp - cameraPosition); vN = nrm; vObj = position * 2.6 + vec3(h1, h2, h3) * 9.0; vWp = wp;
          gl_Position = s <= 0.002 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
          ${LOGV}
        }`,
      fs: /* glsl */`varying vec3 vCol, vDir, vN, vObj, vWp; varying float vFog;
        void main(){
          ${LOGF}
          vec3 col = vCol;
          #ifdef LEAFY
            float n = texture2D(uNoise, vObj.xz * 0.19 + vObj.yy * 0.13).g, n2 = texture2D(uNoise, vObj.xy * 0.61 + 0.3).b;
            float rim = 1.0 - abs(dot(normalize(vN), -vDir));
            if(rim > 0.48 + n * 0.6) discard;                            // ragged, leafy outline instead of a smooth ball
            col *= 0.66 + 0.6 * n + 0.3 * (n2 - 0.5);
          #endif
          gl_FragColor = vec4(mix(col, fogColor(vDir), vFog), 1.0);
        }`,
    });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; scene.add(m); rings.push({ m, uni, cs });
  };
  const n = +(Q.get('trees') || (MOBILE ? 120 : 216));
  const trio = crown(MOBILE ? 0 : 1, [[0, 0, 0, 1], [0.62, 0.22, 0.28, 0.68], [-0.42, 0.3, -0.52, 0.74], [0.05, 0.62, 0.1, 0.6]].slice(0, MOBILE ? 3 : 4));
  ring(n, 11, 2.5, 6.0, 1.0, 5200, 0, trio, true);                               // single trees close to the view
  ring(n, 30, 7, 13, 0.7, 15000, n * 11 * 0.42, crown(0, [[0, 0, 0, 1], [0.7, 0.1, 0.4, 0.7]]), false);   // canopy clumps beyond them
  return (target) => { for (const r of rings) r.uni.uCentre.value.set(Math.floor(target.x / r.cs), Math.floor(target.z / r.cs)); };
}

// ---------------------------------------------------------------- wrecks
const RUST = [[.50, .26, .13], [.44, .22, .12], [.56, .31, .15], [.38, .20, .13], [.47, .29, .19]];
function buildWrecks(F, g) {
  const R = rng(2024), list = [];
  F.wrecks.forEach((w) => {
    let L, B, th, cx = w.c[0], cz = w.c[1];
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
  const cone = new THREE.CylinderGeometry(70, 2.5, 4200, 24, 1, true); cone.rotateZ(-Math.PI / 2); cone.translate(2100, 0, 0);     // narrow at the lamp, widening outward
  const bm = makeMat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vs: /* glsl */`varying float vL; varying vec3 vW, vNb; void main(){ vL = position.x / 4200.0; vNb = normalize(mat3(modelMatrix) * vec3(0.0, position.y, position.z)); vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGV} }`,
    fs: /* glsl */`varying float vL; varying vec3 vW, vNb; void main(){ ${LOGF} float core = pow(abs(dot(normalize(vNb), normalize(cameraPosition - vW))), 2.5); float a = pow(max(1.0 - vL, 0.0), 1.8) * 0.06 * core * uNight; gl_FragColor = vec4(vec3(1.0, 0.92, 0.7) * a, 1.0); }`,
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
export function buildFeatures(scene, F, flyTo) {
  const occ = new Set(), g = new GB(), lights = makeLights(700);
  const casters = [];
  buildOverlay(F);
  buildBuildings(F, g, occ, casters, lights);
  buildRoads(F, scene, occ);
  const st = buildStructures(F, g, lights, scene, casters);
  buildShadows(casters, scene);
  const solid = new THREE.Mesh(g.build(), objectMat({ side: THREE.DoubleSide, defines: { WINDOWS: 1 } })); solid.frustumCulled = false; scene.add(solid);
  const gw = new GB(); const wrecks = buildWrecks(F, gw);
  const wm = new THREE.Mesh(gw.build(), objectMat({ side: THREE.DoubleSide, defines: { RUST: 1 } })); wm.frustumCulled = false; scene.add(wm);
  const fl = buildFloaters(st.floaters, scene, lights);
  buildLakes(F, scene);
  const trees = buildTrees(F, scene);
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
      trees(target);
      labels(camera, showLabels);
    },
  };
}

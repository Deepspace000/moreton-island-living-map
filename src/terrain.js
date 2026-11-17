// Terrain: real elevation mesh, satellite colour, procedural detail, dune shadows,
// and the see-through water column over the estimated seabed.
// The ground is one smooth surface (groundH: a cubic B-spline through the height grid). A coarse mesh
// covers the whole island; finer grids follow the view and blend into it, so dunes stay rounded up close.
import * as THREE from 'three';
import { U, VEX, MOBILE, LOW, dq, Q, makeMat, LOGV, LOGF, getBlob } from './common.js';

export const T = { W: 0, H: 0, mpp: 17, sx: 0, sz: 0, hgt: null, expo: null, mask: null, step: 2, alb: null, albW: 0, albH: 0 };

async function pixels(url, w, h) {
  const blob = await getBlob(url);
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = w || bmp.width; c.height = h || bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, bmp, blob };
}
function tex(bmp, srgb, repeat) {
  const t = new THREE.Texture(bmp);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.anisotropy = 8; t.flipY = false; t.needsUpdate = true;
  return t;
}

export async function loadTerrainData(F, progress) {
  const [hp, mp, ap, np, wp] = await Promise.all([
    pixels('assets/height.png'), pixels('assets/mask.png'), pixels('assets/albedo.jpg', 496, 1024),
    pixels('assets/noise.png'), pixels('assets/water.png'),
  ]);
  progress?.('Shaping the island');
  const W = T.W = hp.w, H = T.H = hp.h; T.mpp = F.mpp; T.sx = W * F.mpp; T.sz = H * F.mpp;
  const hgt = T.hgt = new Float32Array(W * H), expo = T.expo = new Uint8Array(W * H);
  const half = new Uint16Array(W * H * 2), raw = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) raw[i] = (hp.data[i * 4] * 256 + hp.data[i * 4 + 1]) / 65535 * F.hrange + F.hmin;
  shapeBeaches(raw, W, H, F.mpp, mp.data, F, (i) => hp.data[i * 4 + 2] / 255);
  for (let i = 0; i < W * H; i++) {
    const h = raw[i];
    expo[i] = hp.data[i * 4 + 2];
    half[i * 2] = THREE.DataUtils.toHalfFloat(h); half[i * 2 + 1] = THREE.DataUtils.toHalfFloat(expo[i] / 255);
    hgt[i] = THREE.DataUtils.fromHalfFloat(half[i * 2]);      // exactly what the shaders read
  }
  T.mask = mp.data; T.alb = ap.data; T.albW = ap.w; T.albH = ap.h;
  const ht = new THREE.DataTexture(half, W, H, THREE.RGFormat, THREE.HalfFloatType);
  ht.minFilter = ht.magFilter = THREE.LinearFilter; ht.wrapS = ht.wrapT = THREE.ClampToEdgeWrapping; ht.needsUpdate = true;
  U.uHeight.value = ht;
  U.uMask.value = tex(mp.bmp, false, false);
  const full = await createImageBitmap(ap.blob);
  U.uAlbedo.value = tex(full, true, false);
  U.uNoise.value = tex(np.bmp, false, true);
  U.uWaterTex.value = tex(wp.bmp, false, true);
  U.uWorld.value.set(1 / T.sx, 1 / T.sz, T.sx, T.sz);
  U.uHTex.value.set(1 / W, 1 / H); U.uMpp.value = F.mpp;
  T.step = +(Q.get('step') || (MOBILE ? 6 : dq(4, 3, 2)));
}

// Beaches. In the height data the land often steps up two or three metres within a cell or two of the water (at Tangalooma, 2.7 m in 15 m),
// which, drawn with the relief exaggerated, makes a steep bank out of the sea where the owner's photograph shows a broad, nearly level beach.
// So the shore is given a beach's own profile: from the water's edge the sand rises gently through the tide zone, then lies almost flat as a
// berm some tens of metres wide (still dry at the highest tide), and only behind that does the ground climb to the dune or the hill at its
// natural slope. Ground already lower than this is left alone, so wide natural beaches and flats are unchanged; the rocky cape keeps its cliffs;
// and the ground under buildings on the beachfront is kept above the tide.
// The western (bay-side) beach is a tidal road (Queensland Parks: Tangalooma to Bulwer is open from mid to low tide; Tangalooma to Kooringal only
// within about two hours of low tide; the eastern beach is always open). So away from the settlements and the Micat's landing the bay beach is
// narrow: at high tide a strip of dry sand is left under the trees, too narrow to drive, and the 4WDs take the inland tracks.
export const TIDE_NORTH = 0.1, TIDE_SOUTH = -0.45;       // the sea level (m) above which each part of the western beach is shut
const WIDE = []; let splitZ = 0;
function setWide(F) {
  WIDE.length = 0; const place = (re) => (F.places || []).find(o => re.test(o.n || ''))?.p;
  for (const [re, r] of [[/Bulwer/, 650], [/Cowan/, 560], [/^Tangalooma/, 950], [/Kooringal/, 1000]]) { const c = place(re); if (c) WIDE.push([c[0], c[1], r]); }
  const fr = (F.ferries || []).find(f => /MICAT/i.test(f.n || '')); if (fr) { const E = [fr.p[0], fr.p[fr.p.length - 1]].sort((a, b) => Math.hypot(a[0], a[1] / 2) - Math.hypot(b[0], b[1] / 2))[0]; WIDE.push([E[0], E[1], 800]); }
  splitZ = (place(/^Tangalooma/) || [0, 0])[1];
}
const narrowOf = (x, z, expo) => { let k = Math.min(1, Math.max(0, (0.42 - expo) / 0.14)); if (k <= 0) return 0; for (const [cx, cz, r] of WIDE) k = Math.min(k, Math.min(1, Math.max(0, (Math.hypot(x - cx, z - cz) - r) / 250))); return k; };
export const narrowK = (x, z) => narrowOf(x, z, maskAt(x, z).expo);                       // 0 a wide beach, 1 a narrow tidal one
export const tideLimit = (x, z) => narrowK(x, z) > 0.5 ? (z < splitZ ? TIDE_NORTH : TIDE_SOUTH) : null;      // the sea level above which the beach here is shut to 4WDs (null: never)
function shapeBeaches(h, W, H, mpp, mask, F, expoAt) {
  setWide(F);
  const N = W * H, BIG = 1e6, D = 1.4142;
  // distance (in cells) from the nearest cell where d starts at 0; with src, each cell also learns WHICH cell that was
  const chamfer = (d, src) => {
    const relax = (i, j, c) => { const v = d[j] + c; if (v < d[i]) { d[i] = v; if (src) src[i] = src[j]; } };
    for (let z = 1; z < H; z++) for (let x = 1, i = z * W + 1; x < W - 1; x++, i++) { if (d[i] === 0) continue; relax(i, i - 1, 1); relax(i, i - W, 1); relax(i, i - W - 1, D); relax(i, i - W + 1, D); }
    for (let z = H - 2; z >= 0; z--) for (let x = W - 2, i = z * W + W - 2; x > 0; x--, i--) { if (d[i] === 0) continue; relax(i, i + 1, 1); relax(i, i + W, 1); relax(i, i + W + 1, D); relax(i, i + W - 1, D); }
    return d;
  };
  const sea = (i) => h[i] <= 0 && mask[i * 4 + 2] <= 130;                                  // the sea (not a hollow inland)
  const dL = new Float32Array(N), dS = new Float32Array(N);
  for (let i = 0; i < N; i++) { const s = sea(i); dL[i] = s ? 0 : BIG; dS[i] = !s && (mask[i * 4] >= 235 || mask[i * 4 + 2] >= 124) ? 0 : BIG; }      // dL: how far inland a point is; dS: how far out to sea from the island itself (sandbanks do not count)
  chamfer(dL); chamfer(dS);
  // The beach lies in FRONT of the land the map knows: the towns stand back from the sea behind it, as they really do. OUT metres seaward of the
  // mapped shoreline the sand comes up through the tide zone; the highest tide stops about at the mapped shoreline; the berm runs inland from there.
  const OUT = 30, OUTN = 14;
  // the narrow beach: the same gentle tide zone, a strip of dry sand only some eight metres wide, and then the dune
  const profN = (a) => a < 0 ? a * 0.03 : a < 14 ? 1.15 * a / 14 : a < 22 ? 1.15 + 0.35 * (a - 14) / 8 : 1.5 + (a - 22) * 0.35;
  const capAt = (m, x, z, i) => { const S = narrowOf((x + 0.5 - W / 2) * mpp, (z + 0.5 - H / 2) * mpp, expoAt(i)), c = prof(m + OUT); return S > 0 ? c * (1 - S) + profN(m + OUTN) * S : c; };
  // height at a metres up the beach: below the lowest tides a gentle sea bed (a < 0), the tide zone (to 28 m), the berm (to 60 m), then the dune face
  const prof = (a) => a < 0 ? a * 0.03 : a < 12 ? 0.52 * a / 12 : a < 28 ? 0.52 + 0.73 * (a - 12) / 16 : a < 60 ? 1.25 + 0.55 * (a - 28) / 32 : 1.8 + (a - 60) * 0.35;
  const keep = new Uint8Array(N);                        // under and beside buildings
  for (const b of F.buildings || []) { if (b.k === 'ship' || !b.p) continue; for (const q of b.p) { const cx = Math.round((q[0] / (W * mpp) + 0.5) * W - 0.5), cz = Math.round((q[1] / (H * mpp) + 0.5) * H - 0.5); for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const x = cx + k, z = cz + j; if (x >= 0 && x < W && z >= 0 && z < H) keep[z * W + x] = 1; } } }
  const cape = (F.lights || []).find(l => /Cape/.test(l.n || ''))?.p;
  const seaward = (OUT + 16) / mpp + 0.5, capeK = (x, z) => { if (!cape) return 1; const r = Math.hypot((x + 0.5 - W / 2) * mpp - cape[0], (z + 0.5 - H / 2) * mpp - cape[1]); return Math.min(1, Math.max(0, (r - 700) / 400)); };
  // first the land: nothing near the shore stands higher than the beach allows
  for (let z = 0; z < H; z++) for (let x = 0, i = z * W; x < W; x++, i++) {
    if (dL[i] === 0 || dL[i] > 40 || h[i] <= 0) continue;
    const c = capAt(dL[i] * mpp - mpp * 0.5, x, z, i); if (h[i] <= c) continue;
    let n = h[i] + (c - h[i]) * capeK(x, z); if (keep[i]) n = Math.max(n, Math.min(h[i], 1.55));
    h[i] = n;
  }
  // then the beach is built out in front: the sea bed, and any low ground right at the water's edge, come up to the beach's profile, but never
  // higher than the shore that stands behind them (the highest ground within some 35 m), so a low flat shore gets no bar across its front
  const idx = [], val = [];
  for (let z = 3; z < H - 3; z++) for (let x = 3, i = z * W + 3; x < W - 3; x++, i++) {
    const isSea = dL[i] === 0; if (isSea ? dS[i] > seaward : dL[i] > 3.2) continue;
    const c0 = capAt(isSea ? -(dS[i] * mpp - mpp * 0.5) : dL[i] * mpp - mpp * 0.5, x, z, i); if (h[i] >= c0) continue;
    let R = 0; for (let j = -3; j <= 3; j++) for (let k = -3, q = i + j * W - 3; k <= 3; k++, q++) if (dL[q] !== 0 && h[q] > R) R = h[q];
    const c = Math.min(c0, R); if (h[i] >= c) continue;
    idx.push(i); val.push(h[i] + (c - h[i]) * capeK(x, z));
  }
  for (let k = 0; k < idx.length; k++) h[idx[k]] = val[k];
}

// --- sampling helpers (world metres, x east, z south) ---
const px = (x) => (x / T.sx + 0.5) * T.W - 0.5, pz = (z) => (z / T.sz + 0.5) * T.H - 0.5;
export function heightAt(x, z) {            // true surface height in metres (bilinear)
  let fx = px(x), fz = pz(z);
  fx = Math.min(T.W - 1.001, Math.max(0, fx)); fz = Math.min(T.H - 1.001, Math.max(0, fz));
  const x0 = fx | 0, z0 = fz | 0, tx = fx - x0, tz = fz - z0, i = z0 * T.W + x0, h = T.hgt;
  return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - tz) + (h[i + T.W] * (1 - tx) + h[i + T.W + 1] * tx) * tz;
}
export function groundH(x, z) {            // the smooth ground in metres (same cubic B-spline as groundH in the shaders)
  const W = T.W, H = T.H, h = T.hgt;
  const fx = Math.min(1, Math.max(0, x / T.sx + 0.5)) * W - 0.5, fz = Math.min(1, Math.max(0, z / T.sz + 0.5)) * H - 0.5;
  const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  const tx2 = tx * tx, tx3 = tx2 * tx, a0 = (1 - 3 * tx + 3 * tx2 - tx3) / 6, a1 = (4 - 6 * tx2 + 3 * tx3) / 6, a3 = tx3 / 6, a2 = 1 - a0 - a1 - a3;
  const tz2 = tz * tz, tz3 = tz2 * tz, b0 = (1 - 3 * tz + 3 * tz2 - tz3) / 6, b1 = (4 - 6 * tz2 + 3 * tz3) / 6, b3 = tz3 / 6, b2 = 1 - b0 - b1 - b3;
  const x0 = ix < 1 ? 0 : ix - 1, x1 = ix < 0 ? 0 : ix, x2 = ix + 1 > W - 1 ? W - 1 : ix + 1, x3 = ix + 2 > W - 1 ? W - 1 : ix + 2;
  const row = (j) => { const r = (j < 0 ? 0 : j > H - 1 ? H - 1 : j) * W; return h[r + x0] * a0 + h[r + x1] * a1 + h[r + x2] * a2 + h[r + x3] * a3; };
  return row(iz - 1) * b0 + row(iz) * b1 + row(iz + 1) * b2 + row(iz + 2) * b3;
}
export function meshY(x, z) { return shoreY(groundH(x, z)); }      // world y of the drawn ground
export function maskAt(x, z) {              // {land, sand, shore(m), expo}
  const xi = Math.min(T.W - 1, Math.max(0, Math.round(px(x)))), zi = Math.min(T.H - 1, Math.max(0, Math.round(pz(z))));
  const i = (zi * T.W + xi) * 4, m = T.mask;
  return { land: m[i] / 255, sand: m[i + 1] / 255, shore: (m[i + 2] - 127.5) / 127.5 * 1500, expo: T.expo[zi * T.W + xi] / 255 };
}
export function maskBi(x, z) {              // land and sand read the way the shaders read them (between the grid points, not the nearest one)
  let fx = px(x), fz = pz(z); fx = Math.min(T.W - 1.001, Math.max(0, fx)); fz = Math.min(T.H - 1.001, Math.max(0, fz));
  const x0 = fx | 0, z0 = fz | 0, tx = fx - x0, tz = fz - z0, i = (z0 * T.W + x0) * 4, m = T.mask, w = T.W * 4;
  const f = (o) => ((m[i + o] * (1 - tx) + m[i + 4 + o] * tx) * (1 - tz) + (m[i + w + o] * (1 - tx) + m[i + w + 4 + o] * tx) * tz) / 255;
  return { land: f(0), sand: f(1) };
}
export function albedoAt(x, z, out) {
  const xi = Math.min(T.albW - 1, Math.max(0, ((x / T.sx + 0.5) * T.albW) | 0)), zi = Math.min(T.albH - 1, Math.max(0, ((z / T.sz + 0.5) * T.albH) | 0));
  const i = (zi * T.albW + xi) * 4; out[0] = T.alb[i] / 255; out[1] = T.alb[i + 1] / 255; out[2] = T.alb[i + 2] / 255; return out;
}

// the mesh dips slightly at the waterline so the smooth per-pixel shoreline (not the coarse triangles) decides where water shows
const shoreY = (h) => (h - 0.75 * Math.max(0, 1 - Math.abs(h) / 1.7)) * VEX;

let follow = () => {};
export const followTerrain = (x, z) => follow(x, z);      // keep the fine grids centred on what is being looked at

export function buildTerrain(scene) {
  const s = T.step, nx = Math.floor((T.W - 1) / s), nz = Math.floor((T.H - 1) / s);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  let k = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    pos[k++] = (i * s / (T.W - 1) - 0.5) * T.sx;
    const z = (j * s / (T.H - 1) - 0.5) * T.sz;
    pos[k++] = meshY(pos[k - 2], z);
    pos[k++] = z;
  }
  // The ground is drawn as squares of about 120 cells a side (all sharing the one list of points), each knowing how much room it takes
  // up, so that the squares out of view are skipped instead of the whole island being worked through every frame.
  const posAttr = new THREE.BufferAttribute(pos, 3), CH = 120, geos = [];
  for (let j0 = 0; j0 < nz; j0 += CH) for (let i0 = 0; i0 < nx; i0 += CH) {
    const i1 = Math.min(nx, i0 + CH), j1 = Math.min(nz, j0 + CH), idx = new Uint32Array((i1 - i0) * (j1 - j0) * 6); k = 0;
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    let y0 = 1e9, y1 = -1e9; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const y = pos[(j * (nx + 1) + i) * 3 + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const a = j0 * (nx + 1) + i0, d = j1 * (nx + 1) + i1, g = new THREE.BufferGeometry();
    g.setAttribute('position', posAttr); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(pos[a * 3], y0, pos[a * 3 + 2]), new THREE.Vector3(pos[d * 3], y1, pos[d * 3 + 2]));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere()); g.boundingSphere.radius += 2;
    geos.push(g);
  }

  const terrainMat = (uniforms, defines = {}) => makeMat({
    uniforms, defines,
    vs: /* glsl */`
      varying vec3 vW;
      #ifdef CLIP
      uniform vec4 uGrid;                 // xy: world position of grid point (0, 0), zw: grid spacing
      uniform float uHalf;                // grid points from the centre to the edge
      #endif
      void main(){
        #ifdef CLIP
          vec2 ij = position.xz, xz = uGrid.xy + ij * uGrid.zw;
          float y = groundY(xz);
          // toward the edge, the in-between points slide onto the triangles of the next coarser grid, so the two meet without a gap
          float m = smoothstep(0.78, 0.92, max(abs(ij.x), abs(ij.y)) / uHalf);
          vec2 odd = mod(ij, 2.0);
          if(m > 0.0 && odd.x + odd.y > 0.5){
            vec2 o = vec2(odd.x, -odd.y) * uGrid.zw;
            y = mix(y, 0.5 * (groundY(xz + o) + groundY(xz - o)), m);
          }
          vec4 wp = vec4(xz.x, y, xz.y, 1.0);
        #else
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGV}
      }`,
    fs: /* glsl */`
      varying vec3 vW;
      uniform vec4 uHole;                   // xy: centre, zw: half size of the finer grid drawn on top of this one
      uniform vec3 uWaterDeep; uniform float uTurb, uRain; uniform vec2 uWindDir;
      float hAt(vec2 uv){ return texture2D(uHeight, clamp(uv, 0.0, 1.0)).r; }
      // The shade of the trees. Every tree of the near forest stands where a hash of its grid cell puts it (the same reckoning the trees themselves
      // use, see features.js), so each point of ground can ask: is there a crown, or a trunk, between me and the sun? The shadows swing round and
      // lengthen with the hour, and the light comes through the leaves in moving flecks.
      // One fallen leaf in each cell of a grid, lying any way round, slim and a little curved.
      // Returns x: how much of the pixel the leaf covers, y: a number that differs from leaf to leaf, z: where across the leaf (the midrib is at 0).
      vec3 groundLeaf(vec2 p, float seed, float w){
        vec2 id = floor(p), f = fract(p) - 0.5; float h = hash12(id + seed), h2 = fract(h * 13.7), a = h * 6.2832;
        f += (vec2(h2, fract(h * 31.1)) - 0.5) * 0.5;
        vec2 q = vec2(f.x * cos(a) - f.y * sin(a), f.x * sin(a) + f.y * cos(a));
        q.x += q.y * q.y * (h2 - 0.5) * 1.6;
        float d = length(q * vec2(4.2, 1.25));
        return vec3(1.0 - smoothstep(0.5 - w, 0.5 + w, d), h2, q.x * 4.2);
      }
      #define TREE_SHADE_FAR ${dq('260.0', '380.0', '520.0')}
      float treeShade(vec3 P, vec3 L, float dist){
        if(L.y < 0.04 || dist > TREE_SHADE_FAR) return 0.0;
        float ll = length(L.xz) + 1e-4, lit = 1.0, fade = 1.0 - smoothstep(TREE_SHADE_FAR * 0.62, TREE_SHADE_FAR, dist), close = 1.0 - smoothstep(25.0, 90.0, dist);
        vec2 Ln = L.xz / ll, Lh = L.xz / L.y;
        // where would a crown have to stand to shade this point? Step toward the sun to crown height, allowing for the ground rising or falling on the way
        vec2 q = P.xz + Lh * 6.5;
        for(int k = 0; k < 2; k++) q = P.xz + Lh * clamp(6.5 + texture2DLodEXT(uHeight, worldUV(q), 0.0).r * uVex - P.y, 1.0, 60.0);
        vec2 c0 = floor(q / 11.0 - 0.5);
        vec3 ax = normalize(cross(L, vec3(0.31, 0.0, 0.95))), ay = cross(L, ax);
        for(int j = 0; j < 2; j++) for(int i = 0; i < 2; i++){
          vec2 cell = c0 + vec2(float(i), float(j));
          float h1 = hash12(cell), h2 = hash12(cell + 17.3), h3 = hash12(cell * 1.7 + 5.1), h4 = hash12(cell * 0.37 + 91.0);
          vec2 yuv = (cell - uYardO.xy + 0.5) * uYardO.zw; float yard = yuv.x > 0.0 && yuv.x < 1.0 && yuv.y > 0.0 && yuv.y < 1.0 ? step(0.5, texture2DLodEXT(uYard, yuv, 0.0).r) : 0.0;      // garden trees shade the yards too
          vec2 t = (cell + mix(vec2(h1, h2), 0.5 + (vec2(h1, h2) - 0.5) * 0.3, yard)) * 11.0, uv = worldUV(t);
          vec3 mk = texture2DLodEXT(uMask, uv, 0.0).rgb, ov = texture2DLodEXT(uOver, uv, 0.0).rgb;
          float lum = dot(texture2DLodEXT(uAlbedo, uv, 0.0).rgb, vec3(0.3, 0.55, 0.15)), hgt = texture2DLodEXT(uHeight, uv, 0.0).r;
          vec2 duv = (t - uDetRect.xy) * uDetRect.z; vec4 dtx = texture2DLodEXT(uDetail, clamp(duv, 0.0, 1.0), 0.0);
          float dIn = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0) * dtx.a * uDetRect.w;
          float lumP = mix(lum, dot(dtx.rgb / max(dtx.a, 0.01), vec3(0.3, 0.55, 0.15)), dIn), clr = 1.0 - smoothstep(0.06, 0.3, max(max(ov.r, ov.g), ov.b));
          float rkT = (1.0 - smoothstep(uResort.z * 0.8, uResort.z, length(t - uResort.xy))) * step(2.6, hgt) * smoothstep(60.0, 95.0, (mk.b - 0.5) * 3000.0);      // (the resort's trees: see features.js)
          { float ck = (1.0 - smoothstep(380.0, 750.0, (mk.b - 0.5) * 3000.0)) * smoothstep(3.0, 7.0, hgt) * mix(0.55, 1.0, 1.0 - smoothstep(0.25, 0.5, texture2DLodEXT(uHeight, uv, 0.0).g)) * (1.0 - smoothstep(0.52, 0.64, lumP)) * (1.0 - smoothstep(0.55, 0.85, mk.g)) * smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(t - uCape.xy));
            if(ck > 0.01) ck *= smoothstep(0.05, 0.14, length(vec2(texture2DLodEXT(uHeight, worldUV(t + vec2(22.0, 0.0)), 0.0).r - hgt, texture2DLodEXT(uHeight, worldUV(t + vec2(0.0, 22.0)), 0.0).r - hgt)) / 22.0);
            rkT = max(rkT, ck); }      // (and the forest wall of the island's sides)
          float dens = (1.0 - smoothstep(0.1, 0.5, mk.g + (h4 - 0.5) * 0.45) * (1.0 - rkT)) * step(0.92, mk.r) * step(1.5, hgt) * clr * max(smoothstep(0.46, 0.26, lumP), rkT);
          if(hgt < 1.7 && (mk.b - 0.5) * 3000.0 < 130.0) dens = step(0.92, mk.r) * step(0.2, hgt) * clr * smoothstep(0.2, 0.07, lum) * (1.0 - smoothstep(0.1, 0.5, mk.g + (h4 - 0.5) * 0.45));   // low by the shore only mangroves grow, and only where the photograph is dark
          if(yard > 0.5) dens = mix(0.5, 0.82, 1.0 - smoothstep(uResort.z * 0.85, uResort.z, length(t - uResort.xy))) * step(0.92, mk.r) * step(1.5, hgt) * smoothstep(40.0, 70.0, (mk.b - 0.5) * 3000.0);
          else dens *= mix(0.4, 1.3, smoothstep(0.38, 0.62, texture2DLodEXT(uNoise, t / 60.0 + 0.17, 0.0).b));      // groves and gaps, as the trees themselves stand
          if(h3 > dens * 1.15 || sandBlow(t) > 0.5) continue;
          float big = (0.75 + 0.45 * smoothstep(0.12, 0.03, lum)) * (0.8 + 0.4 * h4), hc = 6.5 * (0.9 + 0.2 * h4), r = 4.0 * big;
          vec3 d = vec3(t.x, hgt * uVex + hc, t.y) - P; float along = dot(d, L);
          if(along < 0.0) continue;
          vec3 off = d - along * L; float dd = length(off);
          vec2 pq = vec2(dot(off, ax), dot(off, ay)) + vec2(sin(uTime * 0.7 + h2 * 6.0), cos(uTime * 0.55 + h1 * 6.0)) * 0.06;      // the crown stirs in the wind
          float g1 = texture2DLodEXT(uNoise, pq * 0.09 + h1 * 7.0, 0.0).r, g2 = texture2DLodEXT(uNoise, pq * 0.19 + h2 * 3.0, 0.0).g * 0.6 + texture2DLodEXT(uNoise, vec2(pq.x * 0.8 - pq.y * 0.6, pq.x * 0.6 + pq.y * 0.8) * 0.13 + h1, 0.0).b * 0.4;
          float crown = (1.0 - smoothstep(0.35 * r, r * (0.8 + 0.5 * g1), dd)) * (0.7 + 0.3 * smoothstep(0.3, 0.55, g1));
          crown *= 1.0 - 0.7 * close * smoothstep(0.5, 0.66, g2);                                  // sun flecks through the gaps between the leaves
          vec2 e = t - P.xz; float al = dot(e, Ln), pr = abs(e.x * Ln.y - e.y * Ln.x), up = al * L.y / ll + P.y - hgt * uVex;       // the trunk's shadow: a dark bar from the foot of the tree
          float trunk = step(0.0, al) * (1.0 - smoothstep(0.08, 0.2 + 0.004 * al, pr)) * step(up, hc) * (1.0 - smoothstep(60.0, 160.0, dist));
          lit *= 1.0 - max(crown, trunk * 0.9);                                                    // shadows of neighbouring crowns run together
        }
        return (1.0 - lit) * fade;
      }
      float duneShadow(vec3 p, vec3 L){
        if(L.y > 0.93) return 1.0;
        float res = 1.0, t = 26.0;
        float jit = 0.75 + 0.5 * hash12(gl_FragCoord.xy);
        for(int i = 0; i < 22; i++){
          vec3 q = p + L * t * jit;
          float h = hAt(worldUV(q.xz)) * uVex;
          res = min(res, 9.0 * (q.y - h) / t + 0.55);
          if(res < 0.02 || q.y > 520.0) break;
          t *= 1.34;
        }
        return smoothstep(0.0, 1.0, res);
      }
      void main(){
        bool inMap = abs(vW.x) < uWorld.z * 0.5 && abs(vW.z) < uWorld.w * 0.5;
        if(inMap && abs(vW.x - uHole.x) < uHole.z && abs(vW.z - uHole.y) < uHole.w) discard;
        #ifdef CLIP
        if(!inMap) discard;
        #endif
        ${LOGF}
        vec2 uv = worldUV(vW.xz), cuv = clamp(uv, 0.0005, 0.9995);
        float h = hAt(cuv);
        vec2 e = uHTex;
        float hl = hAt(cuv - vec2(e.x, 0.0)), hr = hAt(cuv + vec2(e.x, 0.0)), hu = hAt(cuv - vec2(0.0, e.y)), hd = hAt(cuv + vec2(0.0, e.y));
        vec3 N = normalize(vec3((hl - hr) * uVex, 2.0 * uMpp, (hu - hd) * uVex));
        float lap = (hl + hr + hu + hd - 4.0 * h);
        vec4 mk4 = texture2D(uMask, cuv); vec3 mk = mk4.rgb;
        float relief = mk4.a * 1.992;                 // baked hollow / ridge shading
        vec2 ov = texture2D(uOver, cuv).rg;            // r: buildings (soft), g: tracks
        vec3 alb = texture2D(uAlbedo, cuv).rgb;
        float dist = length(vW - cameraPosition);
        float near = 1.0 - smoothstep(1500.0, 9000.0, dist);
        // sharp aerial photography near the view
        vec2 duv = (vW.xz - uDetRect.xy) * uDetRect.z;
        vec4 dtx = texture2D(uDetail, clamp(duv, 0.0, 1.0));
        vec2 de = smoothstep(vec2(0.0), vec2(0.06), duv) * smoothstep(vec2(0.0), vec2(0.06), 1.0 - duv);
        float dW = dtx.a * de.x * de.y * uDetRect.w;
        alb = mix(alb, dtx.rgb / max(dtx.a, 0.01), dW);

        // detail noise at three scales
        vec3 nA = texture2D(uNoise, vW.xz / 2300.0).rgb;
        vec3 nB = texture2D(uNoise, vW.xz / 310.0).rgb;
        vec3 nC = texture2D(uNoise, vW.xz / 47.0).rgb;
        vec3 nD = texture2D(uNoise, vW.xz / 71.0 + nB.rg * 0.6).rgb;

        float sand = smoothstep(0.2, 0.7, mk.g + (nB.r - 0.5) * 0.5 + (nC.r - 0.5) * 0.35 * near);
        float blowK = sandBlow(vW.xz); sand = max(sand, blowK);          // the two great sand blows are open sand, whatever the photograph shows
        float blowRun = blowK * smoothstep(0.55, 0.8, texture2D(uNoise, vec2(vW.z / 11.0, vW.x / 160.0)).r);          // runnels down the face of a sand blow, where the sand has slid
        float slope = 1.0 - N.y;

        // ---- vegetation: lift the satellite colour, add canopy clumps ----
        float lum = dot(alb, vec3(0.3, 0.55, 0.15));
        // the strip between the tide and the first dune is open beach wherever the photo shows it bright
        sand = max(sand, (1.0 - smoothstep(3.0, 5.0, h)) * (1.0 - smoothstep(0.535, 0.555, mk.b)) * smoothstep(0.10, 0.20, lum));
        sand = max(sand, smoothstep(0.28, 0.42, mk.g) * smoothstep(0.16, 0.28, lum));
        // and wherever the photograph itself is as bright as bare sand, it is a sand patch, whatever the coarser map says:
        // up close the sharp aerial photograph picks out the small patches among the scrub
        sand = max(sand, smoothstep(0.40, 0.58, lum));
        // Tidal flats: everything below about mean sea level is sand or sandy mud (the photograph only shows water there),
        // except the dark fringe of mangroves just above it. The falling tide bares it as wet beach and sandbanks.
        float flatK = 1.0 - smoothstep(-0.15, 0.4, h);
        sand = max(sand, flatK * (1.0 - step(0.0, h) * smoothstep(0.2, 0.08, lum)));
        vec3 veg = alb * 1.45 + vec3(0.003, 0.009, 0.0);
        veg = mix(veg, vec3(lum * 1.42, lum * 1.72, lum * 0.7), mix(0.4, 0.22, dW));      // the bush is olive (yellow ochre with a little blue), not a lawn green
        veg *= 0.72 + 0.5 * nA.r;
        veg = mix(veg, veg * vec3(1.22, 1.08, 0.66), smoothstep(1.02, 1.32, relief) * 0.55);      // drier, paler ridge tops
        veg = mix(veg, veg * vec3(0.72, 0.92, 0.86), smoothstep(0.95, 0.62, relief) * 0.6);       // lush, dark gullies
        veg = mix(veg, veg * vec3(0.86, 1.0, 1.12), smoothstep(0.45, 0.75, texture2D(uNoise, vW.xz / 760.0 + 0.37).b) * 0.35);
        float can1 = nB.g, can2 = nC.g;
        float canopy = mix(can1, can2, 0.55 * near);
        veg *= mix(0.55 + 0.85 * canopy, 0.9 + 0.2 * can2, dW * 0.85);          // the photo already shows the crowns
        veg = mix(veg, veg * vec3(1.25, 1.12, 0.6), smoothstep(0.55, 0.9, nA.b) * 0.5);    // drier heath patches
        vec2 cg = vec2(texture2D(uNoise, vW.xz / 47.0 + vec2(0.012, 0.0)).g - can2, texture2D(uNoise, vW.xz / 47.0 + vec2(0.0, 0.012)).g - can2);
        vec2 cg1 = vec2(texture2D(uNoise, vW.xz / 310.0 + vec2(0.006, 0.0)).g - can1, texture2D(uNoise, vW.xz / 310.0 + vec2(0.0, 0.006)).g - can1);
        vec3 Nv = normalize(N + vec3(-(cg.x * near * 2.2 + cg1.x * 1.3), 0.0, -(cg.y * near * 2.2 + cg1.y * 1.3)));

        // ---- sand: warm, wind-rippled, sparkling ----
        // Moreton sand: fine, clean, warm yellow, the thing the island is known for. It is kept clear and even: no grey patches, no dark stains,
        // only the gentlest variation, so the beaches look as inviting as they are. (The owner asked for exactly this.)
        float sLum = dot(alb, vec3(0.3, 0.55, 0.15));
        float greyP = smoothstep(0.56, 0.74, texture2D(uNoise, vW.xz / 1300.0 + 0.61).g * 0.88 + nB.b * 0.12);
        // the beaches of the bay side (west and south) are white, as the owner's photographs from Kooringal and the south-west show; the ocean beaches and
        // the high dunes keep their pale yellow. A beach is a bay beach when there is no open ocean within a few hundred metres of it.
        float ocean = max(max(texture2D(uHeight, cuv + vec2(uHTex.x * 18.0, 0.0)).g, texture2D(uHeight, cuv - vec2(uHTex.x * 18.0, 0.0)).g), max(texture2D(uHeight, cuv + vec2(0.0, uHTex.y * 18.0)).g, texture2D(uHeight, cuv - vec2(0.0, uHTex.y * 18.0)).g));
        float bayBeach = (1.0 - smoothstep(0.34, 0.55, ocean)) * (1.0 - smoothstep(5.0, 11.0, h));      // the owner's \"warm sand\": yellow ochre let down with white and a touch of burnt sienna; a shade paler on the bay-side beaches, as photographed at Tangalooma
        vec3 sd = mix(vec3(0.965, 0.80, 0.515), vec3(0.955, 0.82, 0.585), bayBeach) * mix(0.97, 1.03, smoothstep(0.2, 0.8, sLum));
        sd *= 0.97 + 0.06 * nA.r;
        float rip = sin((vW.x * 0.8 + vW.z * 0.5) * 0.9 + nC.r * 9.0) * 0.5 + 0.5;
        sd *= 1.0 - 0.035 * rip * near - 0.015 * nD.b * near;
        sd = mix(sd, sd * vec3(0.97, 0.91, 0.78), smoothstep(0.06, 0.3, slope));              // slip faces: a shade deeper gold
        { // The high dunes (the Desert, the sandhills), as the owner photographed them: sand slides down the steep faces in tongues and leaves streaks
          // that run straight down the slope, and the darker, damper sand under the pale crust shows through in ragged grey-brown patches.
          // The streaks are laid along the nearest two of sixteen compass bearings and blended, so they hold still as the slope turns.
          float steep = smoothstep(0.03, 0.15, slope) * smoothstep(5.0, 12.0, h), ang = atan(N.z, N.x + 1e-5) / 0.3927, q0 = floor(ang), fq = ang - q0, streak = 0.0;
          for(int i = 0; i < 2; i++){
            float a = (q0 + float(i)) * 0.3927; vec2 dn = vec2(cos(a), sin(a)), tg = vec2(-dn.y, dn.x);
            float s1 = texture2D(uNoise, vec2(dot(vW.xz, tg) / 11.0, dot(vW.xz, dn) / 190.0) + a).r, s2 = texture2D(uNoise, vec2(dot(vW.xz, tg) / 2.6, dot(vW.xz, dn) / 70.0) + a * 1.7).g;
            streak += (i == 0 ? 1.0 - fq : fq) * smoothstep(0.46, 0.72, s1 * 0.62 + s2 * 0.38);
          }
          float damp = smoothstep(0.5, 0.66, nB.g * 0.55 + nC.g * 0.3 + nD.r * 0.15);
          sd = mix(sd, sd * vec3(0.95, 0.9, 0.8), steep * clamp(streak * 0.5 + damp * streak * 0.2, 0.0, 1.0) * 0.6);        // (kept faint: a slightly deeper gold where the sand has slid)
          // The Big and Little Sandhills in the south are paler, close to white, and the wind sorts their heavy dark mineral grains into soft
          // smoky wisps that lie along the hollows, with clean bright drifts beside them (the owner's photo from the top of the Big Sandhills).
          float south = smoothstep(7000.0, 9500.0, vW.z) * smoothstep(5.0, 12.0, h);
          sd = mix(sd, vec3(0.99, 0.905, 0.66) * (0.97 + 0.05 * nA.r), south * 0.5);
          vec2 wq = vec2(dot(vW.xz, vec2(0.8, 0.6)), dot(vW.xz, vec2(-0.6, 0.8)));                   // laid along the prevailing south-easter
          float w1 = texture2D(uNoise, vec2(wq.x / 330.0, wq.y / 64.0) + nB.rg * 0.22).r, w2 = texture2D(uNoise, vec2(wq.x / 90.0, wq.y / 17.0) + nC.rg * 0.12 + 0.31).g;
          float dunes = smoothstep(6.0, 14.0, h) * (0.2 + 0.8 * south) * (1.0 - bayBeach);
          float wisp = smoothstep(0.56, 0.74, w1 * 0.68 + w2 * 0.32) * (0.55 + 0.45 * w2) * dunes;
          sd = mix(sd, sd * vec3(0.9, 0.84, 0.72), wisp * 0.3);                                       // only a hint of the darker grains: a soft deeper-gold shading in the hollows
          sd = mix(sd, vec3(1.0, 0.93, 0.72), smoothstep(0.34, 0.2, w1 * 0.68 + w2 * 0.32) * dunes * 0.3);
        }
        // wind-built dune forms: gradients of two noise scales bend the normal so bare sand shows relief from far away
        vec2 dA = vec2(texture2D(uNoise, vW.xz / 310.0 + vec2(0.01, 0.0)).r - nB.r, texture2D(uNoise, vW.xz / 310.0 + vec2(0.0, 0.01)).r - nB.r);
        vec2 dB = vec2(texture2D(uNoise, vW.xz / 47.0 + vec2(0.02, 0.0)).r - nC.r, texture2D(uNoise, vW.xz / 47.0 + vec2(0.0, 0.02)).r - nC.r);
        vec3 Ns = normalize(N + vec3(-(dA.x * 2.6 + dB.x * 1.0 * near), 0.0, -(dA.y * 2.6 + dB.y * 1.0 * near)) + vec3(rip - 0.5, 0.0, 0.0) * 0.1 * near);

        // ---- open ground: dry grass, heath and bare earth (mid-bright imagery) ----
        vec3 gr = mix(vec3(lum), alb, 1.05) * vec3(0.94, 0.93, 0.78) * 0.9;
        gr = mix(gr, sd * 0.62, 0.55);            // open ground is mostly sand showing through, not grass
        gr *= 0.80 + 0.28 * nB.r + (0.5 * (nC.b - 0.5) + 0.45 * (nD.r - 0.5)) * near;
        gr = mix(gr, gr * vec3(0.70, 0.80, 0.50), smoothstep(0.42, 0.7, nC.g) * 0.45 * near);
        float open = smoothstep(0.2, 0.36, lum) * (1.0 - sand);
        sd *= 0.66;
        vec3 col = mix(mix(veg, gr, open), sd, sand) * (1.0 - 0.5 * uNight * max(sand, open));
        { // the grass belt between beach and bush, seen from a distance: a strip of green and straw where the sand value is mid-way
          float belt = smoothstep(0.25, 0.4, mk.g) * (1.0 - smoothstep(0.68, 0.84, mk.g)) * smoothstep(2.5, 3.4, h) * step(0.92, mk.r) * (1.0 - smoothstep(170.0, 250.0, (mk.b - 0.5) * 3000.0));      // only behind a beach, above the reach of the sea
          col = mix(col, mix(vec3(0.19, 0.25, 0.10), vec3(0.36, 0.33, 0.20), nC.g) * (0.8 + 0.4 * nD.r), belt * 0.3 * smoothstep(0.35, 0.6, nC.b * 0.6 + nD.g * 0.5 + (0.6 - mk.g) * 0.8) * (0.4 + 0.6 * smoothstep(14.0, 60.0, dist)));     // thicker toward the scrub; close to, the old thatch between the clumps keeps the sand from showing through
        }
        float close = 1.0 - smoothstep(25.0, 140.0, dist);
        float headland = 1.0 - smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(vW.xz - uCape.xy));
        // low wet flats away from the shore and the houses are fern country: a bright green carpet, not sand
        float wetK = (1.0 - smoothstep(7.0, 11.0, h)) * smoothstep(0.54, 0.587, mk.b) * (1.0 - sand) * (1.0 - smoothstep(0.05, 0.13, ov.r)) * (1.0 - headland) * (1.0 - smoothstep(0.05, 0.14, length(vec2(hl - hr, hu - hd)) / (2.0 * uMpp)));      // wet country is flat country: a slope drains
        float floorK = (1.0 - sand) * (1.0 - smoothstep(0.4, 0.9, ov.g)) * (1.0 - headland) * (1.0 - wetK);
        // Tangalooma resort stands in forest (the owner's aerial photograph): within its grounds, everything but the lawns close round the buildings,
        // the tracks and the beach is forest, whatever the coarse sand map says
        float resLawn = smoothstep(0.025, 0.09, ov.r);
        float resK = (1.0 - smoothstep(uResort.z * 0.8, uResort.z, length(vW.xz - uResort.xy))) * smoothstep(1.9, 2.4, h) * smoothstep(38.0, 60.0, (mk.b - 0.5) * 3000.0) * (1.0 - smoothstep(0.3, 0.8, ov.g));
        // and the island's sides are a wall of forest down to the beach (see the trees in features.js): the ground there is forest floor, not open sand
        float coastK = (1.0 - smoothstep(380.0, 750.0, (mk.b - 0.5) * 3000.0)) * smoothstep(3.0, 7.0, h) * mix(0.55, 1.0, 1.0 - smoothstep(0.25, 0.5, texture2D(uHeight, cuv).g))
                     * (1.0 - smoothstep(0.52, 0.64, lum)) * (1.0 - headland) * (1.0 - smoothstep(0.3, 0.8, ov.g)) * (1.0 - smoothstep(0.05, 0.12, ov.r)) * (1.0 - smoothstep(0.55, 0.85, mk.g))
                     * smoothstep(0.05, 0.14, length(vec2(hl - hr, hu - hd)) / (2.0 * uMpp));          // (slopes, not the low flats behind the beaches)
        coastK *= 1.0 - blowK;
        float forced = max(resK * (1.0 - resLawn), coastK);
        if(close > 0.0){
          vec3 nE = texture2D(uNoise, vW.xz / 3.7).rgb, nF = texture2D(uNoise, vW.xz / 0.83 + 0.21).rgb;
          vec3 nG = texture2D(uNoise, vW.xz / 0.19 + 0.47).rgb;
          col *= 1.0 + ((nE.r - 0.5) * 0.7 + (nF.b - 0.5) * 0.6 + (nG.b - 0.5) * 0.7 * (1.0 - smoothstep(4.0, 30.0, dist)) + (nE.g - 0.45) * 0.45 * (1.0 - sand)) * close * mix(1.0, 0.07, sand);            // fine, clean sand: almost no blotches
          col = mix(col, col * vec3(0.72, 0.9, 0.5), smoothstep(0.5, 0.78, nF.g) * 0.6 * close * (1.0 - sand));        // grass tufts and leaf litter
          col *= 1.0 - 0.05 * sand * (1.0 - smoothstep(6.0, 38.0, dist)) * (sin(dot(vW.xz, vec2(5.2, 2.2)) + 2.2 * sin(dot(vW.xz, vec2(-0.5, 0.9))) + 1.4 * sin(dot(vW.xz, vec2(0.21, 0.13)) + nE.r * 2.0)) * 0.5 + 0.5);      // wind ripples in the sand, wandering and forking
          { // footprints: here and there a line of them wanders over the dry sand (a faint winding trail of small hollows, each with a lit rim)
            float tr = abs(texture2D(uNoise, vW.xz / 55.0 + 0.13).r - 0.5), band = 1.0 - smoothstep(0.004, 0.012, tr), hol = texture2D(uNoise, vW.xz / 1.15).g;
            float fp = band * sand * (1.0 - smoothstep(10.0, 45.0, dist)) * smoothstep(uSeaM + 0.5, uSeaM + 1.2, h) * smoothstep(0.45, 0.6, texture2D(uNoise, vW.xz / 400.0).b);
            col *= 1.0 - 0.09 * fp * smoothstep(0.6, 0.72, hol) + 0.05 * fp * smoothstep(0.5, 0.58, hol) * (1.0 - smoothstep(0.58, 0.64, hol)); }
          N = normalize(N + vec3(nE.b - 0.5 + (nG.r - 0.5) * 0.6, 0.0, nF.r - 0.5 + (nG.g - 0.5) * 0.6) * 0.5 * close);
          // The floor of the bush is not lawn: fallen leaves, shed bark and twigs lie over pale sand, with green only in patches.
          col = mix(col, mix(vec3(0.085, 0.13, 0.05), vec3(0.19, 0.17, 0.09), smoothstep(0.35, 0.75, nF.b)) * (0.6 + 0.9 * nE.g) * (0.8 + 0.5 * nF.g), headland * close * (1.0 - sand) * 0.6);      // the cape is long grass: dull green going to straw, never lawn
          if(wetK > 0.0){                                                                                                          // ferns: fresh green, patches of dead brown fronds
            vec3 fern = mix(vec3(0.055, 0.05, 0.03), vec3(0.11, 0.1, 0.055), nE.g) * (0.7 + 0.6 * nF.g);          // bracken is olive, not lawn green
            fern = mix(fern, vec3(0.15, 0.10, 0.05), smoothstep(0.72, 0.88, nF.b) * 0.5);
            col = mix(col, fern, wetK * close * 0.92 * (1.0 - smoothstep(0.4, 0.9, ov.g)));
          }
          // The floor of the bush is sand, the same pale yellow sand as the beaches, with dark detritus lying on it:
          // drifts of dead leaves, bark and twigs under the trees, a scatter of single pieces between, and almost no grass.
          // (scrub country: wherever the map is not open sand and the photograph is not bright with it, trees and bushes grow and their leaves lie under them,
          //  even where the sand shows pale between the crowns from the air)
          float leafK = max(max(floorK, forced), (1.0 - smoothstep(0.12, 0.5, mk.g)) * (1.0 - smoothstep(0.40, 0.56, lum)) * step(0.92, mk.r) * (1.0 - smoothstep(0.4, 0.9, ov.g)) * (1.0 - headland) * (1.0 - wetK) * (1.0 - smoothstep(0.05, 0.12, ov.r)));
          leafK *= 1.0 - blowK;
          if(leafK * close > 0.0){
            float burnt = smoothstep(0.5, 0.62, texture2D(uNoise, vW.xz / 900.0).b);          // the same burnt country the trees know
            // (two samples at odd scales and angles, each pushed about by a third, so the pattern never lines up in rows)
            vec3 w1 = texture2D(uNoise, vW.xz / 2.3 + nE.rg * 0.9).rgb, w2 = texture2D(uNoise, (vW.xz * mat2(0.8, 0.6, -0.6, 0.8)) / 1.37 + nE.gb * 0.7 + 0.37).rgb;
            // Under the scrub the ground is all but covered with fallen leaves: a brown carpet of them, old ones dark and matted underneath,
            // newer ones lying singly on top in every shade from red-brown to pale tan, with only chinks of sand showing through.
            float nearD = 1.0 - smoothstep(10.0, 45.0, dist);                                    // (further off the carpet is one mottled brown: its fine pattern would only show as rows)
            vec3 det = mix(vec3(0.155, 0.125, 0.088) * (0.85 + 0.3 * nE.g), mix(vec3(0.105, 0.084, 0.062), vec3(0.205, 0.165, 0.115), w2.r) * (0.8 + 0.4 * w1.g), nearD);      // grey-brown, as dead gum leaves weather
            det = mix(det, vec3(0.03, 0.028, 0.026), smoothstep(0.55, 0.8, w2.b) * burnt);      // charcoal where it has burnt
            float thin = smoothstep(0.3, 0.62, nE.r * 0.55 + w1.b * 0.45), cover = mix(0.8, 0.95, thin);          // a little thinner in places, never bare
            float lfw = fwidth(vW.x * 9.0) + fwidth(vW.z * 9.0), nearLf = 1.0 - smoothstep(0.3, 1.1, lfw), anyLeaf = 0.0;
            vec3 top = det;
            if(nearLf > 0.0){
              for(int k = 0; k < 3; k++){
                float fk = float(k), ang = 0.6 + fk * 1.1, lsz = k == 0 ? 9.0 : k == 1 ? 12.3 : 7.4;
                vec2 pr = vec2(vW.x * cos(ang) - vW.z * sin(ang), vW.x * sin(ang) + vW.z * cos(ang)) * lsz + fk * 7.3;
                vec3 Lf = groundLeaf(pr, 3.0 + fk * 5.0, lfw * lsz / 9.0 * 1.5 + 0.012);
                vec3 lc = Lf.y < 0.3 ? vec3(0.17, 0.125, 0.085) : Lf.y < 0.55 ? vec3(0.245, 0.195, 0.135) : Lf.y < 0.75 ? vec3(0.13, 0.115, 0.10) : Lf.y < 0.88 ? vec3(0.30, 0.22, 0.13) : vec3(0.43, 0.38, 0.28);      // browns and greys, and the odd straw-pale one
                lc *= (0.82 + 0.36 * fract(Lf.y * 5.3)) * (1.0 - 0.22 * smoothstep(0.1, 0.0, abs(Lf.z)));            // each leaf its own shade, a darker midrib
                float on = Lf.x * step(fract(Lf.y * 7.7), cover);
                top = mix(top, lc, on); anyLeaf = max(anyLeaf, on);
              }
            }
            float chink = max(smoothstep(0.66, 0.76, w1.r * 0.6 + w2.g * 0.5) * (1.0 - thin * 0.6) * (1.0 - anyLeaf * nearLf) * nearD, smoothstep(0.66, 0.78, nE.b * 0.6 + nB.g * 0.5) * 0.4);   // chinks of sand between the leaves, and here and there a sunny gap where the sand lies nearly bare
            vec3 lf = mix(mix(det, top, nearLf), sd, chink * 0.85);
            float fine = (1.0 - smoothstep(5.0, 16.0, dist)) * 0.5;          // (sticks only right at your feet: further off their grain reads as furrows)
            // sticks and strips of bark, lying every way. (Each is a stretched sample of the noise; the stretch is kept wide and the rows are bent by a second
            // noise, or the texture's own repeat shows through as a regular hatching, which is what a critic saw here before.)
            float s1 = texture2D(uNoise, vec2(dot(vW.xz, vec2(0.8, 0.6)) / 7.0, dot(vW.xz, vec2(-0.6, 0.8)) / 0.62 + w1.g * 2.3)).r;
            float s2 = texture2D(uNoise, vec2(dot(vW.xz, vec2(-0.5, 0.87)) / 5.5, dot(vW.xz, vec2(0.87, 0.5)) / 0.5 + w2.g * 2.9) + 0.31).g;
            float s3 = texture2D(uNoise, vec2(dot(vW.xz, vec2(0.17, 0.98)) / 3.4, dot(vW.xz, vec2(-0.98, 0.17)) / 0.33 + w1.r * 3.4) + 0.63).b;
            lf = mix(lf, vec3(0.15, 0.105, 0.07), smoothstep(0.76, 0.8, s1) * fine * 0.8);
            lf = mix(lf, vec3(0.07, 0.055, 0.045), smoothstep(0.78, 0.82, s2) * fine * 0.8);
            lf = mix(lf, vec3(0.24, 0.16, 0.09), smoothstep(0.76, 0.8, s3) * fine * 0.75);
            col = mix(col, lf, leafK * close * 0.97);
          }
          { // Whatever is still lawn-green close to the eye is really rough ground cover (sedge, low heath, dead fern): dull it toward straw and litter.
            float lawn = smoothstep(0.015, 0.08, col.g - max(col.r, col.b)) * close * (1.0 - sand), gl = dot(col, vec3(0.3, 0.55, 0.15));
            col = mix(col, mix(vec3(gl) * vec3(1.2, 1.02, 0.66), vec3(0.19, 0.15, 0.09), 0.3 + 0.3 * nF.b), lawn * 0.75);
          }
        }
        col = mix(col, vec3(0.05, 0.085, 0.03) * (0.75 + 0.5 * nC.g), wetK * (1.0 - close) * (1.0 - smoothstep(600.0, 3500.0, dist)) * 0.7);
        // farther off the same floor shows between the bushes as sand dulled by its litter
        // (but where the photograph is dark with forest the canopy is closed: from outside you see leaves, not the floor)
        col = mix(col, mix(sd, vec3(0.13, 0.09, 0.055), 0.62 + 0.3 * nC.r), floorK * (1.0 - close) * (1.0 - smoothstep(250.0, 1200.0, dist)) * 0.85 * (1.0 - 0.94 * smoothstep(0.40, 0.20, lum)));
        // seen from a distance, forest is its canopy: dark green, mottled with crowns
        // (wooded sandhills count too: from far off they show closed canopy, not the sand between the trees)
        float woodFar = max(max(1.0 - sand, forced), smoothstep(0.52, 0.38, lum) * smoothstep(140.0, 600.0, dist) * smoothstep(3.0, 5.0, h));      // (bare sand is bright in the photograph; anything this dark, above the beach, has trees on it)
        woodFar *= 1.0 - blowK;
        col = mix(col, vec3(0.022, 0.032, 0.016) * (0.6 + 0.9 * nB.g) * (0.75 + 0.5 * nC.g), woodFar * max(smoothstep(0.52, 0.27, lum), forced) * (1.0 - headland) * (1.0 - wetK) * (1.0 - close) * 0.88 * (1.0 - smoothstep(0.4, 0.9, ov.g)) * (1.0 - smoothstep(0.05, 0.12, ov.r)));
        { // round the houses: low grass in patches, drifts of fallen leaves, and worn sand between (the grass blades and the leaves themselves are drawn on top, see life.js)
          float yd = smoothstep(0.05, 0.12, ov.r) * (1.0 - smoothstep(0.3, 0.8, ov.g)) * smoothstep(2.0, 3.0, h) * (1.0 - smoothstep(0.6, 0.8, mk.g)) * smoothstep(40.0, 80.0, (mk.b - 0.5) * 3000.0);
          float grassP = smoothstep(0.30, 0.46, texture2D(uNoise, vW.xz / 13.0 + 0.3).g), driftP = smoothstep(0.36, 0.6, texture2D(uNoise, vW.xz / 9.0).r * 0.7 + texture2D(uNoise, vW.xz / 2.3 + 0.4).g * 0.3);
          col = mix(col, mix(sd * 0.9, vec3(0.17, 0.215, 0.09) * (0.75 + 0.5 * nC.g), 0.62), yd * grassP * 0.7);
          float speck = texture2D(uNoise, vW.xz / 0.9).b;
          col = mix(col, mix(vec3(0.25, 0.17, 0.09), vec3(0.13, 0.095, 0.065), speck), yd * driftP * (1.0 - 0.5 * grassP) * (0.38 + 0.4 * smoothstep(0.35, 0.65, speck))); }
        col = mix(col, vec3(0.15, 0.235, 0.085) * (0.82 + 0.3 * nC.g) * (0.92 + 0.16 * nB.r), resK * resLawn * 0.92);          // the resort's lawns, close round its buildings
        col *= 1.0 - 0.5 * coastK * (1.0 - close);          // under the forest wall the ground lies in deep shade
        col *= mix(vec3(1.0), vec3(0.9, 0.86, 0.8), blowK) * (1.0 - 0.2 * blowRun);          // the blows are a deeper tan than the beach, streaked where the sand runs
        // sand tracks worn into the ground (the crisp ribbon is drawn on top)
        // (seen low across the forest from the sea, the canopy hides the tracks: they show from above, as on a map, and close to)
        float trackSee = mix(1.0 - 0.9 * smoothstep(500.0, 2200.0, dist), 1.0, smoothstep(0.1, 0.4, normalize(cameraPosition - vW).y));
        col = mix(col, vec3(0.50, 0.43, 0.30) * (0.8 + 0.4 * nC.r), smoothstep(0.1, 0.75, ov.g) * 0.75 * (1.0 - sand) * trackSee);
        vec3 Nn = normalize(mix(mix(Nv, normalize(N + vec3(nD.r - 0.5, 0.0, nD.b - 0.5) * 0.3 * near), open), Ns, sand));
        float ao = clamp(1.0 + lap * 0.045, 0.55, 1.15) * mix(0.75 + 0.35 * canopy, 1.0, sand) * clamp(relief, 0.4, 1.35) * (1.0 - 0.5 * smoothstep(0.05, 0.9, ov.r));

        // ---- light ----
        vec3 L = uLightDir;
        float depth = uSeaM - h;                       // metres of water above this point
        float sh = 1.0;
        if(mk.b > 0.33 && L.y > 0.0) sh = duneShadow(vec3(vW.x, max(max(vW.y, h * uVex), uSeaM * uVex), vW.z) + vec3(0.0, 1.5, 0.0), L);
        { // buildings throw shadows too: the map of where they stand, looked up a little way toward the sun (further when the sun is low)
          vec2 so = L.xz / max(L.y, 0.14); float bs = max(texture2D(uOver, worldUV(vW.xz + so * 3.0)).r, texture2D(uOver, worldUV(vW.xz + so * 7.0)).r * 0.85);
          sh *= 1.0 - 0.55 * smoothstep(0.25, 0.7, bs) * (1.0 - smoothstep(0.3, 0.8, ov.r)) * step(0.02, L.y); }
        float tsh = mk.b > 0.4 ? treeShade(vW, L, dist) : 0.0;
        sh *= 1.0 - mix(0.6, 0.66, sand) * tsh;
        float cs = cloudShadow(vW);
        float vis = sh * cs;
        float nl = max(dot(Nn, L), 0.0);
        nl = mix(nl, nl * 0.5 + 0.5, 0.4 * sand);      // sand glows into the shade: it is never a dull surface
        vec3 amb = mix(uAmbGnd, uAmbSky, Nn.y * 0.5 + 0.5) * ao;
        vec3 V = normalize(cameraPosition - vW);

        // the bared flats stay wet: darker, greyer, rippled by the last tide, with a film of water lying in the hollows
        if(flatK > 0.0 && depth <= 0.0){
          float rp = sin(dot(vW.xz, vec2(1.9, 0.7)) + texture2D(uNoise, vW.xz / 9.0).r * 8.0) * 0.5 + 0.5;
          float pool = smoothstep(0.56, 0.66, texture2D(uNoise, vW.xz / 37.0 + 0.2).g * 0.6 + texture2D(uNoise, vW.xz / 150.0).b * 0.5) * smoothstep(0.5, 0.1, -depth);
          col = mix(col, col * vec3(0.72, 0.63, 0.47) * (0.94 + 0.1 * rp * (1.0 - smoothstep(20.0, 120.0, dist))), flatK * 0.85);          // wet sand is darker than dry, never paler
          col = mix(col, uAmbSky * 0.55 + uLightCol * 0.05, pool * flatK * 0.22);
        }
        // wet sand just above the waterline
        // (the owner's photo of the southern tip: bright dry sand ends at a clean, wandering edge, and below it the wet sand is a warm tan)
        float wetTop = 0.1 + 0.13 * texture2D(uNoise, vW.xz / 31.0).r + 0.04 * texture2D(uNoise, vW.xz / 5.0).g;
        float wet = max(smoothstep(wetTop + 0.025, wetTop - 0.015, -depth), 0.22 * smoothstep(0.7, 0.0, -depth)) * step(depth, 0.0);
        col = mix(col, col * vec3(0.87, 0.77, 0.58), wet * 0.9);          // wet sand: a deeper gold, not brown
        { // wrack: dark seagrass cast up by the tide. A fresh, wavering line of it at the water's edge, an older broken line at the last high water, and
          // scraps scattered over the sand between; thickest on the sheltered shores where the seagrass grows
          float wv = texture2D(uNoise, vW.xz / 13.0).r - 0.5, hw = -depth + wv * 0.14;
          float clump = smoothstep(0.40, 0.62, texture2D(uNoise, vW.xz / 2.3 + 0.13).g) * (0.45 + 0.55 * smoothstep(0.3, 0.6, texture2D(uNoise, vW.xz / 0.37).b));
          float fresh = smoothstep(-0.02, 0.04, hw) * (1.0 - smoothstep(0.1, 0.24, hw)), old = 1.0 - smoothstep(0.0, 0.12, abs(h - 0.85 + wv * 0.3));
          float scraps = step(0.86, texture2D(uNoise, vW.xz / 0.9 + 0.4).r) * smoothstep(0.52, 0.7, texture2D(uNoise, vW.xz / 6.0).g) * step(0.2, hw) * (1.0 - smoothstep(1.5, 2.6, h)) * (1.0 - smoothstep(20.0, 90.0, dist));
          float wrack = clamp(fresh * clump * 0.9 + old * clump * 0.25 + scraps * 0.08, 0.0, 1.0) * (0.3 + 0.7 * bayBeach) * sand * (1.0 - smoothstep(400.0, 1500.0, dist));
          col = mix(col, vec3(0.16, 0.13, 0.08) * (0.7 + 0.6 * texture2D(uNoise, vW.xz / 0.21).g), wrack * 0.4);        // a thin, faint line of weed at the water's edge and no more
        }
        vec3 lit = col * (uLightCol * nl * vis * mix(1.0, clamp(relief, 0.6, 1.25), 0.5) + amb);
        float sp = pow(max(dot(reflect(-L, Nn), V), 0.0), 60.0);
        lit += uLightCol * sp * vis * (sand * 0.5 * step(0.975, texture2D(uNoise, vW.xz / 0.41).b) * (1.0 - smoothstep(10.0, 60.0, dist)) + wet * 0.5);
        lit += skyColor(reflect(-V, N)) * wet * 0.12;

        // ---- under water: seabed seen through the water column ----
        if(depth > 0.0){
          float cn = texture2D(uWaterTex, vW.xz / 61.0 + uWindDir * uTime * 0.035).r - 0.5;
          vec2 wob = vec2(cn, texture2D(uWaterTex, vW.xz / 61.0 + uWindDir * uTime * 0.035).g - 0.5) * min(depth, 4.0) * 0.9;
          vec2 p = vW.xz + wob;
          vec3 bA = texture2D(uNoise, p / 420.0).rgb, bB = texture2D(uNoise, p / 60.0).rgb;
          vec3 bed = vec3(0.86, 0.80, 0.62) * (0.82 + 0.3 * bA.r);
          float rp = sin((p.x * 0.55 - p.y * 0.35) * 1.3 + bB.r * 2.5 + bA.b * 6.0) * 0.5 + 0.5;
          bed *= 1.0 - 0.10 * rp * near;
          { vec2 q = vW.xz; float fineK = (1.0 - smoothstep(2.0, 14.0, dist)) * (1.0 - smoothstep(0.6, 1.6, fwidth(dot(q, vec2(11.0, 6.0)))));                       // close to: ripple marks a hand-span apart, branching and joining, and grit in the troughs
            float r2 = sin(dot(q, vec2(11.0, 6.0)) + 1.7 * sin(dot(q, vec2(-1.3, 2.1))) + 1.2 * sin(dot(q, vec2(0.37, 0.23)) + bB.g * 3.0));
            bed *= 1.0 - fineK * 0.07 * smoothstep(-0.2, 0.9, r2); }
          float grass = smoothstep(0.46, 0.8, bA.g * 0.36 + bB.g * 0.26 + texture2D(uNoise, p / 17.0).b * 0.2 + texture2D(uNoise, vec2(p.x / 46.0 + bA.r * 0.6, p.y / 520.0)).g * 0.3) * smoothstep(0.8, 2.2, depth) * smoothstep(9.0, 3.5, depth) * (1.0 - smoothstep(0.3, 0.8, texture2D(uHeight, cuv).g));
          bed = mix(bed, vec3(0.03, 0.05, 0.035), grass * 0.88);                    // seagrass beds: near-black through the clear water, lying in long bands along the shore, in the gutters between the sand bars
          bed = mix(col * 0.8, bed, smoothstep(0.0, 0.9, depth));
          float c1 = texture2D(uWaterTex, p / 12.0 + uTime * vec2(0.031, 0.019)).b;
          float c2 = texture2D(uWaterTex, p / 8.3 - uTime * vec2(0.027, 0.034)).b;
          float c3 = texture2D(uWaterTex, p / 2.6 + uTime * vec2(0.05, 0.03)).b, c4 = texture2D(uWaterTex, p / 1.9 - uTime * vec2(0.04, 0.055)).b;      // a fine net of light close to
          float cf = 1.0 - smoothstep(6.0, 45.0, dist);
          float caus = mix(pow(min(c1, c2), 1.4) * 0.9, pow(1.0 - min(abs(c3 - c4) * 5.0, 1.0), 4.0) * 0.75 + 0.1, cf);          // close to: thin bright threads where the two wave trains agree
          caus *= exp(-depth * 0.22) * smoothstep(0.0, 0.5, depth) * (1.0 - smoothstep(50.0, 260.0, dist)) * (1.0 - uOvercast * 0.8);
          float sun = max(L.y, 0.0);
          vec3 Nb = normalize(vec3(N.x * 7.0, N.y, N.z * 7.0));                 // exaggerated so channels and banks read as relief
          float bsh = 0.55 + 0.75 * max(dot(Nb, normalize(L + vec3(0.0, 0.6, 0.0))), 0.0);
          vec3 bl = bed * (uLightCol * sun * vis * (0.72 + caus) * bsh + amb * 0.9);
          float cosr = sqrt(1.0 - (1.0 - V.y * V.y) / 1.77);         // refracted view ray
          float path = depth * (1.0 + 1.0 / max(cosr, 0.3));
          vec3 Tm = exp(-vec3(0.36, 0.092, 0.082) * uTurb * path);       // clear water: knee deep you still see the sand its own colour, only a little greener
          float ex = texture2D(uHeight, cuv).g, big = texture2D(uNoise, vW.xz / 9000.0).r;
          vec3 deep = mix(uWaterDeep * vec3(1.0, 1.02, 0.98), uWaterDeep * vec3(1.0, 0.72, 1.12), smoothstep(0.3, 0.9, ex)) * (0.82 + 0.36 * big);   // the bay runs from turquoise shallows to deep blue in the channel (the owner's aerial photograph of Tangalooma); the ocean is indigo
          vec3 scat = deep * (uLightCol * (0.10 + 0.22 * sun) * (0.5 + 0.5 * cs) + uAmbSky * 0.8);
          // a touch of turquoise back-scatter over bright sand
          scat += vec3(0.0, 0.05, 0.04) * exp(-depth * 0.2) * (uLightCol * sun * vis + uAmbSky) * 0.13;
          lit = bl * Tm + scat * (1.0 - Tm);
          if(uContour > 0.0){                                               // chart-style depth contours: every 2 m to 12 m, every 10 m beyond
            float dch = -h, f2 = dch / 2.0, f10 = dch / 10.0;
            float w2 = fwidth(f2), w10 = fwidth(f10);
            float l2 = (1.0 - smoothstep(0.7, 1.5, abs(fract(f2 - 0.5) - 0.5) / max(w2, 1e-5))) * smoothstep(13.0, 10.0, dch) * (1.0 - smoothstep(0.2, 0.5, w2)) * 0.5;
            float l10 = (1.0 - smoothstep(0.8, 1.8, abs(fract(f10 - 0.5) - 0.5) / max(w10, 1e-5))) * (1.0 - smoothstep(0.25, 0.6, w10)) * step(5.0, dch);
            vec2 ce = smoothstep(vec2(0.02), vec2(0.14), uv) * smoothstep(vec2(0.02), vec2(0.14), 1.0 - uv);
            float ln = max(l2, l10) * step(0.4, dch) * uContour * ce.x * ce.y * (1.0 - smoothstep(30000.0, 70000.0, dist));
            lit = mix(lit, lit * 1.35 + vec3(0.03, 0.09, 0.10) * (uLightCol * 0.3 + uAmbSky), ln * 0.55);
          }
        }
        lit += vec3(uFlash) * 0.25 * col;
        lit += col * carLamps(vW) * 1.25;                 // headlamps on the sand, the track and the scrub floor
        gl_FragColor = vec4(applyFog(lit, vW), 1.0);
      }`,
  });
  const hole = () => ({ value: new THREE.Vector4(0, 0, 0, 0) });
  const mat = terrainMat({ uHole: hole() });
  const mesh = new THREE.Group(); mesh.matrixAutoUpdate = false;
  for (const g of geos) { const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; mesh.add(m); }          // (each square is left out by three.js itself when it is out of view)
  scene.add(mesh);

  // finer grids that follow the view: each has half the spacing of the one before, down to about 3 to 4 m
  const D = [s * T.sx / (T.W - 1), s * T.sz / (T.H - 1)];              // spacing of the island mesh
  const K = +(Q.get('lod') ?? Math.max(1, Math.round(Math.log2(D[0] / 3.5)))), n = MOBILE ? 192 : dq(192, 224, 256), hn = n / 2;
  const gp = new Float32Array((n + 1) * (n + 1) * 3), gi = new Uint32Array(n * n * 6); k = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { gp[k++] = i - hn; gp[k++] = 0; gp[k++] = j - hn; }
  k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    gi[k++] = a; gi[k++] = c; gi[k++] = b; gi[k++] = b; gi[k++] = c; gi[k++] = d;
  }
  const grid = new THREE.BufferGeometry();
  grid.setAttribute('position', new THREE.BufferAttribute(gp, 3)); grid.setIndex(new THREE.BufferAttribute(gi, 1));
  grid.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mats = [mat];
  for (let l = 1; l <= K; l++) {
    const m = terrainMat({ uHole: hole(), uGrid: { value: new THREE.Vector4() }, uHalf: { value: hn } }, { CLIP: 1 });
    const g = new THREE.Mesh(grid, m); g.frustumCulled = false; g.matrixAutoUpdate = false; scene.add(g); mats.push(m);
  }
  follow = (x, z) => {
    for (let l = 1; l <= K; l++) {
      const dx = D[0] / 2 ** l, dz = D[1] / 2 ** l;
      // grid point (0, 0) sits on a point of the next coarser grid
      const ox = Math.round((x + T.sx / 2) / (2 * dx)) * 2 * dx - T.sx / 2, oz = Math.round((z + T.sz / 2) / (2 * dz)) * 2 * dz - T.sz / 2;
      mats[l].uniforms.uGrid.value.set(ox, oz, dx, dz);
      mats[l - 1].uniforms.uHole.value.set(ox, oz, hn * dx * 0.955, hn * dz * 0.955);
    }
  };
  follow(0, 0);

  // deep sea floor skirt out to the horizon (same shader, flat at -20 m)
  const R = 260000, y = -47 * VEX - 0.5, hx = T.sx / 2 - 60, hz = T.sz / 2 - 60;
  const sp = [], si = [];
  const quad = (x0, z0, x1, z1) => { const b = sp.length / 3; sp.push(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1); si.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); };
  quad(-R, -R, R, -hz); quad(-R, hz, R, R); quad(-R, -hz, -hx, hz); quad(hx, -hz, R, hz);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si);
  const skirt = new THREE.Mesh(sg, mat); skirt.frustumCulled = false; scene.add(skirt);
  return mesh;
}

// Terrain: real elevation mesh, satellite colour, procedural detail, dune shadows,
// and the see-through water column over the estimated seabed.
// The ground is one smooth surface (groundH: a cubic B-spline through the height grid). A coarse mesh
// covers the whole island; finer grids follow the view and blend into it, so dunes stay rounded up close.
import * as THREE from 'three';
import { U, VEX, MOBILE, LOW, Q, makeMat, LOGV, LOGF, getBlob } from './common.js';

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
  const half = new Uint16Array(W * H * 2);
  for (let i = 0; i < W * H; i++) {
    const h = (hp.data[i * 4] * 256 + hp.data[i * 4 + 1]) / 65535 * F.hrange + F.hmin;
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
  T.step = +(Q.get('step') || (MOBILE ? 6 : LOW ? 4 : 2));
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
  const idx = new Uint32Array(nx * nz * 6); k = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60000);

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
        float slope = 1.0 - N.y;

        // ---- vegetation: lift the satellite colour, add canopy clumps ----
        float lum = dot(alb, vec3(0.3, 0.55, 0.15));
        // the strip between the tide and the first dune is open beach wherever the photo shows it bright
        sand = max(sand, (1.0 - smoothstep(3.0, 5.0, h)) * (1.0 - smoothstep(0.535, 0.555, mk.b)) * smoothstep(0.10, 0.20, lum));
        sand = max(sand, smoothstep(0.28, 0.42, mk.g) * smoothstep(0.16, 0.28, lum));
        vec3 veg = alb * 1.45 + vec3(0.003, 0.009, 0.0);
        veg = mix(veg, vec3(lum * 1.2, lum * 2.0, lum * 0.75), mix(0.4, 0.22, dW));
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
        // Moreton sand: fine quartz, pale yellow, with grey patches (damp or mineral-stained); the photo sets how light it is
        float sLum = dot(alb, vec3(0.3, 0.55, 0.15));
        float greyP = smoothstep(0.56, 0.74, texture2D(uNoise, vW.xz / 1300.0 + 0.61).g * 0.88 + nB.b * 0.12);
        vec3 sd = mix(vec3(0.97, 0.86, 0.56), vec3(0.82, 0.78, 0.68), greyP * 0.18) * mix(0.94, 1.04, smoothstep(0.2, 0.8, sLum));
        sd = mix(sd, alb * vec3(1.04, 0.94, 0.72), 0.05);
        sd *= 0.95 + 0.10 * nA.r;
        float rip = sin((vW.x * 0.8 + vW.z * 0.5) * 0.9 + nC.r * 9.0) * 0.5 + 0.5;
        sd *= 1.0 - 0.05 * rip * near - 0.025 * nD.b * near;
        sd = mix(sd, sd * vec3(0.95, 0.88, 0.74), smoothstep(0.06, 0.3, slope));              // slip faces
        // wind-built dune forms: gradients of two noise scales bend the normal so bare sand shows relief from far away
        vec2 dA = vec2(texture2D(uNoise, vW.xz / 310.0 + vec2(0.01, 0.0)).r - nB.r, texture2D(uNoise, vW.xz / 310.0 + vec2(0.0, 0.01)).r - nB.r);
        vec2 dB = vec2(texture2D(uNoise, vW.xz / 47.0 + vec2(0.02, 0.0)).r - nC.r, texture2D(uNoise, vW.xz / 47.0 + vec2(0.0, 0.02)).r - nC.r);
        vec3 Ns = normalize(N + vec3(-(dA.x * 2.6 + dB.x * 1.0 * near), 0.0, -(dA.y * 2.6 + dB.y * 1.0 * near)) + vec3(rip - 0.5, 0.0, 0.0) * 0.1 * near);

        // ---- open ground: dry grass, heath and bare earth (mid-bright imagery) ----
        vec3 gr = mix(vec3(lum), alb, 1.05) * vec3(0.94, 0.93, 0.78) * 0.9;
        gr *= 0.80 + 0.28 * nB.r + (0.5 * (nC.b - 0.5) + 0.45 * (nD.r - 0.5)) * near;
        gr = mix(gr, gr * vec3(0.70, 0.80, 0.50), smoothstep(0.42, 0.7, nC.g) * 0.45 * near);
        float open = smoothstep(0.2, 0.36, lum) * (1.0 - sand);
        sd *= 0.66;
        vec3 col = mix(mix(veg, gr, open), sd, sand) * (1.0 - 0.5 * uNight * max(sand, open));
        float close = 1.0 - smoothstep(25.0, 140.0, dist);
        float headland = 1.0 - smoothstep(uCape.z * 0.8, uCape.z * 1.2, length(vW.xz - uCape.xy));
        // low wet flats away from the shore and the houses are fern country: a bright green carpet, not sand
        float wetK = (1.0 - smoothstep(7.0, 11.0, h)) * smoothstep(0.54, 0.587, mk.b) * (1.0 - sand) * (1.0 - smoothstep(0.05, 0.13, ov.r)) * (1.0 - headland);
        float floorK = (1.0 - sand) * (1.0 - smoothstep(0.4, 0.9, ov.g)) * (1.0 - headland) * (1.0 - wetK);
        if(close > 0.0){
          vec3 nE = texture2D(uNoise, vW.xz / 3.7).rgb, nF = texture2D(uNoise, vW.xz / 0.83 + 0.21).rgb;
          vec3 nG = texture2D(uNoise, vW.xz / 0.19 + 0.47).rgb;
          col *= 1.0 + ((nE.r - 0.5) * 0.7 + (nF.b - 0.5) * 0.6 + (nG.b - 0.5) * 0.7 * (1.0 - smoothstep(4.0, 30.0, dist)) + (nE.g - 0.45) * 0.45 * (1.0 - sand)) * close * mix(1.0, 0.07, sand);            // fine, clean sand: almost no blotches
          col = mix(col, col * vec3(0.72, 0.9, 0.5), smoothstep(0.5, 0.78, nF.g) * 0.6 * close * (1.0 - sand));        // grass tufts and leaf litter
          col *= 1.0 - 0.05 * sand * (1.0 - smoothstep(6.0, 38.0, dist)) * (sin(dot(vW.xz, vec2(5.2, 2.2)) + nE.r * 7.0) * 0.5 + 0.5);      // wind ripples in the sand
          N = normalize(N + vec3(nE.b - 0.5 + (nG.r - 0.5) * 0.6, 0.0, nF.r - 0.5 + (nG.g - 0.5) * 0.6) * 0.5 * close);
          // The floor of the bush is not lawn: fallen leaves, shed bark and twigs lie over pale sand, with green only in patches.
          col = mix(col, vec3(0.10, 0.19, 0.055) * (0.6 + 0.9 * nE.g) * (0.8 + 0.5 * nF.g), headland * close * (1.0 - sand) * 0.6);      // the cape is long green grass
          if(wetK > 0.0){                                                                                                          // ferns: fresh green, patches of dead brown fronds
            vec3 fern = mix(vec3(0.025, 0.10, 0.018), vec3(0.09, 0.22, 0.04), nE.g) * (0.7 + 0.6 * nF.g);
            fern = mix(fern, vec3(0.15, 0.10, 0.05), smoothstep(0.72, 0.88, nF.b) * 0.5);
            col = mix(col, fern, wetK * close * 0.92 * (1.0 - smoothstep(0.4, 0.9, ov.g)));
          }
          // The floor of the bush is sand, the same pale yellow sand as the beaches, with dark detritus lying on it:
          // drifts of dead leaves, bark and twigs under the trees, a scatter of single pieces between, and almost no grass.
          if(floorK * close > 0.0){
            float burnt = smoothstep(0.5, 0.62, texture2D(uNoise, vW.xz / 900.0).b);          // the same burnt country the trees know
            float drift = smoothstep(0.38, 0.7, nE.r * 0.55 + nF.b * 0.35 + nB.r * 0.4 - 0.12);
            vec3 det = mix(vec3(0.085, 0.06, 0.04), vec3(0.20, 0.13, 0.075), nF.r);            // dark brown leaves and twigs
            det = mix(det, vec3(0.03, 0.028, 0.026), smoothstep(0.55, 0.8, nG.b) * burnt);      // charcoal where it has burnt
            float speck = smoothstep(0.5, 0.62, nG.r * 0.6 + nF.g * 0.5);                       // broken cover: single leaves round the edges of the drifts
            vec3 lf = mix(sd, det, clamp(drift * (0.5 + 0.5 * speck) + (1.0 - drift) * speck * 0.22, 0.0, 1.0));
            float fine = 1.0 - smoothstep(8.0, 50.0, dist);
            float s1 = texture2D(uNoise, vec2(dot(vW.xz, vec2(0.8, 0.6)) / 1.3, dot(vW.xz, vec2(-0.6, 0.8)) / 0.07)).r;         // sticks and strips of bark, lying every way
            float s2 = texture2D(uNoise, vec2(dot(vW.xz, vec2(-0.5, 0.87)) / 1.1, dot(vW.xz, vec2(0.87, 0.5)) / 0.06) + 0.31).g;
            float s3 = texture2D(uNoise, vec2(dot(vW.xz, vec2(0.17, 0.98)) / 0.5, dot(vW.xz, vec2(-0.98, 0.17)) / 0.035) + 0.63).b;
            lf = mix(lf, vec3(0.15, 0.105, 0.07), smoothstep(0.73, 0.79, s1) * fine * 0.9);
            lf = mix(lf, vec3(0.07, 0.055, 0.045), smoothstep(0.75, 0.81, s2) * fine * 0.9);
            lf = mix(lf, vec3(0.24, 0.16, 0.09), smoothstep(0.7, 0.76, s3) * fine * 0.85);
            col = mix(col, lf, floorK * close * 0.97);
          }
        }
        col = mix(col, vec3(0.05, 0.15, 0.03) * (0.75 + 0.5 * nC.g), wetK * (1.0 - close) * (1.0 - smoothstep(600.0, 3500.0, dist)) * 0.7);
        // farther off the same floor shows between the bushes as sand dulled by its litter
        // (but where the photograph is dark with forest the canopy is closed: from outside you see leaves, not the floor)
        col = mix(col, mix(sd, vec3(0.12, 0.085, 0.055), 0.28 + 0.3 * nC.r), floorK * (1.0 - close) * (1.0 - smoothstep(250.0, 1200.0, dist)) * 0.85 * (1.0 - 0.94 * smoothstep(0.40, 0.20, lum)));
        // seen from a distance, forest is its canopy: dark green, mottled with crowns
        col = mix(col, vec3(0.030, 0.062, 0.022) * (0.6 + 0.9 * nB.g) * (0.75 + 0.5 * nC.g), (1.0 - sand) * smoothstep(0.40, 0.20, lum) * (1.0 - headland) * (1.0 - wetK) * (1.0 - close) * 0.62 * (1.0 - smoothstep(0.4, 0.9, ov.g)));
        // sand tracks worn into the ground (the crisp ribbon is drawn on top)
        col = mix(col, vec3(0.50, 0.43, 0.30) * (0.8 + 0.4 * nC.r), smoothstep(0.1, 0.75, ov.g) * 0.75 * (1.0 - sand));
        vec3 Nn = normalize(mix(mix(Nv, normalize(N + vec3(nD.r - 0.5, 0.0, nD.b - 0.5) * 0.3 * near), open), Ns, sand));
        float ao = clamp(1.0 + lap * 0.045, 0.55, 1.15) * mix(0.75 + 0.35 * canopy, 1.0, sand) * clamp(relief, 0.4, 1.35) * (1.0 - 0.5 * smoothstep(0.05, 0.9, ov.r));

        // ---- light ----
        vec3 L = uLightDir;
        float depth = uSeaM - h;                       // metres of water above this point
        float sh = 1.0;
        if(mk.b > 0.33 && L.y > 0.0) sh = duneShadow(vec3(vW.x, max(max(vW.y, h * uVex), uSeaM * uVex), vW.z) + vec3(0.0, 1.5, 0.0), L);
        float cs = cloudShadow(vW);
        float vis = sh * cs;
        float nl = max(dot(Nn, L), 0.0);
        nl = mix(nl, nl * 0.5 + 0.5, 0.25 * sand);     // sand glows a little into the shade
        vec3 amb = mix(uAmbGnd, uAmbSky, Nn.y * 0.5 + 0.5) * ao;
        vec3 V = normalize(cameraPosition - vW);

        // wet sand just above the waterline
        float wet = smoothstep(0.9, 0.0, -depth) * step(depth, 0.0);
        col = mix(col, col * vec3(0.72, 0.66, 0.56), wet * 0.8);
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
          float rp = sin((p.x * 0.55 - p.y * 0.35) * 1.3 + bB.r * 7.0) * 0.5 + 0.5;
          bed *= 1.0 - 0.10 * rp * near;
          float grass = smoothstep(0.52, 0.7, bA.g * 0.6 + bB.g * 0.5) * smoothstep(0.8, 2.2, depth) * smoothstep(9.0, 3.5, depth) * (1.0 - smoothstep(0.3, 0.8, texture2D(uHeight, cuv).g));
          bed = mix(bed, vec3(0.07, 0.13, 0.07), grass * 0.7);
          bed = mix(col * 0.8, bed, smoothstep(0.0, 0.9, depth));
          float c1 = texture2D(uWaterTex, p / 12.0 + uTime * vec2(0.031, 0.019)).b;
          float c2 = texture2D(uWaterTex, p / 8.3 - uTime * vec2(0.027, 0.034)).b;
          float caus = pow(min(c1, c2), 1.4) * 1.5;
          caus *= exp(-depth * 0.22) * smoothstep(0.0, 0.5, depth) * (1.0 - smoothstep(50.0, 260.0, dist)) * (1.0 - uOvercast * 0.8);
          float sun = max(L.y, 0.0);
          vec3 Nb = normalize(vec3(N.x * 7.0, N.y, N.z * 7.0));                 // exaggerated so channels and banks read as relief
          float bsh = 0.55 + 0.75 * max(dot(Nb, normalize(L + vec3(0.0, 0.6, 0.0))), 0.0);
          vec3 bl = bed * (uLightCol * sun * vis * (0.72 + caus) * bsh + amb * 0.9);
          float cosr = sqrt(1.0 - (1.0 - V.y * V.y) / 1.77);         // refracted view ray
          float path = depth * (1.0 + 1.0 / max(cosr, 0.3));
          vec3 Tm = exp(-vec3(0.42, 0.082, 0.105) * uTurb * path);
          float ex = texture2D(uHeight, cuv).g, big = texture2D(uNoise, vW.xz / 9000.0).r;
          vec3 deep = mix(uWaterDeep * vec3(1.0, 1.25, 0.85), uWaterDeep * vec3(1.0, 0.72, 1.12), smoothstep(0.3, 0.9, ex)) * (0.82 + 0.36 * big);   // green bay, indigo ocean
          vec3 scat = deep * (uLightCol * (0.10 + 0.22 * sun) * (0.5 + 0.5 * cs) + uAmbSky * 0.8);
          // a touch of turquoise back-scatter over bright sand
          scat += vec3(0.0, 0.05, 0.04) * exp(-depth * 0.2) * (uLightCol * sun * vis + uAmbSky) * 0.22;
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
        gl_FragColor = vec4(applyFog(lit, vW), 1.0);
      }`,
  });
  const hole = () => ({ value: new THREE.Vector4(0, 0, 0, 0) });
  const mat = terrainMat({ uHole: hole() });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  scene.add(mesh);

  // finer grids that follow the view: each has half the spacing of the one before, down to about 3 to 4 m
  const D = [s * T.sx / (T.W - 1), s * T.sz / (T.H - 1)];              // spacing of the island mesh
  const K = +(Q.get('lod') ?? Math.max(1, Math.round(Math.log2(D[0] / 3.5)))), n = MOBILE || LOW ? 192 : 256, hn = n / 2;
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

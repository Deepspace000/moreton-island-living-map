// Shared state, uniforms and GLSL used by every part of the map.
import * as THREE from 'three';

export const VEX = 1.7;                 // vertical exaggeration of the relief
export const LAT = -27.18, LON = 153.40;
export const TZ_HOURS = 10;             // Brisbane, no daylight saving
export const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
export const Q = new URLSearchParams(location.search);
// lighter geometry on phones, tablets and built-in graphics (override with ?q=high or ?q=low)
function weakGPU() {
  try { const g = document.createElement('canvas').getContext('webgl2'), e = g.getExtension('WEBGL_debug_renderer_info'); const r = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; g.getExtension('WEBGL_lose_context')?.loseContext(); return /Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple|SwiftShader|llvmpipe/i.test(r) && !/Arc|RTX|GTX|Radeon RX/i.test(r); } catch (e) { return false; }
}
export const LOW = Q.get('q') === 'low' || (Q.get('q') !== 'high' && (MOBILE || weakGPU()));

const v3 = (x = 0, y = 0, z = 0) => ({ value: new THREE.Vector3(x, y, z) });
const f = (x = 0) => ({ value: x });
// One object per uniform, shared by reference between all materials.
export const U = {
  uTime: f(), uSunDir: v3(0.4, 0.8, 0.2), uMoonDir: v3(0, 1, 0), uLightDir: v3(0.4, 0.8, 0.2),
  uLightCol: v3(3, 2.9, 2.7), uSunCol: v3(3, 2.9, 2.7), uAmbSky: v3(.3, .4, .6), uAmbGnd: v3(.2, .2, .15),
  uFogCol: v3(.6, .7, .85), uFogSun: v3(.9, .8, .7), uFogDens: f(0.000012),
  uZenith: v3(.1, .26, .62), uHorizon: v3(.55, .72, .9), uSunGlow: v3(1, .8, .5), uNight: f(0), uOvercast: f(0),
  uMoonLit: f(1), uStarRot: f(0),
  uDetail: { value: null }, uDetRect: { value: new THREE.Vector4(0, 0, 1, 0) }, uContour: f(1), uCirrus: f(0.6), uWalk: f(0),
  uHeight: { value: null }, uOver: { value: null }, uMask: { value: null }, uAlbedo: { value: null }, uNoise: { value: null }, uWaterTex: { value: null },
  uWorld: { value: new THREE.Vector4(1, 1, 1, 1) }, uHTex: { value: new THREE.Vector2(1, 1) }, uMpp: f(17),
  uSeaM: f(0), uVex: f(VEX), uCape: { value: new THREE.Vector4(0, 0, 1, 0) },        // Cape Moreton headland: x, z, radius
  uCloudTex: { value: null }, uCloudRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uCloudAlt: f(2000), uCloudStr: f(0.7),
  uWindDir: { value: new THREE.Vector2(1, 0) }, uChop: f(0.5), uSurf: f(1.2), uWhitecap: f(0), uRain: f(0), uSwell: f(1),
  uWaves: { value: Array.from({ length: 6 }, () => new THREE.Vector4(1, 0, 0, 100)) },
  uWavePh: { value: new Float32Array(6) }, uWaterDeep: v3(0.004, 0.085, 0.16), uTurb: f(1), uFlash: f(0),
};

export const GLSL_COMMON = /* glsl */`
uniform float uTime, uFogDens, uNight, uOvercast, uSeaM, uVex, uCloudAlt, uCloudStr, uMpp, uFlash;
uniform vec3 uSunDir, uMoonDir, uLightDir, uLightCol, uSunCol, uAmbSky, uAmbGnd, uFogCol, uFogSun, uZenith, uHorizon, uSunGlow;
uniform sampler2D uHeight, uMask, uAlbedo, uNoise, uWaterTex, uCloudTex, uOver, uDetail;
uniform vec4 uDetRect; uniform float uContour, uCirrus, uWalk;
uniform vec4 uWorld, uCloudRect, uCape;
uniform vec2 uHTex;
vec2 worldUV(vec2 xz){ return xz * uWorld.xy + 0.5; }
float sat(float x){ return clamp(x, 0.0, 1.0); }
// The ground everything stands on: a smooth (cubic B-spline) reading of the height texture, in metres.
// terrain.js has the same function in JS (groundH / meshY), so the mesh, the trees and the walker agree.
float groundH(vec2 xz){
  vec2 st = clamp(worldUV(xz), 0.0, 1.0) / uHTex - 0.5, i = floor(st), f = st - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w3 = f3 / 6.0, w2 = 1.0 - w0 - w1 - w3;
  vec2 g0 = w0 + w1, g1 = w2 + w3, a = (i - 0.5 + w1 / g0) * uHTex, b = (i + 1.5 + w3 / g1) * uHTex;
  return g0.y * (g0.x * texture2D(uHeight, a).r + g1.x * texture2D(uHeight, vec2(b.x, a.y)).r)
       + g1.y * (g0.x * texture2D(uHeight, vec2(a.x, b.y)).r + g1.x * texture2D(uHeight, b).r);
}
// world y of the drawn ground (dips slightly at the waterline so the per-pixel shoreline decides where water shows)
float groundY(vec2 xz){ float h = groundH(xz); return (h - 0.75 * max(0.0, 1.0 - abs(h) / 1.7)) * uVex; }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float cloudAt(vec2 p){
  vec2 uv = (p - uCloudRect.xy) * uCloudRect.zw + 0.5;
  vec2 e = smoothstep(vec2(0.0), vec2(0.04), uv) * smoothstep(vec2(0.0), vec2(0.04), 1.0 - uv);
  return texture2D(uCloudTex, uv).r * e.x * e.y;
}
float cloudShadow(vec3 wp){
  float ly = max(uLightDir.y, 0.16);
  vec2 p = wp.xz + uLightDir.xz / ly * (uCloudAlt - wp.y);
  float c = cloudAt(p) * 0.4 + (cloudAt(p + vec2(420.0, 130.0)) + cloudAt(p + vec2(-130.0, 420.0)) + cloudAt(p + vec2(-420.0, -130.0)) + cloudAt(p + vec2(130.0, -420.0))) * 0.15;
  return 1.0 - c * uCloudStr;
}
vec3 skyColor(vec3 d){
  float y = max(d.y, 0.0);
  float low = 1.0 - sat(uSunDir.y * 2.2);
  float az = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5));          // +1 toward the sun, -1 opposite
  vec3 anti = mix(uHorizon, uZenith * 2.6 + vec3(0.20, 0.06, 0.13) * dot(uHorizon, vec3(0.45)), 0.8);   // cool violet-pink opposite the sun
  vec3 hz = mix(uHorizon, mix(anti, uHorizon, smoothstep(-0.75, 0.9, az)), low);
  vec3 c = mix(hz, uZenith, pow(y, 0.45));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunGlow * (pow(sd, 5.0) * 0.22 * (0.4 + low) + pow(sd, 40.0) * 0.5 + pow(sd, 400.0) * 1.2) * (1.0 - 0.6 * y);
  // warm band hugging the horizon at sunrise / sunset
  c += uSunGlow * low * 0.35 * pow(1.0 - y, 10.0) * (0.35 + 0.65 * pow(sd, 2.0));
  return c;
}
vec3 fogColor(vec3 dir){
  vec3 c = skyColor(normalize(vec3(dir.x, 0.035, dir.z)));                      // haze = the sky at the horizon that way
  return mix(c, vec3(dot(c, vec3(0.3333))), 0.1) + vec3(uFlash) * 0.4;
}
float fogAmount(vec3 wp){
  float d = length(wp - cameraPosition);
  // thinner with height: integrate an exponential atmosphere along the ray (cheap form)
  float hm = max(0.5 * (wp.y + cameraPosition.y), 0.0);
  return 1.0 - exp(-d * uFogDens * exp(-hm / 2600.0));
}
vec3 applyFog(vec3 col, vec3 wp){
  vec3 dir = normalize(wp - cameraPosition);
  return mix(col, fogColor(dir), fogAmount(wp));
}
`;

export const LOGV_PARS = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
export const LOGV = '\n#include <logdepthbuf_vertex>\n';
export const LOGF_PARS = '#include <logdepthbuf_pars_fragment>\n';
export const LOGF = '\n#include <logdepthbuf_fragment>\n';

// ShaderMaterial with the shared uniforms + common GLSL wired in.
export function makeMat({ vs, fs, uniforms = {}, ...rest }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...uniforms },
    vertexShader: LOGV_PARS + GLSL_COMMON + vs,
    fragmentShader: LOGF_PARS + GLSL_COMMON + fs,
    ...rest,
  });
}

// Simple lit, vertex-coloured material for buildings, boats, wrecks, beacons.
export function objectMat(opts = {}) {
  return makeMat({
    vertexColors: true, side: opts.side ?? THREE.FrontSide, defines: opts.defines || {},
    uniforms: opts.uniforms || {},
    vs: /* glsl */`
      attribute vec3 aFx;            // x: window strength / rust, y: along, z: up
      varying vec3 vW, vN, vC, vFx;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; vFx = aFx;
        gl_Position = projectionMatrix * viewMatrix * wp;
        ${LOGV}
      }`,
    fs: /* glsl */`
      varying vec3 vW, vN, vC, vFx; uniform vec3 uWaterDeep;
      void main(){
        ${LOGF}
        float nn = dot(vN, vN); vec3 N = nn > 1e-8 ? vN * inversesqrt(nn) : vec3(0.0, 1.0, 0.0); if(!gl_FrontFacing) N = -N;
        vec3 alb = pow(vC, vec3(2.0));
        vec3 em = vec3(0.0);
        #ifdef RUST
          float r1 = texture2D(uNoise, vW.xz / 9.0 + vW.y * 0.07).r;
          float r2 = texture2D(uNoise, vec2(vW.x + vW.z, vW.y * 1.7) / 5.0).b;
          float streak = texture2D(uNoise, vec2((vW.x + vW.z) * 0.31, vW.y * 0.035)).g;                        // rain-washed vertical streaks
          #ifdef DRYRUST        // hulks rusted right through on a beach: red-brown all over, flaking lighter and darker, no growth
          alb *= 0.6 + 1.0 * r1 * r1 + 0.3 * streak; alb = mix(alb, vec3(0.11, 0.04, 0.02), smoothstep(0.55, 0.85, r2) * 0.4); alb = mix(alb, vec3(0.45, 0.17, 0.05), smoothstep(0.6, 0.9, r1) * 0.5);
          #else
          alb *= 0.3 + 1.7 * r1 * r1 + 0.5 * streak; alb = mix(alb, vec3(0.03, 0.018, 0.012), smoothstep(0.45, 0.8, r2) * 0.8); alb = mix(alb, vec3(0.30, 0.13, 0.045), smoothstep(0.62, 0.9, r1) * 0.5);
          float wl = (vW.y - uSeaM * uVex) / uVex;       // metres above the sea
          alb = mix(alb, vec3(0.02, 0.04, 0.018), smoothstep(1.3, -0.2, wl) * 0.75);
          alb = mix(alb, vec3(0.20, 0.27, 0.16), smoothstep(-0.1, -0.8, wl));       // pale weed and barnacle growth below the surface   // weed and barnacles at the waterline
          #endif
        #endif
        #ifdef WINDOWS
          if(vFx.x > 0.5){
            vec2 g = vec2(vFx.y / 3.6, vFx.z / 3.1);
            vec2 c = fract(g) - 0.5; vec2 id = floor(g);
            float win = step(abs(c.x), 0.24) * step(abs(c.y + 0.04), 0.2) * step(0.3, vFx.z);
            float lit = step(0.52, hash12(id + floor(vW.xz * 0.05)));
            alb = mix(alb, vec3(0.02, 0.035, 0.05), win * 0.85);
            em = vec3(1.0, 0.72, 0.36) * win * lit * uNight * 2.4;
          }
        #endif
        alb *= 0.72 + 0.28 * smoothstep(-0.3, 3.5, (vW.y - uSeaM * uVex) / uVex + step(1.0, vFx.x) * 9.0);   // grime toward the waterline
        if(vFx.x > 0.5) alb *= 0.62 + 0.38 * smoothstep(-0.2, 2.6, vFx.z);          // walls darken toward the ground
        float cs = cloudShadow(vW);
        float nl = max(dot(N, uLightDir), 0.0);
        vec3 skyA = mix(uAmbSky, vec3(dot(uAmbSky, vec3(0.3333))), 0.5);
        vec3 col = alb * (uLightCol * nl * cs + mix(uAmbGnd * 1.3, skyA, N.y * 0.5 + 0.5)) + em;
        float dw = (uSeaM * uVex - vW.y) / uVex;                     // below the surface: seen through the water
        if(dw > 0.0){ vec3 Tm = exp(-vec3(0.42, 0.082, 0.105) * dw * 2.3); col = col * Tm + vec3(0.012, 0.20, 0.18) * (uLightCol * 0.3 + uAmbSky * 0.8) * (1.0 - Tm); }
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
}

// downloads with progress (drives the loading bar)
const prog = { files: new Map(), cb: null };
const report = () => { let t = 0, g = 0; for (const s of prog.files.values()) { t += s.size; g += s.got; } prog.cb?.(t ? g / t : 0); };
export function expect(list, cb) { prog.cb = cb; for (const [url, size] of list) prog.files.set(url, { size, got: 0 }); }
export async function getBlob(url) {
  const st = prog.files.get(url) || { size: 1, got: 0 }; prog.files.set(url, st);
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const len = +r.headers.get('content-length'); if (len && !r.headers.get('content-encoding')) st.size = len;
  if (!r.body) { const b = await r.blob(); st.got = st.size; report(); return b; }
  const reader = r.body.getReader(), chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); st.got = Math.min(st.size, st.got + value.length); report(); }
  st.got = st.size; report();
  return new Blob(chunks, { type: r.headers.get('content-type') || '' });
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

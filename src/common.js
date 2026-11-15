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
  uZenith: v3(.1, .26, .62), uHorizon: v3(.55, .72, .9), uSunGlow: v3(1, .8, .5), uNight: f(0), uOvercast: f(0), uUnder: f(0),
  uMoonLit: f(1), uStarRot: f(0),
  uDetail: { value: null }, uDetRect: { value: new THREE.Vector4(0, 0, 1, 0) }, uContour: f(0), uCirrus: f(0.6), uWalk: f(0), uCarL: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
  uHeight: { value: null }, uOver: { value: null }, uYard: { value: null }, uYardO: { value: new THREE.Vector4(0, 0, 1, 1) }, uMask: { value: null }, uAlbedo: { value: null }, uNoise: { value: null }, uWaterTex: { value: null },
  uWorld: { value: new THREE.Vector4(1, 1, 1, 1) }, uHTex: { value: new THREE.Vector2(1, 1) }, uMpp: f(17),
  uSeaM: f(0), uVex: f(VEX), uCape: { value: new THREE.Vector4(0, 0, 1, 0) },        // Cape Moreton headland: x, z, radius
  uCloudTex: { value: null }, uCloudRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uCloudAlt: f(2000), uCloudStr: f(0.7),
  uWindDir: { value: new THREE.Vector2(1, 0) }, uChop: f(0.5), uSurf: f(1.2), uWhitecap: f(0), uRain: f(0), uSwell: f(1),
  uWaves: { value: Array.from({ length: 6 }, () => new THREE.Vector4(1, 0, 0, 100)) },
  uWavePh: { value: new Float32Array(6) }, uWaterDeep: v3(0.004, 0.085, 0.16), uTurb: f(1), uFlash: f(0),
};

export const GLSL_COMMON = /* glsl */`
uniform float uTime, uFogDens, uNight, uOvercast, uSeaM, uVex, uCloudAlt, uCloudStr, uMpp, uFlash, uUnder;
uniform vec3 uSunDir, uMoonDir, uLightDir, uLightCol, uSunCol, uAmbSky, uAmbGnd, uFogCol, uFogSun, uZenith, uHorizon, uSunGlow;
uniform sampler2D uHeight, uMask, uAlbedo, uNoise, uWaterTex, uCloudTex, uOver, uDetail;
uniform sampler2D uYard; uniform vec4 uYardO;      // one texel for each 11 m cell of the tree grid near houses: 1 where a garden tree may stand
uniform vec4 uDetRect; uniform float uContour, uCirrus, uWalk;
uniform vec4 uCarL[8];        // the headlamps of the eight nearest 4WDs: where the front of the car is (x, z) and the way it points (zero when its lamps are off)
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
  vec3 c = mix(hz, uZenith, pow(y, 0.5));               // pale at the horizon, cobalt overhead
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunGlow * (pow(sd, 5.0) * 0.22 * (0.4 + low) + pow(sd, 40.0) * 0.5 + pow(sd, 400.0) * 1.2) * (1.0 - 0.6 * y);
  // warm band hugging the horizon at sunrise / sunset
  c += uSunGlow * low * 0.35 * pow(1.0 - y, 10.0) * (0.35 + 0.65 * pow(sd, 2.0));
  return c;
}
vec3 fogColor(vec3 dir){
  // under the water the haze is the water itself: deep blue-green below, brighter toward the light above
  if(uUnder > 0.5) return mix(vec3(0.004, 0.085, 0.13), vec3(0.05, 0.40, 0.43), smoothstep(-0.6, 0.9, normalize(dir).y)) * (uLightCol * 0.3 + uAmbSky * 0.9);
  vec3 c = skyColor(normalize(vec3(dir.x, 0.035, dir.z)));                      // haze = the sky at the horizon that way
  return mix(c, vec3(dot(c, vec3(0.3333))), 0.1) + vec3(uFlash) * 0.4;
}
float fogAmount(vec3 wp){
  float d = length(wp - cameraPosition);
  if(uUnder > 0.5) return 1.0 - exp(-d * 0.085);             // you see about fifteen metres under water
  // thinner with height: integrate an exponential atmosphere along the ray (cheap form)
  float hm = max(0.5 * (wp.y + cameraPosition.y), 0.0);
  return 1.0 - exp(-d * uFogDens * exp(-hm / 2600.0));
}
// What the headlamps of the cars throw on a point of ground at night: two dipped beams from each car, widening as they go, brightest a few
// car-lengths ahead and gone by seventy metres or so.
vec3 carLamps(vec3 P){
  vec3 sum = vec3(0.0);
  for(int i = 0; i < 8; i++){
    vec4 c = uCarL[i]; vec2 d = c.zw; if(dot(d, d) < 0.01) continue;
    vec2 rel = P.xz - c.xy; float al = dot(rel, d), sd = dot(rel, vec2(-d.y, d.x));
    if(al < 0.5 || al > 100.0 || abs(sd) > 36.0) continue;
    float w = 1.5 + al * 0.24, beam = exp(-(sd - 1.3) * (sd - 1.3) / (w * w)) + exp(-(sd + 1.3) * (sd + 1.3) / (w * w));
    float fall = smoothstep(0.5, 6.0, al) * (1.0 - smoothstep(32.0, 98.0, al)) / (1.0 + al * al * 0.0026);
    sum += vec3(1.0, 0.92, 0.76) * beam * fall;
  }
  return sum;
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

// A soft dark patch on the ground under something, so it stands on the sand instead of floating over it (there are no cast shadows):
// darkest in the middle, gone at the edge, a little stronger in sunshine. Draw it on any flat quad that has uv from 0 to 1.
let blobMaterial = null;
export function blobShadowMat() {
  return blobMaterial ||= makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    vs: /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGV} }`,
    fs: /* glsl */`varying vec2 vUv; varying vec3 vW;
      void main(){ ${LOGF} float r = length(vUv - 0.5) * 2.0, a = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6) * 1.25 * (0.26 + 0.3 * clamp(uLightDir.y * 2.5, 0.0, 1.0) * cloudShadow(vW) * (1.0 - uNight));
        gl_FragColor = vec4(applyFog(vec3(0.04, 0.05, 0.085) * (uAmbSky + 0.15), vW), a); }`,
  });
}

// Simple lit, vertex-coloured material for buildings, boats, wrecks, beacons.
// Feathers, pixel by pixel. fx.x says what the surface is (1 body feathers, 2 flight feathers side by side, 3 bare skin or bill, 4 scaly leg,
// 5 one long feather on its own), fx.yz are the surface's own coordinates (along and across).
export const FEATHER_GLSL = /* glsl */`
vec3 featherPaint(vec3 alb, vec3 fx){
  float kind = floor(fx.x - 0.5); vec2 q = fx.yz; float pale = step(0.4, dot(alb, vec3(0.3333))), fine = texture2D(uNoise, q * vec2(37.0, 53.0)).r;
  if(kind < 1.5){                      // body feathers: rows of small rounded feathers, each one lapping the next and throwing a line of shade on it
    vec2 c = vec2(q.x * 30.0, q.y * 15.0); c.y += 0.5 * floor(c.x); vec2 f = fract(c) - vec2(0.36, 0.5);
    float d = length(f * vec2(1.0, 1.2)), k = 1.0 - smoothstep(0.3, 1.0, fwidth(c.x) + fwidth(c.y)), rim = smoothstep(0.3, 0.52, d);
    alb *= 1.0 - k * mix(-0.6, 0.34, pale) * rim;                       // white birds: a grey edge to every feather; dark birds: a paler fringe
    alb *= 1.0 - 0.1 * pale * smoothstep(0.35, 0.75, texture2D(uNoise, q * vec2(2.3, 1.7)).g);      // white plumage is never one flat white: soft grey and cream shading through it
    alb *= 1.0 - k * 0.07 * smoothstep(0.12, 0.0, abs(f.y)) * smoothstep(0.3, 0.0, d);                   // the shaft
    alb *= (0.92 + 0.12 * hash12(floor(c))) * (0.95 + 0.08 * fine);
  } else if(kind < 2.5 || kind > 4.5){ // flight feathers: long vanes, a shaft down the middle of each, fine barbs slanting off it
    float nF = kind > 4.5 ? 1.0 : 12.0, along = kind > 4.5 ? q.y : q.x, fi = (kind > 4.5 ? q.x : q.y) * nF, ff = fract(fi) - 0.5, k = 1.0 - smoothstep(0.25, 0.9, fwidth(fi) * (kind > 4.5 ? 0.2 : 1.0));
    if(kind < 4.5) alb *= 1.0 - k * mix(0.45, 0.3, pale) * smoothstep(0.34, 0.5, abs(ff));                              // the dark slot between one feather and the next
    alb = mix(alb, mix(alb + 0.2, alb * 0.7, pale), k * (1.0 - smoothstep(0.02, 0.07, abs(ff))) * 0.8);      // the shaft
    alb *= 1.0 - k * 0.14 * sin((along * 46.0 + abs(ff) * 26.0) * 3.0);                                  // barbs
    alb *= (0.92 + 0.12 * hash12(vec2(floor(fi), 3.0))) * (0.95 + 0.08 * fine);
  } else if(kind < 3.5) alb *= 0.88 + 0.16 * texture2D(uNoise, vec2(q.x * 3.0, q.y * 14.0)).g;           // bare skin and bill: smooth, streaked along its length
  else alb *= (0.8 + 0.22 * step(0.45, fract(q.x * 16.0))) * (0.9 + 0.15 * fine);                        // legs: rings of scales
  return alb;
}`;
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
      #ifdef BIRD
      ${FEATHER_GLSL}
      #endif
      #ifdef BOAT
      // one stencilled figure (0-9) in a cell, built from seven strokes like the figures painted on a hull or sewn on a sail
      float figure7(vec2 q, float d){
        float m = d < 0.5 ? 63.0 : d < 1.5 ? 6.0 : d < 2.5 ? 91.0 : d < 3.5 ? 79.0 : d < 4.5 ? 102.0 : d < 5.5 ? 109.0 : d < 6.5 ? 125.0 : d < 7.5 ? 7.0 : d < 8.5 ? 127.0 : 111.0;
        float inx = step(0.18, q.x) * step(q.x, 0.78), iny = step(0.04, q.y) * step(q.y, 0.96), lft = step(q.x, 0.31), rgt = step(0.65, q.x), up = step(0.5, q.y);
        float on = 0.0;
        on += mod(m, 2.0) >= 1.0 ? step(0.85, q.y) : 0.0;                              // top
        on += mod(floor(m / 2.0), 2.0) >= 1.0 ? rgt * up : 0.0;                        // upper right
        on += mod(floor(m / 4.0), 2.0) >= 1.0 ? rgt * (1.0 - up) : 0.0;                // lower right
        on += mod(floor(m / 8.0), 2.0) >= 1.0 ? step(q.y, 0.15) : 0.0;                 // bottom
        on += mod(floor(m / 16.0), 2.0) >= 1.0 ? lft * (1.0 - up) : 0.0;               // lower left
        on += mod(floor(m / 32.0), 2.0) >= 1.0 ? lft * up : 0.0;                       // upper left
        on += mod(floor(m / 64.0), 2.0) >= 1.0 ? step(abs(q.y - 0.5), 0.055) : 0.0;    // middle
        return min(on, 1.0) * inx * iny;
      }
      #endif
      void main(){
        ${LOGF}
        float nn = dot(vN, vN); vec3 N = nn > 1e-8 ? vN * inversesqrt(nn) : vec3(0.0, 1.0, 0.0); if(!gl_FrontFacing) N = -N;
        vec3 alb = pow(vC, vec3(2.0));
        vec3 em = vec3(0.0);
        #ifdef RUST
          float inside = gl_FrontFacing ? 1.0 : 0.3;       // the inside of a hull is in its own shade: holes in the plating show dark
          float r1 = texture2D(uNoise, vW.xz / 9.0 + vW.y * 0.07).r;
          float r2 = texture2D(uNoise, vec2(vW.x + vW.z, vW.y * 1.7) / 5.0).b;
          float streak = texture2D(uNoise, vec2((vW.x + vW.z) * 0.31, vW.y * 0.035)).g;                        // rain-washed vertical streaks
          #ifdef DRYRUST        // hulks rusted right through on a beach: red-brown all over, flaking lighter and darker, no growth
          alb *= 0.6 + 1.0 * r1 * r1 + 0.3 * streak; alb = mix(alb, vec3(0.11, 0.04, 0.02), smoothstep(0.55, 0.85, r2) * 0.4); alb = mix(alb, vec3(0.45, 0.17, 0.05), smoothstep(0.6, 0.9, r1) * 0.5);
          #else
          float wl = (vW.y - uSeaM * uVex) / uVex;       // metres above the sea
          { float eat = texture2D(uNoise, vec2(vW.x + vW.z * 0.7, vW.y * 0.8) / 11.0).r + 0.2 * texture2D(uNoise, vec2(vW.x - vW.z, vW.y) / 2.7).b;     // holes rusted through the plating above the water, ragged at the edge
            if(eat > 0.8 - 0.08 * smoothstep(0.5, 4.0, wl) && wl > 0.4) discard;
            if(vFx.z > 0.5 && vFx.z > 1.0 - 0.3 * (0.5 + 0.5 * sin(vFx.y * 0.55 + 1.6 * sin(vFx.y * 0.19))) * (0.55 + 0.45 * sin(vFx.y * 1.7 + 2.0 * sin(vFx.y * 0.6))) - 0.05 * texture2D(uNoise, vec2(vFx.y * 0.4, 0.37)).r) discard;      // the top edge of the plating, eaten away unevenly
            float fl = texture2D(uNoise, vec2(vW.x + vW.z, vW.y * 1.3) / 0.9).g;                                                                    // flaking scale
            float grit = texture2D(uNoise, vec2(vW.x - vW.z * 0.6, vW.y * 1.1) / 0.23).r;                                                            // fine pitting
            alb = vec3(0.034, 0.021, 0.015) * (0.5 + 1.2 * r1 * r1 + 0.4 * streak); alb = mix(alb, vec3(0.012, 0.009, 0.008), smoothstep(0.4, 0.75, r2) * 0.85); alb = mix(alb, vec3(0.11, 0.045, 0.016), smoothstep(0.62, 0.85, r1) * (0.3 + 0.5 * fl));
            alb *= (0.6 + 0.6 * fl) * (0.7 + 0.6 * grit); alb = mix(alb, alb * 0.35, smoothstep(0.72, 0.83, eat)); }
          alb = mix(alb, vec3(0.02, 0.04, 0.018), smoothstep(1.3, -0.2, wl) * 0.75);
          { // below the surface a wreck is a reef: turf algae, pink coralline crust, orange sponge and pale barnacles over the dark rust
            float g1 = texture2D(uNoise, vW.xz / 2.3 + vW.y * 0.31).r, g2 = texture2D(uNoise, vec2(vW.x + vW.y * 0.7, vW.z + vW.y * 0.4) / 2.6).g, g3 = texture2D(uNoise, vW.xz / 5.5 - vW.y * 0.11).b;
            float hb = (vW.y - groundY(vW.xz)) / uVex;                                    // metres above the sand: scoured bare low down, thickest growth above, brightest on what faces up to the light
            float zone = smoothstep(0.3, 1.4, hb), upf = smoothstep(0.2, 0.8, N.y);
            vec3 grow = mix(vec3(0.07, 0.05, 0.035), vec3(0.11, 0.17, 0.08), smoothstep(0.25, 0.75, g1) * zone);
            grow = mix(grow, vec3(0.34, 0.20, 0.23), smoothstep(0.55, 0.85, g3) * zone * 0.7);
            grow = mix(grow, vec3(0.50, 0.30, 0.10), smoothstep(0.36, 0.5, g1 * g3) * zone * 0.6);
            grow *= 0.75 + 0.6 * upf;
            grow = mix(grow, vec3(0.70, 0.68, 0.55), smoothstep(0.66, 0.8, g2) * 0.4) * (0.7 + 0.6 * g2);
            alb = mix(alb, grow, smoothstep(-0.05, -0.6, wl)); }
          alb *= inside;
          #endif
        #endif
        vec3 gloss = vec3(0.0);
        #ifdef WINDOWS
          if(vFx.x > 0.5){                       // a wall: vFx.y is metres along it, vFx.z metres above the floor
            alb = mix(vec3(dot(alb, vec3(0.3333))), alb, 0.6);          // paint fades in the sun and salt: no wall is as bright as the colour card
            float kind = floor(vFx.x + 0.1), fx10 = fract(vFx.x + 0.1), plain = step(0.3, fx10), front = step(0.125, fx10) * step(fx10, 0.175), nodoor = step(0.175, fx10), fy = fwidth(vFx.y), fz = fwidth(vFx.z);
            if(kind < 1.5){                      // weatherboards: each board laps the one below and throws a line of shadow
              float b = fract(vFx.z / 0.19), k = 1.0 - smoothstep(0.25, 0.9, fz / 0.19);
              alb *= 1.0 - k * (0.32 * smoothstep(0.18, 0.0, b) - 0.07 * smoothstep(0.7, 1.0, b));
            } else if(kind < 2.5){               // fibro sheets, the joints covered with battens, and a rail at waist height
              float bx = abs(fract(vFx.y / 1.2) - 0.5), k = 1.0 - smoothstep(0.02, 0.12, fy / 1.2);
              alb *= 1.0 + k * (0.10 * smoothstep(0.034, 0.026, bx) - 0.24 * smoothstep(0.014, 0.0, abs(bx - 0.042)));
              alb *= 1.0 + k * (0.08 * smoothstep(0.045, 0.035, abs(vFx.z - 1.2)) - 0.2 * smoothstep(0.016, 0.0, abs(vFx.z - 1.145)));
            } else if(kind < 3.5){               // rendered block: faint courses under the paint
              vec2 q = vec2(vFx.y / 0.4, vFx.z / 0.2); q.x += 0.5 * floor(q.y); vec2 jb = abs(fract(q) - 0.5);
              alb *= 1.0 - 0.10 * (1.0 - smoothstep(0.2, 0.8, fz / 0.2)) * max(smoothstep(0.45, 0.5, jb.x), smoothstep(0.42, 0.5, jb.y));
            } else if(kind < 4.5){               // newer houses: vertical boards with narrow grooves
              alb *= 1.0 - 0.3 * (1.0 - smoothstep(0.25, 0.9, fy / 0.3)) * smoothstep(0.1, 0.0, fract(vFx.y / 0.3));
            } else {                             // corrugated iron walls; the deeper square ribs of a shipping container; rust creeping up from the ground
              float pitch = kind < 5.5 ? 0.16 : 0.3, rib = sin(vFx.y / pitch * 6.2832); if(kind > 5.5) rib = clamp(rib * 2.5, -1.0, 1.0);
              alb *= 1.0 + 0.14 * rib * (1.0 - smoothstep(0.25, 0.9, fy / pitch));
              float rs = texture2D(uNoise, vec2(vFx.y * 0.31, vFx.z * 0.045)).g;
              alb = mix(alb, vec3(0.20, 0.085, 0.03), smoothstep(0.5, 0.8, rs) * smoothstep(2.6, 0.1, vFx.z) * 0.7);
            }
            // weather: patchy paint, and dark streaks run down by the rain
            alb *= 0.84 + 0.26 * texture2D(uNoise, vFx.yz * 0.11).r;
            alb *= 1.0 - 0.2 * smoothstep(0.55, 0.9, texture2D(uNoise, vec2(vFx.y * 0.45, vFx.z * 0.03)).b);
            if(kind < 4.5 && plain < 0.5){       // windows and doors, one bay every 3.6 m
              vec2 g = vec2(vFx.y / 3.6, vFx.z / 3.1); vec2 c = fract(g) - 0.5; vec2 id = floor(g);
              float h = hash12(id + floor(vW.xz * 0.05)), h2 = fract(h * 7.31), h3 = fract(h * 23.7), h4 = fract(h * 51.3);
              vec3 trim = kind > 3.5 ? vec3(0.05, 0.055, 0.06) : vec3(0.80, 0.79, 0.74);
              float lit = step(0.52, h);
              if(h2 < 0.17 && id.y == 0.0 && nodoor < 0.5){      // a door: frame, panel, a small pane and a handle
                float dy = (c.y + 0.5) * 3.1;
                float fr = step(abs(c.x), 0.142) * step(0.0, dy) * step(dy, 2.14), dr = step(abs(c.x), 0.122) * step(0.03, dy) * step(dy, 2.07);
                vec3 dc = h3 < 0.3 ? vec3(0.70, 0.69, 0.64) : h3 < 0.55 ? vec3(0.05, 0.12, 0.22) : h3 < 0.8 ? vec3(0.28, 0.10, 0.06) : vec3(0.06, 0.20, 0.17);
                float pane = step(abs(c.x), 0.07) * step(abs(dy - 1.55), 0.3) * step(0.5, h4);
                dc *= 1.0 - 0.25 * step(abs(abs(c.x) - 0.085), 0.006) * step(abs(dy - 1.0), 0.85);
                dc = mix(dc, vec3(0.03, 0.045, 0.06), pane); dc = mix(dc, vec3(0.5), step(abs(c.x - 0.095), 0.012) * step(abs(dy - 1.02), 0.05));
                alb = mix(alb, trim, fr); alb = mix(alb, dc, dr);
                em = vec3(1.0, 0.72, 0.36) * pane * dr * lit * uNight * 2.0;
              } else {
                float slide = front * step(h2, 0.74) * step(abs(id.y), 0.5);                                          // onto the verandah: sliding glass doors, floor to head height
                float hw = slide > 0.5 ? 0.31 : h3 < 0.45 ? 0.17 : 0.26, hh = slide > 0.5 ? 0.33 : 0.2, cy = slide > 0.5 ? c.y + 0.15 : c.y + 0.04, up = step(slide > 0.5 ? 0.02 : 0.3, vFx.z);
                float fr = step(abs(c.x), hw + 0.022) * step(abs(cy), hh + 0.026) * up, win = step(abs(c.x), hw) * step(abs(cy), hh) * up;
                float sill = step(abs(c.x), hw + 0.04) * step(abs(cy + hh + 0.04), 0.014) * up * (1.0 - slide);
                float bar = max(step(abs(c.x), 0.008), kind < 1.5 && slide < 0.5 ? step(abs(cy), 0.009) : 0.0);                       // sliding sashes; the old weatherboard places have four panes
                vec3 gl = mix(vec3(0.015, 0.028, 0.04), vec3(0.09, 0.15, 0.21), smoothstep(-hh, hh, cy)) + 0.05 * step(0.8, fract((c.x + cy) * 5.0 + h * 3.0));    // glass: dark, with the sky in it
                float blind = step(h4, 0.45) * step(mix(-0.1, 0.12, h2), cy);                                          // some have a blind half down
                gl = mix(gl, vec3(0.42, 0.40, 0.34), blind * 0.8);
                alb = mix(alb, trim, max(fr, sill)); alb = mix(alb, mix(gl, trim, bar), win);
                alb *= 1.0 - 0.22 * step(abs(c.x), hw + 0.04) * step(abs(cy + hh + 0.075), 0.02) * up * (1.0 - slide);               // the sill's shadow
                em = vec3(1.0, 0.72, 0.36) * win * (1.0 - bar) * lit * uNight * mix(2.4, 1.3, blind);
                gloss = vec3(win * (1.0 - bar) * (1.0 - blind) * 0.5);
              }
            }
          }
          if(vFx.x < -0.5){                      // corrugated iron: ribs running down the roof, weathered in streaks, rows of screws, rust where the coating has gone
            alb = mix(vec3(dot(alb, vec3(0.3333))), alb, 0.62) * 0.9;
            float rib = sin(vFx.y * 14.0) * (1.0 - smoothstep(0.06, 0.3, fwidth(vFx.y)));
            alb *= 0.93 + 0.07 * rib + 0.14 * (texture2D(uNoise, vec2(vFx.y * 0.11, vW.y * 0.02 + vW.x * 0.004)).r - 0.5);
            alb *= 1.0 - 0.10 * smoothstep(0.035, 0.0, abs(fract(vFx.z / 0.9 + 0.5) - 0.5)) * (1.0 - smoothstep(0.02, 0.12, fwidth(vFx.z)));
            float rusty = smoothstep(0.55, 0.82, texture2D(uNoise, vW.xz / 95.0).g), rn = texture2D(uNoise, vec2(vFx.y * 0.31, vFx.z * 0.47 + vW.x * 0.013)).r;
            float gather = max(smoothstep(1.3, 0.05, vFx.z), 0.8 * smoothstep(0.14, 0.0, abs(fract(vFx.z / 0.9 + 0.5) - 0.5)));      // rust starts at the eaves and along the laps of the sheets
            alb = mix(alb, vec3(0.13, 0.06, 0.028) * (0.7 + 0.6 * rn), rusty * smoothstep(0.74, 0.92, rn + 0.3 * gather) * 0.75);
            alb *= 1.0 - 0.1 * smoothstep(0.6, 0.0, vFx.z);                                    // grime along the gutter line
          }
        #endif
        #ifdef CAR
          if(vFx.x > 0.25){                      // a 4WD: every point knows which part it is and where on the car it sits, in metres (see fourWD)
            float part = floor(vFx.x), shine = 0.0; vec3 Lp = vec3(vFx.y, vFx.z, (fract(vFx.x) - 0.5) * 5.0);
            vec3 fn = abs(normalize(cross(dFdx(Lp), dFdy(Lp)) + 1e-7));            // which way this bit of the car faces, in the car's own frame
            vec2 wc = vec2(Lp.x > 0.0 ? 1.5 : -1.55, 0.44); float dW = length(Lp.xy - wc);       // from the nearer wheel centre
            float dn = texture2D(uNoise, Lp.xy * 0.23 + Lp.z * 0.11).r;
            if(part < 0.5){                      // the body shell: paint, with the glass, seams, grille and plates drawn on it
              shine = 0.55;
              float sideK = smoothstep(0.5, 0.75, fn.z), endK = smoothstep(0.55, 0.8, fn.x), topK = smoothstep(0.6, 0.85, fn.y);
              float fwd = 0.86 - (Lp.y - 1.16) * 0.61;                                             // the line of the windscreen
              float inY = smoothstep(1.21, 1.25, Lp.y) * smoothstep(1.78, 1.74, Lp.y);
              float glass = sideK * inY * step(-2.1, Lp.x) * step(Lp.x, fwd - 0.1) * smoothstep(0.045, 0.06, min(abs(Lp.x + 0.04), abs(Lp.x + 1.03)));      // side windows, pillars between
              glass = max(glass, (1.0 - sideK) * step(fwd - 0.07, Lp.x) * step(Lp.x, 1.02) * step(1.22, Lp.y) * step(Lp.y, 1.8) * step(abs(Lp.z), 0.76));    // windscreen
              glass = max(glass, endK * step(Lp.x, -2.2) * step(abs(Lp.z), 0.62) * step(1.3, Lp.y) * step(Lp.y, 1.72));                                       // rear window
              float seam = min(min(abs(Lp.x - 0.92), abs(Lp.x + 0.04)), abs(Lp.x + 1.03));
              alb *= 1.0 - 0.6 * smoothstep(0.02, 0.006, seam) * step(0.52, Lp.y) * sideK;                                                                    // door seams
              alb = mix(alb, vec3(0.03), sideK * step(abs(Lp.y - 1.06), 0.02) * max(step(abs(Lp.x - 0.1), 0.085), step(abs(Lp.x + 0.87), 0.085)));            // handles
              float arch = max(smoothstep(0.63, 0.59, dW) * sideK, step(Lp.y, 0.5)); alb = mix(alb, vec3(0.012), arch); shine *= 1.0 - arch;                  // black wheel arches and sills
              float nose = endK * step(1.5, Lp.x), tail = endK * step(Lp.x, -1.5);
              float grille = nose * step(abs(Lp.z), 0.5) * step(abs(Lp.y - 0.9), 0.13);
              alb = mix(alb, vec3(0.015) + 0.10 * step(0.5, fract(Lp.y * 24.0)), grille); shine *= 1.0 - grille;
              alb = mix(alb, vec3(0.78, 0.78, 0.72), (nose + tail) * step(abs(Lp.z), 0.2) * step(abs(Lp.y - 0.62), 0.055));                                  // number plates
              alb *= 1.0 - tail * 0.55 * smoothstep(0.02, 0.006, abs(Lp.z + 0.3)) * step(0.56, Lp.y);                                                         // the seam of the tail door
              alb *= 1.0 - 0.3 * topK * smoothstep(0.016, 0.006, abs(abs(Lp.z) - 0.68)) * step(1.05, Lp.x) * step(Lp.x, 2.2);                                 // bonnet shut lines
              float dust = smoothstep(1.2, 0.45, Lp.y) * (0.2 + 0.8 * dn) * (1.0 - topK);                                                                     // sand and salt thrown up from the beach
              alb = mix(alb, vec3(0.40, 0.34, 0.23), dust * 0.8); shine *= 1.0 - dust;
              if(glass > 0.5){ alb = mix(vec3(0.008, 0.012, 0.016), vec3(0.03, 0.055, 0.08), smoothstep(1.25, 1.75, Lp.y)) + 0.02 * dn; shine = 1.2; }       // glass: dark below, the sky in its upper half
            } else if(part > 1.5 && part < 2.5){ // wheels: tread blocks, a dusty sidewall, a steel rim with six holes
              float a = atan(Lp.y - wc.y, Lp.x - wc.x);
              alb = vec3(0.014) * (0.6 + 0.8 * step(0.5, fract(a * 4.8 + Lp.z * 6.0)) * step(0.43, dW));
              alb = mix(alb, vec3(0.30, 0.26, 0.18), 0.35 * dn);
              vec3 rim = vec3(0.16, 0.165, 0.17) * (0.3 + 0.7 * smoothstep(0.03, 0.05, length(vec2(dW - 0.16, sin(a * 3.0) * 0.11))));
              alb = mix(alb, rim, smoothstep(0.27, 0.25, dW)); alb = mix(alb, vec3(0.05), smoothstep(0.065, 0.05, dW)); shine = 0.3 * smoothstep(0.30, 0.28, dW);
            } else if(part < 3.5) shine = 0.15;  // bull bar, roof rack, spare wheel cover
            else if(part < 4.5){ em = alb * uNight * 1.5; shine = 0.9; }       // lamps
            else alb *= 0.7 + 0.6 * dn;          // canvas swag
            gloss = vec3(shine);
          }
        #endif
        #ifdef BOAT
          if(vFx.x > 0.5){                       // a boat: every part knows what it is and where on the boat it sits (see finish in boats.js)
            float code = floor(vFx.x - 0.5), zone = floor(code / 8.0 + 0.01), face = code - zone * 8.0, shine = 0.0; vec2 L = vFx.yz;
            float bn = texture2D(uNoise, L * 0.11 + zone * 0.37).r, streak = texture2D(uNoise, vec2(L.x * 0.17, L.y * 0.03)).g;
            if(zone < 0.5){                      // paint and gelcoat: a boot stripe above the water, weeping streaks below the deck edge
              shine = 0.5;
              float hullSide = 0.0;
              if(face > 2.5){ hullSide = 1.0;        // the side of a hull. L.x: metres aft of the bow; L.y: 0 at the waterline, 1 at the gunwale
                float xb = L.x, hv = L.y, fine = 1.0 - smoothstep(0.02, 0.07, fwidth(hv)), pale = step(0.35, dot(alb, vec3(0.333)));
                vec3 base = alb, acc = pale > 0.5 ? vec3(0.02, 0.05, 0.16) : vec3(0.76, 0.75, 0.70);
                float figs = 0.0, fx0 = 1.5, fw = 0.2, fy0 = 0.33, fh = 0.2;               // the registration figures on the bow
                if(face < 3.5){                  // yacht: boot stripe, a gold cove line under the gunwale, round ports with bright rims
                  alb = mix(alb, acc, smoothstep(0.07, 0.09, hv) * smoothstep(0.2, 0.18, hv));
                  alb = mix(alb, vec3(0.60, 0.46, 0.16), smoothstep(0.80, 0.815, hv) * smoothstep(0.87, 0.855, hv) * step(0.7, xb) * (0.4 + 0.6 * fine));
                  vec2 pq = vec2((fract((xb - 3.5) / 1.45) - 0.5) * 1.45, (hv - 0.6) * 0.95); float pr = length(pq), has = step(3.5, xb) * step(xb, 9.3);
                  alb = mix(alb, vec3(0.80, 0.79, 0.74), has * smoothstep(0.165, 0.15, pr));
                  float pane = has * smoothstep(0.12, 0.105, pr); alb = mix(alb, vec3(0.012, 0.018, 0.026), pane); shine = mix(shine, 1.7, pane);
                  em += vec3(1.0, 0.8, 0.5) * pane * uNight * 0.7 * step(0.5, hash12(vec2(floor((xb - 3.5) / 1.45), 3.0)));
                } else if(face < 4.5){           // motor cruiser: boot stripe, a broad sheer stripe sweeping aft from the bow with a pin line under it, two ports forward
                  alb = mix(alb, acc, smoothstep(0.06, 0.075, hv) * smoothstep(0.16, 0.145, hv));
                  float sw = 0.60 + 0.10 * smoothstep(0.0, 4.0, xb);
                  alb = mix(alb, acc, smoothstep(sw, sw + 0.012, hv) * smoothstep(0.83, 0.818, hv) * smoothstep(0.35, 0.8, xb));
                  alb = mix(alb, vec3(0.62, 0.08, 0.06), smoothstep(sw - 0.07, sw - 0.06, hv) * smoothstep(sw - 0.03, sw - 0.04, hv) * smoothstep(0.35, 0.8, xb) * (0.4 + 0.6 * fine));
                  vec2 pq = vec2((fract((xb - 2.3) / 1.3) - 0.5) * 1.3, (hv - 0.47) * 1.3); float bx = max(abs(pq.x) - 0.26, abs(pq.y) - 0.07), has = step(2.3, xb) * step(xb, 4.9);
                  alb = mix(alb, vec3(0.74, 0.74, 0.72), has * smoothstep(0.035, 0.02, bx)); float pane = has * smoothstep(0.004, -0.008, bx); alb = mix(alb, vec3(0.012, 0.018, 0.026), pane); shine = mix(shine, 1.7, pane);
                  fy0 = 0.24; fh = 0.17; fx0 = 0.9;
                } else if(face < 5.5){           // aluminium dinghy: bare metal, pressed strakes along its length, a rib every half metre, scratches, big black figures
                  float ln = abs(fract(hv * 3.0 + 0.5) - 0.5) / 3.0;
                  alb *= 1.0 - 0.3 * smoothstep(0.022, 0.006, ln) * fine + 0.18 * smoothstep(0.03, 0.02, abs(ln - 0.035)) * fine;
                  alb *= 1.0 - 0.12 * smoothstep(0.03, 0.01, abs(fract(xb / 0.55) - 0.5) * 0.55) * fine;
                  alb *= 0.82 + 0.3 * texture2D(uNoise, vec2(xb * 0.9, hv * 0.12)).r; shine = 0.9;
                  alb = mix(alb, vec3(0.86, 0.88, 0.9), 0.5 * step(0.8, texture2D(uNoise, vec2(xb * 2.4, hv * 0.4) + 0.3).g) * fine);
                  fx0 = 0.75; fw = 0.15; fy0 = 0.42; fh = 0.4;
                } else if(face < 6.5){           // steel work boat: plates and their welded seams, a band at the water, rust weeping from every scupper, draught marks at the bow
                  alb = mix(alb, pale > 0.5 ? vec3(0.03, 0.06, 0.14) : vec3(0.04, 0.04, 0.045), smoothstep(0.1, 0.11, hv) * smoothstep(0.22, 0.21, hv));
                  float seam = max(smoothstep(0.03, 0.008, abs(fract(xb / 2.6) - 0.5) * 2.6), smoothstep(0.02, 0.006, abs(hv - 0.56)));
                  alb *= 1.0 - 0.22 * seam * fine; alb *= 0.9 + 0.16 * texture2D(uNoise, vec2(floor(xb / 2.6) * 0.37, step(0.56, hv) * 0.5)).r;
                  float sid = floor(xb / 2.6), dx = (fract(xb / 2.6) - 0.5) * 2.6 + 0.04 * sin(hv * 17.0 + sid), len = 0.35 + 0.6 * hash12(vec2(sid, 9.0));
                  alb = mix(alb, vec3(0.30, 0.13, 0.05), 0.62 * smoothstep(0.11, 0.0, abs(dx)) * smoothstep(1.0 - len, 1.0, hv) * (0.5 + 0.5 * streak));
                  float tick = step(abs(xb - 1.4), 0.16) * step(abs(fract(hv * 5.0) - 0.5), 0.07) * step(0.2, hv) * step(hv, 0.9);
                  alb = mix(alb, vec3(0.85), tick * fine); fx0 = 3.0; fw = 0.5; fy0 = 0.62; fh = 0.26;
                } else {                         // jet ski and the rest: a dark lower half and two raked flashes of colour
                  alb = mix(alb, vec3(0.035, 0.035, 0.04), smoothstep(0.52, 0.48, hv + 0.1 * sin(xb * 2.2)));
                  float fl = fract((xb + hv * 0.5) / 1.1); alb = mix(alb, vec3(0.9), step(0.5, hv) * step(0.42, fl) * step(fl, 0.56));
                  fx0 = -9.0;
                }
                // registration figures, both bows
                vec2 fq = vec2((xb - fx0) / fw, (hv - fy0) / fh);
                if(fq.x > 0.0 && fq.x < 6.0 && fq.y > 0.0 && fq.y < 1.0 && fx0 > -1.0){
                  float fid = floor(fq.x); figs = figure7(vec2(fract(fq.x), fq.y), floor(hash12(vec2(fid * 3.7, face)) * 9.99)) * (1.0 - smoothstep(0.25, 0.7, fwidth(fq.x)));
                  alb = mix(alb, dot(base, vec3(0.333)) > 0.3 ? vec3(0.03, 0.03, 0.04) : vec3(0.9), figs);
                }
                if(face < 4.5 || face > 6.5){     // glass fibre: weeping streaks below each scupper, long scrapes where she has lain along a jetty, a tide mark
                  float sid = floor(xb / 1.9), dx = (fract(xb / 1.9) - 0.3 - 0.4 * hash12(vec2(sid, 5.0))) * 1.9 + 0.02 * sin(hv * 23.0 + sid), len = 0.25 + 0.5 * hash12(vec2(sid, 9.0));
                  alb *= 1.0 - 0.26 * smoothstep(0.05, 0.0, abs(dx)) * smoothstep(1.0 - len, 1.0, hv) * (1.0 - smoothstep(0.93, 1.0, hv)) * (0.4 + 0.6 * streak);
                  alb *= 1.0 - 0.13 * smoothstep(0.6, 0.8, texture2D(uNoise, vec2(xb * 0.07, hv * 2.6)).b) * smoothstep(0.75, 0.3, hv);
                }
                float tide = smoothstep(0.13 + 0.07 * texture2D(uNoise, vec2(xb * 0.21, 0.4)).r, 0.0, hv);
                alb = mix(alb, vec3(0.30, 0.29, 0.17), tide * 0.45);       // the yellow-brown stain the harbour leaves just above the water
                face = 0.0;
              }
              alb *= 0.94 + 0.08 * bn;
              if(face < 1.5 && hullSide < 0.5){     // cabin sides and other upright paintwork: moulded panel joints, and the grey streaks rain leaves below every edge
                float fineC = 1.0 - smoothstep(0.02, 0.08, fwidth(L.x));
                alb *= 1.0 - 0.1 * fineC * (1.0 - smoothstep(0.006, 0.02, abs(fract(L.x / 1.7 + 0.25) - 0.5) * 1.7));
                alb *= 1.0 - 0.1 * smoothstep(0.55, 0.9, texture2D(uNoise, vec2(L.x * 0.45, L.y * 0.06)).r) * (0.4 + 0.6 * texture2D(uNoise, vec2(L.x * 0.1, 0.7)).b);
              }
              if(face < 1.5){                     // sunlight thrown up off the water plays over the topsides in moving bands
                float hw = (vW.y - uSeaM * uVex) / uVex;
                float rp = texture2D(uNoise, vec2(L.x * 0.5 + uTime * 0.05, hw * 0.16 - uTime * 0.1)).r * texture2D(uNoise, vec2(L.x * 0.33 - uTime * 0.04, hw * 0.11 - uTime * 0.06) + 0.4).g;       // thin wavering lines, as light off ripples is
                em += uLightCol * alb * smoothstep(0.2, 0.42, rp) * smoothstep(1.3, 0.1, hw) * step(0.0, hw) * 0.2 * clamp(uLightDir.y * 3.0, 0.0, 1.0) * cloudShadow(vW);
              }
            } else if(zone < 1.5){               // bottom paint: scum at the waterline, weed further down
              alb = mix(alb * (0.75 + 0.5 * bn), vec3(0.06, 0.10, 0.045), smoothstep(-0.6, 0.05, L.y) * (0.25 + 0.55 * bn));
              alb = mix(alb, vec3(0.62, 0.6, 0.5), step(0.8, texture2D(uNoise, L * 2.3).r) * smoothstep(-0.5, 0.0, L.y) * 0.5);        // barnacles in a band below the waterline
            } else if(zone < 2.5){               // a band of windows: dark panes with frames between them, some lit at night
              float pane = step(abs(fract(L.x / 1.3 + 0.5) - 0.5), 0.445), id = floor(L.x / 1.3 + 0.5);
              alb = mix(vec3(0.55, 0.55, 0.53), vec3(0.012, 0.018, 0.024) + 0.035 * step(0.78, fract((L.x + L.y) * 1.3)), pane); shine = mix(0.4, 1.7, pane);       // dark panes with a slanting gleam, pale frames
              alb = mix(alb, vec3(0.03), pane * step(abs(fract(L.x / 1.3 + 0.5) - 0.5), 0.445) * step(0.415, abs(fract(L.x / 1.3 + 0.5) - 0.5)));                    // the rubber the glass is set in
              em = vec3(1.0, 0.8, 0.5) * pane * uNight * 0.9 * step(0.45, hash12(vec2(id, floor(vW.x * 0.02))));
            } else if(zone < 3.5){               // a laid deck: planks running fore and aft, dark seams, butt joints
              float kf = 1.0 - smoothstep(0.3, 1.0, fwidth(L.y) / 0.16), row = floor(L.y / 0.16);
              if(alb.r - alb.b > 0.05){            // timber: planks, seams, butts, and the grain running along each plank, greyed by the weather
                alb *= 1.0 - 0.5 * kf * smoothstep(0.12, 0.04, fract(L.y / 0.16));
                alb *= 1.0 - 0.4 * kf * smoothstep(0.012, 0.004, abs(fract(L.x / 2.4 + row * 0.37) - 0.5));
                alb *= 0.86 + 0.24 * texture2D(uNoise, vec2(L.x * 0.6, L.y * 9.0 + row * 0.31)).r;
                alb = mix(alb, vec3(dot(alb, vec3(0.3333))) * 1.05, 0.3 * texture2D(uNoise, L * 0.35).g);
              } else {                             // painted or bare metal: a non-skid pattern of small raised diamonds
                vec2 dq = vec2(L.x + L.y, L.x - L.y) * 9.0;
                alb *= 1.0 - 0.14 * step(0.3, sin(dq.x) * sin(dq.y)) * (1.0 - smoothstep(0.3, 1.2, fwidth(dq.x)));
              }
              alb *= 0.82 + 0.34 * bn;
            } else {                             // sailcloth: seams between the panels, and the sun glowing through
              float seamS = smoothstep(0.035, 0.012, abs(fract((L.y + L.x * 0.12) / 0.95) - 0.5) * 0.95);
              alb *= 1.0 - 0.3 * seamS; alb *= 0.93 + 0.1 * step(0.5, fract((L.y + L.x * 0.12) / 1.9));          // stitched seams between the panels, alternate panels a shade apart
              alb *= 0.9 + 0.14 * bn;
              alb *= 1.0 - 0.02 * step(0.88, max(fract(L.x * 9.0), fract(L.y * 9.0))) * (1.0 - smoothstep(0.2, 0.8, fwidth(L.x * 9.0)));     // the ripstop grid of the cloth
              float jib = step(1.43, L.x), leech = -3.8 + 0.404 * (L.y - 2.45);                  // where the after edge of the mainsail runs at this height
              // mainsail: four stiff battens in from the leech, a tape down the luff, a class badge high up; jib: a strip of blue sun-cover down its after edge
              float bat = (1.0 - jib) * (1.0 - smoothstep(0.02, 0.05, abs(fract((L.y - 3.2) / 2.6) - 0.5) * 2.6)) * step(leech, L.x + 0.3) * step(L.x, leech + 1.7) * step(3.5, L.y) * step(L.y, 13.5);
              alb *= 1.0 - 0.3 * bat;
              alb *= 1.0 - 0.14 * (1.0 - jib) * step(1.18, L.x);
              float bd = length(L - vec2(leech + 1.25, 11.0) + vec2(0.0, 0.0)) ; bd = jib > 0.5 ? 9.0 : length(L - vec2(-3.8 + 0.404 * 8.55 + 1.25, 11.0));
              alb = mix(alb, vec3(0.62, 0.07, 0.06), step(bd, 0.46) * step(0.3, bd));
              { vec2 sq = vec2((L.x + 1.75) / 0.62, (L.y - 8.4) / 1.0);                 // sail number under the badge, and two dark draft stripes across the cloth
                if(jib < 0.5 && sq.x > 0.0 && sq.x < 4.0 && sq.y > 0.0 && sq.y < 1.0) alb = mix(alb, vec3(0.05, 0.05, 0.07), figure7(vec2(fract(sq.x), sq.y), floor(hash12(vec2(floor(sq.x) * 5.3, 2.0)) * 9.99)));
                alb = mix(alb, vec3(0.08, 0.08, 0.1), (1.0 - jib) * (step(abs(L.y - 6.3), 0.035) + step(abs(L.y - 10.2), 0.035)) * step(leech + 0.5, L.x) * step(L.x, 1.0) * step(0.3, fract(L.x * 0.9))); }
              alb = mix(alb, vec3(0.05, 0.10, 0.30), jib * step(L.x, 1.45 - (13.4 - L.y) * 0.047 + 0.42) * step(1.9, L.y));
              em = alb * uLightCol * max(dot(-N, uLightDir), 0.0) * 0.32 * cloudShadow(vW);
            }
            alb *= 0.78 + 0.22 * smoothstep(-0.2, 1.3, (vW.y - uSeaM * uVex) / uVex);      // grime toward the waterline
            gloss = vec3(shine);
          }
        #endif
        #ifdef PLANE
          if(vFx.x > 0.5){                       // an aircraft's skin: sheets of metal with a seam every arm's length, a line of rivets beside each, exhaust and dust
            vec2 L = vFx.yz; float fineP = 1.0 - smoothstep(0.015, 0.06, fwidth(L.x)), sx = (fract(L.x / 0.74) - 0.5) * 0.74, sy = (fract(L.y / 0.52) - 0.5) * 0.52;
            alb *= 1.0 - 0.2 * fineP * (1.0 - smoothstep(0.004, 0.012, abs(sx))); alb *= 1.0 - 0.12 * fineP * (1.0 - smoothstep(0.004, 0.012, abs(sy)));
            alb *= 1.0 - 0.14 * fineP * (1.0 - smoothstep(0.006, 0.014, length(vec2(abs(sx) - 0.035, (fract(L.y / 0.085) - 0.5) * 0.085))));
            alb *= 0.9 + 0.14 * texture2D(uNoise, L * 0.7).r;
            alb = mix(alb, vec3(0.16, 0.15, 0.14), 0.35 * smoothstep(0.55, 0.9, texture2D(uNoise, vec2(L.x * 0.25, L.y * 1.7)).g) * (1.0 - smoothstep(1.2, 3.3, L.x)) * smoothstep(0.2, 2.6, L.x) * step(L.y, 1.0));   // soot streaming back from the exhaust under the nose
            gloss = vec3(0.75);
          }
        #endif
        #ifdef BIRD
        if(vFx.x > 0.5) alb = featherPaint(alb, vFx);
        #endif
        #if !defined(CAR) && !defined(BOAT) && !defined(BIRD)
        alb *= 0.72 + 0.28 * smoothstep(-0.3, 3.5, (vW.y - uSeaM * uVex) / uVex + step(1.0, vFx.x) * 9.0);   // grime toward the waterline
        if(vFx.x > 0.5) alb *= 0.62 + 0.38 * smoothstep(-0.2, 2.6, vFx.z);          // walls darken toward the ground
        #endif
        float cs = cloudShadow(vW);
        float nl = max(dot(N, uLightDir), 0.0);
        vec3 skyA = mix(uAmbSky, vec3(dot(uAmbSky, vec3(0.3333))), 0.5);
        vec3 col = alb * (uLightCol * nl * cs + mix(uAmbGnd * 1.3, skyA, N.y * 0.5 + 0.5)) + em;
        if(gloss.x > 0.0){                       // glass and paint mirror the sky, and glint in the sun
          vec3 V = normalize(cameraPosition - vW), Rf = reflect(-V, N); float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          vec3 skyc = Rf.y > 0.0 ? mix(uHorizon, uZenith, sqrt(Rf.y)) : uAmbGnd * 2.0;
          col += gloss.x * (skyc * (0.07 + 0.5 * fres) + uLightCol * pow(max(dot(Rf, uLightDir), 0.0), 48.0) * 0.5 * cs);
        }
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

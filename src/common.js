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
  uDetail: { value: null }, uDetRect: { value: new THREE.Vector4(0, 0, 1, 0) }, uContour: f(0), uCirrus: f(0.6), uWalk: f(0),
  uHeight: { value: null }, uOver: { value: null }, uMask: { value: null }, uAlbedo: { value: null }, uNoise: { value: null }, uWaterTex: { value: null },
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
  // under the water the haze is the water itself: deep blue-green below, brighter toward the light above
  if(uUnder > 0.5) return mix(vec3(0.004, 0.085, 0.13), vec3(0.05, 0.40, 0.43), smoothstep(-0.6, 0.9, normalize(dir).y)) * (uLightCol * 0.3 + uAmbSky * 0.9);
  vec3 c = skyColor(normalize(vec3(dir.x, 0.035, dir.z)));                      // haze = the sky at the horizon that way
  return mix(c, vec3(dot(c, vec3(0.3333))), 0.1) + vec3(uFlash) * 0.4;
}
float fogAmount(vec3 wp){
  float d = length(wp - cameraPosition);
  if(uUnder > 0.5) return 1.0 - exp(-d * 0.05);
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
          float wl = (vW.y - uSeaM * uVex) / uVex;       // metres above the sea
          { float eat = texture2D(uNoise, vec2(vW.x + vW.z * 0.7, vW.y * 0.8) / 11.0).r + 0.2 * texture2D(uNoise, vec2(vW.x - vW.z, vW.y) / 2.7).b;     // holes rusted through the plating above the water, ragged at the edge
            if(eat > 0.95 - 0.08 * smoothstep(0.5, 4.0, wl) && wl > 0.4) discard;
            float fl = texture2D(uNoise, vec2(vW.x + vW.z, vW.y * 1.3) / 0.9).g;                                                                    // flaking scale
            alb = alb * 0.42 * (0.3 + 1.5 * r1 * r1 + 0.4 * streak); alb = mix(alb, vec3(0.022, 0.014, 0.01), smoothstep(0.4, 0.75, r2) * 0.85); alb = mix(alb, vec3(0.34, 0.12, 0.03), smoothstep(0.6, 0.85, r1) * (0.35 + 0.4 * fl));
            alb *= 0.7 + 0.6 * fl; alb = mix(alb, alb * 0.35, smoothstep(0.82, 0.93, eat)); }
          alb = mix(alb, vec3(0.02, 0.04, 0.018), smoothstep(1.3, -0.2, wl) * 0.75);
          { // below the surface a wreck is a reef: turf algae, pink coralline crust, orange sponge and pale barnacles over the dark rust
            float g1 = texture2D(uNoise, vW.xz / 2.3 + vW.y * 0.31).r, g2 = texture2D(uNoise, vec2(vW.x + vW.z, vW.y) / 2.6).g, g3 = texture2D(uNoise, vW.xz / 5.5 - vW.y * 0.11).b;
            vec3 grow = mix(vec3(0.10, 0.065, 0.04), vec3(0.15, 0.25, 0.09), smoothstep(0.35, 0.6, g1));
            grow = mix(grow, vec3(0.50, 0.24, 0.30), smoothstep(0.6, 0.7, g3));
            grow = mix(grow, vec3(0.78, 0.42, 0.10), smoothstep(0.34, 0.42, g1 * g3));
            grow = mix(grow, vec3(0.70, 0.68, 0.55), smoothstep(0.66, 0.8, g2) * 0.4) * (0.7 + 0.6 * g2);
            alb = mix(alb, grow, smoothstep(-0.05, -0.6, wl)); }
          #endif
        #endif
        vec3 gloss = vec3(0.0);
        #ifdef WINDOWS
          if(vFx.x > 0.5){                       // a wall: vFx.y is metres along it, vFx.z metres above the floor
            float kind = floor(vFx.x + 0.1), plain = step(0.2, fract(vFx.x + 0.1)), fy = fwidth(vFx.y), fz = fwidth(vFx.z);
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
              if(h2 < 0.17 && id.y == 0.0){      // a door: frame, panel, a small pane and a handle
                float dy = (c.y + 0.5) * 3.1;
                float fr = step(abs(c.x), 0.142) * step(0.0, dy) * step(dy, 2.14), dr = step(abs(c.x), 0.122) * step(0.03, dy) * step(dy, 2.07);
                vec3 dc = h3 < 0.3 ? vec3(0.70, 0.69, 0.64) : h3 < 0.55 ? vec3(0.05, 0.12, 0.22) : h3 < 0.8 ? vec3(0.28, 0.10, 0.06) : vec3(0.06, 0.20, 0.17);
                float pane = step(abs(c.x), 0.07) * step(abs(dy - 1.55), 0.3) * step(0.5, h4);
                dc *= 1.0 - 0.25 * step(abs(abs(c.x) - 0.085), 0.006) * step(abs(dy - 1.0), 0.85);
                dc = mix(dc, vec3(0.03, 0.045, 0.06), pane); dc = mix(dc, vec3(0.5), step(abs(c.x - 0.095), 0.012) * step(abs(dy - 1.02), 0.05));
                alb = mix(alb, trim, fr); alb = mix(alb, dc, dr);
                em = vec3(1.0, 0.72, 0.36) * pane * dr * lit * uNight * 2.0;
              } else {
                float hw = h3 < 0.45 ? 0.17 : 0.26, hh = 0.2, cy = c.y + 0.04, up = step(0.3, vFx.z);
                float fr = step(abs(c.x), hw + 0.022) * step(abs(cy), hh + 0.026) * up, win = step(abs(c.x), hw) * step(abs(cy), hh) * up;
                float sill = step(abs(c.x), hw + 0.04) * step(abs(cy + hh + 0.04), 0.014) * up;
                float bar = max(step(abs(c.x), 0.008), kind < 1.5 ? step(abs(cy), 0.009) : 0.0);                       // sliding sashes; the old weatherboard places have four panes
                vec3 gl = mix(vec3(0.015, 0.028, 0.04), vec3(0.09, 0.15, 0.21), smoothstep(-hh, hh, cy)) + 0.05 * step(0.8, fract((c.x + cy) * 5.0 + h * 3.0));    // glass: dark, with the sky in it
                float blind = step(h4, 0.45) * step(mix(-0.1, 0.12, h2), cy);                                          // some have a blind half down
                gl = mix(gl, vec3(0.42, 0.40, 0.34), blind * 0.8);
                alb = mix(alb, trim, max(fr, sill)); alb = mix(alb, mix(gl, trim, bar), win);
                alb *= 1.0 - 0.22 * step(abs(c.x), hw + 0.04) * step(abs(cy + hh + 0.075), 0.02) * up;               // the sill's shadow
                em = vec3(1.0, 0.72, 0.36) * win * (1.0 - bar) * lit * uNight * mix(2.4, 1.3, blind);
                gloss = vec3(win * (1.0 - bar) * (1.0 - blind) * 0.5);
              }
            }
          }
          if(vFx.x < -0.5){                      // corrugated iron: ribs running down the roof, weathered in streaks, rows of screws, rust where the coating has gone
            float rib = sin(vFx.y * 14.0) * (1.0 - smoothstep(0.06, 0.3, fwidth(vFx.y)));
            alb *= 0.93 + 0.07 * rib + 0.14 * (texture2D(uNoise, vec2(vFx.y * 0.11, vW.y * 0.02 + vW.x * 0.004)).r - 0.5);
            alb *= 1.0 - 0.10 * smoothstep(0.035, 0.0, abs(fract(vFx.z / 0.9 + 0.5) - 0.5)) * (1.0 - smoothstep(0.02, 0.12, fwidth(vFx.z)));
            float rusty = smoothstep(0.55, 0.82, texture2D(uNoise, vW.xz / 95.0).g), rn = texture2D(uNoise, vec2(vFx.y * 0.31, vFx.z * 0.47 + vW.x * 0.013)).r;
            alb = mix(alb, vec3(0.22, 0.10, 0.04) * (0.7 + 0.6 * rn), rusty * smoothstep(0.56, 0.8, rn) * 0.6);
          }
        #endif
        #ifdef CAR
          if(vFx.x > 0.5){                       // a 4WD: every part knows where on the car it is, in metres (see fourWD)
            float code = floor(vFx.x - 0.5), part = floor(code / 8.0 + 0.01), face = code - part * 8.0, shine = 0.0; vec2 L = vFx.yz;
            vec2 wc = vec2(L.x > 0.0 ? 1.5 : -1.55, 0.44); float dW = length(L - wc);       // from the nearer wheel centre
            float dn = texture2D(uNoise, L * 0.23 + part * 0.37).r;
            if(part < 0.5){                      // the painted body
              shine = 0.5;
              if(face < 0.5){                    // sides: door seams and handles, black wheel arches and sills
                float seam = min(min(abs(L.x - 0.92), abs(L.x + 0.05)), abs(L.x + 1.02));
                alb *= 1.0 - 0.6 * smoothstep(0.02, 0.006, seam) * step(0.52, L.y);
                alb = mix(alb, vec3(0.03), step(abs(L.y - 1.04), 0.02) * max(step(abs(L.x - 0.1), 0.085), step(abs(L.x + 0.87), 0.085)));
                float arch = max(smoothstep(0.63, 0.59, dW), step(L.y, 0.5)); alb = mix(alb, vec3(0.012), arch); shine *= 1.0 - arch;
              } else if(face < 1.5 || (face > 3.5 && face < 4.5)){        // nose and tail (here L.x runs across the car)
                float nose = step(face, 1.5), grille = nose * step(abs(L.x), 0.5) * step(abs(L.y - 0.93), 0.13);
                alb = mix(alb, vec3(0.015) + 0.10 * step(0.5, fract(L.y * 24.0)), grille);
                alb = mix(alb, vec3(0.78, 0.78, 0.72), step(abs(L.x), 0.2) * step(abs(L.y - 0.61), 0.055));           // number plate
                alb *= 1.0 - (1.0 - nose) * 0.55 * smoothstep(0.02, 0.006, abs(L.x + 0.3)) * step(0.56, L.y);          // the seam of the tail door
                float bump = step(L.y, 0.53); alb = mix(alb, vec3(0.025), bump); shine *= 1.0 - max(grille, bump);
              }
              float dust = smoothstep(1.2, 0.45, L.y) * (0.2 + 0.8 * dn) * step(face, 1.5 + 3.0 * step(3.5, face));     // sand and salt thrown up from the beach
              alb = mix(alb, vec3(0.40, 0.34, 0.23), dust * 0.8); shine *= 1.0 - dust;
            } else if(part < 1.5){               // the cabin: paint, with the glass let into it
              shine = 0.5; float glass = 0.0;
              if(face < 0.5){
                float inY = step(1.27, L.y) * step(L.y, 1.76), fwd = 0.80 - (L.y - 1.14) * 0.54;
                glass = inY * max(step(-0.0, L.x) * step(L.x, fwd), max(step(-0.97, L.x) * step(L.x, -0.11), step(-2.18, L.x) * step(L.x, -1.08)));
                alb *= 1.0 - 0.6 * smoothstep(0.02, 0.006, min(abs(L.x + 0.05), abs(L.x + 1.02))) * (1.0 - glass);
              } else if(face > 3.5 && face < 4.5) glass = step(abs(L.x), 0.66) * step(1.3, L.y) * step(L.y, 1.74);
              else if(face > 2.5 && face < 3.5) glass = step(abs(L.x), 0.78) * step(1.2, L.y) * step(L.y, 1.81);
              if(glass > 0.5){ alb = vec3(0.012, 0.018, 0.022) + 0.03 * dn; shine = 1.7; }
            } else if(part < 2.5){               // wheels: tread blocks, a dusty sidewall, a steel rim with six holes
              float a = atan(L.y - wc.y, L.x - wc.x);
              alb = vec3(0.014) * (0.6 + 0.8 * step(0.5, fract(a * 4.8)) * step(0.435, dW));
              alb = mix(alb, vec3(0.30, 0.26, 0.18), 0.35 * dn);
              vec3 rim = vec3(0.42, 0.43, 0.44) * (0.35 + 0.65 * smoothstep(0.03, 0.05, abs(length(vec2(dW - 0.18, sin(a * 3.0) * 0.12)) - 0.0)));
              alb = mix(alb, rim, smoothstep(0.30, 0.28, dW)); alb = mix(alb, vec3(0.05), smoothstep(0.065, 0.05, dW));
            } else if(part < 3.5) shine = 0.12;  // bull bar, roof rack, spare wheel cover
            else { em = alb * uNight * 1.5; shine = 0.6; }       // lamps
            gloss = vec3(shine);
          }
        #endif
        #ifdef BOAT
          if(vFx.x > 0.5){                       // a boat: every part knows what it is and where on the boat it sits (see finish in boats.js)
            float code = floor(vFx.x - 0.5), zone = floor(code / 8.0 + 0.01), face = code - zone * 8.0, shine = 0.0; vec2 L = vFx.yz;
            float bn = texture2D(uNoise, L * 0.11 + zone * 0.37).r, streak = texture2D(uNoise, vec2(L.x * 0.17, L.y * 0.03)).g;
            if(zone < 0.5){                      // paint and gelcoat: a boot stripe above the water, weeping streaks below the deck edge
              shine = 0.5;
              if(face < 0.5){
                vec3 acc = dot(alb, vec3(0.333)) > 0.35 ? vec3(0.02, 0.05, 0.16) : vec3(0.72, 0.72, 0.68);
                alb = mix(alb, acc, smoothstep(0.1, 0.13, L.y) * smoothstep(0.29, 0.26, L.y));
                alb *= 1.0 - 0.07 * smoothstep(0.6, 0.9, streak) * smoothstep(0.1, 0.9, L.y);
              }
              alb *= 0.94 + 0.08 * bn;
            } else if(zone < 1.5){               // bottom paint: scum at the waterline, weed further down
              alb = mix(alb * (0.75 + 0.5 * bn), vec3(0.06, 0.10, 0.045), smoothstep(-0.6, 0.05, L.y) * (0.25 + 0.55 * bn));
            } else if(zone < 2.5){               // a band of windows: dark panes with frames between them, some lit at night
              float pane = step(abs(fract(L.x / 1.3 + 0.5) - 0.5), 0.445), id = floor(L.x / 1.3 + 0.5);
              alb = mix(vec3(0.55, 0.55, 0.53), vec3(0.012, 0.018, 0.024), pane); shine = mix(0.4, 1.7, pane);
              em = vec3(1.0, 0.8, 0.5) * pane * uNight * 0.9 * step(0.45, hash12(vec2(id, floor(vW.x * 0.02))));
            } else if(zone < 3.5){               // a laid deck: planks running fore and aft, dark seams, butt joints
              float kf = 1.0 - smoothstep(0.3, 1.0, fwidth(L.y) / 0.16), row = floor(L.y / 0.16);
              alb *= 1.0 - 0.5 * kf * smoothstep(0.12, 0.04, fract(L.y / 0.16));
              alb *= 1.0 - 0.4 * kf * smoothstep(0.012, 0.004, abs(fract(L.x / 2.4 + row * 0.37) - 0.5));
              alb *= 0.82 + 0.34 * bn;
            } else {                             // sailcloth: seams between the panels, and the sun glowing through
              alb *= 1.0 - 0.16 * smoothstep(0.05, 0.015, abs(fract((L.y + L.x * 0.12) / 0.95) - 0.5));
              alb *= 0.9 + 0.14 * bn;
              em = alb * uLightCol * max(dot(-N, uLightDir), 0.0) * 0.32 * cloudShadow(vW);
            }
            alb *= 0.78 + 0.22 * smoothstep(-0.2, 1.3, (vW.y - uSeaM * uVex) / uVex);      // grime toward the waterline
            gloss = vec3(shine);
          }
        #endif
        #if !defined(CAR) && !defined(BOAT)
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

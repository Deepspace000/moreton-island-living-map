// Sun, moon, stars, sky colour and the lighting that follows from them.
import * as THREE from 'three';
import { U, LAT, LON, makeMat, LOGV, LOGF, lerp, clamp, smooth } from './common.js';

const RAD = Math.PI / 180;
function altAz(ra, dec, date) {
  const n = date / 86400000 + 2440587.5 - 2451545.0;
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const ha = (gmst * 15 + LON) * RAD - ra, la = LAT * RAD;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { az, el };
}
export function sunPos(date) {
  const n = date / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, eps = (23.439 - 0.0000004 * n) * RAD;
  return altAz(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), Math.asin(Math.sin(eps) * Math.sin(lam)), date);
}
export function moonPos(date) {
  const d = date / 86400000 + 2440587.5 - 2451545.0;
  const L = (218.316 + 13.176396 * d) * RAD, M = (134.963 + 13.064993 * d) * RAD, F = (93.272 + 13.229350 * d) * RAD;
  const l = L + 6.289 * RAD * Math.sin(M), b = 5.128 * RAD * Math.sin(F), e = 23.4397 * RAD;
  return altAz(Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)), Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)), date);
}
const dirOf = (p, v) => v.set(Math.sin(p.az) * Math.cos(p.el), Math.sin(p.el), -Math.cos(p.az) * Math.cos(p.el));

// colour ramps over sun elevation (degrees), linear RGB
function ramp(keys, e, out) {
  let i = 0; while (i < keys.length - 2 && e > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], t = clamp((e - a[0]) / (b[0] - a[0]), 0, 1), s = t * t * (3 - 2 * t);
  return out.set(lerp(a[1], b[1], s), lerp(a[2], b[2], s), lerp(a[3], b[3], s));
}
const ZEN = [[-18, .0015, .003, .009], [-8, .008, .016, .05], [-2, .035, .07, .2], [3, .075, .16, .42], [12, .10, .27, .68], [35, .085, .29, .80], [90, .07, .27, .82]];
const HOR = [[-18, .004, .007, .016], [-9, .02, .025, .06], [-4, .30, .13, .10], [0, .95, .42, .16], [4, .95, .62, .36], [10, .80, .86, .90], [25, .66, .86, 1.14], [90, .60, .84, 1.16]];
const SUN = [[-3, 0, 0, 0], [-0.5, 1.1, .28, .05], [2, 2.6, 1.15, .42], [7, 3.3, 2.2, 1.3], [16, 3.5, 2.95, 2.3], [40, 3.6, 3.35, 2.95], [90, 3.7, 3.5, 3.2]];
const GLOW = [[-10, 0, 0, 0], [-4, .7, .22, .06], [0, 1.6, .62, .16], [6, 1.5, .9, .42], [20, 1.0, .9, .72], [90, .9, .88, .8]];

export const sky = { sunEl: 0, sunAz: 0, moonEl: 0, moonPhase: 0.5, day: 1 };
const tmp = new THREE.Vector3(), grey = new THREE.Vector3();
export function updateSky(date, wx) {
  const s = sunPos(date), m = moonPos(date);
  dirOf(s, U.uSunDir.value); dirOf(m, U.uMoonDir.value);
  const e = s.el / RAD;
  sky.sunEl = e; sky.sunAz = s.az; sky.moonEl = m.el / RAD;
  const elong = Math.acos(clamp(U.uSunDir.value.dot(U.uMoonDir.value), -1, 1));
  sky.moonPhase = (1 - Math.cos(elong)) / 2;
  const oc = wx.overcast, night = 1 - smooth(-9, 1, e);
  sky.day = smooth(-4, 6, e);
  U.uNight.value = night; U.uOvercast.value = oc;
  ramp(ZEN, e, U.uZenith.value); ramp(HOR, e, U.uHorizon.value); ramp(SUN, e, U.uSunCol.value); ramp(GLOW, e, U.uSunGlow.value);
  // overcast: grey the sky, mute the sun
  const lz = U.uZenith.value.dot(tmp.set(.3, .5, .2)) + U.uHorizon.value.dot(tmp.set(.15, .25, .1));
  grey.set(lz * 1.0, lz * 1.06, lz * 1.16).multiplyScalar(1 - 0.5 * oc * oc);
  U.uZenith.value.lerp(grey, oc * 0.85); U.uHorizon.value.lerp(tmp.copy(grey).multiplyScalar(1.15), oc * 0.85);
  U.uSunCol.value.multiplyScalar(1 - oc * 0.82); U.uSunGlow.value.multiplyScalar(1 - oc * 0.85);
  // moonlight
  const moonUp = smooth(-2, 8, sky.moonEl) * (0.15 + 0.85 * sky.moonPhase) * (1 - oc * 0.7);
  U.uMoonLit.value = moonUp;
  const useMoon = e < -3.0;
  if (useMoon) { U.uLightDir.value.copy(U.uMoonDir.value); U.uLightCol.value.set(.20, .28, .46).multiplyScalar((0.25 + moonUp) * smooth(-3, -8, e) * 0.9); }
  else { U.uLightDir.value.copy(U.uSunDir.value); U.uLightCol.value.copy(U.uSunCol.value); }
  if (U.uLightDir.value.y < 0.02) { U.uLightDir.value.y = 0.02; U.uLightDir.value.normalize(); }
  // ambient from the sky itself (+ a floor of starlight)
  U.uAmbSky.value.copy(U.uZenith.value).multiplyScalar(0.9).addScaledVector(U.uHorizon.value, 0.42).addScaledVector(tmp.set(.024, .040, .078), night);
  U.uAmbSky.value.addScaledVector(U.uSunGlow.value, 0.10 * (1 - sky.day) * (1 - night)).multiplyScalar(1 + oc * 0.5).addScaledVector(tmp.set(.05, .075, .13), moonUp * night * 0.22);
  U.uAmbGnd.value.copy(U.uHorizon.value).multiplyScalar(0.14).addScalar(0.002); U.uAmbGnd.value.x += U.uSunCol.value.x * 0.10; U.uAmbGnd.value.y += U.uSunCol.value.y * 0.085; U.uAmbGnd.value.z += U.uSunCol.value.z * 0.06;
  // haze takes the horizon colour, warmer toward the sun
  U.uFogCol.value.copy(U.uHorizon.value).lerp(U.uZenith.value, 0.25);
  U.uFogSun.value.copy(U.uFogCol.value).addScaledVector(U.uSunGlow.value, 0.55);
  U.uFogDens.value = lerp(0.000008, 0.00006, Math.pow(wx.haze, 1.4));          // even on the clearest day the far end of the island is paler and bluer than the near
  U.uStarRot.value = (date / 86164090) * Math.PI * 2;
  // water body colour dims with the light
  const tb = wx.turb;
  U.uWaterDeep.value.set(lerp(.004, .02, tb), lerp(.085, .075, tb), lerp(.165, .09, tb));
  U.uTurb.value = 1 + tb * 0.8;
}

export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const mat = makeMat({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { uMoonLit: U.uMoonLit, uStarRot: U.uStarRot },
    vs: /* glsl */`varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * viewMatrix * vec4(position * 1000.0 + cameraPosition, 1.0); gl_Position = p; ${LOGV} }`,
    fs: /* glsl */`
      varying vec3 vD; uniform float uMoonLit, uStarRot; uniform vec2 uWindDir;
      float h31(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
      void main(){
        vec3 d = normalize(vD);
        vec3 c = skyColor(d);
        // overcast: a textured cloud deck instead of flat grey
        if(uOvercast > 0.01 && d.y > 0.0){
          vec2 suv = d.xz / (d.y + 0.14) * 0.09 + uWindDir * uTime * 0.0012;
          float dk = texture2D(uNoise, suv).r * 0.6 + texture2D(uNoise, suv * 2.7 + 0.3).r * 0.4;
          c = mix(c, c * (0.42 + 1.0 * dk), uOvercast * 0.85 * smoothstep(0.0, 0.12, d.y));
        }
        // high cirrus: thin wind-combed streaks
        if(d.y > 0.02){
          vec2 cu = d.xz / (d.y + 0.25);
          float ci = texture2D(uNoise, cu * vec2(0.03, 0.10) + uWindDir * uTime * 0.0004).r;
          ci = smoothstep(0.5, 0.86, ci) * (0.4 + 0.9 * texture2D(uNoise, cu * 0.37).b);
          c += (uSunCol * 0.13 + uSunGlow * 0.12 + uAmbSky * 0.5) * ci * smoothstep(0.02, 0.3, d.y) * uCirrus * (1.0 - uNight * 0.8);
        }
        // below the horizon: sea haze
        c = mix(c, fogColor(d), smoothstep(0.0, -0.06, d.y));
        // sun disc
        float sd = dot(d, uSunDir);
        c += uSunCol * 9.0 * smoothstep(0.99990, 0.99996, sd) * step(-0.02, d.y);
        // stars (rotate with the earth about the south celestial pole)
        if(uNight > 0.02 && d.y > -0.02){
          float cl = 1.0 - uOvercast * 0.9;
          vec3 ax = normalize(vec3(0.0, sin(0.4744), cos(0.4744)));     // toward south, 27 deg up
          float ca = cos(uStarRot), sa = sin(uStarRot);
          vec3 q = d * ca + cross(ax, d) * sa + ax * dot(ax, d) * (1.0 - ca);
          float st = 0.0;
          for(int i = 0; i < 2; i++){
            float sc = i == 0 ? 190.0 : 330.0;
            vec3 g = q * sc; vec3 id = floor(g); vec3 f = fract(g) - 0.5;
            float r = h31(id + float(i) * 17.0);
            float tw = 0.75 + 0.25 * sin(uTime * (1.5 + r * 5.0) + r * 60.0);
            st += step(0.9935, r) * smoothstep(0.42, 0.0, length(f + (vec3(h31(id + 3.0), h31(id + 5.0), h31(id + 9.0)) - 0.5) * 0.5)) * (0.5 + 2.5 * fract(r * 91.7)) * tw;
          }
          float mw = texture2D(uNoise, vec2(atan(q.z, q.x) * 0.5, q.y * 1.1)).r;
          float band = exp(-pow(dot(q, normalize(vec3(0.5, 0.2, 0.84))) * 3.2, 2.0));
          c += (vec3(0.9, 0.95, 1.0) * st * 1.4 + vec3(0.05, 0.06, 0.09) * band * (0.4 + mw * 1.2)) * uNight * cl * smoothstep(-0.02, 0.15, d.y);
        }
        // moon with its true phase
        float md = dot(d, uMoonDir);
        const float MR = 0.0125;
        float ang = acos(clamp(md, -1.0, 1.0));
        if(ang < MR * 6.0 && uMoonDir.y > -0.03){
          vec3 rx = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir)), ry = cross(uMoonDir, rx);
          vec2 p = vec2(dot(d, rx), dot(d, ry)) / MR;
          float r2 = dot(p, p);
          if(r2 < 1.0){
            vec3 n = normalize(rx * p.x + ry * p.y - uMoonDir * sqrt(1.0 - r2));
            float l = smoothstep(-0.05, 0.25, dot(n, uSunDir));
            float mare = texture2D(uNoise, p * 0.11 + 0.3).r;
            vec3 mc = vec3(1.0, 0.97, 0.9) * (0.55 + 0.6 * mare) * (l * 1.6 + 0.012);
            c = mix(c, mc * (0.25 + 0.75 * uNight) + c * (1.0 - uNight) * 0.6, smoothstep(1.0, 0.92, r2));
          }
          c += vec3(0.5, 0.6, 0.8) * exp(-ang / MR * 0.7) * 0.06 * uMoonLit * uNight;
        }
        c += vec3(uFlash) * (0.25 + 0.5 * smoothstep(0.3, 0.0, d.y));
        if(uUnder > 0.5) c = fogColor(normalize(vD));                 // under water there is no sky beyond the haze
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = -100;
  scene.add(mesh);
  return mesh;
}

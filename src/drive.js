// What the ground is like to drive on, kept where both the picture and the 4WDs can read it:
//   - how rough each place is (the inland tracks have bumpy stretches; the beach is hard near the water and soft higher up)
//   - the pools of water lying on the inland tracks, with the spray and rings a car makes going through one
//   - where the big driftwood logs lie on the beach (a table the drawing of the logs is made from too), so the cars can steer round them
//   - where trees and big bushes stand close to a car (read back from a small picture of them drawn from above), so a car driven into one stops
import * as THREE from 'three';
import { U, VEX, makeMat, GLSL_COMMON, LOGV, LOGF, LOGF_PARS, rng, clamp } from './common.js';
import { T, meshY, groundH, heightAt, maskAt } from './terrain.js';

export const carPace = { kmh: 40 };
export const OPT = { invX: 1, invY: 1 };          // -1 turns an axis of control round (Settings): left and right, up and down          // what a 4WD does on a clear straight (the Travel menu sets it)
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const FARS = new THREE.Sphere(new THREE.Vector3(), 1e6);

// ---------------------------------------------------------------- rough ground
// stretches a few hundred metres long: 0 an easy one, 1 a rough one
export const sectionK = (x, z) => sst(0.3, 0.7, 0.5 + 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.007) * 2.0) * Math.sin(z * 0.011 + 1.7));
export function roughAt(x, z) {
  const m = maskAt(x, z); if (m.land < 0.5) return 0.1;
  if (m.sand < 0.3) return 0.4 + 0.6 * sectionK(x, z);                                    // inland: roots, washouts and corrugations
  return 0.1 + 0.55 * sst(0.9, 2.4, heightAt(x, z) - U.uSeaM.value) * (0.45 + 0.55 * sectionK(x * 1.7 + 40, z * 1.7));      // beach: packed hard by the tide low down, soft and churned higher up
}
// the bumps themselves, in the range -0.8 to 0.8: short ones a wheel drops into, and longer swells
const bh = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), a = bh(i, j), b = bh(i + 1, j), c = bh(i, j + 1), d = bh(i + 1, j + 1); return a + (b - a) * ux + (c - a + (a - b - c + d) * ux) * uz - 0.5; };
export const bumpAt = (x, z) => vn(x / 2.3, z / 2.3) * 0.6 + vn(x / 6.5 + 9.3, z / 6.5 + 4.1);

// ---------------------------------------------------------------- driftwood logs
export const LOG_CS = 3.4, LOGN = 256;
const logTab = new Uint8Array(LOGN * LOGN * 4);
{ const R = rng(5150); for (let i = 0; i < LOGN * LOGN; i++) if (R() < 0.016) { logTab[i * 4] = (R() * 256) | 0; logTab[i * 4 + 1] = (R() * 256) | 0; logTab[i * 4 + 2] = (R() * 256) | 0; logTab[i * 4 + 3] = 1 + ((R() * 255) | 0); } }
let logTex = null;
export function logTexture() { if (!logTex) { logTex = new THREE.DataTexture(logTab, LOGN, LOGN, THREE.RGBAFormat); logTex.wrapS = logTex.wrapT = THREE.RepeatWrapping; logTex.magFilter = logTex.minFilter = THREE.NearestFilter; logTex.needsUpdate = true; } return logTex; }
// the shader lines that take a log's place, lie and length from the table (see the driftwood in life.js)
export const LOG_PRE = /* glsl */`vec4 lg = texture2D(uLogs, (cell + 0.5) / ${LOGN}.0); float logK = step(0.002, lg.a);
        if (logK > 0.5) { jt = lg.rg; h4 = lg.b; h1 = lg.a; }`;
// the logs within r of a place, as x, z of the middle and the half-length along x and z, four numbers a log
export function logsNear(x, z, r, out) {
  out.length = 0;
  const i0 = Math.floor((x - r) / LOG_CS), i1 = Math.floor((x + r) / LOG_CS), j0 = Math.floor((z - r) / LOG_CS), j1 = Math.floor((z + r) / LOG_CS);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const q = ((j & 255) * LOGN + (i & 255)) * 4, a = logTab[q + 3]; if (!a) continue;
    const lx = (i + logTab[q] / 255) * LOG_CS, lz = (j + logTab[q + 1] / 255) * LOG_CS, m = maskAt(lx, lz); if (m.land < 0.9) continue;
    const h = heightAt(lx, lz), s = sst(0.3, 0.65, m.sand) * sst(0.7, 1.1, h) * (1 - sst(2.5, 3.6, h)); if (s < 0.25) continue;
    const ang = logTab[q + 2] / 255 * 6.2832, half = (2.4 + 3.4 * a / 255) * s / 2;
    out.push(lx, lz, Math.cos(ang) * half, Math.sin(ang) * half);
  }
  return out;
}

// ---------------------------------------------------------------- pools on the tracks, and potholes
// Water lies on the inland tracks where the ground is level and low, more of it in the rough stretches; the same stretches are pitted
// with potholes. Each is a patch laid on the ground. list holds the pools: x, z, cos and sin of the way it lies, half-length, half-width, depth.
export function buildPuddles(scene, F) {
  const R = rng(7331), pos = [], ae = [], idx = [], pools = [], grid = new Map(), G = 40;
  const patch = (x, z, ca, sa, a, b, kind, depth) => {
    const base = pos.length / 3, N = kind ? 8 : 18; pos.push(x, meshY(x, z) + 0.05, z); ae.push(0, 0, kind);
    const RG = kind ? 1 : 4;            // a pool is laid in rings, each lying on the ground, so no part of it sinks under a rise
    for (let k = 1; k <= RG; k++) for (let i = 0; i < N; i++) { const t = i / N * 6.2832, u = Math.cos(t) * k / RG, v = Math.sin(t) * k / RG, px = x + ca * u * a - sa * v * b, pz = z + sa * u * a + ca * v * b; pos.push(px, meshY(px, pz) + 0.05, pz); ae.push(u, v, kind);
      const j = (i + 1) % N, o = base + 1 + (k - 1) * N; if (k === 1) idx.push(base, o + i, o + j); else idx.push(o - N + i, o + i, o + j, o - N + i, o + j, o - N + j); }
    if (!kind) { const p = [x, z, ca, sa, a, b, depth]; pools.push(p); for (let gx = Math.floor((x - a) / G); gx <= Math.floor((x + a) / G); gx++) for (let gz = Math.floor((z - a) / G); gz <= Math.floor((z + a) / G); gz++) { const k = gx + ',' + gz; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(p); } }
  };
  for (const r of F.roads) {
    if (r.c !== 1 || r.p.length < 2) continue;
    let next = 20 + R() * 60, hole = 5 + R() * 10, run = 0;
    for (let i = 1; i < r.p.length; i++) {
      const a = r.p[i - 1], b = r.p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue; const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
      for (let d = 0; d < L; d += 4) {
        run += 4; const x = a[0] + tx * d, z = a[1] + tz * d;
        if (run >= hole) {            // potholes, in the rough stretches
          hole = run + 4 + R() * 14; const sk = sectionK(x, z);
          if (sk > 0.45 && pos.length < 150000) { const m = maskAt(x, z); if (m.land > 0.9 && m.sand < 0.3) for (let k = 0, n = 1 + ((R() * 3) | 0); k < n; k++) { const o = (R() - 0.5) * 3.2, s2 = (R() - 0.5) * 5, rr = 0.45 + R() * 0.6, an = R() * 6.28; patch(x + tx * s2 - tz * o, z + tz * s2 + tx * o, Math.cos(an), Math.sin(an), rr * (1 + R() * 0.5), rr, 1, 0); } }
        }
        if (run < next) continue;
        const m = maskAt(x, z), sk = sectionK(x, z); next = run + (sk > 0.5 ? 45 : 140) + R() * 160;
        if (m.land < 0.9 || m.sand > 0.3) continue;
        const len = 3.5 + R() * 6.5, wid = 1.5 + R() * 1.2, h0 = groundH(x, z);
        if (h0 < 2.2 || Math.abs(groundH(x + tx * len, z + tz * len) - h0) > 0.22 || Math.abs(groundH(x - tx * len, z - tz * len) - h0) > 0.22 || Math.abs(groundH(x - tz * 3, z + tx * 3) - groundH(x + tz * 3, z - tx * 3)) > 0.3) continue;      // only where the ground is level enough to hold water
        const o = (R() - 0.5) * 1.2; patch(x - tz * o, z + tx * o, tx, tz, len, wid, 0, 0.1 + R() * 0.22);
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aE', new THREE.Float32BufferAttribute(ae, 3)); g.setIndex(idx); g.boundingSphere = FARS;
  const rip = []; for (let i = 0; i < 8; i++) rip.push(new THREE.Vector4(0, 0, -1e6, 0)); let ripI = 0;
  const mesh = new THREE.Mesh(g, makeMat({
    uniforms: { uRip: { value: rip } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    vs: /* glsl */`attribute vec3 aE; varying vec3 vE, vW; void main(){ vE = aE; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`varying vec3 vE, vW; uniform vec4 uRip[8];
      void main(){ ${LOGF}
        float r = length(vE.xy), lit = max(uLightDir.y, 0.0) * cloudShadow(vW);
        if (vE.z > 0.5) {            // a pothole: a damp dark hollow with a pale crumbled lip
          float a = (1.0 - smoothstep(0.75, 1.0, r)) * 0.62;
          vec3 c = mix(vec3(0.13, 0.105, 0.075), vec3(0.5, 0.44, 0.33), smoothstep(0.5, 0.9, r)) * (uLightCol * (0.15 + 0.55 * lit) + uAmbSky * 0.7);
          gl_FragColor = vec4(applyFog(c, vW), a); return;
        }
        float edge = r + (texture2D(uNoise, vW.xz * 0.09).r - 0.5) * 0.55;            // a ragged shore
        float a = 1.0 - smoothstep(0.6, 0.86, edge); if (a < 0.01) discard;
        vec3 V = normalize(cameraPosition - vW);
        vec2 n2 = (texture2D(uNoise, vW.xz * 0.31 + uTime * 0.025).rg - 0.5) * 0.05;          // the wind's own ripples
        for (int i = 0; i < 8; i++) {            // rings spreading from where wheels went in
          vec2 d = vW.xz - uRip[i].xy; float l = length(d), age = uTime - uRip[i].z, ring = l - age * 1.5, k = uRip[i].w * exp(-age * 0.8) * exp(-ring * ring * 2.4) * step(0.0, age);
          n2 += d / max(l, 0.05) * sin(ring * 8.0) * k * 0.4;
        }
        vec3 N = normalize(vec3(n2.x, 1.0, n2.y)), Rf = reflect(-V, N); Rf.y = abs(Rf.y) + 0.03;
        float fres = 0.1 + 0.9 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 body = mix(vec3(0.5, 0.4, 0.26), vec3(0.2, 0.135, 0.07), smoothstep(0.75, 0.25, edge)) * (uLightCol * (0.15 + 0.6 * lit) + uAmbSky * 0.8);      // tea-brown water, the sand showing through at its edge
        vec3 c = mix(body, skyColor(normalize(Rf)) * 1.1, fres) + uLightCol * pow(max(dot(normalize(Rf), uLightDir), 0.0), 220.0) * 1.6 * lit;
        gl_FragColor = vec4(applyFog(c, vW), a * 0.93); }`,
  }));
  mesh.name = 'puddles'; mesh.userData.pools = pools; mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh);          // (over the track's own ribbon, which is 4)
  // spray: drops thrown up and out from the wheels
  const NP = 220, pp = new Float32Array(NP * 3).fill(-1e5), pa = new Float32Array(NP), pv = new Float32Array(NP * 3), pl = new Float32Array(NP); let pi = 0, live = 0;
  const pg = new THREE.BufferGeometry(), ppa = new THREE.BufferAttribute(pp, 3).setUsage(THREE.DynamicDrawUsage), paa = new THREE.BufferAttribute(pa, 1).setUsage(THREE.DynamicDrawUsage);
  pg.setAttribute('position', ppa); pg.setAttribute('aA', paa); pg.boundingSphere = FARS;
  const spray = new THREE.Points(pg, makeMat({
    transparent: true, depthWrite: false,
    vs: /* glsl */`attribute float aA; varying float vA; varying vec3 vW; void main(){ vA = aA; vW = position; vec4 mv = viewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(150.0 * (0.6 + 0.8 * aA) / max(-mv.z, 0.5), 1.5, 40.0); ${LOGV} }`,
    fs: /* glsl */`varying float vA; varying vec3 vW; void main(){ ${LOGF} float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        vec3 c = vec3(0.62, 0.55, 0.44) * (uLightCol * (0.25 + 0.6 * max(uLightDir.y, 0.0)) + uAmbSky * 0.9); gl_FragColor = vec4(applyFog(c, vW), (1.0 - d * d) * vA * 0.75); }`,
  }));
  spray.name = 'spray'; spray.frustumCulled = false; spray.renderOrder = 6; scene.add(spray);
  const near = (x, z) => grid.get(Math.floor(x / G) + ',' + Math.floor(z / G));
  return {
    pools, mesh,
    // how deep the water is at a place (0: dry)
    at(x, z) { const l = near(x, z); if (!l) return 0; for (const p of l) { const dx = x - p[0], dz = z - p[1], u = (dx * p[2] + dz * p[3]) / p[4], v = (-dx * p[3] + dz * p[2]) / p[5], r = u * u + v * v; if (r < 0.55) return p[6] * (1 - r / 0.55); } return 0; },
    // a wheel goes through at this speed, heading tx, tz: rings on the water, and spray to both sides
    splash(x, z, y, tx, tz, v, depth) {
      rip[ripI].set(x, z, U.uTime.value, clamp(v / 6, 0.3, 1.4)); ripI = (ripI + 1) % 8;
      const n = Math.min(14, Math.round(2 + v * 1.2));
      for (let k = 0; k < n; k++) { const q = pi * 3, sd = k % 2 ? 1 : -1, out = (1.2 + Math.random() * 2.6) * Math.min(1.6, v / 5), up = (1.6 + Math.random() * 2.8) * Math.min(1.5, v / 5) * (0.6 + depth * 3);
        pp[q] = x - tz * sd * 1.2; pp[q + 1] = y + 0.15; pp[q + 2] = z + tx * sd * 1.2; pv[q] = -tz * sd * out + tx * v * 0.35 + (Math.random() - 0.5); pv[q + 1] = up; pv[q + 2] = tx * sd * out + tz * v * 0.35 + (Math.random() - 0.5); pl[pi] = 0.75 + Math.random() * 0.5; pi = (pi + 1) % NP; }
      live = 1.4;
    },
    update(dt) {
      if (live <= 0) return; live -= dt; const h = Math.min(dt, 0.05);
      for (let i = 0; i < NP; i++) { if (pl[i] <= 0) { pa[i] = 0; continue; } pl[i] -= h; const q = i * 3; pv[q + 1] -= 9.8 * VEX * h; pp[q] += pv[q] * h; pp[q + 1] += pv[q + 1] * h; pp[q + 2] += pv[q + 2] * h; pa[i] = clamp(pl[i] * 1.6, 0, 1); if (pl[i] <= 0) { pp[q + 1] = -1e5; pa[i] = 0; } }
      ppa.needsUpdate = true; paa.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- trees, big bushes and logs close to the view
// The forest and the litter under it are grown in the shaders, so nothing on this side knows where a trunk stands. To find out, the same
// trees, bushes and logs are drawn again from straight above into a small picture, 48 m across, round the place being looked at: tree trunks
// and bushes taller than a metre in red, logs in green. The picture is read back, and anything that walks or drives asks it what is in the
// way. (Grass, ferns, small bushes and the smallest trees are not drawn into it: those can be walked and driven through.)
const PN = 192, PSPAN = 48;
export const probe = {
  scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-PSPAN / 2, PSPAN / 2, PSPAN / 2, -PSPAN / 2, 1, 2000), rt: null, buf: new Uint8Array(PN * PN * 4), data: null, cx: 0, cz: 0, busy: false, tick: 0, last: 0, n: 0,
  // m: a mesh whose shader hands on its world position in the varying named wp. trunkOnly: only the parts marked vTrunk count (a tree: you can
  // pass under its crown); lo: how far above the ground a part must stand to count, in metres; log: 1 for the green picture
  add(m, { wp = 'vWp', trunkOnly = false, lo = 0.9, log = 0, cs = 11 } = {}) {
    const src = m.material, mat = new THREE.ShaderMaterial({
      uniforms: src.uniforms, defines: src.defines, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
      vertexShader: src.vertexShader.replace(LOGV, '\ngl_Position.z = 0.0;\n'),
      fragmentShader: LOGF_PARS + GLSL_COMMON + /* glsl */`varying vec3 ${wp}; ${trunkOnly ? 'varying float vTrunk;' : ''}
        void main(){ float up = (${wp}.y - groundY(${wp}.xz)) / uVex; if (up < ${lo.toFixed(2)} || up > 1.9${trunkOnly ? ' || vTrunk < 0.5' : ''}) discard; gl_FragColor = vec4(${log ? '0.0, 1.0' : '1.0, 0.0'}, 0.0, 1.0); }`,
    });
    // Only the few cells round the middle are drawn here (cs: the size of one cell of the thing's grid), not the whole forest: the picture is
    // 48 m across, and drawing every tree again for it made every third frame slow.
    const g = new THREE.InstancedBufferGeometry(), k = Math.ceil(30 / cs) + 1, cells = [];
    for (const [name, a] of Object.entries(m.geometry.attributes)) if (name !== 'iCell') g.setAttribute(name, a);
    g.setIndex(m.geometry.index); for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) cells.push(i, j);
    g.setAttribute('iCell', new THREE.InstancedBufferAttribute(new Float32Array(cells), 2)); g.instanceCount = cells.length / 2; g.boundingSphere = FARS;
    const p = new THREE.Mesh(g, mat); p.frustumCulled = false; this.scene.add(p); this.n++;
  },
  // draw and read the picture round x, z (called every frame while the view is close to the ground; it works every third frame)
  look(renderer, x, z) {
    if (!this.n || this.busy || (this.tick++ % 4)) return;
    if (this.data && Math.hypot(x - this.cx, z - this.cz) < 1.2 && this.tick - this.last < 60) return; this.last = this.tick;          // nothing has moved: the last picture still holds
    if (!this.rt) { this.rt = new THREE.WebGLRenderTarget(PN, PN, { depthBuffer: false }); this.cam.up.set(0, 0, -1); }
    const y = meshY(x, z); this.cam.position.set(x, y + 300, z); this.cam.lookAt(x, y, z); this.cam.updateMatrixWorld();
    const old = renderer.getRenderTarget(); renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.cam); renderer.setRenderTarget(old);
    const done = () => { this.data = this.buf; this.cx = x; this.cz = z; this.busy = false; };
    this.busy = true;
    if (renderer.readRenderTargetPixelsAsync) renderer.readRenderTargetPixelsAsync(this.rt, 0, 0, PN, PN, this.buf).then(done, () => { this.busy = false; });
    else { renderer.readRenderTargetPixels(this.rt, 0, 0, PN, PN, this.buf); done(); }
  },
  // is a trunk or a big bush (and, with logs, a log) standing within r of this place?
  hit(x, z, r = 0.3, logs = false) {
    if (!this.data) return false;
    const k = PN / PSPAN, u = Math.floor((x - this.cx + PSPAN / 2) * k), v = Math.floor((this.cz + PSPAN / 2 - z) * k), n = Math.ceil(r * k), d = this.data;
    for (let j = v - n; j <= v + n; j++) for (let i = u - n; i <= u + n; i++) if (i >= 0 && j >= 0 && i < PN && j < PN) { const q = (j * PN + i) * 4; if (d[q] > 127 || (logs && d[q + 1] > 127)) return true; }
    return false;
  },
  // For someone on foot at x, z heading hd (0 east, turning left as it grows): 0 if the way ahead is clear, else +1 or -1 for the side to turn to
  way(x, z, hd, logs = true) {
    const clear = (a) => { const c = Math.cos(hd + a), s = -Math.sin(hd + a); return !this.hit(x + c * 0.9, z + s * 0.9, 0.32, logs) && !this.hit(x + c * 1.8, z + s * 1.8, 0.32, logs); };
    if (clear(0)) return 0;
    for (const a of [0.6, 1.1, 1.6]) { if (clear(a)) return 1; if (clear(-a)) return -1; }
    return 1;
  },
};

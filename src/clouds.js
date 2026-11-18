// Drifting cumulus built from soft sprites (single heaps, and whole systems of them packed so close they join into one mass), low grey
// sheets of stratus, their shadows on land and sea, and rain. (The high cirrus is drawn on the sky itself: see sky.js.)
import * as THREE from 'three';
import { U, VEX, MOBILE, dq, makeMat, LOGV, LOGF, rng, clamp, smooth } from './common.js';
import { wx } from './weather.js';

const DX = 66000, DZ = 88000, BASE = 1150 * VEX;
export function buildClouds(scene, renderer) {
  const R = rng(4242), NC = MOBILE ? 70 : dq(90, 120, 150);
  const clouds = [], puffs = [];
  const banks = Array.from({ length: 9 }, () => [(R() - .5) * DX, (R() - .5) * DZ, 5000 + R() * 9000, R() * Math.PI]);
  // one cumulus heap: puffs on a flat base, smaller towers on top (tall: 0..1, how much more it builds upward, as in the heart of a system)
  const heap = (c, big, tall = 0) => {
    const size = c.size;
    const n = Math.round((big ? 20 : 11) * (MOBILE ? 0.7 : 1) * (1 + 0.5 * tall) + R() * 8), el = 0.55 + R() * 0.5, rot = R() * Math.PI;
    for (let j = 0; j < n; j++) {
      // flat-based heap: wide low layer, smaller towers on top
      const tier = R() < 0.55 - 0.25 * tall ? 0 : (R() < 0.7 - 0.3 * tall ? 1 : 2);
      const rr = Math.sqrt(R()) * (tier === 0 ? 1 : tier === 1 ? 0.6 : 0.3), an = R() * Math.PI * 2;
      let ox = Math.cos(an) * rr * size * 0.5, oz = Math.sin(an) * rr * size * 0.5 * el;
      const cs = Math.cos(rot), sn = Math.sin(rot); [ox, oz] = [ox * cs - oz * sn, ox * sn + oz * cs];
      const ps = size * (tier === 0 ? 0.5 + R() * 0.25 : tier === 1 ? 0.42 + R() * 0.2 : 0.3 + R() * 0.15);
      const oy = (tier === 0 ? 0.04 + R() * 0.06 : tier === 1 ? 0.16 + R() * 0.1 : 0.3 + R() * 0.12) * size * (big ? 1.15 : 0.9) * (1 + 0.6 * tall);
      const up = clamp(oy / (size * 0.42 * (1 + 0.6 * tall)), 0, 1);
      const nl = Math.hypot(ox, oy * 2 + size * 0.1, oz);
      puffs.push({ c, ox, oy, oz, ps, at: (R() * 4) | 0, fl: 0, rot: R() * 6.283, up, nx: ox / nl, ny: (oy * 2 + size * 0.1) / nl, nz: oz / nl, d: 0 });
    }
  };
  for (let i = 0; i < NC; i++) {
    const big = R() < 0.3, size = big ? 2300 + R() * 2600 : 900 + R() * 1500;
    const bk = banks[(R() * banks.length) | 0], inBank = R() < 0.72, br = Math.sqrt(R()) * bk[2], ba = R() * 6.283;
    const c = { x: inBank ? bk[0] + Math.cos(ba) * br * (1.6 * Math.abs(Math.cos(bk[3])) + 0.5) : (R() - .5) * DX, z: inBank ? bk[1] + Math.sin(ba) * br * (1.6 * Math.abs(Math.sin(bk[3])) + 0.5) : (R() - .5) * DZ, y: BASE + R() * 500, size, rank: (i + R() * 0.6) / NC, a: 0, sp: 0.85 + R() * 0.3 };
    clouds.push(c); heap(c, big);
  }
  // Cloud systems: a long mass of big heaps packed so close that they run into one another, the ones in its heart building higher. They all
  // drift at one speed, so the system holds together, and they come and go together with the amount of cloud (one rank for the lot).
  for (let s = 0, NS = MOBILE ? 1 : dq(1, 2, 3); s < NS; s++) {
    const sx = (R() - .5) * DX, sz = (R() - .5) * DZ, ang = R() * Math.PI, L = 18000 + R() * 12000, W = 6000 + R() * 5000, rank = s === 0 ? 0.05 + R() * 0.15 : 0.08 + R() * 0.4, sp = 0.9 + R() * 0.2;          // (the first shows even on a fairly fine day)
    for (let i = 0, m = Math.round((30 + R() * 14) * (MOBILE ? 0.6 : dq(0.6, 0.8, 1))); i < m; i++) {
      const u = R() - 0.5, v = (R() - 0.5) * Math.sqrt(Math.max(0, 1 - 4 * u * u)), core = Math.max(0, 1 - Math.hypot(2 * u, 2 * v));
      const lx = u * L, lz = v * W, c = { x: sx + lx * Math.cos(ang) - lz * Math.sin(ang), z: sz + lx * Math.sin(ang) + lz * Math.cos(ang), y: BASE + R() * 220, size: 2600 + R() * 2000 + core * 1800, rank: rank + R() * 0.05, a: 0, sp };
      clouds.push(c); heap(c, true, core);
    }
  }
  // Stratus: low, flat grey sheets in broad bands, under the cumulus. Each sheet is wide, thin puffs (stretched sideways when drawn), dim on
  // top as well as underneath, and only partly opaque, so the sky and the land show through it here and there.
  for (let s = 0, NST = MOBILE ? 5 : dq(6, 9, 12); s < NST; s++) {
    const L = 9000 + R() * 8000, W = 2600 + R() * 3600, ang = R() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
    const c = { x: (R() - .5) * DX, z: (R() - .5) * DZ, y: BASE * 0.48 + R() * 160, size: L, rank: 0.15 + R() * 0.75, a: 0, sp: 0.9 + R() * 0.2, op: 0.5 };
    clouds.push(c);
    for (let j = 0, n = Math.round((14 + R() * 9) * (MOBILE ? 0.7 : 1)); j < n; j++) {
      const u = (R() - 0.5) * L, v = (R() - 0.5) * W * Math.sqrt(Math.max(0, 1 - 4 * (u / L) ** 2));
      puffs.push({ c, ox: u * ca - v * sa, oy: R() * 70, oz: u * sa + v * ca, ps: 2200 + R() * 1500, at: (R() * 4) | 0, fl: 1, rot: (R() - 0.5) * 0.6, up: 0.34 + R() * 0.22, nx: 0, ny: 1, nz: 0, d: 0 });
    }
  }
  const N = puffs.length;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0], 3));
  geo.setIndex([0, 1, 2, 2, 1, 3]);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aPar = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aNrm = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', aPos); geo.setAttribute('iPar', aPar); geo.setAttribute('iNrm', aNrm);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const puffTex = new THREE.TextureLoader().load('assets/puff.png');
  puffTex.colorSpace = THREE.NoColorSpace; puffTex.flipY = false;
  const uni = { uDark: { value: 0 }, uPuff: { value: puffTex }, uCamR: { value: new THREE.Vector3() }, uCamU: { value: new THREE.Vector3() } };
  const vsHead = /* glsl */`
    attribute vec4 iPos, iPar; attribute vec3 iNrm; uniform vec3 uCamR, uCamU;
    varying vec2 vUv; varying vec4 vPar; varying vec3 vNrm, vW;
    vec2 spin(vec2 c, float r){ return vec2(c.x * cos(r) - c.y * sin(r), c.x * sin(r) + c.y * cos(r)); }`;
  const mat = makeMat({
    transparent: true, depthWrite: false, uniforms: uni,
    vs: vsHead + /* glsl */`
      void main(){
        float at = mod(iPar.x, 4.0), fl = floor(iPar.x / 4.0);          /* which of the four puffs in the picture; fl is 1 for a stratus puff, stretched sideways */
        vec2 c = spin(position.xy, iPar.y) * vec2(1.0 + 1.8 * fl, 1.0 - 0.35 * fl);
        vec3 wp = iPos.xyz + (uCamR * c.x + uCamU * c.y) * iPos.w;
        vUv = (position.xy + 0.5) * 0.5 + vec2(mod(at, 2.0), floor(at / 2.0)) * 0.5;
        vPar = iPar; vNrm = iNrm; vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`
      uniform sampler2D uPuff; uniform float uDark; varying vec2 vUv; varying vec4 vPar; varying vec3 vNrm, vW;
      void main(){
        ${LOGF}
        vec3 t = texture2D(uPuff, vUv).rgb;
        float dens = t.r * (0.75 + 0.5 * t.b);
        float a = smoothstep(0.02, 0.62, dens) * vPar.w;
        float dist = length(vW - cameraPosition);
        float fl = floor(vPar.x / 4.0);
        { vec2 lu = fract(vUv * 2.0); a *= smoothstep(0.0, 0.14, min(min(lu.x, 1.0 - lu.x), min(lu.y, 1.0 - lu.y))); }          // (the edge of each puff's square never shows, even close up)
        a *= mix(smoothstep(1200.0, 7500.0, dist), smoothstep(250.0, 1800.0, dist), fl);          /* (a low sheet still shows overhead) */
        if(a < 0.004) discard;
        vec3 L = uLightDir; float up = vPar.z;
        float side = dot(normalize(vNrm), L) * 0.5 + 0.5;
        float core = smoothstep(0.15, 0.9, t.g);
        float lit = mix(0.2, 1.0, up) * mix(0.32, 1.0, side) * (1.08 - 0.3 * core);
        vec3 col = uLightCol * 0.36 * lit + uAmbSky * (0.9 + 0.55 * up) + uAmbGnd * 0.25;
        col *= mix(1.0, 0.86, core * (1.0 - up) * 0.9);                                 // soft grey bellies: fair-weather cloud is never dark
        col = mix(col, col * vec3(0.40, 0.43, 0.50), uOvercast * (1.0 - up * 0.55)) * (1.0 - 0.45 * uOvercast);    // heavy rain cloud
        vec3 V = normalize(vW - cameraPosition);
        col += uLightCol * 0.30 * pow(max(dot(V, L), 0.0), 5.0) * (1.0 - smoothstep(0.1, 0.7, dens));   // silver lining
        col *= mix(vec3(1.0), vec3(0.42, 0.45, 0.52) * (0.55 + 0.6 * up), uDark);
        col += vec3(uFlash) * (0.8 + up);
        gl_FragColor = vec4(applyFog(col, vW), a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 30; scene.add(mesh);

  // top-down coverage map -> cloud shadows + reflections
  const SW = 70000, SH = 92000;
  const srt = new THREE.WebGLRenderTarget(MOBILE ? 384 : 640, MOBILE ? 512 : 840, { depthBuffer: false });
  srt.texture.minFilter = srt.texture.magFilter = THREE.LinearFilter; srt.texture.generateMipmaps = false;
  U.uCloudTex.value = srt.texture; U.uCloudRect.value.set(0, 0, 1 / SW, 1 / SH); U.uCloudAlt.value = BASE + 300;
  const smat = makeMat({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: uni,
    vs: vsHead + /* glsl */`
      void main(){
        float at = mod(iPar.x, 4.0), fl = floor(iPar.x / 4.0);
        vec2 c = spin(position.xy, iPar.y) * (1.0 + 0.55 * fl);
        vec3 wp = iPos.xyz + vec3(c.x, 0.0, c.y) * iPos.w;
        vUv = (position.xy + 0.5) * 0.5 + vec2(mod(at, 2.0), floor(at / 2.0)) * 0.5;
        vPar = iPar; vNrm = iNrm; vW = wp;
        gl_Position = vec4((wp.xz - uCloudRect.xy) * uCloudRect.zw * 2.0, 0.0, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`
      uniform sampler2D uPuff; varying vec2 vUv; varying vec4 vPar; varying vec3 vNrm, vW;
      void main(){ ${LOGF} float d = texture2D(uPuff, vUv).r; gl_FragColor = vec4(vec3(smoothstep(0.03, 0.6, d) * vPar.w * 0.75), 1.0); }`,
  });
  const smesh = new THREE.Mesh(geo, smat); smesh.frustumCulled = false;
  const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // rain streaks in a box that follows the view
  const RN = MOBILE ? 3500 : dq(5000, 8000, 12000), rp = new Float32Array(RN * 6), rs = new Float32Array(RN * 2);
  const RR = rng(99);
  for (let i = 0; i < RN; i++) { const x = RR(), y = RR(), z = RR(); rp.set([x, y, z, x, y, z], i * 6); rs[i * 2] = 0; rs[i * 2 + 1] = 1; }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aEnd', new THREE.BufferAttribute(rs, 1));
  const rmat = makeMat({
    transparent: true, depthWrite: false, uniforms: { uBox: { value: new THREE.Vector4() }, uRainA: { value: 0 }, uWindDir: U.uWindDir },
    vs: /* glsl */`
      attribute float aEnd; uniform vec4 uBox; uniform vec2 uWindDir; varying float vA, vF;
      void main(){
        float sp = 0.55 + fract(position.x * 37.0) * 0.5;
        vec3 p = position; p.y = fract(p.y - uTime * sp * 1.1);
        p.xz = fract(p.xz + uWindDir * (1.0 - p.y) * 0.16);
        vec3 wp = uBox.xyz + (p - vec3(0.5, 0.0, 0.5)) * vec3(uBox.w, uBox.w * 0.7, uBox.w);
        wp.y += aEnd * uBox.w * 0.012; wp.xz -= uWindDir * aEnd * uBox.w * 0.003;
        vA = aEnd; vF = 1.0 - smoothstep(uBox.w * 0.25, uBox.w * 0.8, length(wp - cameraPosition)) * 0.85;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: /* glsl */`uniform float uRainA; varying float vA, vF; void main(){ ${LOGF} gl_FragColor = vec4((uAmbSky * 2.2 + uLightCol * 0.1 + vec3(uFlash)), uRainA * (0.2 + 0.8 * vA) * 0.10 * vF); }`,
  });
  const rain = new THREE.LineSegments(rg, rmat); rain.frustumCulled = false; rain.renderOrder = 40; scene.add(rain);

  const order = new Uint32Array(N); let vis = 1;
  const camR = uni.uCamR.value, camU = uni.uCamU.value, tmp = new THREE.Vector3();
  return {
    update(dt, t, camera, show) {
      vis += ((show ? 1 : 0) - vis) * Math.min(1, dt * 3);
      const wd = U.uWindDir.value, sp = (22 + wx.wind * 2.0) * dt;
      // overcast never fully closes the view from above: cap the visible share
      const frac = clamp((0.03 + wx.cloud * 0.8) * wx.low, 0, 0.9);
      for (const c of clouds) {
        c.x += wd.x * sp * c.sp; c.z += wd.y * sp * c.sp;
        if (c.x > DX / 2) c.x -= DX; else if (c.x < -DX / 2) c.x += DX;
        if (c.z > DZ / 2) c.z -= DZ; else if (c.z < -DZ / 2) c.z += DZ;
        const edge = smooth(0, 5000, Math.min(DX / 2 - Math.abs(c.x), DZ / 2 - Math.abs(c.z)));
        const want = c.rank < frac ? 1 : 0; c.a += (want - c.a) * Math.min(1, dt * 0.5); c.e = c.a * edge * vis * (c.op || 1);
      }
      camera.matrixWorld.extractBasis(camR, camU, tmp);
      const cp = camera.position; let n = 0;
      for (let i = 0; i < N; i++) {
        const p = puffs[i]; if (p.c.e < 0.01) continue;
        const dx = p.c.x + p.ox - cp.x, dy = p.c.y + wx.calt + p.oy * wx.cy - cp.y, dz = p.c.z + p.oz - cp.z;
        p.d = dx * dx + dy * dy + dz * dz; order[n++] = i;
      }
      const ord = order.subarray(0, n); ord.sort((a, b) => puffs[b].d - puffs[a].d);
      const P = aPos.array, A = aPar.array, Nn = aNrm.array;
      for (let k = 0; k < n; k++) {
        const p = puffs[ord[k]], c = p.c;
        P[k * 4] = c.x + p.ox * (0.6 + 0.4 * wx.cs); P[k * 4 + 1] = c.y + wx.calt + p.oy * wx.cy; P[k * 4 + 2] = c.z + p.oz * (0.6 + 0.4 * wx.cs); P[k * 4 + 3] = p.ps * wx.cs * (1 + wx.overcast * 0.2);
        A[k * 4] = p.at + 4 * p.fl; A[k * 4 + 1] = p.rot; A[k * 4 + 2] = p.up; A[k * 4 + 3] = c.e;
        Nn[k * 3] = p.nx; Nn[k * 3 + 1] = p.ny; Nn[k * 3 + 2] = p.nz;
      }
      aPos.needsUpdate = aPar.needsUpdate = aNrm.needsUpdate = true; geo.instanceCount = n;
      mesh.visible = n > 0;
      U.uCloudStr.value = 0.5 * (1 - wx.overcast * 0.45); uni.uDark.value = wx.dark; U.uCloudAlt.value = BASE + 300 + wx.calt;
      // shadow map
      const old = renderer.getRenderTarget(), oc = renderer.getClearColor(new THREE.Color()), oa = renderer.getClearAlpha();
      renderer.setRenderTarget(srt); renderer.setClearColor(0x000000, 1); renderer.clear();
      if (n > 0) renderer.render(smesh, ocam);
      renderer.setRenderTarget(old); renderer.setClearColor(oc, oa);
      // rain
      rain.visible = wx.rain > 0.02;
      if (rain.visible) {
        const d = clamp(camera.position.y * 0.9, 250, 30000);
        camera.getWorldDirection(tmp);
        rmat.uniforms.uBox.value.set(cp.x + tmp.x * d * 0.9, Math.max(0, cp.y - d * 0.55), cp.z + tmp.z * d * 0.9, d * 1.5);
        rmat.uniforms.uRainA.value = wx.rain;
      }
    },
  };
}

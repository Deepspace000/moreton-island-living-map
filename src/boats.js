// Boats: yachts and cruisers at anchor (swinging to the real wind), yachts under sail,
// the island ferries on their charted routes, wakes and navigation lights.
import * as THREE from 'three';
import { U, VEX, MOBILE, makeMat, objectMat, LOGV, LOGF, rng, clamp } from './common.js';
import { T, heightAt, maskAt } from './terrain.js';
import { waveAt } from './water.js';
import { GB, makeLights } from './geo.js';
import { wx } from './weather.js';

const WHITE = [.93, .93, .91], NAVY = [.07, .13, .26], ANTI = [.25, .08, .07], DECK = [.80, .76, .66], GLASS = [.06, .09, .13];
function hull(g, L, B, D, free, col, deck, zoff = 0, bot = ANTI) {
  const S = 10, st = [];
  for (let i = 0; i <= S; i++) {
    const u = i / S, x = (u - .5) * L;
    const hb = B / 2 * (u < 0.55 ? 0.84 + 0.16 * Math.sin(u / 0.55 * Math.PI / 2) : Math.pow(Math.cos((u - 0.55) / 0.45 * Math.PI / 2), 0.75)) + 0.02;
    st.push({ x, hb, yd: free * (1 + 0.28 * u * u), yk: -D * (1 - 0.7 * u * u * u) });
  }
  for (let i = 0; i < S; i++) {
    const a = st[i], b = st[i + 1];
    for (const s of [-1, 1]) {
      const A = [a.x, a.yd, zoff + a.hb * s], Bq = [b.x, b.yd, zoff + b.hb * s], Aw = [a.x, 0.05, zoff + a.hb * s * 0.96], Bw = [b.x, 0.05, zoff + b.hb * s * 0.96];
      const Ak = [a.x, a.yk, zoff + a.hb * s * 0.45], Bk = [b.x, b.yk, zoff + b.hb * s * 0.45];
      if (s > 0) { g.quad(Aw, Bw, Bq, A, col); g.quad(Ak, Bk, Bw, Aw, bot); } else { g.quad(Bw, Aw, A, Bq, col); g.quad(Bk, Ak, Aw, Bw, bot); }
    }
    g.quad([a.x, a.yd, zoff - a.hb], [a.x, a.yd, zoff + a.hb], [b.x, b.yd, zoff + b.hb], [b.x, b.yd, zoff - b.hb], deck);
    g.quad([a.x, a.yk, zoff + a.hb * .45], [a.x, a.yk, zoff - a.hb * .45], [b.x, b.yk, zoff - b.hb * .45], [b.x, b.yk, zoff + b.hb * .45], bot);
  }
  const a = st[0];
  g.quad([a.x, a.yk, zoff + a.hb * .45], [a.x, a.yk, zoff - a.hb * .45], [a.x, a.yd, zoff - a.hb], [a.x, a.yd, zoff + a.hb], col);
}
function yacht(sails, hc) {
  const g = new GB();
  hull(g, 11.5, 3.5, 0.8, 1.0, hc, DECK);
  g.box(0.4, 1.0, 0, 4.2, 0.62, 2.1, WHITE); g.box(0.6, 1.25, 0, 3.0, 0.2, 2.14, GLASS);
  g.box(-3.6, 1.0, 0, 2.2, 0.3, 2.3, [.7, .66, .58]);
  g.cyl(1.4, 1.0, 0, 0.1, 0.07, 14.5, 6, [.82, .82, .84]);
  g.box(-1.3, 2.25, 0, 5.2, 0.16, 0.16, [.82, .82, .84]);
  if (sails) {
    const S1 = [.97, .96, .92], S2 = [.92, .91, .86];
    const top = [1.35, 15.2, 0], tack = [1.3, 2.45, 0], clew = [-3.8, 2.45, 0.9], mid = [-1.2, 8.0, 0.75];
    g.tri(top, tack, mid, S1); g.tri(tack, clew, mid, S2); g.tri(clew, top, mid, S1);
    const jt = [1.45, 13.4, 0], jb = [5.6, 1.35, 0], jc = [0.9, 1.8, 1.25], jm = [2.9, 6.0, 0.95];
    g.tri(jt, jm, jb, S1); g.tri(jb, jm, jc, S2); g.tri(jc, jm, jt, S1);
  } else g.box(-1.3, 2.33, 0, 4.9, 0.34, 0.36, [.12, .22, .42]);
  return g.build();
}
function cruiser(hc) {
  const g = new GB();
  hull(g, 10.5, 3.6, 0.6, 1.25, hc, DECK);
  g.box(0.3, 1.3, 0, 5.2, 1.25, 2.9, WHITE); g.box(0.5, 1.75, 0, 4.9, 0.5, 2.94, GLASS);
  g.box(-0.6, 2.55, 0, 3.0, 0.9, 2.4, WHITE); g.box(-0.2, 3.45, 0, 2.6, 0.08, 2.6, [.85, .85, .85]);
  g.box(-4.0, 1.3, 0, 1.6, 0.25, 2.8, [.6, .5, .4]);
  g.cyl(-0.6, 3.5, 0, 0.04, 0.03, 1.8, 4, [.8, .8, .8]);
  return g.build();
}
function tinny() {
  const g = new GB(), AL = [.66, .69, .70];
  hull(g, 4.8, 1.9, 0.22, 0.55, AL, [.5, .53, .54], 0, [.45, .47, .48]);
  g.box(-2.5, 0.25, 0, 0.45, 0.9, 0.4, [.12, .12, .13]);
  g.box(-0.9, 0.5, 0, 0.35, 0.12, 1.6, AL); g.box(0.7, 0.5, 0, 0.35, 0.12, 1.5, AL);
  g.box(-1.4, 0.62, 0.2, 0.4, 0.75, 0.45, [.75, .2, .15]); g.box(-1.4, 1.37, 0.2, 0.3, 0.3, 0.3, [.85, .68, .55]);
  return g.build();
}
function flyer() {            // fast passenger catamaran
  const g = new GB();
  for (const z of [-3.6, 3.6]) hull(g, 35, 2.8, 1.1, 1.7, WHITE, WHITE, z, NAVY);
  g.box(-0.5, 1.7, 0, 31, 0.9, 10.2, WHITE);
  g.box(-1.5, 2.6, 0, 25, 2.6, 9.6, WHITE); g.box(-1.3, 3.4, 0, 24.6, 0.9, 9.66, GLASS);
  g.box(-1.5, 2.62, 0, 25.1, 0.35, 9.7, [.05, .35, .6]);
  g.box(2.5, 5.2, 0, 13, 2.2, 7.4, WHITE); g.box(3.0, 5.9, 0, 12.6, 0.8, 7.46, GLASS);
  g.box(6.8, 7.4, 0, 3.4, 0.25, 5.5, WHITE); g.cyl(4, 7.4, 0, 0.08, 0.05, 3.2, 5, [.8, .8, .8]);
  return g.build();
}
function barge() {            // vehicle ferry
  const g = new GB(), HB = [.10, .28, .50];
  for (const z of [-5.5, 5.5]) hull(g, 58, 5, 1.6, 2.2, HB, [.3, .3, .32], z, [.2, .08, .07]);
  g.box(0, 2.2, 0, 56, 0.6, 16.5, [.36, .37, .38]);
  for (const z of [-8, 8]) g.box(0, 2.8, z, 54, 1.5, 0.4, WHITE);
  g.box(19, 2.8, 0, 9, 3.2, 16, WHITE); g.box(19.3, 6.0, 0, 8, 2.8, 14, WHITE); g.box(19.6, 6.9, 0, 7.9, 1.0, 14.06, GLASS);
  g.box(19, 8.8, 0, 5, 0.3, 10, HB); g.cyl(18, 8.8, 0, 0.5, 0.4, 3.5, 6, HB);
  g.box(-28.5, 2.6, 0, 3.5, 0.3, 11, [.5, .5, .5]);
  const R = rng(8), CARS = [[.85, .85, .85], [.15, .15, .17], [.6, .1, .08], [.12, .25, .5], [.75, .7, .55], [.3, .35, .3]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) if (R() < 0.8) { const x = -22 + c * 5.6, z = (r - 1) * 4.6; g.box(x, 2.8, z, 4.4, 1.3, 2.0, CARS[(R() * CARS.length) | 0]); g.box(x - 0.3, 4.1, z, 2.4, 0.7, 1.8, GLASS); }
  return g.build();
}

export function buildBoats(scene, F) {
  const R = rng(31337), S = 1.55;
  const mat = objectMat({ side: THREE.DoubleSide });
  const HC = [WHITE, WHITE, [.12, .18, .32], [.9, .88, .8], [.55, .1, .1], [.1, .3, .28]];
  const geo = {
    sail: [yacht(true, WHITE), yacht(true, HC[2])], moor: HC.map(c => yacht(false, c)),
    cru: [cruiser(WHITE), cruiser(HC[3])], tin: [tinny()], flyer: flyer(), barge: barge(),
  };
  const pick = (a) => a[(R() * a.length) | 0];
  const boats = [], lights = makeLights(260);
  const mk = (g, x, z, o = {}) => {
    const m = new THREE.Mesh(g, mat); m.rotation.order = 'YZX'; m.scale.setScalar(S * (o.scale || 1)); m.frustumCulled = false; scene.add(m);
    const b = { m, x, z, ax: x, az: z, hd: R() * 6.28, sp: 0, ph: R() * 10, mast: o.mast || 3, ...o };
    b.li = lights.add([x, 0, z], [1, 1, .92], 0, 1, 0, o.big ? 1.6 : 0.9);
    if (o.move) { b.lr = lights.add([x, 0, z], [1, .1, .08], 0, 1, 0, 0.8); b.lg = lights.add([x, 0, z], [.1, 1, .3], 0, 1, 0, 0.8); }
    boats.push(b); return b;
  };
  const depth = (x, z) => U.uSeaM.value - heightAt(x, z);
  const inRect = (x, z, pad = 300) => Math.abs(x) < T.sx / 2 - pad && Math.abs(z) < T.sz / 2 - pad;

  // ---- at anchor ----
  const wrecks = F.wrecks.map(w => w.c);
  const clearOf = (x, z, d) => boats.every(b => Math.hypot(b.x - x, b.z - z) > d) && wrecks.every(w => Math.hypot(w[0] - x, w[1] - z) > 42);
  const moor = (cx, cz, n, rad, types, dmin = 1.8, dmax = 11) => {
    let k = 0;
    for (let t = 0; t < n * 40 && k < n; t++) {
      const a = R() * 6.283, r = Math.sqrt(R()) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, d = depth(x, z);
      if (d < dmin || d > dmax || !clearOf(x, z, 46) || !inRect(x, z)) continue;
      const ty = pick(types);
      if (ty === 'moor') mk(pick(geo.moor), x, z, { anchor: 1, mast: 15.5, scope: 16 });
      else if (ty === 'cru') mk(pick(geo.cru), x, z, { anchor: 1, mast: 5.3, scope: 14 });
      else mk(geo.tin[0], x, z, { anchor: 1, mast: 1.2, scope: 7, small: 1 });
      k++;
    }
  };
  const find = (arr, re) => arr.find(o => re.test(o.n || ''));
  const at = (o) => o && (o.c || o.p);
  const tw = at(find(F.views, /Tangalooma Wrecks/)), tg = at(find(F.places, /^Tangalooma/)), bw = at(find(F.places, /Bulwer/)), cc = at(find(F.places, /Cowan/)), ko = at(find(F.places, /Kooringal/)), dg = at(find(F.seanames, /Days Gutter/));
  const M3 = ['moor', 'moor', 'cru', 'cru', 'tin'];
  if (tw) { moor(tw[0] - 60, tw[1], MOBILE ? 9 : 16, 330, M3, 1.6, 9); }
  if (tg) moor(tg[0] - 350, tg[1] + 100, MOBILE ? 4 : 7, 420, M3);
  if (bw) moor(bw[0] - 350, bw[1], 6, 420, M3);
  if (cc) moor(cc[0] - 300, cc[1], 4, 350, M3);
  if (ko) moor(ko[0] - 250, ko[1], 7, 520, ['moor', 'cru', 'tin', 'tin'], 1.2, 9);
  if (dg) moor(dg[0], dg[1], 6, 600, M3);
  for (const a of F.anchor) moor(a.p[0], a.p[1], 3, 300, M3);
  for (const s of F.seanames) if (/Bank/.test(s.n)) moor(s.p[0], s.p[1], 3, 900, ['tin', 'tin', 'cru'], 0.8, 5);

  // ---- under way ----
  const NAV = MOBILE ? 6 : 10;
  const homes = [[-6500, -9000, 3500], [-7000, 0, 3800], [-5500, 8000, 3000], [-3500, -14000, 3000], [7500, -6000, 2800], [8500, 6000, 2800], [-7500, -4000, 3500], [-6000, 13000, 2800], [-8000, 5000, 3000], [2000, -20500, 1500]];
  for (let i = 0; i < NAV; i++) {
    const h = homes[i % homes.length], sail = i % 3 !== 2;
    let x = h[0], z = h[1];
    for (let t = 0; t < 60; t++) { const px = h[0] + (R() - .5) * h[2], pz = h[1] + (R() - .5) * h[2]; if (depth(px, pz) > 5) { x = px; z = pz; break; } }
    mk(sail ? pick(geo.sail) : pick(geo.cru), x, z, { move: 1, sail, home: h, tx: x, tz: z, tt: 0, tack: R() < .5 ? 1 : -1, mast: sail ? 15.5 : 5.3, cruise: sail ? 0 : 8 + R() * 5 });
  }
  // ---- ferries on their charted routes ----
  for (const f of F.ferries) {
    let pts = f.p.filter(p => p[0] > -T.sx / 2 - 9000 && Math.abs(p[1]) < T.sz / 2 + 5000);
    if (pts.length < 2) continue;
    const big = /MICAT/i.test(f.n), trader = /Trader/i.test(f.n);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    mk(big || trader ? geo.barge : geo.flyer, pts[0][0], pts[0][1], { ferry: 1, move: 1, big: 1, pts, cum, s: R() * cum[cum.length - 1], dir: 1, wait: 0, scale: trader ? 0.55 : 1, cruise: big ? 9 : trader ? 6 : 15, mast: big ? 12.5 : 10.8 });
  }

  // ---- wakes ----
  const movers = boats.filter(b => b.move), NW = 44;
  const wp = new Float32Array(movers.length * NW * 2 * 3), wa = new Float32Array(movers.length * NW * 2 * 2), wi = [];
  movers.forEach((b, k) => { b.hist = []; b.wk = k; for (let j = 0; j < NW - 1; j++) { const o = (k * NW + j) * 2; wi.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); } });
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(wp, 3).setUsage(THREE.DynamicDrawUsage));
  wg.setAttribute('aA', new THREE.BufferAttribute(wa, 2).setUsage(THREE.DynamicDrawUsage));
  wg.setIndex(wi); wg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const wmat = makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vs: /* glsl */`attribute vec2 aA; varying vec2 vA; varying vec3 vW; void main(){ vA = aA; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); ${LOGV} }`,
    fs: /* glsl */`varying vec2 vA; varying vec3 vW;
      void main(){ ${LOGF}
        float n = texture2D(uNoise, vW.xz / 4.3).b * 0.55 + texture2D(uNoise, vW.xz / 13.0 + uTime * 0.02).g * 0.5 + texture2D(uNoise, vW.xz / 37.0).r * 0.3;
        float e = abs(vA.y);
        float arms = smoothstep(1.0, 0.8, e) * smoothstep(0.45, 0.85, e);                     // the two foaming edges of the V
        float churn = (1.0 - e) * vA.x * vA.x;                                                // prop wash, strongest right behind the boat
        float a = vA.x * smoothstep(0.55 - vA.x * 0.35, 0.95, n + arms * 0.45 + churn * 0.5) * (arms + churn * 0.9 + 0.12);
        vec3 c = vec3(0.93, 0.96, 0.97) * (uLightCol * 0.3 * cloudShadow(vW) + uAmbSky * 0.9);
        gl_FragColor = vec4(applyFog(c, vW), a * 0.8); }`,
  });
  const wm = new THREE.Mesh(wg, wmat); wm.frustumCulled = false; wm.renderOrder = 12; scene.add(wm);
  scene.add(lights.pts);
  lights.pts.material.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2);

  const wo = {}; let recT = 0;
  const turn = (b, want, rate, dt) => { let d = ((want - b.hd + Math.PI * 3) % (Math.PI * 2)) - Math.PI; b.hd += clamp(d, -rate * dt, rate * dt); return d; };
  return {
    boats,
    update(dt, t, camera) {
      const wt = U.uWindDir.value, sea = U.uSeaM.value * VEX, upwind = Math.atan2(wt.y, -wt.x);
      recT += dt; const rec = recT > 0.28; if (rec) recT = 0;
      for (const b of boats) {
        let roll = 0;
        if (b.anchor) {
          const yaw = upwind + Math.sin(t * 0.07 + b.ph) * 0.28 + Math.sin(t * 0.19 + b.ph * 3) * 0.1;
          turn(b, yaw, 0.12, dt);
          b.x = b.ax - Math.cos(b.hd) * b.scope; b.z = b.az + Math.sin(b.hd) * b.scope;
        } else if (b.ferry) {
          const end = b.cum[b.cum.length - 1];
          if (b.wait > 0) { b.wait -= dt; b.sp += (0 - b.sp) * Math.min(1, dt); }
          else {
            const toEnd = b.dir > 0 ? end - b.s : b.s;
            b.sp += (Math.min(b.cruise, 1.5 + toEnd * 0.05) * 1.6 - b.sp) * Math.min(1, dt * 0.5);
            b.s += b.sp * b.dir * dt;
            if (b.s >= end || b.s <= 0) { b.s = clamp(b.s, 0, end); b.dir *= -1; b.wait = 35; }
          }
          let i = 1; while (i < b.cum.length - 1 && b.cum[i] < b.s) i++;
          const a = b.pts[i - 1], c = b.pts[i], f = (b.s - b.cum[i - 1]) / Math.max(1, b.cum[i] - b.cum[i - 1]);
          b.x = a[0] + (c[0] - a[0]) * f; b.z = a[1] + (c[1] - a[1]) * f;
          if (b.sp > 0.5) turn(b, Math.atan2(-(c[1] - a[1]) * b.dir, (c[0] - a[0]) * b.dir), 0.25, dt);
        } else {
          // free-roaming yacht or cruiser: wander inside its home water, keep off the banks
          b.tt -= dt;
          const dx = b.tx - b.x, dz = b.tz - b.z, dd = Math.hypot(dx, dz);
          const ahead = (d, off) => depth(b.x + Math.cos(b.hd + off) * d, b.z - Math.sin(b.hd + off) * d);
          const shoal = ahead(120, 0) < 3.2 || ahead(260, 0) < 2.6 || !inRect(b.x + Math.cos(b.hd) * 400, b.z - Math.sin(b.hd) * 400, 500);
          if (dd < 150 || b.tt < 0 || shoal) {
            for (let k = 0; k < 20; k++) { const px = b.home[0] + (Math.random() - .5) * b.home[2] * 2, pz = b.home[1] + (Math.random() - .5) * b.home[2] * 2; if (depth(px, pz) > 5 && inRect(px, pz, 600)) { b.tx = px; b.tz = pz; break; } }
            b.tt = 60 + Math.random() * 80;
          }
          let want = Math.atan2(-dz, dx);
          if (shoal) want = b.hd + (ahead(200, 0.7) > ahead(200, -0.7) ? 1.2 : -1.2);
          let cruise = b.cruise;
          if (b.sail) {
            let off = ((want - upwind + Math.PI * 3) % (Math.PI * 2)) - Math.PI;      // angle off the wind
            if (Math.abs(off) < 0.75) { if (Math.random() < dt / 45) b.tack *= -1; want = upwind + 0.78 * b.tack; off = 0.78 * b.tack; }
            const pt = clamp(Math.abs(off) / 1.6, 0.45, 1);
            cruise = clamp(1.6 + wx.wind * 0.13, 1.6, 6.5) * pt;
            const side = Math.sin(((b.hd - upwind + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0 ? 1 : -1;
            roll = side * clamp(wx.wind * 0.011, 0.03, 0.42) * (1.25 - pt * 0.5);
            b.m.scale.z = S * (side > 0 ? 1 : -1);                                    // boom and sails set to leeward
          }
          turn(b, want, b.sail ? 0.16 : 0.3, dt);
          b.sp += (cruise * 1.6 - b.sp) * Math.min(1, dt * 0.4);
          b.x += Math.cos(b.hd) * b.sp * dt; b.z -= Math.sin(b.hd) * b.sp * dt;
        }
        const wy = waveAt(b.x, b.z, t, wo) * VEX;
        const cs = Math.cos(b.hd), sn = Math.sin(b.hd);
        const sb = (wo.sx * cs - wo.sz * sn) * VEX, sr = (wo.sx * sn + wo.sz * cs) * VEX, k = b.big ? 0.25 : b.small ? 1 : 0.7;
        b.m.position.set(b.x, sea + wy * (b.big ? 0.4 : 1) - (b.small ? 0.05 : 0.1), b.z);
        b.m.rotation.set(-Math.atan(sr) * k + roll + Math.sin(t * 0.9 + b.ph) * 0.02, b.hd, Math.atan(sb) * k);
        const my = b.m.position.y + b.mast * S * (b.scale || 1);
        lights.move(b.li, b.x, my, b.z);
        if (b.move) {
          lights.move(b.lg, b.x + sn * 2.4, b.m.position.y + 3, b.z + cs * 2.4); lights.move(b.lr, b.x - sn * 2.4, b.m.position.y + 3, b.z - cs * 2.4);
          if (rec) { b.hist.unshift({ x: b.x - cs * 4 * S, z: b.z + sn * 4 * S, nx: sn, nz: cs, t, sp: b.sp }); if (b.hist.length > NW) b.hist.length = NW; }
          const w0 = b.big ? 7 : 1.6, life = b.big ? 30 : 16;
          for (let j = 0; j < NW; j++) {
            const h = b.hist[Math.min(j, b.hist.length - 1)] || { x: b.x, z: b.z, nx: sn, nz: cs, t, sp: 0 };
            const age = t - h.t, w = w0 + age * (b.big ? 1.5 : 0.75), o = (b.wk * NW + j) * 2, al = j >= b.hist.length ? 0 : clamp(1 - age / life, 0, 1) * clamp(h.sp / 5, 0, 1) * (j === 0 ? 0 : 1);
            const y = sea + 0.45 + (j < 3 ? wy : 0);
            wp[o * 3] = h.x - h.nx * w; wp[o * 3 + 1] = y; wp[o * 3 + 2] = h.z - h.nz * w;
            wp[o * 3 + 3] = h.x + h.nx * w; wp[o * 3 + 4] = y; wp[o * 3 + 5] = h.z + h.nz * w;
            wa[o * 2] = al; wa[o * 2 + 1] = -1; wa[o * 2 + 2] = al; wa[o * 2 + 3] = 1;
          }
        }
      }
      wg.attributes.position.needsUpdate = true; wg.attributes.aA.needsUpdate = true;
    },
  };
}

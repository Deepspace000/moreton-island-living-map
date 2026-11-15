// A light aircraft: a high-wing single (the kind that flies people over to the island). It waits at one of the two airstrips, takes off,
// flies a tour of the island, lines up on the other strip, lands, turns round and waits again. You can go along with it, or fly it yourself.
import * as THREE from 'three';
import { U, VEX, objectMat, makeMat, LOGV, LOGF, clamp } from './common.js';
import { T, meshY, heightAt, maskAt } from './terrain.js';
import { GB } from './geo.js';

const S = 1.5, WHITE = [.93, .93, .91], BLUE = [.08, .2, .46], GREY = [.6, .62, .64], DARK = [.07, .09, .12], TYRE = [.06, .06, .07];

// the airframe, nose toward +x, wheels on y = 0
function airframe() {
  const g = new GB(), N = 12;
  // fuselage: rounded sections from the spinner back to the tail cone; white above, a blue cheat line along the side, grey under the belly
  const st = [[3.55, 1.02, 0.14, 0.14], [3.25, 1.02, 0.42, 0.42], [2.5, 1.02, 0.56, 0.52], [1.6, 1.12, 0.66, 0.58], [0.6, 1.2, 0.74, 0.6], [-0.6, 1.2, 0.72, 0.58], [-1.8, 1.24, 0.5, 0.4], [-3.2, 1.34, 0.3, 0.2], [-4.4, 1.44, 0.12, 0.06]];
  const pt = (s, k) => { const a = k / N * Math.PI * 2; return [s[0], s[1] + Math.cos(a) * s[2], Math.sin(a) * s[3]]; };
  const colAt = (k) => { const c = Math.cos(k / N * Math.PI * 2); return c < -0.55 ? GREY : Math.abs(c) < 0.22 ? BLUE : WHITE; };
  for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < N; k++) g.quad(pt(st[i], k), pt(st[i], k + 1), pt(st[i + 1], k + 1), pt(st[i + 1], k), colAt(k + 0.5));
  g.cyl(0, 0, 0, 0, 0, 0, 3, WHITE);
  // glass: windscreen and three windows a side, set just proud of the skin
  for (const sd of [-1, 1]) { for (const [x0, x1] of [[0.95, 1.55], [0.15, 0.85], [-0.75, 0.05]]) g.quad([x0, 1.42, sd * 0.61], [x1, 1.42, sd * 0.61], [x1, 1.86, sd * 0.5], [x0, 1.86, sd * 0.5], DARK); }
  g.quad([1.62, 1.5, -0.5], [1.62, 1.5, 0.5], [1.2, 1.92, 0.44], [1.2, 1.92, -0.44], DARK);
  // the wing on top: a plank with a little dihedral, rounded at the tips, with a strut down to the fuselage each side
  for (const sd of [-1, 1]) {
    const P = (x, y, z) => [x, 1.95 + y + Math.abs(z) * 0.06, z * sd], zt = 5.5, c0 = 1.62, c1 = 1.1;
    const le = (z) => 1.25 - 0.05 * z, te = (z) => le(z) - (c0 + (c1 - c0) * z / zt);
    for (const [z0, z1] of [[0, 2.7], [2.7, 5.1], [5.1, zt]]) {
      const e = z1 === zt ? 0.28 : 0;
      g.quad(P(te(z0), 0.09, z0), P(le(z0), 0.09, z0), P(le(z1) - e, 0.09, z1), P(te(z1) + e, 0.09, z1), WHITE); g.quad(P(le(z0), -0.07, z0), P(te(z0), -0.07, z0), P(te(z1) + e, -0.07, z1), P(le(z1) - e, -0.07, z1), GREY);
      g.quad(P(le(z0), 0.09, z0), P(le(z0), -0.07, z0), P(le(z1) - e, -0.07, z1), P(le(z1) - e, 0.09, z1), WHITE); g.quad(P(te(z0), -0.07, z0), P(te(z0), 0.09, z0), P(te(z1) + e, 0.09, z1), P(te(z1) + e, -0.07, z1), WHITE);
    }
    g.quad(P(0.2, 0.095, 4.2), P(1.0, 0.095, 4.2), P(0.95, 0.095, 5.3), P(0.25, 0.095, 5.3), BLUE);                                        // a band of colour near the tip
    g.quad([0.5, 1.9, sd * 2.3], [0.62, 1.9, sd * 2.3], [0.72, 0.62, sd * 0.56], [0.6, 0.62, sd * 0.56], GREY);                               // strut
    // tailplane
    g.quad([-4.3, 1.5, 0], [-3.45, 1.5, 0], [-3.7, 1.5, sd * 1.75], [-4.3, 1.5, sd * 1.75], WHITE); g.quad([-3.45, 1.44, 0], [-4.3, 1.44, 0], [-4.3, 1.44, sd * 1.75], [-3.7, 1.44, sd * 1.75], GREY);
    // main wheels on their sprung legs
    g.quad([0.35, 0.72, sd * 0.5], [0.55, 0.72, sd * 0.5], [0.5, 0.28, sd * 1.25], [0.34, 0.28, sd * 1.25], GREY);
    g.at(new THREE.Matrix4().makeTranslation(0.42, 0.28, sd * 1.3).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))); g.cyl(0, -0.09, 0, 0.28, 0.28, 0.18, 12, TYRE, TYRE); g.at(null);
  }
  // fin and rudder, swept, with the stripe carried up it
  g.quad([-3.3, 1.5, 0.03], [-4.45, 1.5, 0.03], [-4.6, 3.1, 0.03], [-4.05, 3.1, 0.03], WHITE); g.quad([-4.45, 1.5, -0.03], [-3.3, 1.5, -0.03], [-4.05, 3.1, -0.03], [-4.6, 3.1, -0.03], WHITE);
  g.quad([-3.75, 2.2, 0.035], [-4.52, 2.2, 0.035], [-4.58, 2.75, 0.035], [-3.95, 2.75, 0.035], BLUE); g.quad([-4.52, 2.2, -0.035], [-3.75, 2.2, -0.035], [-3.95, 2.75, -0.035], [-4.58, 2.75, -0.035], BLUE);
  // nose wheel and its leg
  g.cyl(2.55, 0.28, 0, 0.04, 0.05, 0.5, 6, GREY);
  g.at(new THREE.Matrix4().makeTranslation(2.55, 0.25, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))); g.cyl(0, -0.07, 0, 0.25, 0.25, 0.14, 12, TYRE, TYRE); g.at(null);
  return g.build();
}

export function buildPlanes(scene, F) {
  const strips = (F.runways || []).filter(r => r.p && r.p.length >= 2).map(r => ({ a: r.p[0], b: r.p[r.p.length - 1] }));
  if (strips.length < 1) return { planes: [], update() {} };
  const H = Math.hypot, find = (list, re, fb) => { const q = (list || []).find(o => re.test(o.n || '')); return q ? (q.c || q.p) : fb; };
  // ---- the strips themselves: cone markers down both edges and a windsock, so they read as airstrips
  const gm = new GB();
  for (const s of strips) {
    const L = H(s.b[0] - s.a[0], s.b[1] - s.a[1]), ux = (s.b[0] - s.a[0]) / L, uz = (s.b[1] - s.a[1]) / L; s.L = L; s.ux = ux; s.uz = uz;
    for (let d = 0; d <= L + 1; d += 60) for (const sd of [-1, 1]) { const x = s.a[0] + ux * d - uz * 13 * sd, z = s.a[1] + uz * d + ux * 13 * sd, y = meshY(x, z); gm.cyl(x, y, z, 0.32, 0.06, 0.55, 8, d < 1 || d > L - 60 ? [.85, .2, .1] : [.92, .92, .9]); }
    const wx0 = s.a[0] + ux * L * 0.5 - uz * 30, wz0 = s.a[1] + uz * L * 0.5 + ux * 30, wy0 = meshY(wx0, wz0); gm.cyl(wx0, wy0, wz0, 0.07, 0.05, 6.5, 6, [.8, .8, .8]); s.sock = [wx0, wy0 + 6.3, wz0];
  }
  const marks = new THREE.Mesh(gm.build(), objectMat({ side: THREE.DoubleSide })); marks.frustumCulled = false; scene.add(marks);
  // windsocks: a tapering orange sleeve that streams downwind and droops when the wind drops
  const sg = new THREE.BufferGeometry(), sp = [], si = [], NS = 8, NR = 8;
  for (let i = 0; i <= NS; i++) for (let k = 0; k < NR; k++) { const a = k / NR * 6.283; sp.push(i / NS, Math.cos(a), Math.sin(a)); }
  for (let i = 0; i < NS; i++) for (let k = 0; k < NR; k++) { const o = i * NR, k2 = (k + 1) % NR; si.push(o + k, o + NR + k, o + k2, o + k2, o + NR + k, o + NR + k2); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  for (const s of strips) {
    const m = new THREE.Mesh(sg, makeMat({ side: THREE.DoubleSide, uniforms: { uAt: { value: new THREE.Vector3(...s.sock) }, uWind: U.uWind || { value: 0.4 } },
      vs: /* glsl */`uniform vec3 uAt; uniform vec2 uWindDir; uniform float uWind; varying vec3 vW; varying float vT;
        void main(){ float t = position.x, k = clamp(uWind, 0.12, 1.0); vec2 d = normalize(uWindDir + 1e-4);
          float r = mix(0.36, 0.16, t), sway = sin(uTime * 3.0 + t * 4.0) * 0.12 * t;
          vec3 ax = vec3(d.x, 0.0, d.y), sdv = vec3(-d.y, 0.0, d.x);
          vec3 wp = uAt + ax * t * 2.6 * (0.45 + 0.55 * k) + vec3(0.0, -t * t * 2.0 * (1.0 - k), 0.0) + sdv * (position.z * r + sway) + vec3(0.0, position.y * r, 0.0);
          vW = wp; vT = t; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); ${LOGV} }`,
      fs: /* glsl */`varying vec3 vW; varying float vT; void main(){ ${LOGF} vec3 c = mix(vec3(0.95, 0.42, 0.08), vec3(0.95, 0.95, 0.93), step(0.5, fract(vT * 2.5))) * (uLightCol * 0.55 * cloudShadow(vW) + uAmbSky * 0.8); gl_FragColor = vec4(applyFog(c, vW), 1.0); }` }));
    m.frustumCulled = false; scene.add(m);
  }
  // ---- the aircraft
  const mat = objectMat({ side: THREE.DoubleSide }), g = new THREE.Group(), body = new THREE.Mesh(airframe(), mat); body.frustumCulled = false; g.add(body);
  // the propeller: a blurred disc when the engine is running
  const prop = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), makeMat({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uSpin: { value: 0 } },
    vs: /* glsl */`varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; ${LOGV} }`,
    fs: /* glsl */`uniform float uSpin; varying vec2 vP; varying vec3 vW; void main(){ ${LOGF} float r = length(vP), a = atan(vP.y, vP.x) + uTime * 2.0;
      float still = smoothstep(0.09, 0.05, abs(sin(a - uTime * 2.0)) * r) * step(r, 0.98);                 // two blades at rest
      float blur = (0.16 + 0.08 * sin(a * 2.0)) * smoothstep(1.0, 0.9, r) * smoothstep(0.1, 0.2, r);       // a grey haze in flight
      float al = mix(still * 0.95, blur * 0.45, uSpin);             // and the yellow of the tips drawn into a ring
      vec3 c = vec3(0.09) * (uLightCol * 0.5 + uAmbSky); gl_FragColor = vec4(applyFog(c, vW), al); }` }));
  prop.rotation.y = Math.PI / 2; prop.position.set(3.6, 1.02, 0); prop.frustumCulled = false; prop.renderOrder = 14; g.add(prop);
  g.scale.setScalar(S); g.rotation.order = 'YZX'; scene.add(g);
  const p = { kind: 'plane', m: g, x: 0, y: 0, z: 0, hd: 0, v: 0, roll: 0, nose: 0, ctl: null, afloat: false, state: 'park', wait: 12, strip: 0, dir: 1, sp: 52, fpEye: [2.0, 2.05], zoom0: 24, hideInFP: false, next: '' };
  const TOUR = [
    [[find(F.views, /Tangalooma Wrecks/, [-2262, -2174]), 300], [find(F.places, /Desert/, [-1556, 1204]), 340], [find(F.views, /Tempest/, [1232, -4525]), 620], [[5600, 2500], 380], [find(F.sandnames, /Big Sand/, [1555, 10824]), 360], [find(F.sandnames, /Little Sand/, [2310, 13342]), 300]],
    [[[6400, 9000], 340], [find(F.camps, /Blue Lagoon/, [5250, -9974]), 320], [find(F.lights, /Cape/, [7389, -17031]), 380], [find(F.places, /Bulwer/, [-2199, -11783]), 300], [[-3400, -8200], 260]],
  ];
  const NAMES = [['the Tangalooma Wrecks', 'the Desert', 'Mount Tempest', 'the Eastern Beach', 'the Big Sandhills', 'the Little Sandhills'], ['the Eastern Beach', 'Blue Lagoon', 'Cape Moreton', 'Bulwer', 'Cowan Cowan']];
  const stripName = (k) => (strips[k].a[1] > 5000 ? 'Kooringal airstrip' : 'Tangalooma airstrip');
  const GEAR = 0.02, end = (s, d) => (d > 0 ? s.a : s.b), far = (s, d) => (d > 0 ? s.b : s.a);
  // which way to use a strip: the way whose approach comes in over the lower ground
  const bestDir = (s) => { let hi = [0, 0]; [1, -1].forEach((d, k) => { const e = end(s, d); for (let t = 200; t <= 2200; t += 200) hi[k] = Math.max(hi[k], heightAt(e[0] - s.ux * d * t, e[1] - s.uz * d * t)); }); return hi[0] <= hi[1] ? 1 : -1; };
  const place = (k, d) => { const s = strips[k], e = end(s, d); p.x = e[0] + s.ux * d * 25; p.z = e[1] + s.uz * d * 25; p.hd = Math.atan2(-s.uz * d, s.ux * d); p.y = meshY(p.x, p.z) + GEAR; p.v = 0; p.strip = k; p.dir = d; };
  place(0, bestDir(strips[0])); let wp = 0, dest = strips.length > 1 ? 1 : 0, ldir = 1, spin = 0;
  const sea = () => U.uSeaM.value * VEX;
  const clear = (x, z) => { const h = heightAt(x, z); return h < 0.5 ? sea() + 25 : Math.max(sea(), meshY(x, z)) + (maskAt(x, z).sand > 0.8 ? 30 : 70); };
  const steer = (tx, tz, dt, rate) => { let d = Math.atan2(-(tz - p.z), tx - p.x) - p.hd; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); const w = clamp(d * 1.2, -rate, rate); p.hd += w * dt; return w; };
  const update = (dt, t) => {
    if (!(dt > 0)) { g.position.set(p.x, p.y, p.z); g.rotation.set(p.roll, p.hd, p.nose); return; }
    let w = 0, vyT = 0, onGround = false;
    const s = strips[p.strip], gy = meshY(p.x, p.z) + GEAR;
    if (p.ctl) {                         // flown by hand: bank to turn, climb and sink; it can be put down on a strip and taken off again
      const c = p.ctl; if (p.state !== 'hand') { p.state = 'hand'; }
      let near = null; for (const q of strips) { const ax = p.x - q.a[0], az = p.z - q.a[1], al = ax * q.ux + az * q.uz, cr = Math.abs(ax * q.uz - az * q.ux); if (al > -40 && al < q.L + 40 && cr < 28) near = q; }
      const low = p.y - gy < 0.25 && near;
      if (low) { onGround = true; p.v += ((c.climb > 0.2 ? 46 : 0) - p.v) * (1 - Math.exp(-dt * (c.climb > 0.2 ? 0.35 : 0.5))); w = -c.turn * 0.5 * clamp(p.v / 8, 0, 1); p.hd += w * dt; vyT = c.climb > 0.2 && p.v > 30 ? 5 : 0; }
      else { p.v += (p.sp - p.v) * (1 - Math.exp(-dt * 0.5)); w = -c.turn * 0.42; p.hd += w * dt; vyT = c.climb * (7 + Math.max(0, p.y - sea()) * 0.02); }
      p.next = near ? 'over the ' + (near === strips[0] ? stripName(0) : stripName(strips.indexOf(near))) : '';
    } else if (p.state === 'park') {     // engine ticking over at the end of the strip
      onGround = true; p.v *= Math.exp(-dt * 2); p.wait -= dt; p.next = 'waiting at the ' + stripName(p.strip);
      if (p.wait <= 0) { p.state = 'roll'; wp = 0; dest = strips.length > 1 ? 1 - p.strip : p.strip; }
    } else if (p.state === 'roll') {     // the take-off run, straight down the strip
      onGround = true; p.v += 4.2 * dt; const f = far(s, p.dir); w = steer(f[0] + s.ux * p.dir * 400, f[1] + s.uz * p.dir * 400, dt, 0.15); p.next = 'taking off';
      if (p.v > 31) { p.state = 'tour'; onGround = false; p.air = 0; }
    } else if (p.state === 'hand') { p.state = 'tour'; }
    if (!p.ctl && p.state === 'tour') {  // round the island, a place at a time
      const north = strips[p.strip].a[1] < 5000 ? 0 : 1, leg = TOUR[north], q = leg[wp]; p.air = (p.air || 0) + dt; p.v += (p.sp - p.v) * (1 - Math.exp(-dt * 0.3));
      if (!q) { p.state = 'approach'; ldir = bestDir(strips[dest]); }
      else if (p.air < 14) { const f = far(strips[p.strip], p.dir), sq = strips[p.strip]; w = steer(f[0] + sq.ux * p.dir * 900, f[1] + sq.uz * p.dir * 900, dt, 0.1); vyT = 7.5; p.next = 'climbing out'; }
      else { w = steer(q[0][0], q[0][1], dt, 0.2); vyT = clamp((sea() + q[1] - p.y) * 0.2, -5, 6); p.next = 'over ' + (NAMES[north][wp] || 'the island'); if (H(q[0][0] - p.x, q[0][1] - p.z) < 420) wp++; }
    }
    if (!p.ctl && p.state === 'approach') {      // out to a point on the line of the strip, a couple of kilometres short of it
      const d = strips[dest], e = end(d, ldir), fx = e[0] - d.ux * ldir * 2300, fz = e[1] - d.uz * ldir * 2300, alt = meshY(e[0], e[1]) + 230;
      p.v += (46 - p.v) * (1 - Math.exp(-dt * 0.3)); w = steer(fx, fz, dt, 0.22); vyT = clamp((alt - p.y) * 0.2, -6, 5); p.next = 'joining for the ' + stripName(dest);
      if (H(fx - p.x, fz - p.z) < 380) { p.state = 'final'; p.strip = dest; p.dir = ldir; }
    } else if (!p.ctl && p.state === 'final') {  // down the line of the strip: aim at a point on the centre line a little way ahead, sink steadily to the threshold
      const e = end(s, p.dir), ax = p.x - e[0], az = p.z - e[1], al = (ax * s.ux + az * s.uz) * p.dir, aim = al + (al > -700 ? 170 : 320), ty = meshY(e[0], e[1]) + GEAR;
      w = steer(e[0] + s.ux * p.dir * aim, e[1] + s.uz * p.dir * aim, dt, 0.38); p.v += ((al > -500 ? 33 : 40) - p.v) * (1 - Math.exp(-dt * 0.5));
      const want = al < 0 ? ty + Math.max(0, -al - 30) * 0.1 : gy; vyT = clamp((want - p.y) * 0.9, p.y - gy < 7 ? -1.6 : -7, 3);        // it eases off the sink just above the ground: a flare p.next = 'on final for the ' + stripName(p.strip);
      if (al > -10 && p.y - gy < 0.6) { p.state = 'rollout'; onGround = true; }
    } else if (!p.ctl && p.state === 'rollout') {      // wheels on: slow down, turn round at the far end, and wait
      onGround = true; const f = far(s, p.dir), e = end(s, p.dir), al = ((p.x - e[0]) * s.ux + (p.z - e[1]) * s.uz) * p.dir + 90; p.v = Math.max(0, p.v - 2.6 * dt); w = steer(e[0] + s.ux * p.dir * al, e[1] + s.uz * p.dir * al, dt, 0.25); p.next = 'landed at the ' + stripName(p.strip);
      const left = H(f[0] - p.x, f[1] - p.z);
      if (p.v < 6 || left < 60) { p.v = Math.min(p.v, 5); p.state = 'turn'; p.dir = -p.dir; }
    } else if (!p.ctl && p.state === 'turn') {
      onGround = true; const f = far(s, p.dir); p.v += (3.5 - p.v) * (1 - Math.exp(-dt * 2)); w = steer(f[0], f[1], dt, 0.6); let d = Math.atan2(-s.uz * p.dir, s.ux * p.dir) - p.hd; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); p.next = 'turning round';
      if (Math.abs(d) < 0.05) { p.state = 'park'; p.wait = 25; }
    }
    p.x += Math.cos(p.hd) * p.v * dt; p.z -= Math.sin(p.hd) * p.v * dt;
    p.x = clamp(p.x, -T.sx / 2 + 300, T.sx / 2 - 300); p.z = clamp(p.z, -T.sz / 2 + 300, T.sz / 2 - 300);
    const g2 = meshY(p.x, p.z) + GEAR;
    if (onGround) { p.vy = 0; p.y += (Math.max(g2, p.y + vyT * dt) - p.y) * 1; if (vyT <= 0) p.y = g2; }
    else {
      p.vy = (p.vy ?? 0) + (vyT - (p.vy ?? 0)) * (1 - Math.exp(-dt * 1.2)); p.y += p.vy * dt;
      // never into the ground or the trees: it looks ahead and is lifted over what is coming (not on final, where it is meant to come down)
      if (p.state !== 'final' && p.state !== 'rollout' && !(p.state === 'tour' && p.air < 14)) { const cs = Math.cos(p.hd), sn = Math.sin(p.hd), fl = Math.max(clear(p.x, p.z), clear(p.x + cs * p.v * 3, p.z - sn * p.v * 3), clear(p.x + cs * p.v * 7, p.z - sn * p.v * 7)); p.fl = (p.fl ?? fl) + (fl - (p.fl ?? fl)) * (1 - Math.exp(-dt * (fl > (p.fl ?? fl) ? 2.5 : 0.6)));
        const hand = !!p.ctl; let nearStrip = false; if (hand) for (const q of strips) { const ax = p.x - q.a[0], az = p.z - q.a[1], al = ax * q.ux + az * q.uz, cr = Math.abs(ax * q.uz - az * q.ux); if (al > -900 && al < q.L + 900 && cr < 120) nearStrip = true; }
        if (!nearStrip && p.y < p.fl) { p.y += (p.fl - p.y) * (1 - Math.exp(-dt * 1.0)); p.vy = Math.max(p.vy, 0); } }
      p.y = Math.max(p.y, g2); p.y = Math.min(p.y, sea() + 1500);
    }
    p.roll += (clamp(-w * 1.9, -0.6, 0.6) * (onGround ? 0 : 1) - p.roll) * (1 - Math.exp(-dt * 2.2));
    p.nose += ((onGround ? (p.state === 'roll' && p.v > 26 ? 0.07 : 0) : clamp((p.vy ?? 0) * 0.022, -0.16, 0.2)) - p.nose) * (1 - Math.exp(-dt * 2));
    spin += ((p.state === 'park' && p.wait > 6 ? 0.0 : 1) - spin) * (1 - Math.exp(-dt * 0.8)); prop.material.uniforms.uSpin.value = spin;
    g.position.set(p.x, p.y, p.z); g.rotation.set(p.roll, p.hd, p.nose);
  };
  update(0, 0);
  return { planes: [p], update, strips };
}

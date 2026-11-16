// The traveller: someone with a pack on their back and a tent, walking the whole island along the tracks and the beaches, to every township,
// camping area, lookout and named place in turn. At night (or when you ask) they pitch the tent and rest. You can go along, or walk them yourself.
import * as THREE from 'three';
import { U, VEX, Q, makeMat, LOGV, LOGF, clamp } from './common.js';
import { T, meshY, heightAt } from './terrain.js';
import { figure, trackGraph, shortest, PERSON_FS } from './folk.js';
import { PERSON_POSE } from './bodies.js';
import { probe } from './drive.js';

export function buildTraveller(scene, F) {
  const H = Math.hypot, f = figure();
  // the pack: a tall bag on the back with a rolled mat on top and a water bottle at the side (part 5), a walking pole in the hand (part 6)
  const S = 6, add = (st, pt, sw) => {
    const base = f.pos.length / 3, n = st.length;
    st.forEach((c, i) => {
      const a = st[Math.min(n - 1, i + 1)], b = st[Math.max(0, i - 1)]; let t = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const l = H(...t) || 1; t = t.map(v => v / l);
      const ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; let sd = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]]; const sl = H(...sd) || 1; sd = sd.map(v => v / sl);
      const up = [sd[1] * t[2] - sd[2] * t[1], sd[2] * t[0] - sd[0] * t[2], sd[0] * t[1] - sd[1] * t[0]];
      for (let j = 0; j < S; j++) { const an = j / S * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), nx = sd[0] * ca + up[0] * sa, ny = sd[1] * ca + up[1] * sa, nz = sd[2] * ca + up[2] * sa; f.pos.push(c[0] + nx * c[3] * (c[4] || 1), c[1] + ny * c[3], c[2] + nz * c[3] * (c[5] || 1)); f.nrm.push(nx, ny, nz); f.part.push(pt); f.swing.push(sw ? sw(c[1]) : 0); }
    });
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < S; j++) { const q = base + i * S, j2 = (j + 1) % S; f.idx.push(q + j, q + S + j, q + j2, q + j2, q + S + j, q + S + j2); }
  };
  // drop the fishing rod the stock figure carries (part 4): fold it to nothing
  for (let i = 0; i < f.part.length; i++) if (f.part[i] === 4) { f.pos[i * 3] = 0; f.pos[i * 3 + 1] = 1; f.pos[i * 3 + 2] = 0; }
  add([[-0.2, 0.86, 0, 0.05], [-0.25, 0.95, 0, 0.17], [-0.27, 1.25, 0, 0.19], [-0.25, 1.5, 0, 0.16], [-0.2, 1.6, 0, 0.05]], 5);          // the bag
  add([[-0.24, 1.66, -0.24, 0.02], [-0.24, 1.66, -0.2, 0.085], [-0.24, 1.66, 0.2, 0.085], [-0.24, 1.66, 0.24, 0.02]], 7);                   // rolled sleeping mat across the top
  add([[-0.2, 1.0, 0.22, 0.02], [-0.2, 1.04, 0.22, 0.05], [-0.2, 1.22, 0.22, 0.05], [-0.2, 1.27, 0.22, 0.025]], 8);                        // water bottle
  add([[0.12, 1.02, -0.235, 0.014], [0.1, 0.5, -0.235, 0.012], [0.08, 0.02, -0.235, 0.008]], 6, (y) => 0.02 + Math.max(0, 1.42 - y) / 0.55);     // walking pole, swinging with the hand that holds it
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(f.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(f.nrm, 3));
  g.setAttribute('aPS', new THREE.Float32BufferAttribute(f.part.flatMap((p, i) => [p, f.swing[i]]), 2)); g.setIndex(f.idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const uni = { uAt: { value: new THREE.Vector4() }, uGait: { value: new THREE.Vector3() } };
  const mesh = new THREE.Mesh(g, makeMat({ uniforms: uni,
    // uAt: where they stand (x, y, z) and the way they face; uGait: stride phase, how much they are walking (0..1), how far sat down (0..1)
    vs: /* glsl */`attribute vec2 aPS; uniform vec4 uAt; uniform vec3 uGait; varying vec3 vW, vObj, vNw, vShirt; varying float vPart, vSeed;
      ${PERSON_POSE}
      void main(){
        float part = aPS.x, sit = uGait.z;
        vec3 lp = personPose(position, aPS, uGait.x, uGait.y, 0.0);
        // sat down beside the tent: the body low, the knees up, the pack off and set down beside
        lp.y -= sit * 0.52 * smoothstep(0.2, 0.95, position.y) + sit * 0.08;
        lp.x += sit * 0.22 * (1.0 - smoothstep(0.3, 0.95, position.y)) * (step(0.5, part) * step(part, 1.5) + step(9.5, part) * step(part, 10.5));
        if((part > 4.5 && part < 5.5) || (part > 6.5 && part < 8.5)) lp = mix(lp, vec3(-0.75, 0.2 + (position.y - 0.9) * 0.25, position.z + 0.5), sit);
        vec2 d = vec2(cos(uAt.w), -sin(uAt.w)), sd = vec2(-d.y, d.x);
        lp *= 0.97;
        vec3 wp = vec3(uAt.x + d.x * lp.x + sd.x * lp.z, uAt.y + lp.y, uAt.z + d.y * lp.x + sd.y * lp.z);
        vNw = normalize(vec3(d.x * normal.x + sd.x * normal.z, normal.y, d.y * normal.x + sd.y * normal.z));
        vObj = position; vPart = part; vSeed = 0.137; vShirt = vec3(0.62, 0.2, 0.11); vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        ${LOGV}
      }`,
    fs: PERSON_FS, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.name = 'traveller'; scene.add(mesh);
  // the tent: a low dome on two crossed poles, with a porch and a door flap; it stands only while they are camped
  const tp = [], tn = [], tc = [], ti = [], NA = 14, NB = 7, R0 = 0.8, HT = 1.05, COL = [0.85, 0.5, 0.12], FLY = [0.25, 0.32, 0.2];
  for (let j = 0; j <= NB; j++) for (let i = 0; i <= NA; i++) {
    const a = i / NA * Math.PI * 2, e = j / NB * Math.PI / 2, r = R0 * Math.cos(e) * (1 + 0.1 * Math.cos(a * 2)) * (1 + 0.25 * Math.max(0, Math.cos(a)) * (1 - j / NB)), y = HT * Math.sin(e);
    tp.push(Math.cos(a) * r * 1.2, y, Math.sin(a) * r); tn.push(Math.cos(a) * Math.cos(e), Math.sin(e) + 0.2, Math.sin(a) * Math.cos(e));
    const seam = Math.abs(((i + 0.5) % (NA / 4)) - NA / 8) < 0.6, door = Math.abs(a) < 0.5 || Math.abs(a - Math.PI * 2) < 0.5; tc.push(...(door && j < NB - 2 ? [0.1, 0.12, 0.1] : seam ? FLY : COL));
  }
  for (let j = 0; j < NB; j++) for (let i = 0; i < NA; i++) { const o = j * (NA + 1) + i; ti.push(o, o + NA + 1, o + 1, o + 1, o + NA + 1, o + NA + 2); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); tg.setIndex(ti);
  const tent = new THREE.Mesh(tg, makeMat({ side: THREE.DoubleSide,
    vs: /* glsl */`attribute vec3 color; varying vec3 vCol, vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec3 n = normalize(mat3(modelMatrix) * normal);
      vCol = color * (uLightCol * (max(dot(n, uLightDir), 0.0) * 0.75 + 0.15) * cloudShadow(w.xyz) + mix(uAmbGnd, uAmbSky, n.y * 0.5 + 0.5)) + color * vec3(1.0, 0.75, 0.4) * uNight * 0.5 * step(0.3, color.r); vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w; ${LOGV} }`,
    fs: /* glsl */`varying vec3 vCol, vW; void main(){ ${LOGF} gl_FragColor = vec4(applyFog(vCol, vW), 1.0); }` }));
  tent.frustumCulled = false; tent.visible = false; scene.add(tent);

  // ---- the route: every named place that lies near a track or a beach, taken nearest-first along the network
  const net = trackGraph(F), pois = [];
  const addPoi = (name, p) => { if (!name || !p) return; let best = null, bd = 900; for (const n of net) { const d = H(n.p[0] - p[0], n.p[1] - p[1]); if (d < bd) { bd = d; best = n; } } if (best && !pois.some(q => q.node === best || H(q.p[0] - p[0], q.p[1] - p[1]) < 120)) pois.push({ name, node: best, p, seen: false }); };
  for (const q of F.places || []) addPoi(q.n, q.p);
  for (const q of F.camps || []) addPoi(q.n, q.p);
  for (const q of F.views || []) addPoi(q.n === 'Ship Wrecks' ? 'Bulwer Wrecks' : q.n, q.c || q.p);
  for (const q of F.lights || []) addPoi(q.n, q.p);
  for (const q of F.sandnames || []) addPoi(q.n, q.p);
  for (const q of F.peaks || []) addPoi(q.n, q.p);
  for (const q of F.misc || []) addPoi(q.n, q.p);
  for (const q of F.lakes || []) if (q.n) addPoi(q.n, q.c || (Array.isArray(q.p[0]) ? q.p[0] : q.p));
  // they set out from a different place each time the map is opened (test pictures always start them at Tangalooma)
  const start = (Q.has('shot') ? pois.find(q => /Tangalooma$/.test(q.name)) : pois[(Math.random() * pois.length) | 0]) || pois[0];
  const w = { kind: 'walker', m: new THREE.Object3D(), x: 0, y: 0, z: 0, hd: 0, v: 0, ctl: null, afloat: false, camped: false, askCamp: null, sp: 1.8, fpEye: [0.15, 1.62], zoom0: 6.5, next: '', visited: 0, total: pois.length, pois };
  let at = start ? start.node : net[0], to = null, goal = null, route = null, phase = 0, sit = 0, walk = 0, rest = 0;
  if (at) { w.x = at.p[0]; w.z = at.p[1]; }
  const pickGoal = () => {             // the nearest place not yet visited, by the tracks; when all are done, start the round again
    if (!pois.some(q => !q.seen)) { for (const q of pois) q.seen = false; w.visited = 0; }
    const sh = shortest(net, at); let best = null, bd = Infinity; for (const q of pois) if (!q.seen) { const d = q.node === at ? 0 : sh.dist[q.node.i]; if (d < bd) { bd = d; best = q; } }
    if (!best || bd === Infinity) { best = pois.find(q => !q.seen); if (best) { best.seen = true; w.visited++; } return pickGoal0(); }
    goal = best; route = shortest(net, goal.node);
  };
  const pickGoal0 = () => { if (pois.some(q => !q.seen)) pickGoal(); };
  const nextNode = () => {             // from here, the neighbour that leads most directly to the goal
    if (!goal || at === goal.node) return null; let best = null, bd = Infinity; for (const e of at.e) { const d = e.d + (e.to === goal.node ? 0 : route.dist[e.to.i]); if (d < bd) { bd = d; best = e.to; } } return best;
  };
  const sea = () => U.uSeaM.value * VEX;
  const update = (dt, t) => {
    if (!at) return;
    const night = U.uNight ? U.uNight.value : 0;
    // Camp when asked, and break camp when asked: the tent comes down at once and they walk on, even in the dark (they will not pitch it again
    // by themselves until the next evening). Left alone, they stop when it gets dark and are up with the light.
    if (w.askCamp !== null) { w.camped = w.askCamp; w.askCamp = null; rest = w.camped ? 1e9 : 0; if (w.camped) pitch(); else { tent.visible = false; w.nightOwl = night > 0.3; } }
    if (night < 0.3) w.nightOwl = false;
    if (!w.ctl && !w.camped && !w.nightOwl && night > 0.8) { w.camped = true; rest = 0; pitch(); }
    if (w.camped && rest < 1e8 && night < 0.3) { w.camped = false; tent.visible = false; }
    let want = 0;
    if (w.camped) { w.v += (0 - w.v) * (1 - Math.exp(-dt * 4)); w.next = 'camped' + (goal ? ' on the way to ' + goal.name : ''); }
    else if (w.ctl) {                  // walked by hand: turn, and set the pace from a stroll to a jog; no wading past the knees
      const c = w.ctl; w.hd -= c.turn * 1.6 * dt; w.pace = clamp((w.pace ?? 1.5) + c.climb * 1.6 * dt, 0, 4.2); want = w.pace * (c.pace ?? 1);
      const nx = w.x + Math.cos(w.hd) * want * dt, nz = w.z - Math.sin(w.hd) * want * dt;
      if (!probe.hit(nx + Math.cos(w.hd) * 0.35, nz - Math.sin(w.hd) * 0.35, 0.3, true) && heightAt(nx, nz) > U.uSeaM.value - 0.5 && Math.abs(nx) < T.sx / 2 - 100 && Math.abs(nz) < T.sz / 2 - 100) { w.x = nx; w.z = nz; w.v += (want - w.v) * (1 - Math.exp(-dt * 4)); } else w.v *= Math.exp(-dt * 6);
      to = null; w.next = 'walking free';
    } else {
      if (!goal) pickGoal();
      if (!to) {                        // rejoin the network at the nearest point of it if they have been led off it
        let near = at, nd = H(at.p[0] - w.x, at.p[1] - w.z); if (nd > 30) for (const n of net) { const d = H(n.p[0] - w.x, n.p[1] - w.z); if (d < nd) { nd = d; near = n; } }
        if (near !== at) { at = near; if (goal) route = shortest(net, goal.node); }
        if (nd > 4 + w.v * dt * 2) to = at; else { if (goal && at === goal.node) { goal.seen = true; w.visited++; w.arrived = goal.name; pickGoal(); } to = nextNode(); if (!to) { goal = null; return; } }
      }
      const dx = to.p[0] - w.x, dz = to.p[1] - w.z, dl = H(dx, dz);
      if (dl < Math.max(0.35, w.v * dt * 1.2)) { at = to; to = null; }
      else { let d = Math.atan2(-dz, dx) - w.hd; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
        const side = probe.way(w.x, w.z, w.hd);          // a trunk, a big bush or a log ahead: they turn aside and walk round it, then pick up their way again
        if (side) w.hd += side * 2.4 * dt; else w.hd += clamp(d * (1 - Math.exp(-dt * 3.5)), -2.2 * dt, 2.2 * dt); want = w.sp * (side ? 0.6 : clamp(1.3 - Math.abs(d), 0.25, 1));
        w.v += (want - w.v) * (1 - Math.exp(-dt * 3)); w.x += Math.cos(w.hd) * w.v * dt; w.z -= Math.sin(w.hd) * w.v * dt; }
      w.next = goal ? 'to ' + goal.name + ' · ' + (Math.max(0, (at === goal.node ? 0 : route.dist[at.i]) + (to ? dl : 0)) / 1000).toFixed(1) + ' km · ' + w.visited + ' of ' + w.total + ' places' : '';
    }
    w.y = Math.max(meshY(w.x, w.z), sea() - 0.8);
    phase += w.v * dt * 3.4; walk += (clamp(w.v / 1.2, 0, 1) - walk) * (1 - Math.exp(-dt * 5)); sit += ((w.camped ? 1 : 0) - sit) * (1 - Math.exp(-dt * 1.5));
    if (!w.camped) tent.visible = false;
    w.m.position.set(w.x, w.y, w.z); w.m.rotation.y = w.hd;
    uni.uAt.value.set(w.x, w.y, w.z, w.hd); uni.uGait.value.set(phase, walk, sit);
  };
  const pitch = () => { const a = w.hd + 1.9, tx = w.x + Math.cos(a) * 2.1, tz = w.z - Math.sin(a) * 2.1; tent.position.set(tx, meshY(tx, tz) - 0.03, tz); tent.rotation.y = w.hd + 1.2; tent.visible = true; };
  update(0, 0);
  return { walkers: at ? [w] : [], update, tent, show: (v) => { mesh.visible = v; } };
}

// The people aboard: someone sits in every 4WD, on every jet ski and in the plane, and stands at the helm of every boat. Whoever is in the
// vehicle you are in can get out at any time (the Get out button, or G):
//   - out of a 4WD, or a plane that is on the ground, they stand beside it and walk where you steer them (round trees, big bushes and logs)
//   - out of a boat or off a jet ski they are in the water: treading water while still, swimming when they move, wading out where it shallows
//   - out of a plane in flight they fall, and do not get up again
import * as THREE from 'three';
import { U, VEX, makeMat, LOGV, rng, clamp } from './common.js';
import { T, meshY, heightAt } from './terrain.js';
import { figure, PERSON_FS } from './folk.js';
import { PERSON_POSE } from './bodies.js';
import { probe } from './drive.js';

let GEO = null;
function geo() {
  if (GEO) return GEO;
  const f = figure(); for (let i = 0; i < f.part.length; i++) if (f.part[i] === 4) { f.pos[i * 3] = 0; f.pos[i * 3 + 1] = 1; f.pos[i * 3 + 2] = 0; }      // (no fishing rod)
  const g = GEO = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(f.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(f.nrm, 3));
  g.setAttribute('aPS', new THREE.Float32BufferAttribute(f.part.flatMap((p, i) => [p, f.swing[i]]), 2)); g.setIndex(f.idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
// uAt: where the feet are (x, y, z) and the way they face. uGait: stride phase, how much the limbs swing, sat (1) or standing easy (below 0).
// uPose: x laid forward and level (swimming, falling), y laid on the back (lying still), z rolled about the way they face, w size.
const VS = /* glsl */`attribute vec2 aPS; uniform vec4 uAt, uPose; uniform vec3 uGait, uShirtC; uniform float uSeedP; varying vec3 vW, vObj, vNw, vShirt; varying float vPart, vSeed;
  ${PERSON_POSE}
  void main(){
    vec3 lp = personPose(position, aPS, uGait.x, uGait.y, uGait.z), n = normal;
    float a = uPose.x * 1.4 - uPose.y * 1.52, ca = cos(a), sa = sin(a); vec2 q = vec2(lp.x, lp.y - 1.0);
    lp.x = q.x * ca + q.y * sa; lp.y = -q.x * sa + q.y * ca + 1.0; n.xy = vec2(n.x * ca + n.y * sa, -n.x * sa + n.y * ca);
    float cr = cos(uPose.z), sr = sin(uPose.z); q = vec2(lp.y - 1.0, lp.z); lp.y = q.x * cr - q.y * sr + 1.0; lp.z = q.x * sr + q.y * cr; n.yz = vec2(n.y * cr - n.z * sr, n.y * sr + n.z * cr);
    lp *= 0.97 * uPose.w;
    vec2 d = vec2(cos(uAt.w), -sin(uAt.w)), sd = vec2(-d.y, d.x);
    vec3 wp = vec3(uAt.x + d.x * lp.x + sd.x * lp.z, uAt.y + lp.y, uAt.z + d.y * lp.x + sd.y * lp.z);
    vNw = normalize(vec3(d.x * n.x + sd.x * n.z, n.y, d.y * n.x + sd.y * n.z));
    vObj = position; vPart = aPS.x; vSeed = uSeedP; vShirt = uShirtC; vW = wp;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    ${LOGV}
  }`;
function person(scene, shirt, seed) {
  const uni = { uAt: { value: new THREE.Vector4() }, uGait: { value: new THREE.Vector3() }, uPose: { value: new THREE.Vector4(0, 0, 0, 1) }, uShirtC: { value: new THREE.Vector3(...shirt) }, uSeedP: { value: seed } };
  const mesh = new THREE.Mesh(geo(), makeMat({ uniforms: uni, vs: VS, fs: PERSON_FS, side: THREE.DoubleSide })); mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  return { mesh, uni };
}
const SHIRTS = [[.62, .2, .11], [.13, .3, .5], [.85, .8, .7], [.2, .45, .3], [.8, .62, .15], [.42, .2, .45], [.1, .12, .15], [.75, .35, .3]];

// o.cars: the 4WDs; o.boats(): the boats; o.planes(): the planes; o.ride: the ride (see ride.js)
export function buildAboard(scene, o) {
  const R = rng(2468), v = new THREE.Vector3(), riders = [], sea = () => U.uSeaM.value * VEX;
  const seatOf = (veh, kind) => {
    // (the vehicles are drawn about half as big again as life, so the people in them are a little over life size too)
    const Z = 1.2, k = veh.m.scale.x || 1;
    if (kind === 'car') return { at: [0.25, 0.38, 0.42], sit: 1, size: Z };                                      // the driver, on the right
    if (kind === 'plane') { const e = veh.fpEye || [2, 2]; return { at: [e[0] - 0.1, e[1] - 1.22 * Z / k, 0], sit: 1, size: Z }; }      // the pilot: head where the view from the cockpit is taken
    if (veh.jet) return { at: [-0.85, 0.4, 0], sit: 1, size: Z };                                               // astride the saddle
    const e = veh.eye || [-3, 3];
    return { at: [e[0], e[1] - 1.62 * Z / k, e[2] || 0], sit: -0.37, size: Z };                                  // standing at the helm: head where the view from the helm is taken
  };
  const add = (veh, kind) => { const sh = SHIRTS[(R() * SHIRTS.length) | 0], p = person(scene, sh, R()); riders.push({ veh, kind, p, seat: seatOf(veh, kind), sh }); veh.rider = riders[riders.length - 1]; };
  for (const c of o.cars) add(c, 'car');
  for (const b of o.boats()) if (b.move && !b.ferry && !b.big) add(b, 'boat');
  for (const p of o.planes()) add(p, 'plane');

  // ---- you, once out of a vehicle ----
  const me = person(scene, SHIRTS[0], 0.5);
  const av = { kind: 'person', m: new THREE.Object3D(), x: 0, y: 0, z: 0, hd: 0, v: 0, vy: 0, ctl: null, afloat: false, sp: 1.6, pace: 0, fpEye: [0.15, 1.62], zoom0: 6.5, next: '', on: false, state: 'walk', from: null, dead: 0 };
  let phase = 0, swing = 0, flat = 0, back = 0, roll = 0, vx = 0, vz = 0, bob = 0;
  const depth = (x, z) => U.uSeaM.value - heightAt(x, z);                    // metres of water over the ground (below 0: dry land)
  function despawn() {            // they are back aboard, or gone: the vehicle has its driver again, and a car left standing goes on its way
    if (!av.on) return; av.on = false; me.mesh.visible = false; av.ctl = null;
    if (av.from) { av.from.empty = false; if (av.from.setDrive && av.from.parked) av.from.setDrive(false); av.from = null; }
  }
  // out of this vehicle (kind: car, boat or plane)
  function leave(veh, kind) {
    if (av.on) despawn();
    const m = veh.m, yaw = veh.hd ?? m.rotation.y, fx = Math.cos(yaw), fz = -Math.sin(yaw), rx = -fz, rz = fx, side = kind === 'car' ? 2.3 : kind === 'boat' ? Math.max(2.2, (veh.len || 8) * 0.22) : 0;
    let sd = 1; if (kind === 'car' && probe.hit(m.position.x + rx * side, m.position.z + rz * side, 0.4, true)) sd = -1;
    av.x = m.position.x + rx * side * sd; av.z = m.position.z + rz * side * sd; av.hd = yaw; av.v = 0; av.vy = 0; av.pace = 0; av.autoGo = false; av.dead = 0; av.next = ''; av.on = true; av.from = veh; veh.empty = true;
    me.uni.uShirtC.value.set(...(veh.rider ? veh.rider.sh : SHIRTS[0])); phase = swing = flat = back = roll = 0;
    const gy = Math.max(meshY(av.x, av.z), sea());
    if (kind === 'plane' && m.position.y > gy + 3) { av.state = 'fall'; av.x = m.position.x; av.z = m.position.z; av.y = m.position.y - 1; vx = fx * (veh.v || 0); vz = fz * (veh.v || 0); flat = 1; }
    else { av.state = depth(av.x, av.z) > 1.2 ? 'swim' : 'walk'; av.y = av.state === 'swim' ? sea() - 1.36 : meshY(av.x, av.z); vx = vz = 0; }
    if (veh.setDrive) { veh.drive = null; veh.parked = true; }
    return av;
  }
  // set down at a spot on the map, facing hd (a click on the ground)
  function place(x, z, hd) {
    if (av.on) despawn();
    av.x = x; av.z = z; av.hd = hd; av.v = 0; av.vy = 0; av.pace = 0; av.autoGo = false; av.dead = 0; av.next = ''; av.on = true; av.from = null; phase = swing = flat = back = roll = 0; vx = vz = 0;
    av.state = depth(x, z) > 1.2 ? 'swim' : 'walk'; av.y = av.state === 'swim' ? sea() - 1.36 : meshY(x, z); me.uni.uShirtC.value.set(...SHIRTS[0]);
    return av;
  }
  function stepMe(dt, t) {
    const c = av.ctl, k = (r) => 1 - Math.exp(-dt * r);
    if (av.state === 'fall') {
      av.vy = Math.max(av.vy - 9.8 * VEX * dt, -56 * VEX); vx *= Math.exp(-dt * 0.5); vz *= Math.exp(-dt * 0.5); av.x += vx * dt; av.z += vz * dt; av.y += av.vy * dt; av.v = Math.hypot(vx, vz, av.vy / VEX);
      roll += dt * 1.1; av.hd += dt * 0.5; phase += dt * 3; swing += (1.3 - swing) * k(3); flat += (1 - flat) * k(3); av.next = 'falling';
      const wet = depth(av.x, av.z) > 1, gy = wet ? sea() - 1.0 : meshY(av.x, av.z) - 0.86;
      if (av.y <= gy) { av.y = gy; av.state = 'dead'; av.dead = 0.001; av.v = 0; av.ctl = null; av.wet = wet; av.next = 'fell to their death'; }
    } else if (av.state === 'dead') {
      av.dead += dt; roll += (0 - (roll % 6.2832)) * k(6); swing += (0 - swing) * k(4);
      if (av.wet) { flat += (1 - flat) * k(4); back += (0 - back) * k(4); av.y = sea() - 1.0 + Math.sin(t * 1.3) * 0.04; } else { flat += (0 - flat) * k(8); back += (1 - back) * k(8); }
    } else {
      if (c) { av.hd -= c.turn * 1.9 * dt; const to = c.go || av.autoGo ? (c.speed || 1.7) : 0; av.pace += (to - av.pace) * k(to > av.pace ? 3.5 : 7); /* walking or not, at the speed chosen in the box (Shift goes faster still): it picks up and stops in a step or two */ }
      const d = depth(av.x, av.z), swim = av.state === 'swim';
      if (!swim && d > 1.25) av.state = 'swim'; else if (swim && d < 0.95) av.state = 'walk';
      const want = (c ? av.pace * (c.pace ?? 1) : 0) * (swim ? 0.42 : 1), nx = av.x + Math.cos(av.hd) * want * dt, nz = av.z - Math.sin(av.hd) * want * dt;
      const blocked = !swim && probe.hit(nx + Math.cos(av.hd) * 0.35, nz - Math.sin(av.hd) * 0.35, 0.3, true);
      if (!blocked && Math.abs(nx) < T.sx / 2 - 100 && Math.abs(nz) < T.sz / 2 - 100) { av.x = nx; av.z = nz; av.v += (want - av.v) * k(4); } else av.v *= Math.exp(-dt * 6);
      if (swim) {              // level and stroking while they move; upright and treading water while they are still
        const go = clamp(av.v / 0.5, 0, 1); flat += (go - flat) * k(2.5); swing += ((0.45 + 0.7 * go) - swing) * k(3); phase += dt * (2.4 + 3.4 * go); bob = Math.sin(t * 1.9) * 0.05;
        av.y += (sea() - 1.36 + 0.2 * flat + bob - av.y) * k(5); av.next = go > 0.3 ? 'swimming' : 'treading water'; av.afloat = true;
      } else { flat += (0 - flat) * k(4); swing += (clamp(av.v / 1.2, 0, 1) - swing) * k(5); phase += av.v * dt * 3.4; av.y = Math.max(meshY(av.x, av.z), sea() - 1.3); av.next = av.v > 2.6 ? 'running' : av.v > 0.2 ? 'walking' : 'standing'; av.afloat = false; }
      back += (0 - back) * k(4); roll = 0;
    }
    av.m.position.set(av.x, av.y, av.z); av.m.rotation.y = av.hd; me.mesh.visible = av.m.visible;
    me.uni.uAt.value.set(av.x, av.y, av.z, av.hd); me.uni.uGait.value.set(phase, swing, av.state === 'walk' && av.v < 0.1 ? -0.37 : 0); me.uni.uPose.value.set(flat, back, av.state === 'fall' ? roll : 0, 1);
  }
  return {
    av, riders, leave, place, despawn,
    update(dt, t, target) {
      const rd = o.ride;
      for (const r of riders) {
        const m = r.veh.m, near = Math.hypot(m.position.x - target.x, m.position.z - target.z) < 700;
        const inside = rd.active && (rd.car === r.veh || rd.boat === r.veh || rd.bird === r.veh) && rd.zoom < 1;      // looking out through their eyes: no body in the way
        const show = near && m.visible && !r.veh.empty && !inside; r.p.mesh.visible = show; if (!show) continue;
        m.updateMatrixWorld(); v.set(r.seat.at[0], r.seat.at[1], r.seat.at[2]).applyMatrix4(m.matrixWorld);
        r.p.uni.uAt.value.set(v.x, v.y, v.z, r.veh.hd ?? m.rotation.y); r.p.uni.uGait.value.set(0, 0, r.seat.sit); r.p.uni.uPose.value.w = r.seat.size;
      }
      if (av.on) stepMe(dt, t); else me.mesh.visible = false;
    },
  };
}

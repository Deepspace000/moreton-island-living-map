// First-person walking: keyboard + mouse, touch or a gamepad.
// Touch: a finger on the view walks forward for as long as it is down (slide sideways = steer, far up = run);
// two fingers down = stand still and drag to look around.
import * as THREE from 'three';
import { U, VEX, clamp } from './common.js';
import { meshY, T } from './terrain.js';
import { probe, OPT } from './drive.js';
import { waveAt } from './water.js';

const EYE = 1.72 * VEX;
export function makeWalk(camera, canvas) {
  const W = { active: false, pos: new THREE.Vector3(), yaw: 0, pitch: -0.05, vy: 0, air: false, swim: false, dive: 0, under: false, speed: 0, onExit: null };
  const keys = new Set();
  let bob = 0, feet = 0, anchor = null, tf = 0, tfGoal = 0, tTurn = 0, tRun = 0;
  const fingers = new Map();                 // touch id -> last position
  const stick = document.getElementById('stick'), knob = stick?.firstElementChild;
  const stickR = () => clamp(Math.min(innerWidth, innerHeight) * 0.2, 60, 110);
  // walking finger: its offset from where it pressed (px, up is positive) sets the turn rate; a long push up runs
  const steer = (dx, dy) => {
    const R = stickR(), m = clamp(dx / R, -1, 1), n = clamp(dy / R, -1, 1);
    tfGoal = 1;
    tTurn = Math.sign(m) * (Math.max(0, Math.abs(m) - 0.12) / 0.88) ** 1.5 * 2.2;
    tRun = Math.max(0, n - 0.5) / 0.5;
    if (knob) knob.style.transform = `translate(${m * R}px, ${-n * R}px)`;
  };
  const stand = () => { anchor = null; tfGoal = tTurn = tRun = 0; if (stick) stick.style.display = 'none'; };
  const walkWith = (id, x, y) => {
    anchor = { id, x, y }; steer(0, 0);
    if (stick) stick.style.cssText = `display:block; left:${x}px; top:${y}px; --r:${stickR()}px`;
  };
  const look = (dx, dy, k) => { W.yaw += dx * k * OPT.invX; W.pitch = clamp(W.pitch - dy * k * OPT.invY, -1.5, 1.5); };
  addEventListener('keydown', (e) => { if (!W.active) return; keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  document.addEventListener('mousemove', (e) => { if (W.active && document.pointerLockElement === canvas) look(e.movementX, e.movementY, 0.0021); });
  canvas.addEventListener('click', () => { if (W.active && document.pointerLockElement !== canvas && matchMedia('(pointer: fine)').matches) canvas.requestPointerLock?.(); });
  // one finger anywhere on the view walks forward; with two fingers down you stand still and drag to look around
  canvas.addEventListener('touchstart', (e) => {
    if (!W.active) return; e.preventDefault();
    for (const t of e.changedTouches) fingers.set(t.identifier, { x: t.clientX, y: t.clientY });
    const t = e.changedTouches[0];
    if (fingers.size === 1) walkWith(t.identifier, t.clientX, t.clientY); else stand();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!W.active) return; e.preventDefault();
    for (const t of e.changedTouches) {
      const p = fingers.get(t.identifier); if (!p) continue;
      if (anchor && anchor.id === t.identifier) steer(t.clientX - anchor.x, anchor.y - t.clientY);
      else if (fingers.size > 1) look(t.clientX - p.x, t.clientY - p.y, 0.0055 / fingers.size);
      p.x = t.clientX; p.y = t.clientY;
    }
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) fingers.delete(t.identifier);
    if (!W.active) return;
    if (fingers.size === 1) { const [id, p] = fingers.entries().next().value; walkWith(id, p.x, p.y); } else stand();
  };
  canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);

  W.enter = (x, z, yaw) => {
    W.active = true; W.pos.set(x, Math.max(meshY(x, z), U.uSeaM.value * VEX) + EYE, z); W.vy = 0; W.pitch = -0.04; if (yaw != null) W.yaw = yaw;
    camera.fov = innerWidth < innerHeight ? 80 : 70; camera.near = 0.25; camera.updateProjectionMatrix();
    if (matchMedia('(pointer: fine)').matches) canvas.requestPointerLock?.();
  };
  W.exit = () => { W.active = false; keys.clear(); stand(); fingers.clear(); tf = 0; if (document.pointerLockElement === canvas) document.exitPointerLock(); camera.near = 3; };
  W.update = (dt) => {
    tf += (tfGoal - tf) * Math.min(1, dt * 9); W.yaw += tTurn * dt;
    let f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + tf;
    let s = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);          // (Q and E step sideways; A and D turn)
    let run = keys.has('ShiftLeft') || keys.has('ShiftRight'), jump = keys.has('Space');
    if (keys.has('ArrowLeft') || keys.has('KeyA')) W.yaw -= dt * 1.6; if (keys.has('ArrowRight') || keys.has('KeyD')) W.yaw += dt * 1.6;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
    if (gp) {
      const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
      s += dz(gp.axes[0] || 0); f -= dz(gp.axes[1] || 0);
      look(dz(gp.axes[2] || 0) * dt * 900, dz(gp.axes[3] || 0) * dt * 650, 0.0021);
      run = run || gp.buttons[7]?.pressed || gp.buttons[10]?.pressed; jump = jump || gp.buttons[0]?.pressed;
      if (gp.buttons[1]?.pressed && W.onExit) return W.onExit();
    }
    const mag = Math.hypot(f, s); if (mag > 1) { f /= mag; s /= mag; }
    const sea = U.uSeaM.value * VEX, gy = meshY(W.pos.x, W.pos.z);
    W.swim = gy < sea - 1.25 * VEX;
    const sp = W.swim ? 3.2 : 5.2 + 11.8 * Math.max(run ? 1 : 0, tRun);
    // diving: once afloat, swimming forward while looking down takes you under, looking up brings you back (C and Space also sink and rise)
    if (W.swim) {
      const sink = (keys.has('KeyC') || keys.has('ControlLeft') ? 1 : 0) - (jump ? 1 : 0);
      if (W.dive > 0.05 || W.pitch < -0.3 || sink > 0) W.dive = clamp(W.dive - Math.sin(W.pitch) * f * sp * dt + sink * 2.4 * dt, 0, Math.max(0, sea - gy - 0.75 * VEX));
      if (W.dive > 0.05) { f *= Math.cos(W.pitch); }
    } else W.dive = 0;
    const sn = Math.sin(W.yaw), cs = Math.cos(W.yaw);
    // a tree trunk, a big bush or a log stops you; you slide along it rather than sticking (grass and small bushes you walk through)
    let mx = (sn * f + cs * s) * sp * dt, mz = (-cs * f + sn * s) * sp * dt;
    if (!W.swim && (mx || mz)) { const l = Math.hypot(mx, mz), ax = mx / l * 0.45, az = mz / l * 0.45, blocked = (x, z) => probe.hit(W.pos.x + x, W.pos.z + z, 0.3, true);
      if (blocked(mx + ax, mz + az)) { if (!blocked(mx + Math.sign(mx) * 0.45, 0)) mz = 0; else if (!blocked(0, mz + Math.sign(mz) * 0.45)) mx = 0; else mx = mz = 0; } }
    W.pos.x = clamp(W.pos.x + mx, -T.sx / 2 + 150, T.sx / 2 - 150);
    W.pos.z = clamp(W.pos.z + mz, -T.sz / 2 + 150, T.sz / 2 - 150);
    W.speed = Math.min(1, mag) * sp;
    const floor = W.swim ? sea + 0.35 - W.dive : Math.max(meshY(W.pos.x, W.pos.z), sea - 1.25 * VEX) + EYE;
    if (W.air) { W.vy -= 20 * dt; feet += W.vy * dt; if (feet <= 0) { feet = 0; W.air = false; W.vy = 0; } }
    else if (jump && !W.swim) { W.air = true; W.vy = 7.5; }
    bob += dt * W.speed * (W.swim ? 0.9 : 1.6);
    const by = W.air ? 0 : Math.sin(bob) * (W.dive > 0.4 ? 0.03 : W.swim ? 0.12 : 0.055) * Math.min(1, W.speed / 5);
    W.pos.y += (floor - W.pos.y) * Math.min(1, dt * 14);
    camera.position.set(W.pos.x, W.pos.y + feet + by, W.pos.z);
    W.under = W.dive > 0.3 && camera.position.y < sea + waveAt(W.pos.x, W.pos.z, U.uTime.value) * VEX - 0.04;      // really under: below the wave that is passing, not just the mean level
    camera.rotation.set(W.pitch, -W.yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
  };
  return W;
}

// where a screen point meets the ground or sea (simple march along the view ray)
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
export function pickGround(camera, cx, cy) {
  _d.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  _o.copy(camera.position);
  let t = 0, step = 4;
  for (let i = 0; i < 900; i++) {
    t += step; step *= 1.012;
    const x = _o.x + _d.x * t, y = _o.y + _d.y * t, z = _o.z + _d.z * t;
    if (Math.abs(x) > T.sx / 2 || Math.abs(z) > T.sz / 2) { if (y < 0) return null; continue; }
    if (y <= Math.max(meshY(x, z), U.uSeaM.value * VEX)) return { x, z };
  }
  return null;
}

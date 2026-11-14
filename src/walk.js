// First-person walking: keyboard + mouse, touch or a gamepad.
// Touch: the first finger walks (hold = forward, slide sideways = steer, up = run, down = stop then back up),
// any other finger looks around.
import * as THREE from 'three';
import { U, VEX, clamp } from './common.js';
import { meshY, T } from './terrain.js';

const EYE = 1.72 * VEX;
export function makeWalk(camera, canvas) {
  const W = { active: false, pos: new THREE.Vector3(), yaw: 0, pitch: -0.05, vy: 0, air: false, swim: false, speed: 0, onExit: null };
  const keys = new Set();
  let bob = 0, feet = 0, mvTouch = null, lkTouch = null, tf = 0, tfGoal = 0, tTurn = 0, tRun = 0;
  const stick = document.getElementById('stick'), knob = stick?.firstElementChild;
  const stickR = () => clamp(Math.min(innerWidth, innerHeight) * 0.2, 60, 110);
  // finger offset from where it pressed (px, up is positive) -> forward amount, turn rate and run amount
  const steer = (dx, dy) => {
    const R = stickR(), m = clamp(dx / R, -1, 1), n = clamp(dy / R, -1, 1);
    tTurn = Math.sign(m) * (Math.max(0, Math.abs(m) - 0.12) / 0.88) ** 1.5 * 2.2;
    tRun = Math.max(0, n - 0.15) / 0.85;
    tfGoal = n > -0.15 ? 1 : n > -0.45 ? (n + 0.45) / 0.3 : n > -0.7 ? 0 : (n + 0.7) / 0.3 * 0.6;
    if (knob) knob.style.transform = `translate(${m * R}px, ${-n * R}px)`;
  };
  const dropMove = () => { mvTouch = null; tfGoal = tTurn = tRun = 0; if (stick) stick.style.display = 'none'; };
  const look = (dx, dy, k) => { W.yaw += dx * k; W.pitch = clamp(W.pitch - dy * k, -1.5, 1.5); };
  addEventListener('keydown', (e) => { if (!W.active) return; keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  document.addEventListener('mousemove', (e) => { if (W.active && document.pointerLockElement === canvas) look(e.movementX, e.movementY, 0.0021); });
  canvas.addEventListener('click', () => { if (W.active && document.pointerLockElement !== canvas && matchMedia('(pointer: fine)').matches) canvas.requestPointerLock?.(); });
  canvas.addEventListener('touchstart', (e) => {
    if (!W.active) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (!mvTouch) {
        mvTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; steer(0, 0);
        if (stick) { stick.style.cssText = `display:block; left:${t.clientX}px; top:${t.clientY}px; --r:${stickR()}px`; }
      } else if (!lkTouch) lkTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!W.active) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (mvTouch && t.identifier === mvTouch.id) steer(t.clientX - mvTouch.x, mvTouch.y - t.clientY);
      if (lkTouch && t.identifier === lkTouch.id) { look(t.clientX - lkTouch.x, t.clientY - lkTouch.y, 0.0055); lkTouch.x = t.clientX; lkTouch.y = t.clientY; }
    }
  }, { passive: false });
  const endTouch = (e) => { for (const t of e.changedTouches) { if (mvTouch && t.identifier === mvTouch.id) dropMove(); if (lkTouch && t.identifier === lkTouch.id) lkTouch = null; } };
  canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);

  W.enter = (x, z, yaw) => {
    W.active = true; W.pos.set(x, Math.max(meshY(x, z), U.uSeaM.value * VEX) + EYE, z); W.vy = 0; W.pitch = -0.04; if (yaw != null) W.yaw = yaw;
    camera.fov = innerWidth < innerHeight ? 80 : 70; camera.near = 0.25; camera.updateProjectionMatrix();
    if (matchMedia('(pointer: fine)').matches) canvas.requestPointerLock?.();
  };
  W.exit = () => { W.active = false; keys.clear(); dropMove(); lkTouch = null; tf = 0; if (document.pointerLockElement === canvas) document.exitPointerLock(); camera.near = 3; };
  W.update = (dt) => {
    tf += (tfGoal - tf) * Math.min(1, dt * 9); W.yaw += tTurn * dt;
    let f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + tf;
    let s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let run = keys.has('ShiftLeft') || keys.has('ShiftRight'), jump = keys.has('Space');
    if (keys.has('ArrowLeft')) W.yaw -= dt * 1.6; if (keys.has('ArrowRight')) W.yaw += dt * 1.6;
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
    const sn = Math.sin(W.yaw), cs = Math.cos(W.yaw);
    W.pos.x = clamp(W.pos.x + (sn * f + cs * s) * sp * dt, -T.sx / 2 + 150, T.sx / 2 - 150);
    W.pos.z = clamp(W.pos.z + (-cs * f + sn * s) * sp * dt, -T.sz / 2 + 150, T.sz / 2 - 150);
    W.speed = Math.min(1, mag) * sp;
    const floor = W.swim ? sea + 0.35 : Math.max(meshY(W.pos.x, W.pos.z), sea - 1.25 * VEX) + EYE;
    if (W.air) { W.vy -= 20 * dt; feet += W.vy * dt; if (feet <= 0) { feet = 0; W.air = false; W.vy = 0; } }
    else if (jump && !W.swim) { W.air = true; W.vy = 7.5; }
    bob += dt * W.speed * (W.swim ? 0.9 : 1.6);
    const by = W.air ? 0 : Math.sin(bob) * (W.swim ? 0.12 : 0.055) * Math.min(1, W.speed / 5);
    W.pos.y += (floor - W.pos.y) * Math.min(1, dt * 14);
    camera.position.set(W.pos.x, W.pos.y + feet + by, W.pos.z);
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

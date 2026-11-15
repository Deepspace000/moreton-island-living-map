// Riding along: tap a 4WD on the beach and you sit in its back seat, looking out through the windscreen as it drives.
// The cabin is drawn round the view (roof lining, sun visors, mirror, pillars, dashboard, a screen with the speed and
// heading, the wheel on the right); drag to look about, and the cabin slides the other way as your head turns.
import * as THREE from 'three';
import { clamp } from './common.js';

const CABIN = /* html */`
<div class="cab">
  <svg class="shell" viewBox="0 0 1800 1000" preserveAspectRatio="none">
    <defs>
      <linearGradient id="rdRoof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0d0e"/><stop offset="1" stop-color="#232629"/></linearGradient>
      <linearGradient id="rdDash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2e31"/><stop offset="0.12" stop-color="#1b1d1f"/><stop offset="1" stop-color="#0b0c0d"/></linearGradient>
      <linearGradient id="rdTint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(20,40,60,0.42)"/><stop offset="1" stop-color="rgba(20,40,60,0)"/></linearGradient>
    </defs>
    <!-- everything that is not glass: the roof, the pillars, the doors and the dashboard, with the windscreen and the two side windows cut out -->
    <path fill="url(#rdRoof)" fill-rule="evenodd" d="M -50,-50 H 1850 V 1050 H -50 Z
      M 512,236 Q 900,200 1288,236 Q 1332,240 1340,290 L 1380,566 Q 1384,604 1340,604 Q 900,574 460,604 Q 416,604 420,566 L 460,290 Q 468,240 512,236 Z
      M 96,286 Q 104,262 136,258 L 350,246 Q 380,245 378,278 L 346,560 Q 342,596 308,598 L 80,612 Q 50,614 54,580 Z
      M 1704,286 Q 1696,262 1664,258 L 1450,246 Q 1420,245 1422,278 L 1454,560 Q 1458,596 1492,598 L 1720,612 Q 1750,614 1746,580 Z"/>
    <path fill="url(#rdTint)" d="M 512,236 Q 900,200 1288,236 Q 1332,240 1340,290 L 1344,320 Q 900,284 456,320 L 460,290 Q 468,240 512,236 Z"/>
    <path d="M 468,300 L 428,570 M 1332,300 L 1372,570" stroke="#33373b" stroke-width="5" opacity="0.8" vector-effect="non-scaling-stroke"/>
    <!-- sun visors, the overhead console and the mirror -->
    <rect x="520" y="150" width="280" height="92" rx="26" fill="#3a3e42"/><rect x="1000" y="150" width="280" height="92" rx="26" fill="#3a3e42"/>
    <rect x="532" y="158" width="130" height="20" rx="6" fill="#d8d2a8" opacity="0.5"/>
    <path d="M 815,118 H 985 Q 1000,118 998,140 L 990,214 Q 988,232 970,232 H 830 Q 812,232 810,214 L 802,140 Q 800,118 815,118 Z" fill="#2c3033" stroke="#15171a" stroke-width="3"/>
    <rect x="838" y="196" width="124" height="18" rx="6" fill="#16181a"/>
    <rect x="788" y="250" width="224" height="58" rx="22" fill="#0d0f10"/><rect x="798" y="257" width="204" height="44" rx="16" fill="#6f8ea0"/><rect x="798" y="257" width="204" height="18" rx="12" fill="#a9c6d2" opacity="0.7"/>
    <!-- the dashboard: a padded top with a line of stitching, air vents either side of the screen, the hood over the instruments -->
    <path d="M 300,640 Q 900,560 1500,640 L 1560,1050 H 240 Z" fill="url(#rdDash)"/>
    <path d="M 330,668 Q 900,600 1470,668" fill="none" stroke="#c98a2a" stroke-width="2" stroke-dasharray="9 7" opacity="0.7" vector-effect="non-scaling-stroke"/>
    <path d="M 1080,640 Q 1230,566 1390,636 L 1400,700 H 1075 Z" fill="#15171a"/>
    <g fill="#0c0d0e" stroke="#4a4f55" stroke-width="2"><rect x="748" y="650" width="58" height="150" rx="12"/><rect x="994" y="650" width="58" height="150" rx="12"/></g>
    <g stroke="#2e3236" stroke-width="3"><path d="M 756,676 H 798 M 756,700 H 798 M 756,724 H 798 M 756,748 H 798 M 756,772 H 798 M 1002,676 H 1044 M 1002,700 H 1044 M 1002,724 H 1044 M 1002,748 H 1044 M 1002,772 H 1044"/></g>
    <rect x="320" y="800" width="560" height="10" rx="5" fill="#8d949b" opacity="0.5"/>
  </svg>
  <!-- a straw hat left on the dash -->
  <svg class="hat" viewBox="0 0 200 90"><ellipse cx="100" cy="68" rx="96" ry="20" fill="#7f8f5c"/><ellipse cx="100" cy="64" rx="96" ry="19" fill="#9aa870"/><path d="M 46,62 Q 48,10 100,10 Q 152,10 154,62 Q 100,78 46,62 Z" fill="#8c9b64"/><path d="M 46,56 Q 100,72 154,56" fill="none" stroke="#5d4a2c" stroke-width="5"/><path d="M 60,30 Q 100,16 140,30 M 54,44 Q 100,30 146,44" fill="none" stroke="#7b8a56" stroke-width="2"/></svg>
  <!-- the screen in the middle of the dash -->
  <div class="screen"><div class="cam"></div><div class="spd"><b id="rdSpeed">35</b><span>km/h</span></div><div class="row"><span id="rdHead">N</span><span id="rdBeach">Eastern Beach</span></div><div class="near" id="rdNear"></div><div class="knobs"><i></i><i></i><i></i></div></div>
  <!-- instruments, and the wheel on the right -->
  <div class="dials"><b id="rdSpeed2">35</b><span>km/h</span></div>
  <svg class="wheel" viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" fill="none" stroke="#0a0b0c" stroke-width="20"/><circle cx="100" cy="100" r="95" fill="none" stroke="#3d4247" stroke-width="3" stroke-dasharray="170 600" transform="rotate(-150 100 100)"/><circle cx="100" cy="100" r="81" fill="none" stroke="#26292c" stroke-width="2"/>
    <path d="M 22,96 Q 60,84 78,92 L 78,118 Q 56,116 30,128 Z M 178,96 Q 140,84 122,92 L 122,118 Q 144,116 170,128 Z M 86,124 H 114 L 120,184 H 80 Z" fill="#101113"/><rect x="66" y="78" width="68" height="52" rx="20" fill="#16181a"/><ellipse cx="100" cy="104" rx="20" ry="9" fill="#2a3f66"/></svg>
  <!-- the tops of the two front seats -->
  <div class="seat l"></div><div class="seat r"></div>
</div>
<button id="rideExit" class="pill">Leave the car</button>
<div class="tip">Drag to look around</div>`;

export function makeRide(camera, canvas, cars, where) {
  const el = document.createElement('div'); el.id = 'ride'; el.innerHTML = CABIN;
  document.getElementById('c').after(el);
  const cab = el.querySelector('.cab'), $ = (id) => el.querySelector('#' + id), v = new THREE.Vector3(), d = new THREE.Vector3();
  const R = { active: false, car: null, pos: new THREE.Vector3(), look: 0, tilt: 0, onExit: null }, S = 1.45, COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let fov0 = 38, near0 = 3, uiT = 0, shake = 0, drag = null;
  // the car under a tap: the nearest one whose place on the screen is within about its own size (and never less than a fingertip)
  R.pick = (cx, cy) => {
    let best = null, bd = 1e9; camera.getWorldDirection(d);
    for (const c of cars) {
      v.copy(c.m.position); v.y += 1.3; const dist = v.distanceTo(camera.position); if (v.clone().sub(camera.position).dot(d) <= 0) continue;
      v.project(camera); const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      const rad = Math.max(30, 5 / dist * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360))), e = Math.hypot(sx - cx, sy - cy);
      if (e < rad * 1.25 && e < bd) { bd = e; best = c; }
    }
    return best;
  };
  R.enter = (car) => {
    R.active = true; R.car = car; car.m.visible = false; R.look = 0; R.tilt = 0; fov0 = camera.fov; near0 = camera.near;
    camera.fov = innerWidth < innerHeight ? 82 : 66; camera.near = 0.2; camera.updateProjectionMatrix();
    el.style.display = 'block'; uiT = 0; R.update(0, 0);
  };
  R.exit = () => { if (!R.active) return; R.active = false; R.car.m.visible = true; el.style.display = 'none'; camera.near = near0; camera.fov = fov0; camera.updateProjectionMatrix(); drag = null; };
  R.update = (dt, t) => {
    const c = R.car, m = c.m, yaw = m.rotation.y, fx = Math.cos(yaw), fz = -Math.sin(yaw);
    R.pos.copy(m.position);
    // eyes in the middle of the back seat; the car rides the bumps of the sand
    shake += dt * c.sp; const bump = Math.sin(shake * 1.9) * 0.012 + Math.sin(shake * 0.53 + 1.0) * 0.02;
    camera.position.set(m.position.x - fx * 0.95 * S, m.position.y + 1.44 * S + bump, m.position.z - fz * 0.95 * S);
    camera.rotation.set(R.tilt + m.rotation.z * 0.7 - 0.03, yaw - Math.PI / 2 - R.look, Math.sin(shake * 0.8) * 0.004, 'YXZ');
    camera.updateMatrixWorld();
    // the cabin stays with the car: as the head turns one way it slides the other
    const hf = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    cab.style.transform = `translate(${(-R.look / hf * 100).toFixed(2)}vw, ${(R.tilt / (camera.fov * Math.PI / 180) * 100 + bump * 30).toFixed(2)}vh)`;
    uiT -= dt; if (uiT <= 0) {
      uiT = 0.3; const kmh = Math.round(c.sp * 3.6), hd = (Math.round(((Math.atan2(fx, -fz) * 180 / Math.PI) + 360) % 360 / 45)) % 8;
      $('rdSpeed').textContent = kmh; $('rdSpeed2').textContent = kmh; $('rdHead').textContent = COMPASS[hd]; $('rdBeach').textContent = c.side > 0 ? 'Eastern Beach' : 'Western Beach';
      $('rdNear').textContent = where ? where(m.position.x, m.position.z) : '';
    }
  };
  // dragging turns the head (the car steers itself)
  canvas.addEventListener('pointerdown', (e) => { if (R.active) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointermove', (e) => { if (!R.active || !drag) return; R.look = clamp(R.look + (e.clientX - drag.x) * 0.0035, -0.62, 0.62); R.tilt = clamp(R.tilt - (e.clientY - drag.y) * 0.0025, -0.2, 0.16); drag.x = e.clientX; drag.y = e.clientY; });
  addEventListener('pointerup', () => { drag = null; }); addEventListener('pointercancel', () => { drag = null; });
  $('rideExit').onclick = () => R.onExit && R.onExit();
  return R;
}

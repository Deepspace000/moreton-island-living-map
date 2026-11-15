// Riding along: tap a 4WD on the beach and you sit in its back seat, looking out through the windscreen as it drives.
// Tap a yacht, a cruiser, a jet ski or a ferry and you stand at its helm: watch it sail itself, or take the wheel.
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
<div class="tip" id="rideTip">Drag to look around</div>
<div class="helm">
  <div class="gauges"><span><b id="hmSpeed">0.0</b> <i id="hmUnit">kn</i></span><span><b id="hmHead">N</b></span><span>wind <b id="hmWind">-</b></span><span><i id="hmDepthL">depth</i> <b id="hmDepth">-</b></span><span class="where" id="hmNear"></span></div>
  <div class="keys">
    <button id="hmLeft" class="pill" title="Steer to port (A or left arrow)">&#9664;</button>
    <button id="hmSlow" class="pill" title="Ease off (S or down arrow)">&minus;</button>
    <svg class="spokes" id="hmWheel" viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="#6a4a2a" stroke-width="7"/><circle cx="50" cy="50" r="9" fill="#8a6234"/><g stroke="#8a6234" stroke-width="5" stroke-linecap="round"><path d="M50,2 V98 M2,50 H98 M16,16 L84,84 M84,16 L16,84"/></g><circle cx="50" cy="6" r="5" fill="#d9b25c"/></svg>
    <button id="hmFast" class="pill" title="More speed (W or up arrow)">+</button>
    <button id="hmRight" class="pill" title="Steer to starboard (D or right arrow)">&#9654;</button>
  </div>
  <button id="hmTake" class="pill">Take the helm</button>
</div>`;

export function makeRide(camera, canvas, cars, getBoats, env = {}) {
  const el = document.createElement('div'); el.id = 'ride'; el.innerHTML = CABIN;
  document.getElementById('c').after(el);
  const cab = el.querySelector('.cab'), helmEl = el.querySelector('.helm'), wheelEl = el.querySelector('.wheel'), $ = (id) => el.querySelector('#' + id), v = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Vector3();
  const R = { active: false, kind: '', car: null, boat: null, bird: null, pos: new THREE.Vector3(), look: 0, tilt: 0, helm: false, onExit: null }, S = 1.45, COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let fov0 = 38, near0 = 3, uiT = 0, shake = 0, drag = null, steer = 0, gas = 0;
  const point = (ang) => COMPASS[(Math.round(((ang * 180 / Math.PI) + 360) % 360 / 45)) % 8];
  // what is under a tap: the nearest 4WD or boat whose place on the screen is within about its own size (and never less than a fingertip)
  R.pick = (cx, cy) => {
    let best = null, bd = 1e9; camera.getWorldDirection(d);
    const px = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
    const test = (kind, obj, pos, up, size) => {
      v.copy(pos); v.y += up; const dist = v.distanceTo(camera.position); if (q.copy(v).sub(camera.position).dot(d) <= 0) return;
      v.project(camera); const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight, rad = Math.max(30, size / dist * px), e = Math.hypot(sx - cx, sy - cy);
      if (e < rad * 1.25 && e / rad < bd) { bd = e / rad; best = { kind, obj }; }
    };
    for (const c of cars) test('car', c, c.m.position, 1.3, 5);
    for (const b of getBoats()) test('boat', b, b.m.position, 2, (b.len || 12) * 0.55);
    for (const p of env.birds || []) test('bird', p, p.m.position, 0.3, 2.8);
    return best;
  };
  R.enter = (hit) => {
    R.active = true; R.kind = hit.kind; R.car = hit.kind === 'car' ? hit.obj : null; R.boat = hit.kind === 'boat' ? hit.obj : null; R.bird = hit.kind === 'bird' ? hit.obj : null; R.look = 0; R.tilt = 0; R.helm = false; steer = 0; gas = 0;
    fov0 = camera.fov; near0 = camera.near; camera.near = 0.2;
    if (R.car) { R.car.m.visible = false; camera.fov = innerWidth < innerHeight ? 82 : 66; }
    else camera.fov = innerWidth < innerHeight ? 84 : 70;
    camera.updateProjectionMatrix();
    cab.style.display = R.car ? 'block' : 'none'; helmEl.style.display = 'flex'; el.classList.toggle('incar', !!R.car);
    $('rideExit').textContent = R.car ? 'Leave the car' : R.boat ? (R.boat.jet ? 'Leave the jet ski' : R.boat.sail ? 'Leave the yacht' : 'Leave the boat') : 'Leave the ' + (R.bird.kind || 'bird');
    $('hmUnit').textContent = R.boat ? 'kn' : 'km/h'; $('hmDepthL').textContent = R.boat ? 'depth' : 'height';
    const b = R.boat, can = canSteer(); $('hmTake').style.display = can ? '' : 'none';
    $('rideTip').textContent = R.car ? 'Drag to look around · take the wheel to drive' : R.bird ? (R.bird.kind === 'pelican' ? 'Drag to look around · fly it yourself to steer, climb and land' : 'Drag to look around · fly it yourself to steer, climb and dive') : can ? 'Drag to look around · take the helm to steer' : b.ferry ? 'Drag to look around · the ferry keeps to its route' : 'Drag to look around · this boat is at anchor';
    sync(); if (hit.control === true || (b && b.jet && hit.control !== false)) take(true);       // a jet ski is yours to ride as soon as you are on it (unless you asked only to watch)
    el.style.display = 'block'; uiT = 0; R.update(0, 0);
  };
  const canSteer = () => !!(R.car || R.bird || (R.boat && R.boat.move && !R.boat.ferry));
  const WORDS = { car: ['Take the wheel', 'Let it drive itself'], boat: ['Take the helm', 'Let her sail herself'], bird: ['Fly it yourself', 'Let it fly on'] };
  const sync = () => { el.classList.toggle('steering', R.helm); $('hmTake').textContent = (R.boat && R.boat.jet ? ['Ride it yourself', 'Let it run itself'] : WORDS[R.kind] || WORDS.boat)[R.helm ? 1 : 0]; $('hmTake').classList.toggle('on', R.helm); };
  const take = (on) => {
    if (!canSteer()) return; R.helm = on; steer = 0; gas = 0;
    if (R.boat) R.boat.helm = on ? { turn: 0, throttle: 1 } : null; else if (R.car) R.car.setDrive(on); else R.bird.ctl = on ? { turn: 0, climb: 0 } : null;
    sync();
  };
  R.exit = () => {
    if (!R.active) return; if (R.helm) take(false); R.active = false; if (R.car) R.car.m.visible = true; if (R.boat) R.boat.helm = null; if (R.bird) R.bird.ctl = null; R.helm = false;
    el.style.display = 'none'; camera.near = near0; camera.fov = fov0; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); drag = null;
  };
  R.update = (dt, t) => {
    if (R.car) {
      const c = R.car, m = c.m, yaw = m.rotation.y, fx = Math.cos(yaw), fz = -Math.sin(yaw);
      R.pos.copy(m.position);
      // eyes in the middle of the back seat; the car rides the bumps of the sand
      shake += dt * c.sp; const bump = Math.sin(shake * 1.9) * 0.012 + Math.sin(shake * 0.53 + 1.0) * 0.02;
      camera.position.set(m.position.x - fx * 0.95 * S, m.position.y + 1.44 * S + bump, m.position.z - fz * 0.95 * S);
      camera.rotation.set(R.tilt + m.rotation.z * 0.7 - 0.03, yaw - Math.PI / 2 - R.look, Math.sin(shake * 0.8) * 0.004, 'YXZ');
      camera.updateMatrixWorld();
      if (c.drive) { c.drive.turn += (steer - c.drive.turn) * Math.min(1, dt * 5); c.drive.throttle = clamp(c.drive.throttle + gas * dt * 0.7, -0.4, 1.6); }
      wheelEl.style.transform = `rotate(${((c.drive ? c.drive.turn : 0) * 95).toFixed(1)}deg)`; $('hmWheel').style.transform = wheelEl.style.transform;
      // the cabin stays with the car: as the head turns one way it slides the other
      const hf = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      cab.style.transform = `translate(${(-R.look / hf * 100).toFixed(2)}vw, ${(R.tilt / (camera.fov * Math.PI / 180) * 100 + bump * 30).toFixed(2)}vh)`;
      uiT -= dt; if (uiT <= 0) {
        uiT = 0.3; const kmh = Math.round(c.sp * 3.6);
        $('rdSpeed').textContent = kmh; $('rdSpeed2').textContent = kmh; $('rdHead').textContent = point(Math.atan2(fx, -fz)); $('rdBeach').textContent = c.side > 0 ? 'Eastern Beach' : 'Western Beach';
        $('rdNear').textContent = env.where ? env.where(m.position.x, m.position.z) : '';
      }
      return;
    }
    if (R.bird) {            // following a pelican: just behind and above it, turning as it turns
      const p = R.bird, sea = env.sea ? env.sea() : 0; R.pos.copy(p.m.position);
      const yawC = Math.atan2(-Math.cos(p.hd), Math.sin(p.hd)) - R.look, fx = -Math.sin(yawC), fz = -Math.cos(yawC), back = p.afloat ? 5 : p.kind === 'eagle' ? 6 : 7.5;
      camera.position.set(p.x - fx * back, Math.max(p.y + 2.3 - R.tilt * 7, sea + 0.4), p.z - fz * back); v.set(p.x + fx * 4, p.y + 0.7, p.z + fz * 4); camera.up.set(0, 1, 0); camera.lookAt(v); camera.updateMatrixWorld();
      if (p.ctl) { p.ctl.turn += (steer - p.ctl.turn) * Math.min(1, dt * 4); p.ctl.climb += (gas - p.ctl.climb) * Math.min(1, dt * 4); $('hmWheel').style.transform = `rotate(${(p.ctl.turn * 60).toFixed(1)}deg)`; }
      uiT -= dt; if (uiT <= 0) {
        uiT = 0.3; $('hmSpeed').textContent = Math.round((p.v ?? p.sp) * 3.6); $('hmHead').textContent = point(Math.atan2(Math.cos(p.hd), Math.sin(p.hd)));
        $('hmWind').textContent = env.wind ? env.wind() : '-'; $('hmDepth').textContent = p.afloat ? 'on the water' : Math.max(0, (p.y - sea) / 1.7).toFixed(0) + ' m'; $('hmNear').textContent = env.where ? env.where(p.x, p.z) : '';
      }
      return;
    }
    // aboard a boat: eyes at the helm, moving with the hull as it pitches, rolls and heels
    const b = R.boat, m = b.m, eye = b.eye || [-3, 3];
    m.updateMatrixWorld(); R.pos.copy(m.position);
    v.set(eye[0], eye[1], 0); m.localToWorld(v); q.set(eye[0] + 20, eye[1] - 0.8, 0); m.localToWorld(q); q.sub(v).normalize();
    camera.position.copy(v);
    camera.rotation.set(Math.asin(clamp(q.y, -1, 1)) * 0.7 + R.tilt, Math.atan2(-q.x, -q.z) - R.look, -m.rotation.x * 0.7 * Math.cos(R.look), 'YXZ');
    camera.updateMatrixWorld();
    if (b.helm) { b.helm.turn += (steer - b.helm.turn) * Math.min(1, dt * 4); b.helm.throttle = clamp(b.helm.throttle + gas * dt * 0.6, 0, 1.5); $('hmWheel').style.transform = `rotate(${(b.helm.turn * 110).toFixed(1)}deg)`; }
    uiT -= dt; if (uiT <= 0) {
      uiT = 0.3; $('hmSpeed').textContent = (b.sp / 1.6 * 1.944).toFixed(1); $('hmHead').textContent = point(Math.atan2(Math.cos(b.hd), Math.sin(b.hd)));
      $('hmWind').textContent = env.wind ? env.wind() : '-'; $('hmDepth').textContent = env.depth ? Math.max(0, env.depth(b.x, b.z)).toFixed(1) + ' m' : '-'; $('hmNear').textContent = env.where ? env.where(b.x, b.z) : '';
    }
  };
  // dragging turns the head (a car steers itself; a boat does too unless you have taken the helm)
  canvas.addEventListener('pointerdown', (e) => { if (R.active) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointermove', (e) => {
    if (!R.active || !drag) return; const wide = R.car ? 0.62 : 3.1;
    R.look = clamp(R.look + (e.clientX - drag.x) * 0.0035, -wide, wide); R.tilt = clamp(R.tilt - (e.clientY - drag.y) * 0.0025, R.car ? -0.2 : -0.6, R.car ? 0.16 : 0.5); drag.x = e.clientX; drag.y = e.clientY;
  });
  addEventListener('pointerup', () => { drag = null; }); addEventListener('pointercancel', () => { drag = null; });
  // the helm: buttons you hold, or the keys
  const hold = (id, on, off) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, off); };
  hold('hmLeft', () => { steer = -1; }, () => { steer = 0; }); hold('hmRight', () => { steer = 1; }, () => { steer = 0; });
  hold('hmSlow', () => { gas = -1; }, () => { gas = 0; }); hold('hmFast', () => { gas = 1; }, () => { gas = 0; });
  $('hmTake').onclick = () => take(!R.helm);
  const KEY = { KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1] };
  addEventListener('keydown', (e) => { if (!R.active) return; if (e.code === 'KeyH') return take(!R.helm); const k = KEY[e.code]; if (k && R.helm) { if (k[0]) steer = k[0]; if (k[1]) gas = k[1]; e.preventDefault(); } });
  addEventListener('keyup', (e) => { const k = KEY[e.code]; if (k) { if (k[0]) steer = 0; if (k[1]) gas = 0; } });
  $('rideExit').onclick = () => R.onExit && R.onExit();
  R.take = take; R.canSteer = canSteer;
  return R;
}

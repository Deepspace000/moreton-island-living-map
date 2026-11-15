import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U, VEX, MOBILE, Q, TZ_HOURS, clamp, lerp, expect, getBlob } from './common.js';
import { loadTerrainData, buildTerrain, followTerrain, meshY, heightAt, T } from './terrain.js';
import { buildWater } from './water.js';
import { buildSky, updateSky, sunPos, sky } from './sky.js';
import { wx, live, fetchWeather, stepWeather, setTideDate, setMode, setCustom, seedCustom, custom, TYPES, current, describe, compass, mode } from './weather.js';
import { makeWalk, pickGround } from './walk.js';
import { buildFeatures } from './features.js';
import { buildBoats } from './boats.js';
import { buildClouds } from './clouds.js';
import { buildDetail } from './detail.js';
import { buildLife } from './life.js';
import { buildFolk } from './folk.js';
import { makeSound } from './sound.js';
import { makeDive } from './dive.js';
import { makeRide } from './ride.js';
import { rideable, flyers } from './life.js';

const $ = (id) => document.getElementById(id);
const msg = (t) => { const e = $('ldmsg'); if (e) e.textContent = t; };
let shownPct = 0;
const pct = (p) => { shownPct = Math.max(shownPct, Math.min(100, p)); const b = $('ldbar'), t = $('ldpct'); if (b) b.style.width = shownPct.toFixed(1) + '%'; if (t) t.textContent = Math.round(shownPct) + '%'; };
const paint = () => new Promise(r => setTimeout(r, 30));
if (Q.get('ui') === '0') document.body.classList.add('ui-off');

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shot') });
const DPR = Math.min(window.devicePixelRatio || 1, +(Q.get('dpr') || (MOBILE ? 1.5 : 2)));
renderer.setPixelRatio(DPR);
const TM = { aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping, agx: THREE.AgXToneMapping }[Q.get('tm') || 'neutral'];
const EXPO = +(Q.get('expo') || 0.5);
renderer.toneMapping = TM; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 3, 700000);
if (window.innerWidth < window.innerHeight) camera.position.set(-9000, 56000, 30000); else camera.position.set(-23000, 17000, 25000);
const controls = new OrbitControls(camera, canvas);
controls.target.set(1200, 0, 300);
controls.enableDamping = true; controls.dampingFactor = 0.09;
controls.screenSpacePanning = false; controls.zoomToCursor = true;
controls.minDistance = 90; controls.maxDistance = 95000; controls.maxPolarAngle = 1.5;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.rotateSpeed = 0.55; controls.zoomSpeed = 1.1; controls.autoRotateSpeed = 0.35;

const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: MOBILE ? 2 : 4, stencilBuffer: true });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
// one bad pixel (NaN / runaway highlight) would be smeared into big blocks by the bloom: clean the frame first
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; if(!(c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0)) c = vec3(0.0); gl_FragColor = vec4(min(c, vec3(48.0)), 1.0); }',
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.55, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const walk = makeWalk(camera, canvas);
// where a car is, in words, for the screen on its dash: the nearest named place and how far off it is
const rideWhere = (x, z) => {
  let best = null, bd = 1e9; for (const p of (features && features.places) || []) { if (/Whole island/.test(p.n)) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
  return best ? (bd < 400 ? best.n : best.n + ' ' + (bd / 1000).toFixed(1) + ' km') : '';
};
const ride = makeRide(camera, canvas, rideable, () => (boats ? boats.boats : []), { birds: flyers, sea: () => U.uSeaM.value * VEX, ground: (x, z) => meshY(x, z), where: rideWhere, wind: () => `${compass(wx.windDir)} ${Math.round(wx.wind / 1.852)} kn`, depth: (x, z) => U.uSeaM.value - heightAt(x, z) });
function resize() {
  const w = +(Q.get('w') || window.innerWidth), h = +(Q.get('h') || window.innerHeight);
  renderer.setSize(w, h, false); composer.setPixelRatio(DPR); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = ride.active ? (ride.car ? (w < h ? 82 : 66) : (w < h ? 84 : 70)) : walk.active ? (w < h ? 80 : 70) : (w < h ? 50 : 38); camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ---------- time ----------
const st = { live: !Q.has('t'), play: false, date: Date.now(), speed: 420 };
const dayStart = (d) => Math.floor((d + TZ_HOURS * 3600e3) / 86400e3) * 86400e3 - TZ_HOURS * 3600e3;
const minutesOf = (d) => ((d + TZ_HOURS * 3600e3) % 86400e3) / 60000;
function setMinutes(m) { st.date = dayStart(st.date) + m * 60000; }
if (Q.has('t')) { const [h, m] = Q.get('t').split(':').map(Number); setMinutes(h * 60 + (m || 0)); }
if (Q.has('wx')) setMode(Q.get('wx'));
const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
function sunTimes(date) {
  const d0 = dayStart(date); let rise = null, set = null, prev = sunPos(d0).el;
  for (let m = 4; m <= 1440; m += 4) { const e = sunPos(d0 + m * 60000).el; if (prev < -0.0145 && e >= -0.0145) rise = m; if (prev >= -0.0145 && e < -0.0145) set = m; prev = e; }
  return { rise, set };
}

// ---------- UI ----------
function refreshWeatherUI() {
  const c = current();
  $('wxTemp').textContent = `${Math.round(c.temp)}°`;
  $('wxDesc').textContent = describe(c.code);
  $('wxSrc').textContent = mode === 'live' ? (live.ok ? `Live · feels ${Math.round(c.feels)}°` : 'Typical day (offline)') : mode === 'custom' ? 'Your weather' : 'Preset weather';
  $('wxWind').textContent = `${Math.round(c.wind)} ${compass(c.windDir)}`;
  $('wxArrow').style.transform = `rotate(${c.windDir + 180}deg)`;
  $('wxWave').textContent = c.wave.toFixed(1);
  $('wxTide').textContent = (c.tide >= 0 ? '+' : '') + c.tide.toFixed(1);
  $('wxCloud').textContent = Math.round(c.cloud);
  $('wxSea').textContent = Math.round(c.sst);
}
let sunT = sunTimes(st.date), sunDay = dayStart(st.date);
function refreshClock() {
  const m = minutesOf(st.date);
  $('clock').textContent = fmt(m);
  if (document.activeElement !== $('time')) $('time').value = Math.round(m);
  if (dayStart(st.date) !== sunDay) { sunDay = dayStart(st.date); sunT = sunTimes(st.date); }
  const upNext = sunT.rise != null && (m < sunT.rise || m > sunT.set);
  $('wxSun').textContent = fmt(upNext ? sunT.rise : sunT.set); $('wxSunL').textContent = upNext ? 'sunrise' : 'sunset';
}
// ---------- weather sliders ----------
const SL = { sun: 'Sun', cloud: 'Cloud', wind: 'Wind', windDir: 'Dir', rain: 'Rain', fog: 'Fog', swell: 'Swell', tide: 'Tide' };
const FMT = { sun: v => v + '%', cloud: v => v + '%', wind: v => v + ' km/h', windDir: v => `${compass(+v)} ${v}°`, rain: v => v + '%', fog: v => v + '%', swell: v => (+v).toFixed(1) + ' m', tide: v => (v >= 0 ? '+' : '') + (+v).toFixed(1) + ' m' };
for (const [k, t] of Object.entries(TYPES)) { const o = document.createElement('option'); o.value = k; o.textContent = t.label; $('sType').appendChild(o); }
function syncWeatherUI() {
  seedCustom();
  for (const k in SL) { $('s' + SL[k]).value = custom[k]; $('o' + SL[k]).textContent = FMT[k](custom[k]); }
  $('sType').value = custom.ctype; $('sStorm').checked = !!custom.storm;
  [...$('wxMode').children].forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  refreshWeatherUI();
}
for (const k in SL) $('s' + SL[k]).addEventListener('input', (e) => { setCustom(k, +e.target.value); syncWeatherUI(); });
$('sType').addEventListener('change', (e) => { setCustom('ctype', e.target.value); syncWeatherUI(); });
$('sStorm').addEventListener('change', (e) => { setCustom('storm', e.target.checked ? 1 : 0); syncWeatherUI(); });
$('wxSet').onclick = () => { const p = $('wxPanel'); p.hidden = !p.hidden; $('wxSet').classList.toggle('on', !p.hidden); syncWeatherUI(); };
$('wxMode').addEventListener('click', (e) => { const m = e.target.dataset.m; if (!m) return; setMode(m); syncWeatherUI(); });
$('btDepth').onclick = (e) => { U.uContour.value = U.uContour.value ? 0 : 1; e.currentTarget.classList.toggle('on', !!U.uContour.value); };

// ---------- walking ----------
function enterWalk(x, z) {
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  fly = null; controls.enabled = false; controls.autoRotate = false; $('btSpin').classList.remove('on');
  walk.enter(x, z, Math.atan2(d.x, -d.z)); document.body.classList.add('walking'); $('btWalk').classList.add('on'); $('btWalk').textContent = 'Back to map';
}
function exitWalk() {
  if (!walk.active) return;
  walk.exit(); controls.enabled = true; document.body.classList.remove('walking'); $('btWalk').classList.remove('on'); $('btWalk').textContent = 'Walk';
  controls.target.set(walk.pos.x, Math.max(meshY(walk.pos.x, walk.pos.z), 0), walk.pos.z);
  camera.position.set(walk.pos.x - Math.sin(walk.yaw) * 650, controls.target.y + 420, walk.pos.z + Math.cos(walk.yaw) * 650);
  resize();
}
walk.onExit = exitWalk;
// riding in a 4WD: tap one on the beach to sit in it; Leave the car (or Esc) to come back to the map above it
function enterRide(hit) {
  if (!hit.kind) hit = { kind: 'car', obj: hit };
  if (ride.active) exitRide();
  if (walk.active) exitWalk();
  fly = null; controls.enabled = false; controls.autoRotate = false; $('btSpin').classList.remove('on');
  ride.enter(hit); document.body.classList.add('riding'); dip();
}
// stepping into or out of a ride, the view comes up out of the dark instead of cutting
const veil = document.createElement('div'); veil.id = 'veil'; document.body.appendChild(veil);
const dip = () => { veil.classList.remove('dip'); void veil.offsetWidth; veil.classList.add('dip'); };
function exitRide() {
  if (!ride.active) return; dip();
  const m = (ride.car || ride.boat || ride.bird).m, yaw = m.rotation.y, far = ride.boat ? Math.max(140, (ride.boat.len || 12) * 6) : ride.bird ? 70 : 110; ride.exit(); controls.enabled = true; document.body.classList.remove('riding');
  controls.target.set(m.position.x, m.position.y, m.position.z);
  camera.position.set(m.position.x - Math.cos(yaw) * far, m.position.y + far * 0.55, m.position.z + Math.sin(yaw) * far);
  resize();
}
ride.onExit = exitRide;
// ---------- the Travel menu: go along with the nearest 4WD, boat, yacht, jet ski, pelican or sea eagle, watching or in control ----------
const TRAVEL = {
  car: () => rideable.map(o => ({ kind: 'car', obj: o })),
  boat: () => boats.boats.filter(b => b.move && !b.sail && !b.jet && !b.ferry).map(o => ({ kind: 'boat', obj: o })),
  yacht: () => boats.boats.filter(b => b.move && b.sail).map(o => ({ kind: 'boat', obj: o })),
  jetski: () => boats.boats.filter(b => b.jet).map(o => ({ kind: 'boat', obj: o })),
  pelican: () => flyers.filter(p => p.kind === 'pelican').map(o => ({ kind: 'bird', obj: o })),
  eagle: () => flyers.filter(p => p.kind === 'eagle').map(o => ({ kind: 'bird', obj: o })),
};
const riding = () => (ride.active ? ride.car || ride.boat || ride.bird : null);
const travelKind = () => { const o = riding(); return !o ? '' : ride.car ? 'car' : ride.bird ? o.kind : o.jet ? 'jetski' : o.sail ? 'yacht' : o.ferry || o.anchor ? '' : 'boat'; };
function travel(kind, control) {
  if (!boats) return; const list = TRAVEL[kind](); if (!list.length) return;
  const cur = riding(), at = list.findIndex(h => h.obj === cur);
  if (at >= 0 && ride.helm !== control) { ride.take(control); return syncTravel(); }        // already with one of these: just take or give back control
  let pick;
  if (at >= 0) pick = list[(at + 1) % list.length];                                          // asked again: on to the next one
  else { const from = ride.active ? ride.pos : walk.active ? walk.pos : controls.target; pick = list.reduce((a, h) => (h.obj.m.position.distanceToSquared(from) < a.obj.m.position.distanceToSquared(from) ? h : a)); }
  enterRide({ ...pick, control }); syncTravel();
}
function syncTravel() {
  const k = travelKind();
  for (const row of document.querySelectorAll('#travel .tv-row')) { const on = row.dataset.kind === k; row.classList.toggle('on', on); for (const b of row.querySelectorAll('button')) b.classList.toggle('on', on && (b.dataset.ctl === '1') === ride.helm); }
}
for (const b of document.querySelectorAll('#travel .tv-row button')) b.onclick = () => travel(b.parentElement.dataset.kind, b.dataset.ctl === '1');
$('tvBack').onclick = () => { exitRide(); syncTravel(); };
// the left-hand column stacks: title, then Travel, then Places, whatever size each is just now
function layoutLeft() {
  const t = $('title'), tv = $('travel'), pl = $('places'), tr = t.getBoundingClientRect(), top = tr.height > 0 ? tr.bottom + 8 : document.body.classList.contains('riding') ? 50 : 10;
  tv.style.top = top + 'px'; const b = tv.getBoundingClientRect().bottom + 8; pl.style.top = b + 'px'; pl.style.maxHeight = `calc(100vh - ${Math.round(b + 86)}px)`;
}
{ let down = null;                 // a tap (not a drag) on a 4WD, a boat or a pelican in flight
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || walk.active || ride.active || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9 || performance.now() - down.t > 500) { down = null; return; }
    down = null; const hit = boats ? ride.pick(e.clientX, e.clientY) : null; if (hit) enterRide(hit);
  });
}
$('btWalk').onclick = () => { if (ride.active) exitRide(); if (walk.active) exitWalk(); else enterWalk(controls.target.x, controls.target.z); };
canvas.addEventListener('dblclick', (e) => { if (walk.active || ride.active) return; const p = pickGround(camera, e.clientX, e.clientY); if (p) enterWalk(p.x, p.z); });
addEventListener('keydown', (e) => { if (ride.active && (e.code === 'Escape' || e.code === 'KeyM')) return exitRide(); if (walk.active && (e.code === 'KeyM' || (e.code === 'Escape' && document.pointerLockElement !== canvas))) exitWalk(); });
$('time').addEventListener('input', (e) => { st.live = false; st.play = false; setMinutes(+e.target.value); syncButtons(); });
$('btLive').onclick = () => { st.live = true; st.play = false; st.date = Date.now(); syncButtons(); };
$('btPlay').onclick = () => { st.play = !st.play; st.live = false; syncButtons(); };
function syncButtons() { $('btLive').classList.toggle('on', st.live); $('btPlay').classList.toggle('on', st.play); $('btPlay').textContent = st.play ? '❚❚ Day cycle' : '▶ Day cycle'; }
let showLabels = Q.get('labels') !== '0', showClouds = true;
$('btLabels').classList.toggle('on', showLabels);
$('btLabels').onclick = (e) => { showLabels = !showLabels; e.currentTarget.classList.toggle('on', showLabels); };
$('btClouds').onclick = (e) => { showClouds = !showClouds; e.currentTarget.classList.toggle('on', showClouds); };
$('btSpin').onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.currentTarget.classList.toggle('on', controls.autoRotate); };
$('btNorth').onclick = () => flyTo(controls.target.x, controls.target.z, camera.position.distanceTo(controls.target), 0, null);
// ---------- sound: starts on the button (browsers need a tap first); if it was on last time, the first tap anywhere brings it back ----------
const btSound = $('btSound');
const setSound = (v) => { if (sound.on !== v) sound.toggle(); btSound.classList.toggle('on', sound.on); try { localStorage.setItem('sound', sound.on ? '1' : '0'); } catch (e) { /* not remembered then */ } };
btSound.onclick = () => setSound(!sound.on);
try { if (localStorage.getItem('sound') === '1') addEventListener('pointerdown', (e) => { if (e.target !== btSound && !sound.on) setSound(true); }, { once: true }); } catch (e) { /* storage can be blocked */ }
// ---------- windows: each one can be shrunk to a small named chip and opened again (remembered between visits) ----------
for (const w of document.querySelectorAll('.win')) {
  const b = document.createElement('button'), key = 'min:' + w.id, name = w.dataset.win;
  b.className = 'win-min'; b.innerHTML = `<span>${name}</span><i></i>`;
  const set = (m) => { w.classList.toggle('min', m); b.title = (m ? 'Show ' : 'Minimise ') + name; b.setAttribute('aria-expanded', String(!m)); };
  let saved = null; try { saved = localStorage.getItem(key); } catch (e) { /* storage can be blocked */ }
  set(saved === null ? w.dataset.min === '1' : saved === '1');          // the Travel menu starts as a chip; the rest start open
  b.onclick = () => { const m = !w.classList.contains('min'); set(m); try { localStorage.setItem(key, m ? '1' : '0'); } catch (e) { /* not remembered then */ } };
  w.append(b);
}
// ---------- download: the whole app as one HTML file (also started by ?download in the address) ----------
const btSave = $('btSave');
if (window.PACKED) btSave.remove();          // this already is the one-file copy
else {
  let busy = false;
  btSave.onclick = async () => {
    if (busy) return; busy = true;
    try {
      const { downloadApp } = await import('./pack.js');
      await downloadApp((p) => { btSave.textContent = 'Packing ' + Math.round(p * 100) + '%'; });
      btSave.textContent = 'Saved';
    } catch (e) { console.error(e); btSave.textContent = 'Download failed'; }
    setTimeout(() => { btSave.textContent = 'Download'; busy = false; }, 5000);
  };
  if (Q.has('download')) btSave.click();
}
let twist = null;
const twistAngle = (e) => Math.atan2(e.touches[1].clientY - e.touches[0].clientY, e.touches[1].clientX - e.touches[0].clientX);
canvas.addEventListener('touchstart', (e) => { twist = e.touches.length === 2 && !walk.active ? twistAngle(e) : null; }, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (twist === null || e.touches.length !== 2 || walk.active) return;
  const a = twistAngle(e); let d = a - twist; twist = a;
  if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
  off.copy(camera.position).sub(controls.target).applyAxisAngle(camera.up, d); camera.position.copy(controls.target).add(off);
}, { passive: true });
canvas.addEventListener('touchend', (e) => { if (e.touches.length < 2) twist = null; }, { passive: true });
const hideHint = () => { $('hint').style.opacity = 0; };
canvas.addEventListener('pointerdown', () => { hideHint(); fly = null; }, { passive: true });
canvas.addEventListener('wheel', () => { hideHint(); fly = null; }, { passive: true });
setTimeout(hideHint, 9000);

// ---------- camera flights ----------
let fly = null;
const sph = new THREE.Spherical(), off = new THREE.Vector3();
function flyTo(x, z, dist, azDeg, polarDeg, dur = 2.4) {
  off.copy(camera.position).sub(controls.target); sph.setFromVector3(off);
  const y = Math.max(meshY(x, z), 0);
  let th = azDeg == null ? sph.theta : -azDeg * Math.PI / 180;       // azimuth the camera looks toward
  th = sph.theta + ((th - sph.theta + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  fly = { t: 0, dur, a: { x: controls.target.x, y: controls.target.y, z: controls.target.z, r: sph.radius, th: sph.theta, ph: sph.phi }, b: { x, y, z, r: dist, th, ph: polarDeg == null ? sph.phi : polarDeg * Math.PI / 180 } };
}
function stepFly(dt) {
  if (!fly) return;
  fly.t = Math.min(1, fly.t + dt / fly.dur);
  const k = fly.t < .5 ? 4 * fly.t ** 3 : 1 - Math.pow(-2 * fly.t + 2, 3) / 2, a = fly.a, b = fly.b;
  controls.target.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
  sph.set(Math.exp(lerp(Math.log(a.r), Math.log(b.r), k)), lerp(a.ph, b.ph, k), lerp(a.th, b.th, k));
  camera.position.setFromSpherical(sph).add(controls.target);
  if (fly.t >= 1) fly = null;
}

// ---------- boot ----------
let features, boats, clouds, water, detail, life, folk;
const sound = makeSound();
const dive = makeDive();
const clock = new THREE.Clock();
async function boot() {
  // downloads fill the bar to 78 %, building the scene takes it to 100 %
  expect([['assets/features.json', 2e5], ['assets/height.png', 6.2e6], ['assets/mask.png', 1.8e6], ['assets/albedo.jpg', 9.6e5], ['assets/noise.png', 5e5], ['assets/water.png', 5.7e5]], (p) => pct(p * 78));
  const F = JSON.parse(await (await getBlob('assets/features.json')).text());
  await loadTerrainData(F, msg);
  pct(82); msg('Shaping the island'); await paint();
  buildSky(scene);
  buildTerrain(scene);
  water = buildWater(scene);
  pct(88); msg('Raising buildings, tracks and wrecks'); await paint();
  features = buildFeatures(scene, F, flyTo);
  pct(94); msg('Launching the boats'); await paint();
  boats = buildBoats(scene, F);
  life = buildLife(scene, F);
  folk = buildFolk(scene, F);
  clouds = buildClouds(scene, renderer);
  detail = buildDetail(F);
  pct(98); msg('Checking the weather'); await paint();
  // quick-jump list
  const P = features.places;
  for (const p of P) { const b = document.createElement('button'); b.textContent = p.n; b.onclick = () => flyTo(p.x, p.z, p.d, p.az, p.pol); $('places').appendChild(b); }
  if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); }
  if (Q.has('go')) { const p = P.find(p => p.n.toLowerCase().startsWith(Q.get('go').toLowerCase())); if (p) flyTo(p.x, p.z, p.d, p.az, p.pol, 0.01); }
  fetchWeather().then(syncWeatherUI); setInterval(() => fetchWeather().then(syncWeatherUI), 15 * 60e3);
  refreshWeatherUI();
  syncWeatherUI();
  window.MAP = { camera, controls, scene, renderer, st, U, flyTo, features, boats, life, folk, dive, ride, rideable, flyers, enterRide, exitRide, sound, F, wx, walk, enterWalk, exitWalk, setCustom, setMode, T, sky, frame, setMinutes: (m) => { st.live = false; setMinutes(m); }, setDt: (v) => { forceDt = v; }, travel: (k, c) => travel(k, c) };
  // review helper: pose the scene, let it settle, post the frame to the local receiver
  window.MAP.shot = async (name, o = {}) => {
    if (!o.walk && walk.active) exitWalk();
    if (o.cam && !o.walk) { camera.position.set(o.cam[0], o.cam[1], o.cam[2]); controls.target.set(o.cam[3], o.cam[4], o.cam[5]); }
    if (o.min != null) { st.live = false; st.play = false; setMinutes(o.min); }
    if (o.wx) setMode(o.wx);
    if (o.custom) for (const k in o.custom) setCustom(k, o.custom[k]);
    if (o.walk) { if (!walk.active) enterWalk(o.walk[0], o.walk[1]); walk.pos.x = o.walk[0]; walk.pos.z = o.walk[1]; walk.yaw = o.walk[2] || 0; walk.pitch = o.walk[3] || 0; }
    fly = null; forceDt = 1.2; for (let i = 0; i < 14; i++) frame(); forceDt = 0.016; for (let i = 0; i < 3; i++) frame(); forceDt = 0;
    const r = await fetch('http://127.0.0.1:8765/' + name, { method: 'POST', body: canvas.toDataURL('image/jpeg', 0.93) });
    return name + ' ' + r.status;
  };
  renderer.compile(scene, camera);
  pct(100); msg('Ready'); await paint();
  renderer.setAnimationLoop(frame);
  if (Q.has('shot')) $('loading').remove(); else { $('loading').style.opacity = 0; $('loading').style.pointerEvents = 'none'; setTimeout(() => $('loading')?.remove(), 1600); }
}

let acc = 0, uiT = 0, flashT = 0, forceDt = 0;
function frame() {
  const dt = forceDt || Math.min(clock.getDelta(), 0.1);
  acc += dt; U.uTime.value = acc;
  if (st.live) st.date = Date.now(); else if (st.play) st.date += dt * 1000 * st.speed;
  setTideDate(st.date); stepWeather(dt);
  updateSky(st.date, wx);
  // lightning
  if (wx.storm > 0.5 && sky.day < 2) { flashT -= dt; if (flashT < 0) { flashT = 2 + Math.random() * 9; U.uFlash.value = 1; } }
  U.uFlash.value *= Math.exp(-dt * 9); if (U.uFlash.value < 0.003) U.uFlash.value = 0;

  const t = ride.active ? ride.pos : walk.active ? walk.pos : controls.target;
  if (ride.active) ride.control(dt); else if (walk.active) walk.update(dt); else {
  stepFly(dt);
  if (!fly) controls.update();
  // keep the pivot on the ground and the camera above it
  t.x = clamp(t.x, -T.sx / 2 - 6000, T.sx / 2 + 6000); t.z = clamp(t.z, -T.sz / 2 - 6000, T.sz / 2 + 6000);
  const gy = Math.max(meshY(t.x, t.z), U.uSeaM.value * VEX);
  if (!fly) t.y = lerp(t.y, gy, 0.2);
  const cy = Math.max(meshY(camera.position.x, camera.position.z), U.uSeaM.value * VEX) + 12;
  if (camera.position.y < cy) camera.position.y = cy;
  camera.lookAt(t);
  camera.updateMatrixWorld();
  }
  { const under = walk.active && walk.under; U.uUnder.value = under ? 1 : 0; dive.update(under, dt); }
  water.position.set(t.x, 0, t.z);
  followTerrain(t.x, t.z);

  features.update(dt, acc, camera, showLabels && !document.body.classList.contains('ui-off') || (showLabels && Q.get('labels') === '1'), t);
  boats.update(dt, acc, camera);
  clouds.update(dt, acc, camera, showClouds && !U.uUnder.value);
  const camDist = walk.active || ride.active ? 0 : camera.position.distanceTo(t);
  detail.update(t, camDist, acc, dt);
  life.update(dt, acc, t, camDist);
  if (ride.active) ride.update(dt, acc);       // the eye is placed last, once the thing you ride has moved
  sound.update({ x: t.x, z: t.z, dist: camDist, wind: wx.wind, wave: wx.wave, rain: wx.rain, dt });
  const e = sky.sunEl;
  { const k = clamp((e + 10) / 16, 0, 1); renderer.toneMappingExposure = lerp(1.7, EXPO, k * k * (3 - 2 * k)); }
  bloom.strength = lerp(0.5, 0.2, sky.day);
  composer.render();

  uiT -= dt; if (uiT < 0) { uiT = 0.25; layoutLeft(); syncTravel(); refreshClock(); $('wxTide').textContent = (wx.tide >= 0 ? '+' : '') + wx.tide.toFixed(1); const az = walk.active ? -walk.yaw : Math.atan2(camera.position.x - t.x, camera.position.z - t.z); $('compass').style.transform = `rotate(${az}rad)`; }
}
boot().catch((e) => { console.error(e); msg('Could not load the map: ' + e.message); });

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U, VEX, MOBILE, Q, TZ_HOURS, DETAIL, DETAIL_NAMES, dq, cullUnseen, clamp, lerp, expect, getBlob } from './common.js';
import { loadTerrainData, buildTerrain, followTerrain, meshY, heightAt, T } from './terrain.js';
import { buildWater } from './water.js';
import { buildSky, updateSky, sunPos, sky } from './sky.js';
import { wx, live, fetchWeather, stepWeather, setTideDate, freeTide, setMode, setCustom, seedCustom, custom, TYPES, current, describe, compass, mode, tideOn, tideHeld } from './weather.js';
import { TIDE_NORTH, TIDE_SOUTH } from './terrain.js';
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
import { buildPlanes } from './plane.js';
import { buildTraveller } from './traveller.js';
import { rideable, flyers } from './life.js';
import { carPace, probe, OPT } from './drive.js';
import { buildAboard } from './avatar.js';
import { buildSeabed } from './seabed.js';
import { makeGuide } from './guide.js';
import { spotSeabed } from './spot.js';
import { makeSpotting } from './spotting.js';
import { buildMinimap } from './minimap.js';
import { makeWindows } from './windows.js';
import { makeMenu } from './menu.js';

const $ = (id) => document.getElementById(id);
const msg = (t) => { const e = $('ldmsg'); if (e) e.textContent = t; };
let shownPct = 0;
const pct = (p) => { shownPct = Math.max(shownPct, Math.min(100, p)); const b = $('ldbar'), t = $('ldpct'); if (b) b.style.width = shownPct.toFixed(1) + '%'; if (t) t.textContent = Math.round(shownPct) + '%'; };
const paint = () => new Promise(r => setTimeout(r, 30));
if (Q.get('ui') === '0') document.body.classList.add('ui-off');
// the release number, shown under the title: it is the number this very file was loaded with (the one in index.html), so it cannot go stale
{ const v = (import.meta.url.match(/[?&]v=(\d+)/) || [])[1]; if (v) $('ver').textContent = 'version ' + v; }

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shot') });
const OPTS = { scale: 0, invX: false, invY: false, dot: false };          // what the Settings window holds (remembered between visits)
try { Object.assign(OPTS, JSON.parse(localStorage.getItem('opts') || '{}')); } catch (e) { /* storage can be blocked */ }
const DPR = Math.min(window.devicePixelRatio || 1, +(Q.get('dpr') || (MOBILE ? 1.5 : dq(1, 1.5, 2))));          // (the level of detail caps how sharp "automatic" is)
const pixelRatio = () => (OPTS.scale > 0 && !Q.has('dpr') ? clamp(OPTS.scale, 0.3, 3) : DPR);          // the Settings window can set how many picture points are drawn for each point of the screen
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

const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: MOBILE ? 2 : dq(2, 4, 4), stencilBuffer: true });
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
const ride = makeRide(camera, canvas, rideable, () => (boats ? boats.boats : []), { birds: flyers, others: () => [...(air ? air.planes : []), ...(trek ? trek.walkers : []), ...(aboard && aboard.av.on ? [aboard.av] : [])], showWalker: (v) => trek && trek.show(v), sea: () => U.uSeaM.value * VEX, ground: (x, z) => meshY(x, z), where: rideWhere, wind: () => `${compass(wx.windDir)} ${Math.round(wx.wind / 1.852)} kn`, depth: (x, z) => U.uSeaM.value - heightAt(x, z) });
function resize() {
  const w = +(Q.get('w') || window.innerWidth), h = +(Q.get('h') || window.innerHeight);
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h, false); composer.setPixelRatio(pixelRatio()); composer.setSize(w, h);
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
  $('wxSrc').textContent = mode === 'drift' ? 'Drifting weather' : mode === 'live' ? (live.ok ? `Live · feels ${Math.round(c.feels)}°` : 'Typical day (offline)') : mode === 'custom' ? 'Your weather' : 'Preset weather';
  $('wxWind').textContent = `${Math.round(c.wind)} ${compass(c.windDir)}`;
  $('wxArrow').style.transform = `rotate(${c.windDir + 180}deg)`;
  $('wxWave').textContent = c.wave.toFixed(1);
  $('wxTide').textContent = (c.tide >= 0 ? '+' : '') + c.tide.toFixed(1);
  $('wxCloud').textContent = Math.round(c.cloud);
  $('wxSea').textContent = Math.round(c.sst);
}
// The Tides & travel panel: the tide now and over the next half day, and what it means on the ground. The same numbers steer the 4WDs
// (see closeBeaches in features.js and the cars in life.js) and the boats (boats.js).
let condTick = 0;
const hhmm = (ms) => { const m = Math.round(minutesOf(ms)) % 1440; return String((m / 60) | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
function refreshCond() {
  const now = st.date, t = wx.tide, SPAN = 13 * 3600e3, N = 78, pts = [];
  for (let i = 0; i <= N; i++) pts.push(tideOn(now - 3600e3 + SPAN * i / N));
  const Y = (v) => 56 - (v + 1.25) / 2.5 * 52, X = (i) => 220 * i / N;
  $('cdLine').setAttribute('d', pts.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(''));
  const nx = 220 / 13; $('cdNow').setAttribute('x1', nx); $('cdNow').setAttribute('x2', nx);
  for (const [id, lim] of [['cdBandN', TIDE_NORTH], ['cdBandS', TIDE_SOUTH]]) { $(id).setAttribute('y', 0); $(id).setAttribute('height', Math.max(0, Y(lim)).toFixed(1)); }
  const rising = tideOn(now + 600e3) > tideOn(now - 600e3) + 0.004, falling = tideOn(now + 600e3) < tideOn(now - 600e3) - 0.004;
  $('cdTide').textContent = (t >= 0 ? '+' : '') + t.toFixed(1) + ' m';
  $('cdTrend').textContent = tideHeld() ? 'tide held by hand' : rising ? 'tide rising' : falling ? 'tide falling' : 'tide on the turn';
  let hi = null, lo = null;          // the next high and low water
  if (!tideHeld()) for (let k = 1; k < 90 && (hi === null || lo === null); k++) { const a = tideOn(now + (k - 1) * 600e3), b = tideOn(now + k * 600e3), c = tideOn(now + (k + 1) * 600e3); if (hi === null && b >= a && b > c) hi = now + k * 600e3; if (lo === null && b <= a && b < c) lo = now + k * 600e3; }
  $('cdHigh').textContent = hi ? hhmm(hi) : '--'; $('cdLow').textContent = lo ? hhmm(lo) : '--';
  { const c = current(); $('cdWind').textContent = Math.round(c.wind * 0.54) + ' kn ' + compass(c.windDir); }
  const row = (id, cls, txt) => { const li = $(id); li.className = cls; li.lastElementChild.textContent = txt; };
  row('cdEast', '', 'open'); row('cdTown', 'off', 'no vehicles');
  row('cdNorth', t > TIDE_NORTH ? 'shut' : t > TIDE_NORTH - 0.25 ? 'warn' : '', t > TIDE_NORTH ? 'shut' : t > TIDE_NORTH - 0.25 ? 'closing soon' : 'open');
  row('cdSouth', t > TIDE_SOUTH ? 'shut' : t > TIDE_SOUTH - 0.2 ? 'warn' : '', t > TIDE_SOUTH ? 'shut' : t > TIDE_SOUTH - 0.2 ? 'closing soon' : 'open');
  const inland = rideable.filter(c => c.onAlt).length, waiting = rideable.filter(c => c.waiting).length;
  row('cdCars', inland || waiting ? 'warn' : 'off', inland + ' inland, ' + waiting + ' waiting');
  const blow = wx.wind > 37 || wx.storm > 0.5; row('cdBoats', blow ? 'shut' : '', blow ? 'staying in' : 'out');
  const m = minutesOf(now); let mic = 'due 10:00', cls = 'off';
  if (m >= 560 && m < 600) { mic = 'coming in'; cls = ''; } else if (m >= 600 && m < 660) { mic = 'on the beach'; cls = ''; } else if (m >= 660 && m < 700) { mic = 'leaving'; cls = ''; }
  else if (m >= 830 && m < 870) { mic = 'coming in'; cls = ''; } else if (m >= 870 && m < 930) { mic = 'on the beach'; cls = ''; } else if (m >= 930 && m < 970) { mic = 'leaving'; cls = ''; }
  else if (m >= 700 && m < 830) mic = 'due 14:30'; else if (m >= 970) mic = 'due 10:00 tomorrow';
  row('cdMicat', cls, mic);
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
  if (aboard && hit.obj !== aboard.av) aboard.despawn();          // back in a vehicle: nobody is left standing outside
  fly = null; controls.enabled = false; controls.autoRotate = false; $('btSpin').classList.remove('on');
  ride.enter(hit); document.body.classList.add('riding'); dip();
}
// stepping into or out of a ride, the view comes up out of the dark instead of cutting
const veil = document.createElement('div'); veil.id = 'veil'; document.body.appendChild(veil);
const dip = () => { veil.classList.remove('dip'); void veil.offsetWidth; veil.classList.add('dip'); };
function exitRide() {
  if (!ride.active) return; dip(); if (tour.on && !tour.busy) stopTour();
  const m = (ride.car || ride.boat || ride.bird).m, yaw = m.rotation.y, far = ride.boat ? Math.max(140, (ride.boat.len || 12) * 6) : ride.bird ? 70 : 110; ride.exit(); controls.enabled = true; document.body.classList.remove('riding');
  controls.target.set(m.position.x, m.position.y, m.position.z);
  camera.position.set(m.position.x - Math.cos(yaw) * far, m.position.y + far * 0.55, m.position.z + Math.sin(yaw) * far);
  resize();
}
// A click on the mini map while you ride: whatever you are in heads for that spot. It takes the controls to do it, slows as it gets there and
// stops (a plane or a bird just comes over the spot); steer by hand, or leave, and it lets go. A car goes straight there over the ground.
let goal = null;
function headFor(x, z) { goal = { x, z, best: 1e9, since: acc }; if (!ride.helm) ride.take(true); syncTravel(); }
function stepGoal() {
  const halt = ride.halt; ride.halt = false;          // (Stop in the walking box, or a finger held on the view)
  if (!goal) return; if (!ride.active || !ride.helm || ride.steering || halt) { goal = null; ride.autoSteer = null; if (ride.bird) ride.bird.autoGo = false; return; }
  const o = ride.car || ride.boat || ride.bird, px = o.m.position.x, pz = o.m.position.z, hd = ride.car ? o.m.rotation.y : o.hd, d = Math.hypot(goal.x - px, goal.z - pz), foot = o.kind === 'person' || o.kind === 'walker';
  let e = Math.atan2(-(goal.z - pz), goal.x - px) - hd; e -= Math.PI * 2 * Math.round(e / (Math.PI * 2));
  ride.autoSteer = clamp(-e * 1.6, -1, 1);
  const near = ride.car ? 7 : ride.boat ? Math.max(14, (o.len || 10) * 0.8) : foot ? 2 : 70;
  if (ride.car && o.drive) o.drive.throttle = d < near ? 0 : d < 40 || Math.abs(e) > 1 ? 0.3 : Math.max(o.drive.throttle, 0.8);
  else if (ride.boat && o.helm) o.helm.throttle = d < near ? 0 : d < 60 ? 0.45 : 1;
  else if (o.kind === 'person') o.autoGo = d >= near; else if (foot) o.pace = d < near ? 0 : 1.7;
  if (d < goal.best - 4) { goal.best = d; goal.since = acc; }
  if (d < near || acc - goal.since > 12) { if (d >= near) { if (ride.car && o.drive) o.drive.throttle = 0; if (foot) o.pace = 0; } if (foot) o.autoGo = false; goal = null; ride.autoSteer = null; }          // there, or it cannot get any nearer (land in a boat's way, the sea or a tree in a car's)
}
// Getting out of the vehicle you are in (Leave the car / boat, the Get out button, or G): on foot beside a 4WD, in the water beside a boat,
// seen through your own eyes, as after a double-click on the ground, so W A S D walk you about; falling from a plane in flight, seen from behind.
const say = (txt) => { const h = $('hint'); h.textContent = txt; h.style.opacity = 1; clearTimeout(say.t); say.t = setTimeout(() => { h.style.opacity = 0; }, 6000); };
function getOut() {
  if (!ride.active || !aboard) return; const veh = ride.car || ride.boat || (ride.bird && ride.bird.kind === 'plane' ? ride.bird : null); if (!veh) return;
  const kind = ride.car ? 'car' : ride.boat ? 'boat' : 'plane', view = ride.zoom; stopTour(); exitRide();
  const me = aboard.leave(veh, kind); enterRide({ kind: 'bird', obj: me, control: true }); ride.setView(me.state === 'fall' ? 1 : 0); syncTravel();
}
// Leave the car / boat / yacht / jet ski steps out of it too (and a plane on the ground); Esc or M still go back up to the map
ride.onExit = () => { const veh = ride.car || ride.boat || (ride.bird && ride.bird.kind === 'plane' ? ride.bird : null); if (veh && aboard) getOut(); else exitRide(); };
{ const b = document.createElement('button'); b.id = 'getOut'; b.className = 'pill'; b.textContent = 'Get out'; b.title = 'Get out of the vehicle (G)'; b.onclick = getOut; document.body.appendChild(b); }
addEventListener('keydown', (e) => { if (e.code === 'KeyG' && ride.active) getOut(); });
// ---------- the Travel menu: go along with the nearest 4WD, boat, yacht, jet ski, pelican or sea eagle, watching or in control ----------
const TRAVEL = {
  car: () => rideable.map(o => ({ kind: 'car', obj: o })),
  boat: () => boats.boats.filter(b => b.move && !b.sail && !b.jet && !b.ferry).map(o => ({ kind: 'boat', obj: o })),
  yacht: () => boats.boats.filter(b => b.move && b.sail).map(o => ({ kind: 'boat', obj: o })),
  jetski: () => boats.boats.filter(b => b.jet).map(o => ({ kind: 'boat', obj: o })),
  pelican: () => flyers.filter(p => p.kind === 'pelican').map(o => ({ kind: 'bird', obj: o })),
  eagle: () => flyers.filter(p => p.kind === 'eagle').map(o => ({ kind: 'bird', obj: o })),
  plane: () => (air ? air.planes : []).map(o => ({ kind: 'bird', obj: o })),
  walker: () => (trek ? trek.walkers : []).map(o => ({ kind: 'bird', obj: o })),
};
const riding = () => (ride.active ? ride.car || ride.boat || ride.bird : null);
const travelKind = () => { const o = riding(); return !o ? '' : ride.car ? 'car' : ride.bird ? o.kind : o.jet ? 'jetski' : o.sail ? 'yacht' : o.ferry || o.anchor ? '' : 'boat'; };
const seenAt = [];
function travel(kind, control) {
  if (!boats) return; const list = TRAVEL[kind](); if (!list.length) return;
  const cur = riding(), at = list.findIndex(h => h.obj === cur);
  if (at >= 0 && ride.helm !== control) { ride.take(control); return syncTravel(); }        // already with one of these: just take or give back control
  let pick;
  if (at >= 0) pick = list[(at + 1) % list.length];                                          // asked again: on to the next one
  else {
    // not the nearest one every time (that kept you round Tangalooma): one somewhere else on the island, well away from where the last few rides were
    const far = (h) => seenAt.reduce((m, q) => Math.min(m, Math.hypot(h.obj.m.position.x - q[0], h.obj.m.position.z - q[1])), 1e9), few = list.slice().sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.ceil(list.length * 0.6)));
    pick = seenAt.length ? few.reduce((a, h) => (far(h) > far(a) ? h : a)) : few[0];
  }
  seenAt.push([pick.obj.m.position.x, pick.obj.m.position.z]); if (seenAt.length > 3) seenAt.shift();
  enterRide({ ...pick, control }); syncTravel();
  if (innerWidth < 640) { const tv = $('travel'); if (!tv.classList.contains('min')) tv.querySelector('.win-min')?.click(); }       // on a phone the list folds away once you have chosen, so you can see where you are
}
// How to control whatever you are doing just now: the map, walking, or the thing you ride, watching it or in control of it.
// It stays on screen (in its own panel over the control bar, which can be minimised) and changes as you change what you do.
let helpKey = '', wins = null;
function syncHelp() {
  const touch = matchMedia('(pointer: coarse)').matches, o = ride.active ? ride.car || ride.boat || ride.bird : null;
  const key = [touch, walk.active, ride.active, ride.helm, o && (o.kind || (o.jet ? 'jet' : o.sail ? 'sail' : '')), ride.car ? 1 : 0].join(); if (key === helpKey) return; helpKey = key;
  let name = 'Map', t;
  if (o) {
    const k = ride.car ? 'car' : ride.boat ? 'boat' : o.kind, canOut = !!(ride.car || ride.boat || k === 'plane');
    name = ride.car ? '4WD' : ride.boat ? (o.jet ? 'Jet ski' : o.sail ? 'Yacht' : o.ferry ? 'Ferry' : 'Boat') : ({ plane: 'Plane', pelican: 'Pelican', eagle: 'Sea eagle', walker: 'Traveller', person: 'On foot' }[k] || 'Bird');
    const out = canOut ? ' · G to get out' : '';
    if (touch && k === 'person') t = 'Hold a finger on the view to walk · hold it towards the left or the right to turn that way · the box at the bottom left has Forward, Left, Right, Stop and three speeds · pinch to see yourself from outside · double-tap a vehicle to get in';
    else if (touch) t = ride.helm ? 'In control · steer and change speed with the buttons at the bottom left · drag to look around · pinch to see it from outside' : 'Watching · drag to look around · pinch to see it from outside · the button at the bottom left gives you control';
    else if (!ride.helm) t = 'Watching · drag, or W A S D, to look around · scroll to see it from outside · H to take control' + out + ' · M for the map';
    else if (k === 'car') t = 'A D steer · W faster · S or down arrow brakes, stops, then reverses · hold Shift to go faster · H to let it drive itself' + out + ' · M for the map';
    else if (k === 'boat') t = 'A D steer · W faster · S or down arrow slows it to a stop · hold Shift to go faster · H to let it go on by itself' + out + ' · M for the map';
    else if (k === 'walker') t = 'A D turn · W faster · down arrow slower · hold Shift to run, S to slow down · H to let them walk on · M for the map';
    else if (k === 'person') t = 'Hold the mouse button on the view to walk, towards the left or the right to turn that way · or W to walk, A D to turn, S or down arrow to stop · the box at the bottom left has Forward, Stop and three speeds · hold Shift to go faster · scroll out to see yourself · double-click a vehicle to get in · M for the map';
    else t = 'A D turn · W climb · down arrow sink · hold Shift to go faster, S to go slower · H to let it fly on' + (k === 'plane' ? ' · land on a strip' : '') + out + ' · M for the map';
    t += touch ? ' · double-tap the mini map to head for that spot' : ' · double-click the mini map to head for that spot';
  } else if (walk.active) { name = 'Walking'; t = touch ? 'Put a finger on the view to walk · slide it sideways to steer, far up to run · two fingers: stand still and look around' : 'W A S D or arrows to move · Shift to run · Space to jump · click the view, then the mouse looks · M for the map · gamepad: sticks, A jump, RT run, B map'; }
  else t = touch ? 'Drag to move · twist two fingers to turn · pinch to zoom · double-tap a spot to stand there · double-tap a 4WD, a boat or a bird to go along, or use Travel · hold a finger still for a menu · drag any panel to move it, its corner to resize it' : 'W A S D or the arrow keys move the view, Q E turn it, Shift goes faster · drag to move · right-drag to turn · scroll to zoom · double-click a spot to stand there · double-click a 4WD, a boat or a bird to go along, or use Travel · right-click for a menu · drag any panel to move it, its corner to resize it';
  $('helpTxt').innerHTML = '<b>' + name + '</b> ' + t;
}
function syncTravel() {
  const k = travelKind(); document.body.classList.toggle('canOut', !!(ride.active && (ride.car || ride.boat || (ride.bird && ride.bird.kind === 'plane'))));
  for (const row of document.querySelectorAll('#travel .tv-row')) { const on = row.dataset.kind === k; row.classList.toggle('on', on); for (const b of row.querySelectorAll('button')) b.classList.toggle('on', on && (b.dataset.ctl === '1') === ride.helm); }
}
for (const b of document.querySelectorAll('#travel .tv-row button')) b.onclick = () => { stopTour(); travel(b.parentElement.dataset.kind, b.dataset.ctl === '1'); };
$('tvBack').onclick = () => { stopTour(); exitRide(); syncTravel(); };
// The tour: it takes each kind of travel in turn for the time you choose, a third of it looking out through the eyes, a third from close behind
// and a third from far behind, then moves on to the next, round and round until you stop it or take over.
const TOUR_KINDS = ['car', 'boat', 'yacht', 'jetski', 'pelican', 'eagle', 'plane', 'walker'], tour = { on: false, busy: false, k: -1, t: 0, lv: -1, secs: 30 };
function tourNext() {
  for (let n = 0; n < TOUR_KINDS.length; n++) {
    tour.k = (tour.k + 1) % TOUR_KINDS.length; const kind = TOUR_KINDS[tour.k]; if (!TRAVEL[kind]().length) continue;
    tour.busy = true; travel(kind, false); if (ride.helm) ride.take(false); tour.busy = false; tour.t = 0; tour.lv = 0; ride.setView(0); syncTravel(); return;
  }
  stopTour();
}
function tourTick(dt) {
  if (!ride.active) return stopTour();
  tour.t += dt; const lv = Math.min(2, Math.floor(tour.t / (tour.secs / 3)));
  if (lv !== tour.lv) { tour.lv = lv; ride.setView(lv); }
  if (tour.t >= tour.secs) tourNext();
}
function startTour() { if (!boats) return; tour.on = true; tour.k = -1; tour.secs = +$('tvSecs').value || 30; tourNext(); syncTour(); }
function stopTour() { if (!tour.on) return; tour.on = false; syncTour(); }
function syncTour() { const b = $('tvTour'); b.textContent = tour.on ? 'Stop the tour' : 'Tour them all'; b.classList.toggle('on', tour.on); }
$('tvTour').onclick = () => (tour.on ? (stopTour(), exitRide(), syncTravel()) : startTour());
$('tvSecs').onchange = () => { tour.secs = +$('tvSecs').value || 30; };
// how fast the 4WDs go on a clear straight (they slow by themselves for bends, slopes, rough or wet track and logs); remembered between visits
// (the same slider is shown again in the box at the bottom left while you are in a 4WD, where the Travel menu is usually folded away)
{ const sl = $('tvKmh'), box = document.createElement('label'); box.className = 'hm-speed'; box.title = sl.parentElement.title;
  box.innerHTML = '<span>4WD speed</span><output></output><input type="range" min="10" max="100" step="5">'; document.querySelector('#ride .helm').appendChild(box);
  const s2 = box.querySelector('input'), show = () => { carPace.kmh = +sl.value; s2.value = sl.value; $('tvKmhO').textContent = box.querySelector('output').textContent = sl.value + ' km/h'; };
  s2.oninput = () => { sl.value = s2.value; sl.oninput(); };
  try { const v = +localStorage.getItem('carKmh'); if (v >= 10 && v <= 100) sl.value = v; } catch (e) { /* storage can be blocked */ }
  sl.oninput = () => { show(); try { localStorage.setItem('carKmh', sl.value); } catch (e) { /* not remembered then */ } }; show(); }
// the left-hand column stacks: title, then Travel, then Places, whatever size each is just now
function layoutLeft() {
  const t = $('title'), tv = $('travel'), sg = $('settings'), pl = $('places'), riding = document.body.classList.contains('riding'), moved = (el) => el.classList.contains('moved');
  if (wins) wins.fit();
  if (!moved(t)) t.style.top = riding ? '52px' : '';
  let b = riding ? 50 : 10;          // (a panel dragged somewhere by hand is out of the column: the others close up)
  for (const el of [t, tv, sg]) { if (moved(el)) continue; if (el !== t) el.style.top = b + 'px'; const r = el.getBoundingClientRect(); if (r.height > 0) b = r.bottom + 8; }
  if (!moved(pl)) { pl.style.top = b + 'px'; pl.style.maxHeight = Math.max(80, Math.round(innerHeight - b - (riding ? (document.querySelector('#ride.person') ? 292 : 210) : 86))) + 'px'; }
  else pl.style.maxHeight = Math.max(80, Math.round((innerHeight - pl.getBoundingClientRect().top - 10) / wins.scale(pl))) + 'px';          // (while riding, the helm sits under the list)
  // the mini map sits in the bottom left corner; where the Places list reaches down that far it moves over to stand beside the list,
  // and on a narrow screen it goes under the Travel chip
  const mm = $('mini'), small = innerWidth <= 820, pr = pl.getBoundingClientRect(); if (mm.classList.contains('moved')) return;          // (dragged somewhere by hand: it stays there)
  mm.style.top = small ? b + 'px' : '';
  mm.style.left = !small && !moved(pl) && !document.body.classList.contains('riding') && pr.height > 0 && pr.bottom + 8 > innerHeight - 152 - mm.offsetHeight ? Math.round(pr.right + 8) + 'px' : '';
}
{ let down = null, last = null;    // two clicks (or taps) on the same spot, not a drag: on a 4WD, a boat or a bird to go along with it, on the ground or the sea to stand there
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    const onFoot = ride.active && ride.bird && ride.bird.kind === 'person';            // (on foot you can still pick a vehicle to get into)
    const finger = e.pointerType !== 'mouse';            // (a finger is less exact than a mouse, and a little slower)
    if (!down || e.button !== 0 || walk.active || (ride.active && !onFoot) || Math.hypot(e.clientX - down.x, e.clientY - down.y) > (finger ? 16 : 9) || performance.now() - down.t > 500) { down = null; return; }
    down = null; const now = performance.now();
    if (!(last && now - last.t < (finger ? 520 : 420) && Math.hypot(e.clientX - last.x, e.clientY - last.y) < (finger ? 46 : 30))) { last = { t: now, x: e.clientX, y: e.clientY }; return; }            // that was the first click: nothing happens until the second
    last = null; const hit = boats ? ride.pick(e.clientX, e.clientY) : null; if (hit && !(aboard && hit.obj === aboard.av)) return enterRide(hit);
    if (onFoot || !aboard) return;
    // the ground or the sea: you stand (or swim) there and see through your own eyes; scroll or pinch out to see yourself from behind
    const p = pickGround(camera, e.clientX, e.clientY); if (!p) return;
    camera.getWorldDirection(lookDir); enterRide({ kind: 'bird', obj: aboard.place(p.x, p.z, Math.atan2(-lookDir.z, lookDir.x)), control: true }); ride.setView(0); syncTravel();
  });
}
$('btWalk').onclick = () => { if (ride.active) exitRide(); if (walk.active) exitWalk(); else enterWalk(controls.target.x, controls.target.z); };
addEventListener('keydown', (e) => { if (e.code === 'Escape' && menu.open) return menu.hide(); if (ride.active && (e.code === 'Escape' || e.code === 'KeyM')) return exitRide(); if (walk.active && (e.code === 'KeyM' || (e.code === 'Escape' && document.pointerLockElement !== canvas))) exitWalk(); });
$('time').addEventListener('input', (e) => { st.live = false; st.play = false; setMinutes(+e.target.value); freeTide(); syncButtons(); syncWeatherUI(); });
$('btLive').onclick = () => { st.live = true; st.play = false; st.date = Date.now(); freeTide(); syncButtons(); syncWeatherUI(); };
$('btPlay').onclick = () => { st.play = !st.play; st.live = false; freeTide(); syncButtons(); syncWeatherUI(); };
function syncButtons() { $('btLive').classList.toggle('on', st.live); $('btPlay').classList.toggle('on', st.play); $('btPlay').textContent = st.play ? '❚❚ Day cycle' : '▶ Day cycle'; }
let showLabels = Q.get('labels') !== '0', showClouds = true;
$('btLabels').classList.toggle('on', showLabels);
$('btLabels').onclick = (e) => { showLabels = !showLabels; e.currentTarget.classList.toggle('on', showLabels); };
const guide = makeGuide(); $('btGuide').onclick = () => guide.toggle();
let spotter = null;
addEventListener('keydown', (e) => { if (e.code === 'Escape' && guide.isOpen) guide.close(); });
$('btClouds').onclick = (e) => { showClouds = !showClouds; e.currentTarget.classList.toggle('on', showClouds); };
$('btSpin').onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.currentTarget.classList.toggle('on', controls.autoRotate); };
$('btNorth').onclick = () => flyTo(controls.target.x, controls.target.z, camera.position.distanceTo(controls.target), 0, null);
// ---------- sound: off until the Sound button turns it on; if it was turned on last time, the first tap anywhere brings it back ----------
// (remembered as 'soundOn': the older 'sound', which every visit set by itself, is not read, so the map starts muted once for everyone)
const btSound = $('btSound');
const setSound = (v) => { if (sound.on !== v) sound.toggle(); btSound.classList.toggle('on', sound.on); try { localStorage.setItem('soundOn', sound.on ? '1' : '0'); } catch (e) { /* not remembered then */ } };
btSound.onclick = () => setSound(!sound.on);
// (Safari, and so every iPad, lets sound start only from a finished tap, a click or a key: a finger going down is not enough)
try { if (localStorage.getItem('soundOn') === '1') { const evs = ['pointerup', 'touchend', 'click', 'keydown'], go = (e) => { for (const ev of evs) removeEventListener(ev, go, true); if (e.target !== btSound && !sound.on) setSound(true); }; for (const ev of evs) addEventListener(ev, go, true); } } catch (e) { /* storage can be blocked */ }
for (const ev of ['pointerup', 'touchend', 'keydown']) addEventListener(ev, () => sound.wake(), true);          // (and after a phone call, or a drag that did not count as a tap, the next tap starts it again)
// ---------- the right mouse button: the app's own menu, in place of the browser's ("Save image as...") ----------
const menu = makeMenu();
const latLon = (x, z) => { const F = window.MAP.F, n = 2 ** 15, fx = (x - F.tx0) / F.tsize + F.tile0[0], fy = (z - F.tz0) / F.tsize + F.tile0[1]; return [Math.atan(Math.sinh(Math.PI * (1 - 2 * fy / n))) * 180 / Math.PI, fx / n * 360 - 180]; };
function openMenu(cx, cy, el) {
  const items = [], mm = $('mini'), onMini = mm.contains(el), busy = walk.active || ride.active;
  const p = !mini ? null : el === mini.canvas ? mini.at(cx, cy) : (el === canvas || $('labels').contains(el)) && !ride.active ? pickGround(camera, cx, cy) : null;
  if (p) {
    const ll = latLon(p.x, p.z), txt = ll[0].toFixed(5) + ', ' + ll[1].toFixed(5);
    items.push({ label: txt, note: 'copy', run: () => { navigator.clipboard?.writeText(txt).catch(() => { /* no clipboard here */ }); } });
    if (!ride.active) items.push({ label: 'Walk here', run: () => { if (walk.active) exitWalk(); enterWalk(p.x, p.z); } });
    if (!busy) {
      const d = camera.position.distanceTo(controls.target);
      items.push({ label: 'Centre the view here', run: () => flyTo(p.x, p.z, d, null, null, 1.2) });
      items.push({ label: 'Zoom in here', run: () => flyTo(p.x, p.z, Math.max(260, Math.min(d * 0.3, 2400)), null, null, 1.6) });
    }
    items.push(null);
  }
  if (p && onMini && ride.active) { items.push({ label: 'Head for this spot', run: () => headFor(p.x, p.z) }); items.push(null); }
  if (walk.active) items.push({ label: 'Back to the map', run: exitWalk });
  else if (ride.active) items.push({ label: 'Back to the map', run: () => { stopTour(); exitRide(); syncTravel(); } });
  else {
    items.push({ label: 'Face north', run: () => $('btNorth').click() });
    items.push({ label: 'Show the whole island', run: () => goPlace(features.places[0]) });
  }
  items.push(null);
  if (mini && onMini && !mm.classList.contains('min')) {
    if (mini.zoom < mini.max) items.push({ label: 'Zoom the mini map in', run: () => mini.zoomBy(1) });
    if (mini.zoom > 0) items.push({ label: 'Zoom the mini map out', run: () => mini.zoomBy(-1) });
  }
  if (wins && wins.anyMoved()) items.push({ label: 'Put every panel back in its place', run: () => wins.resetAll() });
  items.push({ label: mm.classList.contains('min') ? 'Show the mini map' : 'Hide the mini map', run: () => mm.querySelector('.win-min').click() });
  menu.show(cx, cy, items);
}
{ let rdown = null;
  addEventListener('pointerdown', (e) => { if (e.button === 2) rdown = { x: e.clientX, y: e.clientY }; }, true);
  addEventListener('contextmenu', (e) => {
    const el = e.target; if (el.closest && el.closest('a, textarea, input[type=text]')) return;          // a link keeps the browser's menu (copy its address)
    e.preventDefault();
    if (!features || e.pointerType === 'touch' || e.pointerType === 'pen' || document.pointerLockElement) return;      // a held finger is walking or panning, not asking for a menu
    if (rdown && Math.hypot(e.clientX - rdown.x, e.clientY - rdown.y) > 6) return;                          // the right button was dragged: that turned the view
    openMenu(e.clientX, e.clientY, el);
  }, true);
}
// A touch screen has no right button, and Safari on an iPad sends no menu event for a held finger: a finger held still on the map or the mini map
// for a little over half a second brings the menu up. (Not while you walk or steer: a held finger is doing that.)
{ let lp = null; const stop = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return; if (lp) return stop();          // (a second finger: that is a pinch or a twist)
    const el = e.target; if (!features || walk.active || (ride.active && ride.control) || (el !== canvas && !(el.closest && el.closest('#mini') && !el.closest('button')))) return;
    lp = { id: e.pointerId, x: e.clientX, y: e.clientY, t: setTimeout(() => { const q = lp; lp = null; if (q && !menu.open) openMenu(q.x, q.y, el); }, 600) };
  }, true);
  addEventListener('pointermove', (e) => { if (lp && e.pointerId === lp.id && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) stop(); }, true);
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, stop, true);
}
// Safari sends a pinch on a trackpad as its own gesture events and would zoom the whole page with it: the page stays as it is, and on a
// Mac the pinch zooms whatever is under the pointer, as the scroll wheel does. (On an iPad two fingers on the map already zoom it.)
{ let gs = 1; const GEST = 1900;
  addEventListener('gesturestart', (e) => { e.preventDefault(); gs = e.scale || 1; }, { passive: false });
  addEventListener('gesturechange', (e) => { e.preventDefault(); if (navigator.maxTouchPoints > 0) return; const s = e.scale || 1, el = document.elementFromPoint(e.clientX, e.clientY) || canvas;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -Math.log(s / gs) * (el.closest && el.closest('#mini') ? 260 : GEST), clientX: e.clientX, clientY: e.clientY, bubbles: true, cancelable: true })); gs = s; }, { passive: false });
  addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
}
// ---------- settings: how sharp the picture is drawn, the whole screen or the window, and which way the controls work ----------
function applyOpts(save) {
  OPT.invX = OPTS.invX ? -1 : 1; OPT.invY = OPTS.invY ? -1 : 1; resize();
  const w = +(Q.get('w') || innerWidth), h = +(Q.get('h') || innerHeight), r = pixelRatio();
  $('stScale').value = Math.round(r * 100); $('stScaleO').textContent = Math.round(r * 100) + '% · ' + Math.round(w * r) + ' × ' + Math.round(h * r);
  $('stInvX').checked = OPTS.invX; $('stInvY').checked = OPTS.invY; $('stDot').checked = OPTS.dot; document.body.classList.toggle('dot', !!OPTS.dot); $('stFull').textContent = fsEl() ? 'Back to a window' : 'Full screen'; $('stFull').classList.toggle('on', !!fsEl());
  if (save) try { localStorage.setItem('opts', JSON.stringify(OPTS)); } catch (e) { /* not remembered then */ }
}
$('stScale').oninput = (e) => { OPTS.scale = +e.target.value / 100; applyOpts(true); };
$('stAuto').onclick = () => { OPTS.scale = 0; applyOpts(true); };
$('stInvX').onchange = (e) => { OPTS.invX = e.target.checked; applyOpts(true); }; $('stInvY').onchange = (e) => { OPTS.invY = e.target.checked; applyOpts(true); };
$('stDot').onchange = (e) => { OPTS.dot = e.target.checked; applyOpts(true); };
// the level of detail: the scene is built to it, so picking another one loads the map again, and comes back to the same view
for (const b of $('stDetail').children) {
  b.classList.toggle('on', b.dataset.q === DETAIL_NAMES[DETAIL]);
  b.onclick = () => {
    if (b.dataset.q === DETAIL_NAMES[DETAIL] && !Q.has('q')) return;
    try { localStorage.setItem('detail', b.dataset.q); sessionStorage.setItem('view', JSON.stringify([...camera.position.toArray(), ...controls.target.toArray()].map(v => Math.round(v)))); } catch (e) { /* not remembered then */ }
    if (Q.has('q')) { const u = new URL(location.href); u.searchParams.delete('q'); location.replace(u.href); } else location.reload();
  };
}
function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }          // (older Safari knows the whole screen under its own name)
{ const d = document.documentElement, ask = d.requestFullscreen || d.webkitRequestFullscreen, leave = document.exitFullscreen || document.webkitExitFullscreen;
  if (!ask || navigator.standalone) $('stFull').hidden = true;          // an iPhone has no full screen, and the map opened from the home screen already fills it
  $('stFull').onclick = () => { try { const r = fsEl() ? leave.call(document) : ask.call(d); if (r && r.catch) r.catch(() => { /* not allowed here */ }); } catch (e) { /* not allowed here */ } };
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => applyOpts(false));
}
applyOpts(false);
// ---------- windows: each one can be shrunk to a small named chip and opened again (remembered between visits) ----------
if (innerWidth <= 820) $('mini').dataset.min = '1';
{ const hm = document.querySelector('#ride .helm'); hm.id = 'helmBox'; hm.classList.add('win'); hm.dataset.win = 'Steering'; }          // the steering box of a ride can be shrunk to a chip too          // on a phone the mini map starts as a chip
for (const w of document.querySelectorAll('.win')) {
  const b = document.createElement('button'), key = 'min:' + w.id, name = w.dataset.win;
  b.className = 'win-min'; b.innerHTML = `<span>${name}</span><i></i>`;
  const set = (m) => { w.classList.toggle('min', m); b.title = (m ? 'Show ' : 'Minimise ') + name; b.setAttribute('aria-expanded', String(!m)); };
  let saved = null; try { saved = localStorage.getItem(key); } catch (e) { /* storage can be blocked */ }
  set(saved === null ? w.dataset.min === '1' : saved === '1');          // the Travel menu starts as a chip; the rest start open
  b.onclick = () => { const m = !w.classList.contains('min'); set(m); try { localStorage.setItem(key, m ? '1' : '0'); } catch (e) { /* not remembered then */ } };
  w.append(b);
}
wins = makeWindows({ onChange: layoutLeft });          // every panel can be dragged about (also as a chip) and resized by its corner: see windows.js
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
const hideHint = () => { };          // (the opening hint is the How to control panel now, and stays)
canvas.addEventListener('pointerdown', () => { hideHint(); fly = null; }, { passive: true });
canvas.addEventListener('wheel', () => { hideHint(); fly = null; }, { passive: true });
setTimeout(hideHint, 9000);

// A place picked from the Places list. From the map the view flies there. On foot you are put down at the place, still on foot (in the water where it is the sea);
// walking in Walk mode likewise. From a vehicle, a boat or a bird you leave it and the map flies to the place. (Whole island always shows the map.)
function goPlace(p) {
  const whole = /Whole island/.test(p.n), me = ride.active && ride.bird && ride.bird.kind === 'person' ? ride.bird : null;
  if (me && !whole && aboard && me.state !== 'dead' && me.state !== 'fall') { const hd = me.hd; enterRide({ kind: 'bird', obj: aboard.place(p.x, p.z, hd), control: true }); ride.setView(0); syncTravel(); return; }
  if (walk.active && !whole) { exitWalk(); enterWalk(p.x, p.z); return; }
  if (walk.active) exitWalk(); if (ride.active) { stopTour(); exitRide(); syncTravel(); }
  flyTo(p.x, p.z, p.d, p.az, p.pol);
}
// ---------- camera flights ----------
let fly = null;
// W A S D (and the arrow keys) move the view over the map, the way they move you on foot or steer what you drive: W and S forward and back the way
// you are looking, A and D to the left and right, Q and E turn the view round, Shift goes faster. The further out you are, the further a key takes you.
const viewKeys = new Set(), VIEW_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
addEventListener('keydown', (e) => {
  if (walk.active || ride.active || menu.open || e.ctrlKey || e.metaKey || e.altKey || !VIEW_KEYS.has(e.code)) return;
  const el = e.target; if (el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) return;          // (typing in a box, or moving a slider with the arrows)
  viewKeys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => viewKeys.delete(e.code));
addEventListener('blur', () => viewKeys.clear());
const viewFwd = new THREE.Vector3();
function moveView(dt) {
  const K = (c) => viewKeys.has(c) ? 1 : 0;
  const f = K('KeyW') + K('ArrowUp') - K('KeyS') - K('ArrowDown'), r = K('KeyD') + K('ArrowRight') - K('KeyA') - K('ArrowLeft'), turn = K('KeyE') - K('KeyQ');
  if (!f && !r && !turn) return;
  fly = null; controls.autoRotate = false; $('btSpin').classList.remove('on');
  const t = controls.target, dist = camera.position.distanceTo(t), v = Math.max(dist * 0.85, 25) * (K('ShiftLeft') || K('ShiftRight') ? 2.6 : 1) * dt;
  viewFwd.subVectors(t, camera.position); viewFwd.y = 0; if (viewFwd.lengthSq() < 1e-6) viewFwd.set(0, 0, -1); viewFwd.normalize();
  let dx = (viewFwd.x * f - viewFwd.z * r) * v, dz = (viewFwd.z * f + viewFwd.x * r) * v;
  const lim = (a, h) => Math.max(-h, Math.min(h, a)), nx = lim(t.x + dx, T.sx / 2 - 100), nz = lim(t.z + dz, T.sz / 2 - 100); dx = nx - t.x; dz = nz - t.z;
  const dy = (Math.max(meshY(nx, nz), 0) - t.y) * Math.min(1, dt * 6);          // the view keeps to the ground as the land rises and falls under it
  t.x = nx; t.z = nz; t.y += dy; camera.position.x += dx; camera.position.z += dz; camera.position.y += dy;
  if (turn) { off.copy(camera.position).sub(t).applyAxisAngle(camera.up, -turn * dt * 1.3); camera.position.copy(t).add(off); }
}
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
let features, boats, clouds, water, detail, life, folk, air, trek, mini, aboard, seabed;
const lookDir = new THREE.Vector3();
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
  air = buildPlanes(scene, F);
  trek = buildTraveller(scene, F);
  aboard = buildAboard(scene, { cars: rideable, boats: () => boats.boats, planes: () => air.planes, ride });
  seabed = buildSeabed(scene, F, { wrecks: features.wrecks, plates: features.bulwerPlates, reefs: folk.reefs });
  spotSeabed(seabed.lists.crabs, seabed.lists.octos);
  spotter = makeSpotting({ camera, controls, walk, F, state: () => ({ walking: walk.active, riding: ride.active }), openGuide: (id) => guide.open(id) });
  clouds = buildClouds(scene, renderer);
  detail = buildDetail(F);
  mini = buildMinimap(F, {
    root: $('mini'), canvas: $('miniMap'),
    where: () => { const p = ride.active ? ride.pos : walk.active ? walk.pos : controls.target; camera.getWorldDirection(lookDir); return { x: p.x, z: p.z, hdg: Math.atan2(lookDir.x, -lookDir.z), near: ride.active || walk.active }; },
    go: (x, z) => { if (ride.active) headFor(x, z); else if (!walk.active) flyTo(x, z, camera.position.distanceTo(controls.target), null, null, 1.2); },
    goal: () => goal,
  });
  pct(98); msg('Checking the weather'); await paint();
  // quick-jump list
  const P = features.places;
  for (const p of P) { const b = document.createElement('button'); b.textContent = p.n; b.onclick = () => goPlace(p); $('places').appendChild(b); }
  if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); }
  else try { const c = JSON.parse(sessionStorage.getItem('view') || 'null'); sessionStorage.removeItem('view'); if (c && c.length === 6 && c.every(Number.isFinite)) { camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); } } catch (e) { /* the usual view then */ }          // back where it was before the level of detail was changed
  if (Q.has('go')) { const p = P.find(p => p.n.toLowerCase().startsWith(Q.get('go').toLowerCase())); if (p) flyTo(p.x, p.z, p.d, p.az, p.pol, 0.01); }
  fetchWeather().then(syncWeatherUI); setInterval(() => fetchWeather().then(syncWeatherUI), 15 * 60e3);
  refreshWeatherUI();
  syncWeatherUI();
  window.MAP = { camera, controls, scene, renderer, st, U, flyTo, features, boats, life, folk, dive, ride, rideable, flyers, enterRide, exitRide, sound, F, wx, walk, enterWalk, exitWalk, setCustom, setMode, T, sky, frame, setMinutes: (m) => { st.live = false; setMinutes(m); }, setDt: (v) => { forceDt = v; }, travel: (k, c) => travel(k, c), get air() { return air; }, get trek() { return trek; }, tour, startTour, stopTour, mini, menu, openMenu, seabed, aboard, guide, get spotter() { return spotter; } };
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

// ---------- "Loading": the first time a click brings something new into view (walking, a ride, a storm, a far place), the graphics card
// first has to get it ready, and the picture stops for a moment. So every click on a button (or double-click on the map) puts up a
// small box saying so: the next frame is skipped, so that the box is on screen before the slow one starts, and it goes once the
// frames come quickly again. It only fades in after a tenth of a second, so a click that sets off nothing slow never shows it.
const busy = document.createElement('div'); busy.id = 'busy'; busy.className = 'glass'; busy.innerHTML = '<i></i><span>Loading…</span>'; document.body.appendChild(busy);
const BUSY = { hold: 0, frames: 0, calm: 0, last: 0, typ: 20 };
function showBusy() { if (!busy.classList.contains('on')) { busy.classList.add('on'); BUSY.hold = 1; } BUSY.frames = 0; BUSY.calm = 0; }
addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) showBusy(); }, true);
canvas.addEventListener('dblclick', showBusy, true);
let acc = 0, uiT = 0, flashT = 0, forceDt = 0;
function frame() {
  { const now = performance.now(), gap = BUSY.last ? now - BUSY.last : 16; BUSY.last = now;
    if (BUSY.hold > 0 && !forceDt) { BUSY.hold--; return; }          // (this frame only lets the box be drawn)
    if (busy.classList.contains('on')) { BUSY.frames++; BUSY.calm = gap < Math.max(120, BUSY.typ * 2.5) ? BUSY.calm + 1 : 0; if ((BUSY.frames > 3 && BUSY.calm >= 3) || BUSY.frames > 900) busy.classList.remove('on'); }
    else if (gap < 1000) BUSY.typ += (gap - BUSY.typ) * 0.05; }          // (how long a frame usually takes on this machine)
  const dt = forceDt || Math.min(clock.getDelta(), 0.1);
  acc += dt; U.uTime.value = acc;
  if (st.live) st.date = Date.now(); else if (st.play) st.date += dt * 1000 * st.speed;
  setTideDate(st.date); stepWeather(dt);
  if (mode === 'drift' && (condTick % 40) === 1) { try { syncWeatherUI(); } catch (e) { /* panel not ready */ } }
  if (viewKeys.size) { if (walk.active || ride.active) viewKeys.clear(); else moveView(dt); }
  updateSky(st.date, wx);
  // lightning
  if (wx.storm > 0.5 && sky.day < 2) { flashT -= dt; if (flashT < 0) { flashT = 2 + Math.random() * 9; U.uFlash.value = 1; } }
  U.uFlash.value *= Math.exp(-dt * 9); if (U.uFlash.value < 0.003) U.uFlash.value = 0;

  const t = ride.active ? ride.pos : walk.active ? walk.pos : controls.target;
  stepGoal();
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
  boats.update(dt, acc, camera, minutesOf(st.date));
  if ((condTick = (condTick + 1) % 20) === 0) refreshCond();
  clouds.update(dt, acc, camera, showClouds && !U.uUnder.value);
  const camDist = walk.active || ride.active ? 0 : camera.position.distanceTo(t);
  detail.update(t, camDist, acc, dt);
  life.update(dt, acc, t, camDist, renderer);
  seabed.update(camDist);
  if (spotter) spotter.update(dt);
  // (only for what goes on the ground: someone walking, a 4WD being driven, the traveller; never for a boat, a bird or a plane)
  if (camDist < 200 && !ride.boat && !(ride.bird && ride.bird.kind !== 'walker' && ride.bird.kind !== 'person') && !(ride.car && !ride.car.drive)) probe.look(renderer, t.x, t.z);          // where the trees, big bushes and logs stand round the view, for whatever walks or drives there
  air.update(dt, acc); trek.update(dt, acc); aboard.update(dt, acc, t);
  if (aboard.av.dead > 6 && ride.bird === aboard.av) { exitRide(); aboard.despawn(); say('They fell to their death.'); }
  if (tour.on) tourTick(dt);
  if (ride.active) ride.update(dt, acc);       // the eye is placed last, once the thing you ride has moved
  sound.update({ x: t.x, z: t.z, dist: camDist, wind: wx.wind, wave: wx.wave, rain: wx.rain, dt });
  const e = sky.sunEl;
  { const k = clamp((e + 10) / 16, 0, 1); renderer.toneMappingExposure = lerp(1.7, EXPO, k * k * (3 - 2 * k)); }
  bloom.strength = lerp(0.5, 0.2, sky.day);
  cullUnseen(camera);          // whatever is out of view or too far off to be drawn is skipped whole
  composer.render();
  mini.update(dt);

  uiT -= dt; if (uiT < 0) { uiT = 0.25; layoutLeft(); syncTravel(); syncHelp(); refreshClock(); $('wxTide').textContent = (wx.tide >= 0 ? '+' : '') + wx.tide.toFixed(1); const az = walk.active ? -walk.yaw : Math.atan2(camera.position.x - t.x, camera.position.z - t.z); $('compass').style.transform = `rotate(${az}rad)`; }
}
boot().catch((e) => { console.error(e); msg('Could not load the map: ' + e.message); });

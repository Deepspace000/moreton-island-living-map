import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U, VEX, MOBILE, Q, TZ_HOURS, clamp, lerp } from './common.js';
import { loadTerrainData, buildTerrain, meshY, T } from './terrain.js';
import { buildWater } from './water.js';
import { buildSky, updateSky, sunPos, sky } from './sky.js';
import { wx, live, fetchWeather, stepWeather, setMode, current, describe, compass, mode } from './weather.js';
import { buildFeatures } from './features.js';
import { buildBoats } from './boats.js';
import { buildClouds } from './clouds.js';

const $ = (id) => document.getElementById(id);
const msg = (t) => { $('ldmsg').textContent = t; };
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
function resize() {
  const w = +(Q.get('w') || window.innerWidth), h = +(Q.get('h') || window.innerHeight);
  renderer.setSize(w, h, false); composer.setPixelRatio(DPR); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 50 : 38; camera.updateProjectionMatrix();
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
  $('wxSrc').textContent = mode === 'live' ? (live.ok ? `Live · feels ${Math.round(c.feels)}°` : 'Typical day (offline)') : 'Preview weather';
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
$('wxMode').addEventListener('click', (e) => { const m = e.target.dataset.m; if (!m) return; setMode(m); [...$('wxMode').children].forEach(b => b.classList.toggle('on', b === e.target)); refreshWeatherUI(); });
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
let features, boats, clouds, water;
const clock = new THREE.Clock();
async function boot() {
  const F = await (await fetch('assets/features.json')).json();
  await loadTerrainData(F, msg);
  buildSky(scene);
  buildTerrain(scene);
  water = buildWater(scene);
  msg('Raising buildings, tracks and wrecks');
  await new Promise(r => setTimeout(r, 30));
  features = buildFeatures(scene, F, flyTo);
  boats = buildBoats(scene, F);
  clouds = buildClouds(scene, renderer);
  // quick-jump list
  const P = features.places;
  for (const p of P) { const b = document.createElement('button'); b.textContent = p.n; b.onclick = () => flyTo(p.x, p.z, p.d, p.az, p.pol); $('places').appendChild(b); }
  if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); }
  if (Q.has('go')) { const p = P.find(p => p.n.toLowerCase().startsWith(Q.get('go').toLowerCase())); if (p) flyTo(p.x, p.z, p.d, p.az, p.pol, 0.01); }
  fetchWeather().then(refreshWeatherUI); setInterval(() => fetchWeather().then(refreshWeatherUI), 15 * 60e3);
  refreshWeatherUI();
  window.MAP = { camera, controls, scene, renderer, st, U, flyTo, features, boats, wx, setMode, T, sky, frame, setMinutes: (m) => { st.live = false; setMinutes(m); } };
  // review helper: pose the scene, let it settle, post the frame to the local receiver
  window.MAP.shot = async (name, o = {}) => {
    if (o.cam) { camera.position.set(o.cam[0], o.cam[1], o.cam[2]); controls.target.set(o.cam[3], o.cam[4], o.cam[5]); }
    if (o.min != null) { st.live = false; st.play = false; setMinutes(o.min); }
    if (o.wx) setMode(o.wx);
    fly = null; forceDt = 1.2; for (let i = 0; i < 14; i++) frame(); forceDt = 0.016; for (let i = 0; i < 3; i++) frame(); forceDt = 0;
    const r = await fetch('http://127.0.0.1:8765/' + name, { method: 'POST', body: canvas.toDataURL('image/jpeg', 0.93) });
    return name + ' ' + r.status;
  };
  renderer.setAnimationLoop(frame);
  if (Q.has('shot')) $('loading').remove(); else { $('loading').style.opacity = 0; $('loading').style.pointerEvents = 'none'; setTimeout(() => $('loading')?.remove(), 1600); }
}

let acc = 0, uiT = 0, flashT = 0, forceDt = 0;
function frame() {
  const dt = forceDt || Math.min(clock.getDelta(), 0.1);
  acc += dt; U.uTime.value = acc;
  if (st.live) st.date = Date.now(); else if (st.play) st.date += dt * 1000 * st.speed;
  stepWeather(dt);
  updateSky(st.date, wx);
  // lightning
  if (wx.storm > 0.5 && sky.day < 2) { flashT -= dt; if (flashT < 0) { flashT = 2 + Math.random() * 9; U.uFlash.value = 1; } }
  U.uFlash.value *= Math.exp(-dt * 9); if (U.uFlash.value < 0.003) U.uFlash.value = 0;

  stepFly(dt);
  if (!fly) controls.update();
  // keep the pivot on the ground and the camera above it
  const t = controls.target;
  t.x = clamp(t.x, -T.sx / 2 - 6000, T.sx / 2 + 6000); t.z = clamp(t.z, -T.sz / 2 - 6000, T.sz / 2 + 6000);
  const gy = Math.max(meshY(t.x, t.z), U.uSeaM.value * VEX);
  if (!fly) t.y = lerp(t.y, gy, 0.2);
  const cy = Math.max(meshY(camera.position.x, camera.position.z), U.uSeaM.value * VEX) + 12;
  if (camera.position.y < cy) camera.position.y = cy;
  camera.lookAt(t);
  camera.updateMatrixWorld();
  water.position.set(t.x, 0, t.z);

  features.update(dt, acc, camera, showLabels && !document.body.classList.contains('ui-off') || (showLabels && Q.get('labels') === '1'), t);
  boats.update(dt, acc, camera);
  clouds.update(dt, acc, camera, showClouds);
  const e = sky.sunEl;
  { const k = clamp((e + 10) / 16, 0, 1); renderer.toneMappingExposure = lerp(1.7, EXPO, k * k * (3 - 2 * k)); }
  bloom.strength = lerp(0.5, 0.2, sky.day);
  composer.render();

  uiT -= dt; if (uiT < 0) { uiT = 0.25; refreshClock(); const az = Math.atan2(camera.position.x - t.x, camera.position.z - t.z); $('compass').style.transform = `rotate(${az}rad)`; }
}
boot().catch((e) => { console.error(e); msg('Could not load the map: ' + e.message); });

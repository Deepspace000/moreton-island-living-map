// Windows wrapper for the Moreton Island living map. It serves the map's own files through a private app:// address, so the
// map runs exactly as it does on the web (script modules, fetch and images all work, with no server), and everything but the
// live weather works offline. The web version is untouched.
const { app, BrowserWindow, protocol, net, Menu, shell, dialog } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SMOKE = !!process.env.MORETON_SMOKETEST;          // test run: open the map, wait until it is drawn, print a short report and quit
// in development the map is the folder above; in a built app it is copied into resources/map by prepare.js
const BUNDLED = process.env.MORETON_MAP_DIR ? path.resolve(process.env.MORETON_MAP_DIR) : app.isPackaged ? path.join(process.resourcesPath, 'map') : path.resolve(__dirname, '..');
if (process.env.MORETON_USERDATA) app.setPath('userData', path.resolve(process.env.MORETON_USERDATA));

// Updates. A built program holds the map as it was built; at each start, before the map loads, it looks at the map's own website
// for a newer release (update.json: the release number and a hash for every file), downloads only the files that differ into
// <data folder>/updates/<release>, and starts on it (see startUp). The newest release found, bundled or downloaded, is the one shown.
const UPDATE_URL = (process.env.MORETON_UPDATE_URL || 'https://deepspace000.github.io/moreton-island-living-map/').replace(/\/?$/, '/');
const UPDATES = path.join(app.getPath('userData'), 'updates');
const readManifest = (dir) => { try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'update.json'), 'utf8')); return m && m.release && m.files ? m : null; } catch (e) { return null; } };
const hashOf = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
function pickMapDir() {
  if (process.env.MORETON_MAP_DIR || !app.isPackaged) return BUNDLED;
  let best = BUNDLED, rel = (readManifest(BUNDLED) || {}).release || 0;
  try {
    for (const d of fs.readdirSync(UPDATES)) {
      const dir = path.join(UPDATES, d), m = readManifest(dir);
      if (m && m.release > rel && !fs.existsSync(path.join(dir, '.partial'))) { best = dir; rel = m.release; }
    }
    for (const d of fs.readdirSync(UPDATES)) { const dir = path.join(UPDATES, d); if (dir !== best) fs.rmSync(dir, { recursive: true, force: true }); }          // older or half-finished downloads
  } catch (e) { /* no updates folder yet */ }
  return best;
}
let MAP_DIR = pickMapDir();
const HOME = 'app://map/';

// a laptop with two graphics chips would otherwise draw the map on the weak one
app.commandLine.appendSwitch('force_high_performance_gpu');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

// only one map at a time: starting it again brings the open window forward
if (!app.requestSingleInstanceLock()) app.quit();
let win = null;
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

// The start. Before the map loads, the window shows a small page of its own that looks for a newer release, downloads it with a
// progress bar, and only then starts the map, on the new release. With no connection, or if the site is slow to answer, the
// map starts at once with what the program holds. "Start now" skips the wait: the download carries on behind the map and the
// new release is offered when it is in.
const SPLASH = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>Moreton Island</title>
<style>html,body{margin:0;height:100%;background:radial-gradient(ellipse at center,#0d3a50 0%,#06202e 70%);color:#e8f3f6;font:15px/1.4 "Segoe UI",system-ui,sans-serif;user-select:none;cursor:default}
.b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,80vw);text-align:center}
.t{font-size:34px;font-weight:300;letter-spacing:.04em}.s{margin:4px 0 26px;font-size:11px;letter-spacing:.3em;color:#9fc3cf}
.bar{height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}.bar i{display:block;height:100%;width:0;background:#5fd4e6;transition:width .2s}
#m{margin-top:14px;font-size:13px;color:#cfe3ea;min-height:1.4em}
button{margin-top:18px;padding:6px 16px;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(255,255,255,.08);color:#e8f3f6;font:inherit;font-size:12px;cursor:pointer}
button:hover{background:rgba(255,255,255,.16)}</style>
<div class="b"><div class="t">Moreton Island</div><div class="s">MULGUMPIN · QUEENSLAND</div><div class="bar"><i id="p"></i></div><div id="m">Checking for updates…</div><button id="go" hidden>Start now</button></div>
<script>window.set=(m,p,go)=>{document.getElementById('m').textContent=m;if(p!=null)document.getElementById('p').style.width=(p*100).toFixed(1)+'%';document.getElementById('go').hidden=!go;};
document.getElementById('go').onclick=()=>{document.title='skip';};</script>`);
let onSplash = false, started = false;
const splash = (msg, p = null, go = false) => { if (onSplash && win && !win.isDestroyed()) win.webContents.executeJavaScript(`window.set && window.set(${JSON.stringify(msg)}, ${p == null ? 'null' : Number(p)}, ${!!go})`).catch(() => {}); };
const updatesOn = () => !process.env.MORETON_MAP_DIR && (app.isPackaged || !!process.env.MORETON_UPDATE_URL) && !(SMOKE && !process.env.MORETON_UPDATE_URL);
function startMap() {
  if (started || !win) return; started = true; onSplash = false;
  win.loadURL(HOME + 'index.html');
  if (SMOKE) smoke(win);
  if (process.env.MORETON_UPDATE_AUTO) win.webContents.once('did-finish-load', async () => { await new Promise(r => setTimeout(r, 3000)); console.log('AFTER-START ver', await win.webContents.executeJavaScript(`(document.getElementById('ver')||{}).textContent`).catch(() => '?')); app.quit(); });          // (self-test: report the release it started on, and quit)
}
async function startUp() {
  if (!updatesOn()) return startMap();
  onSplash = true;
  win.loadURL(SPLASH);
  await new Promise(r => win.webContents.once('did-finish-load', r));
  await checkForUpdate({ startup: true });
  if (started) return;          // "Start now" was pressed
  if (ready) { MAP_DIR = ready; ready = null; splash('Starting the new release…', 1); await new Promise(r => setTimeout(r, 400)); }
  startMap();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 720, minHeight: 480,
    backgroundColor: '#06202e', title: 'Moreton Island · Living Map', autoHideMenuBar: true, show: false,
    icon: path.join(BUNDLED, 'icon-512.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !SMOKE },          // (a self-test window behind others must still be drawn, for its picture)
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // the window only ever shows the map itself; the links in the credits (imagery, map data, weather) open in the usual browser
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(HOME)) { e.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.key === 'F5') win.webContents.reload();
  });
  win.on('closed', () => { win = null; });
  win.on('page-title-updated', (e, title) => { if (onSplash) { e.preventDefault(); if (title === 'skip') startMap(); } });          // (the start page keeps the window's own title; "Start now" says so through it)
  startUp();
}

// (MORETON_SMOKETEST=1) what the map itself says once it is up: its release, the level of detail, the graphics chip, and any errors
function smoke(w) {
  const errors = [];
  w.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) errors.push(msg); });
  w.webContents.once('did-finish-load', async () => {
    const info = await w.webContents.executeJavaScript(`new Promise((done) => { const t0 = Date.now(), look = () => {
      const up = window.MAP && !document.getElementById('loading');
      if (!up && Date.now() - t0 < 90000) return setTimeout(look, 500);
      const out = { up: !!up, secs: Math.round((Date.now() - t0) / 1000), title: document.title, release: (document.getElementById('ver') || {}).textContent, message: (document.getElementById('ldmsg') || {}).textContent || '' };
      if (up) { const M = window.MAP, gl = M.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info');
        out.gpu = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; out.places = M.features.places.length;
        out.detail = [...document.getElementById('stDetail').children].filter(b => b.classList.contains('on')).map(b => b.textContent).join('');
        out.canvas = [M.renderer.domElement.width, M.renderer.domElement.height]; out.weather = document.getElementById('wxDesc').textContent;
        // every drawn thing must have a shape (release 124 lost the trees' through a slip of the pen), and for the picture the view goes down among the trees
        out.shapeless = 0; M.scene.traverse((o) => { if ((o.isMesh || o.isPoints) && !(o.geometry && o.geometry.attributes.position)) out.shapeless++; });
        M.setMinutes(11 * 60); M.flyTo(-1560, -470, 330, 200, 74, 0.01); setTimeout(() => done(out), 4000); return; }
      done(out); }; look(); })`).catch(e => ({ err: String(e) }));
    if (process.env.MORETON_SMOKE_SHOT) try { fs.writeFileSync(process.env.MORETON_SMOKE_SHOT, (await w.webContents.capturePage()).toJPEG(88)); } catch (e) { errors.push('picture: ' + e.message); }
    console.log('SMOKE', JSON.stringify(info), 'errors:', errors.length);
    errors.slice(0, 5).forEach(m => console.log('ERR', m));
    if (process.env.MORETON_SMOKE_OUT) fs.writeFileSync(process.env.MORETON_SMOKE_OUT, JSON.stringify({ ...info, packaged: app.isPackaged, exe: process.execPath, errors }, null, 1));          // (the portable .exe starts the map from a launcher that prints nothing)
    app.quit();
  });
}

let ready = null, busy = false;          // ready: the folder of a downloaded release that is waiting to be loaded
async function getBuf(url, ms = 60000) { const r = await net.fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'cache-control': 'no-cache' } }); if (!r.ok) throw new Error(url + ' ' + r.status); return Buffer.from(await r.arrayBuffer()); }
// Looks for a newer release and downloads it. At the start (startup) the start page shows how far it has got, and the release is
// loaded by startUp; once the map is running, it is offered with "Load it now / Later" instead.
async function checkForUpdate({ startup = false } = {}) {
  if (busy || ready || !updatesOn()) return;
  busy = true;
  try {
    const have = readManifest(MAP_DIR);
    if (!have) return;
    const want = JSON.parse((await getBuf(UPDATE_URL + 'update.json?t=' + Date.now(), startup ? 6000 : 30000)).toString('utf8'));          // (at the start, a slow answer is not waited for)
    if (!want || !(want.release > have.release) || !want.files) { splash('Up to date', 1); return; }
    const dir = path.join(UPDATES, String(want.release));
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.partial'), '');          // until every file is in, a start must not use this folder
    // the files that are the same as the ones held are copied across; only the others are downloaded
    const todo = [];
    for (const [rel, [size, h]] of Object.entries(want.files)) {
      const dest = path.resolve(dir, rel);
      if (!dest.startsWith(dir + path.sep)) throw new Error('bad path ' + rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const old = have.files[rel];
      if (old && old[1] === h && old[0] === size) { try { fs.copyFileSync(path.join(MAP_DIR, rel), dest); if (hashOf(fs.readFileSync(dest)) === h) continue; } catch (e) { /* fall through and download it */ } }
      todo.push([rel, size, h, dest]);
    }
    const total = todo.reduce((s, t) => s + t[1], 0) || 1, MB = (b) => (b / 1048576).toFixed(1);
    let got = 0;
    const show = () => splash(`Downloading release ${want.release}: ${MB(got)} of ${MB(total)} MB`, got / total, true);
    show();
    const worker = async () => { while (todo.length) {          // four at a time
      const [rel, size, h, dest] = todo.shift(), buf = await getBuf(UPDATE_URL + rel.split('/').map(encodeURIComponent).join('/'));
      if (buf.length !== size || hashOf(buf) !== h) throw new Error('wrong file ' + rel);
      fs.writeFileSync(dest, buf); got += size; show(); } };
    const n = todo.length;
    await Promise.all([worker(), worker(), worker(), worker()]);
    fs.writeFileSync(path.join(dir, 'update.json'), JSON.stringify(want));
    fs.rmSync(path.join(dir, '.partial'));
    ready = dir;
    console.log(`UPDATE release ${want.release} downloaded (${n} new files, ${MB(total)} MB)`);
    if ((startup && !started) || SMOKE) return;          // (at the start, startUp loads it)
    const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Load it now', 'Later'], defaultId: 0, cancelId: 1, title: 'Moreton Island', message: `A newer map is ready (release ${want.release}).`, detail: 'Load it now, or it opens the next time you start the program. Your settings are kept.' });
    if (r.response === 0 && win) { MAP_DIR = ready; ready = null; win.webContents.reloadIgnoringCache(); }
  } catch (e) { console.log('UPDATE skipped:', e.message); }          // offline, or the site is mid-publish: the map starts as it is, and it tries again later
  finally { busy = false; }
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const root = path.resolve(MAP_DIR) + path.sep;
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (rel === '') rel = 'index.html';
    const file = path.resolve(root, rel);
    if (u.host !== 'map' || !file.startsWith(root)) return new Response('Forbidden', { status: 403 });          // nothing outside the map's own folder
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();          // (which looks for an update before the map starts)
  setInterval(checkForUpdate, 4 * 3600 * 1000);          // and again every four hours while it runs
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

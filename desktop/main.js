// Windows wrapper for the Moreton Island living map. It serves the map's own files through a private app:// address, so the
// map runs exactly as it does on the web (script modules, fetch and images all work, with no server), and everything but the
// live weather works offline. The web version is untouched.
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SMOKE = !!process.env.MORETON_SMOKETEST;          // test run: open the map, wait until it is drawn, print a short report and quit
// in development the map is the folder above; in a built app it is copied into resources/map by prepare.js
const MAP_DIR = process.env.MORETON_MAP_DIR ? path.resolve(process.env.MORETON_MAP_DIR) : app.isPackaged ? path.join(process.resourcesPath, 'map') : path.resolve(__dirname, '..');
if (process.env.MORETON_USERDATA) app.setPath('userData', path.resolve(process.env.MORETON_USERDATA));
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

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 720, minHeight: 480,
    backgroundColor: '#06202e', title: 'Moreton Island · Living Map', autoHideMenuBar: true, show: false,
    icon: path.join(MAP_DIR, 'icon-512.png'),
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
  win.loadURL(HOME + 'index.html');
  if (SMOKE) smoke(win);
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

app.whenReady().then(() => {
  const root = path.resolve(MAP_DIR) + path.sep;
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (rel === '') rel = 'index.html';
    const file = path.resolve(root, rel);
    if (u.host !== 'map' || !file.startsWith(root)) return new Response('Forbidden', { status: 403 });          // nothing outside the map's own folder
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

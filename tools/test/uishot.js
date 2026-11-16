const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); });
  await p.goto('http://127.0.0.1:8931/index.html?shot&dpr=1&w=1280&h=760', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 0, polling: 500 });
  await p.evaluate(async () => { const M = MAP, t = M.features.places.find(q => /Tangalooma/.test(q.n)); M.setMinutes(620); M.setMode('clear');
    M.camera.position.set(t.x - 520, 150, t.z - 1500); M.controls.target.set(t.x - 330, 0, t.z - 1900);
    for (let i = 0; i < 3; i++) { M.frame(); await new Promise(r => setTimeout(r, 900)); }
    const tgt = M.controls.target; for (let i = 0; i < 1500; i++) M.life.update(0.25, i * 0.25, tgt, 0); for (let i = 0; i < 25; i++) M.frame(); });
  await p.screenshot({ path: 'ui_panel.jpg', type: 'jpeg', quality: 90 });
  await p.evaluate(() => { document.querySelector('#cond .win-min').click(); MAP.frame(); });
  await p.screenshot({ path: 'ui_panel_min.jpg', type: 'jpeg', quality: 90 });
  const box = await p.evaluate(() => { document.querySelector('#cond .win-min').click(); const r = (id) => { const e = document.getElementById(id).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.top), Math.round(e.right), Math.round(e.bottom)]; }; return JSON.stringify({ cond: r('cond'), wx: r('wx'), bar: r('bar'), travel: r('travel') }); });
  console.log(box, 'errors', errs);
  await b.close();
})();

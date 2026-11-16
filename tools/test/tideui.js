const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('tideui.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(() => {
    const M = MAP, out = [], fr = (n) => { for (let i = 0; i < n; i++) { M.setDt(0.5); M.frame(); M.setDt(0); } }, sea = () => M.U.uSeaM.value.toFixed(2);
    const time = document.getElementById('time'), setT = (m) => { time.value = m; time.dispatchEvent(new Event('input', { bubbles: true })); fr(40); };
    fr(20); out.push('on opening (live, no network here): sea ' + sea());
    const seq = []; for (const m of [0, 180, 360, 540, 720, 900, 1080, 1260]) { setT(m); seq.push((m / 60) + 'h ' + sea()); } out.push('time slider: ' + seq.join(' | '));
    const sl = [...document.querySelectorAll('input[type=range]')].find(e => /tide/i.test(e.id)); out.push('tide slider id: ' + (sl && sl.id));
    if (sl) { sl.value = 1.3; sl.dispatchEvent(new Event('input', { bubbles: true })); fr(40); out.push('tide slider pushed to its top: sea ' + sea()); setT(420); out.push('then the time is moved to 7h: sea ' + sea() + ' (back on the clock)'); setT(780); out.push('and to 13h: sea ' + sea()); }
    return out.join('\n');
  });
  fs.appendFileSync('tideui.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 3)) + '\n'); await b.close();
})();

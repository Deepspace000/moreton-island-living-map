const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('camptest.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(() => {
    const M = MAP, out = [], w = M.trek.walkers[0], fr = (n) => { for (let i = 0; i < n; i++) { M.setDt(0.1); M.frame(); M.setDt(0); } }, st = () => `camped ${w.camped}, tent up ${M.trek.tent.visible}, speed ${w.v.toFixed(2)}`;
    M.setMinutes(1320); M.travel('walker', false); fr(40); out.push('night ' + M.U.uNight.value.toFixed(2) + ', left alone for 4 s: ' + st());
    const btn = document.querySelector('#hmCamp'); out.push('button says "' + btn.textContent + '"'); btn.click(); fr(1); out.push('pressed it; next frame: ' + st()); fr(60); out.push('6 s later: ' + st() + ', button "' + btn.textContent + '"');
    fr(600); out.push('a minute later, still night: ' + st());
    btn.click(); fr(30); out.push('pressed Camp again: ' + st()); btn.click(); fr(30); out.push('pressed Break camp again: ' + st());
    M.setMinutes(720); fr(20); M.setMinutes(1320); fr(40); out.push('after a day has passed, the next night: ' + st());
    const L = M.U.uCarL.value; out.push('headlamps lit at night: ' + L.filter(v => v.z * v.z + v.w * v.w > 0.5).length + ' of 8; first at ' + L[0].x.toFixed(0) + ', ' + L[0].y.toFixed(0));
    M.setMinutes(720); fr(3); out.push('headlamps lit at noon: ' + M.U.uCarL.value.filter(v => v.z * v.z + v.w * v.w > 0.5).length);
    return out.join('\n');
  });
  fs.appendFileSync('camptest.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 3)) + '\n'); await b.close();
})();

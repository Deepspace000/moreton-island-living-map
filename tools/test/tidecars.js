const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); p.setDefaultTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot&x=' + Date.now(), { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  for (const tide of [0.9, -0.2, -0.9]) {
    console.log(await p.evaluate(async (tide) => { const M = MAP; M.setCustom('tide', tide); M.wx.tide = tide; M.U.uSeaM.value = tide; const tgt = M.controls.target;
      for (let i = 0; i < 4000; i++) { M.U.uSeaM.value = tide; M.life.update(0.25, i * 0.25, tgt, 0); }
      M.frame(); await new Promise(r => setTimeout(r, 50)); for (let i = 0; i < 25; i++) M.frame();
      const cars = M.rideable, west = cars.filter(c => c.side < 0);
      const txt = [...document.querySelectorAll('#cdList li')].map(li => li.className.padEnd(5) + li.textContent.trim().replace(/\s+/g, ' ')).join(' | ');
      return 'tide ' + tide + ': west cars ' + west.length + ', on inland tracks ' + cars.filter(c => c.onAlt).length + ', waiting ' + cars.filter(c => c.waiting).length + ', stopped on a shut stretch with a way round: ' + west.filter(c => !c.onAlt && (c.tidal || []).some(s => s.alt && M.U.uSeaM.value > s.thr && c.s > s.s0 + 60 && c.s < s.s1 - 60)).length + '\n   panel: ' + document.getElementById('cdTide').textContent + ' ' + document.getElementById('cdTrend').textContent + ' | ' + txt; }, tide));
  }
  console.log('errors', errs);
  await b.close();
})();

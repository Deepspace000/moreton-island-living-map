const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 560 } })).newPage(); p.setDefaultTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot&x=' + Date.now(), { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  console.log(await p.evaluate(() => { const M = MAP, F = M.F, pm = M.scene.children.find(c => c.name === 'people'); return JSON.stringify({ gates: (F.gates || []).map(g => g.p.map(Math.round)), bypassed: F.bypassed, drive: (F.drive || []).map(r => (r.side > 0 ? 'E' : 'W') + ' ' + r.p.length + ' pts z ' + Math.round(r.p[0][1]) + '..' + Math.round(r.p[r.p.length - 1][1]) + ' furthest inland x ' + Math.round(Math.max(...r.p.map(q => q[0] * -r.side)))), routes: F.beach.map(r => (r.side > 0 ? 'E' : 'W') + ' ' + r.p.length + ' pts z ' + Math.round(r.p[0][1]) + '..' + Math.round(r.p[r.p.length - 1][1])), parked: F.parked.length, people: pm.geometry.instanceCount, cars: M.rideable.filter(c => c.kind === 'car' || c.m).length }); }));
  console.log('errors', errs);
  await b.close();
})();

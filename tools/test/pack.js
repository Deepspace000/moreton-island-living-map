const { chromium } = require('playwright');
const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 600 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.setDefaultTimeout(240000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(NOREND);
  const T0 = Date.now(), tick = (m) => console.log(((Date.now() - T0) / 1000).toFixed(1) + 's', m);
  const dl = p.waitForEvent('download');
  await p.goto('http://127.0.0.1:8931/index.html?download', { waitUntil: 'load' });
  const d = await dl; await d.saveAs('Moreton-Island-Living-Map.html');
  tick('downloaded ' + d.suggestedFilename() + ' ' + (fs.statSync('Moreton-Island-Living-Map.html').size / 1e6).toFixed(1) + ' MB, button: ' + await p.textContent('#btSave'));
  console.log('online errors:', errs);
  // open the saved file on its own, with the network switched off
  const ctx2 = await b.newContext({ viewport: { width: 900, height: 600 }, offline: true });
  const q = await ctx2.newPage(); q.setDefaultTimeout(240000);
  const errs2 = []; q.on('pageerror', e => errs2.push(e.message)); q.on('console', m => { if (m.type() === 'error' && !/INTERNET_DISCONNECTED/.test(m.text())) errs2.push(m.text().slice(0, 200)); });
  const reqs = []; q.on('request', r => { if (!r.url().startsWith('data:') && !r.url().startsWith('file:')) reqs.push(r.url().slice(0, 80)); });
  await q.addInitScript(NOREND);
  await q.goto('file://' + process.cwd() + '/Moreton-Island-Living-Map.html', { waitUntil: 'commit' });
  await q.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'));
  tick('standalone booted');
  console.log(await q.evaluate(async () => {
    const M = MAP, P = M.features.places.length, t = await fetch('tiles/15/' + Object.keys(window.PACKED).find(k => k.startsWith('tiles')).slice(9)).then(r => r.blob());
    return JSON.stringify({ places: P, grid: [M.T.W, M.T.H], packed: Object.keys(window.PACKED).length, tileBytes: t.size, tileType: t.type, saveButton: !!document.getElementById('btSave'), title: document.title, styled: getComputedStyle(document.getElementById('bar')).position });
  }));
  console.log('standalone errors:', errs2.slice(0, 6), '| outside requests:', [...new Set(reqs)].slice(0, 6));
  await b.close();
})();

const { chromium } = require('playwright');
const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ acceptDownloads: true })).newPage(); p.setDefaultTimeout(120000);
  await p.addInitScript(NOREND);
  const dl = p.waitForEvent('download');
  await p.goto('http://127.0.0.1:8931/index.html?download', { waitUntil: 'load' });
  const d = await dl; await d.saveAs('Moreton-Island-Living-Map.html');
  console.log('saved', (fs.statSync('Moreton-Island-Living-Map.html').size / 1e6).toFixed(1), 'MB');
  await b.close();
})();

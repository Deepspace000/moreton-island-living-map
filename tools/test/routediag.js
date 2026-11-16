const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 560 } })).newPage(); p.setDefaultTimeout(120000);
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot&x=' + Date.now(), { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  console.log(await p.evaluate(async () => {
    const T = await import('./src/terrain.js?v=' + document.querySelector('script[type=importmap]').textContent.match(/terrain\.js\?v=(\d+)/)[1]);
    const S = T.T, out = [], side = -1; let last = null;
    for (let z = -S.sz / 2 + 500; z < S.sz / 2 - 500; z += 450) {
      let x = side * (S.sx / 2 - 150), hits = [];
      for (let i = 0; i < 2400 && Math.abs(x) < S.sx / 2; i++, x -= side * 9) { const h = T.groundH(x, z); if (h > 0.9) { const m = T.maskAt(x, z); hits.push(Math.round(x) + ':sand' + m.sand.toFixed(2) + ',behind' + T.groundH(x - side * 70, z).toFixed(1) + ',land' + m.land.toFixed(1)); let k = 0; while (k < 400 && T.groundH(x, z) > 0.3) { x -= side * 9; k++; } if (hits.length >= 3) break; } }
      out.push('z ' + Math.round(z) + ': ' + hits.join(' | '));
    }
    return out.join('\n');
  }));
  await b.close();
})();

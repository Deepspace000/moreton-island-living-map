const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  console.log('errors', errs);
  console.log(await p.evaluate(() => { const f = MAP.folk, P = f.people, n = P.length / 11, kinds = [0, 0, 0]; for (let i = 0; i < n; i++) kinds[P[i * 11 + 6]]++;
    const near = (x, z, r) => { const o = []; for (let i = 0; i < n; i++) if (Math.hypot(P[i * 11] - x, P[i * 11 + 1] - z) < r) o.push([P[i * 11].toFixed(0), P[i * 11 + 1].toFixed(0), P[i * 11 + 6]].join('/')); return o.join(' '); };
    const boats = MAP.boats && MAP.boats.list ? MAP.boats.list.filter(q => q.jet || q.type === 'fly').map(q => [q.type, q.jet, q.x?.toFixed(0), q.z?.toFixed(0)].join('/')) : Object.keys(MAP.boats || {});
    return JSON.stringify({ people: n, kinds, camps: f.camps.length,  signs: f.signs.length, boards: f.signs.reduce((a, s) => a + s.boards.length, 0), signList: f.signs.map(s => s.x.toFixed(0) + ',' + s.z.toFixed(0) + ': ' + s.boards.map(b => b.text + '[' + b.c + ']').join(' / ')).join('\n'),  }, null, 1).replace(/\\n/g, '\n'); }));
  await b.close();
})();

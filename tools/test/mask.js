const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  console.log(await p.evaluate(() => { const T = MAP.T, out = [];
    const at = (x, z) => { const xi = Math.round((x / T.sx + 0.5) * T.W - 0.5), zi = Math.round((z / T.sz + 0.5) * T.H - 0.5), i = (zi * T.W + xi) * 4; return [T.mask[i], T.mask[i + 1], T.mask[i + 2], T.hgt[zi * T.W + xi].toFixed(1)]; };
    for (const [x, z] of [[-1300, 1500], [4500, -10250], [2300, -6000], [600, 6000], [1232, -4300], [-1324, -790]]) out.push(x + ',' + z + ' rgb/h ' + at(x, z));
    // share of land with sand mask under 0.25 / 0.5
    let land = 0, a = 0, c = 0; for (let i = 0; i < T.W * T.H; i += 7) { if (T.mask[i * 4] > 235 && T.hgt[i] > 2.5) { land++; if (T.mask[i * 4 + 1] < 64) a++; if (T.mask[i * 4 + 1] < 128) c++; } }
    out.push('land ' + land + ' g<0.25 ' + (a / land).toFixed(2) + ' g<0.5 ' + (c / land).toFixed(2));
    const u = MAP.U.uHeight.value; out.push('height tex type ' + u.type + ' format ' + u.format + ' sample ' + (u.image.data ? Array.from(u.image.data.slice(0, 4)) : 'img'));
    return out.join('\n'); }));
  await b.close();
})();

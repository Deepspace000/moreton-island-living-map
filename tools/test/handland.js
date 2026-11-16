// can the plane be landed by hand? Line it up on a strip from two kilometres out, hold it in a gentle descent, and see where it ends up
const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('handland.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(async () => {
    const M = MAP, T = await import('./src/terrain.js'), pl = M.air.planes[0], out = [];
    M.air.strips.forEach((s, k) => { for (const d of [1, -1]) {
      const e = d > 0 ? s.a : s.b, ty = T.meshY(e[0], e[1]); pl.x = e[0] - s.ux * d * 2000; pl.z = e[1] - s.uz * d * 2000; pl.hd = Math.atan2(-s.uz * d, s.ux * d); pl.y = ty + 200; pl.v = 46; pl.vy = 0; pl.fl = undefined; pl.ctl = { turn: 0, climb: -0.6 };
      let touched = -1, minClear = 1e9; for (let i = 0; i < 1500; i++) { M.air.update(0.05, i * 0.05); const g = pl.y - T.meshY(pl.x, pl.z); if (touched < 0 && g < 0.3) { touched = i; pl.ctl.climb = 0; } }
      const ax = pl.x - s.a[0], az = pl.z - s.a[1], al = ax * s.ux + az * s.uz, cr = Math.abs(ax * s.uz - az * s.ux);
      out.push(`strip ${k}, direction ${d > 0 ? 'a to b' : 'b to a'}: ` + (touched < 0 ? `never touched down (ended ${(pl.y - T.meshY(pl.x, pl.z)).toFixed(0)} units up)` : `touched down after ${(touched * 0.05).toFixed(0)} s; 75 s in it is ${al.toFixed(0)} m along a ${s.L.toFixed(0)} m strip, ${cr.toFixed(0)} m off the centre line, rolling at ${(pl.v * 3.6).toFixed(0)} km/h`));
      pl.ctl = null;
    } });
    return out.join('\n');
  });
  fs.appendFileSync('handland.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 3)) + '\n'); await b.close();
})();

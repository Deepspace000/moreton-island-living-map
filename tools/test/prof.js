const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 560 } })).newPage(); p.setDefaultTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(NOREND);
  const t0 = Date.now();
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  console.log('boot', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log(await p.evaluate(async () => {
    const T = await import('./src/terrain.js?v=' + (document.querySelector('script[type=importmap]').textContent.match(/terrain\.js\?v=(\d+)/) || [0, ''])[1]);
    const out = [], VEX = 1.7;
    const builds = MAP.F.buildings.filter(b => b.k !== 'ship'); const nearB = (x, z) => { let d = 1e9; for (const b of builds) for (const q of b.p) if (Math.abs(q[1] - z) < 60) d = Math.min(d, Math.hypot(q[0] - x, q[1] - z)); return d; };
    const sites = { 'Tangalooma resort': [-1744, -540], 'Tangalooma north': [-1900, -1800], 'Bulwer': [-2199, -11784], 'Kooringal': [2900, 18645], 'Cowan': [-2451, -6363], 'ocean mid': [5200, 0], 'ocean north': [4500, -9000] };
    for (const [name, [cx, cz]] of Object.entries(sites)) {
      const ocean = /ocean/.test(name), xs = []; for (let x = ocean ? 2500 : cx - 700; x < (ocean ? 8000 : cx + 700); x += 1) xs.push(x);
      const y = xs.map(x => T.meshY(x, cz));
      // the waterline at a tide is where the drawn ground crosses the sea surface; take the crossing nearest the site, and find which way is land
      const cross = (lvl) => { let best = -1; for (let i = 1; i < xs.length; i++) if ((y[i - 1] < lvl) !== (y[i] < lvl)) { if (best < 0 || Math.abs(xs[i] - cx) < Math.abs(xs[best] - cx)) best = i; } return best; };
      const i0 = cross(0); if (i0 < 0) { out.push(name + ': no waterline'); continue; }
      const land = y[Math.min(xs.length - 1, i0 + 8)] > y[Math.max(0, i0 - 8)] ? 1 : -1;
      const at = (dm) => y[Math.max(0, Math.min(xs.length - 1, i0 + land * dm))];
      const edge = (lvl) => { for (let k = -400; k < 400; k++) if (at(k) >= lvl && at(k - 1) < lvl) return k; return null; };
      const hi = edge(1.05 * VEX), lo = edge(-1.15 * VEX);
      // back of the beach: first place inland where the true ground passes 2.5 m (dune grass starts) 
      let back = null; for (let k = 0; k < 600; k++) if (T.groundH(xs[i0] + land * k, cz) > 2.5) { back = k; break; }
      let steep = 0; for (let k = lo ?? -100; k < (hi ?? 30) + 10; k++) steep = Math.max(steep, Math.abs(at(k + 3) - at(k - 3)) / 6);
      out.push(name.padEnd(18) + ' drawn y at 0/5/10/20/30/40/60/80 m from mean waterline: ' + [0, 5, 10, 20, 30, 40, 60, 80].map(k => at(k).toFixed(1)).join(' ') + ' | low-tide edge ' + lo + ' m, high-tide edge ' + hi + ' m, back of beach ' + back + ' m | steepest ' + (Math.atan(steep) * 57.3).toFixed(0) + ' deg (tide zone) | nearest building to the mean / highest waterline: ' + Math.round(nearB(xs[i0], cz)) + ' / ' + Math.round(nearB(xs[i0] + land * (hi || 0), cz)) + ' m');
    }
    return out.join('\n');
  }));
  console.log('errors', errs);
  await b.close();
})();

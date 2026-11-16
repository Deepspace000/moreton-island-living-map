// open the map twice (as a visitor would, not in test mode) and say where each kind of travel is, and where the Travel menu takes you on repeated asks
const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  fs.writeFileSync('spread.log', '');
  for (let load = 1; load <= 1; load++) {
    const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(NOREND);
    await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
    const r = await p.evaluate(async () => {
      const M = MAP, T = await import('./src/terrain.js'), P = M.features.places, near = (x, z) => { let b = null, d = 1e9; for (const q of P) { const e = Math.hypot(q.x - x, q.z - z); if (e < d) { d = e; b = q; } } return b ? b.n + ' ' + (d / 1000).toFixed(1) + 'km' : '?'; };
      for (let i = 0; i < 5; i++) { M.setDt(0.05); M.frame(); M.setDt(0); }
      const B = M.boats.boats, out = [], wet = (o) => (M.U.uSeaM.value - T.heightAt(o.x, o.z) > 1 ? '' : ' (AGROUND)');
      out.push('jet skis: ' + B.filter(q => q.jet).map(q => near(q.x, q.z) + wet(q)).join(' | '));
      out.push('small boats: ' + B.filter(q => q.move && !q.jet && !q.sail && !q.ferry && q.mast < 6).map(q => near(q.x, q.z) + wet(q)).join(' | '));
      out.push('flybridge cruisers under way: ' + B.filter(q => q.move && q.mast === 7.4).map(q => near(q.x, q.z) + wet(q)).join(' | '));
      out.push('yachts under sail: ' + B.filter(q => q.move && q.sail).map(q => near(q.x, q.z)).join(' | '));
      const w = M.trek.walkers[0], pl = M.air.planes[0]; out.push('traveller starts near ' + near(w.x, w.z) + '; plane waits near ' + near(pl.x, pl.z));
      for (const kind of ['jetski', 'boat', 'car', 'pelican']) { const got = []; for (let i = 0; i < 4; i++) { M.exitRide(); M.travel(kind, false); M.setDt(0.05); M.frame(); M.setDt(0); const o = M.ride.car || M.ride.boat || M.ride.bird; got.push(near(o.m.position.x, o.m.position.z)); } M.exitRide(); out.push('asking for a ' + kind + ' four times: ' + got.join(' > ')); }
      const rider = B.filter(q => q.jet)[0].m.geometry.attributes.position.count; out.push('jet ski model: ' + rider + ' points');
      return out.join('\n');
    });
    fs.appendFileSync('spread.log', `--- load ${load}\n` + r + '\nerrors: ' + JSON.stringify(errs.slice(0, 3)) + '\n'); await p.close();
  }
  await b.close();
})();

// every bird, left to itself for ten minutes and then hand-flown low across the island: how close does it come to the ground where there are trees?
const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('treetest.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(async () => {
    const M = MAP, out = [], T = await import('./src/terrain.js'), sea = () => M.U.uSeaM.value * 1.7;
    const bush = (x, z) => T.heightAt(x, z) > 0.5 && T.maskAt(x, z).sand < 0.8;
    const st = {}; for (const f of M.flyers) st[f.kind] ??= { low: 1e9, hi: 0, overBush: 0, n: 0 };
    for (let i = 0; i < 6000; i++) { M.life.update(0.1, 100 + i * 0.1, M.flyers[0].m.position, 0); for (const f of M.flyers) { const s = st[f.kind]; s.n++; s.hi = Math.max(s.hi, (f.y - sea()) / 1.7); if (bush(f.x, f.z)) { s.overBush++; s.low = Math.min(s.low, f.y - T.meshY(f.x, f.z)); } } }
    for (const k in st) out.push(`${k}s on their own, 10 minutes: over bush ${(st[k].overBush / st[k].n * 100).toFixed(0)}% of the time; lowest above the ground there ${st[k].low > 1e8 ? 'n/a' : st[k].low.toFixed(1) + ' units (trees stand about 20)'}; highest ${st[k].hi.toFixed(0)} m above the sea`);
    for (const kind of ['eagle', 'pelican']) {      // hand-flown, held in a dive, straight across the island
      const f = M.flyers.find(q => q.kind === kind); f.x = -3000; f.z = 2000; f.hd = 0; f.y = sea() + 60; f.ctl = { turn: 0, climb: -1 }; let low = 1e9, n = 0;
      for (let i = 0; i < 4000; i++) { M.life.update(0.05, 900 + i * 0.05, f.m.position, 0); if (bush(f.x, f.z)) { n++; low = Math.min(low, f.y - T.meshY(f.x, f.z)); } }
      out.push(`${kind} hand-flown in a dive straight across the island: ${n} steps over bush, lowest above the ground there ${low.toFixed(1)} units`); f.ctl = null;
    }
    return out.join('\n');
  });
  fs.appendFileSync('treetest.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 3)) + '\n'); await b.close();
})();

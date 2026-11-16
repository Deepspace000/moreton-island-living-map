// How wide is the dry beach at each state of the tide? Along both beach lines, at every point: walk seaward to the waterline and landward to
// where the sand ends, and measure the dry sand between. Also: what does the tide do over a day of the clock?
const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('beach.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html' + (process.argv[2] === 'live' ? '' : '?shot'), { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(async () => {
    const M = MAP, T = await import('./src/terrain.js'), W = await import('./src/weather.js'), out = [];
    const prof = [];      // for each beach point: heights along a line from 150 m out to sea to 250 m inland, every 2 m, and where the sand ends
    for (const r of M.F.beach) for (let i = 2; i < r.p.length - 2; i += 3) {
      const a = r.p[i - 1], c = r.p[i + 1], q = r.p[i]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      let nx = tz, nz = -tx; if (T.heightAt(q[0] + nx * 60, q[1] + nz * 60) < T.heightAt(q[0] - nx * 60, q[1] - nz * 60)) { nx = -nx; nz = -nz; }       // n points inland
      const hs = []; let sandEnd = null; for (let d = -200; d <= 300; d += 2) { const x = q[0] + nx * d, z = q[1] + nz * d, h = T.heightAt(x, z); hs.push(h); if (sandEnd === null && d > 0 && (T.maskAt(x, z).sand < 0.5 || h > 6)) sandEnd = d; }
      prof.push({ side: r.side, hs, sandEnd: sandEnd ?? 300, z: q[1] });
    }
    const stat = (a) => { const s = [...a].sort((x, y) => x - y); return `median ${s[s.length >> 1].toFixed(0)} m, narrowest tenth ${s[Math.floor(s.length * 0.1)].toFixed(0)} m, widest tenth ${s[Math.floor(s.length * 0.9)].toFixed(0)} m`; };
    for (const side of [1, -1]) { out.push(side > 0 ? 'OCEAN (east) beach' : 'BAY (west) beach'); const P = prof.filter(q => q.side === side);
      for (const L of [-1.3, -1.0, -0.5, 0, 0.5, 1.0, 1.3]) { const w = [], none = []; for (const q of P) { let wl = null; for (let k = q.hs.length - 1; k >= 0; k--) { if (q.hs[k] <= L) { wl = -200 + k * 2; break; } }      // the waterline: the most landward point at or below sea level... searched from inland
          let first = null; for (let k = 0; k < q.hs.length; k++) { const d = -200 + k * 2; if (d > q.sandEnd) break; if (q.hs[k] > L && first === null) first = d; if (q.hs[k] <= L) first = null; }
          const dry = first === null ? 0 : q.sandEnd - first; w.push(Math.max(0, dry)); }
        out.push(`  sea at ${L >= 0 ? '+' : ''}${L.toFixed(1)} m: dry sand ${stat(w)}; no dry sand at all on ${(w.filter(v => v < 4).length / w.length * 100).toFixed(0)}% of the shore`); } }
    // the real tide table: feed it a known tide (1 m swing, high water at 03:00 UTC today) and see that the sea follows it, and that the model's clock is set by it
    { const t0 = Math.floor(Date.now() / 86400e3) * 86400e3 - 86400e3, times = [], lv = []; for (let h = 0; h < 8 * 24; h++) { times.push(t0 + h * 3600e3); lv.push(0.4 + 1.0 * Math.cos(2 * Math.PI * (h - 3) / 12.42)); }
      const ok = W.setTideTable(times, lv); W.setTideDate(t0 + 3 * 3600e3); const hi = W.tideLevel(); W.setTideDate(t0 + (3 + 6.21) * 3600e3); const lo = W.tideLevel(); W.setTideDate(t0 + 30 * 86400e3 + 3 * 3600e3); const later = W.tideLevel();
      out.push(`real tide table accepted: ${ok}; at its high water the sea is ${hi.toFixed(2)} (the table's +0.4 m offset is not carried over; capped at +1.05); at its low water ${lo.toFixed(2)}; a month later, from the model on the table's clock: ${later.toFixed(2)}`);
      W.setTideTable([], []); }
    // the clock and the tide
    const day = []; for (let m = 0; m < 1440; m += 60) { M.setMinutes(m); for (let i = 0; i < 40; i++) { M.setDt(0.5); M.frame(); M.setDt(0); } day.push(M.U.uSeaM.value.toFixed(2)); }
    out.push('sea level through one day, hour by hour: ' + day.join(' '));
    out.push('tide the model gives over the next 14 days: min ' + Math.min(...Array.from({ length: 14 * 24 }, (_, h) => W.tideModel(Date.now() + h * 3600e3))).toFixed(2) + ', max ' + Math.max(...Array.from({ length: 14 * 24 }, (_, h) => W.tideModel(Date.now() + h * 3600e3))).toFixed(2));
    return out.join('\n');
  });
  fs.appendFileSync('beach.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 3)) + '\n'); await b.close();
})();

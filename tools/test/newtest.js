const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('newtest.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const which = process.argv[2] || 'plane,walker,tour';
  const r = await p.evaluate(async (which) => {
    const M = MAP, out = [], T = await import('./src/terrain.js'), sea = () => M.U.uSeaM.value * 1.7;
    if (/plane/.test(which)) {
      const pl = M.air.planes[0], seq = []; let last = '', lowBush = 1e9, maxRoll = 0, maxSink = 0, py = pl.y, lands = [], tStart = 0;
      for (let i = 0; i < 26000; i++) { M.air.update(0.1, i * 0.1);
        if (pl.state !== last) { seq.push(pl.state + '@' + (i * 0.1).toFixed(0) + 's'); if (pl.state === 'rollout') lands.push({ strip: pl.strip, sinkAtTouch: ((py - pl.y) / 0.1).toFixed(1), speed: (pl.v * 3.6).toFixed(0) }); if (pl.state === 'park') { const s = M.air.strips[pl.strip]; const ax = pl.x - s.a[0], az = pl.z - s.a[1]; lands[lands.length - 1] && (lands[lands.length - 1].parkedAlong = (ax * s.ux + az * s.uz).toFixed(0) + ' of ' + s.L.toFixed(0) + ' m, ' + Math.abs(ax * s.uz - az * s.ux).toFixed(0) + ' m off the centre line'); } last = pl.state; }
        const air = !['park', 'roll', 'rollout', 'turn', 'final'].includes(pl.state); if (air && T.heightAt(pl.x, pl.z) > 0.5 && T.maskAt(pl.x, pl.z).sand < 0.8) lowBush = Math.min(lowBush, pl.y - T.meshY(pl.x, pl.z));
        maxRoll = Math.max(maxRoll, Math.abs(pl.roll)); if (pl.state === 'final') maxSink = Math.max(maxSink, (py - pl.y) / 0.1); py = pl.y; }
      out.push('PLANE, 43 minutes on its own: ' + seq.slice(0, 16).join(' > '));
      out.push('  landings: ' + JSON.stringify(lands)); out.push(`  lowest over bush while flying ${lowBush.toFixed(0)} units; steepest bank ${(maxRoll * 57.3).toFixed(0)} deg; fastest sink on final ${maxSink.toFixed(1)} units/s`);
      // by hand: hold a climb for 20 s, then let go
      pl.ctl = { turn: 0, climb: 1 }; const y0 = pl.y; for (let i = 0; i < 200; i++) M.air.update(0.1, 0); const y1 = pl.y; pl.ctl = null; for (let i = 0; i < 50; i++) M.air.update(0.1, 0);
      out.push(`  by hand: state was ${last}; 20 s of climb took it from ${((y0 - sea()) / 1.7).toFixed(0)} to ${((y1 - sea()) / 1.7).toFixed(0)} m; after letting go its state is ${pl.state}`);
    }
    if (/walker/.test(which)) {
      const w = M.trek.walkers[0]; let wet = 0, far = 0, x0 = w.x, z0 = w.z, stuck = 0, moved = 0, seen = [], lastV = 0, done = -1;
      out.push(`TRAVELLER: ${w.total} places on the list: ` + w.pois.map(q => q.name).join(', ').slice(0, 700));
      for (let i = 0; i < 400000; i++) { M.trek.update(0.5, i); if (T.heightAt(w.x, w.z) < M.U.uSeaM.value - 0.9) wet++; if (i % 2000 === 1999) { const d = Math.hypot(w.x - x0, w.z - z0); if (d < 30) stuck++; x0 = w.x; z0 = w.z; } if (w.visited !== lastV) { lastV = w.visited; if (w.arrived) seen.push(w.arrived); if (w.visited === 0 && done < 0 && seen.length > 3) { done = i; break; } } if (w.visited === w.total && done < 0) { done = i; } if (done >= 0 && i > done + 5) break; }
      out.push(`  walked for ${((done < 0 ? 400000 : done) / 7200).toFixed(1)} hours of its own time: reached ${seen.length} of ${w.total}; in water over the knees for ${wet} s; stood still for a long spell ${stuck} times`);
      out.push('  order: ' + seen.join(' > ').slice(0, 900)); const miss = w.pois.filter(q => !seen.includes(q.name)).map(q => q.name); if (miss.length) out.push('  not reached: ' + miss.join(', '));
      // camp, then break camp; then by hand
      w.askCamp = true; for (let i = 0; i < 60; i++) M.trek.update(0.1, 0); const c1 = w.camped, tv = M.trek.tent.visible, v1 = w.v; w.askCamp = false; for (let i = 0; i < 60; i++) M.trek.update(0.1, 0);
      const p0 = [w.x, w.z]; w.ctl = { turn: 0, climb: 1 }; for (let i = 0; i < 100; i++) M.trek.update(0.1, 0); const dh = Math.hypot(w.x - p0[0], w.z - p0[1]); w.ctl = null; for (let i = 0; i < 300; i++) M.trek.update(0.1, 0);
      out.push(`  camp: camped ${c1}, tent up ${tv}, speed ${v1.toFixed(2)}; after breaking camp: camped ${w.camped}, tent up ${M.trek.tent.visible}; by hand for 10 s it went ${dh.toFixed(0)} m; then on its own again: "${w.next}"`);
    }
    if (/tour/.test(which)) {
      document.getElementById('tvSecs').value = '15'; M.startTour(); const log = []; let last = '';
      for (let i = 0; i < 280; i++) { M.setDt(0.5); M.frame(); M.setDt(0); const o = M.ride.car || M.ride.boat || M.ride.bird, kind = M.ride.car ? 'car' : M.ride.bird ? o.kind : o ? (o.jet ? 'jetski' : o.sail ? 'yacht' : 'boat') : 'none', s = kind + ':' + ['eyes', 'close', 'far'][M.ride.view()]; if (s !== last) { log.push(s + '@' + (i * 0.5).toFixed(0)); last = s; } }
      out.push('TOUR at 15 s each: ' + log.join(' > ').slice(0, 900)); out.push('  button says "' + document.getElementById('tvTour').textContent + '"; steering during the tour: ' + M.ride.helm);
      document.querySelector('#travel .tv-row[data-kind="eagle"] button').click(); for (let i = 0; i < 80; i++) { M.setDt(0.5); M.frame(); M.setDt(0); }
      out.push('  after choosing the eagle by hand: tour on = ' + M.tour.on + ', still with ' + (M.ride.bird ? M.ride.bird.kind : 'something else') + ' 40 s later'); M.exitRide();
    }
    return out.join('\n');
  }, which);
  fs.appendFileSync('newtest.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 4)) + '\n'); await b.close();
})();

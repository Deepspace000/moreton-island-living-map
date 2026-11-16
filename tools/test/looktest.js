// dragging must turn and tilt the head in every mode; a long held turn on a bird must not make the camera whip round
const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('looktest.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(() => {
    const M = MAP, out = [], c = document.getElementById('c'), fr = (dt) => { M.setDt(dt); M.frame(); M.setDt(0); };
    const drag = (dx, dy) => { c.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, clientY: 300, bubbles: true })); for (let i = 1; i <= 10; i++) dispatchEvent(new PointerEvent('pointermove', { clientX: 500 + dx * i / 10, clientY: 300 + dy * i / 10 })); dispatchEvent(new PointerEvent('pointerup', {})); };
    for (const kind of ['car', 'yacht', 'pelican']) {
      M.travel(kind, false); for (let i = 0; i < 20; i++) fr(0.016);
      const l0 = M.ride.look, t0 = M.ride.tilt; drag(300, -60); const l1 = M.ride.look, t1 = M.ride.tilt; drag(2400, 0); fr(0.016);
      out.push(`${kind}: drag 300px right, 60px up -> look ${(l1 - l0).toFixed(2)} rad (want 1.05), tilt ${(t1 - t0).toFixed(2)} (want up to +0.15); after a further 2400px the look is ${M.ride.look.toFixed(2)} (must be within -3.14..3.14); cabin shift ${document.querySelector('#ride .cab').style.transform}; rear panel width ${document.querySelector('#ride .rear').style.width}`);
      M.exitRide();
    }
    for (const kind of ['pelican', 'eagle']) {       // hold a turn for 40 seconds: more than three full circles
      M.travel(kind, true); for (let i = 0; i < 30; i++) fr(0.016);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); let worst = 0, pq = M.camera.quaternion.clone(), hd0 = M.ride.bird.hd;
      for (let i = 0; i < 2400; i++) { fr(0.0167); const a = 2 * Math.acos(Math.min(1, Math.abs(pq.dot(M.camera.quaternion)))) * 57.3 / 0.0167; if (i > 120) worst = Math.max(worst, a); pq.copy(M.camera.quaternion); }
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
      out.push(`${kind}: held a turn for 40 s, turned ${(Math.abs(M.ride.bird.hd - hd0) / 6.283).toFixed(1)} full circles; fastest the camera ever turned ${worst.toFixed(0)} deg/s (the bird itself turns at ${(0.85 * 57.3).toFixed(0)} deg/s)`);
      // climb for 30 s, then dive for 60 s
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); let top = 0, gap = 0; for (let i = 0; i < 1800; i++) { fr(0.0167); top = Math.max(top, M.ride.bird.y); gap = Math.max(gap, Math.abs(M.ride.bird.y + 2.3 - M.camera.position.y)); } dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' })); let low = 1e9; for (let i = 0; i < 3600; i++) { fr(0.0167); low = Math.min(low, M.ride.bird.y); } dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
      const sea = M.U.uSeaM.value * 1.7;
      out.push(`   climbed for 30 s to ${((top - sea) / 1.7).toFixed(0)} m above the sea; the camera never trailed more than ${gap.toFixed(1)} units; dived for 60 s to ${((low - sea) / 1.7).toFixed(1)} m; afloat ${M.ride.bird.afloat}`);
      M.exitRide();
    }
    // an eagle left alone for 5 minutes: how high and low does it go?
    const e = M.flyers.find(f => f.kind === 'eagle'); let lo = 1e9, hi = -1e9; const sea = M.U.uSeaM.value * 1.7; for (let i = 0; i < 3000; i++) { fr(0.1); lo = Math.min(lo, e.y); hi = Math.max(hi, e.y); }
    out.push(`eagle on its own for 5 minutes: between ${((lo - sea) / 1.7).toFixed(0)} m and ${((hi - sea) / 1.7).toFixed(0)} m above the sea`);
    return out.join('\n');
  });
  fs.appendFileSync('looktest.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 4)) + '\n'); await b.close();
})();

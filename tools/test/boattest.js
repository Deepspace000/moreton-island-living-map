const { chromium } = require('playwright');
const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 640 } }); const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); const lg = (m) => fs.appendFileSync('boattest.log', m + '\n');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  await p.evaluate(() => { for (let i = 0; i < 6; i++) MAP.boats.update(0.1, i * 0.1, MAP.camera); });
  for (const kind of ['sail', 'jet', 'anchor', 'ferry']) {
    const r = await p.evaluate(async (kind) => {
      const M = MAP, B = M.boats.boats, bt = B.find(q => kind === 'sail' ? q.sail && q.move : kind === 'jet' ? q.jet : kind === 'anchor' ? q.anchor : q.ferry); if (!bt) return { kind, none: true };
      // tap it on the map
      const pos = bt.m.position; M.controls.enabled = false; M.camera.position.set(pos.x + 60, pos.y + 70, pos.z + 60); M.camera.lookAt(pos); M.camera.updateMatrixWorld();
      const v = pos.clone(); v.y += 2; v.project(M.camera); const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight, hit = M.ride.pick(sx + 3, sy + 2);
      if (!hit) return { kind, pick: 'missed' };
      M.enterRide(hit);
      const step = (n) => { for (let i = 0; i < n; i++) { M.boats.update(0.1, 1 + i * 0.1, M.camera); M.ride.update(0.1, 0); } };
      step(5);
      const cam = M.camera.position, d = new cam.constructor(); M.camera.getWorldDirection(d);
      const out = { kind, picked: hit.kind + (hit.obj === bt ? ' same' : ' other'), len: bt.len.toFixed(1), eyeAbove: (cam.y - pos.y).toFixed(2), eyeFromCentre: Math.hypot(cam.x - pos.x, cam.z - pos.z).toFixed(2), facesBow: (d.x * Math.cos(bt.hd) - d.z * Math.sin(bt.hd)).toFixed(2),
        helmShown: getComputedStyle(document.querySelector('#ride .helm')).display, cabShown: getComputedStyle(document.querySelector('#ride .cab')).display, takeBtn: getComputedStyle(document.querySelector('#hmTake')).display, tip: document.querySelector('#rideTip').textContent, exit: document.querySelector('#rideExit').textContent };
      if (bt.move && !bt.ferry) {
        document.querySelector('#hmTake').click(); const h0 = bt.hd, x0 = bt.x, z0 = bt.z;
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); step(30); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
        out.helm = !!bt.helm; out.turnedRightDeg = ((h0 - bt.hd) * 57.3).toFixed(0); out.moved = Math.hypot(bt.x - x0, bt.z - z0).toFixed(0); out.keysShown = getComputedStyle(document.querySelector('#ride .helm .keys')).display;
        const h1 = bt.hd; step(20); out.holdsCourseDeg = ((h1 - bt.hd) * 57.3).toFixed(1);
      }
      out.gauges = document.querySelector('#ride .gauges').textContent.replace(/\s+/g, ' ').trim();
      M.exitRide(); out.afterExit = { active: M.ride.active, helm: !!bt.helm, ctl: M.controls.enabled };
      return out; }, kind);
    lg(JSON.stringify(r));
  }
  lg('errs ' + JSON.stringify(errs)); process.exit(0);
})();

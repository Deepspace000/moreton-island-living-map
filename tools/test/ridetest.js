const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [w, h, touch] of [process.argv[2] === 'phone' ? [412, 860, true] : [1000, 640, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(); p.setDefaultTimeout(15000); const errs = []; const T0 = Date.now(), lg = (m) => require('fs').appendFileSync('ridetest.log', w + 'x' + h + ' ' + ((Date.now() - T0) / 1000).toFixed(1) + 's ' + m + '\n'); p.on('pageerror', e => errs.push(e.message));
    lg('page'); await p.addInitScript(NOREND);
    await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
    await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
    lg('loaded');
    // put the map camera 70 m from a car and find where the car is on the screen
    const pt = await p.evaluate(() => { const M = MAP, c = M.rideable[0], q = c.m.position; M.controls.target.set(q.x, q.y, q.z); M.camera.position.set(q.x + 40, q.y + 45, q.z + 40); M.camera.lookAt(q); M.camera.updateMatrixWorld(); M.controls.enabled = false;
      const v = q.clone(); v.y += 1.3; v.project(M.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, n: M.rideable.length }; });
    lg('ready'); const hit = await p.evaluate((pt) => document.elementFromPoint(pt.x, pt.y)?.id, pt);
    if (touch) await p.touchscreen.tap(pt.x + 4, pt.y + 3); else await p.mouse.click(pt.x + 4, pt.y + 3);
    lg('tapped'); const st1 = await p.evaluate(() => ({ active: MAP.ride.active, shown: getComputedStyle(document.getElementById('ride')).display, carHidden: MAP.ride.car && !MAP.ride.car.m.visible, fov: MAP.camera.fov }));
    await p.evaluate(() => { for (let i = 0; i < 20; i++) MAP.frame(); });
    lg('frames'); const st2 = await p.evaluate(() => { const M = MAP, c = M.ride.car, q = c.m.position, cp = M.camera.position, d = new (cp.constructor)(); M.camera.getWorldDirection(d); const yaw = c.m.rotation.y;
      return { camToCar: cp.distanceTo(q).toFixed(2), above: (cp.y - q.y).toFixed(2), facesForward: (d.x * Math.cos(yaw) - d.z * Math.sin(yaw)).toFixed(2), speed: document.querySelector('#rdSpeed').textContent, head: document.querySelector('#rdHead').textContent, beach: document.querySelector('#rdBeach').textContent, near: document.querySelector('#rdNear').textContent, transform: document.querySelector('#ride .cab').style.transform }; });
    // a tap away from any car does nothing; drag turns the head; the button leaves
    await p.mouse.move(w / 2, h / 2); await p.mouse.down(); await p.mouse.move(w / 2 + 80, h / 2 + 20, { steps: 4 }); await p.mouse.up();
    const look = await p.evaluate(() => { MAP.frame(); return { look: MAP.ride.look.toFixed(2), tilt: MAP.ride.tilt.toFixed(2), transform: document.querySelector('#ride .cab').style.transform }; });
    lg('dragged'); if (touch) await p.touchscreen.tap(50, 26); else await p.click('#rideExit'); lg('left');
    const st3 = await p.evaluate(() => ({ active: MAP.ride.active, shown: getComputedStyle(document.getElementById('ride')).display, carVisible: MAP.rideable[0].m.visible, ctl: MAP.controls.enabled, fov: MAP.camera.fov }));
    const miss = await p.evaluate(() => { const M = MAP; M.camera.updateMatrixWorld(); return !!M.ride.pick(5, innerHeight - 5); });
    console.log(w + 'x' + h, JSON.stringify({ cars: pt.n, under: hit, st1, st2, look, st3, missPicks: miss, errs }));
  }
  process.exit(0);
})();

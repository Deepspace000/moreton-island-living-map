const { chromium } = require('playwright');
const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 640 } }); const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1])); const lg = (m) => fs.appendFileSync('drivetest.log', m + '\n');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(() => {
    const M = MAP, out = {}, key = (c, up) => dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { code: c }));
    const step = (n, tgt) => { for (let i = 0; i < n; i++) { M.life.update(0.1, 5 + i * 0.1, tgt, 0); M.boats.update(0.1, 5 + i * 0.1, M.camera); if (M.ride.active) M.ride.update(0.1, 0); } };
    step(10, { x: 0, z: 0 });
    // --- pelican: pick it on the map, follow, then fly it: turn, climb, land, take off
    const P = M.flyers || []; out.birds = P.length;
    const bd = P[0], pos = bd.m.position; M.controls.enabled = false; M.camera.position.set(pos.x + 25, pos.y + 30, pos.z + 25); M.camera.lookAt(pos); M.camera.updateMatrixWorld();
    const v = pos.clone(); v.y += 0.3; v.project(M.camera); const hit = M.ride.pick((v.x * 0.5 + 0.5) * innerWidth + 2, (-v.y * 0.5 + 0.5) * innerHeight + 2);
    out.birdPick = hit ? hit.kind + (hit.obj === bd ? ' same' : ' other') : 'missed';
    M.enterRide({ kind: 'bird', obj: bd }); step(5, pos);
    out.birdCam = { dist: M.camera.position.distanceTo(pos).toFixed(1), above: (M.camera.position.y - pos.y).toFixed(1), exit: document.querySelector('#rideExit').textContent, take: document.querySelector('#hmTake').textContent, y0: (pos.y / 1.7).toFixed(1) };
    document.querySelector('#hmTake').click(); const h0 = bd.hd, y0 = bd.y;
    key('KeyD'); key('KeyW'); step(30, pos); key('KeyD', 1); key('KeyW', 1);
    out.birdFly = { ctl: !!bd.ctl, turnedRightDeg: ((h0 - bd.hd) * 57.3).toFixed(0), climbed: (bd.y - y0).toFixed(1), gauges: document.querySelector('#ride .gauges').textContent.replace(/\s+/g, ' ').trim() };
    key('KeyS'); step(400, pos); key('KeyS', 1); out.birdLand = { afloat: bd.afloat, v: bd.v.toFixed(1), aboveSea: (bd.y - M.U.uSeaM.value * 1.7).toFixed(2), depthText: document.querySelector('#hmDepth').textContent };
    key('KeyW'); step(40, pos); key('KeyW', 1); out.birdUp = { afloat: bd.afloat, aboveSea: (bd.y - M.U.uSeaM.value * 1.7).toFixed(1) };
    M.exitRide(); out.birdAfter = { ctl: !!bd.ctl, active: M.ride.active };
    // --- 4WD: ride, take the wheel, drive inland, brake, give it back
    const c = M.rideable[0]; step(20, c.m.position); M.enterRide(c); step(3, c.m.position);
    const p0 = c.m.position.clone(), hc = c.m.rotation.y; document.querySelector('#hmTake').click();
    out.carTake = { drive: !!c.drive, text: document.querySelector('#hmTake').textContent, keys: getComputedStyle(document.querySelector('#ride .helm .keys')).display, gauges: getComputedStyle(document.querySelector('#ride .helm .gauges')).display };
    key('KeyA'); step(25, c.m.position); key('KeyA', 1); step(20, c.m.position);
    out.carDrive = { moved: c.m.position.distanceTo(p0).toFixed(0), turnedLeftDeg: ((c.m.rotation.y - hc) * 57.3).toFixed(0), speedKmh: document.querySelector('#rdSpeed').textContent, onGround: (c.m.position.y - M.U.uSeaM.value * 1.7 > -0.5) };
    key('KeyS'); step(60, c.m.position); key('KeyS', 1); out.carBrake = { v: c.drive.v.toFixed(1) };
    M.exitRide(); step(5, c.m.position); out.carAfter = { drive: !!c.drive, parked: !!c.parked, visible: c.m.visible };
    // --- jet ski: aboard means at the controls
    const j = M.boats.boats.find(q => q.jet); M.enterRide({ kind: 'boat', obj: j }); out.jet = { helm: !!j.helm, text: document.querySelector('#hmTake').textContent }; M.exitRide(); out.jetAfter = !!j.helm;
    return out; });
  lg(JSON.stringify(r, null, 1)); lg('errs ' + JSON.stringify(errs)); process.exit(0);
})();

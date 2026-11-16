// Measures how steady each kind of travel is. Frames are run with an uneven frame time (as a real browser gives), and for each frame we note
//  - where the thing you ride sits in the eye's own frame of reference (it should hardly move: any jump is seen as shaking)
//  - how fast the eye is turning (deg/s), and how much that changes from frame to frame (jerk in the view)
const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); const out = process.argv[2] || 'jitter.log'; fs.writeFileSync(out, '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const ALL = [['car', false], ['car', true], ['boat', false], ['boat', true], ['yacht', false], ['yacht', true], ['jetski', true], ['pelican', false], ['pelican', true], ['eagle', false], ['eagle', true]], ONLY = process.argv[3]; p.on('crash', () => fs.appendFileSync(out, 'PAGE CRASHED\n'));
  for (const [kind, ctl] of ALL.filter(a => !ONLY || ONLY.split(',').includes(a[0] + (a[1] ? '1' : '0')))) {
    const r = await p.evaluate(([kind, ctl, ZOOM]) => {
      const M = MAP; if (M.ride.active) M.exitRide();
      if (M.travel) M.travel(kind, ctl); else { const o = kind === 'car' ? { kind: 'car', obj: M.rideable[0] } : kind === 'pelican' || kind === 'eagle' ? { kind: 'bird', obj: M.flyers.find(f => f.kind === kind) } : { kind: 'boat', obj: M.boats.boats.find(q => kind === 'yacht' ? q.sail && q.move : kind === 'jetski' ? q.jet : q.move && !q.sail && !q.jet && !q.ferry) }; o.control = ctl; M.enterRide(o); }
      if (!M.ride.active) return kind + ': could not start'; if (ZOOM) for (let i = 0; i < 3; i++) M.ride.zoomBy(1.6);
      const obj = (M.ride.car || M.ride.boat || M.ride.bird).m, V = obj.position.clone(), Q = M.camera.quaternion.clone(), rel = [], turn = [], ys = [];
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const frame = (dt) => { if (M.setDt) { M.setDt(dt); M.frame(); M.setDt(0); } else M.frame(); };
      for (let i = 0; i < 60; i++) frame(0.016);
      if (ctl) dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      let pr = null, pq = M.camera.quaternion.clone(), pt = 0;
      for (let i = 0; i < 420; i++) {
        const dt = 0.008 + rnd() * 0.026; if (ctl && i === 140) dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); if (ctl && kind !== 'car' && kind !== 'boat' && kind !== 'yacht' && kind !== 'jetski' && i === 200) dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        frame(dt);
        M.camera.updateMatrixWorld(); const l = M.camera.worldToLocal(V.copy(obj.position));
        if (pr) rel.push(Math.hypot(l.x - pr[0], l.y - pr[1], l.z - pr[2])); pr = [l.x, l.y, l.z];
        const ang = 2 * Math.acos(Math.min(1, Math.abs(pq.dot(M.camera.quaternion)))) * 57.3 / dt; if (i > 0) turn.push(Math.abs(ang - pt)); pt = ang; pq.copy(M.camera.quaternion); ys.push(M.camera.position.y);
      }
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      const st = (a) => { const s = [...a].sort((x, y) => x - y); return 'median ' + s[s.length >> 1].toFixed(3) + ', worst-in-20 ' + s[Math.floor(s.length * 0.95)].toFixed(3) + ', max ' + s[s.length - 1].toFixed(3); };
      return `${kind} ${ctl ? '(steered)' : '(watching)'}\n   thing moves in the eye's frame, m per frame: ${st(rel)}\n   change of turning speed between frames, deg/s: ${st(turn)}\n   eye height range ${Math.min(...ys).toFixed(1)} .. ${Math.max(...ys).toFixed(1)}`;
    }, [kind, ctl, !!process.argv[4]]);
    fs.appendFileSync(out, r + '\n');
  }
  fs.appendFileSync(out, 'errors: ' + JSON.stringify(errs.slice(0, 4)) + '\n');
  await b.close();
})();

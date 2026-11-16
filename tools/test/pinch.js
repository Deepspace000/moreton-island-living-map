// two fingers on the screen: pinching them together must draw the view back, spreading them must bring it close again
const { chromium } = require('playwright'); const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 412, height: 800 }, hasTouch: true, isMobile: true })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); fs.writeFileSync('pinch.log', '');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const r = await p.evaluate(() => {
    const M = MAP, c = document.getElementById('c'), out = [], ev = (type, id, x, y, target) => (target || window).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    for (const kind of ['car', 'yacht', 'eagle']) {
      M.travel(kind, false); for (let i = 0; i < 10; i++) { M.setDt(0.03); M.frame(); M.setDt(0); }
      const z0 = M.ride.zoom, l0 = M.ride.look;
      ev('pointerdown', 1, 150, 400, c); ev('pointerdown', 2, 260, 400, c);
      for (let i = 1; i <= 12; i++) { ev('pointermove', 1, 150 + i * 3, 400); ev('pointermove', 2, 260 - i * 3, 400); }      // fingers together
      const z1 = M.ride.zoom;
      for (let i = 12; i >= -14; i--) { ev('pointermove', 1, 150 + i * 3, 400); ev('pointermove', 2, 260 - i * 3, 400); }    // and apart again, further than they started
      const z2 = M.ride.zoom; ev('pointerup', 1, 0, 0); ev('pointerup', 2, 0, 0);
      out.push(`${kind}: zoom ${z0.toFixed(1)} -> pinched in ${z1.toFixed(1)} -> spread out ${z2.toFixed(1)}; head turned by ${(M.ride.look - l0).toFixed(2)} rad during the pinch (should be 0)`);
      M.exitRide();
    }
    return out.join('\n');
  });
  fs.appendFileSync('pinch.log', r + '\nerrors: ' + JSON.stringify(errs.slice(0, 3)) + '\n'); await b.close();
})();

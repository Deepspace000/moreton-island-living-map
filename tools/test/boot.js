const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); p.setDefaultTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(NOREND);
  const T0 = Date.now();
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  try { await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 }); } catch (e) { console.log('boot did not finish:', await p.evaluate(() => document.getElementById('ldmsg')?.textContent)); }
  console.log('boot', ((Date.now() - T0) / 1000).toFixed(1) + 's', 'errors:', errs);
  console.log(await p.evaluate(() => { const M = MAP, inst = M.scene.children.filter(c => c.geometry && c.geometry.isInstancedBufferGeometry).map(c => c.geometry.instanceCount); return JSON.stringify({ meshes: M.scene.children.length, instanced: inst, roads: 'n/a' }); }));
  // touch walking
  await p.evaluate(() => { const P = MAP.features.places.find(q => q.n === 'The Desert'); MAP.enterWalk(P.x + 60, P.z + 30); MAP.walk.yaw = 0; });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const sec = (label) => p.evaluate((label) => { const w = MAP.walk, x0 = w.pos.x, z0 = w.pos.z, y0 = w.yaw; for (let i = 0; i < 60; i++) w.update(1 / 60);
    const dx = w.pos.x - x0, dz = w.pos.z - z0, fwd = dx * Math.sin(y0) - dz * Math.cos(y0);
    return `${label} forward ${fwd.toFixed(1)} m, turned ${((w.yaw - y0) * 57.3).toFixed(0)} deg, pitch ${w.pitch.toFixed(2)}, speed ${w.speed.toFixed(1)}, ring ${getComputedStyle(document.getElementById('stick')).display}`; }, label).then(console.log);
  await touch('touchStart', [[206, 400, 1]]); await sec('touch         '); 
  await touch('touchMove', [[206, 470, 1]]); await sec('slide down    ');
  await touch('touchMove', [[276, 470, 1]]); await sec('down + right  ');
  await touch('touchMove', [[206, 340, 1]]); await sec('slide far up  ');
  await touch('touchMove', [[206, 400, 1]]);
  await touch('touchStart', [[206, 400, 1], [330, 250, 2]]); await sec('two fingers   ');
  await touch('touchMove', [[206, 400, 1], [370, 210, 2]]); await sec('two, one drags');
  await touch('touchEnd', [[370, 210, 2]]); await sec('back to one   ');
  await touch('touchEnd', []); await sec('none          ');
  // sound engine: start it and run a few updates in different places
  console.log(await p.evaluate(async () => { document.getElementById('btSound').click(); const s = []; for (let i = 0; i < 40; i++) { MAP.frame && 0; await new Promise(r => setTimeout(r, 50)); } return 'sound button on: ' + document.getElementById('btSound').classList.contains('on'); }));
  console.log('errors at end:', errs);
  await b.close();
})();

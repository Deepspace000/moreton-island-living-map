const { chromium } = require('playwright');
const fs = require('fs');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; v.renderer.render = () => {}; } }); };
(async () => {
  const phone = process.argv[2] === 'phone', w = phone ? 412 : 1100, h = phone ? 860 : 700;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone }); const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1])); const lg = (m) => fs.appendFileSync('menutest.log', m + '\n');
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  const tick = (n = 4) => p.evaluate((n) => { for (let i = 0; i < n; i++) MAP.frame(); }, n);
  await tick(6); await p.waitForTimeout(400); await tick(3);
  const st0 = await p.evaluate(() => { const tv = document.getElementById('travel'), r = tv.getBoundingClientRect(), t = document.getElementById('title').getBoundingClientRect(), pl = document.getElementById('places').getBoundingClientRect(); return { min: tv.classList.contains('min'), chip: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], titleBottom: Math.round(t.bottom), placesTop: Math.round(pl.top) }; });
  lg('start ' + JSON.stringify(st0));

  await p.evaluate(() => document.querySelector('#travel .win-min').click()); await p.waitForTimeout(300); await tick(3);
  const st1 = await p.evaluate(() => { const tv = document.getElementById('travel'), r = tv.getBoundingClientRect(), pl = document.getElementById('places').getBoundingClientRect(); return { min: tv.classList.contains('min'), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], placesTop: Math.round(pl.top), rows: tv.querySelectorAll('.tv-row').length }; });
  lg('open ' + JSON.stringify(st1));

  const state = () => p.evaluate(() => { const M = MAP, R = M.ride, o = R.car || R.boat || R.bird; return { active: R.active, what: !o ? '-' : R.car ? 'car' : R.bird ? o.kind : o.jet ? 'jetski' : o.sail ? 'yacht' : 'boat', helm: R.helm, exit: document.querySelector('#rideExit').textContent, rowOn: [...document.querySelectorAll('#travel .tv-row.on')].map(r => r.dataset.kind + ':' + [...r.querySelectorAll('button.on')].map(b => b.textContent)).join(','), back: getComputedStyle(document.getElementById('tvBack')).display }; });
  for (const kind of ['car', 'boat', 'yacht', 'jetski', 'pelican', 'eagle']) {
    await p.evaluate((q) => document.querySelector(q).click(), `#travel .tv-row[data-kind="${kind}"] button[data-ctl="0"]`); await tick(4); const a = await state();
    const id1 = await p.evaluate(() => { const R = MAP.ride, o = R.car || R.boat || R.bird; return MAP.__ids = MAP.__ids || new Map(), MAP.__ids.has(o) ? MAP.__ids.get(o) : (MAP.__ids.set(o, MAP.__ids.size), MAP.__ids.get(o)); });
    await p.evaluate((q) => document.querySelector(q).click(), `#travel .tv-row[data-kind="${kind}"] button[data-ctl="1"]`); await tick(4); const c = await state();
    const id2 = await p.evaluate(() => { const R = MAP.ride, o = R.car || R.boat || R.bird; return MAP.__ids.has(o) ? MAP.__ids.get(o) : (MAP.__ids.set(o, MAP.__ids.size), MAP.__ids.get(o)); });
    await p.evaluate((q) => document.querySelector(q).click(), `#travel .tv-row[data-kind="${kind}"] button[data-ctl="1"]`); await tick(4); const d = await state();
    const id3 = await p.evaluate(() => { const R = MAP.ride, o = R.car || R.boat || R.bird; return MAP.__ids.has(o) ? MAP.__ids.get(o) : (MAP.__ids.set(o, MAP.__ids.size), MAP.__ids.get(o)); });
    lg(kind + ' watch ' + JSON.stringify(a) + ' | control(same=' + (id1 === id2) + ') ' + JSON.stringify(c) + ' | again(next=' + (id3 !== id2) + ') helm ' + d.helm);

  }
  await p.evaluate(() => document.querySelector('#tvBack').click()); await tick(3); lg('back ' + JSON.stringify(await state()));
  lg('errs ' + JSON.stringify(errs)); process.exit(0);
})();

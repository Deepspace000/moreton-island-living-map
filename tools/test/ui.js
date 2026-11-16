const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  for (const [name, w, h, touch] of [['desk', 1280, 720, false], ['phone', 412, 915, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(); p.setDefaultTimeout(120000);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(NOREND);
    await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.MAP && window.MAP.walk && document.querySelectorAll('#places button').length > 3);
    await p.evaluate(() => { document.getElementById('loading')?.remove(); document.getElementById('c').style.display = 'none'; document.body.style.background = 'linear-gradient(#7fb4d6 45%, #d9c79a 45%)'; });
    await p.screenshot({ path: `ui_${name}_1open.png` });
    await p.evaluate(() => MAP.enterWalk(-1500, 1200));
    await p.screenshot({ path: `ui_${name}_2walk.png` });
    for (const id of ['walkHint', 'bar']) await p.click(`#${id} > .win-min`);
    await p.screenshot({ path: `ui_${name}_3walkmin.png` });
    await p.evaluate(() => MAP.exitWalk());
    for (const id of ['title', 'wx', 'places']) if (await p.isVisible(`#${id} > .win-min`)) await p.click(`#${id} > .win-min`);
    await p.screenshot({ path: `ui_${name}_4allmin.png` });
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.MAP && window.MAP.walk);
    console.log(name, 'after reload minimised:', await p.evaluate(() => [...document.querySelectorAll('.win.min')].map(e => e.id).join(' ')), '| errors', errs);
    await p.click('#bar > .win-min'); await p.click('#wx > .win-min');
    console.log(name, 'reopened:', await p.evaluate(() => [...document.querySelectorAll('.win:not(.min)')].map(e => e.id).join(' ')));
    await ctx.close();
  }
  await b.close();
})();

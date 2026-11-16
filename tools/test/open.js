const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 600 }, offline: process.argv[2] !== 'online' });
  const q = await ctx.newPage(); q.setDefaultTimeout(60000);
  q.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300))); q.on('console', m => console.log('console:', m.text().slice(0, 300)));
  q.on('requestfailed', r => console.log('FAILED', r.url().slice(0, 100), r.failure()?.errorText));
  await q.addInitScript(NOREND);
  const T0 = Date.now();
  q.goto('file://' + process.cwd() + '/Moreton-Island-Living-Map.html', { waitUntil: 'commit' }).catch(e => console.log('goto', e.message.slice(0, 100)));
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await Promise.race([q.evaluate(() => document.readyState + ' | ' + (document.getElementById('ldmsg')?.textContent || 'no loader') + ' ' + (document.getElementById('ldpct')?.textContent || '') + ' | MAP ' + !!window.MAP + ' | packed ' + (window.PACKED ? Object.keys(window.PACKED).length : 'none')).catch(e => 'eval err ' + e.message.slice(0, 80)), new Promise(r => setTimeout(() => r('busy'), 3000))]);
    console.log(((Date.now() - T0) / 1000).toFixed(0) + 's', s);
  }
  await b.close();
})();

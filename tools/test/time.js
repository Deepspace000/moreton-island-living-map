const { chromium } = require('playwright');
const [port, w, h] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
  p.on('console', m => console.log('page:', m.text().slice(0, 300)));
  const T0 = Date.now(), tick = (m) => console.log(((Date.now() - T0) / 1000).toFixed(1) + 's', m);
  await p.goto(`http://127.0.0.1:${port}/index.html?shot&dpr=1&ui=0&labels=0&q=low`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk, null, { timeout: 240000, polling: 500 });
  await p.evaluate(() => MAP.renderer.setAnimationLoop(null)); tick('ready');
  for (let i = 0; i < 4; i++) { await p.evaluate(() => { MAP.frame(); MAP.renderer.getContext().finish(); }); tick('frame ' + i); }
  await b.close();
})();

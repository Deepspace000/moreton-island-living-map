const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 480, height: 300 } })).newPage();
  await p.goto('about:blank');
  console.log(await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return 'no webgl2'; const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL) + ' | ' + g.getParameter(g.VERSION); }));
  await b.close();
})();

// compile only the materials whose shader text matches the given patterns, and print any shader errors
const { chromium } = require('playwright');
const pats = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error' || /shader|GLSL|ERROR/i.test(m.text())) errs.push(m.text().slice(0, 1500)); });
  await p.addInitScript(() => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); });
  await p.goto('http://127.0.0.1:8931/index.html?shot&dpr=1&ui=0&labels=0&w=320&h=200', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 0, polling: 500 });
  for (const pat of pats) {
    const n = await p.evaluate((pat) => { const re = new RegExp(pat); let n = 0; const M = MAP, keep = new Set();
      M.scene.traverse(c => { const m = c.material; if (m && (re.test(m.vertexShader || '') || re.test(m.fragmentShader || '') || re.test(JSON.stringify(m.defines || {})))) { keep.add(c); n++; } });
      const vis = []; M.scene.traverse(c => { if (c.isMesh || c.isPoints || c.isLine) { vis.push([c, c.visible]); c.visible = keep.has(c); } });
      try { M.renderer.render(M.scene, M.camera); } catch (e) { console.error('render threw ' + e.message); }
      for (const [c, v] of vis) c.visible = v; return n; }, pat);
    console.log(pat, 'materials:', n, 'errors so far:', errs.length);
  }
  await new Promise(r => setTimeout(r, 1500));
  for (const e of errs.slice(0, 4)) console.log('---\n' + e);
  await b.close();
})();

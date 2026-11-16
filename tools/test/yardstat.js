const { chromium } = require('playwright');
const NOREND = () => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 560 } })).newPage(); p.setDefaultTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(NOREND);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  console.log(await p.evaluate(() => { const M = MAP, F = M.F, pm = M.scene.children.find(c => c.name === 'people'), C = pm.geometry.attributes.iC.array;
    const yt = M.U.uYard.value, d = yt && yt.image.data; let cells = 0; if (d) for (let i = 0; i < d.length; i += 4) if (d[i]) cells++;
    let tris = 0, verts = 0; M.scene.traverse(c => { const g = c.geometry; if (!g || !g.attributes.position) return; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (g.isInstancedBufferGeometry ? g.instanceCount : 1); tris += n; });
    const big = []; M.scene.traverse(c => { const g = c.geometry; if (!g || !g.attributes.position) return; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (g.isInstancedBufferGeometry ? g.instanceCount : 1); if (n > 4e5) big.push((c.name || c.type) + ':' + (n / 1e6).toFixed(2) + 'M'); });
    return JSON.stringify({ parked: F.parked.length, hoists: (F.hoists || []).length, tinnies: (F.tinnies || []).length, yardCells: cells, yardTex: yt && [yt.image.width, yt.image.height], people: pm.geometry.instanceCount, shirts: Array.from(C.slice(0, 21)).map(v => +v.toFixed(2)), trisM: +(tris / 1e6).toFixed(1), big }); }));
  console.log('errors', errs);
  await b.close();
})();

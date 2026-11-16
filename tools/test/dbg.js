// draw only the ground and the meshes whose vertex shader matches a pattern, with an optional text replacement in that shader
const { chromium } = require('playwright'); const fs = require('fs');
const [pat, rep, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 800, height: 500 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (/Shader Error|ERROR: /.test(m.text())) errs.push(m.text().slice(0, 1500)); });
  await p.addInitScript(() => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); });
  await p.goto('http://127.0.0.1:8931/index.html?shot&dpr=1&ui=0&labels=0&w=800&h=500', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 0, polling: 500 });
  const r = await p.evaluate(async ([pat, rep]) => { const re = new RegExp(pat), M = MAP; const keep = [];
    M.scene.traverse(c => { const m = c.material; if (m && re.test(m.vertexShader || '')) { keep.push(c); if (rep) { const [a, bb] = rep.split('=>'); if (m.vertexShader.includes(a)) { m.vertexShader = m.vertexShader.replace(a, bb); m.needsUpdate = true; } } } });
    M.scene.traverse(c => { if (c.isMesh || c.isPoints || c.isLine) c.visible = keep.includes(c) || /treeShade/.test(c.material?.fragmentShader || ''); });
    const wr = M.F.beach.filter(r => r.side < 0); let best = null, bd = 1e9; for (const r of wr) for (const q of r.p) { const d = Math.abs(q[1] - 10300); if (d < bd) { bd = d; best = q; } }
    M.setMinutes(900); M.setMode('clear'); if (M.walk.active) M.exitWalk();
    M.camera.position.set(best[0] - 20, 45, best[1] + 60); M.controls.target.set(best[0] + 25, 0, best[1]);
    const vis = () => M.scene.traverse(c => { if (c.isMesh || c.isPoints || c.isLine) c.visible = keep.includes(c) || /treeShade/.test(c.material?.fragmentShader || ''); });
    for (let i = 0; i < 3; i++) { M.frame(); vis(); await new Promise(r => setTimeout(r, 500)); }
    vis(); M.renderer.render(M.scene, M.camera);
    return JSON.stringify({ n: keep.length, info: keep.map(c => ({ vis: c.visible, inst: c.geometry.instanceCount, verts: c.geometry.attributes.position.count, centre: c.material.uniforms.uCentre?.value.toArray(), cs: c.material.uniforms.uCS?.value })), url: document.getElementById('c').toDataURL('image/jpeg', 0.9) }); }, [pat, rep]);
  const o = JSON.parse(r); fs.writeFileSync(out, Buffer.from(o.url.split(',')[1], 'base64')); delete o.url; console.log(JSON.stringify(o));
  for (const e of errs.slice(0, 2)) console.log('---\n' + e);
  await b.close();
})();

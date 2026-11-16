// render one scatter mesh alone (software GL) to see whether it draws at all
const { chromium } = require('playwright'); const fs = require('fs');
const [pat, force, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 400 } })).newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (/Shader Error|ERROR: /.test(m.text())) errs.push(m.text().slice(0, 1500)); });
  await p.addInitScript(() => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); });
  await p.goto('http://127.0.0.1:8931/index.html?shot&dpr=1&ui=0&labels=0&w=640&h=400', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 0, polling: 500 });
  const r = await p.evaluate(([pat, force]) => { const re = new RegExp(pat), M = MAP; let mesh = null;
    M.scene.traverse(c => { const m = c.material; if (m && re.test(m.vertexShader || '')) mesh = c; });
    if (!mesh) return 'no mesh';
    if (force) { const [a, bb] = force.split('=>'); mesh.material.vertexShader = mesh.material.vertexShader.replace(a, bb); mesh.material.needsUpdate = true; }
    M.scene.traverse(c => { if (c.isMesh || c.isPoints || c.isLine) c.visible = c === mesh; });
    const wr = M.F.beach.filter(r => r.side < 0); let best = null, bd = 1e9; for (const r of wr) for (const q of r.p) { const d = Math.abs(q[1] - 10300); if (d < bd) { bd = d; best = q; } }
    M.camera.position.set(best[0] - 20, 45, best[1] + 60); M.camera.lookAt(best[0] + 25, 0, best[1]); M.camera.updateMatrixWorld();
    const uni = mesh.material.uniforms; uni.uCentre.value.set(Math.floor((best[0] + 25) / uni.uCS.value), Math.floor(best[1] / uni.uCS.value));
    M.renderer.setClearColor(0x4060a0, 1); M.renderer.render(M.scene, M.camera);
    const g = mesh.geometry; return JSON.stringify({ inst: g.instanceCount, verts: g.attributes.position.count, idx: g.index.count, hasN: !!g.attributes.normal, cs: uni.uCS.value, url: document.getElementById('c').toDataURL('image/jpeg', 0.9) }); }, [pat, force]);
  if (r[0] === '{') { const o = JSON.parse(r); fs.writeFileSync(out, Buffer.from(o.url.split(',')[1], 'base64')); delete o.url; console.log(JSON.stringify(o)); } else console.log(r);
  for (const e of errs.slice(0, 2)) console.log('---\n' + e);
  await b.close();
})();

const { chromium } = require('playwright');
const HOOK = () => {
  let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } });
  const c0 = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...r) { if (dest instanceof AudioDestinationNode && !window.__an) { const an = this.context.createAnalyser(); an.fftSize = 8192; window.__an = an; c0.call(this, an); } return c0.call(this, dest, ...r); };
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage(); p.setDefaultTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); 
  await p.addInitScript(HOOK);
  await p.goto('http://127.0.0.1:8931/index.html?shot', { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 90000, polling: 500 });
  await p.click('#btSound');
  const run = (label, o) => p.evaluate(async ({ label, o }) => {
    const M = MAP, F = M.F, east = F.beach.filter(r => r.side > 0).sort((a, b) => b.p.length - a.p.length)[0], bp = east.p[Math.floor(east.p.length * 0.55)], west = F.beach.filter(r => r.side < 0).sort((a, b) => b.p.length - a.p.length)[0], wp = west.p[Math.floor(west.p.length * 0.5)];
    const pos = { ocean: [bp[0], bp[1]], bay: [wp[0], wp[1]], forest: [1232, -4300], sea: [-6000, 0] }[o.at];
    M.U.uNight.value = o.night || 0; M.U.uFlash.value = 0;
    const an = window.__an, buf = new Float32Array(an.fftSize), fb = new Float32Array(an.frequencyBinCount); let sum = 0, n = 0, peak = 0;
    for (let i = 0; i < o.secs * 20; i++) {
      if (o.flash && i === 10) M.U.uFlash.value = 1; if (o.flash && i === 14) M.U.uFlash.value = 0;
      M.sound.update({ x: pos[0], z: pos[1], dist: o.dist || 0, wind: o.wind ?? 12, wave: o.wave ?? 1, rain: o.rain || 0, dt: 0.05 });
      await new Promise(r => setTimeout(r, 50));
      if (i > 30) { an.getFloatTimeDomainData(buf); for (const v of buf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); } n += buf.length; }
    }
    an.getFloatFrequencyData(fb); const hz = an.context.sampleRate / an.fftSize; const band = (a, b2) => { let s = 0; for (let i = Math.floor(a / hz); i < b2 / hz; i++) s += 10 ** (fb[i] / 10); return (10 * Math.log10(s)).toFixed(0); };
    return `${label.padEnd(28)} rms ${(20 * Math.log10(Math.sqrt(sum / n) + 1e-9)).toFixed(1)} dB  peak ${peak.toFixed(2)}  bands dB: <300Hz ${band(20, 300)}, 0.3-2k ${band(300, 2000)}, 2-8k ${band(2000, 8000)}`;
  }, { label, o }).then(console.log);
  await run('forest, day (cicadas, birds)', { at: 'forest', secs: 12 });
  await run('forest, night (crickets)', { at: 'forest', secs: 9, night: 1 });
  await run('bay beach, calm', { at: 'bay', secs: 8, wind: 6 });
  await run('ocean beach, day', { at: 'ocean', secs: 9 });
  console.log('errors:', errs);
  await b.close();
})();

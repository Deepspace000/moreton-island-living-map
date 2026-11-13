// Review captures (dev only): await (await import('/tools/shots.js')).run('b', ['overview','resort'])
export async function run(prefix, only) {
  const M = window.MAP, P = Object.fromEntries(M.features.places.map(p => [p.n, p]));
  const t = P['Tangalooma Resort'], c = P['Cape Moreton Lighthouse'], w = P['Tangalooma Wrecks'], k = P['Kooringal'], d = P['The Desert'], b = P['Bulwer'], mt = P['Mount Tempest'], bs = P['Big Sandhills'];
  const S = {
    overview: { cam: [-23000, 17000, 25000, 1200, 0, 300], min: 630, wx: 'clear' },
    wrecks: { cam: [w.x - 440, 170, w.z + 420, w.x, 0, w.z], min: 630, wx: 'clear' },
    wrecklow: { cam: [w.x - 190, 16, w.z + 150, w.x + 30, 4, w.z - 40], min: 900, wx: 'clear' },
    resort: { cam: [t.x - 700, 260, t.z + 250, t.x + 100, 10, t.z], min: 630, wx: 'clear' },
    cape: { cam: [c.x + 500, 330, c.z - 700, c.x, 150, c.z], min: 630, wx: 'clear' },
    desert: { cam: [d.x - 1500, 700, d.z + 1300, d.x, 60, d.z], min: 960, wx: 'clear' },
    tempest: { cam: [mt.x - 3600, 1500, mt.z + 3600, mt.x, 300, mt.z], min: 1000, wx: 'cloudy' },
    sandhills: { cam: [bs.x - 2600, 900, bs.z + 2400, bs.x, 60, bs.z], min: 450, wx: 'clear' },
    kooringal: { cam: [k.x - 1300, 520, k.z + 900, k.x, 5, k.z], min: 720, wx: 'cloudy' },
    sunset: { cam: [9000, 2600, 9000, -1500, 0, -2500], min: 1085, wx: 'clear' },
    sunsetlow: { cam: [w.x + 130, 26, w.z + 260, w.x - 200, 6, w.z - 60], min: 1090, wx: 'clear' },
    night: { cam: [t.x - 900, 300, t.z + 500, t.x + 100, 10, t.z], min: 1290, wx: 'clear' },
    nightcape: { cam: [c.x + 1500, 500, c.z - 1300, c.x, 170, c.z], min: 1320, wx: 'clear' },
    storm: { cam: [-17000, 9000, 20000, 1200, 0, 300], min: 840, wx: 'storm' },
    stormlow: { cam: [b.x - 900, 70, b.z + 300, b.x, 5, b.z], min: 840, wx: 'storm' },
    cloudy: { cam: [-9000, 5200, -24000, 2500, 0, -8000], min: 930, wx: 'cloudy' },
    sail: null,
  };
  const out = [];
  for (const n of (only || Object.keys(S))) {
    if (n === 'sail') { await M.shot('tmp.jpg', { min: 700, wx: 'cloudy' }); const s = M.boats.boats.find(q => q.sail); const fx = Math.cos(s.hd), fz = -Math.sin(s.hd); S.sail = { cam: [s.x - fx * 20 + fz * 62, 13, s.z - fz * 20 - fx * 62, s.x + fx * 30, 7, s.z + fz * 30] }; }
    if (!S[n]) continue;
    out.push(await M.shot(`${prefix}_${n}.jpg`, S[n]));
  }
  return out.join(', ');
}

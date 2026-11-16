// usage: node shot.js <port> <prefix> <mobile 0|1> <view...>
const { chromium } = require('playwright');
const fs = require('fs');
const [port, prefix, mobile, W, H, ...views] = process.argv.slice(2).map((v, i) => i === 3 || i === 4 ? +v : v);
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ...(mobile === '1' ? { userAgent: UA } : {}) });
  const p = await ctx.newPage(); p.setDefaultTimeout(0);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || /WebGL|shader|GLSL/i.test(m.text())) errs.push(m.text().slice(0, 600)); });
  const T0 = Date.now(), tick = (m) => fs.appendFileSync(prefix + '.log', ((Date.now() - T0) / 1000).toFixed(1) + 's ' + m + '\n');
  await p.addInitScript(() => { let m; Object.defineProperty(window, 'MAP', { configurable: true, get: () => m, set: (v) => { m = v; v.renderer.compile = () => {}; v.renderer.setAnimationLoop = () => {}; } }); });
  await p.goto(`http://127.0.0.1:${port}/index.html?shot&dpr=1${/^ui/.test(prefix) ? '' : '&ui=0&labels=0'}&w=${W}&h=${H}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.MAP && window.MAP.walk && !document.getElementById('loading'), null, { timeout: 0, polling: 500 });
  tick('ready, step ' + await p.evaluate(() => MAP.T.step));
  if (/wal/.test(prefix)) tick('wal ' + await p.evaluate(() => { let n = 0; MAP.scene.traverse(c => { const m = c.material; if (m && m.vertexShader && /float scrub = /.test(m.vertexShader)) { m.vertexShader = m.vertexShader.replace(/float scrub = [^;]*;/, 'float scrub = 1.0;'); m.needsUpdate = true; n++; c.name = 'wallabies'; } }); return n; }));
  if (/zoo/.test(prefix)) tick('zoo ' + await p.evaluate(() => { let n = 0; MAP.scene.traverse(c => { const m = c.material; if (m && m.vertexShader && /step\(h3, 0\.0[457]\)/.test(m.vertexShader)) { m.vertexShader = m.vertexShader.replace(/step\(h3, 0\.0[457]\)/, 'step(h3, 0.6)'); m.needsUpdate = true; n++; } }); return n; }));
  if (/og[AB]/.test(prefix)) tick('og ' + await p.evaluate((v) => { let n = 0; MAP.scene.traverse(c => { const m = c.material; if (m && m.vertexShader && /float oakG/.test(m.vertexShader)) { m.vertexShader = m.vertexShader.replace('oakG = max(oakG, isOak * tall *', 'oakG = max(oakG, ' + v + ' *'); m.needsUpdate = true; n++; } }); return n; }, /ogA/.test(prefix) ? 'isOak' : 'tall'));
  if (/coastdbg/.test(prefix)) tick('coast ' + await p.evaluate(() => { let n = 0; MAP.scene.traverse(c => { const m = c.material; if (m && m.fragmentShader && /float coastK/.test(m.fragmentShader) && /resK \* resLawn \* 0.9/.test(m.fragmentShader)) { m.fragmentShader = m.fragmentShader.replace('col = mix(col, vec3(0.105, 0.15, 0.055)', 'col = mix(col, vec3(1.0, 0.0, 0.0), coastK * 0.8); col = mix(col, vec3(0.0, 0.0, 1.0), wetK * 0.8); col = mix(col, vec3(0.105, 0.15, 0.055)'); m.needsUpdate = true; n++; } }); return n; }));
  if (/rutdbg/.test(prefix)) tick('rut ' + await p.evaluate(() => { let n = 0; MAP.scene.traverse(c => { const m = c.material; if (m && m.fragmentShader && /a = 0.4 \* rut/.test(m.fragmentShader)) { m.fragmentShader = m.fragmentShader.replace('col = vec3(0.60, 0.50, 0.33); a = 0.4 * rut', 'col = vec3(1.0, 0.0, 0.0); a = 4.0 * rut'); m.needsUpdate = true; n++; } }); return n + ' beach routes ' + MAP.F.beach.length + ' roads c3 ' + MAP.F.roads.filter(r => r.c === 3).length; }));
  if (/snag/.test(prefix)) tick('snag ' + await p.evaluate(() => { let n = 0; MAP.scene.traverse(c => { const m = c.material; if (m && m.vertexShader && /step\(h3, 0\.085\)/.test(m.vertexShader)) { m.vertexShader = m.vertexShader.replace(/step\(h3, 0\.085\)/, 'step(h3, 0.7)'); m.needsUpdate = true; n++; } }); return n; }));
  // views are worked out in the page, from the map's own data
  for (const n of views) {
    await p.evaluate(async (n) => {
      const M = MAP, F = M.F, P = Object.fromEntries(M.features.places.map(p => [p.n, p]));
      const w = P['Tangalooma Wrecks'], t = P['Tangalooma Resort'], east = F.beach.filter(r => r.side > 0).sort((a, b) => b.p.length - a.p.length)[0], bp = east.p[Math.floor(east.p.length * 0.55)];
      const car = M.scene.children.find(c => c.name === 'car'), sn = M.scene.children.find(c => c.name === 'snorkeler');
      const V = {
        hills: { cam: [1555 - 520, 230, 10824 + 420, 1555, 60, 10824] },
        edge: { cam: [1100 - 200, 95, 10500 + 160, 1100, 50, 10500] },
        desert: { cam: [-1556 - 420, 190, 1204 + 360, -1556, 40, 1204] },
        resort: { cam: [t.x - 500, 200, t.z + 250, t.x + 100, 10, t.z] },
        palms: { cam: [t.x - 190, 26, t.z + 40, t.x - 20, 10, t.z - 20] },
        wrecks: { cam: [w.x - 190, 16, w.z + 150, w.x + 30, 4, w.z - 40] },
        wrecktop: { cam: [w.x - 70, 60, w.z + 60, w.x, 0, w.z] },
        snork: sn && { cam: [sn.position.x - 14, 7, sn.position.z + 12, sn.position.x, 0, sn.position.z] },
        shallows: { cam: [t.x - 330, 22, t.z - 700, t.x - 250, 0, t.z - 760] },
        car: car && { cam: [car.position.x + 26, car.position.y + 9, car.position.z + 30, car.position.x, car.position.y + 1, car.position.z] },
        beachtop: { cam: [bp[0] + 60, 45, bp[1] + 120, bp[0], 2, bp[1]] },
        walkbeach: { walk: [bp[0] + 4, bp[1], 3.1, -0.12] },
        shells: { walk: [bp[0] + 9, bp[1] + 20, 3.1, -0.75] },
        walkforest: { walk: [t.x + 420, t.z - 250, 0.6, 0.05] },
        walkforest2: { walk: [1232, -4300, 2.2, 0.1] },
        heath: { cam: [4646 - 300, 120, -10508 + 380, 4646, 10, -10508] },
        mangrove: { cam: [2899 - 260, 60, 18645 + 200, 2899, 2, 18645] },
        overview: { cam: [-23000, 17000, 25000, 1200, 0, 300] },
        fish: (() => { const m = M.scene.children.find(c => c.name === 'stripey'), A = m.geometry.attributes.iA.array; return { cam: [A[0] - 9, 6, A[1] + 9, A[0], -2, A[1]] }; })(),
        turtle: (() => { const m = M.scene.children.find(c => c.name === 'turtles'), A = m.geometry.attributes.iA.array; return { cam: [A[0] - 5, 34, A[1] + 5, A[0], 0, A[1]] }; })(),
        ray: (() => { const m = M.scene.children.find(c => c.name === 'rays'), A = m.geometry.attributes.iA.array; return { cam: [A[0] - 3, 22, A[1] + 3, A[0], 0, A[1]] }; })(),
        shorebird: (() => { const m = M.scene.children.find(c => c.name === 'shorebirds'), A = m.geometry.attributes.iP.array, k = Math.floor(A.length / 8) * 4; return { cam: [A[k] - 7, M.F ? 5.5 : 5, A[k + 1] + 6, A[k], 1.5, A[k + 1]] }; })(),
        butterfly: { walk: [t.x + 420, t.z - 250, 0.6, -0.1] },
        floor1: { walk: [t.x + 420, t.z - 250, 0.6, -0.45] },
        swlow: { cam: [600, 1100, 17800, 1700, 0, 15800], tide: -1.1 },
        swhigh: { cam: [600, 1100, 17800, 1700, 0, 15800], tide: 1.0 },
        flatwalk: (() => { const T = M.T, Hh = (x, z) => T.hgt[Math.round((z / T.sz + 0.5) * T.H - 0.5) * T.W + Math.round((x / T.sx + 0.5) * T.W - 0.5)]; let best = [600, 10800]; for (let i = 0; i < 40000; i++) { const x = -300 + Math.random() * 1500, z = 9000 + Math.random() * 4000, h = Hh(x, z); if (h > -0.55 && h < -0.35 && Hh(x + 25, z) < -0.2 && Hh(x - 25, z) < -0.2) { best = [x, z]; break; } } window.__flat = best; return { walk: [best[0], best[1], 0.8, -0.12], tide: -1.1 }; })(),
        flattop: (() => { const b = window.__flat || [600, 10800]; return { cam: [b[0] - 60, 70, b[1] + 60, b[0], 0, b[1]], tide: -1.1 }; })(),
        crabs: (() => { const b = window.__flat || [1700, 15800]; return { walk: [b[0], b[1], 0.8, -0.8], tide: -1.1 }; })(),
        wrecklow: { cam: [w.x - 190, 16, w.z + 150, w.x + 30, 4, w.z - 40], tide: -1.0 },
        swim: { walk: [w.x - 8, w.z + 6, 1.0, -0.55], tide: 0.3 },
        shark: (() => { const A = M.scene.children.find(c => c.name === 'sharks').geometry.attributes.iA.array; return { cam: [A[0] - 14, 9, A[1] + 12, A[0], -1, A[1]] }; })(),
        jelly: (() => { const A = M.scene.children.find(c => c.name === 'jellyfish').geometry.attributes.iA.array; return { walk: [A[0] - 3, A[1] + 2, 1.0, -0.6] }; })(),
        desertfar: { cam: [-1556 - 1500, 700, 1204 + 1300, -1556, 40, 1204] },
        neblows: { cam: [6800, 420, -14200, 6000, 20, -15200] },
        neblows2: { cam: [5600, 160, -15900, 6100, 20, -15300] },
        fromwreck: { walk: [w.x - 40, w.z, 1.45, 0.06] },
        fromwreck2: { walk: [w.x - 120, w.z + 300, 1.2, 0.05] },
        fromwreck3: { cam: [w.x - 260, 22, w.z + 40, w.x + 250, 30, w.z - 20] },
        tangahill: { cam: [t.x - 700, 120, t.z - 900, t.x + 300, 40, t.z - 1200] },
        fern1: { walk: [-1750, -12700, 1.0, 0.02] },
        fern2: { walk: [-1850, -13250, 2.4, -0.1] },
        fern3: { walk: [-1650, -10700, 0.3, 0.05] },
        ferntop: { cam: [-1900, 110, -12500, -1750, 8, -12700] },
        bulwerA: { cam: [-2330, 45, -11690, -2215, 6, -11775] },
        bulwerB: { cam: [-2150, 50, -11900, -2230, 6, -11790] },
        bulwerwalkA: { walk: [-2245, -11770, 1.9, 0.05] },
        bulwerwalkB: { walk: [-2210, -11830, 0.2, 0.05] },
        kooringal: { cam: [2760, 50, 18730, 2890, 5, 18640] },
        cowan: { cam: [-2570, 45, -6300, -2450, 6, -6370] },
        light1: { cam: [7403 - 150, 250, -16768 + 130, 7400, 185, -16775] },
        light2: { cam: [7403 + 60, 230, -16768 - 190, 7395, 180, -16790] },
        capewalk: { walk: [7372, -16690, 0.35, 0.12] },
        capewalk2: { walk: [7330, -16790, 1.45, 0.1] },
        cape: { cam: [7250, 250, -16650, 6600, 0, -14200], swell: 1.4 },
        casu1: { walk: [bp[0] - 55, bp[1] + 40, -1.2, 0.12] },
        casu2: { walk: [bp[0] - 80, bp[1] - 200, -2.2, 0.15] },
        casu3: { walk: [bp[0] - 45, bp[1] + 500, -0.9, 0.1] },
        heath1: { walk: [4500, -10250, 0.3, 0.0] },
        heath2: { walk: [-1300, 1500, 1.0, 0.0] },
        heath3: { walk: [2300, -6000, 2.0, 0.0] },
        heath4: { walk: [600, 6000, 4.0, 0.0] },
        floor2: { walk: [1232, -4300, 2.2, -0.3] },
        bush1: { walk: [t.x + 600, t.z - 500, 1.5, 0.05] },
        bush2: { walk: [4100, -9300, 0.4, 0.0] },
        bush3: { walk: [-900, 900, 2.0, 0.02] },
        bushtop: { cam: [t.x + 330, 160, t.z - 160, t.x + 420, 60, t.z - 250] },
        bulwertop: { cam: [-2426, 125, -11941, -2425, 0, -11944] },
        bulwer1: { cam: [-2505, 34, -11905, -2428, 1, -11946] },
        bulwer2: { cam: [-2380, 30, -11995, -2428, 1, -11944] },
        bulwerwalk: { walk: [-2398, -11958, -1.2, -0.05] },
        bulwerwalk2: { walk: [-2412, -11940, -3.0, -0.08] },
        bulwerwalk3: { walk: [-2404, -11930, -2.0, -0.05] },
        surf: { walk: [bp[0] + 16, bp[1], 2.2, -0.08], swell: 1.2 },
        surfbig: { walk: [bp[0] + 16, bp[1], 1.9, -0.1], swell: 2.6 },
        surf2: { cam: [bp[0] - 30, 28, bp[1] + 90, bp[0] + 45, 0, bp[1]], swell: 1.2 },
        surftop: { cam: [bp[0] + 20, 150, bp[1] + 160, bp[0] + 40, 0, bp[1]], swell: 1.2 },
        baycalm: { cam: [t.x - 260, 60, t.z + 200, t.x - 120, 0, t.z] },
        fish2: (() => { const A = M.scene.children.find(c => c.name === 'blue').geometry.attributes.iA.array; return { cam: [A[0] - 7, 5, A[1] + 7, A[0], -1, A[1]] }; })(),
        afloat: (() => { const A = M.scene.children.find(c => c.name === 'afloat').geometry.attributes.iP.array; return { cam: [A[0] - 12, 5, A[1] + 10, A[0], 0, A[1]] }; })(),
        dragon: { walk: [4376, -9560, 1.0, -0.05] },
        walkforest3: { walk: [t.x + 420, t.z - 250, 2.7, 0.12] },
        walkdune: { walk: [bp[0] - 40, bp[1], -1.57, 0.1] },
        walkdune2: { walk: [bp[0] - 150, bp[1] + 300, -0.6, 0.12] },
        treeclose: { walk: [1232, -4300, 2.2, 0.22] },
        ...(() => { const f = M.folk, Pp = f.people, look = (ax, az, bx, bz, pitch = -0.08) => ({ walk: [ax, az, Math.atan2(bx - ax, -(bz - az)), pitch] });
          const person = (kind, cx, cz) => { let best = null, bd = 1e9; for (let i = 0; i < Pp.length; i += 11) if (Pp[i + 6] === kind) { const d = Math.hypot(Pp[i] - cx, Pp[i + 1] - cz); if (d < bd) { bd = d; best = i; } } return [Pp[best], Pp[best + 1], Pp[best + 2], Pp[best + 3]]; };
          const sign = (x, z, d = 9, pitch = 0.22, side = 0) => { let s = f.signs[0]; for (const q of f.signs) if (Math.hypot(q.x - x, q.z - z) < Math.hypot(s.x - x, s.z - z)) s = q; const l = Math.hypot(s.jx - s.x, s.jz - s.z) || 1, ux = (s.jx - s.x) / l, uz = (s.jz - s.z) / l; return look(s.x + ux * d - uz * side, s.z + uz * d + ux * side, s.x, s.z, pitch); };
          const wk = person(0, -1590, -355), fi = person(1, -1885, -216), fb = person(1, -2400, -12000), c1 = f.camps.find(c => Math.abs(c[0] - 3285) < 30) || f.camps[12], c0 = f.camps[0];
          const jet = M.boats.boats.find(b => b.jet), fly = M.boats.boats.find(b => b.anchor && b.mast === 7.4), flym = M.boats.boats.find(b => b.move && !b.jet && b.mast === 7.4);
          const rf = f.reefs.find(r => Math.hypot(r[0] + 2029, r[1] + 1737) < 50) || f.reefs[0];
          const A = (n) => M.scene.children.find(c => c.name === n).geometry.attributes.iA.array, fh = A('flathead'), wh = A('whiting');
          return {
            carClose: car && { cam: [car.position.x + 6.5, car.position.y + 3.2, car.position.z + 7.5, car.position.x, car.position.y + 1.4, car.position.z] },
            carSide: car && { cam: [car.position.x + 9, car.position.y + 2.2, car.position.z + 0.5, car.position.x, car.position.y + 1.4, car.position.z] },
            carFront: car && { cam: [car.position.x + 1, car.position.y + 2.5, car.position.z + 9, car.position.x, car.position.y + 1.4, car.position.z] },
            ...(() => { const cc = M.scene.children.find(c => c.material && c.material.defines && c.material.defines.CAR && c.name !== 'car'), q = cc.position, a = cc.rotation.y, fx = Math.cos(a), fz = -Math.sin(a);
              const lk = (ax, az, p = -0.12) => ({ walk: [ax, az, Math.atan2(q.x - ax, -(q.z - az)), p] });
              return { campCar1: lk(q.x + fz * 6 + fx * 2.5, q.z - fx * 6 + fz * 2.5), campCar2: lk(q.x + fx * 7 - fz * 2.5, q.z + fz * 7 + fx * 2.5), campCar3: lk(q.x - fx * 6.5 - fz * 3.5, q.z - fz * 6.5 + fx * 3.5), campCar4: lk(q.x - fz * 5, q.z + fx * 5, -0.2) }; })(),
            houseG: { walk: [-2236, -11790, 1.2, 0.12] }, houseH: { cam: [2850, 9, 18668, 2880, 5, 18648] },
            ...(() => { const sea = M.U.uSeaM.value, Hq = (x, z) => M.T.hgt[Math.round((z / M.T.sz + 0.5) * M.T.H - 0.5) * M.T.W + Math.round((x / M.T.sx + 0.5) * M.T.W - 0.5)];
              // hold one animal of a kind on a small circle so it can be photographed: returns a walk-and-dive view of it
              const pin = (name, rad, back, up = 0.3, k = 0, pitch = -0.08) => { const m = M.scene.children.find(c => c.name === name); if (!m) return null; const A = m.geometry.attributes.iA, B = m.geometry.attributes.iB, x = A.array[k * 4], z = A.array[k * 4 + 1];
                for (let i = 0; i < Math.min(A.count, 40); i++) if (Math.hypot(A.array[i * 4] - x, A.array[i * 4 + 1] - z) < 6) A.array[i * 4 + 2] = rad * (0.6 + 0.5 * ((i * 0.37) % 1)); A.needsUpdate = true;
                const bottom = m.material.uniforms.uFlap.value.w > 0.5, dep = bottom ? sea - Hq(x, z) - 0.1 : Math.min(A.array[k * 4 + 3], sea - Hq(x, z) - 0.5), size = B.array[k * 4 + 2];
                return { walk: [x - back, z + back * 0.4, Math.atan2(back, back * 0.4), pitch], dive: Math.max(0.9, dep - up * size + 0.35 / 1.7), fix: [x, z] }; };
              const boat = (pred, d, h = 0) => { const b = M.boats.boats.find(pred); return b && { walk: [b.x - d, b.z + d * 0.5, Math.atan2(d, d * 0.5), 0.02 + h] }; };
              return {
                uwSergeant: pin('stripey', 1.3, 2.2), uwNeon: pin('neon', 1.0, 1.6), uwHumbug: pin('humbug', 1.0, 1.5), uwBream: pin('bream', 1.6, 2.6), uwBait: pin('small', 0.8, 1.2), uwWhiting: pin('whiting', 0.8, 1.2),
                uwFlathead: pin('flathead', 0.5, 1.3, -0.5, 0, -0.45), uwTurtle: pin('turtles', 1.6, 3.2), uwRay: pin('rays', 1.2, 2.6, -0.8, 0, -0.4), uwShovel: pin('shovelnose', 1.2, 2.6, -0.8, 0, -0.4), uwShark: pin('sharks', 1.8, 3.2),
                uwDolphin: pin('dolphins', 4, 6, 0.1), uwDugong: pin('dugongs', 3, 6), uwWhale: pin('whales', 14, 22, 0.2),
                topDolphin: (() => { const A = M.scene.children.find(c => c.name === 'dolphins').geometry.attributes.iA.array; return { cam: [A[0] - 30, 22, A[1] + 26, A[0], 0, A[1]] }; })(),
                topWhale: (() => { const A = M.scene.children.find(c => c.name === 'whales').geometry.attributes.iA.array; return { cam: [A[0] - 60, 40, A[1] + 50, A[0], 0, A[1]] }; })(),
                uwUp: { walk: [w.x - 6, w.z + 8, 1.0, 0.95], dive: 2.2 }, uwWreck: { walk: [w.x - 14, w.z + 10, Math.atan2(14, 10), -0.02], dive: 1.6 }, uwWreck2: { walk: [w.x + 12, w.z - 30, 2.6, -0.05], dive: 1.8 }, uwSand: { walk: [w.x - 60, w.z + 200, 0.5, -0.25], dive: 1.2 },
                maskDive: { walk: [w.x - 14, w.z + 10, Math.atan2(14, 10), -0.02], dive: 1.6 }, maskUp: { walk: [w.x - 6, w.z + 8, 1.0, 0.75], dive: 2.4 },
                pelican: (() => { const ms = M.scene.children.filter(c => c.name === 'afloat'); const o = {}; ms.forEach((m, i) => { const A = m.geometry.attributes.iP; A.array[2] = 1.3; A.needsUpdate = true; o[i] = { walk: [A.array[0] - 3.6, A.array[1] + 1.6, Math.atan2(3.6, 1.6), -0.08] }; }); return o; })()[0],
                cormorant: (() => { const m = M.scene.children.filter(c => c.name === 'afloat')[1]; const A = m.geometry.attributes.iP; A.array[2] = 1.0; A.needsUpdate = true; return { walk: [A.array[0] - 2.4, A.array[1] + 1.0, Math.atan2(2.4, 1.0), -0.1] }; })(),
                crabClose: (() => { const b = window.__flat || [600, 10800]; return { walk: [b[0], b[1], 0.8, -0.95], tide: -1.1 }; })(),
                ...(() => { const wr = F.beach.filter(r => r.side < 0), near = (z0) => { let best = null, bd = 1e9; for (const r of wr) for (const q of r.p) { const d = Math.abs(q[1] - z0); if (d < bd) { bd = d; best = q; } } return best; };
                  const sw = near(10800), ko = near(18400), mid = near(14500), sh = M.scene.children.find(c => c.name === 'ashore'), A = sh && sh.geometry.attributes.iP.array, n = A ? A.length / 4 : 0; let gi = 0; for (let i = 0; i < n; i++) if (A[i * 4 + 1] > A[gi * 4 + 1]) gi = i;
                  return { swBeach: { walk: [sw[0] - 4, sw[1] + 30, 0.25, -0.12] }, swBeach2: { walk: [sw[0] - 14, sw[1], Math.PI - 0.3, -0.16] }, swTop: { cam: [sw[0] - 30, 40, sw[1] + 70, sw[0] - 12, 0, sw[1]] }, kooBeach: { walk: [ko[0] - 6, ko[1], Math.PI + 0.2, -0.12] }, midWade: { walk: [mid[0] - 30, mid[1], 1.2, -0.06] },
                    ashore: A && { walk: [A[gi * 4] + 5, A[gi * 4 + 1] + 3.5, Math.atan2(-5, 3.5), -0.12], tide: -0.6 }, ashoreFar: A && { walk: [A[gi * 4] + 18, A[gi * 4 + 1] - 26, Math.atan2(-18, -26), -0.05] }, ashoreN: n }; })(),
                boatSailC: boat(b => b.sail && b.move, 8, 0.06), boatMoorC: boat(b => b.anchor && b.mast > 10, 7.5, 0.05), boatFlyC: boat(b => b.anchor && b.mast === 7.4, 9, 0.03), boatTin: boat(b => b.small && !b.jet, 4.5),
                ...(() => { const wr = F.beach.filter(r => r.side < 0), near = (z0) => { let best = null, bd = 1e9; for (const r of wr) for (const q of r.p) { const d = Math.abs(q[1] - z0); if (d < bd) { bd = d; best = q; } } return best; };
                  let tip = wr[0].p[0]; for (const r of wr) for (const q of r.p) if (q[1] > tip[1]) tip = q; const ko = near(17200), sw = near(10300);
                  const sh = (min) => ({ walk: [ko[0] + 10, ko[1], 0.5, -0.22], min }), top = (min) => ({ cam: [ko[0] - 25, 55, ko[1] + 50, ko[0] + 25, 0, ko[1] - 10], min });
                  return { shadeAM: sh(450), shadeNoon: sh(735), shadePM: sh(990), shadeTopAM: top(450), shadeTopNoon: top(735), shadeTopPM: top(1000),
                    tip: { walk: [tip[0] - 2, tip[1] - 14, Math.PI, -0.2] }, tipWet: { walk: [tip[0] - 6, tip[1] - 4, Math.PI * 0.8, -0.45] },
                    snagTop: { cam: [sw[0] - 20, 45, sw[1] + 60, sw[0] + 25, 0, sw[1]] }, snagWalk: { walk: [sw[0] + 6, sw[1] + 20, 0.3, -0.16] },
                    desertWalk: { walk: [-1556 + 60, 1204 + 30, 0.0, -0.05] }, desertWalk2: { walk: [-1556 - 80, 1204 - 60, 1.9, -0.1] },
                    hillsTop: { walk: [1555, 10824, 3.9, -0.16] }, hillsTop2: { walk: [1555 + 120, 10824 - 80, 1.2, -0.2] } }; })(),
                wreckW: (() => { const wk = M.features.wrecks.filter(q => q.x < 0 && q.z > 5000 && q.z < 10600)[0]; return wk && { walk: [wk.x + 38, wk.z + 30, Math.atan2(-38, 30), -0.06] }; })(),
                stag: (() => { const g = M.flyers.stags && M.flyers.stags[0]; return g && { walk: [g.position.x + 9, g.position.z + 7, Math.atan2(-9, 7), 0.5] }; })(), stagUp: (() => { const g = M.flyers.stags && M.flyers.stags[0]; return g && { walk: [g.position.x + 4.2, g.position.z + 3.4, Math.atan2(-4.2, 3.4), 0.95] }; })(), stagUp2: (() => { const g = M.flyers.stags && M.flyers.stags[0]; return g && { walk: [g.position.x - 5, g.position.z - 2.5, Math.atan2(5, -2.5), 0.85] }; })(), stagNear: (() => { const g = M.flyers.stags && M.flyers.stags[0]; return g && { cam: [g.position.x + 7, g.position.y + 9, g.position.z + 6, g.position.x, g.position.y + 7.6, g.position.z] }; })(), stag2: (() => { const g = M.flyers.stags && M.flyers.stags[2]; return g && { walk: [g.position.x - 13, g.position.z + 9, Math.atan2(13, 9), 0.38] }; })(),
                strip0: (() => { const s = M.air.strips[0]; return { cam: [s.a[0] - s.ux * 260 + 60, 110, s.a[1] - s.uz * 260, s.a[0] + s.ux * s.L * 0.6, 0, s.a[1] + s.uz * s.L * 0.6] }; })(), strip1: (() => { const s = M.air.strips[1]; return { cam: [s.a[0] - s.ux * 260 + 60, 110, s.a[1] - s.uz * 260, s.a[0] + s.ux * s.L * 0.6, 0, s.a[1] + s.uz * s.L * 0.6] }; })(),
                pelicanNear: (() => { const m = M.scene.children.filter(c => c.name === 'afloat')[0]; const A = m.geometry.attributes.iP; A.array[2] = 1.3; A.needsUpdate = true; return { walk: [A.array[0] - 1.9, A.array[1] + 1.0, Math.atan2(1.9, 1.0), -0.2] }; })(),
                cormorantNear: (() => { const m = M.scene.children.filter(c => c.name === 'afloat')[1]; const A = m.geometry.attributes.iP; A.array[2] = 1.0; A.needsUpdate = true; return { walk: [A.array[0] - 1.1, A.array[1] + 0.6, Math.atan2(1.1, 0.6), -0.3] }; })(),
                ashoreNear: (() => { const sh = M.scene.children.find(c => c.name === 'ashore'), A = sh && sh.geometry.attributes.iP.array; if (!A) return null; let gi = 0; for (let i = 0; i < A.length / 4; i++) if (A[i * 4 + 1] > A[gi * 4 + 1]) gi = i; return { walk: [A[gi * 4] + 2.0, A[gi * 4 + 1] + 1.3, Math.atan2(-2.0, 1.3), -0.2], tide: -0.6 }; })(),
                fishNear: { walk: [w.x - 5, w.z + 4, 1.0, -0.2], tide: 0.3, dive: 1 },
                swimTop: { walk: [w.x - 14, w.z + 10, Math.atan2(14, 10), -0.12] },
                boatSail: boat(b => b.sail && b.move, 16, 0.12), boatMoor: boat(b => b.anchor && b.mast > 10, 14, 0.12), boatCru: boat(b => b.anchor && b.mast < 5 && b.mast > 2.5 && !b.small, 13), boatFly: boat(b => b.anchor && b.mast === 7.4, 16), boatJet: boat(b => b.jet, 6),
                tyre: car && (() => { const tgt = { x: car.position.x, z: car.position.z }; for (let i = 0; i < 260; i++) M.life.update(0.06, M.U.uTime.value, tgt, 0); return { walk: [car.position.x + 3, car.position.z + 14, Math.atan2(-3, 14), -0.22] }; })(),
                tyreTop: car && { cam: [car.position.x + 20, car.position.y + 30, car.position.z + 34, car.position.x, car.position.y, car.position.z - 20] },
              }; })(),
            houseA: { walk: [-2245, -11770, 1.9, 0.1] }, houseB: { walk: [-2210, -11830, 0.2, 0.1] }, houseC: { cam: [-2300, 22, -11720, -2225, 6, -11775] }, houseD: { cam: [2800, 24, 18700, 2890, 5, 18640] },
            houseE: { cam: [-2530, 22, -6320, -2455, 6, -6365] }, houseF: { cam: [t.x - 120, 40, t.z + 90, t.x + 40, 12, t.z + 10] }, houseNight: { cam: [-2300, 22, -11720, -2225, 6, -11775], min: 1230 },
            folkTown: look((wk[0] + wk[2]) / 2 + 7, (wk[1] + wk[3]) / 2 + 9, (wk[0] + wk[2]) / 2, (wk[1] + wk[3]) / 2),
            folkTown2: { cam: [t.x - 160, 70, t.z + 130, t.x + 60, 8, t.z + 30] },
            folkWalk: look(wk[0] + (wk[0] - wk[2]) * 0.25 + 1.5, wk[1] + (wk[1] - wk[3]) * 0.25 + 1.5, wk[2], wk[3], -0.06),
            folkWalk2: (() => { const q = person(0, -2200, -11800); return look(q[0] + (q[0] - q[2]) * 0.25 + 1.5, q[1] + (q[1] - q[3]) * 0.25 + 1.5, q[2], q[3], -0.06); })(),
            folkFishClose: look(fi[0] + 4, fi[1] + 2.5, fi[0], fi[1], -0.1),
            flatheadClose: { cam: [fh[0] - 2.5, 2.2, fh[1] + 2.5, fh[0], -1.5, fh[1]], tide: 0 },
            whitingClose: { cam: [wh[0] - 2, 1.6, wh[1] + 2, wh[0], -1, wh[1]], tide: 0 },
            folkFish: look(fi[0] + 10, fi[1] + 5, fi[0] - 2, fi[1], -0.05),
            folkFish2: look(fb[0] + 12, fb[1] - 8, fb[0] - 2, fb[1], -0.05),
            folkCamp: look(c1[0] + 16, c1[1] + 9, c1[0], c1[1], -0.05),
            folkCampTop: { cam: [c1[0] + 30, M.T ? 45 : 45, c1[1] + 30, c1[0], 8, c1[1]] },
            folkCampBig: look(c0[0] + 22, c0[1] + 14, c0[0], c0[1], -0.05),
            folkCampNight: { ...look(c1[0] + 16, c1[1] + 9, c1[0], c1[1], -0.05), min: 1260 },
            post1: sign(-1651, -27), post2: sign(4010, -9844), post3: sign(2645, 8794), post4: sign(-1144, -2551, 14, 0.15, 6), post5: sign(3311, 17634, 9, 0.22, -5), post6: sign(-2275, 794, 20, 0.1),
            reef: { cam: [rf[0] - 7, 5, rf[1] + 7, rf[0], -6, rf[1]], tide: 0 },
            reefSwim: { walk: [rf[0] - 6, rf[1] + 5, Math.atan2(6, 5), -0.75], tide: 0 },
            jet: jet && { cam: [jet.x - 18, 7, jet.z + 16, jet.x, 1, jet.z] },
            fly: fly && { cam: [fly.x - 26, 9, fly.z + 22, fly.x, 3, fly.z] },
            flyMove: flym && { cam: [flym.x - 30, 10, flym.z + 24, flym.x, 3, flym.z] },
            flathead: { cam: [fh[0] - 3, 5, fh[1] + 3, fh[0], -1, fh[1]], tide: 0 },
            whiting: { cam: [wh[0] - 3, 4, wh[1] + 3, wh[0], -0.5, wh[1]], tide: 0 },
            wal4: { walk: [-1556, 1204, 1.0, -0.5] }, wal5: { walk: [1232, -4300, 2.2, -0.2] },
            wal1: { walk: [-1556, 1204, 1.0, -0.15] }, wal2: { walk: [-1556, 1204, 3.0, -0.3] }, wal3: { cam: [-1556 - 25, 75, 1204 + 25, -1556, 40, 1204] },
            zoo1: { walk: [-1300, 1500, 1.0, -0.12] }, zoo2: { walk: [4500, -10250, 0.3, -0.25] }, zoo3: { walk: [2300, -6000, 2.0, -0.5] }, zoo4: { walk: [600, 6000, 4.0, -0.3] },
          }; })(),
        night: { cam: [t.x - 500, 200, t.z + 250, t.x + 100, 10, t.z], min: 1290 },
      };
      { const om = /^sp(\d|o)_(.+)$/.exec(n); M.scene.traverse(c => { const u = c.material && c.material.uniforms && c.material.uniforms.uForceSp; if (u) u.value = om ? (om[1] === 'o' ? -2 : +om[1]) : -1; }); if (om) V[n] = V[om[2]]; if (om && om[1] === '1') M.scene.traverse(c => { const m = c.material; if (m && m.vertexShader && /float oakG/.test(m.vertexShader) && !c.__og) { c.__og = 1; m.vertexShader = m.vertexShader.replace('oakG = max(oakG, isOak * tall *', 'oakG = max(oakG, 1.0 *'); m.needsUpdate = true; } }); }
      { const sm = /^sitter(\d*)$/.exec(n); if (sm) { const pm = M.scene.children.find(c => c.name === 'people'), A = pm.geometry.attributes.iA.array, B = pm.geometry.attributes.iB.array, hits = []; for (let i = 0; i < B.length / 4; i++) if (B[i * 4 + 2] > 2.5) hits.push([A[i * 4], A[i * 4 + 1], A[i * 4 + 2], A[i * 4 + 3]]); const q = hits[(+sm[1] || 0) % Math.max(1, hits.length)]; console.log('sitters', hits.length); if (q) { const dx = q[2] - q[0], dz = q[3] - q[1], l = Math.hypot(dx, dz) || 1, ox = -dz / l * 3.2 + dx / l * 1.2, oz = dx / l * 3.2 + dz / l * 1.2; V[n] = { walk: [q[0] + ox, q[1] + oz, Math.atan2(-ox, oz), -0.16] }; } } }
      V.oakA = { walk: [t.x + 423.6, t.z - 253.6, 1.15, -0.1] }; V.oakB = { walk: [t.x + 428, t.z - 258, 1.5, -0.2] }; V.tangaBeach = { walk: [t.x - 60, t.z + 40, 0.1, -0.12] }; V.tangaShore = { cam: [t.x - 150, 9, t.z + 260, t.x - 60, 2, t.z - 200] }; V.tangaNorth = { walk: [-1915, -1500, 0.0, -0.06] }; V.tangaAir = { cam: [t.x - 420, 150, t.z + 300, t.x + 40, 0, t.z - 250] }; V.jetty = { cam: [-2040, 14, -80, -1900, 2, -170] }; { const mb = M.boats.boats.find(q => q.times), L = mb && mb.pts[mb.pts.length - 1]; if (L) { V.micat = { cam: [L[0] + 95, 4.5, L[1] + 150, L[0] + 10, 5, L[1]], min: 620 }; V.micatAir = { cam: [L[0] - 60, 70, L[1] + 190, L[0] + 20, 0, L[1]], min: 620 }; V.micatSide = { cam: [L[0] - 20, 9, L[1] + 110, L[0] + 5, 6, L[1]], min: 620 }; V.micatIn = { cam: [L[0] + 95, 4.5, L[1] + 150, L[0] - 200, 5, L[1] - 40], min: 597 }; V.micatRamp = { cam: [L[0] + 62, 5, L[1] + 34, L[0] + 20, 3, L[1] + 4], min: 620 }; V.micatCamp = { cam: [L[0] + 48, 3.2, L[1] - 78, L[0] + 20, 4, L[1] + 5], min: 620 }; V.micatGone = { cam: [L[0] + 95, 4.5, L[1] + 150, L[0] + 10, 5, L[1]], min: 760 }; V.ferryView = { cam: [L[0] - 150, 12, L[1] + 40, L[0] + 120, 18, L[1] + 60], min: 760 }; V.blowView = { cam: [L[0] - 260, 12, L[1] + 330, L[0] + 90, 14, L[1] - 80], min: 760 }; V.wakeStern = { cam: [L[0] - 300, 20, L[1], L[0], 0, L[1]], min: 597.5 }; V.wakeAir = { cam: [L[0] - 300, 20, L[1], L[0], 0, L[1]], min: 597.5 }; V.wakeOutStern = { cam: [L[0] - 300, 20, L[1], L[0], 0, L[1]], min: 662.7 }; V.blows = { cam: [-2750, 22, -2640, -2080, 30, -2700], min: 760 }; V.farResort = { cam: [-5200, 9, -700, -1700, 30, -600], min: 760 }; V.farBlows = { cam: [-4300, 9, -2300, -2050, 25, -2700], min: 760 }; V.westWall = { cam: [L[0] + 55, 3.2, L[1] + 420, L[0] + 120, 22, L[1] - 60], min: 760 }; V.westWallSea = { cam: [L[0] - 420, 25, L[1] + 300, L[0] + 250, 30, L[1] - 100], min: 760 }; } } V.jettyPhoto = { cam: [-2030, 16, -205, -1840, 6, -160] }; V.jettyDeck = { cam: [-1975, 7.2, -183, -1880, 5.5, -160] }; V.jettyTop = { cam: [-1990, 120, 0, -1930, 0, -175] }; V.jettyWalk = { walk: [-1905, -150, -1.35, -0.1] }; V.tangaPhoto = { cam: [t.x - 260, 330, t.z + 760, t.x + 60, 0, t.z - 500] };
      { const G = M.F.gates || []; G.forEach((g, i) => { const [x, z] = g.p, sgn = i % 2 ? 1 : -1; V['gate' + i] = { cam: [x - 16, 4.2, z - sgn * 38, x - 4, 1.5, z + sgn * 6] }; V['gateTop' + i] = { cam: [x - 60, 70, z - sgn * 90, x, 0, z + sgn * 40] }; }); }
      { const wr = M.F.beach.filter(r => r.side < 0); let q = null, bd = 1e9; for (const r of wr) for (const p of r.p) { const d = Math.abs(p[1] + 4500); if (d < bd) { bd = d; q = p; } } if (q) { V.narrow = { cam: [q[0] - 34, 12, q[1] + 95, q[0] + 4, 1, q[1] - 60] }; V.narrowTop = { cam: [q[0] - 90, 110, q[1] + 60, q[0] + 20, 0, q[1] - 40] }; } }
      if (n === 'kooTop') V[n] = { cam: [2900, 520, 18686, 2900, 0, 18645] }; if (n === 'bulTop') V[n] = { cam: [-2199, 520, -11743, -2199, 0, -11784] }; if (n === 'kooLow') V[n] = { cam: [2760, 60, 18840, 2900, 5, 18660] };
      { const fm = /^yardfolk(\d*)$/.exec(n); if (fm) { const pm = M.scene.children.find(c => c.name === 'people'), A = pm.geometry.attributes.iA.array, hits = []; for (const q of M.F.hoists || []) for (let i = 0; i < A.length; i += 4) if (Math.hypot(A[i] - q[0], A[i + 1] - q[1]) < 2.2) { hits.push(q); break; } const q = hits[(+fm[1] || 0) % Math.max(1, hits.length)]; console.log('yardfolk', hits.length); if (q) V[n] = { walk: [q[0] + 5, q[1] + 4, Math.atan2(-5, 4), -0.1] }; } }
      { const ym = /^yard(car|hoist|tinny)(\d*)$/.exec(n); if (ym) { const L = { car: M.F.parked, hoist: M.F.hoists, tinny: M.F.tinnies }[ym[1]] || [], q = L[(+ym[2] || 0) % Math.max(1, L.length)]; console.log('yard', ym[1], L.length); if (q) V[n] = { walk: [q[0] + 6, q[1] + 5, Math.atan2(-6, 5), -0.12] }; } }
      if (/^ride/.test(n)) { if (M.ride.active) M.exitRide(); M.setMinutes(900); M.setMode('clear'); for (let i = 0; i < 4; i++) M.frame(); const k = +n.replace(/\D/g, '') || 0; const car = M.rideable[k % M.rideable.length]; M.enterRide(car); if (/L$/.test(n)) { M.ride.look = 0.45; M.ride.tilt = 0.04; } { const lk = { R: 1.57, B: 3.14, Q: 2.35, Z: -1.57 }[n.slice(-1)]; if (lk) M.ride.look = lk; } for (let i = 0; i < 12; i++) { M.life.update(0.1, M.U.uTime.value, car.m.position, 0); } for (let i = 0; i < 3; i++) { M.frame(); await new Promise(r => setTimeout(r, 700)); } return; }
      if (/^aboard/.test(n)) { if (M.ride.active) M.exitRide(); M.setMinutes(900); M.setMode('clear'); for (let i = 0; i < 3; i++) M.frame(); const B = M.boats.boats, bt = /Sail/.test(n) ? B.find(q => q.sail && q.move) : /Fly/.test(n) ? B.find(q => q.move && !q.jet && q.mast === 7.4) : /Jet/.test(n) ? B.find(q => q.jet) : /Ferry/.test(n) ? B.find(q => q.ferry) : /Cru/.test(n) ? B.find(q => q.anchor && q.mast < 5 && q.mast > 2.5 && !q.small) : /Tin/.test(n) ? B.find(q => q.small && !q.jet) : B.find(q => q.anchor && q.mast > 10);
        M.enterRide({ kind: 'boat', obj: bt }); if (/Helm/.test(n)) document.querySelector('#hmTake').click(); if (/Look/.test(n)) { M.ride.look = 0.9; M.ride.tilt = -0.1; }
        for (let i = 0; i < 3; i++) { M.frame(); await new Promise(r => setTimeout(r, 700)); } return; }
      if (/^tv_/.test(n)) {      // tv_<kind>_<w|s>[_L|_B]: start a kind of travel from the Travel menu's own function, let three seconds pass (steering and climbing if 's'), then look
        const [, kind, how, lk] = n.split('_'); if (M.ride.active) M.exitRide(); M.setMinutes(900); M.setMode('clear'); for (let i = 0; i < 3; i++) M.frame();
        M.travel(kind, how === 's'); if (!M.ride.active) return;
        const rr0 = M.renderer.render; M.renderer.render = () => {};        // the in-between frames are not drawn, only stepped
        for (let i = 0; i < 90; i++) { if (how === 's') { if (i === 20) dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); if (i === 50) { dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); } if (i === 80) dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); }
          M.setDt(0.033); M.frame(); M.setDt(0); }
        const extra = n.split('_')[4]; if (extra) for (let i = 0; i < +extra * 10; i++) { M.setDt(0.1); M.frame(); M.setDt(0); }
        if (lk === 'C' && M.ride.bird) { M.ride.bird.askCamp = true; for (let i = 0; i < 60; i++) { M.setDt(0.1); M.frame(); M.setDt(0); } M.ride.look = 2.2; }
        if (lk === 'Y') { M.ride.zoomBy(1.6); M.ride.zoomBy(1.6); M.ride.look = 1.35; M.ride.tilt = 0.12; } if (lk === 'E') M.ride.setView(0); if (lk === 'S') { M.ride.look = 1.9; M.ride.tilt = 0.12; }
        if (lk === 'L') M.ride.look = 1.2; if (lk === 'B') M.ride.look = 3.1; if (lk === 'Z') for (let i = 0; i < 3; i++) M.ride.zoomBy(1.6); if (lk === 'F') for (let i = 0; i < 6; i++) M.ride.zoomBy(1.6);
        { const mins = n.split('_')[5]; if (mins) M.setMinutes(+mins); }
        for (let i = 0; i < 45; i++) { M.setDt(0.033); M.frame(); M.setDt(0); }
        M.renderer.render = rr0;
        for (let i = 0; i < 3; i++) { M.setDt(0.02); M.frame(); M.setDt(0); await new Promise(r => setTimeout(r, 700)); } return; }
      if (/^stage/.test(n)) {      // a studio: the creatures are stood on open sand a few steps in front of the eye. stage_<what>_<distance>[_<height of eye>][_<side angle>]
        const [, what, dist, eyeUp, turn] = n.split('_'), SX = -1496, SZ = 1234, D = +dist || 4; if (M.ride.active) M.exitRide(); M.setMinutes(870); M.setMode('clear');
        if (!M.walk.active) M.enterWalk(SX, SZ - D); const a = +(turn || 0) * Math.PI / 180;
        M.walk.pos.x = SX + Math.sin(a) * D; M.walk.pos.z = SZ - Math.cos(a) * D; M.walk.yaw = Math.PI + a; M.walk.pitch = -(+(eyeUp || 12)) / 100; M.walk.dive = 0;
        if (what === 'people') { const pm = M.scene.children.find(c => c.name === 'people'), A = pm.geometry.attributes.iA, B = pm.geometry.attributes.iB;
          if (!window.__staged) { window.__staged = 1; for (let k = 0; k < 7; k++) { const x = SX - 2.7 + k * 0.9, walk = k === 1 || k === 4; A.array.set(walk ? [x, SZ - 1.5, x, SZ + 7] : [x, SZ, x + 0.01, SZ - 1], k * 4); B.array[k * 4 + 1] = 1.3; B.array[k * 4 + 2] = walk ? 0 : k === 6 ? 1 : k === 3 ? 3 : 2; B.array[k * 4 + 3] = 1; B.array[k * 4] = [0.13, 0.52, 0.31, 0.77, 0.93, 0.08, 0.64][k]; } A.needsUpdate = B.needsUpdate = true; } }
        else { const pat = what === 'wal' ? /float scrub = / : /float wag = sin/, big = what !== 'skink'; let done = 0;
          M.scene.traverse(c => { const m = c.material; if (!m || !m.vertexShader || !pat.test(m.vertexShader) || c.__staged) return; if (what !== 'wal' && (m.uniforms.uCS.value > 10) !== big) return; c.__staged = 1; done++;
            const sp = what === 'wal' ? 2.6 : what === 'goanna' ? 1.7 : 0.45;
            m.vertexShader = m.vertexShader.replace('vec2 xz = (cell + jt) * uCS', `float stageK = step(abs(iCell.x), 1.5) * step(abs(iCell.y), 1.5); vec2 xz = vec2(${SX}.0, ${SZ}.0) + iCell * ${sp.toFixed(2)}`)
              .replace(/float scrub = [^;]*;/, 'float scrub = stageK;').replace(/step\(h3, 0\.0[45]\);/, 'stageK;').replace(/lp \+= vec3\(\(go - 0\.5\) \* [0-9.]+,/, 'lp += vec3((go - 0.5) * 0.6,'); m.needsUpdate = true; });
          window.__stageN = done; }
        for (let i = 0; i < 4; i++) { M.frame(); await new Promise(r => setTimeout(r, 900)); } return; }
      if (/^menu/.test(n)) { if (M.ride.active) M.exitRide(); M.setMinutes(900); M.setMode('clear'); for (let i = 0; i < 3; i++) M.frame(); const tv = document.getElementById('travel'); if (tv.classList.contains('min')) tv.querySelector('.win-min').click();
        const kind = n.replace(/^menu/, '').replace(/Go$/, '').toLowerCase(); if (kind) { document.querySelector(`#travel .tv-row[data-kind="${kind}"] button[data-ctl="${/Go$/.test(n) ? 1 : 0}"]`).click(); const o = M.ride.car || M.ride.boat || M.ride.bird; for (let i = 0; i < 40; i++) { M.life.update(0.1, M.U.uTime.value + i * 0.1, o.m.position, 0); M.boats.update(0.1, M.U.uTime.value + i * 0.1, M.camera); } }
        for (let i = 0; i < 3; i++) { M.frame(); await new Promise(r => setTimeout(r, 700)); } return; }
      if (/^bird/.test(n)) { if (M.ride.active) M.exitRide(); M.setMinutes(900); M.setMode('clear'); const bd = M.flyers[/2/.test(n) ? 3 : 0]; for (let i = 0; i < 30; i++) M.life.update(0.1, M.U.uTime.value + i * 0.1, bd.m.position, 0); M.enterRide({ kind: 'bird', obj: bd }); if (/Fly/.test(n)) document.querySelector('#hmTake').click(); if (/Side/.test(n)) { M.ride.look = 1.3; M.ride.tilt = 0.1; }
        for (let i = 0; i < 3; i++) { M.frame(); await new Promise(r => setTimeout(r, 700)); } return; }
      if (M.ride.active) M.exitRide();
      const [vn, tideAt] = n.split('@'); const o = V[vn]; if (!o) return; if (tideAt !== undefined) o.tide = +tideAt;       // name@level: the same view with the sea held at that level
      M.setMinutes(o.min ?? 900); M.setMode('clear'); if (o.swell) M.setCustom('swell', o.swell); if (o.tide != null) { M.setCustom('tide', o.tide); M.wx.tide = o.tide; }
      if (o.walk) { if (!M.walk.active) M.enterWalk(o.walk[0], o.walk[1]); M.walk.pos.x = o.walk[0]; M.walk.pos.z = o.walk[1]; M.walk.yaw = o.walk[2]; M.walk.pitch = o.walk[3]; M.walk.dive = o.dive || 0; }
      else { if (M.walk.active) M.exitWalk(); M.camera.position.set(o.cam[0], o.cam[1], o.cam[2]); M.controls.target.set(o.cam[3], o.cam[4], o.cam[5]); }
      for (let i = 0; i < 3; i++) { M.frame(); await new Promise(r => setTimeout(r, 900)); }
      if (/^wake/.test(vn)) {            // let the Micat steam for a minute and a half so that she lays a wake, then look at her
        const rr = M.renderer.render; M.renderer.render = () => {}; M.setDt(0.3); const m0 = /Out/.test(vn) ? 668.0 : 590.0; for (let i = 0; i < 300; i++) { M.setMinutes(m0 + i * 0.005); M.frame(); } M.setDt(0); M.renderer.render = rr;
        const mb = M.boats.boats.find(q => q.times), fx = Math.cos(mb.hd), fz = -Math.sin(mb.hd);
        if (/Stern/.test(vn)) { M.camera.position.set(mb.x - fx * 50, 13, mb.z - fz * 50); M.controls.target.set(mb.x - fx * 170, 0, mb.z - fz * 170); }
        else { M.camera.position.set(mb.x - fx * 150 + fz * 130, 60, mb.z - fz * 150 - fx * 130); M.controls.target.set(mb.x - fx * 60, 0, mb.z - fz * 60); }
        M.frame();
      }
      if (/^micat/.test(vn) && o.min === 620) { const tgt = M.walk.active ? M.walk.pos : M.controls.target, n2 = /Air/.test(vn) ? 470 : /Ramp/.test(vn) ? 318 : 360; for (let i = 0; i < n2; i++) M.life.update(0.1, M.U.uTime.value, tgt, 0); }
    }, n);
    if (/^(ride|aboard|bird|menu|tv_)/.test(n)) { await p.evaluate(() => { MAP.setDt(0.02); MAP.frame(); MAP.setDt(0); }); await p.screenshot({ path: `${prefix}_${n}.jpg`, type: 'jpeg', quality: 90 }); }
    else if (/^mask/.test(n)) { await p.evaluate(() => { for (let i = 0; i < 34; i++) MAP.dive.update(true, 0.1); MAP.frame(); }); await p.screenshot({ path: `${prefix}_${n}.jpg`, type: 'jpeg', quality: 90 }); }
    else {
    const url = await p.evaluate(() => { MAP.frame(); return document.getElementById('c').toDataURL('image/jpeg', 0.92); });
    fs.writeFileSync(`${prefix}_${n}.jpg`, Buffer.from(url.split(',')[1], 'base64')); }
    tick(n + (errs.length ? ' ERR ' + JSON.stringify(errs.filter(e => /Shader Error|ERROR: /.test(e)).slice(0, 2)).slice(0, 1800) : ''));
  }
  fs.appendFileSync(prefix + '.log', 'errors: ' + JSON.stringify(errs.slice(0, 6)) + '\n');
  await b.close();
})();

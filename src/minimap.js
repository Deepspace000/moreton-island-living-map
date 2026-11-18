// The mini map in the corner. It is drawn flat and plain, the way a street map is: pale green land, sand, blue water, white tracks,
// names in dark grey with a white edge, and a blue dot with a beam for where you are and which way you look. North is up.
// The land is read straight from the terrain mask for every pixel, so the shore stays sharp at any zoom; the tracks, lakes and
// names come from the same features file as the 3D map.
import { T } from './terrain.js';

const WATER = [144, 218, 238], LAND = [203, 236, 209], SAND = [248, 241, 218];
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FONT = 'Roboto, "Segoe UI", Arial, sans-serif';
const STYLE = {
  town: { font: `500 12px ${FONT}`, col: '#30343a', h: 12 },
  peak: { font: `400 10.5px ${FONT}`, col: '#735f48', h: 10.5, icon: 'peak' },
  sea: { font: `italic 400 11px ${FONT}`, col: '#3b78b5', h: 11 },
  lake: { font: `italic 400 10.5px ${FONT}`, col: '#3b78b5', h: 10.5 },
  sand: { font: `400 10.5px ${FONT}`, col: '#8b744a', h: 10.5 },
  poi: { font: `400 10.5px ${FONT}`, col: '#0f7a84', h: 10.5, icon: '#12a4af' },
  camp: { font: `400 10.5px ${FONT}`, col: '#1e8e3e', h: 10.5, icon: '#34a853' },
};
const MAXZ = 5, NICE = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

// the land and sand masks at full, half, quarter and eighth size, so a far-out view is not a speckle of single cells
function pyramid() {
  const L = [{ w: T.W, h: T.H, d: T.mask, s: 4 }];
  let w = T.W, h = T.H, src = T.mask, st = 4;
  for (let k = 1; k <= 3; k++) {
    const nw = w >> 1, nh = h >> 1, d = new Uint8Array(nw * nh * 2);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const a = (y * 2 * w + x * 2) * st, b = a + st, c = a + w * st, e = c + st, o = (y * nw + x) * 2;
      d[o] = (src[a] + src[b] + src[c] + src[e] + 2) >> 2; d[o + 1] = (src[a + 1] + src[b + 1] + src[c + 1] + src[e + 1] + 2) >> 2;
    }
    L.push({ w: nw, h: nh, d, s: 2 }); src = d; st = 2; w = nw; h = nh;
  }
  return L;
}

// o.where() says where you are: { x, z, hdg (0 north, clockwise), near (walking or riding) }.  o.go(x, z) is called for a click on the map.
export function buildMinimap(F, o) {
  const root = o.root, canvas = o.canvas, ctx = canvas.getContext('2d'), base = document.createElement('canvas'), bctx = base.getContext('2d');
  const L = pyramid(), bIn = root.querySelector('.mm-in'), bOut = root.querySelector('.mm-out'), bHome = root.querySelector('.mm-home');
  const box = (pts) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of pts) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; };
  const lines = (arr, f) => (arr || []).filter(r => r.p && r.p.length > 1 && (!f || f(r))).map(r => ({ p: r.p, bb: box(r.p) }));
  const tracks = lines(F.roads, r => r.c === 1), streets = lines(F.roads, r => r.c === 0), paths = lines(F.roads, r => r.c > 1);
  const lakes = lines([...(F.lakes || []), ...(F.pools || [])]), streams = lines(F.streams), ferries = lines(F.ferries), piers = lines(F.piers), runways = lines(F.runways);
  const houses = lines(F.buildings, b => b.k !== 'ship');

  const LB = [], add = (p, n, cls, pri, minZ) => { if (p && n) LB.push({ x: p[0], z: p[1], n, cls, pri, minZ, w: 0 }); };
  for (const p of F.places) if (p.n !== 'Tallallebela' && p.n !== 'The Nek') add(p.p, p.n, 'town', 10, 0);
  for (const p of F.peaks) add(p.p, p.n, 'peak', p.e > 280 ? 8 : 4, p.e > 280 ? 1 : 3);
  for (const p of F.sandnames) add(p.p, p.n, 'sand', 6, /Desert|Big Sand/.test(p.n) ? 1 : 2);
  for (const p of F.seanames) add(p.p, p.n, 'sea', 5, 1);
  { const seen = new Set(); for (const p of F.lakes) if (p.n && !seen.has(p.n)) { seen.add(p.n); add(p.c, p.n.replace(/\s*\(.*\)$/, ''), 'lake', 5, /Blue Lagoon/.test(p.n) ? 1.5 : 2.5); } }
  for (const p of F.views) { const wr = /Wreck/.test(p.n || ''); add(p.p, p.n === 'Ship Wrecks' ? 'Bulwer Wrecks' : p.n, 'poi', wr ? 7 : 3, wr ? 1.5 : 3); }
  for (const p of F.camps) if (!/Sunrover|Escapes|WBS/.test(p.n || '')) add(p.p, p.n, 'camp', 2, 3.5);
  for (const p of F.lights) add(p.p, p.n, 'poi', 7, 1.5);
  LB.sort((a, b) => b.pri - a.pri);

  let zoom = { far: 0, near: 4 };
  try { const s = JSON.parse(localStorage.getItem('mini:zoom') || 'null'); if (s && s.far >= 0 && s.near >= 0) zoom = { far: clamp(s.far | 0, 0, MAXZ), near: clamp(s.near | 0, 0, MAXZ) }; } catch (e) { /* storage can be blocked */ }
  let cw = 0, ch = 0, k = 1, pw = 0, ph = 0, img = null, fit = 100, mpp = 0, cx = 0, cz = 0, mode = 'far';
  let bx = NaN, bz = NaN, bm = NaN, acc = 1;                    // what the kept drawing of the map shows: its centre and scale
  const X = (x) => (x - cx) / mpp + cw / 2, Z = (z) => (z - cz) / mpp + ch / 2;

  function measure() {
    const w = canvas.clientWidth, h = canvas.clientHeight, r = Math.min(window.devicePixelRatio || 1, 2);
    if (w === cw && h === ch && r === k) return; cw = w; ch = h; k = r;
    pw = canvas.width = base.width = Math.round(cw * k); ph = canvas.height = base.height = Math.round(ch * k);
    img = bctx.createImageData(pw, ph); fit = Math.max(T.sz / ch, T.sx / cw) * 1.03; bx = NaN; mpp = 0; acc = 1;          // (and drawn again at once: a canvas is wiped when its size is set)
  }
  // land, sand and water, one pixel at a time from the mask
  function paintLand() {
    const dm = mpp / k, lv = clamp(Math.round(Math.log2(dm / T.mpp)), 0, 3), M = L[lv], d = M.d, s = M.s, mw = M.w, mh = M.h;
    const sharp = Math.max(1.5, T.mpp * (1 << lv) / dm * 1.3) / 255, soft = sharp * 0.7;
    const ax = dm / T.sx * mw, ox = ((cx - pw / 2 * dm + dm / 2) / T.sx + 0.5) * mw - 0.5, az = dm / T.sz * mh, oz = ((cz - ph / 2 * dm + dm / 2) / T.sz + 0.5) * mh - 0.5;
    const out = img.data, W0 = WATER[0], W1 = WATER[1], W2 = WATER[2]; let q = 0;
    for (let py = 0; py < ph; py++) {
      const gz = oz + py * az, zi = Math.floor(gz), fz = gz - zi, ok = zi >= 0 && zi < mh - 1, r0 = zi * mw * s, r1 = r0 + mw * s;
      for (let px = 0; px < pw; px++, q += 4) {
        const gx = ox + px * ax, xi = Math.floor(gx); let a = 0, sn = 0;
        if (ok && xi >= 0 && xi < mw - 1) {
          const fx = gx - xi, i0 = r0 + xi * s, i1 = r1 + xi * s;
          a = ((d[i0] * (1 - fx) + d[i0 + s] * fx) * (1 - fz) + (d[i1] * (1 - fx) + d[i1 + s] * fx) * fz - 127.5) * sharp + 0.5; a = a < 0 ? 0 : a > 1 ? 1 : a;
          if (a > 0) { sn = ((d[i0 + 1] * (1 - fx) + d[i0 + s + 1] * fx) * (1 - fz) + (d[i1 + 1] * (1 - fx) + d[i1 + s + 1] * fx) * fz - 72) * soft + 0.5; sn = sn < 0 ? 0 : sn > 1 ? 1 : sn; }
        }
        out[q] = W0 + (LAND[0] + (SAND[0] - LAND[0]) * sn - W0) * a; out[q + 1] = W1 + (LAND[1] + (SAND[1] - LAND[1]) * sn - W1) * a; out[q + 2] = W2 + (LAND[2] + (SAND[2] - LAND[2]) * sn - W2) * a; out[q + 3] = 255;
      }
    }
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.putImageData(img, 0, 0);
  }
  function paintBase() {
    paintLand();
    const c = bctx, zf = Math.log2(fit / mpp), v0 = cx - cw / 2 * mpp, v1 = cz - ch / 2 * mpp, v2 = cx + cw / 2 * mpp, v3 = cz + ch / 2 * mpp;
    c.setTransform(k, 0, 0, k, 0, 0); c.lineJoin = 'round'; c.lineCap = 'round';
    const trace = (set, close) => { c.beginPath(); for (const r of set) { if (r.bb[0] > v2 || r.bb[2] < v0 || r.bb[1] > v3 || r.bb[3] < v1) continue; const p = r.p; c.moveTo(X(p[0][0]), Z(p[0][1])); for (let i = 1; i < p.length; i++) c.lineTo(X(p[i][0]), Z(p[i][1])); if (close) c.closePath(); } };
    const stroke = (set, col, w, dash) => { trace(set); c.setLineDash(dash || []); c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.setLineDash([]); };
    if (zf >= 1.5) stroke(streams, css(WATER), 1 + (zf - 1.5) * 0.3);
    trace(lakes, true); c.fillStyle = css(WATER); c.fill();
    stroke(ferries, 'rgba(60, 120, 181, .7)', 1, [4, 4]);
    if (zf >= 3.4) { trace(houses, true); c.fillStyle = '#e4e6ea'; c.fill(); c.strokeStyle = '#c9cdd3'; c.lineWidth = 0.5; c.stroke(); }
    if (zf >= 2) { stroke(runways, '#c4c9cf', Math.max(2.5, 26 / mpp) + 1.2); stroke(runways, '#eef0f2', Math.max(2.5, 26 / mpp)); }
    if (zf >= 2.5) { stroke(piers, '#b9bec5', 2.6); stroke(piers, '#f4f5f6', 1.4); }
    if (zf >= 2.4) stroke(paths, '#4f9a63', 1.1, [3, 3]);
    const tw = 1 + zf * 0.5, sw = 0.7 + zf * 0.5, edge = 'rgba(92, 118, 102, .55)';
    if (zf >= 1) stroke(tracks, edge, tw + 1.4);
    if (zf >= 2) stroke(streets, edge, sw + 1.4);
    stroke(tracks, '#fff', tw);
    if (zf >= 2) stroke(streets, '#fff', sw);
    // names: the most important first, and none on top of another
    const placed = []; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = 'rgba(255, 255, 255, .92)';
    for (const l of LB) {
      if (zf < l.minZ - 0.01) continue; const sx = X(l.x), sy = Z(l.z); if (sx < -30 || sx > cw + 30 || sy < -12 || sy > ch + 12) continue;
      const st = STYLE[l.cls]; c.font = st.font; if (!l.w) l.w = c.measureText(l.n).width;
      const ty = st.icon ? sy + 5 + st.h : sy + st.h * 0.36, r = [sx - l.w / 2 - 3, st.icon ? sy - 6 : ty - st.h - 1, sx + l.w / 2 + 3, ty + 3];
      if (placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue; placed.push(r);
      if (st.icon === 'peak') { c.beginPath(); c.moveTo(sx, sy - 4.5); c.lineTo(sx + 4.5, sy + 3); c.lineTo(sx - 4.5, sy + 3); c.closePath(); c.fillStyle = '#8c7458'; c.fill(); }
      else if (st.icon) { c.beginPath(); c.arc(sx, sy, 4.2, 0, 7); c.fillStyle = '#fff'; c.fill(); c.beginPath(); c.arc(sx, sy, 3, 0, 7); c.fillStyle = st.icon; c.fill(); }
      c.strokeText(l.n, sx, ty); c.fillStyle = st.col; c.fillText(l.n, sx, ty);
    }
    // how far a stretch of the map is
    let m = NICE[0]; for (const n of NICE) if (n / mpp <= 62) m = n;
    const bw = m / mpp, x = 8, y = ch - 8, txt = m >= 1000 ? m / 1000 + ' km' : m + ' m';
    c.font = `400 10px ${FONT}`; c.textAlign = 'left'; c.strokeText(txt, x + 3, y - 4); c.fillStyle = '#3c4043'; c.fillText(txt, x + 3, y - 4);
    c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x, y); c.lineTo(x + bw, y); c.lineTo(x + bw, y - 4); c.lineWidth = 3; c.stroke(); c.strokeStyle = '#5f6368'; c.lineWidth = 1; c.stroke();
    bx = cx; bz = cz; bm = mpp;
  }
  // keeps the map inside the island's sheet where it can, and you always inside the map
  const hold = (p, half, view) => { const c = view >= half * 2 ? 0 : clamp(p, -half + view / 2, half - view / 2), m = Math.max(0, view / 2 - 16 * mpp); return clamp(c, p - m, p + m); };
  function buttons() { const z = zoom[mode]; bIn.disabled = z >= MAXZ; bOut.disabled = z <= 0; }
  function zoomBy(n) { zoom[mode] = clamp(zoom[mode] + n, 0, MAXZ); buttons(); acc = 1; try { localStorage.setItem('mini:zoom', JSON.stringify(zoom)); } catch (e) { /* not remembered then */ } }
  const at = (clientX, clientY) => { const r = canvas.getBoundingClientRect(); return { x: cx + (clientX - r.left - cw / 2) * mpp, z: cz + (clientY - r.top - ch / 2) * mpp }; };

  // Dragging over the map looks around it, as on a web map: the map stops following you until the button that appears takes it back to
  // where you are (moving the panel about the screen is done by its grip, and resizing it by its corner: see windows.js)
  const pan = { x: 0, z: 0, on: false }, home = () => { pan.x = pan.z = 0; pan.on = false; if (bHome) bHome.hidden = true; acc = 1; };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { finger = e.pointerType !== 'mouse'; if (e.button === 0) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !mpp) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) { if (Math.hypot(dx, dy) < (finger ? 9 : 5)) return; drag.on = true; canvas.setPointerCapture(e.pointerId); root.classList.add('panning'); first = null; }
    pan.x -= dx * mpp; pan.z -= dy * mpp; pan.on = true; if (bHome) bHome.hidden = false; drag.x = e.clientX; drag.y = e.clientY; acc = 1;
  });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => { if (!drag || e.pointerId !== drag.id) return; if (drag.on) { root.classList.remove('panning'); first = null; } drag = null; });
  if (bHome) bHome.onclick = home;
  let first = null, finger = false;            // (it takes two clicks on the same spot: one alone, or the end of a drag, does nothing; a finger gets a little more room and time than a mouse)
  canvas.addEventListener('click', (e) => {
    const now = performance.now();
    if (!(first && now - first.t < (finger ? 520 : 420) && Math.hypot(e.clientX - first.x, e.clientY - first.y) < (finger ? 34 : 20))) { first = { t: now, x: e.clientX, y: e.clientY }; return; }
    first = null; if (mpp) { const p = at(e.clientX, e.clientY); o.go(p.x, p.z); }
  });
  let wheel = 0;
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheel += e.deltaY; if (Math.abs(wheel) >= 60) { zoomBy(wheel < 0 ? 1 : -1); wheel = 0; } }, { passive: false });
  bIn.onclick = () => zoomBy(1); bOut.onclick = () => zoomBy(-1);

  function update(dt) {
    if (root.classList.contains('min') || !canvas.clientWidth) return;
    measure();
    const w = o.where(), md = w.near ? 'near' : 'far'; if (md !== mode) { mode = md; buttons(); }
    const goal = fit / 2 ** zoom[mode], gliding = mpp && Math.abs(mpp / goal - 1) > 0.004;
    acc += dt; if (!gliding && acc < 0.066) return; acc = 0;
    mpp = !mpp ? goal : gliding ? Math.exp(Math.log(mpp) + (Math.log(goal) - Math.log(mpp)) * (1 - Math.exp(-dt * 9))) : goal;
    if (pan.on) { cx = Math.max(-T.sx / 2, Math.min(T.sx / 2, w.x + pan.x)); cz = Math.max(-T.sz / 2, Math.min(T.sz / 2, w.z + pan.z)); pan.x = cx - w.x; pan.z = cz - w.z; }          // (looked around: as far as the island's edge)
    else { cx = hold(w.x, T.sx / 2, cw * mpp); cz = hold(w.z, T.sz / 2, ch * mpp); }
    const half = mpp / k * 0.5; if (!(bm === mpp && Math.abs(cx - bx) < half && Math.abs(cz - bz) < half)) paintBase(); else { cx = bx; cz = bz; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0); ctx.setTransform(k, 0, 0, k, 0, 0);
    // you: a blue dot, and a beam the way you are looking
    const mx = X(w.x), my = Z(w.z), a = w.hdg - Math.PI / 2, g = ctx.createRadialGradient(mx, my, 4, mx, my, 36);
    g.addColorStop(0, 'rgba(66, 133, 244, .5)'); g.addColorStop(1, 'rgba(66, 133, 244, 0)');
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.arc(mx, my, 36, a - 0.55, a + 0.55); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'rgba(0, 0, 0, .35)'; ctx.shadowBlur = 4 * k; ctx.shadowOffsetY = k;
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, 7); ctx.fillStyle = '#4285f4'; ctx.fill();
    // where you are heading (a spot you clicked while riding): a red pin, and a dotted line to it
    const gl = o.goal && o.goal(); if (gl) { const gx = clamp(X(gl.x), 6, cw - 6), gy = clamp(Z(gl.z), 16, ch - 4);
      ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(60, 64, 67, .75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(gx, gy); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.bezierCurveTo(gx - 9, gy - 10, gx - 7, gy - 20, gx, gy - 20); ctx.bezierCurveTo(gx + 7, gy - 20, gx + 9, gy - 10, gx, gy); ctx.fillStyle = '#ea4335'; ctx.fill(); ctx.strokeStyle = '#b31412'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(gx, gy - 13, 2.6, 0, 7); ctx.fillStyle = '#7a0e0b'; ctx.fill(); }
  }
  buttons();
  return { update, zoomBy, at, root, canvas, get zoom() { return zoom[mode]; }, max: MAXZ };
}

// Spotting: when an animal comes into view it is added to the Wildlife guide, an information box comes up, and achievements are unlocked.
// Several animals seen at once are put together in one box ("You have spotted 5 new animals"), grouped by how far off they are.
//   - animals the map places from a list (fish, sea life, waders, water birds, reptiles, mammals, crabs): spotted when one is near enough and in front of you
//   - flying birds and bats: the same, from where they are in the air at the moment
//   - the few the shaders scatter by themselves (wallabies, goannas, blue-tongues, butterflies, dragonflies, midges) have no positions to look up, so they
//     are spotted by chance, the longer you spend on foot or riding low in the kind of country where they live
import * as THREE from 'three';
import { SPOT, seen } from './spot.js';
import { GUIDE, ACH, counts } from './guide.js';
import { flyers } from './life.js';
import { U, VEX } from './common.js';
import { meshY, maskAt, heightAt } from './terrain.js';

const BY = Object.fromEntries(GUIDE.map(a => [a.id, a]));
const NIGHT_ONLY = new Set(['stonecurlew', 'flyingfox', 'microbat', 'bandicoot', 'longnose', 'brushtail', 'ringtail', 'waterrat']);
const DAY_ONLY = new Set([...GUIDE.filter(a => a.group === 'birds' && a.id !== 'stonecurlew').map(a => a.id), ...GUIDE.filter(a => a.group === 'insects').map(a => a.id)]);
const HIGH = { dolphin: 250, dugong: 250, humpback: 800, whaler: 160, tigershark: 220, greenturtle: 160, maskray: 90, shovelnose: 90 };          // how high above the water the eye may be and still count (default 70 m)
const FLY = { pelican: ['pelican', 500], eagle: ['seaeagle', 700], osprey: ['osprey', 450], brahminy: ['brahminy', 450], whistling: ['whistling', 450], wedgetail: ['wedgetail', 700], peregrine: ['peregrine', 400], flyingfox: ['flyingfox', 260], microbat: ['microbat', 120] };
const band = (d) => d < 40 ? 0 : d < 250 ? 1 : 2;
const BAND = ['Close by', 'Nearby', 'In the distance'];

export function makeSpotting({ camera, F, state, openGuide }) {
  const box = document.createElement('div'); box.id = 'spots'; document.body.appendChild(box);
  const lakes = (F.lakes || []).map(l => l.c).filter(Boolean);
  const f = new THREE.Vector3();
  let acc = 0, pend = new Map(), firstT = 0, now = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (id) => `assets/guide/${id}.jpg`;

  // ---- the boxes
  function toast(html, ms, onclick) {
    const el = document.createElement('div'); el.className = 'spot-toast'; el.innerHTML = html;
    let timer = null; const kill = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 400); };
    const arm = () => { clearTimeout(timer); timer = setTimeout(kill, ms); };
    el.addEventListener('pointerenter', () => clearTimeout(timer)); el.addEventListener('pointerleave', arm);
    el.addEventListener('click', (e) => { if (e.target.closest('.spot-x')) return kill(); const r = e.target.closest('[data-id]'); if (r && onclick) onclick(r.dataset.id); kill(); });
    for (const ev of ['pointerdown', 'pointerup', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
    box.appendChild(el); requestAnimationFrame(() => el.classList.add('in')); arm();
    while (box.children.length > 4) box.firstChild.remove();
  }
  const first = (t) => { const m = t.match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : t; };
  function announce(list) {          // list: [id, distance] of animals just spotted for the first time
    const c = counts();
    if (list.length === 1) {
      const a = BY[list[0][0]];
      toast(`<button class="spot-x" aria-label="Close">&times;</button><div class="spot-one" data-id="${a.id}"><img alt="" src="${img(a.id)}"><div><small>New animal spotted</small><b>${esc(a.name)}</b><i>${esc(a.latin)}</i><p>${esc(first(a.text))}</p><span>${c.total} of ${c.max} spotted · tap to read more</span></div></div>`, 10000, openGuide);
    } else {
      const rows = [[], [], []]; for (const [id, d] of list.sort((p, q) => p[1] - q[1])) rows[band(d)].push(id);
      let html = `<button class="spot-x" aria-label="Close">&times;</button><div class="spot-many"><small>New animals spotted</small><b>You have spotted ${list.length} new animals</b>`;
      rows.forEach((ids, k) => { if (!ids.length) return; html += `<h4>${BAND[k]} · ${ids.length}</h4>`; const per = list.length > 6 ? 2 : 4; for (const id of ids.slice(0, per)) { const a = BY[id]; html += `<div class="spot-row" data-id="${id}"><img alt="" src="${img(id)}"><b>${esc(a.name)}</b></div>`; } if (ids.length > per) html += `<p>and ${ids.length - per} more</p>`; });
      html += `<span>${c.total} of ${c.max} spotted · they are all in the guide</span></div>`;
      toast(html, 14000, openGuide);
    }
  }
  function achievements() {
    const c = counts(), got = [];
    for (const [id, title, what, test] of ACH) if (test(c) && seen.unlock(id)) got.push([title, what]);
    if (!got.length) return;
    const rows = got.map(([t, w]) => `<div><b>${esc(t)}</b><p>${esc(w)}</p></div>`).join('');
    toast(`<button class="spot-x" aria-label="Close">&times;</button><div class="spot-ach"><div class="spot-badge"></div><div><small>${got.length > 1 ? 'Achievements unlocked' : 'Achievement unlocked'}</small>${rows}</div></div>`, 9000);
  }
  function flush() {
    const list = []; for (const [id, d] of pend) if (seen.add(id)) list.push([id, d]);
    pend = new Map(); if (list.length) { announce(list); achievements(); }
  }
  const see = (id, d) => { if (!seen.has(id)) { if (!pend.size) firstT = now; const o = pend.get(id); if (o === undefined || d < o) pend.set(id, d); } };

  // ---- the looking
  function look() {
    const p = camera.position, cx = p.x, cz = p.z, sea = U.uSeaM.value * VEX, alt = p.y - Math.max(meshY(cx, cz), sea);
    camera.getWorldDirection(f); const fx = f.x, fz = f.z, fh = Math.hypot(fx, fz);
    const night = U.uNight.value, dark = night > 0.55, light = night < 0.4;
    for (const s of SPOT.src) {
      const id = s.id; if (seen.has(id)) continue;
      if (NIGHT_ONLY.has(id) ? !dark : (DAY_ONLY.has(id) && dark)) continue;
      if (alt > (HIGH[id] || 70)) continue;
      const lim = s.see; let best = 1e9;
      for (let i = 0; i < s.n; i++) {
        const dx = s.xz[i * 2] - cx, dz = s.xz[i * 2 + 1] - cz, d2 = dx * dx + dz * dz, L = lim + s.rad[i];
        if (d2 > L * L) continue;
        const d = Math.sqrt(d2);
        if (d > 14 && fh > 0.3 && (dx * fx + dz * fz) / (d * fh) < 0.45) continue;          // in front of the eye (within about 63 degrees)
        if (d < best) best = d;
      }
      if (best < 1e8) see(id, best);
    }
    for (const q of flyers) {
      const k = FLY[q.kind]; if (!k || !q.m || !q.m.visible) continue; const id = k[0]; if (seen.has(id)) continue;
      if (NIGHT_ONLY.has(id) ? !dark : (DAY_ONLY.has(id) && dark)) continue;
      const dx = q.m.position.x - p.x, dy = q.m.position.y - p.y, dz = q.m.position.z - p.z, d = Math.hypot(dx, dy, dz);
      if (d > k[1] || (dx * f.x + dy * f.y + dz * f.z) / d < 0.5) continue;
      see(id, d);
    }
    // silver gulls follow the viewer about the coast: any low view by day will do
    if (light && alt < 40 && !seen.has('silvergull')) see('silvergull', 30);
    // the shader-scattered ones: by chance, on foot or riding low in their sort of country
    if ((state().walking || state().riding) && alt < 25) {
      const mk = maskAt(cx, cz), h = heightAt(cx, cz), land = mk.land > 0.92, sand = mk.sand, rain = U.uRain.value;
      const forest = land && sand < 0.45 && h > 2, heath = land && sand < 0.6 && h > 1.8, open = land && sand < 0.85 && h > 1.6, dune = land && sand > 0.3 && h > 2.5;
      const dry = light && rain < 0.15, lake = lakes.some(c => Math.hypot(c[0] - cx, c[1] - cz) < 300);
      const roll = (id, rate, on) => { if (on && !seen.has(id) && Math.random() < 1 - Math.exp(-rate * 0.25)) see(id, 25); };
      for (const id of ['bluetiger', 'crow', 'brown', 'grassblue']) roll(id, 0.02, dry && (heath || forest));
      for (const id of ['darner', 'aussietiger', 'hawker']) roll(id, 0.02, dry && lake);
      roll('midges', 0.012, dry && (heath || forest));
      roll('wallaby', 0.004, !dark && (forest || heath));
      roll('goanna', 0.006, !dark && (heath || forest || dune));
      roll('bluetongue', 0.008, !dark && open);
    }
  }

  return {
    update(dt) {
      now += dt; acc += dt;
      if (acc >= 0.25) { acc = 0; if (!document.hidden) look(); }
      if (pend.size && now - firstT > 1.0) flush();
    },
  };
}

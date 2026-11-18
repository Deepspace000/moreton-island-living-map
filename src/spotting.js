// Spotting: when an animal comes into view it is added to the Wildlife guide, an information box comes up, and achievements are unlocked.
// Several animals seen at once are put together in one box ("You have spotted 5 new animals"), grouped by how far off they are.
//   - animals the map places from a list (fish, sea life, waders, water birds, reptiles, mammals, crabs): spotted when one is near enough and in front of you
//   - flying birds and bats: the same, from where they are in the air at the moment
//   - the few the shaders scatter by themselves (wallabies, goannas, blue-tongues, butterflies, dragonflies, midges) have no positions to look up, so they
//     are spotted by chance, the longer you spend on foot or riding low in the kind of country where they live
import * as THREE from 'three';
import { SPOT, seen, entryPos } from './spot.js';
import { GUIDE, ACH, counts } from './guide.js';
import { flyers } from './life.js';
import { U, VEX } from './common.js';
import { meshY, maskAt, heightAt } from './terrain.js';

const BY = Object.fromEntries(GUIDE.map(a => [a.id, a]));
const NIGHT_ONLY = new Set(['stonecurlew', 'flyingfox', 'microbat', 'bandicoot', 'longnose', 'brushtail', 'ringtail', 'waterrat']);
const DAY_ONLY = new Set([...GUIDE.filter(a => a.group === 'birds' && a.id !== 'stonecurlew').map(a => a.id), ...GUIDE.filter(a => a.group === 'insects').map(a => a.id)]);
const HIGH = { dolphin: 250, dugong: 250, humpback: 800, whaler: 160, tigershark: 220, greenturtle: 160, maskray: 90, shovelnose: 90 };          // how high above the water the eye may be and still count (default 70 m)
const FLY = { pelican: ['pelican', 500], eagle: ['seaeagle', 700], osprey: ['osprey', 450], brahminy: ['brahminy', 450], whistling: ['whistling', 450], wedgetail: ['wedgetail', 700], peregrine: ['peregrine', 400], flyingfox: ['flyingfox', 260], microbat: ['microbat', 120] };
const CLOSE = new Set([...GUIDE.filter(a => a.group === 'fish' && a.id !== 'whaler' && a.id !== 'tigershark').map(a => a.id), 'sandcrab', 'bluecrab', 'rockcrab', 'octopus', 'jellyfish']);          // spotted only from about 5 m, as a small notice
const BIGSEA = { humpback: 60, dolphin: 25, dugong: 25, tigershark: 20, whaler: 15, greenturtle: 10, maskray: 10, shovelnose: 10 };          // (the big animals of the water: a little further than 5 m)
const band = (d) => d < 40 ? 0 : d < 250 ? 1 : 2;
const BAND = ['Close by', 'Nearby', 'In the distance'];

export function makeSpotting({ camera, controls, walk, F, state, openGuide }) {
  const box = document.createElement('div'); box.id = 'spots'; document.body.appendChild(box);
  const lakes = (F.lakes || []).map(l => l.c).filter(Boolean);
  const f = new THREE.Vector3();
  let acc = 0, pend = new Map(), now = 0, focus = null;
  const vp = new THREE.Vector3();
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
  // a small notice for the fish and the small things of the water, in the same column at the right as the other messages
  function note(id) {
    const a = BY[id], c = counts(), el = document.createElement('div'); el.className = 'spot-toast spot-note'; el.dataset.id = id;
    el.innerHTML = `<img alt="" src="${img(id)}"><div><small>New animal spotted</small><b>${esc(a.name)}</b><p>${esc(first(a.text))}</p><span>${c.total} of ${c.max} spotted</span></div>`;
    let timer = null; const kill = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 400); };
    el.addEventListener('click', () => { openGuide(id); kill(); }); for (const ev of ['pointerdown', 'pointerup', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
    box.appendChild(el); requestAnimationFrame(() => el.classList.add('in')); timer = setTimeout(kill, 7000); while (box.children.length > 4) box.firstChild.remove();
  }
  function announce(all) {          // all: [id, distance] of animals just spotted for the first time
    const near = all.filter(([id]) => CLOSE.has(id)), list = all.filter(([id]) => !CLOSE.has(id));
    if (near.length <= 3) near.forEach(([id]) => note(id)); else list.push(...near);
    if (!list.length) return;
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
    const list = [], items = []; for (const [id, o] of pend) if (seen.add(id)) { list.push([id, o.d]); if (o.ref) items.push({ id, d: o.d, ref: o.ref }); }
    pend = new Map(); if (!list.length) return;
    announce(list); achievements(); if (items.length) startFocus(items);
  }
  const see = (id, d, ref) => { if (seen.has(id)) return; const o = pend.get(id); if (!o || d < o.d) pend.set(id, { d, ref }); };

  // ---- the frame round what has just been spotted, and the turn of the view toward it
  const SIZE = { humpback: 12, dolphin: 2.5, dugong: 3, tigershark: 3.5, whaler: 2, greenturtle: 1.1, maskray: 1.4, shovelnose: 1.5, pelican: 1.7, seaeagle: 2, wedgetail: 2.2, flyingfox: 1.2, microbat: 0.3, jewfish: 1.2, trevally: 0.8, python: 2, crab: 0.3, octopus: 0.6 };
  const worldPos = (it, out) => {
    const r = it.ref; if (r.q) return out.copy(r.q.m.position);
    return entryPos(r.src, r.i, U.uTime.value, U.uSeaM.value * VEX, VEX, (x, z) => CLOSE.has(it.id) ? meshY(x, z) : Math.max(meshY(x, z), U.uSeaM.value * VEX), out);
  };
  // Every frame has its own clock and stays so that the animal can be gone and looked at: it names how far off the animal is, points the way when it is off the
  // screen, and goes when you are close to it (after a few seconds), after 40 s, or on any key that is not for moving about (after the first 2 s). The view is
  // never turned for a fish: the swimmer keeps going. Other animals turn the view to the nearest of them (not while riding).
  function clearFocus(onlyOld) { if (!focus) return; focus.items = focus.items.filter(it => { if (onlyOld && now - it.t0 < 2) return true; it.el.remove(); return false; }); if (!focus.items.length) focus = null; }
  function startFocus(items) {
    items.sort((a, b) => a.d - b.d);
    focus = focus || { items: [], turnTo: null, tTurn: 0 };
    for (const it of items.slice(0, 6)) {
      const el = document.createElement('div'); el.className = 'spot-frame'; el.innerHTML = '<i></i><span></span>'; frames().appendChild(el); it.el = el; it.name = BY[it.id].name; el.querySelector('span').addEventListener('click', () => { it.el.remove(); focus.items.splice(focus.items.indexOf(it), 1); });
      it.size = SIZE[it.id] || (it.ref.q ? 1.5 : 0.7); it.t0 = now; it.close = CLOSE.has(it.id); focus.items.push(it);
    }
    while (focus.items.length > 6) focus.items.shift().el.remove();
    const far = items.find(it => !CLOSE.has(it.id)); if (far && !state().riding) { focus.turnTo = far; focus.tTurn = now; }
  }
  let layer = null; const frames = () => layer || (layer = Object.assign(document.createElement('div'), { id: 'spotframes' }), document.body.appendChild(layer), layer);
  function updateFocus(dt) {
    if (!focus) return;
    for (const it of focus.items.slice()) if (now - it.t0 > 40 || (it.near && now - it.near > 4)) { it.el.remove(); focus.items.splice(focus.items.indexOf(it), 1); }
    if (!focus.items.length) { focus = null; return; }
    const W = innerWidth, H = innerHeight, k = H / 2 / Math.tan(camera.fov * Math.PI / 360);
    for (const it of focus.items) {
      worldPos(it, vp); const d = vp.distanceTo(camera.position); it.p = it.p || new THREE.Vector3(); it.p.copy(vp);
      if (d < 2.5) { if (!it.near) it.near = now; } else it.near = 0;
      vp.project(camera); const behind = vp.z > 1, on = !behind && Math.abs(vp.x) < 1.0 && Math.abs(vp.y) < 1.0;
      const half = Math.max(40, Math.min(190, it.size * 0.5 / Math.max(d, 1) * k * 1.5)), el = it.el;
      el.querySelector('span').textContent = it.name + ' \u00b7 ' + (d < 10 ? d.toFixed(1) : Math.round(d)) + ' m';
      if (on) { el.classList.remove('off'); el.style.width = el.style.height = half * 2 + 'px'; el.style.left = ((vp.x + 1) / 2 * W - half) + 'px'; el.style.top = ((1 - vp.y) / 2 * H - half) + 'px'; el.style.transform = ''; }
      else {          // off the screen: its name at the edge, on the side where it is
        let sx = behind ? -vp.x : vp.x, sy = behind ? -vp.y : vp.y; const m = Math.max(Math.abs(sx), Math.abs(sy), 1e-3); sx /= m; sy /= m;
        el.classList.add('off'); el.style.width = el.style.height = '0px'; el.style.left = (W / 2 + sx * (W / 2 - 90)) + 'px'; el.style.top = (H / 2 - sy * (H / 2 - (sy < 0 ? 125 : 50))) + 'px';
      }
    }
    // turn toward the nearest of the others: on foot the way it looks, from the map the point it looks at
    const t = focus.turnTo;
    if (t && now - focus.tTurn < 2.5 && t.p && !state().riding) {
      const p = t.p, f = 1 - Math.exp(-dt * 4);
      if (walk.active) {
        const dx = p.x - camera.position.x, dy = p.y - camera.position.y, dz = p.z - camera.position.z, yaw = Math.atan2(dx, -dz), pit = Math.atan2(dy, Math.hypot(dx, dz));
        let dyaw = yaw - walk.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); walk.yaw += dyaw * f; walk.pitch += (Math.max(-1.2, Math.min(1.2, pit)) - walk.pitch) * f;
      } else if (controls) controls.target.lerp(p, f);
    }
  }
  const MOVE = /^(Key[WASDQEZ]|Arrow|Shift|Space|Tab|Control|Alt|Digit|F\d)/;          // keys for moving about do not take a frame away
  addEventListener('keydown', (e) => { if (!MOVE.test(e.code)) clearFocus(true); }, true);

  // ---- the looking
  function look() {
    const p = camera.position, cx = p.x, cz = p.z, sea = U.uSeaM.value * VEX, alt = p.y - Math.max(meshY(cx, cz), sea);
    camera.getWorldDirection(f); const fx = f.x, fz = f.z, fh = Math.hypot(fx, fz);
    const night = U.uNight.value, dark = night > 0.55, light = night < 0.4;
    // The animal has to be in front of the eye (within about 37 degrees, up or down as well) and close: 5 m in the water, 10 m on land, 50 m in the air.
    // The bigger animals of the sea are allowed a little more, since a whale at 5 m would never be seen.
    const t = U.uTime.value, ground = (x, z) => Math.max(meshY(x, z), sea), bed = (x, z) => meshY(x, z);
    for (const s of SPOT.src) {
      const id = s.id; if (seen.has(id)) continue;
      if (NIGHT_ONLY.has(id) ? !dark : (DAY_ONLY.has(id) && dark)) continue;
      const lim = s.move === 'fly8' ? 50 : (s.move === 'swim' || s.move === 'jelly' || CLOSE.has(id)) ? (BIGSEA[id] || 5) : 10; let best = 1e9, bi = -1;
      for (let i = 0; i < s.n; i++) {
        const dx0 = s.xz[i * 2] - cx, dz0 = s.xz[i * 2 + 1] - cz, L = lim + s.rad[i];
        if (dx0 * dx0 + dz0 * dz0 > L * L) continue;          // (too far to be worth working out where it is now)
        entryPos(s, i, t, sea, VEX, CLOSE.has(id) ? bed : ground, vp);
        const dx = vp.x - p.x, dy = vp.y - p.y, dz = vp.z - p.z, d = Math.hypot(dx, dy, dz);
        if (d > lim || (d > 1.5 && (dx * f.x + dy * f.y + dz * f.z) / d < 0.8)) continue;
        if (d < best) { best = d; bi = i; }
      }
      if (best < 1e8) see(id, best, { src: s, i: bi });
    }
    for (const q of flyers) {          // (flying birds and bats: where they are in the air now)
      const k = FLY[q.kind]; if (!k || !q.m || !q.m.visible) continue; const id = k[0]; if (seen.has(id)) continue;
      if (NIGHT_ONLY.has(id) ? !dark : (DAY_ONLY.has(id) && dark)) continue;
      const dx = q.m.position.x - p.x, dy = q.m.position.y - p.y, dz = q.m.position.z - p.z, d = Math.hypot(dx, dy, dz);
      if (d > 50 || (d > 1.5 && (dx * f.x + dy * f.y + dz * f.z) / d < 0.8)) continue;
      see(id, d, { q });
    }
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
      if (acc >= 0.25) { acc = 0; if (!document.hidden && !document.body.classList.contains('guide-open')) { look(); if (pend.size) flush(); } }
      updateFocus(dt);
    },
  };
}

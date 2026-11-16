// Every panel is a small window. It can be dragged anywhere, by any part of it that is not a slider (also as a chip, when it is minimised),
// and made bigger or smaller by the grip in its bottom right corner. Where each was put and how big it was made is remembered between visits.
// A panel that has been moved or resized carries the class "moved": the page's own layout then leaves it where it is.
// Most panels grow and shrink as a whole (text and buttons with them); one marked data-size="free" (the mini map) changes its width and
// height instead, and shows more or less.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function makeWindows({ onChange } = {}) {
  const wins = [...document.querySelectorAll('.win')], KMIN = 0.6, KMAX = 2.4, changed = () => { if (onChange) onChange(); };
  const free = (w) => w.dataset.size === 'free';
  const save = (w) => { try { if (w._s) localStorage.setItem('win:' + w.id, JSON.stringify(w._s)); else localStorage.removeItem('win:' + w.id); } catch (e) { /* not remembered then */ } };
  // keep it on the screen: all of it where it fits, and its top left corner in any case
  function place(w) {
    const s = w._s; if (!s) return; const r = w.getBoundingClientRect();
    s.x = Math.round(clamp(s.x, 4, Math.max(4, innerWidth - Math.max(r.width, 40) - 4))); s.y = Math.round(clamp(s.y, 4, Math.max(4, innerHeight - Math.max(r.height, 26) - 4)));
    w.style.left = s.x + 'px'; w.style.top = s.y + 'px';
  }
  function apply(w) {
    const s = w._s;
    if (!s) { w.classList.remove('moved'); for (const p of ['position', 'left', 'top', 'right', 'bottom', 'margin', 'transform', 'transformOrigin', 'width', 'height']) w.style[p] = ''; return; }
    w.classList.add('moved'); w.style.position = 'fixed'; w.style.right = w.style.bottom = 'auto'; w.style.margin = '0';
    if (free(w)) { w.style.width = s.w ? s.w + 'px' : ''; w.style.height = s.h ? s.h + 'px' : ''; }
    else { w.style.transformOrigin = '0 0'; w.style.transform = s.k && s.k !== 1 ? `scale(${s.k})` : ''; }
    place(w);
  }
  // from now on it stands where it is by its own left and top, not by the page's layout
  function anchor(w) { if (!w._s) { const r = w.getBoundingClientRect(); w._s = { x: r.left, y: r.top, k: 1 }; apply(w); } return w._s; }
  for (const w of wins) {
    const g = document.createElement('i'); g.className = 'win-rs'; g.title = 'Drag to make this panel bigger or smaller'; w.append(g);
    let s = null; try { s = JSON.parse(localStorage.getItem('win:' + w.id) || 'null'); if (!s && w.id === 'mini') { const o = JSON.parse(localStorage.getItem('mini:pos') || 'null'); if (o) s = { x: o[0], y: o[1], k: 1 }; } } catch (e) { /* storage can be blocked */ }
    if (s && isFinite(s.x) && isFinite(s.y)) { w._s = { x: +s.x, y: +s.y, k: clamp(+s.k || 1, KMIN, KMAX), w: +s.w || 0, h: +s.h || 0 }; apply(w); }
  }
  let act = null;
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || act || !e.target.closest) return; const w = e.target.closest('.win'); if (!w) return;
    for (const o of wins) o.style.zIndex = ''; w.style.zIndex = 6;          // (the one you touch comes to the front)
    const size = !!e.target.closest('.win-rs'); if (!size && e.target.closest('input, select, textarea, a[href], .keys, .foot')) return;          // (sliders, links and the steering buttons are held and dragged for their own sake)
    act = { w, id: e.pointerId, size, x: e.clientX, y: e.clientY, on: false, finger: e.pointerType !== 'mouse' };
    if (size) e.preventDefault();
  }, true);
  addEventListener('pointermove', (e) => {
    if (!act || e.pointerId !== act.id) return; const dx = e.clientX - act.x, dy = e.clientY - act.y, w = act.w;
    if (!act.on) {
      if (Math.hypot(dx, dy) < (act.finger ? 9 : 5)) return;          // (less than that is a click or a tap on whatever is there)
      act.on = true; act.r = w.getBoundingClientRect(); const s = anchor(w); act.sx = s.x; act.sy = s.y; act.k = s.k || 1; w.classList.add('dragging');
    }
    const s = w._s;
    if (!act.size) { s.x = act.sx + dx; s.y = act.sy + dy; place(w); }
    else if (free(w)) { s.w = Math.round(clamp(act.r.width + dx, 150, 680)); s.h = Math.round(clamp(act.r.height + dy, 150, 780)); w.style.width = s.w + 'px'; w.style.height = s.h + 'px'; }
    else { s.k = Math.round(clamp(act.k * ((act.r.width + dx) / act.r.width + (act.r.height + dy) / act.r.height) / 2, KMIN, KMAX) * 100) / 100; w.style.transformOrigin = '0 0'; w.style.transform = s.k !== 1 ? `scale(${s.k})` : ''; }
    changed();
  }, true);
  const eat = (e) => { e.stopPropagation(); e.preventDefault(); };
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => {
    if (!act || e.pointerId !== act.id) return; const a = act; act = null; if (!a.on) return;
    a.w.classList.remove('dragging'); place(a.w); save(a.w); changed();
    addEventListener('click', eat, true); setTimeout(() => removeEventListener('click', eat, true), 80);          // (the drag does not also press the button it began on)
  }, true);
  function fit() {
    for (const w of wins) {
      if (w._s) place(w);
      if (w.id === 'places' || w.id === 'wx') w.style.touchAction = w.scrollHeight > w.clientHeight + 2 && !w.classList.contains('min') ? 'pan-y' : '';          // (a long list is scrolled by a finger: drag it sideways to move it)
    }
  }
  addEventListener('resize', fit);
  return {
    fit,
    scale: (w) => (w._s && !free(w) && w._s.k) || 1,
    anyMoved: () => wins.some(w => w._s),
    reset(w) { w._s = null; apply(w); save(w); changed(); },
    resetAll() { for (const w of wins) if (w._s) { w._s = null; apply(w); save(w); } try { localStorage.removeItem('mini:pos'); } catch (e) { /* nothing kept */ } changed(); },
  };
}

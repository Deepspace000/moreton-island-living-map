// The app's own right-click menu. The browser's menu ("Save image as...") means nothing on a map, so this one comes up in its place.
// show(x, y, items): each item is { label, note, run }, and a null in the list draws a dividing line.
export function makeMenu() {
  const el = document.createElement('div'); el.id = 'ctx'; el.hidden = true; el.setAttribute('role', 'menu'); document.body.appendChild(el);
  const hide = () => { el.hidden = true; };
  addEventListener('pointerdown', (e) => { if (!el.hidden && !el.contains(e.target)) hide(); }, true);
  addEventListener('wheel', hide, { passive: true }); addEventListener('blur', hide); addEventListener('resize', hide);
  return {
    hide, get open() { return !el.hidden; },
    show(x, y, items) {
      el.textContent = '';
      for (const it of items) {
        if (!it) { if (el.lastChild && el.lastChild.tagName !== 'HR') el.appendChild(document.createElement('hr')); continue; }
        const b = document.createElement('button'), s = document.createElement('span'); b.setAttribute('role', 'menuitem'); s.textContent = it.label; b.appendChild(s);
        if (it.note) { const n = document.createElement('small'); n.textContent = it.note; b.appendChild(n); }
        b.onclick = () => { hide(); it.run(); }; el.appendChild(b);
      }
      if (el.lastChild && el.lastChild.tagName === 'HR') el.lastChild.remove();
      el.hidden = false; const r = el.getBoundingClientRect();
      el.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'; el.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
    },
  };
}

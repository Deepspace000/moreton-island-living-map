// Under the water: the frame of a diving mask round the view, and breaths of bubbles rising past the glass.
export function makeDive() {
  const el = document.createElement('div'); el.id = 'dive';
  // the mask: black silicone round one wide lens, with the pocket for the nose at the bottom
  const LENS = 'M 15,6 Q 3.5,6 3.5,22 L 3.5,68 Q 3.5,94 22,94 L 35,94 Q 42.5,94 45.5,84 Q 50,71 54.5,84 Q 57.5,94 65,94 L 78,94 Q 96.5,94 96.5,68 L 96.5,22 Q 96.5,6 85,6 Z';
  el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M -5,-5 H 105 V 105 H -5 Z ${LENS}" fill="#07090b" fill-rule="evenodd"/>
    <path d="${LENS}" fill="none" stroke="rgba(0,0,0,0.38)" stroke-width="34" vector-effect="non-scaling-stroke"/>
    <path d="${LENS}" fill="none" stroke="#14171b" stroke-width="12" vector-effect="non-scaling-stroke"/>
    <path d="${LENS}" fill="none" stroke="#3b424a" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><canvas></canvas>`;
  document.getElementById('c').after(el);        // above the picture, below the buttons and panels
  const cv = el.querySelector('canvas'), c = cv.getContext('2d'), bubbles = [];
  let on = false, breath = 1.2, w = 0, h = 0;
  const size = () => { w = cv.width = Math.round(innerWidth * Math.min(devicePixelRatio || 1, 1.5)); h = cv.height = Math.round(innerHeight * Math.min(devicePixelRatio || 1, 1.5)); };
  addEventListener('resize', size); size();
  const puff = (n, x0) => { for (let i = 0; i < n; i++) bubbles.push({ x: x0 + (Math.random() - 0.5) * 0.09, y: 1.02 + Math.random() * 0.12, r: 0.004 + Math.random() * Math.random() * 0.022, v: 0.25 + Math.random() * 0.3, ph: Math.random() * 6.28, wob: 0.6 + Math.random() }); };
  return {
    update(under, dt) {
      if (under !== on) { on = under; el.style.display = on ? 'block' : 'none'; if (on) { breath = 0.4; puff(26, 0.5); } else bubbles.length = 0; }
      if (!on) return;
      breath -= dt; if (breath < 0) { breath = 3.4 + Math.random() * 1.6; const x0 = Math.random() < 0.5 ? 0.36 : 0.64; puff(14 + ((Math.random() * 12) | 0), x0); }
      if (Math.random() < dt * 1.5) puff(1, 0.2 + Math.random() * 0.6);
      c.clearRect(0, 0, w, h);
      const u = Math.min(w, h);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]; b.y -= b.v * dt * (0.6 + b.r * 30); b.ph += dt * 4 * b.wob; b.r *= 1 + dt * 0.12;
        if (b.y < -0.08) { bubbles.splice(i, 1); continue; }
        const x = (b.x + Math.sin(b.ph) * 0.012 * b.wob) * w, y = b.y * h, r = b.r * u * (1 + 0.08 * Math.sin(b.ph * 2.3)), sq = 1 - 0.12 * Math.sin(b.ph * 1.7);       // they wobble and flatten as they rise
        c.save(); c.translate(x, y); c.scale(1, sq);
        const g = c.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, 'rgba(235,250,255,0.10)'); g.addColorStop(0.72, 'rgba(190,235,245,0.10)'); g.addColorStop(0.9, 'rgba(225,248,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0.05)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.11, -0.6, 0, 6.283); c.fill();
        c.restore();
      }
    },
  };
}

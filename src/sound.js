// The island's sound, made in the browser with no recordings: wind and leaves, ocean surf and
// bay ripples, rain and thunder, cicadas by day and crickets by night, and the calls of birds that
// live around Moreton Bay. Every layer follows where the listener stands, the weather and the hour.
import { U, clamp, smooth } from './common.js';
import { maskAt, albedoAt } from './terrain.js';

export function makeSound() {
  let ctx = null, on = false, out, L = null, noiseBuf, birdT = 3, waveT = 1, lapT = 1, gust = 0, thunderArmed = true, envT = 0;
  const env = { ocean: 0, bay: 0, wood: 0, beach: 0, local: 1 }, rgb = [0, 0, 0];
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random() * 2; s.start(0, Math.random() * 3); return s; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const lfo = (f, depth, to, type = 'sine') => { const o = ctx.createOscillator(), g = gain(depth); o.type = type; o.frequency.value = f; o.connect(g); g.connect(to); o.start(); return o; };
  const ease = (param, v, tc = 0.4) => param.setTargetAtTime(v, ctx.currentTime, tc);

  function build() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not on this browser */ }          // (an iPad or iPhone set to silent would otherwise play nothing)
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    out = gain(0); const comp = ctx.createDynamicsCompressor(); out.connect(comp); comp.connect(ctx.destination);
    L = {};
    // wind: a low rush, a higher whistle that comes in with strong wind, and leaves
    L.windF = filt('lowpass', 400); L.wind = gain(); chain(noise(), L.windF, L.wind, out);
    L.whistleF = filt('bandpass', 950, 3); L.whistle = gain(); chain(noise(), L.whistleF, L.whistle, out); lfo(0.13, 180, L.whistleF.frequency);
    L.leaf = gain(); chain(noise(), filt('highpass', 2600), filt('bandpass', 5200, 0.5), L.leaf, out);
    // sea: the rumble and hiss of surf (each wave is shaped in update), and small waves lapping in the bay
    L.surfBed = gain(); chain(noise(), filt('lowpass', 320), L.surfBed, out);
    L.crash = gain(); chain(noise(), filt('lowpass', 900), L.crash, out);
    L.wash = gain(); chain(noise(), filt('bandpass', 2600, 0.6), L.wash, out);
    L.lap = gain(); chain(noise(), filt('bandpass', 1300, 0.9), L.lap, out);
    L.rain = gain(); chain(noise(), filt('highpass', 1800), L.rain, out);
    L.thunder = gain(); chain(noise(), filt('lowpass', 110), L.thunder, out);
    // cicadas: two narrow bands of noise, chopped a hundred times a second, swelling and fading as a chorus
    L.cic = gain(); L.cicSwell = gain(0.6); lfo(0.07, 0.4, L.cicSwell.gain); L.cic.connect(L.cicSwell); L.cicSwell.connect(out);
    for (const [f, rate] of [[4400, 92], [6100, 118]]) { const chop = gain(0.5); lfo(rate, 0.5, chop.gain, 'square'); chain(noise(), filt('bandpass', f, 11), chop, L.cic); }
    // crickets: a pure tone in short trills
    L.crk = gain(); const tone = ctx.createOscillator(); tone.frequency.value = 4700; tone.start();
    const trill = gain(0.5), gate = gain(0.5); lfo(31, 0.5, trill.gain, 'square'); lfo(2.3, 0.5, gate.gain, 'square'); chain(tone, trill, gate, L.crk, out);
    L.birds = gain(0.9); L.birds.connect(out);
  }

  // ---- bird calls: each plays one call at time t0 and returns how long it lasts ----
  const voice = (type, t0, dur, vol, pan, freqs, shape, raspRate) => {
    const o = ctx.createOscillator(), g = gain(0), p = ctx.createStereoPanner ? ctx.createStereoPanner() : gain(1);
    o.type = type; if (p.pan) p.pan.value = pan;
    o.frequency.setValueAtTime(freqs[0][1], t0); for (const [t, f] of freqs.slice(1)) o.frequency.exponentialRampToValueAtTime(f, t0 + t * dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * (shape || 0.15)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let last = g;
    if (raspRate) {            // a harsh voice: chop the note many times a second
      const am = gain(0.55), r = ctx.createOscillator(), d = gain(0.45); r.type = 'square'; r.frequency.value = raspRate; r.connect(d); d.connect(am.gain); r.start(t0); r.stop(t0 + dur + 0.05);
      g.connect(am); last = am;
    }
    o.connect(g); chain(last, p, L.birds); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const CALLS = {
    kite(t, v, p) {            // whistling kite: a long falling whistle, then a quick rising chatter
      voice('sine', t, 0.9, v, p, [[0, 3000], [1, 1750]], 0.2); let u = t + 1.0;
      for (let i = 0; i < 7; i++) { voice('sine', u, 0.085, v * 0.8, p, [[0, 1700 + i * 170], [1, 2300 + i * 190]], 0.3); u += 0.1; }
      return 1.8;
    },
    whipbird(t, v, p) {        // eastern whipbird: a long thin note, the whip crack, and the mate's two-note answer
      voice('sine', t, 1.1, v * 0.7, p, [[0, 1500], [1, 1750]], 0.6); voice('sine', t + 1.1, 0.14, v * 1.3, p, [[0, 1800], [0.8, 7200], [1, 6000]], 0.5);
      voice('sine', t + 1.4, 0.13, v * 0.8, -p, [[0, 2600], [1, 2200]], 0.2); voice('sine', t + 1.58, 0.13, v * 0.8, -p, [[0, 2600], [1, 2200]], 0.2);
      return 1.8;
    },
    oystercatcher(t, v, p) {   // pied oystercatcher: sharp piping, speeding up
      let u = t, gap = 0.26; const n = 4 + (Math.random() * 6 | 0);
      for (let i = 0; i < n; i++) { voice('triangle', u, 0.1, v, p, [[0, 3300], [0.3, 3700], [1, 2900]], 0.2); u += gap; gap = Math.max(0.12, gap * 0.88); }
      return u - t;
    },
    gull(t, v, p) {            // silver gull: harsh scolding cries
      const n = 2 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) voice('sawtooth', t + i * 0.42, 0.36, v * 0.55, p, [[0, 1500], [0.25, 1900], [1, 1250]], 0.2, 64);
      return n * 0.42;
    },
    tern(t, v, p) {            // crested tern: a short rasping "kirrik"
      for (let i = 0; i < 2; i++) voice('sawtooth', t + i * 0.16, 0.13, v * 0.45, p, [[0, 2600], [1, 3100]], 0.3, 120);
      return 0.4;
    },
    coucal(t, v, p) {          // pheasant coucal: a run of deep hoots, falling and quickening
      let u = t, gap = 0.3, f = 470; const n = 12 + (Math.random() * 8 | 0);
      for (let i = 0; i < n; i++) { voice('sine', u, 0.14, v * 1.2, p, [[0, f], [1, f * 0.88]], 0.3); u += gap; gap = Math.max(0.13, gap * 0.93); f *= 0.985; }
      return u - t;
    },
    honeyeater(t, v, p) {      // brown honeyeater: a bright, fast jumble of notes
      let u = t; const n = 6 + (Math.random() * 7 | 0);
      for (let i = 0; i < n; i++) { const f = 2600 + Math.random() * 2600, d = 0.05 + Math.random() * 0.06; voice('sine', u, d, v * 0.7, p, [[0, f], [1, f * (0.75 + Math.random() * 0.6)]], 0.3); u += d + 0.02 + Math.random() * 0.05; }
      return u - t;
    },
    crow(t, v, p) {            // Torresian crow: nasal clipped barks
      const n = 2 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) voice('sawtooth', t + i * 0.34, 0.2, v * 0.4, p, [[0, 640], [1, 520]], 0.2, 48);
      return n * 0.34;
    },
    kookaburra(t, v, p) {      // laughing kookaburra: low chuckles that climb into a loud cackle and fall away
      let u = t; const n = 16 + (Math.random() * 8 | 0);
      for (let i = 0; i < n; i++) {
        const k = i / n, up = Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5) * (1 - 0.5 * Math.max(0, k - 0.7) / 0.3), f = 420 + 700 * up, d = 0.14 - 0.06 * up;
        voice('sawtooth', u, d, v * (0.4 + 0.9 * up), p, [[0, f * 0.9], [0.4, f * 1.15], [1, f * 0.85]], 0.3, 70 + 60 * up); u += d + 0.035;
      }
      return u - t;
    },
    boobook(t, v, p) {         // southern boobook, the owl that says its own name at night
      voice('sine', t, 0.26, v * 1.3, p, [[0, 560], [1, 540]], 0.3); voice('sine', t + 0.42, 0.3, v * 1.3, p, [[0, 450], [1, 430]], 0.3);
      return 0.8;
    },
  };

  // what is around the listener: open ocean or sheltered bay nearby, forest, beach
  function listen(x, z) {
    const m = maskAt(x, z); let expo = 0, wet = 0;
    const reach = Math.abs(m.shore) + 70;
    for (let i = 0; i < 8; i++) { const q = maskAt(x + Math.cos(i * 0.785) * reach, z + Math.sin(i * 0.785) * reach); if (q.land < 0.5) { wet++; expo = Math.max(expo, q.expo); } }
    const d = Math.max(0, m.shore), sea = wet ? 1 : 0, oc = smooth(0.4, 0.8, expo);
    env.ocean = sea * oc * Math.exp(-d / 380) * (m.land < 0.5 ? 0.55 + 0.45 * Math.exp(m.shore / 250) : 1);       // surf carries a long way inland, and fades offshore
    env.bay = sea * (1 - oc) * Math.exp(-d / 70) * (m.land < 0.5 ? Math.exp(m.shore / 120) * 0.8 + 0.2 : 1);
    albedoAt(x, z, rgb); const lum = rgb[0] ** 2.2 * 0.3 + rgb[1] ** 2.2 * 0.55 + rgb[2] ** 2.2 * 0.15;      // the picture is stored gamma-encoded
    env.wood = m.land * (1 - m.sand) * smooth(0.26, 0.09, lum);
    env.beach = m.land > 0.5 ? Math.exp(-d / 120) : 0.6;
    env.land = m.land;
  }

  let wakeT = 0;
  function wake() { if (ctx && on && ctx.state !== 'running') { try { const r = ctx.resume(); if (r && r.catch) r.catch(() => { /* not yet allowed: the next tap will do it */ }); } catch (e) { /* the same */ } } }
  return {
    get on() { return on; },
    toggle() {
      on = !on;
      if (on && !ctx && !(window.AudioContext || window.webkitAudioContext)) return (on = false);          // (a browser with no sound at all: the button simply stays off)
      if (on) { if (!ctx) build(); wake(); ease(out.gain, 0.9, 0.6); } else if (ctx) ease(out.gain, 0, 0.15);
      return on;
    },
    wake,          // called from a tap or a key: Safari starts (or restarts) sound only then
    // s: { x, z, dist (camera distance, 0 when walking), wind km/h, wave m, rain 0..1, dt }
    update(s) {
      if (!ctx || !on) return;
      if (document.hidden) { if (ctx.state === 'running') ctx.suspend(); return; } else if (ctx.state !== 'running' && (wakeT -= s.dt) < 0) { wakeT = 1; wake(); }          // (Safari also has an 'interrupted' state, after a call or another app's sound)
      const dt = s.dt, t = ctx.currentTime, night = U.uNight.value, day = 1 - smooth(0.25, 0.7, night);
      envT -= dt; if (envT < 0) { envT = 0.3; listen(s.x, s.z); }
      const local = smooth(4000, 250, s.dist), wide = smooth(16000, 600, s.dist);          // from high above only the big sounds carry
      const w = clamp(s.wind / 45, 0, 1.4);
      gust += (Math.sin(t * 0.31) * 0.5 + Math.sin(t * 0.83 + 1.7) * 0.3 + Math.sin(t * 2.1) * 0.15 - gust) * Math.min(1, dt * 2);
      const blow = Math.pow(w, 1.3) * (1 + 0.45 * gust);
      ease(L.wind.gain, (0.035 + 0.5 * blow) * (0.55 + 0.45 * (1 - env.wood * local))); ease(L.windF.frequency, 260 + 1000 * w * (1 + 0.3 * gust));
      ease(L.whistle.gain, 0.14 * smooth(0.45, 1.2, w) * (1 + gust)); ease(L.leaf.gain, 0.16 * env.wood * local * (0.15 + blow));
      ease(L.rain.gain, 0.3 * s.rain * (0.5 + 0.5 * local));
      // surf: every few seconds a wave rears up, breaks and hisses back down the sand
      const surf = env.ocean * wide * clamp(0.25 + s.wave * 0.5, 0.2, 1.6);
      ease(L.surfBed.gain, 0.3 * surf);
      waveT -= dt;
      if (waveT < 0 && surf > 0.01) {
        const big = 0.5 + Math.random() * 0.7, c = L.crash.gain, h = L.wash.gain;
        c.cancelScheduledValues(t); c.setTargetAtTime(0.55 * surf * big, t, 0.5); c.setTargetAtTime(0.03 * surf, t + 1.9, 1.3);
        h.cancelScheduledValues(t); h.setTargetAtTime(0.16 * surf * big, t + 1.3, 0.5); h.setTargetAtTime(0.01 * surf, t + 3.0, 1.6);
        waveT = 5.5 + Math.random() * 5;
      } else if (surf <= 0.01) { ease(L.crash.gain, 0); ease(L.wash.gain, 0); }
      // bay: small quick ripples on the sand
      const lapK = env.bay * local * clamp(0.5 + s.wind / 40, 0.4, 1.3);
      lapT -= dt;
      if (lapT < 0) { const g = L.lap.gain; g.cancelScheduledValues(t); g.setTargetAtTime(0.2 * lapK * (0.5 + Math.random()), t, 0.12); g.setTargetAtTime(0.02 * lapK, t + 0.45, 0.4); lapT = 1.4 + Math.random() * 2.2; }
      // insects
      ease(L.cic.gain, 0.36 * env.wood * local * day * smooth(0.5, 0.1, s.rain) * smooth(50, 22, s.wind), 1.5);
      ease(L.crk.gain, 0.06 * smooth(0.45, 0.85, night) * (env.land || 0) * (0.4 + 0.6 * env.wood) * local * smooth(0.6, 0.1, s.rain), 1.5);
      // birds: more talk early and late in the day, less in wind and rain
      birdT -= dt;
      const calm = smooth(0.7, 0.1, s.rain) * smooth(60, 25, s.wind) * local;
      if (birdT < 0 && calm > 0.05) {
        const pool = [];
        if (night > 0.75) { if (env.wood > 0.3) pool.push('boobook'); }
        else if (day > 0.3) {
          if (env.beach > 0.35 || !env.land) pool.push('gull', 'gull', 'oystercatcher', 'tern');
          if (env.wood > 0.3) pool.push('whipbird', 'honeyeater', 'honeyeater', 'honeyeater', 'coucal', 'crow', 'kookaburra');
          pool.push('kite');
        }
        if (pool.length) { const name = pool[Math.random() * pool.length | 0], far = 0.25 + Math.random() * 0.75; birdT = CALLS[name](t + 0.05, 0.09 * far * calm, Math.random() * 1.6 - 0.8) + (1.5 + Math.random() * 6) * (night > 0.75 ? 4 : 1); }
        else birdT = 4;
      }
      // thunder follows the lightning
      if (U.uFlash.value > 0.6 && thunderArmed) { thunderArmed = false; const g = L.thunder.gain, t0 = t + 0.6 + Math.random() * 3; g.cancelScheduledValues(t); g.setValueAtTime(0, t0); g.linearRampToValueAtTime(1.6, t0 + 0.08); g.setTargetAtTime(0.5, t0 + 0.15, 0.5); g.setTargetAtTime(0, t0 + 1.4, 1.6); }
      if (U.uFlash.value < 0.05) thunderArmed = true;
    },
  };
}

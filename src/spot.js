// Where the animals are, for the Wildlife guide's spotting (spotting.js). Each part of the map that places animals tells this list where they
// stand and how far off a person could pick one out; the spotting code then asks which are near the eye and in view. Animals that the shaders
// scatter by themselves (wallabies, lizards, butterflies, dragonflies, midges) have no list; spotting.js uses their habitat instead.
export const SPOT = { src: [] };          // each: { id, xz: [x, z, ...], rad: [metres they roam, ...], n, see (metres) }

// one list of animals of one kind: list holds `stride` numbers per animal, x at xAt and z at zAt; radAt: where the roaming radius is stored, else rad
export function spotAt(id, list, stride, see, o = {}) {
  const n = Math.floor(list.length / stride); if (!n || !id) return;
  const xz = new Float32Array(n * 2), rad = new Float32Array(n), xAt = o.xAt ?? 0, zAt = o.zAt ?? 1;
  for (let i = 0; i < n; i++) { xz[i * 2] = list[i * stride + xAt]; xz[i * 2 + 1] = list[i * stride + zAt]; rad[i] = o.radAt != null ? Math.min(Math.abs(list[i * stride + o.radAt]) || 0, 400) : (o.rad || 10); }
  SPOT.src.push({ id, xz, rad, n, see, data: Float32Array.from(list), stride, move: o.move || 'home' });
}

// where one of them is right now (the same motion the shaders give it), for the frame and the turn of the view: t is the map's clock, sea the water level in
// world metres, ground(x, z) the world height of the ground, out a THREE.Vector3
export function entryPos(s, i, t, sea, vex, ground, out) {
  const d = s.data, k = i * s.stride, x = d[k], z = d[k + 1];
  if (s.move === 'swim') { const r0 = d[k + 2], b = d[k + 7], way = b < 0.5 ? 1 : -1, ang = d[k + 4] + t * d[k + 5] / r0 * way, rr = r0 * (1 + 0.25 * Math.sin(ang * 3 + b * 9)); return out.set(x + Math.cos(ang) * rr, sea - d[k + 3] * vex, z + Math.sin(ang) * rr); }
  if (s.move === 'afloat') { const r = d[k + 2], w = d[k + 3], ang = w * 40 + t * 0.22 / r * (w < 0.5 ? 1 : -1); return out.set(x + Math.cos(ang) * r, sea + 0.4, z + Math.sin(ang) * r); }
  if (s.move === 'fly8') { const ang = d[k + 4] + t * d[k + 5] / d[k + 3]; return out.set(x + Math.cos(ang) * d[k + 3], d[k + 1] + Math.sin(ang * 2 + d[k + 4]) * d[k + 3] * 0.06, d[k + 2] + Math.sin(ang) * d[k + 3] * 0.8); }          // (x, alt, z, radius, phase, speed)
  if (s.move === 'jelly') return out.set(x, sea - d[k + 2] * vex, z);          // (x, z, depth)
  return out.set(x, ground(x, z) + 0.4, z);
}

// swimmers (creatures.js swimmers): by the name the map gives each school; [x, z, swim circle, ...] per animal
const SWIM = { bream: 'bream', blue: 'baitfish', stripey: 'sergeant', neon: 'neon', humbug: 'humbug', small: 'hardyhead', whiting: 'whiting', flathead: 'flathead', turtles: 'greenturtle', rays: 'maskray', wreckrays: 'maskray', shovelnose: 'shovelnose', bigsharks: 'tigershark', sharks: 'whaler', dolphins: 'dolphin', dugongs: 'dugong', whales: 'humpback',
  tailor: 'tailor', dart: 'dart', trevally: 'trevally', jewfish: 'jewfish', longtom: 'longtom', tarwhine: 'tarwhine', snapper: 'snapper', squire: 'squire', sweetlip: 'sweetlip', cod: 'cod', moses: 'moses', tuskfish: 'tusk', morwong: 'morwong', moray: 'moray', fry: 'baitfish', chromis: 'neon', sergeants: 'sergeant', reefbream: 'bream' };
const SEE_SWIM = { baitfish: 30, hardyhead: 25, whiting: 25, neon: 25, humbug: 25, sergeant: 30, dart: 30, longtom: 35, bream: 45, tailor: 45, tarwhine: 40, squire: 35, moses: 40, flathead: 30, tusk: 40, morwong: 40, moray: 30, sweetlip: 50, cod: 45, trevally: 60, jewfish: 70, snapper: 60, greenturtle: 110, maskray: 70, shovelnose: 80, whaler: 130, tigershark: 160, dolphin: 260, dugong: 220, humpback: 900 };
export function spotSwim(name, list, stride) { const id = SWIM[name]; if (id) spotAt(id, list, stride, SEE_SWIM[id] || 50, { radAt: 2, move: 'swim' }); }
// swimmers whose list is filled again as the view moves (creatures.js swimmersLive): room for cap of them; set(list, n) puts the new ones in
export function spotLive(name, cap) {
  const id = SWIM[name]; if (!id) return null;
  const s = { id, xz: new Float32Array(cap * 2), rad: new Float32Array(cap), n: 0, see: SEE_SWIM[id] || 50, data: new Float32Array(cap * 8), stride: 8, move: 'swim' }; SPOT.src.push(s);
  return { set(list, n) { s.n = n; for (let i = 0; i < n; i++) { s.xz[i * 2] = list[i * 8]; s.xz[i * 2 + 1] = list[i * 8 + 1]; s.rad[i] = Math.min(Math.abs(list[i * 8 + 2]) || 0, 400); } for (let i = 0; i < n * 8; i++) s.data[i] = list[i]; } };
}

// birds on foot (wildbirds.js walkers): [x, z, turn, phase]
const WALK = { oystercatchers: ['oystercatcher', 140], curlews: ['curlew', 220], godwits: ['godwit', 200], stonecurlews: ['stonecurlew', 120], bushcurlews: ['bushcurlew', 120], cormorants: ['greatcormorant', 180], cormorantsdry: ['greatcormorant', 180] };
export function spotWalk(name, list) { const w = WALK[name]; if (w) spotAt(w[0], list, 4, w[1], { rad: 20 }); }

// reptiles and mammals (wildland.js critters): [x, z, turn, phase, y]
const CRIT = { waterdragons: ['waterdragon', 35], majorskinks: ['majorskink', 25], landmullets: ['landmullet', 30], gardenskinks: ['gardenskink', 15], leglesslizards: ['legless', 18], pythons: ['python', 40], treesnakes: ['treesnake', 25], blacksnakes: ['blacksnake', 30], whipsnakes: ['whipsnake', 25], turtles: ['turtle', 45],
  bandicoots: ['bandicoot', 40], longnoses: ['longnose', 40], brushtails: ['brushtail', 55], ringtails: ['ringtail', 45], waterrats: ['waterrat', 35] };
export function spotCritter(name, list) { const c = CRIT[name]; if (c) spotAt(c[0], list, 5, c[1], { rad: 14 }); }

// sea bed animals (seabed.js): crabs [x, z, phase, size, face, run, rate, tint] and octopuses the same
export function spotSeabed(crabs, octos) {
  const by = [[], [], []];
  for (let i = 0; i + 8 <= crabs.length; i += 8) by[crabs[i + 7] < 0.35 ? 0 : crabs[i + 7] < 0.7 ? 1 : 2].push(...crabs.slice(i, i + 8));
  ['sandcrab', 'bluecrab', 'rockcrab'].forEach((id, k) => spotAt(id, by[k], 8, 22, { rad: 4 }));
  spotAt('octopus', octos, 8, 22, { rad: 6 });
}

// what has been spotted so far, and which achievements are unlocked: kept in this browser (or this program's own data folder)
export const seen = (() => {
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }, save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not kept then */ } };
  let m = load('moreton:spotted'), a = load('moreton:achievements'); const L = [];
  return { has: (id) => id in m, all: () => m, ach: () => a, on: (f) => L.push(f),
    add(id) { if (id in m) return false; m[id] = Date.now(); save('moreton:spotted', m); for (const f of L) f(id); return true; },
    unlock(id) { if (id in a) return false; a[id] = Date.now(); save('moreton:achievements', a); return true; },
    reset() { m = {}; a = {}; save('moreton:spotted', m); save('moreton:achievements', a); for (const f of L) f(null); } };
})();

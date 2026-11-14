// Sharp aerial photography near the view: 512 px tiles (about 2.1 m per pixel) are streamed
// into one window texture that follows the camera target; the terrain shader lays it over the base colour.
import * as THREE from 'three';
import { U, MOBILE, Q } from './common.js';

export function buildDetail(F) {
  const N = +(Q.get('dn') || (MOBILE ? 4 : 8)), TS = 512, size = N * TS;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 8;
  U.uDetail.value = tex;
  const have = new Set(F.tiles || []), cache = new Map(), queue = [];
  let ox = null, oy = null, dirty = false, last = 0, active = 0, fade = 0;
  const inWin = (tx, ty) => ox !== null && tx >= ox && tx < ox + N && ty >= oy && ty < oy + N;
  const draw = (tx, ty, bmp) => { g.drawImage(bmp, (tx - ox) * TS, (ty - oy) * TS); dirty = true; };
  function pump() {
    while (active < 6 && queue.length) {
      const [tx, ty] = queue.shift(), key = tx + ',' + ty;
      if (cache.has(key) || !inWin(tx, ty)) continue;
      cache.set(key, null); active++;
      fetch(`tiles/15/${tx}/${ty}.jpg`).then(r => r.blob()).then(b => createImageBitmap(b)).then((bmp) => {
        cache.set(key, bmp); if (inWin(tx, ty)) draw(tx, ty, bmp);
        if (cache.size > 150) for (const [k, v] of cache) { const [a, b2] = k.split(',').map(Number); if (v && !inWin(a, b2)) { v.close(); cache.delete(k); if (cache.size <= 110) break; } }
      }).catch(() => cache.delete(key)).finally(() => { active--; pump(); });
    }
  }
  function recentre(nx, ny, fx, fy) {
    ox = nx; oy = ny; g.clearRect(0, 0, size, size); queue.length = 0;
    const want = [];
    for (let ty = oy; ty < oy + N; ty++) for (let tx = ox; tx < ox + N; tx++) {
      const key = tx + ',' + ty; if (!have.has(key)) continue;
      const bmp = cache.get(key); if (bmp) draw(tx, ty, bmp); else if (bmp === undefined) want.push([tx, ty, Math.hypot(tx + .5 - fx, ty + .5 - fy)]);
    }
    want.sort((a, b) => a[2] - b[2]); queue.push(...want); dirty = true; last = -1;
    U.uDetRect.value.set(F.tx0 + (ox - F.tile0[0]) * F.tsize, F.tz0 + (oy - F.tile0[1]) * F.tsize, 1 / (N * F.tsize), U.uDetRect.value.w);
    pump();
  }
  return {
    update(target, camDist, t, dt) {
      const on = camDist < 13000 && have.size > 0;
      if (on) {
        const fx = (target.x - F.tx0) / F.tsize + F.tile0[0], fy = (target.z - F.tz0) / F.tsize + F.tile0[1];
        if (ox === null || Math.abs(fx - (ox + N / 2)) > N / 4 || Math.abs(fy - (oy + N / 2)) > N / 4) recentre(Math.round(fx - N / 2), Math.round(fy - N / 2), fx, fy);
      }
      fade += ((on ? 1 : 0) - fade) * Math.min(1, dt * 2); U.uDetRect.value.w = fade;
      if (dirty && t - last > 0.3) { tex.needsUpdate = true; dirty = false; last = t; }
    },
  };
}

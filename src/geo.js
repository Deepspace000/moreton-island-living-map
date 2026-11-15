// Small geometry builder for vertex-coloured models (buildings, wrecks, boats, beacons).
import * as THREE from 'three';
import { makeMat, LOGV, LOGF } from './common.js';

const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), Nn = new THREE.Vector3(), P = new THREE.Vector3();
export class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.f = []; this.i = []; this.m = null; }
  at(m) { this.m = m; return this; }
  _v(pt, n, col, fx) {
    P.set(pt[0], pt[1], pt[2]); if (this.m) P.applyMatrix4(this.m);
    this.p.push(P.x, P.y, P.z); this.n.push(n.x, n.y, n.z); this.c.push(col[0], col[1], col[2]);
    this.f.push(fx ? fx[0] : 0, fx ? fx[1] : 0, fx ? fx[2] : 0);
  }
  _nrm(a, b, c) {
    A.set(...a); B.set(...b); C.set(...c);
    if (this.m) { A.applyMatrix4(this.m); B.applyMatrix4(this.m); C.applyMatrix4(this.m); }
    Nn.copy(B).sub(A).cross(C.sub(A)); if (Nn.lengthSq() < 1e-12) Nn.set(0, 1, 0); return Nn.normalize().clone();
  }
  tri(a, b, c, col, fa, fb, fc) { const k = this.p.length / 3, n = this._nrm(a, b, c); this._v(a, n, col, fa); this._v(b, n, col, fb); this._v(c, n, col, fc); this.i.push(k, k + 1, k + 2); }
  quad(a, b, c, d, col, fa, fb, fc, fd) {
    const k = this.p.length / 3, n = this._nrm(a, b, d);
    this._v(a, n, col, fa); this._v(b, n, col, fb); this._v(c, n, col, fc); this._v(d, n, col, fd); this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  // quad with per-corner colours
  quadC(a, b, c, d, ca, cb, cc, cd) {
    const k = this.p.length / 3, n = this._nrm(a, b, d);
    this._v(a, n, ca); this._v(b, n, cb); this._v(c, n, cc); this._v(d, n, cd); this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  box(cx, cy, cz, sx, sy, sz, col, top) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy, y1 = cy + sy, z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top || col);
  }
  cyl(cx, y0, cz, r0, r1, h, seg, col, cap) {
    for (let s = 0; s < seg; s++) {
      const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quad([cx + c0 * r0, y0, cz + s0 * r0], [cx + c1 * r0, y0, cz + s1 * r0], [cx + c1 * r1, y0 + h, cz + s1 * r1], [cx + c0 * r1, y0 + h, cz + s0 * r1], col);
      if (cap) this.tri([cx, y0 + h, cz], [cx + c0 * r1, y0 + h, cz + s0 * r1], [cx + c1 * r1, y0 + h, cz + s1 * r1], cap);
    }
  }
  // a rainwater tank: a smooth round wall of corrugated iron (ribs run round it) under a low domed lid
  tank(cx, y0, cz, r, h, seg, col, K = 1) {
    const k = this.p.length / 3, lid = [col[0] * .88, col[1] * .88, col[2] * .88], rise = 0.16 * r * K;
    for (let s = 0; s <= seg; s++) {
      const a = s / seg * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), n = { x: c, y: 0, z: sn }, nl = { x: c * 0.3, y: 0.95, z: sn * 0.3 };
      this._v([cx + c * r, y0, cz + sn * r], n, col, [-1, 0, 2 + a * r]); this._v([cx + c * r, y0 + h, cz + sn * r], n, col, [-1, h / K, 2 + a * r]);
      this._v([cx + c * r * 1.02, y0 + h, cz + sn * r * 1.02], nl, lid); this._v([cx + c * r * 0.12, y0 + h + rise, cz + sn * r * 0.12], { x: 0, y: 1, z: 0 }, lid);
      if (s < seg) { const q = k + s * 4; this.i.push(q, q + 4, q + 5, q, q + 5, q + 1, q + 2, q + 6, q + 7, q + 2, q + 7, q + 3); }
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aFx', new THREE.Float32BufferAttribute(this.f, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// Night lights as glowing points: {pos:[x,y,z], col:[r,g,b], period, duty, phase, size}
export function makeLights(n) {
  const g = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  const par = new THREE.BufferAttribute(new Float32Array(n * 4), 4);       // period, duty, phase, size
  g.setAttribute('position', pos); g.setAttribute('color', col); g.setAttribute('aPar', par);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = makeMat({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uPx: { value: 1 }, uAlways: { value: 0 } },
    vs: /* glsl */`
      attribute vec4 aPar; uniform float uPx, uAlways; varying vec3 vC; varying float vA;
      void main(){
        vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
        float on = aPar.x <= 0.0 ? 1.0 : step(fract(uTime / aPar.x + aPar.z), aPar.y);
        float flick = aPar.x < 0.0 ? 0.75 + 0.25 * sin(uTime * 9.0 + aPar.z * 40.0) * sin(uTime * 13.7 + aPar.z * 9.0) : 1.0;
        float d = -mv.z;
        float s = aPar.w * uPx * 900.0 / d;
        vA = on * flick * max(uNight, uAlways) * clamp(s / 1.6, 0.0, 1.0) * (1.0 - fogAmount((modelMatrix * vec4(position, 1.0)).xyz));
        gl_PointSize = clamp(s, 1.6, 26.0 * uPx);
        vC = color;
        gl_Position = projectionMatrix * mv;
        ${LOGV}
      }`,
    fs: /* glsl */`
      varying vec3 vC; varying float vA;
      void main(){ ${LOGF} vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; float g = exp(-r * r * 5.0) + 0.35 * exp(-r * 2.2); if(r > 1.0) discard; gl_FragColor = vec4(vC * g * vA * 2.6, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 50;
  let k = 0;
  return {
    pts, pos,
    add(p, c, period = 0, duty = 1, phase = 0, size = 1) { pos.setXYZ(k, p[0], p[1], p[2]); col.setXYZ(k, c[0], c[1], c[2]); par.setXYZW(k, period, duty, phase, size); g.setDrawRange(0, k + 1); return k++; },
    move(i, x, y, z) { pos.setXYZ(i, x, y, z); pos.needsUpdate = true; },
  };
}

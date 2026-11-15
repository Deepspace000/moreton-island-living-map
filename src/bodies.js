// Bodies with real proportions: people, wallabies, goannas and skinks. Each is built from smooth limbs (a run of oval cross-sections along a
// curve, with true normals), and each has a painted surface worked out per pixel from where on the body the pixel is: cloth, skin, hair and a
// face for people; fur for the wallaby; banded and spotted scales for the lizards.
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
const H = Math.hypot;

export class Loft {
  constructor() { this.pos = []; this.nrm = []; this.part = []; this.swing = []; this.idx = []; }
  // A limb through the stations st: [x, y, z, half-width, half-depth]. The half-width lies along ref (by default across the body, z), the
  // half-depth at right angles to it. The run is smoothed between stations; the ends are closed with rounded caps. sw(y) gives the swing weight.
  limb(st, part, { S = 12, sub = 4, ref = [0, 0, 1], sw = null } = {}) {
    const m = st.length - 1, P = (j) => st[Math.max(0, Math.min(m, j))], pts = [];
    for (let i = 0; i <= m * sub; i++) { const f = i / sub, k = Math.min(m - 1, Math.floor(f)), t = f - k, q = [0, 1, 2, 3, 4].map(c => cr(P(k - 1)[c], P(k)[c], P(k + 1)[c], P(k + 2)[c], t)); q[3] = Math.max(q[3], 0.0015); q[4] = Math.max(q[4], 0.0015); pts.push(q); }
    const n = pts.length, base = this.pos.length / 3, frames = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = H(...t) || 1; t = t.map(v => v / tl);
      const d = ref[0] * t[0] + ref[1] * t[1] + ref[2] * t[2]; let sd = [ref[0] - t[0] * d, ref[1] - t[1] * d, ref[2] - t[2] * d]; const sl = H(...sd) || 1; sd = sd.map(v => v / sl);
      const up = [t[1] * sd[2] - t[2] * sd[1], t[2] * sd[0] - t[0] * sd[2], t[0] * sd[1] - t[1] * sd[0]]; frames.push([t, sd, up]);
      const c = pts[i];
      for (let j = 0; j < S; j++) {
        const an = j / S * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
        this.pos.push(c[0] + sd[0] * ca * c[3] + up[0] * sa * c[4], c[1] + sd[1] * ca * c[3] + up[1] * sa * c[4], c[2] + sd[2] * ca * c[3] + up[2] * sa * c[4]);
        let nx = sd[0] * ca / c[3] + up[0] * sa / c[4], ny = sd[1] * ca / c[3] + up[1] * sa / c[4], nz = sd[2] * ca / c[3] + up[2] * sa / c[4]; const nl = H(nx, ny, nz) || 1;
        this.nrm.push(nx / nl, ny / nl, nz / nl); this.part.push(part); this.swing.push(sw ? sw(c[1], c) : 0);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < S; j++) { const q = base + i * S, j2 = (j + 1) % S; this.idx.push(q + j, q + S + j, q + j2, q + j2, q + S + j, q + S + j2); }
    for (const [i, sg] of [[0, -1], [n - 1, 1]]) {            // caps: a point pushed out a little along the limb, so the end is domed
      const c = pts[i], t = frames[i][0], bulge = Math.min(c[3], c[4]) * 0.6, k = this.pos.length / 3;
      this.pos.push(c[0] + t[0] * sg * bulge, c[1] + t[1] * sg * bulge, c[2] + t[2] * sg * bulge); this.nrm.push(t[0] * sg, t[1] * sg, t[2] * sg); this.part.push(part); this.swing.push(sw ? sw(c[1], c) : 0);
      for (let j = 0; j < S; j++) this.idx.push(k, base + i * S + j, base + i * S + (j + 1) % S);
    }
    return this;
  }
}

// ---------------------------------------------------------------- a person
// About 1.79 tall as built (it is scaled a little per person): x forward, y up, z to their right. Parts: 0 shirt, 1 legs (trousers or shorts
// over bare legs: the paint decides), 2 skin (head, neck, arms, hands), 3 hat, 4 fishing rod, 9 hair, 10 shoes. (5 to 8 are the traveller's kit.)
export function human() {
  const m = new Loft();
  m.limb([[0, 0.855, 0, 0.176, 0.12], [0, 0.95, 0, 0.176, 0.118], [0.005, 1.08, 0, 0.143, 0.1], [0.015, 1.25, 0, 0.16, 0.116], [0.01, 1.38, 0, 0.172, 0.108], [0, 1.45, 0, 0.15, 0.086], [0, 1.49, 0, 0.068, 0.064]], 0, { S: 14 });      // hips, waist, chest, shoulders, collar
  m.limb([[0, 1.46, 0, 0.055, 0.056], [0.005, 1.56, 0, 0.05, 0.053]], 2, { S: 10, sub: 2 });                                                                                              // neck
  m.limb([[0.015, 1.532, 0, 0.04, 0.046], [0.02, 1.572, 0, 0.07, 0.084], [0.015, 1.63, 0, 0.081, 0.098], [0.01, 1.69, 0, 0.084, 0.102], [0, 1.74, 0, 0.077, 0.095], [-0.005, 1.776, 0, 0.05, 0.064], [-0.005, 1.79, 0, 0.014, 0.018]], 2, { S: 14 });      // head: chin, jaw, cheek, brow, crown
  m.limb([[0.1, 1.672, 0, 0.011, 0.014], [0.122, 1.648, 0, 0.015, 0.014], [0.108, 1.628, 0, 0.017, 0.01]], 2, { S: 8, sub: 3 });                                                           // nose
  for (const sg of [-1, 1]) m.limb([[0.0, 1.648, 0.08 * sg, 0.008, 0.016], [-0.005, 1.67, 0.088 * sg, 0.01, 0.022], [-0.008, 1.695, 0.082 * sg, 0.007, 0.014]], 2, { S: 8, sub: 3, ref: [1, 0, 0] });      // ears
  m.limb([[-0.022, 1.63, 0, 0.087, 0.096], [-0.016, 1.71, 0, 0.091, 0.106], [0.002, 1.766, 0, 0.081, 0.099], [-0.004, 1.802, 0, 0.05, 0.062], [-0.006, 1.812, 0, 0.012, 0.016]], 9, { S: 14 });      // hair: low at the back and sides, coming forward over the top to a hairline above the brow
  m.limb([[0, 1.738, 0, 0.215, 0.215], [0, 1.748, 0, 0.19, 0.19], [0, 1.766, 0, 0.1, 0.108]], 3, { S: 16, sub: 2 });                                                                                                   // hat brim
  m.limb([[0, 1.755, 0, 0.098, 0.108], [0, 1.82, 0, 0.092, 0.102], [0, 1.848, 0, 0.06, 0.07]], 3, { S: 14 });                                                                               // hat crown
  for (const sg of [-1, 1]) {
    const z = 0.085 * sg, legSw = (y) => sg * (0.02 + Math.max(0, 0.93 - y) / 0.9), armSw = (y) => -sg * (0.02 + Math.max(0, 1.42 - y) / 0.55);
    m.limb([[0, 0.94, z, 0.078, 0.08], [0.005, 0.74, z, 0.075, 0.086], [0.012, 0.51, z, 0.052, 0.058], [-0.006, 0.36, z, 0.052, 0.061], [-0.01, 0.13, z, 0.035, 0.04], [-0.01, 0.06, z, 0.036, 0.042]], 1, { sw: legSw });       // thigh, knee, calf, ankle
    m.limb([[-0.075, 0.036, z, 0.036, 0.034], [0.02, 0.042, z, 0.047, 0.04], [0.125, 0.032, z, 0.05, 0.03], [0.185, 0.024, z, 0.034, 0.02]], 10, { sw: legSw, S: 10 });                                                    // shoe
    m.limb([[0, 1.45, 0.13 * sg, 0.045, 0.05], [0, 1.42, 0.168 * sg, 0.052, 0.058], [0, 1.3, 0.195 * sg, 0.046, 0.052], [0.012, 1.15, 0.205 * sg, 0.039, 0.043], [0.04, 1.0, 0.205 * sg, 0.034, 0.038], [0.068, 0.885, 0.2 * sg, 0.027, 0.03]], 2, { sw: armSw, S: 10 });   // upper arm, elbow, forearm, wrist
    m.limb([[0.074, 0.86, 0.2 * sg, 0.02, 0.036], [0.086, 0.79, 0.196 * sg, 0.019, 0.042], [0.094, 0.735, 0.192 * sg, 0.012, 0.026]], 2, { sw: armSw, S: 8, sub: 3 });                                                       // hand
  }
  m.limb([[0.1, 0.95, 0.195, 0.012, 0.012], [1.2, 1.9, 0.195, 0.009, 0.009], [2.4, 3.0, 0.195, 0.004, 0.004]], 4, { S: 6, sub: 3 });                                                        // rod, held by those who fish
  return m;
}
// How a person moves when they walk: the thigh swings from the hip, the shin folds back at the knee as the leg comes forward, the arms swing
// from the shoulder against the legs, and the whole body rises and falls with each step. ph is the phase of the stride, w how much they are walking.
export const PERSON_POSE = /* glsl */`
vec3 personPose(vec3 p, vec2 ps, float ph, float w){
  float part = ps.x, sw = ps.y, st = sin(ph) * w; vec3 lp = p;
  if((part > 0.5 && part < 1.5) || (part > 9.5 && part < 10.5)){
    float sg = sign(sw), a = st * sg * 0.48, bend = (max(0.0, cos(ph) * sg) * 0.95 + 0.06) * w;
    vec2 q = vec2(p.x, p.y - 0.93);
    if(p.y < 0.52){ vec2 k = q - vec2(0.01, -0.42); float cb = cos(bend), sb = sin(bend); q = vec2(k.x * cb + k.y * sb, -k.x * sb + k.y * cb) + vec2(0.01, -0.42); }
    float c = cos(a), s = sin(a); q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
    lp.x = q.x; lp.y = q.y + 0.93;
  } else if(abs(sw) > 0.001){
    float a = st * sign(sw) * 0.42; vec2 q = vec2(p.x, p.y - 1.42);
    if(p.y < 1.13 && part < 2.5){        // nobody's arms hang ruler-straight: the elbow is always a little bent, more as the arm swings forward
      float eb = 0.2 + 0.3 * w + 0.35 * max(0.0, st * sign(sw)), ce = cos(eb), se = sin(eb); vec2 k = q - vec2(0.0, -0.29);
      q = vec2(k.x * ce - k.y * se, k.x * se + k.y * ce) + vec2(0.0, -0.29); }
    float c = cos(a), s = sin(a); q = vec2(q.x * c - q.y * s, q.x * s + q.y * c); lp.x = q.x; lp.y = q.y + 1.42;
  }
  lp.y += abs(cos(ph)) * 0.022 * w;
  return lp;
}`;
// What a person looks like, pixel by pixel. p is the point on the body as built (before it moved), seed says who this is.
export const PERSON_PAINT = /* glsl */`
vec3 personColour(vec3 p, float part, vec3 shirt, float seed){
  float h1 = fract(seed * 3.3), h2 = fract(seed * 5.9), h3 = fract(seed * 9.7), h4 = fract(seed * 13.1), ang = atan(p.z, p.x);
  vec3 skin = mix(mix(vec3(0.80, 0.57, 0.44), vec3(0.66, 0.43, 0.29), smoothstep(0.25, 0.6, h2)), vec3(0.36, 0.23, 0.16), smoothstep(0.72, 0.95, h2));
  vec3 hair = h4 < 0.3 ? vec3(0.05, 0.04, 0.035) : h4 < 0.6 ? vec3(0.17, 0.1, 0.06) : h4 < 0.8 ? vec3(0.42, 0.3, 0.16) : vec3(0.5, 0.5, 0.5);
  float fold = texture2D(uNoise, vec2(ang * 0.55, p.y * 1.6) + h1).g, weave = texture2D(uNoise, vec2(ang * 5.0, p.y * 28.0)).r, fine = texture2D(uNoise, p.yz * 23.0 + p.x * 17.0).b;
  // the shirt's cloth: plain, hooped, or checked; creased, with a darker collar and hem
  vec3 cloth = shirt;
  if(h3 > 0.72) cloth *= 0.78 + 0.22 * step(0.5, fract(p.y * 16.0));
  else if(h3 > 0.5) cloth = mix(cloth, cloth * 0.55 + 0.1, 0.55 * step(0.5, fract(p.y * 13.0)) + 0.45 * step(0.5, fract(ang * 2.6)));
  cloth *= (0.8 + 0.3 * fold) * (0.93 + 0.12 * weave);
  vec3 col = skin;
  if(part < 0.5){
    col = cloth * (1.0 - 0.22 * smoothstep(1.452, 1.47, p.y)) * (1.0 - 0.15 * (1.0 - smoothstep(0.86, 0.885, p.y)));
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.003, 0.009, abs(p.z))) * step(0.02, p.x) * step(1.3, p.y) * step(h3, 0.5);           // the opening of a buttoned shirt
  } else if(part < 1.5){
    float shorts = step(0.14, h1), hem = mix(0.11, 0.55 + 0.12 * h3, shorts);        // this is a beach: nearly everyone is in shorts
    vec3 tr = h1 < 0.14 ? mix(vec3(0.15, 0.19, 0.3), vec3(0.3, 0.29, 0.25), h3) : h1 < 0.45 ? vec3(0.5, 0.46, 0.36) : h1 < 0.7 ? mix(vec3(0.1, 0.25, 0.4), vec3(0.2, 0.2, 0.22), h3) : mix(vec3(0.08, 0.3, 0.32), vec3(0.55, 0.16, 0.12), h3);
    if(h1 > 0.7){ vec2 fl = fract(vec2(ang * 2.2, p.y * 14.0) + h3) - 0.5; tr = mix(tr, vec3(0.85, 0.8, 0.6), (1.0 - smoothstep(0.12, 0.2, length(fl))) * 0.8); }      // board shorts with a flower print
    tr *= (0.78 + 0.3 * fold) * (0.92 + 0.14 * weave) * (1.0 - 0.2 * (1.0 - smoothstep(hem, hem + 0.02, p.y)));
    col = p.y > hem ? tr : skin * (0.92 + 0.1 * fine) * (1.0 - 0.12 * (1.0 - smoothstep(0.004, 0.02, abs(p.y - 0.51))));         // bare legs, a shadow at the knee
  } else if(part < 2.5){
    bool arm = abs(p.z) > 0.06 && p.y < 1.48;
    float cuff = h4 > 0.82 ? 0.9 : 1.22 + 0.06 * h3;
    if(arm && p.y > cuff) col = cloth * (1.0 - 0.2 * (1.0 - smoothstep(cuff, cuff + 0.02, p.y)));                               // the sleeve
    else col = skin * (0.93 + 0.1 * fine);
    if(!arm && p.y > 1.53){                                                                                                    // the face
      float front = smoothstep(0.03, 0.06, p.x), az = abs(p.z);
      float eye = 1.0 - smoothstep(0.007, 0.012, length(vec2(az - 0.033, (p.y - 1.69) * 1.5)));
      float white = 1.0 - smoothstep(0.009, 0.013, length(vec2((az - 0.033) * 0.7, (p.y - 1.69) * 1.9)));
      col = mix(col, vec3(0.74, 0.71, 0.67), white * front * 0.7); col = mix(col, vec3(0.06, 0.045, 0.04), eye * front);
      float brow = (1.0 - smoothstep(0.003, 0.007, abs(p.y - 1.717 + (az - 0.034) * (az - 0.034) * 7.0))) * step(0.014, az) * step(az, 0.056);        // a gentle arch
      col = mix(col, hair * 0.7, brow * front * 0.85);
      float mouth = (1.0 - smoothstep(0.003, 0.007, abs(p.y - 1.6 - az * az * 3.0))) * step(az, 0.03);
      col = mix(col, vec3(0.42, 0.19, 0.17), mouth * front * 0.85);
      col *= 1.0 - 0.14 * front * smoothstep(1.66, 1.7, p.y) * (1.0 - smoothstep(1.7, 1.715, p.y)) * step(az, 0.06);              // the eye sockets sit in shadow
      col = mix(col, skin * vec3(1.12, 0.86, 0.84), 0.3 * front * (1.0 - smoothstep(0.015, 0.035, length(vec2(az - 0.05, p.y - 1.635)))));   // colour in the cheeks
      float beard = step(0.78, h3) * step(fract(seed * 7.1), 0.5) * step(0.13, fract(seed * 17.3)) * (1.0 - smoothstep(1.6, 1.635, p.y)) * smoothstep(0.0, 0.03, p.x) * (1.0 - mouth);      // men only
      col = mix(col, hair * (0.7 + 0.5 * fine), beard * 0.85);
    }
  } else if(part < 3.5){
    float straw = step(0.5, fract(ang * 9.0 + p.y * 40.0)) * 0.5 + step(0.5, fract(length(p.xz) * 60.0)) * 0.5;
    col = mix(vec3(0.66, 0.58, 0.38), vec3(0.2, 0.26, 0.22), step(0.6, h4)) * (0.78 + 0.26 * straw);
    col *= 1.0 - 0.45 * (1.0 - smoothstep(0.006, 0.014, abs(p.y - 1.775))) * step(p.y, 1.8);                                      // the band round the crown
  } else if(part < 4.5) col = vec3(0.09, 0.09, 0.1);
  else if(part < 5.5){                                                                                                           // the pack: canvas, a lid, two straps and a pocket
    col = vec3(0.1, 0.24, 0.19) * (0.8 + 0.3 * weave);
    col *= 1.0 - 0.35 * (1.0 - smoothstep(0.006, 0.014, abs(p.y - 1.4))); col = mix(col, vec3(0.05, 0.05, 0.05), (1.0 - smoothstep(0.012, 0.02, abs(abs(p.z) - 0.09))) * step(p.x, -0.3));
    col = mix(col, col * 0.7, step(1.0, p.y) * step(p.y, 1.2) * step(abs(p.z), 0.1) * step(p.x, -0.36));
  } else if(part < 6.5) col = vec3(0.22, 0.22, 0.24);
  else if(part < 7.5) col = vec3(0.16, 0.26, 0.5) * (0.75 + 0.35 * step(0.5, fract(p.z * 22.0)));
  else if(part < 8.5) col = vec3(0.62, 0.68, 0.74);
  else if(part < 9.5) col = hair * (0.65 + 0.7 * texture2D(uNoise, vec2(ang * 3.0, p.y * 4.0)).r);
  else if(h4 < 0.55){ col = skin * (0.92 + 0.1 * fine);                                                                          // bare feet, or thongs: a sole and a strap
    if(h4 > 0.25){ if(p.y < 0.02) col = vec3(0.12, 0.12, 0.13); col = mix(col, vec3(0.1, 0.25, 0.5), (1.0 - smoothstep(0.008, 0.014, abs(p.x - 0.07 - abs(abs(p.z) - 0.085) * 1.6))) * step(0.03, p.y)); } }
  else col = p.y < 0.022 ? vec3(0.6, 0.58, 0.52) : mix(vec3(0.75, 0.74, 0.7), vec3(0.3, 0.2, 0.12), step(0.55, h3)) * (0.85 + 0.25 * fine);    // sandshoes or boots, a pale sole
  return col;
}`;

// ---------------------------------------------------------------- wallaby
// Parts (the mover knows them by number): 0 body, 1 forearms, 2 hind legs, 3 tail, 4 head and ears. x forward, y up; about 0.86 high as built.
export function wallaby() {
  const m = new Loft(), UP = [0, 0, 1];
  m.limb([[-0.33, 0.3, 0, 0.1, 0.12], [-0.17, 0.33, 0, 0.158, 0.185], [0.04, 0.4, 0, 0.142, 0.17], [0.2, 0.48, 0, 0.108, 0.128], [0.3, 0.565, 0, 0.074, 0.084], [0.37, 0.635, 0, 0.058, 0.064]], 0, { S: 14, ref: UP });       // rump, haunch, belly, chest, neck
  m.limb([[0.33, 0.655, 0, 0.05, 0.056], [0.4, 0.672, 0, 0.058, 0.062], [0.46, 0.66, 0, 0.045, 0.048], [0.51, 0.642, 0, 0.03, 0.032], [0.535, 0.634, 0, 0.016, 0.018]], 4, { S: 12, ref: UP });                               // skull to muzzle
  m.limb([[-0.3, 0.27, 0, 0.085, 0.085], [-0.56, 0.16, 0, 0.06, 0.06], [-0.82, 0.07, 0, 0.04, 0.04], [-1.06, 0.036, 0, 0.022, 0.022], [-1.22, 0.03, 0, 0.008, 0.008]], 3, { S: 10, ref: UP });                                   // the long heavy tail
  for (const sg of [-1, 1]) {
    m.limb([[0.385, 0.705, 0.034 * sg, 0.02, 0.011], [0.37, 0.765, 0.056 * sg, 0.038, 0.009], [0.36, 0.808, 0.062 * sg, 0.02, 0.006]], 4, { S: 8, sub: 3, ref: [1, 0, 0] });                                                // ears
    const z = 0.125 * sg;
    m.limb([[-0.17, 0.33, z * 0.9, 0.068, 0.112], [0.0, 0.175, z * 1.1, 0.05, 0.066], [-0.1, 0.075, z * 1.12, 0.03, 0.036], [0.02, 0.03, z * 1.12, 0.027, 0.022], [0.21, 0.022, z * 1.12, 0.024, 0.016]], 2, { S: 10 });          // thigh, shin, hock, the long foot
    m.limb([[0.2, 0.44, z * 0.72, 0.03, 0.036], [0.27, 0.325, z * 0.8, 0.022, 0.024], [0.305, 0.245, z * 0.8, 0.015, 0.017]], 1, { S: 8, sub: 3 });                                                                            // forearm and paw
  }
  return m;
}
export const WALLABY_PAINT = /* glsl */`
  { vec3 p = vObj; float fur = texture2D(uNoise, vec2(p.x * 2.2 + p.y * 1.5, p.z * 13.0 + p.y * 17.0)).r, fine = texture2D(uNoise, vec2(p.x * 31.0, p.y * 43.0 + p.z * 37.0)).g;
    vec3 back = mix(vec3(0.15, 0.125, 0.105), vec3(0.2, 0.165, 0.135), vH.w), belly = vec3(0.5, 0.27, 0.12), rufous = vec3(0.42, 0.2, 0.1);        // a swamp wallaby: dark grey-brown above, rusty below
    float under = 1.0 - smoothstep(-0.75, -0.25, normalize(vNo).y);
    c = mix(back, belly, under * 0.9);
    c = mix(c, rufous, 0.5 * (1.0 - smoothstep(0.08, 0.2, abs(p.x - 0.27))) * step(0.42, p.y) * (1.0 - under));                  // rusty round the neck and the base of the ears
    if(vK > 0.5 && vK < 2.5) c = mix(c, vec3(0.045, 0.04, 0.035), 1.0 - smoothstep(0.04, 0.2, p.y - (vK < 1.5 ? 0.22 : 0.0)));    // black paws and feet
    if(vK > 2.5 && vK < 3.5) c = mix(c, vec3(0.04, 0.035, 0.03), smoothstep(-0.6, -0.78, p.x));                                    // the end half of the tail is black
    if(vK > 3.5){
      c = mix(c, vec3(0.07, 0.06, 0.055), 0.6 * smoothstep(0.42, 0.5, p.x));                                                        // a dark face
      c = mix(c, vec3(0.55, 0.47, 0.36), (1.0 - smoothstep(0.0, 0.016, abs(p.y - 0.645 + (p.x - 0.46) * 0.3))) * step(0.42, p.x) * 0.7);   // with a pale stripe along the cheek
      c = mix(c, vec3(0.02, 0.018, 0.015), 1.0 - smoothstep(0.011, 0.016, length(vec3(p.x - 0.44, p.y - 0.685, abs(p.z) - 0.049))));       // eye
      c = mix(c, vec3(0.03, 0.028, 0.028), smoothstep(0.522, 0.53, p.x));                                                           // nose
      c = mix(c, vec3(0.42, 0.2, 0.1), smoothstep(0.7, 0.73, p.y) * (1.0 - smoothstep(0.76, 0.8, p.y)) * 0.6); c = mix(c, vec3(0.06, 0.05, 0.045), smoothstep(0.76, 0.8, p.y));      // ears rusty at the base, dark at the tip
    }
    c *= (0.5 + 0.45 * fur) * (0.9 + 0.2 * fine); }`;

// ---------------------------------------------------------------- lizards
// A lace monitor (goanna), and the same build at a smaller size for skinks. Parts: 0 head, body and tail, 2 legs. Low to the ground, x forward.
export function goanna() {
  const m = new Loft(), UP = [0, 0, 1];
  m.limb([[0.53, 0.05, 0, 0.012, 0.009], [0.47, 0.055, 0, 0.031, 0.02], [0.405, 0.066, 0, 0.045, 0.031], [0.32, 0.064, 0, 0.04, 0.032], [0.2, 0.072, 0, 0.068, 0.048], [0.02, 0.074, 0, 0.09, 0.055], [-0.15, 0.068, 0, 0.068, 0.048],
    [-0.3, 0.05, 0, 0.04, 0.036], [-0.55, 0.035, 0, 0.026, 0.026], [-0.8, 0.022, 0, 0.014, 0.015], [-1.06, 0.014, 0, 0.004, 0.005]], 0, { S: 12, sub: 3, ref: UP });
  for (const [x, sg, hind] of [[0.19, 1, 0], [0.19, -1, 0], [-0.15, 1, 1], [-0.15, -1, 1]])
    m.limb([[x, 0.06, 0.05 * sg, 0.034, 0.03], [x + (hind ? -0.02 : 0.02), 0.078, 0.13 * sg, 0.03, 0.026], [x + (hind ? -0.05 : 0.05), 0.024, 0.18 * sg, 0.02, 0.017], [x + (hind ? 0.02 : 0.1), 0.009, 0.215 * sg, 0.034, 0.007], [x + (hind ? 0.06 : 0.15), 0.006, 0.225 * sg, 0.012, 0.004]], 2, { S: 8, sub: 3, ref: [1, 0, 0] });      // a thick limb, the elbow up, a broad clawed foot
  return m;
}
// A blue-tongue: a fat sausage of a lizard with a broad wedge head, a short thick tail and legs almost too small for it.
export function bluetongue() {
  const m = new Loft(), UP = [0, 0, 1];
  m.limb([[0.5, 0.04, 0, 0.02, 0.014], [0.45, 0.046, 0, 0.055, 0.03], [0.38, 0.055, 0, 0.066, 0.04], [0.3, 0.056, 0, 0.055, 0.04], [0.15, 0.064, 0, 0.074, 0.052], [-0.02, 0.066, 0, 0.08, 0.055], [-0.15, 0.06, 0, 0.068, 0.048],
    [-0.28, 0.045, 0, 0.046, 0.036], [-0.4, 0.03, 0, 0.026, 0.022], [-0.5, 0.02, 0, 0.007, 0.007]], 0, { S: 12, sub: 3, ref: UP });
  for (const [x, sg] of [[0.2, 1], [0.2, -1], [-0.14, 1], [-0.14, -1]]) m.limb([[x, 0.045, 0.06 * sg, 0.022, 0.02], [x + 0.01, 0.03, 0.105 * sg, 0.017, 0.014], [x + 0.03, 0.008, 0.125 * sg, 0.022, 0.006]], 2, { S: 8, sub: 3, ref: [1, 0, 0] });
  return m;
}
export const LIZARD_PAINT = (big) => /* glsl */`
  { vec3 p = vObj; float under = 1.0 - smoothstep(-0.8, -0.4, normalize(vNo).y), a = atan(p.z, p.y - 0.05);
    vec2 sc = vec2(p.x * 150.0, a * 12.0); float scale = 0.8 + 0.2 * smoothstep(0.1, 0.35, abs(fract(sc.x + step(0.5, fract(sc.y * 0.5)) * 0.5) - 0.5)) * smoothstep(0.1, 0.35, abs(fract(sc.y) - 0.5));     // rows of small scales
    ${big ? `
    vec3 dark = vec3(0.04, 0.045, 0.05), cream = vec3(0.5, 0.44, 0.22);                                                            // a lace monitor: near black, sprinkled and barred with dull cream
    float tailBand = step(0.5, fract(p.x * 4.4 + 0.1)) * smoothstep(-0.5, -0.58, p.x);                                             // broad bands on the end half of the tail only
    vec2 dq = vec2(fract(p.x / 0.08 + vH.y) - 0.5, fract(a * 2.2) - 0.5); float dots = (1.0 - smoothstep(0.12, 0.2, length(dq * vec2(1.0, 0.8)))) * step(-0.56, p.x);     // across the back, a narrow row of small dots every hand's width
    float speck = step(0.78, texture2D(uNoise, vec2(p.x * 21.0, a * 2.3) + vH.x).r) * 0.5;
    c = mix(dark, cream, max(tailBand, max(dots * 0.8, speck)));
    c = mix(c, vec3(0.46, 0.42, 0.28), under * 0.7);
    if(vK > 1.5) c = mix(dark, cream, (1.0 - smoothstep(0.1, 0.2, length(fract(vec2(p.z * 22.0, p.x * 22.0)) - 0.5))) * 0.7);       // spotted legs` : `
    vec3 base = vec3(0.4, 0.35, 0.27), bar = vec3(0.14, 0.1, 0.07);                                                                 // a blue-tongue: fawn, with eight or so dark bars across the back and tail
    c = mix(base, bar, smoothstep(0.28, 0.36, abs(fract(p.x * 8.5 + vH.y) - 0.5)) * (1.0 - under) * step(p.x, 0.3));
    c = mix(c, vec3(0.16, 0.12, 0.09), (1.0 - smoothstep(0.0, 0.012, abs(p.y - 0.06 - (p.x - 0.4) * 0.1))) * step(0.36, p.x) * step(p.x, 0.47) * 0.8);     // a dark streak back from the eye
    c = mix(c, vec3(0.7, 0.66, 0.56), under * 0.75);`}
    c = mix(c, vec3(0.02, 0.02, 0.02), 1.0 - smoothstep(0.008, 0.012, length(vec3(p.x - 0.42, p.y - 0.085, abs(p.z) - 0.036))));    // eye
    c *= scale; }`;

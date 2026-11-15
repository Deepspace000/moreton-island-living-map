// Sea surface: reflections, glitter, foam and swell. The see-through colour of the
// water itself is drawn by the seabed (terrain.js); this layer adds only the surface.
import * as THREE from 'three';
import { U, VEX, makeMat, LOGV, LOGF } from './common.js';
import { heightAt, maskAt } from './terrain.js';

const waves = [];           // {dx, dz, amp, k, w, ph}
export function setWaves(list) {
  waves.length = 0;
  list.slice(0, 6).forEach((w, i) => {
    const k = 2 * Math.PI / w.len;
    waves.push({ dx: w.dx, dz: w.dz, amp: w.amp, k, w: Math.sqrt(9.81 * k), ph: i * 1.7, swell: w.swell ? 1 : 0 });
    U.uWaves.value[i].set(w.dx, w.dz, w.amp, w.len);
    U.uWavePh.value[i] = w.swell ? 1 : 0;
  });
  for (let i = list.length; i < 6; i++) U.uWaves.value[i].set(1, 0, 0, 100);
}
// CPU copy of the vertex shader swell, so boats ride the same water. Returns metres (un-exaggerated).
export function waveAt(x, z, t, out) {
  const m = maskAt(x, z), depth = U.uSeaM.value - heightAt(x, z);
  const shoal = Math.min(1, Math.max(0, depth / 3.5));
  let y = 0, sx = 0, sz = 0;
  for (const w of waves) {
    const a = w.amp * shoal * (w.swell ? m.expo * m.expo : 0.35 + 0.65 * m.expo);
    const p = (w.dx * x + w.dz * z) * w.k - w.w * t + w.ph;
    y += a * Math.sin(p); const c = a * w.k * Math.cos(p); sx += c * w.dx; sz += c * w.dz;
  }
  if (out) { out.sx = sx; out.sz = sz; }
  return y;
}

export function buildWater(scene) {
  // polar grid: dense under the camera target, reaching the horizon
  const rings = 150, segs = 144, pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let r = 1; r <= rings; r++) {
    const rad = 6 * Math.pow(1.0745, r);
    for (let s = 0; s < segs; s++) { const a = s / segs * Math.PI * 2; pos.push(Math.cos(a) * rad, 0, Math.sin(a) * rad); }
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
  for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) {
    const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + (s + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);

  const mat = makeMat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vs: /* glsl */`
      uniform vec4 uWaves[6]; uniform float uWavePh[6], uSurf;
      varying vec3 vW; varying vec2 vSlope; varying float vWaveH, vBreak;
      // The exposure map blurs to the land's low value right at the beach. Look about 250 m downhill (out to sea) instead,
      // so a surf beach is known as one all the way to the sand.
      float seaward(vec2 xz, float here){
        vec2 uv = clamp(worldUV(xz), 0.0, 1.0), e = uHTex * 2.0;
        vec2 down = vec2(texture2D(uHeight, uv - vec2(e.x, 0.0)).r - texture2D(uHeight, uv + vec2(e.x, 0.0)).r, texture2D(uHeight, uv - vec2(0.0, e.y)).r - texture2D(uHeight, uv + vec2(0.0, e.y)).r);
        return max(here, texture2D(uHeight, clamp(uv + normalize(down + 1e-5) * uHTex * 22.0, 0.0, 1.0)).g);
      }
      void main(){
        vBreak = 0.0;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec2 hg = texture2D(uHeight, clamp(worldUV(wp.xz), 0.0, 1.0)).rg;
        float depth = uSeaM - hg.r, expo = hg.g;
        float shoal = clamp(depth / 3.5, 0.0, 1.0);
        float fade = 1.0 - smoothstep(2500.0, 9000.0, length(wp.xz - cameraPosition.xz));
        float y = 0.0; vec2 sl = vec2(0.0);
        for(int i = 0; i < 6; i++){
          vec4 w = uWaves[i]; float k = 6.2831853 / w.w;
          float a = w.z * shoal * mix(0.35 + 0.65 * expo, expo * expo, uWavePh[i]);
          float p = dot(w.xy, wp.xz) * k - sqrt(9.81 * k) * uTime + float(i) * 1.7;
          y += a * sin(p); sl += a * k * cos(p) * w.xy;
        }
        // surf: where the water gets about as shallow as the swell is high, the waves stand up into breakers that roll
        // in to the sand (only near the middle of the mesh, where it is fine enough to carry them; foam is drawn at any distance)
        if(depth < 6.0 && depth > 0.0){
          float oe = seaward(wp.xz, expo), sv = uSurf * (0.18 + 0.82 * oe * oe), db = 2.0 * sv;
          // each wave has a long back and a steep face on its shoreward side (s is 0 on the crest, just under 1 on the face)
          float s = fract(depth / 0.9 + uTime / 7.0 - 0.25);
          float prof = s < 0.86 ? pow(1.0 - s / 0.86, 2.4) : pow((s - 0.86) / 0.14, 1.6);
          float dprof = s < 0.86 ? -2.79 * pow(1.0 - s / 0.86, 1.4) : 11.4 * pow((s - 0.86) / 0.14, 0.6);
          float env = smoothstep(db * 1.5, db * 0.6, depth) * smoothstep(0.03, db * 0.22, depth) * (1.0 - smoothstep(70.0, 200.0, length(position.xz))) * (0.55 + 0.9 * texture2D(uNoise, wp.xz / 140.0 + uTime * 0.004).r);
          float amp = 0.8 * sv * env;
          y += amp * prof;
          vec2 uvh = clamp(worldUV(wp.xz), 0.0, 1.0), e2 = uHTex * 2.0;
          vec2 deeper = -vec2(texture2D(uHeight, uvh + vec2(e2.x, 0.0)).r - texture2D(uHeight, uvh - vec2(e2.x, 0.0)).r, texture2D(uHeight, uvh + vec2(0.0, e2.y)).r - texture2D(uHeight, uvh - vec2(0.0, e2.y)).r) / (4.0 * uMpp);
          sl += amp * dprof / 0.9 * deeper;                      // so the face of the wave is tilted to the light and the sky
          vBreak = env * prof;
        }
        vWaveH = y; vSlope = sl * uVex;
        wp.y = uSeaM * uVex + y * uVex * fade;
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
        ${LOGV}
      }`,
    fs: /* glsl */`
      uniform vec2 uWindDir; uniform float uChop, uSurf, uWhitecap, uRain, uSwell;
      varying vec3 vW; varying vec2 vSlope; varying float vWaveH, vBreak;
      // The exposure map blurs to the land's low value right at the beach. Look about 250 m downhill (out to sea) instead,
      // so a surf beach is known as one all the way to the sand.
      float seaward(vec2 xz, float here){
        vec2 uv = clamp(worldUV(xz), 0.0, 1.0), e = uHTex * 2.0;
        vec2 down = vec2(texture2D(uHeight, uv - vec2(e.x, 0.0)).r - texture2D(uHeight, uv + vec2(e.x, 0.0)).r, texture2D(uHeight, uv - vec2(0.0, e.y)).r - texture2D(uHeight, uv + vec2(0.0, e.y)).r);
        return max(here, texture2D(uHeight, clamp(uv + normalize(down + 1e-5) * uHTex * 22.0, 0.0, 1.0)).g);
      }
      void main(){
        ${LOGF}
        vec2 uv = worldUV(vW.xz);
        vec2 hg = texture2D(uHeight, clamp(uv, 0.0, 1.0)).rg;
        float depth = uSeaM - hg.r, expo = hg.g;
        if(depth < -0.25) discard;
        vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
        vec2 wd = uWindDir, wp = vec2(-wd.y, wd.x);
        float t = uTime;
        // layered wind ripples (each layer fades before it would alias)
        vec2 n = vec2(0.0);
        float f0 = 1.0 - smoothstep(400.0, 2600.0, dist), f1 = 1.0 - smoothstep(2500.0, 12000.0, dist), f2 = 1.0 - smoothstep(9000.0, 45000.0, dist);
        n += (texture2D(uWaterTex, vW.xz / 19.0 + wd * t * 0.11).rg - 0.5) * 0.9 * f0;
        n += (texture2D(uWaterTex, vW.xz / 57.0 + (wd * 0.8 + wp * 0.3) * t * 0.055).rg - 0.5) * 1.0 * f1;
        n += (texture2D(uWaterTex, vW.xz / 231.0 + (wd * 0.9 - wp * 0.2) * t * 0.021).rg - 0.5) * 0.9 * f1;
        n += (texture2D(uWaterTex, (vW.xz * mat2(0.8, 0.6, -0.6, 0.8)) / 1730.0 + wd * t * 0.006).rg - 0.5) * 0.3 * f2 * (1.0 - 0.85 * uWhitecap);
        float calm = smoothstep(0.0, 1.6, depth);
        float gust = texture2D(uNoise, vW.xz / 6100.0 + wd * t * 0.0016).r;           // cat's paws: patches of ruffled and glassy water
        float chop = min(uChop, mix(1.2, mix(0.34, 0.1, uWhitecap), smoothstep(1200.0, 10000.0, dist))) * mix(0.5, 1.0, expo) * (0.35 + 0.65 * calm) * (0.7 + 0.6 * gust);
        if(uRain > 0.01) n += (texture2D(uWaterTex, vW.xz / 3.1 + t * vec2(0.3, -0.2)).rg - 0.5) * uRain * 1.6 * f0;
        vec3 N = normalize(vec3(-vSlope.x - n.x * chop, 1.0, -vSlope.y - n.y * chop));
        if(!gl_FrontFacing){
          // from underneath: straight up there is a bright, rippling window onto the sky; outside about 48 degrees the surface
          // is a mirror of the deep water. The sun shows through the window as a dancing glare.
          float rip = 0.55 / (1.0 + dist * 0.06);                                   // ripples blur into a smooth sheet with distance
          vec3 Nd = -normalize(vec3(-vSlope.x - n.x * rip, 1.0, -vSlope.y - n.y * rip));
          float ci = max(dot(Nd, V), 0.0), kk = 1.0 - 1.7689 * (1.0 - ci * ci), win = smoothstep(-0.04, 0.3, kk);         // soft edge to the window
          vec3 up = normalize(-V * 1.33 + Nd * (1.33 * ci - sqrt(max(kk, 0.0))) + vec3(0.0, 0.0001, 0.0));       // the ray bent on its way out into the air
          vec3 skyl = skyColor(normalize(vec3(up.x, max(up.y, 0.04), up.z))) * 1.2 + uLightCol * (pow(max(dot(up, uLightDir), 0.0), 60.0) * 1.2 + pow(max(dot(up, uLightDir), 0.0), 6.0) * 0.12) * cloudShadow(vW);
          vec3 Rd = reflect(-V, Nd); vec3 deep = fogColor(vec3(Rd.x, -abs(Rd.y) - 0.15, Rd.z)) * (0.75 + 0.5 * n.x);
          vec3 c = mix(deep, skyl, win);
          c = mix(c, fogColor(-V), (1.0 - exp(-dist * 0.085)) * (1.0 - 0.6 * win));
          gl_FragColor = vec4(c, 1.0); return;
        }
        float ndv = max(dot(N, V), 0.0);
        float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        // far water: unresolved waves tilt the mirror, lowering the grazing reflectance a little
        F = mix(F, min(F, 0.6), smoothstep(3000.0, 30000.0, dist));
        vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.02; R = normalize(R);
        vec3 refl = skyColor(R);
        // clouds mirrored in the sea
        float ct = (uCloudAlt - vW.y) / max(R.y, 0.08);
        float cl = cloudAt(vW.xz + R.xz * ct) * smoothstep(0.03, 0.2, R.y);
        vec3 cloudCol = uLightCol * 0.22 + uAmbSky * 1.3;
        refl = mix(refl, cloudCol, cl * 0.75);
        refl *= 0.93 + 0.14 * gust * (1.0 - uWhitecap);
        // sun / moon glitter: sharp up close, a broad glitter path far away
        float cs = cloudShadow(vW);
        float rough = mix(0.035, 0.16, smoothstep(300.0, 20000.0, dist)) * (0.6 + uChop * 0.7) * (0.7 + 0.6 * gust);
        vec3 Hh = normalize(V + uLightDir);
        float nh = max(dot(N, Hh), 0.0);
        float a2 = rough * rough; float dd = nh * nh * (a2 - 1.0) + 1.0;
        float D = a2 / (3.14159 * dd * dd);
        float FL = 0.02 + 0.98 * pow(1.0 - max(dot(V, Hh), 0.0), 5.0);
        vec3 spec = uLightCol * min(D * 0.25, 40.0) * FL * cs * step(0.0, uLightDir.y) * smoothstep(-0.02, 0.06, uLightDir.y);

        // ---- foam ----
        float fn = texture2D(uNoise, vW.xz / 46.0 + t * 0.008).r;
        float ff = texture2D(uNoise, vW.xz / 7.0 - wd * t * 0.02).b;
        float fg = texture2D(uNoise, vW.xz / 17.0 + wd * t * 0.012).g;
        float oexp = depth < 6.0 ? seaward(vW.xz, expo) : expo;
        float surf = max(uSurf * (0.18 + 0.82 * oexp * oexp), 0.12);
        float z = depth / surf;
        float foam = 0.0;
        // surf zone: lines of broken water roll in toward the beach (in step with the breakers of the vertex stage), each trailing a lace of foam
        if(z < 2.2){
          float nearF = 1.0 - smoothstep(5000.0, 14000.0, dist);                   // separate lines only where they can be resolved
          float db = 2.0 * surf;                                                   // the outer bar: the first waves break well out, then reform and break again
          float s = fract(depth / 0.9 + t / 7.0 - 0.25 + (fn - 0.5) * 0.3);         // 0 on a crest, rising seaward behind it
          float zone = smoothstep(db, db * 0.3, depth) * smoothstep(0.0, 0.1, depth);
          float band = smoothstep(0.6, 0.0, s), edge = smoothstep(0.9, 1.0, s);
          float web = 1.0 - smoothstep(0.0, 0.025 + 0.09 * band, min(abs(ff - 0.5), abs(fg - 0.47)));            // foam left behind a broken wave: a net of streaks that thins as it ages
          float lace = max(smoothstep(0.42, 0.8, ff * 0.7 + fg * 0.5 - (1.0 - band) * 0.6), web * smoothstep(0.0, 0.25, band) * 0.9);
          float lines = zone * (clamp(lace * sqrt(band) + edge * (0.65 + 0.35 * ff), 0.0, 1.0) * nearF + 0.45 * (1.0 - nearF));
          float swash = smoothstep(0.3 + 0.12 * sin(t * 0.5 + fn * 12.0), 0.0, z) * (0.15 + 0.85 * oexp);       // a calm bay shore has hardly any
          foam = clamp(swash * (0.55 + 0.6 * fg) + lines * (0.25 + 0.75 * oexp), 0.0, 1.0);
          foam = max(foam, smoothstep(0.55, 0.9, vBreak / max(0.8 * surf, 0.05)) * (0.6 + 0.4 * ff));        // the crest itself: tumbling white water where the wave stands highest
          foam *= smoothstep(-0.25, 0.02, depth);
        }
        // whitecaps offshore when it blows
        float fbig = texture2D(uNoise, vW.xz / 173.0 + wd * t * 0.004).r;
        float wc = smoothstep(1.0 - uWhitecap * 0.2, 1.0 - uWhitecap * 0.2 + 0.07, fn * 0.45 + fg * 0.35 + fbig * 0.35 + vWaveH * 0.04) * ff * ff * 2.4 * calm * (0.4 + 0.6 * expo) * (1.0 - smoothstep(2200.0, 8000.0, dist));
        wc += uWhitecap * 0.07 * calm * (0.4 + 0.6 * expo) * smoothstep(2200.0, 8000.0, dist) * (0.6 + 0.8 * fbig);   // far away: just a paler, wind-whitened sea
        foam = clamp(foam + wc * step(0.01, uWhitecap), 0.0, 1.0);
        foam *= 1.0 - smoothstep(14000.0, 40000.0, dist) * 0.6;
        vec3 foamCol = vec3(0.95, 0.96, 0.95) * (uLightCol * (0.2 + 0.26 * max(uLightDir.y, 0.0)) * cs + mix(uAmbSky, vec3(dot(uAmbSky, vec3(0.3333))), 0.75) * 0.75) * (0.82 + 0.3 * ff);      // white, not tinted by the blue of the sky

        float a = F + (1.0 - F) * foam * 0.92;
        vec3 rgb = refl * F + spec + foamCol * foam * 0.92 * (1.0 - F);
        rgb += vec3(0.01, 0.10, 0.08) * (uLightCol * 0.12 + uAmbSky * 0.3) * smoothstep(0.45, 0.8, vBreak) * (1.0 - smoothstep(0.85, 1.0, vBreak)) * (1.0 - foam);          // green light through the thin wall of a rising wave
        rgb += vec3(uFlash) * 0.2 * F;
        float fg2 = fogAmount(vW);
        rgb = rgb * (1.0 - fg2) + fogColor(-V) * fg2 * a;
        gl_FragColor = vec4(rgb, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 10;
  scene.add(mesh);
  return mesh;
}

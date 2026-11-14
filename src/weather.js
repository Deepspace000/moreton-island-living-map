// Weather and sea state: live from Open-Meteo (no key needed), or set by hand with the sliders.
import { U, LAT, LON, lerp, clamp, smooth } from './common.js';
import { setWaves } from './water.js';

// raw live readings (defaults = a pleasant day, used until the live data arrives)
export const live = {
  ok: false, temp: 24, feels: 25, wind: 14, gust: 20, windDir: 120, cloud: 30, rain: 0, code: 1, humidity: 65,
  wave: 0.9, waveDir: 110, wavePeriod: 8, swell: 0.8, swellDir: 120, swellPeriod: 9, windWave: 0.3, sst: 24, tide: 0, time: '',
};
// what the scene uses (eased toward the target every frame)
export const wx = { overcast: 0, haze: 0.1, turb: 0, cloud: 0.3, wind: 14, windDir: 120, rain: 0, storm: 0, wave: 0.9, tide: 0, cy: 1, cs: 1, calt: 0, cirrus: 0.5, low: 1, dark: 0 };
const target = { ...wx };
export let mode = 'live';
// hand-set weather (the sliders)
export const custom = { sun: 85, cloud: 25, ctype: 'cumulus', wind: 14, windDir: 120, rain: 0, fog: 5, swell: 0.9, tide: 0, storm: 0 };
export const TYPES = {
  cumulus: { label: 'Fair-weather cumulus', cy: 1, cs: 1, calt: 0, cirrus: 0.5, low: 1, dark: 0 },
  towering: { label: 'Towering cumulus', cy: 2.0, cs: 1.25, calt: -100, cirrus: 0.3, low: 1, dark: 0.15 },
  stratus: { label: 'Low grey sheet', cy: 0.28, cs: 2.0, calt: -420, cirrus: 0.05, low: 1.25, dark: 0.3 },
  cirrus: { label: 'High wisps only', cy: 1, cs: 1, calt: 0, cirrus: 1.7, low: 0.1, dark: 0 },
  storm: { label: 'Storm cells', cy: 1.8, cs: 1.6, calt: -250, cirrus: 0, low: 1.1, dark: 0.7 },
};
const PRESETS = {
  clear: { sun: 100, cloud: 8, ctype: 'cumulus', wind: 9, rain: 0, fog: 3, swell: 0.5, storm: 0 },
  cloudy: { sun: 50, cloud: 72, ctype: 'cumulus', wind: 20, rain: 0, fog: 8, swell: 1.3, storm: 0 },
  storm: { sun: 6, cloud: 100, ctype: 'storm', wind: 52, rain: 100, fog: 22, swell: 3.2, storm: 1 },
};
const liveOvercast = (c) => clamp(smooth(55, 100, c.cloud) * 0.8 + clamp(c.rain / 6, 0, 1) * 0.35 + (c.code >= 95 ? 0.25 : 0), 0, 1);
export function seedCustom() {          // start the sliders from what is showing now
  if (mode !== 'live') return;
  Object.assign(custom, { sun: Math.round((1 - liveOvercast(live)) * 100), cloud: Math.round(live.cloud), wind: Math.round(live.wind), windDir: Math.round(live.windDir), rain: Math.round(clamp(live.rain / 6, 0, 1) * 100), fog: (live.code === 45 || live.code === 48) ? 80 : 5, swell: Math.round(live.wave * 10) / 10, tide: Math.round(live.tide * 10) / 10, storm: live.code >= 95 ? 1 : 0, ctype: live.code >= 95 ? 'storm' : live.rain > 1 ? 'towering' : live.cloud > 92 ? 'stratus' : 'cumulus' });
}
export function setMode(m) { if (m !== 'live' && PRESETS[m]) { seedCustom(); Object.assign(custom, PRESETS[m]); } mode = m; apply(); }
export function setCustom(key, val) { seedCustom(); custom[key] = val; mode = 'custom'; apply(); }
export function current() {
  if (mode === 'live') return live;
  const c = custom, code = c.storm ? 95 : c.rain > 55 ? 65 : c.rain > 20 ? 63 : c.rain > 3 ? 61 : c.fog > 60 ? 45 : c.cloud > 85 ? 3 : c.cloud > 40 ? 2 : c.cloud > 12 ? 1 : 0;
  return { ...live, wind: c.wind, gust: c.wind * 1.4, windDir: c.windDir, cloud: c.cloud, rain: c.rain / 100 * 6, code, wave: c.swell, swell: c.swell * 0.85, windWave: Math.max(0.1, c.wind * 0.02), tide: c.tide };
}

const CODES = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail' };
export const describe = (c) => CODES[c] || 'Fair';
export const compass = (d) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(d / 22.5) % 16];

function apply() {
  const c = current();
  const rain = clamp(c.rain / 6, 0, 1), storm = c.code >= 95 ? 1 : 0, fog = (c.code === 45 || c.code === 48) ? 1 : 0;
  let type;
  if (mode === 'live') {
    target.overcast = liveOvercast(c);
    target.haze = clamp(0.06 + c.humidity / 100 * 0.08 + rain * 0.3 + fog * 0.9 + storm * 0.12, 0, 1);
    type = TYPES[storm ? 'storm' : rain > 0.15 ? 'towering' : c.cloud > 92 ? 'stratus' : 'cumulus'];
  } else {
    target.overcast = clamp(1 - custom.sun / 100, 0, 1);
    target.haze = clamp(0.04 + Math.pow(custom.fog / 100, 1.3) * 0.96 + rain * 0.22, 0, 1);
    type = TYPES[custom.ctype] || TYPES.cumulus;
  }
  target.cloud = c.cloud / 100;
  target.turb = clamp(smooth(1.5, 4, c.wave) * 0.6 + rain * 0.3 + target.overcast * 0.25, 0, 1);
  target.wind = c.wind; target.windDir = c.windDir; target.rain = rain; target.storm = storm; target.wave = c.wave; target.tide = c.tide;
  for (const k of ['cy', 'cs', 'calt', 'cirrus', 'low', 'dark']) target[k] = type[k];
  // sea: two swell trains from the reported swell direction + a wind sea
  const sd = (c.swellDir + 180) * Math.PI / 180, wd = (c.windDir + 180) * Math.PI / 180;      // "from" -> "toward"
  const dir = (a, off) => ({ dx: Math.sin(a + off), dz: -Math.cos(a + off) });
  const sl = clamp(c.swellPeriod * c.swellPeriod * 1.56 * 0.55, 45, 190);
  const ww = Math.max(c.windWave, c.wind * 0.012);
  setWaves([
    { ...dir(sd, 0), amp: c.swell * 0.33, len: sl, swell: true },
    { ...dir(sd, 0.22), amp: c.swell * 0.2, len: sl * 0.62, swell: true },
    { ...dir(sd, -0.31), amp: c.swell * 0.13, len: sl * 0.4, swell: true },
    { ...dir(wd, 0.12), amp: ww * 0.3, len: 34 },
    { ...dir(wd, -0.4), amp: ww * 0.22, len: 21 },
    { ...dir(wd, 0.55), amp: ww * 0.15, len: 13 },
  ]);
}

export function stepWeather(dt) {
  const k = 1 - Math.exp(-dt * (mode === 'live' ? 0.6 : 1.6));
  for (const key of ['overcast', 'haze', 'turb', 'cloud', 'wind', 'rain', 'storm', 'wave', 'tide', 'cy', 'cs', 'calt', 'cirrus', 'low', 'dark']) wx[key] = lerp(wx[key], target[key], k);
  const dd = ((target.windDir - wx.windDir + 540) % 360) - 180; wx.windDir = (wx.windDir + dd * k + 360) % 360;
  const a = (wx.windDir + 180) * Math.PI / 180;
  U.uWindDir.value.set(Math.sin(a), -Math.cos(a));
  U.uChop.value = clamp(0.16 + wx.wind / 50, 0.16, 1.1);
  U.uSurf.value = clamp(0.5 + wx.wave * 1.25, 0.5, 5);
  U.uWhitecap.value = smooth(17, 55, wx.wind);
  U.uRain.value = wx.rain;
  U.uSeaM.value = wx.tide;
  U.uCirrus.value = wx.cirrus * (1 - wx.overcast * 0.7);
}

export async function fetchWeather() {
  try {
    const a = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Australia%2FBrisbane`;
    const b = `https://marine-api.open-meteo.com/v1/marine?latitude=-27.15&longitude=153.50&current=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature,sea_level_height_msl&timezone=Australia%2FBrisbane`;
    const [fa, fb] = await Promise.all([fetch(a).then(r => r.json()), fetch(b).then(r => r.json()).catch(() => null)]);
    const c = fa.current;
    Object.assign(live, { ok: true, temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, gust: c.wind_gusts_10m, windDir: c.wind_direction_10m, cloud: c.cloud_cover, rain: c.precipitation, code: c.weather_code, time: c.time });
    const m = fb && fb.current;
    if (m) {
      const n = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
      Object.assign(live, { wave: n(m.wave_height, live.wave), waveDir: n(m.wave_direction, live.waveDir), wavePeriod: n(m.wave_period, live.wavePeriod), windWave: n(m.wind_wave_height, live.windWave), swell: n(m.swell_wave_height, live.swell), swellDir: n(m.swell_wave_direction, live.swellDir), swellPeriod: n(m.swell_wave_period, live.swellPeriod), sst: n(m.sea_surface_temperature, live.sst), tide: clamp(n(m.sea_level_height_msl, 0), -1.3, 1.3) });
    }
  } catch (e) { console.warn('weather unavailable, using defaults', e); }
  apply();
  return live;
}
apply();

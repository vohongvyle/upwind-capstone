// ─────────────────────────────────────────────────────────────
//  Demo data — produces boards in the SAME format as the backend
//  (board[] with center/weather/pollution.avg) plus a trajectory,
//  so the real parsing path is exercised. Synthetic but plausible:
//   Kern   — valley-floor PM near Bakersfield, afternoon ozone in the
//            SE foothills, NW→SE valley flow, Tehachapi pass jet.
//   LA/OC  — port + freeway NO₂/PM, afternoon sea breeze pushing
//            ozone into the San Gabriel Valley / Inland Empire edge,
//            night land breeze, one Santa Ana (offshore) episode.
// ─────────────────────────────────────────────────────────────
import { inRing } from './geo.js';

function hash(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = t => t * t * (3 - 2 * t);
  const a = hash(xi, yi, z), b = hash(xi + 1, yi, z), c = hash(xi, yi + 1, z), d = hash(xi + 1, yi + 1, z);
  return (a + (b - a) * s(xf)) * (1 - s(yf)) + (c + (d - c) * s(xf)) * s(yf);
}
const g = (lon, lat, cx, cy, r) => Math.exp(-(((lon - cx) / r) ** 2 + ((lat - cy) / (r * 0.8)) ** 2));
const clamp01 = v => Math.max(0, Math.min(1, v));

// ── Kern County ──────────────────────────────────────────────
const KERN = {
  wind(lon, lat, h) {
    const hod = h % 24;
    const synoptic = 0.55 * Math.sin(h / 80 * 2 * Math.PI) + 0.25 * Math.sin(h / 31);
    const base = 1.7 + 0.9 * Math.sin((hod - 9) / 24 * 2 * Math.PI);
    const ang = (-38 + synoptic * 50) * Math.PI / 180;
    let u = base * Math.cos(ang), v = base * Math.sin(ang);
    const pass = g(lon, lat, -118.45, 35.1, 0.35);
    u += 2.4 * pass; v -= 0.4 * pass;
    if (lon > -118.2) u += 0.6;
    u += (noise(lon * 3, lat * 3, h / 6) - 0.5) * 0.8;
    v += (noise(lon * 3 + 9, lat * 3, h / 6) - 0.5) * 0.8;
    return [u, v];
  },
  pollution(lon, lat, h) {
    const hod = h % 24;
    const night = hod < 9 ? 1.3 : hod < 12 ? 1.0 : 0.82;
    const sun = hod === 12 ? 1 : hod === 18 ? 0.85 : hod === 6 ? 0.25 : 0.08;
    const episode = 1 + 0.75 * Math.sin(h / 60 * 2 * Math.PI - 1) + 0.2 * Math.sin(h / 17);
    const city = g(lon, lat, -119.02, 35.37, 0.32);
    const valley = (lon > -119.85 && lon < -118.85 && lat > 35.0) ? 1 : 0.35;
    const oil = g(lon, lat, -119.55, 35.30, 0.25);
    const hwy = Math.exp(-(((lon - (-119.15 + (lat - 35.37) * 0.2)) / 0.12) ** 2));
    const foothill = g(lon, lat, -118.75, 35.2, 0.45);
    const desert = lon > -118.3 ? 1 : 0;
    const n = noise(lon * 4, lat * 4, h / 12);
    const pm2_5 = Math.max(2, (6 + 26 * city * episode + 14 * valley * episode + 6 * hwy + 8 * oil) * night * (0.85 + 0.3 * n));
    return {
      pm2_5,
      pm10: pm2_5 * 1.7 + 12 * desert * (0.6 + n) + 8,
      o3: 55 + 95 * sun * (0.45 + foothill * 1.1 + 0.35 * desert) * (0.8 + 0.35 * episode / 1.75) + 10 * n,
      no2: (6 + 38 * city + 18 * hwy + 6 * oil) * (hod === 12 ? 0.6 : 1.1) * (0.9 + 0.2 * n),
      co: 210 + 320 * city * night + 90 * hwy + 40 * n,
      no: (0.3 + 7 * city * (hod < 9 ? 1 : 0.25) + 2 * hwy) * (0.8 + 0.4 * n),
      so2: 0.8 + 6 * oil + 1.5 * city + 0.6 * n,
    };
  },
};

// ── Los Angeles & Orange ─────────────────────────────────────
function laocModel(region) {
  const rings = region.outlines.map(o => o.ring);
  const isLand = (lon, lat) => rings.some(r => inRing(lon, lat, r))
    || (lon > -117.68 && lat > 33.45)              // Riverside / San Bernardino
    || (lon < -118.85 && lat > 34.05);             // Ventura
  // Santa Ana offshore event peaking ~36 h into the window
  const santaAna = h => Math.exp(-(((h - 36) / 11) ** 2));
  return {
    wind(lon, lat, h) {
      const hod = h % 24;
      const breeze = hod === 12 ? 1 : hod === 18 ? 0.75 : hod === 6 ? -0.25 : -0.45; // + onshore, − land breeze
      const coastal = clamp01(1.4 - (lat - 33.7) * 1.2);                          // weaker far inland
      let u = 2.0 * breeze * (0.5 + 0.5 * coastal), v = 1.5 * breeze * (0.5 + 0.5 * coastal);
      if (lat > 34.35) { u *= 0.4; v = v * 0.3 + 0.4; }                           // San Gabriels / high desert
      const sa = santaAna(h);
      u = u * (1 - sa) - 4.2 * sa; v = v * (1 - sa) - 3.0 * sa;                   // NE → SW offshore
      u += (noise(lon * 3, lat * 3, h / 6) - 0.5) * 0.7;
      v += (noise(lon * 3 + 9, lat * 3, h / 6) - 0.5) * 0.7;
      return [u, v];
    },
    pollution(lon, lat, h) {
      const hod = h % 24;
      const night = hod < 9 ? 1.25 : hod < 12 ? 1.0 : 0.85;
      const sun = hod === 12 ? 1 : hod === 18 ? 0.8 : hod === 6 ? 0.25 : 0.06;
      const sa = santaAna(h);
      const land = isLand(lon, lat) ? 1 : 0.45;
      const episode = (1 + 0.5 * Math.sin(h / 50 * 2 * Math.PI)) * (1 - 0.45 * sa);
      const port = g(lon, lat, -118.23, 33.75, 0.13);
      const dtla = g(lon, lat, -118.24, 34.04, 0.17);
      const i710 = Math.exp(-(((lon - (-118.17 - (lat - 33.9) * 0.15)) / 0.06) ** 2)) * (lat > 33.75 && lat < 34.1 ? 1 : 0);
      const oc = g(lon, lat, -117.9, 33.78, 0.16);
      const sgv = g(lon, lat, -117.85, 34.1, 0.28);
      const inland = clamp01((lat - 33.75) * 1.6 + (lon + 118.4) * 0.45);
      const n = noise(lon * 4, lat * 4, h / 12);
      const pm2_5 = Math.max(2, (5 + 16 * port + 15 * dtla + 10 * i710 + 9 * oc) * night * episode * land * (0.85 + 0.3 * n));
      return {
        pm2_5,
        pm10: pm2_5 * 1.6 + 7 + 45 * sa * (0.5 + n) * land,                    // Santa Ana dust
        o3: 50 + 60 * sun * (0.25 + 1.1 * sgv + 0.55 * inland) * episode + 8 * n,
        no2: (8 + 48 * port + 42 * dtla + 26 * i710 + 22 * oc) * (hod === 12 ? 0.6 : 1.1) * land * (0.9 + 0.2 * n),
        co: 230 + 380 * dtla * night + 220 * port + 120 * i710 + 40 * n,
        no: (0.4 + 9 * dtla * (hod < 9 ? 1 : 0.25) + 5 * port + 3 * i710) * (0.8 + 0.4 * n),
        so2: 0.8 + 9 * port + 1.2 * dtla + 0.5 * n,
      };
    },
  };
}

// Trace a path the way the backend does: snap to neighbouring cells by wind direction.
function trace(board, step) {
  const key = (lo, la) => `${lo.toFixed(3)},${la.toFixed(3)}`;
  const byKey = new Map(board.map(c => [key(c.center[0], c.center[1]), c]));
  let cur = board.reduce((a, b) => (b.pollution.avg.pm2_5 > a.pollution.avg.pm2_5 ? b : a));
  const seen = new Set([key(...cur.center)]);
  const back = [cur];
  for (let s = 0; s < 6; s++) {
    const u = cur.weather['10u_wind_change'], v = cur.weather['10v_wind_change'];
    const m = Math.hypot(u, v) || 1;
    const next = byKey.get(key(cur.center[0] - Math.round(u / m) * step, cur.center[1] - Math.round(v / m) * step));
    if (!next || seen.has(key(...next.center))) break;
    seen.add(key(...next.center));
    back.push(next); cur = next;
  }
  return back.reverse().map(c => [c.center[0] - 360, c.center[1]]);
}

export function makeDemo(config, region) {
  const model = region.id === 'laoc' ? laocModel(region) : KERN;
  const { lons, lats } = region.grid;
  const step = lons[1] - lons[0];
  const now = new Date();
  const end = new Date((config.endDate || now.toISOString().slice(0, 10)) + 'T00:00:00Z');
  const nowSlot = config.endDate ? 3 : Math.floor(now.getHours() / 6);
  const frames = [];
  for (let d = -config.daysBack; d <= config.forecastDays; d++) {
    const day = new Date(end); day.setUTCDate(day.getUTCDate() + d);
    const date = day.toISOString().slice(0, 10);
    config.slots.forEach((slot, si) => {
      const h = (d + config.daysBack) * 24 + +slot.start.slice(0, 2);
      const board = [];
      for (const la of lats) for (const lo of lons) {
        const lon = lo - 360;
        const [u, v] = model.wind(lon, la, h);
        const p = model.pollution(lon, la, h);
        p.aqi = p.pm2_5 < 10 ? 1 : p.pm2_5 < 25 ? 2 : p.pm2_5 < 50 ? 3 : p.pm2_5 < 75 ? 4 : 5; // OpenWeather 1–5
        board.push({
          center: [lo, la],
          weather: { '10u_wind_change': u, '10v_wind_change': v, u_wind_change: u * 1.3, v_wind_change: v * 1.3 },
          pollution: { avg: p },
        });
      }
      frames.push({
        date, slot, forecast: d > 0 || (d === 0 && si > nowSlot),
        json: { board },               // exactly what board_*.json contains
        path: trace(board, step),      // what the evaluation CSV contains (lon,lat rows)
      });
    });
  }
  return frames;
}

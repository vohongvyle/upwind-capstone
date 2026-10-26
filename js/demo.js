// ─────────────────────────────────────────────────────────────
//  Demo data — produces boards in the SAME format as the backend
//  (board[] with center/weather/pollution.avg) plus a trajectory,
//  so the real parsing path is exercised. Synthetic but plausible:
//   Kern   — valley-floor PM near Bakersfield, afternoon ozone in the
//            SE foothills, NW→SE valley flow, Tehachapi pass jet.
//   Visalia / Fresno — same valley dynamics as Kern.
//   San Diego — port + border crossings, afternoon sea breeze ozone inland.
//   El Centro — Mexicali emissions, ag burning, Salton Sea / desert dust.
// ─────────────────────────────────────────────────────────────

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

// ── Generic city model ───────────────────────────────────────
// sources: [lon, lat, radius°, strength]; wind: daytime / night (u, v) m/s
function cityModel(cfg) {
  return {
    wind(lon, lat, h) {
      const hod = h % 24;
      const day = hod === 12 ? 1 : hod === 18 ? 0.8 : hod === 6 ? 0.3 : 0;
      const syn = 0.5 * Math.sin(h / 70 * 2 * Math.PI);
      let u = cfg.wind.day[0] * day + cfg.wind.night[0] * (1 - day);
      let v = cfg.wind.day[1] * day + cfg.wind.night[1] * (1 - day);
      const c = Math.cos(syn * 0.6), s = Math.sin(syn * 0.6);
      [u, v] = [u * c - v * s, u * s + v * c];
      u += (noise(lon * 3, lat * 3, h / 6) - 0.5) * 0.8;
      v += (noise(lon * 3 + 9, lat * 3, h / 6) - 0.5) * 0.8;
      return [u, v];
    },
    pollution(lon, lat, h) {
      const hod = h % 24;
      const night = hod < 9 ? 1.3 : hod < 12 ? 1.0 : 0.82;
      const sun = hod === 12 ? 1 : hod === 18 ? 0.85 : hod === 6 ? 0.25 : 0.08;
      const episode = 1 + 0.6 * Math.sin(h / 55 * 2 * Math.PI - 1) + 0.2 * Math.sin(h / 17);
      const n = noise(lon * 4, lat * 4, h / 12);
      let src = 0;
      for (const [x, y, r, k] of cfg.sources) src += k * g(lon, lat, x, y, r);
      const oz = g(lon, lat, cfg.ozone[0], cfg.ozone[1], cfg.ozone[2]);
      const dust = cfg.dust ? cfg.dust(lon, lat) : 0;
      const base = cfg.base ?? 6;
      const pm2_5 = Math.max(2, (base + 24 * src * episode) * night * (cfg.landFn ? cfg.landFn(lon, lat) : 1) * (0.85 + 0.3 * n));
      return {
        pm2_5,
        pm10: pm2_5 * 1.6 + 8 + 30 * dust * (0.6 + n),
        o3: 52 + cfg.ozoneAmp * sun * (0.35 + oz) * (0.8 + 0.3 * episode / 1.6) + 8 * n,
        no2: (6 + 36 * src) * (hod === 12 ? 0.6 : 1.1) * (0.9 + 0.2 * n),
        co: 220 + 330 * src * night + 30 * n,
        no: (0.3 + 7 * src * (hod < 9 ? 1 : 0.25)) * (0.8 + 0.4 * n),
        so2: 0.8 + (cfg.so2 ? cfg.so2(lon, lat) : 0) + 1.2 * src + 0.5 * n,
      };
    },
  };
}

const CITY_MODELS = {
  // San Joaquin Valley: NW→SE valley flow, PM trapped on the valley floor, ozone piling up on the Sierra foothills
  visalia: cityModel({
    wind: { day: [1.6, -1.5], night: [0.6, -0.9] },
    sources: [[-119.29, 36.33, 0.16, 1], [-119.35, 36.21, 0.12, 0.6], [-119.02, 36.07, 0.12, 0.5], [-119.36, 36.25, 0.06, 0.6]],
    ozone: [-118.95, 36.3, 0.35], ozoneAmp: 105, base: 9,
    landFn: (lon) => (lon > -118.95 ? 0.55 : 1),           // foothills / Sierra cleaner for PM
  }),
  fresno: cityModel({
    wind: { day: [1.5, -1.6], night: [0.5, -0.8] },
    sources: [[-119.79, 36.74, 0.18, 1.1], [-119.70, 36.83, 0.1, 0.5], [-120.06, 36.96, 0.1, 0.5], [-119.80, 36.6, 0.05, 0.6]],
    ozone: [-119.5, 36.75, 0.35], ozoneAmp: 95, base: 8,
    landFn: (lon, lat) => (lon > -119.45 && lat > 36.85 ? 0.55 : 1),
  }),
  // Coastal: afternoon sea breeze pushes ozone inland to El Cajon/Alpine; border crossings + port for NO₂/PM
  sandiego: cityModel({
    wind: { day: [2.2, 0.6], night: [-0.8, -0.3] },
    sources: [[-117.15, 32.71, 0.1, 0.9], [-117.04, 32.52, 0.12, 1.1], [-116.97, 32.56, 0.06, 0.8], [-117.09, 32.68, 0.06, 0.5], [-117.09, 33.12, 0.08, 0.4]],
    ozone: [-116.85, 32.85, 0.3], ozoneAmp: 85, base: 5,
    landFn: (lon, lat) => (lon < -117.27 + (lat - 32.7) * -0.1 ? 0.45 : 1),   // ocean cleaner
    so2: (lon, lat) => 5 * g(lon, lat, -117.14, 32.69, 0.06),                  // port / shipyards
  }),
  // Imperial Valley: Mexicali emissions, ag burning and desert dust; westerly afternoon winds
  elcentro: cityModel({
    wind: { day: [2.4, -0.4], night: [-0.4, 0.9] },
    sources: [[-115.47, 32.62, 0.16, 1.4], [-115.56, 32.79, 0.08, 0.5], [-115.53, 32.98, 0.07, 0.4], [-115.50, 32.68, 0.05, 0.6]],
    ozone: [-115.5, 32.75, 0.4], ozoneAmp: 90, base: 7,
    dust: (lon, lat) => g(lon, lat, -115.85, 33.3, 0.25) + 0.6 * (lon < -115.8 ? 1 : 0),   // Salton Sea playa + desert
  }),
};

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
  const model = CITY_MODELS[region.id] || KERN;
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

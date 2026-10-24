// ─────────────────────────────────────────────────────────────
//  Data layer: load board.json + evaluation files, normalise them
//  onto a regular grid, and interpolate in space and time.
// ─────────────────────────────────────────────────────────────
import { CONFIG } from './config.js';
import { subIndex, INDEXED } from './aqi.js';
import { makeDemo } from './demo.js';

export const VARS = ['u', 'v', 'co', 'no', 'no2', 'o3', 'so2', 'pm2_5', 'pm10'];
const SUB = INDEXED.map(k => 'i_' + k);           // sub-index arrays
export const ALL_VARS = [...VARS, ...SUB, 'aqi'];

const isoDate = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const lon180 = l => (l > 180 ? l - 360 : l);
const num = v => (v == null || v === '' ? NaN : +v);

// ── Parsing ──────────────────────────────────────────────────

function cellsFromBoard(json) {
  const list = Array.isArray(json) ? json : (json.board || json.cells || []);
  return list.map(q => {
    const c = q.center || [q.lon, q.lat];
    const w = q.weather || {};
    const p = (q.pollution && (q.pollution.avg || q.pollution)) || q;
    return {
      lon: lon180(+c[0]), lat: +c[1],
      u: num(w['10u_wind_change'] ?? w.u10 ?? w.u_wind_change ?? w.u),
      v: num(w['10v_wind_change'] ?? w.v10 ?? w.v_wind_change ?? w.v),
      co: num(p.co), no: num(p.no), no2: num(p.no2), o3: num(p.o3),
      so2: num(p.so2 ?? p.so3), pm2_5: num(p.pm2_5 ?? p.pm25), pm10: num(p.pm10),
      owAqi: num(p.aqi),
    };
  });
}

function pathFromBoard(json) {
  if (!json || Array.isArray(json)) return null;
  const raw = json.path || json.trajectory;
  if (!raw) return null;
  return normalisePath(raw, json.origin);
}

function normalisePath(raw, origin) {
  let pts = (Array.isArray(raw) ? raw : raw.path || []).map(p =>
    Array.isArray(p) ? [lon180(+p[0]), +p[1]] : [lon180(+p.lon), +p.lat]);
  if (origin && pts.length && (pts[0][0] !== lon180(+origin[0]) || pts[0][1] !== +origin[1])) {
    pts.unshift([lon180(+origin[0]), +origin[1]]);
  }
  pts = pts.filter(p => isFinite(p[0]) && isFinite(p[1]));
  return pts.length ? pts : null;
}

function parseEval(text, url) {
  const t = text.trim();
  if (url.endsWith('.json') || t.startsWith('{') || t.startsWith('[')) {
    const j = JSON.parse(t);
    return normalisePath(j, j.origin);
  }
  const rows = d3.csvParse(t);
  return normalisePath(rows.map(r => ({ lon: r.lon, lat: r.lat })));
}

// ── Grid ─────────────────────────────────────────────────────

/** Build a regular grid from cell centres; returns {lons, lats, nx, ny, dLon, dLat, bounds}. */
function buildGrid(cells) {
  const round = v => Math.round(v * 1e4) / 1e4;
  const lons = [...new Set(cells.map(c => round(c.lon)))].sort((a, b) => a - b);
  const lats = [...new Set(cells.map(c => round(c.lat)))].sort((a, b) => a - b);
  const dLon = lons.length > 1 ? lons[1] - lons[0] : 0.25;
  const dLat = lats.length > 1 ? lats[1] - lats[0] : 0.25;
  return {
    lons, lats, nx: lons.length, ny: lats.length, dLon, dLat,
    bounds: [lons[0] - dLon / 2, lats[0] - dLat / 2, lons.at(-1) + dLon / 2, lats.at(-1) + dLat / 2],
    centers: lats.flatMap(la => lons.map(lo => [lo, la])),
  };
}

function frameArrays(grid, cells) {
  const n = grid.nx * grid.ny;
  const A = Object.fromEntries(ALL_VARS.map(k => [k, new Float32Array(n).fill(NaN)]));
  const ix = new Map(grid.lons.map((v, i) => [v, i]));
  const iy = new Map(grid.lats.map((v, i) => [v, i]));
  const round = v => Math.round(v * 1e4) / 1e4;
  for (const c of cells) {
    const i = ix.get(round(c.lon)), j = iy.get(round(c.lat));
    if (i == null || j == null) continue;
    const k = j * grid.nx + i;
    for (const v of VARS) A[v][k] = c[v];
  }
  computeIndices(A, n);
  return A;
}

function computeIndices(A, n) {
  for (let k = 0; k < n; k++) {
    let best = NaN;
    for (const p of INDEXED) {
      const s = subIndex(p, A[p][k]);
      A['i_' + p][k] = s == null ? NaN : s;
      if (s != null && !(s <= best)) best = s;
    }
    A.aqi[k] = best;
  }
}

// ── Loading ──────────────────────────────────────────────────

async function fetchText(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function loadSlot(region, date, slot) {
  for (const [dir, forecast] of [[region.archiveDir, false], [region.forecastDir, true]]) {
    const bt = await fetchText(`${dir}/${CONFIG.boardFile(date, slot)}`);
    if (!bt) continue;
    let json;
    try { json = JSON.parse(bt); } catch { continue; }
    let path = pathFromBoard(json);
    if (!path) {
      const url = `${dir}/${CONFIG.evalFile(date, slot)}`;
      const et = await fetchText(url);
      if (et) { try { path = parseEval(et, url); } catch { path = null; } }
    }
    return { date, slot, forecast, cells: cellsFromBoard(json), path };
  }
  return null;
}

async function loadLive(region) {
  const end = CONFIG.endDate ? new Date(CONFIG.endDate + 'T00:00:00Z') : new Date(isoDate(new Date()) + 'T00:00:00Z');
  const jobs = [];
  for (let d = -CONFIG.daysBack; d <= CONFIG.forecastDays; d++) {
    const date = isoDate(addDays(end, d));
    for (const slot of CONFIG.slots) jobs.push(loadSlot(region, date, slot));
  }
  return (await Promise.all(jobs)).filter(f => f && f.cells.length);
}

/**
 * Returns a Dataset:
 *  { grid, frames:[{date, slot, time, forecast, A:{var:Float32Array}, path}], nowIndex, demo }
 */
export async function loadDataset(region) {
  let raw = [], demo = false;
  if (CONFIG.mode !== 'demo') raw = await loadLive(region);
  if (!raw.length) {
    if (CONFIG.mode === 'live') throw new Error('No board files found in ' + region.archiveDir);
    raw = makeDemo(CONFIG, region).map(f => ({ ...f, cells: cellsFromBoard(f.json) }));
    demo = true;
  }
  const grid = buildGrid(raw[0].cells);
  const frames = raw.map(f => {
    const [hh, mm] = [f.slot.start.slice(0, 2), f.slot.start.slice(2)];
    return {
      date: f.date, slot: f.slot, forecast: f.forecast,
      time: new Date(`${f.date}T${hh}:${mm}:00`),
      A: frameArrays(grid, f.cells), path: f.path,
    };
  }).sort((a, b) => a.time - b.time);

  let nowIndex = frames.findLastIndex(f => !f.forecast);
  if (nowIndex < 0) nowIndex = 0;
  return { grid, frames, nowIndex, demo };
}

// ── Interpolation ────────────────────────────────────────────

/** Blend two frames → plain arrays for time position t (float frame index). */
export function blendAt(ds, t) {
  const n = ds.frames.length;
  const t0 = Math.max(0, Math.min(n - 1, Math.floor(t)));
  const t1 = Math.min(n - 1, t0 + 1);
  const f = Math.max(0, Math.min(1, t - t0));
  const a = ds.frames[t0].A, b = ds.frames[t1].A;
  const out = {};
  for (const k of ALL_VARS) {
    const A = a[k], B = b[k], O = new Float32Array(A.length);
    for (let i = 0; i < A.length; i++) {
      const x = A[i], y = B[i];
      O[i] = isNaN(x) ? y : isNaN(y) ? x : x + (y - x) * f;
    }
    out[k] = O;
  }
  return out;
}

export const cr = (p0, p1, p2, p3, t) => {
  // Catmull-Rom, NaN-tolerant
  if (isNaN(p1)) p1 = p2; if (isNaN(p2)) p2 = p1;
  if (isNaN(p0)) p0 = p1; if (isNaN(p3)) p3 = p2;
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/** Bicubic sample of array `arr` at lon/lat. Returns NaN outside the grid bounds. */
export function sample(grid, arr, lon, lat) {
  const gx = (lon - grid.lons[0]) / grid.dLon;
  const gy = (lat - grid.lats[0]) / grid.dLat;
  if (gx < -0.5 || gy < -0.5 || gx > grid.nx - 0.5 || gy > grid.ny - 0.5) return NaN;
  const x = Math.max(0, Math.min(grid.nx - 1, gx));
  const y = Math.max(0, Math.min(grid.ny - 1, gy));
  const ix = Math.min(grid.nx - 2, Math.floor(x)), iy = Math.min(grid.ny - 2, Math.floor(y));
  if (grid.nx < 2 || grid.ny < 2) return arr[0];
  const fx = x - ix, fy = y - iy;
  const at = (i, j) => arr[Math.max(0, Math.min(grid.ny - 1, j)) * grid.nx + Math.max(0, Math.min(grid.nx - 1, i))];
  const row = j => cr(at(ix - 1, j), at(ix, j), at(ix + 1, j), at(ix + 2, j), fx);
  return cr(row(iy - 1), row(iy), row(iy + 1), row(iy + 2), fy);
}

/** Nearest cell index to lon/lat, or -1 if outside. */
export function cellAt(grid, lon, lat) {
  const [w, s, e, n] = grid.bounds;
  if (lon < w || lon > e || lat < s || lat > n) return -1;
  const i = Math.min(grid.nx - 1, Math.max(0, Math.round((lon - grid.lons[0]) / grid.dLon)));
  const j = Math.min(grid.ny - 1, Math.max(0, Math.round((lat - grid.lats[0]) / grid.dLat)));
  return j * grid.nx + i;
}

/** County-wide mean of an array, ignoring NaN. */
export function mean(arr) {
  let s = 0, c = 0;
  for (const v of arr) if (!isNaN(v)) { s += v; c++; }
  return c ? s / c : NaN;
}

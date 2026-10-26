import * as I18N from './strings.js';
// ─────────────────────────────────────────────────────────────
//  Geography helpers: projection, county outline, places
// ─────────────────────────────────────────────────────────────

const TILE = 256;

/** lon/lat → Web-Mercator world pixels at zoom 0 (0..256). */
export function project(lon, lat) {
  const x = (lon + 180) / 360 * TILE;
  const s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE;
  return [x, y];
}
export function unproject(x, y) {
  const lon = x / TILE * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / TILE;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lon, lat];
}

/** Great-circle distance in km. */
export function haversine(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compass bearing a→b in degrees (0 = north). */
export function bearing(a, b) {
  const r = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = deg => DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

export const fmtLat = v => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'N' : 'S'}`;
export const fmtLon = v => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'E' : 'W'}`;

/** Load outline(s): official GeoJSON if present, else the region's approximate rings. */
export async function loadCounty(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const gj = await res.json();
    const geoms = gj.type === 'FeatureCollection' ? gj.features.map(f => f.geometry)
      : gj.type === 'Feature' ? [gj.geometry] : [gj];
    const rings = [];
    for (const g of geoms) {
      if (g.type === 'Polygon') rings.push(g.coordinates[0]);
      if (g.type === 'MultiPolygon') g.coordinates.forEach(p => rings.push(p[0]));
    }
    if (rings.length) return { rings, approximate: false };
  } catch { /* fall through */ }
  return { rings: fallback.map(o => o.ring), approximate: true };
}

// Place names used for "near …" labels — set per region
let PLACES = [];
export function setPlaces(list) { PLACES = list; }

export function nearestPlace(lon, lat) {
  let best = null, bd = Infinity;
  for (const [name, x, y] of PLACES) {
    const d = haversine([lon, lat], [x, y]);
    if (d < bd) { bd = d; best = name; }
  }
  return { name: best, km: bd };
}

/** Human description: "Irvine", "near Irvine", or "38 km SW of Port of LA". */
export function describePlace(lon, lat) {
  const { t, dirLabel } = I18N;
  const p = nearestPlace(lon, lat);
  if (!p.name) return fmtLat(lat) + ' ' + fmtLon(lon);
  if (p.km < 6) return p.name;
  if (p.km < 14) return t('near', { p: p.name });
  const pl = PLACES.find(q => q[0] === p.name);
  return t('kmOf', { km: Math.round(p.km), dir: dirLabel(compass(bearing([pl[1], pl[2]], [lon, lat]))), p: p.name });
}

/** Point-in-polygon (ray casting) for a ring of [lon,lat]. */
export function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

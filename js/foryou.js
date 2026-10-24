// ─────────────────────────────────────────────────────────────
//  "For you": health profile, saved places, best time outside,
//  and the incoming-pollution alert built from forecast boards
//  + the predicted trajectory.
// ─────────────────────────────────────────────────────────────
import { mean } from './data.js';
import { category, CATEGORIES } from './aqi.js';
import { describePlace } from './geo.js';
import { store } from './store.js';
import { t, catName, fmtTime } from './i18n.js';

// AQI above `avoid` → avoid outdoor activity; at or below `ok` → fine.
export const PROFILES = {
  general:   { ok: 100, avoid: 150 },
  sensitive: { ok: 50,  avoid: 100 },
  outdoor:   { ok: 50,  avoid: 100 },
};

export const getProfile = () => (PROFILES[store.get('profile')] ? store.get('profile') : 'general');
export const setProfile = p => store.set('profile', p);

// saved places are per region: [{name, lon, lat}]
export const getPlaces = region => store.get('places:' + region, []);
export function savePlace(region, place) {
  const list = getPlaces(region).filter(p => Math.hypot(p.lon - place.lon, p.lat - place.lat) > 0.01);
  list.unshift(place);
  store.set('places:' + region, list.slice(0, 6));
}
export function removePlace(region, idx) {
  const list = getPlaces(region); list.splice(idx, 1); store.set('places:' + region, list);
}

const valueAt = (f, cell) => (cell >= 0 ? f.A.aqi[cell] : mean(f.A.aqi));

export function verdict(aqi, profile) {
  const p = PROFILES[profile];
  return aqi > p.avoid ? 'avoid' : aqi > p.ok ? 'caution' : 'good';
}

/** Current slot + next 4 (≈ 24 h), from the latest observation onward. */
export function upcoming(ds, cell, profile) {
  const out = [];
  for (let i = ds.nowIndex; i < Math.min(ds.frames.length, ds.nowIndex + 5); i++) {
    const f = ds.frames[i], aqi = valueAt(f, cell);
    out.push({ i, time: f.time, aqi, v: verdict(aqi, profile), forecast: f.forecast });
  }
  return out;
}

export function bestWindow(slots) {
  if (!slots.length) return null;
  const best = slots.reduce((a, b) => (b.aqi < a.aqi ? b : a));
  return { best, allBad: slots.every(s => s.v === 'avoid') };
}

/** Does a trajectory pass within ~1.5 cells of a cell centre? */
function pathNear(path, grid, cell) {
  if (!path || cell < 0) return false;
  const [lon, lat] = grid.centers[cell];
  return path.some(([lo, la]) => Math.abs(lo - lon) <= grid.dLon * 1.5 && Math.abs(la - lat) <= grid.dLat * 1.5);
}

/**
 * Alert for the next 24 h.
 *  kind: 'heading' (path reaches you), 'rising', 'region', or 'clear'.
 */
export function incomingAlert(ds, cell, profile) {
  const p = PROFILES[profile];
  const nowAqi = valueAt(ds.frames[ds.nowIndex], cell);
  for (let i = ds.nowIndex + 1; i < Math.min(ds.frames.length, ds.nowIndex + 5); i++) {
    const f = ds.frames[i];
    if (cell >= 0) {
      const aqi = f.A.aqi[cell];
      // only alert when it gets meaningfully worse than now (crossing the limit, or +20 AQI)
      const bad = (aqi > p.avoid && nowAqi <= p.avoid) || (aqi > p.ok && aqi - nowAqi >= 20);
      if (!bad) continue;
      if (f.path && f.path.length > 1 && pathNear(f.path, ds.grid, cell)) {
        const o = f.path[0];
        return { kind: 'heading', aqi, time: f.time, i, html: t('alertHeading', { origin: describePlace(o[0], o[1]), aqi: Math.round(aqi), time: fmtTime(f.time) }) };
      }
      return { kind: 'rising', aqi, time: f.time, i, html: t('alertRising', { aqi: Math.round(aqi), cat: catName(CATEGORIES.indexOf(category(aqi))), time: fmtTime(f.time) }) };
    } else {
      let wi = -1, wv = -1;
      f.A.aqi.forEach((v, k) => { if (v > wv) { wv = v; wi = k; } });
      if (wv > p.avoid) {
        const [lon, lat] = ds.grid.centers[wi];
        return { kind: 'region', aqi: wv, time: f.time, i, cell: wi, html: t('alertRegion', { where: describePlace(lon, lat), aqi: Math.round(wv), time: fmtTime(f.time) }) };
      }
    }
  }
  if (nowAqi > p.ok) {
    return { kind: 'current', html: t('alertNow', { aqi: Math.round(nowAqi), cat: catName(CATEGORIES.indexOf(category(nowAqi))) }) };
  }
  return { kind: 'clear', html: t('alertClear') };
}

/** Short, profile-aware action tip for an AQI value. */
export function tip(aqi, profile) {
  const sens = profile !== 'general';
  if (profile === 'outdoor' && aqi > 100) return t('tips_outdoor');
  if (aqi <= 50) return t('tips_good');
  if (aqi <= 100) return t(sens ? 'tips_moderate_s' : 'tips_moderate');
  if (aqi <= 150) return t(sens ? 'tips_usg_s' : 'tips_usg');
  if (aqi <= 200) return t('tips_unh');
  return t('tips_vunh');
}

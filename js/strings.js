// ─────────────────────────────────────────────────────────────
//  UI strings (English). Every visible label lives here so
//  wording can be changed in one place.
// ─────────────────────────────────────────────────────────────

const STR = {
    tagline: 'Where your air is coming from',
    loading: 'Loading boards…',
    loadError: 'Could not load data: {msg}',
    // header / badges
    demo: 'Demo', forecast: 'Forecast', latest: 'Latest', archive: 'Archive',
    // layers
    wind: 'Wind', path: 'Path', isolines: 'Isolines', grid: 'Grid',
    satellite: 'Satellite', dark: 'Dark',
    // panel head
    cellKicker: 'Grid cell · 0.25° × 0.25°',
    regionKicker: 'Area overview · mean of {n} cells',
    back: 'Back to area overview',
    // for-you
    myLocation: 'My location', locating: 'Locating…', save: 'Save place', saved: 'Saved',
    remove: 'Remove', outside: 'You are outside the {region} map area.', noGeo: 'Location is not available in this browser.',
    geoDenied: 'Location permission was denied.',
    savedHint: 'Pick a spot on the map, then save it.',
    profile: 'For', p_general: 'Everyone', p_sensitive: 'Asthma, kids, seniors, pregnancy', p_outdoor: 'Outdoor workers',
    bestTitle: 'Best time outside',
    bestNow: 'Now is the best time in the next 24 h.',
    bestAt: 'Best window: {time} (AQI {aqi}).',
    allBad: 'No good window in the next 24 h — plan indoor activities.',
    v_good: 'Good', v_caution: 'Limit', v_avoid: 'Avoid',
    alertHeading: '<b>Pollution is heading your way</b> (origin: {origin}). AQI ≈ {aqi} by {time}.',
    alertRising: '<b>Air will get worse:</b> AQI ≈ {aqi} ({cat}) by {time}.',
    alertRegion: '<b>Unhealthy air expected {where}:</b> AQI ≈ {aqi} by {time}.',
    alertClear: 'No unhealthy air expected in the next 24 h.',
    alertNow: '<b>Air is {cat} right now (AQI {aqi}).</b> It doesn’t get worse in the next 24 h — see the best window below.',
    tips_good: 'Great day to be outside.',
    tips_moderate_s: 'Take it easier on long or hard outdoor workouts.',
    tips_moderate: 'Fine for most people.',
    tips_usg_s: 'Move exercise indoors, keep windows closed, keep rescue inhaler handy.',
    tips_usg: 'Shorten intense outdoor exercise.',
    tips_unh: 'Stay indoors with windows closed; run a HEPA purifier; wear an N95 if you must go out.',
    tips_vunh: 'Avoid going outside. N95 outdoors; HEPA indoors.',
    tips_outdoor: 'Take breaks indoors, wear an N95, drink water.',
    // hero
    drivenBy: 'Driven by <b>{p}</b> · {long}',
    // sections
    pollutants: 'Pollutants', pollutantsHint: 'sub-index · concentration', showOnMap: 'Show {p} on the map',
    worstCell: 'Worst cell', from: 'from {d}',
    aqiOverTime: 'AQI over time', thisCell: 'this cell', regionMean: 'area mean',
    pollutionPath: 'Pollution path',
    noPath: 'No trajectory was produced for this slot.',
    pathText: 'Most likely origin: <strong>{origin}</strong> ({lat}, {lon}). From there it travelled <strong>{dir}</strong> toward {end}.',
    distance: 'distance', steps: 'cell steps', aqiOriginEnd: 'AQI origin → end', focusPath: 'Focus on path',
    // tooltip
    predictedOrigin: 'Predicted origin', originOfSlot: 'Predicted origin of this slot’s pollution', onPath: 'On pollution path · step {n}',
    // legend
    usAqi: 'US AQI', legendAqiSub: 'max of pollutant sub-indices', subIndex: '{p} sub-index', epaScale: '{long} · EPA scale',
    noIndex: '{long} · µg/m³ · no EPA index', origin: 'Origin', you: 'You',
    // chart / timeline
    forecastCaps: 'FORECAST', now: 'Now',
    // places
    near: 'near {p}', kmOf: '{km} km {dir} of {p}',
    // footer
    demoNote: '<b style="color:#fbbf24">Demo data</b> — no board files were found, so a synthetic dataset in the backend’s format is shown.',
    sourceNote: 'Pollutants: OpenWeather Air Pollution API · Wind: Microsoft Aurora · US AQI computed from EPA breakpoints (PM2.5: 2024 revision) on 6-hour means. Not medical advice.',
    approxNote: 'County outline is approximate.',
    // city picker
    pickCity: 'Most polluted in California', rankSource: 'Rankings: American Lung Association, State of the Air 2026 (national rank among U.S. metro areas).',
    rankOzone: 'Ozone', rankShort: 'Short-term particles', rankAnnual: 'Year-round particles', whyHere: 'Why this city', notRanked: 'not in top 25',
  };

const CAT = [['Good', 'Good'], ['Moderate', 'Moderate'], ['Unhealthy for Sensitive Groups', 'USG'], ['Unhealthy', 'Unhealthy'], ['Very Unhealthy', 'Very unh.'], ['Hazardous', 'Hazardous']];

export const locale = () => 'en-US';

export function t(key, vars = {}) {
  const s = STR[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/** Category display helpers (index into aqi.js CATEGORIES). */
export const catName = i => CAT[i][0];
export const catShort = i => CAT[i][1];
export const catAdvice = (i, en) => en;
export const pollLong = (key, en) => en;
export const dirLabel = d => d;

export const fmtTime = (d, opts = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) =>
  d.toLocaleString(locale(), opts);

/** Fill elements carrying data-i18n / data-i18n-title / data-i18n-aria. */
export function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
}

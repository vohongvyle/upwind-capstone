// ─────────────────────────────────────────────────────────────
//  English / Spanish strings. Spanish category names follow the
//  EPA / AirNow Spanish terminology.
//  Language: ?lang=es | saved choice | browser language.
// ─────────────────────────────────────────────────────────────
import { store } from './store.js';

const DICT = {
  en: {
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
    regionKicker: 'Region overview · mean of {n} cells',
    back: 'Back to region overview',
    // for-you
    myLocation: 'My location', locating: 'Locating…', save: 'Save place', saved: 'Saved',
    remove: 'Remove', outside: 'You are outside the {region} area.', noGeo: 'Location is not available in this browser.',
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
    aqiOverTime: 'AQI over time', thisCell: 'this cell', regionMean: 'region mean',
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
    approxNote: 'County outlines are approximate.',
  },
  es: {
    tagline: 'De dónde viene tu aire',
    loading: 'Cargando datos…',
    loadError: 'No se pudieron cargar los datos: {msg}',
    demo: 'Demo', forecast: 'Pronóstico', latest: 'Actual', archive: 'Archivo',
    wind: 'Viento', path: 'Trayecto', isolines: 'Isolíneas', grid: 'Cuadrícula',
    satellite: 'Satélite', dark: 'Oscuro',
    cellKicker: 'Celda · 0.25° × 0.25°',
    regionKicker: 'Resumen de la región · promedio de {n} celdas',
    back: 'Volver al resumen',
    myLocation: 'Mi ubicación', locating: 'Ubicando…', save: 'Guardar lugar', saved: 'Guardado',
    remove: 'Quitar', outside: 'Estás fuera del área de {region}.', noGeo: 'La ubicación no está disponible en este navegador.',
    geoDenied: 'Se negó el permiso de ubicación.',
    savedHint: 'Elige un punto en el mapa y guárdalo.',
    profile: 'Para', p_general: 'Todos', p_sensitive: 'Asma, niños, mayores, embarazo', p_outdoor: 'Trabajo al aire libre',
    bestTitle: 'Mejor hora para salir',
    bestNow: 'Ahora es la mejor hora de las próximas 24 h.',
    bestAt: 'Mejor horario: {time} (AQI {aqi}).',
    allBad: 'No hay buen horario en las próximas 24 h — planea actividades bajo techo.',
    v_good: 'Bien', v_caution: 'Limitar', v_avoid: 'Evitar',
    alertHeading: '<b>La contaminación viene hacia ti</b> (origen: {origin}). AQI ≈ {aqi} para el {time}.',
    alertRising: '<b>El aire va a empeorar:</b> AQI ≈ {aqi} ({cat}) para el {time}.',
    alertRegion: '<b>Se espera aire insalubre {where}:</b> AQI ≈ {aqi} para el {time}.',
    alertClear: 'No se espera aire insalubre en las próximas 24 h.',
    alertNow: '<b>El aire está {cat} ahora (AQI {aqi}).</b> No empeora en las próximas 24 h — mira el mejor horario abajo.',
    tips_good: 'Buen día para estar afuera.',
    tips_moderate_s: 'Evita ejercicio intenso o prolongado al aire libre.',
    tips_moderate: 'Bien para la mayoría de las personas.',
    tips_usg_s: 'Haz ejercicio bajo techo, cierra las ventanas y ten tu inhalador a mano.',
    tips_usg: 'Acorta el ejercicio intenso al aire libre.',
    tips_unh: 'Quédate adentro con las ventanas cerradas; usa un purificador HEPA; usa mascarilla N95 si sales.',
    tips_vunh: 'Evita salir. N95 afuera; HEPA adentro.',
    tips_outdoor: 'Toma descansos bajo techo, usa N95 y toma agua.',
    drivenBy: 'Causado por <b>{p}</b> · {long}',
    pollutants: 'Contaminantes', pollutantsHint: 'subíndice · concentración', showOnMap: 'Mostrar {p} en el mapa',
    worstCell: 'Peor celda', from: 'del {d}',
    aqiOverTime: 'AQI en el tiempo', thisCell: 'esta celda', regionMean: 'promedio regional',
    pollutionPath: 'Trayecto de la contaminación',
    noPath: 'No se generó un trayecto para este horario.',
    pathText: 'Origen probable: <strong>{origin}</strong> ({lat}, {lon}). Desde ahí viajó hacia el <strong>{dir}</strong>, rumbo a {end}.',
    distance: 'distancia', steps: 'pasos', aqiOriginEnd: 'AQI origen → final', focusPath: 'Ver trayecto',
    predictedOrigin: 'Origen estimado', originOfSlot: 'Origen estimado de la contaminación', onPath: 'En el trayecto · paso {n}',
    usAqi: 'AQI (EE. UU.)', legendAqiSub: 'máximo de los subíndices', subIndex: 'Subíndice {p}', epaScale: '{long} · escala EPA',
    noIndex: '{long} · µg/m³ · sin índice EPA', origin: 'Origen', you: 'Tú',
    forecastCaps: 'PRONÓSTICO', now: 'Ahora',
    near: 'cerca de {p}', kmOf: 'a {km} km al {dir} de {p}',
    demoNote: '<b style="color:#fbbf24">Datos de demostración</b> — no se encontraron archivos, se muestra un conjunto sintético con el formato del backend.',
    sourceNote: 'Contaminantes: OpenWeather · Viento: Microsoft Aurora · AQI calculado con los puntos de corte de la EPA sobre promedios de 6 horas. No es consejo médico.',
    approxNote: 'Los límites de los condados son aproximados.',
  },
};

const CAT = {
  en: [['Good', 'Good'], ['Moderate', 'Moderate'], ['Unhealthy for Sensitive Groups', 'USG'], ['Unhealthy', 'Unhealthy'], ['Very Unhealthy', 'Very unh.'], ['Hazardous', 'Hazardous']],
  es: [['Buena', 'Buena'], ['Moderada', 'Moderada'], ['Insalubre para grupos sensibles', 'Insal. GS'], ['Insalubre', 'Insalubre'], ['Muy insalubre', 'Muy insal.'], ['Peligrosa', 'Peligrosa']],
};
const ADVICE_ES = [
  'La calidad del aire es satisfactoria y presenta poco o ningún riesgo.',
  'Aceptable. Las personas inusualmente sensibles deben considerar reducir el esfuerzo prolongado al aire libre.',
  'Niños, adultos mayores y personas con enfermedades del corazón o pulmones deben reducir el esfuerzo prolongado al aire libre.',
  'Todos pueden comenzar a sentir efectos. Los grupos sensibles deben evitar el esfuerzo prolongado al aire libre.',
  'Alerta de salud: todos deben reducir el esfuerzo al aire libre.',
  'Condiciones de emergencia: todos deben evitar actividades al aire libre.',
];
const POLL_LONG_ES = { aqi: 'Calidad del aire', pm2_5: 'Partículas finas', pm10: 'Partículas gruesas', o3: 'Ozono', no2: 'Dióxido de nitrógeno', co: 'Monóxido de carbono', so2: 'Dióxido de azufre', no: 'Óxido nítrico (sin AQI)' };

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'es') return q;
  const s = store.get('lang');
  if (s === 'en' || s === 'es') return s;
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export let LANG = pickLang();
export const locale = () => (LANG === 'es' ? 'es-US' : 'en-US');

export function setLang(l) { LANG = l; store.set('lang', l); document.documentElement.lang = l; applyStatic(); }

export function t(key, vars = {}) {
  const s = DICT[LANG][key] ?? DICT.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/** Category display helpers (index into aqi.js CATEGORIES). */
export const catName = i => CAT[LANG][i][0];
export const catShort = i => CAT[LANG][i][1];
export const catAdvice = (i, en) => (LANG === 'es' ? ADVICE_ES[i] : en);
export const pollLong = (key, en) => (LANG === 'es' ? POLL_LONG_ES[key] ?? en : en);
/** Compass label: Spanish uses O (oeste) for W. */
export const dirLabel = d => (LANG === 'es' ? d.replace(/W/g, 'O') : d);

export const fmtTime = (d, opts = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) =>
  d.toLocaleString(locale(), opts);

/** Fill elements carrying data-i18n / data-i18n-title / data-i18n-aria. */
export function applyStatic() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
}

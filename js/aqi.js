// ─────────────────────────────────────────────────────────────
//  US EPA Air Quality Index
//  OpenWeather's `aqi` field is its own 1–5 scale, NOT the US AQI.
//  Here we compute the real US AQI from concentrations (µg/m³, as
//  OpenWeather returns them) using EPA breakpoints (PM2.5 = 2024 revision).
//  Note: EPA defines averaging periods (24 h PM, 8 h O3/CO, 1 h NO2/SO2);
//  we apply them to the 6-hour averages the backend stores.
// ─────────────────────────────────────────────────────────────

// [C_lo, C_hi, I_lo, I_hi] in the pollutant's native AQI unit
const BP = {
  pm2_5: [[0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]],
  pm10:  [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200], [355, 424, 201, 300], [425, 604, 301, 500]],
  o3:    [[0, 54, 0, 50], [55, 70, 51, 100], [71, 85, 101, 150], [86, 105, 151, 200], [106, 200, 201, 300]],              // ppb, 8 h
  no2:   [[0, 53, 0, 50], [54, 100, 51, 100], [101, 360, 101, 150], [361, 649, 151, 200], [650, 1249, 201, 300], [1250, 2049, 301, 500]], // ppb
  so2:   [[0, 35, 0, 50], [36, 75, 51, 100], [76, 185, 101, 150], [186, 304, 151, 200], [305, 604, 201, 300], [605, 1004, 301, 500]],      // ppb
  co:    [[0, 4.4, 0, 50], [4.5, 9.4, 51, 100], [9.5, 12.4, 101, 150], [12.5, 15.4, 151, 200], [15.5, 30.4, 201, 300], [30.5, 50.4, 301, 500]], // ppm
};

// µg/m³ → AQI unit at 25 °C, 1 atm
const TO_NATIVE = {
  pm2_5: c => c,
  pm10:  c => c,
  o3:    c => c * 24.45 / 48.00,          // ppb
  no2:   c => c * 24.45 / 46.01,          // ppb
  so2:   c => c * 24.45 / 64.07,          // ppb
  co:    c => c * 24.45 / 28.01 / 1000,   // ppm
};

export const POLLUTANTS = [
  { key: 'aqi',   label: 'US AQI',  long: 'Overall air quality', unit: '' },
  { key: 'pm2_5', label: 'PM2.5',   long: 'Fine particles',      unit: 'µg/m³' },
  { key: 'pm10',  label: 'PM10',    long: 'Coarse particles',    unit: 'µg/m³' },
  { key: 'o3',    label: 'O₃',      long: 'Ozone',               unit: 'µg/m³' },
  { key: 'no2',   label: 'NO₂',     long: 'Nitrogen dioxide',    unit: 'µg/m³' },
  { key: 'co',    label: 'CO',      long: 'Carbon monoxide',     unit: 'µg/m³' },
  { key: 'so2',   label: 'SO₂',     long: 'Sulfur dioxide',      unit: 'µg/m³' },
  { key: 'no',    label: 'NO',      long: 'Nitric oxide (no AQI)', unit: 'µg/m³', noIndex: true },
];
export const INDEXED = ['pm2_5', 'pm10', 'o3', 'no2', 'co', 'so2'];

/** Sub-index for one pollutant (concentration in µg/m³). */
export function subIndex(key, conc) {
  const table = BP[key];
  if (!table || conc == null || !isFinite(conc)) return null;
  const c = Math.max(0, TO_NATIVE[key](conc));
  for (const [cl, ch, il, ih] of table) {
    if (c <= ch) return Math.round(((ih - il) / (ch - cl)) * (Math.max(c, cl) - cl) + il);
  }
  const [, ch, , ih] = table[table.length - 1];
  return Math.min(500, Math.round(ih + (c - ch) * 0.5));
}

/** Overall AQI = max sub-index. Returns {aqi, dominant, subs}. */
export function computeAQI(poll) {
  const subs = {};
  let aqi = 0, dominant = null;
  for (const k of INDEXED) {
    const s = subIndex(k, poll[k]);
    subs[k] = s;
    if (s != null && s >= aqi) { aqi = s; dominant = k; }
  }
  return { aqi, dominant, subs };
}

// Official EPA category colours
export const CATEGORIES = [
  { max: 50,  name: 'Good',                           short: 'Good',          color: '#00e400', text: '#0b2e10',
    advice: 'Air quality is satisfactory and poses little or no risk.' },
  { max: 100, name: 'Moderate',                       short: 'Moderate',      color: '#ffff00', text: '#2e2a00',
    advice: 'Acceptable. Unusually sensitive people should consider limiting prolonged outdoor exertion.' },
  { max: 150, name: 'Unhealthy for Sensitive Groups', short: 'USG',           color: '#ff7e00', text: '#2b1400',
    advice: 'Children, older adults and people with heart or lung disease should reduce prolonged outdoor exertion.' },
  { max: 200, name: 'Unhealthy',                      short: 'Unhealthy',     color: '#ff0000', text: '#fff',
    advice: 'Everyone may begin to feel effects. Sensitive groups should avoid prolonged outdoor exertion.' },
  { max: 300, name: 'Very Unhealthy',                 short: 'Very unh.', color: '#8f3f97', text: '#fff',
    advice: 'Health alert: everyone should reduce outdoor exertion.' },
  { max: 500, name: 'Hazardous',                      short: 'Hazardous',     color: '#7e0023', text: '#fff',
    advice: 'Emergency conditions: everyone should avoid outdoor activity.' },
];

export function category(aqi) {
  for (const c of CATEGORIES) if (aqi <= c.max) return c;
  return CATEGORIES[CATEGORIES.length - 1];
}

// Continuous ramp: colour stops at the centre of each category, so the
// field blends smoothly but still reads as the EPA scale.
const STOPS = [0, 25, 75, 125, 175, 250, 400, 500];
const STOP_COLORS = ['#00e400', '#00e400', '#ffff00', '#ff7e00', '#ff0000', '#8f3f97', '#7e0023', '#7e0023'];
let _ramp = null;
export function aqiRamp() {
  if (_ramp) return _ramp;
  const scale = d3.scaleLinear().domain(STOPS).range(STOP_COLORS).interpolate(d3.interpolateRgb).clamp(true);
  // 0..500 lookup table, RGB bytes
  const lut = new Uint8ClampedArray(501 * 3);
  for (let i = 0; i <= 500; i++) {
    const c = d3.rgb(scale(i));
    lut[i * 3] = c.r; lut[i * 3 + 1] = c.g; lut[i * 3 + 2] = c.b;
  }
  _ramp = { scale, lut };
  return _ramp;
}

// Sequential ramp for pollutants without an AQI (NO)
export function seqRamp(max) {
  const interp = d3.interpolateRgbBasis(['#1b3a4b', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']);
  const lut = new Uint8ClampedArray(501 * 3);
  for (let i = 0; i <= 500; i++) {
    const c = d3.rgb(interp(i / 500));
    lut[i * 3] = c.r; lut[i * 3 + 1] = c.g; lut[i * 3 + 2] = c.b;
  }
  return { lut, max, interp };
}

// ─────────────────────────────────────────────────────────────
//  Upwind — configuration
//  Everything that depends on your backend lives here.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  appName: 'Upwind',            // shown in the header and browser tab

  // 'auto' → try the real archive first, fall back to demo data if nothing loads
  // 'live' → real archive only (shows an error if nothing loads)
  // 'demo' → always use generated demo data
  mode: 'auto',

  // Regions and their data folders (served next to index.html).
  // Grid ranges, outlines and place names live in js/regions.js.
  defaultRegion: 'kern',
  regions: {
    kern: { archiveDir: 'board_archive2',      forecastDir: 'forecast',        outlineGeoJSON: 'data/kern.geojson' },
    laoc: { archiveDir: 'la_oc/board_archive', forecastDir: 'la_oc/forecast',  outlineGeoJSON: 'data/la_oc.geojson' },
  },

  // The four 6-hour slots. `label` is what the UI shows, `start`/`end` build the filename.
  slots: [
    { label: '00:00', start: '0000', end: '0600' },
    { label: '06:00', start: '0600', end: '1200' },
    { label: '12:00', start: '1200', end: '1800' },
    { label: '18:00', start: '1800', end: '0000' },
  ],

  // board_YYYY-MM-DD_HHMM-HHMM.json  (pattern described in the paper)
  boardFile: (date, slot) => `board_${date}_${slot.start}-${slot.end}.json`,

  // Evaluation / trajectory output (CSV with lon,lat columns, first row = origin).
  // Change this to whatever your backend actually writes. JSON also works
  // if it is an array of {lon, lat} or {path:[...]} / {origin:[lon,lat], path:[[lon,lat],...]}.
  evalFile: (date, slot) => `evaluation_${date}_${slot.start}-${slot.end}.csv`,

  // How much history to load (days before the most recent board), plus forecast days.
  daysBack: 3,
  forecastDays: 1,

  // Most recent observed date to look for. null = today (browser clock).
  // Set e.g. '2025-05-01' to pin the demo to the poster date.
  endDate: null,

  // Map
  // Basemaps. `dim` darkens the imagery so the AQI colours and wind stay readable.
  basemaps: {
    satellite: {
      label: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      dim: 0.38,
      fieldAlpha: 0.5,      // let the terrain show through the AQI colours
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics · Labels © OpenStreetMap, © CARTO',
    },
    dark: {
      label: 'Dark',
      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      dim: 0,
      fieldAlpha: 0.66,
      attribution: '© OpenStreetMap contributors · © CARTO',
    },
  },
  defaultBasemap: 'satellite',
  // City / road labels drawn on top of the pollution layers (works on both basemaps)
  labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
  subdomains: ['a', 'b', 'c', 'd'],
  minZoom: 6.5,
  maxZoom: 12,

  // Header links (fill in your real URLs)
  links: [
    { label: 'About team',   href: '#' },
    { label: 'Source code',  href: '#' },
    { label: 'Research paper', href: '#' },
    { label: 'Expo poster',  href: '#' },
  ],
};

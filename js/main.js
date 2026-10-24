// ─────────────────────────────────────────────────────────────
//  Upwind — app wiring
// ─────────────────────────────────────────────────────────────
import { CONFIG } from './config.js';
import { loadDataset, blendAt, cellAt } from './data.js';
import { loadCounty, setPlaces, describePlace } from './geo.js';
import { t, LANG, setLang, applyStatic, fmtTime, pollLong } from './i18n.js';
import { getPlaces, savePlace, removePlace, setProfile } from './foryou.js';
import { REGIONS, currentRegion } from './regions.js';
import { POLLUTANTS } from './aqi.js';
import { MapView } from './map.js';
import { Panel, renderLegend, renderTooltip } from './panel.js';
import { Timeline } from './timeline.js';

const $ = id => document.getElementById(id);
const state = { t: 0, layer: 'aqi', sel: -1, playing: false, speed: 1, hover: null };
const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

async function init() {
  const region = currentRegion();
  state.region = region;
  setPlaces(region.places);
  applyStatic();
  document.title = `${CONFIG.appName} · ${region.name}`;
  $('app-name').textContent = CONFIG.appName;
  $('map').setAttribute('aria-label', `${region.name} — air quality map`);
  $('regions').innerHTML = Object.values(REGIONS).map(r =>
    `<button data-region="${r.id}" aria-pressed="${r.id === region.id}">${r.short}</button>`).join('');
  $('regions').addEventListener('click', e => {
    const id = e.target.closest('[data-region]')?.dataset.region;
    if (!id || id === region.id) return;
    const u = new URL(location.href); u.searchParams.set('region', id);
    $('loading').classList.remove('done');
    location.href = u.toString();
  });

  let ds;
  try {
    ds = await loadDataset(region);
  } catch (err) {
    $('loading').innerHTML = `<span>${t('loadError', { msg: err.message })}</span>`;
    return;
  }
  const county = await loadCounty(region.outlineGeoJSON, region.outlines);
  state.ds = ds;
  state.t = ds.nowIndex;
  state.maxNo = Math.max(5, ...ds.frames.flatMap(f => Array.from(f.A.no).filter(v => !isNaN(v))));

  // ── map ──
  const map = new MapView($('map'), {
    grid: ds.grid, county,
    onHover: h => { state.hover = h; renderTooltip($('tooltip'), h, ctx()); },
    onClick: (cell) => select(cell === state.sel ? -1 : cell),
  });
  state.map = map;
  fit(false);

  // ── panel ──
  const panel = new Panel({
    onSelectLayer: k => setLayer(state.layer === k ? 'aqi' : k),
    onSeek: t => { pause(); setTime(t); },
    onFlyToPath: () => flyToPath(),
    onClose: () => select(-1),
  });
  state.panel = panel;

  // ── chips ──
  const chips = $('chips');
  for (const p of POLLUTANTS) {
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.key = p.key; b.setAttribute('role', 'radio');
    b.textContent = p.label; b.title = pollLong(p.key, p.long);
    b.addEventListener('click', () => setLayer(p.key));
    chips.appendChild(b);
  }
  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => toggle(b.dataset.toggle)));

  // ── timeline ──
  const tl = new Timeline($('tl-track'), ds, {
    onScrub: t => { pause(); setTime(t); },
    onRelease: t => setTime(Math.round(t)),
  });
  state.tl = tl;
  $('tl-play').addEventListener('click', () => (state.playing ? pause() : play()));
  $('tl-prev').addEventListener('click', () => { pause(); setTime(Math.max(0, Math.ceil(state.t) - 1)); });
  $('tl-next').addEventListener('click', () => { pause(); setTime(Math.min(ds.frames.length - 1, Math.floor(state.t) + 1)); });
  $('tl-speed').addEventListener('click', () => {
    state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
    $('tl-speed').textContent = state.speed + '×';
  });
  const dateIn = $('tl-date');
  dateIn.min = ds.frames[0].date; dateIn.max = ds.frames.at(-1).date;
  dateIn.value = ds.frames[ds.nowIndex].date;
  dateIn.addEventListener('change', () => {
    const i = ds.frames.findIndex(f => f.date === dateIn.value);
    if (i >= 0) { pause(); setTime(i); }
  });

  // ── zoom buttons ──
  $('z-in').addEventListener('click', () => map.sel.transition().duration(250).call(map.zoom.scaleBy, 1.6));
  $('z-out').addEventListener('click', () => map.sel.transition().duration(250).call(map.zoom.scaleBy, 1 / 1.6));
  $('z-fit').addEventListener('click', () => fit(true));

  // ── keyboard ──
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); state.playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') { pause(); setTime(Math.min(ds.frames.length - 1, Math.floor(state.t) + 1)); }
    else if (e.key === 'ArrowLeft') { pause(); setTime(Math.max(0, Math.ceil(state.t) - 1)); }
    else if (e.key === 'Escape') select(-1);
    else if (e.key === 'w') toggle('wind');
    else if (e.key === 'p') toggle('path');
    else if (e.key === 'g') toggle('grid');
    else if (e.key === 'b') document.querySelector('[data-basemap][aria-pressed="false"]')?.click();
  });

  // ── footer ──
  const setBase = name => {
    map.setBasemap(name);
    updateField();
    $('attrib').textContent = CONFIG.basemaps[name].attribution;
    document.querySelectorAll('[data-basemap]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.basemap === name)));
  };
  document.querySelectorAll('[data-basemap]').forEach(b => b.addEventListener('click', () => setBase(b.dataset.basemap)));
  setBase(CONFIG.defaultBasemap);
  $('links').innerHTML = CONFIG.links.map(l => `<a href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join('');
  state.approx = county.approximate;

  // ── language ──
  const syncLang = () => document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    setLang(b.dataset.lang); syncLang();
    document.querySelectorAll('.chip').forEach(c => { const p = POLLUTANTS.find(p => p.key === c.dataset.key); c.title = pollLong(p.key, p.long); });
    renderLegend(state.layer, state.maxNo); state.tl.draw(); state.tl.set(state.t);
    renderSaved(); renderAll();
  }));
  syncLang();

  // ── for you: profile, my location, saved places ──
  $('profile').addEventListener('change', e => { setProfile(e.target.value); renderAll(); });
  $('btn-locate').addEventListener('click', locate);
  $('btn-save').addEventListener('click', () => {
    if (state.sel < 0) return;
    const [lon, lat] = state.ds.grid.centers[state.sel];
    const [plon, plat] = state.selLonLat || [lon, lat];
    const name = describePlace(plon, plat).replace(/^(near|cerca de) /, '').replace(/^a? ?\d+ km .*? (of|de) /, '');
    savePlace(region.id, { name, lon: plon, lat: plat });
    state.placeName = state.panel.placeName = name;
    renderSaved(); renderAll();
  });
  renderSaved();

  setLayer('aqi');
  setTime(state.t, true);
  const saved = getPlaces(region.id);
  if (saved.length) selectPlace(saved[0]);           // open straight onto "my place"
  window.addEventListener('resize', () => renderAll());
  requestAnimationFrame(() => $('loading').classList.add('done'));
}

// ── helpers ─────────────────────────────────────────────────
function ctx() {
  const { ds } = state;
  return { ds, region: state.region, B: state.B, t: state.t, sel: state.sel, layer: state.layer, frame: ds.frames[Math.round(state.t)] };
}

function padding() {
  if (isMobile()) return { top: 146, right: 20, bottom: window.innerHeight * 0.46 + 80, left: 20 };
  return { top: 156, right: 372 + 40, bottom: 190, left: 30 };
}
function fit(animate) { state.map.fitBounds(state.ds.grid.bounds, padding(), animate); }

function flyToPath() {
  const p = state.ds.frames[Math.round(state.t)].path;
  if (!p) return;
  const g = state.ds.grid;
  const lons = p.map(d => d[0]), lats = p.map(d => d[1]);
  const b = [Math.min(...lons) - g.dLon, Math.min(...lats) - g.dLat, Math.max(...lons) + g.dLon, Math.max(...lats) + g.dLat];
  if (!state.map.show.path) toggle('path');
  state.map.fitBounds(b, padding(), true);
}

function setLayer(k) {
  state.layer = k;
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-checked', String(c.dataset.key === k)));
  renderLegend(k, state.maxNo);
  updateField();
  renderAll();
}

function toggle(name) {
  const m = state.map;
  m.show[name] = !m.show[name];
  document.querySelector(`[data-toggle="${name}"]`).classList.toggle('on', m.show[name]);
  if (name === 'wind' && m.show.wind) m.wind.clear();
}

function select(cell, name = null, lonlat = null) {
  state.sel = cell;
  state.placeName = cell >= 0 ? name : null;
  state.selLonLat = cell >= 0 ? lonlat : null;
  state.panel.placeName = state.placeName;
  state.panel.placeLonLat = state.selLonLat;
  state.map.selected = cell;
  renderAll();
}

function selectPlace(p) {
  const cell = cellAt(state.ds.grid, p.lon, p.lat);
  if (cell < 0) return;
  select(cell, p.name, [p.lon, p.lat]);
}

function placeMsg(text) {
  const el = $('place-msg');
  el.textContent = text; el.hidden = !text;
  clearTimeout(placeMsg.tm);
  if (text) placeMsg.tm = setTimeout(() => { el.hidden = true; }, 5000);
}

function locate() {
  if (!navigator.geolocation) { placeMsg(t('noGeo')); return; }
  const btn = $('btn-locate'), label = btn.querySelector('span');
  label.textContent = t('locating');
  navigator.geolocation.getCurrentPosition(pos => {
    label.textContent = t('myLocation');
    const { longitude: lon, latitude: lat } = pos.coords;
    const cell = cellAt(state.ds.grid, lon, lat);
    if (cell < 0) { placeMsg(t('outside', { region: state.region.name })); return; }
    state.map.me = [lon, lat];
    select(cell, '@me', [lon, lat]);
    state.map.fitBounds([lon - 0.9, lat - 0.55, lon + 0.9, lat + 0.55], padding(), true);
  }, err => {
    label.textContent = t('myLocation');
    placeMsg(err.code === 1 ? t('geoDenied') : t('noGeo'));
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

function renderSaved() {
  const list = getPlaces(state.region.id);
  state.map.markers = list;
  $('saved').innerHTML = list.map((p, i) => `<span class="pill saved-pill"><button data-go="${i}">${p.name}</button><button class="x" data-rm="${i}" aria-label="${t('remove')}" title="${t('remove')}">×</button></span>`).join('');
  $('saved').onclick = e => {
    const go = e.target.closest('[data-go]'), rm = e.target.closest('[data-rm]');
    if (go) selectPlace(list[+go.dataset.go]);
    if (rm) { removePlace(state.region.id, +rm.dataset.rm); renderSaved(); renderAll(); }
  };
}

let lastField = 0;
function setTime(t, force = false) {
  const { ds } = state;
  state.t = Math.max(0, Math.min(ds.frames.length - 1, t));
  state.B = blendAt(ds, state.t);
  state.tl.set(state.t);
  const frame = ds.frames[Math.round(state.t)];
  state.map.setPath(frame.path);
  state.map.setWind(state.B.u, state.B.v);
  const now = performance.now();
  if (force || !state.playing || now - lastField > 90) { updateField(); lastField = now; }
  renderAll();
}

function updateField() {
  const { B, layer } = state;
  if (!B) return;
  const p = POLLUTANTS.find(p => p.key === layer);
  if (p.noIndex) state.map.setField(B[layer], 'seq', state.maxNo);
  else state.map.setField(layer === 'aqi' ? B.aqi : B['i_' + layer], 'aqi');
}

let lastPanel = 0;
function renderAll() {
  if (!state.B || !state.panel) return;
  const c = ctx();
  // time header
  const f = c.frame;
  $('now-time').textContent = fmtTime(f.time);
  const badge = $('now-badge');
  const isNow = Math.round(state.t) === state.ds.nowIndex;
  badge.className = 'badge ' + (state.ds.demo ? 'demo' : f.forecast ? 'forecast' : isNow ? 'live' : '');
  badge.textContent = (state.ds.demo ? t('demo') + ' · ' : '') + (f.forecast ? t('forecast') : isNow ? t('latest') : t('archive'));
  // save button: only when a cell is selected and not already saved
  const saved = getPlaces(state.region.id);
  const isSaved = state.sel >= 0 && saved.some(p => cellAt(state.ds.grid, p.lon, p.lat) === state.sel);
  $('btn-save').hidden = state.sel < 0;
  $('btn-save').disabled = isSaved;
  $('btn-save').querySelector('span').textContent = isSaved ? t('saved') : t('save');
  $('p-note').innerHTML = [state.ds.demo ? t('demoNote') : '', t('sourceNote'), state.approx ? t('approxNote') : ''].filter(Boolean).join(' ');
  $('tl-date').value = f.date;
  // throttle the heavier panel while playing
  const now = performance.now();
  if (!state.playing || now - lastPanel > 120) { state.panel.update(c); lastPanel = now; }
  if (state.hover) renderTooltip($('tooltip'), state.hover, c);
}

// ── playback ────────────────────────────────────────────────
let raf = 0, last = 0;
function play() {
  state.playing = true; $('tl-play').classList.add('playing'); $('tl-play').setAttribute('aria-label', 'Pause');
  if (state.t >= state.ds.frames.length - 1) state.t = 0;
  last = performance.now();
  const step = now => {
    if (!state.playing) return;
    const dt = (now - last) / 1000; last = now;
    let t = state.t + dt * 0.9 * state.speed;       // ≈ one 6-hour slot per second at 1×
    if (t > state.ds.frames.length - 1) t = 0;
    setTime(t);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
function pause() {
  if (!state.playing) return;
  state.playing = false; cancelAnimationFrame(raf);
  $('tl-play').classList.remove('playing'); $('tl-play').setAttribute('aria-label', 'Play');
  updateField(); renderAll();
}

init();

// ─────────────────────────────────────────────────────────────
//  Side panel, AQI-over-time chart, legend, map tooltip
// ─────────────────────────────────────────────────────────────
import { POLLUTANTS, INDEXED, CATEGORIES, category } from './aqi.js';
import { mean, sample } from './data.js';
import { describePlace, haversine, bearing, compass, fmtLat, fmtLon } from './geo.js';
import { t, catName, catShort, catAdvice, pollLong, dirLabel, fmtTime, locale } from './i18n.js';
import { upcoming, bestWindow, incomingAlert, tip, getProfile } from './foryou.js';

const $ = id => document.getElementById(id);
const fmt = (v, d = 1) => (v == null || isNaN(v) ? '—' : v >= 100 ? Math.round(v).toLocaleString(locale()) : v.toFixed(d));
const ci = cat => CATEGORIES.indexOf(cat);

/** Values for the current scope (one cell or the county mean). */
export function scopeValues(B, idx) {
  const get = k => (idx >= 0 ? B[k][idx] : mean(B[k]));
  const out = { aqi: get('aqi'), u: get('u'), v: get('v') };
  for (const p of POLLUTANTS) if (p.key !== 'aqi') out[p.key] = get(p.key);
  for (const p of INDEXED) out['i_' + p] = get('i_' + p);
  let dom = null, best = -1;
  for (const p of INDEXED) if (out['i_' + p] > best) { best = out['i_' + p]; dom = p; }
  out.dominant = dom;
  return out;
}

export function windText(u, v) {
  const sp = Math.hypot(u, v);
  const toward = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;   // direction air moves toward
  return { sp, toward, from: dirLabel(compass((toward + 180) % 360)), to: dirLabel(compass(toward)) };
}

export class Panel {
  constructor({ onSelectLayer, onSeek, onFlyToPath, onClose }) {
    this.onSelectLayer = onSelectLayer; this.onSeek = onSeek;
    $('slots').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) this.onSeek(+b.dataset.i); });
    $('alert').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) this.onSeek(+b.dataset.i); });
    $('p-close').addEventListener('click', onClose);
    this.onFlyToPath = onFlyToPath;
    this.rows = new Map();
    const host = $('p-pollutants');
    for (const p of POLLUTANTS.filter(p => p.key !== 'aqi')) {
      const b = document.createElement('button');
      b.className = 'prow'; b.dataset.key = p.key;
      b.innerHTML = `<span class="pl">${p.label}</span><span class="pbar"><i></i></span><span class="pi">—</span><span class="pc">—</span>`;
      b.addEventListener('click', () => this.onSelectLayer(p.key));
      host.appendChild(b);
      this.rows.set(p.key, b);
    }
    // mobile sheet handle
    const panel = $('panel');
    $('sheet-handle').addEventListener('click', () => {
      const states = ['', 'expanded', 'collapsed'];
      const cur = panel.classList.contains('expanded') ? 1 : panel.classList.contains('collapsed') ? 2 : 0;
      const next = states[(cur + 1) % 3];
      panel.classList.remove('expanded', 'collapsed');
      document.body.classList.remove('sheet-expanded', 'sheet-collapsed');
      if (next) { panel.classList.add(next); document.body.classList.add('sheet-' + next); }
    });
    this.chart = new TrendChart($('chart'), t => this.onSeek(t));
  }

  update({ ds, region, B, t: tt, sel, layer, frame }) {
    const g = ds.grid;
    const s = scopeValues(B, sel);
    // header
    for (const [k, row] of this.rows) row.title = t('showOnMap', { p: pollLong(k, POLLUTANTS.find(p => p.key === k).long) });
    if (sel >= 0) {
      const [lon, lat] = g.centers[sel];
      $('p-kicker').textContent = this.placeName === '@me' ? t('myLocation') : this.placeName ? '★ ' + t('saved') : t('cellKicker');
      const [plon, plat] = this.placeLonLat || [lon, lat];
      const d = describePlace(plon, plat);
      $('p-title').textContent = d.charAt(0).toUpperCase() + d.slice(1);
      $('p-sub').textContent = `${fmtLat(lat)}  ${fmtLon(lon)}`;
      $('p-close').hidden = false;
      $('chart-scope').textContent = t('thisCell');
    } else {
      $('p-kicker').textContent = t('regionKicker', { n: g.nx * g.ny });
      $('p-title').textContent = region.name;
      $('p-sub').textContent = fmtTime(frame.time) + (frame.forecast ? ' · ' + t('forecast') : '');
      $('p-close').hidden = true;
      $('chart-scope').textContent = t('regionMean');
    }

    // hero
    const aqi = Math.round(s.aqi), cat = category(aqi);
    $('p-aqi').textContent = isNaN(aqi) ? '—' : aqi;
    const catEl = $('p-cat');
    catEl.textContent = ci(cat) === 2 ? catShort(2) : catName(ci(cat));
    catEl.title = catName(ci(cat)); catEl.style.background = cat.color; catEl.style.color = cat.text;
    const dom = POLLUTANTS.find(p => p.key === s.dominant);
    $('p-dom').innerHTML = dom ? t('drivenBy', { p: dom.label, long: pollLong(dom.key, dom.long).toLowerCase() }) : '';
    $('p-advice').textContent = catAdvice(ci(cat), cat.advice);
    $('p-marker').style.left = `${aqiToScale(aqi) * 100}%`;

    // pollutant rows
    for (const [k, row] of this.rows) {
      const idx = s['i_' + k], conc = s[k];
      const bar = row.querySelector('i');
      if (k === 'no') {
        bar.style.width = `${Math.min(100, (conc / 20) * 100)}%`; bar.style.background = '#64748b';
        row.querySelector('.pi').textContent = '—';
      } else {
        bar.style.width = `${Math.min(100, (idx / 200) * 100)}%`; bar.style.background = category(idx).color;
        row.querySelector('.pi').textContent = isNaN(idx) ? '—' : Math.round(idx);
      }
      row.querySelector('.pc').textContent = `${fmt(conc)} µg/m³`;
      row.classList.toggle('active', k === layer);
      row.classList.toggle('dominant', k === s.dominant);
    }

    // wind
    const w = windText(s.u, s.v);
    $('p-wind').textContent = `${w.sp.toFixed(1)} m/s`;
    $('p-wind-dir').textContent = t('from', { d: w.from });
    $('p-wind-arrow').style.transform = `rotate(${w.toward}deg)`;

    // worst cell
    let wi = -1, wv = -1;
    B.aqi.forEach((v, i) => { if (v > wv) { wv = v; wi = i; } });
    if (wi >= 0) {
      const [lon, lat] = g.centers[wi];
      $('p-worst').innerHTML = `<i style="background:${category(wv).color}"></i>${Math.round(wv)}`;
      $('p-worst-sub').textContent = describePlace(lon, lat);
    }

    // chart
    const series = ds.frames.map(f => {
      const v = sel >= 0 ? f.A.aqi[sel] : mean(f.A.aqi);
      const u = sel >= 0 ? f.A.u[sel] : mean(f.A.u), vv = sel >= 0 ? f.A.v[sel] : mean(f.A.v);
      return { time: f.time, aqi: v, u, v: vv, forecast: f.forecast };
    });
    this.chart.render(series, tt, ds.nowIndex);

    // trajectory
    this.renderPath(frame, B, g);
    this.renderForYou(ds, sel);
  }

  /** Alert banner + best-time slots + tip. Always about "now → next 24 h", not the scrubbed time. */
  renderForYou(ds, sel) {
    const profile = getProfile();
    $('profile').value = profile;
    const a = incomingAlert(ds, sel, profile);
    const al = $('alert');
    al.className = 'alert ' + a.kind;
    al.innerHTML = `<span class="al-ico" aria-hidden="true">${a.kind === 'clear' ? '✓' : '!'}</span><span>${a.html}</span>`
      + (a.i != null ? `<button class="al-go" data-i="${a.i}">${fmtTime(a.time, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} →</button>` : '');

    const slots = upcoming(ds, sel, profile);
    const bw = bestWindow(slots);
    $('slots').innerHTML = slots.map(s => {
      const c = category(s.aqi);
      const isBest = bw && s === bw.best && !bw.allBad;
      return `<button class="slot ${s.v}${isBest ? ' best' : ''}${s.forecast ? ' fc' : ''}" data-i="${s.i}" title="${fmtTime(s.time)}">
        <span class="s-t">${s.i === ds.nowIndex ? t('now') : fmtTime(s.time, { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span class="s-d">${s.i === ds.nowIndex ? '' : fmtTime(s.time, { weekday: 'short' })}</span>
        <span class="s-a" style="--c:${c.color}">${isNaN(s.aqi) ? '—' : Math.round(s.aqi)}</span>
        <span class="s-v">${t('v_' + s.v)}</span></button>`;
    }).join('');
    if (bw) {
      $('best-text').innerHTML = bw.allBad ? t('allBad')
        : bw.best.i === ds.nowIndex ? t('bestNow')
        : t('bestAt', { time: `<b>${fmtTime(bw.best.time)}</b>`, aqi: Math.round(bw.best.aqi) });
      $('tip').textContent = tip(slots[0].aqi, profile);
    }
  }

  renderPath(frame, B, g) {
    const el = $('traj-body');
    const p = frame.path;
    if (!p || !p.length) { el.innerHTML = t('noPath'); return; }
    const o = p[0], end = p.at(-1);
    let km = 0; for (let i = 1; i < p.length; i++) km += haversine(p[i - 1], p[i]);
    const dir = p.length > 1 ? dirLabel(compass(bearing(o, end))) : '—';
    const op = describePlace(o[0], o[1]), ep = describePlace(end[0], end[1]);
    const oAqi = sample(g, B.aqi, o[0], o[1]), eAqi = sample(g, B.aqi, end[0], end[1]);
    el.innerHTML = `
      <div>${t('pathText', { origin: op, lat: fmtLat(o[1]), lon: fmtLon(o[0]), dir, end: ep.replace(/^(near|cerca de) /, '') })}</div>
      <div class="traj-stats">
        <div><b>${Math.round(km)} km</b><span>${t('distance')}</span></div>
        <div><b>${p.length - 1}</b><span>${t('steps')}</span></div>
        <div><b>${isNaN(oAqi) ? '—' : Math.round(oAqi)} → ${isNaN(eAqi) ? '—' : Math.round(eAqi)}</b><span>${t('aqiOriginEnd')}</span></div>
      </div>
      <button class="btn" id="fly-path">${t('focusPath')}</button>`;
    el.querySelector('#fly-path').addEventListener('click', this.onFlyToPath);
  }
}

// EPA categories are drawn as six equal segments → map AQI to 0..1 piecewise
export function aqiToScale(aqi) {
  const edges = [0, 50, 100, 150, 200, 300, 500];
  if (isNaN(aqi)) return 0;
  for (let i = 0; i < 6; i++) if (aqi <= edges[i + 1]) return (i + (aqi - edges[i]) / (edges[i + 1] - edges[i])) / 6;
  return 1;
}

// ── Trend chart ────────────────────────────────────────────
class TrendChart {
  constructor(el, onSeek) {
    this.el = el; this.onSeek = onSeek;
    this.svg = d3.select(el).append('svg');
    this.readout = d3.select(el).append('div').attr('class', 'readout');
    const defs = this.svg.append('defs');
    const hatch = defs.append('pattern').attr('id', 'fc-hatch').attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    hatch.append('rect').attr('width', 6).attr('height', 6).attr('fill', 'rgba(196,181,253,0.05)');
    hatch.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', 'rgba(196,181,253,0.16)').attr('stroke-width', 2);
    this.gBands = this.svg.append('g'); this.gFc = this.svg.append('g');
    this.gAxis = this.svg.append('g').attr('class', 'axis'); this.gY = this.svg.append('g').attr('class', 'axis');
    this.gLine = this.svg.append('g'); this.gWind = this.svg.append('g'); this.gCur = this.svg.append('g');
    this.hit = this.svg.append('rect').attr('fill', 'transparent').style('cursor', 'crosshair');
  }

  render(series, tt, nowIndex) {
    const W = this.el.clientWidth || 330, H = 150;
    const m = { l: 28, r: 6, t: 14, b: 38 };
    const ph = H - m.t - m.b;
    this.svg.attr('width', W).attr('height', H);
    const n = series.length;
    const x = d3.scaleLinear().domain([0, n - 1]).range([m.l, W - m.r]);
    const ymax = Math.max(120, d3.max(series, d => d.aqi) * 1.15 || 0);
    const y = d3.scaleLinear().domain([0, ymax]).range([m.t + ph, m.t]).nice();

    // EPA bands
    const bands = CATEGORIES.map((c, i) => ({ lo: i ? CATEGORIES[i - 1].max : 0, hi: c.max, color: c.color })).filter(b => b.lo < y.domain()[1]);
    this.gBands.selectAll('rect').data(bands).join('rect')
      .attr('x', m.l).attr('width', W - m.l - m.r)
      .attr('y', b => y(Math.min(b.hi, y.domain()[1]))).attr('height', b => y(b.lo) - y(Math.min(b.hi, y.domain()[1])))
      .attr('fill', b => b.color).attr('opacity', 0.07);

    // forecast region
    const fi = series.findIndex(d => d.forecast);
    this.gFc.selectAll('*').remove();
    if (fi >= 0) {
      const x0 = x(Math.max(0, fi - 0.5));
      this.gFc.append('rect').attr('x', x0).attr('y', m.t).attr('width', W - m.r - x0).attr('height', ph).attr('fill', 'url(#fc-hatch)');
      this.gFc.append('text').attr('x', W - m.r - 2).attr('y', m.t - 4).attr('text-anchor', 'end')
        .attr('fill', '#c4b5fd').attr('font-size', 9.5).attr('font-weight', 600).attr('letter-spacing', '.08em').text(t('forecastCaps'));
    }

    // axes
    const days = [];
    series.forEach((d, i) => { if (i === 0 || d.time.getDate() !== series[i - 1].time.getDate()) days.push(i); });
    this.gAxis.attr('transform', `translate(0,${m.t + ph + 22})`)
      .call(d3.axisBottom(x).tickValues(days).tickSize(0).tickFormat(i => series[i].time.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('text').attr('text-anchor', 'start').attr('dy', 10));
    this.gY.attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).tickValues([0, 50, 100, 150, 200, 300].filter(v => v <= y.domain()[1])).tickSize(-(W - m.l - m.r)))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)'))
      .call(g => g.selectAll('text').attr('dx', -4));

    // line (observed solid, forecast dashed)
    const line = d3.line().defined(d => !isNaN(d.aqi)).x((d, i) => x(d.i)).y(d => y(d.aqi)).curve(d3.curveMonotoneX);
    const pts = series.map((d, i) => ({ ...d, i }));
    const obs = pts.filter(d => !d.forecast), fc = pts.filter((d, i) => d.forecast || (pts[i + 1] && pts[i + 1].forecast));
    this.gLine.selectAll('path').data([obs, fc]).join('path')
      .attr('d', d => line(d)).attr('fill', 'none').attr('stroke', (d, i) => (i ? '#c4b5fd' : '#e7edf3'))
      .attr('stroke-width', 1.8).attr('stroke-dasharray', (d, i) => (i ? '4 3' : null));
    this.gLine.selectAll('circle').data(pts).join('circle')
      .attr('cx', d => x(d.i)).attr('cy', d => y(d.aqi)).attr('r', 2.3)
      .attr('fill', d => category(d.aqi).color).attr('stroke', '#0b0f14').attr('stroke-width', 1);

    // wind arrows strip
    const wy = m.t + ph + 9;
    this.gWind.selectAll('path').data(pts).join('path')
      .attr('d', 'M0,-4.5 L3,3 L0,1.5 L-3,3 Z')
      .attr('transform', d => `translate(${x(d.i)},${wy}) rotate(${windText(d.u, d.v).toward})`)
      .attr('fill', 'rgba(226,240,255,0.55)');

    // cursor
    const cx = x(tt);
    const val = interp(series, tt);
    this.gCur.selectAll('*').remove();
    this.gCur.append('line').attr('x1', cx).attr('x2', cx).attr('y1', m.t).attr('y2', m.t + ph).attr('stroke', '#5eead4').attr('stroke-width', 1.2);
    if (!isNaN(val)) this.gCur.append('circle').attr('cx', cx).attr('cy', y(val)).attr('r', 4.5).attr('fill', '#5eead4').attr('stroke', '#0b0f14').attr('stroke-width', 2);
    if (nowIndex >= 0 && nowIndex < n) {
      this.gCur.append('line').attr('x1', x(nowIndex)).attr('x2', x(nowIndex)).attr('y1', m.t).attr('y2', m.t + ph)
        .attr('stroke', 'rgba(255,255,255,0.35)').attr('stroke-dasharray', '2 3');
    }

    // interaction
    this.hit.attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', ph + 18)
      .on('pointermove', e => {
        const i = Math.round(x.invert(d3.pointer(e)[0])), d = series[Math.max(0, Math.min(n - 1, i))];
        this.readout.text(`${fmtTime(d.time, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} · AQI ${isNaN(d.aqi) ? '—' : Math.round(d.aqi)}`);
      })
      .on('pointerleave', () => this.readout.text(''))
      .on('click', e => this.onSeek(Math.max(0, Math.min(n - 1, Math.round(x.invert(d3.pointer(e)[0]))))));
  }
}

function interp(series, t) {
  const i = Math.floor(t), f = t - i;
  const a = series[i]?.aqi, b = series[Math.min(series.length - 1, i + 1)]?.aqi;
  return a + (b - a) * f;
}

// ── Legend ────────────────────────────────────────────────
export function renderLegend(layer, maxNo) {
  const el = $('legend');
  const p = POLLUTANTS.find(p => p.key === layer);
  const keys = `<div class="keys"><span><i class="k-origin"></i>${t('origin')}</span><span><i class="k-path"></i>${t('path')}</span><span><i class="k-wind"></i>${t('wind')}</span><span><i class="k-you"></i>${t('you')}</span></div>`;
  const long = pollLong(p.key, p.long);
  if (p.noIndex) {
    const ticks = d3.ticks(0, maxNo, 4);
    el.innerHTML = `<div class="lt">${p.label} <span>${t('noIndex', { long: long.replace(/ \((no AQI|sin AQI)\)/, '') })}</span></div>
      <div class="grad" style="background:linear-gradient(90deg,#1b3a4b,#2a9d8f,#e9c46a,#f4a261,#e76f51)"></div>
      <div class="gticks">${ticks.map(t => `<span>${t}</span>`).join('')}</div>${keys}`;
    return;
  }
  const title = layer === 'aqi' ? t('usAqi') : t('subIndex', { p: p.label });
  const sub = layer === 'aqi' ? t('legendAqiSub') : t('epaScale', { long });
  el.innerHTML = `<div class="lt">${title} <span>${sub}</span></div>
    <div class="segs">${CATEGORIES.map(c => `<i style="background:${c.color}"></i>`).join('')}</div>
    <div class="ticks">${[0, 51, 101, 151, 201, 301].map(v => `<span>${v}</span>`).join('')}</div>
    <div class="names">${CATEGORIES.map((c, i) => `<span>${catShort(i)}</span>`).join('')}</div>${keys}`;
}

// ── Tooltip ───────────────────────────────────────────────
export function renderTooltip(el, h, { ds, B, layer, frame }) {
  if (!h) { el.hidden = true; return; }
  const g = ds.grid;
  const aqi = sample(g, B.aqi, h.lon, h.lat);
  if (isNaN(aqi)) { el.hidden = true; return; }
  const p = POLLUTANTS.find(p => p.key === layer);
  const cat = category(aqi);
  const u = sample(g, B.u, h.lon, h.lat), v = sample(g, B.v, h.lon, h.lat);
  const w = windText(u, v);
  let rows = '';
  if (layer !== 'aqi') {
    const conc = sample(g, B[layer], h.lon, h.lat);
    const si = p.noIndex ? null : sample(g, B['i_' + layer], h.lon, h.lat);
    rows += `<div class="tt-r"><span>${p.label}</span><b>${fmt(conc)} µg/m³${si != null ? ` · ${Math.round(si)}` : ''}</b></div>`;
  } else {
    rows += `<div class="tt-r"><span>PM2.5</span><b>${fmt(sample(g, B.pm2_5, h.lon, h.lat))} µg/m³</b></div>`;
    rows += `<div class="tt-r"><span>O₃</span><b>${fmt(sample(g, B.o3, h.lon, h.lat))} µg/m³</b></div>`;
  }
  rows += `<div class="tt-r"><span>${t('wind')}</span><b>${w.sp.toFixed(1)} m/s → ${w.to}</b></div>`;
  let onPath = '';
  if (frame.path) {
    const ci = h.cell, [clon, clat] = g.centers[ci];
    const step = frame.path.findIndex(([lo, la]) => Math.abs(lo - clon) < g.dLon / 2 && Math.abs(la - clat) < g.dLat / 2);
    if (step === 0) onPath = t('originOfSlot');
    else if (step > 0) onPath = t('onPath', { n: step });
  }
  el.innerHTML = `
    <div class="tt-h"><span class="tt-v">${Math.round(aqi)}</span><span class="tt-c" style="background:${cat.color};color:${cat.text}">${catShort(ci(cat))}</span></div>
    ${rows}
    <div class="tt-p">${describePlace(h.lon, h.lat)} · ${fmtLat(h.lat)} ${fmtLon(h.lon)}${onPath ? `<br><span style="color:var(--accent)">${onPath}</span>` : ''}</div>`;
  el.hidden = false;
  const r = el.getBoundingClientRect();
  let x = h.x + 16, y = h.y + 16;
  if (x + r.width > window.innerWidth - 8) x = h.x - r.width - 16;
  if (y + r.height > window.innerHeight - 8) y = h.y - r.height - 16;
  el.style.left = x + 'px'; el.style.top = y + 'px';
}

// ─────────────────────────────────────────────────────────────
//  MapView — a small, dependency-free slippy map on <canvas>
//  (d3-zoom for pan/zoom). Layers, bottom → top:
//    base tiles · AQI field · contours · wind particles ·
//    overlay (county, grid, path, origin, selection) · label tiles
// ─────────────────────────────────────────────────────────────
import { project, unproject } from './geo.js';
import { CONFIG } from './config.js';
import { sample, cellAt, cr } from './data.js';
import { aqiRamp, seqRamp } from './aqi.js';
import { WindLayer } from './wind.js';
import { t as tr } from './i18n.js';

const FIELD_W = 520;              // field bitmap resolution (px across the grid)
const FIELD_ALPHA_IN = 0.66;      // inside county
const FIELD_ALPHA_OUT = 0.16;     // grid area outside county
const PATH = '#5eead4';           // trajectory accent

export class MapView {
  constructor(root, { grid, county, onHover, onClick }) {
    this.root = root;
    this.grid = grid;
    this.county = county;
    this.onHover = onHover; this.onClick = onClick;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.k = 1; this.tx = 0; this.ty = 0;
    this.tiles = new Map();
    this.show = { wind: true, path: true, contours: true, grid: false };
    this.basemap = CONFIG.basemaps[CONFIG.defaultBasemap];
    this.path = null; this.hover = -1; this.selected = -1;
    this.markers = []; this.me = null;   // saved places [{name,lon,lat}], my location [lon,lat]
    this.contours = [];
    this.t0 = performance.now();

    const mk = cls => { const c = document.createElement('canvas'); c.className = 'map-layer ' + cls; root.appendChild(c); return c; };
    this.cBase = mk('base'); this.cField = mk('field'); this.cWind = mk('wind');
    this.cOver = mk('overlay'); this.cLabel = mk('labels');
    this.ctxBase = this.cBase.getContext('2d'); this.ctxField = this.cField.getContext('2d');
    this.ctxOver = this.cOver.getContext('2d'); this.ctxLabel = this.cLabel.getContext('2d');
    this.wind = new WindLayer(this.cWind, this);

    this.fieldCanvas = document.createElement('canvas');
    this.buildMask();
    this.resize();

    // pan / zoom
    const wb = [project(-125, 39), project(-113, 32)];
    this.zoom = d3.zoom()
      .scaleExtent([2 ** CONFIG.minZoom, 2 ** CONFIG.maxZoom])
      .translateExtent(wb)
      .on('start', () => root.classList.add('dragging'))
      .on('zoom', e => this.setTransform(e.transform))
      .on('end', () => root.classList.remove('dragging'));
    this.sel = d3.select(root).call(this.zoom).on('dblclick.zoom', null);

    root.addEventListener('pointermove', e => this.pointer(e));
    root.addEventListener('pointerleave', () => { this.hover = -1; this.onHover?.(null); });
    root.addEventListener('click', e => {
      if (e.defaultPrevented) return;
      const [lon, lat] = this.fromEvent(e);
      this.onClick?.(cellAt(this.grid, lon, lat), lon, lat);
    });
    window.addEventListener('resize', () => { this.resize(); this.wind.reseed(); });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ── geometry ───────────────────────────────────────────────
  toScreen(lon, lat) { const [x, y] = project(lon, lat); return [x * this.k + this.tx, y * this.k + this.ty]; }
  fromScreen(x, y) { return unproject((x - this.tx) / this.k, (y - this.ty) / this.k); }
  fromEvent(e) { const r = this.root.getBoundingClientRect(); return this.fromScreen(e.clientX - r.left, e.clientY - r.top); }

  resize() {
    const r = this.root.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    for (const c of [this.cBase, this.cField, this.cWind, this.cOver, this.cLabel]) {
      c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
      c.style.width = this.W + 'px'; c.style.height = this.H + 'px';
    }
    this.redrawStatic();
  }

  /** Fit lon/lat bounds into the viewport with CSS-pixel padding {top,right,bottom,left}. */
  fitBounds([w, s, e, n], pad, animate = false) {
    const a = project(w, n), b = project(e, s);
    const bw = b[0] - a[0], bh = b[1] - a[1];
    const aw = this.W - pad.left - pad.right, ah = this.H - pad.top - pad.bottom;
    const k = Math.min(aw / bw, ah / bh);
    const x = pad.left + (aw - bw * k) / 2 - a[0] * k;
    const y = pad.top + (ah - bh * k) / 2 - a[1] * k;
    const t = d3.zoomIdentity.translate(x, y).scale(k);
    (animate ? this.sel.transition().duration(700).ease(d3.easeCubicOut) : this.sel).call(this.zoom.transform, t);
  }

  setTransform(t) {
    this.k = t.k; this.tx = t.x; this.ty = t.y;
    this.wind.clear();
    this.redrawStatic();
  }

  redrawStatic() {
    this.drawTiles(this.ctxBase, this.basemap.url, true);
    this.drawTiles(this.ctxLabel, CONFIG.labels, false);
    this.drawField();
  }

  // ── tiles ──────────────────────────────────────────────────
  tile(tpl, z, x, y) {
    const key = `${tpl}|${z}/${x}/${y}`;
    let t = this.tiles.get(key);
    if (!t) {
      const n = 2 ** z, xx = ((x % n) + n) % n;
      const s = CONFIG.subdomains[(xx + y) % CONFIG.subdomains.length];
      const url = tpl.replace('{s}', s).replace('{z}', z).replace('{x}', xx).replace('{y}', y)
        .replace('{r}', this.dpr > 1 ? '@2x' : '');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      t = { img, ok: false };
      img.onload = () => { t.ok = true; this.queueStatic(); };
      img.onerror = () => { t.failed = true; };
      img.src = url;
      this.tiles.set(key, t);
    }
    return t;
  }

  queueStatic() {
    if (this._q) return;
    this._q = requestAnimationFrame(() => {
      this._q = null;
      this.drawTiles(this.ctxBase, this.basemap.url, true);
      this.drawTiles(this.ctxLabel, CONFIG.labels, false);
    });
  }

  drawTiles(ctx, tpl, isBase) {
    const { dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (isBase) { ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--map-bg') || '#0b0f14'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const z = Math.max(0, Math.min(18, Math.round(Math.log2(this.k))));
    const n = 2 ** z, size = 256 * this.k / n;
    const [x0, y0] = [(-this.tx) / this.k * n / 256, (-this.ty) / this.k * n / 256];
    const [x1, y1] = [(this.W - this.tx) / this.k * n / 256, (this.H - this.ty) / this.k * n / 256];
    let allFailed = true;
    for (let ty = Math.floor(y0); ty < Math.ceil(y1); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(x0); tx < Math.ceil(x1); tx++) {
        const sx = tx * size + this.tx, sy = ty * size + this.ty;
        const t = this.tile(tpl, z, tx, ty);
        if (!t.failed) allFailed = false;
        if (t.ok) { ctx.drawImage(t.img, sx, sy, size + 0.5, size + 0.5); continue; }
        // parent fallback while loading
        for (let up = 1; up <= 4; up++) {
          const pz = z - up; if (pz < 0) break;
          const key = `${tpl}|${pz}/${tx >> up}/${ty >> up}`;
          const p = this.tiles.get(key);
          if (p && p.ok) {
            const f = 2 ** up, src = p.img.naturalWidth / f;
            ctx.drawImage(p.img, (tx % f) * src, (ty % f) * src, src, src, sx, sy, size + 0.5, size + 0.5);
            break;
          }
        }
      }
    }
    if (isBase && this.basemap.dim) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(6, 10, 14, ${this.basemap.dim})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (isBase && allFailed) this.drawGraticule(ctx);
  }

  /** Offline fallback: a faint graticule so the map never looks broken. */
  drawGraticule(ctx) {
    ctx.strokeStyle = 'rgba(148,163,184,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = -126; lon <= -112; lon += 0.5) { const a = this.toScreen(lon, 30), b = this.toScreen(lon, 40); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    for (let lat = 30; lat <= 40; lat += 0.5) { const a = this.toScreen(-126, lat), b = this.toScreen(-112, lat); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke();
  }

  // ── county mask (rasterised once at field resolution) ─────
  buildMask() {
    const [w, s, e, n] = this.grid.bounds;
    const a = project(w, n), b = project(e, s);
    this.fw = FIELD_W;
    this.fh = Math.round(FIELD_W * (b[1] - a[1]) / (b[0] - a[0]));
    this.fieldCanvas.width = this.fw; this.fieldCanvas.height = this.fh;
    const m = document.createElement('canvas'); m.width = this.fw; m.height = this.fh;
    const c = m.getContext('2d');
    const sx = this.fw / (b[0] - a[0]), sy = this.fh / (b[1] - a[1]);
    c.fillStyle = '#fff';
    c.filter = 'blur(1.2px)';
    c.beginPath();
    for (const ring of this.county.rings) ring.forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat); const px = (x - a[0]) * sx, py = (y - a[1]) * sy;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    });
    c.fill();
    const d = c.getImageData(0, 0, this.fw, this.fh).data;
    this.mask = new Float32Array(this.fw * this.fh);
    for (let i = 0; i < this.mask.length; i++) this.mask[i] = d[i * 4 + 3] / 255;
    // precompute lon/lat for each pixel
    this.pxLon = new Float32Array(this.fw); this.pxLat = new Float32Array(this.fh);
    for (let x = 0; x < this.fw; x++) this.pxLon[x] = unproject(a[0] + (x + 0.5) / sx, a[1])[0];
    for (let y = 0; y < this.fh; y++) this.pxLat[y] = unproject(a[0], a[1] + (y + 0.5) / sy)[1];
    // separable bicubic: lon only depends on x, lat only on y → precompute grid index + fraction
    const g = this.grid;
    const axis = (vals, origin, step, n) => {
      const I = new Int16Array(vals.length), F = new Float32Array(vals.length);
      vals.forEach((v, k) => {
        const c = Math.max(0, Math.min(n - 1, (v - origin) / step));
        I[k] = Math.max(0, Math.min(n - 2, Math.floor(c))); F[k] = c - I[k];
      });
      return { I, F };
    };
    this.ax = axis(this.pxLon, g.lons[0], g.dLon, g.nx);
    this.ay = axis(this.pxLat, g.lats[0], g.dLat, g.ny);
  }

  /** Fast bicubic upsampling of a cell array onto the field bitmap (fw × fh). */
  upsample(values) {
    const g = this.grid, { fw, fh } = this, nx = g.nx, ny = g.ny;
    const at = (i, j) => values[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
    const rows = new Float32Array(ny * fw);
    for (let j = 0; j < ny; j++) for (let x = 0; x < fw; x++) {
      const i = this.ax.I[x];
      rows[j * fw + x] = cr(at(i - 1, j), at(i, j), at(i + 1, j), at(i + 2, j), this.ax.F[x]);
    }
    const out = new Float32Array(fw * fh);
    const R = j => Math.max(0, Math.min(ny - 1, j)) * fw;
    for (let y = 0; y < fh; y++) {
      const j = this.ay.I[y], f = this.ay.F[y];
      const r0 = R(j - 1), r1 = R(j), r2 = R(j + 1), r3 = R(j + 2), o = y * fw;
      for (let x = 0; x < fw; x++) out[o + x] = cr(rows[r0 + x], rows[r1 + x], rows[r2 + x], rows[r3 + x], f);
    }
    return out;
  }

  // ── field ──────────────────────────────────────────────────
  /** values: Float32Array per cell; mode: 'aqi' (0–500 EPA ramp) or 'seq' (0–max). */
  setField(values, mode, max) {
    const g = this.grid, ctx = this.fieldCanvas.getContext('2d');
    const img = ctx.createImageData(this.fw, this.fh), D = img.data;
    const lut = mode === 'aqi' ? aqiRamp().lut : seqRamp(max).lut;
    const [w, s, e, n] = g.bounds;
    const aIn = this.basemap.fieldAlpha ?? FIELD_ALPHA_IN;
    const featherLon = g.dLon * 0.35, featherLat = g.dLat * 0.35;
    const up = this.upsample(values);
    for (let y = 0; y < this.fh; y++) {
      const lat = this.pxLat[y];
      const fy = Math.min(1, Math.min(lat - s, n - lat) / featherLat);
      for (let x = 0; x < this.fw; x++) {
        const lon = this.pxLon[x];
        const v = up[y * this.fw + x];
        const i = y * this.fw + x, o = i * 4;
        if (isNaN(v)) { D[o + 3] = 0; continue; }
        const idx = Math.max(0, Math.min(500, Math.round(mode === 'aqi' ? v : v / max * 500)));
        D[o] = lut[idx * 3]; D[o + 1] = lut[idx * 3 + 1]; D[o + 2] = lut[idx * 3 + 2];
        const fx = Math.min(1, Math.min(lon - w, e - lon) / featherLon);
        const m = this.mask[i];
        D[o + 3] = 255 * Math.max(0, Math.min(fx, fy)) * (FIELD_ALPHA_OUT + (aIn - FIELD_ALPHA_OUT) * m);
      }
    }
    ctx.putImageData(img, 0, 0);
    this.buildContours(values, mode, max);
    this.drawField();
  }

  drawField() {
    const ctx = this.ctxField;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!this.fw) return;
    const [w, s, e, n] = this.grid.bounds;
    const a = this.toScreen(w, n), b = this.toScreen(e, s);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.fieldCanvas, a[0], a[1], b[0] - a[0], b[1] - a[1]);
  }

  // ── contours (isolines at category boundaries) ────────────
  buildContours(values, mode, max) {
    const g = this.grid, cw = 140, ch = Math.round(140 * (g.bounds[3] - g.bounds[1]) / (g.bounds[2] - g.bounds[0]));
    const [w, s, e, n] = g.bounds;
    const grid = new Float64Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const v = sample(g, values, w + (x + 0.5) / cw * (e - w), n - (y + 0.5) / ch * (n - s));
      grid[y * cw + x] = isNaN(v) ? -1 : v;
    }
    const th = mode === 'aqi' ? [50, 100, 150, 200, 300] : d3.ticks(0, max, 5).slice(1, -1);
    const polys = d3.contours().size([cw, ch]).thresholds(th)(grid);
    const toLL = ([x, y]) => [w + x / cw * (e - w), n - y / ch * (n - s)];
    const edge = ([x, y]) => x <= 0.6 || y <= 0.6 || x >= cw - 0.6 || y >= ch - 0.6;
    this.contours = polys.map(p => ({
      value: p.value,
      lines: p.coordinates.flatMap(poly => poly.map(ring => ring.map(pt => ({ ll: toLL(pt), edge: edge(pt) })))),
    }));
  }

  setBasemap(name) {
    this.basemap = CONFIG.basemaps[name];
    this.redrawStatic();
  }

  setPath(path) { this.path = path && path.length > 1 ? path : (path && path.length === 1 ? path : null); }
  setWind(u, v) { this.wind.setField(this.grid, u, v); }

  pointer(e) {
    const [lon, lat] = this.fromEvent(e);
    const c = cellAt(this.grid, lon, lat);
    this.hover = c;
    const r = this.root.getBoundingClientRect();
    this.onHover?.(c < 0 ? null : { cell: c, lon, lat, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  // ── per-frame overlay ─────────────────────────────────────
  loop(now) {
    if (this.show.wind) this.wind.frame(); else if (!this._windCleared) { this.wind.clear(); }
    this._windCleared = !this.show.wind;
    this.drawOverlay((now - this.t0) / 1000);
    requestAnimationFrame(this.loop);
  }

  ringPath(ctx, ring) {
    ring.forEach(([lon, lat], i) => { const [x, y] = this.toScreen(lon, lat); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  }

  cellRect(idx) {
    const g = this.grid, i = idx % g.nx, j = Math.floor(idx / g.nx);
    const lon = g.lons[i], lat = g.lats[j];
    const a = this.toScreen(lon - g.dLon / 2, lat + g.dLat / 2), b = this.toScreen(lon + g.dLon / 2, lat - g.dLat / 2);
    return [a[0], a[1], b[0] - a[0], b[1] - a[1]];
  }

  drawOverlay(t) {
    const ctx = this.ctxOver, { dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // grid
    if (this.show.grid) {
      const g = this.grid; ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= g.nx; i++) { const lon = g.bounds[0] + i * g.dLon; const a = this.toScreen(lon, g.bounds[1]), b = this.toScreen(lon, g.bounds[3]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let j = 0; j <= g.ny; j++) { const lat = g.bounds[1] + j * g.dLat; const a = this.toScreen(g.bounds[0], lat), b = this.toScreen(g.bounds[2], lat); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
    }

    // contours, clipped to the county
    if (this.show.contours && this.contours.length) {
      ctx.save();
      ctx.beginPath(); this.county.rings.forEach(r => this.ringPath(ctx, r)); ctx.clip();
      ctx.lineWidth = 1; ctx.setLineDash([]);
      for (const c of this.contours) {
        ctx.strokeStyle = `rgba(255,255,255,${c.value >= 150 ? 0.42 : 0.26})`;
        ctx.beginPath();
        for (const line of c.lines) {
          let pen = false;
          for (let i = 0; i < line.length; i++) {
            const p = line[i];
            if (p.edge && (i === 0 || line[i - 1].edge)) { pen = false; continue; }
            const [x, y] = this.toScreen(p.ll[0], p.ll[1]);
            pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // county outline
    ctx.save();
    ctx.beginPath(); this.county.rings.forEach(r => this.ringPath(ctx, r));
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(241,245,249,0.75)'; ctx.lineWidth = 1.3; ctx.setLineDash([]); ctx.stroke();
    ctx.restore();

    // hover + selection
    if (this.hover >= 0 && this.hover !== this.selected) {
      const [x, y, w, h] = this.cellRect(this.hover);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    if (this.selected >= 0) {
      const [x, y, w, h] = this.cellRect(this.selected);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.strokeRect(x, y, w, h);
    }

    if (this.show.path && this.path) this.drawPath(ctx, t);
    this.drawMarkers(ctx, t);
  }

  drawMarkers(ctx, t) {
    ctx.save();
    ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const m of this.markers) {
      const [x, y] = this.toScreen(m.lon, m.lat);
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0b0f14'; ctx.stroke();
      const tw = ctx.measureText(m.name).width;
      ctx.fillStyle = 'rgba(11,15,20,0.82)'; roundRect(ctx, x + 9, y - 10, tw + 12, 20, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(m.name, x + 15, y + 0.5);
    }
    if (this.me) {
      const [x, y] = this.toScreen(this.me[0], this.me[1]);
      const p = (t * 0.8) % 1;
      ctx.beginPath(); ctx.arc(x, y, 8 + p * 16, 0, Math.PI * 2); ctx.fillStyle = `rgba(59,130,246,${0.35 * (1 - p)})`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = '#3b82f6'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    ctx.restore();
  }

  drawPath(ctx, t) {
    const pts = this.path.map(([lon, lat]) => this.toScreen(lon, lat));
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    if (pts.length > 1) {
      // halo + core
      const line = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
      line(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 7; ctx.stroke();
      line(); ctx.strokeStyle = 'rgba(94,234,212,0.28)'; ctx.lineWidth = 9; ctx.shadowColor = PATH; ctx.shadowBlur = 14; ctx.stroke();
      ctx.shadowBlur = 0;
      // flowing dashes show direction of travel
      line(); ctx.strokeStyle = PATH; ctx.lineWidth = 2.4; ctx.setLineDash([2, 9]); ctx.lineDashOffset = -t * 22; ctx.stroke();
      ctx.setLineDash([]);

      // arrowheads at segment midpoints
      ctx.fillStyle = PATH;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0); if (len < 28) continue;
        const a = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        ctx.save(); ctx.translate(mx, my); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 5); ctx.closePath();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fill();
        ctx.restore();
      }

      // nodes
      for (let i = 1; i < pts.length; i++) {
        ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], i === pts.length - 1 ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = '#0b1215'; ctx.fill(); ctx.strokeStyle = PATH; ctx.lineWidth = 1.6; ctx.stroke();
      }

      // comet travelling origin → end
      const seg = []; let total = 0;
      for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
      const phase = ((t * 0.32) % 1.25);
      if (phase <= 1 && total > 0) {
        let d = phase * total, i = 0;
        while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
        const f = seg[i] ? d / seg[i] : 0;
        const cx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, cy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.25, 'rgba(94,234,212,0.7)'); gr.addColorStop(1, 'rgba(94,234,212,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
      }
    }

    // origin: pulsing rings + core + label
    const [ox, oy] = pts[0];
    for (let r = 0; r < 2; r++) {
      const p = ((t * 0.7 + r * 0.5) % 1);
      ctx.beginPath(); ctx.arc(ox, oy, 6 + p * 26, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(94,234,212,${0.65 * (1 - p)})`; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fillStyle = PATH; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#06100f'; ctx.stroke();
    ctx.beginPath(); ctx.arc(ox, oy, 2.4, 0, Math.PI * 2); ctx.fillStyle = '#06100f'; ctx.fill();

    const label = tr('predictedOrigin');
    ctx.font = '600 11.5px "IBM Plex Sans", system-ui, sans-serif';
    const tw = ctx.measureText(label).width, lx = ox + 14, ly = oy - 26;
    ctx.fillStyle = 'rgba(6,16,15,0.86)';
    roundRect(ctx, lx, ly, tw + 16, 22, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(94,234,212,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = PATH; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + 8, ly + 11.5);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

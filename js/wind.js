// ─────────────────────────────────────────────────────────────
//  Animated wind particles (earth.nullschool / windy style).
//  Particles live in lon/lat, are advected by the bicubic-sampled
//  u/v field and drawn as fading trails on their own canvas.
// ─────────────────────────────────────────────────────────────
import { sample } from './data.js';

const MAX_AGE = [50, 110];
const SPEED_PX = 0.55;     // screen px per frame per (m/s)

export class WindLayer {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = view;
    this.particles = [];
    this.grid = null; this.u = null; this.v = null;
    this.enabled = true;
  }

  setField(grid, u, v) {
    this.grid = grid; this.u = u; this.v = v;
    if (!this.particles.length) this.reseed();
  }

  /** Particle count scales with how large the grid is on screen. */
  reseed() {
    if (!this.grid) return;
    const [w, s, e, n] = this.grid.bounds;
    const a = this.view.toScreen(w, n), b = this.view.toScreen(e, s);
    const area = Math.abs((b[0] - a[0]) * (b[1] - a[1]));
    const count = Math.max(300, Math.min(4200, Math.round(area / 260)));
    this.particles = Array.from({ length: count }, () => this.spawn({}, true));
  }

  spawn(p, randomAge = false) {
    const [w, s, e, n] = this.grid.bounds;
    p.lon = w + Math.random() * (e - w);
    p.lat = s + Math.random() * (n - s);
    p.max = MAX_AGE[0] + Math.random() * (MAX_AGE[1] - MAX_AGE[0]);
    p.age = randomAge ? Math.random() * p.max : 0;
    return p;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  frame() {
    const { ctx, canvas } = this;
    if (!this.enabled || !this.grid) { return; }
    const dpr = this.view.dpr;

    // fade existing trails
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.91)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    const K = this.view.k * 256 / 360;  // px per degree longitude
    const buckets = [[], [], [], []];   // batch by speed for fewer stroke() calls

    for (const p of this.particles) {
      const u = sample(this.grid, this.u, p.lon, p.lat);
      const v = sample(this.grid, this.v, p.lon, p.lat);
      if (isNaN(u) || isNaN(v) || p.age++ > p.max) { this.spawn(p); continue; }
      const sp = Math.hypot(u, v);
      const c = SPEED_PX * dpr;
      const nlon = p.lon + (u * c) / (K * dpr);
      const nlat = p.lat + (v * c * Math.cos(p.lat * Math.PI / 180)) / (K * dpr);
      const a = this.view.toScreen(p.lon, p.lat), b = this.view.toScreen(nlon, nlat);
      const bi = sp < 1.2 ? 0 : sp < 2.2 ? 1 : sp < 3.4 ? 2 : 3;
      buckets[bi].push(a[0] * dpr, a[1] * dpr, b[0] * dpr, b[1] * dpr);
      p.lon = nlon; p.lat = nlat;
    }

    ctx.lineWidth = 1.15 * dpr;
    ctx.lineCap = 'round';
    const alphas = [0.38, 0.55, 0.72, 0.9];
    buckets.forEach((seg, i) => {
      if (!seg.length) return;
      ctx.strokeStyle = `rgba(226, 240, 255, ${alphas[i]})`;
      ctx.beginPath();
      for (let j = 0; j < seg.length; j += 4) { ctx.moveTo(seg[j], seg[j + 1]); ctx.lineTo(seg[j + 2], seg[j + 3]); }
      ctx.stroke();
    });
  }
}

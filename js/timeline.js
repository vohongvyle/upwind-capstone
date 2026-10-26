// ─────────────────────────────────────────────────────────────
//  Timeline scrubber: day labels, 6-hour ticks, county-AQI heat
//  strip, forecast region, "now" marker, draggable playhead.
// ─────────────────────────────────────────────────────────────
import { mean } from './data.js';
import { category } from './aqi.js';
import { t as tr, fmtTime, locale } from './strings.js';

export class Timeline {
  constructor(el, ds, { onScrub, onRelease }) {
    this.el = el; this.ds = ds; this.onScrub = onScrub; this.onRelease = onRelease;
    this.svg = d3.select(el).append('svg');
    this.hover = d3.select(el).append('div').attr('class', 'tl-hover').style('display', 'none');
    const defs = this.svg.append('defs');
    const p = defs.append('pattern').attr('id', 'tl-hatch').attr('width', 5).attr('height', 5).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).attr('stroke', 'rgba(196,181,253,0.22)').attr('stroke-width', 1.6);
    this.g = this.svg.append('g');
    this.head = this.svg.append('g').attr('class', 'head');
    this.head.append('line').attr('y1', 15).attr('y2', 33).attr('stroke', '#fff').attr('stroke-width', 2);
    this.head.append('circle').attr('cy', 24).attr('r', 7).attr('fill', '#fff').attr('stroke', '#0b0f14').attr('stroke-width', 2.5);

    this.levels = ds.frames.map(f => mean(f.A.aqi));
    this.draw();
    new ResizeObserver(() => { this.draw(); this.set(this.t ?? 0); }).observe(el);

    const toT = e => {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(ds.frames.length - 1, this.x.invert(e.clientX - r.left)));
    };
    let drag = false;
    el.addEventListener('pointerdown', e => { drag = true; el.setPointerCapture(e.pointerId); this.onScrub(toT(e)); });
    el.addEventListener('pointermove', e => {
      const t = toT(e);
      if (drag) this.onScrub(t);
      const f = ds.frames[Math.round(t)];
      this.hover.style('display', null).style('left', `${this.x(Math.round(t))}px`)
        .text(`${fmtTime(f.time)}${f.forecast ? ' · ' + tr('forecast') : ''}`);
    });
    el.addEventListener('pointerup', e => { if (drag) { drag = false; this.onRelease(toT(e)); } });
    el.addEventListener('pointerleave', () => this.hover.style('display', 'none'));
  }

  draw() {
    const { ds } = this, n = ds.frames.length;
    const W = this.el.clientWidth || 600;
    this.svg.attr('width', W).attr('height', 46);
    this.x = d3.scaleLinear().domain([-0.5, n - 0.5]).range([0, W]);
    const x = this.x, g = this.g;
    g.selectAll('*').remove();
    const cw = (x(1) - x(0)) || W;

    // forecast region
    const fi = ds.frames.findIndex(f => f.forecast);
    if (fi >= 0) {
      const x0 = x(fi) - cw / 2;
      g.append('rect').attr('x', x0).attr('y', 17).attr('width', W - x0).attr('height', 14).attr('fill', 'url(#tl-hatch)');
      g.append('text').attr('class', 'fc-label').attr('x', x0 + 4).attr('y', 44).text(tr('forecast'));
    }

    // heat strip
    g.selectAll('rect.cell').data(this.levels).join('rect').attr('class', 'cell')
      .attr('x', (d, i) => x(i) - cw / 2 + 0.5).attr('width', Math.max(1, cw - 1))
      .attr('y', 20).attr('height', 8).attr('rx', 1.5)
      .attr('fill', d => (isNaN(d) ? '#333' : category(d).color))
      .attr('opacity', (d, i) => (ds.frames[i].forecast ? 0.5 : 0.85));

    // day labels + ticks
    ds.frames.forEach((f, i) => {
      const first = i === 0 || f.time.getDate() !== ds.frames[i - 1].time.getDate();
      if (first) {
        g.append('line').attr('class', 'tick').attr('x1', x(i) - cw / 2).attr('x2', x(i) - cw / 2).attr('y1', 2).attr('y2', 31);
        if (W > 420 || i % 2 === 0) {
          g.append('g').attr('class', 'day').append('text').attr('x', x(i) - cw / 2 + 5).attr('y', 12)
            .text(`${f.time.toLocaleDateString(locale(), { weekday: 'short' })} ${f.time.getDate()}`);
        }
      }
    });

    // now marker
    const ni = ds.nowIndex;
    if (fi >= 0 && ni >= 0) {
      g.append('text').attr('class', 'now-label').attr('x', x(ni) + cw / 2 - 4).attr('y', 44).attr('text-anchor', 'end').text(tr('now'));
    }
  }

  set(t) {
    this.t = t;
    this.head.attr('transform', `translate(${this.x(t)},0)`);
    this.el.setAttribute('aria-valuenow', Math.round(t));
    this.el.setAttribute('aria-valuetext', this.ds.frames[Math.round(t)].time.toString());
  }
}

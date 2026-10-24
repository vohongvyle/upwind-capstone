// Small localStorage wrapper. Storage can be unavailable (private mode,
// blocked cookies) — every call is guarded and falls back to memory.
const mem = new Map();
const NS = 'upwind:';

export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(NS + key);
      return v == null ? (mem.has(key) ? mem.get(key) : fallback) : JSON.parse(v);
    } catch { return mem.has(key) ? mem.get(key) : fallback; }
  },
  set(key, value) {
    mem.set(key, value);
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* memory only */ }
  },
};

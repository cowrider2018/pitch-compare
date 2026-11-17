// Adaptive staircase on the pitch difference in cents.
// 1-down-1-up until the first reversal (fast approach), then 2-down-1-up (converges to ~70.7% correct).
// Step factor is ×√2 until 4 reversals, then ×2^(1/4) for fine tracking.

export function createStaircase({ start = 50, min = 0.3, max = 200 } = {}) {
  return { value: start, min, max, streak: 0, lastDir: 0, reversals: [], trials: 0 };
}

function factor(s) {
  return s.reversals.length < 4 ? Math.SQRT2 : Math.pow(2, 0.25);
}

/** Mutates and returns the staircase after a response on a "different" trial. */
export function updateStaircase(s, correct) {
  s.trials++;
  let dir = 0;
  if (correct) {
    s.streak++;
    const need = s.reversals.length === 0 ? 1 : 2;
    if (s.streak >= need) { dir = -1; s.streak = 0; }
  } else {
    s.streak = 0;
    dir = 1;
  }
  if (dir !== 0) {
    if (s.lastDir !== 0 && dir !== s.lastDir) s.reversals.push(s.value);
    s.lastDir = dir;
    const f = factor(s);
    s.value = Math.min(s.max, Math.max(s.min, dir < 0 ? s.value / f : s.value * f));
  }
  return s;
}

/** Geometric mean of the last (up to) 6 reversals, ignoring the first 2 once there are enough. */
export function threshold(s) {
  const r = s.reversals;
  if (r.length < 2) return null;
  const usable = r.length >= 6 ? r.slice(2) : r;
  const last = usable.slice(-6);
  return Math.exp(last.reduce((a, v) => a + Math.log(v), 0) / last.length);
}

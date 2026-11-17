// Pure summaries over stored sessions.
import { noteName } from './pitch.js';

/** @param session {{ results: {dir:number, correct:boolean}[] }} */
export function summarize(session) {
  const r = session.results;
  const diff = r.filter((x) => x.dir !== 0);
  const same = r.filter((x) => x.dir === 0);
  return {
    n: r.length,
    accuracy: r.length ? r.filter((x) => x.correct).length / r.length : null,
    diffAccuracy: diff.length ? diff.filter((x) => x.correct).length / diff.length : null,
    // "same" trials answered as different
    falseAlarm: same.length ? same.filter((x) => !x.correct).length / same.length : null,
  };
}

/**
 * Per-octave breakdown (octave of the pair's mean pitch, C-based) across sessions.
 * Rows: { label, diffN, diffAcc, meanDelta, sameN, falseAlarm }
 */
export function byOctave(sessions) {
  const rows = new Map();
  for (const s of sessions) {
    for (const x of s.results) {
      const oct = Math.floor((x.m1 + x.m2) / 2 / 12) - 1;
      if (!rows.has(oct)) rows.set(oct, { oct, diffN: 0, diffOk: 0, logDelta: 0, sameN: 0, sameBad: 0 });
      const row = rows.get(oct);
      if (x.dir === 0) {
        row.sameN++;
        if (!x.correct) row.sameBad++;
      } else {
        row.diffN++;
        if (x.correct) row.diffOk++;
        row.logDelta += Math.log(x.delta);
      }
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.oct - b.oct)
    .map((r) => ({
      label: `${noteName((r.oct + 1) * 12)}–${noteName((r.oct + 1) * 12 + 11)}`,
      diffN: r.diffN,
      diffAcc: r.diffN ? r.diffOk / r.diffN : null,
      meanDelta: r.diffN ? Math.exp(r.logDelta / r.diffN) : null,
      sameN: r.sameN,
      falseAlarm: r.sameN ? r.sameBad / r.sameN : null,
    }));
}

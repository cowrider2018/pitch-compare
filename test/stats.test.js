import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, byOctave, durationMs, formatDuration } from '../js/stats.js';

const results = [
  { m1: 60.1, m2: 60.2, dir: 1, delta: 10, correct: true },
  { m1: 60.2, m2: 60.1, dir: -1, delta: 10, correct: false },
  { m1: 61, m2: 61, dir: 0, delta: 0, correct: false },
  { m1: 72.5, m2: 72.5, dir: 0, delta: 0, correct: true },
  { m1: 72.0, m2: 72.04, dir: 1, delta: 4, correct: true },
];

test('summarize splits different and same trials', () => {
  const s = summarize({ results });
  assert.equal(s.n, 5);
  assert.equal(s.accuracy, 3 / 5);
  assert.equal(s.diffAccuracy, 2 / 3);
  assert.equal(s.falseAlarm, 1 / 2);
});

test('byOctave groups by the octave of the pair', () => {
  const rows = byOctave([{ results }]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, 'C4–B4');
  assert.equal(rows[0].diffN, 2);
  assert.equal(rows[0].diffAcc, 0.5);
  assert.ok(Math.abs(rows[0].meanDelta - 10) < 1e-9);
  assert.equal(rows[0].falseAlarm, 1);
  assert.equal(rows[1].label, 'C5–B5');
  assert.equal(rows[1].falseAlarm, 0);
});

test('duration runs from start to last answer', () => {
  assert.equal(durationMs({ startedAt: 1000, endedAt: 755000 }), 754000);
  assert.equal(durationMs({ id: 1 }), null);
  assert.equal(formatDuration(754000), '12:34');
  assert.equal(formatDuration(3723000), '1:02:03');
  assert.equal(formatDuration(4000), '0:04');
  assert.equal(formatDuration(null), '–');
});

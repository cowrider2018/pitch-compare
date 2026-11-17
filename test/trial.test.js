import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTrial, makeTimbrePair } from '../js/trial.js';

function seeded(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

test('trials respect delta, direction and range', () => {
  const rng = seeded(1);
  const counts = { first: 0, same: 0, second: 0 };
  for (let i = 0; i < 3000; i++) {
    const t = makeTrial({ rng, low: 48, high: 72, delta: 12, interference: 1 });
    counts[t.answer]++;
    const diffCents = (t.m2 - t.m1) * 100;
    if (t.answer === 'same') assert.equal(diffCents, 0);
    else assert.ok(Math.abs(Math.abs(diffCents) - 12) < 1e-9);
    if (t.answer === 'second') assert.ok(t.m2 > t.m1);
    if (t.answer === 'first') assert.ok(t.m1 > t.m2);
    const mid = (t.m1 + t.m2) / 2;
    assert.ok(mid >= 48 && mid <= 72);
  }
  assert.ok(Math.abs(counts.same / 3000 - 1 / 3) < 0.04, JSON.stringify(counts));
  assert.ok(Math.abs(counts.first - counts.second) < 200, JSON.stringify(counts));
});

test('base pitch is not snapped to the note grid', () => {
  const rng = seeded(3);
  const offsets = new Set();
  for (let i = 0; i < 200; i++) {
    const t = makeTrial({ rng, low: 48, high: 72, delta: 0, pSame: 1 });
    offsets.add(Math.round((t.m1 - Math.round(t.m1)) * 100));
  }
  assert.ok(offsets.size > 50);
});

test('level 0 shares one timbre; level 2 mostly makes the higher tone darker', () => {
  const rng = seeded(5);
  const [a, b] = makeTimbrePair(rng, 0, 1);
  assert.equal(a, b);
  let contra = 0;
  for (let i = 0; i < 1000; i++) {
    const [t1, t2] = makeTimbrePair(rng, 2, 1);
    if (t2.brightness < t1.brightness) contra++;
  }
  assert.ok(contra > 750, String(contra));
});

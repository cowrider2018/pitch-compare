import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTrial, makeTimbrePair, makeVariablePair } from '../js/trial.js';

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

test('mode 0 shares one timbre', () => {
  const { timbres: [a, b], amount } = makeTimbrePair(seeded(5), 0);
  assert.equal(a, b);
  assert.equal(amount, 0);
});

test('variable mode spans identical to severe', () => {
  const rng = seeded(8);
  const [a0, b0] = makeVariablePair(rng, 0);
  assert.deepEqual(a0.harmonics, b0.harmonics);
  assert.equal(a0.brightness, b0.brightness);
  assert.equal(a0.cutoffRatio, b0.cutoffRatio);
  assert.ok(a0.gainDb === b0.gainDb);
  assert.equal(a0.envelope, b0.envelope);
  for (let i = 0; i < 500; i++) {
    const [a, b] = makeVariablePair(rng, 1);
    assert.ok(Math.abs(a.brightness - b.brightness) >= 0.2, `${a.brightness} vs ${b.brightness}`);
    assert.notEqual(a.family, b.family);
  }
  const amounts = [];
  for (let i = 0; i < 2000; i++) amounts.push(makeTrial({ rng, low: 48, high: 72, delta: 10, interference: 3 }).amount);
  assert.ok(amounts.some((x) => x < 0.05) && amounts.some((x) => x > 0.95));
  assert.ok(Math.abs(amounts.reduce((p, x) => p + x, 0) / amounts.length - 0.5) < 0.03);
});

test('no mode ties brightness to pitch direction', () => {
  const rng = seeded(9);
  for (const level of [1, 3]) {
    let darkerHigher = 0, ties = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const t = makeTrial({ rng, low: 48, high: 72, delta: 20, pSame: 0, interference: level });
      const [hi, lo] = t.dir > 0 ? [t.timbres[1], t.timbres[0]] : [t.timbres[0], t.timbres[1]];
      if (hi.brightness === lo.brightness) ties++;
      else if (hi.brightness < lo.brightness) darkerHigher++;
    }
    assert.ok(Math.abs(darkerHigher / (N - ties) - 0.5) < 0.04, `level ${level}: ${darkerHigher / (N - ties)}`);
  }
});

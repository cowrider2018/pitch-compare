import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStaircase, updateStaircase, threshold } from '../js/staircase.js';

test('descends 1-down before the first reversal, then 2-down', () => {
  const s = createStaircase({ start: 64 });
  updateStaircase(s, true);
  assert.ok(Math.abs(s.value - 64 / Math.SQRT2) < 1e-9);
  updateStaircase(s, false); // up → first reversal
  assert.equal(s.reversals.length, 1);
  const v = s.value;
  updateStaircase(s, true);
  assert.equal(s.value, v); // needs two in a row now
  updateStaircase(s, true);
  assert.ok(s.value < v);
});

test('respects bounds', () => {
  const s = createStaircase({ start: 1, min: 0.5, max: 4 });
  for (let i = 0; i < 20; i++) updateStaircase(s, true);
  assert.equal(s.value, 0.5);
  for (let i = 0; i < 20; i++) updateStaircase(s, false);
  assert.equal(s.value, 4);
});

test('converges near a simulated listener threshold', () => {
  // Listener with a logistic psychometric function for 2-direction discrimination, true threshold ~8 cents.
  let seed = 7;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pCorrect = (d) => 0.5 + 0.5 / (1 + Math.exp(-(Math.log(d) - Math.log(8)) * 3));
  const s = createStaircase({ start: 50 });
  for (let i = 0; i < 400; i++) updateStaircase(s, rng() < pCorrect(s.value));
  const t = threshold(s);
  assert.ok(t > 4 && t < 16, `threshold ${t}`);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiToFreq, describe, formatCents, noteName } from '../js/pitch.js';

test('midiToFreq honours A4 reference', () => {
  assert.equal(midiToFreq(69), 440);
  assert.equal(midiToFreq(69, 442), 442);
  assert.ok(Math.abs(midiToFreq(81) - 880) < 1e-9);
  assert.ok(Math.abs(midiToFreq(60) - 261.6256) < 1e-3);
});

test('note naming and cents offsets', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(69), 'A4');
  assert.equal(noteName(70), 'B♭4');
  assert.deepEqual(describe(69.083), { name: 'A4', cents: 8.3 });
  assert.deepEqual(describe(68.6), { name: 'A4', cents: -40 });
  assert.deepEqual(describe(69), { name: 'A4', cents: 0 });
});

test('formatCents', () => {
  assert.equal(formatCents(8.3), '+8.3¢');
  assert.equal(formatCents(-40), '−40¢');
  assert.equal(formatCents(0), '±0.0¢');
});

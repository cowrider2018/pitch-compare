// Pitch math. Pitches are fractional MIDI numbers; frequencies are relative to a configurable A4.

export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function midiToFreq(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function noteName(midiInt) {
  const pc = ((midiInt % 12) + 12) % 12;
  return NOTE_NAMES[pc] + (Math.floor(midiInt / 12) - 1);
}

/** Nearest note and cents offset (one decimal), e.g. { name: 'A4', cents: -8.3 }. */
export function describe(midi) {
  const n = Math.round(midi);
  let cents = Math.round((midi - n) * 1000) / 10;
  if (Object.is(cents, -0)) cents = 0;
  return { name: noteName(n), cents };
}

export function formatCents(c) {
  const s = Math.abs(c) < 10 ? Math.abs(c).toFixed(1) : String(Math.round(Math.abs(c)));
  return (c > 0 ? '+' : c < 0 ? '−' : '±') + s + '¢';
}

export function formatPitch(midi) {
  const d = describe(midi);
  return `${d.name} ${formatCents(d.cents)}`;
}

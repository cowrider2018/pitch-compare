// Trial generation: continuous random base pitch (not snapped to the note grid), same/different,
// and a pair of timbres whose differences act as interference.

export const HARMONICS = 32;
export const FAMILIES = ['full', 'odd', 'formant'];

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * A timbre spec. brightness ∈ [0,1] drives spectral roll-off and low-pass cutoff, which is the
 * main cue listeners confuse with pitch height.
 */
export function makeTimbre(rng, brightness, family = FAMILIES[Math.floor(rng() * FAMILIES.length)]) {
  const p = lerp(2.6, 0.7, brightness);           // amplitude ∝ 1/n^p
  const center = 2 + rng() * 8;                     // formant centre (harmonic number)
  const width = 1 + rng() * 2.5;
  const harmonics = [];
  for (let n = 1; n <= HARMONICS; n++) {
    let a = 1 / Math.pow(n, p);
    if (family === 'odd' && n % 2 === 0) a *= 0.04;
    if (family === 'formant') a *= 0.25 + 2.5 * Math.exp(-((n - center) ** 2) / (2 * width * width));
    harmonics.push(a);
  }
  return {
    family,
    brightness,
    harmonics,
    cutoffRatio: lerp(2, 16, brightness),           // low-pass cutoff as a multiple of f0
    q: 0.5 + rng() * 3,
    attack: 0.005 + rng() * 0.07,
    envelope: rng() < 0.35 ? 'pluck' : 'sustain',
    gainDb: 0,
  };
}

/**
 * Interference levels:
 *   0 – both tones share one (randomly chosen) timbre
 *   1 – independent random timbres, ±2 dB level jitter
 *   2 – traps: brightness usually contradicts pitch direction; "same" trials get a large brightness gap
 * dir: +1 if the second tone is higher, -1 if lower, 0 if same.
 */
export function makeTimbrePair(rng, level, dir) {
  if (level <= 0) {
    const t = makeTimbre(rng, rng());
    return [t, t];
  }
  if (level === 1) {
    const a = makeTimbre(rng, rng()), b = makeTimbre(rng, rng());
    a.gainDb = (rng() * 2 - 1) * 2;
    b.gainDb = (rng() * 2 - 1) * 2;
    return [a, b];
  }
  const dark = () => rng() * 0.3, bright = () => 0.7 + rng() * 0.3;
  let b1, b2;
  if (dir === 0) {
    [b1, b2] = rng() < 0.5 ? [dark(), bright()] : [bright(), dark()];
  } else if (rng() < 0.75) {
    // the higher tone is darker
    [b1, b2] = dir > 0 ? [bright(), dark()] : [dark(), bright()];
  } else {
    b1 = rng(); b2 = rng();
  }
  const a = makeTimbre(rng, b1), b = makeTimbre(rng, b2);
  a.gainDb = (rng() * 2 - 1) * 3;
  b.gainDb = (rng() * 2 - 1) * 3;
  return [a, b];
}

/**
 * @returns {{ m1:number, m2:number, dir:-1|0|1, delta:number, answer:'first'|'same'|'second', timbres:[object,object] }}
 * m1/m2 are fractional MIDI pitches. The pair is centred on a uniformly random base in [low, high].
 */
export function makeTrial({ rng = Math.random, low, high, delta, pSame = 1 / 3, interference = 1 }) {
  const dir = rng() < pSame ? 0 : rng() < 0.5 ? 1 : -1;
  const base = low + rng() * (high - low);
  const half = dir === 0 ? 0 : delta / 200;
  const m1 = base - dir * half;
  const m2 = base + dir * half;
  return {
    m1, m2, dir,
    delta: dir === 0 ? 0 : delta,
    answer: dir === 0 ? 'same' : dir > 0 ? 'second' : 'first',
    timbres: makeTimbrePair(rng, interference, dir),
  };
}

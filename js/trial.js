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
 * Modes (stored as `interference`):
 *   0 – both tones share one (randomly chosen) timbre
 *   1 – independent random timbres, ±2 dB level jitter
 *   2 – retired ("traps": brightness opposed pitch direction, which trained a reverse cue).
 *       Kept only so old records stay labelled.
 *   3 – variable: each trial draws an interference amount s ∈ [0,1], from identical timbres (s=0)
 *       to severe differences (s=1)
 * No mode ties timbre to which tone is higher.
 */
export const MODES = { PLAIN: 0, TIMBRE: 1, VARIABLE: 3 };

/**
 * Two timbres differing by amount s ∈ [0,1]. Tone b is tone a blended toward an independent target
 * timbre by s; the target's brightness is pushed to the far end from a's as s grows. Level difference
 * up to ±5 dB at s=1. The pair is shuffled so neither tone is systematically the reference.
 */
export function makeVariablePair(rng, s) {
  const ba = rng();
  const far = ba < 0.5 ? 0.7 + rng() * 0.3 : rng() * 0.3;
  const a = makeTimbre(rng, ba);
  let family = FAMILIES[Math.floor(rng() * FAMILIES.length)];
  if (s > 0.66 && family === a.family) family = FAMILIES[(FAMILIES.indexOf(family) + 1) % FAMILIES.length];
  const t = makeTimbre(rng, lerp(rng(), far, s), family);
  const b = {
    family: s < 0.5 ? a.family : t.family,
    brightness: lerp(a.brightness, t.brightness, s),
    harmonics: a.harmonics.map((h, n) => lerp(h, t.harmonics[n], s)),
    cutoffRatio: a.cutoffRatio * Math.pow(t.cutoffRatio / a.cutoffRatio, s), // geometric blend
    q: lerp(a.q, t.q, s),
    attack: lerp(a.attack, t.attack, s),
    envelope: rng() < s ? t.envelope : a.envelope,
    gainDb: 0,
  };
  const d = s * 5 * (rng() * 2 - 1);
  a.gainDb = -d / 2;
  b.gainDb = d / 2;
  return rng() < 0.5 ? [a, b] : [b, a];
}

/** @returns {{ timbres: [object, object], amount: number }} amount = how much the timbres differ (0–1). */
export function makeTimbrePair(rng, level) {
  if (level === MODES.VARIABLE) {
    const amount = rng();
    return { timbres: makeVariablePair(rng, amount), amount };
  }
  if (level === MODES.TIMBRE) {
    const a = makeTimbre(rng, rng()), b = makeTimbre(rng, rng());
    a.gainDb = (rng() * 2 - 1) * 2;
    b.gainDb = (rng() * 2 - 1) * 2;
    return { timbres: [a, b], amount: null };
  }
  const t = makeTimbre(rng, rng());
  return { timbres: [t, t], amount: 0 };
}

/**
 * @returns {{ m1:number, m2:number, dir:-1|0|1, delta:number, answer:'first'|'same'|'second',
 *             timbres:[object,object], amount:number|null }}
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
    ...makeTimbrePair(rng, interference),
  };
}

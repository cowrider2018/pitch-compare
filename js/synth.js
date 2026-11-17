// Web Audio rendering of tone specs from trial.js. Everything is synthesized; no audio files.

const dbToGain = (db) => Math.pow(10, db / 20);

export class Synth {
  constructor() {
    this.ctx = null;
    this.nodes = [];
  }

  /** Must be called from a user gesture (iOS requirement). */
  async unlock() {
    if (!this.ctx) {
      // Play through the iOS ringer/silent switch (Safari 17+).
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    // A silent buffer finishes unlocking on older iOS.
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    src.connect(this.ctx.destination);
    src.start();
  }

  stop() {
    for (const n of this.nodes) { try { n.stop(); } catch {} }
    this.nodes = [];
  }

  tone(freq, timbre, when, dur) {
    const ctx = this.ctx;
    const nyq = ctx.sampleRate / 2;
    const count = Math.max(1, Math.min(timbre.harmonics.length, Math.floor((nyq * 0.9) / freq)));
    const real = new Float32Array(count + 1);
    const imag = new Float32Array(count + 1);
    for (let n = 1; n <= count; n++) imag[n] = timbre.harmonics[n - 1];
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(freq * timbre.cutoffRatio, nyq * 0.9);
    filter.Q.value = timbre.q;

    const env = ctx.createGain();
    const peak = dbToGain(timbre.gainDb);
    const g = env.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(peak, when + timbre.attack);
    if (timbre.envelope === 'pluck') {
      g.exponentialRampToValueAtTime(peak * 0.04, when + dur - 0.03);
    } else {
      g.setValueAtTime(peak, when + dur - 0.06);
    }
    g.linearRampToValueAtTime(0, when + dur);

    osc.connect(filter).connect(env).connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    this.nodes.push(osc);
  }

  /**
   * Plays [freq1, freq2] with timbres.
   * @returns {{ second: Promise<void>, done: Promise<void> }} resolving at the second tone's onset and at the end.
   */
  playPair(freqs, timbres, { dur = 0.6, gap = 0.35 } = {}) {
    this.stop();
    const lead = 0.05;
    const t0 = this.ctx.currentTime + lead;
    this.tone(freqs[0], timbres[0], t0, dur);
    this.tone(freqs[1], timbres[1], t0 + dur + gap, dur);
    const at = (s) => new Promise((r) => setTimeout(r, s * 1000));
    return { second: at(lead + dur + gap), done: at(lead + dur * 2 + gap) };
  }
}

import { midiToFreq, formatPitch, formatCents, noteName } from './pitch.js';
import { createStaircase, updateStaircase, threshold } from './staircase.js';
import { makeTrial, plainTimbre } from './trial.js';
import { Synth } from './synth.js';
import { loadSettings, saveSettings } from './store.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const synth = new Synth();
let settings = loadSettings();

const ANSWER_LABEL = { first: '第一個高', same: '一樣', second: '第二個高' };
const FAMILY_LABEL = { full: '完整泛音', odd: '奇次泛音', formant: '共振峰', plain: '純淨' };

/** One training round: a staircase plus the trials answered in it. */
let round = null;
let trial = null;
let answered = false;
let playing = false;

function newRound() {
  round = {
    startedAt: Date.now(),
    staircase: createStaircase({ start: settings.startDelta }),
    results: [], // { m1, m2, dir, delta, answer, response, correct, interference }
  };
}

// ---------- views ----------

function showView(name) {
  for (const v of $$('.view')) v.hidden = v.id !== `view-${name}`;
  for (const t of $$('.tab')) t.classList.toggle('active', t.dataset.view === name);
  if (name !== 'train') synth.ctx && synth.stop();
}

for (const t of $$('.tab')) t.addEventListener('click', () => showView(t.dataset.view));

// ---------- training ----------

function fmtDelta(c) {
  return c < 10 ? c.toFixed(1) + '¢' : Math.round(c) + '¢';
}

function renderStats() {
  const r = round?.results ?? [];
  const n = r.length;
  const correct = r.filter((x) => x.correct).length;
  $('#st-n').textContent = n;
  $('#st-acc').textContent = n ? Math.round((correct / n) * 100) + '%' : '–';
  $('#st-delta').textContent = round ? fmtDelta(round.staircase.value) : '–';
  const thr = round && threshold(round.staircase);
  $('#st-thr').textContent = thr ? fmtDelta(thr) : '–';
}

function setAnswersEnabled(on) {
  for (const b of $$('.answers button')) b.disabled = !on;
}

async function play(plain = false) {
  if (!trial) return;
  playing = true;
  $('#btn-replay').disabled = true;
  const freqs = [midiToFreq(trial.m1, settings.a4), midiToFreq(trial.m2, settings.a4)];
  const timbres = plain ? [plainTimbre(), plainTimbre()] : trial.timbres;
  await synth.playPair(freqs, timbres, { dur: settings.dur });
  playing = false;
  $('#btn-replay').disabled = false;
  if (!answered) setAnswersEnabled(true);
}

function nextTrial() {
  trial = makeTrial({
    low: settings.low,
    high: settings.high,
    delta: round.staircase.value,
    interference: settings.interference,
  });
  answered = false;
  $('#reveal').hidden = true;
  for (const b of $$('.answers button')) b.classList.remove('correct', 'wrong');
  setAnswersEnabled(false);
  renderStats();
  play();
}

function timbreText(t) {
  return `${FAMILY_LABEL[t.family]} · 亮度 ${Math.round(t.brightness * 100)}%${t.envelope === 'pluck' ? ' · 撥奏' : ''}`;
}

function toneHtml(midi, timbre) {
  const hz = midiToFreq(midi, settings.a4).toFixed(2);
  return `${formatPitch(midi)} <span class="sub">${hz} Hz · ${timbreText(timbre)}</span>`;
}

function answer(response) {
  if (!trial || answered || playing) return;
  answered = true;
  setAnswersEnabled(false);
  const correct = response === trial.answer;

  round.results.push({
    m1: trial.m1, m2: trial.m2, dir: trial.dir, delta: trial.delta,
    answer: trial.answer, response, correct, interference: settings.interference,
  });
  // Only "different" trials move the staircase; "same" trials measure false alarms.
  if (trial.dir !== 0) updateStaircase(round.staircase, correct);

  for (const b of $$('.answers button')) {
    if (b.dataset.answer === trial.answer) b.classList.add('correct');
    else if (b.dataset.answer === response) b.classList.add('wrong');
  }
  const v = $('#verdict');
  v.className = correct ? 'good' : 'bad';
  v.textContent = correct ? '✓ 正確' : `✗ 答錯 — 正解：${ANSWER_LABEL[trial.answer]}`;
  $('#rv-1').innerHTML = toneHtml(trial.m1, trial.timbres[0]);
  $('#rv-2').innerHTML = toneHtml(trial.m2, trial.timbres[1]);
  $('#rv-d').textContent = trial.dir === 0 ? '0¢（同音高）' : formatCents((trial.m2 - trial.m1) * 100) + '（第二音相對第一音）';
  $('#reveal').hidden = false;
  renderStats();
  $('#btn-next').focus({ preventScroll: true });
}

function endRound() {
  synth.stop();
  round = null;
  trial = null;
  $('#trial-pane').hidden = true;
  $('#start-pane').hidden = false;
  renderStats();
}

$('#btn-start').addEventListener('click', async () => {
  await synth.unlock();
  newRound();
  $('#start-pane').hidden = true;
  $('#trial-pane').hidden = false;
  nextTrial();
});
$('#btn-replay').addEventListener('click', () => play(false));
$('#btn-replay-plain').addEventListener('click', () => play(true));
$('#btn-next').addEventListener('click', () => nextTrial());
$('#btn-end').addEventListener('click', endRound);
for (const b of $$('.answers button')) b.addEventListener('click', () => answer(b.dataset.answer));

document.addEventListener('keydown', (e) => {
  if ($('#view-train').hidden || !trial || e.target.closest('input, select')) return;
  const key = { ArrowLeft: 'first', ArrowDown: 'same', ArrowRight: 'second', '1': 'first', '2': 'same', '3': 'second' }[e.key];
  if (key && !answered) { e.preventDefault(); answer(key); }
  else if (e.key === ' ') { e.preventDefault(); if (!playing) play(false); }
  else if (e.key === 'Enter' && answered) { e.preventDefault(); nextTrial(); }
});

// ---------- settings ----------

function fillSettingsForm() {
  const form = $('#settings');
  for (const name of ['low', 'high']) {
    const sel = form.elements[name];
    sel.innerHTML = '';
    for (let m = 28; m <= 100; m++) sel.add(new Option(noteName(m), m));
  }
  form.elements.a4.value = settings.a4;
  form.elements.low.value = settings.low;
  form.elements.high.value = settings.high;
  form.elements.dur.value = String(settings.dur);
  form.elements.startDelta.value = settings.startDelta;
  form.elements.interference.value = String(settings.interference);
}

$('#settings').addEventListener('change', () => {
  const f = $('#settings').elements;
  const num = (v, d) => (Number.isFinite(+v) && v !== '' ? +v : d);
  let low = num(f.low.value, settings.low);
  let high = num(f.high.value, settings.high);
  if (high <= low) high = low + 1;
  settings = {
    a4: Math.min(480, Math.max(380, num(f.a4.value, 440))),
    low, high,
    interference: num(f.interference.value, 1),
    dur: num(f.dur.value, 0.6),
    startDelta: Math.min(200, Math.max(1, num(f.startDelta.value, 50))),
  };
  saveSettings(settings);
  fillSettingsForm();
});

fillSettingsForm();
renderStats();

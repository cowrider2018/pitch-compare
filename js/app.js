import { midiToFreq, formatPitch, formatCents, noteName } from './pitch.js';
import { createStaircase, updateStaircase, threshold } from './staircase.js';
import { makeTrial } from './trial.js';
import { Synth } from './synth.js';
import { loadSettings, saveSettings, loadSessions, saveSession, clearSessions } from './store.js';
import { summarize, byOctave } from './stats.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const synth = new Synth();
let settings = loadSettings();
if (settings.interference === 2) settings.interference = 1; // the retired "traps" mode

const FEEDBACK_MS = 700; // how long the answer colours stay before the next trial plays

/** One training round: a staircase plus the trials answered in it. */
let round = null;
let trial = null;
let canAnswer = false; // true from the second tone's onset until answered
let busy = false;      // showing feedback; ignore input
let playToken = 0;     // invalidates callbacks from superseded playbacks

function newRound() {
  round = {
    id: Date.now(),
    interference: settings.interference,
    staircase: createStaircase({ start: settings.startDelta }),
    results: [], // { m1, m2, dir, delta, answer, response, correct }
  };
}

// ---------- views ----------

function showView(name) {
  for (const v of $$('.view')) v.hidden = v.id !== `view-${name}`;
  for (const t of $$('.tab')) t.classList.toggle('active', t.dataset.view === name);
  if (name === 'history') renderHistory();
}

for (const t of $$('.tab')) t.addEventListener('click', () => showView(t.dataset.view));

// ---------- training ----------

function fmtDelta(c) {
  return c < 10 ? c.toFixed(1) + '¢' : Math.round(c) + '¢';
}

function renderStats() {
  const r = round?.results ?? [];
  const n = r.length;
  $('#st-n').textContent = n;
  $('#st-n-unit').textContent = n === 1 ? 'trial' : 'trials';
  $('#st-delta').textContent = round ? fmtDelta(round.staircase.value) : '–';
  const thr = round && threshold(round.staircase);
  $('#st-thr').textContent = thr ? fmtDelta(thr) : '–';
}

function setWaiting(on) {
  $('.pad').classList.toggle('wait', on);
}

function play() {
  if (!trial) return;
  const token = ++playToken;
  const freqs = [midiToFreq(trial.m1, settings.a4), midiToFreq(trial.m2, settings.a4)];
  const { second } = synth.playPair(freqs, trial.timbres, { dur: settings.dur });
  if (!canAnswer) {
    setWaiting(true);
    second.then(() => {
      if (token !== playToken || busy) return;
      canAnswer = true;
      setWaiting(false);
    });
  }
}

function nextTrial() {
  trial = makeTrial({
    low: settings.low,
    high: settings.high,
    delta: round.staircase.value,
    interference: round.interference,
  });
  canAnswer = false;
  busy = false;
  for (const b of $$('.pad button')) b.classList.remove('correct', 'wrong');
  renderStats();
  play();
}

/** One-line recap of the previous trial, so each answer still links sound to note names. */
function lastLine(t, correct) {
  const mark = correct ? '✓' : '✗';
  if (t.dir === 0) return `${mark}  same  ${formatPitch(t.m1)}`;
  return `${mark}  ${formatPitch(t.m1)} → ${formatPitch(t.m2)}  (${formatCents((t.m2 - t.m1) * 100)})`;
}

/** Same trial again after a wrong answer: same pitches and timbres; tried answers stay marked. */
function retryTrial() {
  canAnswer = false;
  busy = false;
  play();
}

function answer(response) {
  if (!trial || !canAnswer || busy) return;
  if (trial.tried?.includes(response)) return; // already ruled out on this trial
  canAnswer = false;
  busy = true;
  synth.stop();
  playToken++;
  const correct = response === trial.answer;

  if (!trial.tried) {
    // Only the first attempt counts for stats and difficulty; retries are practice.
    trial.tried = [];
    trial.result = {
      m1: trial.m1, m2: trial.m2, dir: trial.dir, delta: trial.delta,
      answer: trial.answer, response, correct, tries: 1, amount: trial.amount,
    };
    round.results.push(trial.result);
    // Only "different" trials move the staircase; "same" trials measure false alarms.
    if (trial.dir !== 0) updateStaircase(round.staircase, correct);
  } else {
    trial.result.tries++;
  }
  persistRound();
  renderStats();

  const last = $('#last');
  const r = round;
  if (correct) {
    $(`[data-answer="${response}"]`).classList.add('correct');
    last.className = 'last good';
    last.textContent = lastLine(trial, true);
    setTimeout(() => { if (round === r) nextTrial(); }, FEEDBACK_MS);
  } else {
    // Don't reveal the answer or the pitches: the same trial plays again.
    trial.tried.push(response);
    $(`[data-answer="${response}"]`).classList.add('wrong');
    last.className = 'last bad';
    last.textContent = '✗  listen again';
    const t = trial;
    setTimeout(() => { if (round === r && trial === t) retryTrial(); }, FEEDBACK_MS);
  }
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;

/** Saved after every answer so closing the app never loses a round. */
function persistRound() {
  if (!round || !round.results.length) return;
  saveSession({
    id: round.id,
    a4: settings.a4,
    low: settings.low,
    high: settings.high,
    interference: round.interference,
    threshold: threshold(round.staircase),
    finalDelta: round.staircase.value,
    results: round.results.map((x) => ({
      m1: r4(x.m1), m2: r4(x.m2), dir: x.dir, delta: r4(x.delta), response: x.response, correct: x.correct, tries: x.tries,
      ...(x.amount != null && { amount: Math.round(x.amount * 100) / 100 }),
    })),
  });
}

function endRound() {
  synth.stop();
  playToken++;
  round = null;
  trial = null;
  busy = false;
  canAnswer = false;
  $('#trial-pane').hidden = true;
  $('#start-pane').hidden = false;
  document.body.classList.remove('training');
  markLastMode();
}

function markLastMode() {
  for (const b of $$('.modes button')) b.classList.toggle('last-used', +b.dataset.level === settings.interference);
}

async function startRound(level) {
  await synth.unlock();
  settings = { ...settings, interference: level };
  saveSettings(settings);
  newRound();
  $('#last').className = 'last';
  $('#last').innerHTML = '&nbsp;';
  $('#start-pane').hidden = true;
  $('#trial-pane').hidden = false;
  document.body.classList.add('training');
  nextTrial();
}

for (const b of $$('.modes button')) b.addEventListener('click', () => startRound(+b.dataset.level));
$('#btn-replay').addEventListener('click', () => { if (!busy) play(); });
$('#btn-end').addEventListener('click', endRound);
for (const b of $$('[data-answer]')) b.addEventListener('click', () => answer(b.dataset.answer));

document.addEventListener('keydown', (e) => {
  if ($('#trial-pane').hidden || !trial) return;
  const key = { ArrowLeft: 'first', '1': 'first', ArrowRight: 'second', '2': 'second', ArrowDown: 'same', s: 'same', '0': 'same' }[e.key];
  if (key) { e.preventDefault(); answer(key); }
  else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); if (!busy) play(); }
  else if (e.key === 'Escape') endRound();
});

// ---------- history ----------

const pct = (x) => (x == null ? '–' : Math.round(x * 100) + '%');
const MODE_LABEL = { 0: 'None', 1: 'Normal', 2: 'Traps (retired)', 3: 'Variable' };

function renderHistory() {
  const sessions = loadSessions();
  const tbody = $('#tbl-sessions tbody');
  tbody.innerHTML = '';
  for (const s of sessions.slice(-30).reverse()) {
    const sum = summarize(s);
    const d = new Date(s.id);
    const date = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const tr = tbody.insertRow();
    for (const v of [date, sum.n, pct(sum.accuracy), pct(sum.falseAlarm), s.threshold ? fmtDelta(s.threshold) : '–', MODE_LABEL[s.interference] ?? '–']) {
      tr.insertCell().textContent = v;
    }
  }
  $('#no-sessions').hidden = sessions.length > 0;
  $('#tbl-sessions').closest('.table-wrap').hidden = sessions.length === 0;

  const ob = $('#tbl-octaves tbody');
  ob.innerHTML = '';
  const rows = byOctave(sessions);
  for (const r of rows) {
    const tr = ob.insertRow();
    for (const v of [r.label, r.diffN, pct(r.diffAcc), r.meanDelta ? fmtDelta(r.meanDelta) : '–', pct(r.falseAlarm)]) {
      tr.insertCell().textContent = v;
    }
  }
  $('#tbl-octaves').closest('.table-wrap').hidden = rows.length === 0;
}

$('#btn-clear').addEventListener('click', () => {
  if (confirm('Clear all training records? This cannot be undone.')) {
    clearSessions();
    renderHistory();
  }
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
    interference: settings.interference,
    dur: num(f.dur.value, 0.6),
    startDelta: Math.min(200, Math.max(1, num(f.startDelta.value, 50))),
  };
  saveSettings(settings);
  fillSettingsForm();
});

fillSettingsForm();
markLastMode();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

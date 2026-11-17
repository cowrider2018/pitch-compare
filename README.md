# Pitch

Pitch discrimination trainer for musicians. Two close pitches, answer which is higher (or same),
with timbre variation as interference. Runs fully offline as a PWA; all sound is synthesized at
runtime with the Web Audio API, so there are no audio files.

## Run locally

    npm run serve     # http://localhost:5173/
    npm test          # unit tests for pure logic (pitch math, staircase, trial generation)

## Layout

- `js/pitch.js` – MIDI/frequency/cents math, note naming relative to a configurable A4
- `js/staircase.js` – adaptive 2-down-1-up staircase on the pitch difference (cents)
- `js/trial.js` – trial generation: continuous random base pitch, same/different, timbre pairs
- `js/synth.js` – Web Audio rendering of a tone (harmonic spectrum + low-pass + envelope)
- `js/store.js` – settings, sessions and trial log in localStorage
- `js/app.js` – UI

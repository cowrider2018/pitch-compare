// Local persistence. Wrapped in try/catch: storage can be unavailable (private mode, etc.).

const KEY_SETTINGS = 'pitch.settings.v1';

export const DEFAULT_SETTINGS = {
  a4: 440,
  low: 48,          // C3
  high: 72,         // C5
  interference: 1,  // 0 none, 1 random timbres, 2 traps
  dur: 0.6,         // seconds per tone
  startDelta: 50,   // cents
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEY_SETTINGS, {}) };
}

export function saveSettings(s) {
  write(KEY_SETTINGS, s);
}

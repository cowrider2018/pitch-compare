import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('service worker precaches every app file, and every precached file exists', () => {
  for (const f of readdirSync(new URL('js/', root))) assert.ok(assets.includes(`js/${f}`), `js/${f} missing from sw.js ASSETS`);
  for (const a of assets) if (a !== './') assert.ok(existsSync(new URL(a, root)), `${a} does not exist`);
});

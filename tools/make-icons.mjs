// Generates the PNG app icons (no dependencies). Run: node tools/make-icons.mjs
// Design: two short bars at slightly different heights on a dark square (two close pitches).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x1b, 0x1d, 0x23];
const FG = [0x7d, 0x97, 0xff];

// Shapes in unit coordinates, kept inside the maskable safe zone (central 80%).
const bars = [
  { x0: 0.24, x1: 0.47, y: 0.58, h: 0.09 },
  { x0: 0.53, x1: 0.76, y: 0.42, h: 0.09 },
];

function coverage(px, py, size) {
  // 4x4 supersampling for anti-aliased rounded bars
  let hit = 0;
  for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
    const x = (px + (sx + 0.5) / 4) / size, y = (py + (sy + 0.5) / 4) / size;
    for (const b of bars) {
      const r = b.h / 2;
      const cx = Math.min(Math.max(x, b.x0 + r), b.x1 - r);
      if ((x - cx) ** 2 + (y - b.y) ** 2 <= r * r) { hit++; break; }
    }
  }
  return hit / 16;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const a = coverage(x, y, size);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] + (FG[i] - BG[i]) * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../icons/', import.meta.url);
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
  writeFileSync(new URL(name, out), png(size));
  console.log(name);
}

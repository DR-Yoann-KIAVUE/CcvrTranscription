// Génère une icône source PNG 1024x1024 (fond teal arrondi + point micro blanc).
// Sans dépendance externe : encodage PNG manuel via zlib.
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const S = 1024;
const buf = Buffer.alloc(S * S * 4); // RGBA

const teal = [13, 125, 116];
const tealDark = [10, 75, 87];
const white = [245, 250, 249];

function set(x, y, [r, g, b], a = 255) {
  const i = (y * S + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

const radius = 180; // coins arrondis
function insideRounded(x, y) {
  const rx = Math.min(x, S - 1 - x);
  const ry = Math.min(y, S - 1 - y);
  if (rx >= radius || ry >= radius) return true;
  const dx = radius - rx;
  const dy = radius - ry;
  return dx * dx + dy * dy <= radius * radius;
}

const cx = S / 2;
const cy = S / 2;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (!insideRounded(x, y)) {
      set(x, y, [0, 0, 0], 0); // transparent
      continue;
    }
    // Dégradé diagonal.
    const t = (x + y) / (2 * S);
    const bg = [
      Math.round(teal[0] * (1 - t) + tealDark[0] * t),
      Math.round(teal[1] * (1 - t) + tealDark[1] * t),
      Math.round(teal[2] * (1 - t) + tealDark[2] * t),
    ];
    set(x, y, bg);

    // Corps de micro : capsule blanche centrée.
    const capW = 150;
    const capTop = cy - 230;
    const capBot = cy + 60;
    const inCapsuleX = Math.abs(x - cx) <= capW;
    const inCapsuleY = y >= capTop && y <= capBot;
    let mic = false;
    if (inCapsuleX && inCapsuleY) {
      // arrondis haut/bas de la capsule
      if (y < capTop + capW) {
        const dx = x - cx;
        const dy = y - (capTop + capW);
        mic = dx * dx + dy * dy <= capW * capW;
      } else if (y > capBot - capW) {
        const dx = x - cx;
        const dy = y - (capBot - capW);
        mic = dx * dx + dy * dy <= capW * capW;
      } else {
        mic = true;
      }
    }
    // Arc + pied du micro.
    const dArc = Math.hypot(x - cx, y - (cy - 20));
    const arc = dArc >= 250 && dArc <= 300 && y >= cy - 20;
    const stem = Math.abs(x - cx) <= 22 && y > cy + 60 && y < cy + 230;
    const base = Math.abs(x - cx) <= 130 && y >= cy + 220 && y <= cy + 250;
    if (mic || arc || stem || base) set(x, y, white);
  }
}

// --- Encodage PNG ---
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Scanlines avec octet de filtre 0.
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  buf.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "src-tauri", "app-icon.png");
fs.writeFileSync(out, png);
console.log("Icône écrite :", out, `(${png.length} octets)`);

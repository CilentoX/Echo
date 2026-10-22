// Gera icon.png 1024x1024 de alta qualidade para o Eco
// Fundo #0D1017, squircle arredondado, ondas concêntricas teal #14B8A6
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
const BG = [0x0D, 0x10, 0x17];
const ACC = [0x14, 0xB8, 0xA6];

// ---------- helpers ----------
function lerp(a, b, t) { return a + (b - a) * t; }

function sqr(x) { return x * x; }

// Squircle (rounded square) mask
function isInsideSquircle(x, y, cx, cy, r) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  // p-norm com p=4 aproxima um squircle
  const d = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25);
  return d <= r;
}

// Anti-aliased distance-based alpha para bordas
function edgeAlpha(dist, radius, width) {
  const d = Math.abs(dist - radius);
  if (d > width) return 0;
  return 1 - d / width;
}

// ---------- desenho ----------
const px = new Uint8Array(SIZE * SIZE * 4);
const cx = SIZE / 2;
const cy = SIZE / 2;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let r = BG[0], g = BG[1], b = BG[2], a = 255;

    // Fundo: squircle escuro (arredonda os cantos do ícone)
    const sqIn = isInsideSquircle(x, y, cx, cy, SIZE * 0.46);
    const sqEdge = edgeAlpha(dist, SIZE * 0.46, 60);

    // Arcos concêntricos (3 anéis teal)
    let acc = 0;
    // anel 1: raio ~28% com alpha .66
    acc += edgeAlpha(dist, SIZE * 0.28, 8);
    // anel 2: raio ~39% com alpha .44
    acc += edgeAlpha(dist, SIZE * 0.39, 8) * 0.66;
    // anel 3: raio ~50% com alpha .33
    acc += edgeAlpha(dist, SIZE * 0.50, 8) * 0.33;

    // ponto central teal (raio ~14%)
    const centerAlpha = edgeAlpha(dist, SIZE * 0.14, 20);

    const tealAlpha = Math.min(1, Math.max(acc, centerAlpha));
    const squircleAlpha = sqIn ? 1 : sqEdge;

    // Combina: onde há squircle, pinta teal nos anéis; senão, fundo escuro
    if (squircleAlpha > 0) {
      if (tealAlpha > 0) {
        const ta = tealAlpha * squircleAlpha;
        r = lerp(BG[0], ACC[0], ta);
        g = lerp(BG[1], ACC[1], ta);
        b = lerp(BG[2], ACC[2], ta);
      } else {
        r = BG[0]; g = BG[1]; b = BG[2]; // dentro do squircle mas sem anel = escuro
        a = Math.floor(255 * squircleAlpha * 0.15); // leve visibilidade
      }
    } else {
      r = BG[0]; g = BG[1]; b = BG[2]; a = 0; // fora do squircle = transparente
    }

    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  }
}

// ---------- encoder PNG ----------
function crc32(buf, seed = 0) {
  // CRC32 simplificado (tabela prévia não implementada; use CRC via tabela)
  // Implementação inline pequena
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  let crc = (~seed) >>> 0;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (~crc) >>> 0;
}

function writePNG(w, h, data) {
  const stride = w * 4;
  const rawLen = h * (1 + stride);
  const raw = Buffer.alloc(rawLen);
  for (let y = 0; y < h; y++) {
    raw[y * (1 + stride)] = 0; // filtro none
    Buffer.from(data).copy(raw, y * (1 + stride) + 1, y * stride, y * stride + stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // color type RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace

  // PLTE não necessário (RGBA)
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, chunk('IHDR', ihdr), idat, iend]);
}

const png = writePNG(SIZE, SIZE, px);
fs.writeFileSync('icons/icon.png', png);
console.log('icons/icon.png gerado:', png.length, 'bytes');

// Gera app-icon.png 1024x1024 para Echo
// Fundo #0F1114 opaco, símbolo E abstrato #14B8A6 (3 faixas)
const fs = require('fs');
const zlib = require('zlib');

const SIZE = 1024;
const BG = [0x0F, 0x11, 0x14];  // #0F1114
const ACC = [0x14, 0xB8, 0xA6]; // #14B8A6

function lerp(a, b, t) { return a + (b - a) * t; }

// Sombra suave para dar profundidade (opcional, minimal)
function edgeAlpha(dist, radius, width) {
  const d = Math.abs(dist - radius);
  if (d > width) return 0;
  return 1 - d / width;
}

const px = Buffer.alloc(SIZE * SIZE * 4);

const cx = SIZE / 2;
const cy = SIZE / 2;

// Dimensões das 3 faixas do E (proporções do SVG mestre)
const barThickness = Math.round(154 * SIZE / 1024); // ~154
const barRx = Math.round(77 * SIZE / 1024);          // ~77
const barTopY = Math.round(230 * SIZE / 1024);       // ~230
const barMidY = Math.round(435 * SIZE / 1024);       // ~435
const barBotY = Math.round(640 * SIZE / 1024);       // ~640
const barLeft = Math.round(230 * SIZE / 1024);       // ~230
const barLongWidth = Math.round(564 * SIZE / 1024);  // ~564
const barMidWidth = Math.round(423 * SIZE / 1024);   // ~423

// Preenche tudo com fundo
for (let i = 0; i < px.length; i += 4) {
  px[i] = BG[0]; px[i + 1] = BG[1]; px[i + 2] = BG[2]; px[i + 3] = 255;
}

// Desenha uma barra horizontal com cantos arredondados (rx)
// x, y: canto superior esquerdo
function drawBar(x, y, w, h) {
  const rightX = x + w;
  const bottomY = y + h;
  const rx = Math.min(barRx, h / 2);

  for (let py = y; py < bottomY; py++) {
    for (let px_ = x; px_ < rightX; px_++) {
      const i = (py * SIZE + px_) * 4;
      let inside = true;
      let alpha = 255;

      // Verifica se está nos cantos arredondados
      if (px_ < x + rx || px_ > rightX - rx || py < y + rx || py > bottomY - rx) {
        // Canto superior esquerdo
        if (px_ < x + rx && py < y + rx) {
          const dx = px_ - (x + rx);
          const dy = py - (y + rx);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > rx) {
            inside = false;
          } else {
            alpha = Math.floor(edgeAlpha(d, rx, 3) * 255);
          }
        }
        // Canto superior direito
        if (px_ > rightX - rx && py < y + rx) {
          const dx = px_ - (rightX - rx);
          const dy = py - (y + rx);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > rx) {
            inside = false;
          } else {
            alpha = Math.floor(edgeAlpha(d, rx, 3) * 255);
          }
        }
        // Canto inferior esquerdo
        if (px_ < x + rx && py > bottomY - rx) {
          const dx = px_ - (x + rx);
          const dy = py - (bottomY - rx);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > rx) {
            inside = false;
          } else {
            alpha = Math.floor(edgeAlpha(d, rx, 3) * 255);
          }
        }
        // Canto inferior direito
        if (px_ > rightX - rx && py > bottomY - rx) {
          const dx = px_ - (rightX - rx);
          const dy = py - (bottomY - rx);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > rx) {
            inside = false;
          } else {
            alpha = Math.floor(edgeAlpha(d, rx, 3) * 255);
          }
        }
      }

      if (!inside) continue;

      px[i] = ACC[0];
      px[i + 1] = ACC[1];
      px[i + 2] = ACC[2];
      px[i + 3] = alpha;
    }
  }
}

// Desenha as 3 faixas
drawBar(barLeft, barTopY, barLongWidth, barThickness);
drawBar(barLeft, barMidY, barMidWidth, barThickness);
drawBar(barLeft, barBotY, barLongWidth, barThickness);

// ---------- Encoder PNG ----------
function crc32(buf, seed = 0) {
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
    raw[y * (1 + stride)] = 0;
    data.copy(raw, y * (1 + stride) + 1, y * stride, y * stride + stride);
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

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // color type RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace

  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, chunk('IHDR', ihdr), idat, iend]);
}

const png = writePNG(SIZE, SIZE, px);
fs.writeFileSync('app-icon.png', png);
console.log('app-icon.png gerado:', png.length, 'bytes');

// Verificação: fundo opaco (todos os pixels fora das barras têm alpha 255)
let opaqueBgCount = 0;
let accCount = 0;
for (let i = 3; i < px.length; i += 4) {
  if (px[i] === 255) opaqueBgCount++;
  if (px[i-3] === ACC[0] && px[i-2] === ACC[1] && px[i-1] === ACC[2]) accCount++;
}
console.log('Pixels com alpha 255:', opaqueBgCount, 'de', px.length / 4);
console.log('Pixels teal (acento):', accCount);

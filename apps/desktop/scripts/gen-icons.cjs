// Gera icon.ico (multi-size) + header.bmp/sidebar.bmp com cores sólidas da paleta Eco
const fs = require('fs');
const path = require('path');

// ── helpers PNG ──
function writePng(buf, file) { fs.writeFileSync(file, buf); }

// Minimal PNG encoder (RGBA, 8-bit) — sem dependências externas
function encodePng(width, height, pixels) {
  // pixels: ArrayBufferView ou Uint8ClampedArray RGBA
  const rowBytes = width * 4;
  const stride = rowBytes + 1; // + filter byte per row
  const raw = stride * height;
  const len = 8 + 13 + 12 + (raw * 1) + 12 + 12; // IHDR+IDAT+IEND aproximado (usamos zlib manual simplificado)
  // Vamos usar uma abordagem ainda mais simples: salvar como .ico com múltiplos PNGs embalados

  // Para não depender de zlib puro, geramos um ICO com BMPs internos (formato mais simples)
  // ICO = cabeçalho + dir entries + dados BMP (DIB) de cada tamanho
  const sizes = [16, 32, 48, 64, 128, 256];
  const dirEntries = [];
  let offset = 6 + sizes.length * 16;
  const dibData = [];

  sizes.forEach(sz => {
    const dib = createDib(sz, sz, pixelsFor(sz));
    dibData.push(dib);
    dirEntries.push({
      width: sz >= 256 ? 0 : sz,
      height: sz >= 256 ? 0 : sz,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      size: dib.length,
      offset
    });
    offset += dib.length;
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // type = 1 (icon)
  header.writeUInt16LE(sizes.length, 4); // count

  const entryBufs = dirEntries.map(e => {
    const b = Buffer.alloc(16);
    b.writeUInt8(e.width, 0);
    b.writeUInt8(e.height, 1);
    b.writeUInt8(e.colorCount, 2);
    b.writeUInt8(e.reserved, 3);
    b.writeUInt16LE(e.planes, 4);
    b.writeUInt16LE(e.bitCount, 6);
    b.writeUInt32LE(e.size, 8);
    b.writeUInt32LE(e.offset, 12);
    return b;
  });

  return Buffer.concat([header, ...entryBufs, ...dibData]);
}

function createDib(w, h, px) {
  // BITMAPV5HEADER simplificado + dados RGBA (BMP v3 32bpp, bottom-up)
  const stride = ((w * 32 + 31) / 32) * 4;
  const imageSize = stride * h;
  const size = 40 + imageSize;
  const dib = Buffer.alloc(size);
  dib.writeUInt32LE(40, 0); // biSize
  dib.writeInt32LE(w, 4);
  dib.writeInt32LE(h, 8);   // positivo = bottom-up
  dib.writeUInt16LE(1, 12); // biPlanes
  dib.writeUInt16LE(32, 14); // biBitCount
  dib.writeUInt32LE(0, 16);  // biCompression = BI_RGB
  dib.writeUInt32LE(imageSize, 20);
  dib.writeInt32LE(2835, 24); // biXPelsPerMeter
  dib.writeInt32LE(2835, 28);
  dib.writeUInt32LE(0, 32);
  dib.writeUInt32LE(0, 36);

  // px: Uint8ClampedArray RGBA (w*h*4). BMP armazena BGRA, bottom-up.
  const pxBuf = Buffer.from(px);
  for (let row = 0; row < h; row++) {
    const dstOff = 40 + row * stride;
    const srcOff = (h - 1 - row) * w * 4;
    for (let x = 0; x < w; x++) {
      const s = srcOff + x * 4;
      // BGRA
      dib[dstOff + x * 4 + 0] = pxBuf[s + 2]; // B
      dib[dstOff + x * 4 + 1] = pxBuf[s + 1]; // G
      dib[dstOff + x * 4 + 2] = pxBuf[s + 0]; // R
      dib[dstOff + x * 4 + 3] = pxBuf[s + 3]; // A
    }
  }
  return dib;
}

function pixelsFor(sz) {
  // Desenha o logo Eco (ondas concêntricas teal #14B8A6 sobre #0D1017)
  // Desenho procedural puro
  const px = new Uint8ClampedArray(sz * sz * 4);
  const cx = sz / 2;
  const cy = sz / 2;
  const bgR = 0x0D, bgG = 0x10, bgB = 0x17, bgA = 0xFF;
  const accR = 0x14, accG = 0xB8, accB = 0xA6, accA = 0xFF;

  for (let y = 0; y < sz; y++) {
    for (let x = 0; x < sz; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      let r = bgR, g = bgG, b = bgB, a = bgA;

      // Ponto central (logo dot)
      if (d <= sz * 0.12) { r = accR; g = accG; b = accB; }
      // Arcos concêntricos (3 anéis)
      else if (d > sz * 0.30 && d <= sz * 0.42) { r = accR; g = accG; b = accB; a = 0xFF * 0.66 | 0; }
      else if (d > sz * 0.48 && d <= sz * 0.60) { r = accR; g = accG; b = accB; a = 0xFF * 0.33 | 0; }

      const i = (y * sz + x) * 4;
      px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a;
    }
  }
  return px;
}

const icoBuf = encodePng(0, 0, null); // não usado diretamente, build abaixo
// Rebuild com sizes fixos:
const sizes = [16, 32, 48, 64, 128, 256];
const dirEntries = [];
let offset = 6 + sizes.length * 16;
const dibData = [];
sizes.forEach(sz => {
  const px = pixelsFor(sz);
  const dib = createDib(sz, sz, px);
  dibData.push(dib);
  dirEntries.push({ width: sz >= 256 ? 0 : sz, height: sz >= 256 ? 0 : sz, colorCount: 0, reserved: 0, planes: 1, bitCount: 32, size: dib.length, offset });
  offset += dib.length;
});
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const entryBufs = dirEntries.map(e => {
  const b = Buffer.alloc(16);
  b.writeUInt8(e.width, 0); b.writeUInt8(e.height, 1); b.writeUInt8(e.colorCount, 2); b.writeUInt8(e.reserved, 3);
  b.writeUInt16LE(e.planes, 4); b.writeUInt16LE(e.bitCount, 6); b.writeUInt32LE(e.size, 8); b.writeUInt32LE(e.offset, 12);
  return b;
});
fs.writeFileSync('src-tauri/icons/icon.ico', Buffer.concat([header, ...entryBufs, ...dibData]));
console.log('icon.ico gerado:', sizes.join(', '));

// ── BMP helpers ──
function makeBmp(w, h, fillFn) {
  const stride = ((w * 24 + 31) / 32) * 4;
  const size = 14 + 40 + stride * h;
  const b = Buffer.alloc(size);
  b.write('BM', 0, 'ascii');
  b.writeUInt32LE(size, 2);
  b.writeUInt32LE(14 + 40, 10); // offset pixels
  b.writeUInt32LE(40, 14);      // DIB header size
  b.writeInt32LE(w, 18);
  b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);      // 24 bpp
  b.writeUInt32LE(0, 30);       // BI_RGB
  b.writeUInt32LE(stride * h, 34);
  b.writeInt32LE(2835, 38);
  b.writeInt32LE(2835, 42);
  b.writeUInt32LE(0, 46);
  b.writeUInt32LE(0, 50);

  const pxStart = 54;
  for (let row = 0; row < h; row++) {
    const dst = pxStart + row * stride;
    const srcRow = h - 1 - row; // bottom-up
    for (let x = 0; x < w; x++) {
      const [r, g, bb] = fillFn(x, srcRow, w, h);
      b[dst + x*3 + 0] = bb; // B
      b[dst + x*3 + 1] = g;  // G
      b[dst + x*3 + 2] = r;  // R
    }
  }
  return b;
}

const acc = [0x14, 0xB8, 0xA6]; // teal
const dark = [0x0D, 0x10, 0x17]; // bg
const surf = [0x17, 0x1B, 0x24]; // surf

// header.bmp 150x57 — gradiente teal -> dark
const headerBmp = makeBmp(150, 57, (x, y) => {
  const t = x / 150;
  return [Math.round(dark[0]*(1-t) + acc[0]*t), Math.round(dark[1]*(1-t) + acc[1]*t), Math.round(dark[2]*(1-t) + acc[2]*t)];
});
fs.writeFileSync('src-tauri/nsis/header.bmp', headerBmp);
console.log('header.bmp gerado: 150x57');

// sidebar.bmp 164x314 — dark sólido com faixa teal no topo
const sidebarBmp = makeBmp(164, 314, (x, y) => y < 60 ? acc : dark);
fs.writeFileSync('src-tauri/nsis/sidebar.bmp', sidebarBmp);
console.log('sidebar.bmp gerado: 164x314');

console.log('Pronto. Rode `pnpm tauri build` depois de atualizar a versão no tauri.conf.json.');

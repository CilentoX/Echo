// Gera header.bmp (150x57) e sidebar.bmp (164x314) para o instalador NSIS
// BMP 24-bit sem compressão, sem artifacts de gradiente — logo Eco puro
const fs = require('fs');
const path = require('path');

const BG = [0x0D, 0x10, 0x17];
const ACC = [0x14, 0xB8, 0xA6];

function lerp(a, b, t) { return a + (b - a) * t; }

// Anti-aliased circle edge alpha (dist dentro de width da borda)
function edgeAlpha(dist, radius, width) {
  const d = Math.abs(dist - radius);
  if (d > width) return 0;
  return 1 - d / width;
}

// Desenha logo Eco num buffer RGBA (w x h)
function drawEcoLogo(w, h) {
  const px = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  const scale = Math.min(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = BG[0], g = BG[1], b = BG[2], a = 255;

      // Ponto central teal
      const centerAlpha = edgeAlpha(dist, scale * 0.11, scale * 0.04);
      // Arcos concêntricos
      let acc = 0;
      acc += edgeAlpha(dist, scale * 0.26, scale * 0.035);
      acc += edgeAlpha(dist, scale * 0.36, scale * 0.035) * 0.66;
      acc += edgeAlpha(dist, scale * 0.46, scale * 0.035) * 0.33;

      const tealAlpha = Math.min(1, Math.max(acc, centerAlpha));
      if (tealAlpha > 0) {
        const ta = tealAlpha;
        r = lerp(BG[0], ACC[0], ta);
        g = lerp(BG[1], ACC[1], ta);
        b = lerp(BG[2], ACC[2], ta);
      }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return px;
}

// ---------- BMP encoder ----------
function makeBmp(w, h, pxRGBA) {
  const stride = Math.ceil((w * 24) / 32) * 4;
  const size = 14 + 40 + stride * h;
  const b = Buffer.alloc(size);
  b.write('BM', 0, 'ascii');
  b.writeUInt32LE(size, 2);
  b.writeUInt32LE(14 + 40, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18);
  b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  b.writeUInt32LE(0, 30);   // BI_RGB, sem compressão
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
      const s = (srcRow * w + x) * 4;
      b[dst + x * 3 + 0] = pxRGBA[s + 2]; // B
      b[dst + x * 3 + 1] = pxRGBA[s + 1]; // G
      b[dst + x * 3 + 2] = pxRGBA[s];     // R
    }
  }
  return b;
}

// header.bmp 150x57 — logo Eco centralizado pequeno
const headerPx = drawEcoLogo(150, 57);
fs.writeFileSync('src-tauri/nsis/header.bmp', makeBmp(150, 57, headerPx));
console.log('header.bmp gerado: 150x57');

// sidebar.bmp 164x314 — logo Eco centralizado maior
const sidebarPx = drawEcoLogo(164, 314);
fs.writeFileSync('src-tauri/nsis/sidebar.bmp', makeBmp(164, 314, sidebarPx));
console.log('sidebar.bmp gerado: 164x314');

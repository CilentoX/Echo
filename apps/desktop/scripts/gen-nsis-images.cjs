// Gera imagens BMP para o instalador NSIS com a identidade Eco
// header.bmp: 150x57px (recomendado pelo Tauri)
// sidebar.bmp: 164x314px
const fs = require("fs");

const TEAL = [0x14, 0xB8, 0xA6];   // #14B8A6
const DARK = [0x0D, 0x10, 0x17];   // #0D1017
const SURF = [0x17, 0x1B, 0x24];   // #171B24

function makeBmp(width, height, fillFn) {
  // BMP header (40 bytes DIB + 14 bytes file header)
  const rowSize = Math.ceil((width * 24 + 31) / 32) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;

  const buf = Buffer.alloc(fileSize);

  // BM signature
  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // offset to pixel array

  // DIB header
  buf.writeUInt32LE(40, 14);   // header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);    // planes
  buf.writeUInt16LE(24, 28);   // bits per pixel
  buf.writeUInt32LE(0, 30);    // compression (none)
  buf.writeUInt32LE(imageSize, 34);
  buf.writeInt32LE(2835, 38);  // horizontal resolution
  buf.writeInt32LE(2835, 42);  // vertical resolution
  buf.writeUInt32LE(0, 46);    // colors used
  buf.writeUInt32LE(0, 50);    // important colors

  // Pixels (BMP stores BGR, bottom-to-top)
  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fillFn(x, y, width, height);
      buf[rowOffset + x * 3] = b;
      buf[rowOffset + x * 3 + 1] = g;
      buf[rowOffset + x * 3 + 2] = r;
    }
  }

  return buf;
}

// Header: 150x57 — gradiente teal escuro → teal claro com logo textual
const headerBmp = makeBmp(150, 57, (x, y) => {
  // Fundo escuro com sutil gradiente teal
  const t = y / 57;
  const r = Math.round(DARK[0] + (TEAL[0] - DARK[0]) * t * 0.4);
  const g = Math.round(DARK[1] + (TEAL[1] - DARK[1]) * t * 0.6);
  const b = Math.round(DARK[2] + (TEAL[2] - DARK[2]) * t * 0.8);
  return [r, g, b];
});

// Sidebar: 164x314 — fundo escuro com ondas concêntricas (logo Eco)
const sidebarBmp = makeBmp(164, 314, (x, y) => {
  const cx = 82;
  const cy = 157;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.sqrt(dx * dx + dy * dy);

  // Fundo escuro
  let [r, g, b] = DARK;

  // Ondas concêntricas teal
  if (d > 20 && d < 30) {
    [r, g, b] = TEAL;
  } else if (d > 45 && d < 55) {
    [r, g, b] = [0x10, 0x94, 0x88]; // teal press
  } else if (d > 70 && d < 80) {
    [r, g, b] = [0x0D, 0x94, 0x88];
  } else if (d > 95 && d < 105) {
    [r, g, b] = [0x14, 0xB8, 0xA6];
  } else if (d > 120 && d < 130) {
    [r, g, b] = [0x2D, 0xD4, 0xBF];
  } else if (d < 20) {
    // Círculo central escuro
    [r, g, b] = [0x12, 0x15, 0x1C];
  }

  return [r, g, b];
});

fs.writeFileSync("src-tauri/nsis/header.bmp", headerBmp);
fs.writeFileSync("src-tauri/nsis/sidebar.bmp", sidebarBmp);

console.log("✓ BMPs gerados:");
console.log("  src-tauri/nsis/header.bmp (150x57)");
console.log("  src-tauri/nsis/sidebar.bmp (164x314)");
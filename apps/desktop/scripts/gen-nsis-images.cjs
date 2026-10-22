/** Gera imagens BMP para o instalador NSIS do Eco.
 *  header.bmp: 150x57 (fundo teal, logo branco)
 *  sidebar.bmp: 164x314 (fundo dark, logo grande + nome Eco)
 */
const fs = require("fs");
const path = require("path");

const TEAL = [0x14, 0xB8, 0xA6];   // #14B8A6
const DARK = [0x0D, 0x10, 0x17];   // #0D1017
const WHITE = [0xFF, 0xFF, 0xFF];

function writeBMP(file, width, height, pixelFn) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;
  const buf = Buffer.alloc(fileSize);

  // BM signature
  buf.write("BM", 0, 2, "ascii");
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // pixel array offset
  // DIB header (40 bytes)
  buf.writeInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);  // planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  // no compression (BI_RGB = 0)
  buf.writeUInt32LE(imageSize, 34);
  buf.writeInt32LE(2835, 38); // pixels per meter X
  buf.writeInt32LE(2835, 42); // pixels per meter Y
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  let px = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height);
      buf[px++] = b;
      buf[px++] = g;
      buf[px++] = r;
    }
    // padding to row boundary
    while (px % 4 !== 0) buf[px++] = 0;
  }

  fs.writeFileSync(file, buf);
  console.log(`Wrote ${file} (${width}x${height})`);
}

const outDir = path.join(__dirname, "../src-tauri/nsis");
fs.mkdirSync(outDir, { recursive: true });

// Header: 150x57, teal background com logo branco simples (3 círculos concêntricos)
writeBMP(
  path.join(outDir, "header.bmp"),
  150,
  57,
  (x, y, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const dx = x - cx;
    const dy = y - cy;
    const r2 = dx * dx + dy * dy;
    // Logo: círculos concêntricos brancos no centro
    if (r2 > 12 * 12 && r2 < 14 * 14) return WHITE;
    if (r2 > 20 * 20 && r2 < 22 * 22) return WHITE;
    if (r2 > 28 * 28 && r2 < 30 * 30) return WHITE;
    return TEAL;
  },
);

// Sidebar: 164x314, dark background com logo grande + nome
writeBMP(
  path.join(outDir, "sidebar.bmp"),
  164,
  314,
  (x, y, w, h) => {
    const cx = w / 2;
    const cy = h / 3; // logo na parte superior
    const dx = x - cx;
    const dy = y - cy;
    const r2 = dx * dx + dy * dy;

    // Logo grande (círculos concêntricos)
    if (r2 > 20 * 20 && r2 < 22 * 22) return WHITE;
    if (r2 > 34 * 34 && r2 < 36 * 36) return WHITE;
    if (r2 > 48 * 48 && r2 < 50 * 50) return WHITE;

    // Nome "Eco" simplificado: blocos brancos abaixo do logo
    const nameY = cy + 60;
    if (y > nameY - 6 && y < nameY + 6) {
      if (x > cx - 30 && x < cx - 20) return WHITE; // E
      if (x > cx - 10 && x < cx) return WHITE;
      if (x > cx + 10 && x < cx + 30) return WHITE; // c/o
    }

    return DARK;
  },
);

console.log("\nDone. BMPs ready for NSIS installer branding.");

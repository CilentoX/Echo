// Gera header.bmp (150x57) e sidebar.bmp (164x314) para o NSIS com a LOGO REAL
// Decodifica app-icon.png (logo real do usuário) e redimensiona bilinear.
// BMP 24-bit sem compressão, fundo #0F1114.
const fs = require('fs');
const zlib = require('zlib');

// ---------- Decodificador PNG (RGB/RGBA) ----------
function decodePNG(buf) {
  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  if (!buf.slice(0,8).equals(sig)) throw new Error('não é PNG');
  let pos = 8, w, h, bitDepth, colorType;
  const idatParts = [];
  let palette = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos+4, pos+8);
    const data = buf.slice(pos+8, pos+8+len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (bitDepth !== 8) throw new Error('bit depth ' + bitDepth + ' não suportado');
    } else if (type === 'IDAT') idatParts.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 0 ? 1 : colorType === 4 ? 2 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x-channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x-channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xFF;
      else if (filter === 2) v = (v + b) & 0xFF;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xFF;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2*c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        v = (v + pr) & 0xFF;
      }
      cur[x] = v;
    }
    for (let x = 0; x < w; x++) {
      const o = (y*w + x) * 4, s = x * channels;
      if (colorType === 6) { out[o]=cur[s]; out[o+1]=cur[s+1]; out[o+2]=cur[s+2]; out[o+3]=cur[s+3]; }
      else if (colorType === 2) { out[o]=cur[s]; out[o+1]=cur[s+1]; out[o+2]=cur[s+2]; out[o+3]=255; }
      else if (colorType === 3) { const pi=cur[s]*3; out[o]=palette[pi]; out[o+1]=palette[pi+1]; out[o+2]=palette[pi+2]; out[o+3]=255; }
      else if (colorType === 0) { out[o]=out[o+1]=out[o+2]=cur[s]; out[o+3]=255; }
      else if (colorType === 4) { out[o]=out[o+1]=out[o+2]=cur[s]; out[o+3]=cur[s+1]; }
    }
    prev = cur;
  }
  return { width: w, height: h, data: out };
}

// ---------- Resize bilinear ----------
function resizeBilinear(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const fy = (y + 0.5) * sh / dh - 0.5;
    const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(sh-1, y0+1), ty = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < dw; x++) {
      const fx = (x + 0.5) * sw / dw - 0.5;
      const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(sw-1, x0+1), tx = Math.max(0, Math.min(1, fx - x0));
      const o = (y*dw + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const p00 = src[(y0*sw+x0)*4+ch], p10 = src[(y0*sw+x1)*4+ch];
        const p01 = src[(y1*sw+x0)*4+ch], p11 = src[(y1*sw+x1)*4+ch];
        out[o+ch] = Math.round(p00*(1-tx)*(1-ty) + p10*tx*(1-ty) + p01*(1-tx)*ty + p11*tx*ty);
      }
    }
  }
  return out;
}

// ---------- Encoder BMP 24-bit ----------
function makeBmp(w, h, rgba) {
  const stride = Math.ceil((w * 24) / 32) * 4;
  const size = 54 + stride * h;
  const b = Buffer.alloc(size);
  b.write('BM', 0, 'ascii');
  b.writeUInt32LE(size, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18); b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
  b.writeUInt32LE(0, 30); b.writeUInt32LE(stride*h, 34);
  b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42);
  for (let row = 0; row < h; row++) {
    const dst = 54 + row * stride;
    const srcRow = h - 1 - row;
    for (let x = 0; x < w; x++) {
      const s = (srcRow * w + x) * 4;
      b[dst + x*3] = rgba[s+2]; b[dst + x*3+1] = rgba[s+1]; b[dst + x*3+2] = rgba[s];
    }
  }
  return b;
}

// ---------- Gera os BMPs com a logo real ----------
const BG = [0x0F, 0x11, 0x14];

const src = decodePNG(fs.readFileSync('app-icon.png'));
console.log('app-icon.png decodificado:', src.width + 'x' + src.height);

function makeBrandedBmp(w, h, logoSize) {
  const logo = resizeBilinear(src.data, src.width, src.height, logoSize, logoSize);
  const canvas = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w*h; i++) {
    canvas[i*4] = BG[0]; canvas[i*4+1] = BG[1]; canvas[i*4+2] = BG[2]; canvas[i*4+3] = 255;
  }
  const ox = Math.floor((w - logoSize) / 2);
  const oy = Math.floor((h - logoSize) / 2);
  for (let y = 0; y < logoSize; y++) {
    for (let x = 0; x < logoSize; x++) {
      const d = ((oy+y)*w + (ox+x)) * 4;
      const s = (y*logoSize + x) * 4;
      const sa = logo[s+3] / 255;
      canvas[d] = Math.round(logo[s]*sa + BG[0]*(1-sa));
      canvas[d+1] = Math.round(logo[s+1]*sa + BG[1]*(1-sa));
      canvas[d+2] = Math.round(logo[s+2]*sa + BG[2]*(1-sa));
      canvas[d+3] = 255;
    }
  }
  return makeBmp(w, h, canvas);
}

fs.writeFileSync('src-tauri/nsis/header.bmp', makeBrandedBmp(150, 57, 45));
console.log('header.bmp 150x57 OK (logo 45px)');
fs.writeFileSync('src-tauri/nsis/sidebar.bmp', makeBrandedBmp(164, 314, 130));
console.log('sidebar.bmp 164x314 OK (logo 130px)');

// Converte a logo real do usuário em todos os artefatos:
// 1. app-icon.png 1024x1024 (fonte do `tauri icon`)
// 2. tray-icon.png 512x512 (fundo escuro preservado, legível em bandejas claras/escuras)
// 3. logo-512.png (para o eco-site)
// 4. favicon-32.png (para o eco-site)
const fs = require('fs');
const zlib = require('zlib');

const SRC = process.argv[2];
const buf = fs.readFileSync(SRC);

// ---------- Decoder PNG (RGB/RGBA/palette/gray, bit depth 8) ----------
function decodePNG(buf) {
  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  if (!buf.slice(0,8).equals(sig)) throw new Error('Não é PNG');
  let pos = 8, width=0, height=0, bitDepth=0, colorType=0;
  let idat = [], palette = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos+4, pos+8);
    const data = buf.slice(pos+8, pos+8+len);
    if (type === 'IHDR') { width=data.readUInt32BE(0); height=data.readUInt32BE(4); bitDepth=data[8]; colorType=data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bit depth ' + bitDepth + ' não suportado');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4); // sempre RGBA
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = raw.slice(p, p + stride); p += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x-channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x-channels] : 0;
      let v = row[x];
      if (filter === 1) v = (v + a) & 0xFF;
      else if (filter === 2) v = (v + b) & 0xFF;
      else if (filter === 3) v = (v + ((a+b)>>1)) & 0xFF;
      else if (filter === 4) {
        const pa=Math.abs(b-c), pb=Math.abs(a-c), pc=Math.abs(a+b-2*c);
        v = (v + ((pa<=pb&&pa<=pc)?a:(pb<=pc?b:c))) & 0xFF;
      }
      cur[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const o = (y*width + x)*4, i = x*channels;
      if (colorType === 6) { cur.copy(out, o, i, i+4); }
      else if (colorType === 2) { out[o]=cur[i]; out[o+1]=cur[i+1]; out[o+2]=cur[i+2]; out[o+3]=255; }
      else if (colorType === 4) { out[o]=out[o+1]=out[o+2]=cur[i]; out[o+3]=cur[i+1]; }
      else if (colorType === 3) {
        const pi = cur[i]*3;
        out[o]=palette[pi]; out[o+1]=palette[pi+1]; out[o+2]=palette[pi+2];
        out[o+3]= trns && cur[i] < trns.length ? trns[cur[i]] : 255;
      }
      else { out[o]=out[o+1]=out[o+2]=cur[i]; out[o+3]=255; }
    }
    prev = cur;
  }
  return { width, height, rgba: out };
}

// ---------- Bilinear resize RGBA ----------
function resizeBilinear(src, sw, sh, dw, dh) {
  const dst = Buffer.alloc(dw * dh * 4);
  const xr = (sw - 1) / (dw - 1 || 1);
  const yr = (sh - 1) / (dh - 1 || 1);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, y * yr);
    const y0 = Math.floor(sy), y1 = Math.min(sh - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, x * xr);
      const x0 = Math.floor(sx), x1 = Math.min(sw - 1, x0 + 1), fx = sx - x0;
      const o = (y*dw + x)*4;
      for (let c = 0; c < 4; c++) {
        const v00 = src[(y0*sw+x0)*4+c], v10 = src[(y0*sw+x1)*4+c];
        const v01 = src[(y1*sw+x0)*4+c], v11 = src[(y1*sw+x1)*4+c];
        const top = v00 + (v10 - v00) * fx;
        const bot = v01 + (v11 - v01) * fx;
        dst[o+c] = Math.round(top + (bot - top) * fy);
      }
    }
  }
  return dst;
}

// ---------- Encoder PNG ----------
function crc32(buf) {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k=0;k<8;k++) c = (c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc>>>8) ^ t[(crc^buf[i])&0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function encodePNG(w, h, rgba) {
  const stride = w*4;
  const raw = Buffer.alloc(h*(1+stride));
  for (let y=0;y<h;y++) { raw[y*(1+stride)]=0; rgba.copy(raw, y*(1+stride)+1, y*stride, y*stride+stride); }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length,0);
    const tb = Buffer.from(type,'ascii');
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb,data])),0);
    return Buffer.concat([len,tb,data,cb]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR',ihdr), chunk('IDAT',compressed), chunk('IEND',Buffer.alloc(0))
  ]);
}

// ---------- Executa ----------
const { width: sw, height: sh, rgba } = decodePNG(buf);
console.log('Fonte:', sw, 'x', sh);

function save(name, size) {
  const data = resizeBilinear(rgba, sw, sh, size, size);
  const png = encodePNG(size, size, data);
  fs.writeFileSync(name, png);
  console.log(name, '→', size+'x'+size, png.length, 'bytes');
}

save('app-icon.png', 1024);
save('src-tauri/icons/tray-icon.png', 512);
save('logo-512.png', 512);
save('favicon-32.png', 32);

console.log('OK — todos os artefatos gerados a partir da imagem original.');

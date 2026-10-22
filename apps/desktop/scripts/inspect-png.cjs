// Examina o PNG da logo do usuário: dimensões, formato, cor de fundo, distribuição de cores
const fs = require('fs');
const zlib = require('zlib');

const file = process.argv[2];
const buf = fs.readFileSync(file);

// Assinatura
const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
if (!buf.slice(0,8).equals(sig)) { console.log('Não é PNG válido'); process.exit(1); }

// Percorrer chunks
let pos = 8;
let width=0, height=0, bitDepth=0, colorType=0;
let idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos+4, pos+8);
  const data = buf.slice(pos+8, pos+8+len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === 'IDAT') {
    idat.push(data);
  } else if (type === 'IEND') break;
  pos += 12 + len;
}
console.log('Dimensões:', width, 'x', height);
console.log('Bit depth:', bitDepth, 'Color type:', colorType, '(0=gray,2=RGB,3=palette,4=gray+A,6=RGBA)');

const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : 1;
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = width * channels;
const px = Buffer.alloc(width * height * channels);

// Unfilter
let prevRow = Buffer.alloc(stride);
let p = 0;
for (let y = 0; y < height; y++) {
  const filter = raw[p++];
  const row = raw.slice(p, p + stride);
  p += stride;
  const cur = Buffer.alloc(stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? cur[x-channels] : 0;
    const b = prevRow[x];
    const c = x >= channels ? prevRow[x-channels] : 0;
    let v = row[x];
    if (filter === 1) v = (v + a) & 0xFF;
    else if (filter === 2) v = (v + b) & 0xFF;
    else if (filter === 3) v = (v + ((a+b)>>1)) & 0xFF;
    else if (filter === 4) {
      const pa = Math.abs(b-c), pb = Math.abs(a-c), pc = Math.abs(a+b-2*c);
      const pred = (pa<=pb && pa<=pc) ? a : (pb<=pc ? b : c);
      v = (v + pred) & 0xFF;
    }
    cur[x] = v;
  }
  cur.copy(px, y*stride);
  prevRow = cur;
}

// Amostra de cores: cantos, centro, histograma simplificado
function getPixel(x, y) {
  const i = (y*width + x)*channels;
  if (channels === 4) return [px[i],px[i+1],px[i+2],px[i+3]];
  if (channels === 3) return [px[i],px[i+1],px[i+2],255];
  return [px[i],px[i],px[i],255];
}
console.log('Canto (0,0):', getPixel(0,0));
console.log('Canto (w-1,0):', getPixel(width-1,0));
console.log('Canto (0,h-1):', getPixel(0,height-1));
console.log('Centro:', getPixel(Math.floor(width/2), Math.floor(height/2)));

// Cores mais comuns (quantizadas 16 níveis)
const counts = new Map();
for (let y = 0; y < height; y+=2) {
  for (let x = 0; x < width; x+=2) {
    const [r,g,b,a] = getPixel(x,y);
    const key = `${r>>4},${g>>4},${b>>4},${a>>4}`;
    counts.set(key, (counts.get(key)||0)+1);
  }
}
const sorted = [...counts.entries()].sort((A,B)=>B[1]-A[1]).slice(0,8);
console.log('Cores dominantes (r,g,b,a em grupos de 16):');
for (const [k,c] of sorted) console.log('  ', k, '→', c, 'amostras');
console.log('Total amostrado:', width*height/4);

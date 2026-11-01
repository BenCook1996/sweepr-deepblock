import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const rootStoreDir = path.resolve('store-creatives');
const activeListingDir = path.join(rootStoreDir, 'active-listing');
const distAssetsDir = path.resolve('dist/store-assets');
fs.mkdirSync(rootStoreDir, { recursive: true });
fs.mkdirSync(activeListingDir, { recursive: true });
fs.mkdirSync(distAssetsDir, { recursive: true });

const concepts = [
  { id: 'c1', folder: 'alternative-1-website-hero-pearl' },
  { id: 'c2', folder: 'alternative-2-laptop-3d-box-studio' },
  { id: 'c3', folder: 'alternative-3-swiss-bento-scorecard' },
  { id: 'c4', folder: 'alternative-4-emerald-obsidian-daylight-split' },
  { id: 'c5', folder: 'alternative-5-browser-first-loupe-zoom' }
];

const targets = [
  { rt: 's1', file: 'slide-1-hero-before-after.png', w: 1280, h: 800 },
  { rt: 's2', file: 'slide-2-video-streaming.png', w: 1280, h: 800 },
  { rt: 's3', file: 'slide-3-cookie-autoreject.png', w: 1280, h: 800 },
  { rt: 's4', file: 'slide-4-scam-shop-search.png', w: 1280, h: 800 },
  { rt: 's5', file: 'slide-5-ram-tamer-privacy.png', w: 1280, h: 800 },
  { rt: 'small-promo', file: 'small-promo-440x280.png', w: 440, h: 280 },
  { rt: 'marquee-promo', file: 'marquee-promo-1400x560.png', w: 1400, h: 560 }
];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function rgbaPngTo24BitRgbPng(buf) {
  let pos = 8;
  let w = 0, h = 0, colorType = 0;
  const idatParts = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatParts.push(data);
    }
    pos += 12 + len;
  }
  if (colorType === 2) return buf;
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const strideRgba = w * 4 + 1;
  const strideRgb = w * 3 + 1;
  const recon = Buffer.alloc(h * w * 4);
  const rgbRaw = Buffer.alloc(h * strideRgb);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }

  for (let y = 0; y < h; y++) {
    const f = raw[y * strideRgba];
    for (let x = 0; x < w * 4; x++) {
      const byte = raw[y * strideRgba + 1 + x];
      const a = x >= 4 ? recon[y * w * 4 + x - 4] : 0;
      const b = y > 0 ? recon[(y - 1) * w * 4 + x] : 0;
      const c = x >= 4 && y > 0 ? recon[(y - 1) * w * 4 + x - 4] : 0;
      let val = byte;
      if (f === 1) val = (byte + a) & 0xff;
      else if (f === 2) val = (byte + b) & 0xff;
      else if (f === 3) val = (byte + ((a + b) >> 1)) & 0xff;
      else if (f === 4) val = (byte + paeth(a, b, c)) & 0xff;
      recon[y * w * 4 + x] = val;
    }
    rgbRaw[y * strideRgb] = 0;
    for (let px = 0; px < w; px++) {
      rgbRaw[y * strideRgb + 1 + px * 3] = recon[y * w * 4 + px * 4];
      rgbRaw[y * strideRgb + 1 + px * 3 + 1] = recon[y * w * 4 + px * 4 + 1];
      rgbRaw[y * strideRgb + 1 + px * 3 + 2] = recon[y * w * 4 + px * 4 + 2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // 24-bit RGB (no alpha)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const comp = zlib.deflateSync(rgbRaw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', comp),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const chromeBin = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = path.join(distAssetsDir, '.headless-profile');

for (const c of concepts) {
  const cDir = path.join(rootStoreDir, c.folder);
  fs.mkdirSync(cDir, { recursive: true });
  for (const t of targets) {
    const outPng = path.join(cDir, t.file);
    const url = `http://localhost:3000/store-creatives?renderConcept=${c.id}&renderTarget=${t.rt}&v=${Date.now()}`;
    execFileSync(
      chromeBin,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--virtual-time-budget=1500',
        `--window-size=${t.w},${t.h}`,
        `--screenshot=${outPng}`,
        url
      ],
      { stdio: 'ignore' }
    );
    const rgbBuf = rgbaPngTo24BitRgbPng(fs.readFileSync(outPng));
    fs.writeFileSync(outPng, rgbBuf);

    // If this is Concept 4 (selected active set), also copy to active-listing and dist/store-assets
    if (c.id === 'c4') {
      fs.writeFileSync(path.join(activeListingDir, t.file), rgbBuf);
      fs.writeFileSync(path.join(distAssetsDir, t.file), rgbBuf);
    }
    console.log(`[${c.id}] ${c.folder}/${t.file} -> ${rgbBuf.readUInt32BE(16)}x${rgbBuf.readUInt32BE(20)} (colorType=${rgbBuf[25]}, ${rgbBuf.length}B)`);
  }
}

try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
console.log('All 35 creatives (5 alternatives x 7 assets) saved to store-creatives/ and Concept 4 synced to store-creatives/active-listing/ & dist/store-assets/.');

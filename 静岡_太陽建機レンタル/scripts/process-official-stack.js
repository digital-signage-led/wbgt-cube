const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'assets', 'taiyo_stack.src.png');
const dstPath = path.join(root, 'assets', 'taiyo_stack.png');

const src = PNG.sync.read(fs.readFileSync(srcPath));
const { width: W, height: H, data } = src;

function isNearWhite(r, g, b, a) {
  if (a < 8) return true;
  return r >= 245 && g >= 245 && b >= 245;
}

function isSoftWhite(r, g, b, a) {
  if (a < 8) return true;
  // AA fringe around black text / mark edges
  return r >= 230 && g >= 230 && b >= 230;
}

// Edge flood → transparent (keep enclosed white petals & letter holes for now)
const seen = new Uint8Array(W * H);
const q = [];
function enq(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  if (seen[i]) return;
  const o = i * 4;
  if (!isNearWhite(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
  seen[i] = 1;
  q.push(i);
}
for (let x = 0; x < W; x++) { enq(x, 0); enq(x, H - 1); }
for (let y = 0; y < H; y++) { enq(0, y); enq(W - 1, y); }
for (let qi = 0; qi < q.length; qi++) {
  const i = q[qi];
  const o = i * 4;
  data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 0;
  const x = i % W;
  const y = (i - x) / W;
  enq(x + 1, y); enq(x - 1, y); enq(x, y + 1); enq(x, y - 1);
}

// Find red mark bbox
let rminY = H, rmaxY = 0, rminX = W, rmaxX = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (data[o + 3] < 20) continue;
    if (data[o] > 170 && data[o + 1] < 100 && data[o + 2] < 100) {
      if (x < rminX) rminX = x;
      if (x > rmaxX) rmaxX = x;
      if (y < rminY) rminY = y;
      if (y > rmaxY) rmaxY = y;
    }
  }
}

// Clear remaining soft-white BELOW mark (letter holes O/A etc. → panel shows through)
const textTop = rmaxY + 1;
for (let y = textTop; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (isSoftWhite(data[o], data[o + 1], data[o + 2], data[o + 3])) {
      data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 0;
    }
  }
}

// Crop to opaque content
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (data[o + 3] > 20) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
const out = new PNG({ width: cw, height: ch, colorType: 6 });
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const si = ((minY + y) * W + (minX + x)) * 4;
    const di = (y * cw + x) * 4;
    out.data[di] = data[si];
    out.data[di + 1] = data[si + 1];
    out.data[di + 2] = data[si + 2];
    out.data[di + 3] = data[si + 3];
  }
}

fs.writeFileSync(dstPath, PNG.sync.write(out));
console.log('wrote', dstPath, cw + 'x' + ch, 'from', W + 'x' + H, 'redY', rminY + '-' + rmaxY);

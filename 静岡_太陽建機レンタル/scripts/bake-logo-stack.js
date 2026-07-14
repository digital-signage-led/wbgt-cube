const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.join(__dirname, '..');
const mark = PNG.sync.read(fs.readFileSync(path.join(root, 'assets', 'taiyo_mark.png')));
const corp = PNG.sync.read(fs.readFileSync(path.join(root, 'assets', 'taiyo_corp.png')));

// Official vertical stack: markW = corpW, gap = markH * 0.1163
const markW = mark.width;
const markH = mark.height;
const gap = Math.round(markH * 0.1163);
const corpW = markW;
const corpH = Math.round(corp.height * (corpW / corp.width));
const outW = markW;
const outH = markH + gap + corpH;
const out = new PNG({ width: outW, height: outH, colorType: 6 });
out.data.fill(0);

function blit(src, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / dw));
      const sy = Math.min(src.height - 1, Math.floor((y * src.height) / dh));
      const si = (src.width * sy + sx) << 2;
      const di = (outW * (dy + y) + (dx + x)) << 2;
      const a = src.data[si + 3] / 255;
      if (a <= 0) continue;
      const oa = out.data[di + 3] / 255;
      const na = a + oa * (1 - a);
      if (na <= 0) continue;
      out.data[di] = Math.round((src.data[si] * a + out.data[di] * oa * (1 - a)) / na);
      out.data[di + 1] = Math.round((src.data[si + 1] * a + out.data[di + 1] * oa * (1 - a)) / na);
      out.data[di + 2] = Math.round((src.data[si + 2] * a + out.data[di + 2] * oa * (1 - a)) / na);
      out.data[di + 3] = Math.round(na * 255);
    }
  }
}

blit(mark, 0, 0, markW, markH);
blit(corp, 0, markH + gap, corpW, corpH);

const outPath = path.join(root, 'assets', 'taiyo_stack.png');
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log('wrote', outPath, outW + 'x' + outH, 'gap', gap, 'corpH', corpH);

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'assets', 'ihara_logo.png');
const tmp = path.join(__dirname, '..', 'assets', 'ihara_logo.tmp.png');

const src =
  process.argv[2] ||
  path.join(__dirname, '..', 'assets', 'ihara_logo.png');

const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const threshold = 235;

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r >= threshold && g >= threshold && b >= threshold) {
    data[i + 3] = 0;
  }
}

await sharp(data, { raw: { width, height, channels } })
  .trim({ threshold: 10 })
  .png()
  .toFile(tmp);

fs.renameSync(tmp, out);

const meta = await sharp(out).metadata();
console.log(`Saved ${out} (${meta.width}x${meta.height})`);

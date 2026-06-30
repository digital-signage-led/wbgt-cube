import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dir, 'wbgt-cube-fujiken-nagasaki-4face.html'), 'utf8');

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const errors = [];
const logs = [];
const browser = await chromium.launch({ headless: true });

async function runCase(name, query) {
  const page = await browser.newPage();
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !/CORS|ERR_FAILED/i.test(text)) errors.push(`[${name}] ${text}`);
    if (/(\[WBGT\]|\[取得\]|\[debug\]|失敗|timeout)/i.test(text)) logs.push(`[${name}] ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name}] PAGE: ${e.message}`));

  await page.goto(base + query, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(10000);

  const before = await page.evaluate(() => window.signageDebug ? window.signageDebug.state() : null);
  const live = await page.evaluate(() => {
    if (!window.signageDebug) return null;
    const s0 = window.signageDebug.state();
    window.signageDebug.setRainMsg('【雨接近】デバッグ文言更新テスト');
    const s1 = window.signageDebug.state();
    return { scrollBefore: s0.globalScrollX, scrollAfter: s1.globalScrollX, transformBefore: s0.footTransform, transformAfter: s1.footTransform, text: s1.footText };
  });

  const dom = await page.evaluate(() => {
    const strip = document.querySelector('.content-area .scene-strip-bg .col-bg-body');
    return {
      activeScene: document.querySelector('.scene.active')?.id || null,
      stripBg: strip ? getComputedStyle(strip).backgroundColor : null,
      hasStripBg: !!document.querySelector('.content-area .scene-strip-bg'),
      hasPanelBg: !!document.querySelector('#scene1 .panel .col-bg-layer')
    };
  });

  await page.close();
  return { name, dom, before, live };
}

const demo = await runCase('demo', '?demo=1&debug=1');
const prod = await runCase('prod-cache', '?debug=1');

await browser.close();
server.close();

console.log('=== demo ===');
console.log(JSON.stringify(demo, null, 2));
console.log('=== prod (no cache) ===');
console.log(JSON.stringify(prod, null, 2));
console.log('=== errors ===');
console.log(errors.length ? errors.join('\n') : '(none)');
console.log('=== logs ===');
console.log(logs.slice(0, 25).join('\n') || '(none)');

const issues = [];
if (errors.length) issues.push('JS errors');
if (!demo.dom.hasStripBg) issues.push('demo: no background');
if (demo.live && Math.abs(demo.live.scrollBefore - demo.live.scrollAfter) > 0.01) {
  issues.push(`demo: scroll jumped ${demo.live.scrollBefore} -> ${demo.live.scrollAfter}`);
}
if (demo.live && demo.live.transformBefore && demo.live.transformAfter === 'translate3d(0px, 0px, 0px)' && demo.live.transformBefore !== 'translate3d(0px, 0px, 0px)') {
  issues.push('demo: foot transform reset to 0 on text update');
}
if (demo.live && !String(demo.live.text || '').includes('デバッグ文言')) {
  issues.push('demo: rain message not applied');
}
if (issues.length) {
  console.log('\n=== ISSUES ===');
  issues.forEach((i) => console.log('- ' + i));
  process.exit(1);
}
console.log('\n=== ALL TESTS PASS ===');

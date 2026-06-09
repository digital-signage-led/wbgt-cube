/**
 * シーン4 上バー・ウェーブ光の確認
 * 実行: node scripts/verify-t3-wave.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { pathToFileURL } from 'url';

const indexUrl = pathToFileURL(path.resolve('index.html')).href;

const CASES = [
    { params: 'only=4&level=2', wave: false, label: '注意', tier: null },
    { params: 'only=4&level=4', wave: true, label: '厳重警戒', tier: 'severe' },
    { params: 'only=4&level=5', wave: true, label: '危険', tier: 'danger' }
];

async function readBarState(page) {
    return page.locator('#scene3 .t3-static-top-bar').evaluate((el) => ({
        wave: el.classList.contains('t3-lv-wave-active'),
        severe: el.classList.contains('t3-lv-wave-severe'),
        danger: el.classList.contains('t3-lv-wave-danger'),
        label: document.querySelector('#scene3 .t3-lv-static')?.textContent?.trim() || ''
    }));
}

async function readGlowSample(page) {
    return page.locator('#scene3 .t3-static-top-bar').evaluate((bar) => {
        const before = getComputedStyle(bar, '::before');
        const after = getComputedStyle(bar, '::after');
        return {
            animationName: before.animationName,
            animationDuration: before.animationDuration,
            timing: before.animationTimingFunction,
            trailDuration: after.animationDuration
        };
    });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 200 } });

let failed = 0;
for (const c of CASES) {
    await page.goto(`${indexUrl}?${c.params}`);
    await page.waitForTimeout(900);
    const state = await readBarState(page);
    const glow = state.wave ? await readGlowSample(page) : null;

    const tierOk = !c.wave
        ? !state.severe && !state.danger
        : c.tier === 'severe'
            ? state.severe && !state.danger
            : !state.severe && state.danger;
    const ok = state.wave === c.wave && state.label === c.label && tierOk
        && (!c.wave || (glow && glow.animationName === 't3-patrol-sweep' && glow.timing === 'linear'));

    const mark = ok ? 'OK' : 'NG';
    if (!ok) failed += 1;
    console.log(`[${mark}] ?${c.params}`);
    console.log(`      wave=${state.wave} label=${state.label} severe=${state.severe} danger=${state.danger}`);
    if (glow) {
        console.log(`      animation=${glow.animationName} duration=${glow.animationDuration} timing=${glow.timing}`);
    }
}

await browser.close();
if (failed) {
    console.error(`\n${failed} case(s) failed.`);
    process.exit(1);
}
console.log('\nAll wave checks passed.');

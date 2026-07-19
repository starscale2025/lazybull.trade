import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
page.on('response', r => {
  const u = r.url();
  if (u.includes('/api/quote?symbol')) console.log(el(), 'HIST-REFETCH (remount signal)', r.status());
  if (u.includes('webpack') || u.includes('hot-update')) console.log(el(), 'HMR', u.slice(0, 100));
});
await page.goto('http://localhost:3000/trade', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// drag the band down once, then watch for 90s at 2s resolution
const rect = await page.evaluate(() => {
  const r = [...document.querySelectorAll('svg rect')].find(x => x.getAttribute('stroke-dasharray') === '6 3');
  const bb = r.getBoundingClientRect();
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
});
await page.mouse.move(rect.x, rect.y);
await page.mouse.down();
await page.mouse.move(rect.x, rect.y + 70, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(500);
const read = () => page.evaluate(() => ({
  thesis: (document.body.innerText.match(/between \$[^\n]*/) || [])[0] || 'NONE',
  nan: (document.body.innerText.match(/NaN/g) || []).length,
}));
const base = await read();
console.log('AFTER DRAG', JSON.stringify(base));
let flips = 0;
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(2000);
  const now = await read();
  if (now.thesis !== base.thesis) { flips++; console.log(el(), 'CHANGED ->', now.thesis); }
  if (now.nan) console.log(el(), 'NaN COUNT', now.nan);
}
console.log('flips:', flips, 'final:', JSON.stringify(await read()));
await b.close();

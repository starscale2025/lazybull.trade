import { chromium } from 'playwright';

const log = (...a) => console.log(...a);
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://localhost:3000/trade', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// helper: read the low/high handle labels from the cone svg
async function band() {
  return await page.evaluate(() => {
    const texts = [...document.querySelectorAll('svg text')].map(t => t.textContent.trim());
    // spot label + low/high labels are numeric strings with 2 decimals
    const nums = texts.filter(t => /^\d+\.\d{2}$/.test(t)).map(Number);
    const prob = texts.find(t => /PROBABILITY RANGE/.test(t)) || '';
    const dLabel = texts.find(t => /d → exp/.test(t)) || '';
    return { nums, prob, dLabel };
  });
}
async function nanCount() {
  return await page.evaluate(() => (document.body.innerText.match(/NaN/g) || []).length);
}

log('--- initial ---', JSON.stringify(await band()));
log('NaN:', await nanCount());

// locate the band rect (dashed) to drag
const rectBox = await page.evaluate(() => {
  const r = [...document.querySelectorAll('svg rect')].find(x => x.getAttribute('stroke-dasharray') === '6 3');
  if (!r) return null;
  const bb = r.getBoundingClientRect();
  return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
});
log('band rect', JSON.stringify(rectBox));

// (a) drag the band down 60px, then wait 35s across >=3 poll cycles
const cx = rectBox.x + rectBox.w / 2, cy = rectBox.y + rectBox.h / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx, cy + 60, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(400);
const afterDrag = await band();
log('--- after drag ---', JSON.stringify(afterDrag));
for (let i = 1; i <= 4; i++) {
  await page.waitForTimeout(10000);
  const now = await band();
  log(`t+${i * 10}s`, JSON.stringify(now), 'STOMPED=' + (JSON.stringify(now.nums) !== JSON.stringify(afterDrag.nums)));
}
log('NaN after polls:', await nanCount());

// (b) symbol switching
async function pickSym(s) {
  await page.getByRole('button', { name: new RegExp('^' + s) }).first().click().catch(async () => {
    await page.locator(`text=${s}`).first().click();
  });
  await page.waitForTimeout(1200);
}
for (const s of ['SPY', 'AMZN', 'SPY', 'NVDA', 'AMZN']) {
  await pickSym(s);
  const st = await band();
  log('sym', s, JSON.stringify(st), 'NaN=' + (await nanCount()));
}

await b.close();
log('ERRORS:', errs.length ? errs.slice(0, 20) : 'none');

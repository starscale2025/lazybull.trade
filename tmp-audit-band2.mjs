import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:3000/trade', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

async function probe() {
  return await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    const texts = [...document.querySelectorAll('svg text')].map(t => t.textContent.trim());
    const nums = texts.filter(t => /^\d+\.\d{2}$/.test(t)).map(Number);
    const cone = document.querySelector('svg text')?.textContent;
    const bodyLen = document.body.innerText.length;
    const nan = (document.body.innerText.match(/NaN/g) || []).length;
    const thesis = (document.body.innerText.match(/between \$[^\n]*/) || [])[0] || '';
    return { svgCount: svgs.length, textCount: texts.length, nums, bodyLen, nan, thesis };
  });
}
for (let i = 0; i <= 5; i++) {
  console.log('t+' + i * 10, JSON.stringify(await probe()));
  if (i < 5) await page.waitForTimeout(10000);
}
await page.screenshot({ path: '/tmp/claude-503/lazybull-r3/t50.png' });
await b.close();

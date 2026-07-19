import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('response', r => { if (r.url().includes('/api/quote')) console.log('RESP', new Date().toISOString().slice(14,19), r.status(), r.url().slice(0,80)); });
await page.goto('http://localhost:3000/trade', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
let badDumped = false;
for (let i = 0; i < 14; i++) {
  const st = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      textCount: document.querySelectorAll('svg text').length,
      thesis: (txt.match(/between \$[^\n]*/) || [])[0] || '',
      spotLine: (txt.match(/\$\d+\.\d\d/g) || []).slice(0,4),
      txt,
    };
  });
  console.log(i * 5 + 's', st.textCount, st.thesis, JSON.stringify(st.spotLine));
  if (st.textCount < 5 && !badDumped) {
    badDumped = true;
    fs.writeFileSync('/tmp/claude-503/lazybull-r3/bad-state.txt', st.txt);
    await page.screenshot({ path: '/tmp/claude-503/lazybull-r3/bad.png', fullPage: false });
  }
  await page.waitForTimeout(5000);
}
await b.close();

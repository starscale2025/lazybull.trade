import { chromium } from 'playwright';
const b = await chromium.launch();

// A) hydration reproducibility
for (const n of [1,2,3]) {
  const p = await (await b.newContext()).newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message.split('\n')[0]));
  await p.goto('http://localhost:3000/admin', {waitUntil:'load'});
  await p.waitForTimeout(2500);
  console.log(`load#${n} pageerrors:`, JSON.stringify(errs));
  await p.close();
}

// B) kill switch double-arm
{
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/admin', {waitUntil:'networkidle'});
await p.waitForTimeout(1200);
const btn = p.locator('button[aria-pressed]').first();
const face = async()=> (await btn.innerText()).replace(/\n/g,' ');
console.log('KS initial:', await face());
await btn.click(); await p.waitForTimeout(2200);
console.log('KS armed t+2.2s:', await face());
await btn.click(); await p.waitForTimeout(200);          // disarm
console.log('KS disarmed:', await face());
await btn.click();                                        // immediately re-arm
console.log('KS re-armed t+0:', await face());
for (const w of [1000,1000,1000,1000,1000,1000]) { await p.waitForTimeout(w); console.log('  +1s ->', await face()); }
await p.close();
}
await b.close();

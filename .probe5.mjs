import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
await p.goto('http://localhost:3000/admin', {waitUntil:'networkidle'});
await p.waitForTimeout(1500);
// event stream panel = the one containing the pause button
const panel = p.locator('div.relative.flex.h-full.flex-col').filter({has:p.locator('button:text-is("pause"), button:text-is("resume")')});
console.log('panels matched:', await panel.count());
const rows = ()=>panel.locator('div.divide-y > div.grid').count();
const badge = ()=>panel.locator('span.tabular-nums').first().innerText();
console.log('all rows:', await rows(), 'badge:', await badge());
for (const f of ['trade','ai','auth','warn','err','kill','all']) {
  await panel.locator(`button:text-is("${f}")`).click(); await p.waitForTimeout(200);
  console.log(`filter ${f}: rows=${await rows()}`);
}
console.log('-- pause --');
const b0 = await badge();
await panel.locator('button:text-is("pause")').click(); await p.waitForTimeout(7000);
const b1 = await badge();
console.log('badge before/after 7s paused:', b0, b1, 'btn:', await panel.locator('button:text-is("resume")').count()?'resume':'?');
await panel.locator('button:text-is("resume")').click(); await p.waitForTimeout(7000);
console.log('badge after 7s resumed:', await badge());

console.log('-- health chart toggles --');
const hp = p.locator('div').filter({has:p.locator('button:text-is("p99")')}).last();
for (const s of ['rps','p99','err','all']) {
  await p.locator(`button:text-is("${s}")`).first().click(); await p.waitForTimeout(250);
  const paths = await hp.locator('svg path').count();
  const active = await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>['all','rps','p99','err'].includes(b.innerText.trim())&&b.className.includes('bull')).map(b=>b.innerText.trim()));
  console.log(`series ${s}: svg paths=${paths} active=${JSON.stringify(active)}`);
}
await b.close();

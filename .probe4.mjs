import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message.split('\n')[0]));
await p.goto('http://localhost:3000/admin', {waitUntil:'networkidle'});
await p.waitForTimeout(1500);

// enumerate every interactive control
const ctrls = await p.evaluate(()=>[...document.querySelectorAll('button,a,input,select')].map(e=>({tag:e.tagName,txt:(e.innerText||e.value||'').trim().replace(/\n/g,' ').slice(0,40),href:e.getAttribute('href')||''})));
console.log('CONTROL COUNT:', ctrls.length);
console.log(JSON.stringify(ctrls.slice(0,40)));

// event stream filters
const es = p.locator('div:has-text("event stream")').last();
for (const f of ['trade','ai','auth','warn','err','kill']) {
  await p.locator(`button:text-is("${f}")`).first().click(); await p.waitForTimeout(250);
  const n = await p.locator('div.divide-y.divide-border-soft > div.grid').count();
  console.log(`filter ${f}: rows=${n}`);
}
await p.locator('button:text-is("all")').first().click(); await p.waitForTimeout(200);

// pause
const cnt=async()=>parseInt(await p.locator('span.tabular-nums').first().innerText());
console.log('count before pause:', await cnt());
await p.locator('button:text-is("pause")').click(); await p.waitForTimeout(6000);
console.log('count after 6s paused:', await cnt(), 'label:', await p.locator('button:text-is("resume")').count());
await p.locator('button:text-is("resume")').click(); await p.waitForTimeout(6000);
console.log('count after 6s resumed:', await cnt());

// any other clickable panels
const links = ctrls.filter(c=>c.tag==='A');
console.log('LINKS:', JSON.stringify(links));
for (const l of links) { if(l.href && l.href.startsWith('/')) { const r=await p.request.get('http://localhost:3000'+l.href); console.log('link',l.href,'->',r.status()); } }

console.log('ERRS:', JSON.stringify(errs));
await b.close();

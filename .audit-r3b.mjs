import { chromium } from 'playwright';
const b = await chromium.launch();
for (const r of ['/pro','/auth/signin']) {
  const ctx = await b.newContext({viewport:{width:1280,height:900}});
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('=== PAGEERROR on '+r+' ===\n'+e.stack));
  p.on('requestfailed', rq => console.log('  reqfail '+r+': '+rq.url().slice(0,140)+' :: '+rq.failure()?.errorText));
  p.on('response', async res => { if(res.status()>=400) console.log('  HTTP '+res.status()+' '+res.url().slice(0,140)); });
  await p.goto('http://localhost:3000'+r, {waitUntil:'domcontentloaded',timeout:20000}).catch(e=>console.log('nav',e.message));
  await p.waitForTimeout(4000);
  await ctx.close();
}
await b.close();

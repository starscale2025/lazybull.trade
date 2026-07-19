import { chromium } from 'playwright';
const routes = ['/','/learn','/learn/bots','/trade','/trade/chain','/pro','/quant','/greeks','/pricing','/about','/auth/signin'];
const b = await chromium.launch();
for (const r of routes) {
  const ctx = await b.newContext({ viewport:{width:1280,height:900} });
  const p = await ctx.newPage();
  const msgs=[], errs=[];
  p.on('console', m => { if(m.type()==='error'||m.type()==='warning') msgs.push(m.type()+': '+m.text().slice(0,300)); });
  p.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,300)));
  await p.goto('http://localhost:3000'+r, {waitUntil:'domcontentloaded', timeout:20000}).catch(e=>errs.push('NAV: '+e.message.slice(0,120)));
  await p.waitForTimeout(3000);
  const hyd = msgs.filter(m=>/hydrat|did not match|Text content does not match|server rendered/i.test(m));
  console.log('=== '+r);
  console.log('  hydration:', hyd.length? hyd : 'none');
  const other = msgs.filter(m=>!hyd.includes(m));
  if(other.length) console.log('  console:', other.slice(0,6));
  if(errs.length) console.log('  errors:', errs);
  await ctx.close();
}
await b.close();

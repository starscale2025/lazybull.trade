import { chromium } from 'playwright';
const b = await chromium.launch();
// re-check flaky pageerrors
for (const r of ['/pro','/auth/signin']) {
  for (let i=0;i<2;i++){
    const ctx=await b.newContext(); const p=await ctx.newPage();
    p.on('pageerror',e=>console.log('FLAKE '+r+' run'+i+': '+e.message));
    await p.goto('http://localhost:3000'+r,{waitUntil:'domcontentloaded',timeout:20000}).catch(()=>{});
    await p.waitForTimeout(3500); await ctx.close();
  }
}
console.log('--- pageerror recheck done ---');

// (c) footer a11y
const ctx=await b.newContext({viewport:{width:1280,height:900}});
const p=await ctx.newPage();
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
const foot = await p.evaluate(()=>{
  const f=document.querySelector('footer');
  const links=[...f.querySelectorAll('a')].map(a=>({t:a.textContent.trim().slice(0,30),href:a.getAttribute('href')}));
  const spans=[...f.querySelectorAll('li span, .cursor-default')].filter(s=>s.getAttribute('title')==='Coming soon')
    .map(s=>({t:s.textContent.trim().slice(0,30),tabindex:s.getAttribute('tabindex'),role:s.getAttribute('role'),tag:s.tagName}));
  return {links,spans};
});
console.log('FOOTER LINKS:', JSON.stringify(foot.links,null,0));
console.log('FOOTER SOON SPANS:', JSON.stringify(foot.spans));
// tab through footer: are any "soon" items focusable?
const focusables = await p.evaluate(()=>{
  const f=document.querySelector('footer');
  return [...f.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .map(e=>e.tagName+' :: '+e.textContent.trim().slice(0,28));
});
console.log('FOOTER FOCUSABLE:', JSON.stringify(focusables,null,0));
await ctx.close(); await b.close();

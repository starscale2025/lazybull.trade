import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:1280,height:900}});
const p = await ctx.newPage();

// --- footer subscribe form ---
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
const meta = await p.evaluate(()=>{
  const f=document.querySelector('footer form');
  const i=f.querySelector('input'), btn=f.querySelector('button');
  return {formAction:f.getAttribute('action'), formMethod:f.getAttribute('method'),
          inputName:i.getAttribute('name'), btnType:btn.getAttribute('type'), btnTypeProp:btn.type};
});
console.log('FORM META:', JSON.stringify(meta));
const before = p.url();
await p.locator('footer form input').fill('learner@inbox.io');
let navigated=false; p.on('framenavigated',fr=>{if(fr===p.mainFrame())navigated=true;});
await p.locator('footer form button').click();
await p.waitForTimeout(2500);
console.log('URL before:', before);
console.log('URL after :', p.url());
console.log('navigated :', navigated, '| input value now:', await p.locator('footer form input').inputValue().catch(()=>'GONE'));

// --- anchor scroll ---
await p.goto('http://localhost:3000/learn#volsmile',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500);
const sc = await p.evaluate(()=>({y:window.scrollY, elTop: document.getElementById('volsmile')?.getBoundingClientRect().top}));
console.log('ANCHOR /learn#volsmile ->', JSON.stringify(sc));

// --- Nav breakpoints ---
for (const w of [375,768,1280]) {
  await p.setViewportSize({width:w,height:900});
  await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2000);
  const nav = await p.evaluate(()=>{
    const n=document.querySelector('nav');
    const inner=n.firstElementChild;
    const kids=[...inner.children].map(c=>{const r=c.getBoundingClientRect();return {cls:c.className.slice(0,40),x:Math.round(r.x),w:Math.round(r.width),vis:r.width>0};});
    const right=inner.lastElementChild;
    const rk=[...right.children].map(c=>{const r=c.getBoundingClientRect();return {tag:c.tagName,t:c.textContent.trim().slice(0,18),x:Math.round(r.x),w:Math.round(r.width),h:Math.round(r.height)};});
    return {navH:Math.round(n.getBoundingClientRect().height), innerW:Math.round(inner.getBoundingClientRect().width),
            scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth, kids, right:rk};
  });
  console.log('NAV @'+w+':', JSON.stringify(nav,null,1));
  await p.screenshot({path:'/tmp/claude-503/lazybull-r3/nav-'+w+'.png', clip:{x:0,y:0,width:w,height:70}});
}
await b.close();

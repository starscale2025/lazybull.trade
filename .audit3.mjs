import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1600,height:1000}});
p.on('pageerror', e=>console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/pro', {waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>[...document.querySelectorAll('svg')].some(s=>s.getBoundingClientRect().width>600), null, {timeout:60000});
await p.waitForTimeout(2000);
const box = await p.evaluate(()=>{let best=null,ba=0;for(const s of document.querySelectorAll('svg')){const r=s.getBoundingClientRect();if(r.width*r.height>ba){ba=r.width*r.height;best=r;}}return {x:best.x,y:best.y};});
const cx=box.x+200, cy=box.y+200;
const count = async () => +((await p.textContent('body')).match(/(\d+) drawing/)?.[1]);

await p.keyboard.press('t');
await p.mouse.move(cx, cy); await p.mouse.down();
for(let i=1;i<=10;i++) await p.mouse.move(cx+i*15, cy+i*8);
await p.mouse.up(); await p.waitForTimeout(400);
console.log('trendline ->', await count());
await p.keyboard.press('b');
await p.mouse.move(cx, cy+300); await p.mouse.down();
for(let i=1;i<=40;i++) await p.mouse.move(cx+i*8, cy+300+Math.sin(i/3)*40);
await p.mouse.up(); await p.waitForTimeout(400);
console.log('brush ->', await count());
await p.keyboard.press('h');
await p.mouse.click(cx+400, cy+50); await p.waitForTimeout(250);
await p.mouse.click(cx+420, cy+90); await p.waitForTimeout(250);
console.log('2 horiz ->', await count());
await p.evaluate((a)=>{
  const el=document.elementFromPoint(a[0],a[1]);
  const mk=(t,x,y)=>new MouseEvent(t,{bubbles:true,clientX:x,clientY:y,button:0});
  el.dispatchEvent(mk('mousedown',a[0],a[1])); el.dispatchEvent(mk('mouseup',a[0],a[1]));
  el.dispatchEvent(mk('mousedown',a[0],a[1]+30)); el.dispatchEvent(mk('mouseup',a[0],a[1]+30));
},[cx+600, cy+50]);
await p.waitForTimeout(500);
console.log('same-task 2 horiz ->', await count(), '(expect 6)');
for(let i=0;i<7;i++){ await p.keyboard.press('Meta+z'); await p.waitForTimeout(200); process.stdout.write('u'+(i+1)+'='+(await count())+' ');}
console.log('');
for(let i=0;i<7;i++){ await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(200); process.stdout.write('r'+(i+1)+'='+(await count())+' ');}
console.log('');
await b.close();

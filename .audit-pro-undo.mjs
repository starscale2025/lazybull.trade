import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1600,height:1000}});
p.on('pageerror', e=>console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/pro', {waitUntil:'networkidle'});
await p.waitForFunction(()=>[...document.querySelectorAll('svg')].some(s=>s.getBoundingClientRect().width>600), null, {timeout:60000});
await p.waitForTimeout(1500);
const box = await p.evaluate(()=>{let best=null,ba=0;for(const s of document.querySelectorAll('svg')){const r=s.getBoundingClientRect();if(r.width*r.height>ba){ba=r.width*r.height;best=r;}}return {x:best.x,y:best.y,width:best.width,height:best.height};});
console.log('chart box', box);
const count = async () => +((await p.textContent('body')).match(/(\d+) drawing/)?.[1]);
const cx = box.x+200, cy = box.y+200;
console.log('start count', await count());

await p.keyboard.press('t');
await p.mouse.move(cx, cy); await p.mouse.down();
for(let i=1;i<=10;i++) await p.mouse.move(cx+i*15, cy+i*8);
await p.mouse.up(); await p.waitForTimeout(400);
console.log('T1 trendline count =', await count(), '(expect 1)');

await p.keyboard.press('b');
await p.mouse.move(cx, cy+300); await p.mouse.down();
for(let i=1;i<=40;i++) await p.mouse.move(cx+i*8, cy+300+Math.sin(i/3)*40);
await p.mouse.up(); await p.waitForTimeout(400);
console.log('T2 brush count =', await count(), '(expect 2)');
console.log('   brush pts =', await p.evaluate(()=>document.querySelectorAll('path').length));

await p.keyboard.press('h');
await p.mouse.click(cx+400, cy+50);
await p.mouse.click(cx+420, cy+90);
await p.waitForTimeout(400);
console.log('T3 rapid 2 horiz count =', await count(), '(expect 4)');

await p.evaluate((a)=>{
  const el=document.elementFromPoint(a[0],a[1]);
  const mk=(t,x,y)=>new MouseEvent(t,{bubbles:true,clientX:x,clientY:y,button:0});
  el.dispatchEvent(mk('mousedown',a[0],a[1])); el.dispatchEvent(mk('mouseup',a[0],a[1]));
  el.dispatchEvent(mk('mousedown',a[0],a[1]+30)); el.dispatchEvent(mk('mouseup',a[0],a[1]+30));
},[cx+600, cy+50]);
await p.waitForTimeout(500);
console.log('T3b same-task 2 horiz count =', await count(), '(expect 6)');

const N = await count();
const seq=[];
for(let i=0;i<N+1;i++){ await p.keyboard.press('Meta+z'); await p.waitForTimeout(200); seq.push(await count()); }
console.log('T4 undo sequence:', seq.join(','), '(expect descending to 0)');
const seq2=[];
for(let i=0;i<N+1;i++){ await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(200); seq2.push(await count()); }
console.log('T5 redo sequence:', seq2.join(','), '(expect ascending to '+N+')');

await p.keyboard.press('Meta+z'); await p.waitForTimeout(300);
const a1=await count();
await p.keyboard.press('h'); await p.mouse.click(cx+300, cy+400); await p.waitForTimeout(400);
const a2=await count();
await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(400);
console.log('T6 undo->',a1,' new->',a2,' redo->',await count(),'(redo must stay',a2,')');
await p.screenshot({path:'/tmp/claude-503/lazybull-r3/final.png'});
await b.close();

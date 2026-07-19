import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1600,height:1000}});
p.on('pageerror', e=>console.log('PAGEERROR', e.message));
p.on('console', m=>{ if(m.type()==='error') console.log('CONSOLE-ERR', m.text().slice(0,200)); });
await p.goto('http://localhost:3000/pro', {waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>[...document.querySelectorAll('svg')].some(s=>s.getBoundingClientRect().width>600), null, {timeout:60000});
await p.waitForTimeout(2000);
const box = await p.evaluate(()=>{let best=null,ba=0;for(const s of document.querySelectorAll('svg')){const r=s.getBoundingClientRect();if(r.width*r.height>ba){ba=r.width*r.height;best=r;}}return {x:best.x,y:best.y};});
const cx=box.x+200, cy=box.y+200;
const count = async () => +((await p.textContent('body')).match(/(\d+) drawing/)?.[1]);
const tool = async () => await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/border-accent|text-accent|bg-accent/.test(b.className)).map(b=>b.getAttribute('title')||b.textContent.trim().slice(0,12)).join('|'));

async function addH(dx,dy){ await p.keyboard.press('h'); await p.mouse.click(cx+dx, cy+dy); await p.waitForTimeout(250); }
for(let i=0;i<3;i++) await addH(100+i*40, 40+i*40);
console.log('after 3 horizontals count =', await count());
await p.keyboard.press('Meta+z'); await p.waitForTimeout(300); console.log('undo1 ->', await count());
await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(300); console.log('redo1 ->', await count(), '(expect 3)');
await p.keyboard.press('Meta+z'); await p.waitForTimeout(300); console.log('undo2 ->', await count());
await p.keyboard.press('Meta+z'); await p.waitForTimeout(300); console.log('undo3 ->', await count());
await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(300); console.log('redo2 ->', await count(),'(expect 2)');
await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(300); console.log('redo3 ->', await count(),'(expect 3)');
console.log('active tool markers:', await tool());
await addH(300,300);
console.log('after new horizontal count =', await count());
await p.screenshot({path:'/tmp/claude-503/lazybull-r3/a2.png'});
await b.close();

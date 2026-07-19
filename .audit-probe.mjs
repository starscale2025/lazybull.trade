import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1600,height:1000}});
p.on('pageerror', e=>console.log('PAGEERROR', e.message, e.stack?.split('\n').slice(0,4).join('|')));
await p.goto('http://localhost:3000/pro', {waitUntil:'networkidle'});
await p.waitForTimeout(5000);
console.log(await p.evaluate(()=>[...document.querySelectorAll('svg')].map(s=>{const r=s.getBoundingClientRect();return `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)},${Math.round(r.y)} cls=${s.getAttribute('class')}`}).filter(x=>!x.startsWith('18x18')).join('\n')));
await b.close();

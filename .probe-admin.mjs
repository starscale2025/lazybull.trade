import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const logs=[]; p.on('console', m=>logs.push(m.text()));
await p.goto('http://localhost:3000/admin', {waitUntil:'networkidle'});
await p.waitForTimeout(1500);
const INPUT='div.max-w-2xl input';
const ROWS='div.max-h-\\[60vh\\] > button';

console.log('-- open via Cmd+K --');
await p.keyboard.press('Meta+k'); await p.waitForTimeout(400);
console.log('open:', await p.locator(INPUT).count(), 'rows:', await p.locator(ROWS).count());
console.log('focused:', await p.evaluate(()=>document.activeElement.tagName));

console.log('-- filter "rot" --');
await p.locator(INPUT).fill('rot'); await p.waitForTimeout(250);
console.log('rows:', JSON.stringify((await p.locator(ROWS).allInnerTexts()).map(s=>s.replace(/\n/g,' '))));
console.log('-- filter "zzz" --');
await p.locator(INPUT).fill('zzz'); await p.waitForTimeout(250);
console.log('empty msg:', await p.locator('text=no commands match').count());
await p.locator(INPUT).fill(''); await p.waitForTimeout(250);
console.log('rows all:', await p.locator(ROWS).count());

console.log('-- arrow nav highlight --');
const hl=async()=>p.evaluate(()=>[...document.querySelectorAll('div.max-h-\\[60vh\\] > button')].findIndex(b=>b.className.includes('bg-bull/10')));
console.log('active start:', await hl());
await p.keyboard.press('ArrowDown'); await p.waitForTimeout(120); console.log('after Down:', await hl());
await p.keyboard.press('ArrowDown'); await p.waitForTimeout(120); console.log('after Down:', await hl());
await p.keyboard.press('ArrowUp'); await p.waitForTimeout(120); console.log('after Up:', await hl());

console.log('-- Enter executes --');
logs.length=0;
await p.keyboard.press('Enter'); await p.waitForTimeout(300);
console.log('dispatch logs:', JSON.stringify(logs.filter(l=>l.includes('[admin]'))));
console.log('open after Enter:', await p.locator(INPUT).count());

console.log('-- Escape --');
await p.keyboard.press('Meta+k'); await p.waitForTimeout(300);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
console.log('open after Esc:', await p.locator(INPUT).count());

console.log('-- typing "k" in input toggles? --');
await p.keyboard.press('Meta+k'); await p.waitForTimeout(300);
await p.locator(INPUT).type('kill'); await p.waitForTimeout(200);
console.log('after typing kill, open:', await p.locator(INPUT).count(), 'val:', await p.locator(INPUT).inputValue().catch(()=>'GONE'));
await b.close();

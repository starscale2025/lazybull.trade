import { chromium } from 'playwright';
const b = await chromium.launch();
const cases = ['', '?error=OAuthSignin', '?error=Configuration', '?error=100%25', '?error=100%', '?error=%E0%A4%A', '?error=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', '?callbackUrl=https://evil.example.com'];
for (const q of cases) {
  const p = await (await b.newContext()).newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message.split('\n')[0]));
  const r = await p.goto('http://localhost:3000/auth/signin'+q, {waitUntil:'load'});
  await p.waitForTimeout(1200);
  let banner='(none)', h1='(none)';
  try { h1 = await p.locator('h1').first().innerText({timeout:1500}); } catch {}
  try { banner = await p.locator('div:has-text("⚠")').last().innerText({timeout:800}); } catch {}
  const bodyLen = (await p.locator('body').innerText()).length;
  console.log(`[${q||'(none)'}] status=${r.status()} bodyLen=${bodyLen} h1=${JSON.stringify(h1.replace(/\n/g,' '))} banner=${JSON.stringify(banner.replace(/\n/g,' ').slice(0,60))} errs=${JSON.stringify(errs)}`);
  await p.close();
}
// provider button click
{
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/auth/signin', {waitUntil:'networkidle'});
await p.waitForTimeout(800);
const reqs=[]; p.on('request', r=>reqs.push(r.method()+' '+r.url()));
await p.locator('button:has-text("Continue with Google")').click();
await p.waitForTimeout(2500);
console.log('after click url:', p.url());
console.log('reqs:', JSON.stringify(reqs.filter(r=>r.includes('auth')).slice(0,6)));
console.log('visible text after click:', (await p.locator('body').innerText()).slice(0,160).replace(/\n/g,' | '));
await p.close();
}
await b.close();

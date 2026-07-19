import { chromium } from 'playwright';
import fs from 'fs';

const IDS = process.argv[2].split(',');
const DIR = '/tmp/claude-503/lazybull-r3';
fs.mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
for (const id of IDS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 300)));
  const resp = await page.goto(`http://localhost:3000/learn/bots/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(14000);
  let body='';
  for (let a=0;a<3;a++){ try { body = await page.evaluate(() => document.body.innerText); break; } catch(e){ await page.waitForTimeout(3000); } }
  fs.writeFileSync(`${DIR}/${id}.txt`, body);
  const bad = [];
  for (const pat of ['NaN', 'Infinity', 'undefined', '[object Object]', 'bot not found', 'on the way —']) {
    if (body.includes(pat)) bad.push(pat);
  }
  let dm={cellText:'',svg:0,hasRun:false};
  try { dm = await page.evaluate(() => {
    // demo cell = the element containing the "▶ run" button
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent.includes('run'));
    const cell = runBtn ? runBtn.closest('div.border') : null;
    let cellText = '';
    let node = runBtn;
    for (let i = 0; i < 8 && node; i++) { node = node.parentElement; }
    const root = document.querySelectorAll('section')[0];
    // find the section whose text has "LIVE DEMO"
    const secs = Array.from(document.querySelectorAll('section'));
    const demoSec = secs.find(s => s.innerText.toUpperCase().includes('LIVE DEMO'));
    if (demoSec) cellText = demoSec.innerText;
    return {
      cellText,
      svg: demoSec ? demoSec.querySelectorAll('svg').length : 0,
      hasRun: !!runBtn,
    };
  }); } catch(e){ console.log('  EVAL FAIL', e.message.slice(0,120)); }
  const flags = [];
  if (/NaN|Infinity|undefined/.test(dm.cellText)) flags.push('BADNUM_IN_DEMO');
  if (dm.svg === 0) flags.push('NO_CHART_SVG');
  if (/loading/i.test(dm.cellText)) flags.push('STILL_LOADING');
  const realErrs = errs.filter(e => !/ERR_CONNECTION_REFUSED|auth\/session|status of 500/.test(e));
  console.log(`\n=== ${id} [${resp.status()}] svg=${dm.svg} bad=${JSON.stringify(bad)} flags=${JSON.stringify(flags)} errs=${realErrs.length}`);
  if (realErrs.length) console.log('  ERR:', realErrs.slice(0, 4).join(' || '));
  console.log('  DEMO:', dm.cellText.replace(/\n+/g, ' | ').slice(0, 900));
  await ctx.close();
}
await browser.close();

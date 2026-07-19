import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
await p.goto('http://localhost:3000/admin', {waitUntil:'networkidle'});
await p.waitForTimeout(1500);
const hp = p.locator('div.relative.h-full.overflow-hidden').filter({hasText:'system health'}).first();
console.log('health panels:', await hp.count());
for (const s of ['rps','p99','err','all']) {
  await hp.locator(`button:text-is("${s}")`).click(); await p.waitForTimeout(250);
  console.log(`${s}: paths=${await hp.locator('svg path').count()} strokes=${JSON.stringify(await hp.locator('svg path').evaluateAll(ps=>ps.map(x=>x.getAttribute('stroke'))))}`);
}
// y-axis labels? padL=36 reserved
console.log('svg text nodes (y-axis labels):', await hp.locator('svg text').count());
// legend
console.log('legend:', (await hp.locator('div.mt-2').innerText()).replace(/\n/g,' | '));
// geo map / heatmap / trades / errors / funnel / signup interactivity
for (const name of ['UserGeoMap','SymbolHeatmap','RecentTrades','ErrorTopList','SignupTimeline','ProFunnel','KpiStrip']) {}
const all = await p.evaluate(()=>({buttons:document.querySelectorAll('button').length, svgs:document.querySelectorAll('svg').length}));
console.log(all);
await p.screenshot({path:'/tmp/claude-503/lazybull-r3/admin.png', fullPage:true});
await b.close();

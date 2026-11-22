// Guard: Pro charts keeps the view you chose, and its last candle moves (2026-11-22).
//   node scripts/pro-chart.mjs [baseUrl]      (default http://localhost:3100)
//
// The owner reported that the time frames did not work and that candles did not
// go up and down live. Both came from one habit: the chart treated every fresh
// array of bars as a new chart, and the page makes one on each 30 s refetch and
// each price tick. A range or a zoom lasted until the next poll, and a new price
// arrived as a redraw of the whole chart. Around that sat three smaller faults:
// the range buttons were bar counts that ignored the bar size, the time axis
// only ever printed dates, and the chart heard a price once in 15 s.
//
// With canned bars and a hand-fed price stream, this checks that:
//   · the page opens on a range that is true (six months of daily bars)
//   · a chosen range survives the refetch, with no entrance replayed
//   · a zoom by hand un-lights the range and survives the refetch too
//   · every range button picks its bar size and shows its span of time
//   · a timeframe button un-lights the range and shows the last 120 bars
//   · the time axis shows the clock on intraday bars and names each new day
//   · a tick inside the developing bar moves the last candle; one past its end
//     opens the next candle; neither replays the entrance or moves the view
//   · a refetch that does not list the developing minute yet leaves that candle
//     as the ticks built it (its open, high and low)
//   · with the market shut a tick only moves the last candle
//   · scrolled back into history, ticks and refetches leave the view where it is
//   · bars that answer after another bar size was picked are not drawn
//   · on a phone the range row still works and nothing scrolls sideways
// The page's 30 s and 15 s timers are shortened here so a refetch takes a second.

import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3100").replace(/\/$/, "");
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const STEP = { "1m": MIN, "5m": 5 * MIN, "15m": 15 * MIN, "1h": HOUR, "4h": 4 * HOUR, D: DAY, W: 7 * DAY, M: 30 * DAY };
/** Intraday bars come in sessions a day apart: [bars a session, sessions]. */
const SESSIONS = { "1m": [390, 1], "5m": [78, 5], "15m": [26, 17], "1h": [7, 30], "4h": [2, 34] };
const COUNT = { D: 1300, W: 330, M: 77 };
const SPOT = 200;

const fails = [];
let where = "";
const check = (ok, what) => (ok ? console.log(`✓ ${where}${what}`) : (fails.push(where + what), console.error(`✗ ${where}${what}`)));

// ── the canned feed ──────────────────────────────────────────────────────────
// `clock` is the feed's idea of now and `last` its newest trade. Bars run up to
// the one the clock is in, which closes on `last`; a tick pushed by a check moves
// both. The clock starts five seconds into a minute, six minutes ago, so the
// checks can place trades in that minute and the three after it without dating
// one ahead of the real time (the page will not open a bar from the future).
// `finishedOnly` makes the one-minute bars stop at the last finished minute, the way a real feed lags.
const feed = { clock: Math.floor((Date.now() - 6 * MIN) / MIN) * MIN + 5000, last: SPOT, market: "REGULAR", calls: {}, delay: {}, finishedOnly: false };

function times(tf) {
  const step = STEP[tf];
  if (SESSIONS[tf]) {
    const [per, n] = SESSIONS[tf];
    const end = Math.floor(feed.clock / step) * step - (feed.finishedOnly && tf === "1m" ? step : 0); // start of the bar the clock is in
    const out = [];
    for (let s = n - 1; s >= 0; s--) for (let j = per - 1; j >= 0; j--) out.push(end - s * DAY - j * step);
    return out;
  }
  const end = Math.floor(feed.clock / DAY) * DAY;
  return Array.from({ length: COUNT[tf] }, (_, i) => end - (COUNT[tf] - 1 - i) * step);
}
// A price for a moment in time, so a bar keeps its price as the window slides.
const priceAt = (t, step) => +(SPOT * (1 + 0.03 * Math.sin(t / (step * 17)) + 0.01 * Math.sin(t / (step * 5)))).toFixed(2);
function bars(sym, tf) {
  const step = STEP[tf];
  const ts = times(tf);
  return ts.map((t, i) => {
    const o = priceAt(t - step, step);
    const c = i === ts.length - 1 && !(feed.finishedOnly && tf === "1m") ? feed.last : priceAt(t, step);
    return { i, t, o, h: +(Math.max(o, c) * 1.002).toFixed(2), l: +(Math.min(o, c) * 0.998).toFixed(2), c, v: 1000 + ((t / step) % 97) * 90 };
  });
}
const metaOf = () => ({ regularMarketPrice: feed.last, regularMarketTime: Math.floor(feed.clock / 1000), marketState: feed.market, exchangeName: "NASDAQ", currency: "USD" });

/** What a range should show of these bars, worked out the long way round. */
function expectBars(tf, kind, n) {
  const ts = times(tf), last = ts[ts.length - 1];
  let count;
  if (kind === "all") count = ts.length;
  else if (kind === "sessions") count = Math.min(ts.length, SESSIONS[tf][0] * n);
  else if (kind === "ytd") count = ts.filter((t) => t >= Date.UTC(new Date(last).getUTCFullYear(), 0, 1)).length;
  else count = ts.filter((t) => t > last - n * DAY).length;
  return Math.max(Math.min(20, ts.length), count);
}
const RANGES = [
  ["1D", "5m", "sessions", 1], ["5D", "15m", "sessions", 5], ["1M", "1h", "days", 30], ["3M", "D", "days", 91],
  ["6M", "D", "days", 182], ["YTD", "D", "ytd", 0], ["1Y", "D", "days", 365], ["5Y", "W", "days", 1826], ["All", "M", "all", 0],
];

async function open(browser, viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("lb-consent", JSON.stringify({ v: 1, adult: true, analytics: false, training: false, at: new Date().toISOString() })); } catch {}
    // On a dev server the framework's own badge sits over the corner of a phone screen.
    document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); });
    // The page refetches bars every 30 s and the watchlist polls every 15 s.
    const real = window.setInterval.bind(window);
    window.setInterval = (fn, ms, ...rest) => real(fn, ms === 30000 ? 1200 : ms === 15000 ? 900 : ms, ...rest);
    // A price stream the checks feed by hand, in place of /api/stream/quotes.
    const all = [];
    window.EventSource = class {
      constructor(url) { this.url = url; this.on = {}; this.readyState = 1; all.push(this); setTimeout(() => this.emit("hello", "{}"), 10); this.hb = real(() => this.emit("hb", String(Date.now())), 2000); }
      addEventListener(type, fn) { (this.on[type] ||= []).push(fn); }
      removeEventListener() {}
      close() { this.readyState = 2; clearInterval(this.hb); }
      emit(type, data) { if (this.readyState !== 2) for (const fn of this.on[type] || []) fn({ type, data }); }
    };
    window.__tick = (quotes) => { const es = all.filter((e) => e.readyState !== 2).pop(); if (es) es.emit("quotes", JSON.stringify({ quotes })); return !!es; };
    window.__streams = () => all.filter((e) => e.readyState !== 2).map((e) => decodeURIComponent(e.url));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
  await page.route("**/api/quote?**", async (route) => {
    const u = new URL(route.request().url());
    const sym = u.searchParams.get("symbol"), tf = u.searchParams.get("tf") || "D";
    feed.calls[tf] = (feed.calls[tf] || 0) + 1;
    const body = { ok: true, bars: bars(sym, tf), meta: metaOf(), source: "canned" }; // as of the request, like a server's cache
    const wait = feed.delay[tf] || 0;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    await route.fulfill({ json: body }).catch(() => {});
  });
  await page.route("**/api/quote-batch?**", async (route) => {
    const syms = (new URL(route.request().url()).searchParams.get("symbols") || "").split(",").filter(Boolean);
    const t = Math.floor(feed.clock / 1000);
    await route.fulfill({ json: { ok: true, source: "canned", quotes: syms.map((sym) => ({ sym, last: sym === "AAPL" ? feed.last : SPOT, chg: 1, chgPct: 0.5, marketState: feed.market, marketTime: t })) } }).catch(() => {});
  });
  return { ctx, page, errs };
}

const read = (page) => page.evaluate(() => {
  const svg = [...document.querySelectorAll("svg[aria-label]")].find((e) => / chart, \d+ bars/.test(e.getAttribute("aria-label") || ""));
  const label = svg ? svg.getAttribute("aria-label") : "";
  const m = / (\S+) chart, (\d+) bars, last close ([\d,]+(?:\.\d+)?)/.exec(label) || [];
  const on = [...document.querySelectorAll("button[aria-pressed='true']")].map((b) => b.textContent.trim());
  const TFS = ["1m", "5m", "15m", "1h", "4h", "D", "W", "M"], RANGES = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];
  return {
    tf: m[1] || "", bars: +(m[2] || 0), close: +String(m[3] || "0").replace(/,/g, ""),
    candles: svg ? svg.querySelectorAll('rect[opacity="0.32"]').length : 0,
    animating: document.querySelectorAll(".chart-candle-in").length,
    tfOn: on.filter((t) => TFS.includes(t)).join(","), rangeOn: on.filter((t) => RANGES.includes(t)).join(","),
    axis: svg ? [...svg.querySelectorAll('text[data-axis="x"]')].map((t) => t.textContent) : [],
    // the legend's O H L C: the last bar's, while the pointer is off the chart
    ohlc: (() => {
      const o = [...document.querySelectorAll("span")].find((el) => el.textContent === "O" && el.nextElementSibling && /^[\d,.]+$/.test(el.nextElementSibling.textContent || ""));
      if (!o) return "";
      const kids = [...o.parentElement.children].map((el) => el.textContent.trim());
      const at = (k) => kids[kids.indexOf(k) + 1];
      return ["O", "H", "L", "C"].map((k) => `${k} ${at(k)}`).join(" ");
    })(),
  };
});
const press = (page, text) => page.locator("button", { hasText: new RegExp(`^${text}$`) }).first().click();
const settle = (page, ms = 1300) => page.waitForTimeout(ms);
const until = async (page, fn, ms = 6000) => { const t = Date.now(); for (;;) { const s = await read(page); if (fn(s)) return s; if (Date.now() - t > ms) return s; await page.waitForTimeout(80); } };
/** The most candles seen mid-entrance while `ms` pass: 0 means nothing was replayed. */
async function replayed(page, ms) { let max = 0; const t = Date.now(); while (Date.now() - t < ms) { max = Math.max(max, (await read(page)).animating); await page.waitForTimeout(70); } return max; }
const refetches = (tf) => feed.calls[tf] || 0;
async function afterRefetch(page, tf, n = 2) { const from = refetches(tf); const t = Date.now(); while (refetches(tf) < from + n && Date.now() - t < 9000) await page.waitForTimeout(100); await page.waitForTimeout(350); }
/** Push one trade down the stream. The feed's own clock and last price follow it, unless `quiet`. */
const tick = (page, price, atMs, { market = feed.market, quiet = false } = {}) => {
  if (!quiet) { feed.clock = Math.max(feed.clock, atMs); feed.last = price; }
  return page.evaluate(([price, at, market]) => window.__tick([{ sym: "AAPL", last: price, chg: price - 200, chgPct: (price - 200) / 2, marketState: market, marketTime: at }]), [price, Math.floor(atMs / 1000), market]);
};

const browser = await chromium.launch();
try {
  // ── desktop ────────────────────────────────────────────────────────────────
  where = "desktop · ";
  const { ctx, page, errs } = await open(browser, { width: 1440, height: 900 });
  await page.goto(`${BASE}/pro`, { waitUntil: "load" });
  let s = await until(page, (x) => x.bars > 0 && x.animating === 0, 15000);
  await settle(page, 600);
  s = await read(page);
  const sixM = expectBars("D", "days", 182);
  check(s.tf === "D" && s.rangeOn === "6M" && s.candles === sixM, `opens on six months of daily bars, with 6M lit (${s.candles} candles, ${sixM} wanted, lit "${s.rangeOn}")`);
  check((await page.evaluate(() => window.__streams())).some((u) => /symbols=.*AAPL/.test(u)), "the chart's symbol is on the live stream");

  // a chosen range outlives the refetch
  await press(page, "1Y");
  const year = expectBars("D", "days", 365);
  s = await until(page, (x) => x.candles === year);
  check(s.candles === year && s.rangeOn === "1Y", `1Y shows a year of daily bars (${s.candles}, ${year} wanted)`);
  const before = refetches("D");
  const flashed = await replayed(page, 3200);
  s = await read(page);
  check(refetches("D") >= before + 2, `the bars were refetched while it sat there (${refetches("D") - before} times)`);
  check(s.candles === year && s.rangeOn === "1Y", `after the refetches it is still a year, with 1Y lit (${s.candles} candles, lit "${s.rangeOn}")`);
  check(flashed === 0, `no entrance was replayed by a refetch (${flashed} candles seen fading in)`);

  // a zoom by hand
  const plot = await page.evaluate(() => { const svg = [...document.querySelectorAll("svg[aria-label]")].find((e) => / chart, \d+ bars/.test(e.getAttribute("aria-label") || "")); const r = svg.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4, w: r.width }; });
  await page.mouse.move(plot.x, plot.y);
  await page.mouse.wheel(0, -500);
  await settle(page, 400);
  s = await read(page);
  const zoomed = s.candles;
  check(s.rangeOn === "" && zoomed < year, `a zoom by hand un-lights the range (lit "${s.rangeOn}", ${zoomed} candles)`);
  await afterRefetch(page, "D");
  s = await read(page);
  check(Math.abs(s.candles - zoomed) <= 1, `the zoom survives the refetch (${zoomed} candles before, ${s.candles} after)`);

  // every range button
  for (const [name, tf, kind, n] of RANGES) {
    await press(page, name);
    const want = expectBars(tf, kind, n);
    s = await until(page, (x) => x.tf === tf && x.candles === want && x.rangeOn === name);
    check(s.tf === tf && s.tfOn === tf && s.rangeOn === name && s.candles === want, `${name} is ${tf} bars, ${want} of them (${s.tf}, ${s.candles} candles, lit "${s.rangeOn}")`);
  }
  // a range holds across a refetch on an intraday frame too
  await press(page, "5D");
  s = await until(page, (x) => x.tf === "15m" && x.candles === expectBars("15m", "sessions", 5));
  await afterRefetch(page, "15m");
  s = await read(page);
  check(s.candles === expectBars("15m", "sessions", 5) && s.rangeOn === "5D", `5D is still five sessions after a refetch (${s.candles} candles)`);

  // a timeframe button
  await press(page, "5m");
  s = await until(page, (x) => x.tf === "5m" && x.candles === 120 && x.animating === 0);
  check(s.tfOn === "5m" && s.rangeOn === "" && s.candles === 120, `a timeframe button un-lights the range and shows the last 120 bars (${s.candles} candles, lit "${s.rangeOn}")`);
  check(s.axis.length >= 3 && /^[A-Z][a-z]{2} \d\d$/.test(s.axis[0]) && s.axis.slice(1).some((l) => /^\d\d:\d\d$/.test(l)) && new Set(s.axis).size === s.axis.length, `5m axis names the day, then gives the clock, no label twice (${s.axis.join(" | ")})`);
  await press(page, "D");
  s = await until(page, (x) => x.tf === "D" && x.bars === COUNT.D && x.candles === 120 && x.animating === 0);
  check(s.axis.length >= 3 && s.axis.every((l) => /^[A-Z][a-z]{2} \d\d, \d\d$/.test(l)), `daily axis keeps the date and year (${s.axis.join(" | ")})`);
  await press(page, "M");
  s = await until(page, (x) => x.tf === "M" && x.bars === COUNT.M && x.animating === 0 && x.axis.length >= 3);
  check(s.axis.length >= 3 && s.axis.every((l) => /^[A-Z][a-z]{2} \d{4}$/.test(l)), `monthly axis is a month and a year (${s.axis.join(" | ")})`);

  // live ticks on a one-minute chart
  await press(page, "1m");
  s = await until(page, (x) => x.tf === "1m" && x.bars === 390 && x.candles === 120 && x.animating === 0);
  await settle(page, 500);
  const n0 = (await read(page)).bars;
  const minute = times("1m").at(-1); // start of the minute the feed is in
  feed.delay["1m"] = 4000; // refetches answer late for now: what a tick does is seen by itself
  const sample = replayed(page, 12000); // watch for a replayed entrance through all of this
  await tick(page, 201.25, minute + 20_000);
  s = await until(page, (x) => x.close === 201.25);
  check(s.bars === n0 && s.close === 201.25 && s.candles === 120, `a trade inside the developing bar moves the last candle and adds none (${s.bars} bars, close ${s.close})`);
  await tick(page, 200.9, minute + 40_000);
  s = await until(page, (x) => x.close === 200.9);
  check(s.bars === n0 && s.close === 200.9, `and moves it down again (close ${s.close})`);
  await tick(page, 202.1, minute + MIN + 5_000); // the next minute
  s = await until(page, (x) => x.close === 202.1 && x.bars === n0 + 1);
  check(s.bars === n0 + 1 && s.close === 202.1 && s.candles === 120, `a trade in the next minute opens the next candle, still in view (${n0} bars to ${s.bars}, close ${s.close}, ${s.candles} on screen)`);
  // that candle is built from its ticks, and a refetch that does not list the minute yet leaves it so
  await tick(page, 202.9, minute + MIN + 15_000);
  await until(page, (x) => x.close === 202.9);
  await tick(page, 202.3, minute + MIN + 25_000);
  await page.mouse.move(700, 20); // off the chart: the legend reads the last bar
  s = await until(page, (x) => x.close === 202.3 && x.ohlc === "O 202.10 H 202.90 L 202.10 C 202.30");
  check(s.ohlc === "O 202.10 H 202.90 L 202.10 C 202.30", `the new candle is built from its ticks (${s.ohlc})`);
  feed.finishedOnly = true;
  feed.delay["1m"] = 0;
  await page.waitForTimeout(4300); // the late answers drain
  await afterRefetch(page, "1m");
  s = await read(page);
  check(s.bars === n0 + 1 && s.ohlc === "O 202.10 H 202.90 L 202.10 C 202.30", `a refetch that does not list that minute yet leaves the candle as built (${s.bars} bars, ${s.ohlc})`);
  feed.finishedOnly = false;
  await afterRefetch(page, "1m");
  s = await read(page);
  check(s.close === 202.3 && s.candles === 120 && s.bars === n0, `once the feed lists the minute its bar takes over, closed on the last trade, the view unmoved (${s.bars} bars, close ${s.close}, ${s.candles} on screen)`);
  const flashedLive = await sample;
  check(flashedLive === 0, `ticks and refetches replayed no entrance (${flashedLive} candles seen fading in)`);

  // market shut: a trade past the bar's end only moves the last candle
  feed.market = "CLOSED";
  await afterRefetch(page, "1m");
  const nShut = (await read(page)).bars;
  feed.delay["1m"] = 4000; // again: the tick by itself, before the feed lists that minute
  const shutAt = minute + 2 * MIN + 5_000;
  await tick(page, 202.4, shutAt, { market: "CLOSED", quiet: true });
  s = await until(page, (x) => x.close === 202.4);
  await page.waitForTimeout(600);
  s = await read(page);
  check(s.close === 202.4 && s.bars === nShut, `with the market shut a trade past the bar's end moves the last candle and opens none (${nShut} bars to ${s.bars}, close ${s.close})`);
  feed.clock = shutAt; feed.last = 202.4; feed.market = "REGULAR"; feed.delay["1m"] = 0;
  await page.waitForTimeout(4300);
  await afterRefetch(page, "1m");

  // scrolled back into history
  await page.mouse.move(plot.x, plot.y);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++) { await page.mouse.move(plot.x + k * 30, plot.y); await page.waitForTimeout(16); }
  await page.mouse.up();
  await settle(page, 500);
  const back = await read(page);
  await tick(page, 203.3, feed.clock + MIN + 10_000);
  await until(page, (x) => x.close === 203.3);
  await afterRefetch(page, "1m");
  s = await read(page);
  check(back.axis.length >= 3 && s.axis.join("|") === back.axis.join("|") && s.close === 203.3, `scrolled back, a new candle and a refetch leave the same bars in view (${back.axis.join(" | ")} then ${s.axis.join(" | ")})`);

  // bars that answer late are not drawn over another bar size
  await press(page, "D");
  s = await until(page, (x) => x.tf === "D" && x.bars === 1300 && x.animating === 0);
  feed.delay.D = 2500;
  const from = refetches("D");
  for (const t = Date.now(); refetches("D") === from && Date.now() - t < 6000; ) await page.waitForTimeout(40); // a D refetch is in flight
  await press(page, "5m");
  s = await until(page, (x) => x.tf === "5m" && x.bars === 390 && x.candles === 120);
  await page.waitForTimeout(3200);
  s = await read(page);
  feed.delay.D = 0;
  check(s.tf === "5m" && s.bars === 390 && s.candles === 120, `daily bars that answered late were not drawn on the 5m chart (${s.tf}, ${s.bars} bars)`);

  check(errs.length === 0, `no page errors${errs.length ? ": " + [...new Set(errs)].slice(0, 3).join(" | ") : ""}`);
  await ctx.close();

  // ── phone ──────────────────────────────────────────────────────────────────
  where = "phone · ";
  const ph = await open(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ph.page.goto(`${BASE}/pro`, { waitUntil: "load" });
  s = await until(ph.page, (x) => x.bars > 0 && x.animating === 0, 15000);
  await ph.page.locator("button", { hasText: /^5D$/ }).first().scrollIntoViewIfNeeded();
  await ph.page.locator("button", { hasText: /^5D$/ }).first().tap();
  const five = expectBars("15m", "sessions", 5);
  s = await until(ph.page, (x) => x.tf === "15m" && x.candles === five);
  check(s.tf === "15m" && s.rangeOn === "5D" && s.candles === five, `5D works from the range row (${s.tf}, ${s.candles} candles, ${five} wanted)`);
  const side = await ph.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(side <= 1, `nothing scrolls sideways (${side}px)`);
  check(ph.errs.length === 0, `no page errors${ph.errs.length ? ": " + ph.errs.slice(0, 3).join(" | ") : ""}`);
  await ph.ctx.close();
} catch (e) {
  check(false, `could not finish (${String(e.message).split("\n")[0]})`);
} finally {
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} check(s) failed on /pro.` : "\nPro charts keeps its view and its last candle moves.");
process.exit(fails.length ? 1 : 0);

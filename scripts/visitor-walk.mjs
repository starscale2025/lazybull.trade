// Guard: what a first-time, signed-out visitor meets (2026-11-25).
//   node scripts/visitor-walk.mjs [baseUrl] [--live]      (default http://localhost:3100)
//
// The owner asked for the site to work and to feel useful to someone who has
// just arrived. An audit of the live site as that visitor found every page
// loading cleanly and a handful of things that were plainly wrong once it did:
// a watchlist that opened on four rows of dashes, an invented chart of the
// S&P 500, a clock five and a half hours fast, a contest page with three
// edition numbers, months-old prices beside the live one, and event dates made
// up from a ticker's letters. This walks the same path and fails on each.
//
// Against localhost the page is fed a canned feed shaped like production's:
// US stocks, funds and coins have prices; indices and Indian names have no
// source. Against any other address, or with --live, the site's own answers
// are used, so the same script checks a deploy.
//
// It checks that:
//   · a new visitor's Pro watchlist has a price on every row, and no index
//   · an untouched copy of the old default list is swapped; an edited one is kept,
//     and loading the page with one stored raises no hydration error
//   · a symbol with no source shows an empty chart that says so, never candles,
//     and the side panel drops the last symbol's figures
//   · the Pro clock is India time
//   · the contest page's header and its board name the same edition
//   · the chain page's price pills are the live prices
//   · the builder's event tab shows published dates only, no company dates

import { chromium } from "playwright";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) || "http://localhost:3100").replace(/\/$/, "");
const LIVE = args.includes("--live") || !/\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(BASE);
const DAY = 86_400_000;

const fails = [];
let where = "";
const check = (ok, what) => (ok ? console.log(`✓ ${where}${what}`) : (fails.push(where + what), console.error(`✗ ${where}${what}`)));
const skip = (what) => console.log(`– ${where}${what}`);

const OLD_DEFAULT = ["^NSEI", "^NSEBANK", "^GSPC", "^IXIC", "AAPL", "NVDA", "TSLA", "AMZN", "MSFT", "META", "GOOGL", "BTC-USD", "ETH-USD"];
/** What production's feed does not carry: an index or an Indian listing. */
const noFeed = (s) => s.startsWith("^") || /\.(NS|BO)$/i.test(s);

// ── the canned feed (localhost only) ────────────────────────────────────────
const priceOf = (sym) => +(60 + ([...sym].reduce((a, c) => a + c.charCodeAt(0), 0) % 400) + 0.37).toFixed(2);
function cannedBars(sym) {
  const end = Math.floor(Date.now() / DAY) * DAY;
  const p = priceOf(sym);
  return Array.from({ length: 300 }, (_, i) => {
    const t = end - (299 - i) * DAY;
    const c = +(p * (1 + 0.04 * Math.sin(i / 17) + 0.01 * Math.sin(i / 5))).toFixed(2);
    const o = +(p * (1 + 0.04 * Math.sin((i - 1) / 17) + 0.01 * Math.sin((i - 1) / 5))).toFixed(2);
    return { i, t, o, h: +(Math.max(o, c) * 1.004).toFixed(2), l: +(Math.min(o, c) * 0.996).toFixed(2), c, v: 1_000_000 + (i % 13) * 40_000 };
  });
}

async function open(browser, stored) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(({ stored, canned }) => {
    try {
      localStorage.setItem("lb-consent", JSON.stringify({ v: 1, adult: true, analytics: false, training: false, at: new Date().toISOString() }));
      if (stored && !sessionStorage.getItem("walk-seeded")) {
        localStorage.setItem("lb-pro-watchlist", JSON.stringify(stored));
        sessionStorage.setItem("walk-seeded", "1");
      }
    } catch {}
    document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); });
    if (!canned) return;
    // A quiet price stream in place of /api/stream/quotes: it says hello and
    // keeps its heartbeat, so the page relies on its polls.
    window.EventSource = class {
      constructor() { this.on = {}; this.readyState = 1; setTimeout(() => this.emit("hello", "{}"), 10); this.hb = setInterval(() => this.emit("hb", String(Date.now())), 2000); }
      addEventListener(type, fn) { (this.on[type] ||= []).push(fn); }
      removeEventListener() {}
      close() { this.readyState = 2; clearInterval(this.hb); }
      emit(type, data) { if (this.readyState !== 2) for (const fn of this.on[type] || []) fn({ type, data }); }
    };
  }, { stored: stored || null, canned: !LIVE });
  const page = await ctx.newPage();
  const errs = [];
  const live = {};
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
  page.on("response", async (r) => {
    if (!r.url().includes("/api/quote-batch")) return;
    try { for (const q of (await r.json()).quotes || []) if (q?.last != null) live[q.sym] = q.last; } catch {}
  });
  if (!LIVE) {
    await page.route("**/api/quote?**", async (route) => {
      const u = new URL(route.request().url());
      const sym = (u.searchParams.get("symbol") || "").toUpperCase(), tf = u.searchParams.get("tf") || "D";
      if (noFeed(sym)) return route.fulfill({ status: 502, json: { ok: false, error: "no data", reason: "no_feed", symbol: sym, tf } }).catch(() => {});
      const bars = cannedBars(sym);
      await route.fulfill({ json: { ok: true, symbol: sym, tf, source: "canned", bars, meta: { regularMarketPrice: bars[bars.length - 1].c, regularMarketTime: Math.floor(Date.now() / 1000), marketState: "REGULAR", exchangeName: "NASDAQ", currency: "USD" } } }).catch(() => {});
    });
    await page.route("**/api/quote-batch?**", async (route) => {
      const syms = (new URL(route.request().url()).searchParams.get("symbols") || "").split(",").filter(Boolean);
      const t = Math.floor(Date.now() / 1000);
      const quotes = syms.filter((s) => !noFeed(s)).map((sym) => ({ sym, last: cannedBars(sym)[299].c, chg: 1.2, chgPct: 0.6, marketState: "REGULAR", marketTime: t }));
      await route.fulfill({ json: { ok: true, source: "canned", quotes } }).catch(() => {});
    });
  }
  return { ctx, page, errs, live };
}

const chart = (page) => page.evaluate(() => {
  const svg = [...document.querySelectorAll("svg[aria-label]")].find((e) => / chart, \d+ bars/.test(e.getAttribute("aria-label") || ""));
  const m = / chart, (\d+) bars/.exec(svg?.getAttribute("aria-label") || "");
  return {
    bars: m ? +m[1] : 0,
    note: document.querySelector("[data-empty-note]")?.textContent?.trim() || "",
    synthetic: [...document.querySelectorAll("span")].some((e) => e.childElementCount === 0 && e.textContent.trim() === "Synthetic tape"),
    perf: [...document.querySelectorAll("[data-perf-grid] > div > div:first-child")].map((e) => e.textContent.trim()),
    panel: [...document.querySelectorAll("span")].map((e) => (e.childElementCount <= 1 ? e.textContent.trim() : "")).find((s) => /^(No price data for this symbol here|SIM tape · not real quotes)$/.test(s)) || "",
  };
});
const rows = (page) => page.evaluate(() => [...document.querySelectorAll("[data-watch-row]")].map((e) => ({ sym: e.getAttribute("data-watch-row"), priced: e.getAttribute("data-priced") === "1" })));
const stored = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("lb-pro-watchlist") || "null"); } catch { return null; } });
async function until(page, read, ok, ms = 20000) {
  const end = Date.now() + ms;
  let v = await read(page);
  while (!ok(v) && Date.now() < end) { await page.waitForTimeout(300); v = await read(page); }
  return v;
}

const browser = await chromium.launch({ channel: "chromium" });
console.log(`visitor walk · ${BASE} · ${LIVE ? "the site's own data" : "canned feed"}\n`);
try {
  // ── Pro charts, a new visitor ─────────────────────────────────────────────
  where = "pro, new visitor · ";
  let v = await open(browser);
  await v.page.goto(`${BASE}/pro`, { waitUntil: "load", timeout: 60000 });
  let list = await until(v.page, rows, (r) => r.length > 0 && r.every((x) => x.priced), 25000);
  check(list.length >= 8, `the watchlist opens with ${list.length} rows`);
  check(list.every((r) => !noFeed(r.sym)), `no index or Indian listing in it (${list.filter((r) => noFeed(r.sym)).map((r) => r.sym).join(", ") || "none"})`);
  const dead = list.filter((r) => !r.priced).map((r) => r.sym);
  check(dead.length === 0, `every row has a price${dead.length ? ` (none on ${dead.join(", ")})` : ""}`);
  let c = await until(v.page, chart, (x) => x.bars > 0);
  check(c.bars > 0 && !c.note, `the first chart has candles (${c.bars} bars)`);

  const clock = await v.page.evaluate(() => document.querySelector("[data-pro-clock]")?.textContent || "");
  const m = /(\d\d):(\d\d):(\d\d)/.exec(clock);
  if (m) {
    const india = new Date(Date.now() + 330 * 60_000);
    const want = india.getUTCHours() * 3600 + india.getUTCMinutes() * 60 + india.getUTCSeconds();
    const got = +m[1] * 3600 + +m[2] * 60 + +m[3];
    const off = Math.min(Math.abs(got - want), 86400 - Math.abs(got - want));
    check(off <= 60, `the clock is India time (${m[0]}, ${off}s from it)`);
  } else check(false, `the clock is on the page (read "${clock}")`);
  check(v.errs.length === 0, `no page errors${v.errs.length ? ": " + v.errs.slice(0, 3).join(" | ") : ""}`);
  await v.ctx.close();

  // ── Pro charts, a returning visitor with the old default ──────────────────
  where = "pro, old default stored · ";
  v = await open(browser, OLD_DEFAULT);
  await v.page.goto(`${BASE}/pro`, { waitUntil: "load", timeout: 60000 });
  await v.page.waitForTimeout(1500); // the saved list is read once the page has hydrated
  list = await until(v.page, rows, (r) => r.length > 0 && r.every((x) => !noFeed(x.sym)), 8000);
  check(list.every((r) => !noFeed(r.sym)), `the untouched old list is swapped (${list.map((r) => r.sym).slice(0, 4).join(", ")}…)`);
  const kept = await until(v.page, stored, (k) => Array.isArray(k) && k.every((s) => !noFeed(s)), 8000);
  check(Array.isArray(kept) && kept.every((s) => !noFeed(s)), "and the swap is what is stored now");
  await v.ctx.close();

  // ── Pro charts, a list somebody edited, and a symbol with no source ───────
  where = "pro, edited list · ";
  const mine = ["^GSPC", "AAPL", "NVDA"];
  v = await open(browser, mine);
  await v.page.goto(`${BASE}/pro`, { waitUntil: "load", timeout: 60000 });
  list = await until(v.page, rows, (r) => r.map((x) => x.sym).join(",") === mine.join(","), 10000);
  check(list.map((r) => r.sym).join(",") === mine.join(","), `an edited list is kept as it is (${list.map((r) => r.sym).join(", ")})`);
  const still = await until(v.page, stored, (k) => Array.isArray(k) && k.join(",") === mine.join(","), 4000);
  check(Array.isArray(still) && still.join(",") === mine.join(","), "and it is still what is stored");
  await until(v.page, chart, (x) => x.bars > 0);
  await until(v.page, chart, (x) => x.perf.some((p) => p !== "—"), 8000);
  await v.page.locator('[data-watch-row="^GSPC"] button').first().click();
  c = await until(v.page, chart, (x) => x.note !== "" || x.synthetic, 15000);
  if (LIVE && c.bars > 0 && !c.synthetic) skip(`this deployment prices ^GSPC (${c.bars} real bars): nothing to check`);
  else {
    check(c.bars === 0 && !c.synthetic, `no candles are drawn for ^GSPC (${c.bars} bars${c.synthetic ? ", labelled synthetic" : ""})`);
    check(c.note === "No price data for ^GSPC here.", `the chart says why ("${c.note}")`);
    check(c.perf.length === 6 && c.perf.every((p) => p === "—"), `the last symbol's Performance figures are gone (${c.perf.join(" ")})`);
    check(c.panel === "No price data for this symbol here", `the side panel does not call it a practice tape ("${c.panel}")`);
  }
  await v.page.locator('[data-watch-row="AAPL"] button').first().click();
  c = await until(v.page, chart, (x) => x.bars > 0 && x.note === "");
  check(c.bars > 0 && c.note === "", `a priced symbol brings the candles back (${c.bars} bars)`);
  check(v.errs.length === 0, `no page errors${v.errs.length ? ": " + v.errs.slice(0, 3).join(" | ") : ""}`);
  await v.ctx.close();

  // ── the weekly set ────────────────────────────────────────────────────────
  where = "contest · ";
  v = await open(browser);
  await v.page.goto(`${BASE}/practice/contest`, { waitUntil: "load", timeout: 60000 });
  const text = await until(v.page, (p) => p.evaluate(() => document.body.innerText), (t) => /Board\s*\n\s*(№\d+|Unavailable)/.test(t) || /Ranked on solves[^\n]*\n\s*(№\d+|Unavailable)/.test(t), 15000);
  const head = /Weekly set\s*№\s*(\d+)/.exec(text);
  const board = /Ranked on solves[^\n]*\n\s*№(\d+)/.exec(text) || /Board\s*\n\s*№(\d+)/.exec(text);
  if (!head) check(false, "the header names an edition");
  else if (!board) skip(`the board is unavailable here (no database): header says №${head[1]}`);
  else {
    check(head[1] === board[1], `the header and the board name the same edition (№${head[1]}, №${board[1]})`);
    check(!(+head[1] > 14 && /this is the first/.test(text)), "and it is not called the first when it is not");
  }
  await v.ctx.close();

  // ── the chain page ────────────────────────────────────────────────────────
  where = "chain · ";
  v = await open(browser);
  await v.page.goto(`${BASE}/trade/chain`, { waitUntil: "load", timeout: 60000 });
  const pills = await until(
    v.page,
    (p) => p.evaluate(() => {
      const lines = document.body.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
      const a = lines.findIndex((l) => /^underlying$/i.test(l));
      const out = {};
      for (let i = a + 1; i > 0 && i < a + 14 && i + 1 < lines.length; i += 2) {
        if (!/^[A-Z]{1,5}$/.test(lines[i]) || !/^\$[\d,.]+$/.test(lines[i + 1])) break;
        out[lines[i]] = +lines[i + 1].replace(/[$,]/g, "");
      }
      return out;
    }),
    (o) => Object.keys(o).length >= 3 && Object.keys(o).every((s) => v.live[s] != null && Math.abs(o[s] - v.live[s]) < 0.011),
    20000,
  );
  const names = Object.keys(pills);
  if (!names.length) check(false, "the underlying pills are on the page");
  else if (!names.some((s) => v.live[s] != null)) skip("no live prices here to compare the pills with");
  else {
    const wrong = names.filter((s) => v.live[s] != null && Math.abs(pills[s] - v.live[s]) >= 0.011).map((s) => `${s} ${pills[s]} vs ${v.live[s]}`);
    check(wrong.length === 0, `every pill shows the live price${wrong.length ? ` (${wrong.join("; ")})` : ` (${names.join(", ")})`}`);
  }
  await v.ctx.close();

  // ── the builder's event tab ───────────────────────────────────────────────
  where = "builder · ";
  v = await open(browser);
  await v.page.goto(`${BASE}/trade`, { waitUntil: "load", timeout: 60000 });
  await v.page.waitForTimeout(4000);
  const choose = v.page.locator("button, a, [role=button]").filter({ hasText: /choose this/i }).first();
  await choose.scrollIntoViewIfNeeded();
  await choose.click();
  const deeper = v.page.locator("button[aria-controls='deeper']").first();
  await deeper.scrollIntoViewIfNeeded();
  if ((await deeper.getAttribute("aria-expanded")) !== "true") await deeper.click();
  const tab = v.page.locator("button").filter({ hasText: /^event horizon$/i }).first();
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  const ev = await until(
    v.page,
    (p) => p.evaluate(() => {
      const src = document.querySelector("[data-events-source]");
      const root = src?.parentElement;
      if (!root) return null;
      const rest = root.innerText.replace(src.innerText, "");
      const titles = [...root.querySelectorAll("[title]")].map((e) => e.getAttribute("title"));
      return { source: src.innerText.trim(), rest, titles };
    }),
    (x) => x != null,
    10000,
  );
  if (!ev) check(false, "the event tab opens and says where its dates come from");
  else {
    check(/published calendars/.test(ev.source), "the tab says where its dates come from");
    const company = [ev.rest, ...ev.titles].join(" ").match(/earnings|ex-dividend|\bdiv\b/i);
    check(!company, `no company date is pinned${company ? ` (found "${company[0]}")` : ""}`);
  }
  check(v.errs.length === 0, `no page errors${v.errs.length ? ": " + v.errs.slice(0, 3).join(" | ") : ""}`);
  await v.ctx.close();
} catch (e) {
  check(false, `could not finish (${String(e.message).split("\n")[0]})`);
} finally {
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} check(s) failed on the visitor walk.` : "\nA first-time visitor meets nothing that is plainly wrong.");
process.exit(fails.length ? 1 : 0);

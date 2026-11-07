// THE PERFORMANCE BUDGET (2026-11, THE MATTER plan Phase 0.6).
// Run against a production server:
//     npm run build && npx next start -p 3100 &
//     npm run budget            # or BUDGET_URL=http://host:port npm run budget
//
// What used to be checked by hand before a review, CI now refuses to lose:
//   · frame zero: the H1 is the LCP, at most one WebGL context, and under the
//     byte budget, because the film waits for scroll intent (CinemaGate)
//   · the film draws nothing until it is asked for (no scene at load)
//   · layout shift on the homepage, /learn and /quant, desktop and phone
//
// Every visit seeds consent first: the age and consent dialog is a separate
// first-visit layer, and its paragraph would otherwise be the phone LCP.
//
// Exit codes: 0 = within budget · 1 = at least one check over · 2 = could not run.

import { chromium } from "playwright";

const BASE = (process.env.BUDGET_URL || "http://localhost:3100").replace(/\/$/, "");
const IDLE_MS = 5000; // settle time after load: fonts, late chunks, the hero's first frames
const TOTAL_TIMEOUT_MS = 240_000;

const BUDGET = {
  frameZeroKB: 1200,
  webglContextsAtLoad: 1,
  homeCLS: 0.02,
  pageCLS: 0.05,
};

// A ratchet, not a pass: where a page is known to sit over budget, CI holds it
// at today's number so it cannot get worse, until the fix lands and the line
// is deleted. Empty since Phase 1 (2026-11-06): /quant's desktop CLS went
// 0.083 → 0.001 when its notices moved into a server-drawn slot.
const RATCHET = {};
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

// Runs in every frame before any page script: consent on file, and a count of
// WebGL contexts (the film's scene is a same-origin iframe, so it counts too).
function instrument() {
  try {
    localStorage.setItem("lb-consent", JSON.stringify({ v: 1, adult: true, analytics: false, training: false, at: new Date().toISOString() }));
    localStorage.setItem("lb-safety", JSON.stringify({ state: { wizardSeen: true, trainingWheels: true }, version: 0 }));
  } catch {}
  const top = window.top || window;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest);
    if (ctx && /webgl/.test(String(type)) && !this.__budgetCounted) {
      this.__budgetCounted = true;
      top.__budgetGL = (top.__budgetGL || 0) + 1;
    }
    return ctx;
  };
  if (window === top) {
    window.__budgetCLS = 0;
    window.__budgetLCP = null;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__budgetCLS += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__budgetLCP = e.element ? e.element.id || e.element.tagName.toLowerCase() : null;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  }
}

async function visit(browser, device, path) {
  const context = await browser.newContext(device);
  await context.addInitScript(instrument);
  const page = await context.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(IDLE_MS);
    return await page.evaluate(() => {
      const kb = (n) => Math.round(n / 1024);
      const nav = performance.getEntriesByType("navigation")[0];
      const bytes = performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), nav ? nav.transferSize || 0 : 0);
      return {
        kb: kb(bytes),
        gl: window.__budgetGL || 0,
        cls: Math.round(window.__budgetCLS * 1000) / 1000,
        lcp: window.__budgetLCP,
        filmScene: !!document.querySelector("[data-cinema] iframe"),
      };
    });
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  const rows = [];
  const check = (name, actual, ok, limit) => rows.push({ name, actual, limit, ok });
  try {
    const home = await visit(browser, DESKTOP, "/");
    check("desktop / · LCP element", home.lcp, home.lcp === "fz-title", "fz-title");
    check("desktop / · WebGL contexts at load", home.gl, home.gl <= BUDGET.webglContextsAtLoad, `≤ ${BUDGET.webglContextsAtLoad}`);
    check("desktop / · KB at load", home.kb, home.kb <= BUDGET.frameZeroKB, `≤ ${BUDGET.frameZeroKB}`);
    check("desktop / · film scene at load", home.filmScene ? "mounted" : "none", !home.filmScene, "none");
    check("desktop / · CLS", home.cls, home.cls <= BUDGET.homeCLS, `≤ ${BUDGET.homeCLS}`);

    const phone = await visit(browser, PHONE, "/");
    check("phone / · LCP element", phone.lcp, phone.lcp === "fz-title", "fz-title");
    check("phone / · CLS", phone.cls, phone.cls <= BUDGET.homeCLS, `≤ ${BUDGET.homeCLS}`);

    for (const path of ["/learn", "/quant"]) {
      for (const [label, device] of [["desktop", DESKTOP], ["phone", PHONE]]) {
        const r = await visit(browser, device, path);
        const name = `${label} ${path} · CLS`;
        const limit = RATCHET[name] ?? BUDGET.pageCLS;
        check(name, r.cls, r.cls <= limit, RATCHET[name] ? `≤ ${limit}, ratchet` : `≤ ${limit}`);
      }
    }
  } finally {
    await browser.close();
  }

  const w = Math.max(...rows.map((r) => r.name.length));
  for (const r of rows) console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(w)}  ${String(r.actual).padStart(9)}  (${r.limit})`);
  const over = rows.filter((r) => !r.ok);
  console.log(over.length ? `\nbudget: ${over.length} over` : "\nbudget: within");
  return over.length ? 1 : 0;
}

const timer = setTimeout(() => {
  console.error(`budget: gave up after ${TOTAL_TIMEOUT_MS / 1000}s`);
  process.exit(2);
}, TOTAL_TIMEOUT_MS);
main()
  .then((code) => {
    clearTimeout(timer);
    process.exit(code);
  })
  .catch((err) => {
    console.error("budget: could not run:", err?.message || err);
    process.exit(2);
  });

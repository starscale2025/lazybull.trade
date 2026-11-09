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
//   · (Gate A3 #4) no uncaught error on any route visited; one wheel step
//     mounts the film; at least one context at load, so a runner with no GPU
//     cannot pass by drawing nothing
//   · (Gate A4 #2) the same prerendered routes with the clock a day ahead, so
//     a date read during render (React #418) fails here and not in the field;
//     and the film's frame time at 2x, act by act, on a real GPU. A runner
//     with only software GL reports that row as n/a rather than failing it
//     on a renderer no visitor uses. The phone rows are a phone VIEWPORT and
//     are not CPU-throttled, and say so.
//
// Every visit seeds consent first: the age and consent dialog is a separate
// first-visit layer, and its paragraph would otherwise be the phone LCP.
//
// Exit codes: 0 = within budget · 1 = at least one check over · 2 = could not run.

import { chromium } from "playwright";

const BASE = (process.env.BUDGET_URL || "http://localhost:3100").replace(/\/$/, "");
const IDLE_MS = 5000; // settle time after load: fonts, late chunks, the hero's first frames
const TOTAL_TIMEOUT_MS = 300_000;

const BUDGET = {
  frameZeroKB: 1000,
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
const PHONE_LABEL = "phone viewport, unthrottled";
// The film is judged at the density it ships to: a 2x laptop.
const DESKTOP_2X = { ...DESKTOP, deviceScaleFactor: 2 };
const FILM_GATE = { p95Ms: 16.7, over25Pct: 4, maxMs: 100 };
// Film-time windows, aimed through the page's own filmToScroll.
const FILM_WINDOWS = [
  ["dive", 0.15, 0.24],
  ["regime", 0.24, 0.32],
  ["candle", 0.32, 0.59],
  ["safety + vote", 0.59, 0.73],
  ["bull", 0.73, 0.84],
  ["mark", 0.84, 0.99],
];
// Prerendered routes: what a stale build date would break.
const PRERENDERED = ["/", "/trade", "/trade/chain", "/pricing", "/learn", "/quant"];
const HYDRATION = /Minified React error #(418|419|423|425)|hydrat/i;


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

async function visit(browser, device, path, opts = {}) {
  const context = await browser.newContext(device);
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e)));
  // React reports a recoverable hydration error to the console, not as an
  // uncaught error; count those too.
  page.on("console", (m) => m.type() === "error" && HYDRATION.test(m.text()) && errors.push(m.text()));
  try {
    if (opts.tomorrow) await page.clock.setFixedTime(Date.now() + 86_400_000);
    await page.goto(BASE + path, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(opts.idle ?? IDLE_MS);
    const out = await page.evaluate(() => {
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
    if (opts.wheel) {
      // One ordinary wheel step is scroll intent: the film must mount on it.
      await page.mouse.move(700, 450);
      await page.mouse.wheel(0, 120);
      out.filmOnWheel = await page
        .waitForSelector("[data-cinema] iframe", { state: "attached", timeout: 8000 })
        .then(() => true, () => false);
    }
    out.errors = errors;
    return out;
  } finally {
    await context.close();
  }
}

// The film's frame time, window by window, at 2x. Sweeps each act over four
// seconds the way a reader scrolls it and keeps every rAF delta.
async function filmFrames(browser) {
  const context = await browser.newContext(DESKTOP_2X);
  await context.addInitScript(instrument);
  const page = await context.newPage();
  try {
    await page.goto(BASE + "/", { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(3000);
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl");
      const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
    });
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 60);
    await page.waitForFunction(
      () => {
        const f = document.querySelector("[data-cinema] iframe");
        return !!(f && f.contentWindow && f.contentWindow.renderAt && globalThis.__filmToScroll);
      },
      null,
      { timeout: 30_000 }
    );
    await page.waitForTimeout(5000);
    const out = {};
    for (const [name, a, b] of FILM_WINDOWS) {
      out[name] = await page.evaluate(async ([a, b]) => {
        const s = document.querySelector("[data-cinema]");
        const top = s.getBoundingClientRect().top + scrollY;
        const range = s.offsetHeight - innerHeight;
        const at = (p) => top + range * globalThis.__filmToScroll(p);
        scrollTo(0, at(a));
        await new Promise((r) => setTimeout(r, 1500));
        const deltas = [];
        let last = performance.now();
        let running = true;
        const tick = (t) => {
          deltas.push(t - last);
          last = t;
          if (running) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const t0 = performance.now();
        const dur = 4000;
        while (performance.now() - t0 < dur) {
          const k = (performance.now() - t0) / dur;
          scrollTo(0, at(a + (b - a) * k));
          await new Promise((r) => setTimeout(r, 16));
        }
        running = false;
        const d = deltas.slice(2).sort((x, y) => x - y);
        return {
          p95: d[Math.floor(d.length * 0.95)],
          over25: (100 * d.filter((x) => x > 25).length) / d.length,
          max: d[d.length - 1],
        };
      }, [a, b]);
    }
    return { renderer, windows: out };
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  const rows = [];
  const check = (name, actual, ok, limit) => rows.push({ name, actual, limit, ok });
  try {
    const errorsOn = [];
    const noteErrors = (where, r) => r.errors.length && errorsOn.push(`${where}: ${r.errors[0]}`);

    const home = await visit(browser, DESKTOP, "/", { wheel: true });
    noteErrors("desktop /", home);
    check("desktop / · LCP element", home.lcp, home.lcp === "fz-title", "fz-title");
    // Exactly one: more means the film mounted early, none means nothing drew
    // (a GPU-less runner would otherwise pass this row by default).
    check("desktop / · WebGL contexts at load", home.gl, home.gl >= 1 && home.gl <= BUDGET.webglContextsAtLoad, `1..${BUDGET.webglContextsAtLoad}`);
    check("desktop / · KB at load", home.kb, home.kb <= BUDGET.frameZeroKB, `≤ ${BUDGET.frameZeroKB}`);
    check("desktop / · film scene at load", home.filmScene ? "mounted" : "none", !home.filmScene, "none");
    check("desktop / · CLS", home.cls, home.cls <= BUDGET.homeCLS, `≤ ${BUDGET.homeCLS}`);
    check("desktop / · one wheel step mounts the film", home.filmOnWheel ? "mounted" : "no", !!home.filmOnWheel, "mounted");

    const phone = await visit(browser, PHONE, "/");
    noteErrors(`${PHONE_LABEL} /`, phone);
    check(`${PHONE_LABEL} / · LCP element`, phone.lcp, phone.lcp === "fz-title", "fz-title");
    check(`${PHONE_LABEL} / · CLS`, phone.cls, phone.cls <= BUDGET.homeCLS, `≤ ${BUDGET.homeCLS}`);

    for (const path of ["/learn", "/quant"]) {
      for (const [label, device] of [["desktop", DESKTOP], [PHONE_LABEL, PHONE]]) {
        const r = await visit(browser, device, path);
        noteErrors(`${label} ${path}`, r);
        const name = `${label} ${path} · CLS`;
        const limit = RATCHET[name] ?? BUDGET.pageCLS;
        check(name, r.cls, r.cls <= limit, RATCHET[name] ? `≤ ${limit}, ratchet` : `≤ ${limit}`);
      }
    }
    // The tool routes: no CLS budget yet, but no uncaught error either.
    for (const path of ["/trade", "/trade/chain", "/pricing"]) {
      noteErrors(`desktop ${path}`, await visit(browser, DESKTOP, path, { idle: 3000 }));
    }
    check("uncaught errors, every route visited", errorsOn.length, errorsOn.length === 0, "0");
    for (const e of errorsOn) console.error(`  pageerror · ${e}`);

    // A day after the build: anything rendered from the date must hydrate.
    const staleOn = [];
    for (const path of PRERENDERED) {
      const r = await visit(browser, DESKTOP, path, { tomorrow: true, idle: 2500 });
      if (r.errors.length) staleOn.push(`${path}: ${r.errors[0]}`);
    }
    check("clock a day ahead · errors on prerendered routes", staleOn.length, staleOn.length === 0, "0");
    for (const e of staleOn) console.error(`  next day · ${e}`);
  } finally {
    await browser.close();
  }

  // The film, on a real GPU where there is one: Metal through ANGLE on a Mac
  // (headless Chromium otherwise falls back to SwiftShader).
  const gpu = await chromium.launch(
    process.platform === "darwin"
      ? { channel: "chromium", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"] }
      : { args: ["--enable-gpu", "--ignore-gpu-blocklist"] }
  );
  try {
    const film = await filmFrames(gpu);
    const software = /swiftshader|llvmpipe|software/i.test(film.renderer);
    for (const [name, w] of Object.entries(film.windows)) {
      const label = `desktop @2x · film ${name} · p95 / >25ms / max`;
      const actual = `${w.p95.toFixed(1)} / ${w.over25.toFixed(1)}% / ${Math.round(w.max)}`;
      // Judged at the precision the row prints. At 120 Hz the p95 frame is two
      // vsyncs, which IS one 60 Hz frame; rAF timestamps jitter a few
      // hundredths of a millisecond around it, and 16.71 failing a 16.7 line
      // the row prints as met would be noise, not a regression.
      const p95 = Math.round(w.p95 * 10) / 10;
      const ok = p95 <= FILM_GATE.p95Ms && w.over25 <= FILM_GATE.over25Pct && w.max <= FILM_GATE.maxMs;
      const limit = `≤ ${FILM_GATE.p95Ms} / ${FILM_GATE.over25Pct}% / ${FILM_GATE.maxMs}`;
      if (software) rows.push({ name: label, actual, limit: `n/a on ${film.renderer.slice(0, 40)}`, ok: true });
      else check(label, actual, ok, limit);
    }
  } catch (err) {
    check("desktop @2x · film frame time", "could not run", false, String(err?.message || err).slice(0, 60));
  } finally {
    await gpu.close();
  }

  const w = Math.max(...rows.map((r) => r.name.length));
  for (const r of rows) console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(w)}  ${String(r.actual).padStart(18)}  (${r.limit})`);
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

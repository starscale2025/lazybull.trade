// Guard: the /start orbit stays a page you can use (2026-11-20).
//   node scripts/start-orbit.mjs [baseUrl]      (default http://localhost:3100)
//
// /start puts its six main links on a ring that turns by itself, can be
// dragged, and passes behind a giant wordmark. Every one of those is a way to
// lose a link. In Chrome's and Safari's engines, at a desktop and a phone
// width, this checks that:
//   · the ring turns, stops under the pointer, and starts again
//   · coming near a pod, without touching it, makes the bar say what the pod
//     is for and the ring wait; moving away takes the description back
//   · a drag changes the pod at the front and goes nowhere; a click navigates
//   · Tab reaches the six pods in reading order, and the focused pod comes to
//     the front, above the wordmark, with nothing over it; ← → move focus
//   · with motion reduced or paused the pods stand still and none overlap
//   · on a phone the pods are a grid, none covered, none under the status line
//   · the stage never scrolls sideways
//   · the wordmark keeps its ceiling and stands on the horizon, alone (no
//     particle bull, no mirrored copy)
//   · when the quote API fails, the page says Simulated and every mover is tagged SIM
//   · the arc of words never comes near a letter of the wordmark or under the
//     navbar, at 1280×720, 1440×790 and 1920×1080
//   · the movers read worst to best from left to right, on mirrored places
//   · the four candles are two mirrored pairs, as many red as the day's share
//     of fallers (filled from the left), never red before there is data
//   · on a phone, on a simulated day, both movers are tagged SIM, stay inside
//     the screen, and touch neither each other nor the wordmark (390 and 320px)
//   · the home page loads none of this page's code or styles
// Quotes are answered here with a canned day, so the checks never depend on a
// market data key or on the hour.

import { chromium, webkit } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3100").replace(/\/$/, "");
const PODS = ["/learn", "/practice", "/trade", "/pro", "/quant", "/greeks"];

const fails = [];
let where = "";
const check = (ok, what) => (ok ? console.log(`✓ ${where}${what}`) : (fails.push(where + what), console.error(`✗ ${where}${what}`)));

const consent = () => {
  try {
    localStorage.setItem("lb-consent", JSON.stringify({ v: 1, adult: true, analytics: false, training: false, at: new Date().toISOString() }));
  } catch {}
};
const pauseMotion = () => {
  try {
    localStorage.setItem("lb-motion", "paused");
  } catch {}
};

// A closed session with a move for whatever symbols are asked for.
const cannedDay = (route) => {
  const syms = (new URL(route.request().url()).searchParams.get("symbols") || "").split(",").filter(Boolean);
  const quotes = syms.map((sym) => {
    let h = 0;
    for (const c of sym) h = (h * 31 + c.charCodeAt(0)) % 997;
    return { sym, last: 100, chgPct: Math.round(((h / 997) * 8 - 4) * 100) / 100, marketState: "CLOSED" };
  });
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, quotes, source: "alpaca" }) });
};
const noQuotes = (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false }) });

// ── what the page is asked ───────────────────────────────────────────────
const readPods = () =>
  [...document.querySelectorAll('[data-start="pod"]')].map((p) => {
    const b = p.getBoundingClientRect();
    const x = b.left + b.width / 2;
    const y = b.top + b.height / 2;
    const top = document.elementFromPoint(x, y);
    return { href: p.querySelector("a")?.getAttribute("href"), x, y, l: b.left, t: b.top, r: b.right, b: b.bottom, z: +getComputedStyle(p).zIndex || 0, clear: !!top && p.contains(top) };
  });
const readStage = () => {
  const q = (s) => document.querySelector(s);
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { l: b.left, t: b.top, r: b.right, b: b.bottom };
  };
  return {
    live: !!q('[data-start="stage"]')?.hasAttribute("data-live"),
    stage: box(q('[data-start="stage"]')),
    status: q('[data-start="status"]')?.innerText.replace(/\s+/g, " ") ?? "",
    statusBox: box(q('[data-start="status"]')),
    say: q('[data-start="say"]')?.innerText.replace(/\s+/g, " ") ?? "",
    word: q('[data-start="word"]')?.getAttribute("data-state") ?? null,
    chips: [...document.querySelectorAll('[data-start="chip"]')].map((c) => c.textContent || ""),
    sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
    focus: document.activeElement?.closest('[data-start="pod"]') ? document.activeElement.getAttribute("href") : null,
    path: location.pathname,
  };
};

const front = (pods) => pods.reduce((a, b) => (b.y > a.y ? b : a));
const drift = (a, b) => Math.max(...a.map((p, i) => Math.max(Math.abs(p.x - b[i].x), Math.abs(p.y - b[i].y))));
const overlaps = (pods) => {
  const hits = [];
  for (let i = 0; i < pods.length; i++)
    for (let j = i + 1; j < pods.length; j++) {
      const a = pods[i];
      const b = pods[j];
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) hits.push(`${a.href} × ${b.href}`);
    }
  return hits;
};

async function open(ctx, { live = false } = {}) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/start", { waitUntil: "load", timeout: 60_000 });
  } catch {
    await page.goto(BASE + "/start", { waitUntil: "domcontentloaded", timeout: 60_000 }); // one retry: a dev server compiling
  }
  await page.waitForSelector('[data-start="pod"]', { timeout: 30_000 });
  if (live) {
    await page.waitForSelector('[data-start="stage"][data-live]', { timeout: 30_000 });
    await page.waitForTimeout(1900); // the pods leave the still arc and take up the orbit
  } else await page.waitForTimeout(1500);
  return page;
}
const context = async (browser, size, { reduced = false, paused = false, quotes = cannedDay } = {}) => {
  const ctx = await browser.newContext({ viewport: size, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(consent);
  if (paused) await ctx.addInitScript(pauseMotion);
  await ctx.route("**/api/quote-batch**", quotes);
  return ctx;
};

// ── desktop: the orbit ───────────────────────────────────────────────────
async function desktop(browser, name) {
  where = `${name} 1440 · `;
  const ctx = await context(browser, { width: 1440, height: 900 });
  let page = await open(ctx, { live: true });

  let pods = await page.evaluate(readPods);
  let s = await page.evaluate(readStage);
  check(pods.map((p) => p.href).join() === PODS.join(), "six pods, in reading order");
  check(!s.sideways, "no sideways scroll");
  const mark = await page.evaluate(() => {
    const word = document.querySelector('[data-start="word"]');
    const stage = document.querySelector('[data-start="stage"]');
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;";
    word.firstElementChild.appendChild(probe);
    const baseline = probe.getBoundingClientRect().bottom;
    probe.remove();
    const hz = document.querySelector('[data-start="horizon"]').getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return {
      px: parseFloat(getComputedStyle(word).fontSize),
      ceiling: 15.5 * rem,
      off: Math.abs(baseline - (hz.top + hz.height / 2)),
      others: stage.querySelectorAll("[data-matter-slot]").length + [...stage.querySelectorAll("[aria-hidden] *")].filter((e) => /^\s*lazybull\.?\s*$/.test(e.textContent || "") && !e.closest('[data-start="word"]')).length,
    };
  });
  check(mark.px <= mark.ceiling + 0.5 && mark.off < 2.5 && mark.others === 0, `the wordmark keeps its ceiling, stands on the horizon and is alone (${mark.px.toFixed(0)}px of ${mark.ceiling.toFixed(0)}, ${mark.off.toFixed(1)}px off the horizon, ${mark.others} other)`);
  check(/Market closed/.test(s.status) && s.chips.length > 0 && s.chips.every((c) => !/SIM/.test(c)), `a real day is not tagged SIM (${s.chips.length} movers, "${s.status}")`);

  // turning by itself
  await page.waitForTimeout(1000);
  let later = await page.evaluate(readPods);
  check(drift(pods, later) > 6, `the ring turns (${drift(pods, later).toFixed(0)}px in a second)`);

  // the pointer stops it
  let f = front(later);
  await page.mouse.move(f.x, f.y);
  await page.waitForTimeout(1600);
  pods = await page.evaluate(readPods);
  await page.waitForTimeout(800);
  later = await page.evaluate(readPods);
  s = await page.evaluate(readStage);
  check(drift(pods, later) < 1, `a pod under the pointer stops the ring (${drift(pods, later).toFixed(2)}px)`);
  const name0 = (await page.locator(`[data-start="pod"] a[href="${f.href}"] [data-start="pod-name"]`).innerText()).trim();
  check(!!name0 && s.say.startsWith(name0) && s.say.length > name0.length + 12, `the pod in hand is named and says what it is for ("${s.say.slice(0, 70)}")`);

  // and it starts again once the pointer leaves
  await page.mouse.move(720, 20);
  await page.waitForTimeout(2800);
  pods = await page.evaluate(readPods);
  await page.waitForTimeout(1000);
  later = await page.evaluate(readPods);
  check(drift(pods, later) > 6, "the ring starts again when the pointer leaves");

  // coming near a pod, without touching it. At the front the ring carries pods
  // to the left, so a pointer just right of one is being left behind: only the
  // approach itself can keep the two together.
  f = front(later);
  const beside = { x: f.r + 42, y: f.y };
  await page.mouse.move(beside.x, beside.y, { steps: 6 });
  await page.waitForTimeout(900);
  pods = await page.evaluate(readPods);
  await page.waitForTimeout(600);
  later = await page.evaluate(readPods);
  s = await page.evaluate(readStage);
  const nearPod = later.find((p) => p.href === f.href);
  const touching = beside.x >= nearPod.l && beside.x <= nearPod.r && beside.y >= nearPod.t && beside.y <= nearPod.b;
  const nameNear = (await page.locator(`[data-start="pod"] a[href="${f.href}"] [data-start="pod-name"]`).innerText()).trim();
  check(
    !touching && s.say.startsWith(nameNear) && s.say.length > nameNear.length + 12 && drift(pods, later) < 1,
    `coming near a pod, ${Math.round(beside.x - nearPod.r)}px from it, says what it is for and the ring waits ("${s.say.slice(0, 60)}")`,
  );
  await page.mouse.move(720, 20);
  await page.waitForTimeout(2800);
  pods = await page.evaluate(readPods);
  await page.waitForTimeout(1000);
  later = await page.evaluate(readPods);
  s = await page.evaluate(readStage);
  check(drift(pods, later) > 6 && !/[:,—]/.test(s.say) && s.say.length < 20, `moving away takes the description back and lets the ring turn ("${s.say}")`);

  // a drag turns the ring and goes nowhere
  f = front(later);
  await page.mouse.move(f.x, f.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(f.x - i * 50, f.y, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  pods = await page.evaluate(readPods);
  s = await page.evaluate(readStage);
  check(front(pods).href !== f.href, `a drag changes the pod at the front (${f.href} → ${front(pods).href})`);
  check(s.path === "/start", "a drag does not follow a link");

  // a click does
  await page.mouse.move(720, 20);
  await page.waitForTimeout(600);
  f = front(await page.evaluate(readPods));
  await page.mouse.move(f.x, f.y);
  await page.waitForTimeout(1500);
  const at = (await page.evaluate(readPods)).find((p) => p.href === f.href);
  await page.mouse.click(at.x, at.y);
  const went = await page.waitForURL((u) => u.pathname === f.href, { timeout: 45_000 }).then(() => true, () => false);
  check(went, `a click on a pod opens it (${f.href})`);
  await page.close();

  // the keyboard
  page = await open(ctx, { live: true });
  const TAB = name === "webkit" ? "Alt+Tab" : "Tab"; // Safari keeps Tab for fields; Option+Tab walks links
  let reached = null;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press(TAB);
    reached = (await page.evaluate(readStage)).focus;
  }
  const order = [reached];
  const onTop = [];
  for (let i = 0; i < PODS.length; i++) {
    if (i) {
      await page.keyboard.press(TAB);
      order.push((await page.evaluate(readStage)).focus);
    }
    await page.waitForTimeout(1300);
    pods = await page.evaluate(readPods);
    const me = pods.find((p) => p.href === order[i]);
    const mid = 720;
    if (!me || front(pods).href !== me.href || me.z <= 10 || !me.clear || Math.abs(me.x - mid) > 60) onTop.push(`${order[i]} (z${me?.z}, ${me ? Math.round(me.x - mid) : "?"}px off centre, ${me?.clear ? "clear" : "covered"})`);
  }
  check(order.join() === PODS.join(), `Tab reaches the six pods in order (${order.join(" ")})`);
  check(!onTop.length, `each focused pod comes to the front, on top${onTop.length ? `: not ${onTop.join("; ")}` : ""}`);
  await page.keyboard.press("ArrowRight");
  const wrapped = (await page.evaluate(readStage)).focus;
  await page.keyboard.press("ArrowLeft");
  const back = (await page.evaluate(readStage)).focus;
  check(wrapped === PODS[0] && back === PODS[PODS.length - 1], `← and → move focus round the ring (${wrapped}, ${back})`);
  check(!(await page.evaluate(readStage)).sideways, "no sideways scroll with a pod focused");
  await ctx.close();

  // motion reduced, motion paused: the still arc
  for (const [label, opts] of [["reduced motion", { reduced: true }], ["motion paused", { paused: true }]]) {
    const c = await context(browser, { width: 1440, height: 900 }, opts);
    const p = await open(c);
    const a = await p.evaluate(readPods);
    await p.waitForTimeout(700);
    const b = await p.evaluate(readPods);
    const st = await p.evaluate(readStage);
    const hit = overlaps(b);
    check(!st.live && drift(a, b) < 0.5, `${label}: the pods stand still`);
    check(!hit.length && b.every((x) => x.clear && x.l >= 0 && x.r <= 1440), `${label}: no pod overlaps another or is covered${hit.length ? ` (${hit.join("; ")})` : ""}`);
    await c.close();
  }

  // no feed: a labelled simulated day
  const c = await context(browser, { width: 1440, height: 900 }, { quotes: noQuotes });
  const p = await open(c, { live: true });
  await p.waitForFunction(() => /Simulated/.test(document.querySelector('[data-start="status"]')?.textContent || ""), null, { timeout: 15_000 }).catch(() => {});
  const sim = await p.evaluate(readStage);
  check(/Simulated/.test(sim.status) && sim.word === "sim", `with the quote API down the page says Simulated ("${sim.status}")`);
  check(sim.chips.length > 0 && sim.chips.every((x) => /SIM/.test(x)), `every simulated mover is tagged SIM (${sim.chips.length})`);
  await c.close();
}

// ── phone: a still grid ──────────────────────────────────────────────────
// ── the arc of words and the movers' wings, at three window shapes ───────
// The arc's characters are measured where the browser draws them (each one's
// box, through the rotating SVG, onto the screen); only those the fade lets
// through count. They must keep clear of the letters' ink and of the navbar.
const arcAndWings = () => {
  const word = document.querySelector('[data-start="word"]');
  const stage = document.querySelector('[data-start="stage"]').getBoundingClientRect();
  const hz = document.querySelector('[data-start="horizon"]').getBoundingClientRect();
  const horizon = hz.top + hz.height / 2;
  const fs = parseFloat(getComputedStyle(word).fontSize);
  const range = document.createRange();
  range.selectNodeContents(word.firstElementChild);
  const run = range.getBoundingClientRect();
  const ink = { l: run.left, r: run.right, t: horizon - 0.74 * fs, b: horizon };
  const text = document.querySelector('[data-start="arc"] text');
  const ctm = text.getScreenCTM();
  let seen = 0;
  let near = Infinity;
  let high = Infinity;
  for (let i = 0; i < text.getNumberOfChars(); i++) {
    let box;
    try {
      box = text.getExtentOfChar(i);
    } catch {
      continue;
    }
    const pts = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(ctm));
    const c = { l: Math.min(...pts.map((p) => p.x)), r: Math.max(...pts.map((p) => p.x)), t: Math.min(...pts.map((p) => p.y)), b: Math.max(...pts.map((p) => p.y)) };
    if (c.b > horizon - 0.92 * fs) continue; // faded out, or under the horizon
    seen++;
    near = Math.min(near, Math.hypot(Math.max(ink.l - c.r, c.l - ink.r, 0), Math.max(ink.t - c.b, c.t - ink.b, 0)));
    high = Math.min(high, c.t - stage.top);
  }
  const chips = [...document.querySelectorAll('[data-start="chip"]')]
    .map((el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, move: +el.dataset.move };
    })
    .sort((a, b) => a.x - b.x);
  const mid = stage.left + stage.width / 2;
  const candles = [...document.querySelectorAll('[data-start="candle"]')]
    .map((el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, down: el.dataset.tone === "down" };
    })
    .sort((a, b) => a.x - b.x);
  const [up, down] = (document.querySelector('[data-start="stage"]').innerText.match(/(\d+) up · (\d+) down/) || []).slice(1).map(Number);
  const reds = candles.filter((c) => c.down).length;
  return {
    candles: candles.length,
    candlesMirrored: candles.every((c, i) => {
      const o = candles[candles.length - 1 - i];
      return Math.abs(c.x - mid + (o.x - mid)) < 4 && Math.abs(c.y - o.y) < 12;
    }),
    reds,
    redsWanted: up + down > 0 ? Math.round((candles.length * down) / (up + down)) : -1,
    redsFromLeft: candles.every((c, i) => c.down === i < reds),
    seen,
    near: Math.round(near),
    high: Math.round(high),
    chips: chips.length,
    ordered: chips.every((c, i) => i === 0 || c.move >= chips[i - 1].move),
    mirrored: chips.every((c, i) => {
      const o = chips[chips.length - 1 - i];
      return Math.abs(c.x - mid + (o.x - mid)) < 6 && Math.abs(c.y - o.y) < 6;
    }),
  };
};

async function shapes(browser, name) {
  for (const [w, h] of [[1280, 720], [1440, 790], [1920, 1080]]) {
    where = `${name} ${w}×${h} · `;
    const ctx = await context(browser, { width: w, height: h });
    const page = await open(ctx, { live: true });
    const a = await page.evaluate(arcAndWings);
    await page.waitForTimeout(2500); // the arc turns; look again
    const b = await page.evaluate(arcAndWings);
    const near = Math.min(a.near, b.near);
    const high = Math.min(a.high, b.high);
    check(a.seen > 10 && b.seen > 10 && near >= 8 && high >= 4, `the arc of words keeps clear of the letters (${near}px) and of the navbar (${high}px)`);
    check(a.chips >= 4 && a.chips % 2 === 0 && a.ordered && a.mirrored, `${a.chips} movers read worst to best, on mirrored places`);
    check(a.candles === 4 && a.candlesMirrored && a.reds === a.redsWanted && a.redsFromLeft, `four mirrored candles, ${a.reds} red for the day's fallers (${a.redsWanted} wanted)`);
    await ctx.close();
  }
}

async function phone(browser, name) {
  where = `${name} 390 · `;
  const ctx = await context(browser, { width: 390, height: 844 });
  const page = await open(ctx);
  const s = await page.evaluate(readStage);
  const pods = await page.evaluate(readPods);
  check(!s.live && pods.length === PODS.length, "a still grid, not a ring");
  check(!s.sideways, "no sideways scroll");
  const hit = overlaps(pods);
  check(!hit.length, `no pod overlaps another${hit.length ? ` (${hit.join("; ")})` : ""}`);
  check(pods.every((p) => p.b - p.t >= 44 && p.l >= 0 && p.r <= 390), "every pod is a full touch target inside the screen");
  const under = pods.filter((p) => s.statusBox && Math.min(p.r, s.statusBox.r) - Math.max(p.l, s.statusBox.l) > 1 && Math.min(p.b, s.statusBox.b) - Math.max(p.t, s.statusBox.t) > 1);
  check(!under.length, `the status line covers no pod${under.length ? ` (${under.map((p) => p.href).join(" ")})` : ""}`);
  const covered = [];
  for (const href of PODS) {
    const ok = await page.evaluate((h) => {
      const a = document.querySelector(`[data-start="pod"] a[href="${h}"]`);
      a.scrollIntoView({ block: "center", behavior: "instant" });
      const b = a.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!top && a.contains(top);
    }, href);
    if (!ok) covered.push(href);
  }
  check(!covered.length, `every pod can be tapped${covered.length ? ` (covered: ${covered.join(" ")})` : ""}`);
  await ctx.close();

  // a simulated day: the movers carry a SIM tag and are at their widest
  for (const w of [390, 320]) {
    where = `${name} ${w} · `;
    const c = await context(browser, { width: w, height: 800 }, { quotes: noQuotes });
    const p = await open(c);
    await p.waitForFunction(() => document.querySelectorAll('[data-start="chip"]').length > 0, null, { timeout: 15_000 }).catch(() => {});
    await p.waitForTimeout(1800);
    const sim = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('[data-start="chip"]')].map((el) => {
        const b = el.getBoundingClientRect();
        return { text: el.textContent || "", l: b.left, r: b.right, t: b.top, b: b.bottom };
      });
      const word = document.querySelector('[data-start="word"]');
      const hz = document.querySelector('[data-start="horizon"]').getBoundingClientRect();
      return { chips, inkTop: hz.top - 0.74 * parseFloat(getComputedStyle(word).fontSize), width: window.innerWidth, sideways: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    const [a, b] = sim.chips;
    const inside = sim.chips.every((x) => x.l >= 8 && x.r <= sim.width - 8);
    const apart = sim.chips.length === 2 && (a.r <= b.l || a.b <= b.t || b.b <= a.t);
    const clear = sim.chips.every((x) => x.b <= sim.inkTop);
    check(
      sim.chips.length === 2 && sim.chips.every((x) => /SIM/.test(x.text)) && inside && apart && clear && !sim.sideways,
      `on a simulated day both movers are tagged SIM, inside the screen, clear of each other and of the wordmark (${sim.chips.map((x) => `${Math.round(x.l)}→${Math.round(x.r)}`).join(", ")} of ${sim.width})`,
    );
    await c.close();
  }
}

// ── the home page ships none of it ───────────────────────────────────────
async function homeIsClean(browser) {
  where = "home · ";
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(consent);
  const page = await ctx.newPage();
  const bodies = [];
  page.on("response", (r) => {
    const type = r.request().resourceType();
    if (type === "script" || type === "stylesheet") bodies.push(r.text().then((t) => [r.url(), type, t], () => null));
  });
  await page.goto(BASE + "/", { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2500);
  const files = (await Promise.all(bodies)).filter(Boolean);
  // names that exist only in the hub's stylesheet and stage (the attribute as a
  // prop, quoted: a bare "data-start" also matches other libraries' "data-starting-style")
  const leaked = files.filter(([, type, text]) => (type === "stylesheet" ? /wordRise|ringTurn|lampPulse/.test(text) : /"data-start"\s*:|Full index/.test(text))).map(([url]) => url.replace(BASE, ""));
  check(files.length > 0 && !leaked.length, `the home page loads none of the hub's code or styles (${files.length} files read)${leaked.length ? `: ${leaked.slice(0, 3).join(", ")}` : ""}`);
  await ctx.close();
}

for (const [engine, name] of [[chromium, "chromium"], [webkit, "webkit"]]) {
  let browser;
  try {
    browser = await engine.launch();
    await desktop(browser, name);
    await shapes(browser, name);
    await phone(browser, name);
    if (name === "chromium") await homeIsClean(browser);
  } catch (e) {
    // an engine that is not installed, or a page that would not load: a guard that cannot look does not pass
    where = `${name} · `;
    check(false, `could not finish (${String(e.message).split("\n")[0]})`);
  }
  await browser?.close();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed on /start.`);
  process.exit(1);
}
console.log("\nThe orbit turns, stops, drags, clicks and tabs as it should.");

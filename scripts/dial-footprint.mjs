// Guard: nothing interactive sits under the folded shortcut dial.
//   node scripts/dial-footprint.mjs [baseUrl]      (default http://localhost:3100)
//
// The dial (components/dial/ShortcutDial.tsx) lives in the bottom-left corner
// of every page. Folded, it is drawn small and is inert except for one 44 px
// opener, but whatever it is drawn over is still covered: a link or a field
// under the arc is hard to see and easy to miss. For every page route, at a
// desktop and a phone width, at the top of the page and at its very bottom,
// this samples points across the folded dial's drawn shapes and fails if the
// first thing under any of them (ignoring the dial itself) is interactive.

import { readdirSync, statSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3100").replace(/\/$/, "");

// Dynamic segments get one real sample each; routes with no sample are skipped.
const SAMPLE = { "[slug]": "kelly-fraction", "[id]": "kelly", "[track]": "finance" };
const SKIP = /^\/(admin|api|pro\/mic-check)(\/|$)|\/certificate\//;

function routes(dir = "app", prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) {
      if (name === "page.tsx" || name === "page.ts") out.push(prefix || "/");
      continue;
    }
    if (name.startsWith("(") && name.endsWith(")")) out.push(...routes(p, prefix)); // route group
    else if (name.startsWith("[")) SAMPLE[name] && out.push(...routes(p, `${prefix}/${SAMPLE[name]}`));
    else if (!name.startsWith("_") && !name.startsWith("@")) out.push(...routes(p, `${prefix}/${name}`));
  }
  return out;
}

const INTERACTIVE = "a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=switch], [tabindex]:not([tabindex='-1'])";

// Runs in the page, so everything it uses comes in as its argument.
const probe = (INTERACTIVE) => {
  const root = document.querySelector(".dial-root");
  if (!root || getComputedStyle(root).opacity === "0") return [];
  // the folded dial's drawn shapes: its arc segments (not drawn under 1024 px,
  // where it folds to a puck) and the opener
  const svg = root.querySelector("svg");
  const arcDrawn = !!svg && getComputedStyle(svg).opacity !== "0";
  const shapes = [...(arcDrawn ? root.querySelectorAll("svg path") : []), root.querySelector(".dial-opener")]
    .filter(Boolean)
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 1 && r.height > 1);
  const hits = new Map();
  for (const r of shapes) {
    for (let fx = 0.15; fx < 1; fx += 0.175) {
      for (let fy = 0.15; fy < 1; fy += 0.175) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        const under = document.elementsFromPoint(x, y).find((e) => !root.contains(e) && !e.closest(".dial-editor"));
        const live = under?.closest(INTERACTIVE);
        if (live && getComputedStyle(live).visibility !== "hidden") {
          const label = `${live.tagName.toLowerCase()} "${(live.getAttribute("aria-label") || live.textContent || "").trim().slice(0, 40)}"`;
          hits.set(label, `${Math.round(x)},${Math.round(y)}`);
        }
      }
    }
  }
  return [...hits].map(([what, at]) => `${what} at ${at}`);
};

const list = [...new Set(routes())].filter((r) => !SKIP.test(r)).sort();
const browser = await chromium.launch();
let failures = 0;
let unchecked = 0;
const open = async (page, url) => {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }); // one retry: a dev server compiling
  }
};
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" })).newPage();
  for (const route of list) {
    try {
      await open(page, BASE + route);
      await page.waitForTimeout(900);
      const top = await page.evaluate(probe, INTERACTIVE);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      const bottom = await page.evaluate(probe, INTERACTIVE);
      const bad = [...top.map((s) => `top: ${s}`), ...bottom.map((s) => `bottom: ${s}`)];
      if (bad.length) {
        failures++;
        console.error(`✗ ${route} @${w}: ${bad.slice(0, 4).join("; ")}`);
      } else console.log(`✓ ${route} @${w}`);
    } catch (e) {
      unchecked++;
      console.error(`· ${route} @${w}: not checked (${e.message.split("\n")[0]})`);
    }
  }
}
await browser.close();
if (failures || unchecked) {
  if (failures) console.error(`\n${failures} page${failures === 1 ? "" : "s"} put something interactive under the shortcut dial.`);
  if (unchecked) console.error(`${unchecked} page${unchecked === 1 ? "" : "s"} could not be checked; a guard that cannot look does not pass.`);
  process.exit(1);
}
console.log("\nNothing interactive under the shortcut dial.");

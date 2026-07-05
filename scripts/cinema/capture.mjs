// Scroll-cinema shot pipeline. Usage:
//   npm run cinema:capture            (dev server must be running on :3000)
//   SITE=http://localhost:3001 npm run cinema:capture
//
// The homepage hero renders the scene LIVE (public/cinema/scene.html in an
// iframe), so there are no pre-rendered frames — this only (re)captures the
// distinct app-screen shots the scene composites into panels + the reveal hero.
// Output: public/cinema/shots/*.webp (committed). See scripts/cinema/README.md.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(ROOT, "shots"); // raw PNG screenshots (gitignored)
const OUT = path.resolve(ROOT, "..", "..", "public", "cinema", "shots"); // served webp
const SITE = process.env.SITE ?? "http://localhost:3000";
// Each becomes a DISTINCT panel screen in the assembly/dive acts. ("/" is the
// cinema itself now, so it isn't a panel — the reveal-target "hero" shot below
// captures the real Get Started landing separately.)
const PAGES = [
  ["learn", "/learn"],
  ["trade", "/trade"],
  ["quant", "/quant"],
  ["pro", "/pro"],
  ["chain", "/trade/chain"],
  ["bots", "/learn/bots"],
  ["about", "/about"],
];

async function captureShots(browser) {
  fs.mkdirSync(RAW, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 3, // 4800×3000 so the dive can magnify the panels and stay sharp
    reducedMotion: "reduce", // freeze the site's ambient animation for clean shots
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  for (const [name, route] of PAGES) {
    process.stdout.write(`shot ${name} ${SITE}${route} … `);
    await page.goto(SITE + route, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(2500); // let charts/fonts settle
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));
    await page.screenshot({ path: path.join(RAW, `${name}.png`) });
    console.log("ok");
  }
  // Hero shot: reduced-motion renders the cinema as a static fallback <section
  // data-cinema-static>; remove it and scroll its next sibling — the real <Hero>
  // — to the viewport top, matching what the live page shows at handoff.
  process.stdout.write("shot hero … ");
  await page.goto(SITE + "/", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()); // dev overlay
    const cinema =
      document.querySelector("[data-cinema-static]") || document.querySelector("[data-cinema]");
    const hero = cinema?.nextElementSibling;
    cinema?.remove();
    if (hero) window.scrollTo(0, hero.getBoundingClientRect().top + window.scrollY);
  });
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));
  await page.screenshot({ path: path.join(RAW, "hero.png") });
  console.log("ok");
  await ctx.close();
}

function encodeToPublic() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(RAW).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    execFileSync("cwebp", [
      "-quiet", "-q", "88",
      path.join(RAW, f),
      "-o", path.join(OUT, f.replace(/\.png$/, ".webp")),
    ]);
  }
  console.log(`encoded ${files.length} shots → public/cinema/shots`);
}

const browser = await chromium.launch();
await captureShots(browser);
await browser.close();
encodeToPublic();
console.log("done");

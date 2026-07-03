// Scroll-cinema frame pipeline. Usage:
//   npm run cinema:capture            (dev server must be running on :3000)
//   SITE=http://localhost:3001 npm run cinema:capture
// Drop scripts/cinema/bull.mp4 (Veo clip) next to this file to replace the
// particle-bull placeholder, then re-run. See scripts/cinema/README.md.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(ROOT, "shots");
const RAW = path.join(ROOT, "raw");
const OUT = path.resolve(ROOT, "..", "..", "public", "cinema", "frames");
const SCENE = pathToFileURL(path.join(ROOT, "scene.html")).href;
const SITE = process.env.SITE ?? "http://localhost:3000";
const FRAME_COUNT = 160;
const POSTER_INDEX = Math.round(FRAME_COUNT * 0.66); // bull moment, 1-based below
const SETS = [
  { name: "desktop", width: 1600, height: 1000 },
  { name: "mobile", width: 800, height: 1200 },
];
// Each becomes a DISTINCT panel screen in the assembly/dive acts.
const PAGES = [
  ["home", "/"],
  ["learn", "/learn"],
  ["trade", "/trade"],
  ["quant", "/quant"],
  ["pro", "/pro"],
  ["chain", "/trade/chain"],
  ["bots", "/learn/bots"],
  ["about", "/about"],
];

const pad = (n) => String(n).padStart(4, "0");

async function captureShots(browser) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce", // freeze the site's ambient animation for clean shots
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  for (const [name, route] of PAGES) {
    const file = path.join(SHOTS, `${name}.png`);
    process.stdout.write(`shot ${name} ${SITE}${route} … `);
    await page.goto(SITE + route, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(2500); // let charts/fonts settle
    // strip the Next.js dev error overlay (pre-existing next-auth error w/o a DB)
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));
    await page.screenshot({ path: file });
    console.log("ok");
  }
  // Hero shot: reuse the reduced-motion context (a full-motion load of "/" hits a
  // client error boundary here without a DB). Reduced-motion renders the cinema as
  // a static fallback <section data-cinema-static>; remove it and scroll its next
  // sibling — the real <Hero> — to the viewport top, matching the live handoff.
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
  await page.screenshot({ path: path.join(SHOTS, "hero.png") });
  console.log("ok");
  await ctx.close();
}

function extractBullFrames() {
  const mp4 = path.join(ROOT, "bull.mp4");
  if (!fs.existsSync(mp4)) {
    console.log("no bull.mp4 — using particle placeholder");
    return null;
  }
  const dir = path.join(RAW, "bull");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-i", mp4,
    "-vf", "fps=30,scale=1200:-2,eq=saturation=1.05:gamma=0.98",
    path.join(dir, "bull_%04d.png"),
  ], { stdio: "inherit" });
  return fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
    .map((f) => pathToFileURL(path.join(dir, f)).href);
}

async function renderSet(browser, set, bullFrames) {
  const dir = path.join(RAW, set.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: set.width, height: set.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(SCENE);
  const shots = Object.fromEntries(
    [...PAGES.map(([name]) => name), "hero"].map((name) => [
      name,
      pathToFileURL(path.join(SHOTS, `${name}.png`)).href,
    ])
  );
  await page.evaluate((cfg) => window.initScene(cfg), { shots, bullFrames });
  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = i / (FRAME_COUNT - 1);
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(dir, `frame_${pad(i + 1)}.png`) });
    if ((i + 1) % 20 === 0) console.log(`${set.name} ${i + 1}/${FRAME_COUNT}`);
  }
  await ctx.close();
}

// Encode each rendered PNG to WebP with cwebp (Google's WebP tools). We use
// cwebp rather than ffmpeg's libwebp because common Homebrew ffmpeg builds ship
// without the libwebp encoder.
function encodeSet(set, quality = 68) {
  const inDir = path.join(RAW, set.name);
  const outDir = path.join(OUT, set.name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(inDir).filter((f) => f.endsWith(".png")).sort();
  for (const f of files) {
    execFileSync("cwebp", [
      "-quiet", "-q", String(quality),
      path.join(inDir, f),
      "-o", path.join(outDir, f.replace(/\.png$/, ".webp")),
    ]);
  }
  console.log(`${set.name} encoded ${files.length} frames`);
}

function writePosterAndManifest() {
  execFileSync("cwebp", [
    "-quiet", "-q", "72",
    path.join(RAW, "desktop", `frame_${pad(POSTER_INDEX)}.png`),
    "-o", path.join(OUT, "poster.webp"),
  ]);
  const manifest = {
    desktop: { dir: "/cinema/frames/desktop", width: 1600, height: 1000, frameCount: FRAME_COUNT },
    mobile: { dir: "/cinema/frames/mobile", width: 800, height: 1200, frameCount: FRAME_COUNT },
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
}

const skipShots = process.argv.includes("--skip-shots") &&
  PAGES.every(([n]) => fs.existsSync(path.join(SHOTS, `${n}.png`)));

const browser = await chromium.launch();
if (!skipShots) await captureShots(browser);
const bullFrames = extractBullFrames();
for (const set of SETS) {
  await renderSet(browser, set, bullFrames);
  encodeSet(set);
}
writePosterAndManifest();
await browser.close();
for (const set of SETS) {
  const size = execFileSync("du", ["-sh", path.join(OUT, set.name)]).toString().trim();
  console.log("payload", size);
}
console.log("done");

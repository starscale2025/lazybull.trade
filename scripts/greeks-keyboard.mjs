// Guard: the Greeks lab works with the keyboard alone (plan A5, Stage 4).
//   node scripts/greeks-keyboard.mjs [baseUrl]      (default http://localhost:3100)
//
// Tabs from the top of /greeks to the surface's handle, moves it with the
// arrow keys, picks another surface from the cards, switches to puts, and
// checks that each step changed what the page says. No mouse anywhere.

import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:3100").replace(/\/$/, "");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("lb-consent", JSON.stringify({ v: 1, adult: true, analytics: false, training: false, at: new Date().toISOString() }));
  } catch {}
});
const page = await ctx.newPage();
const fails = [];
const check = (ok, what) => (ok ? console.log(`✓ ${what}`) : (fails.push(what), console.error(`✗ ${what}`)));
const focused = () => page.evaluate(() => {
  const a = document.activeElement;
  return { role: a?.getAttribute("role"), label: a?.getAttribute("aria-label"), text: (a?.textContent || "").trim().slice(0, 40), value: a?.getAttribute("aria-valuetext") };
});
const tabTo = async (test, max = 60) => {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (test(await focused())) return true;
  }
  return false;
};

await page.goto(BASE + "/greeks", { waitUntil: "load" });
await page.waitForTimeout(1500);

check(await tabTo((f) => f.role === "slider" && /strike and days/i.test(f.label || "")), "Tab reaches the surface's handle");
const before = (await focused()).value;
for (const k of ["ArrowRight", "ArrowRight", "ArrowUp"]) await page.keyboard.press(k);
const after = (await focused()).value;
check(before !== after && /Strike \d+/.test(after || ""), `arrow keys move the handle (${before} -> ${after})`);
check(/Strike/.test(await page.locator("p[aria-live=polite]").first().textContent() || ""), "a polite live region speaks the new values");

const title = () => page.locator("h2").first().textContent();
const t0 = await title();
check(await tabTo((f) => /^.?\s*Theta/.test(f.text)), "Tab reaches the Theta card");
await page.keyboard.press("Enter");
check((await title()) !== t0 && /Theta/.test((await title()) || ""), "Enter on a card shows its surface");

check(await tabTo((f) => f.text === "Put"), "Tab reaches the Put switch");
await page.keyboard.press("Space");
check(/put/.test((await title()) || ""), "Space switches the lab to puts");

await browser.close();
if (fails.length) {
  console.error(`\n${fails.length} keyboard check(s) failed.`);
  process.exit(1);
}
console.log("\nThe Greeks lab works with the keyboard alone.");

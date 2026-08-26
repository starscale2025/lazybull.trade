// Durability guardrails — run after `next build`:  node scripts/guard.mjs
//
// The Phoenix Protocol fixed real regressions (three.js shipped twice, ~1,900
// lines of dead components in the bundle). These checks keep them fixed. Hard
// failures block a build; the dead-code scan warns (dynamic imports make a
// hard fail on unused files too fragile to gate CI).
//
// Budgets are set with headroom over the current HEALTHY build so a genuine
// regression trips them, not normal growth:
//   chunks total  ≤ 4.6 MB  (healthy ≈ 3.7 MB; a duplicated three chunk = +0.85)
//   largest chunk ≤ 1.60 MB (the three chunk is ~1.32 MB)

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const CHUNKS_DIR = ".next/static/chunks";
const BUDGET_TOTAL_MB = 4.6;
const BUDGET_LARGEST_MB = 1.6;

let failed = false;
const fail = (msg) => {
  console.error("✗ " + msg);
  failed = true;
};
const ok = (msg) => console.log("✓ " + msg);

// ── 1. exactly one three.js carrier ─────────────────────────────────────────
{
  const carriers = [];
  for (const f of readdirSync(CHUNKS_DIR)) {
    if (!f.endsWith(".js")) continue;
    if (readFileSync(join(CHUNKS_DIR, f), "utf8").includes("WebGLRenderer")) carriers.push(f);
  }
  if (carriers.length > 1) fail(`three.js duplicated across ${carriers.length} chunks: ${carriers.join(", ")}`);
  else ok(carriers.length === 1 ? `one three.js chunk (${carriers[0]})` : "no three.js in the bundle");
}

// ── 2. payload budget ───────────────────────────────────────────────────────
{
  let total = 0;
  let largest = { f: "", kb: 0 };
  for (const f of readdirSync(CHUNKS_DIR)) {
    if (!f.endsWith(".js")) continue;
    const kb = statSync(join(CHUNKS_DIR, f)).size / 1024;
    total += kb;
    if (kb > largest.kb) largest = { f, kb };
  }
  const totalMb = total / 1024;
  const largestMb = largest.kb / 1024;
  if (totalMb > BUDGET_TOTAL_MB) fail(`chunks total ${totalMb.toFixed(2)} MB exceeds ${BUDGET_TOTAL_MB} MB budget`);
  else ok(`chunks total ${totalMb.toFixed(2)} MB (budget ${BUDGET_TOTAL_MB})`);
  if (largestMb > BUDGET_LARGEST_MB) fail(`largest chunk ${largest.f} is ${largestMb.toFixed(2)} MB (budget ${BUDGET_LARGEST_MB})`);
  else ok(`largest chunk ${largestMb.toFixed(2)} MB (budget ${BUDGET_LARGEST_MB})`);
}

// ── 3. dead-component scan (WARN — poor-man's knip) ─────────────────────────
// A component file whose basename is imported nowhere is probably dead. Warn,
// don't fail: dynamic/string imports would make this a flaky gate.
{
  const roots = ["app", "components", "lib"];
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) files.push(p);
    }
  };
  for (const r of roots) walk(r);
  const corpus = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const orphans = [];
  for (const f of files) {
    // Only consider reusable components (skip route files, which are entered by the router).
    if (!f.startsWith("components/")) continue;
    const base = f.split("/").pop().replace(/\.tsx?$/, "");
    // Is this basename referenced by any import/from string other than its own
    // file? Anchor `base` to a full path SEGMENT — `(?:[^"']*/)?base` requires it
    // to sit right after a "/" (or the opening quote for a bare import), so a
    // suffix collision (Card being "used" whenever HungCard is imported) can no
    // longer hide a real orphan.
    const seg = `(?:[^"']*/)?${base}`;
    const importRe = new RegExp(`(from\\s+["']${seg}["']|import\\(["']${seg}["']\\))`);
    if (!importRe.test(corpus)) orphans.push(f);
  }
  if (orphans.length) {
    console.warn(`⚠ ${orphans.length} component(s) imported nowhere (bury or wire them):`);
    for (const o of orphans) console.warn(`   ${o}`);
  } else {
    ok("no orphaned components");
  }
}

// ── 4. the Dock invariant (FAIL) ────────────────────────────────────────────
// The Dock (components/Dock.tsx) is the ONE place a floating control may pin to
// the bottom-right corner; anything else there re-creates the overlapping-FAB
// anarchy the Dock fixed. Fail if any component pins fixed + bottom-* + right-*
// outside the Dock. Heuristic on static className values (misses interpolated
// classes) but catches the common regression.
{
  const offenders = [];
  const scan = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        scan(p);
        continue;
      }
      if (!e.name.endsWith(".tsx")) continue;
      if (p.endsWith(join("components", "Dock.tsx"))) continue; // the one sanctioned corner
      const src = readFileSync(p, "utf8");
      const values = [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2] ?? "");
      if (values.some((v) => /\bfixed\b/.test(v) && /bottom-/.test(v) && /right-/.test(v))) offenders.push(p);
    }
  };
  scan("components");
  if (offenders.length) fail(`fixed bottom-right control outside the Dock (re-dock it): ${offenders.join(", ")}`);
  else ok("dock invariant: no rogue bottom-right FABs");
}

// ── 5. the z ladder (FAIL) ──────────────────────────────────────────────────
// A modal must outrank persistent floating chrome. It did not: the Dock host
// sits at 90 and RiskWizard sat at 90 too (losing on DOM order), PreTradeModal
// at 85, StrategyCard and the KillSwitch arming sheet at 80 — so the floating
// "place a bet" pill rendered on top of every safety gate and stayed clickable
// through it. Stacking is now named in globals.css (--z-dock / --z-dialog /
// --z-palette); this stops a raw number creeping back in under the Dock.
{
  const offenders = [];
  const scan = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { scan(p); continue; }
      if (!e.name.endsWith(".tsx")) continue;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const v = m[1] ?? m[2] ?? "";
        if (!/\bfixed\b/.test(v) || !/\binset-0\b/.test(v)) continue;
        const z = /z-\[(\d+)\]/.exec(v);
        if (z && Number(z[1]) <= 90) offenders.push(`${p} (z-[${z[1]}])`);
      }
    }
  };
  scan("components");
  scan("app");
  if (offenders.length)
    fail(`full-screen overlay at or below the Dock — use z-[var(--z-dialog)]: ${offenders.join(", ")}`);
  else ok("z ladder: every full-screen overlay outranks the Dock");
}

if (failed) {
  console.error("\nguard: FAILED");
  process.exit(1);
}
console.log("\nguard: passed");

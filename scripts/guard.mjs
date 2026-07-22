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
    // Is this basename referenced by any import/from string other than its own file?
    const importRe = new RegExp(`(from\\s+["'][^"']*${base}["']|import\\(["'][^"']*${base}["']\\))`);
    if (!importRe.test(corpus)) orphans.push(f);
  }
  if (orphans.length) {
    console.warn(`⚠ ${orphans.length} component(s) imported nowhere (bury or wire them):`);
    for (const o of orphans) console.warn(`   ${o}`);
  } else {
    ok("no orphaned components");
  }
}

if (failed) {
  console.error("\nguard: FAILED");
  process.exit(1);
}
console.log("\nguard: passed");

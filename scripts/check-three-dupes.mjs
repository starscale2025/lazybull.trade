// Post-build guard: exactly ONE chunk may contain three.js.
// The cinema once shipped WebGLRenderer twice — 2 × 852KB, 34% of the entire
// static payload — because three lazy boundaries split the module graph.
// Run after `next build`:  node scripts/check-three-dupes.mjs
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const dir = ".next/static/chunks";
let carriers = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".js")) continue;
  const src = readFileSync(join(dir, f), "utf8");
  if (src.includes("WebGLRenderer")) carriers.push(f);
}

if (carriers.length > 1) {
  console.error(`✗ three.js is duplicated across ${carriers.length} chunks:`);
  for (const c of carriers) console.error(`  - ${c}`);
  process.exit(1);
}
console.log(
  carriers.length === 1
    ? `✓ one three.js chunk: ${carriers[0]}`
    : "✓ no three.js in the bundle (nothing 3D built?)"
);

// Post-build guard: exactly ONE chunk may contain three.js.
// The cinema once shipped WebGLRenderer twice — 2 × 852KB, 34% of the entire
// static payload — because three lazy boundaries split the module graph.
// Run after `next build`:  node scripts/check-three-dupes.mjs
//
// What counts as a copy: a chunk holding three's own WebGLRenderer SOURCE,
// recognised by the error strings only that source carries. It used to match
// the bare word "WebGLRenderer", which also hits every chunk that merely CALLS
// `new THREE.WebGLRenderer()`. That was harmless while one lazy boundary held
// both three and its only caller; since frame zero's matter scene became a
// second, Turbopack rightly lifts three into a shared chunk and the callers
// sit beside it, and the bare word flagged two callers as copies.
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const dir = ".next/static/chunks";
const MARK = "THREE.WebGLRenderer: Error creating WebGL context";
let carriers = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".js")) continue;
  const src = readFileSync(join(dir, f), "utf8");
  if (src.includes(MARK)) carriers.push(f);
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

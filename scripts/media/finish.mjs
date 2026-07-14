// Finish a downloaded master image into committed site assets:
//   node scripts/media/finish.mjs <master.(png|jpg|webp)> public/media/<dir>/<name>
// Emits <name>@1600.webp and <name>@800.webp and prints sizes.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [src, outBase] = process.argv.slice(2);
if (!src || !outBase) {
  console.error("usage: node scripts/media/finish.mjs <master> <outBaseNoExt>");
  process.exit(1);
}
const tmp = `${outBase}.tmp.png`;
for (const w of [1600, 800]) {
  execFileSync("sips", ["-Z", String(w), "-s", "format", "png", src, "--out", tmp], { stdio: "ignore" });
  const out = `${outBase}@${w}.webp`;
  execFileSync("cwebp", ["-quiet", "-q", "82", tmp, "-o", out]);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${path.basename(out)}  ${kb}KB${kb > (w === 1600 ? 300 : 90) ? "  ⚠ OVER BUDGET" : ""}`);
}
fs.rmSync(tmp, { force: true });

// Turn a generated clip into a scroll-scrub webp frame sequence.
// Usage: node scripts/media/scrub-frames.mjs <in.mp4> <outDir> [frames=64] [width=1280] [q=55]
// (ffmpeg → PNG, then cwebp — this machine's Homebrew ffmpeg lacks libwebp.)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const [, , input, outDir, framesArg = "64", widthArg = "1280", qArg = "55"] = process.argv;
if (!input || !outDir) {
  console.error("usage: scrub-frames.mjs <in.mp4> <outDir> [frames] [width] [q]");
  process.exit(1);
}
const N = Number(framesArg);
const W = Number(widthArg);
const Q = Number(qArg);

const probe = execFileSync("ffprobe", [
  "-v", "error",
  "-select_streams", "v:0",
  "-show_entries", "stream=nb_frames,duration",
  "-of", "json",
  input,
]).toString();
const stream = JSON.parse(probe).streams[0];
const total = Number(stream.nb_frames) || Math.floor(Number(stream.duration) * 24);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scrub-"));
// select N frames evenly across the clip
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", input,
  "-vf", `select='not(mod(n\\,${Math.max(1, Math.floor(total / N))}))',scale=${W}:-2`,
  "-vsync", "vfr",
  "-frames:v", String(N),
  path.join(tmp, "f-%03d.png"),
]);

fs.mkdirSync(outDir, { recursive: true });
const pngs = fs.readdirSync(tmp).filter((f) => f.endsWith(".png")).sort();
let bytes = 0;
pngs.forEach((f, i) => {
  const out = path.join(outDir, `f-${String(i).padStart(3, "0")}.webp`);
  execFileSync("cwebp", ["-quiet", "-q", String(Q), path.join(tmp, f), "-o", out]);
  bytes += fs.statSync(out).size;
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${pngs.length} frames → ${outDir} (${(bytes / 1024 / 1024).toFixed(2)} MB total)`);

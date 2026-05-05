// Server-only helper that reads the actual bot registry files at build time
// and extracts the source for a given bot id. Whatever ships here is what the
// bot really runs — no chance of the docs drifting from the code.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

let cache: { bots: string; ai: string } | null = null;
function loadFiles() {
  if (cache) return cache;
  cache = {
    bots: readFileSync(join(ROOT, "lib/quant/bots.ts"), "utf8"),
    ai: readFileSync(join(ROOT, "lib/quant/ai-bots.ts"), "utf8"),
  };
  return cache;
}

export type BotSource = {
  code: string;
  filename: string;
  startLine: number;
  endLine: number;
};

export function getBotSource(id: string): BotSource | null {
  const { bots, ai } = loadFiles();
  // First search ai-bots (smaller, more likely for ai-* ids)
  const fromAi = sliceById(ai, id, "lib/quant/ai-bots.ts");
  if (fromAi) return fromAi;
  return sliceById(bots, id, "lib/quant/bots.ts");
}

// Walks the file looking for `id: "<id>"`, then walks back to the nearest
// `const xxx: BotDef = aiBot(...)` or `const xxx: BotDef = {` to find the
// declaration start. Walks forward to the matching close brace and trailing
// `};` or `,);` to find the end. Returns the trimmed declaration verbatim.
function sliceById(src: string, id: string, filename: string): BotSource | null {
  const lines = src.split("\n");
  const idMarker = `id: "${id}"`;
  const idLineIdx = lines.findIndex((l) => l.includes(idMarker));
  if (idLineIdx < 0) return null;

  // Walk backward to find the declaration (`const XXX: BotDef = ...`)
  let startIdx = idLineIdx;
  for (let i = idLineIdx; i >= 0 && i > idLineIdx - 60; i--) {
    if (/^const\s+\w+\s*:\s*BotDef\s*=/.test(lines[i])) {
      startIdx = i;
      break;
    }
  }

  // Walk forward, tracking brace/paren depth, to find the end of the
  // declaration. We want to land on the line that contains the closing `};`.
  let depth = 0;
  let started = false;
  let endIdx = startIdx;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{" || ch === "(") {
        depth++;
        started = true;
      } else if (ch === "}" || ch === ")") {
        depth--;
        if (started && depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (started && depth === 0) {
      endIdx = i;
      break;
    }
  }

  // Drop banner comments above the const declaration if present
  const code = lines.slice(startIdx, endIdx + 1).join("\n").trim();
  return {
    code,
    filename,
    startLine: startIdx + 1,
    endLine: endIdx + 1,
  };
}

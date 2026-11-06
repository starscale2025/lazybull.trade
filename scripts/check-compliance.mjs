// Compliance-copy guard.
//
// lazybull sells understanding, not trades. Two regulators police the line we
// stand on and they read features and copy, not disclaimers: SEBI treats
// stock-specific, forward-looking instruction as unregistered investment
// advice however it is labelled (the Dec 2025 Avadhut Sathe order impounded
// ₹546 crore from an "academy" whose courses carried entry and exit calls),
// and the FTC prosecutes earnings claims from trading educators (Online
// Trading Academy, 2020; IM Mastery Academy, 2026). See docs/COMPLIANCE.md.
//
// A 2026-09 diligence pass found sizing instructions ("plug those
// probabilities into Kelly for sizing"), signal language ("BUY/SELL only fire
// when…", "that's the trade signal") and an unhedged accuracy claim still
// live in shipped copy, months after the team's own compliance note said to
// remove them. Prose regresses silently, so the rule is mechanical now:
// this scans every copy-bearing file for the banned vocabulary and fails the
// build. It is a lint, not a lawyer — a clean run means no BANNED PHRASE was
// found, never that a page is lawful.
//
//   node scripts/check-compliance.mjs            # whole tree, exits 1 on a hit
//   node scripts/check-compliance.mjs --list     # print the rules and exit
//   node scripts/check-compliance.mjs path/…     # only these files
//
// A legitimate hit — /safety quoting the words we promise never to say — goes
// in scripts/compliance-allow.txt as `path:pattern-id`, one per line, with a
// `#` comment saying why. Widening a RULE to dodge a failure is the one edit
// this file exists to prevent.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const ALLOW_FILE = "scripts/compliance-allow.txt";

/** Directories that hold copy a visitor can read. */
// public/cinema holds the 2D film scene, which draws copy into a canvas: the
// 2026-11 verification found "P(down) 71%" there, invisible to a .tsx-only scan.
const SCAN_DIRS = ["app", "components", "lib/quant", "lib/practice/content", "lib", "public/cinema"];
const SCAN_EXT = [".tsx", ".ts", ".html", ".svg"];
/** Never scanned: generated output, tests (they quote banned strings on purpose). */
const SKIP = [
  "node_modules",
  ".next",
  "__tests__",
  join("scripts", "practice"),
];

/**
 * Each rule is `{ id, re, why }`. `re` is matched case-insensitively against
 * the file's text. Keep the patterns narrow: a rule that fires on ordinary
 * prose gets loosened by the next person in a hurry, and then it guards
 * nothing.
 */
const RULES = [
  // ── instruction: telling a reader what to do with money ──────────────────
  { id: "sizing", re: /\bsize up\b|\bhalf[- ]kelly\b|plug (?:those|these) probabilities|\bposition[- ]sizing context\b/i,
    why: "tells the reader how much to risk — a personalised sizing recommendation" },
  { id: "instruct-trade", re: /\byou should (?:buy|sell|short|hold)\b|\bbuy now\b|\bsell now\b|\bsit it out\b|\bstand aside\b/i,
    why: "instructs a trade; education describes what a rule did, never what to do" },
  { id: "signal", re: /\btrade signal\b|\bstrong (?:long|short) signal\b|\bclean (?:long|short) signal\b|\bthe agreement is the signal\b/i,
    why: "frames model output as an actionable signal" },
  { id: "fires", re: /\b(?:buy\/sell|buy or sell)\s+only fires?\b|\bfires? (?:a )?(?:buy|sell)\b/i,
    why: "signal language; describe the historical rule in the past tense instead" },

  // ── promise: any implied or stated return ────────────────────────────────
  { id: "earnings", re: /\bfree money\b|\bcan(?:'|’)?t lose\b|\bcannot lose\b|\brisk[- ]free profit\b|\bbeat the market\b|\bguaranteed returns?\b|\bmake money (?:with|from|using) (?:this|us|lazybull)\b/i,
    why: "an earnings claim — the exact thing the FTC prosecutes educators for" },
  { id: "edge-claim", re: /\breal edge\b|\byou(?:'|’)?ve got something real\b/i,
    why: "promises an edge; say what the historical sample showed" },

  // ── unhedged performance ─────────────────────────────────────────────────
  { id: "ultra-tier", re: /\bULTRA\b/,
    why: "a confidence band named like a trade grade; use the agreement labels" },
  { id: "accuracy-77", re: /\b77\s*%|\b65[–-]77\s*%/,
    why: "outside the canonical out-of-sample band (55–66%); see ai quants/README.md" },

  // ── facts that are simply wrong ──────────────────────────────────────────
  { id: "dead-domain", re: /lazybull\.trade/i,
    why: "that domain does not resolve; the site is lazybull.us and the brand is lazybull" },

  // ── homepage claims the memo flagged ─────────────────────────────────────
  { id: "bots-watching", re: /\d+\s+bots watching|so you don(?:'|’)?t have to/i,
    why: "positions the models as something that trades for you" },
  { id: "fake-prediction", re: /P\((?:down|up)\)\s*\d/i,
    why: "a fabricated prediction rendered as decoration" },

  { id: "oracle", re: /\bsaw the crash coming\b|\bcrash detection\b|\bbars early\b|\bthe AI (?:actually )?called\b|\bpaper pick\b|\bcandidate\s*=\s*(?:CALL|PUT)\b/i,
    why: "claims the models foresaw a move; the film may bound risk, never predict it" },

  // ── betting vocabulary: lazybull teaches positions, it does not take bets ─
  { id: "bet", re: /\bbet (?:on|builder|placed|a|open|at)\b|\b(?:place|confirm|open|paper|up|down|option|manage|settled)\s+(?:this\s+)?bets?\b|\bno bets\b|\}\s*bets?\b|^\s*bets?\s|\bbetting\b|\b(?:win|model) odds\b|\bif right\b/i,
    why: "betting-slip vocabulary under a not-a-guessing-game manifesto; say paper trade or position" },
  { id: "income-promise", re: /\brisk income\b|\bonly then trade\b/i,
    why: "frames a short-premium position as income, or ends a lesson on 'now trade'; it is a credit with a defined loss, and the next step is a paper trade" },

  // ── model output as a call (Gate A re-tribunal, 2026-11-05: /quant printed
  // "★ recommended for AMZN" and "BUY · 5/5 say UP" beside PAPER TRADE, and the
  // line rules above passed it, because the BUY came from verdict.side at
  // runtime). Uppercase on purpose: lowercase buy/sell is the paper order
  // ticket's own vocabulary on /pro and in the stores.
  { id: "verdict-token", re: /(?:\b(?:[Ff]lash(?:es|ed)?|[Ss]ays?|[Ll]ean(?:s|ed)?|[Vv]erdict(?: is)?)|→)\s*(?:a\s+)?(?:BUY|SELL)\b|\b(?:BUY|SELL)\s*·\s*\d|\b\d+\s+(?:BUY|SELL)\b|\bBUY\s*\/\s*SELL\b|\b\d+\/\d+\s+say\s+(?:UP|DOWN)\b|\bverdict\.side\.toUpperCase\(\)/,
    why: "prints a model's output as a trade action or a vote on the price; the workbench prints a read (up / down / flat / caution) of a window that has already played out (lib/quant/reads)" },
  { id: "recommended-for", re: /\brecommended for\b/i,
    why: "recommends something for a named security; say what a stack or a tool is for, not which stock it suits" },
  // Gate A re-run, 2026-11-06: the AI cells still printed "73% chance up",
  // "CONSENSUS DIRECTION UP", "Decision: LONG" and "a 2.10% setup over the next
  // 20 days". The rules above missed them because the words sat around
  // template expressions; these match the fixed text either side of one.
  { id: "forward-read", re: /%\s*chance\b|\bconsensus direction\b|\bDecision:\s*(?:\$\{|LONG\b|SHORT\b)|\bover the next \d+\s*(?:d\b|days?\b|sessions?\b)/i,
    why: "speaks about what a named security will do (a % chance, a direction call, a decision, 'over the next N days'); a /quant read describes a window that has already played out (lib/quant/reads)" },

  // ── demo-ware vocabulary that must not return ────────────────────────────
  { id: "seeded-fake", re: /\bseeded fake|\bSIM lamp\b|\bscripted judge\b|\bpitch prototype\b/i,
    why: "fabricated figures presented as product; make the number real or omit it" },
];

/* ── the scan ─────────────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (SKIP.some((s) => rel === s || rel.startsWith(s + sep))) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SCAN_EXT.some((e) => name.endsWith(e))) out.push(rel);
  }
  return out;
}

/** `path:rule-id` per line; `#` comments and blanks ignored. */
function readAllowList() {
  if (!existsSync(ALLOW_FILE)) return new Set();
  return new Set(
    readFileSync(ALLOW_FILE, "utf8")
      .split("\n")
      .map((l) => l.replace(/#.*$/, "").trim())
      .filter(Boolean)
  );
}

/**
 * Scan one file's text. Exported for the test, which asserts the rules
 * actually fire — a guard nobody has seen fail is a guard nobody trusts.
 */
export function scanText(text, relPath = "", allow = new Set()) {
  const hits = [];
  const lines = text.split("\n");
  for (const rule of RULES) {
    if (allow.has(`${relPath}:${rule.id}`)) continue;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(rule.re);
      if (m) hits.push({ file: relPath, line: i + 1, id: rule.id, why: rule.why, text: m[0] });
    }
  }
  return hits;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    for (const r of RULES) console.log(`${r.id.padEnd(16)} ${r.why}`);
    return 0;
  }
  const allow = readAllowList();
  const explicit = args.filter((a) => !a.startsWith("--"));
  const files = explicit.length > 0 ? explicit.map((f) => relative(ROOT, f) || f) : [...new Set(SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))))];

  const hits = [];
  for (const rel of files) {
    const full = join(ROOT, rel);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    hits.push(...scanText(readFileSync(full, "utf8"), rel, allow));
  }

  if (hits.length === 0) {
    console.log(`compliance: clean — ${files.length} files, ${RULES.length} rules`);
    return 0;
  }
  console.error(`compliance: ${hits.length} banned phrase${hits.length === 1 ? "" : "s"} in ${new Set(hits.map((h) => h.file)).size} file(s)\n`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    [${h.id}] "${h.text}" — ${h.why}\n`);
  }
  console.error(`Rewrite the copy. If a hit is legitimate (quoting what we promise never to say),`);
  console.error(`add "<path>:<rule-id>" with a reason to ${ALLOW_FILE}.`);
  return 1;
}

// Only run when invoked directly — the test imports scanText.
if (process.argv[1] && process.argv[1].endsWith("check-compliance.mjs")) {
  process.exit(main());
}

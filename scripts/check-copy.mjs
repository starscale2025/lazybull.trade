// Copy-preservation guard for styling passes.
//
// A design pass is allowed to change how things look and NOTHING else. This
// strips styling attributes from a file and its HEAD version, then compares
// what is left. If the residue differs, the pass changed something that is
// not styling — wording, markup, a link — and wants a human.
//
// Born from a real incident: a restyle rewrote hero copy, invented a commit
// hash that appeared nowhere in the original, and deleted two working
// breadcrumb links. All three were invisible in a diff full of class churn.
//
//   node scripts/check-copy.mjs                 # every changed tsx vs HEAD
//   node scripts/check-copy.mjs path/to/File.tsx

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

/** Drop an attribute and its value, brace-matching so nested objects survive. */
function stripAttr(src, name) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf(name + "=", i);
    if (at === -1) { out += src.slice(i); break; }
    out += src.slice(i, at);
    let j = at + name.length + 1;
    if (src[j] === '"' || src[j] === "'") {
      const quote = src[j];
      j = src.indexOf(quote, j + 1);
      i = j === -1 ? src.length : j + 1;
    } else if (src[j] === "{") {
      let depth = 0;
      for (; j < src.length; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}" && --depth === 0) { j++; break; }
      }
      i = j;
    } else {
      i = j;
    }
  }
  return out;
}

/** What the user can actually perceive: text, links, and structure. */
function residue(src) {
  let s = src;
  for (const attr of ["className", "class", "style"]) s = stripAttr(s, attr);
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
    .replace(/^\s*\/\/.*$/gm, "")        // line comments
    .replace(/\s+/g, " ")
    .trim();
}

// Content changes that ARE authorised. A styling pass must never edit copy,
// but a design decision sometimes deletes an element outright — and that is
// indistinguishable from an accident to the check above. So the exceptions are
// enumerated here, with a reason, rather than left to a reviewer's memory.
// Anything not on this list is still a hard failure.
const ALLOWED = {
  "components/Nav.tsx":
    "nav numerals removed — navigation is a set of destinations, not a sequence, so 01-07 encoded nothing (the landing INDEX keeps its numerals)",
  "components/MobileMenu.tsx":
    "same numeral removal as the desktop rail, kept in step with it",
};

const target = process.argv[2];
const files = target
  ? [target]
  : execSync("git diff --name-only HEAD -- '*.tsx'", { encoding: "utf8" })
      .split("\n").filter(Boolean);

let failed = 0;
for (const file of files) {
  if (!existsSync(file)) { console.log(`DELETED  ${file}`); failed++; continue; }
  let head;
  try {
    head = execSync(`git show HEAD:"${file}"`, { encoding: "utf8" });
  } catch {
    console.log(`NEW      ${file} (no HEAD version — nothing to compare)`);
    continue;
  }
  const now = readFileSync(file, "utf8");

  const a = residue(head);
  const b = residue(now);
  const linksBefore = (head.match(/href=/g) || []).length;
  const linksAfter = (now.match(/href=/g) || []).length;

  const problems = [];
  if (a !== b) problems.push("visible content or markup changed");
  if (linksAfter < linksBefore) problems.push(`lost ${linksBefore - linksAfter} link(s)`);

  if (problems.length && ALLOWED[file]) {
    console.log(`ALLOWED  ${file} — ${problems.join("; ")}`);
    console.log(`         reason: ${ALLOWED[file]}`);
    continue;
  }

  if (problems.length) {
    failed++;
    console.log(`FAIL     ${file} — ${problems.join("; ")}`);
    // Show the first divergence in context so it is actionable.
    if (a !== b) {
      let k = 0;
      while (k < a.length && k < b.length && a[k] === b[k]) k++;
      console.log(`         at ~${k}: HEAD …${a.slice(Math.max(0, k - 60), k + 60)}…`);
      console.log(`                     NOW  …${b.slice(Math.max(0, k - 60), k + 60)}…`);
    }
  } else {
    console.log(`ok       ${file}`);
  }
}

console.log(`\n${files.length} file(s) checked, ${failed} failing.`);
process.exit(failed ? 1 : 0);

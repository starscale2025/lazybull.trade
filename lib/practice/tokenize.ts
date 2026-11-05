// A small highlighter for the overlay editor (components/practice/CodeEditor.tsx).
// It knows comments, strings, numbers, keywords and calls — enough for a stub
// to read as code — and guarantees one invariant the overlay editor depends on:
// concatenating the tokens reproduces the input byte for byte, so the
// coloured <pre> and the transparent <textarea> above it never drift.

import type { Lang, Token, TokenKind } from "./types";

export const TOKEN_CLASS: Record<TokenKind, string> = {
  kw: "text-cyan",
  str: "text-amber",
  num: "text-plasma",
  cmt: "text-fg-faint",
  fn: "text-fg",
  plain: "",
};

const PY_KW = new Set(
  "def return if elif else for while in not and or import from as class lambda None True False with pass yield raise try except finally is break continue global nonlocal assert del".split(
    " "
  )
);
const TS_KW = new Set(
  "const let var function return if else for while of in import from export type interface new class extends throw try catch finally async await number string boolean void null undefined true false this readonly enum implements switch case break continue default".split(
    " "
  )
);

const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch);
const isIdent = (ch: string) => /[A-Za-z0-9_$]/.test(ch);
const isDigit = (ch: string) => ch >= "0" && ch <= "9";

export function tokenize(code: string, lang: Lang): Token[] {
  const out: Token[] = [];
  const kw = lang === "python" ? PY_KW : TS_KW;
  const n = code.length;
  let i = 0;
  let plain = "";

  const flushPlain = () => {
    if (plain) {
      out.push({ text: plain, kind: "plain" });
      plain = "";
    }
  };
  const push = (text: string, kind: TokenKind) => {
    flushPlain();
    out.push({ text, kind });
  };

  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];

    // comments
    if ((lang === "python" && ch === "#") || (lang === "typescript" && ch === "/" && next === "/")) {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      push(code.slice(i, j), "cmt");
      i = j;
      continue;
    }
    if (lang === "typescript" && ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const j = end === -1 ? n : end + 2;
      push(code.slice(i, j), "cmt");
      i = j;
      continue;
    }

    // strings — triple quotes first, then single/double/backtick
    if (ch === '"' || ch === "'" || (lang === "typescript" && ch === "`")) {
      const triple = lang === "python" && code.startsWith(ch + ch + ch, i);
      if (triple) {
        const end = code.indexOf(ch + ch + ch, i + 3);
        const j = end === -1 ? n : end + 3;
        push(code.slice(i, j), "str");
        i = j;
        continue;
      }
      let j = i + 1;
      while (j < n) {
        const c = code[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === ch) {
          j++;
          break;
        }
        // An unterminated quote runs to the end of the line (template
        // literals may span lines).
        if (c === "\n" && ch !== "`") break;
        j++;
      }
      push(code.slice(i, Math.min(j, n)), "str");
      i = Math.min(j, n);
      continue;
    }

    // numbers
    if (isDigit(ch) || (ch === "." && next !== undefined && isDigit(next) && !(i > 0 && isIdent(code[i - 1])))) {
      let j = i;
      while (j < n && (isDigit(code[j]) || code[j] === "." || code[j] === "_")) j++;
      if ((code[j] === "e" || code[j] === "E") && (isDigit(code[j + 1] ?? "") || code[j + 1] === "-" || code[j + 1] === "+")) {
        j += 2;
        while (j < n && isDigit(code[j])) j++;
      }
      push(code.slice(i, j), "num");
      i = j;
      continue;
    }

    // identifiers / keywords / calls
    if (isIdentStart(ch)) {
      let j = i;
      while (j < n && isIdent(code[j])) j++;
      const word = code.slice(i, j);
      if (kw.has(word)) {
        push(word, "kw");
      } else {
        // a call, or the name right after def / function
        let k = j;
        while (k < n && (code[k] === " " || code[k] === "\t")) k++;
        const before = plain.replace(/\s+$/, "");
        const afterDef =
          out.length > 0 &&
          out[out.length - 1].kind === "kw" &&
          /^(def|function)$/.test(out[out.length - 1].text) &&
          before === "";
        if (code[k] === "(" || afterDef) push(word, "fn");
        else plain += word;
      }
      i = j;
      continue;
    }

    plain += ch;
    i++;
  }
  flushPlain();
  return out;
}

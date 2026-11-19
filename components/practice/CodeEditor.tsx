"use client";

/**
 * The editor for /practice — an overlay editor. Execution happens elsewhere:
 * the workspace hands the text to lib/practice/use-judge.ts, which runs it in
 * the Pyodide worker; this component only edits it.
 *
 * Three layers share ONE metrics class (METRICS below): a line-number gutter,
 * a <pre> of highlighted spans, and a transparent <textarea> on top that owns
 * typing, the caret, selection and the only visible scrollbar. The pre is
 * `code + "\n"` so the trailing empty line keeps its height; onScroll copies
 * the textarea's offsets onto the pre and the gutter so the coloured glyphs
 * sit exactly under the invisible ones.
 *
 * Why each odd class is there:
 *   border-0            the UA sheet gives textareas a 1px border + 2px
 *                       padding that would shift every glyph off the pre
 *   caret-brand-ink     text-transparent also hides the caret in Safari
 *                       unless caret-color is explicit
 *   selection:…!        app/layout.tsx paints `selection:bg-bull
 *                       selection:text-bg` on the body, and the deck skin an
 *                       unlayered `.deck ::selection` (solid green, ink
 *                       text) — either would render selected text opaque
 *                       over the coloured pre. Unlayered beats a layered
 *                       utility, so these two carry `!` to keep the 30% film
 *   whitespace-pre      both layers must wrap identically — i.e. never
 *
 * Keyboard: Tab indents (LANG_META.indent spaces), Shift+Tab dedents, Enter
 * copies the indent (+1 level after `:` / `{`), Escape blurs and hands focus
 * to the run button — the keyboard-trap exit, spelled out in the footer.
 * ⌘/Ctrl+↵ is left to bubble: the workspace root owns run / submit.
 *
 * Skin: the Playground mockup of the pitch deck (slide 7). A header strip with
 * the file as a tab ("● solution.py"), the language as an outlined segmented
 * rect, then RUN (outlined pill) and SUBMIT (the screen's one green pill), mono
 * capitals both. The body is the sunk #0a0a0a with quiet line numbers and the
 * mockup's code colours (DECK_TOKEN below). The frame is the workspace's: this
 * paints only its own fill. Language: buttons on the aria-pressed pattern of
 * components/pro/OrderPanel.tsx (lines 164-196). Run and Submit are plain
 * buttons with the deck's classes: Run carries the ref Escape hands focus to,
 * and a language button here can be disabled and titled.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ClientProblem, Lang, TokenKind } from "@/lib/practice/types";
import { LANG_META } from "@/lib/practice/types";
import { isEdited } from "@/lib/practice/judge";
import { tokenize } from "@/lib/practice/tokenize";
import { Chip } from "@/components/calm/kit";
import { Kbd } from "./Chips";

/** The one metrics class every layer wears. Change it here or nowhere. */
const METRICS =
  "m-0 p-3 font-mono text-[0.8125rem] leading-[1.6] tracking-normal whitespace-pre [tab-size:4] [font-variant-ligatures:none]";

/** The mockup's code colours, sampled from slide 7: keywords in the brand
    green, calls and def names in cyan, numbers in #c9ff00, comments in the
    quiet grey, strings in the amber note's ink, the rest bone. The token KINDS
    are lib/practice/tokenize.ts's; only the paint is this editor's. Colour
    only — never weight or style — so a coloured glyph keeps the exact advance
    of the transparent one above it. #c9ff00 has no paper twin in the deck, so
    the light theme gets a darker cut of it. */
const DECK_TOKEN: Record<TokenKind, string> = {
  kw: "text-[var(--brand)]",
  fn: "text-[var(--cyan)]",
  num: "text-[#c9ff00] [[data-theme=light]_&]:text-[#4f6b00]",
  cmt: "text-[var(--deck-quiet)]",
  str: "text-[var(--deck-amber-text)]",
  plain: "",
};

const LANGS: Lang[] = ["python", "typescript"];

/* ── pure edits on the textarea ──────────────────────────────────────────── */

const spaces = (n: number) => " ".repeat(n);
const lineStartOf = (v: string, i: number) => v.lastIndexOf("\n", i - 1) + 1;
const lineEndOf = (v: string, i: number) => {
  const j = v.indexOf("\n", i);
  return j === -1 ? v.length : j;
};

function indent(ta: HTMLTextAreaElement, n: number) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  if (!v.slice(s, e).includes("\n")) {
    ta.setRangeText(spaces(n), s, e, "end");
    return;
  }
  const ls = lineStartOf(v, s);
  const le = lineEndOf(v, e);
  const block = v
    .slice(ls, le)
    .split("\n")
    .map((l) => spaces(n) + l)
    .join("\n");
  ta.setRangeText(block, ls, le, "select");
}

function dedent(ta: HTMLTextAreaElement, n: number) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const ls = lineStartOf(v, s);
  const le = lineEndOf(v, e);
  const lines = v.slice(ls, le).split("\n");
  const cuts = lines.map((l) => Math.min(n, (/^ */.exec(l) ?? [""])[0].length));
  if (cuts.every((c) => c === 0)) return;
  const block = lines.map((l, i) => l.slice(cuts[i])).join("\n");
  if (s === e) {
    ta.setRangeText(block, ls, le, "preserve");
    const pos = Math.max(ls, s - cuts[0]);
    ta.setSelectionRange(pos, pos);
  } else {
    ta.setRangeText(block, ls, le, "select");
  }
}

function newline(ta: HTMLTextAreaElement, n: number) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const line = v.slice(lineStartOf(v, s), s);
  const lead = (/^[ \t]*/.exec(line) ?? [""])[0];
  const isComment = /^\s*(#|\/\/)/.test(line);
  const opens = !isComment && /[:{]\s*$/.test(line);
  ta.setRangeText("\n" + lead + (opens ? spaces(n) : ""), s, e, "end");
}

/* ── the editor ──────────────────────────────────────────────────────────── */

export function CodeEditor({
  problem,
  lang,
  code,
  onChange,
  onLang,
  onReset,
  onRun,
  onSubmit,
  locked,
  runnable = true,
  className = "",
}: {
  problem: ClientProblem;
  lang: Lang;
  code: string;
  onChange: (code: string) => void;
  onLang: (lang: Lang) => void;
  onReset: () => void;
  onRun: () => void;
  onSubmit: () => void;
  /** loading | running | judging — the judge holds the file. */
  locked: boolean;
  /** False for a language with no judge yet: the text stays editable, the
      run and submit buttons do not pretend. */
  runnable?: boolean;
  className?: string;
}) {
  const meta = LANG_META[lang];
  const hasTs = Boolean(problem.stubs.typescript);
  const edited = isEdited(code, problem.stubs[lang] ?? problem.stubs.python);
  const tokens = useMemo(() => tokenize(code, lang), [code, lang]);
  const lineCount = code.split("\n").length;

  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<HTMLButtonElement>(null);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  const readCaret = () => {
    const ta = taRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart).split("\n");
    const line = before.length;
    const col = before[before.length - 1].length + 1;
    setCaret((c) => (c.line === line && c.col === col ? c : { line, col }));
  };

  // A reset or a language switch replaces the value under the caret:
  // re-align the layers and the footer readout.
  useEffect(() => {
    syncScroll();
    readCaret();
  }, [code, lang]);

  const commit = (ta: HTMLTextAreaElement) => {
    onChange(ta.value);
    readCaret();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const ta = e.currentTarget;
    if (e.key === "Escape") {
      e.preventDefault();
      ta.blur();
      runRef.current?.focus();
      return;
    }
    if (locked) return;
    // ⌘/Ctrl+↵ and friends belong to the workspace root — let them bubble.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) dedent(ta, meta.indent);
      else indent(ta, meta.indent);
      commit(ta);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      newline(ta, meta.indent);
      commit(ta);
    }
  };

  const runTitle = runnable ? undefined : "TypeScript judging ships next — Python runs for real today";

  return (
    <div className={`relative flex flex-col bg-[var(--deck-sunk)] ${className}`}>
      {/* ── header strip: the file as a tab, then the controls ─────────────
          44px tall, like the problem pane's tab strip beside it, so the two
          hairlines run on as one rule across the desk. */}
      <div className="flex flex-wrap items-stretch justify-between border-b border-border">
        <div className="flex min-w-0 items-stretch">
          {/* One file, so the tab is a label, not a control. */}
          <span className="flex min-h-11 items-center gap-2.5 border-r border-border pl-5 pr-5 font-mono text-[0.8125rem] text-fg sm:pl-6">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-fg-faint" />
            {meta.file}
          </span>
          {edited && (
            <span className="flex items-center pl-3">
              <Chip dot>Edited</Chip>
            </span>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 py-1.5 pl-5 pr-4 sm:pl-4 sm:pr-5">
          {/* The mockup's "Python 3.12" box, as a two-way switch. */}
          <div role="group" aria-label="Language" className="flex items-center gap-0.5 rounded-[8px] p-0.5 shadow-[inset_0_0_0_1px_var(--deck-rule)]">
            {LANGS.map((l) => {
              const available = l === "python" || hasTs;
              const on = l === lang;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => onLang(l)}
                  aria-pressed={on}
                  disabled={!available || locked}
                  title={available ? (l === "typescript" ? "editor only — TypeScript judging ships next" : undefined) : "typescript stub coming soon"}
                  className="inline-flex h-7 items-center rounded-[6px] px-2.5 text-[0.8125rem] font-medium text-fg-faint transition-colors enabled:hover:text-fg aria-pressed:bg-[var(--deck-raised)] aria-pressed:text-fg disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {LANG_META[l].label}
                  {!available && " · soon"}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onReset}
            disabled={locked}
            className="inline-flex h-8 items-center rounded-full px-3 text-[0.8125rem] text-fg-faint transition-colors enabled:hover:bg-[var(--deck-raised)] enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-45"
          >
            ↺ Reset
          </button>

          <button ref={runRef} type="button" onClick={onRun} disabled={locked || !runnable} title={runTitle} className="deck-btn deck-btn-sm">
            ▶ Run
          </button>
          <button type="button" onClick={onSubmit} disabled={locked || !runnable} title={runTitle} className="deck-btn deck-btn-primary deck-btn-sm">
            Submit
          </button>
        </div>
      </div>

      {/* the rail — the judge's pulse while it holds the file */}
      {locked ? <div className="dc-rail relative" /> : <div className="h-0.5" />}

      {/* ── the three layers ─────────────────────────────────────────────────
          The textarea carries outline-none, so the focus ring is drawn here,
          on the wrapper, via :has(:focus-visible) — inset, so no ancestor
          can clip it. */}
      <div
        className={`relative flex min-h-0 flex-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-ink has-[:focus-visible]:-outline-offset-2 ${
          locked ? "pointer-events-none opacity-70" : ""
        }`}
      >
        {/* The mockup's gutter: quiet numerals on the editor's own ink, no
            rule — the caret's line a step brighter. */}
        <div
          ref={gutterRef}
          aria-hidden
          className={`${METRICS} w-12 shrink-0 select-none overflow-hidden text-right text-[var(--deck-quiet)] sm:w-14`}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className={i + 1 === caret.line ? "text-fg-dim" : undefined}>
              {i + 1}
            </div>
          ))}
          {/* spacer: lets the gutter scroll as far as a textarea with a
              horizontal scrollbar can */}
          <div className="h-4" />
        </div>

        <div className="relative min-w-0 flex-1">
          <pre
            ref={preRef}
            aria-hidden
            className={`${METRICS} pointer-events-none absolute inset-0 overflow-hidden pr-8 text-fg`}
          >
            {tokens.map((t, i) =>
              t.kind === "plain" ? (
                <span key={i}>{t.text}</span>
              ) : (
                <span key={i} className={DECK_TOKEN[t.kind]}>
                  {t.text}
                </span>
              )
            )}
            {"\n"}
            <span aria-hidden className="block h-4" />
          </pre>
          <textarea
            ref={taRef}
            value={code}
            onChange={(e) => {
              onChange(e.target.value);
              readCaret();
            }}
            onScroll={syncScroll}
            onSelect={readCaret}
            onKeyDown={onKeyDown}
            readOnly={locked}
            aria-label={`${meta.file} — ${meta.label} editor`}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="off"
            enterKeyHint="done"
            className={`${METRICS} absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent text-transparent caret-brand-ink outline-none selection:bg-brand-ink/30! selection:text-transparent!`}
          />
        </div>
      </div>

      {/* ── footer strip: the editor's readout, in small mono ────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-5 py-2 font-mono text-[0.6875rem] text-fg-faint sm:px-6">
        <span className="tabular-nums">
          Ln {caret.line}, col {caret.col} · UTF-8 · spaces: {meta.indent}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {!runnable && <span className="text-[var(--deck-amber-text)]">TypeScript judging ships next — Python runs for real today ·</span>}
          <Kbd>tab</Kbd> indent · <Kbd>esc</Kbd> leave editor
        </span>
      </div>
    </div>
  );
}

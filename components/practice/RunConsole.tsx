"use client";

/**
 * The console under the editor — Testcases | Result — painted from the judge
 * hook (lib/practice/use-judge.ts). Nothing here has a timer: the stream
 * block shows the log lines as the runtime loads, the worker posts each case
 * and the server answers, and the verdict block mounts when the verdict
 * exists. Under prefers-reduced-motion only the entrance animations go
 * (globals.css:1788); every state is the same state.
 *
 * What a number here means: per-case and total runtime are wall time
 * measured in the solver's own browser by the worker; "beats" is the share of
 * accepted submissions for this problem that ran slower, computed on the
 * server from real rows and null until there are enough; "judge" says who
 * produced the verdict — the server (the judge of record) or, for a ▶ run
 * with the server away, this device against the visible cases.
 *
 * Copied chrome: the lockdown strip (components/quant/RunRitual.tsx:313-320),
 * the streaming block (components/quant/RunStream.tsx:60-100), the metric
 * tiles (components/quant/BotCell.tsx:366-383).
 *
 * Skin: the RESULT block of the pitch deck's Playground mockup (slide 7) — a
 * mono RESULT label, the verdict word large in the reading sans, bold, the
 * count beside it in the faint grey, and one row per case behind a small
 * tinted circle. Colour says one thing per hue: green a pass, red a wrong
 * answer, amber a file that did not run (and a verdict that is not the judge
 * of record's), cyan the hidden set — the deck's out-of-sample colour. Wells
 * (inputs, the log, stdout) are the sunk #0a0a0a under a hairline. Links and
 * Run again are the deck's outlined pills; Submit, in the editor, stays the
 * workspace's one green one.
 */

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { CaseResult, ClientProblem, LogTone, RunMode, RunReport, Verdict } from "@/lib/practice/types";
import { LANG_META } from "@/lib/practice/types";
import type { Judge } from "@/lib/practice/use-judge";
import type { PlanNeed } from "@/lib/practice/client";
import { track } from "@/lib/track";
import { DecimatedNumber } from "@/components/quant/DecimatedNumber";
import { Kbd, LockPill, VERDICT_LABEL } from "./Chips";
import { PaneTabs, type TabDef } from "./ProblemTabs";

export type ConsoleTab = "testcases" | "result";
export type Neighbour = { id: string; title: string } | null;

/* ── the panel ───────────────────────────────────────────────────────────── */

const TABS: TabDef<ConsoleTab>[] = [
  { id: "testcases", label: "Testcases" },
  { id: "result", label: "Result" },
];

export function RunConsole({
  problem,
  judge,
  tab,
  onTab,
  next,
  onRunAgain,
  className = "",
}: {
  problem: ClientProblem;
  judge: Judge;
  tab: ConsoleTab;
  onTab: (tab: ConsoleTab) => void;
  next: Neighbour;
  onRunAgain: () => void;
  className?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col ${className}`}>
      {/* The strip carries the hairline the tab underline lands on. The
          runtime repeats in the status strip, so a phone can drop it here. */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 sm:px-6">
        <div className="shrink-0">
          <PaneTabs tabs={TABS} value={tab} onChange={onTab} label="Console tabs" />
        </div>
        <span className="deck-label hidden min-w-0 truncate sm:block">
          {LANG_META.python.runtime.charAt(0).toUpperCase() + LANG_META.python.runtime.slice(1)}
        </span>
      </div>
      {/* At lg this body ends in the desk's bottom-right corner: the radius
          keeps a classic scrollbar inside the window's 14px frame. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:rounded-br-[13px]">
        {tab === "testcases" ? (
          <Testcases problem={problem} judge={judge} />
        ) : (
          <Result problem={problem} judge={judge} next={next} onRunAgain={onRunAgain} />
        )}
      </div>
    </section>
  );
}

/* ── testcases ───────────────────────────────────────────────────────────── */

/** A sunk well for a case's text. No colour here: each caller sets its own,
    so a tint never fights a base colour for the same property. */
const WELL_CLS =
  "mt-2 whitespace-pre-wrap break-words rounded-[10px] border border-border bg-[var(--deck-sunk)] px-3.5 py-2.5 font-mono text-[0.75rem] leading-relaxed";

/** The cyan of the deck's out-of-sample band: what only a submit sees. */
const HIDDEN_CHIP = "deck-chip bg-[var(--deck-cyan-tint)] text-cyan";

function Testcases({ problem, judge }: { problem: ClientProblem; judge: Judge }) {
  const visible = problem.cases;
  const [activeId, setActiveId] = useState(visible[0]?.id ?? "");
  const active = visible.find((c) => c.id === activeId) ?? visible[0];

  if (!active) {
    return <div className="grid flex-1 place-items-center p-6 text-[0.875rem] text-fg-faint">No visible cases</div>;
  }

  const judged = judge.report?.cases.find((x) => x.id === active.id) ?? null;
  const running = judge.locked ? (judge.live.find((x) => x.id === active.id) ?? null) : null;

  return (
    <div className="space-y-4 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((c, i) => {
          const r = judge.report?.cases.find((x) => x.id === c.id) ?? null;
          const on = c.id === active.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setActiveId(c.id)}
              className={`inline-flex h-8 items-center rounded-[8px] px-3 text-[0.8125rem] font-medium transition-colors ${
                on
                  ? "bg-[var(--deck-raised)] text-fg shadow-[inset_0_0_0_1px_var(--deck-rule)]"
                  : "text-fg-faint shadow-[inset_0_0_0_1px_var(--border)] hover:text-fg"
              }`}
            >
              {r && (
                <span role="img" aria-label={r.pass ? "passed" : "failed"} className={`mr-1.5 ${r.pass ? "text-bull" : "text-bear"}`}>
                  {r.pass ? "✓" : "✕"}
                </span>
              )}
              Case {i + 1}
            </button>
          );
        })}
        {problem.hiddenCount > 0 && <span className={`${HIDDEN_CHIP} ml-1`}>+ {problem.hiddenCount} hidden on submit</span>}
      </div>

      <div>
        {/* The entry point is code: its case survives the label's capitals. */}
        <div className="deck-label">
          Input · keyword arguments to <span className="font-mono normal-case tracking-normal text-cyan">{problem.entry}()</span>
        </div>
        <pre className={`${WELL_CLS} text-fg`}>{active.input}</pre>
      </div>

      <div>
        <div className="deck-label">Expected</div>
        <pre className={`${WELL_CLS} text-fg`}>{active.expected}</pre>
      </div>

      {(judged || running) && (
        <div>
          <div className="deck-label">
            Got{judged ? ` · ${judged.pass ? "match" : "mismatch"} · ${judged.ms} ms` : running ? ` · ${running.ms} ms` : ""}
          </div>
          <pre className={`${WELL_CLS} ${judged ? (judged.pass ? "text-bull" : "text-bear") : "text-fg"}`}>
            {(judged ?? running)!.error ? `${(judged ?? running)!.got}\n${(judged ?? running)!.error}` : (judged ?? running)!.got}
          </pre>
        </div>
      )}

      <p className="text-[0.75rem] leading-relaxed text-fg-faint">
        The judge calls <span className="font-mono text-fg-dim">{problem.entry}()</span> with exactly these inputs · outputs are compared to 6
        decimal places
      </p>
    </div>
  );
}

/* ── result ──────────────────────────────────────────────────────────────── */

const TONE_CLS: Record<LogTone, string> = {
  ok: "text-bull",
  warn: "text-amber",
  err: "text-bear",
  info: "text-cyan",
};

/** The verdict word's colour — the deck's VerdictPill hues (./Chips.tsx). */
const VERDICT_TONE: Record<Verdict, string> = {
  accepted: "text-bull",
  "wrong-answer": "text-bear",
  error: "text-amber",
};

function Result({
  problem,
  judge,
  next,
  onRunAgain,
}: {
  problem: ClientProblem;
  judge: Judge;
  next: Neighbour;
  onRunAgain: () => void;
}) {
  const { phase, report, mode, locked, wall } = judge;

  if (wall) return <Wall need={wall} slug={problem.id} />;

  if (phase === "idle" || (!locked && !report)) {
    return <div className="grid flex-1 place-items-center p-6 text-[0.875rem] text-fg-faint">▸ Run the tests to see output</div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* the lockdown notice — RunRitual.tsx:313-320; stays up for as long
          as the judge holds the file */}
      {locked && (
        <div className="dc-line border-b border-border px-5 py-2.5 sm:px-6">
          <span className="deck-label text-fg-dim">
            {phase === "loading"
              ? "Editor locked · loading the python runtime"
              : phase === "judging"
                ? `Editor locked · ${mode === "submit" ? "the server is judging" : "judging"}`
                : mode === "submit"
                  ? `Editor locked · running ${problem.cases.length + problem.hiddenCount} cases`
                  : "Editor locked · running the visible cases"}
          </span>
        </div>
      )}

      {locked && <Stream judge={judge} />}

      {phase === "verdict" && report && (
        <Verdict problem={problem} report={report} mode={mode} next={next} onRunAgain={onRunAgain} />
      )}
    </div>
  );
}

/** The plan wall, in place of a verdict: a submit on a locked problem.
    Emits hit_paywall once per wall so the funnel can count it. */
function Wall({ need, slug }: { need: PlanNeed; slug: string }) {
  useEffect(() => {
    track("hit_paywall", { surface: "practice_submit", slug, need });
  }, [slug, need]);
  const label = need === "power" ? "Power" : "Plus";
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="rounded-[12px] border border-border bg-[var(--deck-sunk)] px-5 py-6 text-center">
        <LockPill lock={need === "power" ? "power" : "pro"} />
        <div className="deck-display mt-3 text-[1.25rem] leading-snug tracking-[-0.015em] text-fg">
          Submitting this one ships with {label}.
        </div>
        <p className="mx-auto mt-1.5 max-w-[38ch] text-[0.8125rem] leading-relaxed text-fg-faint">
          Running the visible cases is free for everyone — the hidden set and the verdict are on the plan
        </p>
        <Link href={`/pricing#${need}`} className="deck-btn deck-btn-sm mt-5">
          See the plans <span className="deck-arrow">→</span>
        </Link>
      </div>
    </div>
  );
}

/** The RunStream console block. Lines mount as the judge appends them, so
    each one types in with `run-stream-line` the moment it lands. */
function Stream({ judge }: { judge: Judge }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="relative overflow-hidden rounded-[12px] border border-border bg-[var(--deck-sunk)] px-4 py-3.5 font-mono text-[0.6875rem] leading-[1.6]">
        {/* dc-rail, not cell-running-rail: inside .deck its glow is off. */}
        <div className="dc-rail absolute inset-x-0 top-0" aria-hidden />
        <div className="deck-label mb-2.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-brand-ink">
            <span className="size-1.5 rounded-full bg-brand-ink pulse-dot" />
            {judge.phase === "loading" ? "Loading runtime" : judge.phase === "judging" ? "Judging" : "Running"}
          </span>
          <span className="normal-case tracking-normal">{LANG_META[judge.lang].file}</span>
        </div>
        <div className="space-y-0.5 text-fg-dim">
          {judge.log.map((ln, i) => (
            <div key={i} className="run-stream-line">
              <span className="text-[var(--deck-quiet)]">{">"} </span>
              <span className={ln.tone ? TONE_CLS[ln.tone] : "text-fg-dim"}>{ln.text}</span>
            </div>
          ))}
          <div className="inline-flex items-center gap-1">
            <span aria-hidden className="text-brand-ink pulse-dot">
              ▌
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Verdict({
  problem,
  report,
  mode,
  next,
  onRunAgain,
}: {
  problem: ClientProblem;
  report: RunReport;
  mode: RunMode;
  next: Neighbour;
  onRunAgain: () => void;
}) {
  const judged = report.total > 0;
  const firstFail = report.cases.find((c) => !c.pass) ?? null;
  const acceptedSubmit = mode === "submit" && report.verdict === "accepted";
  const failedSubmit = mode === "submit" && report.verdict !== "accepted";
  const judgeLabel =
    report.judgedBy === "server" ? (report.recorded ? "server · saved" : "server · not saved") : "this device";
  // Not the judge of record, or not booked: the one place amber flags a pass.
  const judgeWarn = report.judgedBy !== "server" || !report.recorded;
  const hiddenGap = report.cases.some((c) => c.hidden && !c.pass) && report.cases.every((c) => c.hidden || c.pass);

  return (
    <div className="cell-result-in space-y-5 px-5 py-4 sm:px-6">
      {/* the mockup's result head: RESULT, then the verdict word large with
          the count beside it */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="deck-label">Result</span>
          <span className="deck-label">
            {mode} · judged by <span className={judgeWarn ? "text-amber" : undefined}>{judgeLabel}</span>
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className={`dc-verdict text-[2rem] font-bold leading-none tracking-[-0.025em] ${VERDICT_TONE[report.verdict]}`}>
            {VERDICT_LABEL[report.verdict]}
          </h2>
          <span className="text-[0.875rem] text-fg-faint">
            {judged ? `${report.passed}/${report.total} cases · ${report.runtimeMs} ms` : "Nothing judged"}
          </span>
        </div>
        {failedSubmit && (report.verdict === "error" || hiddenGap) && (
          <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-fg-dim">
            {report.verdict === "error"
              ? "Nothing was judged — see the error below"
              : "The hidden set found the gap the visible ones missed"}
          </p>
        )}
      </div>

      {acceptedSubmit && (
        <div className="space-y-4">
          <div>
            <p className="text-[0.8125rem] text-fg-dim">
              {report.beats !== null ? (
                <>
                  Faster than{" "}
                  <span className="t-data text-[0.875rem] text-fg">
                    <DecimatedNumber value={`${report.beats}%`} active />
                  </span>{" "}
                  of accepted submissions
                </>
              ) : (
                "No speed ladder yet — it appears once five submissions are accepted"
              )}
            </p>
            {report.beats !== null && <BeatsBar pct={report.beats} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {next ? (
              <>
                <Link href={`/practice/${next.id}`} className="deck-btn deck-btn-sm">
                  Next problem <span className="deck-arrow">→</span>
                </Link>
                <Link href="/practice" className="deck-btn deck-btn-sm">
                  Back to the set
                </Link>
              </>
            ) : (
              <Link href="/practice" className="deck-btn deck-btn-sm">
                Back to the set <span className="deck-arrow">→</span>
              </Link>
            )}
            <button type="button" onClick={onRunAgain} className="deck-btn deck-btn-sm ml-auto">
              ↻ Run again
            </button>
          </div>
        </div>
      )}

      {report.error && (
        <div className="rounded-[10px] border border-[var(--deck-red-line)] bg-[var(--deck-red-tint)] px-4 py-3 font-mono text-[0.75rem] leading-relaxed text-fg">
          {/* An exception's class name is code: no capitals forced on it. */}
          <span className="mr-2 font-semibold text-bear">{report.error.title}</span>
          <span className="whitespace-pre-wrap break-words">{report.error.detail}</span>
        </div>
      )}

      {report.cases.length > 0 && (
        <ul className="space-y-0.5">
          {report.cases.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-1">
              <CaseMark pass={c.pass} />
              <span className="min-w-0 flex-1 text-[0.875rem] text-fg-dim">
                Case {c.id}
                {c.hidden && <span className={`${HIDDEN_CHIP} ml-2 h-5 px-1.5 text-[0.6875rem]`}>Hidden</span>}
              </span>
              <span className={`t-data shrink-0 text-[0.6875rem] ${c.pass ? "text-fg-faint" : "text-bear"}`}>
                {c.pass ? "ok" : c.error ? "raised" : "mismatch"} · {c.ms} ms
              </span>
            </li>
          ))}
        </ul>
      )}

      {firstFail && <Diff c={firstFail} />}

      {report.stdout && (
        <div>
          <div className="deck-label">stdout</div>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-border bg-[var(--deck-sunk)] px-3.5 py-2.5 font-mono text-[0.6875rem] leading-relaxed text-fg-dim">
            {report.stdout}
          </pre>
        </div>
      )}
      {report.stderr && (
        <div>
          <div className="deck-label">stderr</div>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--deck-red-line)] bg-[var(--deck-sunk)] px-3.5 py-2.5 font-mono text-[0.6875rem] leading-relaxed text-bear">
            {report.stderr}
          </pre>
        </div>
      )}

      {/* metric tiles — BotCell.tsx:366, laid out as the mockup's stat row:
          a hairline above, a quiet label over each figure. Every figure is
          measured or aggregated; the ones that do not exist yet read "—" and
          say why in the label. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
        <Tile label="Passed" value={judged ? <DecimatedNumber value={`${report.passed}/${report.total}`} active /> : "—"} />
        <Tile label="Runtime · your browser" value={judged ? <DecimatedNumber value={`${report.runtimeMs} ms`} active /> : "—"} />
        <Tile
          label={report.beats !== null ? "Faster than" : "Faster than · needs 5 accepted"}
          value={report.beats !== null ? <DecimatedNumber value={`${report.beats}%`} active /> : "—"}
        />
        <Tile label="Judge" value={<span className={`text-[0.8125rem] ${judgeWarn ? "text-amber" : ""}`}>{judgeLabel}</span>} />
      </div>

      {!acceptedSubmit && (
        <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] text-fg-faint">
          <button type="button" onClick={onRunAgain} className="deck-btn deck-btn-sm">
            ↻ Run again
          </button>
          {mode === "run" && report.verdict === "accepted" && (
            <span className="flex flex-wrap items-center gap-1.5">
              All visible cases pass · <Kbd>⌘⇧↵</Kbd> to submit against the {problem.hiddenCount} hidden ones
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** The mockup's check circle: a tinted disc, the mark in the verdict colour.
    #0b2f1e is sampled from the deck; paper has no twin for it, so the light
    theme takes the deck's green tint. */
function CaseMark({ pass }: { pass: boolean }) {
  return (
    <span
      role="img"
      aria-label={pass ? "passed" : "failed"}
      className={`grid size-5 shrink-0 place-items-center rounded-full ${
        pass ? "bg-[#0b2f1e] text-bull [[data-theme=light]_&]:bg-[var(--deck-green-tint)]" : "bg-[var(--deck-red-tint)] text-bear"
      }`}
    >
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {pass ? <path d="M2.2 5.3l1.9 1.9 3.8-4.1" /> : <path d="M2.9 2.9l4.2 4.2M7.1 2.9L2.9 7.1" />}
      </svg>
    </span>
  );
}

/** expected vs got, in the two-sided block of app/learn/broken-vwap. A hidden
    case shows only what the solver's code printed — its expectation never
    left the server. */
function Diff({ c }: { c: CaseResult }) {
  return (
    <div className="rounded-[10px] border border-[var(--deck-red-line)] bg-[var(--deck-sunk)] px-4 py-3 font-mono text-[0.75rem] leading-relaxed">
      <div className="text-[0.6875rem] text-fg-faint">
        Case {c.id}
        {c.hidden ? " · hidden" : ""} · first failure
      </div>
      {c.expected !== undefined ? (
        <div className="mt-1.5 whitespace-pre-wrap break-words text-bull">
          {"− expected  "}
          {c.expected}
        </div>
      ) : (
        <div className="mt-1.5 whitespace-pre-wrap break-words text-fg-faint">{"− expected  (hidden — stays on the server)"}</div>
      )}
      <div className="whitespace-pre-wrap break-words text-bear">
        {"+ got       "}
        {c.got}
      </div>
      {c.error && <div className="mt-1 whitespace-pre-wrap break-words text-fg-dim">{c.error}</div>}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.75rem] text-fg-faint">{label}</div>
      <div className="mt-1.5 t-data text-[1.0625rem] text-fg">{value}</div>
    </div>
  );
}

/** Widens from 0 to `pct` on the frame after mount. A transition on width,
    not a keyframe; dropped entirely under reduced motion. */
function BeatsBar({ pct }: { pct: number }) {
  const [width, setWidth] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const r = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setReduce(r);
    if (r) {
      setWidth(pct);
      return;
    }
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`faster than ${pct}% of accepted submissions`}
      className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--deck-raised)]"
    >
      <div
        className={`h-full rounded-full bg-bull ${reduce ? "" : "transition-[width] duration-700 [transition-timing-function:var(--ease-settle)]"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

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
 * the verdict headline + glow (RunRitual.tsx:333-342, 73-81), the streaming
 * block (components/quant/RunStream.tsx:60-100), the metric tiles
 * (components/quant/BotCell.tsx:366-383), the footer buttons
 * (components/quant/ImportBotModal.tsx:179-191).
 */

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { CaseResult, ClientProblem, LogTone, RunMode, RunReport } from "@/lib/practice/types";
import { LANG_META } from "@/lib/practice/types";
import type { Judge } from "@/lib/practice/use-judge";
import type { PlanNeed } from "@/lib/practice/client";
import { track } from "@/lib/track";
import { DecimatedNumber } from "@/components/quant/DecimatedNumber";
import { Panel } from "./Panel";
import { Kbd, LockPill, VerdictPill } from "./Chips";
import { UnderlineTabs, type TabDef } from "./ProblemTabs";

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
    <Panel
      title={<UnderlineTabs tabs={TABS} value={tab} onChange={onTab} label="Console tabs" />}
      right={<span className="text-fg-faint">{LANG_META.python.runtime}</span>}
      className={className}
      bodyClassName="flex flex-col"
    >
      {tab === "testcases" ? (
        <Testcases problem={problem} judge={judge} />
      ) : (
        <Result problem={problem} judge={judge} next={next} onRunAgain={onRunAgain} />
      )}
    </Panel>
  );
}

/* ── testcases ───────────────────────────────────────────────────────────── */

const PRE_CLS = "mt-1 whitespace-pre-wrap break-words border border-border bg-bg p-2 font-mono text-[0.75rem] leading-relaxed text-fg";

function Testcases({ problem, judge }: { problem: ClientProblem; judge: Judge }) {
  const visible = problem.cases;
  const [activeId, setActiveId] = useState(visible[0]?.id ?? "");
  const active = visible.find((c) => c.id === activeId) ?? visible[0];

  if (!active) {
    return <div className="grid flex-1 place-items-center p-3 t-chrome text-fg-faint">no visible cases</div>;
  }

  const judged = judge.report?.cases.find((x) => x.id === active.id) ?? null;
  const running = judge.locked ? (judge.live.find((x) => x.id === active.id) ?? null) : null;

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((c, i) => {
          const r = judge.report?.cases.find((x) => x.id === c.id) ?? null;
          const on = c.id === active.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              aria-pressed={on}
              className={`inline-flex h-7 items-center gap-1.5 border px-2.5 font-mono text-[0.6875rem] transition-colors ${
                on ? "border-bull bg-bull/5 text-fg" : "border-border bg-bg text-fg-faint hover:text-fg-dim"
              }`}
            >
              {r && (
                <span role="img" aria-label={r.pass ? "passed" : "failed"} className={r.pass ? "text-bull" : "text-bear"}>
                  {r.pass ? "✓" : "✕"}
                </span>
              )}
              Case {i + 1}
            </button>
          );
        })}
        {problem.hiddenCount > 0 && (
          <span className="inline-flex h-7 items-center border border-dashed border-border px-2.5 font-mono text-[0.6875rem] text-fg-faint">
            + {problem.hiddenCount} hidden on submit
          </span>
        )}
      </div>

      <div>
        <div className="t-chrome text-fg-faint">input · keyword arguments to {problem.entry}()</div>
        <pre className={PRE_CLS}>{active.input}</pre>
      </div>

      <div>
        <div className="t-chrome text-fg-faint">expected</div>
        <pre className={PRE_CLS}>{active.expected}</pre>
      </div>

      {(judged || running) && (
        <div>
          <div className="t-chrome text-fg-faint">
            got{judged ? ` · ${judged.pass ? "match" : "mismatch"} · ${judged.ms} ms` : running ? ` · ${running.ms} ms` : ""}
          </div>
          <pre className={`${PRE_CLS} ${judged ? (judged.pass ? "text-bull" : "text-bear") : ""}`}>
            {(judged ?? running)!.error ? `${(judged ?? running)!.got}\n${(judged ?? running)!.error}` : (judged ?? running)!.got}
          </pre>
        </div>
      )}

      <p className="t-chrome text-fg-faint">
        the judge calls {problem.entry}() with exactly these inputs · outputs are compared to 6 decimal places
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

// sideGlow() from RunRitual.tsx, for the two sides the judge can land on.
const BULL_GLOW = "0 0 30px rgba(0,255,135,.45), 0 0 80px rgba(0,255,135,.2)";
const BEAR_GLOW = "0 0 30px rgba(255,46,99,.45), 0 0 80px rgba(255,46,99,.2)";
const HEADLINE = "dc-verdict font-display text-[clamp(2rem,4vw,3rem)] leading-[0.9] tracking-[-0.04em]";

const BTN_PRIMARY =
  "inline-flex h-9 items-center bg-bull px-4 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bull-dim";
const BTN_SECONDARY =
  "inline-flex h-9 items-center border border-border bg-bg px-3 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:text-fg";

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
    return (
      <div className="grid flex-1 place-items-center p-3 t-chrome text-fg-faint">▸ run the tests to see output</div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* the lockdown notice — RunRitual.tsx:313-320; stays up for as long
          as the judge holds the file */}
      {locked && (
        <div className="dc-line relative flex items-stretch border-b border-amber/30 bg-amber/6">
          <span aria-hidden className="dc-hazard w-1.5 shrink-0" />
          <span className="t-chrome px-3 py-1.5 text-amber">
            {phase === "loading"
              ? "editor locked · loading the python runtime"
              : phase === "judging"
                ? `editor locked · ${mode === "submit" ? "the server is judging" : "judging"}`
                : mode === "submit"
                  ? `editor locked · running ${problem.cases.length + problem.hiddenCount} cases`
                  : "editor locked · running the visible cases"}
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
    <div className="p-3">
      <div className="border border-dashed border-border bg-bg p-6 text-center">
        <LockPill lock={need === "power" ? "power" : "pro"} />
        <div className="mt-3 font-display text-lg tracking-tightest text-fg">Submitting this one ships with {label}.</div>
        <p className="mx-auto mt-1 max-w-[38ch] t-chrome text-fg-faint">
          running the visible cases is free for everyone — the hidden set and the verdict are on the plan
        </p>
        <Link href={`/pricing#${need}`} className={`mt-4 ${BTN_SECONDARY} hover:border-bull hover:text-bull`}>
          see the plans →
        </Link>
      </div>
    </div>
  );
}

/** The RunStream console block. Lines mount as the judge appends them, so
    each one types in with `run-stream-line` the moment it lands. */
function Stream({ judge }: { judge: Judge }) {
  return (
    <div className="p-3">
      <div className="relative overflow-hidden border border-border-soft bg-bg p-3 font-mono text-[0.6875rem] leading-[1.55]">
        <div className="cell-running-rail" aria-hidden />
        <div className="mb-2 flex items-center justify-between t-eyebrow text-fg-faint">
          <span className="flex items-center gap-2 text-bull">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            {judge.phase === "loading" ? "loading runtime" : judge.phase === "judging" ? "judging" : "running"}
          </span>
          <span>{LANG_META[judge.lang].file}</span>
        </div>
        <div className="space-y-0.5 text-fg-dim">
          {judge.log.map((ln, i) => (
            <div key={i} className="run-stream-line">
              <span className="text-fg-faint">{">"} </span>
              <span className={ln.tone ? TONE_CLS[ln.tone] : "text-fg-dim"}>{ln.text}</span>
            </div>
          ))}
          <div className="inline-flex items-center gap-1">
            <span aria-hidden className="text-bull pulse-dot">
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

  return (
    <div className="cell-result-in space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <VerdictPill verdict={report.verdict} />
        <span className="t-chrome text-fg-faint">
          {judged ? `${report.passed}/${report.total} cases` : "nothing judged"} · {mode} · judged by {judgeLabel}
        </span>
      </div>

      {acceptedSubmit && (
        <div className="border border-bull/30 bg-bull/5 p-4">
          <h2 className={HEADLINE} style={{ color: "var(--bull)", textShadow: BULL_GLOW }}>
            Accepted.
          </h2>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 t-chrome text-fg-dim">
            {report.beats !== null ? (
              <span>
                faster than{" "}
                <span className="t-data text-[0.8125rem] text-fg">
                  <DecimatedNumber value={`${report.beats}%`} active />
                </span>{" "}
                of accepted submissions
              </span>
            ) : (
              <span>no speed ladder yet — it appears once five submissions are accepted</span>
            )}
            <span className="text-fg-faint">
              {report.passed}/{report.total} cases · {report.runtimeMs} ms
            </span>
          </div>
          {report.beats !== null && <BeatsBar pct={report.beats} />}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {next ? (
              <>
                <Link href={`/practice/${next.id}`} className={BTN_PRIMARY}>
                  next problem →
                </Link>
                <Link href="/practice" className={BTN_SECONDARY}>
                  back to the set
                </Link>
              </>
            ) : (
              <Link href="/practice" className={BTN_PRIMARY}>
                back to the set →
              </Link>
            )}
            <button type="button" onClick={onRunAgain} className="ml-auto t-chrome text-fg-faint transition-colors hover:text-fg">
              ↻ run again
            </button>
          </div>
        </div>
      )}

      {failedSubmit && (
        <div className="border border-bear/30 bg-bear/5 p-4">
          <h2 className={HEADLINE} style={{ color: "var(--bear)", textShadow: BEAR_GLOW }}>
            {report.verdict === "error" ? "Did not run." : "Wrong answer."}
          </h2>
          <p className="mt-2 t-chrome text-fg-dim">
            {report.verdict === "error"
              ? "nothing was judged — see the error below"
              : report.cases.some((c) => c.hidden && !c.pass) && report.cases.every((c) => c.hidden || c.pass)
                ? `${report.passed}/${report.total} cases · the hidden set found the gap the visible ones missed`
                : `${report.passed}/${report.total} cases`}
          </p>
        </div>
      )}

      {report.error && (
        <div className="border-l-2 border-bear bg-bear/5 px-3 py-2 font-mono text-[0.75rem] leading-relaxed text-fg">
          <span className="mr-2 t-chrome text-bear">{report.error.title}</span>
          <span className="whitespace-pre-wrap break-words">{report.error.detail}</span>
        </div>
      )}

      {report.cases.length > 0 && (
        <ul>
          {report.cases.map((c) => (
            <li key={c.id} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-2 border-b border-border-soft py-2">
              <span role="img" aria-label={c.pass ? "passed" : "failed"} className={`font-mono ${c.pass ? "text-bull" : "text-bear"}`}>
                {c.pass ? "✓" : "✕"}
              </span>
              <span className="font-mono text-[0.75rem] text-fg">
                case {c.id}
                {c.hidden && <span className="ml-2 border border-border px-1 py-px t-chrome text-fg-faint">hidden</span>}
              </span>
              <span className={`t-data text-[0.6875rem] ${c.pass ? "text-fg-faint" : "text-bear"}`}>
                {c.pass ? "ok" : c.error ? "raised" : "mismatch"} · {c.ms} ms
              </span>
            </li>
          ))}
        </ul>
      )}

      {firstFail && <Diff c={firstFail} />}

      {report.stdout && (
        <div>
          <div className="t-chrome text-fg-faint">stdout</div>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words border border-border bg-bg p-2 font-mono text-[0.6875rem] leading-relaxed text-fg-dim">
            {report.stdout}
          </pre>
        </div>
      )}
      {report.stderr && (
        <div>
          <div className="t-chrome text-fg-faint">stderr</div>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words border border-bear/30 bg-bg p-2 font-mono text-[0.6875rem] leading-relaxed text-bear">
            {report.stderr}
          </pre>
        </div>
      )}

      {/* metric tiles — BotCell.tsx:366. Every figure is measured or aggregated;
          the ones that do not exist yet read "—" and say why in the label. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4">
        <Tile label="passed" value={judged ? <DecimatedNumber value={`${report.passed}/${report.total}`} active /> : "—"} />
        <Tile label="runtime · your browser" value={judged ? <DecimatedNumber value={`${report.runtimeMs} ms`} active /> : "—"} />
        <Tile
          label={report.beats !== null ? "faster than" : "faster than · needs 5 accepted"}
          value={report.beats !== null ? <DecimatedNumber value={`${report.beats}%`} active /> : "—"}
        />
        <Tile label="judge" value={<span className="text-[0.8125rem]">{judgeLabel}</span>} />
      </div>

      {!acceptedSubmit && (
        <div className="flex flex-wrap items-center gap-3 t-chrome text-fg-faint">
          <button type="button" onClick={onRunAgain} className="transition-colors hover:text-fg">
            ↻ run again
          </button>
          {mode === "run" && report.verdict === "accepted" && (
            <span className="flex items-center gap-1.5">
              all visible cases pass · <Kbd>⌘⇧↵</Kbd> to submit against the {problem.hiddenCount} hidden ones
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** expected vs got, in the two-sided block of app/learn/broken-vwap. A hidden
    case shows only what the solver's code printed — its expectation never
    left the server. */
function Diff({ c }: { c: CaseResult }) {
  return (
    <div className="border-l-2 border-bear bg-bear/5 px-3 py-2 font-mono text-[0.75rem] leading-relaxed">
      <div className="t-chrome text-fg-faint">
        case {c.id}
        {c.hidden ? " · hidden" : ""} · first failure
      </div>
      {c.expected !== undefined ? (
        <div className="mt-1 whitespace-pre-wrap break-words text-bull">
          {"− expected  "}
          {c.expected}
        </div>
      ) : (
        <div className="mt-1 whitespace-pre-wrap break-words text-fg-faint">{"− expected  (hidden — stays on the server)"}</div>
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
    <div className="bg-bg p-2.5">
      <div className="t-chrome text-fg-faint">{label}</div>
      <div className="mt-1 t-data text-base text-fg">{value}</div>
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
      className="mt-2 h-1 bg-border-soft"
    >
      <div
        className={`h-full bg-bull ${reduce ? "" : "transition-[width] duration-700 [transition-timing-function:var(--ease-settle)]"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

"use client";

/**
 * The problem workspace — statement left, editor + console right, a problem
 * bar above and a status strip below. Owns everything that moves: the
 * language, one draft per language (seeded from the stubs), the console tab,
 * the judge (lib/practice/use-judge.ts — real Python in a worker, graded on
 * the server), the keyboard (⌘/Ctrl+↵ run, ⌘/Ctrl+⇧+↵ submit — bound on this
 * root, so they never fight ⌘K), the Command Deck entries, and progress:
 * markAttempt on every run, and recordVerdict the moment a verdict lands
 * (that helper marks the problem solved on an accepted submit — the list's
 * ✓, the ring and the heatmap all re-read via the progress event).
 *
 * The problem is a ClientProblem (lib/practice/content forClient): visible
 * cases with their expectations, the hidden cases' COUNT only, the first hint,
 * and flags for what the walls hold. TypeScript keeps its editor but has no
 * judge yet; the buttons say so instead of pretending.
 *
 * Layout is the 12-col shell of components/quant/QuantPage.tsx:664-696 cut to
 * two columns (44 / 56); viewport heights divide by --ui-zoom because
 * html{zoom} does not shrink vh units. Below lg everything stacks and the
 * page scrolls. The page mounts this with key={problem.id} so a client-side
 * hop to the next problem starts from that problem's stubs, not stale state.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ClientProblem, Lang, RunMode, RunReport } from "@/lib/practice/types";
import { LANG_META } from "@/lib/practice/types";
import { TRACK_META } from "@/lib/practice/tracks";
import { markAttempt, recordVerdict, usePracticeProgress } from "@/lib/practice/progress";
import { PYODIDE_VERSION } from "@/lib/practice/runner";
import { useJudge, type Judge } from "@/lib/practice/use-judge";
import { registerCommands, type DeckCommand } from "@/lib/command-deck";
import { track } from "@/lib/track";
import { Chip, type ChipTone } from "@/components/calm/kit";
import { DifficultyPill, Kbd, LockPill, StatusGlyph, TrackChip } from "./Chips";
import { CodeEditor } from "./CodeEditor";
import { ProblemPane } from "./ProblemPane";
import { RunConsole, type ConsoleTab, type Neighbour } from "./RunConsole";

export type { Neighbour };

export const TS_NOTE = "TypeScript judging ships next — Python runs for real today";

/** The status word on the strip. Colour only for a verdict: pass or fail. */
function statusLine(judge: Judge): { word: string; tone: ChipTone } {
  switch (judge.phase) {
    case "loading":
      return { word: "Loading python", tone: "neutral" };
    case "running":
      return { word: "Running", tone: "neutral" };
    case "judging":
      return { word: "Judging", tone: "neutral" };
    case "verdict":
      if (!judge.report) return { word: "Standing by", tone: "neutral" };
      switch (judge.report.verdict) {
        case "accepted":
          return { word: "Accepted", tone: "gain" };
        case "wrong-answer":
          return { word: "Wrong answer", tone: "loss" };
        default:
          return { word: "Did not run", tone: "loss" };
      }
    default:
      return judge.wall ? { word: "Locked", tone: "neutral" } : { word: "Standing by", tone: "neutral" };
  }
}

export function Workspace({ problem, prev, next }: { problem: ClientProblem; prev: Neighbour; next: Neighbour }) {
  const router = useRouter();
  const trackMeta = TRACK_META[problem.track];
  const hasTs = Boolean(problem.stubs.typescript);

  const [lang, setLang] = useState<Lang>("python");
  const [drafts, setDrafts] = useState<Record<Lang, string>>(() => ({
    python: problem.stubs.python,
    typescript: problem.stubs.typescript ?? "",
  }));
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("testcases");
  const judge = useJudge(problem);
  const { statusOf } = usePracticeProgress();
  const code = drafts[lang];
  const judged = LANG_META[lang].judged;

  const setCode = useCallback((v: string) => setDrafts((d) => ({ ...d, [lang]: v })), [lang]);
  const resetCode = useCallback(
    () => setDrafts((d) => ({ ...d, [lang]: problem.stubs[lang] ?? problem.stubs.python })),
    [lang, problem.stubs]
  );
  const switchLang = useCallback(
    (l: Lang) => {
      if (l === "typescript" && !hasTs) return;
      setLang(l);
    },
    [hasTs]
  );
  const toggleLang = useCallback(() => switchLang(lang === "python" ? "typescript" : "python"), [lang, switchLang]);

  const { locked, begin } = judge;
  const doRun = useCallback(
    (mode: RunMode) => {
      if (locked || !judged) return;
      markAttempt(problem.id);
      setConsoleTab("result");
      begin(mode, code, lang);
      track("practice_run", { slug: problem.id, mode, lang });
    },
    [locked, judged, begin, problem.id, code, lang]
  );

  // Book the verdict when it lands — once per report.
  const recorded = useRef<RunReport | null>(null);
  useEffect(() => {
    if (judge.phase !== "verdict" || !judge.report || recorded.current === judge.report) return;
    recorded.current = judge.report;
    recordVerdict(problem.id, judge.lang, judge.report);
    track("practice_verdict", {
      slug: problem.id,
      mode: judge.mode,
      verdict: judge.report.verdict,
      judgedBy: judge.report.judgedBy,
      recorded: judge.report.recorded,
    });
  }, [judge.phase, judge.report, judge.lang, judge.mode, problem.id]);

  // ⌘/Ctrl+↵ run · ⌘/Ctrl+⇧+↵ submit — scoped to this root.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.nativeEvent.isComposing) return;
    e.preventDefault();
    doRun(e.shiftKey ? "submit" : "run");
  };

  // Command Deck. The handlers change every render, so the deck reads them
  // through a ref and the registration only re-runs when a label would.
  const nextId = next?.id;
  const nextTitle = next?.title;
  const latest = useRef({ doRun, resetCode, toggleLang, goNext: () => {} });
  useEffect(() => {
    latest.current = {
      doRun,
      resetCode,
      toggleLang,
      goNext: () => {
        if (nextId) router.push(`/practice/${nextId}`);
      },
    };
  });
  useEffect(() => {
    const cmds: DeckCommand[] = [
      { id: "practice-run", label: "Run the visible cases", group: "practice", hotkey: "⌘↵", run: () => latest.current.doRun("run") },
      { id: "practice-submit", label: "Submit to the judge", group: "practice", hotkey: "⌘⇧↵", run: () => latest.current.doRun("submit") },
      { id: "practice-reset", label: "Reset the editor to the stub", group: "practice", run: () => latest.current.resetCode() },
    ];
    if (hasTs) {
      cmds.push({
        id: "practice-lang",
        label: lang === "python" ? "Switch to TypeScript" : "Switch to Python",
        group: "practice",
        run: () => latest.current.toggleLang(),
      });
    }
    if (nextId) {
      cmds.push({ id: "practice-next", label: `Next problem · ${nextTitle}`, group: "navigate", run: () => latest.current.goNext() });
    }
    return registerCommands("practice-workspace", cmds);
  }, [hasTs, lang, nextId, nextTitle]);

  const status = statusLine(judge);
  const num = String(problem.num).padStart(2, "0");

  return (
    <div onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
      {/* ── problem bar ──────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-bg-soft">
        <div className="shell shell-wide flex flex-wrap items-center gap-x-3 gap-y-2 py-2 t-label text-fg-faint">
          {/* breadcrumb — app/learn/bots/[id]/page.tsx:54-62 */}
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
            <Link href="/practice" className="transition-colors hover:text-fg">
              Practice
            </Link>
            <span aria-hidden>/</span>
            <Link href={`/practice/tracks/${problem.track}`} className="transition-colors hover:text-fg">
              {trackMeta.label}
            </Link>
            <span aria-hidden>/</span>
            <span className="min-w-0 truncate text-fg">
              #{num} {problem.title}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <DifficultyPill difficulty={problem.difficulty} />
            <TrackChip track={problem.track} />
            {problem.lock && <LockPill lock={problem.lock} />}
            <StatusGlyph status={statusOf(problem.id)} className="text-[0.75rem]" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {prev ? (
              <Link href={`/practice/${prev.id}`} title={prev.title} className="transition-colors hover:text-fg">
                ← Prev
              </Link>
            ) : (
              <span aria-disabled className="opacity-40">
                ← Prev
              </span>
            )}
            {next ? (
              <Link href={`/practice/${next.id}`} title={next.title} className="transition-colors hover:text-fg">
                Next →
              </Link>
            ) : (
              <span aria-disabled className="opacity-40">
                Next →
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── the desk ─────────────────────────────────────────────────────── */}
      <section
        aria-label="Problem workspace"
        className="shell shell-wide grid min-h-0 flex-1 gap-3 py-3 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]"
      >
        <ProblemPane problem={problem} className="min-h-0 lg:max-h-[calc(100vh/var(--ui-zoom)-10rem)]" />

        <div className="flex min-h-0 flex-col gap-3">
          <CodeEditor
            problem={problem}
            lang={lang}
            code={code}
            onChange={setCode}
            onLang={switchLang}
            onReset={resetCode}
            onRun={() => doRun("run")}
            onSubmit={() => doRun("submit")}
            locked={locked}
            runnable={judged}
            className="min-h-[22rem] flex-[3]"
          />
          <RunConsole
            problem={problem}
            judge={judge}
            tab={consoleTab}
            onTab={setConsoleTab}
            next={next}
            onRunAgain={() => doRun("run")}
            className="min-h-[14rem] flex-[2]"
          />
        </div>
      </section>

      {/* ── status strip — RunRitual.tsx:492-501 ─────────────────────────── */}
      <div className="border-t border-border bg-bg-soft">
        <div className="shell shell-wide flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 t-label text-fg-faint">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span aria-live="polite">
              <Chip tone={status.tone} dot>
                {status.word}
              </Chip>
            </span>
            {judged ? (
              <span>Python 3.13 in your browser · pyodide {PYODIDE_VERSION} · judged on the server to 6 dp</span>
            ) : (
              <span className="text-fg-dim">{TS_NOTE}</span>
            )}
            <span className="flex items-center gap-1.5">
              <Kbd>⌘↵</Kbd> run · <Kbd>⌘⇧↵</Kbd> submit
            </span>
          </div>
          <span>Paper only · educational · not advice</span>
        </div>
      </div>
    </div>
  );
}

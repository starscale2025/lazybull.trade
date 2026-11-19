"use client";

/**
 * The problem workspace — statement left, editor + console right, a problem
 * bar above. Owns everything that moves: the
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
 *
 * Skin: the Playground mockup of the pitch deck (slide 7). The desk is ONE
 * window — a #0d0d0d pane with a hairline frame and the deck's 14px radius —
 * ruled into the statement, the editor and the console, rather than three
 * floating cards. Below sm it runs edge to edge, so the phone keeps every
 * pixel of width for the tabs and the code. The page's one bar (it replaces
 * the site navbar here) is flat ink with one hairline: the wordmark home, the
 * trail, prev and next. There is no status strip below the desk (owner, 2026-11-17):
 * the console already shows what the judge is doing, the editor's footer
 * carries the TypeScript note, and the judge's status word survives as a
 * visually hidden live region for screen readers.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ClientProblem, Lang, RunMode, RunReport } from "@/lib/practice/types";
import { LANG_META } from "@/lib/practice/types";
import { TRACK_META } from "@/lib/practice/tracks";
import { markAttempt, recordVerdict } from "@/lib/practice/progress";
import { useJudge, type Judge } from "@/lib/practice/use-judge";
import { registerCommands, type DeckCommand } from "@/lib/command-deck";
import { track } from "@/lib/track";
import { AuthButtons } from "@/components/AuthButtons";
import { CodeEditor } from "./CodeEditor";
import { ProblemPane } from "./ProblemPane";
import { RunConsole, type ConsoleTab, type Neighbour } from "./RunConsole";

export type { Neighbour };

export const TS_NOTE = "TypeScript judging ships next — Python runs for real today";

/** The judge's status word, announced to screen readers as it changes. */
function statusLine(judge: Judge): { word: string } {
  switch (judge.phase) {
    case "loading":
      return { word: "Loading python" };
    case "running":
      return { word: "Running" };
    case "judging":
      return { word: "Judging" };
    case "verdict":
      if (!judge.report) return { word: "Standing by" };
      switch (judge.report.verdict) {
        case "accepted":
          return { word: "Accepted" };
        case "wrong-answer":
          return { word: "Wrong answer" };
        default:
          return { word: "Did not run" };
      }
    default:
      return judge.wall ? { word: "Locked" } : { word: "Standing by" };
  }
}

/** Prev / next: quiet mono capitals, a raised fill on hover — the navbar's
    links at a smaller cut. */
const STEP_CLS =
  "inline-flex h-8 items-center rounded-full px-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fg-faint";

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
      {/* ── THE ONE BAR (owner, 2026-11-17) ─────────────────────────────────
          This page's only navigation: the wordmark home, the trail (Practice /
          subject / number and title), prev and next, and sign in or the
          account. It replaces the site navbar here, so the desk keeps the rest
          of the screen. On a phone the trail takes a second row under the
          wordmark, the steps (arrows only) and the account. Relative, not
          static, at lg so the account panel stays above the desk. */}
      <header className="deck-navbar sticky top-0 z-50 lg:relative">
        <div className="shell shell-wide flex flex-wrap items-center gap-x-5 gap-y-1 py-2 sm:h-11 sm:flex-nowrap sm:py-0">
          <Link
            href="/"
            aria-label="lazybull, home"
            className="deck-wordmark order-1 flex shrink-0 items-center [view-transition-name:nav-mark]"
          >
            lazybull<span className="text-bull">.</span>
          </Link>
          <span aria-hidden className="order-2 hidden h-5 w-px shrink-0 bg-border sm:block" />

          {/* breadcrumb — app/learn/bots/[id]/page.tsx:54-62 */}
          <nav
            aria-label="Breadcrumb"
            className="order-4 flex w-full min-w-0 items-center gap-2 text-[0.8125rem] text-fg-faint sm:order-3 sm:w-auto sm:flex-1"
          >
            <Link href="/practice" className="shrink-0 transition-colors hover:text-fg">
              Practice
            </Link>
            <span aria-hidden className="text-[var(--deck-quiet)]">
              /
            </span>
            <Link href={`/practice/tracks/${problem.track}`} className="shrink-0 transition-colors hover:text-fg">
              {trackMeta.label}
            </Link>
            <span aria-hidden className="text-[var(--deck-quiet)]">
              /
            </span>
            <span aria-current="page" className="min-w-0 truncate text-fg">
              <span className="t-data text-fg-faint">#{num}</span> {problem.title}
            </span>
          </nav>

          <div className="order-3 ml-auto flex shrink-0 items-center gap-1 sm:order-4">
            {prev ? (
              <Link
                href={`/practice/${prev.id}`}
                title={prev.title}
                aria-label={`Previous problem: ${prev.title}`}
                className={`${STEP_CLS} transition-colors hover:bg-[var(--deck-raised)] hover:text-fg`}
              >
                ←<span className="hidden sm:inline">&nbsp;Prev</span>
              </Link>
            ) : (
              <span aria-disabled className={`${STEP_CLS} opacity-40`}>
                ←<span className="hidden sm:inline">&nbsp;Prev</span>
              </span>
            )}
            {next ? (
              <Link
                href={`/practice/${next.id}`}
                title={next.title}
                aria-label={`Next problem: ${next.title}`}
                className={`${STEP_CLS} transition-colors hover:bg-[var(--deck-raised)] hover:text-fg`}
              >
                <span className="hidden sm:inline">Next&nbsp;</span>→
              </Link>
            ) : (
              <span aria-disabled className={`${STEP_CLS} opacity-40`}>
                <span className="hidden sm:inline">Next&nbsp;</span>→
              </span>
            )}
            <span aria-hidden className="mx-1.5 h-5 w-px bg-border sm:mx-2" />
            <AuthButtons always />
          </div>
        </div>
      </header>

      {/* ── the desk: one window, ruled into three ──────────────────────── */}
      {/* Its frame is the neon one (owner, 2026-11-17): a green gradient that
          travels round the edge, and its glow outside it (.deck-neon in
          globals.css). The 1px border stays, transparent, as the line's room. */}
      <div className="shell shell-wide flex min-h-0 flex-1 flex-col max-sm:px-0 sm:py-3">
        <section
          aria-label="Problem workspace"
          className="deck-neon grid min-h-0 flex-1 bg-[var(--deck-pane)] sm:rounded-[14px] sm:border sm:border-transparent lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]"
        >
          <i aria-hidden className="deck-neon-bloom" />
          <ProblemPane problem={problem} className="min-h-0 lg:max-h-[calc(100vh/var(--ui-zoom)-4.75rem)]" />

          {/* The rule between the panes lives here, on the column that always
              spans the full row, so it never stops short of the frame. */}
          <div className="flex min-h-0 flex-col border-t border-border lg:border-l lg:border-t-0">
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
              className="min-h-[22rem] flex-[3] lg:rounded-tr-[13px]"
            />
            <RunConsole
              problem={problem}
              judge={judge}
              tab={consoleTab}
              onTab={setConsoleTab}
              next={next}
              onRunAgain={() => doRun("run")}
              className="min-h-[14rem] flex-[2] border-t border-border"
            />
          </div>
        </section>
      </div>

      {/* The judge's status, for screen readers only: the strip that showed it
          is gone, and the console paints the same states on screen. */}
      <span aria-live="polite" className="sr-only">
        {status.word}
      </span>
    </div>
  );
}

"use client";

// The three tab bodies of the problem pane — Description, Editorial,
// Submissions — plus the underline tab strip the pane and the run console
// share. Class strings are lifted, not invented: the tabs are the
// Market | Limit | Stop strip in components/pro/OrderPanel.tsx (lines 189-201),
// the teacher callout is components/quant/BotCell.tsx (line 450), the related
// cards are app/learn/bots/[id]/page.tsx (lines 386-406).
//
// What is real here, and where it comes from. Acceptance is accepted ÷
// submitted over real submissions (/api/practice/stats) and reads "—" until a
// problem has enough of them. The first hint ships with the page; the hints
// past it and the editorial are served by app/api/practice/[slug]/editorial,
// which answers 402 for a viewer without practicePro — opening a locked one
// emits hit_paywall and links to /pricing#plus; there is no checkout here.
// Submissions are the solver's own rows: this device's ledger, or the
// server's once signed in (lib/practice/progress.ts).

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ClientProblem, Verdict } from "@/lib/practice/types";
import { LANG_META } from "@/lib/practice/types";
import { fetchEditorial, useAcceptance, type PlanNeed } from "@/lib/practice/client";
import { usePracticeProgress } from "@/lib/practice/progress";
import { track } from "@/lib/track";
import { DifficultyPill, Eyebrow, LockPill, TrackChip, VERDICT_LABEL } from "./Chips";
import { Paragraphs, RichText } from "./RichText";
import { Empty, Td, Th, Tr } from "./Table";

/* ── underline tabs ──────────────────────────────────────────────────────── */

export type TabDef<T extends string> = { id: T; label: ReactNode };

/** Underline tabs for a Panel title row. Phrasing content only (a span and
    buttons) because Panel renders its title inside a <span>. */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <span role="group" aria-label={label} className="inline-flex flex-wrap gap-x-3 gap-y-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-pressed={value === t.id}
          className={`border-b-2 pb-1 font-mono text-[0.6875rem] tracking-normal transition-colors ${
            value === t.id ? "border-bull text-fg" : "border-transparent text-fg-faint hover:text-fg-dim"
          }`}
        >
          {t.label}
        </button>
      ))}
    </span>
  );
}

/* ── the teacher (editorial + later hints), behind the wall ─────────────── */

type Teacher =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "open"; editorial: string[] | null; hints: string[] }
  | { status: "locked"; need: PlanNeed }
  | { status: "error"; error: string };

/** One fetch per slug per page load, shared by the hints and the editorial
    tab, so switching tabs never re-asks and never re-counts a paywall hit. */
const teacherCache = new Map<string, Teacher>();
const teacherInflight = new Map<string, Promise<Teacher>>();

function loadTeacher(slug: string): Promise<Teacher> {
  const cached = teacherCache.get(slug);
  if (cached && (cached.status === "open" || cached.status === "locked")) return Promise.resolve(cached);
  const inflight = teacherInflight.get(slug);
  if (inflight) return inflight;
  const p = fetchEditorial(slug)
    .then((r): Teacher => {
      if (r.ok) return { status: "open", editorial: r.editorial, hints: r.hints };
      if (r.need) return { status: "locked", need: r.need };
      return { status: "error", error: r.error };
    })
    .then((t) => {
      teacherCache.set(slug, t);
      return t;
    })
    .finally(() => teacherInflight.delete(slug));
  teacherInflight.set(slug, p);
  return p;
}

function useTeacher(slug: string, surface: "practice_editorial" | "practice_hints") {
  const [teacher, setTeacher] = useState<Teacher>(() => teacherCache.get(slug) ?? { status: "idle" });
  const open = useCallback(() => {
    setTeacher((t) => (t.status === "idle" || t.status === "error" ? { status: "loading" } : t));
    loadTeacher(slug).then((t) => {
      setTeacher(t);
      if (t.status === "locked") track("hit_paywall", { surface, slug, need: t.need });
    });
  }, [slug, surface]);
  return { teacher, open };
}

function LockPanel({ need, what }: { need: PlanNeed; what: string }) {
  return (
    <div className="border border-dashed border-border bg-bg p-6 text-center">
      <LockPill lock={need === "power" ? "power" : "pro"} />
      <div className="mt-3 font-display text-lg tracking-tightest text-fg">{what} ships with {need === "power" ? "Power" : "Plus"}.</div>
      <p className="mx-auto mt-1 max-w-[38ch] t-chrome text-fg-faint">
        the reference solution, the complexity, and the three ways people get it wrong
      </p>
      <Link
        href={`/pricing#${need}`}
        className="mt-4 inline-flex surface-card border border-border bg-surface px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull hover:text-bull"
      >
        see the plans →
      </Link>
    </div>
  );
}

/* ── description ─────────────────────────────────────────────────────────── */

const PRE_CLS = "whitespace-pre-wrap font-mono text-[0.75rem] leading-relaxed text-fg";
const CARD_CLS =
  "surface-card border border-border bg-surface p-3 transition-colors hover:border-bull/50 hover:bg-bull/[0.03]";

export function DescriptionTab({ problem }: { problem: ClientProblem }) {
  const [revealed, setRevealed] = useState(0);
  const { rateFor, countFor, loaded, minSubmissions } = useAcceptance();
  const { teacher, open } = useTeacher(problem.id, "practice_hints");
  const rate = rateFor(problem.id);
  const learnHref =
    problem.related?.learn ?? (problem.related?.bot ? `/learn/bots/${problem.related.bot}` : null);
  const botHref = problem.related?.bot ? `/quant?add=${problem.related.bot}` : null;

  // The hints on screen: the free first one, then whatever the wall opened.
  const hints: string[] = teacher.status === "open" ? teacher.hints : problem.firstHint ? [problem.firstHint] : [];
  const shown = hints.slice(0, revealed);
  const moreBehindWall = problem.hintCount > 1 && teacher.status !== "open";
  const canRevealNext = revealed < hints.length;

  const revealNext = () => {
    if (canRevealNext) {
      setRevealed((r) => r + 1);
      return;
    }
    if (moreBehindWall) open();
  };

  // Once the wall opens, the next press reveals the next hint.
  useEffect(() => {
    if (teacher.status === "open" && revealed < Math.min(2, teacher.hints.length)) setRevealed(Math.min(2, teacher.hints.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher.status]);

  return (
    <div className="space-y-6 p-4">
      <header>
        <div className="t-chrome text-fg-faint">#{String(problem.num).padStart(2, "0")}</div>
        <h1 className="mt-1 font-display text-2xl tracking-tightest text-fg">{problem.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DifficultyPill difficulty={problem.difficulty} />
          <TrackChip track={problem.track} showGlyph />
          <span
            className="t-chrome text-fg-faint"
            title={
              rate === null
                ? loaded
                  ? `${countFor(problem.id)} submitted · a rate shows after ${minSubmissions}`
                  : "loading"
                : `${countFor(problem.id)} submitted · accepted ÷ submitted`
            }
          >
            acceptance {rate === null ? "—" : `${(rate * 100).toFixed(1)}%`}
          </span>
          <span className="t-chrome text-fg-faint">~{problem.minutes} min</span>
        </div>
      </header>

      <Paragraphs paragraphs={problem.statement} className="t-body-sm text-fg-dim" />

      {problem.examples.length > 0 && (
        <div className="space-y-3">
          {problem.examples.map((ex, i) => (
            <div key={i} className="border border-border bg-bg">
              <div className="border-b border-border bg-bg-soft px-3 py-2 t-chrome text-fg-dim">example {i + 1}</div>
              <div className="grid gap-x-3 gap-y-2 p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                <div className="t-chrome text-fg-faint sm:pt-0.5">input</div>
                <pre className={PRE_CLS}>{ex.input}</pre>
                <div className="t-chrome text-fg-faint sm:pt-0.5">output</div>
                <pre className={PRE_CLS}>{ex.output}</pre>
                {ex.note && (
                  <>
                    <div className="t-chrome text-fg-faint sm:pt-0.5">note</div>
                    <p className="text-[0.75rem] leading-relaxed text-fg-dim">
                      <RichText text={ex.note} />
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {problem.constraints.length > 0 && (
        <section>
          <div className="t-chrome text-fg-faint">constraints</div>
          <ul className="mt-2 space-y-1.5 font-mono text-[0.75rem] leading-relaxed text-fg-dim">
            {problem.constraints.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-bull">
                  ›
                </span>
                <span className="min-w-0">
                  <RichText text={c} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {problem.hintCount > 0 && (
        <section>
          <Eyebrow tone="amber">
            teacher · {problem.hintCount} hint{problem.hintCount === 1 ? "" : "s"}
            {problem.hintCount > 1 ? " · the first is free" : ""}
          </Eyebrow>
          <div className="mt-3 space-y-2">
            {shown.map((h, i) => (
              <div key={i} className="border-l-2 border-bull bg-bull/5 px-3 py-2 text-[0.75rem] leading-relaxed text-fg">
                <span className="mr-2 t-chrome text-bull">teacher</span>
                <RichText text={h} />
              </div>
            ))}
            {teacher.status === "locked" && revealed >= 1 && <LockPanel need={teacher.need} what={`Hints ${revealed + 1}–${problem.hintCount}`} />}
            {teacher.status === "error" && <p className="t-chrome text-bear">{teacher.error}</p>}
            {(canRevealNext || (moreBehindWall && teacher.status !== "locked")) && revealed < problem.hintCount && (
              <button
                type="button"
                onClick={revealNext}
                disabled={teacher.status === "loading"}
                className="h-8 border border-border bg-bg px-3 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-amber hover:text-fg disabled:opacity-50"
              >
                {teacher.status === "loading" ? "…" : `▸ reveal hint ${revealed + 1}${!canRevealNext && moreBehindWall ? " · plus" : ""}`}
              </button>
            )}
          </div>
        </section>
      )}

      {(learnHref || botHref) && (
        <section className="grid gap-2 sm:grid-cols-2">
          {learnHref && (
            <Link href={learnHref} className={CARD_CLS}>
              <div className="t-chrome text-bull">↗ read the theory</div>
              <div className="mt-1 text-[0.75rem] text-fg-dim">the chapter this problem is cut from</div>
            </Link>
          )}
          {botHref && (
            <Link href={botHref} className={CARD_CLS}>
              <div className="t-chrome text-cyan">▶ open in the workbench</div>
              <div className="mt-1 text-[0.75rem] text-fg-dim">run the same math on a real tape</div>
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

/* ── editorial ───────────────────────────────────────────────────────────── */

export function EditorialTab({ problem }: { problem: ClientProblem }) {
  const { teacher, open } = useTeacher(problem.id, "practice_editorial");

  useEffect(() => {
    if (problem.hasEditorial) open();
  }, [problem.hasEditorial, open]);

  if (!problem.hasEditorial) {
    return (
      <div className="p-4">
        <Empty>no editorial for this problem yet — the five featured problems (★) have one; the rest are being written</Empty>
      </div>
    );
  }
  if (teacher.status === "idle" || teacher.status === "loading") {
    return (
      <div className="p-4">
        <Empty>loading…</Empty>
      </div>
    );
  }
  if (teacher.status === "locked") {
    return (
      <div className="p-4">
        <LockPanel need={teacher.need} what="The editorial" />
      </div>
    );
  }
  if (teacher.status === "error") {
    return (
      <div className="p-4">
        <Empty>{teacher.error}</Empty>
      </div>
    );
  }
  if (!teacher.editorial || teacher.editorial.length === 0) {
    return (
      <div className="p-4">
        <Empty>no editorial for this problem yet</Empty>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-4">
      <Eyebrow tone="amber">editorial · the walkthrough</Eyebrow>
      <Paragraphs paragraphs={teacher.editorial} className="t-body-sm text-fg-dim" />
    </div>
  );
}

/* ── submissions ─────────────────────────────────────────────────────────── */

const VERDICT_TONE: Record<Verdict, string> = {
  accepted: "text-bull",
  "wrong-answer": "text-bear",
  error: "text-amber",
};

/** Only ever called after mount — toLocaleString depends on the viewer's
    zone and locale, which the server cannot know. */
function fmtWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SubmissionsTab({ problem }: { problem: ClientProblem }) {
  const { state, mounted, source, signedIn } = usePracticeProgress();
  const rows = useMemo(
    () => state.submissions.filter((s) => s.slug === problem.id).sort((a, b) => b.at - a.at),
    [state.submissions, problem.id]
  );

  const where = source === "server" ? "from the server" : signedIn ? "this device, while the server answers" : "this device · sign in to keep them across devices";

  if (rows.length === 0) {
    return (
      <div className="p-3">
        <Empty>no submissions yet — press ▶ run</Empty>
        <p className="mt-2 text-center t-chrome text-fg-faint">{where}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full t-data text-[0.6875rem]">
        <thead>
          <Tr head>
            <Th left>when</Th>
            <Th left>mode</Th>
            <Th left>lang</Th>
            <Th left>verdict</Th>
            <Th>runtime</Th>
          </Tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <Tr key={`${s.id}-${s.at}`}>
              <Td left strong className="whitespace-nowrap">
                {mounted ? fmtWhen(s.at) : "—"}
              </Td>
              <Td left>{s.mode}</Td>
              <Td left>{LANG_META[s.lang].short}</Td>
              <Td left>
                <span className={VERDICT_TONE[s.verdict]}>{VERDICT_LABEL[s.verdict]}</span>
                {s.total > 0 && (
                  <span className="ml-2 text-fg-faint">
                    {s.passed}/{s.total}
                  </span>
                )}
              </Td>
              <Td strong className="whitespace-nowrap">
                {s.total > 0 ? `${s.runtimeMs} ms` : "—"}
              </Td>
            </Tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 t-chrome text-fg-faint">{where}</p>
    </div>
  );
}

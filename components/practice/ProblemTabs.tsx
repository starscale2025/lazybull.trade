"use client";

// The three tab bodies of the problem pane — Description, Editorial,
// Submissions — plus the tab strip the pane and the run console share. The
// teacher callout is components/quant/BotCell.tsx (line 450), the related
// cards are app/learn/bots/[id]/page.tsx (lines 386-406).
//
// Skin: the Playground mockup (pitch deck, slide 7). The title in Fraunces as
// "NN. Title", the tags as the deck's square-ish chips, the statement in the
// dim body grey with `code` as raised mono chips, examples in sunk wells with
// bold bone Input / Output, and the quiet label-then-value meta. The teacher's
// hints are the info hue (cyan); an error is the amber note.
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
import { DifficultyPill, LockPill, TrackChip, VERDICT_LABEL } from "./Chips";
import { Paragraphs, RichText } from "./RichText";
import { Empty, Td, Th, Tr } from "./Table";

/* ── tab strip ───────────────────────────────────────────────────────────── */

export type TabDef<T extends string> = { id: T; label: ReactNode };

/** The deck's pane tabs (slide 7): words in the reading sans, the active one
    bone over a 2px green underline. The semantics stay what they were — a
    group of toggle buttons on aria-pressed, not a tablist — and .deck-tab
    paints both the bone and the underline off [aria-pressed="true"]
    (globals.css, THE DECK SKIN; the trade workbench's tabs use the same rule).
    Phrasing content only (a span and buttons). The caller's strip carries the
    hairline (`border-b`) and no bottom padding, so the underline lands on it. */
export function PaneTabs<T extends string>({
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
    // gap-x-4 on a phone: all three problem tabs hold one line at 360px.
    <span role="group" aria-label={label} className="flex flex-wrap items-stretch gap-x-4 sm:gap-x-6">
      {tabs.map((t) => (
        <button key={t.id} type="button" aria-pressed={value === t.id} onClick={() => onChange(t.id)} className="deck-tab">
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

/** The plan wall, in a sunk well: the lock chip, one Fraunces line, the
    outlined pill to the plans. Shared look with the console's Wall. */
function LockPanel({ need, what }: { need: PlanNeed; what: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-[var(--deck-sunk)] px-5 py-6 text-center">
      <LockPill lock={need === "power" ? "power" : "pro"} />
      <div className="deck-display mt-3 text-[1.25rem] leading-snug tracking-[-0.015em] text-fg">
        {what} ships with {need === "power" ? "Power" : "Plus"}.
      </div>
      <p className="mx-auto mt-1.5 max-w-[38ch] text-[0.8125rem] leading-relaxed text-fg-faint">
        The reference solution, the complexity, and the three ways people get it wrong
      </p>
      <Link href={`/pricing#${need}`} className="deck-btn deck-btn-sm mt-5">
        See the plans <span className="deck-arrow">→</span>
      </Link>
    </div>
  );
}

/* ── description ─────────────────────────────────────────────────────────── */

/** An example's value: dim mono, wrapping, in the sunk well. */
const PRE_CLS = "min-w-0 whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-relaxed text-fg-dim";
/** The mockup's "Input" / "Output": bold bone mono, on the value's baseline. */
const IO_LABEL = "font-mono text-[0.75rem] font-semibold leading-relaxed text-fg";
/** `block` on purpose: on touch, .tap-floor makes a display-less link
    inline-flex, which would lay the card's two lines side by side. */
const CARD_CLS =
  "block rounded-[12px] border border-border p-4 transition-colors hover:border-[var(--deck-rule-hi)] hover:bg-[var(--deck-raised)]";

export function DescriptionTab({ problem, figure }: { problem: ClientProblem; figure?: React.ReactNode }) {
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
    <div className="space-y-7 px-5 py-6 sm:px-6">
      <header className="deck-rise">
        {/* "142. Pairs signal from cointegrated series" — the mockup's title. */}
        <h1 className="deck-display text-[1.625rem] leading-[1.15] tracking-[-0.02em] text-fg">
          {String(problem.num).padStart(2, "0")}. {problem.title}
        </h1>
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <DifficultyPill difficulty={problem.difficulty} />
            <TrackChip track={problem.track} />
          </div>
          {/* Quiet label, then the value in bone — the mockup's "Costs 5 bps / side". */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-fg-faint">
            <span
              title={
                rate === null
                  ? loaded
                    ? `${countFor(problem.id)} submitted · a rate shows after ${minSubmissions}`
                    : "loading"
                  : `${countFor(problem.id)} submitted · accepted ÷ submitted`
              }
            >
              Acceptance <span className="t-data text-fg">{rate === null ? "—" : `${(rate * 100).toFixed(1)}%`}</span>
            </span>
            <span>
              ~<span className="text-fg">{problem.minutes}</span> min
            </span>
          </div>
        </div>
      </header>

      <div className="deck-rise" style={{ ["--i" as string]: 1 }}>
        <Paragraphs paragraphs={problem.statement} className="text-[0.9375rem] leading-[1.7] text-fg-dim" />
      </div>

      {/* The example, drawn: built on the server from the first example (plan A5, Stage 5). */}
      {figure && (
        <figure className="rounded-2xl border border-border-soft bg-bg p-3">
          {figure}
          <figcaption className="mt-1 t-label text-fg-faint">Example 1, drawn · SIM</figcaption>
        </figure>
      )}

      {problem.examples.length > 0 && (
        <div className="space-y-4">
          {problem.examples.map((ex, i) => (
            <div key={i}>
              <div className="deck-label">Example {i + 1}</div>
              <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 rounded-[12px] border border-border bg-[var(--deck-sunk)] px-4 py-3.5">
                <div className={IO_LABEL}>Input</div>
                <pre className={PRE_CLS}>{ex.input}</pre>
                <div className={IO_LABEL}>Output</div>
                <pre className={PRE_CLS}>{ex.output}</pre>
                {ex.note && (
                  <>
                    <div className={IO_LABEL}>Note</div>
                    <p className="text-[0.8125rem] leading-relaxed text-fg-dim">
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
          <div className="deck-label">Constraints</div>
          <ul className="mt-2.5 space-y-1.5 font-mono text-[0.75rem] leading-relaxed text-fg-dim">
            {problem.constraints.map((c, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className="text-[var(--deck-quiet)]">
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
          <div className="deck-eyebrow">
            Teacher · {problem.hintCount} hint{problem.hintCount === 1 ? "" : "s"}
            {problem.hintCount > 1 ? " · the first is free" : ""}
          </div>
          <div className="mt-3.5 space-y-2.5">
            {shown.map((h, i) => (
              <div
                key={i}
                className="rounded-[10px] border border-[var(--deck-cyan-line)] bg-[var(--deck-cyan-tint)] px-4 py-3 text-[0.8125rem] leading-relaxed text-fg"
              >
                <span className="deck-label mr-2 text-cyan">Teacher</span>
                <RichText text={h} />
              </div>
            ))}
            {teacher.status === "locked" && revealed >= 1 && <LockPanel need={teacher.need} what={`Hints ${revealed + 1}–${problem.hintCount}`} />}
            {teacher.status === "error" && <p className="deck-note px-4 py-2.5 text-[0.8125rem] leading-relaxed">{teacher.error}</p>}
            {(canRevealNext || (moreBehindWall && teacher.status !== "locked")) && revealed < problem.hintCount && (
              <button type="button" onClick={revealNext} disabled={teacher.status === "loading"} className="deck-btn deck-btn-sm">
                {teacher.status === "loading" ? "…" : `▸ Reveal hint ${revealed + 1}${!canRevealNext && moreBehindWall ? " · Plus" : ""}`}
              </button>
            )}
          </div>
        </section>
      )}

      {(learnHref || botHref) && (
        <section className="grid gap-2.5 sm:grid-cols-2">
          {learnHref && (
            <Link href={learnHref} className={CARD_CLS}>
              <div className="text-[0.875rem] font-medium text-brand-ink">↗ Read the theory</div>
              <div className="mt-1 text-[0.8125rem] text-fg-faint">The chapter this problem is cut from</div>
            </Link>
          )}
          {botHref && (
            <Link href={botHref} className={CARD_CLS}>
              <div className="text-[0.875rem] font-medium text-brand-ink">▶ Open in the workbench</div>
              <div className="mt-1 text-[0.8125rem] text-fg-faint">Run the same math on a real tape</div>
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
      <div className="px-5 py-6 sm:px-6">
        <Empty>No editorial for this problem yet — the five featured problems (★) have one; the rest are being written</Empty>
      </div>
    );
  }
  if (teacher.status === "idle" || teacher.status === "loading") {
    return (
      <div className="px-5 py-6 sm:px-6">
        <Empty>Loading…</Empty>
      </div>
    );
  }
  if (teacher.status === "locked") {
    return (
      <div className="px-5 py-6 sm:px-6">
        <LockPanel need={teacher.need} what="The editorial" />
      </div>
    );
  }
  if (teacher.status === "error") {
    return (
      <div className="px-5 py-6 sm:px-6">
        <Empty>{teacher.error}</Empty>
      </div>
    );
  }
  if (!teacher.editorial || teacher.editorial.length === 0) {
    return (
      <div className="px-5 py-6 sm:px-6">
        <Empty>No editorial for this problem yet</Empty>
      </div>
    );
  }
  return (
    <div className="space-y-5 px-5 py-6 sm:px-6">
      <div className="deck-eyebrow">Editorial · the walkthrough</div>
      <Paragraphs paragraphs={teacher.editorial} className="text-[0.9375rem] leading-[1.7] text-fg-dim" />
    </div>
  );
}

/* ── submissions ─────────────────────────────────────────────────────────── */

/** Green a pass, red a wrong answer, amber a file that did not run — the
    deck's VerdictPill colours (./Chips.tsx). */
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

  const where = source === "server" ? "From the server" : signedIn ? "This device, while the server answers" : "This device · sign in to keep them across devices";

  if (rows.length === 0) {
    return (
      <div className="px-5 py-6 sm:px-6">
        <Empty>No submissions yet — press ▶ Run</Empty>
        <p className="text-center text-[0.75rem] text-fg-faint">{where}</p>
      </div>
    );
  }

  // px-3 + the cells' px-2 puts the first column on the pane's 20px rule.
  return (
    <div className="overflow-x-auto px-3 py-5 sm:px-4">
      <table className="deck-table w-full t-data text-[0.6875rem]">
        <thead>
          <Tr head>
            <Th left>When</Th>
            <Th left>Mode</Th>
            <Th left>Lang</Th>
            <Th left>Verdict</Th>
            <Th>Runtime</Th>
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
      <p className="mt-3 px-2 text-[0.75rem] text-fg-faint">{where}</p>
    </div>
  );
}

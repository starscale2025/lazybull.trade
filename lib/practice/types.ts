// Types for /practice — the problem set. Pure data, no React.
//
// THREE SHAPES, ON PURPOSE. `ProblemMeta` is the light row the client-side
// list board filters: title, track, difficulty, tags — no prose, no code.
// `ProblemContent` is the heavy half — statement, stubs, testcases, the
// editorial — that only the server loads (app/practice/[slug]/page.tsx and
// app/api/practice/**). `ClientProblem` is what the server page hands the
// workspace: the content MINUS everything a solver must not see — hidden
// case inputs and outputs, the editorial, the hints past the first. Keep the
// heavy modules separate from the row metadata: if the 48 statements and
// Python stubs lived beside the rows, every visitor to /practice would
// download all of them inside the list chunk. Tree-shaking cannot drop the
// contents of an array.

export type TrackId = "finance" | "quant" | "ml" | "maths" | "trading";
export type Difficulty = "easy" | "medium" | "hard";
export type Lang = "python" | "typescript";
/** "pro" locks submitting (and the editorial) behind a plan with
    `practicePro`; "power" behind `practicePower` (lib/billing/types.ts). Labels
    live in LOCK_META. Running the visible cases is free for everyone. */
export type Lock = "pro" | "power";

export type Example = { input: string; output: string; note?: string };
export type TestCase = {
  id: string;
  /** Keyword arguments, e.g. "S=100.0, K=100.0, T=1.0" — literals only. */
  input: string;
  expected: string;
  /** Hidden cases only run on submit, and never leave the server. */
  hidden?: boolean;
};

/** Light — safe to import from a client component. */
export type ProblemMeta = {
  /** The slug. */
  id: string;
  /** 1-based display number, assigned in track order by the registry. */
  num: number;
  title: string;
  /** One line for the list row and the cards. */
  blurb: string;
  track: TrackId;
  difficulty: Difficulty;
  tags: string[];
  /** Estimated minutes. Track hours are summed from this. */
  minutes: number;
  /** Fully authored: TS stub, editorial, three hints, verified numbers. */
  featured?: boolean;
  lock?: Lock;
  /** bot → /learn/bots/<bot> + /quant?add=<bot>; learn → any in-site path. */
  related?: { bot?: string; learn?: string };
};

/** Heavy — server-only by convention. Imported by app/practice/[slug]/page.tsx,
    the API routes and the tests, never by a "use client" file. */
export type ProblemContent = {
  /** The function the judge calls on every case, e.g. "call_price". Emitted
      by the generator from the spec's `fn`; four problems keep it behind a
      private helper, so it is never derived from the stub at runtime. */
  entry: string;
  /** Paragraphs. `backticks` render as inline code. */
  statement: string[];
  examples: Example[];
  constraints: string[];
  /** Revealed one at a time under "⟢ teacher". The first is free; the rest
      ship with the editorial behind the Pro wall. */
  hints: string[];
  stubs: { python: string; typescript?: string };
  /** 3 visible + 6 hidden. */
  cases: TestCase[];
  /** What the UNTOUCHED stub gets wrong on ▶ run — one visible case. An
      authoring invariant the generator enforces, not something the judge
      reads. */
  failing: { caseId: string; got: string };
  /** What submit-without-editing gets wrong — one hidden case. */
  failingHidden: { caseId: string; got: string };
  /** Pro-locked walkthrough. Featured problems only. */
  editorial?: string[];
};

export type Problem = ProblemMeta & ProblemContent;

/** The workspace's problem: what crosses the RSC boundary. Built by
    `forClient` in lib/practice/content/index.ts. */
export type ClientProblem = ProblemMeta & {
  entry: string;
  statement: string[];
  examples: Example[];
  constraints: string[];
  /** The free hint, or null. */
  firstHint: string | null;
  /** How many hints exist in total, so the tab can say "2 more with Pro". */
  hintCount: number;
  hasEditorial: boolean;
  stubs: { python: string; typescript?: string };
  /** Visible cases only, with their expected outputs. */
  cases: TestCase[];
  hiddenCount: number;
};

export type Track = {
  id: TrackId;
  label: string;
  /** The eyebrow line under the label, lowercase. */
  hint: string;
  /** A CSS variable reference — "var(--bull)" — never a literal colour. */
  color: string;
  glyph: string;
  blurb: string;
};

export const LANG_META: Record<
  Lang,
  { label: string; short: string; file: string; indent: number; runtime: string; judged: boolean }
> = {
  python: { label: "Python", short: "py", file: "solution.py", indent: 4, runtime: "python 3.13 · pyodide", judged: true },
  typescript: { label: "TypeScript", short: "ts", file: "solution.ts", indent: 2, runtime: "typescript · not judged yet", judged: false },
};

/** Pill classes follow the VERDICT_BG shapes in components/quant/BotCell.tsx. */
export const DIFFICULTY_META: Record<Difficulty, { label: string; cls: string; color: string }> = {
  easy: { label: "easy", cls: "border-bull/30 bg-bull/15 text-bull", color: "var(--bull)" },
  medium: { label: "medium", cls: "border-amber/30 bg-amber/15 text-amber", color: "var(--amber)" },
  hard: { label: "hard", cls: "border-bear/30 bg-bear/15 text-bear", color: "var(--bear)" },
};

export const LOCK_META: Record<Lock, { label: string; cls: string }> = {
  pro: { label: "Pro", cls: "border-bull/40 bg-bull/10 text-bull" },
  power: { label: "Power · coming soon", cls: "border-border bg-bg text-fg-faint" },
};

/* ── the judge ───────────────────────────────────────────────────────────── */

/** The header the browser sends its anonymous device id in — the localStorage
    uuid lib/track.ts writes. Read by lib/practice/http.ts, sent by
    lib/practice/client.ts; one constant so the two can never drift. */
export const DEVICE_HEADER = "x-lb-device";
/** The most code a submission may carry (lib/db/practice.ts bounds the body). */
export const MAX_CODE_CHARS = 20_000;

export type RunMode = "run" | "submit";
export type Verdict = "accepted" | "wrong-answer" | "error";
export type LogTone = "ok" | "warn" | "info" | "err";
export type LogLine = { text: string; tone?: LogTone };

/** What the worker hands back per case: the formatted return value (or the
    exception's class name, as the generator records it), wall time, and the
    exception text when there was one. */
export type CaseOutput = { id: string; got: string; ms: number; error?: string };

export type CaseResult = {
  id: string;
  pass: boolean;
  hidden: boolean;
  got: string;
  /** Only present for visible cases — hidden expectations never leave the server. */
  expected?: string;
  ms: number;
  error?: string;
};

export type RunReport = {
  mode: RunMode;
  verdict: Verdict;
  /** run → visible cases only; submit → visible + hidden. */
  cases: CaseResult[];
  passed: number;
  total: number;
  /** Sum of the per-case wall times, measured in the solver's browser. */
  runtimeMs: number;
  /** Share of accepted submissions for this problem that ran slower — computed
      on the server from real submissions, null until there are enough. */
  beats: number | null;
  /** Who produced the verdict. "server" is the judge of record; "device" means
      the outputs were compared locally against the visible cases because the
      server could not be reached — never possible for a submit. */
  judgedBy: "server" | "device";
  /** The server booked the submission. False when the database was down. */
  recorded: boolean;
  error?: { title: string; detail: string };
  stdout?: string;
  stderr?: string;
  log: LogLine[];
};

/* ── the highlighter ─────────────────────────────────────────────────────── */

export type TokenKind = "kw" | "str" | "num" | "cmt" | "fn" | "plain";
export type Token = { text: string; kind: TokenKind };

/* ── progress ────────────────────────────────────────────────────────────── */

export type ProblemStatus = "solved" | "attempted" | "todo";
export type SolvedEntry = { at: number; lang: Lang; runtimeMs: number };
export type Submission = {
  id: string;
  slug: string;
  lang: Lang;
  mode: RunMode;
  verdict: Verdict;
  passed: number;
  total: number;
  runtimeMs: number;
  /** Epoch ms. */
  at: number;
};

/** What localStorage holds under PROGRESS_KEY, and what /api/practice/me
    returns for a signed-in user. */
export type ProgressState = {
  solved: Record<string, SolvedEntry>;
  attempts: Record<string, number>;
  submissions: Submission[];
};

export type ProgressSummary = {
  solvedCount: number;
  attemptedCount: number;
  total: number;
  byDifficulty: Record<Difficulty, { solved: number; total: number }>;
  byTrack: Record<TrackId, { solved: number; total: number; nextSlug: string | null }>;
  streak: { current: number; longest: number };
  /** yyyy-mm-dd, ascending — every day with an accepted submission. */
  activeDays: string[];
};

export type Badge = {
  id: string;
  label: string;
  glyph: string;
  /** Lowercase, one line: what earns it. */
  hint: string;
  earned: boolean;
};

/* ── the weekly set ──────────────────────────────────────────────────────── */

/** Ranked on solves and time only. There is no P&L column by construction. */
export type LeaderboardRow = {
  rank: number;
  /** The signed-in solver's display name; "anonymous" for device-only rows. */
  name: string;
  solved: number;
  total: number;
  /** Ms from the set's start to the last accepted submit. */
  timeMs: number;
};

export type WeeklySet = {
  num: number;
  /** ISO start of the anchor edition; roll forward by whole weeks. */
  anchorIso: string;
  durationMin: number;
  /** Four slugs: easy, medium, medium, hard. */
  problems: string[];
};

/** A past edition with at least one accepted submit in its window. */
export type PastSet = { num: number; startIso: string; solvers: number; total: number };

/* ── certificates ────────────────────────────────────────────────────────── */

export type CertificateRecord = {
  id: string;
  track: TrackId;
  displayName: string;
  /** ISO. */
  mintedAt: string;
};

/** Per-slug acceptance from real submissions (mode "submit" only). */
export type SlugStats = { submissions: number; accepted: number };

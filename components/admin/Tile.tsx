// The cockpit's tile chrome, in one place.
//
// Every panel on /admin used to hand-roll the same header row, and every one
// of them assumed it would always have rows to draw — `Math.max(...rows)` on
// an empty array is -Infinity, which is only survivable when the data is
// seeded and therefore never empty. Now that the numbers come from Mongo,
// empty is the NORMAL early state, so the empty case gets a first-class
// component that says WHY a tile is blank instead of rendering NaN.

import type { ReactNode } from "react";

export function Tile({
  label,
  meta,
  right,
  live = false,
  tone = "bull",
  children,
}: {
  label: string;
  meta?: ReactNode;
  right?: ReactNode;
  live?: boolean;
  tone?: "bull" | "bear" | "amber";
  children: ReactNode;
}) {
  const toneClass = tone === "bear" ? "text-bear" : tone === "amber" ? "text-amber" : "text-bull";
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border-soft bg-bg-soft px-3 py-2 t-chrome text-fg-dim">
        <div className="flex min-w-0 items-center gap-3">
          {live && <span className="size-1.5 shrink-0 rounded-full bg-bull pulse-dot" />}
          <span className={toneClass}>{label}</span>
          {meta != null && (
            <>
              <span className="text-fg-faint">·</span>
              <span className="truncate">{meta}</span>
            </>
          )}
        </div>
        {right != null && <span className="shrink-0 text-fg-faint">{right}</span>}
      </div>
      {children}
    </div>
  );
}

/** A blank tile that explains itself. `reason` is the plain-English sentence
    from lib/admin-data — it names the missing pipe, not just the absence. */
export function Empty({ reason }: { reason: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <p className="max-w-[56ch] text-center font-mono text-[0.6875rem] leading-relaxed text-fg-faint">
        <span className="text-amber">nothing to show · </span>
        {reason}
      </p>
    </div>
  );
}

/** A label/value pair — the cockpit's smallest unit of fact. */
export function Stat({ k, v, tone }: { k: string; v: ReactNode; tone?: "bull" | "bear" | "fg" }) {
  const c = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-fg";
  return (
    <div className="min-w-0">
      <div className="t-chrome truncate text-fg-faint">{k}</div>
      <div className={`mt-1 font-display text-2xl tracking-tightest tabular-nums ${c}`}>{v}</div>
    </div>
  );
}

/** A ranked row with a proportional bar — used by every "top N" tile so the
    breakdowns read as one family instead of five separate charts. */
export function BarRow({
  rank,
  label,
  sub,
  value,
  pct,
  tone = "bull",
}: {
  rank?: number;
  label: string;
  sub?: string;
  value: ReactNode;
  pct: number;
  tone?: "bull" | "bear" | "amber";
}) {
  const bar = tone === "bear" ? "bg-bear" : tone === "amber" ? "bg-amber" : "bg-bull";
  return (
    <div className="grid grid-cols-[24px_1fr_84px] items-center gap-2 px-3 py-1.5 transition-colors hover:bg-surface">
      <span className="t-chrome tabular-nums text-fg-faint">
        {rank != null ? String(rank).padStart(2, "0") : ""}
      </span>
      <div className="min-w-0">
        <div className="truncate font-mono text-[0.75rem] text-fg">{label}</div>
        {sub && <div className="truncate font-mono text-[0.625rem] text-fg-faint">{sub}</div>}
        <div className="mt-1 h-1 w-full overflow-hidden bg-border-soft">
          <div
            className={`h-full ${bar} transition-all duration-700 ease-out`}
            style={{ width: `${Math.max(0, Math.min(100, pct * 100)).toFixed(1)}%` }}
          />
        </div>
      </div>
      <span className="text-right font-mono text-[0.6875rem] tabular-nums text-fg">{value}</span>
    </div>
  );
}

/** Seconds-to-days, for a timestamp the reader is comparing to "now". */
export function rel(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

import type { CohortMetrics } from "@/lib/admin-data";
import { Empty, Tile } from "./Tile";

// The memo's third number and the table behind it: "users active in three
// separate weeks". Eight weekly signup cohorts, retention in weeks 1–4
// measured from each person's OWN signup instant, and the share who came back
// in at least three distinct weeks of their first month.
//
// A cell is blank when the cohort has not lived long enough to answer it —
// week 3 for a cohort that is two weeks old is not zero, it is unknown, and
// printing 0% there is how retention dashboards flatter themselves.

function cell(n: number, of: number, known: boolean) {
  if (!known) return <span className="text-fg-faint">·</span>;
  if (of === 0) return <span className="text-fg-faint">—</span>;
  const pct = (n / of) * 100;
  return (
    <span className={pct >= 30 ? "text-bull" : pct > 0 ? "text-fg" : "text-fg-faint"}>
      {pct.toFixed(0)}%<span className="ml-1 text-[0.5625rem] text-fg-faint">{n}</span>
    </span>
  );
}

export function CohortTable({ data }: { data: CohortMetrics }) {
  const t = data.threeWeekActive;
  const rows = data.rows.filter((r) => r.signups > 0);
  return (
    <Tile
      label="weekly cohorts"
      meta="retention from each signup"
      right={
        t.eligible > 0 ? (
          <span className="tabular-nums">
            <span className="text-bull">{(t.share * 100).toFixed(0)}%</span> active ≥3 weeks
          </span>
        ) : (
          "no mature cohort"
        )
      }
    >
      {rows.length === 0 ? (
        <Empty reason="no signup event in the last 8 weeks, so there is no cohort to follow. Retention is measured from the `signup` event only — accounts created before the tracker shipped cannot be cohorted." />
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[30rem] grid-cols-[92px_58px_repeat(4,1fr)_72px] gap-2 border-b border-border-soft bg-bg-soft px-3 py-1.5 t-chrome text-fg-faint">
            <span>week of</span>
            <span className="text-right">signups</span>
            <span className="text-right">w1</span>
            <span className="text-right">w2</span>
            <span className="text-right">w3</span>
            <span className="text-right">w4</span>
            <span className="text-right">≥3 wks</span>
          </div>
          <div className="divide-y divide-border-soft">
            {rows.map((r) => (
              <div
                key={r.weekStart}
                className="grid min-w-[30rem] grid-cols-[92px_58px_repeat(4,1fr)_72px] items-center gap-2 px-3 py-1.5 font-mono text-[0.6875rem] tabular-nums transition-colors hover:bg-surface"
              >
                <span className="text-fg-dim">{new Date(r.weekStart).toISOString().slice(0, 10)}</span>
                <span className="text-right text-fg">{r.signups}</span>
                {r.retained.map((n, i) => (
                  <span key={i} className="text-right">
                    {cell(n, r.signups, r.weeksElapsed > i + 1)}
                  </span>
                ))}
                <span className="text-right">{cell(r.threeWeekActive, r.signups, r.weeksElapsed >= 5)}</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 font-mono text-[0.625rem] leading-relaxed text-fg-faint">
            {t.eligible > 0
              ? `${t.users} of ${t.eligible} signups older than 28 days were active in ≥3 distinct weeks of their first month.`
              : "no signup in this window is 28 days old yet, so the ≥3-weeks share has nothing mature to measure."}{" "}
            A dot means the cohort has not lived long enough to answer that column.
          </div>
        </div>
      )}
    </Tile>
  );
}

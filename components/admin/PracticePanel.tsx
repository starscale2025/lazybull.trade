import type { PracticeMetrics } from "@/lib/admin-data";
import { BarRow, Empty, Stat, Tile } from "./Tile";

// /practice, straight from the judge's own ledger (`practice_submissions`)
// rather than from the client's practice_run / practice_verdict events — the
// ledger is what the product already prints acceptance rates from, so the
// cockpit cannot disagree with the problem pages about how hard a problem is.

export function PracticePanel({ data }: { data: PracticeMetrics }) {
  const max = data.top.length ? Math.max(...data.top.map((r) => r.submissions)) : 1;
  const rate = data.submits > 0 ? (data.accepted / data.submits) * 100 : 0;
  return (
    <Tile label="practice" meta="last 7d" right={data.submits ? `${rate.toFixed(0)}% accepted` : undefined}>
      {data.runs === 0 && data.submits === 0 ? (
        <Empty reason="no run and no submission has been recorded in the last 7 days." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 border-b border-border-soft px-3 py-3">
            <Stat k="runs" v={data.runs.toLocaleString()} />
            <Stat k="submits" v={data.submits.toLocaleString()} tone={data.submits ? "bull" : "fg"} />
            <Stat k="accepted" v={data.accepted.toLocaleString()} />
            <Stat k="solvers" v={data.users.toLocaleString()} />
          </div>
          <div className="border-b border-border-soft px-3 py-1.5 t-chrome text-fg-faint">top problems by submissions</div>
          {data.top.length === 0 ? (
            <div className="px-3 py-3 font-mono text-[0.625rem] text-fg-faint">runs only — nobody has submitted yet.</div>
          ) : (
            <div className="divide-y divide-border-soft">
              {data.top.map((r, i) => (
                <BarRow
                  key={r.slug}
                  rank={i + 1}
                  label={r.slug}
                  sub={`${r.accepted}/${r.submissions} accepted`}
                  value={r.submissions.toLocaleString()}
                  pct={r.submissions / max}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Tile>
  );
}

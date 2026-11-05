import type { TeacherMetrics } from "@/lib/admin-data";
import { BarRow, Empty, Stat, Tile } from "./Tile";

// The AI teacher, from explain_served and hit_paywall.
//
// Note what this tile does NOT claim. The old KPI strip carried "ai teacher
// tokens · 2.1M / 24h": app/api/explain logs {source, plan} and no usage
// figure at all, so there was never a token count to show. What exists is how
// many explanations were served, which engine served them (`source` — a `mock`
// share is the fallback path, and worth watching), and which plan the asker
// was on when they hit the wall.

function Split({ title, rows, empty }: { title: string; rows: { key: string; n: number }[]; empty: string }) {
  const max = rows.length ? Math.max(...rows.map((r) => r.n)) : 1;
  return (
    <div className="min-w-0 flex-1">
      <div className="border-b border-border-soft px-3 py-1.5 t-chrome text-fg-faint">{title}</div>
      {rows.length === 0 ? (
        <div className="px-3 py-3 font-mono text-[0.625rem] text-fg-faint">{empty}</div>
      ) : (
        <div className="divide-y divide-border-soft">
          {rows.map((r) => (
            <BarRow key={r.key} label={r.key} value={r.n.toLocaleString()} pct={r.n / max} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TeacherPanel({ data }: { data: TeacherMetrics }) {
  const empty = data.served7d === 0 && data.paywall7d === 0;
  return (
    <Tile label="ai teacher" meta="explain_served · hit_paywall · 7d" right={`${data.served7d.toLocaleString()} served`}>
      {empty ? (
        <Empty reason="no explanation was served and no paywall was hit in the last 7 days. Both are server events (app/api/explain), so this is the traffic, not a tracking gap." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 border-b border-border-soft px-3 py-3">
            <Stat k="served · 24h" v={data.served24h.toLocaleString()} tone={data.served24h ? "bull" : "fg"} />
            <Stat k="served · 7d" v={data.served7d.toLocaleString()} />
            <Stat k="paywalled · 7d" v={data.paywall7d.toLocaleString()} tone={data.paywall7d ? "bear" : "fg"} />
          </div>
          <div className="flex flex-col divide-y divide-border-soft md:flex-row md:divide-x md:divide-y-0">
            <Split title="by engine" rows={data.bySource} empty="no explanation served" />
            <Split title="by plan" rows={data.byPlan} empty="no explanation served" />
            <Split title="paywall by surface" rows={data.paywallBySurface} empty="no paywall hit" />
          </div>
        </>
      )}
    </Tile>
  );
}

import type { BotRuns } from "@/lib/admin-data";
import { BarRow, Empty, Stat, Tile } from "./Tile";

// The most convincing lie on the old cockpit lived here: twelve REAL bot names
// ("6-Model Consensus", "Kalman Filter", "Monte Carlo VaR") against run counts
// straight out of the PRNG. It looked like the most specific tile on the page.
//
// The truth is that quant_run_all / setup_applied / preset_applied carry how
// MANY bots ran, never which — so a leaderboard cannot be built at all. The two
// totals below are what the props support; the rest is a note saying what to
// emit to get the leaderboard back.

export function BotRunDistribution({ data }: { data: BotRuns }) {
  const max = data.rows.length ? Math.max(...data.rows.map((r) => r.runs)) : 1;
  return (
    <Tile label="quant bots" meta="runs · 7d" right={`${data.runs.toLocaleString()} runs`}>
      <div className="grid grid-cols-2 gap-4 border-b border-border-soft px-3 py-3">
        <Stat k="workbench runs · 7d" v={data.runs.toLocaleString()} tone={data.runs ? "bull" : "fg"} />
        <Stat k="bot slots engaged" v={data.botsEngaged.toLocaleString()} />
      </div>
      {data.rows.length === 0 ? (
        <Empty reason={data.note ?? "no data"} />
      ) : (
        <div className="flex flex-col divide-y divide-border-soft">
          {data.rows.map((r, i) => (
            <BarRow
              key={r.id}
              rank={i + 1}
              label={r.label}
              value={r.runs.toLocaleString()}
              pct={r.runs / max}
            />
          ))}
        </div>
      )}
    </Tile>
  );
}

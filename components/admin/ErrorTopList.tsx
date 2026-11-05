import type { ErrorData } from "@/lib/admin-data";
import { BarRow, Empty, Tile, rel } from "./Tile";

// This tile listed six error names — yahoo_chart_502, openai_rate_limit,
// mongo_serverSelectionTimeout — each against a route and a count, and every
// one of them was fabricated: nothing in this codebase writes an error
// anywhere a dashboard could read it. The query behind it now looks for real
// `csp_violation` events, finds none (app/api/csp-report console.warns and
// returns 204), and says so.

export function ErrorTopList({ data }: { data: ErrorData }) {
  const max = data.rows.length ? Math.max(...data.rows.map((r) => r.count)) : 1;
  const total = data.rows.reduce((a, b) => a + b.count, 0);
  return (
    <Tile
      label="errors"
      tone="bear"
      meta="last 24h"
      right={data.rows.length ? `${total} total` : "not wired"}
    >
      {data.rows.length === 0 ? (
        <Empty reason={data.note ?? "no data"} />
      ) : (
        <div className="flex flex-col divide-y divide-border-soft">
          {data.rows.map((r, i) => (
            <BarRow
              key={r.name}
              rank={i + 1}
              label={r.name}
              sub={`${r.route} · ${rel(r.lastSeen)} ago`}
              value={r.count.toLocaleString()}
              pct={r.count / max}
              tone="bear"
            />
          ))}
        </div>
      )}
    </Tile>
  );
}

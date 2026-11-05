import type { TradeFeed } from "@/lib/admin-data";
import { Empty, Tile, rel } from "./Tile";

// The real order flow, newest first.
//
// The p/l and "status" columns are gone. The events stream records that an
// order was SUBMITTED and with what parameters; it does not record how the
// position ended, and lib/db/paper.ts stores each account's ledger as an
// opaque client blob the cockpit cannot honestly total. The old table printed
// a signed p/l and a win/loss badge for every row — invented, all of it.

const KIND_BADGE: Record<string, string> = {
  order_submitted: "border-bull/40 bg-bull/5 text-bull",
  bet_placed: "border-cyan/40 bg-cyan/5 text-cyan",
  bet_opened: "border-plasma/40 bg-plasma/5 text-plasma",
};

export function RecentTrades({ data }: { data: TradeFeed }) {
  return (
    <Tile label="paper order flow" meta="newest first · 7d" right={data.rows.length ? `${data.rows.length} rows` : undefined}>
      {data.rows.length === 0 ? (
        <Empty reason={data.note ?? "no data"} />
      ) : (
        <>
          <div className="grid grid-cols-[56px_88px_64px_120px_1fr_52px] gap-2 border-b border-border-soft bg-bg-soft px-3 py-1.5 t-chrome text-fg-faint">
            <span>when</span>
            <span>actor</span>
            <span>sym</span>
            <span>event</span>
            <span>detail</span>
            <span className="text-right">geo</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-border-soft">
              {data.rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[56px_88px_64px_120px_1fr_52px] items-center gap-2 px-3 py-1.5 font-mono text-[0.6875rem] tabular-nums transition-colors hover:bg-surface"
                >
                  <span className="text-fg-faint">{rel(r.t)}</span>
                  <span className="truncate text-fg-dim">{r.who}</span>
                  <span className="text-fg">{r.sym}</span>
                  <span className={`truncate border px-1 py-0 text-center t-chrome ${KIND_BADGE[r.kind] ?? "border-border text-fg-dim"}`}>
                    {r.kind}
                  </span>
                  <span className="truncate text-fg-dim">{r.detail}</span>
                  <span className="text-right text-fg-faint">{r.country ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Tile>
  );
}

import type { GeoData } from "@/lib/admin-data";
import { BarRow, Empty, Tile } from "./Tile";

// Where the actives are, by the ISO-2 country the SERVER stamps on schema-v2
// events (lib/db/events.ts) — never an IP, never a city.
//
// The world map that used to live here is gone, and not only because its
// sixteen city dots were PRNG counts. Its continents were hand-drawn paths in
// an invented 0..1 space that is not a projection: NYC sat at (0.28, 0.36),
// which in equirectangular terms is the Bahamas. Dropping REAL country
// centroids onto that silhouette would put half of them in the sea, so the
// silhouette went and the ranking stayed. A country code and a count are the
// whole of what the data supports.

export function UserGeoMap({ data }: { data: GeoData }) {
  const max = data.rows.length ? Math.max(...data.rows.map((r) => r.users)) : 1;
  return (
    <Tile
      label="geo"
      meta={`distinct actives · ${data.windowDays}d`}
      live={data.rows.length > 0}
      right={data.rows.length ? `${data.rows.length} countries · ${data.total} actives` : undefined}
    >
      {data.rows.length === 0 ? (
        <Empty reason={data.note ?? "no data"} />
      ) : (
        <div className="flex flex-col divide-y divide-border-soft">
          {data.rows.map((r, i) => (
            <BarRow
              key={r.country}
              rank={i + 1}
              label={r.country}
              sub={`${((r.users / data.total) * 100).toFixed(1)}% of located actives`}
              value={r.users.toLocaleString()}
              pct={r.users / max}
            />
          ))}
          <div className="px-3 py-2 font-mono text-[0.625rem] leading-relaxed text-fg-faint">
            counts only events that carry a country — schema-v1 rows and hosts that send no geo header are invisible here, so this is a floor, not a total.
          </div>
        </div>
      )}
    </Tile>
  );
}

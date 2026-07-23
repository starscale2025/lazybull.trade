// Static snapshot of the trained models' outputs (public/quant-snapshot.json).
//
// The zero-hosting path to real Python-NN predictions: hosting a torch server
// costs money, so instead the site ships a daily snapshot of the real model
// output for the popular tickers. When no live FastAPI is configured (prod),
// the AI bots read this instead of the TS surrogate — real numbers, labelled
// "Python NN · snapshot". Regenerate with:
//     python3 "ai quants/export_snapshot.py"   (local service on :8000 running)

type Snapshot = { generated: string; tickers: Record<string, Record<string, unknown>> };

let cache: Promise<Snapshot | null> | null = null;

function load(): Promise<Snapshot | null> {
  if (cache) return cache;
  cache =
    typeof fetch === "undefined"
      ? Promise.resolve(null)
      : fetch("/quant-snapshot.json")
          .then((r) => (r.ok ? (r.json() as Promise<Snapshot>) : null))
          .catch(() => null);
  return cache;
}

/** Baked model output for `ticker` at `endpoint`, or null if not in the snapshot. */
export async function snapshotLookup<T>(
  endpoint: string,
  ticker: string | undefined,
): Promise<{ data: T; generated: string } | null> {
  if (!ticker) return null;
  const snap = await load();
  const hit = snap?.tickers?.[ticker.toUpperCase()]?.[endpoint];
  return hit ? { data: hit as T, generated: snap.generated } : null;
}

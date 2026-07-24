// A tiny in-memory fake of the Upstash/Vercel-KV REST surface, just enough to
// exercise the KV code paths (single-flight lock, atomic per-IP guard) with no
// network. Supports the exact command subset those paths use: SET (with NX/EX),
// GET, DEL, INCR, DECR, EXPIRE. TTLs are governed by a mutable `clock` the test
// controls, so key expiry is deterministic.
//
// Each command body runs synchronously start-to-finish inside its promise, which
// mirrors Redis's atomicity: two concurrent `SET k v NX` calls can never both
// win — the second sees the first's write. That's what makes the lock testable.

export type FakeKv = {
  transport: (cmd: (string | number)[]) => Promise<unknown>;
  store: Map<string, { val: string; exp: number }>;
  calls: string[][];
  clock: { t: number };
};

export function fakeKv(startAt = 0): FakeKv {
  const clock = { t: startAt };
  const store = new Map<string, { val: string; exp: number }>();
  const calls: string[][] = [];

  const alive = (k: string) => {
    const e = store.get(k);
    if (!e) return null;
    if (e.exp <= clock.t) {
      store.delete(k);
      return null;
    }
    return e;
  };

  const transport = async (raw: (string | number)[]): Promise<unknown> => {
    const cmd = raw.map(String);
    calls.push(cmd);
    const [op, key, ...rest] = cmd;
    switch (op.toUpperCase()) {
      case "SET": {
        const val = rest[0];
        const nx = rest.some((x) => x.toUpperCase() === "NX");
        const exIdx = rest.findIndex((x) => x.toUpperCase() === "EX");
        const ttl = exIdx >= 0 ? Number(rest[exIdx + 1]) : 0;
        if (nx && alive(key)) return null; // key held → NX fails
        store.set(key, { val, exp: ttl ? clock.t + ttl * 1000 : Infinity });
        return "OK";
      }
      case "GET": {
        const e = alive(key);
        return e ? e.val : null;
      }
      case "DEL": {
        const had = alive(key);
        store.delete(key);
        return had ? 1 : 0;
      }
      case "INCR": {
        const e = alive(key);
        const n = (e ? Number(e.val) : 0) + 1;
        store.set(key, { val: String(n), exp: e ? e.exp : Infinity });
        return n;
      }
      case "DECR": {
        const e = alive(key);
        const n = (e ? Number(e.val) : 0) - 1;
        store.set(key, { val: String(n), exp: e ? e.exp : Infinity });
        return n;
      }
      case "EXPIRE": {
        const e = alive(key);
        if (!e) return 0;
        e.exp = clock.t + Number(rest[0]) * 1000;
        return 1;
      }
      default:
        throw new Error(`fakeKv: unsupported command ${op}`);
    }
  };

  return { transport, store, calls, clock };
}

import { describe, expect, it } from "vitest";
import {
  decideInitial,
  isFactoryDefault,
  latestActivity,
  resolveFork,
  sanitizeSnapshot,
  type PaperSnapshot,
} from "@/lib/paper-sync-core";
import { PaperPutBody, PaperSnapshotSchema } from "@/lib/db/paper";

const emptySnap = (over: Partial<PaperSnapshot> = {}): PaperSnapshot => ({
  cash: 100_000,
  startingCash: 100_000,
  realizedToday: 0,
  positions: [],
  shares: {},
  orders: [],
  trades: [],
  balanceLog: [],
  journal: {},
  ...over,
});

describe("PaperSnapshotSchema (the wire contract)", () => {
  it("accepts a normal snapshot", () => {
    expect(PaperSnapshotSchema.safeParse(emptySnap()).success).toBe(true);
  });

  it("rejects non-finite money — NaN cash must never reach the collection", () => {
    expect(PaperSnapshotSchema.safeParse(emptySnap({ cash: NaN })).success).toBe(false);
    expect(PaperSnapshotSchema.safeParse(emptySnap({ realizedToday: Infinity })).success).toBe(false);
  });

  it("enforces the client-side caps server-side", () => {
    const fat = emptySnap({ trades: Array.from({ length: 201 }, () => ({})) as PaperSnapshot["trades"] });
    expect(PaperSnapshotSchema.safeParse(fat).success).toBe(false);
  });

  it("bounds journal notes", () => {
    const long = emptySnap({ journal: { t1: "x".repeat(2001) } });
    expect(PaperSnapshotSchema.safeParse(long).success).toBe(false);
  });

  it("PaperPutBody requires a non-negative integer baseRev", () => {
    expect(PaperPutBody.safeParse({ baseRev: -1, state: emptySnap() }).success).toBe(false);
    expect(PaperPutBody.safeParse({ baseRev: 1.5, state: emptySnap() }).success).toBe(false);
    expect(PaperPutBody.safeParse({ baseRev: 3, state: emptySnap() }).success).toBe(true);
  });
});

describe("sanitizeSnapshot (untrusted → store-safe)", () => {
  it("turns garbage into a sane default account", () => {
    const s = sanitizeSnapshot({ cash: "lots", trades: "nope", journal: [1, 2] });
    expect(s.cash).toBe(100_000);
    expect(s.trades).toEqual([]);
    expect(s.journal).toEqual({});
  });

  it("re-sanitizes shares — dust and NaN positions don't survive the download", () => {
    const s = sanitizeSnapshot(
      emptySnap({
        shares: {
          AAPL: { sym: "AAPL", qty: 1e-12, avgPrice: 100, realized: 0, openedAt: 1, lastTs: 1 },
          NVDA: { sym: "NVDA", qty: 10, avgPrice: NaN, realized: 0, openedAt: 1, lastTs: 1 },
          MSFT: { sym: "MSFT", qty: 5, avgPrice: 100, realized: 0, openedAt: 1, lastTs: 1 },
        } as unknown as PaperSnapshot["shares"],
      })
    );
    expect(Object.keys(s.shares)).toEqual(["MSFT"]);
  });
});

describe("isFactoryDefault / latestActivity", () => {
  it("a fresh account is default; any activity is not", () => {
    expect(isFactoryDefault(emptySnap())).toBe(true);
    expect(isFactoryDefault(emptySnap({ cash: 99_000 }))).toBe(false);
    expect(
      isFactoryDefault(emptySnap({ trades: [{ closedAt: 1 }] as unknown as PaperSnapshot["trades"] }))
    ).toBe(false);
  });

  it("latestActivity is the max across ledger, trades and orders", () => {
    const s = emptySnap({
      balanceLog: [{ ts: 100 }] as unknown as PaperSnapshot["balanceLog"],
      trades: [{ closedAt: 500 }] as unknown as PaperSnapshot["trades"],
      orders: [{ placedAt: 300 }] as unknown as PaperSnapshot["orders"],
    });
    expect(latestActivity(s)).toBe(500);
    expect(latestActivity(emptySnap())).toBe(0);
  });
});

describe("decideInitial (first reconcile after sign-in)", () => {
  it("both sides empty → nothing moves", () => {
    expect(decideInitial({ serverRev: 0, serverHasState: false, localDefault: true, lastSyncedRev: 0 })).toEqual({ kind: "none" });
  });

  it("no server copy + local activity → first upload", () => {
    expect(decideInitial({ serverRev: 0, serverHasState: false, localDefault: false, lastSyncedRev: 0 })).toEqual({ kind: "push" });
  });

  it("server copy + factory-default local (new device) → adopt", () => {
    expect(decideInitial({ serverRev: 4, serverHasState: true, localDefault: true, lastSyncedRev: 0 })).toEqual({ kind: "adopt" });
  });

  it("linear history (server rev is what this device last synced) → push", () => {
    expect(decideInitial({ serverRev: 7, serverHasState: true, localDefault: false, lastSyncedRev: 7 })).toEqual({ kind: "push" });
  });

  it("server moved while local also changed → fork", () => {
    expect(decideInitial({ serverRev: 9, serverHasState: true, localDefault: false, lastSyncedRev: 7 })).toEqual({ kind: "fork" });
  });
});

describe("resolveFork", () => {
  it("newer side wins; ties adopt (non-destructive)", () => {
    expect(resolveFork(2000, 1000)).toBe("adopt");
    expect(resolveFork(1000, 2000)).toBe("push");
    expect(resolveFork(1500, 1500)).toBe("adopt");
  });
});

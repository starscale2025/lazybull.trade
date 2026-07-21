// Rev semantics of the paper-account store against a REAL MongoDB
// (mongodb-memory-server) — the optimistic-concurrency contract is what keeps
// two devices from silently clobbering each other's account history.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { getPaper, putPaper } from "@/lib/db/paper";

const USER = "507f1f77bcf86cd799439011"; // any valid ObjectId string
const snap = (cash: number) => ({
  cash,
  startingCash: 100_000,
  realizedToday: 0,
  positions: [],
  shares: {},
  orders: [],
  trades: [],
  balanceLog: [],
  journal: {},
});

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "lbtest";
  // lib/mongo only caches its client on globalThis in development — seed the
  // cache ourselves so every db() call in the suite shares ONE connection and
  // vitest can exit cleanly.
  (globalThis as unknown as { _lbMongo?: Promise<MongoClient> })._lbMongo = new MongoClient(
    mongod.getUri()
  ).connect();
}, 60_000);

afterAll(async () => {
  const g = globalThis as unknown as { _lbMongo?: Promise<MongoClient> };
  await g._lbMongo?.then((c) => c.close());
  delete g._lbMongo;
  await mongod?.stop();
});

describe("putPaper / getPaper rev contract", () => {
  it("an unknown user reads as rev 0 with no state", async () => {
    const r = await getPaper(USER);
    expect(r).toEqual({ rev: 0, updatedAt: null, state: null });
  });

  it("first push from rev 0 creates the doc at rev 1", async () => {
    const r = await putPaper(USER, 0, snap(100_000));
    expect(r).toEqual({ ok: true, rev: 1 });
    const g = await getPaper(USER);
    expect(g.rev).toBe(1);
    expect((g.state as { cash: number }).cash).toBe(100_000);
  });

  it("a linear update on the current rev advances it", async () => {
    const r = await putPaper(USER, 1, snap(90_000));
    expect(r).toEqual({ ok: true, rev: 2 });
  });

  it("a STALE baseRev conflicts and returns the server copy — never a silent clobber", async () => {
    const r = await putPaper(USER, 1, snap(1)); // built on rev 1, server is at 2
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.conflict.rev).toBe(2);
      expect((r.conflict.state as { cash: number }).cash).toBe(90_000);
    }
    // and the doc was not touched
    const g = await getPaper(USER);
    expect(g.rev).toBe(2);
    expect((g.state as { cash: number }).cash).toBe(90_000);
  });

  it("a rev-0 push racing an EXISTING doc conflicts instead of forking a second doc", async () => {
    const r = await putPaper(USER, 0, snap(2));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.conflict.rev).toBe(2);
  });
});

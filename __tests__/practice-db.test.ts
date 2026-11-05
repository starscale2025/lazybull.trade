// The /practice store against a REAL MongoDB (mongodb-memory-server), the
// way __tests__/paper-db.test.ts does it: submissions → acceptance rates,
// the runtime ladder, the profile ledger, the weekly board's ranking and the
// certificate's idempotency. These aggregations are the ONLY source of every
// figure the UI prints, so they are tested as the product, not as plumbing.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import {
  MIN_ACCEPTED_FOR_PERCENTILE,
  MIN_SUBMISSIONS_FOR_RATE,
  acceptedSlugsFor,
  certificatesFor,
  codeHash,
  contestBoard,
  getCertificate,
  mintCertificate,
  progressFor,
  publicName,
  recordSubmission,
  runtimePercentile,
  solversPerWindow,
  statsFor,
} from "@/lib/db/practice";

const ADA = "507f1f77bcf86cd799439011";
const BOB = "507f1f77bcf86cd799439012";
const DEVICE = "11111111-2222-3333-4444-555555555555";

let mongod: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "lbtest";
  // lib/mongo only caches its client on globalThis in development — seed the
  // cache ourselves so every db() call in the suite shares ONE connection and
  // vitest can exit cleanly.
  client = new MongoClient(mongod.getUri());
  (globalThis as unknown as { _lbMongo?: Promise<MongoClient> })._lbMongo = client.connect();
  await client.db("lbtest").collection("users").insertMany([
    { _id: new ObjectId(ADA), name: "Ada Lovelace" },
    { _id: new ObjectId(BOB), name: "bob" },
  ]);
}, 60_000);

afterAll(async () => {
  const g = globalThis as unknown as { _lbMongo?: Promise<MongoClient> };
  await g._lbMongo?.then((c) => c.close());
  delete g._lbMongo;
  await mongod?.stop();
});

const CODE = "def f(x):\n    return x\n";
const submit = (identity: { userId?: string; device?: string }, slug: string, verdict: "accepted" | "wrong-answer", runtimeMs = 10, mode: "run" | "submit" = "submit") =>
  recordSubmission({ identity, slug, lang: "python", mode, verdict, passed: verdict === "accepted" ? 9 : 5, total: 9, runtimeMs, code: CODE });

describe("recordSubmission → statsFor", () => {
  it("counts submits only, per slug, and reports accepted alongside", async () => {
    for (let i = 0; i < 4; i++) await submit({ device: DEVICE }, "black-scholes-call", i < 3 ? "accepted" : "wrong-answer", 10 + i);
    await submit({ device: DEVICE }, "black-scholes-call", "accepted", 5, "run"); // a run: never a submit
    const stats = await statsFor(["black-scholes-call", "kelly-fraction"]);
    expect(stats["black-scholes-call"]).toEqual({ submissions: 4, accepted: 3 });
    expect(stats["kelly-fraction"]).toBeUndefined();
    expect(await statsFor([])).toEqual({});
    expect(MIN_SUBMISSIONS_FOR_RATE).toBe(5);
  });
  it("keeps the code for a signed-in row only, and hashes whitespace-only variants the same", async () => {
    const a = await submit({ userId: ADA }, "put-call-parity", "accepted", 8);
    const row = await client.db("lbtest").collection("practice_submissions").findOne({ _id: new ObjectId(a.id) });
    expect(row?.code).toBe(CODE);
    expect(row?.userId?.toHexString()).toBe(ADA);
    const d = await submit({ device: DEVICE }, "put-call-parity", "accepted", 8);
    const anon = await client.db("lbtest").collection("practice_submissions").findOne({ _id: new ObjectId(d.id) });
    expect(anon?.code).toBeUndefined();
    expect(anon?.device).toBe(DEVICE);
    expect(codeHash("def f(x):\r\n\r\n    return x   \r\n")).toBe(codeHash(CODE));
    expect(codeHash("def f(x):\n    return x + 1\n")).not.toBe(codeHash(CODE));
  });
});

describe("runtimePercentile", () => {
  it("is null until enough accepted submits exist, then the share that ran slower", async () => {
    expect(MIN_ACCEPTED_FOR_PERCENTILE).toBe(5);
    expect(await runtimePercentile("black-scholes-call", 1)).toBeNull(); // 3 accepted so far
    await submit({ device: "d2" }, "black-scholes-call", "accepted", 100);
    await submit({ device: "d3" }, "black-scholes-call", "accepted", 200);
    // accepted runtimes: 10, 11, 12, 100, 200
    expect(await runtimePercentile("black-scholes-call", 50)).toBe(40);
    expect(await runtimePercentile("black-scholes-call", 1000)).toBe(0);
    expect(await runtimePercentile("black-scholes-call", 0)).toBe(100);
  });
});

describe("progressFor / acceptedSlugsFor", () => {
  it("reads by user id AND device, stamps first solves and counts every attempt", async () => {
    await submit({ userId: ADA, device: DEVICE }, "max-drawdown", "wrong-answer", 3, "run");
    await submit({ userId: ADA, device: DEVICE }, "max-drawdown", "accepted", 4);
    await submit({ userId: ADA, device: DEVICE }, "max-drawdown", "accepted", 2);
    const p = await progressFor({ userId: ADA, device: DEVICE });
    expect(p.solved["max-drawdown"]?.runtimeMs).toBe(4); // the FIRST accepted submit
    expect(p.solved["put-call-parity"]).toBeDefined();
    expect(p.solved["black-scholes-call"]).toBeDefined(); // device-only rows count too
    expect(p.attempts["max-drawdown"]).toBe(3);
    expect(p.submissions.length).toBeGreaterThan(0);
    expect(p.submissions[0].slug).toBe("max-drawdown");
    expect(p.submissions[0].mode).toBe("submit");
    expect(p.submissions.every((s) => typeof s.at === "number")).toBe(true);

    const onlyUser = await progressFor({ userId: ADA });
    expect(onlyUser.solved["black-scholes-call"]).toBeUndefined();
    expect(await progressFor({})).toEqual({ solved: {}, attempts: {}, submissions: [] });

    const accepted = await acceptedSlugsFor({ userId: ADA }, ["max-drawdown", "put-call-parity", "kelly-fraction"]);
    expect([...accepted].sort()).toEqual(["max-drawdown", "put-call-parity"]);
  });
});

describe("contestBoard", () => {
  const PROBLEMS = ["position-size-by-stop", "mean-reversion-half-life", "quantile-signal", "kalman-price-level"];
  const START = new Date("2030-01-06T14:30:00Z");
  const END = new Date(START.getTime() + 90 * 60_000);
  const inside = (min: number) => new Date(START.getTime() + min * 60_000);

  async function submitAt(identity: { userId?: string; device?: string }, slug: string, at: Date, verdict: "accepted" | "wrong-answer" = "accepted") {
    const r = await submit(identity, slug, verdict, 7);
    await client.db("lbtest").collection("practice_submissions").updateOne({ _id: new ObjectId(r.id) }, { $set: { createdAt: at } });
  }

  it("ranks on distinct solves, then on time to the last accepted submit; names are public, devices anonymous", async () => {
    // Ada: 2 solves, last at +40. Bob: 2 solves, last at +30 (faster). A device: 1 solve. Outside the window: ignored.
    await submitAt({ userId: ADA }, PROBLEMS[0], inside(10));
    await submitAt({ userId: ADA }, PROBLEMS[1], inside(40));
    await submitAt({ userId: ADA }, PROBLEMS[1], inside(45)); // a repeat solve is not a third problem
    await submitAt({ userId: BOB }, PROBLEMS[0], inside(5));
    await submitAt({ userId: BOB }, PROBLEMS[2], inside(30));
    await submitAt({ userId: BOB }, PROBLEMS[3], inside(50), "wrong-answer"); // not accepted
    await submitAt({ device: "dev-x" }, PROBLEMS[3], inside(20));
    await submitAt({ device: "dev-late" }, PROBLEMS[0], new Date(END.getTime() + 1));
    await submitAt({ userId: ADA }, PROBLEMS[3], new Date(START.getTime() - 1));

    const rows = await contestBoard(PROBLEMS, START, END);
    expect(rows.map((r) => [r.rank, r.name, r.solved, r.total])).toEqual([
      [1, "bob", 2, 4],
      [2, "Ada L.", 2, 4],
      [3, "anonymous", 1, 4],
    ]);
    expect(rows[0].timeMs).toBe(30 * 60_000);
    expect(rows[1].timeMs).toBe(45 * 60_000);
    expect(rows[2].timeMs).toBe(20 * 60_000);
    expect(Object.keys(rows[0]).sort()).toEqual(["name", "rank", "solved", "timeMs", "total"]);

    const before = { start: new Date(START.getTime() - 7 * 86_400_000), end: new Date(END.getTime() - 7 * 86_400_000) };
    expect(await solversPerWindow(PROBLEMS, [{ start: START, end: END }, before])).toEqual([3, 0]);
    expect(await contestBoard([], START, END)).toEqual([]);
  });
  it("shortens names to first name + initial, never an email", () => {
    expect(publicName("Shaurya Negi")).toBe("Shaurya N.");
    expect(publicName("  ada   byron lovelace ")).toBe("ada L.");
    expect(publicName("bob")).toBe("bob");
    expect(publicName(null)).toBe("anonymous");
    expect(publicName("")).toBe("anonymous");
  });
});

describe("mintCertificate", () => {
  it("is idempotent per (user, track): the second call returns the first row", async () => {
    const a = await mintCertificate(ADA, "finance", "Ada Lovelace");
    expect(a.created).toBe(true);
    expect(a.certificate.track).toBe("finance");
    expect(a.certificate.displayName).toBe("Ada Lovelace");
    expect(a.certificate.id).toMatch(/^[0-9a-f]{24}$/);
    const b = await mintCertificate(ADA, "finance", "Somebody Else");
    expect(b.created).toBe(false);
    expect(b.certificate.id).toBe(a.certificate.id);
    expect(b.certificate.displayName).toBe("Ada Lovelace");

    const other = await mintCertificate(ADA, "quant", "Ada Lovelace");
    expect(other.created).toBe(true);
    expect(other.certificate.id).not.toBe(a.certificate.id);

    const mine = await certificatesFor(ADA);
    expect(mine.map((c) => c.track)).toEqual(["finance", "quant"]);
    expect(await certificatesFor(BOB)).toEqual([]);
    expect(await certificatesFor("not-an-id")).toEqual([]);
  });
  it("is readable back by id, publicly, and nothing else resolves", async () => {
    const mine = await certificatesFor(ADA);
    const c = await getCertificate(mine[0].id);
    expect(c).toEqual(mine[0]);
    expect(await getCertificate("nope")).toBeNull();
    expect(await getCertificate(new ObjectId().toHexString())).toBeNull();
  });
});

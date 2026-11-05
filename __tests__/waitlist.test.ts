// The waitlist the 2026-09 diligence memo found missing, against a REAL
// MongoDB (mongodb-memory-server): the (email, tier) dedupe that turns a
// double-click into `already:true`, the address validation, and the two
// reads the pricing and account pages make.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { db } from "@/lib/mongo";
import {
  MAX_WAITLIST_BODY_BYTES,
  WAITLIST_TIERS,
  WaitlistInput,
  __resetWaitlist,
  joinWaitlist,
  normalizeEmail,
  waitlistCounts,
  waitlistFor,
} from "@/lib/db/waitlist";

const USER = "507f1f77bcf86cd799439011";
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "lbtest";
  (globalThis as unknown as { _lbMongo?: Promise<MongoClient> })._lbMongo = new MongoClient(mongod.getUri()).connect();
  __resetWaitlist();
}, 60_000);

afterAll(async () => {
  const g = globalThis as unknown as { _lbMongo?: Promise<MongoClient> };
  await g._lbMongo?.then((c) => c.close());
  delete g._lbMongo;
  await mongod?.stop();
});

describe("normalizeEmail / WaitlistInput (the wire contract)", () => {
  it("lowercases, trims, bounds at 254 and shape-checks", () => {
    expect(normalizeEmail("  A.Person@Example.COM ")).toBe("a.person@example.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail("no-at-sign")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull(); // no TLD
    expect(normalizeEmail("a b@c.co")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@b.co`)).toBeNull(); // 255 chars
    expect(normalizeEmail(`${"a".repeat(249)}@b.co`)).not.toBeNull(); // 254
  });

  it("accepts the three tiers × two currencies with an optional email, nothing else", () => {
    expect(WAITLIST_TIERS).toEqual(["plus", "pro", "power"]);
    expect(WaitlistInput.safeParse({ tier: "power", currency: "INR" }).success).toBe(true);
    expect(WaitlistInput.safeParse({ tier: "power", currency: "INR", email: "x@y.zz" }).success).toBe(true);
    expect(WaitlistInput.safeParse({ tier: "free", currency: "USD" }).success).toBe(false);
    expect(WaitlistInput.safeParse({ tier: "pro", currency: "EUR" }).success).toBe(false);
    expect(WaitlistInput.safeParse({ tier: "pro", currency: "USD", email: "x".repeat(255) }).success).toBe(false);
    expect(MAX_WAITLIST_BODY_BYTES).toBe(2_000);
  });
});

describe("joinWaitlist — one row per (email, tier)", () => {
  it("first join inserts; the same address on the same tier is `already`, on another tier is new", async () => {
    expect(await joinWaitlist({ email: "a@b.co", tier: "pro", currency: "USD", userId: USER, region: "in" })).toEqual({ already: false });
    expect(await joinWaitlist({ email: "a@b.co", tier: "pro", currency: "INR" })).toEqual({ already: true });
    expect(await joinWaitlist({ email: "a@b.co", tier: "power", currency: "USD" })).toEqual({ already: false });
    const rows = await (await db()).collection("waitlist").find({ email: "a@b.co" }).sort({ createdAt: 1 }).toArray();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tier: "pro", currency: "USD", region: "IN" });
    expect(rows[0].userId).toBeInstanceOf(ObjectId);
    expect(rows[0].userId.toHexString()).toBe(USER);
    expect(rows[1].userId).toBeUndefined();
    expect(rows[1].region).toBeUndefined();
  });

  it("a double-click races into one row, not two", async () => {
    const r = await Promise.all([
      joinWaitlist({ email: "race@b.co", tier: "plus", currency: "USD" }),
      joinWaitlist({ email: "race@b.co", tier: "plus", currency: "USD" }),
    ]);
    expect(r.filter((x) => x.already)).toHaveLength(1);
    expect(await (await db()).collection("waitlist").countDocuments({ email: "race@b.co" })).toBe(1);
  });

  it("a userId that is not an ObjectId is dropped rather than stored as junk", async () => {
    await joinWaitlist({ email: "junk@b.co", tier: "plus", currency: "USD", userId: "nope" });
    const row = await (await db()).collection("waitlist").findOne({ email: "junk@b.co" });
    expect(row?.userId).toBeUndefined();
  });

  it("waitlistCounts tallies per tier; waitlistFor lists one address's tiers", async () => {
    expect(await waitlistCounts()).toEqual({ plus: 2, pro: 1, power: 1 });
    const mine = await waitlistFor("A@B.co");
    expect(mine.map((w) => w.tier)).toEqual(["pro", "power"]);
    expect(mine[0]).not.toHaveProperty("_id");
    expect(mine[0]).not.toHaveProperty("email");
    expect(await waitlistFor("nobody@b.co")).toEqual([]);
    expect(await waitlistFor("not an email")).toEqual([]);
  });
});

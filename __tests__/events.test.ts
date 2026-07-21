import { describe, expect, it } from "vitest";
import { EventInput, EventsBody } from "@/lib/db/events";

const ev = (over: Record<string, unknown> = {}) => ({ type: "page_view", ts: 1, page: "/quant", ...over });

describe("EventInput (the wire contract)", () => {
  it("accepts a normal event", () => {
    expect(EventInput.safeParse(ev()).success).toBe(true);
    expect(EventInput.safeParse({ type: "order_submitted", props: { sym: "AAPL", qty: 100, filled: true, note: null } }).success).toBe(true);
  });

  it("rejects non-snake_case and oversized event names", () => {
    expect(EventInput.safeParse(ev({ type: "Page View" })).success).toBe(false);
    expect(EventInput.safeParse(ev({ type: "x".repeat(49) })).success).toBe(false);
    expect(EventInput.safeParse(ev({ type: "" })).success).toBe(false);
  });

  it("bounds prop keys and values so a hostile client can't bloat the collection", () => {
    expect(EventInput.safeParse(ev({ props: { ["k".repeat(49)]: 1 } })).success).toBe(false);
    expect(EventInput.safeParse(ev({ props: { note: "x".repeat(401) } })).success).toBe(false);
    expect(EventInput.safeParse(ev({ props: { nested: { deep: true } } })).success).toBe(false);
  });
});

describe("EventsBody", () => {
  it("caps the batch at 50 and requires at least one event", () => {
    expect(EventsBody.safeParse({ events: [] }).success).toBe(false);
    expect(EventsBody.safeParse({ events: Array.from({ length: 51 }, () => ev()) }).success).toBe(false);
    expect(EventsBody.safeParse({ device: "abcd1234", events: [ev()] }).success).toBe(true);
  });
});

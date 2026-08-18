import { describe, expect, it } from "vitest";
import { WorkspaceInput, WorkspacePatch, MAX_WORKSPACE_BODY_BYTES } from "@/lib/db/workspaces";

// Mirrors the real client payloads: app/pro/page.tsx saveWorkspace() and
// components/quant/SetupsBar.tsx save().
const proSave = (over: Record<string, unknown> = {}) => ({
  kind: "pro",
  name: "AAPL · D",
  state: {
    symbol: { sym: "AAPL", name: "Apple Inc." },
    timeframe: "D",
    drawings: [{ id: "d1", tool: "horizontal", p: 190.5, color: "#00ff87" }],
    indicators: ["ema20", "vwap"],
    layout: 1,
    chart: "candles",
    color: "#00ff87",
    alerts: [],
  },
  isPublic: false,
  ...over,
});

const quantSave = () => ({
  kind: "quant",
  name: "NVDA · seed",
  state: {
    symbol: "NVDA",
    bars: 500,
    mode: "seed",
    seed: 42,
    drift: 0.1,
    vol: 0.2,
    active: [{ defId: "sma-cross", params: { fast: 10, slow: 30 } }],
  },
});

describe("WorkspaceInput (the create contract)", () => {
  it("accepts the real pro and quant save payloads", () => {
    expect(WorkspaceInput.safeParse(proSave()).success).toBe(true);
    expect(WorkspaceInput.safeParse(quantSave()).success).toBe(true);
  });

  it("rejects unknown top-level fields instead of storing them", () => {
    expect(WorkspaceInput.safeParse(proSave({ userId: "attacker" })).success).toBe(false);
    expect(WorkspaceInput.safeParse(proSave({ createdAt: "2020-01-01" })).success).toBe(false);
  });

  it("bounds and trims the name", () => {
    expect(WorkspaceInput.safeParse(proSave({ name: "" })).success).toBe(false);
    expect(WorkspaceInput.safeParse(proSave({ name: "   " })).success).toBe(false);
    expect(WorkspaceInput.safeParse(proSave({ name: "x".repeat(121) })).success).toBe(false);
    const parsed = WorkspaceInput.parse(proSave({ name: "  padded  " }));
    expect(parsed.name).toBe("padded");
  });

  it("requires isPublic to be a real boolean, defaulting to false", () => {
    expect(WorkspaceInput.safeParse(proSave({ isPublic: "yes" })).success).toBe(false);
    expect(WorkspaceInput.safeParse(proSave({ isPublic: 1 })).success).toBe(false);
    expect(WorkspaceInput.parse(quantSave()).isPublic).toBe(false);
  });

  it("caps the state arrays so a valid-length body can't smuggle a huge doc", () => {
    const state = proSave().state as Record<string, unknown>;
    expect(
      WorkspaceInput.safeParse(proSave({ state: { ...state, drawings: Array(501).fill({}) } })).success,
    ).toBe(false);
    expect(
      WorkspaceInput.safeParse(proSave({ state: { ...state, indicators: Array(51).fill("ema20") } })).success,
    ).toBe(false);
    expect(
      WorkspaceInput.safeParse(proSave({ state: { ...state, alerts: Array(201).fill({}) } })).success,
    ).toBe(false);
    expect(
      WorkspaceInput.safeParse(proSave({ state: { ...state, timeframe: "x".repeat(21) } })).success,
    ).toBe(false);
  });

  it("keeps the byte cap generous enough for a heavy but honest layout", () => {
    const body = JSON.stringify(
      proSave({
        state: {
          ...(proSave().state as Record<string, unknown>),
          drawings: Array.from({ length: 300 }, (_, i) => ({
            id: `d${i}`,
            tool: "trendline",
            a: { i, p: 100 + i },
            b: { i: i + 10, p: 110 + i },
            color: "#00ff87",
          })),
        },
      }),
    );
    expect(body.length).toBeLessThan(MAX_WORKSPACE_BODY_BYTES);
  });
});

describe("WorkspacePatch (the update contract)", () => {
  it("accepts any subset of the writable fields", () => {
    expect(WorkspacePatch.safeParse({ name: "renamed" }).success).toBe(true);
    expect(WorkspacePatch.safeParse({ isPublic: true }).success).toBe(true);
    expect(WorkspacePatch.safeParse({ state: { timeframe: "1h" } }).success).toBe(true);
  });

  it("rejects unknown fields — including kind, which never changes after create", () => {
    expect(WorkspacePatch.safeParse({ kind: "quant" }).success).toBe(false);
    expect(WorkspacePatch.safeParse({ userId: "attacker" }).success).toBe(false);
    expect(WorkspacePatch.safeParse({ name: "ok", updatedAt: "2020-01-01" }).success).toBe(false);
  });

  it("holds patches to the same field bounds as create", () => {
    expect(WorkspacePatch.safeParse({ name: "x".repeat(121) }).success).toBe(false);
    expect(WorkspacePatch.safeParse({ isPublic: "true" }).success).toBe(false);
    expect(WorkspacePatch.safeParse({ state: { drawings: Array(501).fill({}) } }).success).toBe(false);
  });
});

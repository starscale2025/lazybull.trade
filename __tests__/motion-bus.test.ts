import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The bus keeps module state (the pause, whether storage was read), so every
// test loads a fresh copy against its own fake storage and <html>.
type Store = Map<string, string>;
function fakeStorage(store: Store) {
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}
function fakeDocument() {
  return { documentElement: { dataset: {} as Record<string, string | undefined> } };
}

async function freshBus() {
  vi.resetModules();
  return import("@/lib/motion/bus");
}

describe("motion bus: the pause", () => {
  let store: Store;
  let doc: ReturnType<typeof fakeDocument>;

  beforeEach(() => {
    store = new Map();
    doc = fakeDocument();
    vi.stubGlobal("localStorage", fakeStorage(store));
    vi.stubGlobal("document", doc);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts unpaused and leaves <html> alone", async () => {
    const bus = await freshBus();
    bus.initMotionPause();
    expect(bus.isMotionPaused()).toBe(false);
    expect(doc.documentElement.dataset.motion).toBeUndefined();
  });

  it("restores a stored pause onto <html>", async () => {
    store.set("lb-motion", "paused");
    const bus = await freshBus();
    bus.initMotionPause();
    expect(bus.isMotionPaused()).toBe(true);
    expect(doc.documentElement.dataset.motion).toBe("paused");
  });

  it("persists, reflects and notifies once per real change", async () => {
    const bus = await freshBus();
    const seen: boolean[] = [];
    const off = bus.onMotionPausedChange(() => seen.push(bus.isMotionPaused()));
    bus.setMotionPaused(true);
    bus.setMotionPaused(true);
    expect(store.get("lb-motion")).toBe("paused");
    expect(doc.documentElement.dataset.motion).toBe("paused");
    bus.setMotionPaused(false);
    expect(store.has("lb-motion")).toBe(false);
    expect(doc.documentElement.dataset.motion).toBeUndefined();
    expect(seen).toEqual([true, false]);
    off();
    bus.setMotionPaused(true);
    expect(seen).toEqual([true, false]);
  });

  it("survives a storage that throws (private mode, blocked site data)", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });
    const bus = await freshBus();
    expect(() => bus.initMotionPause()).not.toThrow();
    expect(bus.isMotionPaused()).toBe(false);
    expect(() => bus.setMotionPaused(true)).not.toThrow();
    expect(bus.isMotionPaused()).toBe(true);
    expect(doc.documentElement.dataset.motion).toBe("paused");
  });
});

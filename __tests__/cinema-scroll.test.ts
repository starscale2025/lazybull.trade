import { ACTS } from "@/lib/cinema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FILM_LIFT_END, FILM_SPAN, FILM_START, HANDOFF_HOLD_VH, SCROLL_LENGTH_VH, filmToScroll, scrollToFilm } from "@/components/scrollstory/cinema-metrics";

describe("scroll ↔ film mapping", () => {
  it("round-trips scroll → film → scroll up to the hold", () => {
    for (let i = 0; i <= 1000; i++) {
      const s = (i / 1000) * FILM_SPAN;
      expect(filmToScroll(scrollToFilm(s))).toBeCloseTo(s, 9);
    }
  });

  it("holds the last frame, pinned, for HANDOFF_HOLD_VH at the end", () => {
    expect(FILM_SPAN).toBeCloseTo(1 - HANDOFF_HOLD_VH / (SCROLL_LENGTH_VH - 100), 12);
    for (let i = 0; i <= 100; i++) {
      const s = FILM_SPAN + ((1 - FILM_SPAN) * i) / 100;
      expect(scrollToFilm(s)).toBe(1);
    }
    expect(filmToScroll(1)).toBe(FILM_SPAN);
    // The film itself plays over 1104vh: 1270 until Gate A4 #5 cut the mark's
    // dead tail, 1160 until the candle act's tail gave up half its road.
    expect((SCROLL_LENGTH_VH - 100) * FILM_SPAN).toBeCloseTo(1104, 9);
  });

  it("gives the mark's act under 1,000 px and the vote more road (Gate A4 #5)", () => {
    // At a 900 px viewport, as the gate measures.
    const px = (a: number, b: number) => (filmToScroll(b) - filmToScroll(a)) * (SCROLL_LENGTH_VH - 100) * 9;
    expect(px(ACTS.mark.from, 1)).toBeLessThan(1000);
    expect(px(ACTS.consensus.from, ACTS.consensus.to)).toBeGreaterThan(700);
    // ...while the long acts keep their pace (within 4%). 2,717 is the Gate A4
    // length of 3,224 less the half of the tail the floor line's glide gave up.
    expect(px(ACTS.candle.from, ACTS.candle.to) / 2717).toBeGreaterThan(0.96);
    expect(px(ACTS.candle.from, ACTS.candle.to) / 2717).toBeLessThan(1.04);
  });

  it("round-trips film → scroll → film from the curtain to the end", () => {
    for (let i = 0; i <= 1000; i++) {
      const p = FILM_START + ((1 - FILM_START) * i) / 1000;
      expect(scrollToFilm(filmToScroll(p))).toBeCloseTo(p, 9);
    }
  });

  it("is monotonic, so a later scroll is never an earlier frame", () => {
    let last = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const p = scrollToFilm(i / 1000);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it("clamps outside the section and starts under the curtain", () => {
    expect(scrollToFilm(-0.5)).toBe(FILM_START);
    expect(scrollToFilm(0)).toBe(FILM_START);
    expect(scrollToFilm(1.5)).toBe(1);
    expect(filmToScroll(0)).toBe(0);
    expect(filmToScroll(FILM_START)).toBe(0);
    expect(filmToScroll(2)).toBe(FILM_SPAN);
    // the curtain's lift ends where the film's first act begins
    expect(scrollToFilm(filmToScroll(FILM_LIFT_END))).toBeCloseTo(FILM_LIFT_END, 9);
  });
});

describe("cinemaResumeAt: only a reload resumes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stub(navType: string | null, store: Record<string, string>) {
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal("performance", {
      now: () => Date.now(),
      getEntriesByType: () => (navType ? [{ type: navType }] : []),
    });
  }
  const load = async () => (await import("@/components/scrollstory/cinema-memory")).cinemaResumeAt;

  it("resumes a reload or a back/forward landing mid-film", async () => {
    const at = await load();
    stub("reload", { "lb-cinema-resume": "0.5" });
    expect(at()).toBe(0.5);
    stub("back_forward", { "lb-cinema-resume": "0.42" });
    expect(at()).toBe(0.42);
  });

  it("starts an arrival from the top", async () => {
    const at = await load();
    stub("navigate", { "lb-cinema-resume": "0.5" });
    expect(at()).toBeNull();
    stub(null, { "lb-cinema-resume": "0.5" });
    expect(at()).toBeNull();
  });

  it("gives an asked-for replay the whole film", async () => {
    const at = await load();
    stub("reload", { "lb-cinema-resume": "0.5", "lb-cinema-replay": "1" });
    expect(at()).toBeNull();
  });

  it("ignores places not worth restoring, and garbage", async () => {
    const at = await load();
    for (const raw of [String(FILM_START), String(FILM_LIFT_END), "0.97", "0.99", "abc", "NaN", "-1"]) {
      stub("reload", { "lb-cinema-resume": raw });
      expect(at()).toBeNull();
    }
    stub("reload", {});
    expect(at()).toBeNull();
    stub("reload", { "lb-cinema-resume": "0.9699" });
    expect(at()).toBe(0.9699);
  });

  it("survives storage that throws", async () => {
    const at = await load();
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(at()).toBeNull();
  });
});

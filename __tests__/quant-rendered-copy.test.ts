// /quant's copy, linted the way a visitor reads it.
//
// scripts/check-compliance.mjs reads source files, and source hides what a
// template literal prints: "`${p}% chance ${label}`" passed it, and the Gate A
// re-run (2026-11-06) found the AI cells printing "CONSENSUS DIRECTION UP ·
// 5/5" on real AMZN beside PAPER TRADE. So this runs every bot in the
// registry on a few windows, collects the strings a card renders, and puts
// them through the same rules, plus a past-tense check for the AI reads.
//
// It also pins the holdout the AI bots skipped: a read from outside the page
// (hosted, on-device, snapshot) counts only when it is dated to the window's
// last bar (lib/quant/reads).

import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanText } from "../scripts/check-compliance.mjs";
import { BOT_REGISTRY } from "../lib/quant/bots";
import { HOLDOUT, READ, modelWindow, windowEnd } from "../lib/quant/reads";
import { generateCandles, type Candle } from "../lib/candles";
import type { BotDef, BotResult } from "../lib/quant/types";

type Hit = { id: string; text: string };

const DAY = 86_400_000;
/** Stamp a synthetic walk with weekday dates ending on `last`, as a real tape is. */
function dated(bars: Candle[], last: string): Candle[] {
  const ts: number[] = [];
  let t = Date.parse(`${last}T14:30:00Z`);
  while (ts.length < bars.length) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) ts.unshift(t);
    t -= DAY;
  }
  return bars.map((b, i) => ({ ...b, t: ts[i], v: 1_000_000 }));
}

const LAST = "2026-11-05";
const TAPES = [
  { name: "climb", drift: 0.6, vol: 1.2 },
  { name: "slide", drift: -0.6, vol: 1.2 },
  { name: "chop", drift: 0, vol: 2.6 },
].map((s, i) => {
  const all = dated(generateCandles(180 + HOLDOUT, 11 + i, 226, s.drift, s.vol), LAST);
  return { ...s, all, window: modelWindow(all) };
});
// Every tape has the same length and last day, so one window end for all.
const END = windowEnd(TAPES[0].window)!;

/** The bots that read the tape and so speak about a named security. */
const TAPE_READERS = ["ai-consensus", "ai-direction", "ai-magnitude", "ai-quantile", "ai-transformer", "ai-sequence", "ai-triple-barrier"];

beforeAll(() => {
  // The real snapshot, with every AMZN read re-dated to the test window's
  // last day so the snapshot path (the build functions) runs.
  const snap = JSON.parse(readFileSync(join(__dirname, "../public/quant-snapshot.json"), "utf8"));
  for (const read of Object.values(snap.tickers.AMZN) as { as_of?: string }[]) read.as_of = END;
  vi.stubGlobal("fetch", async (url: string) =>
    String(url).includes("quant-snapshot.json")
      ? new Response(JSON.stringify(snap), { status: 200 })
      : new Response("{}", { status: 404 })
  );
});

const defaults = (def: BotDef) => Object.fromEntries(def.params.map((p) => [p.key, p.default]));
const run = (def: BotDef, candles: Candle[], symbol = "AMZN") =>
  Promise.resolve(def.run({ candles, symbol }, defaults(def)));

/** What a BotCell prints for one result (components/quant/BotCell.tsx), in
    the case it prints it: the pill, the chips and the metric labels are
    uppercased (.t-chrome), so the uppercase-only rules see them that way. */
function resultText(r: BotResult): string[] {
  return [
    READ[r.verdict.side].toUpperCase(),
    r.verdict.text,
    r.asOf ? `AS OF ${r.asOf}` : "",
    ...r.metrics.map((m) => `${m.label.toUpperCase()} ${m.value}`),
    ...r.metrics.map((m) => m.hint ?? ""),
    ...(r.pane?.series ?? []).map((s) => s.label),
    ...(r.pane?.refLines ?? []).map((l) => l.label ?? ""),
    ...(r.overlay ?? []).map((o) => o.label),
    ...r.signals.map((s) => s.label ?? ""),
    r.summary,
    r.beginner ?? "",
  ].filter(Boolean);
}

/** …and around it, the bot's own header and parameters. */
const cardText = (def: BotDef, r: BotResult) => [
  def.name,
  def.tagline,
  def.formula ?? "",
  ...def.params.map((p) => `${p.label} ${p.hint ?? ""}`),
  ...resultText(r),
];

/** Past-window reads only: nothing about what a named stock will do. Applied
    to what the tape-reading AI cells print, where the 2026-11-06 copy failed.
    (The option pricers "predict" a price for an option you describe, which is
    fine.) */
const FORWARD: { id: string; re: RegExp }[] = [
  { id: "future-tense", re: /\bwill\b|\bgoing to\b/i },
  { id: "next-n", re: /\bnext \d+|\bnext (?:month|week)\b/i },
  { id: "forecast-verb", re: /\b(?:predicts?|expects?|expected return)\b/i },
  { id: "edge", re: /\bedge\b/i },
  { id: "trade-side", re: /\b(?:LONG|SHORT)\b/ },
  { id: "chance", re: /\bchance\b|\bP\((?:up|down)\)/i },
];

function lint(def: BotDef, r: BotResult): Hit[] {
  const text = cardText(def, r).join("\n");
  const hits: Hit[] = (scanText(text, `rendered:${def.id}`) as Hit[]).map((h) => ({ id: h.id, text: h.text }));
  if (TAPE_READERS.includes(def.id)) {
    const result = resultText(r).join("\n");
    for (const f of FORWARD) {
      const m = result.match(f.re);
      if (m) hits.push({ id: f.id, text: m[0] });
    }
  }
  return hits;
}

describe("every card's rendered copy passes the compliance rules", () => {
  for (const tape of TAPES) {
    it.each(BOT_REGISTRY.map((d) => [d.id, d] as const))(`${tape.name} · %s`, async (_id, def) => {
      // Dated AMZN takes the snapshot path, undated AMZN and an unknown
      // ticker take the stand-in: between them every copy branch renders.
      const runs = await Promise.all([
        run(def, tape.window),
        run(def, tape.window.map(({ t: _t, v: _v, ...b }) => b)),
        run(def, tape.window, "ZZZZ"),
      ]);
      for (const r of runs) expect(lint(def, r)).toEqual([]);
    });
  }
});

describe("the AI bots read only the page's window", () => {
  const window = TAPES[0].window;
  const bot = (id: string) => BOT_REGISTRY.find((d) => d.id === id)!;

  it.each(TAPE_READERS)("%s prints the window's last day on its card", async (id) => {
    expect((await run(bot(id), window)).asOf).toBe(END);
  });

  it.each(TAPE_READERS.filter((id) => id !== "ai-triple-barrier"))(
    "%s takes a snapshot dated to the window's last day",
    async (id) => {
      expect((await run(bot(id), window)).source).toBe("snapshot");
    }
  );

  it.each(TAPE_READERS.filter((id) => id !== "ai-triple-barrier"))(
    "%s drops a snapshot that has seen past the window, and one of an earlier window",
    async (id) => {
      // One session shorter: the snapshot, dated a day later, saw a session
      // the page holds back.
      const shorter = await run(bot(id), window.slice(0, -1));
      expect(shorter.source).toBe("heuristic");
      expect(shorter.asOf).toBe(windowEnd(window.slice(0, -1)));
      // One session longer: the snapshot read a window that ended a day earlier.
      const longer = await run(bot(id), TAPES[0].all.slice(0, window.length + 1));
      expect(longer.source).toBe("heuristic");
    }
  );

  it.each(TAPE_READERS)("%s on an undated (synthetic) tape uses the stand-in", async (id) => {
    const r = await run(bot(id), window.map(({ t: _t, v: _v, ...b }) => b));
    expect(r.source).not.toBe("snapshot");
    expect(r.asOf).toBe(`${HOLDOUT} sessions back`);
  });

  it("the option pricers, which read no tape, carry no date", async () => {
    for (const id of ["ai-bs-surrogate", "ai-iv-solver", "ai-mc-surrogate", "ai-american", "ai-heston"]) {
      expect((await run(bot(id), window)).asOf).toBeUndefined();
    }
  });
});

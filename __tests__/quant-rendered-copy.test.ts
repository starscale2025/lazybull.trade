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
//
// And it renders the real components (BotCell, OutputPanel, RunRitual) to
// markup, because the Gate A3 review (2026-11) found /quant printing a
// confidence it does not have: "CONF 95%" on every card beside the one
// hit-rate band, "MEAN CONFIDENCE 75%" over the run, and a bar labelled
// "model agreement" that was filled with the same mean. The confidence chip
// lived in BotCell, which resultText below only mirrors, so the copy lint
// above never saw it.

import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { scanText } from "../scripts/check-compliance.mjs";
import { BOT_REGISTRY } from "../lib/quant/bots";
import { HOLDOUT, READ, modelWindow, outcomeOf, windowEnd } from "../lib/quant/reads";
import { generateCandles, type Candle } from "../lib/candles";
import { ACCURACY_BAND, type BotDef, type BotResult } from "../lib/quant/types";
import { BotCell } from "../components/quant/BotCell";
import { OutputPanel, type RunRow } from "../components/quant/OutputPanel";
import { RunRitual } from "../components/quant/RunRitual";

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
    the strictest case: the labels print in sentence case since the calm
    pass, but they are checked uppercased so the uppercase-only rules still
    catch them if a label is ever set in caps again. */
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

/** The one historical hit-rate band (ACCURACY_BAND, lib/quant/types), the
    only percentage /quant may print as how often a read was right. */
const [BAND_LO, BAND_HI] = ACCURACY_BAND.split(/[–-]/).map((n) => parseFloat(n));

/** Words that put a figure in a confidence or accuracy role: the chance a
    read is right. Not "win rate": a backtest's win rate counts this tape's
    trades, worked out in front of the reader, and claims nothing about a
    model. Not "range" either: the quantile bot's "80% range" is the width it
    was asked for. */
const ROLE = String.raw`(?:conf(?:idence|ident)?|accura(?:cy|te)|hit[- ]?rate|odds|probabilit(?:y|ies)|chance|likel(?:y|ihood|iest))`;
const PCT = String.raw`(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*%`;
/** "CONF 95%", "Historical hit rate (hypothetical) 55–66%": the word, then a
    figure in the same clause (no full stop, no other number between). */
const ROLE_THEN_PCT = new RegExp(String.raw`\b${ROLE}\b[^.%\d\n]{0,40}?${PCT}`, "gi");
/** "95% confident", "73% chance": a figure, then the word. */
const PCT_THEN_ROLE = new RegExp(String.raw`${PCT}\s*(?:\w+\s+)?${ROLE}\b`, "gi");

/** Every percentage in a confidence or accuracy role that falls outside the
    band: "CONF 95%" fails, "HIT RATE 55–66%" passes. */
function bandHits(lines: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const line of lines) {
    for (const re of [ROLE_THEN_PCT, PCT_THEN_ROLE]) {
      for (const m of line.matchAll(re)) {
        const figures = [m[1], m[2]].filter(Boolean).map(Number);
        if (figures.some((f) => f < BAND_LO || f > BAND_HI)) hits.push({ id: "confidence-band", text: m[0] });
      }
    }
  }
  return hits;
}

function lint(def: BotDef, r: BotResult): Hit[] {
  const text = cardText(def, r).join("\n");
  const hits: Hit[] = (scanText(text, `rendered:${def.id}`) as Hit[]).map((h) => ({ id: h.id, text: h.text }));
  hits.push(...bandHits(cardText(def, r)));
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

describe("no number on /quant reads as a confidence (Gate A3)", () => {
  const noop = () => {};

  /** Markup to the text a visitor reads, one cell per element, tooltips
      included. React marks the seam between adjacent text nodes with an
      empty comment; dropping it keeps "conf 95%" one cell. */
  function cells(html: string): string[] {
    const decode = (t: string) =>
      t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const out: string[] = [];
    for (const [tok] of html.replace(/<!-- -->/g, "").matchAll(/<[^>]*>|[^<]+/g)) {
      const t = tok.startsWith("<") ? tok.match(/\btitle="([^"]*)"/)?.[1] : tok;
      if (t && decode(t).trim()) out.push(decode(t).trim());
    }
    return out;
  }
  /** A cell that is only a figure is read with the label before it, which is
      how a metric tile or a chip reads: "conf" then "95%". */
  const BARE = /^[+−-]?\d[\d.,]*(?:\s*[–-]\s*\d[\d.,]*)?\s*%$/;
  const phrases = (html: string) => {
    const cs = cells(html);
    return cs.map((c, i) => (i > 0 && BARE.test(c) ? `${cs[i - 1]} ${c}` : c));
  };

  const cardHtml = (def: BotDef, result: BotResult, candles: Candle[], symbol: string) =>
    renderToStaticMarkup(
      createElement(BotCell, {
        index: 0,
        active: { uid: def.id, defId: def.id, params: defaults(def) as Record<string, number | string | boolean> },
        def,
        result,
        candles,
        symbol,
        beginner: true,
        onUpdateParams: noop,
        onRemove: noop,
        onToggleCollapse: noop,
        onRerun: noop,
      })
    );
  const panelHtml = (runs: RunRow[], tape?: (typeof TAPES)[number]) =>
    renderToStaticMarkup(
      createElement(OutputPanel, {
        runs,
        symbol: "AMZN",
        outcome: tape ? outcomeOf(tape.window, tape.all) : null,
        beginner: true,
        ranAt: 0,
        dataSource: "seed",
      })
    );
  const ritualHtml = (rows: RunRow[]) =>
    renderToStaticMarkup(
      createElement(RunRitual, { phase: "verdict", rows, symbol: "AMZN", bars: 180, dataSource: "seed", runMs: 1200, onRunAll: noop })
    );

  /** Every bot on a tape, down each copy branch (see the first describe). */
  async function rowsFor(tape: (typeof TAPES)[number]) {
    const rows: { row: RunRow; candles: Candle[]; symbol: string }[] = [];
    for (const def of BOT_REGISTRY) {
      const undated = tape.window.map(({ t: _t, v: _v, ...b }) => b);
      for (const [candles, symbol] of [[tape.window, "AMZN"], [undated, "AMZN"], [tape.window, "ZZZZ"]] as const) {
        const result = await run(def, candles, symbol);
        const active = { uid: `${def.id}-${rows.length}`, defId: def.id, params: defaults(def) as Record<string, number | string | boolean> };
        rows.push({ row: { active, def, result }, candles, symbol });
      }
    }
    return rows;
  }

  /** The same result with verdict.confidence taken out, or set to `c`. */
  const withConfidence = (r: BotResult, c?: number): BotResult => {
    const { confidence: _drop, ...verdict } = r.verdict;
    return { ...r, verdict: c === undefined ? verdict : { ...verdict, confidence: c } };
  };

  it("the band check fires on what it exists to catch", () => {
    const fails = [
      "CONF 95%",
      "MEAN CONFIDENCE 75%",
      "95% confident the 10-day loss won't exceed $1,828",
      "HISTORICAL HIT RATE (HYPOTHETICAL) 65–77%",
      "73% chance up",
    ];
    for (const line of fails) expect(bandHits([line]), line).not.toEqual([]);
    expect(bandHits(phrases('<span title="Model confidence in this verdict">conf <span>95%</span></span>'))).not.toEqual([]);
    const passes = [
      `HISTORICAL HIT RATE (HYPOTHETICAL) ${ACCURACY_BAND}`,
      `Embargoed CV hit rate ${ACCURACY_BAND} · hypothetical · out-of-sample · not a forecast.`,
      "MODELS AGREEING 2 of 4",
      "WIN RATE 83%",
      "80% RANGE WIDTH 13.14%",
      "Six models read the same window. A 6/6 vote means the models lined up; it is not better odds, and the same historical band covers every vote.",
    ];
    for (const line of passes) expect(bandHits([line]), line).toEqual([]);
  });

  for (const tape of TAPES) {
    it(`${tape.name} · the cards, the Output panel and the run band print no confidence or accuracy outside ${ACCURACY_BAND}`, async () => {
      const rows = await rowsFor(tape);
      const pages = [
        ...rows.map(({ row, candles, symbol }) => ({ id: row.def.id, html: cardHtml(row.def, row.result!, candles, symbol) })),
        { id: "output-panel", html: panelHtml(rows.map((r) => r.row), tape) },
        { id: "run-ritual", html: ritualHtml(rows.map((r) => r.row)) },
      ];
      for (const { id, html } of pages) {
        const lines = phrases(html);
        const hits = [
          ...bandHits(lines),
          ...(scanText(lines.join("\n"), `rendered:${id}`) as Hit[]).map((h) => ({ id: h.id, text: h.text })),
        ];
        expect(hits, id).toEqual([]);
      }
    });

    // The bar under the meter was labelled "model agreement" and filled with
    // the mean confidence: a label check alone passes that. So the render
    // must come out the same whatever verdict.confidence holds.
    it(`${tape.name} · what renders does not depend on verdict.confidence`, async () => {
      const rows = await rowsFor(tape);
      const as = (c?: number) => rows.map(({ row }) => ({ ...row, result: withConfidence(row.result!, c) }));
      const [none, sure] = [as(undefined), as(0.99)];
      // Compared tag by tag, so a failure diffs the one element that changed
      // (a width is an attribute, so this is the markup, not just its text).
      const tags = (html: string) => html.split(/(?=<)/);
      rows.forEach(({ candles, symbol }, i) => {
        expect(tags(cardHtml(sure[i].def, sure[i].result, candles, symbol)), sure[i].def.id).toEqual(
          tags(cardHtml(none[i].def, none[i].result, candles, symbol))
        );
      });
      expect(tags(panelHtml(sure, tape)), "output-panel").toEqual(tags(panelHtml(none, tape)));
      expect(tags(ritualHtml(sure)), "run-ritual").toEqual(tags(ritualHtml(none)));
    });
  }

  it("the Output bar and the run band count the models agreeing: 2 of 4 is half", () => {
    const def = BOT_REGISTRY[0];
    const rows: RunRow[] = (["buy", "buy", "sell", "hold"] as const).map((side, i) => ({
      active: { uid: `fixture-${i}`, defId: def.id, params: {} },
      def,
      result: { signals: [], metrics: [], summary: "", verdict: { side, text: "", confidence: 0.95 } },
    }));
    const panel = panelHtml(rows);
    const lines = cells(panel);
    expect(lines).toContain("models agreeing");
    expect(lines[lines.indexOf("models agreeing") + 1]).toBe("2 of 4");
    expect(panel).toContain("width:50.0%");
    expect(panel).not.toMatch(/95(?:\.0)?%/);
    const ritual = cells(ritualHtml(rows));
    expect(ritual).toContain("agreement");
    expect(ritual[ritual.indexOf("agreement") + 1]).toBe("2/4");
    expect(ritual.join(" ")).not.toMatch(/confidence|95%/i);
  });
});

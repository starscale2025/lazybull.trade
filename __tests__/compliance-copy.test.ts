// The compliance guard, guarded.
//
// scripts/check-compliance.mjs is the mechanical half of the promise in
// docs/COMPLIANCE.md: lazybull describes what a rule did historically and
// never instructs a trade, promises a return, or dresses a model output as a
// signal. A lint nobody has watched fail is a lint nobody should trust, so
// this pins the rules that matter against real sentences — the ones the
// 2026-09 diligence pass actually found shipped — and against the innocent
// prose next to them, because a rule that fires on ordinary teaching copy
// gets loosened by the next person in a hurry and then guards nothing.

import { describe, expect, it } from "vitest";
// A plain ESM script, imported directly so the guard is tested through the
// same entry point the build runs.
import { scanText } from "../scripts/check-compliance.mjs";

type Hit = { file: string; line: number; id: string; why: string; text: string };
const scan = (text: string, path = "x.tsx", allow = new Set<string>()): Hit[] =>
  scanText(text, path, allow) as Hit[];
const ids = (text: string) => scan(text).map((h) => h.id);

describe("banned copy is caught", () => {
  it.each([
    ["sizing", "When the consensus is strong, plug those probabilities into Kelly for sizing."],
    ["sizing", "Most pros use half-Kelly because full Kelly accepts giant drawdowns."],
    ["instruct-trade", "Anything in between, sit it out."],
    ["signal", "Anything more than 0.5% off is mispriced — that's the trade signal."],
    ["earnings", "Learn the system and beat the market."],
    ["edge-claim", "Real edge here — the models agree."],
    ["ultra-tier", "When you see ULTRA tier, the sample was thin."],
    ["accuracy-77", "Historical accuracy lands around 65–77%."],
    ["dead-domain", 'title: "About — lazybull.trade"'],
    ["bots-watching", "27 bots watching, so you don't have to."],
    ["fake-prediction", "P(down) 71%"],
    ["seeded-fake", "every surface that prints one sits next to a SIM lamp"],
    // 2026-11 verification: what the film and the workbench actually rendered.
    ["fake-prediction", "P(up) 64% by Friday"],
    ["ultra-tier", "TIER ULTRA · CONF 95%"],
    ["instruct-trade", "H 0.55 · RANDOM WALK · no edge — stand aside"],
    ["oracle", "AI CRASH DETECTION"],
    ["oracle", "candidate = CALL 240 · agree 4/6"],
    ["oracle", "historical agreement 6/6 models · paper pick staged"],
    ["bet", "⟢ bet builder · v2"],
    ["bet", "⚡ confirm bet · AMZN"],
    ["bet", "You collected $484 betting AMZN closes between 215 and 240."],
    ["bet", "win odds 55%"],
    // 2026-11 plan review: rendered strings the first widening still missed.
    ["bet", "Option bets · 2 open"],
    ["bet", "No bets yet. The UP/DOWN slip books here."],
    ["bet", "settle or manage bets on /trade"],
    ["bet", "seed tape — switch to live to bet at real prices"],
    ["bet", "Place a trade on /pro or bet a direction on /quant."],
    ["bet", "bet open (credit) · iron condor"],
    ["bet", "Max profit $570 (model odds 62%)."],
    ["income-promise", "Defined-risk income"],
    ["income-promise", "Learn it. Backtest it. Only then trade it."],
    // 2026-11-05 Gate A re-tribunal: what /quant and /learn printed.
    ["verdict-token", "One bot flashes BUY at 60% confidence."],
    ["verdict-token", "BUY · 78% CONF"],
    ["verdict-token", "2 BUY · 1 HOLD · 1 SELL"],
    ["verdict-token", "moderate agreement — 5/5 say UP."],
    ["verdict-token", "SMA CROSSOVER → BUY"],
    ["verdict-token", "the BUY / SELL / HOLD pill at the top of the cell"],
    ["verdict-token", "value={result.verdict.side.toUpperCase()}"],
    ["recommended-for", "★ recommended for {symbol}"],
  ])("flags %s", (id, line) => {
    expect(ids(line)).toContain(id);
  });

  it("reports the file, the line and a reason a writer can act on", () => {
    const [hit] = scan("ok\nok\nAnything in between, sit it out.\n", "components/Bot.tsx");
    expect(hit).toMatchObject({ file: "components/Bot.tsx", line: 3, id: "instruct-trade" });
    expect(hit.why.length).toBeGreaterThan(20);
  });
});

describe("teaching copy is left alone", () => {
  // Every line below is the COMPLIANT rewrite of something above, or ordinary
  // prose from the primer. If a change to the rules starts flagging these, the
  // rule is too wide — narrow it rather than allow-listing the whole file.
  it.each([
    "When at least five of six models agreed historically, the next bar matched about 60% of the time.",
    "The Kelly criterion computes the bet fraction that maximises long-run growth; the maths is f* = (p·b − q) / b.",
    "Hypothetical, out-of-sample, not a forecast.",
    "The rule marked a long lean when the fast average crossed above the slow one.",
    "Theta is what the position loses to the passing of a day.",
    "Paper only · educational · not advice",
    "Delta measures how much the option moves per dollar of the underlying.",
    "Out-of-sample accuracy sits in a 55–66% band by agreement tier.",
    "No trade here uses real money.",
    "confirm paper trade · AMZN",
    "Your worst case is a number you chose.",
    "in-range odds · BS model",
    "Option positions · 2 open",
    "Defined-risk credit",
    "Learn it. Backtest it. Then paper-trade it.",
    "Black-Scholes probability 62%, a model, not a forecast",
    "The models disagreed, and the split is the lesson.",
    "moderate agreement — 5/5 read up.",
    "2 up · 1 flat · 1 down",
    "On-chart order ticket — SELL | qty | BUY, top-left.",
    "placePaperOrder({ sym, side: dir === \"up\" ? \"buy\" : \"sell\" })",
    "overstating p by 10% can double your recommended fraction",
  ])("passes: %s", (line) => {
    expect(scan(line)).toEqual([]);
  });
});

describe("the allow-list", () => {
  const line = "we never say “free money”";
  it("suppresses exactly one rule in exactly one file", () => {
    expect(ids(line)).toContain("earnings");
    expect(scan(line, "app/safety/page.tsx", new Set(["app/safety/page.tsx:earnings"]))).toEqual([]);
    // …and nowhere else, so an entry cannot quietly go site-wide.
    expect(scan(line, "components/Hero.tsx", new Set(["app/safety/page.tsx:earnings"])).map((h) => h.id)).toContain("earnings");
  });
});

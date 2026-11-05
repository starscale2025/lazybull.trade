// The consent decision layer, pinned.
//
// Everything here is a PURE function of a consent record — no browser, no
// storage, no network — because that is the only part of the gate worth
// pinning: "does this event go out?" is one boolean, and the memo's stake on
// it is blunt ("an un-consented dataset is an un-sellable dataset"). If this
// file goes green while the answer is wrong, the dataset is worthless.
//
// The DOM half (focus trap, escape, the POST) is not covered: vitest runs in
// the node environment here (vitest.config.ts) and a jsdom harness for one
// dialog would test React, not the rule.

import { describe, expect, it } from "vitest";
import {
  CONSENT_TEXT_VERSION,
  CONSENT_VERSION,
  ConsentInput,
  ConsentRecord,
  analyticsAllowed,
  consentGateNeeded,
  consentIsCurrent,
  isMinor,
  parseConsentCookie,
  trainingAllowed,
} from "@/lib/consent";
import { eventAllowed } from "@/lib/track";
import {
  ABANDON_MS,
  REASK_WINDOW_MS,
  isAbandon,
  isReask,
  noteBuilderAbandon,
  noteExplainRequest,
  tradeFingerprint,
} from "@/lib/confusion";

const rec = (over: Partial<ConsentRecord> = {}): ConsentRecord => ({
  v: CONSENT_VERSION,
  adult: true,
  analytics: true,
  training: false,
  at: "2026-09-08T10:00:00.000Z",
  text: CONSENT_TEXT_VERSION,
  ...over,
});

describe("is the gate needed?", () => {
  it("opens when there is no record at all", () => {
    expect(consentGateNeeded(null)).toBe(true);
  });

  it("stays shut for a current record — including a decline", () => {
    expect(consentGateNeeded(rec())).toBe(false);
    expect(consentGateNeeded(rec({ analytics: false, training: false }))).toBe(false);
  });

  it("re-opens when the consent TEXT has moved on — a stale yes is not a yes", () => {
    expect(consentGateNeeded(rec({ text: "2020-01-01" }))).toBe(true);
    expect(consentIsCurrent(rec({ text: "2020-01-01" }))).toBe(false);
  });

  it("re-asks a yes written before the text version existed", () => {
    const legacy = rec();
    delete legacy.text;
    expect(consentIsCurrent(legacy)).toBe(false);
    expect(consentGateNeeded(legacy)).toBe(true);
  });

  it("lets a decline stand under any text: it carries no yes forward", () => {
    const legacy = rec({ analytics: false, training: false });
    delete legacy.text;
    expect(consentGateNeeded(legacy)).toBe(false);
    expect(consentGateNeeded(rec({ analytics: false, training: false, text: "2020-01-01" }))).toBe(false);
  });

  it("does NOT re-prompt an under-18 answer — that gets the blocked state instead", () => {
    const minor = rec({ adult: false, analytics: false, training: false });
    expect(consentGateNeeded(minor)).toBe(false);
    expect(isMinor(minor)).toBe(true);
    expect(isMinor(rec())).toBe(false);
    expect(isMinor(null)).toBe(false);
  });
});

describe("does this event pass the consent filter?", () => {
  it("drops everything while undecided", () => {
    expect(eventAllowed("page_view", null)).toBe(false);
    expect(eventAllowed("page_view", null, "trace")).toBe(false);
  });

  it("passes product analytics on an adult yes", () => {
    expect(eventAllowed("page_view", rec())).toBe(true);
    expect(eventAllowed("bet_opened", rec(), "trace")).toBe(true);
  });

  it("drops analytics on an adult no", () => {
    expect(eventAllowed("page_view", rec({ analytics: false }))).toBe(false);
  });

  it("lets TRAINING consent alone carry a decision trace, and nothing else", () => {
    const trainingOnly = rec({ analytics: false, training: true });
    expect(eventAllowed("confusion_signal", trainingOnly, "trace")).toBe(true);
    expect(eventAllowed("page_view", trainingOnly)).toBe(false);
    expect(eventAllowed("page_view", trainingOnly, "analytics")).toBe(false);
  });

  it("drops both bases when both purposes are declined", () => {
    const declined = rec({ analytics: false, training: false });
    expect(eventAllowed("page_view", declined)).toBe(false);
    expect(eventAllowed("confusion_signal", declined, "trace")).toBe(false);
  });

  it("drops everything on a stale consent text, yes or no", () => {
    expect(eventAllowed("page_view", rec({ text: "2020-01-01" }))).toBe(false);
    expect(eventAllowed("confusion_signal", rec({ training: true, text: "2020-01-01" }), "trace")).toBe(
      false
    );
  });

  it("has an EMPTY essential allow-list — no client event bypasses the gate", () => {
    // If this ever fails, someone added a name to ESSENTIAL_EVENTS. That is a
    // claim that it is lawful to collect the event from a person who said no.
    for (const type of ["page_view", "bet_opened", "consent_given", "sign_in", "error"]) {
      expect(eventAllowed(type, null)).toBe(false);
    }
  });
});

describe("under-18 blocks everything", () => {
  const minor = rec({ adult: false, analytics: true, training: true });

  it("fails every consent helper even with the purpose flags set", () => {
    // The flags cannot be true for a minor in practice (the gate zeroes them),
    // but the guard must not depend on that: `adult` is the gate.
    expect(analyticsAllowed(minor)).toBe(false);
    expect(trainingAllowed(minor)).toBe(false);
    expect(eventAllowed("page_view", minor)).toBe(false);
    expect(eventAllowed("confusion_signal", minor, "trace")).toBe(false);
  });

  it("is never postable to the server — the schema refuses adult:false", () => {
    expect(ConsentInput.safeParse({ ...rec(), adult: false }).success).toBe(false);
    expect(ConsentInput.safeParse({ ...rec(), device: "abcd-1234" }).success).toBe(true);
  });
});

describe("the record itself", () => {
  it("refuses junk rather than reading it as a yes", () => {
    expect(ConsentRecord.safeParse({ ...rec(), v: 2 }).success).toBe(false);
    expect(ConsentRecord.safeParse({ ...rec(), at: "yesterday" }).success).toBe(false);
    expect(ConsentRecord.safeParse({ ...rec(), analytics: "true" }).success).toBe(false);
    expect(ConsentRecord.safeParse({ ...rec(), text: "x".repeat(17) }).success).toBe(false);
  });

  it("rebuilds from the mirror cookie when localStorage was cleared", () => {
    const parsed = parseConsentCookie("1.1.1.0.1757328000");
    expect(parsed).toMatchObject({ v: 1, adult: true, analytics: true, training: false });
    expect(analyticsAllowed(parsed)).toBe(true);
    expect(parseConsentCookie("1.1.1.0")).toBeNull();
    expect(parseConsentCookie("2.1.1.0.1757328000")).toBeNull();
    expect(parseConsentCookie("")).toBeNull();
  });

  it("carries the consent text version through the cookie", () => {
    const parsed = parseConsentCookie("1.1.1.0.1757328000.20261105");
    expect(parsed?.text).toBe("2026-11-05");
    expect(consentGateNeeded(parsed)).toBe(consentGateNeeded(rec({ text: "2026-11-05" })));
    // an old five-field cookie rebuilds text-less, so its yes is re-asked
    expect(consentGateNeeded(parseConsentCookie("1.1.1.0.1757328000"))).toBe(true);
  });
});

describe("confusion signals ride on the same consent", () => {
  const legs = [
    { type: "C" as const, side: "long" as const, strike: 230, qty: 1 },
    { type: "C" as const, side: "short" as const, strike: 240, qty: 1 },
  ];

  it("fingerprints the position, not the order the legs were picked in", () => {
    const a = tradeFingerprint({ strategy: "Bull Call Spread", underlying: "AMZN", legs });
    const b = tradeFingerprint({
      strategy: "bull call spread",
      underlying: "amzn",
      legs: [legs[1], legs[0]],
    });
    expect(a).toBe(b);
  });

  it("treats a changed strike as a new question, not a repeat", () => {
    const a = tradeFingerprint({ strategy: "Bull Call Spread", underlying: "AMZN", legs });
    const b = tradeFingerprint({
      strategy: "Bull Call Spread",
      underlying: "AMZN",
      legs: [legs[0], { ...legs[1], strike: 245 }],
    });
    expect(a).not.toBe(b);
  });

  it("calls a second ask inside five minutes a re-ask, and nothing else", () => {
    const t0 = 1_000_000;
    expect(isReask(undefined, t0)).toBe(false); // first ask
    expect(isReask(t0, t0 + REASK_WINDOW_MS - 1)).toBe(true);
    expect(isReask(t0, t0 + REASK_WINDOW_MS + 1)).toBe(false); // a fresh session
  });

  it("calls a >30s builder session with no trade an abandon, and nothing else", () => {
    const t0 = 1_000_000;
    expect(isAbandon(t0, false, t0 + ABANDON_MS + 1)).toBe(true);
    expect(isAbandon(t0, true, t0 + ABANDON_MS + 1)).toBe(false); // they traded
    expect(isAbandon(t0, false, t0 + ABANDON_MS - 1)).toBe(false); // a bounce
    expect(isAbandon(0, false, t0)).toBe(false); // never started
  });

  it("emits nothing at all without consent (node has no consent record)", () => {
    expect(noteExplainRequest("AMZN|bull call spread|bC23000x1")).toBe(false);
    expect(noteBuilderAbandon(1, false, "builder", 1 + ABANDON_MS + 1)).toBe(false);
  });
});

// Confusion signals — the written heuristic behind the decision-trace moat.
//
// WHY THIS EXISTS. The diligence memo asked for "decision-trace logging with
// consent: schema version, DPDP-compliant consent text, age gate, and a
// WRITTEN CONFUSION HEURISTIC. The moat starts the day this ships and not
// before." A trace of what someone did is only worth something if the file
// also says which parts of it mean "this person did not understand". That
// judgement lives here, in one module, in prose, so it can be argued with —
// rather than being reconstructed later from a SQL query nobody wrote down.
//
// TWO SIGNALS, both deliberately conservative. A false "confused" reading is
// worse than a missed one: it would teach the AI teacher to re-explain things
// people already understood.
//
//   1. RE-ASK. The same position explained twice inside five minutes. Not
//      "asked twice" — asked twice about the SAME FINGERPRINT (strategy +
//      underlying + the exact legs). Change a strike and it is a new question,
//      not a repeated one. Five minutes is the window in which the first
//      answer is still on screen: asking again while you can still read the
//      last answer is the observable form of "that did not land".
//
//   2. ABANDON. A builder session longer than 30 seconds that ended with no
//      paper trade. Under 30s is a bounce — someone looked at the page and
//      left, which says nothing about comprehension. Past 30s they were
//      working: dragging the band, switching strategies, opening the legs. To
//      do all that and place nothing is the cheapest available proxy for "I
//      built something and could not tell whether it was what I meant".
//
// CONSENT. Emitted under the "trace" basis (lib/track.ts): analytics OR
// training consent carries it. Analytics, because "which strategies confuse
// people" is a product-improvement question and that is what the analytics
// toggle promises. Training, because the training toggle's own copy names
// "drags, undos, re-asks" as the thing it covers — a re-ask IS the named
// example. With neither consent this module records nothing at all, not even
// in memory: a behavioural trail held on the device is still a behavioural
// trail.

import { analyticsAllowed, readConsent, trainingAllowed } from "./consent";
import { track } from "./track";

/** Two explains of the same position inside this window is a re-ask. */
export const REASK_WINDOW_MS = 5 * 60_000;
/** A builder session shorter than this is a bounce, not an abandonment. */
export const ABANDON_MS = 30_000;
/** Fingerprints held in memory. Small: a session builds a handful of shapes. */
const MAX_TRACKED = 64;

type FingerprintInput = {
  strategy: string;
  underlying: string;
  legs: { type: "C" | "P"; side: "long" | "short"; strike: number; qty: number }[];
};

/**
 * A stable short id for "this exact position". Strategy + underlying + legs,
 * legs sorted so the same basket built in a different order is the same
 * question. Premiums are NOT in it: the quote moves between two asks and a
 * moving quote must not disguise a repeat. Rounded strikes for the same
 * reason.
 */
export function tradeFingerprint(input: FingerprintInput): string {
  const legs = input.legs
    .map((l) => `${l.side[0]}${l.type}${Math.round(l.strike * 100)}x${l.qty}`)
    .sort()
    .join(",");
  return `${input.underlying.toUpperCase()}|${input.strategy.toLowerCase()}|${legs}`;
}

/** PURE: is this ask a re-ask? `prev` is when the same fingerprint was last asked. */
export function isReask(prev: number | undefined, now: number): boolean {
  return prev !== undefined && now - prev <= REASK_WINDOW_MS && now >= prev;
}

/** PURE: did this builder session end in abandonment? */
export function isAbandon(startedAt: number, placed: boolean, now: number): boolean {
  return !placed && startedAt > 0 && now - startedAt > ABANDON_MS;
}

/** Analytics OR training — see the header. Always false on the server. */
function traceAllowed(): boolean {
  const rec = readConsent();
  return analyticsAllowed(rec) || trainingAllowed(rec);
}

// In memory, per tab. Not persisted: a re-ask after a reload is not something
// we can honestly observe (the first answer is gone from the screen too), and
// persisting fingerprints would write a behavioural trail to the device for a
// signal we would then have to discard anyway.
const lastAsked = new Map<string, number>();

/**
 * Call on every explanation request. Returns true when it emitted a signal.
 *
 * @param fingerprint from tradeFingerprint()
 * @param surface where the ask came from — "explain" is the AI teacher panel
 */
export function noteExplainRequest(
  fingerprint: string,
  surface = "explain",
  now = Date.now()
): boolean {
  if (!fingerprint || !traceAllowed()) return false;
  const prev = lastAsked.get(fingerprint);
  lastAsked.set(fingerprint, now);
  if (lastAsked.size > MAX_TRACKED) {
    // Oldest insertion first — Map preserves insertion order.
    const oldest = lastAsked.keys().next();
    if (!oldest.done) lastAsked.delete(oldest.value);
  }
  if (!isReask(prev, now)) return false;
  track(
    "confusion_signal",
    { kind: "reask", surface, gap_ms: now - (prev as number) },
    { basis: "trace" }
  );
  return true;
}

/**
 * Call when a builder session ends (unmount, pagehide, symbol change).
 * Returns true when it emitted a signal.
 *
 * @param startedAt ms timestamp the session began
 * @param placed did it end with a paper trade?
 */
export function noteBuilderAbandon(
  startedAt: number,
  placed: boolean,
  surface = "builder",
  now = Date.now()
): boolean {
  if (!traceAllowed() || !isAbandon(startedAt, placed, now)) return false;
  track(
    "confusion_signal",
    { kind: "abandon", surface, dwell_ms: now - startedAt },
    { basis: "trace" }
  );
  return true;
}

/** Test-only: drop the in-memory fingerprints between cases. */
export function __resetConfusion(): void {
  lastAsked.clear();
}

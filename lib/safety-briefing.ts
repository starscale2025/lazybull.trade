// The first-visit risk briefing opens on intent, not on a timer: the first
// time a visitor places a paper trade, or turns training wheels off. Until
// 2026-11 it opened 600 ms after /trade loaded, over a page nobody had read
// yet, behind a full-screen blur.
//
// components/safety/RiskWizard.tsx registers itself here while it is mounted.
// A caller wraps the action the briefing should come before:
//     withBriefing(() => setConfirm(trade))
// Seen already, or no briefing on this page: the action runs at once.
// Otherwise the briefing opens, and the action runs when it closes, with how
// it closed (the briefing itself sets training wheels on or off).

import { useSafety } from "@/lib/stores";

export type BriefingOutcome = "wheels-on" | "wheels-off";
type Opener = (done: (outcome: BriefingOutcome) => void) => void;

let opener: Opener | null = null;

export function registerBriefing(fn: Opener) {
  opener = fn;
  return () => {
    if (opener === fn) opener = null;
  };
}

/** True when the next intent would open the briefing first. */
export function briefingPending() {
  return !!opener && !useSafety.getState().wizardSeen;
}

export function withBriefing(then: (outcome?: BriefingOutcome) => void = () => {}) {
  if (!opener || useSafety.getState().wizardSeen) then();
  else opener(then);
}

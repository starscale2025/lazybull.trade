// Shared helpers for the trade-confirmation gate, used by both voice engines.
// The gate must accept a trade only on an AFFIRMATIVE user turn (a real "yes"),
// never just "some user turn happened since staging".

const NEGATION = /\b(no|nope|nah|don'?t|do not|cancel|stop|wait|hold on|never ?mind|not yet|not now|forget it)\b/i;

// Must be a confirmation-SHAPED utterance, not merely one containing a filler
// "ok"/"sure"/"right" somewhere. Anchored at the start of what the user said.
const AFFIRMATION_HEAD =
  /^(yes|yeah|yep|yup|confirm(ed)?|do it|send it|send that|go ahead|go for it|place it|place the order|fill it|execute|make the trade|buy it|sell it|let'?s go|absolutely|for sure|sounds good|sure|okay|ok|affirmative|correct|proceed|approved?)\b/i;

// Only trivial filler may follow the affirmation — anything substantive means
// the user was saying something else (e.g. "ok what about NVDA" is NOT consent).
const ALLOWED_TAIL = /^(please|now|go|go ahead|do it|it|that|thanks|thank you|sounds good|lets go|let s go|man|dude|buddy|for sure|sure|yes|yeah)?$/i;

// True only when the utterance clearly means "yes, do the trade".
export function isAffirmative(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t) return false;
  if (NEGATION.test(t)) return false;            // any negation wins outright
  const m = t.match(AFFIRMATION_HEAD);
  if (!m) return false;
  const tail = t.slice(m[0].length).replace(/[^a-z' ]/gi, " ").replace(/\s+/g, " ").trim();
  return ALLOWED_TAIL.test(tail);
}

// A staged trade can't sit around forever waiting for a stray later confirm.
export const STAGED_TTL_MS = 3 * 60_000;

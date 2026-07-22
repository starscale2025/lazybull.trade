// THE NARRATOR — the terminal's spoken voice. One place composes market
// commentary and routes it to a pair of visually-hidden aria-live regions:
// fills are assertive (they're the moment), everything else polite. The same
// sentences can feed toasts and the voice co-pilot's captions — a11y as the
// product's voice, not a compliance layer.
//
// A real-time trading app previously had ZERO live regions: fills, quote
// ticks and bot verdicts were all silent to assistive tech.

let politeNode: HTMLElement | null = null;
let assertiveNode: HTMLElement | null = null;
let lastMsg = "";
let lastAt = 0;

const HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;";

function ensureNodes() {
  if (politeNode && assertiveNode) return;
  const make = (mode: "polite" | "assertive") => {
    const el = document.createElement("div");
    el.setAttribute("aria-live", mode);
    el.setAttribute("aria-atomic", "true");
    el.setAttribute("role", mode === "assertive" ? "alert" : "status");
    el.style.cssText = HIDDEN_STYLE;
    document.body.appendChild(el);
    return el;
  };
  politeNode = make("polite");
  assertiveNode = make("assertive");
}

export function narrate(text: string, opts?: { assertive?: boolean }): void {
  if (typeof document === "undefined" || !text) return;
  ensureNodes();
  const now = Date.now();
  if (text === lastMsg && now - lastAt < 3000) return; // no stutter
  lastMsg = text;
  lastAt = now;
  const node = opts?.assertive ? assertiveNode! : politeNode!;
  // NO requestAnimationFrame here: rAF never fires in hidden tabs, so a fill
  // narrated while the tab was backgrounded would silently vanish. A changed
  // string announces directly via aria-atomic; only an exact repeat needs the
  // clear-then-set dance (timers still run when hidden, merely clamped).
  if (node.textContent === text) {
    node.textContent = "";
    setTimeout(() => {
      node.textContent = text;
    }, 30);
  } else {
    node.textContent = text;
  }
}

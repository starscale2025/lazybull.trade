// The Volatility Wonk — one function owns the market → letterform mapping.
//
// Fraunces' SOFT/WONK axes carry the day's volatility: VIX 12 = composed,
// upright serifs; VIX 40+ = fully feral cuts. Quantized to 0.1 so the type
// breathes instead of jittering.
//
// All movement happens HERE, as a rAF tween writing inline styles. Chromium
// neither recomputes var() inside font-variation-settings when the custom
// property changes dynamically, nor transitions the property reliably — both
// were tried, both silently froze the type at 0. The CSS var (still set
// below) only exists so late-mounting .wonk-type elements are correct at
// mount; everything already on screen is driven by this tween.

export function wonkFromVix(vix: number): number {
  return Math.round(Math.min(1, Math.max(0, (vix - 12) / 28)) * 10) / 10;
}

let current = 0;
let raf = 0;

export function applyWonk(target: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--market-wonk", String(target));
  if (raf) cancelAnimationFrame(raf);

  const write = (w: number) => {
    const value = `"WONK" ${w.toFixed(3)}, "SOFT" ${(w * 60).toFixed(1)}`;
    for (const el of document.querySelectorAll<HTMLElement>(".wonk-type")) {
      el.style.fontVariationSettings = value;
    }
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    current = target;
    write(target);
    return;
  }

  const from = current;
  const DURATION = 600;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / DURATION);
    const eased = 1 - Math.pow(1 - t, 5); // the house fast-attack/long-settle
    current = from + (target - from) * eased;
    write(current);
    if (t < 1) raf = requestAnimationFrame(tick);
    else raf = 0;
  };
  raf = requestAnimationFrame(tick);
}

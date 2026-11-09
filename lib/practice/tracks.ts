// The five tracks. Mirrors CATEGORY_META in lib/quant/types.ts: a colour is a
// CSS variable reference so it follows the theme, and the hint is the lowercase
// line that sits under the label. One colour for all five since the calm pass
// (S1, 2026-11-09): a track is told by its glyph and name, and the five hues
// it replaced included the gain mint, the loss red and the warning amber.

import type { Track, TrackId } from "./types";

export const TRACK_ORDER: TrackId[] = ["finance", "quant", "ml", "maths", "trading"];

export const TRACK_META: Record<TrackId, Track> = {
  finance: {
    id: "finance",
    label: "Finance",
    hint: "pricing & payoffs",
    color: "var(--brand-ink)",
    glyph: "Σ",
    blurb: "Price it before you trade it — options, bonds, cash flows, drawdowns.",
  },
  quant: {
    id: "quant",
    label: "Quant",
    hint: "the math under the move",
    color: "var(--brand-ink)",
    glyph: "∫",
    blurb: "Ratios, filters and simulations — the instruments the workbench runs.",
  },
  ml: {
    id: "ml",
    label: "ML",
    hint: "labels, leakage, folds",
    color: "var(--brand-ink)",
    glyph: "⟁",
    blurb: "Label without lookahead, split without leakage, stack without lying.",
  },
  maths: {
    id: "maths",
    label: "Maths",
    hint: "numerics that don't lie",
    color: "var(--brand-ink)",
    glyph: "√",
    blurb: "The distributions, roots and matrices every model above stands on.",
  },
  trading: {
    id: "trading",
    label: "Trading",
    hint: "signals & sizing",
    color: "var(--brand-ink)",
    glyph: "◈",
    blurb: "Signals, sizing and the discipline that keeps an account alive.",
  },
};

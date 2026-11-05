// The five tracks. Mirrors CATEGORY_META in lib/quant/types.ts: a colour is a
// CSS variable reference so it follows the theme, and the hint is the lowercase
// eyebrow that sits under the label.

import type { Track, TrackId } from "./types";

export const TRACK_ORDER: TrackId[] = ["finance", "quant", "ml", "maths", "trading"];

export const TRACK_META: Record<TrackId, Track> = {
  finance: {
    id: "finance",
    label: "Finance",
    hint: "pricing & payoffs",
    color: "var(--bull)",
    glyph: "Σ",
    blurb: "Price it before you trade it — options, bonds, cash flows, drawdowns.",
  },
  quant: {
    id: "quant",
    label: "Quant",
    hint: "the math under the move",
    color: "var(--cyan)",
    glyph: "∫",
    blurb: "Ratios, filters and simulations — the instruments the workbench runs.",
  },
  ml: {
    id: "ml",
    label: "ML",
    hint: "labels, leakage, folds",
    color: "var(--bear)",
    glyph: "⟁",
    blurb: "Label without lookahead, split without leakage, stack without lying.",
  },
  maths: {
    id: "maths",
    label: "Maths",
    hint: "numerics that don't lie",
    color: "var(--plasma)",
    glyph: "√",
    blurb: "The distributions, roots and matrices every model above stands on.",
  },
  trading: {
    id: "trading",
    label: "Trading",
    hint: "signals & sizing",
    color: "var(--amber)",
    glyph: "◈",
    blurb: "Signals, sizing and the discipline that keeps an account alive.",
  },
};

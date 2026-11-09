"use client";

// PREDICT-THEN-REVEAL (/learn redesign, phase L1). Before each demo, the copy
// makes you call your shot — a one-tap intuition guess. The pinned demo beside
// it is the reveal: you commit, then watch it prove you right or wrong. Turns a
// page you read into a page that quizzes you.
//
// State is remembered per chapter (one shared localStorage map, so L4's ledger
// can read every call in one place) — scroll back and your answer stands.
// "just show me" skips. Fully keyboard-operable; nothing here needs motion.
//
// Calm (S1, 2026-11-09): a calm panel with the kit's toggle shape, written by
// hand because a committed guess also has to be disabled. The right answer
// fills; a wrong pick is struck through. Mint, red and amber are gone: being
// right about a quiz is not a gain, and nothing here is a warning.

import { useEffect, useState } from "react";

export type PredictConfig = {
  question: string;
  options: { label: string; correct?: boolean }[];
  reveal: string;
};

const KEY = "lb-learn-predict";
type Store = Record<string, { i: number; correct: boolean }>;

export function readPredicts(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function writePredicts(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new Event("lb-learn-progress")); // L4 ledger listens
  } catch {
    /* private mode — the guess just won't persist */
  }
}

export function Predict({ id, cfg }: { id: string; cfg: PredictConfig }) {
  const [guess, setGuess] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const s = readPredicts()[id];
    if (s) {
      setGuess(s.i);
      setDone(true);
    }
  }, [id]);

  const commit = (i: number | null) => {
    const correct = i != null && !!cfg.options[i]?.correct;
    setGuess(i);
    setDone(true);
    if (i != null) {
      const s = readPredicts();
      s[id] = { i, correct };
      writePredicts(s);
    }
  };

  const gotIt = guess != null && !!cfg.options[guess]?.correct;

  return (
    <div className="calm-panel mt-8 p-5">
      <i aria-hidden className="lit-aura" />
      <div className="t-eyebrow text-brand-ink">Call your shot</div>
      <p className="mt-2 max-w-[46ch] font-display text-lg leading-snug text-fg">{cfg.question}</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your prediction">
        {cfg.options.map((o, i) => {
          const isCorrect = done && o.correct;
          const isWrongPick = done && guess === i && !o.correct;
          return (
            <button
              key={o.label}
              disabled={done}
              onClick={() => commit(i)}
              aria-pressed={guess === i}
              className={`calm-toggle disabled:pointer-events-none ${
                isCorrect
                  ? "!bg-fg !text-bg"
                  : isWrongPick
                    ? "!bg-fg/[0.06] !text-fg-dim line-through"
                    : done
                      ? "opacity-50"
                      : ""
              }`}
            >
              {isCorrect ? "✓ " : isWrongPick ? "✕ " : ""}
              {o.label}
            </button>
          );
        })}
      </div>

      {done ? (
        <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed text-fg-dim" aria-live="polite">
          <span className="font-medium text-fg">{gotIt ? "Nailed it. " : guess == null ? "" : "Not quite. "}</span>
          {cfg.reveal} <span className="text-fg-faint">→ the terminal shows it live.</span>
        </p>
      ) : (
        <button onClick={() => commit(null)} className="calm-link mt-3">
          Just show me <span aria-hidden>›</span>
        </button>
      )}
    </div>
  );
}

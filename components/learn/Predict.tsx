"use client";

// PREDICT-THEN-REVEAL (/learn redesign, phase L1). Before each demo, the copy
// makes you call your shot — a one-tap intuition guess. The pinned terminal
// beside it is the reveal: you commit, then watch the live demo prove you
// right or wrong. Turns a page you read into a page that quizzes you.
//
// State is remembered per chapter (one shared localStorage map, so L4's ledger
// can read every call in one place) — scroll back and your answer stands.
// "just show me" skips. Fully keyboard-operable; nothing here needs motion.

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
    <div className="mt-8 border-l-2 border-amber/60 bg-amber/[0.04] py-3 pl-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-amber">
        <span className="size-1 rounded-full bg-amber" /> call your shot
      </div>
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
              className={`h-8 border px-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                isCorrect
                  ? "border-bull/60 bg-bull/15 text-bull"
                  : isWrongPick
                    ? "border-bear/60 bg-bear/10 text-bear line-through"
                    : done
                      ? "border-border bg-bg text-fg-faint"
                      : "border-border bg-bg text-fg-dim hover:border-amber hover:text-fg"
              }`}
            >
              {isCorrect ? "✓ " : isWrongPick ? "✕ " : ""}
              {o.label}
            </button>
          );
        })}
      </div>

      {done ? (
        <p className="mt-3 max-w-[52ch] font-mono text-[12px] leading-relaxed text-fg-dim" aria-live="polite">
          <span className={gotIt ? "text-bull" : "text-amber"}>
            {gotIt ? "Nailed it. " : guess == null ? "" : "Not quite. "}
          </span>
          {cfg.reveal} <span className="text-fg-faint">→ the terminal shows it live.</span>
        </p>
      ) : (
        <button
          onClick={() => commit(null)}
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint underline underline-offset-2 hover:text-fg-dim"
        >
          just show me →
        </button>
      )}
    </div>
  );
}

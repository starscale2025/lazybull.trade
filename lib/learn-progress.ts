"use client";

// Learning progress for /learn (redesign L4). "Concepts" are the eight demo
// chapters that ask you to call your shot (phase L1); answering one unlocks
// it. The ledger, the equity-curve progress, and the §14 diploma all read
// from here — a thin view over the shared lb-learn-predict map, kept live by
// the lb-learn-progress event Predict fires on each guess.

import { useEffect, useState } from "react";

export const LEARN_CHAPTERS = [
  { id: "regime", num: "01", short: "Regime" },
  { id: "three-pieces", num: "02", short: "Primitives" },
  { id: "live-demo", num: "03", short: "Live demo" },
  { id: "backtest", num: "04", short: "Backtest" },
  { id: "consensus", num: "05", short: "Consensus" },
  { id: "greeks", num: "06", short: "Greeks" },
  { id: "volsmile", num: "07", short: "Vol smile" },
  { id: "probability", num: "08", short: "Probability" },
  { id: "families", num: "09", short: "Families" },
  { id: "dataset", num: "10", short: "Dataset" },
  { id: "teacher", num: "11", short: "Teacher" },
  { id: "byob", num: "12", short: "BYO bot" },
  { id: "ai-quants", num: "13", short: "AI quants" },
  { id: "now-go", num: "14", short: "Now go" },
] as const;

// The eight "call your shot" concepts, in page order.
export const CONCEPT_IDS = [
  "regime",
  "live-demo",
  "backtest",
  "consensus",
  "greeks",
  "volsmile",
  "probability",
  "dataset",
] as const;

type PredictMap = Record<string, { i: number; correct: boolean }>;

export function useLearnProgress() {
  const [predicts, setPredicts] = useState<PredictMap>({});
  useEffect(() => {
    const read = () => {
      try {
        setPredicts(JSON.parse(localStorage.getItem("lb-learn-predict") || "{}"));
      } catch {
        /* private mode */
      }
    };
    read();
    window.addEventListener("lb-learn-progress", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("lb-learn-progress", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const answered = CONCEPT_IDS.filter((id) => predicts[id]);
  const correct = answered.filter((id) => predicts[id].correct);
  return {
    predicts,
    answeredCount: answered.length,
    correctCount: correct.length,
    total: CONCEPT_IDS.length,
  };
}

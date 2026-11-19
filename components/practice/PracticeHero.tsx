// The /practice header, in the pitch deck's hand (2026-11-17). Slide 7 calls
// this surface the Quant Playground and gives it one line — it "turns
// knowledge into proven skill" — so that is the headline, set the way the
// deck's cover sets its accent: the last phrase in light green italic, with
// the mark's green full stop. Today's problem sits beside it; under both, the
// deck's figure row (slide 2): a mono label, a light-italic numeral, a line.
//
// Every figure is a fact about the product, not a projection: the problem
// count is the registry's, the case split and the tolerance are the judge's
// (lib/practice/content, lib/practice/judge.ts), and nothing is staked.
//
// PURE — no hooks, no dates. Renders from the server page; TodayCard is the
// one client island (it reads the solver's progress).

import Link from "next/link";
import type { CSSProperties } from "react";
import { DAILY_SLUG, PROBLEMS, getMeta } from "@/lib/practice/problems";
import { TodayCard } from "./TodayCard";

const FIGURES = [
  { label: "Problems", value: String(PROBLEMS.length), line: "across five tracks, from pricing to sizing" },
  { label: "Cases each", value: "3 + 6", line: "three to run as you go, six hidden for the verdict" },
  // lib/practice/judge.ts: |got − expected| ≤ 1e-6 · max(1, |expected|) — six
  // decimal places up to 1, one part in a million above it. The line says both.
  { label: "Graded to", value: "6 dp", line: "six decimal places (one part in a million above 1), on the server" },
  { label: "At risk", value: "$0", line: "paper only · educational · not advice" },
] as const;

const at = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;

export function PracticeHero() {
  const daily = getMeta(DAILY_SLUG);
  return (
    <header className="shell pt-[clamp(2.75rem,6.5vw,5.5rem)]">
      <div className="grid items-end gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0">
          <p className="deck-eyebrow deck-rise">Practice</p>
          <h1 className="deck-h1 deck-rise mt-5 max-w-[14ch] text-fg" style={at(1)}>
            Turn what you learn into <span className="deck-accent">proven skill.</span>
          </h1>
          <p className="deck-lede deck-rise mt-6 max-w-[37rem]" style={at(2)}>
            Forty-eight problems on the maths the workbench actually runs: pricing, risk, labels without lookahead,
            sizing. Your Python runs for real in your browser, and the server grades it against cases you have not
            seen.
          </p>
          <div className="deck-rise mt-9 flex flex-wrap items-center gap-x-7 gap-y-4" style={at(3)}>
            {daily && (
              <Link href={`/practice/${daily.id}`} className="deck-btn deck-btn-primary deck-btn-lg">
                Start today’s problem
                <span aria-hidden className="deck-arrow">
                  →
                </span>
              </Link>
            )}
            <Link href="#problems" className="deck-link">
              Browse all {PROBLEMS.length}
              <span aria-hidden className="deck-arrow">
                ↓
              </span>
            </Link>
          </div>
        </div>
        <TodayCard className="deck-rise" style={at(3)} />
      </div>

      <dl className="deck-rise mt-[clamp(3rem,6vw,4.5rem)] grid grid-cols-2 border-t border-[var(--deck-rule)] lg:grid-cols-4" style={at(4)}>
        {FIGURES.map((f, i) => (
          <div
            key={f.label}
            className={`flex flex-col gap-3 py-6 pr-4 ${i % 2 === 1 ? "border-l border-border pl-5" : ""} ${
              i >= 2 ? "border-t border-border lg:border-t-0" : ""
            } ${i === 2 ? "lg:border-l lg:pl-5" : ""} ${i > 0 ? "lg:pl-6" : ""}`}
          >
            <dt className="deck-label">{f.label}</dt>
            <dd className="deck-figure text-[clamp(2.5rem,4.6vw,3.75rem)] text-fg">{f.value}</dd>
            <dd className="max-w-[16rem] text-[0.875rem] leading-snug text-fg-dim">{f.line}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

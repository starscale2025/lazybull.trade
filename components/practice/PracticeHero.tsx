// The /practice header, on the calm kit (S1, 2026-11-09): eyebrow, the title
// with its one accent, one line, one primary action (today's problem) and a
// quiet link to the tracks, then the three figures as a stat row. It used to
// be a tinted band with a hairline grid of figure boxes, a mono caps eyebrow
// with a rule, and the compliance line in mono caps.
//
// PURE — no hooks, no dates. Renders from the server page.

import { CalmLink, PageHeader, PillLink, Stats } from "@/components/calm/kit";
import { DAILY_SLUG, PROBLEMS, getMeta } from "@/lib/practice/problems";
import { TRACK_ORDER } from "@/lib/practice/tracks";

const FIGURES = [
  { value: String(PROBLEMS.length), label: "problems" },
  { value: String(TRACK_ORDER.length), label: "tracks" },
  { value: "$0", label: "real risk" },
] as const;

export function PracticeHero() {
  const daily = getMeta(DAILY_SLUG);
  return (
    <PageHeader
      eyebrow="Practice"
      title="Solve the market."
      accent="One problem at a time."
      lede="Forty-eight problems on the math the workbench actually runs: pricing, risk, labels without lookahead, sizing. Your Python runs for real, in your browser, and the server grades it against hidden cases to six decimal places. Nothing at stake but your streak."
      actions={
        <>
          {daily && (
            <PillLink href={`/practice/${daily.id}`} kind="primary">
              Start today’s problem
            </PillLink>
          )}
          <CalmLink href="#tracks">Browse the tracks</CalmLink>
        </>
      }
    >
      <Stats items={FIGURES} className="mt-12" />
      {/* The compliance line: one per page, visible without scrolling. */}
      <p className="mt-6 text-[0.8125rem] text-fg-faint">Paper only · educational · not advice</p>
    </PageHeader>
  );
}

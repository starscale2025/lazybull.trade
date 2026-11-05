// The /practice hero. The header band is copied from app/learn/bots/page.tsx
// (lines 32-48): a `bg-bg-soft` band with a hairline under it, `.shell
// section-y-sm`, one t-title display line with a single t-accent phrase and a
// 60ch thesis. The 3-up figure block is the hairline `gap-px bg-border` grid
// from components/learn/Diploma.tsx (lines 103-116), set in t-figure — the one
// rung between chrome and display, for the two or three numbers that matter.
//
// PURE — no hooks, no dates. Renders from the server page.

import { Eyebrow } from "@/components/practice/Chips";
import { PROBLEMS } from "@/lib/practice/problems";
import { TRACK_ORDER } from "@/lib/practice/tracks";

const FIGURES: { value: string; label: string }[] = [
  { value: String(PROBLEMS.length), label: "problems" },
  { value: String(TRACK_ORDER.length), label: "tracks" },
  { value: "$0", label: "real risk" },
];

export function PracticeHero() {
  return (
    <section className="border-b border-border bg-bg-soft">
      <div className="shell section-y-sm">
        <Eyebrow>practice · paper only · educational</Eyebrow>
        <h1 className="mt-3 t-title">
          Solve the market. <span className="t-accent">One problem at a time.</span>
        </h1>
        <p className="mt-4 max-w-[60ch] t-body text-fg-dim">
          Forty-eight problems on the math the workbench actually runs — pricing, risk, labels without
          lookahead, sizing. Your Python runs for real, in your browser, and the server grades it against
          hidden cases to six decimal places. Nothing at stake but your streak.
        </p>

        <div className="mt-6 grid max-w-md grid-cols-3 gap-px border border-border bg-border">
          {FIGURES.map((f) => (
            <div key={f.label} className="bg-bg p-3">
              <div className="t-figure text-fg">{f.value}</div>
              <div className="mt-1 t-chrome text-fg-faint">{f.label}</div>
            </div>
          ))}
        </div>

        {/* The compliance line lives on the hero as well as the board's footer
            strip — the house rule is one per page, visible without scrolling. */}
        <div className="mt-4 t-chrome text-fg-faint">paper only · educational · not advice</div>
      </div>
    </section>
  );
}

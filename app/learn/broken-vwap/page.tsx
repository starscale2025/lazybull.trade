import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BrokenVwap } from "@/components/learn/BrokenVwap";

export const metadata: Metadata = {
  title: "Anatomy of a Broken VWAP · Learn · Lazybull",
  description:
    "We shipped a VWAP that was secretly just typical price. This is the full autopsy — the exact code, the lie it drew, and the test that makes it impossible now.",
};

// THE LESSON THAT CONFESSES (Phoenix Protocol P5). A trading school that
// dissects its own shipped defect in public. The bug becomes the syllabus.
// Every code block on this page is verbatim: the broken function from commit
// e6900cf, the fixed one from components/pro/indicators.ts, the regression
// test from __tests__/pro-indicators.test.ts.

export default function BrokenVwapLesson() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-14">
        {/* ── the confession ─────────────────────────────────────────── */}
        <header data-gsap="fade-up">
          <div className="flex items-center gap-3 t-eyebrow text-fg-faint">
            <span className="border border-bear/40 bg-bear/10 px-1.5 py-0.5 font-semibold text-bear">chapter zero</span>
            <span>the confession</span>
          </div>
          <h1 className="mt-4 t-title">
            Anatomy of a <em className="t-accent text-bear">Broken</em> VWAP
          </h1>
          <p className="mt-5 max-w-[60ch] font-mono text-[13px] leading-relaxed text-fg-dim">
            We shipped this bug. For weeks, the default workspace on{" "}
            <Link href="/pro" className="text-fg underline decoration-border underline-offset-4 hover:decoration-fg">
              /pro
            </Link>{" "}
            drew a line labeled VWAP that was not VWAP. Nobody noticed — least of all us — because it
            looked plausible. This page is the full autopsy: the exact code, the lie it drew, how you
            catch it, and the test that now makes it impossible.
          </p>
        </header>

        {/* ── what VWAP claims to be ─────────────────────────────────── */}
        <section className="mt-14" data-gsap="fade-up">
          <h2 className="t-eyebrow font-semibold text-fg-faint">
            01 · what VWAP claims to be
          </h2>
          <p className="mt-3 max-w-[62ch] font-mono text-[12px] leading-relaxed text-fg-dim">
            Volume-Weighted Average Price: the average price actually paid today, weighted by how much
            volume traded at each price —{" "}
            <code className="text-fg">Σ(typical&nbsp;price&nbsp;×&nbsp;volume) / Σ(volume)</code>, with the
            sums <span className="text-fg">anchored at the session open</span> and reset only when a new
            session starts. Institutions benchmark fills against it. Its whole value is the anchor: it
            remembers the entire day. Break the anchor and you break the meaning.
          </p>
        </section>

        {/* ── the live cell ──────────────────────────────────────────── */}
        <section className="mt-12" data-gsap="fade-up">
          <h2 className="t-eyebrow font-semibold text-fg-faint">
            02 · the same tape, both lines — toggle it
          </h2>
          <div className="mt-4">
            <BrokenVwap />
          </div>
        </section>

        {/* ── the autopsy ────────────────────────────────────────────── */}
        <section className="mt-14" data-gsap="fade-up">
          <h2 className="t-eyebrow font-semibold text-fg-faint">
            03 · the autopsy — the code we actually shipped
          </h2>
          <pre className="mt-4 overflow-x-auto border border-bear/30 bg-surface/60 p-4 font-mono text-[11px] leading-relaxed text-fg-dim">
            <code>{`export function vwap(bars: Bar[]): Series {
  const out: Series = new Array(bars.length).fill(null);
  let cumPv = 0;
  let cumV = 0;
  let lastDay = -1;                                          // ① born a number
  for (let i = 0; i < bars.length; i++) {
    const day = new Date(bars[i].t).toDateString().length;   // ② a string LENGTH
    const dayKey = new Date(bars[i].t).toDateString();
    // reset on session change (UTC day) — close-enough for demo
    if (dayKey !== \`\${lastDay}\`) {                           // ③ "Mon Jul 20 2026" !== "15"
      cumPv = 0;                                             //    …true on EVERY bar
      cumV = 0;
      lastDay = day;
    }
    const tp = (bars[i].h + bars[i].l + bars[i].c) / 3;
    cumPv += tp * bars[i].v;
    cumV += bars[i].v;
    out[i] = cumV ? cumPv / cumV : null;
  }
  return out;
}`}</code>
          </pre>
          <div className="mt-4 max-w-[62ch] space-y-3 font-mono text-[12px] leading-relaxed text-fg-dim">
            <p>
              Three small sins, stacked: <span className="text-bear">①</span> the anchor variable starts
              life as a number. <span className="text-bear">②</span> it gets assigned{" "}
              <code className="text-fg">toDateString().length</code> — the number <code className="text-fg">15</code>,
              the length of <code className="text-fg">&quot;Mon Jul 20 2026&quot;</code>, not the date.{" "}
              <span className="text-bear">③</span> the guard compares the date string against{" "}
              <code className="text-fg">{"`${lastDay}`"}</code> — the string <code className="text-fg">&quot;15&quot;</code>.
              A calendar date never equals its own character count, so the reset fires on{" "}
              <span className="text-fg">every single bar</span>.
            </p>
            <p>
              And Σ(tp·v)/Σv computed over one bar is just… tp. The &quot;VWAP&quot; the default workspace
              drew was <span className="text-fg">typical price in a trench coat</span> — a line that hugs
              every candle and carries zero information. Note the cruelest part: the comment says{" "}
              <em>&quot;close-enough for demo.&quot;</em> TypeScript never complained, because every
              comparison was technically legal. The types were fine. The <em>meaning</em> was gone.
            </p>
          </div>
        </section>

        {/* ── how you catch it ───────────────────────────────────────── */}
        <section className="mt-14" data-gsap="fade-up">
          <h2 className="t-eyebrow font-semibold text-fg-faint">
            04 · how you catch it — assert the MATH, not the render
          </h2>
          <p className="mt-3 max-w-[62ch] font-mono text-[12px] leading-relaxed text-fg-dim">
            Two hourly bars, same session. Bar one trades 100 shares at a typical price of 100; bar two
            trades 300 at 200. A real VWAP must answer <span className="text-fg">175</span> — the
            volume-weighted blend. The broken one answers 200, the second bar&apos;s own typical price.
            One assertion separates them. This is the actual test in our suite, verbatim — and it
            imports <code className="text-fg">vwap</code> from the module that renders on /pro,{" "}
            <span className="text-fg">not a copy</span>:
          </p>
          <pre className="mt-4 overflow-x-auto border border-bull/30 bg-surface/60 p-4 font-mono text-[11px] leading-relaxed text-fg-dim">
            <code>{`describe("vwap — the one we shipped broken", () => {
  it("REGRESSION: intraday sums are CUMULATIVE within a session, not reset per bar", () => {
    const t0 = Date.UTC(2026, 6, 20, 14); // intraday spacing (1h)
    const bars = [bar(t0, 110, 90, 100, 100), bar(t0 + HOUR, 210, 190, 200, 300)];
    const out = vwap(bars);
    const tp1 = (110 + 90 + 100) / 3;             // 100
    const tp2 = (210 + 190 + 200) / 3;            // 200
    const expected = (tp1 * 100 + tp2 * 300) / 400; // 175
    expect(out[1]).toBeCloseTo(expected, 10);
    expect(out[1]).not.toBeCloseTo(tp2, 5); // the broken behavior
  });`}</code>
          </pre>
          <p className="mt-4 max-w-[62ch] font-mono text-[12px] leading-relaxed text-fg-dim">
            The general lesson: an indicator can be plausibly wrong forever, because charts don&apos;t
            have error states — a broken line still draws. The only defense is a test that knows the
            <span className="text-fg"> arithmetic answer</span> in advance and asserts against the code
            that&apos;s actually on screen.
          </p>

          <div className="mt-6 border border-cyan/30 bg-cyan/5 p-4">
            <div className="t-eyebrow font-semibold text-cyan">
              postscript · the test ambushed us a second time
            </div>
            <p className="mt-2 max-w-[60ch] font-mono text-[12px] leading-relaxed text-fg-dim">
              Building this page&apos;s exhibit caught another bug — in the <em>fix</em>. The repaired
              VWAP keyed sessions by <code className="text-fg">toDateString()</code>: the viewer&apos;s{" "}
              <span className="text-fg">local</span> calendar day. A US session runs 13:30–20:00 UTC,
              which crosses midnight in Mumbai — so for a viewer in India, the anchor quietly reset{" "}
              <span className="text-fg">mid-session, at their local midnight</span>. Correct in New
              York, broken in half the world. Sessions now key by UTC day, there are no strings left at
              the crime scene, and that regression is pinned too. Tests don&apos;t just pin the past —
              they ambush the future.
            </p>
          </div>
        </section>

        {/* ── the receipt ────────────────────────────────────────────── */}
        <section className="mt-14 border border-border bg-surface/60 p-5" data-gsap="fade-up">
          <div className="t-eyebrow text-fg-faint">the receipt</div>
          <p className="mt-3 max-w-[60ch] font-mono text-[12px] leading-relaxed text-fg-dim">
            Every indicator on the live chart now carries a{" "}
            <span className="font-semibold text-bull">✓</span> in its legend — hover it and it states the
            exact formula it was verified against, backed by that suite. Go hover the VWAP. It earned
            the checkmark the hard way.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/pro"
              className="inline-flex h-9 items-center bg-bull px-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim"
            >
              open /pro — see the ✓ live
            </Link>
            <Link
              href="/learn"
              className="inline-flex h-9 items-center border border-border bg-bg px-4 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg"
            >
              ← back to the syllabus
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

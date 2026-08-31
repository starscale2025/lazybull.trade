import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/safety" },
  title: "Safety — lazybull",
  description:
    "The Honesty Ledger: how lazybull keeps you safe — paper-only $0 risk, training wheels, a kill switch, and a pre-trade danger check, in plain English.",
};

// The Honesty Ledger, safety edition — the same plain-English contract as
// /terms and /privacy, but for the guardrails. A finance-education product's
// safety story is brand, not fine print, so every commitment carries a mono
// "what this means" note. Server component: crawlable text.

function Clause({ n, title, children, means }: { n: string; title: string; children: React.ReactNode; means: string }) {
  return (
    <section className="border-b border-border-soft py-8">
      <h2 className="flex items-baseline gap-3 font-display text-xl tracking-tightest text-fg">
        <span className="font-mono text-[0.6875rem] text-fg-faint">{n}</span>
        {title}
      </h2>
      <div className="mt-3 max-w-[70ch] space-y-3 t-body text-fg-dim">{children}</div>
      <p className="mt-4 max-w-[70ch] border-l-2 border-bull/50 bg-bull/5 px-3 py-2 font-mono text-[0.75rem] leading-relaxed text-fg-dim">
        <span className="font-semibold uppercase tracking-wider text-bull">what this means · </span>
        {means}
      </p>
    </section>
  );
}

export default function SafetyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="mx-auto w-full max-w-[56.25rem] flex-1 px-5 pb-24 pt-12">
        <div className="flex flex-wrap items-center gap-2 t-eyebrow text-fg-faint">
          <span className="border border-bull/40 bg-bull/10 px-1.5 py-0.5 font-semibold text-bull">the honesty ledger</span>
          <span>safety commitments · effective 24 july 2026</span>
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-tightest">
          Safety, in plain <span className="t-accent">English</span>.
        </h1>
        <p className="mt-3 max-w-[70ch] t-body text-fg-dim">
          Options can wipe out an account faster than almost anything in finance. So lazybull is built to let you learn
          exactly that — how they blow up — without a real dollar on the line. Here is every guardrail, and what each one
          actually does.
        </p>

        <Clause
          n="01"
          title="$0 at risk, by construction"
          means="the strongest safety feature is that there is no real money to lose. Every account is imaginary; nothing you do here can touch a real dollar."
        >
          <p>
            Every trade on lazybull is a <strong className="text-fg">paper trade</strong> — a simulated fill in a practice
            account funded with imaginary dollars. We are not a broker, hold no real money or securities, and route no
            real orders. The worst thing that can happen to your balance is that a pretend number goes down and teaches
            you something. Real options trading carries real, substantial risk; this is where you learn before you ever
            face it.
          </p>
        </Clause>

        <Clause
          n="02"
          title="Training wheels — defined-risk only, with a daily limit"
          means="switch it on and the app refuses to let you build a position that can lose an unbounded amount, and caps how much you can lose in a day. Turn it off deliberately, in safety settings, once you understand the risk."
        >
          <p>
            Training-wheels mode restricts you to <strong className="text-fg">defined-risk strategies</strong> — positions
            whose maximum loss is known and capped — and enforces a daily loss limit. Naked shorts and other
            unbounded-risk trades are blocked while it is on. It is a choice you control in safety settings, not a wall
            we hide behind: you can take it off, but only on purpose.
          </p>
        </Clause>

        <Clause
          n="03"
          title="The kill switch — one control that stops everything"
          means="a single switch freezes all new trading immediately, no questions asked. You reset it yourself when you are ready to continue."
        >
          <p>
            A global kill switch can halt new trades across the whole app in one click, watched by a sentinel that stays
            mounted on every page. It is there for the moment you feel yourself chasing a loss or trading on tilt — the
            behaviors that hurt real traders most. Nothing auto-resets it; you turn it back off deliberately.
          </p>
        </Clause>

        <Clause
          n="04"
          title="The pre-trade danger check"
          means="before you confirm a position that can blow up, we show you — in plain English — exactly how it can, with the max loss spelled out. No surprises at the point of no return."
        >
          <p>
            When you build a trade with unbounded or outsized risk, a pre-trade dialog spells out the max loss, max
            profit, and cost, and — for the dangerous ones — runs a short simulation of how the position can go wrong.
            You confirm with your eyes open. Safety here is not a nag; it is a rehearsal.
          </p>
        </Clause>

        <Clause
          n="05"
          title="We label what is real and what is not"
          means="quotes are real but delayed; the option chain is a synthetic model; your account is imaginary. Never time a real trade on any of it — and the interface always tells you which is which."
        >
          <p>
            Price quotes are third-party and <strong className="text-fg">delayed</strong>. Option chains and their prices
            are <strong className="text-fg">synthetic</strong>, generated from a Black-Scholes model, not live market
            quotes. Seed mode is entirely artificial. Those "synthetic" and "delayed" labels are part of the product on
            purpose, so you never mistake a teaching fixture for a live market. See the{" "}
            <Link className="text-bull underline underline-offset-4" href="/terms">terms ledger</Link> for the full data
            breakdown.
          </p>
        </Clause>

        <Clause
          n="06"
          title="Resets are permanent — and that is the point"
          means="the reset button erases your paper history for good, behind a red warning. Practicing the discipline of a clean slate is part of the lesson."
        >
          <p>
            Resetting your funds permanently erases balances, positions, history, and journal notes, as the reset dialog
            makes clear before you confirm. Simulated history has no monetary value; we preserve it faithfully for
            signed-in users, but you can always wipe it and start over.
          </p>
        </Clause>

        <Clause
          n="07"
          title="Stepping away is always one click"
          means="stop whenever you want — sign out, reset to zero, or just close the tab. Nothing bills you, nothing chases you, and no balance follows you out the door."
        >
          <p>
            There is no money to withdraw, no subscription trapping you, and no dark pattern keeping you in. If lazybull
            ever stops being useful — or fun — you leave, and nothing comes with you. If you want your signed-in data
            deleted, the <Link className="text-bull underline underline-offset-4" href="/privacy">privacy ledger</Link>{" "}
            explains how.
          </p>
        </Clause>

        <Clause
          n="08"
          title="This is education — never advice"
          means="the bots, models, and teacher exist to explain how instruments work. If you trade real money elsewhere based on them, that decision and its risk are yours alone."
        >
          <p>
            Nothing on lazybull is a recommendation, signal, or personalized advice, and simulated performance never
            predicts real performance. Before trading real money anywhere, consider speaking with a licensed
            professional. The full terms live in the{" "}
            <Link className="text-bull underline underline-offset-4" href="/terms">terms ledger</Link>; questions go to{" "}
            <a className="text-bull underline underline-offset-4" href="mailto:hello@lazybull.us">hello@lazybull.us</a>.
          </p>
        </Clause>

        <p className="mt-8 max-w-[70ch] font-mono text-[0.6875rem] leading-relaxed text-fg-faint">
          <span className="text-amber">pending counsel review</span> — this ledger is written plainly and in good
          faith; formal legal review is scheduled.
        </p>
      </main>
      <Footer />
    </div>
  );
}

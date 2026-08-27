import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms — lazybull",
  description:
    "The Honesty Ledger: lazybull's terms in plain English. Paper trading only, education only, never advice, never real money.",
};

// The Honesty Ledger — legal copy in the product's own voice. Every clause is
// plain English, and every clause carries a mono "what this means" note,
// because a finance-education product with unreadable legal pages is teaching
// the wrong lesson. Server component: this page must be crawlable text.

function Clause({ n, title, children, means }: { n: string; title: string; children: React.ReactNode; means: string }) {
  return (
    <section className="border-b border-border-soft py-8">
      <h2 className="flex items-baseline gap-3 font-display text-xl tracking-tightest text-fg">
        <span className="font-mono text-[11px] text-fg-faint">{n}</span>
        {title}
      </h2>
      <div className="mt-3 max-w-[70ch] space-y-3 t-body text-fg-dim">{children}</div>
      <p className="mt-4 max-w-[70ch] border-l-2 border-bull/50 bg-bull/5 px-3 py-2 font-mono text-[12px] leading-relaxed text-fg-dim">
        <span className="font-semibold uppercase tracking-wider text-bull">what this means · </span>
        {means}
      </p>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 pb-24 pt-12">
        <div className="flex flex-wrap items-center gap-2 t-eyebrow text-fg-faint">
          <span className="border border-bull/40 bg-bull/10 px-1.5 py-0.5 font-semibold text-bull">the honesty ledger</span>
          <span>terms of service · effective 22 july 2026</span>
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-tightest">
          Terms, in plain <span className="t-accent">English</span>.
        </h1>

        <Clause n="01" title="What lazybull is — and is not" means="a classroom with a scoreboard, not a brokerage. Nothing here can spend, hold, or lose a real dollar.">
          <p>
            lazybull is an <strong className="text-fg">education platform</strong>. Every trade on this site is a paper
            trade: simulated fills against market data, in a practice account funded with imaginary dollars. lazybull is
            not a broker-dealer, not an investment adviser, not an exchange, and does not accept, hold, or transmit real
            money or real securities. Nothing on this site is an offer to buy or sell anything.
          </p>
        </Clause>

        <Clause n="02" title="Nothing here is financial advice" means="the bots, the models, the teacher, the consensus meter — they are TEACHING AIDS. If you trade real money elsewhere based on them, that is your decision and your risk alone.">
          <p>
            The indicators, quant bots, AI models, probability readouts, and every generated explanation exist to teach
            you how these instruments work. They are not recommendations, signals, or advice, and they are not tailored
            to you. Markets are risky; simulated performance never guarantees anything about real performance. Before
            trading real money anywhere, consider speaking with a licensed professional.
          </p>
        </Clause>

        <Clause n="03" title="The data is a mix — and we label it" means="quotes are real but delayed; the option chain is a synthetic model; your account is imaginary. The interface tells you which is which, on purpose.">
          <p>
            Price quotes come from third-party sources (currently Yahoo Finance) and are <strong className="text-fg">delayed
            and provided as-is</strong> — do not use them to time real trades. Option chains and their prices are{" "}
            <strong className="text-fg">synthetic</strong>, generated from a Black-Scholes model, not real market quotes.
            Seed mode generates entirely artificial price series. We label synthetic data as synthetic wherever it
            appears; those labels are part of the product.
          </p>
        </Clause>

        <Clause n="04" title="Your account" means="sign in with Google, keep your login to yourself, and don't try to break the site. We can suspend accounts that abuse it.">
          <p>
            You may use lazybull signed out (everything stays in your browser) or signed in with Google (your paper
            account, watchlists, and saved setups sync to our servers). You are responsible for activity under your
            account. Do not attempt to disrupt the service, scrape it at abusive rates, probe it for vulnerabilities in
            bad faith, or use it for anything unlawful. We may suspend or delete accounts that do.
          </p>
        </Clause>

        <Clause n="05" title="Resets and simulated history" means="the reset button destroys your paper history — permanently. The big red warning is the contract; this clause is the receipt.">
          <p>
            Paper balances, positions, trade history, and journal notes are simulation state. Resetting your funds
            permanently erases them, as the reset dialog spells out before you confirm. Simulated history has no
            monetary value and no guarantee of retention, though we work to preserve it faithfully for signed-in users.
          </p>
        </Clause>

        <Clause n="06" title="Our stuff, your stuff" means="the site is ours; your journal notes and setups are yours. We only use your content to run the product for you.">
          <p>
            The lazybull software, design, and content are ours (or licensed to us) and protected by law. The content
            you create — journal notes, saved setups, watchlists — remains yours; you grant us the limited license
            needed to store and display it back to you, and nothing more.
          </p>
        </Clause>

        <Clause n="07" title="No warranties; limited liability" means="it's free educational software, provided as-is. Since no real money can pass through it, no real trading losses can come out of it.">
          <p>
            lazybull is provided <strong className="text-fg">"as is," without warranties</strong> of any kind — including
            availability, accuracy of data, or fitness for a particular purpose. To the fullest extent the law allows,
            our liability to you is limited to the amount you paid us to use the service (currently: nothing). We are
            never liable for real-world trading decisions you make anywhere else.
          </p>
        </Clause>

        <Clause n="08" title="Changes and contact" means="if these terms change materially, the effective date at the top changes with them. Questions go to the address below.">
          <p>
            We may update these terms as the product evolves; material changes will be reflected in the effective date
            above. Continued use after a change means you accept it. Questions:{" "}
            <a className="text-bull underline underline-offset-4" href="mailto:hello@lazybull.us">hello@lazybull.us</a>.
            Privacy is covered separately in the{" "}
            <Link className="text-bull underline underline-offset-4" href="/privacy">privacy ledger</Link>.
          </p>
        </Clause>

        <p className="mt-8 max-w-[70ch] font-mono text-[11px] leading-relaxed text-fg-faint">
          <span className="text-amber">pending counsel review</span> — this ledger is written plainly and in good
          faith; formal legal review is scheduled.
        </p>
      </main>
      <Footer />
    </div>
  );
}

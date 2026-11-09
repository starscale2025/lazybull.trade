import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/calm/kit";

export const metadata: Metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/terms" },
  title: "Terms — lazybull",
  description:
    "The Honesty Ledger: lazybull's terms in plain English. Education only, paper trading only, 18+, never advice, never real money — plus how subscriptions, cancellation and Practice certificates actually work.",
};

// The Honesty Ledger — legal copy in the product's own voice. Every clause is
// plain English, and every clause carries a "what this means" note,
// because a finance-education product with unreadable legal pages is teaching
// the wrong lesson. Server component: this page must be crawlable text.
//
// ─── OPEN FOUNDER DECISIONS — do not guess these onto the page ─────────────
// Everything below is deliberately ABSENT from the rendered copy because no
// answer is certain yet. Stating a wrong one is worse than stating none: a
// governing-law clause naming a jurisdiction we are not incorporated in, or a
// refund window we are not contractually able to honour, is a term we would
// have to break. Fill these in once counsel and the entity exist, and track
// them in docs/COMPLIANCE.md (d).
//
// TODO(founders) ENTITY. No company is formed yet. These terms therefore say
//   "we" and "lazybull" and name no legal entity. Once incorporated, name the
//   contracting entity in clause 01 and in clause 12's liability cap.
//
// TODO(founders) GOVERNING LAW AND FORUM. The previous version of this page
//   stated none, and this one does not invent one — it follows from the
//   entity's jurisdiction. Add a governing-law clause (and the dispute forum)
//   once that is decided; do not copy one from another product's terms.
//
// TODO(founders) REFUND POLICY. Clause 05 says refunds follow the policy of
//   whichever provider processed the payment (Lemon Squeezy as merchant of
//   record for USD; Razorpay for INR), which is the only thing that is true
//   today. If we want our own promise on top of that — a 14-day
//   no-questions-asked window, say — confirm we can actually operate it on
//   BOTH rails, then write it here as a stated number. Until then, no number.
//
// TODO(founders) GRIEVANCE OFFICER. Named contact required under the DPDP
//   Act; /privacy currently routes to the address on /about. Same item.
// ───────────────────────────────────────────────────────────────────────────

function Clause({ n, title, children, means }: { n: string; title: string; children: React.ReactNode; means: string }) {
  return (
    <section className="py-7">
      <h2 className="flex items-baseline gap-3 font-display text-2xl tracking-tightest text-fg">
        <span className="font-sans text-[0.8125rem] tabular-nums text-fg-faint">{n}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 t-body text-fg-dim">{children}</div>
      <p className="mt-4 rounded-[14px] bg-fg/5 px-4 py-3 text-[0.9375rem] leading-relaxed text-fg-dim">
        <span className="font-medium text-brand-ink">What this means · </span>
        {means}
      </p>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="page-aura flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="flex-1">
        <PageHeader eyebrow="The honesty ledger" title="Terms, in plain" accent="English.">
          <p className="mt-6 text-[0.8125rem] text-fg-faint">Terms of service · effective 10 September 2026</p>
        </PageHeader>
        <div className="shell pb-24">
          <div className="measure-wide">

            <Clause
              n="01"
              title="What lazybull is — and is not"
              means="a classroom with a scoreboard, not a brokerage. Nothing here can spend, hold, or lose a real dollar."
            >
              <p>
                lazybull is an <strong className="text-fg">education platform</strong>. Every trade on this site is a paper
                trade: a simulated fill in a practice account funded with imaginary dollars. lazybull is{" "}
                <strong className="text-fg">not a broker-dealer, not an investment adviser, not a research analyst, not an
                exchange</strong>, and holds no registration with SEBI, the SEC, or any other regulator. We do not accept,
                hold, or transmit real money or real securities, and we route no orders anywhere. Nothing on this site is an
                offer, a solicitation, or an inducement to buy or sell anything.
              </p>
            </Clause>

            <Clause
              n="02"
              title="Nothing here is advice, and nothing here is a signal"
              means="the bots, the models, the teacher, the agreement meter — they are TEACHING AIDS. Nothing on this site tells you what to buy. If you trade real money elsewhere, that decision and its risk are yours alone."
            >
              <p>
                The indicators, quant bots, AI models, probability readouts, agreement meters, and every generated
                explanation exist to teach you how these instruments behave. They are{" "}
                <strong className="text-fg">not recommendations, not signals, not calls, and not advice</strong>, they are
                not tailored to you, and they are not an opinion about what any security will do next. We do not know your
                income, holdings, goals, or risk tolerance — we deliberately never ask — so nothing here could be
                personalised even in principle. Models are shown as agreement and disagreement between historical rules,
                described in the past tense.
              </p>
              <p>
                Markets are risky and options can lose their entire value quickly. Before trading real money anywhere,
                consider speaking with a licensed professional.
              </p>
            </Clause>

            <Clause
              n="03"
              title="You have to be 18"
              means="adults only. We do not collect parental consent, so we do not admit minors — and if you tell the gate you are under 18, the workbench stays closed."
            >
              <p>
                You must be <strong className="text-fg">18 or older</strong> to use lazybull, and you confirm that at the
                gate before the workbench opens. We do not collect verifiable parental consent, so we do not knowingly let
                anyone under 18 use the product or knowingly process their data. If we learn an account belongs to a minor,
                we will close it. The reasoning is in the{" "}
                <Link className="text-brand-ink underline underline-offset-4" href="/privacy">privacy ledger</Link>.
              </p>
            </Clause>

            <Clause
              n="04"
              title="Your account"
              means="sign in with Google, keep your login to yourself, and don’t try to break the site. We can suspend accounts that abuse it."
            >
              <p>
                You may use lazybull signed out (everything stays in your browser) or signed in with Google (your paper
                account, watchlists, workspaces and Practice history sync to our servers). You are responsible for activity
                under your account and for keeping access to it secure. Do not attempt to disrupt the service, scrape it at
                abusive rates, probe it for vulnerabilities in bad faith, resell or redistribute the market data we display,
                or use it for anything unlawful. We may suspend or delete accounts that do.
              </p>
            </Clause>

            <Clause
              n="05"
              title="Subscriptions, and how to stop paying us"
              means="paid plans renew automatically until you cancel. Cancel whenever you like and you keep the plan until the period you already paid for runs out. Refunds are handled by whoever took the payment."
            >
              <p>
                lazybull has a free tier and paid plans. Payments in{" "}
                <strong className="text-fg">US dollars are processed by Lemon Squeezy, which acts as the merchant of
                record</strong> — they are the seller for that transaction and handle the applicable sales taxes. Payments
                in <strong className="text-fg">Indian rupees are processed by Razorpay</strong>. We never see or store your
                card or bank details on either rail.
              </p>
              <p>
                Paid plans <strong className="text-fg">renew automatically</strong> at the listed price for the interval you
                chose until you cancel. You can cancel at any time; cancellation stops the next renewal and{" "}
                <strong className="text-fg">your plan stays active until the end of the period you have already paid
                for</strong>, after which the account returns to the free tier. Your data is not deleted by a downgrade —
                content beyond a free-tier limit becomes read-only rather than destroyed.
              </p>
              <p>
                <strong className="text-fg">Refunds</strong> are handled under the refund policy of the provider that
                processed your payment — Lemon Squeezy for USD, Razorpay for INR — and requests should go to us first at the
                address in clause 13 so we can raise them. Prices, plan limits, and the contents of a plan may change; a
                change to a plan you are already on takes effect at your next renewal, not mid-period. If a plan is listed
                as a waitlist tier, joining the waitlist charges you nothing and promises no date.
              </p>
            </Clause>

            <Clause
              n="06"
              title="The data is a mix — and we label it"
              means="Indian securities are at least 31 days old, by rule. Quotes elsewhere are delayed. Option chains are a synthetic model. Your account is imaginary. The interface tells you which is which, on purpose."
            >
              <p>
                <strong className="text-fg">Indian securities are deliberately delayed by at least 31 days.</strong> SEBI’s
                norms for using price data in education require a uniform lag for unregistered persons; we apply 31 days —
                one day of margin over the floor — to every Indian symbol, for every user, in every region. It is not a
                setting and there is no paid tier that removes it. Consequently we do{" "}
                <strong className="text-fg">not offer real-time paper trading on Indian securities at all</strong>.
              </p>
              <p>
                Other price quotes come from third-party sources and are <strong className="text-fg">delayed and provided
                as-is</strong> — do not use them to time real trades. Option chains and their prices are{" "}
                <strong className="text-fg">synthetic</strong>, generated from a Black-Scholes model, not real market
                quotes. Seed mode generates entirely artificial price series. We label synthetic data as synthetic and
                delayed data as delayed wherever they appear; those labels are part of the product.
              </p>
            </Clause>

            <Clause
              n="07"
              title="Everything you see is hypothetical"
              means="every result on this site is simulated. It is not a track record, it is not what you would have made, and it says nothing about what any strategy will do next."
            >
              <p>
                Paper results, back-tested bot samples, payoff diagrams, probability readouts and agreement meters are{" "}
                <strong className="text-fg">hypothetical</strong>. Hypothetical results have inherent limitations: they are
                produced with the benefit of hindsight, they do not involve real capital, they cannot reproduce slippage,
                liquidity, assignment, or the emotions of trading with real money, and they may rest on synthetic prices
                rather than executable ones. <strong className="text-fg">Simulated performance is not indicative of future
                results</strong>, and no result shown here is a representation that any person did or would achieve it.
                Nothing on this site states or implies what you will earn.
              </p>
            </Clause>

            <Clause
              n="08"
              title="Practice, and what a certificate is"
              means="a certificate says you solved the problems. It is a completion record for a course you took on a website — not a licence, a qualification, or a professional credential of any kind."
            >
              <p>
                Practice runs your Python in your own browser and sends the outputs to us to be judged against expectations
                we keep server-side. A <strong className="text-fg">Practice certificate is a completion record</strong>: it
                attests that the named account solved the problems in a track on this site, and nothing more. It is{" "}
                <strong className="text-fg">not a professional credential, licence, degree, registration, or
                qualification</strong>, it is not accredited by anyone, it does not authorise you to advise or manage money,
                and it should not be presented as any of those. Certificates are verifiable by their public link so anyone
                can check exactly that limited claim. We may void a certificate obtained by circumventing the judge.
              </p>
            </Clause>

            <Clause
              n="09"
              title="The AI teacher is provided as-is"
              means="it is a language model explaining the position you built. It can be confidently wrong. Check it against the numbers the app already shows you."
            >
              <p>
                The AI teacher and the voice co-pilot run on third-party language models under a prompt that restricts them
                to explaining the position you constructed. They can still be <strong className="text-fg">inaccurate,
                incomplete, or confidently wrong</strong>, and their output is provided as-is with no warranty of
                correctness. Every response is labelled as AI output. It is never advice, and it is not a substitute for
                reading the payoff, the Greeks, and the worst case the app computes for you. Usage limits per plan apply and
                are enforced per UTC day. What is sent to those providers is set out in the{" "}
                <Link className="text-brand-ink underline underline-offset-4" href="/privacy">privacy ledger</Link>.
              </p>
            </Clause>

            <Clause
              n="10"
              title="Resets and simulated history"
              means="the reset button destroys your paper history — permanently. The big red warning is the contract; this clause is the receipt."
            >
              <p>
                Paper balances, positions, trade history, and journal notes are simulation state. Resetting your funds
                permanently erases them, as the reset dialog spells out before you confirm. Simulated history has{" "}
                <strong className="text-fg">no monetary value</strong>, cannot be withdrawn, transferred, or converted into
                anything, and carries no guarantee of retention — though we work to preserve it faithfully for signed-in
                users.
              </p>
            </Clause>

            <Clause
              n="11"
              title="Our stuff, your stuff"
              means="the site is ours; your journal notes, setups and Practice code are yours. We only use your content to run the product for you."
            >
              <p>
                The lazybull software, design, curriculum, and content are ours (or licensed to us) and protected by law.
                The content you create — journal notes, saved setups, watchlists, workspaces, and the code you submit to
                Practice — remains yours; you grant us the limited licence needed to store it, run it through the judge, and
                display it back to you, and nothing more. If you have turned on “help train the teacher,” clause 03 of the{" "}
                <Link className="text-brand-ink underline underline-offset-4" href="/privacy">privacy ledger</Link> governs that
                separate permission, and you can withdraw it at any time.
              </p>
            </Clause>

            <Clause
              n="12"
              title="No warranties; limited liability"
              means="educational software, provided as-is. No real money can pass through it, so no real trading losses can come out of it — and our liability is capped at what you actually paid us."
            >
              <p>
                lazybull is provided <strong className="text-fg">“as is,” without warranties</strong> of any kind —
                including availability, accuracy or timeliness of data, or fitness for a particular purpose. To the fullest
                extent the law allows, we are not liable for indirect, incidental, special, or consequential damages, or for
                lost profits, and{" "}
                <strong className="text-fg">our total liability to you is limited to the amount you paid us in the twelve
                months before the claim</strong> — which, on the free tier, is nothing. We are never liable for real-world
                trading decisions you make anywhere else, on any platform, for any reason. Nothing here limits liability
                that cannot be limited by law.
              </p>
            </Clause>

            <Clause
              n="13"
              title="Changes and contact"
              means="if these terms change materially, the effective date at the top changes with them. Questions go to the address below."
            >
              <p>
                We may update these terms as the product evolves; material changes will be reflected in the effective date
                above. Continued use after a change means you accept it. If you do not, stop using the service and cancel
                any paid plan. Questions:{" "}
                <a className="text-brand-ink underline underline-offset-4" href="mailto:hello@lazybull.us">hello@lazybull.us</a>.
                Privacy is covered separately in the{" "}
                <Link className="text-brand-ink underline underline-offset-4" href="/privacy">privacy ledger</Link>, and the
                guardrails in the{" "}
                <Link className="text-brand-ink underline underline-offset-4" href="/safety">safety ledger</Link>.
              </p>
            </Clause>

            <p className="mt-8 text-[0.8125rem] leading-relaxed text-fg-faint">
              <span className="font-medium text-fg-dim">Pending counsel review</span> — this ledger is written plainly and in good
              faith; formal legal review is scheduled.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

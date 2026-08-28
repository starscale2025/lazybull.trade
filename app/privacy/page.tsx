import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/privacy" },
  title: "Privacy — lazybull",
  description:
    "The privacy ledger: exactly what lazybull collects (a Google profile, a paper account, product events), where the voice co-pilot sends what you say, and what it never touches — money, cards, real trades.",
};

// The privacy half of the Honesty Ledger. Same voice as /terms: every section
// plain-English with a mono "what this means" note. Server component — this
// page must be crawlable text.

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

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 pb-24 pt-12">
        <div className="flex flex-wrap items-center gap-2 t-eyebrow text-fg-faint">
          <span className="border border-bull/40 bg-bull/10 px-1.5 py-0.5 font-semibold text-bull">the honesty ledger</span>
          <span>privacy policy · effective 18 august 2026</span>
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-tightest">
          What we know, <span className="t-accent">exactly</span>.
        </h1>

        <Clause n="01" title="What we collect" means="a Google profile if you sign in, your paper-trading state so it can follow you across devices, and product events so we can see what's used. That's the whole list.">
          <p>Three categories, nothing hidden:</p>
          <p>
            <strong className="text-fg">Account</strong> — if you sign in with Google: your name, email address, and
            avatar, plus the session records needed to keep you signed in.{" "}
            <strong className="text-fg">Paper-trading state</strong> — your simulated account (balance, positions,
            orders, history, journal notes), watchlists, and saved setups, synced so your other devices see them.{" "}
            <strong className="text-fg">Product events</strong> — things like "page viewed," "order submitted," "bot
            run," with a random device identifier, so we can understand which features matter and improve them.
          </p>
        </Clause>

        <Clause n="02" title="What we never collect" means="no card numbers, no bank accounts, no government IDs, no real brokerage anything. The product is paper-only, so the data is too.">
          <p>
            We take no payments today, so we hold no payment data. We never ask for and never store card numbers, bank
            details, tax or government identifiers, or credentials to any real brokerage. Signed out, your paper account
            lives only in your browser's localStorage and never reaches our servers.
          </p>
        </Clause>

        <Clause n="03" title="Where it lives" means="a MongoDB Atlas database and your own browser. Quotes are fetched from Yahoo by OUR servers — your identity is not forwarded to data providers.">
          <p>
            Server-side data is stored in MongoDB Atlas. Client-side, we use localStorage for your practice account,
            preferences (like data mode), and the anonymous device id — plus the cookies Google sign-in requires for
            your session. Market quotes are proxied through our servers from Yahoo Finance; your name and email are not
            part of those requests.
          </p>
        </Clause>

        <Clause n="04" title="What we do with it" means="run the product, fix the product, improve the product. We don't sell data and we don't run ad trackers. The only outsiders are the infrastructure that hosts it, Google, and the AI providers in clause 05.">
          <p>
            We use your data to operate the features you use (sync, sign-in), to debug problems, and — via aggregate
            product events — to decide what to build next. We do not sell or rent personal data, and we run no
            third-party advertising trackers. The only parties that touch data are the infrastructure providers that
            host it (e.g. our database and hosting), Google, which handles the sign-in itself and — on Chrome and
            Edge — the speech recognition behind the free voice engine, and — if you use the voice co-pilot or an AI
            explainer — the AI providers named in clause 05.
          </p>
        </Clause>

        <Clause n="05" title="Voice and the AI features" means="the co-pilot works by sending what you say — and what's on your chart — to an AI company. Nothing else on lazybull talks to a model; the engine-by-engine detail is spelled out above.">
          <p>
            The co-pilot has no brain of its own. Whichever engine you run, it is shown the same picture of your
            workspace — symbol, indicators, alerts and their notes, watchlist, paper orders — plus the computed read of
            the live chart. The free engine attaches both to every turn; the premium engine is handed them whenever it
            reads your screen, which it does from the opening greeting onward. Your name, email, and session are not
            part of any of it — but everything you say to the co-pilot is.
          </p>
          <p>
            On the <strong className="text-fg">free voice engine</strong>, your speech is turned into text by your
            browser's built-in recognition: on Chrome and Edge — the browsers this engine actually works in — that
            means the raw microphone audio is uploaded to <strong className="text-fg">Google's speech service</strong>.
            The transcript then goes with the context above to <strong className="text-fg">OpenRouter</strong>, which
            routes it to a free community model. Free models are only served to accounts that allow prompt logging, so
            assume the provider stores those prompts and may use them to train future models.
          </p>
          <p>
            The <strong className="text-fg">premium voice engine</strong> streams your microphone audio from your
            browser straight to <strong className="text-fg">OpenAI</strong>, and sends the same workspace and chart
            context down the same connection — so it discloses more than the free engine, not less, just to one named
            company instead of two. The options explainers send the trade's parameters (strategy, strikes, break-evens
            — not who you are) to OpenAI too. If you would rather none of this leaves your machine, don't start the
            co-pilot and don't press explain; nothing else on lazybull talks to a model. Moving the free engine onto a
            paid, no-retention tier is the fix we want, and this clause changes the day it lands.
          </p>
        </Clause>

        <Clause n="06" title="How long, and how to leave" means="data stays while your account is active; email us and we delete the lot. Signed-out data is yours to clear from your own browser.">
          <p>
            Account data is kept while your account is active. To delete your account and everything attached to it,
            email{" "}
            <a className="text-bull underline underline-offset-4" href="mailto:hello@lazybull.us">hello@lazybull.us</a>{" "}
            from your sign-in address and we will remove it. Signed-out practice data can be cleared any time via your
            browser's site-data controls (or the in-app reset button).
          </p>
        </Clause>

        <Clause n="07" title="Changes and contact" means="material changes move the effective date at the top. Same address for every question.">
          <p>
            If this policy changes materially, the effective date above changes with it. Questions, requests, or
            complaints:{" "}
            <a className="text-bull underline underline-offset-4" href="mailto:hello@lazybull.us">hello@lazybull.us</a>.
            The service terms live in the{" "}
            <Link className="text-bull underline underline-offset-4" href="/terms">terms ledger</Link>.
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

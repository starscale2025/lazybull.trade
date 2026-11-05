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
    "The privacy ledger: exactly what lazybull collects (a Google profile, a paper account, consented product events, practice submissions, billing metadata), who processes it, how long it is kept, and what it never touches — card numbers, real trades, minors.",
};

// The privacy half of the Honesty Ledger. Same voice as /terms: every section
// plain-English with a mono "what this means" note. Server component — this
// page must be crawlable text.
//
// THE CATEGORIES BELOW MUST MATCH lib/consent.ts. The gate collects exactly
// two purpose toggles — `analytics` and `training` — behind one 18+ gate, and
// CONSENT_TEXT_VERSION ("2026-09-08") re-prompts everyone if that wording
// changes. If you edit clause 05 here, check the gate copy and bump that
// constant; a re-worded purpose that silently inherits an old yes is the one
// failure mode this whole system exists to prevent.
//
// TODO(founders): DPDP requires a named grievance officer with a working
// contact. No grievance mailbox is known to exist, so clause 09 routes people
// to the address published on /about rather than inventing an inbox that
// bounces. Create grievance@ (or name the founder who owns it), then put the
// name and address here. See docs/COMPLIANCE.md (d).

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

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="mx-auto w-full max-w-[56.25rem] flex-1 px-5 pb-24 pt-12">
        <div className="flex flex-wrap items-center gap-2 t-eyebrow text-fg-faint">
          <span className="border border-bull/40 bg-bull/10 px-1.5 py-0.5 font-semibold text-bull">the honesty ledger</span>
          <span>privacy policy · effective 10 september 2026</span>
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-tightest">
          What we know, <span className="t-accent">exactly</span>.
        </h1>
        <p className="mt-3 max-w-[70ch] t-body text-fg-dim">
          Seven categories, and we can name every field in them. If something is not on this page, we do not collect it.
        </p>

        <Clause
          n="01"
          title="What we collect"
          means="a Google profile if you sign in, your paper account, consented product events, your consent record itself, your practice submissions, billing metadata from the payment provider, and whatever you type into the AI teacher. That is the whole list."
        >
          <p>
            <strong className="text-fg">Account</strong> — if you sign in with Google: your name, email address, and
            avatar, plus the session records that keep you signed in.
          </p>
          <p>
            <strong className="text-fg">Paper-trading state</strong> — your simulated account (balance, positions,
            orders, history, journal notes), watchlists, and saved workspaces, synced so your other devices see them.
            Signed out, this lives only in your browser and never reaches our servers.
          </p>
          <p>
            <strong className="text-fg">Product events</strong> — only if you leave the analytics toggle on. Each event
            is an event name, a timestamp, a random device identifier, the page path, the schema version the client
            stamped on it, and a country code our server derives from the connection (ISO-2 — a country, never an IP we
            keep). The first page view of a session may also carry the <em>host</em> of the site that referred you and
            the first-touch campaign tags from the link you arrived on. No event carries your name, your email, or
            anything you typed.
          </p>
          <p>
            <strong className="text-fg">Your consent record</strong> — the decision itself: that you confirmed you are
            18 or older, your two purpose toggles, when you chose, and which version of the wording you agreed to. It
            lives on your device. If you are 18 or older and turn either purpose on, a copy is stored server-side as the
            audit trail for that consent, keyed to a random device id (or to your account when you are signed in), with
            your country and browser type. If you turn both off, nothing is sent. An under-18 answer is <strong className="text-fg">never sent to us</strong> — see clause 06.
          </p>
          <p>
            <strong className="text-fg">Practice submissions</strong> — when you submit a Practice problem: the
            problem, the outcome, the runtime, and a hash of your normalised code. For signed-in users we also store{" "}
            <strong className="text-fg">the code you submitted</strong>, so your own history and any certificate you
            earn can be shown back to you and verified. Write nothing private in that editor.
          </p>
          <p>
            <strong className="text-fg">Billing metadata</strong> — if you subscribe: the plan, status, currency,
            recurring amount, renewal date, and the subscription id our payment provider gives us. We never see, never
            receive, and never store card numbers, UPI handles, or bank details — those are handled entirely by Lemon
            Squeezy or Razorpay on their own pages.
          </p>
          <p>
            <strong className="text-fg">AI-teacher and voice requests</strong> — what you send to a model. Detailed in
            clause 04, because it is the one place your words leave our infrastructure.
          </p>
        </Clause>

        <Clause
          n="02"
          title="What we never collect"
          means="no card numbers, no bank details, no government IDs, no brokerage credentials, no financial profile. We could not tailor advice to you even if we wanted to — we do not know anything about your money."
        >
          <p>
            We never ask for and never store card or bank details, tax or government identifiers, or credentials to any
            real brokerage. We also never ask for your income, net worth, holdings, risk tolerance, or investment
            goals — the inputs that would turn education into personalised advice. We run{" "}
            <strong className="text-fg">no third-party advertising trackers</strong>, no ad pixels, and no cross-site
            profiling, and we do not sell or rent personal data to anyone, for any price.
          </p>
        </Clause>

        <Clause
          n="03"
          title="What we do with it"
          means="operate the product, debug it, and improve it. Your decision traces only train the AI teacher if you switched that second toggle ON — it is off by default and it is not bundled with anything else."
        >
          <p>
            Three purposes: <strong className="text-fg">operate</strong> (sign you in, sync your paper account, serve
            your plan, judge your Practice runs), <strong className="text-fg">debug</strong> (find and fix what breaks),
            and <strong className="text-fg">improve</strong> (aggregate product events tell us which features earn their
            place).
          </p>
          <p>
            There is a fourth purpose and it is separate on purpose:{" "}
            <strong className="text-fg">improving the AI teacher</strong> from decision traces keyed to a random device id (pseudonymous, not anonymous) — your drags,
            undos and re-asks. That happens <strong className="text-fg">only</strong> if you turned on "help train the
            teacher," which is off unless you switch it on. Leaving it off costs you nothing and changes no feature.
          </p>
        </Clause>

        <Clause
          n="04"
          title="The AI teacher, and the voice co-pilot"
          means="press explain and the position you built — strikes, expiries, break-evens — goes to a model provider. Start the voice co-pilot and everything you say goes too. Neither is on unless you start it, and neither is told who you are."
        >
          <p>
            The <strong className="text-fg">AI teacher</strong> is handed the position on your canvas — strategy, legs,
            strikes, expiries, break-evens, the computed Greeks — and asked to explain it. It runs on a locked prompt
            that only describes what you already built: it does not recommend, does not size, and does not forecast.
            Every answer is labelled as AI output. Your name, email, and session are not part of the request. When no
            model key is configured the product answers from a deterministic local fallback instead, and says so.
          </p>
          <p>
            The <strong className="text-fg">voice co-pilot</strong> discloses more, so read this before you start it. It
            is shown the same picture of your workspace — symbol, indicators, alerts and their notes, watchlist, paper
            orders — plus the computed read of the chart. On the free engine, your speech is turned into text by your
            browser's built-in recognition, which on Chrome and Edge means the raw microphone audio is uploaded to{" "}
            <strong className="text-fg">Google's speech service</strong>; the transcript then goes to{" "}
            <strong className="text-fg">OpenRouter</strong>, which routes it to a free community model. Free models are
            only served to accounts that allow prompt logging, so assume that provider stores those prompts and may use
            them to train future models. The premium engine streams your microphone audio straight to{" "}
            <strong className="text-fg">OpenAI</strong> and sends the same context down the same connection — more
            disclosure than the free engine, but to one named company instead of two.
          </p>
          <p>
            If you would rather none of this leaves your machine: don't press explain and don't start the co-pilot.
            Nothing else on lazybull talks to a model.
          </p>
        </Clause>

        <Clause
          n="05"
          title="Consent, and taking it back"
          means="one 18+ confirmation and two independent toggles. Both start off, and neither is a condition of using the product. Change your mind whenever you like."
        >
          <p>
            Before the workbench opens you answer three things. <strong className="text-fg">"I am 18 or older"</strong>{" "}
            is required — see clause 06. <strong className="text-fg">"Product analytics"</strong> (off by default) covers
            what you do in the app — pages, paper trades, explanations asked — so we can improve it; never sold, never
            advertising. <strong className="text-fg">"Help train the teacher"</strong> (off by default) allows your
            decision traces — drags, undos, re-asks — keyed to a random device id, to be used to improve the AI teacher.
          </p>
          <p>
            Your answers are stored on this device (and, if you turn either purpose on, copied to our server as
            described in clause 01), and the record notes which wording you agreed to. If we materially
            change what that dialog says, we ask again rather than assume. You can withdraw either toggle at any time
            from the consent controls; product events stop at the moment you do, and the training permission stops
            applying to anything collected afterwards. Neither toggle gates a feature.
          </p>
        </Clause>

        <Clause
          n="06"
          title="18+ only — and why"
          means="the product is for adults. If you tell the gate you are under 18 the workbench closes, nothing is tracked, and that answer is never sent to us at all."
        >
          <p>
            lazybull is an <strong className="text-fg">18+ product</strong>. India's DPDP rules ban behavioural
            monitoring of under-18s without verifiable parental consent, and we do not collect a parent's consent — so
            we do not let minors in rather than pretend we can supervise it. We do not knowingly collect or process the
            personal data of anyone under 18.
          </p>
          <p>
            An under-18 answer stays on the device and is never posted to our servers: sending us a record that says "a
            child answered here," stamped with a device id, would itself be processing a child's data. Locally it closes
            the workbench and turns tracking off. If you believe a minor has an account with us, write to us using
            clause 09 and we will delete it.
          </p>
        </Clause>

        <Clause
          n="07"
          title="Who else touches it"
          means="the companies that host, store, authenticate, explain and charge. That is the entire list, and the market-data vendors are not on it — they never learn who you are."
        >
          <p>
            <strong className="text-fg">Vercel</strong> hosts and serves the app.{" "}
            <strong className="text-fg">MongoDB Atlas</strong> stores server-side data.{" "}
            <strong className="text-fg">Google</strong> handles sign-in, and — on Chrome and Edge — the speech
            recognition behind the free voice engine. The <strong className="text-fg">AI providers</strong> named in
            clause 04 receive what you send the teacher or the co-pilot.{" "}
            <strong className="text-fg">Lemon Squeezy</strong> (USD, as merchant of record) and{" "}
            <strong className="text-fg">Razorpay</strong> (INR) take payments and send us subscription metadata.
          </p>
          <p>
            <strong className="text-fg">Market-data vendors receive no identity.</strong> Quotes are fetched by our
            servers, not by your browser, and those requests carry a symbol — never your name, email, device id, or
            address.
          </p>
          <p>
            These providers operate in the United States, the European Union, and India, so running lazybull means your
            data is processed outside the country you are in. We only use providers under contracts that bind them to
            process it for us and not for themselves.
          </p>
        </Clause>

        <Clause
          n="08"
          title="How long we keep it"
          means="events for 24 months, consent records for as long as you have an account plus three years, everything else while your account is alive. Ask and we delete."
        >
          <p>
            <strong className="text-fg">Product events</strong> are retained for 24 months and then deleted.{" "}
            <strong className="text-fg">Consent records</strong> are kept for the life of the account plus three years —
            they are the proof of what you agreed to and when, so they have to outlive the data they governed.{" "}
            <strong className="text-fg">Account, paper-trading, Practice and billing</strong> data is kept while your
            account is active, except where a payment provider or tax law requires a transaction record to be held
            longer.
          </p>
          <p>
            Signed-out data — your local paper account, preferences, and the consent record on your device — can be
            cleared any time from your browser's site-data controls or the in-app reset.
          </p>
        </Clause>

        <Clause
          n="09"
          title="Your rights, and how to use them"
          means="ask us for a copy, a correction, or a deletion and we will do it. Complaints go to the founders directly — the address is on the about page."
        >
          <p>
            You can ask us to give you a copy of your data, correct it, delete it, or tell you who we shared it with,
            and you can nominate someone to exercise those rights if you cannot. To delete your account and everything
            attached to it, email{" "}
            <a className="text-bull underline underline-offset-4" href="mailto:hello@lazybull.us">hello@lazybull.us</a>{" "}
            from your sign-in address. Withdrawing consent is clause 05 and needs no email at all.
          </p>
          <p>
            <strong className="text-fg">Grievances.</strong> If you are unhappy with how we handled a request, write to
            the founders at the address published on our{" "}
            <Link className="text-bull underline underline-offset-4" href="/about">about page</Link>. We are three
            people; it reaches all of us. Under India's DPDP Act you may escalate to the Data Protection Board if we do
            not resolve it.
          </p>
        </Clause>

        <Clause
          n="10"
          title="Changes and contact"
          means="material changes move the effective date at the top — and if they change what the consent dialog says, you get asked again instead of being assumed into it."
        >
          <p>
            If this policy changes materially, the effective date above changes with it. If a change alters what the
            consent dialog asks you for, the dialog reappears and your previous answer does not carry over. Questions or
            requests:{" "}
            <a className="text-bull underline underline-offset-4" href="mailto:hello@lazybull.us">hello@lazybull.us</a>.
            The service terms live in the{" "}
            <Link className="text-bull underline underline-offset-4" href="/terms">terms ledger</Link>, and the
            guardrails in the{" "}
            <Link className="text-bull underline underline-offset-4" href="/safety">safety ledger</Link>.
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

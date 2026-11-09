# Compliance, as engineering

**This is an engineering document, not legal advice.** Nobody here is a lawyer.
It records what we believe the rules require, and — the part that matters — the
line of code that answers each one, so a future change that breaks a commitment
shows up as a diff and not as a letter from a regulator. Everything in section
(d) is still open and needs counsel.

The premise: regulators read *features and copy*, not disclaimers. A page that
says "educational purposes only" at the bottom and gives a stock-specific entry
and target at the top is advice with a footer. So every rule below is answered
by a mechanism — a constant, a prompt, a schema, a lint — that keeps working
when the marketing copy is rewritten by someone who never read this file.

---

## (a) What lazybull is, under Indian and US law

| Claim | Why it holds |
| --- | --- |
| **Education** | The product teaches how options behave. It explains the position *you* built; it never proposes one. |
| **Paper-only** | Every fill is simulated against a $5,000 imaginary balance. There is no live account anywhere in the system. |
| **No custody** | We never hold, receive, or transmit client money or securities. Subscription money goes to a merchant of record / payment gateway, never to a client account, because there are no client accounts. |
| **No order routing** | There is no broker integration, no OMS, no exchange connectivity. Nothing leaves the process that could become an order. |
| **Impersonal** | No output is tailored to a user's finances, holdings, risk tolerance, or goals. We never ask for them, so we could not tailor if we wanted to. Bots and models are described in the past tense, as historical rules, to every reader identically. |

Two consequences we design around. In India, "investment advice" under the SEBI
(Investment Advisers) Regulations turns on advice *concerning securities,
tailored or presented as suitable* — impersonal education sits outside it, and
the moment content becomes stock-specific and forward-looking it stops being
education whatever it is labelled. In the US, *Lowe v. SEC* protects bona fide
impersonal publications; the protection evaporates for person-specific,
subscriber-tailored advice. Both roads lead to the same engineering rule:
**impersonal, historical, never forward-looking about a named security.**

---

## (b) Each rule, and the code that answers it

### 1. SEBI circular, 8 May 2026 — price data for educational purposes

Unregistered persons using price data for education must use data with a
**uniform lag of at least 30 days**, effective 1 July 2026.

**Answered by** `lib/region.ts`:

```
export const LAG_DAYS = 31;
export const LAG_POLICY = "sebi-education-lag-31d";
```

31, not 30 — one day of margin so a clock skew or a timezone off-by-one on
either side can never produce a 29-day-old bar. The lag is applied by symbol
classification, not by viewer location: an Indian security is lagged for
*everyone*, everywhere. Viewer region is informational only and drives banner
copy, never data. Every lagged response carries `lag: { delayed, asOf, policy,
lagDays }`, and `LAG_LABEL` renders the rule by name so the UI says *why* it is
delayed, not merely that it is.

Also: `MARKET_DATA_ALLOW_YAHOO` is off in production. The scraped fallback is a
development convenience, and it must be retired before we charge for anything
that depends on data (see (d)).

### 2. SEBI FAQ, 29 January 2025 — educators and recent price data

Educators must not use recent price data in a way that *indicates future prices*
or amounts to advice.

**Answered by** three mechanisms:

- **The locked teacher prompt** (`app/api/explain/route.ts`). The system prompt
  is a constant in the route, not a user-supplied string. It explains only the
  position already on the canvas — what each leg does, where the break-evens
  are, what the Greeks mean, what the worst case is. It is instructed never to
  recommend, never to size, never to forecast a price or a direction. Every
  response ships with an AI-output disclosure. With no API key set, a
  deterministic mock answers instead of a model, so the shape of the output is
  the same in every environment.
- **Impersonal bot copy** (`lib/quant/**`). The 27 instruments are described as
  historical rules in the past tense — what the rule did over a sample — never
  as something that will do anything next.
- **No accuracy leaderboards.** The Practice leaderboard ranks on solves and
  then time. It never ranks on money, P&L, or predictive accuracy, because a
  scoreboard of who predicted best is a forecast product wearing a game's
  clothes.

### 3. Avadhut Sathe interim order, SEBI, December 2025 — advice under cover of education

An "academy" ran education whose substance was advice: stock-specific entry and
exit calls, targets, live trading rooms alongside the course. SEBI treated it as
unregistered investment advice and impounded ₹546 crore.

**What lazybull never does**, and where that is enforced:

- no stock-specific calls, entries, exits or targets — `scripts/check-compliance.mjs` rules `instruct-trade`, `signal`, `fires`;
- no live trading room, no real-time call channel, no "follow along" session;
- no performance or profit claims — rules `earnings`, `edge-claim`, `accuracy-77`;
- no position sizing — rule `sizing`;
- no framing of the models as something that trades for you — rule `bots-watching`.

### 4. SEBI advisory, November 2024 — unregistered virtual trading / gaming platforms using real-time data

SEBI cautioned the public against platforms offering virtual trading or gaming
services **on real-time market data of listed securities**, including ones
promising returns.

**Answered by** the same `LAG_DAYS = 31` path. Indian securities reach the paper
engine already lagged, which means **real-time Indian paper trading is not
offered at all** — not as a plan, not as an upgrade, not behind a flag. There is
no prize, no entry fee, no payout: the balance is imaginary and cannot be
converted into anything. Subscriptions buy usage limits (explains, workspaces,
bots), never a trading advantage or a stake.

### 5. DPDP Act 2023 — Rules notified 13 November 2025

Full compliance 13 May 2027. Notice-and-consent per purpose, verifiable consent,
and a ban on behavioural monitoring and targeted advertising directed at
children without verifiable parental consent.

**Answered by** `lib/consent.ts` and the gate that writes it:

- **18+ gate.** The product is 18+ because we do not collect verifiable parental
  consent, and the target demographic (students learning options) certainly
  contains under-18s. An under-18 answer closes the workbench and turns tracking
  off. It is **never posted to the server** — shipping a "child said no" record
  with a device id would itself be processing a child's data. `isMinor()` keeps
  this state distinct from "undecided" so the gate shows the blocked state
  rather than re-prompting.
- **Purpose-separated consent.** `ConsentRecord` is `{ v, adult, analytics,
  training, at, text }`. Analytics (default off) and AI-training use (default
  off) are separate booleans, because bundling them into one "accept" is exactly
  the consent the DPDP rules do not recognise. `analyticsAllowed()` gates
  `lib/track.ts`; `trainingAllowed()` gates any use of decision traces for
  teacher improvement.
- **Re-consent on re-wording.** `CONSENT_TEXT_VERSION = "2026-09-08"` records
  *which wording* was agreed to. `consentGateNeeded()` re-prompts when the
  stored text version differs, so a re-worded purpose can never silently
  inherit an old yes.
- **Retention.** Product events 24 months; consent records for the life of the
  account plus 3 years (they are the audit trail for the consent itself);
  deletion on request. Stated on `/privacy`.
- **Withdrawal.** `clearConsent()` is reachable from the UI; tracking stays off
  until a new yes.
- **Availability.** The server copy (`lib/db/consent.ts`) is an audit trail and
  is never required — with no `MONGODB_URI` the gate still works and local
  consent still applies.

Still open: a named grievance officer and a working grievance mailbox (see (d)).

### 6. US — *Lowe v. SEC*, 472 U.S. 181 (1985)

The publisher's exclusion covers bona fide, regular-circulation publications
offering impersonal advice; it does not cover person-specific advice.

**Answered by** the impersonal rule above: no user financial profile is
collected, no output is conditioned on one, and every reader of a given bot or
chapter sees the same words. The AI teacher describes the position on the
canvas; it is not given, and does not ask for, anything about the person.

### 7. US — FTC enforcement on earnings claims by trading educators

*Online Trading Academy* (2020) and *IM Mastery Academy* (2026, lead defendants
turning over tens of millions in assets to settle) are the pattern: trading
educators prosecuted for the income and performance claims in their marketing.

**Answered by** a mechanical ban on income claims —
`scripts/check-compliance.mjs` rules `earnings`, `edge-claim`, `accuracy-77`,
`seeded-fake`, `fake-prediction` — plus hypothetical labelling everywhere a
number appears: simulated results are labelled simulated, synthetic chains are
labelled synthetic, and historical bot samples are labelled as out-of-sample
history, in the past tense. No testimonial implies income. No page states or
implies what a user will earn.

### 8. The SEC marketing rule

Rule 206(4)-1 binds **registered investment advisers**. lazybull is not one and
does not hold itself out as one, so the rule does not apply. We follow its
hypothetical-performance instincts anyway — label the hypothetical, do not
cherry-pick, show the loss cases — because they are also how you avoid (7).

---

## (c) The copy rules the lint enforces

`scripts/check-compliance.mjs` scans every copy-bearing `.ts`/`.tsx` under
`app/`, `components/`, `lib/`, `lib/quant/` and `lib/practice/content/` for
banned vocabulary and exits non-zero on a hit. It is wired into `npm run
verify`. **It is a lint, not a lawyer** — a clean run means no banned phrase was
found, never that a page is lawful.

Run `node scripts/check-compliance.mjs --list` for the live list. As of this
writing, eighteen rules:

| id | what it catches |
| --- | --- |
| `sizing` | tells the reader how much to risk — a personalised sizing recommendation |
| `instruct-trade` | instructs a trade; education describes what a rule did, never what to do |
| `signal` | frames model output as an actionable signal |
| `fires` | signal language; describe the historical rule in the past tense instead |
| `earnings` | an earnings claim — the exact thing the FTC prosecutes educators for |
| `edge-claim` | promises an edge; say what the historical sample showed |
| `ultra-tier` | a confidence band named like a trade grade; use the agreement labels |
| `accuracy-77` | outside the canonical out-of-sample band (55–66%) |
| `dead-domain` | a domain that does not resolve; the site is lazybull.us and the brand is lazybull |
| `bots-watching` | positions the models as something that trades for you |
| `fake-prediction` | a fabricated prediction rendered as decoration |
| `seeded-fake` | fabricated figures presented as product; make the number real or omit it |

**The allow-list is empty, and that is the target state.** A legitimate hit — a
page quoting the words we promise never to say — goes in
`scripts/compliance-allow.txt` as `path:pattern-id` with a `#` comment saying
why. Before adding one, reword. Widening a rule to dodge a failure is the single
edit this lint exists to prevent.

---

## (d) Open items for counsel

None of these are engineering problems. All of them block something.

- [ ] **Entity.** No company is formed. Three student co-founders in India,
      pre-revenue, now taking subscription money. Decide the entity and the
      jurisdiction it sits in *before* the first charge settles. Until it
      exists, the legal pages name no entity and state no governing law — the
      placeholders are marked with `TODO(founders)` comments in
      `app/terms/page.tsx`.
- [ ] **Governing law and dispute forum.** Currently absent from `/terms`, on
      purpose: it follows from the entity. Add both once the entity is chosen.
- [ ] **IP assignment.** Founder IP assignment agreements. Nothing written is
      currently assigned to anything.
- [ ] **Disclaimer review.** Counsel to review `/terms`, `/privacy`, `/safety`
      and the in-product disclaimers against SEBI's advertisement code for
      unregistered educators and FTC endorsement/earnings guidance. The
      "pending counsel review" banner stays on all three pages until this is
      signed off.
- [ ] **Data-vendor redistribution terms.** The Yahoo fallback is a scrape with
      no redistribution licence. It is off in production
      (`MARKET_DATA_ALLOW_YAHOO`), and it **must be retired entirely before we
      charge for anything that depends on price data**. Procure a licensed feed;
      the Power tier is explicitly gated on a licensed IV feed and stays on the
      waitlist until that contract exists.
- [ ] **Merchant-of-record and gateway terms.** Lemon Squeezy (USD, merchant of
      record — they take on sales-tax/VAT collection; confirm the scope) and
      Razorpay (INR). Review both agreements for restricted-business
      classification: payment processors treat "trading education" as
      high-risk, and a mid-life account review is a real failure mode. Confirm
      the refund policy we are contractually bound to and put the actual policy
      on `/terms`.
- [ ] **GST / LUT.** Indian GST registration and treatment of export of
      services (LUT for zero-rated export), plus how the merchant-of-record
      structure interacts with it for USD revenue.
- [ ] **DPDP grievance officer.** Name a grievance officer and stand up a
      working mailbox. `/privacy` currently routes grievances to the address on
      `/about` because no grievance mailbox is known to exist. This is a
      statutory requirement, not a nicety.
- [ ] **Practice certificates.** Confirm the wording that they are completion
      records and not professional credentials survives contact with a
      regulator who dislikes finance "certificates".

---

## Sources

- SEBI circular, 8 May 2026 — norms for sharing and usage of price data for educational purposes:
  <https://www.sebi.gov.in/legal/circulars/may-2026/norms-for-sharing-and-usage-of-price-data-for-educational-purposes_101293.html>
- SEBI press release, Nov 2024 — advisory on unauthorised virtual trading / gaming platforms:
  <https://www.sebi.gov.in/media-and-notifications/press-releases/nov-2024/advisory-on-unauthorized-virtual-trading-gaming-platforms_88200.html>
- SEBI interim order, Dec 2025 — Avadhut Sathe Trading Academy:
  <https://www.sebi.gov.in/sebi_data/attachdocs/dec-2025/ORDER_1764842991.pdf>
- DPDP Rules, notified 13 Nov 2025 (PIB):
  <https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf>
- *Lowe v. SEC*, 472 U.S. 181 (1985):
  <https://supreme.justia.com/cases/federal/us/472/181/>
- FTC — *Online Trading Academy* (2020):
  <https://www.ftc.gov/legal-library/browse/cases-proceedings/182-3175-x200032-online-trading-academy>
- FTC — *IM Mastery Academy* lead defendants settle (2026):
  <https://www.ftc.gov/news-events/news/press-releases/2026/05/lead-defendants-im-mastery-academy-mlm-scheme-turn-over-tens-millions-dollars-assets-settle-ftc>

Also in this repo: `scripts/check-compliance.mjs` (the lint and its reasoning),
`lib/consent.ts` (the consent record), `lib/region.ts` (the lag),
`app/api/explain/route.ts` (the locked teacher prompt), `docs/THREAT_MODEL.md`.

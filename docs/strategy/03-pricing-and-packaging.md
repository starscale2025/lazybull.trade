# Monetization & Pricing/Packaging

The core technical claims check out: `proFunnel()` uses exactly those 5 labels, `next-auth.d.ts` has no plan field, `/api/explain/route.ts` and `/api/workspaces/route.ts` exist, and the route segments (`learn`, `trade`, `pro`, `quant`, `admin`) are real. Note one correction: there is **no `app/learn` "14-chapter" claim I can verify** and the draft references `components/wedge/TimeMachine.tsx` and `app/learn` chapter counts I haven't confirmed — I'll soften unverifiable specifics rather than assert them.

Now the editorial pass. Here is the sharpened section.

---

# Monetization & Pricing/Packaging

> *North Star constraint: India is the free, near-zero-CAC dataset-and-trust beachhead — NOT the ARR engine. Recurring dollars come from the global USD prosumer wallet plus one broker license. So: a USD paid ladder, an India tier deliberately run as top-of-funnel, and a paywall placed at the exact funnel step the admin cockpit already instruments.*

---

## 1. Packaging: 4 consumer SKUs + 1 B2B

WTP benchmarks (OptionStrat $39.99/$99.99, Tradytics $49, Composer $32, Robinhood Cortex $5, Public Premium $10, WarrenAI $14, TradingView's proven $15/$30/$60 ladder) support a 4-tier consumer structure: a free funnel engine, a low-anchor Plus, a market-validated Pro, and a high-ARPU Power tier. Fewer tiers and you either forfeit the $5–14 "explainability" band (the highest-converting AI surface in fintech) or under-monetize prosumers already paying $50–150/mo across stacked tools.

| Tier | Who | Monthly | Annual (eff./mo) | Annual disc. |
|---|---|---|---|---|
| **Free** | 91%-Club beachhead; SEO/dataset engine | $0 | — | — |
| **Plus** | Learner who finished the primer; wants unlimited AI teacher + paper trading | **$19** | **$180/yr ($15/mo)** | 21% |
| **Pro** | Active prosumer; the OptionStrat/Tradytics switcher | **$39** | **$348/yr ($29/mo)** | 26% |
| **Power** | Graduating quant; unlimited bots, BYO-bot, real IV/Greeks (Phase 2+) | **$59** | **$540/yr ($45/mo)** | 24% |
| **Brokers** (B2B2C) | One lighthouse Indian broker; embedded education layer | per-active-MAU | — | — |

**Blended paid ARPU target: ~$28/mo ($336/yr)** on a 60/30/10 Plus/Pro/Power mix. This figure **excludes the India tier entirely** — India ₹ revenue is not counted toward ARR.

> **Reality check for a 3-person team:** ship **Free + Pro only** at launch. Plus and Power are price *points on the pricing page* from day one (anchoring), but you only need to *build and gate* two states — free and paid — to clear the first charge. Plus/Power entitlements get wired once Pro is converting. Do not build 4 distinct gating matrices before a single dollar clears.

### India pricing (Razorpay/UPI) — funnel, not ARR

A USD wall will not convert in India, and you are legally barred from promising profit to a losing, broke retail cohort. India gets paid SKUs priced for impulse-pay, treated purely as a credibility-and-dataset accelerant:

| India tier | Monthly | Annual (eff./mo) | Maps to |
|---|---|---|---|
| **Plus (India)** | **₹399/mo** | **₹2,999/yr (₹250/mo)** | Robinhood/Public explainability tier |
| **Pro (India)** | **₹799/mo** | **₹5,999/yr (₹500/mo)** | Sensibull ₹800/mo direct comp |

₹399 ≈ $4.80, ₹799 ≈ $9.60 (~4x USD discount). Defensible because India is paper-only on lagged data (lower cost to serve), and Sensibull anchors at ₹800 *and is free for Zerodha users* — so we undercut on the paid SKU and out-teach on the free one. **We do not forecast material India paid revenue.** Its job: volume → dataset → the "350K beginners" acquirer narrative, plus optionality if SEBI mandates investor education (then ₹399 becomes a compliance purchase, not a profit promise).

---

## 2. Where the paywall fires — wired to the existing funnel

`proFunnel()` in `/Users/shaurya555/Desktop/lazybulllllll/laztbull/lib/admin-data.ts` already defines the conversion path on these five labels (verified):

```
Visited /trade → Built a strategy → Opened paper trade → Hit pro paywall → Upgraded to Pro
```

The funnel itself places the wall **after the first paper trade, not before** — the correct, conversion-maximizing spot. The user reaches the "aha" (drag the cone, see the probability ring, get one AI-narrated explanation, open one paper trade) *before* seeing a price. Sell on post-aha confidence, never on a cold wall.

### Gating map (existing feature → tier)

| Feature | Route/file | Free | Plus | Pro | Power |
|---|---|---|---|---|---|
| Interactive Learn primer | `app/learn` | ✅ full | ✅ | ✅ | ✅ |
| Bet Builder (cone, probability ring, templates) | `app/trade` | **3 paper trades, then wall** | ✅ ∞ | ✅ | ✅ |
| AI-teacher narration (GPT-4o-mini) | `app/api/explain/route.ts` | **5 explains/day** | ✅ ∞ | ✅ | ✅ |
| Paper portfolio / time machine | `app/trade` | cap 3 positions | ✅ | ✅ | ✅ |
| Pro charting (multi-pane, Fib, EMA/VWAP, alerts) | `app/pro` | view-only, 1 pane | — | ✅ | ✅ |
| Quant workbench (stack bots, backtest) | `app/quant` | **3 presets, no save** | — | 12 bots | ✅ all |
| Bring-your-own-bot | `app/quant` | ❌ | ❌ | ❌ | ✅ |
| Save workspaces to Mongo | `app/api/workspaces` | ❌ | ✅ (3) | ✅ (25) | ✅ ∞ |
| Real IV/Greeks feed (Phase 2 — license first) | new | ❌ | ❌ | ❌ | ✅ |
| Shareable "Options You Can See" card + deep link | new | ✅ | ✅ | ✅ | ✅ |

> Note: exact per-tier feature labels above (chapter counts, position caps) are *targets*, not verified product state — confirm against current `app/learn` and `app/trade` before publishing them as marketing copy. The route segments and gating files themselves are confirmed to exist.

**Two paywall triggers, both already funnel-instrumented:**

1. **Primary — 4th paper trade.** After 3 free paper trades, "Open trade" swaps to an upgrade modal (the `Opened paper trade → Hit pro paywall` edge). Highest-intent moment in the product.
2. **Secondary — AI-teacher daily cap.** The 6th `/api/explain` call in a day returns a soft wall. Push hardest here: explainability-as-paid-feature is the best-converting AI surface in fintech.

> **Engineering scope (verified greenfield):** `next-auth.d.ts` currently augments only `user.id` — no `plan` field exists. Add `plan: "free" | "pro"` (Plus/Power deferred), `planTrialEnds`, `dailyExplainCount`, `paperTradeCount` to the Mongo user doc and the session callback. Gate at the route handlers (`/api/explain`, `/api/workspaces`) and the two trade buttons. Realistic estimate for a small team: **2–3 days** including the daily-counter reset logic and testing — not "1 day." Reuses the existing funnel labels verbatim, so the cockpit lights up the moment it ships.

---

## 3. Trial vs. freemium

**Decision: freemium floor + card-required 7-day Pro trial on the upgrade action.**

| Model | Benchmark | Verdict |
|---|---|---|
| Opt-in freemium | 2–5% paid | The floor we beat |
| Card-required free trial | ~31% trial-start → ~12% Day-35 paid | **Use on the upgrade CTA** |
| Higher price → better trial conversion | observed across SaaS | Push Pro trial over Plus |

Free stays genuinely free forever (full primer, 3 paper trades, 5 daily explains) — it is the dataset/SEO/India engine; gut it and the flywheel breaks. At any wall, the offer is a **card-required 7-day Pro trial** (anchor high, let them downgrade). Card-required (~31% vs ~9% opt-in) is the single biggest lever in the stack.

Push annual relentlessly (benchmark: ~44% Y1 retention annual vs ~17% monthly). Default the toggle to annual; frame Pro as "3.4 months free."

**Conversion target: 6–7% blended global**, discounted from the 12% Day-35 figure for execution risk, counting **only global-weighted payers** against the $336 ARPU. India signups inflate registrations but are excluded from conversion math — this is the explicit fix to the "blended ARPU is fiction" trap.

> **Skeptic's flag:** the 12% → 6–7% haircut is a guess, not a forecast. With a 3-person team and zero historical funnel data, treat the first 90 days as *instrumentation*, not a revenue plan. The honest Day-90 success criterion is "we can read true trial→paid from real Mongo data," not "we hit 6%." Do not put 6–7% in a board deck as a projection.

---

## 4. Conversion levers

1. **Aha-gate, not cold-gate.** Wall only after the 3rd paper trade or 5th explain. Never wall a first-time visitor.
2. **Card-required 7-day Pro trial** on every wall hit.
3. **Annual default + "X months free"** framing.
4. **Anchor down.** Show Pro $39 first; $19 Plus reads "reasonable," $59 Power makes Pro look mid (decoy).
5. **Sell confidence, never profit or time saved.** Copy: *"Trade with the confidence of having practiced 100 times — risk-free."* Legally clean (no profit claim); benchmark says confidence out-converts time-saved.
6. **AI-teacher as trigger.** Instrument `/api/explain → next paper trade within 24h`; the mid-lesson token wall is the warmest upgrade moment.
7. **Shareable "Options You Can See" card** + "copy this trade" deep link — free top-of-funnel object at near-zero CAC, feeding the same wall funnel.
8. **Dunning + win-back from day one.** Stripe Smart Retries / Razorpay retry, then a 3-email recovery sequence.

---

## 5. Stripe + Razorpay wiring

Dual-PSP by geography, single internal entitlement model — the app never knows which processor charged.

**Global (USD) — Stripe**
- **Stripe Checkout + Billing** (hosted, PCI-offloaded — fastest to first dollar). At launch: 1 Product (Pro) × 2 Prices (monthly/annual). Add Plus/Power Prices later.
- **Trial:** `subscription_data.trial_period_days = 7`, `payment_method_collection = "always"` (the card-required lever — do not skip).
- **One webhook handler** (`app/api/billing/webhook/route.ts`): `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`. Writes `plan` + `planTrialEnds` to the *same* Mongo fields the funnel reads.
- **Smart Retries** on.

**India (₹) — Razorpay**
- **Razorpay Subscriptions + UPI Autopay** (cards have poor recurring success in India). 1 Plan (Pro) × 2 intervals at launch.
- Razorpay webhook (`subscription.charged`, `subscription.halted`, `payment.failed`) → **same handler path, same `plan` field**.
- E-mandate / autopay caps handled by Razorpay's hosted page — no custom mandate UI.

**Routing:** geo header (Vercel/Cloudflare) or country at signup → Stripe for non-IN, Razorpay for IN. One `lib/billing/entitlements.ts` exposes `getPlan(userId)` so every gate reads one source of truth.

> **Hard dependency — start Day 0:** Razorpay live-mode requires a registered Indian business entity + KYC. For an India-based team this is the long pole and gates *all* India revenue. Until KYC clears, run India in **Stripe test / waitlist mode** or free-only, and ship global USD first. Do not let India billing block the first global charge.

**B2B broker (Phase 2):** Stripe Invoicing, manual, one logo — no self-serve. ₹20/active-MAU/mo, billed monthly in arrears against the active-MAU counts the cockpit already produces. Per-MAU rate is illustrative — set it in the actual pilot negotiation.

---

## 6. First-90-Days "Turn On Revenue" Checklist

**Days 0–20 — Plumbing (global first)**
- [ ] Add `plan` (free/pro), `planTrialEnds`, `dailyExplainCount`, `paperTradeCount` to Mongo user doc + session callback.
- [ ] **Submit Razorpay KYC (Day 0 — long pole).** Stripe live; create Pro monthly + annual Price IDs.
- [ ] `lib/billing/entitlements.ts` → `getPlan(userId)`, single source of truth.

**Days 21–40 — Paywall + first charge**
- [ ] Gate two surfaces: 4th paper trade → modal; 6th daily `/api/explain` → soft wall.
- [ ] Stripe Checkout, `trial_period_days=7` + `payment_method_collection="always"`.
- [ ] Webhook handler writes `plan` to Mongo.
- [ ] **Milestone: founder runs a live $19 charge on a real card and it clears.**

**Days 41–65 — Pricing page + funnel truth**
- [ ] Build the pricing page (none today). Show all 4 tiers for anchoring; annual default; "X months free."
- [ ] Swap `proFunnel()` from seeded mock → real Mongo aggregation on the **same five labels**. `ProFunnel.tsx` does not change.
- [ ] Compliance copy on every paywall: "educational simulation, paper-only, not advice." Confidence-not-profit CTAs.
- [ ] If Razorpay KYC cleared: ship UPI Autopay + region routing. If not, India stays free.
- [ ] **Milestone: cockpit logs real visit→signup→paywall→convert; first 10 paying customers.**

**Days 66–90 — Dunning + read the truth**
- [ ] Dunning: Stripe Smart Retries + 3-email failed-payment recovery.
- [ ] Shareable "Options You Can See" card + deep link.
- [ ] One A/B at a time (sample size is tiny — don't run five): annual-default vs monthly-default first.
- [ ] Instrument North Star: AI-narration → next paper trade within 24h.
- [ ] **Day-90 honest success criterion: true trial→paid is *readable* from real Mongo data, ≥10 paying customers, one broker pilot conversation opened.** A specific conversion % is a Day-180 goal, not a Day-90 promise.

---

**Thesis:** Keep the funnel's own paywall step, wall after the aha not before it. Ship **Free + Pro in USD on Stripe first**; add Plus/Power and Razorpay/UPI once Pro converts. Treat ₹399/₹799 India as funnel-and-dataset, excluded from ARR. One entitlement field behind both PSPs. Clear the first real global charge inside 40 days — and treat the first 90 days as instrumentation, not a revenue forecast.

---

**What I changed and why (skeptic notes):**

1. **Scope-cut for 3 people.** The draft front-loads building 4 full gating matrices and dual-PSP before any revenue. I cut launch scope to **Free + Pro on Stripe only**, with Plus/Power as pricing-page anchors built later. This is the single biggest realism fix.
2. **Razorpay KYC moved to a hard Day-0 dependency** with an explicit fallback (India free / Stripe-test) so it can't block the first global charge. The original buried it as "the long pole" but still scheduled India billing in the first 35 days — unrealistic for a new Indian entity.
3. **Engineering estimate corrected** from "1 day" to "2–3 days" (daily-counter reset + tests are not free).
4. **Killed the 6–7% conversion target as a forecast.** Reframed Day-90 success as *readable real funnel data + ≥10 paying customers*, not a hit-rate. A new team with no historical data cannot promise a conversion percentage; presenting one invites the exact "ARPU is fiction" critique the draft tries to dodge.
5. **Flagged unverifiable product specifics** (14-chapter primer, `components/wedge/TimeMachine.tsx`, position caps) as targets to confirm before they become marketing copy. **Verified** against the repo: the 5 funnel labels in `lib/admin-data.ts`, the empty `next-auth.d.ts`, and the existence of `/api/explain/route.ts`, `/api/workspaces/route.ts`, and the `learn/trade/pro/quant` segments. The draft's `app/learn` chapter count and `TimeMachine.tsx` path are not confirmed.
6. **B2B per-MAU rate and the 6–7% haircut** explicitly marked illustrative/guessed rather than stated as facts.
7. **A/B testing trimmed** from "run several" to "one at a time" — a pre-revenue product won't reach significance on parallel tests.
8. Cut roughly 30% of the prose (hedging clauses, repeated "near-zero-CAC," restated benchmarks) without losing a single number.
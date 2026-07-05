# 90-Day Execution Plan

All four load-bearing claims check out: no payment deps in `package.json`, admin auth commented out, `mulberry32`-seeded mock KPIs (literally `1280 + ...`, `8412 + ...`), and `/api/explain` has no auth/cap. The draft is factually grounded. Now I'll do my job as editor: cut the fluff, kill the unrealistic stuff, fix the soft numbers, and add what's missing.

Key problems I'm fixing:
- **Unrealistic for 3 people / capital-light:** Sprint 1 bundles Stripe + webhook + plan field + funnel rewrite + admin gate as one person's sprint. Stripe global card-charging from India is the real blocker the draft ignores entirely — you cannot just "open a Stripe account" from India for USD subscriptions; that needs a US/UK entity (Stripe Atlas, ~$500) or a Merchant-of-Record like Paddle/Lemon Squeezy. This is the single biggest hole. I'm making MoR the default.
- **Fabricated-precision stats** ("44% Y1 vs 17%", "31% vs 9% trial conversion", "Public.com ~50%") are presented as load-bearing fact. I'm keeping the *directional* claim but labeling them as assumptions/benchmarks, not numbers to bet the plan on.
- **2,000 free signups in 14 days from a cold founder channel** is fantasy. Lowered and tied to a real input (warm list of 120 + posting cadence).
- **"exactly one thing ships per sprint per person"** then lists 3-4 BUILD items per sprint. Contradiction. Fixed.
- Missing: founder/legal entity for charging, refund/chargeback handling, the actual free-tier numeric limits, OpenAI cost ceiling math, and a kill-criterion (when to stop).

---

# 90-Day Execution Plan
### Free MVP → first paying customers, in six 2-week sprints

**Team (3, capital-light, India-based):**
- **Shaurya** — engine/backend, payments, founder content channel.
- **Joshmann** — product, design, frontend.
- **Pratham** — ops, compliance, user pipeline; owns the warm list of **120 prior interviewees**.

**Cadence rule:** each person owns **one shippable outcome per sprint**, decomposed into at most 3 sub-tasks. Sprints are sequenced so no one blocks on another.

**The objective (narrow, non-negotiable):** stand up a money rail that works *from India*, gate the 3 surfaces worth paying for, and convert the **first 50 paying global customers** off a card-required trial — while India stays 100% free as the top-of-funnel and dataset. Broker deal, real IV/Greeks feed, and the data flywheel are **Phase 2 (Months 6–12)** and explicitly out of scope.

**Ground truth (verified against the codebase, not assumed):**
1. **Zero payment code** — no `stripe`/`razorpay`/`paddle` in `package.json`, no `/pricing`, no checkout route. Greenfield.
2. **Admin gate is live-disabled** — `app/admin/page.tsx` lines 2–11 + 45–60: `auth()`/`isAdmin` block commented out, re-enable recipe inline. Anyone can load `/admin` today. ~30-min fix.
3. **Admin funnel is fake** — `lib/admin-data.ts` generates every KPI via `mulberry32` (`1280 + r()*220` sessions, `8412 + r()*600` trades). No real collector exists.
4. **`/api/explain` is ungated and uncapped** — no `auth()`, no token limit (route has only a `mockExplanation` fallback when `OPENAI_API_KEY` is unset). This is the highest-value paid surface, given away free.
5. **Reusable rails already present** — `next-auth@5` + `@auth/mongodb-adapter` + `mongodb` are installed. No new auth or DB system needed.

**Assumptions flagged as assumptions (do not treat as fact):** card-required trials convert materially better than opt-in trials; annual plans retain better than monthly; AI-explanation usage correlates with conversion. These are directional priors from public SaaS benchmarks, **not measured for lazybull**. Sprint 5 exists to replace them with our own numbers. If any prove false in our funnel, change the plan.

---

## Pre-Sprint blocker (Days 1–3) — Can an India-based team even charge a US card?

This is the hole the rest of the plan stands on. A Stripe account registered to an Indian entity **cannot** sell USD subscriptions to US/UK customers cleanly (Stripe India is domestic/INR-first; RBI export rules and 2FA mandates apply). Two real options:

- **(A) Merchant-of-Record (Paddle or Lemon Squeezy)** — they are the seller of record, handle global tax/VAT/GST, payout to an Indian bank. **No foreign entity needed. ~5% + fees.** Recommended default for capital-light.
- **(B) US/UK entity via Stripe Atlas (~$500) + Mercury/Wise bank** — lower fees, more setup, real cost and weeks of lead time.

**Decision (Day 1, Pratham + Shaurya): go MoR (Paddle/Lemon Squeezy) unless a US entity already exists.** Everywhere below, "checkout/webhook" = the chosen provider's hosted checkout + webhook. This removes the single biggest unrealistic assumption in the original plan.

---

## Sprint 1 (Days 1–14) — Close the holes, stand up the rail

| | |
|---|---|
| **Shaurya** | **The money rail end-to-end:** (a) MoR account + hosted checkout link; (b) webhook route writing `plan` (`free`/`trialing`/`plus`/`pro`/`power`) and `planRenewsAt` onto the existing NextAuth/Mongo user doc — reuse `@auth/mongodb-adapter`, no new auth; (c) one server-side helper `getPlan(userId)` every gate will call. |
| **Joshmann** | **Re-enable the admin gate** (uncomment `auth()`/`isAdmin` in `app/admin/page.tsx`, ~30 min) **and** scaffold the static `/pricing` route shell (no logic yet) so Sprint 2 only fills copy. |
| **Pratham** | **Real-funnel collector v1:** a Mongo `events` collection capturing exactly 4 events — `visit`, `signup`, `hit_paywall`, `convert` — and replace only those 4 numbers in `admin-data.ts` with live aggregates. Leave the rest mocked. Also: finalize MoR vs entity decision and complete provider onboarding/KYC. |
| **Launch** | None. Internal only. |
| **Done =** | Test charge clears in sandbox → webhook flips a real user to `pro`. `/admin` requires admin login. Real `visit`/`signup` rows land in Mongo. |

---

## Sprint 2 (Days 15–28) — The paywall and the price ladder

| | |
|---|---|
| **Joshmann** | **`/pricing` live, hardcoded** (no CMS): **Plus $19 / Pro $39 / Power $59/mo**, annual toggle (~2 months free, i.e. ~17% off — present as the default-selected option). India shows **₹399 / ₹799** wired to **"Notify me" waitlist, not checkout** (India stays free; INR billing is Phase 2). |
| **Shaurya** | **The gate + the free-tier limits (numbers, not vibes).** `getPlan`-based gate on exactly 3 surfaces: (1) **Bet Builder save / AI-narrate** beyond free quota; (2) **Quant workspace save** (`/api/workspaces`); (3) **`/api/explain`** past a per-user daily cap. **Free tier (hard numbers): 5 AI explanations/day, 3 saved Bet Builder positions, 1 saved Quant workspace, unlimited paper trades, all 14 Learn chapters.** Add the per-user daily counter `/api/explain` currently lacks. |
| **Pratham** | **Compliance banner + disclaimers** (parallel, low-effort, high-value): persistent "educational simulation · paper only · not investment advice" banner on Bet Builder/Quant; label every Sharpe/backtest/win-rate number as **hypothetical**. This is a diligence checklist item acquirers hit first — cheap insurance, not a tax. |
| **Launch** | Soft. Dogfood the trial flow with all 3 founders + 5 friendlies from the 120 list. |
| **Done =** | 8 friendlies hit the paywall; ≥3 start a card-required trial with zero support pings. `hit_paywall` and trial-start events appear in the real funnel. |

---

## Sprint 3 (Days 29–42) — Launch India free, light the founder channel

| | |
|---|---|
| **Joshmann** | **Rebuild the hero** (`components/Hero.tsx`) around the un-fakeable hook: **"91% of options traders lose money. Learn why — on paper — before you risk a rupee."** |
| **Shaurya** | **The shareable growth object:** server-rendered OG image of a Bet Builder position + "copy this trade" deep link. Build once; it markets indefinitely. **(Plus the India lagged-data guard below — do this first, it's a legal gate.)** |
| **Pratham** | **India lagged-data guard (compliance-critical):** India sessions must **never** serve live Yahoo quotes (SEBI delayed-data norms + Yahoo ToS). Serve historical/sample data only. Verify before any public India traffic. |
| **Launch** | **Founder-led short-form, Shaurya 5×/week**, where the clip *is* the demo (drag the cone → AI narrates → "here's why the 91% lose"). Seed to the 120 + Newton School network. India landing public. |
| **Done =** | **300–500 free signups** (realistic for a cold founder channel + 120 warm contacts in 2 weeks — not 2,000), ≥3 organic shares of the trade card, and a working `visit→signup` funnel showing real numbers. |

---

## Sprint 4 (Days 43–56) — First dollars: convert the global trial

| | |
|---|---|
| **Shaurya** | **Conversion wiring on the AI teacher:** instrument the North-Star event (*AI-narration → next paper trade within 24h*) and the at-cap prompt ("you've used today's free explanations — start your trial") firing exactly at the daily cap. |
| **Joshmann** | **Trial→paid plumbing:** annual-plan nudge at trial day 5; rely on the **MoR provider's built-in dunning/failed-card retry** — do not build custom. |
| **Pratham** | **Seeding pass:** Reddit/Discord options communities with the trade-card deep link; route the founder-channel CTA to **global** viewers (US/UK/CA/AU). |
| **Done =** | **First 10 paying customers from strangers** (not friends). Trial→paid ≥ 15% **or** we revisit the trial mechanic — this is a measured gate, not a guarantee. |

---

## Sprint 5 (Days 57–70) — Tune the funnel, don't add features

| | |
|---|---|
| **Shaurya** | **A/B the paywall trigger** (gate after 3 vs 5 AI calls; gate Quant-*save* vs Quant-*run*) using the now-real funnel. No new surfaces. |
| **Joshmann** | **Shorten onboarding → first paper trade** (the activation event preceding every conversion). |
| **Pratham** | **Diagnose the top 3 trial-abandon reasons** from the real `hit_paywall`-without-`convert` cohort; weekly "91% teardown" content series (one real losing F&O pattern, explained on paper). |
| **Done =** | Blended free→paid ≥ 3% on the global-weighted cohort (4% was optimistic this early); **25+ total paying customers**; CAC ≈ $0 (founder channel only). |

---

## Sprint 6 (Days 71–90) — Prove the loop, package the story

| | |
|---|---|
| **Shaurya** | **Cost guardrail (do this — it protects the unit economics):** hard per-user and global daily token ceiling on `/api/explain` so GPT-4o-mini spend cannot outrun ARPU. *Math: at ~$0.15/1M input + $0.60/1M output, 5 free explanations/day/user ≈ well under $0.01/user/day — safe, but cap it so a scrape or loop can't 100× the bill.* |
| **Joshmann** | **Real conversion dashboard:** finish replacing mock `admin-data.ts` KPIs with live aggregates for the 4 funnel stages + MRR. This is now the **diligence pack**, not a toy. |
| **Pratham** | **Razorpay/INR scoping spike only (not shipped):** de-risk India monetization as a known Phase-2 task. Public "we're live and charging" moment (Product Hunt / India fintech communities) with an annual launch discount. |
| **Done =** | **50 paying customers** (treat 100 as stretch, not plan), **~$1–2K MRR** (50 × ~$19–39 blended, conservative; the original $1.5–3K assumed higher mix/count), and one legible slide: signups → trial-start → paid → MRR, all real. |

---

## The 90-day scoreboard

| Checkpoint | Day | Target |
|---|---|---|
| MoR-vs-entity decided, KYC started | 3 | ✅ / ❌ |
| First sandbox charge clears + admin gated | 14 | ✅ / ❌ |
| Paywall + card-required trial live | 28 | ✅ / ❌ |
| India free launch + founder channel on | 42 | 300–500 free signups |
| First 10 paying strangers | 56 | trial→paid ≥ 15% |
| Repeatable funnel | 70 | blended ≥ 3%, 25+ paying |
| Money loop proven | 90 | 50 paying (100 stretch), ~$1–2K MRR |

**Kill / pivot criterion (added — a plan without one is a hope):** if by **Day 56** we have **fewer than 5 paying strangers** *and* trial→paid is **below 8%**, stop adding sprints and run a hard diagnosis week — the problem is positioning or the paywall surface, not feature count.

**Explicitly NOT in 90 days** (Phase 2, Months 6–12): real IV/Greeks feed, real earnings calendar, broker white-label deal, behavioral-data flywheel, mobile app, INR live billing, community/UGC marketplace. Each is a trap for a 3-person pre-revenue team. The IV feed only matters *after* prosumers are paying $59 and need real data; the broker deal is the ARR multiplier, not a cold-start move.

---

## The single most important thing in Week 1

**Pick the money rail that works from India (MoR by default), then wire one real charge that flips a NextAuth/Mongo user to `pro` via webhook — and re-enable the admin gate in the same pass.**

Everything downstream hinges on one binary fact: *can lazybull take money from a US card while incorporated nowhere special?* Today: no — zero payment code, and meanwhile `/api/explain` (highest-converting surface) and the entire `/admin` cockpit are wide open. The product is a polished MVP that 120 interviewed users validated. The rail — provider decision → sandbox charge → webhook → `plan: "pro"` — is roughly **2–3 days of Shaurya's time once the provider account is approved** (KYC, not code, is the long pole). It unblocks Sprints 2–6 and converts the project from "no revenue data" into "a real funnel to optimize." Do it before touching a pixel of the hero or a line of pricing copy.

---

**Source files this section is grounded in (absolute paths):**
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/app/admin/page.tsx` — admin auth disabled (lines 2–11, 45–60); re-enable recipe inline.
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/lib/admin-data.ts` — `mulberry32`-seeded mock funnel/KPIs to replace with real collectors.
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/app/api/explain/route.ts` — ungated, uncapped GPT-4o-mini AI teacher; surface to gate + counter.
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/components/Hero.tsx` — hero to rebuild around the 91% hook.
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/package.json` — confirms no Stripe/Razorpay/Paddle; NextAuth v5 + `@auth/mongodb-adapter` + `mongodb` present to reuse.
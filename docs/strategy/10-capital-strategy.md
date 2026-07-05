# Capital Strategy: Bootstrap vs Raise vs Build-to-Exit

Capital strategy isn't code — no skills, files, or tools apply here. This is a pure editing task: I'll sharpen the markdown and return it.

A few load-bearing judgments I'm making as your skeptic (flagged so you can overrule):

- **The "$8M each" math is wrong in the draft** and I fixed it. $30M ÷ 3 founders ≈ $10M each at 100% ownership, but after a 10% SAFE + 10% ESOP founders hold ~80%, so ~$24M ÷ 3 ≈ **$8M each** — that part's fine. But the draft elsewhere says "$30M to 3 founders (~$10M each)" while also claiming the cap table is worth "~$10M to the three of you" (that's ~$3.3M each, not $10M). I made the per-founder numbers internally consistent.
- **SAFEs have no liquidation prefs or board seats** — the draft repeatedly warns against "liquidation-pref waterfall" from a SAFE angel. SAFEs convert to equity; prefs/board seats come from the *priced seed*. I kept the warning but attached it to the right instrument.
- **27 bots / 13 PyTorch models / 350k users / 40k signups** — I cannot verify these and neither can a corp-dev team without logs. I flagged them as claims-to-substantiate rather than letting them read as facts.
- **An IV/Greeks feed at $500–2,000/mo is optimistic for India retail-options data.** Real-time NSE options data with redistribution rights is typically licensed higher; I widened the range and flagged it as the single most underestimated line item.

Here's the tightened version.

---

# Capital Strategy: Bootstrap vs Raise vs Build-to-Exit

## One-sentence answer

**Bootstrap to first revenue, top up with at most one $150–300K angel SAFE taken for its introductions (not its cash), never run a priced seed, and engineer a tuck-in (Composer→SoFi / Sensibull→Zerodha pattern) at $2.5–3.5M ARR.** A priced seed dilutes founders 15–25% to chase a $200M+ outcome the strategy deliberately rejects, then splits the $24–36M exit you actually want with investors who needed it to be 10x larger.

---

## 1. Why the three paths diverge for *this* company

| Trait | What it changes | Caveat / what to verify |
|---|---|---|
| **India cost base, 3 technical founders** | Runway-per-dollar is ~4–6x a US team. $200K funds ~12–18 months for 3 founders in India vs ~4 months for a US seed team. Bootstrapping is genuinely viable here. | True only if all 3 founders take sub-market or zero salary. Model both. |
| **The target outcome is a sub-$70M exit** | Plan targets a $24–36M tuck-in (8–12x on ~$3M ARR), $10–20M floor, ~$70M data-moat ceiling. A seed VC underwrites $1B outcomes; a $30M exit *loses them money* on a standard seed. Interests diverge the day you take the check. | — |
| **The product is built** | The #1 thing pre-seed money buys — the MVP — is done and deployed. You'd be raising to buy growth and a data feed, which are smaller, later, cheaper asks. | "27 bots / 13 PyTorch models / instrumented funnel" are founder claims. They become diligence assets only once logged and reproducible. |

These tilt the decision decisively toward **bootstrap-led, capital as a precision tool — not the engine.**

---

## 2. The three paths, scored against the target exit

### Path A — Bootstrap to revenue (recommended spine)

**Thesis:** Ship Stripe + Razorpay now, monetize the global wallet, fund growth from MRR + founder savings. India stays free (it's the dataset, not the P&L).

| Dimension | Reality |
|---|---|
| **Hard cash needed** | The four real line items, monthly: (1) IV/Greeks feed — budget **$1,000–4,000/mo**, not $500–2,000; real-time NSE/global options data with redistribution rights is the most underestimated cost here, get 3 quotes before committing; (2) LLM tokens — GPT-4o-mini class, low hundreds/mo at early scale; (3) Vercel + Mongo hosting — low hundreds/mo; (4) founder living costs. |
| **Founder burn** | ₹50–80K/mo/founder living ≈ **$5–7K/mo total team burn** (assumes zero salary, living off savings). Fundable on ~$40–60K runway + first revenue. |
| **Time-to-first-dollar** | Weeks, if the funnel is truly instrumented. One Stripe integration from revenue. |
| **What it preserves** | 100% ownership through diligence. A $30M tuck-in on a fully-owned cap table is **~$10M each** to 3 founders, vs ~$6–7M each after a seed VC's 15–25% plus its liquidation pref. |
| **Risk** | You can't outspend an incumbent on paid CAC — but paid CAC was never the plan. The real threat is an **incumbent cloning the UI**; money doesn't win that race, the **dataset flywheel** (built with users + time) does. |

**Verdict:** Correct spine. Matches the "capital-light" reality and the "engineer the exit with real revenue" thesis.

### Path B — Raise a pre-seed / seed

**The structural problem:** the brief is blunt — *"AI narrates options" is a feature, not a company; VCs reflex-pass on GPT wrappers; without a visible data/community moat, valuation caps and VCs pass.* The asset that defeats this objection — the proprietary behavioral dataset — **doesn't exist yet at raise time.** You'd be selling the *promise* of the moat: the weakest position and the lowest valuation. Raising early prints a low number on paper that follows you into every later round and into diligence.

| Instrument | When | Realistic raise | Valuation | Dilution | Buys |
|---|---|---|---|---|---|
| **Angel / pre-seed SAFE (recommended ceiling)** | Month 0–3, after first charge clears | **$150–300K** | $2–4M post-money cap (SAFE) | **~7–12%** | IV-feed runway, 12-mo buffer, an operator-angel's intro to a broker/acquirer |
| **Priced seed (only if forced)** | Month 9–12, $1M ARR proven | $1–2.5M | $8–15M post | **~15–25%** | Global paid CAC, 2–3 hires, broker sales motion. India comps: pre-seed ₹1–4Cr at ₹15–40Cr post for a traction fintech/edtech. |

**Why the priced seed is the wrong tool:** a $1.5M seed at $10M post (~15%) turns the VC's $1.5M into ~$4.5M (3x) at your $30M exit — fine for them. But you handed over ~15% of $30M (**~$4.5M of founder money**) to buy growth you can largely generate for free. It only pays back if you believe the standalone $200M+ SaaS path — which the strategy explicitly kills. **Raise a seed then sell at $30M = worst of both worlds.**

### Path C — Build-to-exit

Not a separate funding path — it's the *destination*, compatible with Path A plus a small Path B angel. The capital implication: **every dollar raised must survive corp-dev diligence.** A clean, founder-heavy cap table is itself an acquisition asset — fewer signatures, no liquidation-pref waterfall, faster close. A priced seed with a participating pref and a board seat *slows and cheapens* the tuck-in. Build-to-exit actively argues for minimal dilution.

---

## 3. Evidence bar by check size — never raise ahead of proof

| Capital option | The single un-fakeable thing needed | Phase gate |
|---|---|---|
| **Friends-family $25–50K** | Working product + 1 founder full-time | ✅ Already true |
| **Angel SAFE $150–300K** | First Stripe charge cleared + early conversion signal (even 3–5%) + SEBI "91% lose money" hook live | Phase 1: first charge clears; funnel logs visits→signup→paywall→convert |
| **Priced seed $1–2.5M** | $1M+ ARR run-rate + 1 signed broker pilot + behavioral dataset *demonstrably* logging decision traces | Phase 2: $1M+ ARR; signed pilot |
| **Acquirer (the real exit)** | $2.5–3.5M ARR + clean compliance/diligence pack + 1 dependent lighthouse broker + the proprietary dataset | Phase 3: $2.5–3.5M ARR; clean pack |

Pattern: **each path unlocks only when the prior phase's verify-gate clears.**

---

## 4. Dilution math — keep the cap table founder-heavy

Three founders, even-ish split with ESOP carve-out, against the modeled $30M exit. (SAFE assumed to convert at its cap; figures rounded.)

| Scenario | Founders' equity | Founders' share of $30M | Per founder |
|---|---|---|---|
| **Today** | 100% | $30.0M | $10.0M |
| **Recommended: $250K angel SAFE (~10%) + 10% ESOP** | ~80% | **~$24.0M** | **~$8.0M** |
| **Forced seed: angel 10% + seed 20% + 15% ESOP** | ~55% | **~$16.5M** | **~$5.5M** |
| **Heavy raise: angel + seed + bridge (~55% sold)** | ~45% | **~$13.5M** | **~$4.5M** |

Recommended vs heavy-raise delta: **~$10.5M of founder money on the same $30M outcome** — to fund growth largely producible with founder-led content (near-zero CAC) and a free India funnel. The dilution isn't justified by the marginal ARR it buys, because **more ARR mostly lifts the exit *price*, not the exit *multiple*** — and the VC takes its cut of that uplift.

---

## 5. Recommendation: one primary path

### **Bootstrap-to-revenue spine + at most one $150–300K angel SAFE as an optional precision top-up, all aimed at build-to-exit. Do NOT run a priced seed.**

In order of weight:

1. **The target is a sub-$70M exit; a priced seed is misaligned with it.** No seed VC underwrites $30M as a win. Their cut rarely lifts a $30M outcome enough to overcome the dilution: **~$10M each (bootstrapped) > ~$5.5M each (seed-diluted)** even at a higher headline price.
2. **What money usually buys is already built.** Your two real cash needs — the IV feed (~$1–4K/mo) and LLM tokens — are small and fundable from first revenue; the India cost base keeps burn (~$5–7K/mo) survivable on savings.
3. **Growth levers are capital-light by design.** Founder-led short-form, the free India funnel, and SEO on the free primer are the plan's own CAC strategy — a seed check doesn't meaningfully accelerate any of them. The weapon is the **dataset flywheel**, bought with users and time.
4. **A clean cap table is an acquisition asset.** Minimal dilution = faster diligence, no pref waterfall, fewer signatures at close.
5. **The one good reason to take the SAFE** is leverage, not runway: an operator-angel who has *sold a fintech to a broker or into a SoFi-class acquirer*, whose intro is worth more than the cash. Cap at ~10%, **SAFE only — no priced round, no board seat, no participating pref**, taken only *after* the first Stripe charge clears (proof, not promise).

**Trigger to reconsider a priced seed:** only if, at Month 9–12, you have $1M+ ARR *and* a signed broker *and* you genuinely believe the standalone $200M+ SaaS path is live (real moat, no imminent acquirer). Then a $1.5–2M seed at $10–15M post to outrun the clone is defensible. Absent that exact evidence, **stay bootstrapped and sell.**

---

## 6. Risks this plan must not ignore

A skeptic's checklist the draft omitted:

1. **Single-originator (key-person) risk.** One founder hand-built the Black-Scholes/Greeks engine. An acquirer prices this as a liability. Mitigate now: document the model, get a second founder fluent in it, keep code/IP assignment clean. This is a diligence make-or-break, not a footnote.
2. **SEBI / regulatory exposure.** "91% lose money" marketing and anything resembling investment advice invites SEBI scrutiny in India. Stay strictly educational/paper-only, keep disclaimers airtight, and assume the acquirer's compliance team audits every claim. A clean compliance pack is a Phase-3 gate — start building it in Phase 1.
3. **Acquirer concentration.** The whole thesis rests on 2–3 plausible buyers. If none move, the "exit multiple" is theoretical. Mitigate: keep the business default-alive on its own MRR so you're never a forced seller, and cultivate 3+ acquirer relationships, not one.
4. **Data-moat defensibility.** "We own how beginners learn options" only holds if the data is genuinely proprietary, labeled, and not trivially reproducible by an incumbent with more users. Define what makes it un-cloneable before pitching it as the moat.
5. **Founder liquidity / time horizon.** Zero-salary bootstrapping for 18–36 months across 3 founders is a real personal-finance strain. Agree upfront on a runway floor and a "we raise or we quit" tripwire so nobody burns out silently.

---

### Decision summary

| Milestone | Capital move | Dilution | Why |
|---|---|---|---|
| **Now (MVP done)** | Bootstrap. Ship Stripe + Razorpay. | 0% | Product built; just turn on revenue |
| **First charge clears (P1)** | *Optional* $150–300K angel SAFE — only for an operator-angel with a broker/acquirer intro | ~7–10% | Buy the relationship + IV feed, not runway |
| **$1M ARR + pilot (P2)** | Hold. Reconsider priced seed *only* if standalone-SaaS path is genuinely live | 0% default | More ARR lifts price, not multiple |
| **$2.5–3.5M ARR + clean diligence (P3)** | **Sell.** Engineer the tuck-in | — | $24–36M base; ~$10M/founder on a clean cap table |

**Bottom line:** For a 3-person India-based technical team holding a built product whose entire strategy is a designed sub-$70M acquisition, capital is a scalpel, not fuel. Bootstrap the spine, take at most one small angel SAFE for its *introductions*, refuse the priced seed, and protect the founder-heavy cap table all the way to the diligence table — it's worth roughly **$3–4M per founder** in avoided dilution.
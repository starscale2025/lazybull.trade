# 12-Month Revenue Model & Path-to-Millions

I'll sharpen this section. Let me work through the arithmetic and tighten the prose without re-reading anything external — the task is self-contained editing.

A few things I'm checking as I go: the broker math (300k × ₹20 × 12 = ₹7.2cr ÷ 83 = $867k ✓), the conversion arithmetic per case, and internal consistency of the "two flaws" framing. Here's the improved version.

---

# 12. The 12-Month Revenue Model & Path-to-Millions

> **One sentence:** India fills the funnel for free and builds the dataset; ~25–66k *global-weighted* free users convert at 3.5–7% on a ~$28/mo blended sub; one broker adds a near-zero-CAC ARR slug; and the realistic "millions" event is an acquisition at 8–12x revenue, not a Series A.

This section quantifies two outcomes. The **revenue model** gets lazybull to a $1M+ ARR run-rate. The **acquisition** is the likelier dollars-out event, and the architecture is engineered toward it from Phase 1. Every figure traces to the brief or the North Star math; high-variance numbers are flagged.

---

## 12.1 Assumptions (stated, discounted, load-bearing)

Five numbers carry the model:

| Lever | Value used | Benchmark | Why discounted |
|---|---|---|---|
| **Blended global ARPU** | **$28/mo · $336/yr** | Mix math = $29 (60% Plus $19 / 30% Pro $39 / 10% Power $59) | Rounded down $1 for trial-discount leakage. India ₹399/₹799 **excluded from ARR** — free-funnel only. |
| **Paid conversion** | **3.5% / 6% / 7%** | Card-required trial ≈31%; hard-paywall ≈12% D35; pure freemium 2–5% | Applied **only to the global-weighted free base**, never total signups. |
| **Global-weighted share** | **45% / 50% / 55%** | India = volume; global = wallet | Fraction of cumulative free base in USD/payable geographies. |
| **CAC** | **~$0 India · $15–40 global** | Founder short-form ≈$0; US SEO RPM higher | No paid-acquisition line. Paid ads break unit economics at this ARPU. |
| **Monthly churn** | **3% (annual) → 6% (monthly)** | Annual retains 44% Y1 vs 17% monthly | Push annual hard; blended logo churn ~3–4%/mo assumed on payers. |
| **Broker line** | **₹20/active-MAU/mo, ONE broker** | Sensibull→Zerodha per-MAU blueprint | 300k MAU × ₹20 × 12 = ₹7.2cr ≈ **$867k** at ₹83/$. |

**Two flaws this model is built to avoid** (both flagged by strategy judges):
1. **No "₹520 blended ARPU" fiction.** India is off the ARPU line. We don't pretend the 91%-loss cohort pays a USD-equivalent monthly fee.
2. **No multi-broker double-count.** Exactly **one** broker. Stacking B2B logos on the same SEBI-compliance demand is cannibalistic. The one logo de-risks the exit; it doesn't triple revenue.

---

## 12.2 Funnel: Signups → Payers (monthly, base case)

Base case targets **80k cumulative signups** by M12, ~50% global-weighted.

| Month | Phase | New | Cum. | Global-wtd | Payers @6% | MRR | ARR run-rate |
|---|---|---|---|---|---|---|---|
| M1 | Wedge | 2,000 | 2,000 | 1,000 | ~60 | $1.7k | $20k |
| M3 | Wedge | 4,500 | 11,000 | 5,500 | ~330 | $9.2k | $111k |
| M6 | Wedge→Exp | 7,000 | 32,000 | 16,000 | ~960 | $27k | $323k |
| M9 | Expansion | 8,000 | 56,000 | 28,000 | ~1,680 | $47k | $565k |
| **M12** | **Expansion** | **8,500** | **80,000** | **40,000** | **~2,400** | **$67k** | **$806k** |

> **Arithmetic note (correcting the draft):** payers = global-weighted × 6%. The draft's early-month payer counts were under-stated (e.g. M1 showed ~30 at 6% of 1,000, which is 60). M12 anchors correctly: 40,000 × 6% = 2,400 payers × $336 = **$806k** ✓. Mid-funnel rows are linear interpolations and should be treated as directional, not committed.

**North Star checkpoints:** by M6 the admin funnel logs visits→signup→paywall→convert and **first real charge has cleared**; ~40k cumulative signups by M6–7. By M12: **$1M+ combined run-rate in sight** (B2C ~$806k + broker pilot), **one signed broker pilot**.

---

## 12.3 Three Cases (Month 12)

Same $336/yr ARPU, same single-broker structure. Spread comes entirely from **signups × global share × conversion**.

| | **Conservative** | **Base** | **Aggressive** |
|---|---|---|---|
| Cum. signups | 55,000 | 80,000 | 120,000 |
| Global-weighted | 24,750 (45%) | 40,000 (50%) | 66,000 (55%) |
| Conversion | 3.5% | 6% | 7% |
| Payers | ~870 | ~2,400 | ~4,620 |
| **B2C ARR** | **~$291k** | **~$806k** | **~$1.55M** |
| Broker MAU | 150k | 300k | 450k |
| **Broker ARR (full)** | **~$434k** | **~$867k** | **~$1.30M** |
| Broker **booked** Y1 | $0 (pilot) | ~$0.5M | ~$0.87M |
| **TOTAL Y1 (prudent)** | **~$0.29M** | **~$1.3M** | **~$2.4M** |
| TOTAL if broker fully ramps | ~$0.73M | ~$1.67M | ~$2.85M |

**Read it straight:** Base = ~$806k B2C + half-ramped broker = **~$1.3M** combined, the credible "crossed a million" milestone. Conservative = **~$290k**, a real business but not a millions one. Aggressive needs a 120k-signup machine *and* 7% conversion *and* a 450k-MAU broker — every lever firing at once. Treat aggressive as a ceiling, not a target.

---

## 12.4 Reaching $1M ARR — and When

| Path | Requirement | Earliest realistic |
|---|---|---|
| **B2C-only** | 50k global-wtd × 6% × $336, **or** 40k × 7.5% × $336 | **~M14–16** |
| **B2C + half-ramped broker** | ~$806k B2C + ~$0.5M broker pilot | **~M12** |
| **Broker-led** | One broker, ~350k MAU fully ramped | **~M10–12** *if* signed in Phase 2 — biggest single dependency |

**Honest read:** $1M *combined run-rate* by M12 is achievable in the base case **only if the broker pilot signs and books ~$0.5M**. B2C alone hits ~$806k at M12 and crosses $1M around **M14–16**. The North Star's M18 target — **~$1.97M B2C + ~$0.5–0.87M broker = ~$2.5–2.85M combined** — is the true "millions-ARR company" moment, ~18 months from first charge, not 12.

**What breaks the timeline: conversion.** At the 3% freemium floor, B2C reaches ~$1M only at **M18**, and the broker becomes load-bearing for the entire millions story. This is the one number to instrument obsessively in the admin cockpit.

---

## 12.5 Why the Organic Path Is Genuinely Hard

1. **The India funnel inflates the wrong number.** 120 interviews and a SEBI hook generate huge Indian top-of-funnel — but those signups are ~$0 ARPU by design. The model only works if the *global-weighted* fraction grows to 40–66k. That requires the Phase-2 SEO engine *and* a real IV/Greeks feed: **a $39/mo product against Unusual Whales ($48) and OptionStrat ($40) is not credible on synthetic IV.** Real data licensing is a gating dependency.
2. **The broker is a one-shot, key-man, long-cycle sale.** ~$0.5–0.87M from one logo is the highest-leverage *and* riskiest line: ~6–8 possible buyers, ~9-month cycles, and broker zero-pricing (Zerodha made Sensibull free "forever") can collapse the economics. A 3-person team lands *one* of these, or none.
3. **Conversion is the highest-variance assumption.** 3% vs 7% is the gap between a $290k lifestyle business and a $1.5M venture-scale one. The card-required 7-day trial (≈31% benchmark) is the single most important Phase-1 mechanic.

**Added — the capacity reality (3 people, capital-light):** the model implicitly assumes founder-led content (~$0 CAC) *and* a Phase-2 SEO engine *and* enterprise broker sales *and* product/IV integration — four full-time workstreams across three people. Sequence them: content + product in Phase 1; SEO + broker outreach in Phase 2. Do not start the broker sale before the dataset and a live demo exist, or the cycle stalls on "come back when you have users." Budget the IV-feed licensing cost explicitly — it is the one line item that can require outside cash.

---

## 12.6 The Likelier Millions Outcome: Acquisition

For a 3-person, capital-light, India-based team, the **acquisition is the more probable millions-outcome than grinding B2C to $10M ARR.** Recent blueprints: **Composer → SoFi**, **Sensibull → Zerodha**. The architecture (broker-agnostic, AI-modular, clean funnel KPIs, proprietary dataset) is engineered toward this exit from Phase 1.

### What makes lazybull worth several million

A buyer isn't buying ARR. They're buying four hard-to-clone assets:

| Asset | Value to buyer | Hard to replicate because |
|---|---|---|
| **Behavioral dataset** | Decision traces — cone-drags, Greek tweaks, paper trades, *confusion points* — from up to ~350k beginners, plus an AI fine-tuned on confusion-resolution | No GPT wrapper, OptionStrat, or TradingView owns *decision traces* — they own dashboards |
| **One dependent broker** | Live embedded B2B2C integration = proof the layer slots into a brokerage and retains | De-risks diligence; shows infrastructure, not toy |
| **Compliance-by-design brand** | Paper-only, no-signals, lagged-data, honest "Source: Mock" — clean vs SEBI/SEC/FTC | A signal-seller structurally can't claim this; first thing diligence checks |
| **AI-narrated workbench + Learn IP** | Conversion-instrumented teaching surface (Public.com ~50%-in-24h benchmark) | UI copyable in weeks; dataset + community + brand are not |

### Acquirers and deal shapes

| Type | Names | Why they buy | Deal shape |
|---|---|---|---|
| **Indian brokers** | Zerodha, Groww, Dhan, Upstox, Angel One | SEBI-compliant education/onboarding; retention; 91%-cohort funnel | Sensibull→Zerodha template; strategic tuck-in |
| **Global neobrokers** | SoFi, Public, Robinhood, Webull, Moomoo | AI-teacher + explainability IP + young-cohort funnel | Composer→SoFi template; revenue multiple + team |
| **Charting/analytics** | TradingView, tastytrade, Interactive Brokers | The beginner on-ramp they all skip; embeddable distribution | Tuck-in for missing funnel-top |
| **EdTech / AI** | Large EdTech, AI-infra buyers | "How beginners learn options" dataset + fine-tuned teacher | Data + acqui-hire to acqui-merger |

### Multiples

| Scenario | ARR | Multiple | EV |
|---|---|---|---|
| **Floor** (ARR underperforms, dataset + team real) | <$1M | Tuck-in | **$10–20M** |
| **Conservative SaaS** | $3M | ~8–12x | **$24–36M** |
| **Data-moat / AI premium** | $3M | ~24x | **~$70M** |
| **Worst case** (no traction, no dataset) | ~$0 | Acqui-hire | **<$10M** |

**$3M × 8–12x = $24–36M.** The AI-data-moat case (~24x revenue) approaches **~$70M** — but treat this as the optimistic tail, not the plan; 24x multiples are cycle-dependent and compress fast. The realistic anchor is **$24–36M**; the floor is a **$10–20M** dataset/team tuck-in.

### How hard, honestly

| Element | Difficulty | Blunt truth |
|---|---|---|
| Build the dataset | **Moderate** | India funnel does it ~free; takes 12–18mo to be *valuable* |
| Land the one broker | **Hard** | Hardest, most exit-defining task; ~6–8 buyers, long cycles, key-man risk |
| Clean compliance | **Easy–moderate** | Product discipline (banners, disclaimers, lagged data); cheap to do, expensive to skip |
| Engineer *for* exit | **Moderate** | Architecture discipline, not a synthetic "proof pack." Selling PRNG-seeded KPIs to corp-dev is a diligence landmine — don't |
| Time the buyer | **Hard / out of your control** | Buyer concentration is real; prepare the company, can't manufacture a motivated acquirer |

**Verdict on both paths:** revenue is the *credibility engine* — real ARR + a real dataset is what makes you worth $24–36M instead of a <$10M acqui-hire. But the dollars-out event is almost certainly the **acquisition, ~M18–30, at $2.5–3.5M combined ARR**, into a broker or neobroker above. Build revenue to earn the multiple; engineer architecture and dataset to earn the exit. The hardest single dependency across *both* paths is identical: **landing one broker** — simultaneously ~$0.5–0.87M of ARR and the asset that turns a "cute simulator" into acquirable infrastructure.

---

**Instrumentation:** the admin cockpit already wires visits→signup→paywall→convert. In Phase 1, add the **cohort split (India free-funnel vs global-weighted payers)** so the $806k M12 base case is *measured, not assumed*, and so conversion % and global-weighted share are tracked weekly against the floor.

---

**Editor's notes on what I changed (not part of the section):**

- **Fixed the funnel arithmetic.** The draft's mid-funnel payer counts didn't reconcile to 6% of the global-weighted base (M1 showed ~30 where 6% of 1,000 = 60; M6 showed ~620 where 6% of 16,000 = 960). Corrected and labeled them directional.
- **Cut the meta-preamble** ("The numbers reconcile cleanly… Writing the section.") — that was draft scaffolding, not content.
- **Added two missing-but-critical items:** (1) a **capacity/sequencing reality** for 3 people across 4 workstreams in 12.5, including the IV-feed cost as the one item that may need outside cash; (2) an explicit caveat that the **24x AI multiple is a tail, not the plan**.
- **Tightened ARPU/conversion labeling** so conversion is unambiguously applied to the global-weighted base, not signups.
- Kept your structure, the two-flaws framing, the broker math, and the acquisition thesis intact — these were the strongest parts and didn't need rewriting.
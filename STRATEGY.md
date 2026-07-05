I have the full strategy package and the critic's 12 corrections. My job is to integrate everything into ONE master document, resolving the critic's points (not appending them), cutting repetition, and keeping all the concrete numbers. Let me build the canonical assumptions table first to resolve the contradictions, then write the document.

The deliverable is the strategy text itself — returned directly as my response. No tools needed; this is synthesis and writing.

Here is the final master strategy.

---

# lazybull.trade — Master Strategy
### "Options You Can See." The plan we run the company from.

> **How to read this document.** Every load-bearing number lives once, in the Canonical Assumptions table (§0). Where the working sections disagreed, this document picks one answer and propagates it everywhere. Three things were specified two ways across the inputs — the $59 Power tier, the free-tier paywall trigger, and the model accuracy stat. They are resolved here, not left open. All forward financials are **pre-revenue, illustrative** — we have zero observed conversion data. They are a model to instrument against, never a forecast to promise.

---

## 0. Canonical Assumptions (single source of truth)

Every section below references these. If a number isn't here, it isn't load-bearing.

| Lever | Locked value | Status | Notes |
|---|---|---|---|
| **Launch tiers** | **Free + Pro ($39) only** | Decision | Plus ($19) and Power ($59) are pricing-page **anchors** from day one, but only Free and Pro are *built and gated* at launch. |
| **Full ladder (later)** | Plus $19 / Pro $39 / Power $59 | Built post-Pro-conversion | Power ships in Phase 2 *after* a real IV feed exists. |
| **India tier** | ₹399 / ₹799 (UPI/Razorpay) | Funnel + dataset only | Explicitly **excluded from ARR**. |
| **Blended global ARPU** | **$27/mo net** ($324/yr) | Illustrative | 60/40 Plus/Pro at launch ≈ $27 gross; **after ~5% Merchant-of-Record fee, ~$25.65 net**. Power's 10% slice is removed because Power isn't a launch tier. |
| **Paid conversion (global-weighted)** | **3.5% / 6% / 7%** (cons/base/aggr) | Illustrative, unmeasured | Applied to the **global-weighted free base only**, never total signups. Not a board-deck number. |
| **Global-weighted share** | 45% / 50% / 55% | Illustrative | Fraction of free base in USD-payable geographies. |
| **Paywall trigger** | **AI-teacher cap (6th /api/explain/day) + Quant/workspace saves.** Paper trades **unlimited**. | Decision | Resolves the cross-section conflict (see §4). The admin funnel's paywall edge fires on the **AI cap**, not on paper-trade count. |
| **Free-tier limits** | Full Learn primer · **unlimited paper trades** · 5 AI explains/day · 3 saved Bet Builder positions · 1 saved Quant workspace | Decision | Identical everywhere. |
| **Model accuracy** | **Banded 55.5% (LOW) → 66% (ULTRA)** out-of-sample | Verified in `ai quants/serve.py` | The live **`value={77}` "ultra-tier accuracy %"** stat in `app/learn/page.tsx` is **wrong/unsourced and must be removed or disclaimed first** (highest-risk string on the site). One band, everywhere. |
| **SEBI loss stat** | **~91% of individual F&O traders had net losses; ~₹1.05 lakh crore aggregate in FY25** | Lock as canonical citation; verify filing once | One owner (Pratham) confirms exact figure/period/gross-vs-net **once**, freezes the citation text, every surface references it. Always "Source: SEBI." Never rounded up. |
| **Broker line (Y1)** | **One pilot, ~₹15–40 lakh/yr (~$18–48k)** | Realistic | The seven-figure "₹7.2cr / $867k full-ramp" is a **Phase-3+ ceiling**, not Y1. The pilot's job is the **logo and exit proof point**, not Y1 ARR. |
| **Money rail** | **Merchant-of-Record (Paddle / Lemon Squeezy) global + Razorpay India** | Decision | An India-domiciled entity cannot cleanly sell USD subs on native Stripe. MoR is seller-of-record, handles global tax, pays to an Indian bank. ~5% fee, **modeled into ARPU above**. |
| **IV/Greeks feed** | **$1,000–4,000/mo** recurring | Phase-2 COGS | Most underestimated cost. Get 3 written quotes before committing. The one line that may need outside cash. |
| **Team** | Shaurya (engine/backend/payments/content), Joshmann (product/design/frontend), Pratham (ops/compliance/user pipeline, owns 120 warm interviewees) | Fixed | 3 people, capital-light, India-based. |

**Verification owner:** Pratham owns reconciling every "verified against code" claim and the SEBI citation; Shaurya owns the accuracy-band and code-surface verifications. One person, one read, one locked number — because internal inconsistency is itself a diligence failure for a company whose pitch is "clean numbers."

---

## 1. Executive Summary

Retail options trading is a structural boom on top of a structural tragedy. US listed options hit ~13.8B contracts in 2025; retail is ~45–50% of flow; ~57% of SPX volume is 0DTE — the most addictive, most loss-generating corner of the market. And the most credible, government-sourced fact in the entire space: **SEBI found ~91% of individual F&O traders lose money — ~₹1.05 lakh crore vaporized in FY25.** Our entire thesis is to capture the 91% *before* they fund a broker.

**The bet:** Nobody owns the visual, AI-narrated, learn-by-doing → paper-trade beginner journey. OptionStrat visualizes for experts. tastytrade lectures. QuantConnect demands code. Sensibull is a dashboard for people who already understand. lazybull is **"Options You Can See"** — drag a probability cone, watch the Black-Scholes math, get an AI teacher to explain every Greek in plain English, paper-trade it with zero risk. The on-ramp every competitor skips.

**The wedge:** Win India's trust and dataset **for free** (near-zero CAC, the SEBI hook, the largest "how-beginners-learn-options" dataset on earth). **Monetize the global wallet** — the US/UK/CA/AU/SEA prosumer already paying $50–150/mo across stacked tools — with the AI teacher as the gated, highest-converting surface in fintech. Land **one** lighthouse Indian broker as the marquee logo.

**The number we're going for:** A real business at **~$1–1.3M combined ARR by ~Month 12–14**, scaling toward **~$2–2.5M by Month 18** — built capital-light, with **no priced VC round**. That revenue is the *credibility engine*. The actual millions-event is the one this architecture is engineered for from day one: **a strategic tuck-in (Composer→SoFi, Sensibull→Zerodha) at ~$2.5–3.5M ARR.**

**The honest valuation anchor:** The exit thesis rests on a proprietary behavioral dataset, a dependent broker, and a compliance-clean brand. **None of those fully exist yet.** So the priced anchor is the **floor — a $10–20M dataset+team tuck-in** — with **$24–36M** as the achievable case *conditional on hitting dataset scale with consent captured from day one*, and the ~24x AI-data-moat multiple (~$70M) treated strictly as an optimistic, cycle-dependent tail. We build revenue to earn the multiple; we engineer the dataset and architecture to earn the exit.

**What we do Monday:** Stand up the money rail that works *from India* (MoR), gate the AI teacher, re-enable the admin auth, kill the unsourced 77% stat, and clear the first real charge inside 40 days. Everything else is downstream of having revenue to defend.

---

## 2. The Market Reality (the tightest version)

**The boom is structural, not a fad.** ~13.8B US contracts in 2025 (6th straight record), ~59M/day (+22% YoY), a single-day record >110M on Oct 10. Retail ~45–50% of flow; ~57% of SPX volume 0DTE. ~30% of Gen Z started investing before 25.

**Don't anchor to the education-software TAM.** It's small (~$1.35B, ~12% CAGR); 2% of it is single-digit millions and a knife-fight with tastytrade and Varsity. The millions-path runs through capturing a thin slice of *tens of millions of young retail traders* (education as the acquisition wedge) and the larger ~$8–15B trading-*platform* software pool — not the education shelf itself.

**India is the beachhead, not a footnote.** World's largest options market (>84% of global equity-options contracts), ~120M unique investors, 192M demat accounts. The killer stat is canonical (§0). And India is **counter-cyclical to regulation** — SEBI's 2024–25 crackdown throttles *live* retail F&O while documenting the 91% loss rate and moving toward mandatory education. A paper-trading-first, no-signals, lagged-data product is the politically-aligned, regulation-resilient play: live-trading apps shrink under SEBI; an education sim grows.

**The competitive white space, in one table:**

| Camp | Players | Weakness we exploit |
|---|---|---|
| Analytics tools | OptionStrat ($40/$100), Unusual Whales ($48), Sensibull, Quantsapp | Visualize for people who *already understand*; no teaching, no AI narration |
| Broker-funded education | tastytrade, Zerodha Varsity | Lecture-heavy, not interactive; assume you want a brokerage account |
| Algo/quant workbenches | Composer ($32→SoFi), QuantConnect ($20–60) | Code-first, steep, zero hand-holding |

**Global hedge:** the same English SEO/content ranks in higher-RPM US markets; 0DTE/short-dated is the flagship hook; crypto options and micro-futures reuse the *same Black-Scholes engine* — low-build TAM multipliers that hedge SEBI top-of-funnel shrink.

---

## 3. The Strategy / North Star (and why it beat the alternatives)

**The chosen path: "The 91% Club" India wedge → "lazybull Pro" global monetization → engineered tuck-in.** Among nine adversarially-scored strategies, the India-F&O wedge scored highest on Market & Demand (7/10) for one undentable reason: it owns the single most credible, un-fakeable demand hook in the space. Every other strategy *borrows* the SEBI stat; this one is *built* on it. Its compliance posture isn't a constraint — it's counter-cyclical armor.

But we adopt it with three structural fixes the judges' critiques forced, because the raw India-first plan had real holes:

1. **The willingness-to-pay paradox.** You cannot charge "the 91% who lose money" a monthly fee while being legally barred from promising they'll make money. **Fix: India is free** — the dataset, SEO, and credibility engine, not the P&L.
2. **Channel double-count.** Stacking India B2C + multiple broker B2B deals on the *same* SEBI-compliance demand is cannibalistic fiction. **Fix: model exactly ONE broker**, and exclude India ₹ from ARR.
3. **Broker zero-pricing risk.** Zerodha made Sensibull free "forever"; a broker line can collapse overnight. **Fix: don't anchor ARR on B2B** — the one logo's job is de-risking the exit, not carrying revenue.

**What we explicitly killed** (and why — so they don't creep back in):
- **India-heavy B2C as the revenue engine** — the WTP paradox is fatal. India stays free.
- **The three-broker / $6.2M projection** — cannibalistic double-count. One logo.
- **LazyBull Arena / pay-to-fail retake mechanic** — charging the 91% per attempt with celebrated fail-and-re-pay economics is the *exact* predatory pattern SEBI and the FTC ($362M Online Trading Academy) target. Never.
- **Strava-for-Options virality as the primary play** — sub-critical k-factor (~0.15–0.35). We graft only its best idea (the shareable "Options You Can See" card) as a free top-of-funnel object.
- **The $59 flow-trader hero SKU as the wedge** — there's no real IV feed; you can't charge a flow trader $59 on synthetic IV. Power survives as a Phase-2 tier for *graduating prosumers*, after a real feed.
- **Pure acquisition-build play & synthetic "proof pack"** — selling PRNG-seeded KPIs to corp-dev is a diligence landmine. We engineer *for* the exit but earn it with real revenue and a real dataset.

**The one-line North Star:** *Win India's trust and dataset for free; monetize the global wallet with the AI teacher; build the behavioral-data flywheel before the UI gets cloned; engineer the Composer→SoFi tuck-in with real revenue and one dependent broker — never a synthetic proof pack.*

**The 12–18 month sequence:**
- **Phase 1 — Wedge (0–6 mo):** Ship the money rail + AI-teacher paywall. Rebuild the hero on the SEBI hook. Ship compliance-by-design and fix the three fatal code flags (§10). Found Shaurya as the content channel. *Verify: first real charge clears; admin funnel logs real events; 8–15k free signups.*
- **Phase 2 — Expansion (6–12 mo):** License a real IV/Greeks feed (turns "cute app" into "infrastructure," makes $39/$59 credible). Build the SEO engine on the free primer. Land ONE broker pilot. *Verify: ~$1M ARR run-rate in sight; one signed pilot.*
- **Phase 3 — Moat (12–18 mo):** Build the un-clonable flywheel (decision-trace dataset, confusion-resolution tuning, UGC marketplace, mastery leaderboard). Keep architecture broker-agnostic, AI modular, KPIs legible. *Verify: ~$2–2.5M combined ARR; clean diligence pack.*

---

## 4. Monetization & Pricing

**Constraint:** India is the free dataset/trust beachhead, NOT the ARR engine. Recurring dollars come from the global USD prosumer wallet + one broker. So: a USD paid ladder, an India tier run as top-of-funnel, and a paywall placed at the exact funnel step the admin cockpit already instruments.

### The ladder (built lean, anchored full)

| Tier | Who | Monthly | Annual (eff./mo) | Build status |
|---|---|---|---|---|
| **Free** | 91%-Club beachhead; SEO/dataset engine | $0 | — | Launch |
| **Plus** | Learner who finished the primer; unlimited AI teacher | **$19** | $180/yr ($15) | **Anchor at launch, gate later** |
| **Pro** | Active prosumer; the OptionStrat/Tradytics switcher | **$39** | $348/yr ($29) | **Launch (the one paid tier you build first)** |
| **Power** | Graduating quant; unlimited bots, BYO-bot, real IV/Greeks | **$59** | $540/yr ($45) | **Phase 2 — after real IV feed** |
| **India** | Funnel + dataset | **₹399 / ₹799** | ₹2,999 / ₹5,999 | Razorpay; **excluded from ARR** |
| **Brokers** | One lighthouse Indian broker | per-active-MAU | — | Phase 2, manual invoice |

> **Scope discipline for 3 people:** Ship **Free + Pro on the MoR provider only.** Plus and Power are *price points on the pricing page* from day one (anchoring), but you build and gate exactly two states — free and paid — to clear the first charge. Do not build four gating matrices before a single dollar clears.

**Blended global ARPU: ~$27/mo gross → ~$25.65 net after the ~5% MoR fee.** This is a 60/40 Plus/Pro launch mix (Power's slice removed, since Power isn't live at launch). India ₹ is excluded entirely. *This figure is illustrative on an unmeasured mix — treat it as a sensitivity input, not a projection.*

**India pricing** is paper-only on lagged data (lower cost to serve), undercuts Sensibull's ₹800 anchor, and exists to produce volume → dataset → the acquirer narrative — plus optionality if SEBI mandates investor education (then ₹399 becomes a *compliance* purchase, never a profit promise). **We forecast no material India paid revenue.**

### Where the paywall fires (resolving the cross-section conflict)

`proFunnel()` in `lib/admin-data.ts` already defines the path on five verified labels:

```
Visited /trade → Built a strategy → Opened paper trade → Hit pro paywall → Upgraded to Pro
```

**Decision (canonical, §0): paper trades stay UNLIMITED; the paywall fires on the AI-teacher daily cap and on saves.** This was specified two incompatible ways across inputs (one capped paper trades at 3; another made them unlimited and gated saves). We pick **unlimited paper trades + AI cap** because (a) the AI teacher is the highest-converting surface in fintech and the SKU we most want to gate, (b) capping the core "aha" (paper trading) before the aha lands depresses activation, and (c) it keeps the free experience genuinely free so the dataset flywheel doesn't break. The funnel's `Opened paper trade → Hit pro paywall` edge is interpreted as *"reached the AI/save wall during a paper-trading session,"* not *"blocked from a 4th trade."*

**Gating map (existing feature → tier):**

| Feature | Route/file | Free | Pro |
|---|---|---|---|
| Interactive Learn primer | `app/learn` | full | ✅ |
| Bet Builder (cone, probability ring, templates) | `app/trade` | ✅ unlimited paper trades | ✅ |
| AI-teacher narration | `app/api/explain/route.ts` | **5 explains/day → wall on 6th** | ✅ ∞ |
| Pro charting (multi-pane, Fib, EMA/VWAP, alerts) | `app/pro` | view-only, 1 pane | ✅ |
| Quant workbench | `app/quant` | 3 presets, **no save** | ✅ |
| Save workspaces to Mongo | `app/api/workspaces` | **1 (Bet Builder: 3 positions)** | ✅ ∞ |
| Real IV/Greeks feed | new (Phase 2) | ❌ | Power only |

> **Engineering reality:** `next-auth.d.ts` augments only `user.id` today — no `plan` field. Add `plan: "free"|"pro"`, `planTrialEnds`, `dailyExplainCount`, `paperTradeCount` (the counter still useful for funnel analytics even though it's not the wall) to the Mongo user doc + session callback. Gate at the route handlers and the AI/save surfaces. **2–3 days** including the daily-counter reset logic and tests — not "1 day." Reuses the existing funnel labels verbatim, so the cockpit lights up the moment it ships.

### Trial vs. freemium

**Freemium floor + card-required 7-day Pro trial on the upgrade action.** Free stays genuinely free forever (it's the dataset/SEO/India engine; gut it and the flywheel breaks). At any wall, the offer is a card-required 7-day Pro trial. Card-required trials convert materially better than opt-in (directional SaaS priors, not measured for us). Push annual relentlessly — default the toggle to annual; frame Pro as "3.4 months free."

> **The conversion number is not a forecast.** With zero historical funnel data, the first 90 days are *instrumentation*, not a revenue plan. The honest Day-90 success criterion is "we can read true trial→paid from real Mongo data + ≥10 paying customers," not "we hit 6%." Do not put a conversion % in a board deck.

### Conversion levers
1. **Aha-gate, not cold-gate** — wall on the 6th explain or a save, never a first-time visitor.
2. **Card-required 7-day Pro trial** on every wall.
3. **Annual default + "X months free."**
4. **Anchor down** — show Pro $39 first; $19 Plus reads reasonable; $59 Power makes Pro look mid.
5. **Sell confidence, never profit or time saved** — *"Trade with the confidence of having practiced 100 times — risk-free."* Legally clean, higher-converting.
6. **AI-teacher as trigger** — instrument `/api/explain → next paper trade within 24h`; the mid-lesson token wall is the warmest upgrade moment.
7. **Shareable "Options You Can See" card** + "copy this trade" deep link — near-zero-CAC top-of-funnel feeding the same wall.
8. **Dunning + win-back from day one** — provider Smart Retries + a 3-email recovery sequence.

### Money-rail wiring (MoR, not native Stripe)
Because an India entity can't cleanly sell USD subs via native Stripe, the global rail is a **Merchant-of-Record (Paddle or Lemon Squeezy)** — seller of record, handles global tax/VAT/GST, pays to an Indian bank, **no foreign entity required, ~5% + fees (already in the ARPU above).** India runs on **Razorpay Subscriptions + UPI Autopay**. One internal entitlement model (`lib/billing/entitlements.ts → getPlan(userId)`) behind both, so the app never knows which processor charged. Use the MoR provider's *actual* webhook events and trial mechanics (they differ from native Stripe's `checkout.session.completed` / `trial_period_days` — do not architect against Stripe's API). **Razorpay live-mode needs a registered Indian entity + KYC — start Day 0; until it clears, India stays free / global ships first.** B2B broker billing is manual invoicing in arrears against the cockpit's active-MAU counts.

---

## 5. The Path-to-Millions Model

**One sentence:** India fills the funnel for free and builds the dataset; ~25–66k *global-weighted* free users convert at 3.5–7% on a ~$25.65-net sub; one broker adds a small near-zero-CAC slug; and the realistic millions-event is an acquisition, not a Series A.

> **Framing discipline (the critic's central correction):** the original model committed the same sin it accused others of — multiplying three unmeasured fractions (ARPU × conversion × global-share) and reporting the product to three significant figures. **All figures below are pre-data, illustrative sensitivity points, not a forecast.** We stop reporting payer counts and ARR as if precise.

### Assumptions (canonical, §0; restated load-bearing here)
- ARPU **$25.65/mo net** ($308/yr) — illustrative on an unmeasured 60/40 mix, net of MoR fee.
- Conversion **3.5% / 6% / 7%** applied to the **global-weighted base only**.
- Global-weighted share **45% / 50% / 55%**.
- CAC **~$0 India / genuinely-$0 global channels only** (see §8 — paid channels do not clear the gate).
- Churn 3%/mo annual → 6%/mo monthly; push annual hard.
- Broker **one pilot, ~$18–48k Y1** (the seven-figure full-ramp is a Phase-3+ ceiling).
- Recurring COGS: IV feed **$1–4k/mo** + LLM tokens (low hundreds/mo) + hosting (low hundreds/mo).

### Three cases at Month 12 (sensitivity, not precision)

| | Conservative | Base | Aggressive |
|---|---|---|---|
| Cum. signups | ~55,000 | ~80,000 | ~120,000 |
| Global-weighted | ~24,750 (45%) | ~40,000 (50%) | ~66,000 (55%) |
| Conversion | 3.5% | 6% | 7% |
| Payers | ~870 | ~2,400 | ~4,620 |
| **B2C ARR (net)** | **~$268k** | **~$739k** | **~$1.42M** |
| **Broker booked Y1** | $0 (pilot unsigned) | ~$30k (realistic pilot) | ~$48k |
| **TOTAL Y1 (prudent)** | **~$268k** | **~$770k** | **~$1.47M** |

> **The honest read on "crossed a million by M12."** The earlier package leaned on a $500k broker booking to claim a $1.3M base case. **The realistic broker pilot is ~$18–48k, not $500k** — so the base case is **~$770k at M12**, and B2C alone crosses **$1M around M14–16.** "A million combined" is a **Month 14–16** milestone, not Month 12. We state this plainly because an inflated broker number is exactly the kind of thing diligence catches.

### When $1M ARR actually arrives

| Path | Requirement | Earliest realistic |
|---|---|---|
| B2C-only | ~50k global-weighted × 6% × $308 net | **~M14–16** |
| Broker-led upside | One broker fully ramped (~350k MAU @ ₹20) | **~M14+ *if* signed and ramped** — the biggest single dependency |

The North Star's M18 target — **~$1.8–2M B2C + a ramping broker = ~$2–2.5M combined** — is the true "millions-ARR company" moment, ~18 months from first charge. **The number that breaks the timeline is conversion:** at the 3% freemium floor, B2C reaches $1M only near M18. Instrument it obsessively.

### The combined cash-flow reality (the missing P&L)

The plan asserts "capital-light bootstrap" — here is the proof it must clear. At the **base case** (~$60–67k MRR by M12), a $4k/mo feed is ~6% of revenue — survivable. At the **conservative case** (~$22k MRR), the same feed is ~17% — and the feed must be paid *before* the Pro/Power data tiers are credible, i.e. **spent before that revenue exists.** Net: founder burn (~$5–7k/mo at zero salary) + feed + tokens + hosting is fundable on ~$40–60k of savings/early MRR **only if the IV feed is deferred to Phase 2** (after Pro converts) and **only if conversion clears ~4%+**. The **IV-feed licensing cost is the one line item that can require the optional angel SAFE** (§11). Get a written quote now so the margin isn't built on an unknown.

### Why the organic path is genuinely hard (stated, not hidden)
1. **India inflates the wrong number** — those signups are ~$0 ARPU by design. The model only works if the *global-weighted* fraction grows, which needs the Phase-2 SEO engine *and* a real IV feed ($39 against Unusual Whales is not credible on synthetic IV).
2. **The broker is a one-shot, key-man, 9–15-month sale** a 3-person pre-revenue team lands once, or never. It's the highest-leverage *and* riskiest line.
3. **Conversion is the highest-variance assumption** — 3% vs 7% is the gap between a ~$270k lifestyle business and a ~$1.4M venture-scale one.
4. **Capacity** — four workstreams (content, product/IV, SEO, broker sales) across three people. Sequence them: content + product in P1; SEO + broker in P2. Don't start the broker sale before a dataset and live demo exist.

### The likelier millions outcome: acquisition

For a 3-person, capital-light, India-based team, the **acquisition is more probable than grinding B2C to $10M ARR.** A buyer isn't buying ARR — they're buying four hard-to-clone assets, **each of which is conditional and not yet real:**

| Asset | Value to buyer | Conditional on |
|---|---|---|
| **Behavioral dataset** (decision traces, confusion points) | The one thing no GPT wrapper, OptionStrat, or TradingView owns | Reaching scale **with DPDP consent captured from day one** — unconsented = un-sellable, discounted to zero |
| **One dependent broker** | Proof the layer slots into a brokerage and retains | Signing the pilot |
| **Compliance-by-design brand** | Clean vs SEBI/SEC/FTC; first thing diligence checks | Fixing the three fatal flags (§10) |
| **AI-narrated workbench + Learn IP** | Conversion-instrumented teaching surface | Already largely built |

**Acquirers & blueprints:** Indian brokers (Zerodha/Groww/Dhan/Upstox/Angel One — Sensibull→Zerodha template); global neobrokers (SoFi/Public/Robinhood/Webull — Composer→SoFi template); charting/analytics (TradingView/tastytrade/IBKR — the on-ramp they skip); EdTech/AI-infra buyers (the dataset + tuned teacher).

**Multiples — anchored honestly:**

| Scenario | ARR | Multiple | EV | Treatment |
|---|---|---|---|---|
| **Floor** (ARR underperforms; dataset + team real) | <$1M | tuck-in | **$10–20M** | **The honest anchor** |
| **Achievable SaaS case** | ~$3M | ~8–12x | **$24–36M** | *Conditional* on dataset scale + consent + a signed broker |
| **Data-moat / AI premium** | ~$3M | ~24x | **~$70M** | Optimistic, cycle-dependent **tail — not the plan** |
| **Worst case** (no traction, no dataset) | ~$0 | acqui-hire | **<$10M** | What zero revenue guarantees |

**Verdict:** revenue is the credibility engine that lifts you from a <$10M acqui-hire to the $24–36M conditional case; the dataset + architecture earn the exit. The hardest single dependency across *both* the revenue and exit paths is identical: **landing one broker** — simultaneously the ARR slug and the asset that turns a "cute simulator" into acquirable infrastructure. Likely dollars-out: **acquisition, ~M18–30, at ~$2.5–3.5M combined ARR.**

---

## 6. AI as the Moat (roadmap)

**Thesis in one line:** the model is rented; the proprietary asset is the *dataset of how beginners learn options* and the teacher tuned on it. The pitch is *"we own the dataset and the tuning,"* not *"we have ML models."*

**What ships today (verified):** `/api/explain` — a stateless single-shot teacher hardcoded to `gpt-4o-mini` (`route.ts:73`) with an honest `source:"mock"` fallback when `OPENAI_API_KEY` is absent (`route.ts:52-53`); a **27-bot workbench** (12 AI + 15 classical) whose **consensus bot votes over 6 direction models** (not "27-bot consensus"); a FastAPI service loading **5 option-pricing surrogates** (BS/IV/MC/American/Heston) + sequence-CNN/transformer nets, with the **direction ensemble in sklearn** (not PyTorch) at **banded 55.5–66% accuracy** (the canonical band — and the live `value={77}` stat must be removed first; §0, §10).

**Claude migration decision:** migrate every teaching surface off OpenAI to the Claude family — pedagogical quality on multi-paragraph explanation *is* the product; prompt caching on the frozen system prompt collapses per-call cost; Haiku-class pricing is competitive while Sonnet/Opus give headroom on hard surfaces. *Verify exact model IDs and prices at build time — they drift.*

### Five-phase build (padded for a 3-person team where AI is not the only job)

| # | Capability | Phase | Effort | Gate | Model class |
|---|---|---|---|---|---|
| A | Migrate teacher → Claude + streaming + prompt cache | P1 (0–6) | 3–4 days | Free (capped) | Haiku |
| B | Decision-trace logging (flywheel raw material) | **P1 (0–6), day one** | 2–3 wks | All tiers (silent, consented) | — |
| C | Copilot v1 — post-trade critique | P1→P2 (4–9) | 4–5 wks | **Pro $39** | Sonnet |
| D | Natural-language-to-strategy | P2 (6–12) | 3–4 wks | Pro | Opus |
| E | Confusion-resolution fine-tune + copilot memory | P3 (12–18) | 5–7 wks | **Pro at launch; Power once Power ships** | Haiku (tuned) + Sonnet |

**~17–23 person-weeks of net-new AI work over 18 months ≈ ~1.5 engineers if AI were their only job — it isn't.** If forced to cut, **cut D before C** (D is table stakes; C is the moat surface). **Resolving the tier contradiction:** because Power isn't a launch tier, **Build E's confusion-tuned narration gates to Pro at launch and migrates to Power only once Power ships in Phase 2.** Nothing gates behind a tier that doesn't exist.

**(a) The personalized copilot — the gated premium surface.** Stateful and proactive (today's teacher is reactive/stateless): watches the paper portfolio, remembers sessions, critiques *patterns*. Build order: post-trade critique (Pro gate, built entirely on data we already have) → weekly pattern digest → live cone coaching. **Why it's a moat, not a feature:** a competitor can bolt "AI explains this trade" on in weeks, but cannot bolt on "AI that remembers this user confused theta with delta three sessions ago" — that requires the decision traces (Build B). Instrument against the North Star metric: **AI-narration → next paper trade within 24h** (treat the "Public.com ~50%-in-24h" figure as a target to validate, not a guaranteed benchmark — re-source before quoting externally).

**(b) Natural-language-to-strategy** is table stakes (Composer/QuantConnect Mia/NexusTrade all have it) — build it only as an **on-ramp into the visual builder**, emitting a *populated draggable canvas, never an execute-this recommendation*, validated against the Bet Builder's existing JSON schema.

**(c) The teaching-data flywheel — the un-clonable asset.** Logging starts **day one of Phase 1** (cumulative value; India's free funnel makes it large). Capture cone-drags, Greek tweaks, `/api/explain` calls, paper-trade outcomes, and — the gold — **confusion points.** Three things the schema needs from day one: **(1) `schema_version`** for migratability; **(2) explicit DPDP-compliant consent + anonymization** — a behavioral dataset on Indian users is DPDP Act 2023 in scope, and unconsented traces make the moat a liability, discounted to zero in diligence; **(3) a written confusion heuristic** (e.g. same explanation re-fetched ≥2× within 5 min, OR an undo within 10s of a Greek tweak, OR a Bet Builder session abandoned after >30s).

**Build E precondition, stated plainly:** the fine-tune needs **on the order of 1,000+ clean confusion-resolution tuples** to beat few-shot prompting. **If Phase-1/2 volume doesn't produce that, E becomes "a better few-shot prompt library," not a fine-tune.** Don't promise the fine-tune (or price the company on it) until B's volume confirms feasibility — this is *the* condition behind the data-moat valuation.

**Own vs. rent:** rent the teacher LLM (frontier reasoning isn't where 3 people compete); keep the 5 pricing surrogates (deterministic, cheap, power the `source:"mock"` fallback); **own the decision-trace dataset and the tuning fiercely**; keep the 55.5–66% ensemble **but frame it permanently as pedagogy** ("watch 6 models disagree, understand why the market is uncertain"), never as an oracle — converting a SEBI-hostile predictive claim into a teaching surface.

**Ships first (Phase 1, near-zero-regret):** (1) migrate `/api/explain` → Claude Haiku (swap `route.ts:73`, add streaming, cache the system prompt, **preserve the `source:"mock"` fallback exactly**); (2) ship decision-trace logging **with consent + `schema_version` + the confusion heuristic, before monetization**; (3) stand up copilot v1 post-trade critique on Sonnet as the first gated Pro feature, instrumented against the 24h metric.

---

## 7. 90-Day Plan (sprints)

**Objective (narrow, non-negotiable):** stand up a money rail that works *from India*, gate the surfaces worth paying for, and convert the **first ~50 paying global customers** off a card-required trial — while India stays 100% free. Broker deal, real IV feed, and the data flywheel's *fine-tune* are Phase 2; **decision-trace logging is Phase 1.**

**Cadence rule (resolving the contradiction):** each person owns **one shippable outcome per sprint, decomposed into ≤3 sub-tasks.** Sprint 1's "money rail end-to-end" *is* one outcome with three sub-tasks; that's the rule, applied consistently. **Shaurya is on the payments critical path AND the content channel — so content is explicitly throttled to a sustainable cadence (§8), and the share-card/cost-guardrail items are sequenced into later sprints, not piled onto his payment sprints.**

**Verified ground truth:** zero payment code in `package.json`; admin auth commented out in `app/admin/page.tsx` (~30-min re-enable); `lib/admin-data.ts` KPIs are `mulberry32`-seeded mocks; `/api/explain` is ungated/uncapped; `next-auth@5` + `@auth/mongodb-adapter` + `mongodb` already installed to reuse.

**Pre-sprint blocker (Days 1–3):** decide the rail. An India entity can't cleanly sell USD subs on native Stripe. **Decision: MoR (Paddle/Lemon Squeezy)** unless a US entity already exists. Razorpay KYC submitted Day 0 (the long pole).

| Sprint | Shaurya (one outcome) | Joshmann (one outcome) | Pratham (one outcome) | Done = |
|---|---|---|---|---|
| **1 (1–14)** | **Money rail end-to-end:** MoR account → webhook writes `plan`/`planRenewsAt` to the NextAuth/Mongo user doc → `getPlan(userId)` helper | **Re-enable admin gate** (uncomment auth) + scaffold static `/pricing` shell | **Real-funnel collector v1:** Mongo `events` (`visit`/`signup`/`hit_paywall`/`convert`); replace those 4 mock numbers; finalize MoR decision + KYC | Sandbox charge flips a real user to `pro`; `/admin` requires login; real events land |
| **2 (15–28)** | **The gate + free-tier limits:** `getPlan` gate on AI-teacher cap (6th `/api/explain`/day) + Quant/Bet-Builder saves; add the daily counter. **Free: 5 explains/day, 3 saved positions, 1 workspace, unlimited paper trades, full Learn primer** | **`/pricing` live, hardcoded:** Plus $19 / Pro $39 (Power shown as "coming soon"); annual default; India ₹399/₹799 → waitlist, not checkout | **Compliance banner + disclaimers + kill the 77% stat** (§10 F1/F3): "educational simulation · paper only · not advice"; label every Sharpe/backtest/accuracy figure hypothetical | 8 friendlies hit the wall; ≥3 start a card-required trial; `hit_paywall` fires real |
| **3 (29–42)** | **India lagged-data guard** (§10 F2 — legal gate, do first) **then** the shareable OG "copy this trade" card | **Rebuild hero** (`components/Hero.tsx`) on the SEBI hook (canonical citation) | **Decision-trace logging v1** with consent + `schema_version` + confusion heuristic (Build B) | **300–500 free signups** (cold founder channel + 120 warm), ≥3 organic shares, working `visit→signup` |
| **4 (43–56)** | **Conversion wiring:** instrument AI-narration → next-paper-trade-24h; at-cap upgrade prompt | **Trial→paid plumbing:** annual nudge at trial day 5; rely on MoR provider dunning | **Global seeding pass:** r/options, Discord, route founder CTA to US/UK/CA/AU | **First 10 paying strangers**; trial→paid ≥15% *or* revisit the mechanic |
| **5 (57–70)** | **A/B the paywall trigger** (gate after 3 vs 5 explains; save vs run) on the now-real funnel — no new surfaces | **Shorten onboarding → first paper trade** (the activation event) | **Diagnose top-3 trial-abandon reasons**; weekly "91% teardown" content | Blended free→paid ≥3% global-weighted; **25+ paying**; CAC ≈ $0 |
| **6 (71–90)** | **Cost guardrail:** hard per-user + global daily token ceiling on `/api/explain` (at Haiku/4o-mini pricing, 5 explains/user/day ≈ <$0.01/user/day — safe, but cap against scrapes) | **Real conversion dashboard:** finish replacing mock KPIs with live aggregates + MRR (now the diligence pack) | **Razorpay/INR scoping spike** (not shipped) + public "we're live and charging" moment | **~50 paying** (100 stretch), **~$1–2k MRR**, one legible signups→trial→paid→MRR slide |

**Kill / pivot criterion:** if by **Day 56** there are **<5 paying strangers** *and* trial→paid is **<8%**, stop adding sprints and run a hard diagnosis week — the problem is positioning or the paywall surface, not feature count.

**Explicitly NOT in 90 days** (Phase 2+): real IV/Greeks feed, real earnings calendar, broker white-label, the confusion-resolution *fine-tune*, mobile app, INR live billing, UGC marketplace.

**The single most important Week-1 thing:** *Pick the money rail that works from India (MoR), wire one real charge that flips a NextAuth/Mongo user to `pro` via webhook, and re-enable the admin gate in the same pass.* The rail is ~2–3 days of Shaurya's time **once the provider account clears KYC** — KYC, not code, is the long pole. Do it before touching a pixel of the hero.

---

## 8. Growth & Distribution

**Constraint dictates strategy:** 3 people, no paid-ads budget, India-based. We win on owned + earned channels where marginal CAC approaches ~$0. **At most 2 acquisition channels run hot at once.** SEBI's 91% stat is our free top-of-funnel; we do not buy our way into India.

### The two-cohort CAC frame (never blend them)

| | India F&O (18–32) | Global prosumer (US/UK/CA/AU/SEA) |
|---|---|---|
| Role | Top-of-funnel, dataset, trust | The ARR engine |
| Monetized? | No (free / ₹399–799 funnel) | Yes — Pro $39 (Plus $19 later) |
| **CAC ceiling** | **~₹0** | **< $28 per *paid customer*** |
| Channels | SEO, founder Reels, share card, Discord | SEO, AI-citation, founder Shorts, PH, referral |

> **The unit-economics correction that breaks the naive paid plan.** The CAC ceiling is **per paid customer, not per signup.** At 6% conversion, a $15 *signup* CAC = **$250 per paying customer** — ~9x over the $28 ceiling and below LTV-positive. **Therefore: only genuinely $0 channels clear the gate — founder content, SEO, and the share card.** Paid educator affiliates ($8–20/signup → $130–330/paid) and paid ads **do not clear it and are not in the plan.** The blunt consequence: *the "monetize the global wallet" engine has no proven paid acquisition path — it rides entirely on owned/earned channels and the share-card flywheel.* This is a real risk, stated, not hidden.

### Channel ranking (sequenced, max 2 hot)

**#1 — SEO / Content moat (highest-leverage, lowest-CAC, but slow).** The 14 interactive chapters + bot pages are the only runnable options-education corpus on the open web. Programmatic play: **Strategy × Ticker matrix** (12 templates × ~150 liquid US+India tickers ≈ **1,800 pages**, reusing the Bet Builder engine) + Greek×strategy pages. **Ship in tranches — 200 pages, measure indexation 60 days, expand only what ranks** (mass-templated thin pages trip Google's scaled-content-abuse policy, *higher* risk for a new domain). Layer **GEO/AI-citation** (TL;DR blocks, Schema.org, a ~120-term glossary) as a **$0 rider, unmeasurable** — track via branded-search lift, not a CAC. **Compliance is template-injected on every page** (paper-only banner, "hypothetical" stamps, India lagged data). Honest funnel: ~720 ranking pages × ~30 visits/mo × ~4% ≈ **~860 signups/mo at maturity (month 9+)** — this funds Phase 2, not Phase 1's cold start. 6–9 month lag.

**#2 — Founder-led short-form (the actual Phase-1 cold-start engine).** The product *is* the content: screen-recordings of the cone drag / 6-bots-disagreeing / AI narration, one punchy hook. **Sustainable cadence: 5 native clips/week from Shaurya, repurposed across 3 platforms — start ONE platform, prove a format, then cross-post.** Plan for a **2–3 month algorithmic dead zone**; model a **2–4% breakout rate** (not the 8–12% top-decile fantasy). Add a paid editor only *after* a format proves out. Guardrail: never imply profit — every clip ends "paper only — learn before you risk a rupee."

**#3 — "Explain this trade" share mechanic (CAC-reducer, not engine).** Every paper trade → an auto-rendered card (payoff curve, probability ring, one-line AI thesis, watermark) with a **deep link that reconstructs the exact trade into a live Bet Builder.** Honest k-factor ~0.15–0.35 — it *assists* channels 1/2; we don't bet the company on it. ~2 weeks; makes every other channel's traffic shareable.

**#4 — Product Hunt + launch sequence (a one-time moment + backlink portfolio).** 3-week founder sprint: 200–300-person ship list, soft-launch in r/options & r/IndianStreetBets, tease the share card, PH launch ("the visual options simulator that explains every trade — paper-only"), directory blast (BetaList/TAAFT/AlternativeTo/SaaSHub — most nofollow, a handful carry weight), Show HN on the student-built Black-Scholes angle. Realistic: **~1–3k high-intent signups**, mostly tire-kickers. Relaunch in Phase 2 with live IV.

**#5 — Discord (weak as acquisition, #1 for retention + dataset + UGC).** `#paper-trade-of-the-day`, `#bot-lab` (seeds the UGC marketplace + dataset), `#learn-together` cohorts gamified on **mastery/streaks, never P&L** (P&L leaderboards invite SEBI scrutiny), weekly founder teardowns. **Seed cold from share cards; do not staff daily moderation until ~300+ members.** Phase-1 seed → Phase-2 invest.

**#6 — Referral (switch on in Phase 2, after there's a paid product).** Global: double-sided "give a month of Pro, get a month" — pay-for-performance, cost only on a converting referral. India: **non-cash, status-based only** (tokens, badges) — cash incentives on a "make money" product invite SEBI/FTC scrutiny.

**#7 — Broker & educator partnerships (Phase 2–3, #1 by ARR-per-deal).** The lighthouse broker is the Sensibull→Zerodha blueprint — but model a **realistic ~₹15–40 lakh/yr pilot** (§0), 9–15 month cycle, the win is the **logo and exit proof point**, not near-term ARR. Educator partnerships only with **registered-educator / "learn-first" creators** (SEBI's crackdown makes tip-creators radioactive and compliance-positioned ones newly valuable); pay affiliate %, not flat sponsorships; never sponsor anyone who posts buy/sell calls — one association poisons the compliance brand.

### Two things every channel depends on (build Week 1)
1. **Activation, not just acquisition.** Define and instrument **% of signups who place ≥1 paper trade within 24h** and gate channel scaling on it — a leaky bucket makes every channel uneconomic.
2. **Cohort-split tracking infrastructure** — India vs global by geo/language, UTM discipline, "how did you hear about us," per-channel signup→activation→paid dashboards. Without it, none of the CAC discipline above is possible.

### The sequence

| Phase | Months | HOT (max 2) | SEEDING | Target |
|---|---|---|---|---|
| **P1 Wedge** | 0–6 | Founder short-form • SEO build-out | Share card, PH (one moment), Discord seed, **trace logging** | First charge clears; **8–15k free signups** |
| **P2 Expansion** | 6–12 | SEO at scale • Referral | Broker BD, educator affiliates, Discord invest | **~$770k–$1M ARR run-rate; 1 broker pilot in discussion** |
| **P3 Moat** | 12–18 | Broker pilot • Programmatic SEO at full ~1,800 pages | UGC marketplace, PH relaunch w/ live IV | Clean diligence pack; ARR toward $1M+ |

**Review cadence:** monthly — any channel that hasn't beaten its CAC ceiling (or, for India, isn't producing dataset volume) after its ramp window gets **paused**, attention reallocated. Prevents the slow death of running everything at half-effort.

---

## 9. Brand & Positioning

**The job:** make a 3-person team sound trustworthy in a category whose default association is a rented-Lamborghini Telegram guru. This section is the language source-of-truth.

**The category we own:** not "trading education" (a ~$1.35B knife-fight) — **"Visual Options": options you can see, drag, and paper-trade before you risk a rupee.**

| Old shelf (crowded) | Our shelf (empty) |
|---|---|
| Options **analytics** (for people who already understand) | **Visual Options** — the on-ramp *before* analytics makes sense |
| Options **courses** (watch, retain nothing) | **Options you can see** — drag it, don't sit through it |
| Options **signals** (illegal, 91% lose) | **Options you practice** — paper-only, no tips |

**Honest limit:** "category" is a marketing frame, not a moat. The real moat is the SEBI-compliant paper-only posture + the India wedge + speed + the dataset — and an incumbent *can* eventually bolt on the UI. The defense is **being first and being trusted**, not the phrase. The phrase that travels everywhere: **"Options You Can See."**

**One-sentence positioning:**
> For the 18–32 trader who knows options are where the money is — and where 91% lose it — lazybull is the visual workbench where you learn options by dragging, building, and paper-trading them, with an AI teacher that explains every move in plain English. Unlike analytics tools built for people who already understand, or gurus who sell signals, lazybull is the on-ramp: zero-risk by default, on the regulator's side of the line.

**Three proof pillars:** (1) **Visual** — drag the chain to build spreads (live in the hero); (2) **AI-narrated** — explains all 6 Greeks in plain English; (3) **Paper-only by default** — $100k paper, kill switch, no broker, no tips (the trust pillar and the compliance moat in one).

**Messaging by audience (four first sentences, one product):**
- **Beginner (global free):** "Understand options before you ever risk a dollar." CTA: *Start free — no card, no broker.*
- **Prosumer (global ARR):** "Visualize, model, and stress-test any options trade — with an AI that explains the why." CTA: *Start your 7-day Pro trial.* **Do not claim "replaces Unusual Whales" or "real-time data" until we license a feed** — sell on *understanding*, not data parity. Overselling here gets us torched in r/options.
- **India F&O (the wedge — free):** **"91% of F&O traders lose money. Learn why — on paper — before you risk a rupee."** Always "Source: SEBI"; never round up — un-fakeability *is* the asset. CTA: *Learn free. Practice free. Risk nothing.*
- **Broker (one logo, Phase-2 narrative — keep the deck warm, don't build a pipeline yet):** "The SEBI-compliant education and onboarding layer your new F&O users need — white-labeled, paper-only, per-MAU."

**Tier naming:** master brand always **lazybull** (lowercase). Tiers are short competence words: **Free / Plus / Pro** (Power deferred to Phase 2). No cute names — in a fraud-soaked category, **restraint is the brand.** Resolving the package's tier conflict: **launch with two paid tiers (Plus anchor + Pro built), Power is a Phase-2 SKU** once real IV makes a bot ensemble demoable — and we do **not** market the bot ensemble until it's demoable (the hero shows 6 Greek explainers, not a "27-bot consensus").

**The narrative that makes this trustworthy** (the category's perception problem is our opportunity):
- **Origin story, led with:** three Newton School of Technology students; Shaurya hand-coded the Black-Scholes engine (0.4ms full-chain pricing, live); Pratham ran 120+ interviews. **Both numbers must be checkable — if interviews are approximate, say "100+."** Founders who inflate their own origin story in an anti-fraud brand are dead on arrival.
- **Four trust signals, made physical:** (1) **paper-only by default** — the thing a scammer can never say; (2) **no signals, ever** — any multi-model feature is "watch the models disagree," pedagogy not a tip; (3) **"Source: Mock" honesty** — labeling a synthetic number is a radical trust signal and **non-optional** given we ship with mock/lagged data; (4) **the regulator is on our side** — persistent "educational simulation, not advice, paper only" banners are brand, not legal cost.
- **Compliance is a real obligation, not a vibe:** before the India page is live, get a one-page T&C + risk disclaimer reviewed by an actual Indian lawyer (budget one consult), confirm education/simulation-only status, scrub every "advice"/"recommendation"/implied-return from copy.

**Five hero headlines** (A/B-test the top three *only once traffic reaches significance* — until then ship #1):

| # | Headline | Subhead | Lever |
|---|---|---|---|
| **1 (lead)** | **Options you can see.** | Drag the trade. Watch the math. Paper-trade it — before you risk a rupee. | Category |
| **2 (India)** | **91% of options traders lose money. Learn why — on paper.** | The visual workbench where you practice with zero risk. No tips. No broker. Source: SEBI. | Fear-of-loss |
| **3 (global)** | **Stop reading about options. Start seeing them.** | Visualize, model, and stress-test any trade — with an AI teacher that explains every move. | Mastery |
| **4** | **The options workbench with training wheels.** | Build real strategies, run Black-Scholes live, trade $100K on paper. Risk nothing while you learn. | Safety |
| **5** | **An AI that teaches you options. Not one that tells you what to buy.** | No signals. No hype. A visual workbench that explains the why — free to practice. | Anti-guru |

**Tagline lockup (always-on):** *Options you can see. Paper-only. AI-taught.* The India variant (#2) ships as a **separate route**, so the SEBI hook gets its own SEO/social surface and scoped compliance copy. Hero file `components/Hero.tsx` is already on-message (H1 already "Options you can see.") — add the tagline lockup; the H1 needs no change.

---

## 10. Legal/Compliance & Risk Register

**Thesis:** paper-only, no-signals, lagged-data simulation is the only defensible place to stand while SEBI throttles retail F&O. **Compliance is the moat.** But three live code surfaces flip that moat into registration-and-enforcement liability the moment a paid charge clears — because a fee strengthens the "held yourself out as an adviser" argument and revenue makes you worth suing. **Fix these three before the first charge.**

### The three fatal flags (fix before the first paid charge)

| # | Liability | Verified location | Why fatal | Fix |
|---|---|---|---|---|
| **F1** | Signal/sizing copy: "Real edge… Size up," "Half-Kelly is sensible," "BUY/SELL only fire when ≥5 models lean the same way" | `LearnConsensusPlayground.tsx:169–174`; `bot-content.ts:90,104,136` | Textbook personalized buy/sell + position-size recommendation. Pierces the *Lowe v. SEC* publisher exclusion, trips SEBI's RA regs, matches the finfluencer pattern SEBI removes posts for. A losing user + "Size up" = the cleanest possible complaint. | Strip every action verb and sizing term → past-tense impersonal: *"When ≥85% of models agreed historically, next-bar direction matched 65–77% of the time."* Ban: *you/buy/sell/size/Kelly/edge/signal/now.* |
| **F2** | Undelayed live Yahoo data served to India IPs | `app/api/quote/route.ts:25` (`query1.finance.yahoo.com`, intraday `range`/`interval`, `revalidate:30`) | Violates SEBI's lag rule + Yahoo ToS (bars commercial redistribution). At the first charge, "personal use" is gone — you're a commercial redistributor of an unlicensed scrape. | Geo-gate: India IPs → EOD/lagged only (region flag in `quote/route.ts`); migrate off the scrape before charging on data. |
| **F3** | Public hypothetical performance: **the live `value={77}` "ultra-tier accuracy %"** in `app/learn/page.tsx`, plus Sharpe/win-rate/"accuracy leaderboard" | `app/learn/page.tsx`; `ai-bots.ts:614,619`; `bot-content.ts:104,111`; `LearnBacktestBuilder.tsx:231`; `ModelSpread.tsx:131` | SEC posture: hypothetical/backtested performance shouldn't sit on an unrestricted retail page. A published accuracy leaderboard is performance advertising; add a fee → FTC deception exposure (*Online Trading Academy*, $362M). **And the 77% stat contradicts the canonical 55.5–66% band — an internally inconsistent accuracy claim is itself a diligence landmine.** | **Remove or disclaim the 77% first** (highest-risk string). Tag every Sharpe/accuracy/win-rate "Hypothetical, backtested — not indicative of future results." Kill the "accuracy leaderboard"; rank on mastery. |

**If you fix only one thing, fix F1** — the single line between "publisher of educational content" (safe) and "unregistered investment adviser" (SEBI + SEC exposure).

### The advice line, per regulator

The "paper-only, no-signals, lagged-data" safe harbor is real but **conditional** — it holds only while content stays impersonal, hypothetical, non-transactional.

| Regime | Stays SAFE | Crosses the line |
|---|---|---|
| **SEC (Advisers Act)** | Impersonal commentary → *Lowe* exclusion; paper-only = no custody | Individualized "you should…," sizing (F1) |
| **FINRA** | Never route orders/hold funds | Any real-money execution; "actionable signal" framed as suitable |
| **SEBI (RA/IA)** | Neutral education; no tips/targets; lagged data; no P&L leaderboards | "BUY/SELL fires," accuracy-as-advice, live data, **cash-prize/real-money leaderboards (illegal in India)** |
| **FTC** | No income claims | "Real edge," "size up" — disclaimers don't cure an express earnings claim |
| **MiFID II (if EU users)** | Fails the 4-part advice test (impersonal+hypothetical+non-transactional) | Personalized recommendation on a specific instrument |

**Operating rule for every screen/AI output/bot card:** describe what *happened historically* and what it *means*. Never instruct what to do/buy/sell/size. **`/api/explain` is highest-risk and highest-value** — hard-lock its system prompt: explain only the position the user already built, never recommend a new one, never state a target, never imply profit; keep and market the honest "Source: Mock" fallback.

### Disclaimers, ToS, Privacy (build these)
- **Persistent banner** on Trade/Quant/Pro: "Educational simulation · Paper-only · Not advice · Delayed/historical data." Not permanently dismissible.
- **First-run OCC-style options-risk interstitial**, acknowledged once, **logged with timestamp + user ID in MongoDB** (that log *is* your audit trail — an interstitial you can't prove was shown is no defense).
- **AI-output disclosure** on every `/api/explain` response.
- **Real `/terms /privacy /risk-disclosure /safety` pages** — today `Footer.tsx:165–170` has three dead `#` links and `Footer.tsx:175–183` one decent disclaimer. An acquirer's counsel finds the dead links in five minutes.
- **Privacy: DPDP Act 2023 applies to you today** as an India entity (not "when global") — add GDPR/CCPA. Disclose the behavioral dataset, state purpose as **product improvement and AI training explicitly**, list processors (Claude/OpenAI, Google, Mongo Atlas, the MoR provider, Razorpay). **An un-consented dataset is an un-sellable dataset** — diligence discounts unconsented training rights to zero (this is *the* condition behind the data-moat valuation in §5).
- **ToS clauses:** no advice/no fiduciary/not a BD or RA-RIA; paper-only/no order routing; no performance guarantee; AI "as-is"/no reliance; assumption of risk + liability cap (at fees) + indemnity; restricted-geo solicitation; no user redistribution of market data; UGC/bot-marketplace license clause (Phase 3).

### Entity & capital-adjacent legal
- **Run an Indian Pvt Ltd now** (Option A); pre-engineer a Delaware C-corp flip (Option B) for *just before* a US raise or US-acquirer LOI by assigning all IP cleanly to the opco today. **The single most common diligence-killer for a 3-founder team is unassigned founder IP** — sign IP-assignment agreements **this month** covering the Black-Scholes engine, the models, and the dataset. Cost ~₹0; fatal if missing at LOI.
- **Data licensing:** India → EOD/lagged now; license a ToS-clean delayed-quote + IV/Greeks feed in Phase 2 *before* charging on data; label IV "illustrative" until then. **Get a written quote now** — four-to-five figures USD/yr, and it gates gross margin (§5).
- **Payments/tax:** MoR handles global tax as seller-of-record; **India GST 18%** on domestic SaaS (register at ₹20 lakh); export of services can be **zero-rated under an LUT** — have a CA file it; keep FIRC/FEMA docs clean. **No real-money custody, ever** — paper-only keeps you out of money-transmitter territory.

### Ranked risk register

| # | Risk | Sev | Likelihood | Fatal? | Mitigation (owner) |
|---|---|---|---|---|---|
| R1 | Advice-line breach (F1 signal/sizing copy) | Critical | High (live) | **Yes** | Rewrite to impersonal hypothetical; lock `/api/explain` prompt — *Shaurya* |
| R2 | Data licensing / SEBI lag (F2) once monetized | High | Med-High | **Yes (India)** | Geo-gate India to EOD; license clean feed before charging — *eng* |
| R3 | Performance claims (the live 77%, Sharpe, leaderboard) | High | Med | **Yes** | Remove 77%; hypothetical tags; kill accuracy leaderboard — *Shaurya* |
| R4 | Un-papered dataset/IP (unassigned IP, unconsented training) | High | High (default) | **Yes at exit** | Founder IP-assignment now; DPDP consent in ToS — *founders* |
| R5 | No privacy/ToS pages; DPDP applies now | Med-High | High (current) | Blocks raise | Ship real legal pages — *eng* |
| R6 | Cash-prize/P&L leaderboard creep (Arena) | Critical | Low (if killed) | **Yes if shipped** | Never ship — keep Arena dead — *Shaurya* |
| R7 | Broker zero-pricing collapses B2B | High | Med-High | No (business) | Don't anchor ARR on B2B; one logo for the exit — *Shaurya* |
| R8 | AI hallucination relied on by a losing user | Med | Med | No | "As-is"/no-reliance; `/api/explain` guardrails; Mock fallback — *eng* |
| R9 | Entity/tax mess (no flip pre-planning; GST/FEMA gaps) | Med | Med | No (costly) | Option A now; pre-engineer flip; CA for GST/LUT/FEMA — *Shaurya* |
| R10 | SEBI top-of-funnel shrink cuts new F&O entrants | Med | High | No | Counter-cyclical positioning; faster globalization; India is funnel not ARR — *Shaurya* |
| R11 | **Key-person risk** — one founder built the engine | Med-High | High (default) | **Discounts exit** | Document the model; second founder fluent; clean IP assignment — *Shaurya/founders* |

**Bottom line:** Paper-only is your single greatest legal asset — guard it absolutely (no real funds, no order routing, no cash prizes, ever). The posture is ~80% right by architecture; the remaining 20% is copy and data hygiene living in four files. Fix F1/F2/F3 and paper the dataset before you charge, and "compliance-by-design" becomes the clean-diligence story that earns the conditional data-moat multiple instead of a sub-$10M acqui-hire.

---

## 11. Capital Strategy

**One-sentence answer:** **Bootstrap to first revenue, top up with at most one $150–300K angel SAFE taken for its *introductions* (not its cash), never run a priced seed, and engineer a tuck-in at $2.5–3.5M ARR.** A priced seed dilutes founders 15–25% to chase a $200M+ outcome the strategy deliberately rejects, then splits the $24–36M exit you actually want with investors who needed it to be 10x larger.

**Why the three paths diverge for *this* company:**
- **India cost base, 3 technical founders:** runway-per-dollar ~4–6x a US team; ~$200K funds ~12–18 months (only if founders take zero/sub-market salary — model both).
- **The target is a sub-$70M exit:** a seed VC underwrites $1B outcomes; a $30M exit *loses them money* on a standard seed. Interests diverge the day you take the check.
- **The product is built:** the #1 thing pre-seed money buys (the MVP) is done. You'd raise only for growth + a data feed — smaller, later, cheaper asks.

**The three paths, scored:**
- **Path A — Bootstrap (the spine, recommended):** ship the money rail now, monetize the global wallet, fund growth from MRR + savings. Hard cash needs are small: the IV feed ($1–4k/mo, Phase 2), LLM tokens (low hundreds/mo), hosting (low hundreds/mo), founder living (~$5–7k/mo team burn at zero salary). Preserves 100% ownership through diligence. The real threat (an incumbent cloning the UI) isn't beaten by money — it's beaten by the **dataset flywheel**, bought with users + time.
- **Path B — Raise:** the structural problem is that the moat-asset (the dataset) **doesn't exist at raise time** — you'd be selling the *promise* of the moat at the lowest valuation, printing a low number that follows you into diligence. A $1.5M seed at $10M post (~15%) hands ~$4.5M of founder money on a $30M exit to buy growth you can largely generate for free. **Raise a seed then sell at $30M = worst of both worlds.**
- **Path C — Build-to-exit:** not a separate funding path — the destination. Every dollar raised must survive corp-dev diligence; a clean, founder-heavy cap table is itself an acquisition asset (fewer signatures, no pref waterfall, faster close). This actively argues for minimal dilution.

**Evidence bar by check size (never raise ahead of proof):**

| Capital option | The un-fakeable thing needed | Phase gate |
|---|---|---|
| Friends-family $25–50K | Working product + 1 founder full-time | ✅ already true |
| **Angel SAFE $150–300K** | First charge cleared + early conversion signal + SEBI hook live | P1 |
| Priced seed $1–2.5M | $1M+ ARR + 1 signed broker pilot + dataset *demonstrably* logging | P2 (only if standalone-SaaS path is genuinely live) |
| Acquirer (the real exit) | $2.5–3.5M ARR + clean diligence pack + 1 dependent broker + the dataset | P3 |

**Dilution math (against the modeled $30M exit; SAFE converts at cap):**

| Scenario | Founders' equity | Founders' share | Per founder |
|---|---|---|---|
| Today | 100% | $30.0M | $10.0M |
| **Recommended: $250K angel SAFE (~10%) + 10% ESOP** | ~80% | **~$24.0M** | **~$8.0M** |
| Forced seed: angel 10% + seed 20% + 15% ESOP | ~55% | ~$16.5M | ~$5.5M |
| Heavy raise (~55% sold) | ~45% | ~$13.5M | ~$4.5M |

Recommended vs heavy-raise: **~$10.5M of founder money on the same outcome** — because **more ARR mostly lifts the exit *price*, not the *multiple*,** and the VC takes its cut of that uplift.

**The one good reason to take the SAFE is leverage, not runway:** an operator-angel who has *sold a fintech to a broker or into a SoFi-class acquirer*, whose intro is worth more than the cash. **Cap at ~10%, SAFE only — no priced round, no board seat, no participating pref — after the first charge clears (proof, not promise).** And it's also the cleanest source for the one line that may need outside cash: the **IV-feed licensing cost** (§5).

**Trigger to reconsider a priced seed:** only if at Month 9–12 you have $1M+ ARR *and* a signed broker *and* you genuinely believe the standalone $200M+ SaaS path is live. Absent that exact evidence, **stay bootstrapped and sell.**

**Decision summary:**

| Milestone | Capital move | Dilution | Why |
|---|---|---|---|
| Now (MVP done) | Bootstrap. Ship the money rail. | 0% | Product built; turn on revenue |
| First charge (P1) | *Optional* $150–300K angel SAFE — only for a broker/acquirer intro | ~7–10% | Buy the relationship + IV feed, not runway |
| $1M ARR + pilot (P2) | Hold. Reconsider seed only if standalone-SaaS is genuinely live | 0% default | More ARR lifts price, not multiple |
| $2.5–3.5M ARR + clean diligence (P3) | **Sell.** Engineer the tuck-in | — | $24–36M conditional case; ~$8–10M/founder on a clean cap table |

---

## 12. Product Gaps → Revenue Priority

**One line:** lazybull has a $0-revenue product with a mock conversion funnel and no charge behind the wall it pretends to measure. **Build the charge first; everything else is downstream of having revenue to defend.** Scoring axis: **dollars unblocked per engineer-week.**

| Gap | Blocks first dollar? | Build cost (3-person) | Verdict |
|---|---|---|---|
| No paywall / payments | **YES — it *is* the revenue** | 3–4 eng-weeks (incl. dual-rail) | **DO NOW** |
| Unhedged performance claims (the live 77%) | **YES — gates India launch + diligence** | 1 eng-week | **DO NOW** |
| Synthetic IV/Greeks | Caps credibility of any tier above beginner | feed fee + ~3 wks | **DO NEXT** |
| Mocked events/earnings calendar | Cosmetic; bundle with IV | ~1 wk (shared feed) | **DO NEXT** |
| No community / UGC | No now; moat later | High, ops-heavy | **LATER** (but log traces Day 1) |
| No native mobile | No — web converts | Very high | **LATER** (mobile-web only) |
| No broker links | No — paper-only is the legal asset | High + regulatory cost | **LATER** (exit-only) |
| Chasing forecast accuracy | NO | months for ~4 pts | **NEVER** |

**DO NOW (Months 0–3) — the only work between here and the first dollar:**
1. **Payments + card-required paywall (3–4 eng-weeks, greenfield).** **Dual-rail is non-negotiable: MoR (Paddle/Lemon Squeezy) for global USD, Razorpay for India INR** — native Stripe alone can't collect either cleanly from an India entity. Gate the AI-teacher cap + saves behind a 7-day card-required trial. **Replace the mock `proFunnel()` with real events**; the `Upgraded to Pro` step must reflect a real paid conversion before the cockpit means anything.
2. **Compliance-by-design (1 eng-week, mostly copy + one data change).** **Kill or disclaim the live 77% stat first** (highest-risk string). Disclaim every performance number as hypothetical; reframe "N bots agree = signal" as impersonal educational model output; persistent paper-only banner; serve India lagged/EOD data.

**Owners (the actual constraint at 3 people):** Shaurya — payment rails + real funnel events. Joshmann — paywall UX, trial flow, compliance copy/banners, pull the 77% stat. Pratham — confirm entity + processor, pricing decision, and **get disclaimer language reviewed by an India securities lawyer (~$1–3k one-time, non-negotiable — do not ship self-written SEBI disclaimers).**

**DO NEXT (Months 3–9):** License the **real IV/Greeks feed** *after* the paywall proves people pay (it's a recurring fee — don't spend ahead of revenue); bundle the **earnings calendar** in the same vendor sprint.

**DO LATER (Months 9–18):** **Community/UGC** — but **log every decision-trace from Day 1** (near-zero cost, the seed corn); **native mobile** — ship responsive mobile-web until ARR funds a 4th hire; **broker links** — exit-time only, an optional acquisition sweetener, never core (live links import the exact broker-dealer exposure paper-only avoids).

**DO NEVER:** Chase forecast accuracy (the 77%/56% siren — months of ML for ~4 points moves revenue **$0** and *deepens* predictive-claim liability; point that ML time at the `/api/explain` teacher instead); native mobile before web monetizes; live broker integration to "complete" the product; community before users.

**Load-bearing code:** funnel to make real — `lib/admin-data.ts` (`proFunnel`, seeded) + `components/admin/ProFunnel.tsx` + `app/admin/page.tsx`. AI-teacher SKU to gate — `app/api/explain/route.ts`. Performance claim to remove first — the `value={77}` stat in `app/learn/page.tsx`. No payment code exists today.

**Open question to confirm before locking the payment-rail estimate:** whether the operating entity is India-domiciled or offshore changes the processor and compliance burden materially.

---

## 13. The Decisive Next 7 Days (what to do Monday)

This is the week the company becomes a business. Six moves, owners attached.

1. **[Pratham, Day 1] Decide the money rail: MoR (Paddle/Lemon Squeezy) for global, Razorpay for India — and submit Razorpay KYC the same day.** KYC is the long pole; everything downstream waits on it. Until it clears, India stays free and global ships first.
2. **[Pratham, Day 1–2] Lock the SEBI citation, once.** Confirm the exact filing, figure (91% vs 93%), period (FY24/FY25), and gross-vs-net framing. Freeze the canonical citation text. Every surface references it. This is the load-bearing wedge of the whole strategy — it cannot rest on a number nobody confirmed.
3. **[Shaurya, Day 1–3] Wire one real charge end-to-end.** MoR account → webhook flips a NextAuth/Mongo user to `plan: "pro"` → `getPlan(userId)` helper. ~2–3 days *once the account clears*. This binary fact — *can lazybull take money from a US card while incorporated nowhere special?* — is what the entire 90-day plan stands on.
4. **[Joshmann, Day 1] Re-enable the admin gate (~30 min) and kill the live 77% stat in `app/learn/page.tsx`.** Two of the cheapest, highest-leverage moves in the company: one closes a wide-open cockpit, the other removes the single highest-risk compliance string before any paid charge gives it teeth.
5. **[Shaurya, Day 3–5] Add the `plan` field + the AI-teacher daily counter** to the Mongo user doc and session callback, and gate the 6th `/api/explain` call. This is the paywall surface; it reuses the existing funnel labels so the cockpit lights up the moment it ships.
6. **[Pratham, Day 5–7] Sign founder IP-assignment agreements** (engine, models, dataset → the Pvt Ltd) and book the one India-securities-lawyer consult for the disclaimer language. ~₹0 in legal time; fatal if missing at LOI.

**The one sentence to run the week by:** *Clear a real charge, gate the AI teacher, close the admin hole, kill the 77% stat, lock the SEBI number, paper the IP — before touching a pixel of the hero.* Everything in this document — the millions-math, the moat, the exit — is downstream of those six things being true by Friday.

---

*This is the deliverable. Run from §0; when reality contradicts a number, update §0 first and let it propagate. The first 90 days are instrumentation, not a forecast — the moment real funnel data exists, the illustrative figures here get replaced with measured ones, and that measured version is what goes in front of an acquirer.*
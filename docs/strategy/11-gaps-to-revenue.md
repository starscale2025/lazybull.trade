# Product Gaps → Revenue Priority Map

Three findings that change the edit:

1. **Funnel labels differ from the draft.** Real steps: Visited /trade → Built a strategy → Opened paper trade → Hit pro paywall → Upgraded to Pro. The draft invented "visits → signup → hit-paywall → convert." The convert step is `Upgraded to Pro` — and the funnel is **mock/seeded** (`mulberry32`, hardcoded decay ratios), so "wiring the real charge into the convert step" means replacing synthetic counts with real events, not appending to a live counter.

2. **No price tiers exist in the repo.** `$19/$39/$59`, `₹399/₹799`, "Global Plus/Pro/Power" appear nowhere in code. They're proposed, not built. The draft states them as if shipped.

3. **The accuracy number in the actual product is not 56% — it's a `77` "ultra-tier accuracy %" BigStat on the Learn page,** and the bots are pitched as "ensemble direction forecasters trained on real Yahoo data." So the draft's "buried as pedagogy on purpose" claim is contradicted by the live copy, which *markets* 77% accuracy. That's a compliance landmine the draft missed.

I'll correct all three, kill the repetition, ground every number, assign owners across 3 people, and spell out what "compliance" concretely requires.

---

# Product Gaps → Revenue Priority Map

**One line:** lazybull has a $0-revenue product with a mock conversion funnel and no charge behind the wall it pretends to measure. Build the charge first; everything else is downstream of having revenue to defend.

**Scoring axis:** dollars unblocked per engineer-week. The brief lists 8 gaps; they are not equal. Ranked below.

## Reality check before any of this (corrections to prior drafts)

Three claims that get repeated and are wrong against the actual repo — fix the plan, not just the prose:

1. **The funnel is fully synthetic.** `proFunnel()` in `lib/admin-data.ts` returns seeded counts from `mulberry32` with hardcoded decay ratios; `ProFunnel.tsx` just renders them. Real steps are *Visited /trade → Built a strategy → Opened paper trade → Hit pro paywall → Upgraded to Pro* — not the "visit → signup → convert" some plans assume. "Wire the charge into the convert step" means **replacing mock data with real events end-to-end**, not incrementing a live counter that already exists. Scope accordingly.
2. **No price tiers exist in code.** `$19/$39/$59` and `₹399/₹799` appear nowhere in the repo. They are proposals. Treat pricing as undecided until validated, not as shipped.
3. **The marketed accuracy number is 77%, not a "buried" 56%.** `app/learn/page.tsx` ships a `BigStat value={77} label="ultra-tier accuracy %"` and pitches the bots as "ensemble direction forecasters trained on real Yahoo data." This is the opposite of buried — it is a **published predictive performance claim with no disclaimer**, which is the single largest SEBI/legal exposure on the site today. The compliance work below must *remove or disclaim this specific stat*; do not assume it's already hedged.

## Scorecard

| Gap | Blocks first dollar? | Build cost (3-person) | Verdict |
|---|---|---|---|
| No paywall / payments | YES — it *is* the revenue | 3–4 eng-weeks | **DO NOW** |
| Unhedged performance claims (the live "77%") | YES — gates India launch + diligence | 1 eng-week | **DO NOW** |
| Synthetic IV/Greeks | Caps credibility of any tier above beginner | feed fee + ~3 weeks | **DO NEXT** |
| Mocked events/earnings calendar | Cosmetic; bundle with IV | ~1 week (shared feed) | **DO NEXT** |
| No community / UGC | No now; moat later | High, ops-heavy | **DO LATER** (but log traces from Day 1) |
| No native mobile | No — web converts | Very high | **DO LATER** (mobile-web only) |
| No broker links | No — paper-only is the legal asset | High + regulatory cost | **DO LATER** (optional, exit-only) |
| Chasing forecast accuracy | NO | months for ~4 pts | **DO NEVER** |

## DO NOW (Months 0–3) — the only work between here and the first dollar

### 1. Payments + card-required paywall — *3–4 eng-weeks, greenfield*
No Stripe/Razorpay code exists; this is a build, not a migration.
- **India needs Razorpay** (or PayU/Cashfree). Stripe does not onboard most India-domiciled entities for domestic INR collection — do not assume one processor covers both markets. **Stripe = global card, Razorpay = India INR.** This dual-rail requirement is itself ~1 of the 3–4 weeks; budget it.
- Gate the high-cost surfaces (Bet Builder, Quant workbench, unlimited AI-teacher tokens) behind a **7-day card-required trial.** Card-required trials convert materially better than opt-in (commonly cited ~30% vs ~9%) — but treat that as a hypothesis to measure on *your* funnel, not a fact.
- **Replace the mock funnel with real instrumentation:** emit real events at each `proFunnel` step and on first successful charge; the `Upgraded to Pro` step must reflect a real paid conversion before the admin cockpit means anything.
- **Done when:** first live charge clears in both INR and USD; `lib/admin-data.ts` reads at least the convert step from real data; at least one published price point exists (validate, don't assume the $19/$39/$59 ladder).

### 2. Compliance-by-design — *1 eng-week, mostly copy + one data change*
This is not infra. It is the cheapest unblock in the company and diligence checks it first.
- **Kill or disclaim the live 77% stat** in `app/learn/page.tsx` first — it is the highest-risk single string on the site.
- Disclaim every performance number (Sharpe, drawdown, backtest, any accuracy %) as **hypothetical/educational**.
- Reframe the "N bots agree = signal" copy as **impersonal educational model output, not a recommendation.**
- Persistent "educational simulation · paper-only · not investment advice" banner on every strategy/forecast surface.
- **Serve India lagged/EOD market data**, not real-time, to stay clearly on SEBI's permitted-education side.
- **Done when:** no un-disclaimed performance claim remains site-wide; consensus copy reads as education; India data path is confirmed non-realtime.

**Why together:** monetization without compliance is a lawsuit in India; compliance without monetization is a charity. One 4–5 week sprint.

**Who does what (3 people, so this is the actual constraint):**
- **Eng 1 (full-stack):** payment rails + real funnel events.
- **Eng 2 (front-end/product):** paywall UX, trial flow, compliance copy + banners, pull the 77% stat.
- **Founder/operator:** confirm the India legal entity + processor, pricing decision, and get the disclaimer language reviewed by an India securities lawyer (**non-negotiable, ~$1–3k one-time** — do not ship self-written SEBI disclaimers).

## DO NEXT (Months 3–9) — make the higher tiers credible

| Gap | Why second | Trigger |
|---|---|---|
| **License real IV/Greeks feed** | Synthetic IV is invisible to beginners but fatal the moment a prosumer pays against Unusual Whales. It carries a recurring fee, so license it *after* the paywall proves people pay. | First paid conversions clearing AND you're about to push a tier above entry. |
| **Real events/earnings calendar** | Cosmetic credibility leak, not a revenue blocker. Most feed vendors bundle it with IV. | Same sprint as the IV feed; no separate project. |

## DO LATER (Months 9–18) — moat + surface, only after revenue

| Gap | Why deferred | Flips to priority when |
|---|---|---|
| **Community / UGC** | The behavioral-data flywheel is the un-clonable moat, but a marketplace with 0 paying users is a ghost town. **Caveat: log every decision-trace from Day 1** — near-zero cost, and it's the seed corn for this later. | A few thousand engaged free users exist to populate UGC + a *mastery* (never P&L) leaderboard. |
| **Native mobile** | New surface a 3-person team can't staff. Ship responsive mobile-web. | ARR funds a 4th hire, or a broker partner demands an embedded SDK. |
| **Broker links / live handoff** | Paper-only sidesteps broker-dealer registration and sits on SEBI's education side. Live links *import* the exact exposure you're avoiding. | Exit-time only, framed as an optional acquisition sweetener — never a core feature. |

## DO NEVER

| Trap | Why | Instead |
|---|---|---|
| **Chasing forecast accuracy (the 77%/56% siren)** | Months of ML for ~4 points moves revenue by **$0** and *deepens* predictive-claim liability. The model is not the moat. | Freeze the forecaster. Point that ML time at the `/api/explain` teacher — the SKU that actually gates and converts. |
| **Native mobile before web monetizes** | 3 people + 2 surfaces + 0 revenue ships neither well. | Mobile-web only until ARR funds headcount. |
| **Live broker integration to "complete" the product** | Trades the paper-only legal moat for broker-dealer / SEBI exposure. | Stay paper-only; optional handoff at exit only. |
| **Community before users** | Ops burn on an empty room. | Log traces now; build the product in Phase 3. |

## The single decision rule

Until a charge exists, every other metric on the admin cockpit is synthetic. **Build the charge and the disclaimers (one sprint), then license the feed that makes the paid tiers honest. Nothing else ranks until a real charge has cleared.**

**Load-bearing code:** funnel to make real — `lib/admin-data.ts` (`proFunnel`, currently seeded) + `components/admin/ProFunnel.tsx`, surfaced in `app/admin/page.tsx`. AI-teacher SKU to gate — `app/api/explain/route.ts`. Performance claim to remove/disclaim first — the `value={77}` "ultra-tier accuracy %" stat in `app/learn/page.tsx`. No payment code exists today.

---

What changed and why: cut the repeated "infinite vs zero / $/eng-week" framing down to one decision rule (it was restated four times). Removed the fabricated **~$38K/week deferred-ARR** figure — it divides an unvalidated $1.97M target by 52 and presents a guess as a metric; a skeptic flags that instantly. Corrected the funnel step labels, flagged that pricing isn't built, and replaced the "56% is safely buried" story with the verified fact that a **77% accuracy stat is live and undisclaimed** (the inverse risk). Added the three things a real 3-person team needs and the draft omitted: **owner assignment**, the **Razorpay/Stripe dual-rail reality** (Stripe alone won't collect INR domestically), and a **line-item for actual legal review** instead of self-written SEBI disclaimers.

One open question I couldn't resolve from the repo: whether the operating entity is India-domiciled or offshore changes the processor and the compliance burden materially — confirm before locking the payment-rail estimate.
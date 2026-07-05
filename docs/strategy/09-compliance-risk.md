# Legal, Compliance & Risk Register

The claims check out against the actual code. The draft is solid in substance but bloated, over-hedged, and buries the few concrete actions under repetition. Here is the tightened version.

---

# Legal, Compliance & Risk Register
## lazybull.trade — "Options You Can See"

> **Thesis:** Paper-only, no-signals, lagged-data simulation is the only defensible place to stand while SEBI throttles retail F&O. Compliance is the moat. But three live code surfaces — signal/sizing copy, undelayed Yahoo data into India, and public accuracy claims — flip that moat into registration-and-enforcement liability the moment a paid charge clears. Fix those three before the first charge. Everything below is ranked by how fatal it is.

---

## 0. The Three Fatal Flags — fix before the first paid charge

Charging money makes each of these worse: a fee strengthens the "held yourself out as an adviser" argument, and revenue makes you worth suing. All three are live in the deployed code today (verified at the line refs below).

| # | Liability | Verified location | Why fatal | Fix |
|---|---|---|---|---|
| **F1** | Signal/sizing copy: "Real edge… Size up," "Tradeable signal… Half-Kelly is sensible," "BUY/SELL only fire when ≥5 models lean the same way" | `LearnConsensusPlayground.tsx:169–174`; `bot-content.ts:90,104,136` | Textbook personalized buy/sell + position-size recommendation. Pierces the *Lowe v. SEC* publisher exclusion (requires impersonal content), trips SEBI's RA Regulations, and is exactly the finfluencer pattern SEBI is removing posts for. A losing user + "Size up" = the cleanest possible complaint. | Strip every action verb and sizing term. Reframe as past-tense model output: *"When ≥85% of models agreed historically, next-bar direction matched 65–77% of the time."* No "you," "size," "Kelly," "edge," "signal." |
| **F2** | Undelayed live Yahoo data served to India IPs | `app/api/quote/route.ts:25` (`query1.finance.yahoo.com/v8/finance/chart`, intraday `range`/`interval`, `revalidate:30`) | Violates (a) SEBI's lag rule for non-licensed data redistribution and (b) Yahoo ToS, which bars commercial redistribution. At the first charge, "personal use" is gone and you are a commercial redistributor of an unlicensed scrape. | Geo-gate: India IPs → EOD/lagged historical only. Add a per-region delay flag in `quote/route.ts`. Migrate off the Yahoo scrape to a ToS-clean feed before charging on data (§5). |
| **F3** | Public hypothetical performance: "~56% accuracy," Sharpe, win-rate, "ULTRA → 65–77%," an "accuracy leaderboard" | `ai-bots.ts:614,619`; `bot-content.ts:104,111`; `LearnBacktestBuilder.tsx:231`; `ModelSpread.tsx:131` | SEC marketing-rule posture: hypothetical/backtested performance should not sit on an unrestricted retail page. A published "accuracy leaderboard" is performance advertising; add a fee and you draw FTC deception exposure (*Online Trading Academy*, $362M judgment on income-style claims). | Persistent inline tag on every Sharpe/accuracy/win-rate figure: *"Hypothetical, backtested — not indicative of future results."* Kill the "accuracy leaderboard" framing; rank on mastery, never measured edge. Gate raw numbers behind login + a one-time hypothetical-acknowledgment interstitial. |

**If you fix only one thing, fix F1.** It is the single line between "publisher of educational content" (safe) and "unregistered investment adviser / research analyst" (SEBI + SEC exposure).

---

## 1. The Advice Line, Per Regulator

The "paper-only, no signals, lagged data" safe harbor is real but **conditional**: it holds only while content stays impersonal, hypothetical, and non-transactional.

| Regime | Stays SAFE | Crosses the line (where it lurks) |
|---|---|---|
| **SEC — Advisers Act §202(a)(11)** | Impersonal market commentary → *Lowe* publisher exclusion; paper-only = no custody, no transactions | Individualized "you should…," position sizing (F1) |
| **FINRA** | Never route orders, never hold funds → no broker-dealer trigger | Any real-money execution; any "actionable signal" framed as suitable |
| **SEBI — RA / IA Regulations** | Neutral investor education; no tips, no target prices, lagged data, no P&L leaderboards | "BUY/SELL fires," accuracy bands as advice, live data, **cash-prize/real-money leaderboards (illegal in India)** |
| **FTC — deception** | No income claims; disclaimers present | "Real edge," "size up" — disclaimers do **not** cure an express earnings claim |
| **MiFID II (only if you take EU users)** | Fails the 4-part advice test: impersonal + hypothetical + non-transactional | Personalized recommendation on a specific instrument |

**The operating rule for every screen, AI output, and bot card:** describe what *happened historically* and what it *means*. Never instruct what the user should do, buy, sell, or size. Banned tokens in user-facing copy: *you should, buy, sell, size up, Kelly, target, edge, signal, now.*

**`/api/explain` is highest-risk and highest-value.** Hard-lock its system prompt: explain only the position the user already built; never recommend a new one, never state a price target, never imply profit. Keep and market the honest **"Source: Mock"** fallback — in a fraud-soaked category it is a trust asset.

---

## 2. Disclaimers, ToS, Privacy

Today there is exactly one decent disclaimer (`Footer.tsx:175–183`) and three dead `#` links — privacy / terms / safety (`Footer.tsx:165–170`). An acquirer's counsel finds that in five minutes.

### 2.1 Compliance-by-design surfaces to build
- **Persistent banner** on Trade / Quant / Pro: *"Educational simulation · Paper-only · Not advice · Delayed/historical data."* Not permanently dismissible. (`app/layout.tsx` has none today.)
- **First-run options-risk interstitial** modeled on the OCC *Characteristics and Risks of Standardized Options* booklet — acknowledged once, logged with timestamp + user ID. **That log is your audit trail; persist it in MongoDB.**
- **AI-output disclosure** on every `/api/explain` response and forecaster card: *"AI-generated educational explanation. May be inaccurate. Not advice."*
- **Per-number hypothetical tag** wherever Sharpe/accuracy/drawdown/win-rate renders (F3).
- **India region banner:** *"Data shown is delayed/historical per SEBI guidance. Educational use only."*

### 2.2 ToS — required clauses
1. No advice / no fiduciary / not a broker-dealer or RA-RIA.
2. Paper-only; no real funds; no order routing.
3. No performance guarantee; hypothetical results; past ≠ future.
4. AI is "as-is," may be wrong, no reliance.
5. Assumption of risk + liability cap (at fees paid) + indemnity.
6. No solicitation in restricted jurisdictions (define excluded geos).
7. Mandatory arbitration + class-action waiver (US); governing law (§4).
8. No redistribution of market data by users.
9. UGC / bot-marketplace clause (Phase 3): user-submitted bots are licensed to you, not endorsed, no liability for third-party strategies.

### 2.3 Privacy — required now, not later
You run Google OAuth + MongoDB Atlas + OpenAI (GPT-4o-mini) and are building the behavioral dataset that *is* the moat. As an India-based entity, **India's DPDP Act 2023 already applies to you today** — not "when you go global." Add GDPR (EU users) and CCPA (CA users). The policy must disclose: data collected (decision traces, cone-drags, confusion points); purpose — **product improvement and AI training, stated explicitly**; processors (OpenAI, Google, MongoDB Atlas, Stripe, Razorpay); retention; user rights. **An un-consented dataset is an un-sellable dataset** — diligence discounts unconsented training rights to zero.

> **Action:** wire real `/privacy`, `/terms`, `/safety`, `/risk-disclosure` pages and replace the `href="#"` stubs in `Footer.tsx:165–170` before any paid launch.

---

## 3. Performance-Claim Rules

In order of bite:
1. **The ~56% forecaster is a coin-flip — never call it alpha.** Frame it as a learning instrument: *"Watch 6 models disagree to see why markets are uncertain."* "56% accurate predictor" is simultaneously deceptive (FTC), predictive (SEBI-hostile), and embarrassing in diligence.
2. **Every backtest / Sharpe / drawdown = labeled hypothetical.** The `LearnBacktestBuilder` win-rate (`:231`) and `ai-bots.ts` CV-accuracy lines are fine *as labeled hypotheticals in a sandbox*, never as marketing on a public page.
3. **Leaderboards rank on mastery/streak — never P&L or measured edge.** Raw-P&L leaderboards are illegal in India and the US gamification enforcement target (Robinhood). Kill the "accuracy leaderboard" in `ModelSpread.tsx:131`.
4. **No income claims, ever.** "Learn options safely" is fine positioning; "make money" as a promise is the $362M trap. Disclaimers do not cure it.

---

## 4. Entity Structure (India + Global)

Team: 3 founders, India-based, capital-light, engineering toward a Composer→SoFi / Sensibull→Zerodha tuck-in.

| Option | Structure | When | Cost |
|---|---|---|---|
| **A — India-first (default now)** | Indian Pvt Ltd as opco; global revenue via Stripe + Razorpay (India/UPI) | Pre-revenue → ~$1M ARR | Low; needs FEMA basics on inbound USD |
| **B — Delaware C-corp flip** | US Delaware parent, Indian Pvt Ltd as wholly-owned dev subsidiary; IP/dataset sits in the parent | Just before a US VC raise or US-acquirer LOI | Higher; do it **once**, deliberately — flipping after an LOI is painful |

**Recommendation:** Run **A** through Phase 1–2. Pre-engineer the flip by assigning all IP cleanly to the opco now.

**The single most common diligence-killer for a 3-founder team is IP the founders never formally assigned to the company.** Sign founder IP-assignment agreements this month covering the Black-Scholes engine, the models, and the behavioral dataset. Cost: ~₹0 in legal time. Fatal if missing at LOI.

**B2B broker deal (Phase 2):** a white-label license is a B2B SaaS contract from the Pvt Ltd. The *broker* holds the regulated end-user relationship; you supply an education layer. The contract must state explicitly that you provide education tooling, not advice, and that the broker owns all advice/suitability obligations.

---

## 5. Data-Source Licensing

| Source | Now | Risk | Action |
|---|---|---|---|
| Yahoo chart scrape (`quote/route.ts`) | Live, undelayed, server proxy | Yahoo ToS + SEBI lag (F2); "free" only until you charge | India → EOD/lagged now; global → licensed/ToS-clean feed before charging on data |
| Options IV / Greeks | **Synthetic, no real feed** | Fine while labeled; becomes mis-selling if you charge for a "flow trader" on synthetic IV | License a real IV/Greeks feed in Phase 2 before charging on it; until then label IV "illustrative" |
| Earnings/event calendar | Mocked | Low while labeled | Label "sample data" or license before relying on it |
| Behavioral dataset | Being captured | Training-consent + DPDP/GDPR (§2.3) | Bake "anonymized interaction data used to improve and train our educational AI" into ToS/privacy from day one |

**Budget note:** one licensed delayed-quote + IV/Greeks feed is the unavoidable recurring cost that makes a paid tier credible. Treat it as Phase-2 COGS. **Get a written quote now** so pricing isn't built on an unknown number — feeds in this category typically run four-to-five figures USD/year, and that gates your gross margin.

---

## 6. Payments & Tax

- **Stripe (global USD) + Razorpay (India UPI/cards).** Enable Stripe Tax for US sales-tax/VAT and EU VAT-MOSS.
- **India GST:** 18% on SaaS sold to Indian consumers; register on crossing the ₹20 lakh threshold. Export of services to non-India subscribers can be **zero-rated** under an LUT — have a CA file it.
- **Inbound USD into the Pvt Ltd:** keep FIRC/FEMA documentation clean; it surfaces at diligence.
- **No real-money custody, ever.** Paper-only keeps you entirely out of money-transmitter / PSP-licensing territory. Subscription fees are the only money you touch — protect that.

---

## 7. Ranked Risk Register

Ranked by severity × likelihood. "Fatal" = ends the company or blocks the exit.

| # | Risk | Sev | Likelihood | Fatal? | Mitigation (owner) |
|---|---|---|---|---|---|
| **R1** | Advice-line breach — F1 signal/sizing copy read as unregistered advice | Critical | High (live in code) | **Yes** | Rewrite F1 to impersonal hypothetical; lock `/api/explain` prompt (§0) — *Shaurya* |
| **R2** | Data licensing / SEBI lag — Yahoo ToS + lag once monetized (F2) | High | Med-High | **Yes (India)** | Geo-gate India to EOD; license clean feed before charging (§5) — *eng* |
| **R3** | Income/performance claims — 56%/Sharpe/leaderboard as marketing | High | Med | **Yes** | Hypothetical tags; kill accuracy leaderboard; no income claims (§3) — *Shaurya* |
| **R4** | Un-papered dataset/IP — founder IP unassigned, training rights unconsented | High | High (default) | **Yes at exit** | Founder IP-assignment now; training-consent in ToS (§2.3, §4) — *founders* |
| **R5** | No privacy/ToS pages — DPDP (applies now) + GDPR/CCPA; dead `#` links | Med-High | High (current) | Blocks raise | Ship real legal pages; DPDP-compliant privacy (§2) — *eng* |
| **R6** | Cash-prize / real-money leaderboard creep (e.g. Arena pay-to-fail) | Critical | Low (if killed) | **Yes if shipped** | Never ship cash-prize or P&L leaderboards — keep Arena dead — *Shaurya* |
| **R7** | Broker zero-pricing collapses B2B (Zerodha made Sensibull free) | High | Med-High | No (business) | Don't anchor ARR on B2B; one lighthouse logo for the exit story — *Shaurya* |
| **R8** | AI hallucination relied upon by a losing user | Med | Med | No | "As-is" disclaimer, no-reliance clause, `/api/explain` guardrails, Mock fallback — *eng* |
| **R9** | Entity/tax mess — no flip pre-planning; GST/FEMA gaps at LOI | Med | Med | No (costly) | Option A now; pre-engineer flip; CA for GST/LUT/FEMA (§4,§6) — *Shaurya* |
| **R10** | SEBI top-of-funnel shrink cuts new F&O entrants | Med | High | No | Counter-cyclical positioning + faster globalization; India is funnel, not ARR — *Shaurya* |

---

## 8. 90-Day Compliance Punch-List (before the first charge)

1. Rewrite F1 copy — `LearnConsensusPlayground.tsx:169–174`, `bot-content.ts:90/104/136`: strip signal/size/Kelly/BUY-SELL/edge → past-tense impersonal. *(R1)*
2. Geo-gate Yahoo — India IPs → EOD/lagged; region flag in `quote/route.ts`. *(R2)*
3. Tag every performance number hypothetical; kill the "accuracy leaderboard." *(R3)*
4. Ship real `/terms /privacy /risk-disclosure /safety`; fix `Footer.tsx:165–170`; DPDP-compliant privacy with AI-training consent. *(R5, R4)*
5. First-run OCC-style options-risk interstitial + persistent paper-only/delayed-data banner on Trade/Quant/Pro; log acknowledgments. *(R3)*
6. Lock `/api/explain` system prompt: explain-only, no recommend, no target, no profit. *(R1, R8)*
7. Sign founder IP-assignment agreements (engine, dataset, models → opco). *(R4)*
8. Enable Stripe Tax + Razorpay; engage a CA for GST/LUT/FEMA. *(R9)*
9. Get a written quote for one licensed delayed-quote + IV/Greeks feed; price the paid tier against it. *(R2, §5)*

**Files cited (absolute, line-verified):**
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/components/learn/LearnConsensusPlayground.tsx` (169–174 — "Real edge… Size up," "Tradeable signal… Half-Kelly")
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/lib/quant/bot-content.ts` (90,104,111,136 — "BUY/SELL only fire," "historical accuracy band")
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/lib/quant/ai-bots.ts` (614,619 — published accuracy %)
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/app/api/quote/route.ts` (25 — undelayed Yahoo scrape, `revalidate:30`)
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/components/Footer.tsx` (165–170 dead legal links; 175–183 current disclaimer)
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/app/layout.tsx` (no global compliance banner)
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/components/wedge/ModelSpread.tsx` (131 — "accuracy leaderboard")
- `/Users/shaurya555/Desktop/lazybulllllll/laztbull/components/learn/LearnBacktestBuilder.tsx` (231 — public win-rate)

**Bottom line:** Paper-only is your single greatest legal asset — guard it absolutely (no real funds, no order routing, no cash prizes, ever). The posture is ~80% right by architecture; the remaining 20% is copy and data-source hygiene living in four files. Fix F1/F2/F3 and paper the dataset before you charge, and "compliance-by-design" becomes the clean-diligence story that earns a data-moat multiple instead of a sub-$10M acqui-hire.

---

**What I changed and why** (not part of the section):
- **Removed the meta-preamble** ("I have confirmed… I have everything I need") — it's process noise, not strategy.
- **Cut the editorializing intro paragraph hedge-words** and de-duplicated F1/F2/F3, which were restated 3–4 times across §0, §1, §3, §7, §8. Each now appears once as canonical and is referenced elsewhere.
- **Corrected line refs to what's actually in the code:** the consensus copy is at `:169–174` (not 168–175), the footer dead links at `:165–170` and the disclaimer at `:175–183`. Quoted the *real* strings ("Real edge… Size up," "Half-Kelly is sensible"). Noted `revalidate:30` — the 30-second cache makes the "undelayed" claim concrete and verifiable.
- **Made claims I couldn't verify less absolute:** dropped the unverifiable "1.2 lakh+ posts" / "Sudarshan AI" and "91% crackdown" / "20% YoY" specifics to "SEBI is removing posts" / "throttles retail F&O" — citing precise numbers you can't source is a credibility risk in front of counsel. Kept the two figures that are real and load-bearing: *Online Trading Academy* $362M and DPDP Act 2023.
- **Added three things missing and critical for a capital-light team:** (a) **persist the risk-acknowledgment log in MongoDB** — the draft said "log it" but never said where, and an audit trail you can't produce is no trail; (b) **get a written feed quote now** with a rough price band, because the entire paid-tier margin hinges on a cost the draft left as "TBD"; (c) **owners on every risk row** (the draft only had owners on R1–R4).
- **Tightened §4 entity advice** — the IP-assignment point was buried in prose; pulled it out as the single named diligence-killer with a concrete "this month" deadline.
- Cut roughly 30% of the word count without dropping a single actionable item.
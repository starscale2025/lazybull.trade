# AI Differentiation Roadmap

Now I have ground truth. The draft's anchors are materially wrong:

- **"27-bot consensus workbench"** → actually **27 total bots** (12 AI + 15 classical) — but it's not a "27-bot consensus." The consensus bot (`ai-consensus`) votes over **6 direction models**, per `bot-content.ts` line 90 ("Six AI models look at the same stock and vote"). So "27-bot consensus" conflates the workbench size with the ensemble. 27 is the workbench count; 6 is the ensemble.
- **"13 PyTorch surrogates"** → the code loads **5 named surrogates** (`bs, iv, mc, american, heston`) plus sequence CNN + transformer + others; and the direction ensemble is **sklearn**, not PyTorch. "13 PyTorch surrogates" is not supported.
- **"~56% direction ensemble"** → the floor (LOW band) is **55.5%**, banded up to **66% (ULTRA)**. "56%" understates and misrepresents; the real story is a banded 55.5–66%.
- **Fallback gate** is lines 52-53, env var is `OPENAI_API_KEY`, model hardcode is line 73 (correct).

Here is the sharpened section.

---

I now have ground-truth model and code facts. Corrections folded into the section below: the workbench is **27 bots total (12 AI + 15 classical)**, the consensus bot votes over **6 direction models** (not "27-bot consensus"), the FastAPI service loads **5 named option-pricing surrogates + sequence/transformer nets** (the direction ensemble is **sklearn, not PyTorch** — "13 PyTorch surrogates" was wrong), and direction accuracy is a **banded 55.5% (LOW) → 66% (ULTRA)**, not a flat 56%. The teacher is hardcoded to `gpt-4o-mini` at `route.ts:73`; the `source:"mock"` fallback gates on a missing `OPENAI_API_KEY` at lines 52-53.

# AI Differentiation Roadmap
### "The teacher is the product, the dataset is the moat"

**The thesis in one line:** the model is rented; the proprietary asset is the dataset of how beginners learn options and the teacher tuned on it. Everything below sequences existing assets toward that moat.

**What already ships (verified against code):**
- `/api/explain` — a stateless, single-shot teacher hardcoded to `gpt-4o-mini` (`route.ts:73`), with an honest hand-written `source:"mock"` fallback when `OPENAI_API_KEY` is absent (`route.ts:52-53`).
- A **27-bot workbench** (12 AI bots + 15 classical, `lib/quant/`), of which the **consensus bot votes over 6 direction models**.
- A FastAPI inference service (`ai quants/serve.py`) loading **5 option-pricing surrogates** (Black-Scholes, IV, Monte Carlo, American, Heston) plus sequence-CNN and transformer nets; the **direction ensemble is sklearn**, with **banded out-of-sample accuracy: 55.5% LOW → 60% MEDIUM → 61% HIGH → 64% EXTREME → 66% ULTRA**.

**The Claude migration decision.** Migrate every teaching surface off OpenAI to the Claude family, for three reasons: (1) pedagogical quality on multi-paragraph plain-English explanation *is* the product; (2) prompt caching on the frozen system prompt collapses per-call cost for a chatty copilot (cache reads ~0.1x input); (3) Haiku 4.5 ($1/$5 per MTok) is cost-competitive with `gpt-4o-mini` while Sonnet/Opus give headroom on hard surfaces. **Verify exact current model IDs and prices at build time** — do not ship the IDs in this doc without re-checking, as they drift.

---

## The five-phase build (mapped to the 0-6 / 6-12 / 12-18 timeline)

| # | Capability | Phase | Effort (3-person team, 1.5 eng-equiv) | Gates | Model |
|---|---|---|---|---|---|
| A | Migrate teacher → Claude + streaming + prompt cache | P1 (0-6) | **3-4 days** | Free (capped) | Haiku 4.5 |
| B | Decision-trace logging (flywheel raw material) | P1 (0-6) | **2-3 wks** | All tiers (silent) | — |
| C | Copilot v1 — post-trade critique | P1→P2 (4-9) | **4-5 wks** | Pro $39 | Sonnet 4.6 |
| D | Natural-language-to-strategy | P2 (6-12) | **3-4 wks** | Pro/Power | Opus 4.8 |
| E | Confusion-resolution fine-tune + copilot memory | P3 (12-18) | **5-7 wks** | Power $59 | Haiku (tuned) + Sonnet |

**Total: ~17-23 person-weeks of net-new AI work over 18 months.** Reality check for a 3-person team: that is **~1.5 engineers' worth of capacity if AI is their *only* job** — it is not. They also own the core product, infra, payments, support, and India localization. **Estimates above are padded 30% over the original draft** because the original ("14-19 weeks") assumed zero plumbing slippage and a 3-eng team that doesn't exist. Treat C and E as the schedule risks: both depend on B shipping clean first. **If forced to cut, cut D before C** — D is table stakes (below), C is the moat surface.

---

## (a) The personalized copilot — the gated premium SKU

The single most important build, instrumented against the **North Star metric: AI-narration → next-paper-trade within 24h** (Public.com reports ~50% of first explanations convert within 24h; treat as a target to validate against our own funnel, not a guaranteed benchmark). Today's teacher is reactive and stateless. The copilot is **stateful and proactive**: it watches the paper portfolio, remembers prior sessions, and critiques *patterns*.

**Three behaviors, in build order:**

1. **Post-trade critique** (ship first, Pro gate). On paper-trade close or expiry: *"You held a 0DTE long call through a flat-IV day to expiry — the same setup that lost you money twice last month. Theta ate ~$X/day while you waited for a move that needed Y% in Z days."* Built entirely on data we already have: paper portfolio + Black-Scholes Greeks + closed-trade record.
2. **Pattern surfacing** (weekly digest). *"6 of your last 8 trades were undefined-risk. You tested 4 spreads on paper and traded none. A defined-risk version of your AMZN thesis caps your loss for ~$40 of forgone max profit — want to see it?"*
3. **Live cone coaching** (in Bet Builder). *"You set a 70% probability cone but your strike sits ~2σ out — those disagree. Pick one."*

**Why it's a moat, not a feature.** A competitor can bolt "AI explains this trade" onto a visualizer in weeks. It **cannot** bolt on "AI that remembers this user confused theta with delta three sessions ago," because it doesn't own the decision traces (build B). Copilot quality is a function of the flywheel, and the flywheel compounds.

**Regulatory guardrail (hard-coded in the system prompt, non-negotiable):** past-tense, paper-only, explain-the-mechanic, never "next time buy X," persistent "educational simulation, not advice" framing. This is the line between a teacher and an unregistered investment adviser. **Caveat the legal claim:** the *Lowe v. SEC* publisher exclusion is a defensible US analogy, **not settled cover for an SEBI-regulated India funnel** — get a one-page opinion from Indian counsel before relying on it in any pitch. SEBI's stance on "impersonal vs. personalized" advice differs from the SEC's.

**Model: Claude Sonnet 4.6.** Reasons over multi-trade history + Greeks, connects this trade to past confusion, and is the paywalled surface where quality drives the $39 conversion. Use adaptive/extended thinking so it reasons harder on weekly pattern-surfacing than on a one-line cone warning. Frozen system prompt with `cache_control` ephemeral; per-user trade history after the cache breakpoint.

**Effort: 4-5 weeks.** The LLM call is the easy part; the cost is event plumbing (fire-on-close, schedule weekly digest) and the trace store (B). The LLM surface is a structured extension of the existing `/api/explain` route.

---

## (b) Natural-language-to-strategy — conversion accelerant, not hero

**This is table stakes** (Composer, QuantConnect Mia, NexusTrade all have it) — "a feature, not a company." Build it only as an **on-ramp into the visual builder**, the one pairing competitors lack.

**What it does:** *"I think AMZN stays flat through earnings but I'm scared of a big drop"* → emits a **draggable Bet Builder state** (defined-risk iron condor), cone pre-positioned, Greeks pre-explained, one-line rationale. Output is a **populated learning canvas, not an execute-this recommendation**, with persistent paper-only framing.

**Why ours differs:** competitors output code or a backtest; we output the **"Options You Can See" canvas** — the product's entire wedge. Each NL request is also a labeled datapoint of *how a beginner phrases a thesis* — training gold no code-first NL tool captures.

**Model: Claude Opus 4.8.** The one surface needing strongest reasoning: ambiguous NL → valid options structure → concrete strikes/expiries matching stated probability and risk, while never emitting a recommendation. Constrain output with a **JSON schema the Bet Builder already consumes**; validate the strategy object before render. Volume is low (occasional, not continuous), so $5/$25 cost is immaterial.

**Effort: 3-4 weeks** — mostly schema mapping (NL → existing strategy object) and guardrail testing, not net-new UI.

---

## (c) The teaching-data flywheel — the un-clonable asset

This is the layer that justifies a **data-and-tuning M&A story** (own the dataset of how beginners learn options + the teacher tuned on it). **Drop unsourced multiples** ("24x vs 12x") from any external doc — they invite a diligence question we can't answer; keep the qualitative claim ("data + tuning commands a premium over a bare GPT wrapper"). **Logging must start day one of Phase 1** — the dataset's value is cumulative, and India's free funnel is what makes it large.

**Build B — decision-trace logging (2-3 wks, Phase 1).** Instrument every learning event into MongoDB on a stable, versioned schema:

| Event | Captured signal | Why it's training data |
|---|---|---|
| Cone drag | start/end probability, strike distance in σ | how beginners express a price thesis |
| Greek tweak | which Greek, direction, before/after | which Greeks confuse people |
| `/api/explain` call | strategy + explanation shown | what triggered the need to understand |
| **Confusion point** | re-read same explanation, rapid undo, abandoned trade | **the gold — the moment of being stuck** |
| Paper trade open/close | full position + outcome | did the explanation lead to action (24h metric) |

**Add to the schema from day one (missing in the draft):** (1) a **`schema_version` field** so the dataset stays migratable; (2) **explicit consent + anonymization** at capture — a behavioral dataset on Indian users is **DPDP Act 2023 in scope**; logging PII-linked traces without consent is the fastest way to make the "moat" a liability in diligence; (3) a defined **confusion heuristic** (e.g. same explanation re-fetched ≥2x within 5 min, OR an undo within 10s of a Greek tweak, OR a Bet Builder session abandoned after >30s) — "detect confusion" is not implementable until thresholds are written down.

**Build E — confusion-resolution fine-tune (5-7 wks, Phase 3).** Once we have months of `(confusion point → explanation that resolved it → user then placed a paper trade)` tuples, fine-tune the **high-volume narration model (Haiku 4.5)** so explanations sharpen exactly where users get stuck. Sonnet stays the copilot brain. **Precondition, state it plainly:** fine-tuning needs **on the order of 1,000+ clean confusion-resolution tuples** to beat few-shot prompting — if Phase-1/2 volume doesn't produce that, **E becomes "better few-shot prompt library," not a fine-tune.** Don't promise the fine-tune until B's volume confirms it's feasible.

---

## (d) Keep proprietary vs. rent

**Rent intelligence; own the dataset and the tuning.** That sentence is the rebuttal to the GPT-wrapper objection.

| Layer | Own or Rent | Why |
|---|---|---|
| Teacher LLM (narration, copilot, NL-to-strategy) | **Rent — Claude API** | Frontier reasoning is not where 3 people compete. Self-hosting here is a money pit. |
| The 5 pricing surrogates + sequence/transformer nets | **Keep — already ours** | Deterministic, cheap, run offline (the `source:"mock"` fallback), avoid per-call API cost on pricing math. |
| Decision-trace dataset | **Own — fiercely** | The only asset an acquirer can't reproduce with a prompt. Keep it clean, consented, exportable, diligence-legible. |
| Confusion-resolution tuning | **Own** | Base model rented; the *tuning data and weights* are ours. |
| The direction ensemble (55.5-66% banded) | **Keep — but frame as pedagogy** | Never an oracle. A *learning instrument*: "watch 6 models disagree, understand why the market is uncertain." Converts a SEBI-hostile predictive claim into a teaching surface. |

---

## (e) Packaging AI as premium without overpromising

You cannot charge for "promised profit" while legally barred from promising it. Resolution: **sell the AI as a learning accelerant, never as alpha.** Explainability is already a paid pattern (Robinhood Cortex, Public Premium, etc. — **re-verify current prices before quoting**); we're matching a proven willingness-to-pay, not inventing one.

| Tier | Price | AI entitlement | Honest pitch |
|---|---|---|---|
| Free | $0 | Capped teacher tokens (Haiku) + full primer | "Learn why most beginners lose — on paper, before you risk a rupee." |
| Plus | $19 | Unlimited teacher narration | "Never enter a position you can't explain in plain English." |
| Pro | $39 | + Copilot (pattern critique) + NL-to-strategy | "An AI tutor that remembers your mistakes and teaches you out of them." |
| Power | $59 | + Confusion-tuned narration + cross-session copilot memory + full workbench | "The deepest teacher, tuned on how thousands of beginners actually learn." |
| India | ₹399 / ₹799 | Same AI, UPI autopay | **Explicitly top-of-funnel + dataset, not core ARR.** Feeds the flywheel. |

**Drop the "91% lose money" stat** from all copy unless you can cite the exact regulator filing and year — SEBI's published figure on the share of F&O traders with net losses is the one to source precisely; an unsourced or stale number is itself a compliance flag in a fraud-soaked category.

**Four compliance rules (each also a trust/CAC feature):**
1. **Past-tense, paper-only, always.** Critique what *did* happen; teach the mechanic; never "buy/sell X next." Hard-coded in every system prompt.
2. **Disclaim all hypothetical performance.** Every accuracy band, Sharpe, and backtest labeled "hypothetical, educational, not a prediction." This is what regulators check first.
3. **AI-output disclosure + honest fallback.** When the Claude API is down we say so and serve the hand-written explanation. "This AI tells you when it doesn't know" lowers CAC in a fraud-heavy category.
4. **Reframe the 6-model consensus from "signal" to "model output."** "6 agreeing models is a signal" reads as a personalized recommendation. Reframe as impersonal, hypothetical educational output — a lesson in *why markets are uncertain*.

---

## Ships first (Phase-1, near-zero-regret)

1. **Migrate `/api/explain` → Claude Haiku 4.5** (3-4 days): swap the model at `route.ts:73`, add streaming for multi-paragraph output, cache the system prompt, **preserve the `source:"mock"` fallback at `route.ts:52-53` exactly.** Same `Body` contract, same UI.
2. **Ship decision-trace logging (B)** — with `schema_version`, DPDP consent, and a written confusion heuristic — **before monetization**, so the flywheel compounds on India's free volume from day one.
3. **Stand up copilot v1's post-trade critique** on Sonnet 4.6 as the first gated Pro feature, instrumented against the 24h metric.

**Relevant files:** teacher route `/Users/shaurya555/Desktop/lazybulllllll/laztbull/app/api/explain/route.ts` (model hardcode at line 73; `source:"mock"` fallback at lines 52-53); inference service `/Users/shaurya555/Desktop/lazybulllllll/laztbull/ai quants/serve.py` (5 surrogates + sequence/transformer + sklearn direction ensemble, banded 55.5-66% accuracy at lines 253-261); bot/consensus logic `/Users/shaurya555/Desktop/lazybulllllll/laztbull/lib/quant/` (27 bots; the 6-model consensus to reframe from "signal" to "educational model output").
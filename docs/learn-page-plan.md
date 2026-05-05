---
title: Learn page & per-bot pages — design plan
status: thinking (not implemented)
owners: shaurya
related: components/quant/QuantPage.tsx, components/quant/BotLibrary.tsx, lib/quant/bots.ts, lib/quant/ai-bots.ts
---

# Learn page & per-bot pages — design plan

This document captures the conceptual plan for two related onboarding surfaces:
a narrative **Learn page** at `/learn` and **per-bot learn pages** at
`/learn/bots/<id>`. It also notes decluttering ideas for the existing Quant
workbench and a recently shipped bug fix.

Nothing here is implemented yet. The point is to make the design durable so
graphify can connect these intentions to the actual code that will eventually
realise them.

## Why this is needed

The `/quant` workbench currently front-loads expert affordances on a
first-time visitor:

- Hero copy ("QUANT WORKBENCH · V0.1 · 27 BOTS LOADED · DETERMINISTIC SEED")
  reads as scientific, not welcoming.
- Five sliders (Symbol, Bars, Seed, Drift, Vol) appear before any explanation.
- "Jupyter-style notebook" framing assumes prior knowledge.
- 27 bots in a single scrollable list with no visible pedagogy.

A class-12 math student or a curious trader can't tell what the verdict means,
why you'd stack bots, or that the AI bots call a Python ML service. They click
a bot, see a wall of metrics, and bounce.

## Two surfaces

### 1. `/learn` — canonical narrative onboarding

Standalone route, accessible from a new `00 LEARN` nav slot. Long-form,
scrollable, with live mini-demos. ~3-minute read.

Sections:

1. **Hero** — one sentence: "A workbench where you stack trading models like
   Lego blocks, run them on a chart, and see if they agree." One CTA: scroll.
2. **The three pieces** — 3-column diagram: Dataset, Bot, Workspace.
3. **Live demo** — a real `BotCell` rendered inline with a fixed dataset and
   hard-coded SMA Crossover.
4. **Why stack bots?** — side-by-side: SMA alone (1/4 BUY) vs SMA + RSI + MACD
   + Z-score (4/4 BUY). The Output panel's tally flips visually.
5. **The 5 bot families** — Trend, Stats, Risk, Options, AI Quants. Single line
   each. AI Quants gets the honest sub-line about Mock vs Python NN.
6. **Dataset sliders demystified** — interactive mini-card. Symbol, Bars, Seed,
   Drift, Vol explained in plain English with a live mini-chart that responds.
7. **Teacher mode** — two cells side by side, beginner ON vs OFF.
8. **Bring your own bot** — 30-second walkthrough with a 10-line TS snippet.
9. **Now go** — three CTAs: clean workbench, trend starter, AI consensus demo.

### 2. Soft pointer on `/quant` for first-time visitors

- localStorage flag `lb_quant_seen_v1`. If unset, render a small dismissable
  banner above the workspace: "First time here? See how this works in 90s →"
  linking to `/learn`. Set the flag on click or dismiss. No modal, no tour.

## Per-bot learn pages

Each of the 27 bots gets a dedicated page that explains the math, when it
shines, when it breaks, and lets you play with it live.

### Route structure

- `/learn` — the narrative onboarding above.
- `/learn/bots` — encyclopedia index. Grid of all 27 grouped by category.
- `/learn/bots/[id]` — one page per bot. `id` is the existing `BotDef.id`
  (e.g. `/learn/bots/sma-cross`, `/learn/bots/ai-consensus`).

### Per-bot page sections

1. **Hero strip** — glyph + name + category color + tagline + two CTAs:
   `▶ TRY IT NOW` (deep-link `/quant?add=<id>`) and `↗ VIEW SOURCE` (link to
   `lib/quant/bots.ts:<line>` and, for AI bots, the Python
   `ai quants/models/<dir>/train.py`).
2. **TL;DR** — 2–3 plain-English sentences. Same voice as `result.beginner`
   but standalone, not gated behind running the bot.
3. **The math** — render `BotDef.formula` as KaTeX, then a sentence-by-sentence
   breakdown of every variable.
4. **Live demo** — a real `BotCell` mounted inline with the bot's default
   params and a fixed synthetic chart. All sliders exposed.
5. **Specialty: when this bot shines / fails** — the heart of the page. Two
   columns. The "especiality" the user explicitly asked for.
   - **Shines when…** — concrete market conditions. SMA: trending markets.
     RSI Reversion: range-bound. 6-Model Consensus: liquid large-caps with
     strong macro context. Wheel: sideways markets on stocks you'd own.
   - **Fails when…** — the honest counter. SMA: chop kills it (whipsaws).
     RSI: strong trends keep it overbought for weeks. BS Surrogate: deep
     ITM/OTM with extreme IV — outside training distribution. Direction
     Ensemble: regime shifts (COVID, 2022 rate cycle).
6. **How to read its verdict** — what makes the pill say BUY vs HOLD; what
   `confidence` actually represents for *this* bot. Differs per bot.
7. **AI bots only — service status panel**
   - Live ping to `localhost:8000/health` showing 🟢 Live / 🔴 Mock fallback.
   - One-paragraph "how to start the Python side" with the
     `uvicorn serve:app --reload --port 8000` snippet.
   - Mini diagram: `BotCell.run()` → `callApi()` → `/api/<endpoint>` →
     `load_surrogate()` → `predict()` → JSON → `BotResult`.
8. **Related bots** — auto-derived from same category, plus 1–2 hand-curated
   cross-category pairings.
9. **FAQ** — 2–3 hand-written.
10. **Footer** — back to `/learn`, → `/learn/bots`, → `/quant?add=<id>`.

### Auto-generation vs hand-written split

Hand-writing 27 × 10 sections = ~270 content blocks. Don't.

- **Auto from `BotDef`** (60% of each page): hero, formula, params table,
  endpoint, module path, source link, related-bots-by-category, the bot's
  existing `tagline` / mock `summary` / mock `beginner` text. Falls out of the
  existing data model — zero new content needed.
- **Hand-written MDX** (40%): the "specialty: shines/fails" section, FAQ,
  deep math explainer. Lives at `content/bots/<id>.mdx` with frontmatter. The
  `[id]` route pulls auto-fields from the registry and merges with the MDX.
- ~30 min per bot to write the hand-content. Batch over a few sessions.

### Surfacing per-bot pages from existing UI

- `BotLibrary` row — add a small `?` icon next to the `+`/`✓` toggle that opens
  `/learn/bots/<id>` in a new tab. Doesn't interfere with the toggle click.
- `BotCell` header — add a `?` button next to the existing
  `params`/`▶ run`/`✕` cluster.
- Inside the params panel (already shows formula + endpoint + module) — append
  a `↗ How does this work?` link.
- Empty workspace — placeholder cards become real links to their learn pages.

## Decluttering the workbench (independent of Learn)

- Collapse the hero after first run. Demote "run math at the market" into a
  thin strip with a "?" → opens Learn.
- Demote 3 of the 5 sliders. Show **Symbol + Bars** by default; hide
  **Seed / Drift / Vol** behind an "Advanced" disclosure.
- Drop the chip row ("STACK BOTS · TUNE · RUN / BRING YOUR OWN BOT") — marketing
  copy belongs on `/learn` or the homepage.
- Tighten the bot library row. Compress to icon + name + 1-line tagline; show
  category as a 3px left color-bar.
- Output panel collapse. Hide behind a button when the workspace has fewer
  than 3 cells.

## Recommended v1 scope

1. `/learn` narrative page, 6 sections, 1 live demo.
2. `/learn/bots` index — auto-generated grid, no MDX yet.
3. `/learn/bots/[id]` — auto-fields only (no specialty section yet) for all
   27, so every bot has a real URL.
4. Hand-write the 5 most-clicked bots' specialty + FAQ first (probably:
   6-Model Consensus, Direction Ensemble, BS Surrogate, SMA Crossover,
   RSI Reversion). Backfill the other 22 over time.
5. Add `?` icons in `BotLibrary` + `BotCell`.
6. Add localStorage soft banner on `/quant` for first-timers.

~1.5 days of work. The auto-fields-only baseline means no bot is left without
*some* page even before all the hand-content lands.

## Decision points before building

- MDX vs plain JSON for hand-content? MDX lets us drop interactive components
  (live demo, charts) directly into prose. Recommended.
- One long page or tabs? Long page wins for first-time learners.
- Preset deep-links (`/quant?add=<id>`) require `QuantPage` to read URL params
  on mount and auto-add. Small wire-up, ~20 lines.
- Replace `04 TEACHER` nav slot with `LEARN`, or add a new slot? Teacher is the
  AI Greek-explainer (different feature); they shouldn't fight.
- FAQ content — write yourself, or generate seeds from `summary` + `verdict.text`
  and edit? Seeds save 50% time.

## Recently shipped: bot library toggle bug fix

Before any of the above, a bug was fixed in the workbench:

- Symptom: clicking a bot in the library always added a fresh cell, even if
  the bot was already in the workspace. Users couldn't remove a bot from the
  library side — only via the small `✕` on each cell.
- Fix: library rows are now a true toggle. `BotLibrary.onAdd` is paired with
  a new `onRemove(defId)` from `QuantPage.removeBotsByDefId`. Inactive rows
  show `+`; active rows show `✓ added` (hover → `− remove`) and click removes
  every cell with that `defId`.
- The per-cell `✕` button still works for one-off removal. Clicking the
  per-cell remove button is what `BotCell.onRemove` invokes via
  `QuantPage.removeBot(uid)`.

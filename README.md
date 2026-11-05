# lazybull

**Options you can see.** Drag two strikes on an options chain and the payoff, the Greeks and the worst case draw themselves. An AI teacher explains the position in plain English. Then you paper-trade it — on a simulated $5,000 account, with a kill switch under everything.

Live at **[lazybull.us](https://www.lazybull.us)**.

Most people learn options by losing money. SEBI's August 2026 study found that 87.7% of India's individual F&O traders lost money in FY26, and 89% of those under 30 did. The interfaces show a grid of numbers and a buy button. This is the on-ramp that comes first.

## What this is not

- **Not a broker.** We accept no funds. There is nothing to deposit and nothing to withdraw.
- **Not advice.** No tips, no targets, no signals, no recommendations — by design, not by disclaimer. See [docs/COMPLIANCE.md](docs/COMPLIANCE.md).
- **Not a prediction service.** The quant bots are teaching instruments. They are shown as models agreeing and disagreeing, with hypothetical out-of-sample hit rates, never as a forecast.

## The surfaces

| Route | What it is |
|---|---|
| `/learn` | A 14-chapter interactive primer — every chart responds to you. |
| `/practice` | 48 problems across finance, quant, ML, maths and trading. Real Python, judged. |
| `/trade` | The strategy builder: drag the chain, watch the payoff redraw. |
| `/pro` | The terminal — drawing tools, indicators, replay, paper trading. |
| `/quant` | 27 teaching bots on real or seeded tape, with their provenance stated. |
| `/greeks` | Every Greek as a picture, with the teacher on top. |

## The honesty posture

This is a finance-education product in a category full of fraud, so the guardrails are architectural rather than cosmetic.

- **Paper-only.** No custody, no order routing. It is the product's single greatest legal asset.
- **The chain is labelled.** Prices come from a real Black-Scholes engine with a modelled skew; open interest and volume are deterministic placeholders, and the UI says so where they are rendered.
- **One accuracy band, always hypothetical.** Out-of-sample direction accuracy is 55–66% by agreement tier, stated as history, never as a forecast.
- **Indian securities are delayed at least 31 days**, as SEBI's education-data norms require, whoever is looking.
- **Analytics are consent-gated and the product is 18+.** India's DPDP rules ban behavioural monitoring of minors, so an age gate comes before any event is recorded, and using decision traces to improve the teacher is a separate, off-by-default opt-in.
- **Copy is linted.** `npm run compliance` fails the build on sizing instructions, signal language, earnings claims, unhedged accuracy figures and dead domains. The allow-list is empty and meant to stay that way.

## Architecture

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · MongoDB Atlas · deployed on Vercel. The pricing engine, order engine and quant models are first-party; the LLM is rented and swappable.

**[docs/ENGINE.md](docs/ENGINE.md) is the maintainer's map** — read it before changing anything in `lib/pricing.ts`, `lib/paper-orders.ts` or `lib/market-data/`.

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in what you need; every group is optional except Mongo
npm run dev
```

The app degrades honestly with nothing configured: no `MONGODB_URI` means no sign-in or sync, no market-data keys means the provider chain falls through to a labelled simulated tape, and no `OPENAI_API_KEY` means the AI teacher returns its deterministic mock explanation marked as such. Billing is env-gated — with no provider keys, the pricing page offers a real waitlist instead of a checkout, never a fake one.

Env groups in `.env.example`: MongoDB, Auth.js, market data, AI surfaces, admin, billing (Lemon Squeezy for USD, Razorpay for INR), region and consent, social links, and the Yahoo fallback flag.

One-time index creation:

```bash
node --env-file=.env.local --experimental-strip-types scripts/init-mongo.ts
```

## Tests and checks

```bash
npm test        # vitest
npm run verify  # tsc + vitest + next build + bundle guard + compliance lint
```

`npm run verify` is the gate. It type-checks, runs the suite, builds, enforces the bundle ceilings in `scripts/guard.mjs`, and runs the copy lint in `scripts/check-compliance.mjs`.

After deploying, assert the production environment from the outside:

```bash
node scripts/verify-prod.mjs https://your-host
```

## Documentation

- **[docs/ENGINE.md](docs/ENGINE.md)** — every subsystem, why it is built that way, and where it drifts.
- **[docs/COMPLIANCE.md](docs/COMPLIANCE.md)** — the rules we operate under and the code that answers each one.
- **[docs/METRICS.md](docs/METRICS.md)** — what the admin dashboard computes and what each number means.

## Status

Pre-launch. The product is live and free; billing is built and env-gated, waiting on entity and provider onboarding.

## Licence

No licence file: all rights reserved.

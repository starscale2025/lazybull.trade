# The engine

A maintainer's map of lazybull (live at lazybull.us), for an engineer who has never opened this
repository. Every subsystem cites its file, and where a design looks odd the point is to say *why*.
Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, MongoDB, Vercel. The product is
**paper-only**: no real orders, no money movement, no brokerage integration anywhere in the tree.

---

## 1. Pricing — `lib/pricing.ts`

Closed-form Black–Scholes, no WASM and no vendor SDK, so the chain prices in under 100 ms and is
deterministic — which is what lets SSR and CSR agree without hydration tricks.

- `ncdf` is the Abramowitz & Stegun 26.2.17 rational approximation of the normal CDF, max absolute
  error ~7.5e-8. That bound is why a polynomial is acceptable: a chain quoted to the cent is not
  sensitive to the eighth decimal of a probability.
- `priceOption` returns price plus five Greeks, theta per day (÷365) and vega/rho per point (÷100)
  so no caller rescales; at `t <= 0` it returns intrinsic and zero Greeks.
- `skewedIv` is the smile: `baseIv + skew + |m|·0.04`, `m = K/S − 1`, skew `0.18·max(0,m)^1.4` for
  calls against `0.32·max(0,−m)^1.4` for puts. Puts are steeper on purpose.
- `priceChain({spot, expiries, strikes, baseIv = 0.32, rate = 0.045, spread = 0.02})` builds the
  grid in one pass, bid/ask straddling the mid by `price·spread/2 + 0.02`.
- `payoff` sums signed intrinsic minus premium at a 100× multiplier. `pnlCurve` samples it (±40%,
  81 points) for the chart; `pnlSummary` re-samples wider and denser (±60%, 401 points) and
  interpolates breakevens across sign changes.
- `pnlSummary` also sets `unboundedRisk` from the slope at each end: a tail whose loss is still
  *growing* at the edge is how a naked short is caught, since a numerical scan cannot see infinity.

**Open interest and volume are not market data.** `oi` and `vol` come from an FNV-1a
`hash(expiry|strike|type)` scaled into a plausible range — stable across renders, completely
invented. In the same typography as the prices beside them they read as a feed, so the table footer
in `components/options-chain/OptionsChain.tsx` says so in the chain itself: "Chain: Black-Scholes
with a modelled skew · open interest and volume are simulated placeholders". Keep that line until
those columns carry a real feed.

## 2. Strategy detection — `lib/detector.ts`

`detect(legs)` sorts by strike and pattern-matches into one of 19 named shapes (singles, verticals,
straddles/strangles, condors, butterflies, calendars, ratios) or `Custom`, returning
`{kind, bias, defined, net, blurb}`. `defined` is the honest risk flag the UI and the AI teacher
both read. Nothing else in the app enumerates strategies.

## 3. Order engine and paper account

**`lib/paper-orders.ts`** — pure functions over order state, no React and no storage, so fill rules
are unit-tested directly. Types `market | limit | stop`; TIF `day | week | gtc` — not
exchange-accurate, and the file says so, because there is no session calendar.

- `fillPriceFor` treats a limit as the **worst** acceptable price: a buy limit at 100 with the
  market at 90 fills at 90. Returning the limit would overcharge every marketable order.
- A triggered stop fills at the market, so it slips on a gap; anything else flatters every stop.
- `sweep` runs **expire → fill → OCO**. OCO first would cancel the sibling of an unfilled order.
- `bracketFor` builds TP/SL children as `gtc` + `reduceOnly` sharing a `parentId` — GTC because an
  exit that expires silently unprotects the position.
- `ordersMargin` reserves notional only for non-reduce-only buys, at 1:1. `validateMove` refuses a
  drag that would fill instantly, which would liquidate the position the handle protects.

**`lib/paper-shares.ts`** — average-cost accounting. `QTY_EPS = 1e-9` because an exact `=== 0` left
float dust that rendered "LONG 0.00" and could never be closed; `MAX_QTY`/`MAX_PRICE` because an
unbounded fill drove cash to `-Infinity` and poisoned every later comparison.

**`lib/paper-metrics.ts`** states the identities as a contract:

```
holdingsValue  = Σ signed qty × price
betsAtCost     = Σ cost of OPEN option bets (debit +, credit −)
equity         = balance + holdingsValue + betsAtCost
accountMargin  = Σ |qty| × price          (1:1, shorts included)
availableFunds = equity − accountMargin − ordersMargin
marginBuffer   = availableFunds / equity  (0 when equity ≤ 0)
```

Cash-account accounting: a buy debits full notional, so equity must add holdings back. The old
`equity = balance + unrealised` assumed a margin-style balance and made every purchase read as an
instant loss of its own notional. Leverage is pinned at 1:1 rather than imitating a broker's table,
because an account that quietly grants leverage understates what a position costs. Open option bets
are carried at cost; a stale model price would invent P&L.

**`lib/stores.ts`** — `DEFAULT_CAPITAL = 5_000`, a beginner-sized stake, because $100k made every
lesson feel free; existing accounts keep what they started with. `accountStartedAt` + `resetCount`
are the account **epoch** (persist v3; older accounts reconstruct a start from the ledger rather
than inventing a date). `useSafety` holds `trainingWheels` (on by default, blocks opening naked
shorts), `dailyLossLimit` (500) and `killSwitchTriggered`. The gates live inside `submitOrder`, the
one entry point every order path shares, so no caller can forget them — and **reducing exposure is
always allowed, including while halted**, because blocking a close would trap the user in the
position that armed the switch.

## 4. Paper sync — `lib/paper-sync-core.ts`, `lib/db/paper.ts`, `app/api/paper/route.ts`

Snapshot replication with optimistic concurrency: the client is the engine and the truth while it
runs; the server holds the latest sanitized snapshot per user at a rising `rev`.

- `sanitizeSnapshot` coerces an untrusted snapshot — the wire is treated exactly like localStorage.
- `decideInitial` → `none | push | adopt | fork`. A factory-default local account has nothing worth
  pushing; a server past what this device last saw means someone else wrote.
- `resolveFork` gives the account to whichever side traded more recently, ties to the server —
  adopting is the non-destructive direction, since the local copy is still on disk.
- `putPaper` is `findOneAndUpdate` on `{userId, rev: baseRev}` with `$inc: {rev: 1}`, upserting only
  at `baseRev === 0`. The unique index on `userId` is **awaited**: it turns a baseRev-0 race into a
  duplicate-key error rather than a second account document.
- **A conflict returns the server copy in the 409 body**, so one round trip resolves it and the
  client never has to guess what it lost.
- `POST` aliases `PUT` because `navigator.sendBeacon` can only POST. Over 512 KB → 413.

## 5. Market data — `lib/market-data/**`

`index.ts` is the orchestrator and the only module routes import; adapters implement the one
interface in `provider.ts`, so adding a vendor is a file plus a slot in the chain.

- **Chain** Alpaca → Twelve Data → Finnhub → Yahoo; a provider is a candidate only with credentials
  *and* a closed breaker. `CHAIN_DEADLINE_MS = 7000` caps the whole walk and shrinks each slice to
  the remaining budget, so four 6-second timeouts cannot stack to 24.
- **Freshness tiers** (`provider.ts`): A realtime primary, B secondary live, C last-good from cache
  after everything failed, D nothing real. Every response carries a `Provenance` stamp the UI
  renders. `FRESH_TTL_S = {quote: 3, intraday: 60, daily: 600}`, `STALE_RETENTION_S` 24 h.
- **Breakers** (`health.ts`): three consecutive qualifying failures (429/5xx/timeout/network) open a
  provider for 30 s, then half-open. A clean "no data" does not qualify. Module state, reset on cold
  start: a breaker is a short-lived hint, not durable state.
- **Single-flight**: an in-process `dedup()` map collapses concurrent identical requests inside an
  instance; `acquireRefreshLock`/`releaseRefreshLock` (`cache.ts`) collapses them fleet-wide via KV.
  Cache is KV when configured, an in-process Map otherwise; every KV call is timed out and its
  errors swallowed. KV is an enhancement, never a dependency.

**Indian securities** are classified in `lib/region.ts` (`.NS`/`.BO`, the `^CNX*`/`^NSE*`/`^BSE*`
families, bare names like NIFTY/SENSEX) and served with a **31-day lag** — `LAG_DAYS`, one day of
margin over SEBI's 30-day education-data floor so no clock skew produces a 29-day-old bar. The
**provenance carries the policy** id `sebi-education-lag-31d`, so the badge names the rule instead
of a vague "delayed". The rule attaches to the **data, not the viewer**: US/UK names stay live for
everyone, no geo-IP sits on the data path, and nothing in the cache is keyed by viewer.
`lagBarsResponse` also **scrubs the meta** (market price, previous close, market time, 52-week
range) — a lagged series carrying a live price in its meta leaks exactly what the policy withholds.
The lag is applied on **read**, so a warm cache can never freeze the cutoff.

**The Yahoo adapter is off in production**: `available()` is `NODE_ENV !== "production"` unless
`MARKET_DATA_ALLOW_YAHOO=1` is set deliberately. It is an unlicensed scrape and must be retired
before anyone is charged for data.

## 6. Streaming — `app/api/stream/quotes/route.ts`, `lib/streaming/**`

- `manager.ts` keeps **one** EventSource for the union of subscribed symbols, with reconnect
  backoff, stale detection (12 s), fan-out throttled to ~10 fps, and fallback to polling
  `/api/quote-batch` after four failed attempts.
- The route is a thin pump over `getProvider()`. There is no shared upstream websocket — serverless
  has no persistent singleton and Alpaca's free tier allows one connection total — so "one upstream
  subscription per symbol" comes from the cache plus in-flight de-duplication instead.
- Events: `hello`, `quotes` (changed rows only), a heartbeat on its own clock, `bye` at the 55 s
  cycle boundary, under Vercel's 60 s cap; the client reconnects.
- Symbols cap at 50. `guard.ts` caps 8 concurrent streams and 30 new connections per minute per IP,
  fleet-wide via KV atomics when configured and per-instance otherwise, **failing soft** to the
  in-memory decision on any KV error — abuse protection must not become an availability risk.
- **Indian securities are never streamed** (a tick is by definition a live print): one lagged
  snapshot in the priming pump, then excluded from every later tick.

## 7. Quant workbench — `lib/quant/**`, `ai quants/`

- `BOT_REGISTRY` (`bots.ts`) is 27 bots — 12 AI bots from `ai-bots.ts`, then 15 classical
  technical/statistical/risk/options instruments. **Teaching instruments, not signals.**
- `provenance.ts` holds `SOURCE_META`, the single source of truth for "where did this number come
  from", badged on every card: hosted API, on-device CNN, on-device transformer, snapshot,
  Black-Scholes, Monte Carlo, statistical, technical, heuristic, your own code. `heuristic` is the
  one that matters — a stand-in shown only when the trained model could not be reached.
- `onnx.ts` runs the small trained nets in-browser via onnxruntime-web (WASM), **self-hosted** from
  `/ort/`, which closed the last third-party script origin. Three fragile constraints: the CPU build
  (not JSEP, a 26 MB artifact), `wasmPaths` as a **file** override so the loader does not
  dynamically import from a CDN, and `numThreads = 1` (the threaded path needs cross-origin
  isolation, which would break the cinema iframe and the WebRTC handshake).
- `ai quants/serve.py` is the FastAPI surrogate service, reached at `NEXT_PUBLIC_QUANTAI_URL`. Unset
  in production there is deliberately no localhost fallback, and each bot degrades to its
  deterministic TypeScript surrogate.
- **The canonical out-of-sample direction band is `ACCURACY_BAND = "55–66%"`** (`types.ts`), always
  printed beside `HYPOTHETICAL_NOTE` — "hypothetical · out-of-sample · not a forecast". One
  constant, in the module both `ai-bots.ts` and `bot-content.ts` import, so a number and its hedge
  cannot drift apart. A higher figure fails the compliance lint.
- Output is framed as **agreement and disagreement between models**, never as odds. `BAND_LABEL`
  (`ai-bots.ts`) is the one place a band key becomes words: `ultra → "very strong agreement"` down
  to `low → "split"`. The quantity underneath is dispersion — how tightly models landed on the same
  side — and printed raw as ULTRA/HIGH it read as a trade grade whose top rung promises the best
  odds. The old ladder of four accuracy bands rising with agreement turned a dispersion measure into
  a promise; there is one band now, and the label says only how much models agreed.
- Custom bots hot-load through `runtime.ts` (`new Function`) — that, with the BYO probability model
  in `lib/models.ts`, is why the CSP still carries `'unsafe-eval'`.

## 8. AI teacher — `app/api/explain/route.ts`

POST-only, sign-in optional, gated three ways.

1. **Per-UTC-day cap** — `PLAN_LIMITS[plan].explainsPerDay` (free = 5), counted by `consumeDaily`
   (`lib/billing/usage.ts`), keyed `user:<id>` signed in and `ip:<ip>` otherwise, so the free
   allowance is five a day with or without an account — the number the pricing page prints. It is
   consumed **after** validation (a malformed body must not spend an explain) and **before** the
   model call (a capped request must cost nothing); over the cap it logs `hit_paywall`.
2. **Per-minute limiter** (`lib/rate-limit.ts`): 10/IP, 60 global — that bounds spend against IP
   rotation; the daily cap is a product limit.
3. **The locked teaching prompt** — `TEACHER_SYSTEM_PROMPT` in `lib/billing/explain-policy.ts`:
   explain the position the user built; never recommend, forecast or size.

Every response, live or mock, carries `EXPLAIN_DISCLOSURE` — the AI-output disclosure — plus today's
tally. With no `OPENAI_API_KEY`, an upstream error, or a 20-second timeout it returns
`source: "mock"`, the deterministic explanation built from numbers the client already computed. The
teacher never answers with a 500.

## 9. Practice — `lib/practice/**`, `app/api/practice/**`, `public/practice/pyodide-worker.js`

48 problems across five tracks, judged by real Python execution.

- **Light/heavy split** (`types.ts`): `ProblemMeta` rows in `problems.ts` for the client board;
  `ProblemContent` (statements, stubs, testcases, editorials) in `content/*`, server-only.
  Tree-shaking cannot drop the contents of an array, so if the statements sat beside the rows every
  visitor to `/practice` would download 48 problems' worth of Python in the list chunk.
- `forClient()` is the one door to the browser and is an **allow-list** — hidden cases (inputs *and*
  outputs), the editorial and every hint past the first are stripped — so a field added tomorrow
  cannot leak by default.
- **Execution**: `runner.ts` spawns the worker (classic, **same-origin**) on the first ▶ run, never
  at import, keeping the ~15 MB runtime off pages that merely display a problem. It `importScripts`
  **Pyodide v0.28.3 from cdn.jsdelivr.net** — the site's only third-party script origin, loaded
  inside a worker and never as a page `<script>`.
- **Protocol**: main sends `{type:"run", id, code, entry, cases}`; the worker replies `status`
  (loading/ready), one `case` per testcase as it lands, then `result` with capped stdout/stderr.
  There is no cancel message — Python runs synchronously, so an infinite loop is only stoppable by
  `terminate()`, which the runner does at 20 s before rebuilding the worker. Case kwargs parse with
  `ast.literal_eval`, literals only, so an input can never be code.
- **Formatter**: the worker's `fmt` is copied **verbatim** from `scripts/practice/gen/common.py` (a
  vitest diffs the two), which is what makes a browser's printed output comparable with the
  `expected` string the generator produced from a reference implementation. Floats print to at most
  six decimals.
- **Comparison** (`judge.ts`): exact match first, else numbers within
  `REL_TOLERANCE = 1e-6 · max(1, |expected|)` and lists element-wise under the same rule; everything
  else exactly. The tolerance covers a browser's libm differing from the generator's machine and
  sits far below anything a wrong formula produces.
- **The trust boundary is the point.** The browser runs the code and posts what each case printed;
  the **server** holds the expectations and computes the verdict (`.../[slug]/submit`) — hidden
  expectations never leave the process. Hidden case *inputs* travel separately on submit via
  `.../[slug]/cases?mode=submit`. Someone could post strings by hand, but they would still need the
  right answers, and the per-IP cap makes the endpoint a poor oracle. Recording is best-effort: a
  database blip returns the real verdict with `recorded: false`, never a fake success.
- **Collections** (`lib/db/practice.ts`): `practice_submissions` (one row per run or submit with the
  verdict, wall time, a hash of the normalised code, and the code itself for signed-in users) and
  `practice_certificates` (one row per user and track). Identity follows the events model — userId
  when signed in, else the device id — and reads take both, so anonymous solving survives sign-in.
- **Certificates**: `POST /api/practice/certificate` requires sign-in, mints only once the server has
  seen an accepted submit for **every** problem in the track, is idempotent per (user, track), and
  answers 409 with the missing slugs.
- **TypeScript is editor-only for now** (`LANG_META` marks it `judged: false`). Content under
  `lib/practice/content/` is **generated** by `scripts/practice/gen-content.py` — edit the generator.

## 10. Billing and entitlements — `lib/billing/**`

- `types.ts` is the single source of truth for the ladder `free → plus → pro → power`, with
  `PLAN_LIMITS` (explains/day, workspaces, saved positions, bot count, two practice flags, custom
  bots) and `PLAN_PRICES` in USD and INR. Pricing page, API gates, account page and admin metrics
  all read it, so a limit cannot be advertised on one surface and enforced differently on another.
- `getPlan(userId, email)` returns the highest plan any entitling subscription confers and **never
  throws** — a Mongo blip degrades a paid user to free rather than 500-ing `/api/explain`.
  `entitles` also requires an unclosed period with 24 h of grace, because a renewal webhook can land
  after `currentPeriodEnd`. `LAZYBULL_COMP_PLAN` pairs grant a plan with no subscription row.
- The `subscriptions` collection is written **only** by the two webhook routes — a checkout redirect
  proves nothing, a signed webhook does. The upsert is keyed `{provider, providerSubId}` behind a
  unique index and guarded by the provider's own event timestamp, so at-least-once out-of-order
  delivery is safe: a replay is a no-op, a late older event cannot regress a newer status.
- Both rails verify HMAC-SHA256 over the **raw** body with `timingSafeEqual`. **Lemon Squeezy**
  (`X-Signature`) is the USD rail and the **merchant of record** — their hosted checkout takes the
  card and remits tax, which is what lets an India-domiciled company sell worldwide with no US
  entity. **Razorpay** (`X-Razorpay-Signature`) is the INR rail (UPI autopay, cards), created
  server-side and handed to a hosted page so no new script origin joins the CSP.
- With no billing env, `/pricing` shows a real waitlist, never a fake checkout.
- Daily counters (`usage.ts`) INCR a per-UTC-day KV key with a 2-day TTL, else a Mongo `usage_daily`
  upsert with a TTL index, and **fail open** when both are unreachable — a product cap is not a
  security control.

## 11. Events and consent

- **Consent is the first gate.** `lib/track.ts` checks it at the top of `track()`, before the queue —
  not at flush, not on the server. An event never queued cannot leak from a `pagehide` beacon, and a
  device that never consented never even gets a device id. **Analytics events are dropped without
  consent.**
- Two bases: `analytics`, and `trace` for decision traces (satisfied by analytics *or* training
  consent, because the training toggle's own copy names re-asks as the thing it covers).
  `ESSENTIAL_EVENTS` is deliberately empty — the consent decision and signup are recorded
  server-side.
- **Schema v2**: every event carries `sv: 2`; the first `page_view` of a session carries `ref`
  (referrer **host** only) and `utm_source`/`utm_medium`/`utm_campaign`, repeated on later events as
  `ft_*` first-touch, so a conversion three pages deep still names the channel.
- The **server** stamps `country` (ISO-2 from the platform geo header, never an IP) in
  `lib/db/events.ts`; the client never sends one. v1 events are still accepted so an old tab keeps
  its batch across a deploy. Indexes `{userId, createdAt}`, `{type, createdAt}`, `{createdAt: -1}`.
- `lib/consent.ts` holds `{v, adult, analytics, training, at, text}` plus `CONSENT_TEXT_VERSION` —
  bump it and the gate re-prompts rather than inheriting a stale yes. localStorage is the device
  truth with a cookie mirror; the server copy (`lib/db/consent.ts`) is an audit trail and must never
  be required.
- **Minors are never posted**: an under-18 answer stays on the device, because shipping a "child
  said no" record with a device id would itself be processing a child's data.
- `components/ConsentGate.tsx` is the 18+ gate plus two toggles — analytics offered on but written
  only on a real click, AI-training offered **off** as a separate opt-in. Under 18 closes the
  workbench.
- `lib/confusion.ts` is the written confusion heuristic, deliberately conservative: a **re-ask**
  (same position fingerprint explained twice within five minutes) and an **abandon** (a builder
  session over 30 s ending with no paper trade), emitted under `trace`.

## 12. Auth and security

- **`lib/auth.ts`** — NextAuth v5, Google only, database sessions via the Mongo adapter.
  `withoutOAuthTokens` wraps `linkAccount` and deletes `access_token`, `refresh_token` and
  `id_token` before insert. Nothing here ever reads those tokens, so they were stored capability
  never spent — pure blast radius on a leaked `MONGODB_URI`. Deleting beats encrypting and cannot
  lock anyone out: re-sign-in works off `{provider, providerAccountId}`, which survives the strip.
- `AUTH_URL` is the origin pin so a forged Host header cannot steer the callback. `trustHost` stays
  true because in `@auth/core` it is one on/off switch, not a host allow-list.
- **CSP** — `proxy.ts` mints a 128-bit nonce per request and builds the page policy there;
  `next.config.ts` owns the five non-CSP headers and the static policy for `/cinema/**`. **The two
  sources must stay on disjoint paths** — they write into the same header bag and which wins depends
  on the server.
- The policy is still **report-only**. The blocker: 48 routes are statically prerendered, and a
  prerendered document is served verbatim — its inline bootstrap and `<script src>` tags carry no
  nonce, because there was no request at build time to mint one. Under `'strict-dynamic'` they would
  be blocked and every prerendered page would white-screen (verified against a production build).
  Enforcing means opting the page routes into dynamic rendering — and paying for it — or dropping
  the nonce. Until then `X-Frame-Options` carries the clickjacking defence, because browsers ignore
  `frame-ancestors` in report-only mode.
- `'unsafe-eval'` cannot honestly be narrowed: CSP is per-document and soft navigation never
  re-issues the header, so scoping it to `/quant` and `/trade` would break the two `new Function`
  sinks while restricting nothing. Removing it means removing those sinks.
- **`lib/rate-limit.ts`** derives `clientIp` once for every limited route, platform headers winning
  over the spoofable leftmost `x-forwarded-for`; the global cap is the unspoofable backstop, which
  is why every route keeps both tiers. **`lib/kv.ts`** reads env at **call** time, takes an
  injectable transport, and times out at 2 s so KV can never wedge a request.
- **`lib/admin.ts`** — `ADMIN_EMAILS` is authoritative whenever non-empty: it *replaces* the list,
  so any address including the founder's is revocable by env alone; `FOUNDERS` applies only while it
  is empty. No union — a union would be additive-only and unable to revoke, which is a backdoor.

## 13. Testing

Vitest, node environment, `__tests__/**/*.test.ts`, `@` aliased to the repo root. Decision logic is
kept pure and separate from React and storage precisely so it can be tested directly: fills, share
accounting, account metrics, the sync reconciler, the judge, the consent rule, the streaming guard
and the compliance lint all have suites. Database suites (`admin-metrics`, `billing-store`,
`paper-db`, `practice-db`, `waitlist`) run against `mongodb-memory-server`, which works because
**`lib/mongo.ts` reads `MONGODB_DB` at call time** — a module-level const is captured when the
import graph is evaluated, which in vitest happens before a suite's `beforeAll` can point the name
at its ephemeral server. `__tests__/helpers/fakeKv.ts` fakes the KV REST surface on a
test-controlled clock, each command body running synchronously inside its promise to mirror Redis
atomicity; that is what makes the single-flight lock and the per-IP guard testable with no network.

## 14. Operational runbook

**`.env.example`** is grouped and commented: MongoDB; Auth.js/Google; market data (Alpaca → Twelve
Data → Finnhub, all optional); KV (also the store behind the fleet-wide limiter); AI surfaces
(OpenAI, OpenRouter, voice gates); admin + the quant service URL; billing (Lemon Squeezy variants,
Razorpay plans, comp grants, `LAZYBULL_INR_PER_USD`); region and consent; social links; the Yahoo
flag. The app runs with **zero** env vars set — every subsystem degrades on its own terms.

- `scripts/init-mongo.ts` — idempotent index creation
  (`node --env-file=.env.local --experimental-strip-types scripts/init-mongo.ts`).
- `scripts/verify-prod.mjs <origin>` — post-deploy verification from the outside: admin boundary,
  voice auth gate, KV limiter actually fleet-wide, security headers, CSP collector, a credential scan
  over the entry bundles. Nothing else proves the deployed environment matches the template.
- `scripts/guard.mjs` — post-build bundle ceilings: one three.js carrier chunk, chunks total
  ≤ 4.6 MB, largest chunk ≤ 1.6 MB, plus a warn-only dead-code scan.
- `scripts/check-compliance.mjs` — the copy lint over `app`, `components`, `lib/quant`,
  `lib/practice/content` and `lib`: sizing instructions, trade instructions, signal language,
  earnings/edge claims, an accuracy figure outside the canonical band, the dead `.trade` domain,
  demo-ware wording. Legitimate hits go in `scripts/compliance-allow.txt` as `path:pattern-id`.
  Widening a rule to dodge a failure is the one edit the file exists to prevent.
- `npm run verify` = `tsc --noEmit && vitest run && next build && node scripts/guard.mjs &&
  node scripts/check-compliance.mjs`.

## 15. Where things drift

1. **Plan limits advertised vs enforced.** `PLAN_LIMITS` (`lib/billing/types.ts`) is the only place
   a number may live. Change a cap and confirm the pricing page, paywall copy, practice locks
   (`lib/practice/access.ts`) and `app/api/explain` still read it.
2. **The accuracy band.** `ACCURACY_BAND` (`lib/quant/types.ts`) and `BAND_LABEL`
   (`lib/quant/ai-bots.ts`). A figure typed into a card instead of imported will drift, and the lint
   catches only the specific figures it knows.
3. **Generated Practice content vs its generator.** `lib/practice/content/*.ts` is output; edit
   `scripts/practice/gen/` and regenerate, or `expected` stops being something a reference
   implementation produced. The two `fmt` copies are diffed by a test — change one, change both.
4. **The chain's placeholder labelling.** Remove the `OptionsChain.tsx` footer only when `oi`/`vol`
   have a real feed; keep it through any layout rewrite.
5. **Provenance labels.** `SOURCE_META` (`lib/quant/provenance.ts`) and the `Provenance` stamp
   (`lib/market-data/provider.ts`) are what the badges render. A new data path with no source id, or
   a fallback that forgets `heuristic`, produces a card that claims more than it did.
6. **The lag policy's blast radius.** `lib/region.ts` is applied inside the orchestrator, and the SSE
   route excludes the same symbols independently. Any path bypassing `getProvider()` bypasses it.
7. **The two CSP sources.** `proxy.ts` and `next.config.ts` must stay on disjoint paths, or one
   silently un-nonces the other.

// Post-deploy PRODUCTION verification — run against the live deployment:
//     node scripts/verify-prod.mjs https://lazybull.trade
//
// `npx vitest run` proves the code is right in a checked-out tree. Nothing there
// proves the DEPLOYED environment is configured right — env vars, headers, KV,
// and the auth gates only exist as production configuration. This script makes
// real HTTP requests and asserts that configuration from the outside.
//
// Zero dependencies (global fetch + node: builtins, Node >= 18) so it runs from
// any CI step without an install, and every request is bounded by a per-request
// timeout plus a hard TOTAL timeout — a hung endpoint must never wedge a job.
//
// Checks map to the register in docs/THREAT_MODEL.md:
//   1 admin boundary R-00 · 2 voice auth gate R-02 · 3 KV limiter live R-01
//   4 security headers R-03 · 5 CSP collector R-03 · 6 key custody §6b · 7 recon R-13
//
// Exit codes: 0 = every check passed · 1 = at least one FAIL (gate the deploy)
//             2 = usage error, unreachable host, or the total timeout tripped.

const REQ_TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 90_000;
// Scanning every chunk of a 3.7 MB bundle is pointless for a prefix scan; the
// entry chunks are where an inlined secret would land. Bounded so CI stays fast.
const MAX_BUNDLES = 40;

// ── credential patterns (the ONE place this vocabulary lives) ───────────────
// Every entry anchors to a distinctive PREFIX, never to entropy: a generic
// "long random string" rule fires on minified identifiers and base64 asset
// blobs, and a false FAIL that blocks a deploy is worse than a narrow rule.
// Lookarounds keep prefixes from matching mid-token (`task-`, `risk-`).
// Add a row here — and nowhere else — when a new key enters .env.example.
const SECRET_ENV_NAMES = [
  "MONGODB_URI", "AUTH_SECRET", "NEXTAUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET",
  "OPENAI_API_KEY", "OPENROUTER_API_KEY", "ALPACA_KEY_ID", "ALPACA_SECRET",
  "TWELVE_DATA_API_KEY", "FINNHUB_API_KEY",
  "KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
].join("|");

const SECRET_PATTERNS = [
  ["openai secret key", /(?<![\w-])sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{24,}/g],
  ["openrouter key", /(?<![\w-])sk-or-v1-[A-Za-z0-9]{24,}/g],
  ["anthropic key", /(?<![\w-])sk-ant-[A-Za-z0-9_-]{24,}/g],
  // ek_ tokens are minted per session and legitimately reach the browser at
  // RUNTIME (useVoiceAgent holds one in memory); one baked into static HTML/JS
  // is a hardcoded credential, which is why scanning only static assets is sound.
  ["openai ephemeral token", /(?<![\w-])ek_[A-Za-z0-9]{24,}/g],
  ["mongo connection string", /mongodb(?:\+srv)?:\/\/\S+/gi],
  ["google api key", /(?<![\w-])AIza[0-9A-Za-z_-]{35}(?![\w-])/g],
  ["google oauth client secret", /(?<![\w-])GOCSPX-[A-Za-z0-9_-]{20,}/g],
  ["alpaca key id", /(?<![A-Za-z0-9_])(?:PK|AK)[A-Z0-9]{18}(?![A-Za-z0-9_])/g],
  ["aws access key id", /(?<![\w-])AKIA[0-9A-Z]{16}(?![\w-])/g],
  ["github token", /(?<![\w-])(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})/g],
  ["slack token", /(?<![\w-])xox[baprs]-[A-Za-z0-9-]{10,}/g],
  ["stripe live key", /(?<![\w-])[sr]k_live_[A-Za-z0-9]{16,}/g],
  ["private key block", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g],
  // A server-only env NAME next to an assigned value — the shape a leaked
  // build-time inline takes. The bare name in an error string ("OPENAI_API_KEY
  // is not set") has no `:`/`=` + quoted value after it, so it stays quiet.
  ["server env var with a value", new RegExp(`\\b(?:${SECRET_ENV_NAMES})\\b\\s*["']?\\s*[:=]\\s*["'\`][^"'\`\\n]{8,}`, "g")],
];

// Recon shapes for the public observability endpoints (check 7). Kept separate
// from SECRET_PATTERNS: a hostname is not a credential, but /api/health echoes
// raw driver errors on failure, and those carry the cluster host verbatim.
const LEAK_PATTERNS = [
  ["credentials embedded in a URL", /[a-z][a-z0-9+.-]*:\/\/[^/\s"']+:[^/@\s"']+@/gi],
  ["atlas cluster hostname", /[a-z0-9-]+\.mongodb\.net/gi],
  ["kv/upstash hostname", /[a-z0-9-]+\.upstash\.io/gi],
  ["internal hostname", /\b[a-z0-9-]+\.(?:internal|local|lan|cluster\.local)\b/gi],
  ["private ip", /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g],
];

// Strings that only ever render inside the admin cockpit.
const COCKPIT_MARKERS = ["ADMIN COCKPIT", "Cockpit is admin-only", "KillSwitch", "kill switch"];

// ── output (mirrors scripts/guard.mjs: ✓/✗ glyphs, one line per assertion) ──
const LABEL_W = 38;
let failed = 0;
let passed = 0;

const pass = (label, evidence) => {
  passed++;
  console.log(`✓ PASS  ${label.padEnd(LABEL_W)} ${evidence}`);
};
const fail = (label, evidence) => {
  failed++;
  console.error(`✗ FAIL  ${label.padEnd(LABEL_W)} ${evidence}`);
};
const note = (text) => console.log(`        ${"".padEnd(LABEL_W)} ${text}`);
const warn = (text) => console.warn(`⚠ NOTE  ${text}`);
const section = (title) => console.log(`\n── ${title} ${"─".repeat(Math.max(2, 68 - title.length))}`);

/** Mask a matched credential — never echo one into a CI log. */
const mask = (hit) => `${hit.slice(0, 4)}…[${hit.length} chars]`;

/** Redact anything secret-shaped before printing a response body. */
function redact(text) {
  let out = text;
  for (const [, re] of SECRET_PATTERNS) out = out.replace(re, (m) => mask(m));
  return out;
}

const snippet = (text, n = 110) => {
  const flat = redact(String(text ?? "")).replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat || "(empty body)";
};

/** One bounded request. Never throws — a transport error becomes a result. */
async function req(method, url, { headers = {}, body, redirect = "follow" } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      redirect,
      cache: "no-store",
      signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    });
    return { ok: true, status: res.status, headers: res.headers, text: await res.text() };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// ── usage ───────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/verify-prod.mjs <base-url>");
  console.error("   eg: node scripts/verify-prod.mjs https://lazybull.trade");
  process.exit(2);
}
if (typeof fetch !== "function") {
  console.error("verify-prod: needs Node 18+ (global fetch is missing)");
  process.exit(2);
}

let BASE;
try {
  BASE = new URL(arg).origin;
} catch {
  console.error(`verify-prod: "${arg}" is not a valid URL`);
  process.exit(2);
}
const at = (path) => BASE + path;

// The total timeout is unref'd: it can only fire while work is outstanding, so
// a normal finish exits immediately instead of idling for the full budget.
const killer = setTimeout(() => {
  console.error(`\n✗ verify-prod: TOTAL TIMEOUT after ${TOTAL_TIMEOUT_MS / 1000}s — aborting so CI cannot hang`);
  process.exit(2);
}, TOTAL_TIMEOUT_MS);
killer.unref();

console.log(`verify-prod — ${BASE}`);
console.log(`${process.version} · request timeout ${REQ_TIMEOUT_MS / 1000}s · total timeout ${TOTAL_TIMEOUT_MS / 1000}s`);
if (new URL(arg).protocol !== "https:") warn("target is not https — HSTS and secure-cookie checks below are meaningless over http");

// ── 1. admin boundary (R-00) ────────────────────────────────────────────────
// Anonymous GET /admin must bounce to sign-in. Redirects are followed MANUALLY
// so the assertion lands on the redirect itself, not on the sign-in page.
section("1. admin boundary — R-00");
{
  const label = "GET /admin (no cookies)";
  const r = await req("GET", at("/admin"), { redirect: "manual" });
  if (!r.ok) {
    fail(label, `request failed: ${r.error}`);
  } else {
    const loc = r.headers.get("location") ?? "";
    const isRedirect = r.status >= 300 && r.status < 400;
    if (r.status === 200) fail(label, `200 OK — the anonymous gate is NOT redirecting`);
    else if (!isRedirect) fail(label, `${r.status} — expected a 3xx redirect to the sign-in flow`);
    else if (!/\/auth\/signin|\/api\/auth\/signin/.test(loc)) fail(label, `${r.status} → ${loc || "(no Location)"} — not the sign-in flow`);
    else pass(label, `${r.status} → ${loc}`);

    const hits = COCKPIT_MARKERS.filter((m) => r.text.toLowerCase().includes(m.toLowerCase()));
    if (hits.length) fail("/admin body carries no cockpit markers", `LEAKED: ${hits.join(", ")}`);
    else pass("/admin body carries no cockpit markers", `none of ${COCKPIT_MARKERS.length} markers in ${r.text.length} bytes`);
  }
}

// ── 2. AI spend protection (R-02) ───────────────────────────────────────────
// Both voice routes require a signed-in session by DEFAULT (lib/voice-auth.ts).
// A 200 here means anonymous, billed access is live in production.
section("2. AI spend protection — R-02");
{
  const cases = [
    ["POST /api/realtime/session", "/api/realtime/session", { voice: "cedar" }],
    ["POST /api/voice/brain", "/api/voice/brain", { messages: [{ role: "user", content: "verify-prod probe" }] }],
  ];
  for (const [label, path, body] of cases) {
    const r = await req("POST", at(path), {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      fail(label, `request failed: ${r.error}`);
      continue;
    }
    if (r.status === 401) {
      pass(label, `401 ${snippet(r.text, 60)}`);
    } else if (r.status === 200) {
      // Loudest possible: this response just spent real budget on an anonymous call.
      fail(label, `*** 200 OK — ANONYMOUS BILLED ACCESS IS LIVE ***`);
      note("treat as an incident: unset VOICE_ALLOW_ANON (or set VOICE_REQUIRE_AUTH=1) and redeploy now");
      note("a 200 from /api/realtime/session means this probe just minted a real billed ek_ token");
    } else if (r.status === 429) {
      fail(label, `429 — the request passed the auth gate and was stopped only by the rate limiter`);
      note("anonymous callers are reaching the billed path; the gate is open (VOICE_ALLOW_ANON=1?)");
    } else if (r.status === 500 && /is not set/i.test(r.text)) {
      // The route checks its provider key BEFORE the auth gate, so this 500
      // proves nothing about the gate — the assertion is simply unverifiable.
      fail(label, `500 provider key unset — the auth gate was never reached, so it stays UNPROVEN`);
      note("set the provider key in the production env and re-run, or accept that this check cannot pass on this deploy");
    } else {
      fail(label, `${r.status} (expected 401) ${snippet(r.text, 60)}`);
    }
  }
}

// ── 3. KV limiter live (R-01) ───────────────────────────────────────────────
// /api/status reports the cache/limiter backend as `cacheBackend`, which is
// "kv" | "memory" (lib/market-data/cache.ts:28). "memory" means the two-tier
// rate limits are per-instance, i.e. multiplied by the running instance count.
section("3. KV limiter live — R-01");
{
  const label = "GET /api/status cacheBackend";
  const r = await req("GET", at("/api/status"));
  if (!r.ok) {
    fail(label, `request failed: ${r.error}`);
  } else if (r.status !== 200) {
    fail(label, `${r.status} (expected 200) ${snippet(r.text, 60)}`);
  } else {
    let body = null;
    try {
      body = JSON.parse(r.text);
    } catch {
      /* handled below */
    }
    const backend = body?.cacheBackend;
    if (backend === "kv") pass(label, `cacheBackend="kv" — limits are fleet-wide`);
    else if (backend === "memory") fail(label, `cacheBackend="memory" — KV env is UNSET; limits are per-instance and there is no cross-cold-start stale-serve`);
    else fail(label, `cacheBackend=${JSON.stringify(backend) ?? "absent"} — field missing or unexpected in ${snippet(r.text, 60)}`);
  }
}

// ── 4. security headers (R-03) ──────────────────────────────────────────────
section("4. security headers — R-03");
{
  const SAFE_REFERRER = new Set(["strict-origin-when-cross-origin", "strict-origin", "same-origin", "no-referrer"]);
  const expectations = [
    {
      name: "Strict-Transport-Security",
      // Below ~180d browsers treat the pin as good as absent; config ships 2y.
      test: (v) => Number(/max-age=(\d+)/i.exec(v)?.[1] ?? 0) >= 15_552_000,
      want: "max-age >= 15552000",
    },
    { name: "X-Content-Type-Options", test: (v) => v.trim().toLowerCase() === "nosniff", want: "nosniff" },
    { name: "Referrer-Policy", test: (v) => SAFE_REFERRER.has(v.trim().toLowerCase()), want: "strict-origin-when-cross-origin or stricter" },
    // DENY app-wide; only /cinema/* relaxes to SAMEORIGIN, and "/" is not that.
    { name: "X-Frame-Options", test: (v) => v.trim().toUpperCase() === "DENY", want: "DENY" },
    // microphone=(self) is intended (the voice agent); camera/geolocation are used nowhere.
    { name: "Permissions-Policy", test: (v) => /camera=\(\)/.test(v) && /geolocation=\(\)/.test(v), want: "camera=(), geolocation=()" },
  ];
  const r = await req("GET", at("/"));
  if (!r.ok) {
    fail("GET / for header inspection", `request failed: ${r.error}`);
  } else {
    for (const { name, test, want } of expectations) {
      const v = r.headers.get(name);
      if (v == null) fail(name, `ABSENT (want ${want})`);
      else if (!test(v)) fail(name, `"${v}" (want ${want})`);
      else pass(name, `"${v}"`);
    }
    const enforced = r.headers.get("content-security-policy");
    const reportOnly = r.headers.get("content-security-policy-report-only");
    if (enforced) pass("Content-Security-Policy", `mode=ENFORCED (${enforced.length} bytes)`);
    else if (reportOnly) {
      pass("Content-Security-Policy", `mode=REPORT-ONLY (${reportOnly.length} bytes)`);
      note("report-only is the shipped state; browsers ignore frame-ancestors in this mode, so X-Frame-Options above carries clickjacking defense");
    } else fail("Content-Security-Policy", "ABSENT in both enforced and report-only form");
  }
}

// ── 5. CSP reports arrive (R-03) ────────────────────────────────────────────
// The collector must accept a report with 204 and never error-loop a reporter.
section("5. CSP report collector — R-03");
{
  const label = "POST /api/csp-report (synthetic)";
  const report = {
    "csp-report": {
      "document-uri": `${BASE}/__verify-prod-synthetic__`,
      referrer: "",
      "violated-directive": "script-src",
      "effective-directive": "script-src",
      "original-policy": "default-src 'self'; report-uri /api/csp-report",
      disposition: "report",
      "blocked-uri": "https://verify-prod.invalid/synthetic.js",
      "status-code": 200,
    },
  };
  const r = await req("POST", at("/api/csp-report"), {
    headers: { "content-type": "application/csp-report" },
    body: JSON.stringify(report),
  });
  if (!r.ok) fail(label, `request failed: ${r.error}`);
  else if (r.status === 204) pass(label, "204 accepted");
  else fail(label, `${r.status} (expected 204) ${snippet(r.text, 60)}`);
  note('MANUAL: acceptance != delivery. Confirm the line `csp-report: script-src blocked https://verify-prod.invalid/synthetic.js`');
  note("        actually appears in the production log viewer — no HTTP response can prove that from out here.");
}

// ── 6. secret exposure (§6b key custody) ────────────────────────────────────
// Fetch / and the JS it references, then prefix-scan for credentials. Any hit
// is a hard FAIL: a key in a client bundle is public the moment it ships.
section("6. secret exposure in shipped assets — §6b");
{
  const home = await req("GET", at("/"));
  // The precondition is asserted, not assumed. A PASS here certifies "no
  // credential ships to browsers", and that claim is only worth something if the
  // scan actually read the shipped bytes. `req()` resolves for ANY status, so a
  // 500 error page (a missing env var at render time) carries no <script> tags
  // and would otherwise scan clean — the exact false PASS this check exists to
  // prevent. Non-200 is therefore a FAIL, not an empty scan.
  if (!home.ok) {
    fail("GET / for asset scan", `request failed: ${home.error}`);
  } else if (home.status !== 200) {
    fail("GET / for asset scan", `${home.status} (expected 200) — no shipped assets to scan, so the scan proves nothing`);
  } else {
    const urls = new Set();
    for (const m of home.text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) urls.add(m[1]);
    for (const m of home.text.matchAll(/<link[^>]+href=["']([^"']+\.js)["']/gi)) urls.add(m[1]);
    // Next's inline flight payload names chunks that appear in no src attribute.
    for (const m of home.text.matchAll(/\/_next\/static\/[A-Za-z0-9._/-]+\.js/g)) urls.add(m[0]);

    const bundles = [...urls]
      .map((u) => {
        try {
          return new URL(u, BASE).href;
        } catch {
          return null;
        }
      })
      .filter((u) => u && u.startsWith(BASE))
      .slice(0, MAX_BUNDLES);

    const scanned = [{ name: "/ (html)", text: home.text }];
    let unreachable = 0;
    for (const u of bundles) {
      const b = await req("GET", u);
      if (b.ok && b.status === 200) scanned.push({ name: u.slice(BASE.length), text: b.text });
      else unreachable++;
    }

    const hits = [];
    for (const { name, text } of scanned) {
      for (const [patName, re] of SECRET_PATTERNS) {
        for (const m of text.matchAll(re)) hits.push({ name, patName, hit: m[0] });
      }
    }
    const bytes = scanned.reduce((n, s) => n + s.text.length, 0);
    const label = "no credentials in html + js bundles";
    if (hits.length) {
      fail(label, `${hits.length} hit(s) across ${scanned.length} asset(s)`);
      for (const h of hits.slice(0, 12)) note(`${h.patName} → ${mask(h.hit)} in ${h.name}`);
      if (hits.length > 12) note(`… and ${hits.length - 12} more`);
    } else if (scanned.length === 1) {
      // Only the HTML was read: every referenced chunk failed (a WAF answering
      // 403 to the undici UA does this), or the page referenced none at all. An
      // inlined key lands in the JS, so a clean HTML page is not evidence —
      // fail rather than certify an unread bundle.
      fail(label, `no JS bundle could be fetched (${bundles.length} referenced, ${unreachable} unreachable) — the scan proves nothing`);
      note("the HTML alone scanned clean, but a build-time inline lands in the chunks, which were never read");
    } else {
      pass(label, `clean — ${scanned.length} asset(s), ${(bytes / 1024).toFixed(0)} KB, ${SECRET_PATTERNS.length} patterns`);
    }
    if (urls.size > MAX_BUNDLES) note(`scanned the first ${MAX_BUNDLES} of ${urls.size} referenced scripts (cap keeps CI fast)`);
    // Partial coverage stays a note — one 404 chunk should not gate a deploy.
    // Total failure is the FAIL above, which already reports this count.
    if (unreachable && scanned.length > 1) note(`${unreachable} referenced script(s) could not be fetched and were NOT scanned`);
  }
}

// ── 7. public data leak (R-13) ──────────────────────────────────────────────
// The observability endpoints are anonymous by design; they must still not hand
// out a connection string, credentials, or internal hostnames.
section("7. public data leak — R-13");
for (const path of ["/api/health", "/api/status"]) {
  const label = `GET ${path} leaks nothing`;
  const r = await req("GET", at(path));
  if (!r.ok) {
    fail(label, `request failed: ${r.error}`);
    continue;
  }
  const hits = [];
  for (const [patName, re] of [...LEAK_PATTERNS, ...SECRET_PATTERNS]) {
    for (const m of r.text.matchAll(re)) hits.push({ patName, hit: m[0] });
  }
  if (hits.length) {
    fail(label, `${r.status} — ${hits.length} hit(s)`);
    for (const h of hits.slice(0, 8)) note(`${h.patName} → ${mask(h.hit)}`);
  } else {
    pass(label, `${r.status} — clean over ${r.text.length} bytes`);
  }
}

// ── manual checks ───────────────────────────────────────────────────────────
// Stated in full every run: an operator who never sees this list will assume a
// green script means "everything verified", which is exactly the wrong belief.
section("MANUAL CHECKS — a script cannot verify these from outside");
console.log(`
  [ ] Atlas connection count stays FLAT under load.
      Atlas → Metrics → Connections, watched during a traffic burst. A climbing
      line means the serverless client singleton is not being reused.

  [ ] CSP violation reports actually LAND IN LOGS.
      Check 5 above only proves the collector answered 204. Open the production
      log viewer and find the "csp-report: …" warn line from this run's synthetic
      report. No reports at all after a week of real traffic is the signal that
      the CSP can be promoted from Report-Only to enforced.

  [ ] Provider billing alerts are configured.
      Hard budget caps + email alerts on OpenAI and OpenRouter (R-02 follow-up).
      The auth gate limits WHO can spend; only a billing cap limits HOW MUCH.

  [ ] Production env var inventory matches .env.example.
      Confirm in the hosting dashboard: MONGODB_URI, AUTH_SECRET, AUTH_GOOGLE_ID,
      AUTH_GOOGLE_SECRET, ADMIN_EMAILS, KV_REST_API_URL/TOKEN, and the provider
      keys. Confirm VOICE_ALLOW_ANON is UNSET (or VOICE_REQUIRE_AUTH=1), and that
      no secret is defined with a NEXT_PUBLIC_ prefix — that ships it to browsers.
`);

// ── verdict ─────────────────────────────────────────────────────────────────
console.log(`${passed} passed · ${failed} failed`);
if (failed) {
  console.error("\nverify-prod: FAILED");
  process.exit(1);
}
console.log("\nverify-prod: passed");

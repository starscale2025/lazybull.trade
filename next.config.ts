import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// ── Security headers (threat model R-03) ─────────────────────────────────────
//
// The PAGE Content-Security-Policy is NOT here — it lives in proxy.ts, which
// mints a fresh nonce per request and carries the client-side external-origin
// inventory. This file owns two things the proxy deliberately never sees:
//   1. the five non-CSP headers, on every response including /api and static
//      assets (they cannot break rendering, so they are enforced, not reported);
//   2. the CSP for /cinema/**, which the proxy skips because a file served off
//      disk cannot receive a per-request nonce.
// The two CSP sources must stay on DISJOINT paths. Both write into the same
// response-header bag and which one wins for a shared key depends on the
// server: the local Node router applies config headers first and lets
// middleware overwrite them, while `minimalMode` (the serverless deploy) skips
// config headers there entirely and leaves the merge to the platform. Anything
// that overlaps therefore silently un-nonces pages on one of the two.
// Non-page paths the proxy skips (/api/**, /_next/**, /models/*.onnx,
// /ort/*.wasm, /media/*.webm) ship no CSP at all: none of them is a document,
// and nosniff plus their JSON/binary content types carry that weight.
//
// PROMOTION PATH — what is true today, 2026-08-18:
//   • script-src no longer carries 'unsafe-inline' or any CDN host. It is
//     'nonce-<per-request>' + 'strict-dynamic'. 'unsafe-eval' stays site-wide
//     because CSP is per-document and soft navigation never re-issues the
//     header, so scoping it to the two new Function() routes (/quant, /trade)
//     would break them without restricting anything — see proxy.ts.
//   • style-src still carries 'unsafe-inline' by design — Next injects inline
//     styles with no nonce, and that is a far weaker sink.
//   • Violations POST to /api/csp-report (one warn line per report in server
//     logs — no need to sit in end users' consoles).
//   • REMAINING BLOCKER, and it is not a one-word change: 48 routes are
//     statically prerendered (`.next/prerender-manifest.json`), and a
//     prerendered document is served verbatim — its inline `self.__next_f`
//     bootstrap and its <script src> chunk tags carry no nonce, because there
//     was no request to mint one at build time. Under 'strict-dynamic' those
//     tags would be blocked, so enforcing today would white-screen every
//     prerendered page. Enforcing requires opting the page routes into dynamic
//     rendering first (and paying for it), or dropping the nonce again.
//     VERIFIED against a production build (next build && next start,
//     2026-08-18), so the next reader need not redo it: the response header
//     carries a fresh nonce per request, and `grep '<script[^>]*nonce='` over
//     the served HTML of / and /pro matches ZERO of their 16 and 15 script
//     tags. The build emits 48 prerendered routes and no dynamically-rendered
//     page at all, so the nonce currently applies to nothing. A real browser
//     logs "Executing inline script violates ... 'strict-dynamic'" on first
//     paint. Report-Only is therefore the deliberate resting state (owner
//     decision, 2026-08-18): collect the real violation profile from
//     production before choosing between going dynamic and dropping the nonce.
//   • Until then X-Frame-Options carries the clickjacking defense — browsers
//     ignore frame-ancestors in report-only mode.

// public/cinema/scene.html is a STATIC file with one inline <script> (framed
// same-origin by ScrollCinema), so it can never take a nonce. Allow-list that
// one script by hash, computed from the file itself at build time so the hash
// cannot drift out of sync with the source. If the read or the match ever
// fails, fall back to 'unsafe-inline' for that path only — a broken intro is
// worse than a weak policy on one self-contained page.
const cinemaScript = (() => {
  try {
    const html = readFileSync(join(process.cwd(), "public", "cinema", "scene.html"), "utf8");
    const inline = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!inline) return "'unsafe-inline'";
    return `'sha256-${createHash("sha256").update(inline[1], "utf8").digest("base64")}'`;
  } catch {
    return "'unsafe-inline'";
  }
})();

// scene.html loads nothing: no <script src>, no <link>, no fetch, no worker.
// Only the inline script and the inline <style> need an allowance.
const cinemaCsp = [
  "default-src 'self'",
  `script-src ${cinemaScript}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = (frameOptions: "DENY" | "SAMEORIGIN") => [
  // Two years; add `preload` only after committing to the HSTS preload list.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: frameOptions },
  // The voice agent needs the mic (lib/pro/voice/useVoiceAgent.ts); camera and
  // geolocation are used nowhere.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

// ── Static asset caching ─────────────────────────────────────────────────────
//
// Every file under /public shipped `Cache-Control: public, max-age=0`. That is
// Next's default and it is deliberate — it cannot know which of your files
// change — but it means a returning visitor re-validates all 13 MB of
// /ort/ort-wasm-simd-threaded.wasm, both GLBs and every cinema plate on every
// single navigation. Nothing below sets a security key, so none of it can
// weaken the two entries above.
//
// This works because `send` (the static server Next bundles) writes its own
// Cache-Control only `if (!res.getHeader("Cache-Control"))` — a value set here
// is already on the response by then, so it wins instead of racing.
//
// One question decides the value: CAN THE BYTES AT A FIXED URL CHANGE? For
// almost everything here git says yes, so `immutable` — which tells a browser
// never to ask again, for a year, with no way to take it back — is wrong for
// almost everything here. Only the .onnx fetch carries a version in its URL.
const cacheControl = (source: string, value: string, has?: { type: "query"; key: string }[]) => ({
  source,
  ...(has ? { has } : {}),
  headers: [{ key: "Cache-Control", value }],
});

// Anything re-baked in place under a name that never moves. `git log
// --diff-filter=M` counts the edits: cinema/shots/hero.webp 10, every other
// plate 9, bull-crystal.glb and bull-obsidian.glb 2 each,
// media/quant/machine-hero and media/loops/machine-loop 2 each. Pin any of
// those for a year and the next re-bake reaches nobody who has already
// visited, and there is no filename to bump to force them off it. An hour
// instead: the refetch-per-navigation stops, and a stale plate corrects
// itself within the hour rather than never.
const REBAKEABLE = "public, max-age=3600, must-revalidate";

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders("DENY") },
      // /cinema/scene.html is framed same-origin by ScrollCinema; a blanket
      // DENY would blank the intro. For a duplicate header key the LAST
      // matching entry wins, so only /cinema/** relaxes to SAMEORIGIN.
      {
        source: "/cinema/:path*",
        headers: [
          ...securityHeaders("SAMEORIGIN"),
          { key: "Content-Security-Policy-Report-Only", value: cinemaCsp },
        ],
      },

      // The re-bakeable art: the GLBs, the marketing stills and webm loops,
      // and the cinema plates. Directory-wide on purpose — /cinema and /media
      // gain files faster than this list would be updated, and an hour is the
      // right default for anything that lands in them.
      cacheControl("/models/:path*", REBAKEABLE),
      cacheControl("/media/:path*", REBAKEABLE),
      cacheControl("/cinema/:path*", REBAKEABLE),

      // Vendored third-party runtimes: 13 MB of ORT wasm and the Draco decoder
      // (lib/quant/onnx.ts:34, components/scrollstory/Bull3D.tsx:25). Never
      // edited in place so far, but both are verbatim copies of a pinned
      // package — onnx.ts:28 says to re-copy the wasm "whenever the pinned
      // onnxruntime-web version in package.json moves", under the same name.
      // A year-long pin would leave a browser running last year's wasm against
      // this year's inlined Emscripten glue, which fails as a decode error
      // nobody can reproduce. A day is enough to stop the per-navigation
      // refetch; the check that follows is a 304 carrying no body.
      cacheControl("/ort/:path*", "public, max-age=86400, must-revalidate"),
      cacheControl("/draco/:path*", "public, max-age=86400, must-revalidate"),

      // The one genuinely versioned URL in /public. lib/quant/onnx.ts:86
      // fetches `/models/<name>.onnx?v=${MODEL_VER}` and :35 bumps MODEL_VER
      // on re-export, so the URL changes whenever the bytes do — which is the
      // whole precondition for `immutable`. The `has` clause is load-bearing:
      // it keeps the year off a bare /models/x.onnx, which carries no version
      // and would otherwise inherit a promise the filename cannot keep.
      cacheControl("/models/:file.onnx", "public, max-age=31536000, immutable", [
        { type: "query", key: "v" },
      ]),

      // Last, so it wins over the /cinema rule above: scene.html is a DOCUMENT,
      // and the one whose inline <script> is allow-listed by the SHA-256 that
      // cinemaScript computes from this file at build time. Cache it and a
      // browser can hold a copy from before a deploy while the server sends the
      // hash of the copy after — the script no longer matches its own
      // allowance and CSP blocks the intro. `no-cache` still stores it and
      // still gets a 304; it just never serves it without asking first.
      cacheControl("/cinema/scene.html", "no-cache"),
    ];
  },
};

export default nextConfig;

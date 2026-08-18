// Two unrelated jobs live here because Next allows exactly ONE proxy module.
// They are scoped differently on purpose — see the matcher at the bottom.
// Keep this file free of lib/auth and mongodb imports; pulling either in
// breaks the proxy build.

import { NextResponse, type NextRequest } from "next/server";

// ═══ 1. Per-request CSP nonce (threat model R-03) ════════════════════════════
//
// The page CSP is built HERE, not in next.config.ts, because a nonce has to be
// minted per request. Next reads it back out of the request header below
// (server/app-render: `content-security-policy` || `...-report-only`) and
// stamps it on the bootstrap + chunk <script> tags it emits, which is what
// lets 'unsafe-inline' leave script-src.
//
// CLIENT-SIDE EXTERNAL-ORIGIN INVENTORY (grepped app/ lib/ components/ —
// server-only fetches in app/api/** and lib/market-data/** never hit the
// browser, so they need no CSP allowance):
//   • https://api.openai.com          — WebRTC SDP offer POST for the voice
//     agent (lib/pro/voice/useVoiceAgent.ts:447). The audio itself flows over
//     DTLS/SRTP, which CSP does not govern; only this HTTPS signalling call
//     needs connect-src.
//   • https://*.googleusercontent.com — Google OAuth avatar rendered by
//     components/AuthButtons.tsx:64. Google is the only auth provider
//     (lib/auth.ts), and its avatar host varies across lh* subdomains.
//   • NEXT_PUBLIC_QUANTAI_URL (optional) — the FastAPI quant service is
//     fetched from the browser when configured (lib/quant/ai-bots.ts:24);
//     its origin joins connect-src when the var is set. Unset in production
//     today → no allowance emitted.
// There is no CDN entry any more: onnxruntime-web is self-hosted from
// /ort/ (lib/quant/onnx.ts), which is what closed R-09.
// SPECIAL RESOURCES, all same-origin:
//   • WASM — onnxruntime-web inference plus the three.js DRACO decoder
//     (components/scrollstory/Bull3D.tsx:25 loads /draco/) → 'wasm-unsafe-eval'.
//   • Workers — DRACOLoader spawns workers from Blob URLs → worker-src blob:.
//   • Same-origin iframe — ScrollCinema embeds /cinema/scene.html
//     (components/scrollstory/ScrollCinema.tsx:723) → frame-src 'self'. That
//     file is static and gets its own policy from next.config.ts.
//   • Covered by 'self': /api/* fetches, the EventSource on
//     /api/stream/quotes, /models/*.onnx, /ort/*.wasm, /media/*.webm,
//     GLB/scene assets, and next/font (self-hosted at build time).

const CSP_HEADER = "Content-Security-Policy-Report-Only";

// NEXT_PUBLIC_ values are inlined at build time, in the edge bundle too.
const quantAiOrigin = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_QUANTAI_URL;
    return u ? new URL(u).origin : "";
  } catch {
    return "";
  }
})();

// 'unsafe-eval' is SITE-WIDE, and cannot honestly be anything else. Only two
// routes reach a deliberate new Function() sink — /quant →
// components/quant/ImportBotModal → lib/quant/runtime.ts:26 (custom bots) and
// /trade → components/wedge/ModelSpread → lib/models.ts:182 (the BYO
// probability model) — but CSP is a per-DOCUMENT header and this is an SPA:
// both routes are reached predominantly by next/link soft navigation
// (components/Nav.tsx, components/AuthButtons.tsx, app/portfolio/page.tsx),
// which creates no new document, so the ORIGIN route's policy keeps governing
// and the sinks would throw; and navigating AWAY from them carries the
// allowance onto the next route regardless. Scoping by pathname therefore
// restricts nothing in a real session while killing bot import once the policy
// is enforced. Dropping 'unsafe-eval' means removing the two sinks, not
// narrowing the header. `next dev --webpack` compiles every hot update with
// eval() too, so dev needs it either way.

/** 128 bits from the platform CSPRNG, base64 — never Math.random. */
function mintNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function csp(nonce: string): string {
  // 'strict-dynamic' drops 'self' for CSP3 browsers and lets Next's own
  // (nonce'd) chunk loader vouch for the chunks it injects; 'self' stays for
  // CSP2-only agents.
  const script = ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'", "'unsafe-eval'"];

  return [
    "default-src 'self'",
    script.join(" "),
    // style-src KEEPS 'unsafe-inline': Next and styled-jsx inject inline
    // <style> with no nonce, and an injected stylesheet is a far weaker sink
    // than an injected script. Standard practice, accepted trade-off.
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://api.openai.com" + (quantAiOrigin ? " " + quantAiOrigin : ""),
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "font-src 'self' data:",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
  ].join("; ");
}

// ═══ 2. /admin fast-path bounce — NOT the security boundary ══════════════════
//
// Sessions are database-backed (Mongo adapter), and this file can't reach
// Mongo, so it validates nothing: a forged cookie sails straight through.
// All it does is spare obviously-anonymous requests (no Auth.js session
// cookie at all) a server render before the real gates — the `auth()` +
// `isAdmin()` checks in app/admin/layout.tsx and app/admin/page.tsx —
// bounce them anyway.

// Auth.js v5 session cookie names (plain + HTTPS __Secure- prefix).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// The matcher below is wide because the nonce has to reach every page, so the
// bounce carries its own test. This matches exactly what "/admin/:path*" did:
// /admin, /admin/, and anything beneath — and nothing else.
const ADMIN = /^\/admin(?:\/|$)/;

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ADMIN.test(pathname) && !SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    const signin = new URL("/auth/signin", request.url);
    signin.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signin);
  }

  const nonce = mintNonce();
  const policy = csp(nonce);
  // Set on the REQUEST so Next can nonce its own script tags, and on the
  // response so the browser enforces (today: reports) the same policy.
  const headers = new Headers(request.headers);
  headers.set(CSP_HEADER, policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(CSP_HEADER, policy);
  return response;
}

export const config = {
  matcher: [
    // Every page route. Excluded — none of them carry Next's inline bootstrap,
    // and a file served off disk can never take a per-request nonce:
    //   api/     — JSON responses; also keeps the proxy off the hot data paths
    //   _next/   — build output and the dev HMR endpoint
    //   any path with a dot — /cinema/scene.html, /models/*.onnx, /ort/*.wasm,
    //     /media/*.webm, /favicon.ico … next.config.ts hands /cinema/** its own
    //     hash-based policy; the rest are not documents and ship none.
    "/((?!api/|_next/|.*\\.).*)",
    // Kept verbatim so the /admin bounce cannot lose coverage the day someone
    // edits the pattern above (a path like /admin/x.y has a dot).
    "/admin/:path*",
  ],
};

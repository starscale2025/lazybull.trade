import { NextResponse } from "next/server";
import { clientIp, underLimit } from "@/lib/rate-limit";
import { requireVoiceAuth } from "@/lib/voice-auth";
import { SITE_URL } from "@/lib/site";

// Server-side proxy to OpenRouter for the FREE voice engine's "brain".
// Keeps OPENROUTER_API_KEY off the client. Takes an OpenAI-style `messages`
// array, asks a free model for our strict-JSON reply, returns the raw content
// string for the client to parse (see brainProtocol.parseBrainReply).
//
// WHAT LEAVES THIS SERVER (R-10; the user-facing disclosure is clause 05 of
// app/privacy/page.tsx — keep the two in sync). Only the relayed `messages`:
// the persona system prompt, the live market snapshot, the workspace state
// (symbol, indicators, alerts including the user's own notes, paper blotter,
// watchlist) and the last <=12 conversation turns, which on the voice path are
// the user's transcribed utterances. Nothing identifies the account: the
// session is checked here and never forwarded, the two attribution headers
// below are app-level constants, and `relay` (further down) strips every field
// except role/content. Free (`:free`) models are only served to accounts that
// allow prompt logging — see the data-policy branch below — so treat every
// byte above as retained by the provider and usable for training.

export const runtime = "nodejs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free models tried in order — OpenRouter falls through when one errors/limits.
// Order is based on live testing: nemotron reliably returns parseable JSON
// content; the popular llama/gemma/qwen free pools are frequently 429'd but are
// good when available. NOTE: openai/gpt-oss-*:free are REASONING models that
// often return `content: null` (everything goes to `reasoning`), so they're last
// resort only. Override with OPENROUTER_MODEL. Re-check ids at:
//   https://openrouter.ai/api/v1/models   (filter ids ending in ":free")
// NOTE: OpenRouter rejects a `models` array with more than 3 entries
// ("'models' array must have 3 items or fewer"), so each list is capped at 3.
const MAX_FALLBACKS = 3;
const DEFAULT_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];
// Used only if the first attempt returns 200 with empty content.
// Other decent free options if these dry up: google/gemma-4-31b-it:free,
// google/gemma-4-26b-a4b-it:free, nvidia/nemotron-3-nano-30b-a3b:free.
const RETRY_MODELS = [
  "google/gemma-4-31b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

// Reasoning models burn completion tokens before emitting content, and some put
// the answer ONLY in `message.reasoning`. Dig it out rather than going silent.
// Also scrubs `<unk>`-style tokenizer garbage some free models emit.
function extractContent(data: unknown): string {
  const msg = (data as { choices?: Array<{ message?: { content?: unknown; reasoning?: unknown } }> })?.choices?.[0]?.message ?? {};
  const scrub = (s: string) => s.replace(/<unk>/g, "").replace(/<\|[^|>]*\|>/g, "").trim();
  const direct = typeof msg.content === "string" ? scrub(msg.content) : "";
  const jsonIn = (s: string) => {
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    return a !== -1 && b > a ? s.slice(a, b + 1) : "";
  };
  // prefer a JSON object wherever it lives: content first, then the reasoning trace
  if (direct && jsonIn(direct)) return direct;
  if (typeof msg.reasoning === "string") {
    const fromReasoning = jsonIn(scrub(msg.reasoning));
    if (fromReasoning) return fromReasoning;
  }
  return direct;
}

// Free models degenerate often (empty, pure reasoning, <unk> spam). Only accept
// a reply we can actually turn into speech; otherwise we retry on another pool.
function usableReply(content: string): boolean {
  if (!content) return false;
  const a = content.indexOf("{");
  const b = content.lastIndexOf("}");
  if (a === -1 || b <= a) return false;
  try {
    const o = JSON.parse(content.slice(a, b + 1)) as { speech?: unknown };
    return typeof o.speech === "string" && o.speech.trim().length > 0;
  } catch {
    return /"speech"\s*:\s*"[^"]/.test(content); // near-JSON the client can still recover
  }
}

// ── rate limit (per-IP + global, per minute) — see lib/rate-limit.ts ───────
// KV-backed (fleet-wide) when configured, per-instance in-memory otherwise.
const MAX_PER_IP = 20;   // OpenRouter free tier is ~20 req/min anyway
const MAX_GLOBAL = 120;

export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set. Add it to .env.local to enable the free voice co-pilot." },
      { status: 500 },
    );
  }

  // Members-only by default — this relay accepts client-supplied system-role
  // messages under the app's OpenRouter identity (R-02). VOICE_ALLOW_ANON=1
  // opts a deployment into anonymous access; see lib/voice-auth.ts.
  const denied = await requireVoiceAuth();
  if (denied) return denied;

  const ip = clientIp(req.headers);
  if (!(await underLimit("brain", ip, MAX_PER_IP, MAX_GLOBAL))) {
    return NextResponse.json({ error: "slow down a moment — too many voice turns" }, { status: 429 });
  }

  let messages: unknown;
  try {
    ({ messages } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  // Bound the payload — the client only ever sends system + snapshot + <=12 history.
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return NextResponse.json({ error: "messages must be an array of 1-30 items" }, { status: 400 });
  }
  const roleOk = (r: unknown) => r === "system" || r === "user" || r === "assistant";
  const wellFormed = messages.every(
    (m): m is { role: string; content: string } =>
      !!m && typeof m === "object" && roleOk((m as { role?: unknown }).role) && typeof (m as { content?: unknown }).content === "string",
  );
  if (!wellFormed) return NextResponse.json({ error: "each message needs a valid role and string content" }, { status: 400 });
  if (JSON.stringify(messages).length > 24_000) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  // Relay ONLY role+content (R-10). The check above proves those two fields but
  // says nothing about the rest of the object: an OpenAI-style `name`, or any
  // identifier a future — or tampered — client bolts on, would otherwise be
  // forwarded verbatim to a provider that retains prompts. Rebuilding each
  // message makes that structurally impossible rather than a client-side
  // promise. Our own client already sends exactly these two fields
  // (lib/pro/voice/useFreeVoiceAgent.ts:259-266), so nothing is lost.
  const relay = (messages as { role: string; content: string }[]).map(({ role, content }) => ({ role, content }));

  // Operator switch — also the privacy lever. Free variants are the reason R-10
  // exists; pinning OPENROUTER_MODEL to a PAID model (no `:free` suffix), or to
  // a provider endpoint with zero data retention, is the actual fix, not a
  // wording change. Anything set here must match what clause 05 of
  // app/privacy/page.tsx tells users.
  const models = process.env.OPENROUTER_MODEL ? [process.env.OPENROUTER_MODEL] : DEFAULT_MODELS;

  const ask = (modelList: string[]) =>
    fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // App-level attribution only — these show up on OpenRouter's public app
        // rankings, so they must stay constants. Never put a user id, email or
        // session value here, and don't add OpenRouter's optional `user` field
        // to the body either: it would key the provider's retained prompts to a
        // person (R-10).
        // SITE_URL, not a literal: the hardcoded host here was
        // https://lazybull.trade, which resolves NXDOMAIN, so the attribution
        // pointed at nothing. Still a build-time constant, so the rule above
        // (never a user id, email or session value) holds.
        "HTTP-Referer": SITE_URL,
        "X-Title": "LazyBull Voice Co-pilot",
      },
      body: JSON.stringify({
        models: modelList.slice(0, MAX_FALLBACKS), // hard cap — OpenRouter 400s above 3
        messages: relay,
        temperature: 0.4,
        // Generous budget: reasoning models spend hundreds of tokens thinking
        // before they emit the JSON, and a truncated reply is a silent agent.
        max_tokens: 800,
        // No response_format — free models' JSON-mode support is spotty; we rely
        // on the prompt-engineered contract + defensive client parsing instead.
      }),
    });

  try {
    const r = await ask(models);

    const data = await r.json();
    if (!r.ok) {
      // Map the two catches that bite free-tier users, generic-log the rest.
      const msg = data?.error?.message || "";
      if (r.status === 404 && /data policy|no endpoints/i.test(msg)) {
        console.error("openrouter data-policy 404:", msg);
        return NextResponse.json(
          { error: "OpenRouter blocked this by data policy — enable prompt logging at openrouter.ai/settings/privacy to use free models." },
          { status: 424 },
        );
      }
      if (r.status === 402) {
        return NextResponse.json({ error: "OpenRouter balance issue — top up (or clear a negative balance) at openrouter.ai/credits." }, { status: 402 });
      }
      if (r.status === 429) {
        return NextResponse.json({ error: "OpenRouter rate limit hit — free tier is ~20/min & 50/day ($0). Add $10 once to raise it." }, { status: 429 });
      }
      console.error("openrouter error:", r.status, data);
      return NextResponse.json({ error: "voice brain unavailable — check server logs" }, { status: 502 });
    }

    let content = extractContent(data);
    let model = data?.model;

    // A 200 that's empty / pure-reasoning / degenerate would leave the co-pilot
    // mute or make it apologise — retry once on a different free pool.
    if (!usableReply(content) && !process.env.OPENROUTER_MODEL) {
      console.warn("openrouter: unusable reply from", model, "— retrying on fallback models");
      try {
        const r2 = await ask(RETRY_MODELS);
        const d2 = await r2.json();
        if (r2.ok) {
          const c2 = extractContent(d2);
          if (usableReply(c2) || (!content && c2)) { content = c2; model = d2?.model; }
        }
      } catch { /* keep the first result and fall through */ }
    }

    if (!content) {
      return NextResponse.json({ error: "the free model returned nothing — try again in a moment" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, content, model });
  } catch (e) {
    console.error("openrouter fetch error:", e);
    return NextResponse.json({ error: "voice brain unavailable" }, { status: 502 });
  }
}

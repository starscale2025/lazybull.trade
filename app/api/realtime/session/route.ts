import { NextResponse } from "next/server";
import { clientIp, underLimit } from "@/lib/rate-limit";
import { requireVoiceAuth } from "@/lib/voice-auth";

// Mints a short-lived OpenAI Realtime client token (an `ek_...` ephemeral key)
// so the browser can open a WebRTC session WITHOUT ever seeing OPENAI_API_KEY.
// GA endpoint: POST /v1/realtime/client_secrets  → token is response.value.
//
// Persona instructions + tools are applied client-side via `session.update`
// (see useVoiceAgent.ts), so here we only pin the model, voice, and TTL.

export const runtime = "nodejs";

const REALTIME_MODEL = "gpt-realtime";
const ALLOWED_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar",
]);

// ── Rate limit (per-IP + global, per minute) ───────────────────────────────
// Each minted token can open a *billed* Realtime session, so throttle to blunt
// budget-drain abuse — the second tier behind the auth gate, and the only tier
// when the operator opens the endpoint with VOICE_ALLOW_ANON=1. Counters live
// in KV when configured (fleet-wide, survives cold starts) with a per-instance
// in-memory fallback — see lib/rate-limit.ts for the degradation policy.
const MAX_PER_IP = 6;
const MAX_GLOBAL = 60;

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local to enable the voice co-pilot." },
      { status: 500 },
    );
  }

  // Members-only by default — each token is 600s of billed Realtime whose
  // instructions/tools the client chooses (R-02). VOICE_ALLOW_ANON=1 opts a
  // deployment into anonymous access; see lib/voice-auth.ts for the semantics.
  const denied = await requireVoiceAuth();
  if (denied) return denied;

  const ip = clientIp(req.headers);
  if (!(await underLimit("realtime", ip, MAX_PER_IP, MAX_GLOBAL))) {
    return NextResponse.json({ error: "too many voice sessions — slow down a moment" }, { status: 429 });
  }

  let voice = "cedar";
  try {
    const body = await req.json();
    if (body?.voice && ALLOWED_VOICES.has(body.voice)) voice = body.voice;
  } catch {
    // no body / bad json → use default voice
  }

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          audio: { output: { voice } },
        },
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      // Log the upstream detail server-side; return a generic message so we don't
      // echo internal/quota/billing detail to arbitrary callers.
      console.error("realtime client_secrets failed:", r.status, data);
      return NextResponse.json({ error: "voice session unavailable — check the server logs" }, { status: 502 });
    }
    // data.value holds the ephemeral `ek_...` token the browser needs.
    return NextResponse.json(data);
  } catch (e) {
    console.error("realtime client_secrets error:", e);
    return NextResponse.json({ error: "voice session unavailable" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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

// ── Best-effort in-memory rate limit (per-IP + global) ─────────────────────
// Each minted token can open a *billed* Realtime session, so throttle to blunt
// budget-drain abuse of this unauthenticated endpoint. Note: module state is
// per-instance and resets on cold start — for hard limits across a fleet, back
// this with a shared store (Redis/Upstash). Good enough to stop a naive loop.
const WINDOW_MS = 60_000;
const MAX_PER_IP = 6;
const MAX_GLOBAL = 60;
const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

function underLimit(ip: string, now: number): boolean {
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  if (globalHits.length >= MAX_GLOBAL) return false;
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_IP) return false;
  arr.push(now);
  ipHits.set(ip, arr);
  globalHits.push(now);
  // opportunistic cleanup so the map doesn't grow unbounded
  if (ipHits.size > 5000) for (const [k, v] of ipHits) if (!v.some((t) => now - t < WINDOW_MS)) ipHits.delete(k);
  return true;
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local to enable the voice co-pilot." },
      { status: 500 },
    );
  }

  // Optional: require a signed-in user (flip on to make voice a members-only,
  // billed feature). Off by default so anonymous /pro visitors can try it.
  if (process.env.VOICE_REQUIRE_AUTH === "1") {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "sign in to use the voice co-pilot" }, { status: 401 });
    }
  }

  const now = Date.now();
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
  if (!underLimit(ip, now)) {
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

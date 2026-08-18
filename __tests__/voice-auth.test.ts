import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The voice endpoints spend real OpenAI/OpenRouter budget, so their default is
// members-only (threat model R-02). Covers the flag matrix in lib/voice-auth.ts
// and the wired-up 401 on both routes — auth must be checked BEFORE any
// upstream call is made.

const h = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));
vi.mock("@/lib/auth", () => ({ auth: async () => h.session }));

import { voiceAuthRequired, requireVoiceAuth } from "@/lib/voice-auth";
import { POST as mintRealtimeToken } from "@/app/api/realtime/session/route";
import { POST as voiceBrain } from "@/app/api/voice/brain/route";
import { __resetRateLimit } from "@/lib/rate-limit";

const FLAGS = ["VOICE_REQUIRE_AUTH", "VOICE_ALLOW_ANON"] as const;

beforeEach(() => {
  __resetRateLimit();
  h.session = null;
  for (const f of FLAGS) delete process.env[f];
  // let both routes get past their key-presence checks and reach the gate
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENROUTER_API_KEY = "sk-or-test";
});
afterEach(() => {
  for (const f of FLAGS) delete process.env[f];
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  vi.restoreAllMocks();
});

describe("voiceAuthRequired flag matrix", () => {
  it("defaults to required when neither flag is set", () => {
    expect(voiceAuthRequired()).toBe(true);
  });

  it("VOICE_ALLOW_ANON=1 opts into anonymous access", () => {
    process.env.VOICE_ALLOW_ANON = "1";
    expect(voiceAuthRequired()).toBe(false);
  });

  it("VOICE_REQUIRE_AUTH=1 still forces auth on", () => {
    process.env.VOICE_REQUIRE_AUTH = "1";
    expect(voiceAuthRequired()).toBe(true);
  });

  it("auth wins when both flags are set", () => {
    process.env.VOICE_ALLOW_ANON = "1";
    process.env.VOICE_REQUIRE_AUTH = "1";
    expect(voiceAuthRequired()).toBe(true);
  });

  it('only the exact value "1" opts out', () => {
    process.env.VOICE_ALLOW_ANON = "true";
    expect(voiceAuthRequired()).toBe(true);
  });
});

describe("requireVoiceAuth", () => {
  it("401s anonymous callers by default, with the shared message shape", async () => {
    const res = await requireVoiceAuth();
    expect(res?.status).toBe(401);
    expect(await res!.json()).toEqual({ error: "sign in to use the voice co-pilot" });
  });

  it("passes signed-in callers", async () => {
    h.session = { user: { id: "u1" } };
    expect(await requireVoiceAuth()).toBeNull();
  });

  it("passes anonymous callers only under the explicit opt-in", async () => {
    process.env.VOICE_ALLOW_ANON = "1";
    expect(await requireVoiceAuth()).toBeNull();
  });
});

describe("route wiring (default env, no session)", () => {
  const post = (body: unknown) =>
    new Request("http://x/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("/api/realtime/session 401s before any upstream call", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const res = await mintRealtimeToken(post({ voice: "cedar" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "sign in to use the voice co-pilot" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("/api/voice/brain 401s before any upstream call", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const res = await voiceBrain(post({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "sign in to use the voice co-pilot" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("a signed-in session still mints a token (back-compat)", async () => {
    h.session = { user: { id: "u1" } };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ value: "ek_test" }), { status: 200 }));
    const res = await mintRealtimeToken(post({ voice: "cedar" }));
    expect(res.status).toBe(200);
    expect((await res.json()).value).toBe("ek_test");
  });
});

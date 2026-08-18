import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Auth gate shared by the billed voice endpoints (/api/realtime/session,
// /api/voice/brain). Every accepted request there spends real OpenAI or
// OpenRouter budget, so access is members-only by DEFAULT (threat model R-02):
//   • flags unset           → auth required (secure default)
//   • VOICE_ALLOW_ANON=1    → anonymous callers allowed (explicit demo opt-in)
//   • VOICE_REQUIRE_AUTH=1  → auth required regardless — wins over ALLOW_ANON
// The flag logic lives ONLY here so the two routes cannot drift.

/** True when the voice endpoints must see a signed-in session. */
export function voiceAuthRequired(): boolean {
  if (process.env.VOICE_REQUIRE_AUTH === "1") return true; // forced on — beats ALLOW_ANON
  return process.env.VOICE_ALLOW_ANON !== "1";
}

/** The shared 401 to return, or null when the caller may proceed. */
export async function requireVoiceAuth(): Promise<NextResponse | null> {
  if (!voiceAuthRequired()) return null;
  const session = await auth();
  if (session?.user) return null;
  return NextResponse.json({ error: "sign in to use the voice co-pilot" }, { status: 401 });
}

// The four things every /api/practice route does before its own work: rate
// limit the IP, bound the body, read the device id, answer in JSON. SERVER-ONLY.
//
// Caps ride lib/rate-limit.ts (KV-backed when configured, per-instance
// otherwise) with the same two tiers the AI routes use: per-IP first, then a
// global backstop against IP rotation. Nothing here costs money upstream, so
// the caps are nuisance caps — generous for a person, tight for a script that
// tries to brute-force a hidden expectation through the comparison.

import { NextResponse } from "next/server";
import { clientIp, underLimit } from "@/lib/rate-limit";
import { DeviceHeader } from "@/lib/db/practice";
import { DEVICE_HEADER } from "@/lib/practice/types";

export { DEVICE_HEADER };

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

/** A 429 when the IP (or everyone) has spent this minute's budget, else null. */
export async function gate(req: Request, scope: string, perIp: number, global: number): Promise<NextResponse | null> {
  const ip = clientIp(req.headers);
  if (await underLimit(`practice-${scope}`, ip, perIp, global)) return null;
  return json({ ok: false, error: "rate limited — slow down a moment" }, 429);
}

/** The anonymous device id the browser sends (the localStorage uuid
    lib/track.ts also sends with events), validated, or undefined. */
export function deviceOf(headers: Headers): string | undefined {
  const raw = headers.get(DEVICE_HEADER);
  if (!raw) return undefined;
  const r = DeviceHeader.safeParse(raw);
  return r.success ? r.data : undefined;
}

/** Parses a JSON body under `maxChars`, or returns the 4xx to send. */
export async function readJson(req: Request, maxChars: number): Promise<{ body: unknown } | { response: NextResponse }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxChars) return { response: json({ ok: false, error: "payload too large" }, 413) };
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { response: json({ ok: false, error: "unreadable body" }, 400) };
  }
  if (text.length > maxChars) return { response: json({ ok: false, error: "payload too large" }, 413) };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { response: json({ ok: false, error: "bad json" }, 400) };
  }
}

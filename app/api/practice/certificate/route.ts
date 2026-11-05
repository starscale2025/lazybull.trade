// POST /api/practice/certificate { track, device? } — mints the track's
// certificate once the server has seen an accepted submit for EVERY problem
// in it, from this user or this device. Signed-in only: the certificate
// names the account, and the public page at /practice/certificate/<id>
// shows that name. Idempotent per (user, track): a second call returns the
// first row. 409 with the missing slugs when the track is not finished.

import { CertificateBody, acceptedSlugsFor, mintCertificate } from "@/lib/db/practice";
import { viewer } from "@/lib/practice/access";
import { gate, json, readJson } from "@/lib/practice/http";
import { problemsByTrack } from "@/lib/practice/problems";

export const dynamic = "force-dynamic";

const MAX_BODY = 500;

export async function POST(req: Request) {
  const limited = await gate(req, "certificate", 10, 300);
  if (limited) return limited;

  const v = await viewer();
  if (!v.userId) return json({ ok: false, error: "sign in to mint a certificate" }, 401);

  const read = await readJson(req, MAX_BODY);
  if ("response" in read) return read.response;
  const parsed = CertificateBody.safeParse(read.body);
  if (!parsed.success) return json({ ok: false, error: "invalid body" }, 400);
  const { track, device } = parsed.data;

  const slugs = problemsByTrack(track).map((p) => p.id);
  try {
    const accepted = await acceptedSlugsFor({ userId: v.userId, device }, slugs);
    const missing = slugs.filter((s) => !accepted.has(s));
    if (missing.length > 0) return json({ ok: false, error: "incomplete", missing }, 409);
    const { certificate, created } = await mintCertificate(v.userId, track, v.name ?? "Trader");
    return json({ ok: true, certificate, created });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "database unavailable" }, 503);
  }
}

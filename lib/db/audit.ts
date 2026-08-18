// Audit trail for privileged access — who reached the admin cockpit, when, and
// whether they were let in (threat model R-07).
//
// This module OBSERVES the admin gate; it must never become part of it. Two
// constraints follow, and both are structural rather than conventional:
//   • The caller never awaits it and it never throws. A slow or broken Mongo
//     has to be incapable of delaying, blocking or failing the gate that
//     emitted the record.
//   • It never carries credentials. Session email and Mongo user id only — no
//     session token, no cookie, no OAuth material.
//
// The insert is handed to Next's `after()` rather than left as a floating
// promise. Both are non-blocking, but a serverless instance can be frozen the
// moment the response is sent, so a bare promise would silently never land;
// `after()` keeps the invocation alive until the write finishes.
//
// TTL WARNING: auditLogs carries a 1-YEAR TTL on createdAt
// (`scripts/init-mongo.ts`), so records here self-delete after 365 days. That
// is right for access logs and WRONG for anything that must be kept — the
// immutable order audit of THREAT_MODEL §6a needs its own TTL-exempt
// collection, not this one.

import { ObjectId } from "mongodb";
import { after } from "next/server";
import { db } from "../mongo";

/** `granted` = on the allow-list; `denied-not-admin` = signed in, not on it. */
export type AdminAccessOutcome = "granted" | "denied-not-admin";

type AuditDoc = {
  type: "admin_access";
  outcome: AdminAccessOutcome;
  /** Session email — the identifier an operator can actually act on. */
  email: string | null;
  userId?: ObjectId;
  createdAt: Date;
};

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection<AuditDoc>("auditLogs");
  // Mirrors scripts/init-mongo.ts so the TTL exists even on a deploy where
  // that script was never run (the watchlists/R-18 precedent) — without it,
  // access records would be retained forever. expireAfterSeconds must match
  // the script exactly or createIndex conflicts with the existing index.
  indexReady ??= Promise.all([
    c.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }),
    c.createIndex({ userId: 1, createdAt: -1 }),
  ]).catch(() => {});
  await indexReady;
  return c;
}

/**
 * Record one admin-page access. Returns synchronously; every failure path —
 * scheduling, connecting, indexing, inserting — is swallowed, so the gate's
 * decision is never contingent on the audit succeeding.
 */
export function auditAdminAccess(
  outcome: AdminAccessOutcome,
  email: string | null | undefined,
  userId?: string | null,
): void {
  const doc: AuditDoc = {
    type: "admin_access",
    outcome,
    email: email ?? null,
    ...(userId && ObjectId.isValid(userId) ? { userId: new ObjectId(userId) } : {}),
    createdAt: new Date(),
  };
  try {
    after(async () => {
      try {
        await (await coll()).insertOne(doc);
      } catch {
        /* swallowed by design — see the header */
      }
    });
  } catch {
    // No request scope to defer to (unit tests, prerender). An audit gap is
    // strictly better than a gate that throws.
  }
}

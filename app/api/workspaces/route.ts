// /api/workspaces
//   GET   list mine
//   POST  create new — gated by the plan's workspace cap (PLAN_LIMITS) on top
//         of the hard per-user bound in lib/db/workspaces.ts.
//
// The 2026-09 diligence memo: "no entitlement checks anywhere". The free tier
// advertises one saved workspace on /pricing; this route is where that number
// is enforced, with the 402 body from lib/billing/gate.ts so the client that
// saved (app/pro, components/quant/SetupsBar) can render the upgrade nudge.
// The plan comes off the session (lib/auth.ts resolves it per request).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PAYWALL_STATUS, paywall } from "@/lib/billing/gate";
import { BILLING_EVENTS, PLAN_LIMITS, type Plan } from "@/lib/billing/types";
import { logServerEvent } from "@/lib/db/events";
import {
  listWorkspaces,
  createWorkspace,
  WorkspaceInput,
  WorkspaceLimitError,
  WorkspacePlanLimitError,
  MAX_WORKSPACE_BODY_BYTES,
} from "@/lib/db/workspaces";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as "pro" | "quant" | null;
  const items = await listWorkspaces(session.user.id, kind ?? undefined);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  // content-length is client-declared, so the actual text is re-checked
  // after read — the two together keep oversized docs out of Mongo.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_WORKSPACE_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_WORKSPACE_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const parsed = WorkspaceInput.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid body",
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 },
    );
  }

  const plan: Plan = session.user.plan ?? "free";
  try {
    const doc = await createWorkspace(session.user.id, parsed.data, {
      planLimit: PLAN_LIMITS[plan].workspaces,
    });
    return NextResponse.json({ ok: true, workspace: doc });
  } catch (err) {
    // The plan cap is the one 402 this route emits — the fixed paywall
    // contract, plus the product event the admin funnel reads.
    if (err instanceof WorkspacePlanLimitError) {
      await logServerEvent(BILLING_EVENTS.hitPaywall, session.user.id, { surface: "workspace", plan });
      return NextResponse.json(paywall("workspace_limit", plan, err.limit), { status: PAYWALL_STATUS });
    }
    // Only the hard per-user cap carries a message meant for the UI toast.
    // Anything else here is ours (Mongo down, BSON refusing a pathological
    // doc) — that is a 500 with a generic message, so internal detail never
    // reaches the client and monitoring doesn't read a backend outage as
    // malformed client input.
    if (err instanceof WorkspaceLimitError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error("workspace create failed:", err);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}

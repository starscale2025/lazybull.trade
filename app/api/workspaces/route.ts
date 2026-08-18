// /api/workspaces
//   GET   list mine
//   POST  create new

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listWorkspaces,
  createWorkspace,
  WorkspaceInput,
  WorkspaceLimitError,
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

  try {
    const doc = await createWorkspace(session.user.id, parsed.data);
    return NextResponse.json({ ok: true, workspace: doc });
  } catch (err) {
    // Only the per-user cap carries a message meant for the UI toast. Anything
    // else here is ours (Mongo down, BSON refusing a pathological doc) — that is
    // a 500 with a generic message, so internal detail never reaches the client
    // and monitoring doesn't read a backend outage as malformed client input.
    if (err instanceof WorkspaceLimitError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error("workspace create failed:", err);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}

// /api/workspaces/[id] — GET / PATCH / DELETE a single workspace.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkspace,
  getPublicWorkspace,
  updateWorkspace,
  deleteWorkspace,
  WorkspacePatch,
  MAX_WORKSPACE_BODY_BYTES,
} from "@/lib/db/workspaces";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  let ws = null;
  if (session?.user?.id) ws = await getWorkspace(session.user.id, id);
  // Public-link fallback is a projected read — name/kind/state only, never
  // the owner's userId. The owner path above keeps the full doc.
  if (!ws) ws = await getPublicWorkspace(id);
  if (!ws) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, workspace: ws });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const parsed = WorkspacePatch.safeParse(raw);
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

  const updated = await updateWorkspace(session.user.id, id, parsed.data);
  if (!updated) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, workspace: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  const ok = await deleteWorkspace(session.user.id, id);
  return NextResponse.json({ ok });
}

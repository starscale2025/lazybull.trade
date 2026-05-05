// /api/workspaces/[id] — GET / PATCH / DELETE a single workspace.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkspace,
  getPublicWorkspace,
  updateWorkspace,
  deleteWorkspace,
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
  if (!ws) ws = await getPublicWorkspace(id); // public-link fallback
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
  const body = await req.json();
  const updated = await updateWorkspace(session.user.id, id, body);
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

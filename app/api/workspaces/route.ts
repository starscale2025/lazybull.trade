// /api/workspaces
//   GET   list mine
//   POST  create new

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listWorkspaces, createWorkspace, WorkspaceInput } from "@/lib/db/workspaces";

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
  try {
    const body = await req.json();
    const parsed = WorkspaceInput.parse(body);
    const doc = await createWorkspace(session.user.id, parsed);
    return NextResponse.json({ ok: true, workspace: doc });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 },
    );
  }
}

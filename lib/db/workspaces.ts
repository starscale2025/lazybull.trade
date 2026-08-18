// Typed CRUD layer for workspaces. Used by /api/workspaces routes.

import { ObjectId, type WithId } from "mongodb";
import { z } from "zod";
import { db } from "../mongo";

// Loose state schema — workspaces are deeply nested and we don't want to
// fight every shape evolution. Top-level shape only; the rest is opaque —
// but every known collection carries a hard count/length bound so a body
// that clears the byte cap still can't smuggle an oversized array in.
const WorkspaceState = z.object({
  symbol: z.unknown().optional(),
  timeframe: z.string().max(20).optional(),
  drawings: z.array(z.unknown()).max(500).optional(),
  indicators: z.array(z.string().max(40)).max(50).optional(),
  layout: z.number().int().min(1).max(8).optional(),
  chart: z.string().max(20).optional(),
  color: z.string().max(32).optional(),
  alerts: z.array(z.unknown()).max(200).optional(),
  /** Quant setups (kind:"quant") — the bot stack is their only unbounded array. */
  active: z.array(z.unknown()).max(64).optional(),
}).passthrough();

// strictObject: unknown top-level fields are rejected, never silently stored.
export const WorkspaceInput = z.strictObject({
  kind: z.enum(["pro", "quant"]),
  name: z.string().trim().min(1).max(120),
  state: WorkspaceState,
  isPublic: z.boolean().optional().default(false),
});

// PATCH accepts any subset of the writable fields and nothing else. `kind`
// is deliberately absent — a workspace never changes kind after create.
export const WorkspacePatch = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  state: WorkspaceState.optional(),
  isPublic: z.boolean().optional(),
});

/**
 * Largest save/patch body we'll accept (chars). A drawings-heavy pro layout
 * (hundreds of drawings incl. multi-point brush strokes) serializes well
 * under 150KB; 256KB leaves headroom while staying ~60× under Mongo's
 * 16MB document limit.
 */
export const MAX_WORKSPACE_BODY_BYTES = 256_000;

/** Per-user doc cap — the list UI shows at most 50; 100 leaves headroom. */
export const MAX_WORKSPACES_PER_USER = 100;

export type Workspace = z.infer<typeof WorkspaceInput> & {
  _id: ObjectId;
  userId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export async function listWorkspaces(userId: string, kind?: "pro" | "quant") {
  const col = (await db()).collection<Workspace>("workspaces");
  const filter: Record<string, unknown> = { userId: new ObjectId(userId) };
  if (kind) filter.kind = kind;
  return col.find(filter).sort({ updatedAt: -1 }).limit(50).toArray();
}

export async function getWorkspace(userId: string, id: string) {
  const col = (await db()).collection<Workspace>("workspaces");
  if (!ObjectId.isValid(id)) return null;
  return col.findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
}

/** Public share read: only what the share UI renders — never the owner's
 *  userId or timestamps. Inclusion projection so fields added to the doc
 *  later stay private by default. */
export type PublicWorkspace = Pick<Workspace, "_id" | "name" | "kind" | "state">;

export async function getPublicWorkspace(id: string): Promise<PublicWorkspace | null> {
  const col = (await db()).collection<Workspace>("workspaces");
  if (!ObjectId.isValid(id)) return null;
  return col.findOne(
    { _id: new ObjectId(id), isPublic: true },
    { projection: { name: 1, kind: 1, state: 1 } },
  );
}

/**
 * The one error from this module whose message is safe to show a client — it
 * lets the route echo the cap while sending everything else back as a generic
 * 500, so internal failures never surface as user-facing 400s.
 */
export class WorkspaceLimitError extends Error {}

export async function createWorkspace(
  userId: string,
  input: z.infer<typeof WorkspaceInput>,
): Promise<WithId<Workspace>> {
  const parsed = WorkspaceInput.parse(input);
  const col = (await db()).collection<Workspace>("workspaces");
  // Per-user cap: an authenticated client must not be able to grow the
  // collection without bound. Message is user-facing (pro toast shows it).
  const owned = await col.countDocuments({ userId: new ObjectId(userId) });
  if (owned >= MAX_WORKSPACES_PER_USER) {
    throw new WorkspaceLimitError(
      `workspace limit reached (${MAX_WORKSPACES_PER_USER}) — delete one first`,
    );
  }
  const now = new Date();
  const doc = {
    userId: new ObjectId(userId),
    kind: parsed.kind,
    name: parsed.name,
    state: parsed.state,
    isPublic: parsed.isPublic,
    createdAt: now,
    updatedAt: now,
  };
  const r = await col.insertOne(doc as Workspace);
  return { ...doc, _id: r.insertedId } as WithId<Workspace>;
}

export async function updateWorkspace(
  userId: string,
  id: string,
  input: z.infer<typeof WorkspacePatch>,
) {
  // Re-parse at the DB boundary so every caller — not just the route — is
  // held to the same bounds. The route safeParses first, so this won't throw
  // on client traffic.
  const parsed = WorkspacePatch.parse(input);
  const col = (await db()).collection<Workspace>("workspaces");
  if (!ObjectId.isValid(id)) return null;
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.name !== undefined) $set.name = parsed.name;
  if (parsed.state !== undefined) $set.state = parsed.state;
  if (parsed.isPublic !== undefined) $set.isPublic = parsed.isPublic;
  const r = await col.findOneAndUpdate(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set },
    { returnDocument: "after" },
  );
  return r;
}

export async function deleteWorkspace(userId: string, id: string) {
  const col = (await db()).collection<Workspace>("workspaces");
  if (!ObjectId.isValid(id)) return false;
  const r = await col.deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
  return r.deletedCount === 1;
}

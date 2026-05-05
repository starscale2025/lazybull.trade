// Typed CRUD layer for workspaces. Used by /api/workspaces routes.

import { ObjectId, type WithId } from "mongodb";
import { z } from "zod";
import { db } from "../mongo";

// Loose state schema — workspaces are deeply nested and we don't want to
// fight every shape evolution. Top-level shape only; the rest is opaque.
const WorkspaceState = z.object({
  symbol: z.unknown().optional(),
  timeframe: z.string().optional(),
  drawings: z.array(z.unknown()).optional(),
  indicators: z.array(z.string()).optional(),
  layout: z.number().optional(),
  chart: z.string().optional(),
  color: z.string().optional(),
  alerts: z.array(z.unknown()).optional(),
}).passthrough();

export const WorkspaceInput = z.object({
  kind: z.enum(["pro", "quant"]),
  name: z.string().min(1).max(120),
  state: WorkspaceState,
  isPublic: z.boolean().optional().default(false),
});

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

export async function getPublicWorkspace(id: string) {
  const col = (await db()).collection<Workspace>("workspaces");
  if (!ObjectId.isValid(id)) return null;
  return col.findOne({ _id: new ObjectId(id), isPublic: true });
}

export async function createWorkspace(
  userId: string,
  input: z.infer<typeof WorkspaceInput>,
): Promise<WithId<Workspace>> {
  const parsed = WorkspaceInput.parse(input);
  const col = (await db()).collection<Workspace>("workspaces");
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
  input: Partial<z.infer<typeof WorkspaceInput>>,
) {
  const col = (await db()).collection<Workspace>("workspaces");
  if (!ObjectId.isValid(id)) return null;
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) $set.name = input.name;
  if (input.state !== undefined) $set.state = WorkspaceState.parse(input.state);
  if (input.isPublic !== undefined) $set.isPublic = input.isPublic;
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

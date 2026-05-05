// MongoDB Atlas connection singleton.
//
// Reuses one MongoClient across hot reloads in development. In production
// each Next.js server instance gets its own client. Pulls credentials from
// MONGODB_URI in .env.local — that file is gitignored.

import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    "MONGODB_URI is not set. Add it to .env.local (see lib/mongo.ts).",
  );
}

const dbName = process.env.MONGODB_DB || "lazybull";
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  appName: "lazybull-next",
};

declare global {
  // eslint-disable-next-line no-var
  var _lbMongo: Promise<MongoClient> | undefined;
}

const clientPromise: Promise<MongoClient> =
  globalThis._lbMongo ?? new MongoClient(uri, options).connect();

if (process.env.NODE_ENV === "development") {
  globalThis._lbMongo = clientPromise;
}

export async function mongo(): Promise<MongoClient> {
  return clientPromise;
}

export async function db(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

/** Pings the cluster — used by /api/health and the smoke-test script. */
export async function pingMongo() {
  const d = await db();
  await d.command({ ping: 1 });
  const stats = await d.command({ dbStats: 1, scale: 1024 * 1024 }).catch(() => null);
  return {
    ok: true,
    db: dbName,
    storageMB: stats?.storageSize ? Math.round(stats.storageSize) : null,
    collections: stats?.collections ?? null,
  };
}

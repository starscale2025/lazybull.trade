// MongoDB Atlas connection singleton.
//
// Reuses one MongoClient across hot reloads in development. In production
// each Next.js server instance gets its own client. Pulls credentials from
// MONGODB_URI in .env.local — that file is gitignored.

import { MongoClient, type Db } from "mongodb";

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

// Lazy: don't read env / open a connection at import time. Vercel collects
// page data during `next build`, which loads every route module. A throw
// here would kill the build instead of just the request.
function getClient(): Promise<MongoClient> {
  if (globalThis._lbMongo) return globalThis._lbMongo;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local locally and to your hosting provider's env vars in production.",
    );
  }
  const p = new MongoClient(uri, options).connect();
  if (process.env.NODE_ENV === "development") globalThis._lbMongo = p;
  return p;
}

export async function mongo(): Promise<MongoClient> {
  return getClient();
}

export async function db(): Promise<Db> {
  const client = await getClient();
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

// MongoDB Atlas connection singleton.
//
// ONE MongoClient per Node process, in EVERY environment. Serverless keeps a
// warmed instance alive across invocations, so a client built per call opens a
// pool that is never closed — sustained traffic walks the Atlas connection
// limit up until the instance is recycled. The memo lives on globalThis rather
// than in a module-scope variable because module scope is not stable enough:
// dev HMR re-evaluates this file on every edit, and a bundler can instantiate
// the same module twice in one process. Either would hand out a second client.
//
// Nothing here dials at import time. MONGODB_URI is read on the first call, so
// a missing var throws on the request that needs the database instead of during
// `next build`, which loads every route module to collect page data.
//
// Credentials come from MONGODB_URI in .env.local — that file is gitignored.

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

function getClient(): Promise<MongoClient> {
  const cached = globalThis._lbMongo;
  if (cached) return cached;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local locally and to your hosting provider's env vars in production.",
    );
  }

  const pending = new MongoClient(uri, options).connect();
  globalThis._lbMongo = pending;
  // Memoizing a REJECTED promise would poison the process until the next
  // deploy: every later request would await the same dead dial. So drop the
  // memo when this one fails and let the next caller redial. The identity
  // check matters — by the time this settles the memo may already hold a
  // newer, healthy promise, and clearing that would discard a live client.
  //
  // Eviction only rescues callers that come back through getClient(), which
  // db() and pingMongo() do on every request. lib/auth.ts is EXEMPT: it builds
  // MongoDBAdapter(mongo()) at module scope, so the adapter captures ONE
  // promise object for the life of the process and re-awaits that same object
  // on every query — it only re-enters this file when handed a function. So if
  // the first dial rejects, that instance keeps serving data routes but can
  // never authenticate again until it is recycled. Closing that gap means
  // switching auth.ts to the adapter's documented function form,
  // MongoDBAdapter(() => mongo(), ...) — nothing in this file can do it.
  pending.catch(() => {
    if (globalThis._lbMongo === pending) globalThis._lbMongo = undefined;
  });
  return pending;
}

// Hands back the memo ITSELF, never a fresh wrapper around it. Only the memo
// carries the rejection handler attached above; an `async` wrapper would return
// a new promise with no handler of its own, and the auth adapter stores what it
// is handed without awaiting until its first query — so a failed first dial
// would go unhandled and, under Node's default --unhandled-rejections=throw,
// take the process down.
//
// A missing MONGODB_URI must still arrive as a rejected promise, never a
// synchronous throw: lib/auth.ts calls this at module scope, where a throw would
// take down every route that imports auth, including during the build.
export function mongo(): Promise<MongoClient> {
  try {
    return getClient();
  } catch (err) {
    const rejected: Promise<MongoClient> = Promise.reject(err);
    rejected.catch(() => {}); // marked handled; awaiting it still throws
    return rejected;
  }
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

/** Test-only: drop the cached client promise without closing it. */
export function __resetMongo(): void {
  globalThis._lbMongo = undefined;
}

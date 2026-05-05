// One-time index creation. Idempotent — safe to re-run.
// Run with:  node --env-file=.env.local --experimental-strip-types scripts/init-mongo.ts

// @ts-expect-error -- runtime uses node --experimental-strip-types which requires .ts; tsc is OK.
import { db, mongo } from "../lib/mongo.ts";

async function main() {
  const d = await db();

  console.log("Creating indexes…");

  // Workspaces — saved Pro/Quant layouts.
  await d.collection("workspaces").createIndex({ userId: 1, updatedAt: -1 });
  await d
    .collection("workspaces")
    .createIndex({ isPublic: 1 }, { partialFilterExpression: { isPublic: true } });

  // Watchlists — one doc per user, but index userId for safety.
  await d.collection("watchlists").createIndex({ userId: 1 }, { unique: true });

  // Custom bots — user imports + future marketplace.
  await d.collection("customBots").createIndex({ userId: 1 });
  await d
    .collection("customBots")
    .createIndex({ isPublic: 1, installCount: -1 }, { partialFilterExpression: { isPublic: true } });

  // Alerts — symbol+status used by the firing worker.
  await d.collection("alerts").createIndex({ userId: 1, triggeredAt: 1 });
  await d.collection("alerts").createIndex({ symbol: 1, triggeredAt: 1 });

  // Paper positions.
  await d.collection("paperPositions").createIndex({ userId: 1, status: 1 });

  // Audit logs — TTL 1 year.
  await d.collection("auditLogs").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 60 * 24 * 365 },
  );
  await d.collection("auditLogs").createIndex({ userId: 1, createdAt: -1 });

  console.log("Indexes created. Listing collections:");
  for (const c of await d.listCollections().toArray()) {
    const idx = await d.collection(c.name).indexes();
    console.log(`  ${c.name}: ${idx.map((i) => i.name).join(", ")}`);
  }

  await (await mongo()).close();
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});

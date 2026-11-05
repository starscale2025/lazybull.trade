"use client";

// What /pricing needs from the server, fetched once: which rails are live and
// a coarse region (app/api/billing/config), plus the public waitlist tallies
// (app/api/waitlist/count). Both degrade to "nothing configured, no counts":
// with no network, no Mongo (local dev has no .env) or a slow edge, the page
// still renders a working waitlist — never a checkout button that goes
// nowhere, and never a number it cannot back.

import { useEffect, useState } from "react";

export type BillingConfig = {
  /** False until /api/billing/config answered (or failed). */
  loaded: boolean;
  providers: { usd: boolean; inr: boolean };
  region: "IN" | "XX" | null;
};

export type WaitlistCounts = Record<"plus" | "pro" | "power", number>;

const NONE: BillingConfig = { loaded: false, providers: { usd: false, inr: false }, region: null };
const ZERO: WaitlistCounts = { plus: 0, pro: 0, power: 0 };

export function useBillingConfig(): { config: BillingConfig; counts: WaitlistCounts } {
  const [config, setConfig] = useState<BillingConfig>(NONE);
  const [counts, setCounts] = useState<WaitlistCounts>(ZERO);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/billing/config", { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; providers?: { usd?: boolean; inr?: boolean }; region?: "IN" | "XX" | null };
        if (!alive) return;
        setConfig({
          loaded: true,
          providers: { usd: j.providers?.usd === true, inr: j.providers?.inr === true },
          region: j.region === "IN" || j.region === "XX" ? j.region : null,
        });
      } catch {
        if (alive) setConfig({ ...NONE, loaded: true });
      }
    })();
    (async () => {
      try {
        const r = await fetch("/api/waitlist/count");
        const j = (await r.json()) as { counts?: Partial<WaitlistCounts> };
        if (!alive || !j.counts) return;
        setCounts({
          plus: Number(j.counts.plus) || 0,
          pro: Number(j.counts.pro) || 0,
          power: Number(j.counts.power) || 0,
        });
      } catch {
        /* zeros — the page hides counts under 10 anyway */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { config, counts };
}

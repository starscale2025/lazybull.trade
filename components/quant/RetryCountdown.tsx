"use client";

import { useEffect, useState } from "react";

/** Live seconds until the next live-feed retry, derived from a `retryAt` epoch
    (ms). Owns its own 1s tick so a big parent doesn't re-render every second.
    Returns null when idle (no pending retry). Shared by the /quant OFFLINE
    badge (QuantHero) and the reconnect banner (QuantPage) so both count down off
    the same wired `retryAt` state. */
export function useRetryCountdown(retryAt?: number | null): number | null {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!retryAt) {
      setSecs(null);
      return;
    }
    const tick = () => setSecs(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [retryAt]);
  return secs;
}

"use client";

import { useEffect, useState } from "react";
import { Chip, type ChipTone } from "@/components/calm/kit";

// NEXT_PUBLIC_* is inlined into the CLIENT bundle at build time, so an
// unconditional localhost fallback shipped "http://localhost:8000" to every
// production visitor — each one then firing (and failing) requests at their own
// machine. Only fall back to localhost in development.
const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_QUANTAI_URL) ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

type Status = "checking" | "live" | "down";

export function LearnApiStatus({ endpoint }: { endpoint: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [info, setInfo] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      if (!API_BASE) {
        if (!cancelled) { setStatus("down"); setInfo("not configured"); }
        return;
      }
      const t0 = performance.now();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        const elapsed = Math.round(performance.now() - t0);
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        setStatus("live");
        setLatencyMs(elapsed);
        if (Array.isArray(j?.loaded)) {
          setInfo(`${j.loaded.length} models loaded`);
        }
      } catch {
        if (cancelled) return;
        setStatus("down");
        setInfo("uvicorn not running on " + API_BASE);
      }
    };
    ping();
    const id = setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // A real status, so the dot still pulses (calm, S1): the one chip, in the
  // brand colour when up, as a warning when down, because a bot then falls
  // back to a simulated surrogate. Mint and red are for gain and loss.
  const tone: ChipTone = status === "live" ? "brand" : status === "down" ? "warn" : "neutral";

  return (
    <div className="calm-panel flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 text-[0.8125rem] text-fg-dim">
      <i aria-hidden className="lit-aura" />
      <span className="font-medium text-fg">FastAPI</span>
      <span className="text-fg-faint">·</span>
      <span className="break-all font-mono text-[0.75rem]">{API_BASE}</span>
      <span className="text-fg-faint">·</span>
      <span className="break-all font-mono text-[0.75rem]">{endpoint}</span>
      <span className="ml-auto flex items-center gap-3">
        {latencyMs != null && status === "live" && <span className="text-fg-faint">{latencyMs} ms</span>}
        <Chip tone={tone}>
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full bg-current ${
              status === "live" ? "pulse-dot" : status === "checking" ? "animate-pulse" : ""
            }`}
          />
          {status === "live" ? "Live" : status === "down" ? "Offline" : "Checking…"}
        </Chip>
      </span>
      {info && <span className="basis-full t-label text-fg-dim">{info.charAt(0).toUpperCase() + info.slice(1)}</span>}
    </div>
  );
}

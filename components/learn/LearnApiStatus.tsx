"use client";

import { useEffect, useState } from "react";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_QUANTAI_URL) ||
  "http://localhost:8000";

type Status = "checking" | "live" | "down";

export function LearnApiStatus({ endpoint }: { endpoint: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [info, setInfo] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
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

  const tone =
    status === "live"
      ? "border-bull/50 bg-bull/10 text-bull"
      : status === "down"
      ? "border-bear/50 bg-bear/10 text-bear"
      : "border-border bg-bg text-fg-faint";

  return (
    <div className={`flex flex-wrap items-center gap-3 border px-4 py-3 font-mono text-[11px] uppercase tracking-wider ${tone}`}>
      <span className="flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${
            status === "live"
              ? "bg-bull pulse-dot"
              : status === "down"
              ? "bg-bear"
              : "bg-fg-faint animate-pulse"
          }`}
        />
        <span>FastAPI</span>
      </span>
      <span className="text-fg-faint">·</span>
      <span>{API_BASE}</span>
      <span className="text-fg-faint">·</span>
      <span>{endpoint}</span>
      <span className="ml-auto flex items-center gap-3">
        {latencyMs != null && status === "live" && (
          <span className="text-fg-faint normal-case tracking-normal">{latencyMs} ms</span>
        )}
        <span className="font-semibold">
          {status === "live" ? "LIVE" : status === "down" ? "OFFLINE" : "CHECKING…"}
        </span>
      </span>
      {info && (
        <span className="basis-full text-[10px] normal-case tracking-normal text-fg-dim">
          {info}
        </span>
      )}
    </div>
  );
}

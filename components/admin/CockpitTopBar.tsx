"use client";

import { useEffect, useState } from "react";

const BUILD = "a4f819";

export function CockpitTopBar({ admin }: { admin: string }) {
  const [time, setTime] = useState<string>("");
  const [uptime, setUptime] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const d = new Date();
      setTime(d.toUTCString().split(" ")[4]);
      setUptime(Math.floor((performance.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let last = performance.now();
    let frames = 0;
    let raf = 0;
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const upStr = uptime < 60
    ? `${uptime}s`
    : uptime < 3600
      ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
      : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 border border-bull/40 bg-bull/5 px-2 py-1 text-bull">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          ADMIN COCKPIT · LIVE
        </div>
        <span className="hidden md:inline">build {BUILD}</span>
        <span className="hidden md:inline">·</span>
        <span className="hidden md:inline">env <span className="text-bull">prod</span></span>
        <span className="hidden lg:inline">·</span>
        <span className="hidden lg:inline">region iad-1</span>
        <span className="hidden lg:inline">·</span>
        <span className="hidden lg:inline">uptime {upStr}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden md:inline">{fps} fps</span>
        <span className="hidden md:inline text-fg-faint">·</span>
        <span className="hidden sm:inline">{admin}</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg tabular-nums">{time || "--:--:--"}</span>
        <span className="text-fg-faint">UTC</span>
        <a
          href="/api/auth/signout"
          className="ml-2 border border-border bg-surface px-2 py-1 text-fg-dim transition-colors hover:border-bear hover:text-bear"
        >
          sign out
        </a>
      </div>
    </div>
  );
}

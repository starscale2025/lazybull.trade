"use client";

import { useState } from "react";

export function KillSwitchPanel() {
  const [armed, setArmed] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [history] = useState([
    { t: "12 min ago", who: "system", reason: "daily loss limit · auto" },
    { t: "1h 14m",    who: "system", reason: "stale market data · auto" },
    { t: "5h 02m",    who: "you",    reason: "manual drill" },
  ]);

  const toggle = () => {
    if (armed) {
      setArmed(false);
      setCountdown(0);
      return;
    }
    setArmed(true);
    let t = 5;
    setCountdown(t);
    const id = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) {
        clearInterval(id);
        setArmed(false);
      }
    }, 1000);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-bear pulse-dot" />
          <span className="text-bear">kill switch</span>
          <span className="text-fg-faint">·</span>
          <span>platform-wide</span>
        </div>
        <span className="text-fg-faint">last 7d · 3 fires</span>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 p-5">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              armed
                ? "radial-gradient(circle at 50% 50%, rgba(255,77,106,0.18), transparent 60%)"
                : "radial-gradient(circle at 50% 50%, rgba(46,232,165,0.06), transparent 60%)",
          }}
        />

        <button
          onClick={toggle}
          className={`group relative flex size-32 items-center justify-center rounded-full border-2 transition-all ${
            armed
              ? "border-bear bg-bear/10 shadow-[0_0_60px_-10px_rgba(255,77,106,0.6)]"
              : "border-fg-dim bg-surface hover:border-bear hover:shadow-[0_0_40px_-12px_rgba(255,77,106,0.4)]"
          }`}
          aria-pressed={armed}
        >
          <div className="absolute inset-0.5 rounded-full border border-border" />
          <div className="text-center font-display tracking-tightest">
            <div className={`text-3xl ${armed ? "text-bear" : "text-fg"}`}>
              {armed ? countdown : "ARM"}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
              {armed ? "auto-fires in" : "press to arm"}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span className={`size-1.5 rounded-full ${armed ? "bg-bear pulse-dot" : "bg-fg-faint"}`} />
          <span className={armed ? "text-bear" : "text-fg-dim"}>
            {armed ? "armed · drill mode" : "standby"}
          </span>
        </div>
      </div>

      <div className="border-t border-border-soft">
        <div className="border-b border-border-soft px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
          recent fires
        </div>
        <div className="divide-y divide-border-soft">
          {history.map((h) => (
            <div key={h.t} className="grid grid-cols-[60px_60px_1fr] items-center gap-2 px-3 py-1.5 font-mono text-[10px]">
              <span className="text-fg-faint">{h.t}</span>
              <span className="text-fg-dim">{h.who}</span>
              <span className="text-fg">{h.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

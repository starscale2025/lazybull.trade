"use client";

import { useState } from "react";
import type { KillHistory } from "@/lib/admin-data";
import { rel } from "./Tile";

// The kill switch, told the truth about.
//
// Two fictions were removed. Its "recent fires" list was three hardcoded
// strings ("12 min ago · daily loss limit · auto") that never changed and
// never came from anywhere, and its header claimed "last 7d · 3 fires". The
// list is now real close_all events — the only kill-shaped fact this product
// records (lib/stores.ts emits one with the reason a session was flattened).
//
// The button itself is unchanged and still local: there is no server-side
// kill switch to trip, so the panel says "drill" rather than implying a
// platform-wide lever exists. Wiring a real one is a backend change, not a
// dashboard one.

export function KillSwitchPanel({ history }: { history: KillHistory }) {
  const [armed, setArmed] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

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
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 t-chrome text-fg-dim">
        <div className="flex items-center gap-3">
          <span className={`size-1.5 rounded-full ${armed ? "bg-bear pulse-dot" : "bg-fg-faint"}`} />
          <span className="text-bear">kill switch</span>
          <span className="text-fg-faint">·</span>
          <span>local drill</span>
        </div>
        <span className="text-fg-faint tabular-nums">
          {history.rows.length} close_all · 30d
        </span>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 p-5">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: armed
              ? "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--bear) 18%, transparent), transparent 60%)"
              : "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--bull) 6%, transparent), transparent 60%)",
          }}
        />

        <button
          onClick={toggle}
          className={`group relative flex size-32 items-center justify-center rounded-full border-2 transition-all ${
            armed
              ? "border-bear bg-bear/10 shadow-[0_0_60px_-10px_color-mix(in_srgb,var(--bear)_60%,transparent)]"
              : "border-fg-dim bg-surface hover:border-bear hover:shadow-[0_0_40px_-12px_color-mix(in_srgb,var(--bear)_40%,transparent)]"
          }`}
          aria-pressed={armed}
        >
          <div className="absolute inset-0.5 rounded-full border border-border" />
          <div className="text-center font-display tracking-tightest">
            <div className={`text-3xl ${armed ? "text-bear" : "text-fg"}`}>{armed ? countdown : "ARM"}</div>
            <div className="font-mono text-[0.625rem] uppercase tracking-wider text-fg-faint">
              {armed ? "drill ends in" : "press to arm"}
            </div>
          </div>
        </button>

        <p className="max-w-[34ch] text-center font-mono text-[0.625rem] leading-relaxed text-fg-faint">
          {armed ? "armed · drill only" : "standby"} — this control is local to your browser. No server-side kill switch exists yet.
        </p>
      </div>

      <div className="border-t border-border-soft">
        <div className="border-b border-border-soft px-3 py-1.5 t-chrome text-fg-faint">close_all events · 30d</div>
        {history.rows.length === 0 ? (
          <p className="px-3 py-3 font-mono text-[0.625rem] leading-relaxed text-fg-faint">{history.note}</p>
        ) : (
          <div className="divide-y divide-border-soft">
            {history.rows.map((h) => (
              <div key={`${h.t}-${h.who}`} className="grid grid-cols-[48px_72px_1fr] items-center gap-2 px-3 py-1.5 font-mono text-[0.625rem]">
                <span className="text-fg-faint tabular-nums">{rel(h.t)}</span>
                <span className="truncate text-fg-dim">{h.who}</span>
                <span className="truncate text-fg">{h.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

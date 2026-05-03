"use client";

const PRESETS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];

export function BottomBar({ preset, onPreset, status }: { preset: string; onPreset: (p: string) => void; status: string }) {
  return (
    <div className="flex h-9 items-center justify-between border-t border-border bg-bg-soft px-3 font-mono text-[10px] uppercase tracking-wider">
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onPreset(p)}
            className={`h-6 min-w-7 border px-1.5 transition-colors ${
              p === preset
                ? "border-bull bg-bull/10 text-bull"
                : "border-transparent text-fg-dim hover:border-border hover:text-fg"
            }`}
          >
            {p}
          </button>
        ))}
        <span className="ml-2 text-fg-faint">log · auto</span>
      </div>
      <div className="flex items-center gap-3 text-fg-faint">
        <span>{status}</span>
        <span>·</span>
        <span>03:27:39 UTC+5:30</span>
      </div>
    </div>
  );
}

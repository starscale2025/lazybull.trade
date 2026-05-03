"use client";

import { motion } from "motion/react";
import type { ToolKind } from "./chartCore";

type Tool = {
  id: ToolKind | "divider";
  label: string;
  hint?: string;
  icon?: React.ReactNode;
};

const TOOLS: Tool[] = [
  {
    id: "cursor",
    label: "Cursor",
    hint: "Pan & select (V)",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l7 18 2-7 7-2L3 3z" />
      </svg>
    ),
  },
  { id: "divider", label: "" },
  {
    id: "trendline",
    label: "Trend line",
    hint: "Two-point trend (T)",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21L21 3" />
        <circle cx="3" cy="21" r="1.6" fill="currentColor" />
        <circle cx="21" cy="3" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "ray",
    label: "Ray",
    hint: "Trend ray to the right",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21L21 3" />
        <circle cx="3" cy="21" r="1.6" fill="currentColor" />
        <path d="M21 3l-3 1M21 3l-1 3" />
      </svg>
    ),
  },
  {
    id: "horizontal",
    label: "Horizontal",
    hint: "Price line (H)",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 12h18" />
        <circle cx="6" cy="12" r="1.4" fill="currentColor" />
        <circle cx="18" cy="12" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "channel",
    label: "Parallel channel",
    hint: "Trend + parallel band",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 19L21 9" />
        <path d="M3 14L21 4" />
      </svg>
    ),
  },
  { id: "divider", label: "" },
  {
    id: "fib",
    label: "Fib retracement",
    hint: "Drag swing low → high",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18" />
        <text x="3" y="22" fontFamily="var(--font-jetbrains)" fontSize="3" fill="currentColor" stroke="none">.618</text>
      </svg>
    ),
  },
  {
    id: "rect",
    label: "Rectangle",
    hint: "Zone box",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="6" width="16" height="12" />
      </svg>
    ),
  },
  {
    id: "brush",
    label: "Brush",
    hint: "Freehand (B)",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21q3 -8 9 -10 t9 -7" />
        <circle cx="21" cy="4" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
  { id: "divider", label: "" },
  {
    id: "text",
    label: "Text",
    hint: "Floating note",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 6h14M12 6v14M9 20h6" />
      </svg>
    ),
  },
  {
    id: "callout",
    label: "Callout",
    hint: "Pinned label",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="1" />
        <path d="M9 16l3 4 3-4" />
      </svg>
    ),
  },
  {
    id: "measure",
    label: "Measure",
    hint: "Δ price · Δ bars (M)",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="9" width="18" height="6" />
        <path d="M6 9v3M9 9v6M12 9v3M15 9v6M18 9v3" />
      </svg>
    ),
  },
  { id: "divider", label: "" },
  {
    id: "eraser",
    label: "Eraser",
    hint: "Click a drawing to delete",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l8 -8 6 6 -8 8H3v-6z" />
        <path d="M14 6l3 -3 4 4 -3 3" />
      </svg>
    ),
  },
];

const COLORS = ["#00ff87", "#22d3ee", "#ffb800", "#ff2e63", "#a78bfa", "#f5f5f0"];

export function LeftToolbar({
  tool,
  setTool,
  color,
  setColor,
  onClear,
  count,
}: {
  tool: ToolKind;
  setTool: (t: ToolKind) => void;
  color: string;
  setColor: (c: string) => void;
  onClear: () => void;
  count: number;
}) {
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-soft py-2">
      {TOOLS.map((t, i) =>
        t.id === "divider" ? (
          <div key={`d-${i}`} className="my-1 h-px w-6 bg-border" />
        ) : (
          <ToolBtn key={t.id} t={t} active={tool === t.id} onClick={() => setTool(t.id as ToolKind)} />
        )
      )}

      <div className="my-1 h-px w-6 bg-border" />

      {/* color picker */}
      <div className="group relative">
        <button
          aria-label="Color"
          className="flex size-8 items-center justify-center border border-border bg-bg transition-colors hover:border-fg-dim"
        >
          <span className="size-4" style={{ background: color }} />
        </button>
        <div className="absolute left-10 top-0 z-30 hidden flex-col gap-1 border border-border bg-bg p-1 shadow-2xl group-hover:flex">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`size-5 border ${color === c ? "border-fg" : "border-border"}`}
              style={{ background: c }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="my-auto" />

      {/* drawings count */}
      <div className="flex flex-col items-center gap-0.5 font-mono text-[8px] uppercase tracking-wider text-fg-faint">
        <span>{count}</span>
        <span>drws</span>
      </div>

      {/* clear */}
      <button
        aria-label="Clear all"
        onClick={onClear}
        className="flex size-8 items-center justify-center text-fg-faint transition-colors hover:text-bear"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4h8v2M6 6v14h12V6" />
        </svg>
      </button>
    </aside>
  );
}

function ToolBtn({ t, active, onClick }: { t: Tool; active: boolean; onClick: () => void }) {
  return (
    <div className="group relative">
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.92 }}
        className={`flex size-8 items-center justify-center border transition-colors ${
          active ? "border-bull bg-bull/10 text-bull" : "border-transparent bg-bg text-fg-dim hover:border-border hover:text-fg"
        }`}
        aria-label={t.label}
      >
        {t.icon}
      </motion.button>
      <div className="pointer-events-none absolute left-10 top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap border border-border bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg shadow-xl group-hover:block">
        <div>{t.label}</div>
        {t.hint && <div className="text-fg-faint normal-case tracking-normal">{t.hint}</div>}
      </div>
    </div>
  );
}

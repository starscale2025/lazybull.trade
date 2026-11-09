"use client";

import { useEffect } from "react";
import { Chip, ToolButton } from "@/components/calm/kit";

/** A ToolButton as the strip's 28px square transport key. */
const KEY = "!size-7 !p-0";

type Props = {
  total: number;
  cursor: number;
  onChange: (n: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (n: number) => void;
  onClose: () => void;
};

export function ReplayBar({ total, cursor, onChange, playing, setPlaying, speed, setSpeed, onClose }: Props) {
  // tick when playing
  useEffect(() => {
    if (!playing) return;
    const stepMs = Math.max(40, 600 / speed);
    const id = setInterval(() => {
      if (cursor >= total - 1) {
        setPlaying(false);
        return;
      }
      onChange(Math.min(total - 1, cursor + 1));
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, speed, cursor, total, onChange, setPlaying]);

  return (
    <div className="flex h-11 items-center gap-3 border-t border-border bg-bg-soft px-3 t-label">
      {/* Amber on the label only: replay is the simulated state. */}
      <Chip tone="warn">Replay</Chip>
      <ToolButton onClick={() => onChange(Math.max(0, cursor - 10))} className={KEY}>⏮</ToolButton>
      <ToolButton onClick={() => onChange(Math.max(0, cursor - 1))} className={KEY}>◀</ToolButton>
      <ToolButton onClick={() => setPlaying(!playing)} className={`${KEY} !bg-fg !text-bg`}>
        {playing ? "▮▮" : "▶"}
      </ToolButton>
      <ToolButton onClick={() => onChange(Math.min(total - 1, cursor + 1))} className={KEY}>▶</ToolButton>
      <ToolButton onClick={() => onChange(Math.min(total - 1, cursor + 10))} className={KEY}>⏭</ToolButton>
      <input
        type="range"
        min={0}
        max={total - 1}
        value={cursor}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 accent-brand-ink"
      />
      <span className="text-fg-dim">Bar</span>
      <span className="t-data w-16 text-right text-fg">{cursor + 1} / {total}</span>
      <span className="text-fg-faint">·</span>
      <span className="text-fg-dim">Speed</span>
      <select
        value={speed}
        onChange={(e) => setSpeed(parseInt(e.target.value))}
        className="h-7 rounded-[var(--r-instrument)] border border-border bg-bg px-1 text-fg-dim outline-none"
      >
        <option value={1}>1×</option>
        <option value={2}>2×</option>
        <option value={4}>4×</option>
        <option value={8}>8×</option>
        <option value={16}>16×</option>
      </select>
      <ToolButton onClick={onClose} className="ml-2 !h-7 !px-2">Exit</ToolButton>
    </div>
  );
}

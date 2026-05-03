"use client";

import { useEffect } from "react";

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
    <div className="flex h-11 items-center gap-3 border-t border-amber/40 bg-amber/5 px-3 font-mono text-[11px] uppercase tracking-wider">
      <span className="text-amber">▶ replay</span>
      <button onClick={() => onChange(Math.max(0, cursor - 10))} className="size-7 border border-amber/40 text-amber hover:bg-amber/10">⏮</button>
      <button onClick={() => onChange(Math.max(0, cursor - 1))} className="size-7 border border-amber/40 text-amber hover:bg-amber/10">◀</button>
      <button onClick={() => setPlaying(!playing)} className="size-7 border border-amber bg-amber text-bg hover:bg-amber-dim">
        {playing ? "▮▮" : "▶"}
      </button>
      <button onClick={() => onChange(Math.min(total - 1, cursor + 1))} className="size-7 border border-amber/40 text-amber hover:bg-amber/10">▶</button>
      <button onClick={() => onChange(Math.min(total - 1, cursor + 10))} className="size-7 border border-amber/40 text-amber hover:bg-amber/10">⏭</button>
      <input
        type="range"
        min={0}
        max={total - 1}
        value={cursor}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 accent-amber"
      />
      <span className="text-fg-dim">bar</span>
      <span className="text-fg w-16 text-right tabular-nums">{cursor + 1} / {total}</span>
      <span className="text-fg-faint">·</span>
      <span className="text-fg-dim">speed</span>
      <select
        value={speed}
        onChange={(e) => setSpeed(parseInt(e.target.value))}
        className="h-7 border border-amber/40 bg-bg px-1 text-amber outline-none"
      >
        <option value={1}>1×</option>
        <option value={2}>2×</option>
        <option value={4}>4×</option>
        <option value={8}>8×</option>
        <option value={16}>16×</option>
      </select>
      <button onClick={onClose} className="ml-2 h-7 border border-border bg-bg px-2 text-fg-dim hover:border-fg-dim hover:text-fg">exit</button>
    </div>
  );
}

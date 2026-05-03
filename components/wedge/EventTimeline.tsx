"use client";

import { motion } from "motion/react";
import type { MarketEvent } from "@/lib/events";
import { eventTone } from "@/lib/events";

export function EventTimeline({ events, daysToExpiry, baseDate }: { events: MarketEvent[]; daysToExpiry: number; baseDate: Date }) {
  // Filter events within [now, expiry]
  const expiry = new Date(baseDate);
  expiry.setDate(expiry.getDate() + daysToExpiry);
  const within = events.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= baseDate.getTime() && t <= expiry.getTime();
  });

  return (
    <div className="border border-border bg-bg p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span className="size-1.5 rounded-full bg-amber" />
          event horizon · next {daysToExpiry}d
        </div>
        <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
          <Legend tone="var(--bear)" label="earnings" />
          <Legend tone="var(--amber)" label="fed" />
          <Legend tone="var(--cyan)" label="cpi" />
          <Legend tone="var(--bull)" label="div" />
        </div>
      </div>

      <div className="relative h-12 border-t border-border-soft pt-4">
        {/* baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 size-2 rounded-full bg-cyan" title="now" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 size-2 rounded-full bg-amber" title="expiry" />
        <div className="absolute -top-1 left-2 font-mono text-[9px] uppercase tracking-wider text-cyan">now</div>
        <div className="absolute -top-1 right-2 font-mono text-[9px] uppercase tracking-wider text-amber">exp</div>

        {within.map((e, i) => {
          const day = (new Date(e.date).getTime() - baseDate.getTime()) / 86_400_000;
          const pct = Math.max(0, Math.min(100, (day / daysToExpiry) * 100));
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pct}%` }}
            >
              <div className="flex h-8 w-2 items-center justify-center" style={{ background: eventTone(e.kind) }} title={`${e.title} · ${e.date}`} />
              <div className="absolute left-1/2 top-9 hidden -translate-x-1/2 whitespace-nowrap border border-border bg-surface px-2 py-1 font-mono text-[10px] text-fg shadow-xl group-hover:block z-10">
                <div className="text-fg">{e.title}</div>
                <div className="text-fg-faint normal-case">{e.date} · {e.vol} vol expected</div>
                <div className="mt-1 max-w-[220px] whitespace-normal text-[10px] text-fg-dim normal-case tracking-normal">{e.blurb}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {within.length === 0 && (
        <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          no scheduled events in your window
        </div>
      )}

      {/* upcoming list */}
      {within.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {within.slice(0, 4).map((e) => (
            <li key={e.id} className="flex items-start gap-2 border border-border-soft bg-surface px-2 py-1.5">
              <span className="mt-1 inline-block size-2 shrink-0" style={{ background: eventTone(e.kind) }} />
              <div className="flex-1 text-[11px] leading-snug">
                <div className="font-mono text-fg">{e.title}</div>
                <div className="text-fg-faint">{e.date} · {e.vol} vol</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block size-2" style={{ background: tone }} />
      {label}
    </span>
  );
}

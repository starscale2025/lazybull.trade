"use client";

import { motion } from "motion/react";
import { GreekMeta, type GreekKey } from "./GreekIcons";
import { useTeacher } from "@/lib/stores";
import type { ReactNode } from "react";

export function GreekTrigger({
  greek,
  children,
}: {
  greek: GreekKey;
  children: ReactNode;
}) {
  const setBubble = useTeacher((s) => s.setBubble);
  const meta = GreekMeta[greek];
  return (
    <span
      onMouseEnter={() => setBubble({ title: meta.title, body: meta.body, icon: greek })}
      onMouseLeave={() => setBubble(undefined)}
      onFocus={() => setBubble({ title: meta.title, body: meta.body, icon: greek })}
      onBlur={() => setBubble(undefined)}
      tabIndex={0}
      className="cursor-help underline decoration-dotted decoration-fg-faint underline-offset-4 outline-none focus-visible:text-bull"
    >
      {children}
    </span>
  );
}

// inline icon + label, for use inside the chain tooltip
export function GreekChip({
  greek,
  value,
}: {
  greek: GreekKey;
  value: string;
}) {
  const meta = GreekMeta[greek];
  const Icon = meta.Icon;
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-1.5 border border-border bg-surface-2 px-1.5 py-1 font-mono text-[10px] tabular-nums"
    >
      <span style={{ color: meta.color }}>
        <Icon size={14} color={meta.color} />
      </span>
      <span className="text-fg-faint">{meta.label}</span>
      <span className="text-fg">{value}</span>
    </motion.span>
  );
}

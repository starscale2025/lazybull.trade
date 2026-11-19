// Table primitives for /practice, set the deck's way (2026-11-17): mono
// capitals in the head over a stronger rule, hairlines between rows, figures
// in tabular mono. The caller owns the <table>:
//
//   <table className="deck-table w-full t-data text-[0.6875rem]">
//
// PURE. No hooks, no directive.

import type { ReactNode } from "react";

export function Tr({ children, head, className = "" }: { children: ReactNode; head?: boolean; className?: string }) {
  return <tr className={`${head ? "" : "deck-row border-t border-border first:border-t-0"} ${className}`}>{children}</tr>;
}

export function Th({ children, left, className = "" }: { children?: ReactNode; left?: boolean; className?: string }) {
  return (
    <th className={`deck-label px-2 pb-3 pt-1 font-normal ${left ? "text-left" : "text-right"} ${className}`}>{children}</th>
  );
}

export function Td({
  children,
  left,
  strong,
  tone,
  className = "",
}: {
  children?: ReactNode;
  left?: boolean;
  strong?: boolean;
  /** Sign-tinted: positive bull, negative bear, zero dim. */
  tone?: number;
  className?: string;
}) {
  const color =
    tone == null ? (strong ? "text-fg" : "text-fg-dim") : tone > 0 ? "text-bull" : tone < 0 ? "text-bear" : "text-fg-dim";
  return <td className={`px-2 py-3 ${left ? "text-left" : "text-right"} ${color} ${className}`}>{children}</td>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-[0.875rem] text-fg-faint">{children}</div>;
}

/** A labelled figure tile: mono label, the figure under it. */
export function Stat({
  label,
  value,
  sub,
  tone,
  big,
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: number;
  big?: boolean;
  className?: string;
}) {
  const color = tone == null || tone === 0 ? "text-fg" : tone > 0 ? "text-bull" : "text-bear";
  return (
    <div className={`rounded-[10px] bg-[var(--deck-sunk)] p-3 ${className}`}>
      <div className="deck-label">{label}</div>
      <div className={`mt-1.5 t-data ${big ? "text-[1.125rem]" : "text-[0.875rem]"} ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.75rem] text-fg-faint">{sub}</div>}
    </div>
  );
}

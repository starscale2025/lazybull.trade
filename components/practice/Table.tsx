// Table primitives for /practice, copied from the module-private pieces in
// app/portfolio/page.tsx (lines 690-810) so a problems table and a paper
// ledger are set in the same hand. The caller owns the <table>:
//
//   <table className="w-full t-data text-[0.6875rem]">
//
// PURE. No hooks, no directive.

import type { ReactNode } from "react";

export function Tr({ children, head, className = "" }: { children: ReactNode; head?: boolean; className?: string }) {
  return (
    <tr
      className={`${
        head ? "text-fg-faint" : "border-t border-[color-mix(in_srgb,var(--fg)_6%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
      } ${className}`}
    >
      {children}
    </tr>
  );
}

export function Th({ children, left, className = "" }: { children?: ReactNode; left?: boolean; className?: string }) {
  return (
    // Calm (S1): sentence case in the reading sans; the numbers below stay mono.
    <th className={`px-2 pb-2 font-sans text-[0.75rem] font-normal ${left ? "text-left" : "text-right"} ${className}`}>
      {children}
    </th>
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
  return <td className={`px-2 py-1.5 ${left ? "text-left" : "text-right"} ${color} ${className}`}>{children}</td>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-[0.875rem] text-fg-faint">{children}</div>;
}

/** A labelled figure tile — `bg-surface p-3`, chrome label, tabular value. */
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
    <div className={`bg-surface p-3 ${className}`}>
      <div className="t-chrome text-fg-faint">{label}</div>
      <div className={`mt-1 t-data ${big ? "text-[1rem]" : "text-[0.8125rem]"} ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 t-chrome text-fg-faint">{sub}</div>}
    </div>
  );
}

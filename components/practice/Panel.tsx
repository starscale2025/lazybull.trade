// The house panel skeleton, for /practice. Copied from the shells in
// components/quant/OutputPanel.tsx (lines 46-62) and components/quant/BotLibrary.tsx
// (lines 43-56): a square-cornered `surface-instrument` frame, a `bg-bg-soft`
// header strip carrying a display-face title and a chrome right slot, a body
// that scrolls, and an optional chrome footer strip.
//
// PURE. Props in, markup out — no hooks, no dates, no storage, no directive —
// so it renders from server pages and inside client workspaces alike. The
// container owns state and passes it down.

import type { ReactNode } from "react";

export type PanelProps = {
  title: ReactNode;
  /** The `mt-1 t-chrome` line under the title — "click → add to workspace". */
  sub?: ReactNode;
  /** Right-aligned chrome on the title row — a count, a lamp, a pill. */
  right?: ReactNode;
  /** A `bg-bg-soft` strip under the body — actions, a status line. */
  footer?: ReactNode;
  className?: string;
  /** Extra classes for the scrolling body. Padding belongs here, not on the frame. */
  bodyClassName?: string;
  as?: "aside" | "section" | "div";
  children: ReactNode;
};

export function Panel({
  title,
  sub,
  right,
  footer,
  className = "",
  bodyClassName = "",
  as: Tag = "section",
  children,
}: PanelProps) {
  return (
    <Tag className={`flex h-full flex-col surface-instrument border border-border bg-surface ${className}`}>
      <div className="border-b border-border bg-bg-soft px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-base tracking-tightest text-fg">{title}</span>
          {right != null && <span className="t-chrome text-fg-faint">{right}</span>}
        </div>
        {sub != null && <div className="mt-1 t-chrome text-fg-faint">{sub}</div>}
      </div>
      <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
      {footer != null && <div className="border-t border-border bg-bg-soft p-2">{footer}</div>}
    </Tag>
  );
}

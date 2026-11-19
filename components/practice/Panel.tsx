// The house panel for /practice, in the pitch deck's hand (2026-11-17): a
// flat ink pane with one hairline (the Playground mockup's panes), the title
// in the reading sans, the right slot and any sub-line as mono labels.
//
//   calm   a browse surface: the header sits inside the pane, no strip.
//   tool   a working surface (the workspace): the header is a strip ruled off
//          from the body, and a footer strip can carry actions.
//
// PURE. Props in, markup out — no hooks, no dates, no storage, no directive —
// so it renders from server pages and inside client workspaces alike.

import type { ReactNode } from "react";

export type PanelProps = {
  title: ReactNode;
  /** A quiet line under the title. */
  sub?: ReactNode;
  /** Right-aligned on the title row — a count, a lamp, a pill. */
  right?: ReactNode;
  /** A strip under the body — actions, a status line. */
  footer?: ReactNode;
  className?: string;
  /** Extra classes for the scrolling body. Padding belongs here, not on the frame. */
  bodyClassName?: string;
  as?: "aside" | "section" | "div";
  /** A browse surface: the header inside the pane, no ruled strip. */
  calm?: boolean;
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
  calm = false,
  children,
}: PanelProps) {
  if (calm) {
    return (
      <Tag className={`deck-pane flex h-full flex-col ${className}`}>
        <div className="px-5 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">{title}</span>
            {right != null && <span className="deck-label">{right}</span>}
          </div>
          {sub != null && <div className="mt-1 text-[0.8125rem] text-fg-faint">{sub}</div>}
        </div>
        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer != null && <div className="px-5 pb-5">{footer}</div>}
      </Tag>
    );
  }
  return (
    <Tag className={`deck-pane flex h-full flex-col overflow-hidden ${className}`}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">{title}</span>
          {right != null && <span className="deck-label">{right}</span>}
        </div>
        {sub != null && <div className="mt-1 text-[0.8125rem] text-fg-faint">{sub}</div>}
      </div>
      <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
      {footer != null && <div className="border-t border-border px-4 py-2.5">{footer}</div>}
    </Tag>
  );
}

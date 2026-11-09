import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * THE CALM KIT (S1, 2026-11-09): the site's one component language.
 *
 * The marketing pages went calm in Phase 2 (M33: sentence case, soft fills
 * instead of outlines, one accent, one primary per screen). The product
 * pages never did, and each grew its own dialect: boxed mono caps chips in
 * five colours, square outlined buttons, coloured uppercase subtitles, a
 * fake window chrome. This is the marketing set made the site's set, so a
 * page is built from these and nothing else:
 *
 *   PageHeader   the top of a route: eyebrow, H1 (one accent phrase), one
 *                line, its actions. One per page.
 *   Chip         the one chip. Sentence case, a soft fill, no outline. Colour
 *                only when it means something: gain, loss, a warning.
 *   Stats        a row of figures, the number large and its label under it.
 *   CalmPanel    glass with a lit edge and the aura travelling round it
 *                (globals.css, LIT EDGES). A panel written by hand takes
 *                .calm-panel and <i className="lit-aura" /> as its first child.
 *   PillLink     the button for pages and the nav: a full pill. "primary" is
 *                the one gradient on the screen; there is one per screen.
 *   CalmLink     the quiet link, with a chevron that moves on hover.
 *   TogglePill   a filter or a choice that stays on: a pill that fills with
 *                the reading colour when on (aria-pressed says so).
 *   SectionHeading  a section's eyebrow and title, one accent phrase at most.
 *   PillButton   PillLink for a <button>.
 *   ToolButton   the second shape: compact and square, terminal tools only.
 *
 * For a label outside a data table use t-label (globals.css), not t-chrome.
 *
 * The terminal tools (/trade, /pro, the practice workspace) keep square
 * controls: the second of the two button shapes (Gate A4 #13).
 *
 * The page under them takes `page-aura` on its <main>: the soft light the
 * glass reads against.
 *
 * PURE. No hooks and no directive, so server pages render these directly.
 */

export function PageHeader({
  eyebrow,
  title,
  accent,
  lede,
  actions,
  children,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** The heading's one gradient phrase. */
  accent?: string;
  lede?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`shell pb-[clamp(2.5rem,5vw,3.5rem)] pt-[clamp(3rem,7vw,5.5rem)] ${className}`}>
      {eyebrow && <div className="t-eyebrow text-brand-ink">{eyebrow}</div>}
      <h1 className="mt-3 max-w-[22ch] font-display text-[clamp(2.5rem,5.6vw,4.75rem)] leading-[0.98] tracking-[-0.04em] text-fg text-balance">
        {title}
        {accent && (
          <>
            {" "}
            <span className="t-accent">{accent}</span>
          </>
        )}
      </h1>
      {lede && <p className="mt-5 measure-wide text-[1.0625rem] leading-[1.6] text-fg-dim">{lede}</p>}
      {actions && <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">{actions}</div>}
      {children}
    </header>
  );
}

const CHIP_TONE = {
  neutral: "text-fg-dim",
  gain: "text-bull",
  loss: "text-bear",
  warn: "text-amber",
  brand: "text-brand-ink",
} as const;

export type ChipTone = keyof typeof CHIP_TONE;

export function Chip({
  tone = "neutral",
  dot = false,
  children,
  className = "",
}: {
  tone?: ChipTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`calm-chip ${CHIP_TONE[tone]} ${className}`}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Stats({ items, className = "" }: { items: readonly { value: ReactNode; label: string }[]; className?: string }) {
  return (
    <dl className={`flex flex-wrap gap-x-12 gap-y-5 ${className}`}>
      {items.map((s) => (
        // dt first in the DOM (a label precedes its value for a reader); the
        // figure is shown on top.
        <div key={s.label} className="flex flex-col-reverse gap-1">
          <dt className="text-[0.8125rem] text-fg-faint">{s.label}</dt>
          <dd className="font-display text-[2rem] leading-none tracking-[-0.03em] text-fg">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CalmPanel({
  as: Tag = "div",
  title,
  aside,
  children,
  className = "",
}: {
  as?: "div" | "section" | "aside";
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={`calm-panel p-5 md:p-6 ${className}`}>
      <i aria-hidden className="lit-aura" />
      {(title != null || aside != null) && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {title != null && <h2 className="whitespace-nowrap text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">{title}</h2>}
          {aside != null && <span className="text-[0.8125rem] text-fg-faint">{aside}</span>}
        </div>
      )}
      {children}
    </Tag>
  );
}

const PILL_SIZE = {
  sm: "h-9 px-4 text-[0.875rem]",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-7 text-base",
} as const;

const PILL_KIND = {
  primary:
    "btn-grad font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.36),0_10px_30px_-14px_rgba(88,46,255,0.6)]",
  secondary: "calm-pill-secondary font-medium text-fg",
} as const;

export function PillLink({
  href,
  kind = "secondary",
  size = "md",
  children,
  className = "",
  ...rest
}: Omit<ComponentProps<typeof Link>, "href" | "className"> & {
  href: string;
  kind?: keyof typeof PILL_KIND;
  size?: keyof typeof PILL_SIZE;
  className?: string;
}) {
  return (
    <Link
      {...rest}
      href={href}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full tracking-[-0.01em] transition-[transform,box-shadow,background-color,color] duration-300 [transition-timing-function:var(--ease-settle)] hover:-translate-y-px ${PILL_SIZE[size]} ${PILL_KIND[kind]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function TogglePill({
  on,
  children,
  className = "",
  ...rest
}: ComponentProps<"button"> & { on: boolean }) {
  return (
    <button type="button" {...rest} aria-pressed={on} className={`calm-toggle ${className}`}>
      {children}
    </button>
  );
}

export function PillButton({
  kind = "secondary",
  size = "md",
  children,
  className = "",
  ...rest
}: ComponentProps<"button"> & {
  kind?: keyof typeof PILL_KIND;
  size?: keyof typeof PILL_SIZE;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full tracking-[-0.01em] transition-[transform,box-shadow,background-color,color] duration-300 [transition-timing-function:var(--ease-settle)] enabled:hover:-translate-y-px disabled:opacity-45 ${PILL_SIZE[size]} ${PILL_KIND[kind]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ToolButton({
  primary = false,
  children,
  className = "",
  ...rest
}: ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button type="button" {...rest} className={`tool-btn ${primary ? "tool-btn-primary btn-grad" : ""} ${className}`}>
      {children}
    </button>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  accent,
  center = false,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  accent?: string;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={`${center ? "text-center" : ""} ${className}`}>
      {eyebrow && <div className="t-eyebrow text-brand-ink">{eyebrow}</div>}
      <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1] tracking-[-0.035em] text-fg text-balance">
        {title}
        {accent && (
          <>
            {" "}
            <span className="t-accent">{accent}</span>
          </>
        )}
      </h2>
    </div>
  );
}

export function CalmLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`calm-link ${className}`}>
      {children} <span aria-hidden>›</span>
    </Link>
  );
}

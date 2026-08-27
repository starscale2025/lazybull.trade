import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The glass control set — ui_kits/site-glass, translated to the codebase.
 *
 * TWO DEVIATIONS FROM THE KIT, both deliberate:
 *
 * 1. The kit tracks hover in React state (`const [h, setH] = useState(false)`)
 *    on every button and link. Here hover is pure CSS. That is not a style
 *    preference: it keeps Workflow / Features / Safety / Pricing as SERVER
 *    components, so the whole marketing region ships zero extra JS. The
 *    landing already carries a ~1.3MB three.js chunk for the cinema and
 *    scripts/guard.mjs budgets the bundle at 4.6MB — a hover boolean is not
 *    worth a client boundary here.
 *
 * 2. Sizes come from the type roles (t-eyebrow / t-chrome / t-data) instead of
 *    the kit's inline `fontSize: 10, letterSpacing: ".18em"` pairs, which are
 *    those roles spelled out longhand. Buttons are the documented exception —
 *    the role contract in globals.css says a control keeps its own size, so
 *    button type is set explicitly and never borrowed from chrome.
 */

/* ── Section shell ───────────────────────────────────────────────────────── */

export function GlassSection({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // scroll-mt clears the sticky nav pill on an anchor jump. It lives here
    // rather than as `html { scroll-padding-top }` because that would apply to
    // the cinema's scroll range too, and the cinema reads scrollY directly.
    <section id={id} className={`relative z-10 scroll-mt-[84px] ${className}`}>
      <div className="mx-auto w-full max-w-[1160px] px-6 py-[clamp(4rem,9vw,5.75rem)]">
        {children}
      </div>
    </section>
  );
}

/* ── Eyebrow — a rule that bleeds out of the bull green, then the label ──── */

export function GlassEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 t-eyebrow text-bull">
      <span
        aria-hidden
        className="h-px w-[22px] bg-[linear-gradient(90deg,var(--bull),transparent)]"
      />
      {children}
    </div>
  );
}

/* ── Section heading — roman serif, then exactly one italic-green phrase ─── */

export function GlassHeading({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: string;
}) {
  return (
    <h2 className="mt-4 font-display text-[clamp(2.1rem,4.2vw,3.4rem)] leading-[0.98] tracking-[-0.04em] text-fg text-balance">
      {children}
      {accent && (
        <>
          {" "}
          <span className="t-accent">{accent}</span>
        </>
      )}
    </h2>
  );
}

/* ── Chip — a glass pill, optionally with a status dot ───────────────────── */

const CHIP_TONE = {
  bull: "text-bull",
  amber: "text-amber",
  cyan: "text-cyan",
  dim: "text-fg-dim",
} as const;

const CHIP_DOT = {
  bull: "bg-bull",
  amber: "bg-amber",
  cyan: "bg-cyan",
  dim: "bg-fg-dim",
} as const;

export function GlassChip({
  tone = "bull",
  dot = false,
  pulse = false,
  children,
  className = "",
}: {
  tone?: keyof typeof CHIP_TONE;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`glass inline-flex items-center gap-2 rounded-[var(--r-pill)] px-3.5 py-[7px] t-eyebrow ${CHIP_TONE[tone]} ${className}`}
    >
      {dot && (
        <span
          aria-hidden
          className={`size-[5px] shrink-0 rounded-full ${CHIP_DOT[tone]} ${pulse ? "pulse-dot" : ""}`}
          style={{ boxShadow: "0 0 10px currentColor" }}
        />
      )}
      {children}
    </span>
  );
}

/* ── Button ──────────────────────────────────────────────────────────────────
   One primary per screen — that restraint is the redesign's whole argument
   about the shipped page, which runs competing CTAs in the same viewport.

   The gradient fill is a documented departure from the shipped brand (whose
   primary is a flat bull fill). It is confined to the glass marketing region;
   nothing in /pro, /trade or /quant picks it up.                            */

const BTN_SIZE = {
  lg: "h-[54px] px-[30px] text-[13px]",
  md: "h-[42px] px-5 text-[11px]",
} as const;

const BTN_KIND = {
  primary:
    "bg-[linear-gradient(180deg,#24f596,#00d96f)] text-[#04140b] font-bold border border-bull/50 " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_34px_-14px_rgba(0,255,135,0.5)] " +
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_14px_44px_-12px_rgba(0,255,135,0.6)]",
  glass:
    "glass font-medium text-fg hover:bg-[rgba(245,245,240,0.1)] hover:border-[rgba(245,245,240,0.22)]",
  ghost:
    "border border-transparent bg-transparent font-medium text-fg-dim hover:text-fg",
} as const;

const BTN_BASE =
  "group/btn inline-flex shrink-0 items-center justify-center gap-[9px] whitespace-nowrap " +
  "rounded-[var(--r-btn)] font-mono uppercase tracking-[0.08em] " +
  "transition-[transform,box-shadow,background-color,border-color,color] duration-350 " +
  "[transition-timing-function:var(--ease-settle)] hover:-translate-y-px";

export function GlassButton({
  href,
  kind = "primary",
  size = "md",
  arrow = false,
  children,
  className = "",
}: {
  href: string;
  kind?: keyof typeof BTN_KIND;
  size?: keyof typeof BTN_SIZE;
  arrow?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${BTN_BASE} ${BTN_SIZE[size]} ${BTN_KIND[kind]} ${className}`}
    >
      {children}
      {arrow && (
        <span
          aria-hidden
          className="transition-transform duration-300 [transition-timing-function:var(--ease-settle)] group-hover/btn:translate-x-[3px]"
        >
          →
        </span>
      )}
    </Link>
  );
}

/* ── Feature bullet — the brand's `›` list marker, never a disc or an icon ── */

export function GlassPoints({ points }: { points: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {points.map((p) => (
        <li
          key={p}
          className="flex gap-2.5 font-mono text-[11px] leading-[1.5] text-fg-dim"
        >
          <span aria-hidden className="text-bull">
            ›
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

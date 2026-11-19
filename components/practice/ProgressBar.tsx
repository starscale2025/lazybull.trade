// A thin progress rule, the deck's phase bar (slide 12) at instrument size: a
// flat track and a filled rule whose width is the fraction. The fill eases
// through the brand curve — a CSS transition on width, not an animation, so
// it needs no reduced-motion block.
//
// PURE — `value` is 0..1 and the container computes it.

export type ProgressBarProps = {
  /** 0..1. Clamped; a non-finite value renders as empty. */
  value: number;
  /** A CSS colour — normally a var, e.g. "var(--bull)". */
  color?: string;
  className?: string;
  /** Adds a label row above: the label left, the percentage right. */
  label?: string;
  /** Names the bar for assistive tech without the visible label row. */
  ariaLabel?: string;
};

export function ProgressBar({ value, color = "var(--brand-ink)", className = "", label, ariaLabel }: ProgressBarProps) {
  const pct = Number.isFinite(value) ? Math.round(Math.min(1, Math.max(0, value)) * 100) : 0;
  const bar = (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? ariaLabel}
      className="h-[3px] overflow-hidden rounded-[1px] bg-[var(--deck-rule,color-mix(in_srgb,var(--fg)_9%,transparent))]"
    >
      <div
        className="h-full rounded-[1px] transition-[width] duration-700 [transition-timing-function:var(--ease-settle)]"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
  if (!label) return <div className={className}>{bar}</div>;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between text-[0.75rem] text-fg-faint">
        <span>{label}</span>
        <span className="t-data">{pct}%</span>
      </div>
      {bar}
    </div>
  );
}

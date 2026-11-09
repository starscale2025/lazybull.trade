// A thin rounded progress rule, the same instrument as the mobile scroll bar
// in components/learn/ChapterNav.tsx: a soft track and a filled
// inner rule whose width is the fraction. The fill eases through the brand
// curve — a CSS transition on width, not an animation, so it needs no
// reduced-motion block.
//
// PURE — `value` is 0..1 and the container computes it.

export type ProgressBarProps = {
  /** 0..1. Clamped; a non-finite value renders as empty. */
  value: number;
  /** A CSS colour — normally a var, e.g. "var(--cyan)". */
  color?: string;
  className?: string;
  /** Adds a label row above: the label left, the percentage right. */
  label?: string;
};

export function ProgressBar({ value, color = "var(--brand-ink)", className = "", label }: ProgressBarProps) {
  const pct = Number.isFinite(value) ? Math.round(Math.min(1, Math.max(0, value)) * 100) : 0;
  const bar = (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]"
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-settle)]"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
  if (!label) return <div className={className}>{bar}</div>;
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between t-label text-fg-faint">
        <span>{label}</span>
        <span className="t-data">{pct}%</span>
      </div>
      {bar}
    </div>
  );
}

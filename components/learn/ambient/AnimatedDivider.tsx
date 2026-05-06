// Section-to-section divider. Two thin lines drawing in from the center,
// a slowly-spinning diamond, optional label, and tick marks.

export function AnimatedDivider({
  label,
  num,
}: {
  label?: string;
  num?: string;
}) {
  return (
    <div className="relative bg-bg py-14">
      {/* Background grid wash */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-15" />

      <div className="relative mx-auto flex max-w-[1280px] items-center justify-center gap-6 px-5">
        {/* Left line */}
        <div className="relative flex-1 origin-right">
          <div className="absolute inset-y-1/2 h-px w-full -translate-y-1/2 bg-fg-faint/30 divider-grow" style={{ animationDelay: "0.1s" }} />
          {/* Decorative tick marks */}
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "10%" }} />
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "30%" }} />
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "60%" }} />
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "85%" }} />
        </div>

        {/* Center diamond + label */}
        <div className="flex items-center gap-3 px-2">
          {num && (
            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-fg-faint">
              §{num}
            </span>
          )}
          <div className="relative size-3 diamond-spin">
            <span
              className="absolute inset-0 border border-bull"
              style={{ transform: "rotate(45deg)", boxShadow: "0 0 12px rgba(0,255,135,0.5)" }}
            />
          </div>
          {label && (
            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-bull whitespace-nowrap">
              {label}
            </span>
          )}
          <div className="relative size-3 diamond-spin" style={{ animationDirection: "reverse" }}>
            <span
              className="absolute inset-0 border border-bull"
              style={{ transform: "rotate(45deg)", boxShadow: "0 0 12px rgba(0,255,135,0.5)" }}
            />
          </div>
        </div>

        {/* Right line */}
        <div className="relative flex-1 origin-left">
          <div className="absolute inset-y-1/2 h-px w-full -translate-y-1/2 bg-fg-faint/30 divider-grow" style={{ animationDelay: "0.1s" }} />
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "15%" }} />
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "40%" }} />
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "70%" }} />
          <div className="absolute inset-y-1/2 h-2 w-px -translate-y-1/2 bg-fg-faint/40" style={{ left: "90%" }} />
        </div>
      </div>
    </div>
  );
}

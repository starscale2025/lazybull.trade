// Corner-fixed "LIVE · LEARN MODE" pill. Pulses the bull dot. Sits below
// the scroll-progress bar.

export function LiveBadge() {
  return (
    <div
      className="fixed top-4 right-4 z-[60] hidden lg:flex"
      aria-hidden
      style={{ marginTop: "8px" }}
    >
      <div className="flex items-center gap-2 border border-bull/40 bg-bg/80 px-2 py-1 backdrop-blur-sm font-mono text-[9px] uppercase tracking-[0.35em]">
        <span className="size-1.5 rounded-full bg-bull pulse-dot" />
        <span className="text-bull">LIVE</span>
        <span className="text-fg-faint">/</span>
        <span className="text-fg-dim">LEARN MODE</span>
      </div>
    </div>
  );
}

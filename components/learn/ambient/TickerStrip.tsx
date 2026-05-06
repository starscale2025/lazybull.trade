// Inter-section marquee of jargon. Colored diamonds in trader colors. Pure
// CSS marquee, infinite. The page has multiple of these scrolling in
// alternating directions to create rhythm.

const TONE_COLORS = ["var(--bull)", "var(--bear)", "var(--cyan)", "var(--amber)", "var(--plasma)"];

export function TickerStrip({
  items,
  reverse = false,
  speed = "normal",
}: {
  items: string[];
  reverse?: boolean;
  speed?: "slow" | "normal" | "fast";
}) {
  const repeated = [...items, ...items, ...items];
  const animationClass = reverse ? "marquee-reverse" : speed === "slow" ? "marquee-slow" : "marquee";

  return (
    <div className="relative overflow-hidden border-y border-border bg-bg-soft">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-10" />
      <div className={`relative flex ${animationClass} gap-12 py-3 font-mono text-[10px] uppercase tracking-[0.3em] whitespace-nowrap`}>
        {repeated.map((item, i) => (
          <span key={i} className="flex items-center gap-3 shrink-0">
            <span style={{ color: TONE_COLORS[i % TONE_COLORS.length] }} className="text-[8px]">
              ◆
            </span>
            <span className="text-fg">{item}</span>
            <span className="text-fg-faint">·</span>
          </span>
        ))}
      </div>
      {/* Edge fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg-soft to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg-soft to-transparent" />
    </div>
  );
}

// A quiet marquee of terms (calm, S1, 2026-11-09): the reading type, a dot
// between items, faded out at both edges by a mask so the strip needs no
// background of its own. It was a soft band over a grid wash, in mono caps,
// with a diamond per item in the trader colours.

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
    // The left fade widens to 15rem at lg so the words clear the chapter rail
    // (ChapterNav's geometry contract).
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6rem,#000_calc(100%-6rem),transparent)] lg:[mask-image:linear-gradient(90deg,transparent,#000_15rem,#000_calc(100%-6rem),transparent)]">
      <div className={`relative flex ${animationClass} gap-12 py-3 t-label whitespace-nowrap`}>
        {repeated.map((item, i) => (
          <span key={i} className="flex items-center gap-12 shrink-0">
            <span className="text-fg-dim">{item}</span>
            <span aria-hidden className="text-fg-faint">
              ·
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

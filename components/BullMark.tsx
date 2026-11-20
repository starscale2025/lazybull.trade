import { bullMarkPoints } from "@/lib/bull-mark";

/**
 * The bull mark (lib/bull-mark.ts): a long-strangle payoff read as a head, in
 * the brand ramp. The nav's logo, and the shape the film ends on (M25), so
 * the film's last frame is the mark the page carries from then on.
 */
export function BullMark({ className = "", strokeWidth = 2.2 }: { className?: string; strokeWidth?: number }) {
  return (
    // `bull-mark` is a hook only: inside the pitch-deck skin (globals.css,
    // THE DECK SKIN) the stroke takes the brand green instead of the ramp.
    <svg viewBox="0 0 28 20" className={`bull-mark ${className}`} aria-hidden fill="none">
      <defs>
        {/* One definition however many marks a page draws: the ids collide
            but the gradients are identical, so whichever wins is right. */}
        <linearGradient id="lb-mark-ramp" x1="0" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00a857" />
          <stop offset="0.52" stopColor="#00c46a" />
          <stop offset="1" stopColor="#00ff87" />
        </linearGradient>
      </defs>
      <polyline
        points={bullMarkPoints(28, 20, 2)}
        stroke="url(#lb-mark-ramp)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

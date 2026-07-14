"use client";

// The type-sandwich hero (reel-6 watch effect): giant display lines render in
// two stacks — `behind` lines sit under the object cutout, `front` lines over
// it — and the three layers parallax at different rates via data-gsap so the
// object reads as physically floating inside the typography.

import Image from "next/image";

export function splitLayers(lines: string[], frontFrom: number) {
  const cut = Math.max(0, Math.min(lines.length, frontFrom));
  return { behind: lines.slice(0, cut), front: lines.slice(cut) };
}

type Props = {
  /** Alpha-cutout image (public path, e.g. /media/bull/bull-cut@1600.webp) */
  cutout: string;
  cutoutAlt: string;
  /** Display lines, top to bottom. */
  lines: string[];
  /** Index of the first line that renders IN FRONT of the object. */
  frontFrom: number;
  kicker?: string;
  className?: string;
  /** "screen" makes black pixels transparent — a free cutout for luminous
   *  objects shot on black (glass, glow, neon). Default expects real alpha. */
  blend?: "normal" | "screen";
};

export function MaterialHero({ cutout, cutoutAlt, lines, frontFrom, kicker, className = "", blend = "normal" }: Props) {
  const { behind, front } = splitLayers(lines, frontFrom);
  const Line = ({ text }: { text: string }) => (
    <div className="font-display uppercase leading-[0.92] tracking-tightest text-fg text-[clamp(3rem,9vw,9rem)]">
      {text}
    </div>
  );
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {kicker && (
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint" data-gsap="fade-up">
          ⟢ {kicker}
        </div>
      )}
      <div className="relative">
        {/* behind layer */}
        <div className="relative z-0 select-none" data-gsap="parallax" data-gsap-amount="40">
          {behind.map((t) => (
            <Line key={t} text={t} />
          ))}
        </div>
        {/* the object. In screen mode the blend lives on the WRAPPER — the
            parallax transform makes this div a stacking context, and a blend on
            the img inside it would be isolated there and render opaque. */}
        <div
          className={`pointer-events-none absolute left-1/2 top-1/2 z-10 w-[min(58vw,540px)] -translate-x-1/2 -translate-y-1/2 ${blend === "screen" ? "mix-blend-screen" : ""}`}
          data-gsap="parallax"
          data-gsap-amount="110"
        >
          <Image
            src={cutout}
            alt={cutoutAlt}
            width={1600}
            height={2000}
            priority
            className={`h-auto w-full ${blend === "screen" ? "" : "drop-shadow-[0_40px_80px_rgba(0,0,0,0.75)]"}`}
          />
        </div>
        {/* front layer */}
        <div className="relative z-20 select-none" data-gsap="parallax" data-gsap-amount="70">
          {front.map((t) => (
            <Line key={t} text={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

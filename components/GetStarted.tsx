"use client";

import Link from "next/link";
import { MagneticCTA } from "./atmosphere/MagneticCTA";
import { HungCard } from "./atmosphere/HungCard";

// The single landing the cinema hands off to (and the page's real, crawlable
// content). Live/glowing, but with continuous — not entrance — effects so the
// baked reveal frame matches and the handoff stays seamless.
const FEATURES = [
  "Visual options chain",
  "27 quant bots · 13 models",
  "AI crash detection",
  "$100K paper account",
];

// Deterministic ghost candle series — a climb into a dip, echoing the cinema.
const CANDLES = Array.from({ length: 32 }, (_, i) => {
  const t = i / 31;
  const trend = t < 0.75 ? t / 0.75 : 1 - ((t - 0.75) / 0.25) * 0.5;
  const h = 18 + trend * 68 + Math.sin(i * 0.8) * 8;
  return {
    h: Math.max(10, Math.min(96, h)),
    up: Math.sin(i * 0.8) > -0.2 && t < 0.78,
    delay: (i % 8) * 0.25,
  };
});

const EMBERS = Array.from({ length: 9 }, (_, i) => ({
  left: 7 + ((i * 97) % 86),
  delay: (i * 0.8) % 6,
  dur: 6 + (i % 4),
  size: i % 3 === 0 ? 3 : 2,
}));

export function GetStarted() {
  return (
    <section
      data-getstarted
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden border-t border-border bg-bg px-6 text-center"
    >
      {/* --- animated background --- */}
      {/* living smoke: a real fluid, not CSS — sits under everything else.
          muted is (re)set via ref: React omits the muted ATTRIBUTE in SSR
          markup, so the browser would otherwise veto autoplay pre-hydration. */}
      <video
        ref={(el) => {
          if (!el) return;
          el.muted = true;
          if (el.paused && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            el.play().catch(() => {});
          }
        }}
        src="/media/loops/smoke-loop.webm"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] w-full object-cover opacity-25 motion-reduce:hidden"
      />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[520px] w-[520px] rounded-full bg-bull/12 blur-[150px] drift" />
      <div
        className="pointer-events-none absolute -right-24 bottom-1/4 h-[440px] w-[440px] rounded-full bg-cyan/10 blur-[150px] drift"
        style={{ animationDelay: "-7s" }}
      />

      {/* ghost candle chart along the bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[44%] items-end justify-center gap-[5px] px-6 opacity-20 sm:gap-[7px]">
        {CANDLES.map((c, i) => {
          const color = c.up ? "var(--bull)" : "var(--bear)";
          return (
            <div
              key={i}
              className="gs-candle relative flex w-[1.4%] max-w-[13px] items-end justify-center"
              style={{ height: `${c.h}%`, animationDelay: `${c.delay}s` }}
            >
              <span className="absolute -top-2.5 left-1/2 h-2.5 w-px -translate-x-1/2" style={{ background: color, opacity: 0.5 }} />
              <span className="w-full" style={{ height: "100%", background: color, boxShadow: `0 0 8px ${c.up ? "rgba(0,255,135,0.4)" : "rgba(255,46,99,0.4)"}` }} />
            </div>
          );
        })}
      </div>

      {/* floating embers */}
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="gs-ember pointer-events-none absolute bottom-0 rounded-full bg-bull"
          style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s` }}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 scanlines opacity-30" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 44%, rgba(0,0,0,0.72) 100%)" }}
      />

      {/* --- content --- */}
      <div className="relative flex flex-col items-center gap-8">
        <span className="ambient-glow inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-bull">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" /> paper-only · $0 at risk, ever
        </span>

        <h2
          className="font-display text-fg"
          style={{ fontSize: "clamp(2.75rem, 7.5vw, 6rem)", lineHeight: 0.95, letterSpacing: "-0.02em", textShadow: "0 0 40px rgba(0,0,0,0.6)" }}
        >
          Options you can{" "}
          <span className="headline-sweep crt-flicker italic font-light" style={{ paddingRight: "0.14em" }}>
            see
          </span>
          <span className="text-bull crt-flicker" style={{ marginLeft: "-0.04em" }}>
            .
          </span>
        </h2>

        <p className="max-w-xl font-mono text-sm leading-relaxed text-fg-dim md:text-base">
          27 bots, 13 models and 8 live demos in one terminal. Learn it, backtest it,
          and only then trade it — on a $100K paper account, with an AI teacher over
          every Greek and a kill switch under everything.
        </p>

        <div className="mt-1 flex flex-col items-center gap-4 sm:flex-row">
          <MagneticCTA>
            <Link
              href="/trade"
              className="gs-cta group relative inline-flex items-center gap-2 overflow-hidden bg-bull px-9 py-4 font-mono text-sm font-bold uppercase tracking-wider text-bg"
            >
              <span className="relative z-10">Get started</span>
              <span className="relative z-10 transition-transform group-hover:translate-x-1" aria-hidden>→</span>
            </Link>
          </MagneticCTA>
          <Link
            href="/auth/signin"
            className="font-mono text-sm uppercase tracking-wider text-fg-dim underline-offset-4 hover:text-fg hover:underline"
          >
            or sign in
          </Link>
        </div>

        {/* feature chips hung on wires — damped pendulums, hover gives a push */}
        <div className="mt-2 flex flex-wrap items-start justify-center gap-6">
          {FEATURES.map((f, i) => (
            <HungCard key={f} wire={34 + (i % 3) * 14} phase={i * 1.7}>
              <span className="flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim backdrop-blur-sm">
                <span className="size-1 rounded-full bg-bull/70 pulse-dot" /> {f}
              </span>
            </HungCard>
          ))}
        </div>

        {/* the AI that watches — macro eye with live HUD tracking boxes */}
        <div className="relative mt-12 w-full max-w-3xl overflow-hidden border border-border">
          {/* a LIVE eye: blinks, pupil breathes, the chart in it flickers */}
          <video
            ref={(el) => {
              if (!el) return;
              el.muted = true;
              if (el.paused && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                el.play().catch(() => {});
              }
            }}
            src="/media/loops/eye-loop.webm"
            poster="/media/eye/eye-hero@1600.webp"
            autoPlay
            muted
            loop
            playsInline
            aria-label="Macro eye with a candlestick chart reflected in the pupil — the AI watches every tick"
            className="h-auto w-full opacity-90"
          />
          {[
            { l: "26%", t: "46%", w: 90, label: "P(down) 71%" },
            { l: "58%", t: "22%", w: 74, label: "IV 0.41" },
            { l: "70%", t: "58%", w: 84, label: "Δ −0.32" },
          ].map((b) => (
            <div
              key={b.label}
              className="pointer-events-none absolute border border-bull/70 bg-bg/60 px-1.5 py-1 text-left font-mono text-[9px] uppercase tracking-wider text-bull backdrop-blur-[1px]"
              style={{ left: b.l, top: b.t, width: b.w, animation: "gs-hud 3.2s ease-in-out infinite" }}
            >
              {b.label}
            </div>
          ))}
          <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-dim">
            27 bots watching, so you don&apos;t have to
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gs-ember { 0% { transform: translateY(0); opacity: 0; } 14% { opacity: 0.7; } 100% { transform: translateY(-50vh); opacity: 0; } }
        .gs-ember { animation-name: gs-ember; animation-timing-function: ease-out; animation-iteration-count: infinite; box-shadow: 0 0 6px var(--bull); }
        @keyframes gs-candle-breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.05); } }
        .gs-candle { transform-origin: bottom; animation: gs-candle-breathe 4s ease-in-out infinite; }
        @keyframes gs-cta-glow { 0%,100% { box-shadow: 0 0 24px 2px rgba(0,255,135,0.35); } 50% { box-shadow: 0 0 46px 7px rgba(0,255,135,0.62); } }
        .gs-cta { animation: gs-cta-glow 2.6s ease-in-out infinite; }
        .gs-cta::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 36%, rgba(255,255,255,0.6) 50%, transparent 64%); background-size: 250% 100%; animation: gs-cta-shine 3.6s ease-in-out infinite; }
        @keyframes gs-cta-shine { 0% { background-position: 180% 0; } 55%,100% { background-position: -130% 0; } }
        @keyframes gs-hud { 0%,100% { opacity: 0.55; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
        @media (prefers-reduced-motion: reduce) {
          .gs-ember, .gs-candle, .gs-cta, .gs-cta::after { animation: none; }
          .gs-ember { opacity: 0; }
          [style*="gs-hud"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}

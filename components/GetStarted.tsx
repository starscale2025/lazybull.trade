"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MagneticCTA } from "./atmosphere/MagneticCTA";
import { HungCard } from "./atmosphere/HungCard";
import { AuthButtons } from "./AuthButtons";
import { SITE_DIRECTORY as DIRECTORY } from "@/lib/directory";

// The landing carries no navbar — this directory IS the site's front door.
// Numbered from the shared canonical list (lib/directory) so the same link
// shows the same number here and in the product-page rail.

// The hero HUD's index column — driven by the SAME /api/quote-batch feed (and
// 30s server cache) as the ticker below it, so its QQQ/VIX are provably
// identical to the ticker's and can never contradict it. Symbols are a subset
// of the ticker's, so this adds ZERO new upstream calls. Decorative
// (aria-hidden); shows muted "—" placeholders until the first quote lands —
// never a stale hardcoded number.
const HUD_SYMBOLS = ["SPY", "QQQ", "IWM", "GLD", "^VIX"] as const;
const HUD_DISPLAY: Record<string, string> = { "^VIX": "VIX" };
type HudQuote = { sym: string; last?: number; chgPct?: number };

function HudIndexColumn() {
  const [rows, setRows] = useState(() =>
    HUD_SYMBOLS.map((s) => ({ s: HUD_DISPLAY[s] ?? s, v: "—", c: "", up: true }))
  );
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${HUD_SYMBOLS.join(",")}`);
        const j = await r.json();
        if (cancelled || !j?.ok || !Array.isArray(j.quotes)) return;
        const by = new Map<string, HudQuote>((j.quotes as HudQuote[]).map((q) => [q.sym, q]));
        setRows(
          HUD_SYMBOLS.map((sym) => {
            const q = by.get(sym);
            const disp = HUD_DISPLAY[sym] ?? sym;
            if (!q || typeof q.last !== "number") return { s: disp, v: "—", c: "", up: true };
            const up = (q.chgPct ?? 0) >= 0;
            const v =
              q.last >= 1000
                ? q.last.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : q.last.toFixed(2);
            return { s: disp, v, c: `${up ? "+" : "−"}${Math.abs(q.chgPct ?? 0).toFixed(2)}%`, up };
          })
        );
      } catch {
        /* keep prior rows on a transient error */
      }
    };
    run();
    const id = setInterval(run, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return (
    <div
      className="pointer-events-none absolute left-[5%] top-[38%] hidden space-y-2.5 text-left font-mono text-[11px] tracking-wider md:block"
      aria-hidden
    >
      {rows.map((r) => (
        <div key={r.s} className="border-b border-bull/20 pb-1.5 text-bull/90">
          <div>
            {r.s} <span className="text-fg-dim">{r.v}</span>
          </div>
          {r.c && <div className={r.up ? "text-bull" : "text-bear"}>{r.c}</div>}
        </div>
      ))}
    </div>
  );
}

// The single landing the cinema hands off to (and the page's real, crawlable
// content). Live/glowing, but with continuous — not entrance — effects so the
// baked reveal frame matches and the handoff stays seamless.

// Below-the-fold loops load LAZILY: preload none/metadata keeps their megabytes
// out of the initial page load, and playback (which triggers the real fetch)
// only starts as the video nears the viewport. muted is (re)set via ref because
// React omits the muted ATTRIBUTE in SSR markup, so the browser would otherwise
// veto autoplay pre-hydration.
const lazyLoop = (el: HTMLVideoElement | null) => {
  if (!el) return;
  el.muted = true;
  if (el.dataset.lazyloop) return; // ref callbacks re-run; wire once
  el.dataset.lazyloop = "1";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Keep observing (the old code disconnected after first play): a 1.2MB webm
  // decoding in a loop forever once seen was a battery tax by design. Now it
  // plays when on screen and PAUSES when it scrolls away.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !reduce) el.play().catch(() => {});
        else el.pause();
      }
    },
    { rootMargin: "300px 0px" }
  );
  io.observe(el);
};

const FEATURES = [
  "Visual options chain",
  "27 quant bots · 13 models",
  "AI crash detection",
  "$5K paper account",
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
  const { status: authStatus } = useSession();
  // "▶ watch the film" — the cinema is opt-in now, never a gate. Offered to
  // everyone on desktop (it never mounts on phones), first-timers included.
  const [canReplay, setCanReplay] = useState(false);
  useEffect(() => {
    try {
      setCanReplay(window.matchMedia("(min-width: 768px)").matches);
    } catch {}
  }, []);
  const replay = () => {
    try {
      sessionStorage.setItem("lb-cinema-replay", "1");
    } catch {}
    window.location.assign("/");
  };
  return (
    <section
      data-getstarted
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden border-t border-border bg-bg px-6 text-center"
    >
      {/* --- animated background --- */}
      {/* living smoke: a real fluid, not CSS — sits under everything else.
          No poster, so preload=metadata keeps a first frame ready; playback
          (and the real fetch) starts as the section nears the viewport. */}
      <video
        ref={lazyLoop}
        src="/media/loops/smoke-loop.webm"
        preload="metadata"
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

        {/* The page's h1 — it used to live inside CrystalHero, a component
            that was never mounted, leaving the landing led by an h2. */}
        <h1
          className="wonk-type font-display text-fg"
          style={{ fontSize: "clamp(2.75rem, 7.5vw, 6rem)", lineHeight: 0.95, letterSpacing: "-0.02em", textShadow: "0 0 40px rgba(0,0,0,0.6)" }}
        >
          Options you can{" "}
          <span className="headline-sweep crt-flicker italic font-light" style={{ paddingRight: "0.14em" }}>
            see
          </span>
          <span className="text-bull crt-flicker" style={{ marginLeft: "-0.04em" }}>
            .
          </span>
        </h1>

        <p className="max-w-xl font-mono text-sm leading-relaxed text-fg-dim md:text-base">
          27 bots, 13 models and 8 live demos in one terminal. Learn it, backtest it,
          and only then trade it — on a $5K paper account, with an AI teacher over
          every Greek and a kill switch under everything.
        </p>

        <div className="mt-1 flex flex-col items-center gap-4 sm:flex-row">
          <MagneticCTA>
            <Link
              href="/trade"
              className="gs-cta group relative inline-flex items-center gap-2 overflow-hidden bg-bull px-9 py-4 font-mono text-sm font-bold uppercase tracking-wider text-bg"
            >
              <span className="relative z-10">{authStatus === "authenticated" ? "Open the chain" : "Get started"}</span>
              <span className="relative z-10 transition-transform group-hover:translate-x-1" aria-hidden>→</span>
            </Link>
          </MagneticCTA>
          {/* Session-aware: a signed-in user was being told to sign in. */}
          {authStatus === "authenticated" ? (
            <Link
              href="/portfolio"
              className="font-mono text-sm uppercase tracking-wider text-fg-dim underline-offset-4 hover:text-fg hover:underline"
            >
              your portfolio →
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="font-mono text-sm uppercase tracking-wider text-fg-dim underline-offset-4 hover:text-fg hover:underline"
            >
              or sign in
            </Link>
          )}
        </div>

        {canReplay && (
          <button
            onClick={replay}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-faint transition-colors hover:text-bull"
          >
            ▶ watch the film
          </button>
        )}

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

        {/* --- the page directory: with no navbar on the landing, this is the
            site's front door. Numbered to match the rail on product pages. --- */}
        <div className="mt-14 w-full max-w-5xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
              everything on the desk
            </span>
            <AuthButtons />
          </div>
          <nav aria-label="Site pages" className="grid grid-cols-1 gap-px border border-border bg-border text-left sm:grid-cols-2 lg:grid-cols-4">
            {DIRECTORY.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group relative bg-bg/80 p-4 backdrop-blur-sm transition-colors hover:bg-surface"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{p.n}</span>
                <span className="mt-1 flex items-center gap-2 font-display text-lg tracking-tightest text-fg">
                  {p.l}
                  <span className="translate-x-0 text-bull opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" aria-hidden>
                    →
                  </span>
                </span>
                <span className="mt-1 block font-mono text-[11px] leading-relaxed text-fg-dim">{p.d}</span>
                <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-bull transition-transform duration-300 group-hover:scale-x-100" />
              </Link>
            ))}
          </nav>
        </div>

        {/* the AI that watches — FULL-BLEED live eye, type set ON the footage,
            edges melted into the void (no box, no border: this is a scene,
            not an embed) */}
        <div className="relative left-1/2 mt-16 w-screen -translate-x-1/2">
          <div className="relative h-[78vh] min-h-[420px] w-full overflow-hidden">
            {/* the matrix eye: an eye built from phosphor code on a CRT —
                monochrome emerald so it belongs to the terminal world. The
                poster covers until the loop lazily fetches near the viewport
                (preload=none: ~1MB stays out of the initial load). */}
            <video
              ref={lazyLoop}
              src="/media/loops/matrix-eye.webm"
              poster="/media/eye/matrix-eye@1600.webp"
              preload="none"
              muted
              loop
              playsInline
              aria-label="An eye drawn in green terminal code, a candlestick chart ticking in its pupil — the AI watches every tick"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                // fade the FOOTAGE itself to transparent on every edge — the section's
                // grid + glow continue through, so there is no rectangle to see.
                // (never paint black over the page: opaque overlays create the very
                // border they're meant to hide)
                // stops chosen so alpha reaches 0 BEFORE every band edge (top edge sits
                // at 66% of ry, sides at 68% of rx — zero by 63% guarantees no paint
                // touches the boundary)
                maskImage:
                  "radial-gradient(ellipse 74% 70% at 50% 46%, black 32%, rgba(0,0,0,0.8) 46%, transparent 63%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 74% 70% at 50% 46%, black 32%, rgba(0,0,0,0.8) 46%, transparent 63%)",
              }}
            />
            {/* no overlay: any full-band shade paints a visible onset line at the
                band boundary. The video's own alpha mask does all the melting;
                the title card carries its own text-shadow. */}
            {/* pupil target brackets + tracking HUD */}
            <div
              className="pointer-events-none absolute left-1/2 top-[46%] size-[26vmin] -translate-x-1/2 -translate-y-1/2"
              aria-hidden
            >
              {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "left-0 bottom-0 border-l border-b", "right-0 bottom-0 border-r border-b"].map((pos) => (
                <span key={pos} className={`absolute size-4 border-bull/80 ${pos}`} />
              ))}
              <span className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bull pulse-dot" />
            </div>
            {/* P(down) card — sparkline + confidence, top-left (ref 06) */}
            <div
              className="pointer-events-none absolute left-[6%] top-[14%] border border-bull/60 bg-bg/70 px-3 py-2 text-left backdrop-blur-sm"
              style={{ animation: "gs-hud 3.2s ease-in-out infinite" }}
              aria-hidden
            >
              <svg viewBox="0 0 120 22" className="h-5 w-28 text-bull" fill="none" aria-hidden>
                <polyline
                  points="0,15 9,12 18,16 27,10 36,13 45,7 54,11 63,6 72,10 81,5 90,9 99,4 108,8 120,3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
              <div className="mt-1.5 font-mono text-[13px] uppercase tracking-wider text-bull md:text-sm">
                P(down) <span className="font-bold">71%</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-dim">confidence</span>
                <span className="flex gap-px" aria-hidden>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={`h-1.5 w-1 ${i < 7 ? "bg-bull" : "bg-fg-faint/40"}`} />
                  ))}
                </span>
              </div>
            </div>
            {/* left index column — live, cache-shared with the ticker (ref 06) */}
            <HudIndexColumn />
            {[
              { l: "78%", t: "20%", label: "IV 0.41", d: "-1.1s" },
              { l: "76%", t: "62%", label: "Δ −0.32", d: "-2.2s" },
            ].map((b) => (
              <div
                key={b.label}
                className="pointer-events-none absolute border border-bull/70 bg-bg/70 px-2.5 py-1.5 text-left font-mono text-[11px] uppercase tracking-wider text-bull backdrop-blur-sm md:text-xs"
                style={{ left: b.l, top: b.t, animation: "gs-hud 3.2s ease-in-out infinite", animationDelay: b.d }}
              >
                {b.label}
              </div>
            ))}
            {/* the line, set like a title card — not a caption */}
            <div className="absolute inset-x-0 bottom-[8%] px-6 text-center">
              <div className="font-display text-bull text-[clamp(1.8rem,4.5vw,3.6rem)] leading-tight [text-shadow:0_2px_30px_rgba(0,0,0,0.95)]">
                27 bots watching,{" "}
                <br className="hidden sm:block" />so you don&apos;t have to.
              </div>
              <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.3em] text-fg-dim [text-shadow:0_1px_12px_rgba(0,0,0,0.9)]">
                every tick · every greek · every regime
              </div>
            </div>
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

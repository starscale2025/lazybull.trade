"use client";

import { useEffect, useState } from "react";

// THE EYE BAND — the first section of the landing, directly after the film.
// Until 2026-11 this component was also the hero (H1, CTA, four chips over a
// decorative payoff, and a nine-cell directory). Frame zero moved the hero to
// components/HeroInstrument.tsx as a real, draggable payoff, and the directory
// went with the chips: the product is described once, by the instrument.

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
  // null until the FIRST quote lands: five permanent "SPY —" dash rows were a
  // whole HUD voice saying nothing whenever the feed is absent (which locally
  // is always — no .env). No skeleton for a decorative layer.
  const [rows, setRows] = useState<{ s: string; v: string; c: string; up: boolean }[] | null>(null);
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
  if (!rows) return null;
  return (
    <div
      className="pointer-events-none absolute left-[5%] top-[38%] hidden space-y-2.5 text-left t-data text-[0.6875rem] tracking-wider md:block"
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

  // PHONES HOLD THE STILL. These loops are atmosphere, and on a narrow screen
  // they are atmosphere that costs about a megabyte: matrix-eye.webm alone is
  // 931KB on top of an 83KB poster, for a decorative band, on the India-first
  // audience STRATEGY.md is written around. Below 768px we never fetch the
  // video and let the poster stand — and swap that poster to the 800px encode
  // (37KB) while we are here. Desktop is untouched.
  if (window.matchMedia("(max-width: 767px)").matches) {
    const small = el.dataset.posterSm;
    if (small) el.poster = small;
    el.removeAttribute("src");
    el.load(); // drop any in-flight fetch; the poster remains
    return;
  }
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

export function GetStarted() {
  return (
    <section
      data-getstarted
      className="relative flex flex-col items-center overflow-hidden bg-bg text-center"
    >
        {/* the AI that watches — FULL-BLEED live eye, type set ON the footage,
            edges melted into the void (no box, no border: this is a scene,
            not an embed) */}
        {/* NO left-1/2 -translate-x-1/2 here: the parent is a flex column with
            items-center, which already centers this band. The classic full-bleed
            double-shift assumes the item starts at the parent's LEFT edge, so on
            a centered flex item it lands 50%·parent − 50%·self off — measured
            30.6px left, cropping the band's left edge and leaving a right gap. */}
        <div className="relative w-screen">
          <div className="eye-title-bed relative h-[78vh] min-h-[26.25rem] w-full overflow-hidden">
            {/* the matrix eye: an eye built from phosphor code on a CRT —
                monochrome emerald so it belongs to the terminal world. The
                poster covers until the loop lazily fetches near the viewport
                (preload=none: ~1MB stays out of the initial load). */}
            <video
              ref={lazyLoop}
              src="/media/loops/matrix-eye.webm"
              poster="/media/eye/matrix-eye@1600.webp"
              data-poster-sm="/media/eye/matrix-eye@800.webp"
              preload="none"
              muted
              loop
              playsInline
              aria-label="An eye drawn in green terminal code, a candlestick chart ticking in its pupil"
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
            {/* still no FULL-BAND overlay: a uniform shade paints a visible
                onset line at the band boundary, and the melting is still the
                video's own alpha mask. The title bed is a different animal —
                .eye-title-bed::after in globals.css, a lower-third pool shaped
                to the title block that is zero alpha at its top and exactly
                var(--bg) at the bottom, so neither of ITS edges lands on a
                boundary. It paints above the footage and below the card. */}
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
            {/* THE GREEKS CARD — was a down-probability panel with a hard
                71 in it and a confidence meter drawn to match.
                The memo: a fabricated prediction rendered as decoration on the
                homepage. Nobody ran a model to get that number; it was a
                designer's figure set in the typography of a real one. Whatever
                it did for the composition, it advertised a direction call from
                a product that makes none.
                What replaces it is TRUE and still decorative: the four Greeks
                this workbench actually computes and redraws while you drag,
                named in the same phosphor. No number, so no number to invent.
                (The sparkline stays: an unlabelled line with no axis is a
                texture, not a claim.) */}
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
              <div className="mt-1.5 font-mono text-[0.8125rem] uppercase tracking-wider text-bull md:text-sm">
                Δ · Γ · Θ · ν
              </div>
              <div className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-fg-dim">
                live as you drag
              </div>
            </div>
            {/* left index column — live, cache-shared with the ticker (ref 06) */}
            <HudIndexColumn />
            {/* the line, set like a title card — not a caption */}
            <div className="absolute inset-x-0 bottom-[8%] z-10 px-6 text-center">
              {/* THE BAND'S TITLE. It used to count the bots and promise they
                  were watching the market for you. The memo calls that
                  signal-language, and it is: it says the machines are minding
                  the tape on the reader's behalf, which is a service we do not
                  sell and cannot sell unregistered. The band's real subject is
                  the teaching, so the title names the teaching. */}
              <div className="font-display text-fg font-semibold text-[clamp(1.8rem,4.5vw,3.6rem)] leading-tight [text-shadow:0_1px_2px_var(--bg),0_0_14px_var(--bg),0_0_44px_var(--bg)]">
                Every Greek, explained{" "}
                <br className="hidden sm:block" />while you drag.
              </div>
              <div className="mt-3 t-eyebrow text-fg-dim [text-shadow:0_1px_2px_var(--bg),0_0_14px_var(--bg)]">
                see it · understand it · practise it
              </div>
            </div>
          </div>
        </div>

      <style>{`
        @keyframes gs-hud { 0%,100% { opacity: 0.55; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="gs-hud"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MagneticCTA } from "./atmosphere/MagneticCTA";
import { AuthButtons } from "./AuthButtons";
import { HeroPayoff } from "./HeroPayoff";
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
      className="pointer-events-none absolute left-[5%] top-[38%] hidden space-y-2.5 text-left t-data text-[11px] tracking-wider md:block"
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

const FEATURES = [
  "Visual options chain",
  "27 quant bots · 13 models",
  "AI crash detection",
  "$5K paper account",
];

// Deterministic ghost candle series — a climb into a dip, echoing the cinema.
// STATIC on purpose: at 20% opacity a breathing scaleY read as noise, not
// life, under a headline that already flickers. The smoke loop is the one
// moving thing in the background now.
const CANDLES = Array.from({ length: 32 }, (_, i) => {
  const t = i / 31;
  const trend = t < 0.75 ? t / 0.75 : 1 - ((t - 0.75) / 0.25) * 0.5;
  const h = 18 + trend * 68 + Math.sin(i * 0.8) * 8;
  return {
    h: Math.max(10, Math.min(96, h)),
    up: Math.sin(i * 0.8) > -0.2 && t < 0.78,
  };
});

export function GetStarted() {
  const { status: authStatus } = useSession();
  // Which shape the hero's payoff instrument is drawing. Four states, driven by
  // the four chips below it — not per-frame, so React state is the right tool.
  const [payoffState, setPayoffState] = useState(0);
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
        style={{
          // Fade the footage out before the section's bottom edge. Without this
          // the section's overflow-hidden shears the smoke off mid-plume, and
          // that straight line is the seam under the eye band.
          maskImage: "linear-gradient(to top, transparent 0%, black 26%)",
          WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 26%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      {/* Static glow pools — the drift animation is gone. The smoke loop is the
          background's one mover; two more slow drifters under it read as churn. */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[520px] w-[520px] rounded-full bg-bull/12 blur-[150px]" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 h-[440px] w-[440px] rounded-full bg-cyan/10 blur-[150px]" />

      {/* ghost candle chart along the bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[44%] items-end justify-center gap-[5px] px-6 opacity-20 sm:gap-[7px]"
        style={{
          // The bars stand ON the section's bottom edge, so the clip cut every
          // one of them off flat. Dissolve their footing instead — atmosphere
          // at 20% opacity reads better melting into the void than sitting on
          // a visible floor.
          maskImage: "linear-gradient(to top, transparent 0%, black 20%)",
          WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 20%)",
        }}
      >
        {CANDLES.map((c, i) => {
          const color = c.up ? "var(--bull)" : "var(--bear)";
          return (
            <div
              key={i}
              className="relative flex w-[1.4%] max-w-[13px] items-end justify-center"
              style={{ height: `${c.h}%` }}
            >
              <span className="absolute -top-2.5 left-1/2 h-2.5 w-px -translate-x-1/2" style={{ background: color, opacity: 0.5 }} />
              <span className="w-full" style={{ height: "100%", background: color, boxShadow: `0 0 8px ${c.up ? "rgba(0,255,135,0.4)" : "rgba(255,46,99,0.4)"}` }} />
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 scanlines opacity-30" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 44%, rgba(0,0,0,0.72) 100%)" }}
      />
      {/* THE HAND-OFF. Everything above is clipped by this section's
          overflow-hidden, so without a ramp the whole background stack — smoke,
          candles, orbs, grid — ended on one straight full-width line right
          under the eye band, with the next section's border stacked on it.
          This ramps to the page background instead, so the band has no edge of
          its own and the marketing region simply begins. Starts fully
          transparent: a uniform shade would paint the very onset line it is
          here to remove (same reason the eye's footage is alpha-masked rather
          than covered). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%]"
        style={{ background: "linear-gradient(to bottom, transparent 0%, var(--bg) 92%)" }}
      />

      {/* --- content --- */}
      {/* w-full is load-bearing. The eye band below is deliberately full-bleed
          (`w-screen`), and without an explicit width here that child inflated
          this column's min-content width to 100vw — so every sibling stretched
          past the section's own px-6 and the h1 and lede sat hard against both
          bezels on a phone (measured: 0px gutter at 360px, 2px at 390px).
          Sizing this column from the parent's PADDED box instead lets the band
          overflow it without dragging the type out with it. */}
      <div className="relative flex w-full flex-col items-center gap-8">
        <span className="ambient-glow inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-3 py-1 t-chrome text-bull">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" /> paper-only · $0 at risk, ever
        </span>

        {/* The page's h1 — it used to live inside CrystalHero, a component
            that was never mounted, leaving the landing led by an h2. */}
        <h1
          className="wonk-type font-display text-fg"
          style={{ fontSize: "clamp(2.75rem, 7.5vw, 6rem)", lineHeight: 0.95, letterSpacing: "-0.02em", textShadow: "0 0 40px rgba(0,0,0,0.6)" }}
        >
          Options you can{" "}
          <span className="headline-sweep crt-flicker t-accent" style={{ paddingRight: "0.14em" }}>
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

        {/* sm:gap-8 is a composition call, not a clearance measurement: the
            key now has a hard 1px edge and a defined radius, and at gap-4 the
            quiet text link sat close enough to read as a second control. The
            key's actual lateral light is ~2px (both outer layers carry a
            negative spread), so nothing here is clearing a halo. */}
        <div className="mt-1 flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <MagneticCTA>
            {/* THE PRIMARY KEY. Fill, ink, 1px bull border, the --r-btn role
                radius and the 0.25 rest specular all come from
                .btn-primary-glass — the promoted sitewide primary the nav and
                footer already wear — so the hero key and the nav key are one
                control at two sizes. .gs-cta adds only the hero-weight seat
                (see the <style> below).
                bg-bull and text-bg are gone ON PURPOSE: they are utilities, so
                they sit in a later layer than the component class and would
                have silently beaten it; and text-bg painted near-white ink on
                mint in the light theme (~2.9:1), which #04140b fixes (~10:1).
                No overflow-hidden either — the sheen is clipped by its own
                radius now, the fix .specular documents in globals.css. */}
            <Link
              href="/trade"
              className="gs-cta btn-primary-glass group relative inline-flex items-center gap-2 px-9 py-4 font-mono text-sm font-bold uppercase tracking-wider"
            >
              <span className="relative z-10">{authStatus === "authenticated" ? "Open the chain" : "Get started"}</span>
              <span className="relative z-10 transition-transform duration-300 [transition-timing-function:var(--ease-settle)] group-hover:translate-x-1" aria-hidden>→</span>
            </Link>
          </MagneticCTA>
          {/* Session-aware: a signed-in user was being told to sign in.
              Same 14px mono as the key — a control keeps its own size — but a
              persistent hairline rule now says "text link" at a glance, so it
              stops reading as a second, unfilled button competing with the
              primary. It warms to phosphor on hover, on the one curve. py-3
              buys the 44px touch target the bare inline link never had. */}
          {authStatus === "authenticated" ? (
            <Link
              href="/portfolio"
              className="inline-flex items-center py-3 font-mono text-sm uppercase tracking-wider text-fg-dim underline decoration-fg-faint/40 underline-offset-4 transition-[color,text-decoration-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:text-fg hover:decoration-bull"
            >
              your portfolio →
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="inline-flex items-center py-3 font-mono text-sm uppercase tracking-wider text-fg-dim underline decoration-fg-faint/40 underline-offset-4 transition-[color,text-decoration-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:text-fg hover:decoration-bull"
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

        {/* Four spec chips, hung DEAD STILL. The wire survives as a motif — it
            is the one piece of physicality on the page — but the pendulums are
            gone, and so are the three arbitrary drop heights (34/48/62, which
            put chip 4 back at chip 1's height and made the group read as a
            dropped handful rather than a composed row). What replaces them is a
            rack: ONE rail, four identical 24px drops off four evenly lit nodes,
            four chip tops on one baseline.

            NOTHING MOVES, including on arrival. No data-gsap here on purpose:
            the note at the top of this file states the invariant — this
            component runs continuous, NOT entrance, effects so the cinema's
            baked reveal frame matches and the hand-off stays seamless. An
            entrance stagger on the hero's own chips would break that.

            MATERIAL: the same recipe as the page directory below, at chip
            scale. .surface-instrument is the sanctioned "instrument density"
            class — the role radius plus the top specular and NOTHING else,
            deliberately no backdrop-filter — over the same --glass-bg-strong
            fill and --glass-border hairline the directory's cells use. The old
            chip stacked surface-card and then overrode both of its properties
            with rounded-full and backdrop-blur-sm (utilities beat @layer
            components), so it was paying for a recipe it discarded and running
            a 4px blur that flattened nothing. This page now frosts exactly one
            surface — the directory sheet — which is what globals.css's frost
            note asks for.

            Rail and wires are lg-only: a rail cannot span a wrapped row. Below
            that the chips are a plain 2-up (1-up on phones), shrink-wrapped and
            centred — never full-width, because a full-width pill reads as a
            button and these are labels. lg is also where the directory below
            goes four-across, so the rail and the table resolve together. */}
        <div className="relative mt-3 max-w-lg lg:max-w-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-px hidden h-px lg:block"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--bull) 30%, transparent) 9%, color-mix(in srgb, var(--bull) 30%, transparent) 91%, transparent 100%)",
            }}
          />
          {/* THE INSTRUMENT. The four chips are no longer labels — they are the
              controls of a real payoff diagram, so the hero DEMONSTRATES
              "options you can see" instead of asserting it one line under the
              words. See components/HeroPayoff.tsx. */}
          <div className="flex w-full flex-col items-center gap-5">
            <HeroPayoff
              labels={FEATURES}
              activeIndex={payoffState}
              onActivate={setPayoffState}
            />
          </div>
        </div>

        {/* --- the page directory: with no navbar on the landing, this is the
            site's front door. Numbered to match the rail on product pages. --- */}
        <div className="mt-14 w-full max-w-5xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="t-eyebrow text-fg-faint">
              everything on the desk
            </span>
            <AuthButtons />
          </div>
          {/* ONE sheet of frosted glass with the pages ruled onto it — not 8
              cards. `gap-px` over a container background is the hairline
              lattice this site uses everywhere; rounding each CELL would tear
              it (at 8px every tile pulls off the shared seam and leaves a notch
              at all 12 interior junctions), so the radius goes on the sheet and
              overflow-hidden clips the four outer corners. Note that this means
              only the SHEET's four corners round — the interior corners stay
              square, which is the read an instrument face wants.

              The frost lives HERE, once. globals.css makes backdrop-filter
              opt-in because it costs a GPU readback per element; 8 cells each
              blurring was 8 readbacks for a 4px blur that never actually
              flattened the candles behind them — which is why the cells had to
              be near-opaque to stay readable. One --glass-blur on the sheet
              (26px + saturate) smooths the whole backdrop and the translucent
              cells composite over it for free. .surface-card is taken purely
              for that frost; its radius and shadow are reshaped by the
              utilities beside it, which is exactly the escape hatch the class
              is layered to allow.

              p-px, not a border: it exposes 1px of the nav's own ground so the
              outer frame and the interior seams are the same hairline of the
              same token (lit in dark, dark on warm paper, no branch), it gives
              --glass-hi's inset top/right highlight a strip to actually paint
              on instead of hiding it under the cells, and it keeps the focus
              ring off the overflow clip boundary (see the focus-law exception
              in globals.css). */}
          <nav aria-label="Site pages" className="surface-card grid grid-cols-1 gap-px overflow-hidden rounded-[var(--r-instrument)] bg-[var(--glass-border)] p-px text-left shadow-[var(--glass-hi),var(--glass-glow)] sm:grid-cols-2 lg:grid-cols-4">
            {DIRECTORY.map((p) => (
              // A pane, not a card: no frost of its own (the sheet carries it)
              // and no literal colour. --glass-bg-strong is the fill
              // globals.css prescribes when type has to stay legible over
              // atmosphere — right for an 11px mono line on the ghost candles,
              // and strictly MORE legible than the old hover, which repainted
              // the cell with bg-surface (rgba(255,255,255,0.035), effectively
              // nothing). Hover drops to the lighter --glass-bg: the frost
              // THINS where you touch it while the bull underline sweeps in.
              // Both tokens flip to white on the light theme, so a dark fill
              // never smudges the paper. No transition-colors: that utility
              // ships its own curve and overrode the @layer base rule giving
              // every anchor --ease-settle. Dropping it puts the hover back on
              // the brand's one curve.
              <Link
                key={p.href}
                href={p.href}
                className="group relative bg-[var(--glass-bg-strong)] p-4 hover:bg-[var(--glass-bg)]"
              >
                <span className="t-chrome text-fg-faint">{p.n}</span>
                <span className="mt-1 flex items-center gap-2 font-display text-lg tracking-tightest text-fg">
                  {p.l}
                  <span className="translate-x-0 text-bull opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" aria-hidden>
                    →
                  </span>
                </span>
                {/* The description is DISCLOSURE, not furniture: 8 cells × 11px
                    blurb was ~40% of the hero's text mass repeated by the
                    footer's 24 links. Opacity (not height) so the sheet never
                    reflows; still in the DOM for crawlers and readers. Coarse
                    pointers have no hover, so they keep the line. */}
                <span className="mt-1 block font-mono text-[11px] leading-relaxed text-fg-dim opacity-0 transition-opacity duration-300 [transition-timing-function:var(--ease-settle)] group-hover:opacity-100 group-focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100">{p.d}</span>
                <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-bull transition-transform duration-300 group-hover:scale-x-100" />
              </Link>
            ))}
          </nav>
        </div>

        {/* the AI that watches — FULL-BLEED live eye, type set ON the footage,
            edges melted into the void (no box, no border: this is a scene,
            not an embed) */}
        {/* NO left-1/2 -translate-x-1/2 here: the parent is a flex column with
            items-center, which already centers this band. The classic full-bleed
            double-shift assumes the item starts at the parent's LEFT edge, so on
            a centered flex item it lands 50%·parent − 50%·self off — measured
            30.6px left, cropping the band's left edge and leaving a right gap. */}
        <div className="relative mt-16 w-screen">
          <div className="eye-title-bed relative h-[78vh] min-h-[420px] w-full overflow-hidden">
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
              {/* IV and Δ used to float free over the footage — two more bobbing
                  voices, the Δ badge sitting inside the title's own line box.
                  Pinned here as one data row: the band keeps its two voices,
                  P(down) and the title. */}
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-bull/90">
                IV 0.41 · Δ −0.32
              </div>
            </div>
            {/* left index column — live, cache-shared with the ticker (ref 06) */}
            <HudIndexColumn />
            {/* the line, set like a title card — not a caption */}
            <div className="absolute inset-x-0 bottom-[8%] z-10 px-6 text-center">
              <div className="font-display text-fg font-semibold text-[clamp(1.8rem,4.5vw,3.6rem)] leading-tight [text-shadow:0_1px_2px_var(--bg),0_0_14px_var(--bg),0_0_44px_var(--bg)]">
                27 bots watching,{" "}
                <br className="hidden sm:block" />so you don&apos;t have to.
              </div>
              <div className="mt-3 t-eyebrow text-fg-dim [text-shadow:0_1px_2px_var(--bg),0_0_14px_var(--bg)]">
                every tick · every greek · every regime
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* (gs-ember and gs-candle-breathe are gone: the embers are deleted and
           the ghost candles hold still — the smoke loop carries the ambience,
           so the h1 flicker and the CTA sheen read as the focal motion.) */
        /* THE PRIMARY KEY'S SEAT — elevation is SHAPED here, never bloomed.
           gs-cta-glow is gone. It breathed a +7px POSITIVE spread at 0.62
           alpha, i.e. 7px of unblurred green standing outside the border box
           before the Gaussian falloff even began, which is exactly why the
           control read as melting instead of clickable. What replaces it holds
           the edge at every moment: ONE hairline phosphor ring sitting AT the
           border (it sharpens the boundary as it brightens) over pooled layers
           that all carry a NEGATIVE spread, so the hard core of every shadow
           stays inside its own blur and nothing unblurred can cross the edge.
           Measured reach: the old halo was ~30px omnidirectional WITH that 7px
           opaque core; this is ~24px below, ~2px at the sides and 0 above — a
           directional seat, not a halo. Brighter, not bigger.
           And nothing breathes: this section already runs smoke, embers,
           scanlines, four pulse-dots and a flickering headline, so the one
           thing that should be still and hard is the primary action. (A
           breathing box-shadow also overrode any :hover box-shadow, which is
           why the old button had no hover elevation at all.)
           NOT --glow-bull, though it is the same ring-plus-negative-spread
           construction and is a named token: --glow-bull is baked rgba with no
           [data-theme="light"] override, so it fogs warm paper. The color-mix
           form below follows --bull into the light theme. If --glow-bull ever
           gains a light value, this should collapse back onto it.
           NOTE: this block is unlayered, so it deliberately wins over
           .btn-primary-glass's own box-shadow — the fill, ink, border and
           radius still come from there. */
        .gs-cta {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -1px 0 rgba(4,20,11,0.22),
            0 0 0 1px color-mix(in srgb, var(--bull) 38%, transparent),
            0 10px 26px -12px color-mix(in srgb, var(--bull) 62%, transparent),
            0 22px 60px -28px color-mix(in srgb, var(--bull) 52%, transparent);
        }
        /* (The focus law no longer squares rounded controls, so the local
           border-radius patch that used to live here is gone.) */
        /* Hover raises the RING and tightens the near seat; the outer pool does
           NOT grow. The magnetic wrapper already fades a cursor-tracked radial
           in behind the button on hover (.magnetic-glow::after), and letting
           the button bloom on top of that would rebuild the original problem
           one interaction later. Crisper on hover, never blurrier. Specular
           goes 0.25 -> 0.30, which is UNDER the 0.32 .btn-primary-glass:hover
           already ships at the h-14 marketing size; the 0.25-not-0.4 note in
           globals.css is about the REST state. */
        .gs-cta:hover {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.3),
            inset 0 -1px 0 rgba(4,20,11,0.22),
            0 0 0 1px color-mix(in srgb, var(--bull) 66%, transparent),
            0 14px 34px -14px color-mix(in srgb, var(--bull) 78%, transparent),
            0 24px 62px -30px color-mix(in srgb, var(--bull) 55%, transparent);
        }
        /* Pressed: the specular dims, an inner top shade appears and the pool
           collapses — the key sinks into its own light. Rides the same
           0.3s --ease-settle transition .btn-primary-glass already declares. */
        .gs-cta:active {
          box-shadow:
            inset 0 2px 5px -2px rgba(4,20,11,0.38),
            inset 0 1px 0 rgba(255,255,255,0.14),
            0 0 0 1px color-mix(in srgb, var(--bull) 55%, transparent),
            0 4px 14px -10px color-mix(in srgb, var(--bull) 60%, transparent);
        }
        /* The specular pass: a 16%-wide streak at 0.26 white, where it was a
           28%-wide band at 0.6 — on a mint face that blew out to the 2010s
           gloss globals.css warns about. It whips across on the brand curve
           and then RESTS for four fifths of a 6s cycle, so it reads as light
           catching a machined edge rather than a showroom lamp on a turntable.
           border-radius: inherit is what clips it to the 13px corners, which is
           why the button no longer needs overflow-hidden. */
        .gs-cta::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.26) 50%, transparent 58%); background-size: 260% 100%; background-repeat: no-repeat; animation: gs-cta-shine 6s var(--ease-settle) infinite; }
        @keyframes gs-cta-shine { 0% { background-position: 180% 0; } 22%,100% { background-position: -130% 0; } }
        @keyframes gs-hud { 0%,100% { opacity: 0.55; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
        @media (prefers-reduced-motion: reduce) {
          /* The sheen gets animation:none AND opacity:0 — belt and braces,
             since a decorative specular's readable final state is that it is
             absent. (For the record: animation:none alone would NOT smear it. A
             background-position of 0% on a 260%-wide image aligns image-0% to
             area-0%, parking the streak fully off-screen right — verified in a
             browser. The declaration is intent, not a rescue.) */
          .gs-cta::after { animation: none; opacity: 0; }
          [style*="gs-hud"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}

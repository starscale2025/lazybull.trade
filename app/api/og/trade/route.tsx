// /api/og/trade?t=<share param> — the share card for a copied trade.
//
// The other half of lib/share-trade.ts. A link with no picture is a link
// nobody clicks, and the memo's growth section named the missing loop exactly:
// "No shareable 'copy this trade' card / deep link". This route draws the one
// thing worth showing — the payoff curve of the position that was shared —
// from the SAME pricing functions the app uses, so the card cannot disagree
// with the page it points at.
//
// SAFETY. `t` is attacker-controlled. It goes through decodeLegs() and nothing
// else: bounded length, bounded leg count, every number range-checked, and a
// flat 400 for anything that fails. Nothing from the URL is rendered as text —
// the underlying is regex-bounded to a ticker and every other glyph on the
// card is computed here.
//
// FONTS. Same three subsetted TTFs app/opengraph-image.tsx uses (assets/
// og-fonts, cut from the woff2 files next/font already ships, ~95KB total,
// read from disk and never sent to a browser). Satori has no default font and
// THROWS without one, so the read is memoised and guarded: if the files are
// missing from a deployment bundle the route answers 500 rather than melting
// down inside the renderer.

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeLegs, MAX_SHARE_PARAM } from "@/lib/share-trade";
import { SITE_URL } from "@/lib/site";
import { detect } from "@/lib/detector";
import { pnlCurve, pnlSummary } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const DISPLAY = "Fraunces";
const MONO = "JetBrains Mono";

const BG = "#050505";
const FG = "#f5f5f0";
const DIM = "#8a8a82";
const BULL = "#00ff87";
const BEAR = "#ff2e63";
const GRID = "rgba(245,245,240,0.06)";

const SIZE = { width: 1200, height: 630 };

/** The wordmark, derived from the canonical origin rather than typed. The
 *  brand's host has already moved once (lib/site.ts) and every hard-coded copy
 *  of it became a dead domain on a shared image nobody could re-publish. */
const WORDMARK = (() => {
  try {
    return new URL(SITE_URL).host.replace(/^www\./, "");
  } catch {
    return "lazybull";
  }
})();

let fontCache: { name: string; data: Buffer; weight: 400 | 600; style: "normal" | "italic" }[] | null =
  null;
function fonts() {
  if (fontCache) return fontCache;
  const read = (f: string) => readFileSync(join(process.cwd(), "assets", "og-fonts", f));
  fontCache = [
    { name: DISPLAY, data: read("Fraunces-Display.ttf"), weight: 600 as const, style: "normal" as const },
    { name: DISPLAY, data: read("Fraunces-Display-Italic.ttf"), weight: 600 as const, style: "italic" as const },
    { name: MONO, data: read("JetBrainsMono.ttf"), weight: 400 as const, style: "normal" as const },
  ];
  return fontCache;
}

const money = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}`;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("t");
  // Bound before parsing, not after: a megabyte of `t` should never reach a
  // regex, let alone a renderer.
  if (!raw || raw.length > MAX_SHARE_PARAM) {
    return new Response("invalid trade", { status: 400 });
  }
  const trade = decodeLegs(raw);
  if (!trade) return new Response("invalid trade", { status: 400 });

  const { legs, spot, underlying, daysToExpiry } = trade;
  const detection = detect(legs);
  const summary = pnlSummary(legs, spot);

  // Does profit grow without bound above the range? The right-tail slope of the
  // wide curve answers it; pnlSummary already answers the loss side.
  const wide = pnlCurve(legs, spot, 0.6, 401);
  const uncappedUp = wide[wide.length - 1].pnl - wide[wide.length - 2].pnl > 0;

  // ── the payoff figure, in the card's own coordinate space ──────────────────
  // Vertical bands are hand-balanced against the type below (the column uses
  // flex-start + explicit margins, NOT space-between: space-between packed the
  // stat row up into the curve and printed the numbers over the loss fill).
  //   56 pad · 24 eyebrow · 18 · 120 position · [FIGURE] · 67 stats · 51 · 46 footer
  const x0 = 72;
  const x1 = 1128;
  const yTop = 236;
  const yBot = 362;
  const curve = pnlCurve(legs, spot, 0.35, 81);
  const sMin = curve[0].s;
  const sMax = curve[curve.length - 1].s;
  const pnls = curve.map((p) => p.pnl);
  let lo = Math.min(...pnls, 0);
  let hi = Math.max(...pnls, 0);
  const pad = (hi - lo || 1) * 0.14;
  lo -= pad;
  hi += pad;
  const X = (s: number) => x0 + ((s - sMin) / (sMax - sMin || 1)) * (x1 - x0);
  const Y = (p: number) => yBot - ((p - lo) / (hi - lo || 1)) * (yBot - yTop);
  const yZero = Y(0);
  const line = curve.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.s).toFixed(1)},${Y(p.pnl).toFixed(1)}`).join(" ");
  const above = curve.map((p) => `L${X(p.s).toFixed(1)},${Y(Math.max(0, p.pnl)).toFixed(1)}`).join(" ");
  const below = curve.map((p) => `L${X(p.s).toFixed(1)},${Y(Math.min(0, p.pnl)).toFixed(1)}`).join(" ");

  const stats: { k: string; v: string; c: string }[] = [
    { k: "max profit", v: uncappedUp ? "uncapped" : money(summary.maxProfit), c: BULL },
    { k: "max loss", v: summary.unboundedRisk ? "unbounded" : money(summary.maxLoss), c: BEAR },
    {
      k: summary.breakevens.length === 1 ? "breakeven" : "breakevens",
      v: summary.breakevens.length ? summary.breakevens.map((b) => b.toFixed(2)).join(" / ") : "—",
      c: FG,
    },
  ];

  let fontData;
  try {
    fontData = fonts();
  } catch {
    // Without a font Satori throws inside the renderer; fail cleanly instead.
    return new Response("card unavailable", { status: 500 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          background: BG,
          padding: "56px 72px",
          position: "relative",
        }}
      >
        {/* hairline grid — the terminal ground */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {Array.from({ length: 11 }, (_, i) => (
            <div
              key={i}
              style={{ position: "absolute", left: (i + 1) * 100, top: 0, bottom: 0, width: 1, background: GRID }}
            />
          ))}
        </div>

        {/* the payoff curve, drawn from the same pnlCurve the app draws */}
        <svg width={SIZE.width} height={SIZE.height} viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={`M${X(sMin).toFixed(1)},${yZero.toFixed(1)} ${above} L${X(sMax).toFixed(1)},${yZero.toFixed(1)} Z`} fill={BULL} fillOpacity={0.16} />
          <path d={`M${X(sMin).toFixed(1)},${yZero.toFixed(1)} ${below} L${X(sMax).toFixed(1)},${yZero.toFixed(1)} Z`} fill={BEAR} fillOpacity={0.16} />
          <line x1={x0} y1={yZero} x2={x1} y2={yZero} stroke={DIM} strokeWidth={1} strokeDasharray="4 7" />
          <line x1={X(spot)} y1={yTop - 14} x2={X(spot)} y2={yBot + 14} stroke={FG} strokeOpacity={0.28} strokeWidth={1} strokeDasharray="3 5" />
          <path d={line} stroke={FG} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </svg>

        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: MONO,
            fontSize: 20,
            letterSpacing: 4,
            color: BULL,
            textTransform: "uppercase",
          }}
        >
          <div style={{ width: 9, height: 9, borderRadius: 9, background: BULL }} />
          shared trade · paper only · $0 at risk
        </div>

        {/* the position */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 78, lineHeight: 1, letterSpacing: -3, color: FG, fontWeight: 600 }}>
              {detection.kind}
            </div>
            <div style={{ display: "flex", fontFamily: MONO, fontSize: 30, color: BULL, letterSpacing: 1 }}>
              {underlying}
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: MONO, fontSize: 23, color: DIM, letterSpacing: -0.2 }}>
            {/* ONE text node, not five interpolations: every child of a Satori
                flex box becomes a flex item, and the separators would be laid
                out as items rather than read as a sentence. */}
            {`${legs.length} leg${legs.length === 1 ? "" : "s"} · ${daysToExpiry}d to expiry · spot $${spot.toFixed(2)} · ${detection.bias}`}
          </div>
        </div>

        {/* the numbers, clear of the figure above */}
        <div style={{ display: "flex", gap: 56, marginTop: 182 }}>
          {stats.map((s) => (
            <div key={s.k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", fontFamily: MONO, fontSize: 17, letterSpacing: 3, color: DIM, textTransform: "uppercase" }}>
                {s.k}
              </div>
              <div style={{ display: "flex", fontFamily: MONO, fontSize: 34, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* footer rule */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: MONO,
            fontSize: 21,
            color: DIM,
            letterSpacing: 2,
            borderTop: "1px solid rgba(245,245,240,0.12)",
            marginTop: 51,
            paddingTop: 20,
          }}
        >
          <div style={{ display: "flex", color: FG, letterSpacing: 1 }}>{WORDMARK}</div>
          <div style={{ display: "flex" }}>paper only · educational · not advice</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: fontData.map((f) => ({ ...f, data: f.data as unknown as ArrayBuffer })),
      headers: {
        // A pure function of `t` — cache it hard at the edge and in the crawler.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    }
  );
}

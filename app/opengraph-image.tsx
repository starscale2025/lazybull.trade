import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TAGLINE, TAGLINE_LEAD } from "@/lib/cinema";
import { bullMarkPoints } from "@/lib/bull-mark";

// The share card: what a stranger sees of this site before they visit it.
//
// It draws the one object the whole product is about, a long-call payoff (flat
// at max loss, a hard kink at the strike, uncapped above it), under the
// headline the homepage opens on, in the brand's own type and colour:
// the bull mark and "lazybull." as the nav sets them, "see." in the brand
// gradient (it was flat mint), and the subhead in the site's sans,
// Bricolage Grotesque (it was mono).
//
// THE FONTS. Satori falls back to Helvetica, silently, when it is handed no
// font data, so the card brings its own. assets/og-fonts/* are cut from the
// very woff2 files next/font already ships, so they cannot drift from the live
// site and nothing was downloaded to make them: Fraunces at opsz 144 / wght
// 600 with SOFT and WONK at 0, Bricolage Grotesque at opsz 24 / wght 450, and
// JetBrains Mono, each subsetted to printable ASCII plus the punctuation the
// copy uses. They are read at BUILD time only: this route prerenders to a PNG,
// so not one of those bytes reaches a browser.

const font = (f: string) => readFileSync(join(process.cwd(), "assets", "og-fonts", f));
const DISPLAY = "Fraunces";
const SANS = "Bricolage Grotesque";

// The wordmark is the BRAND, not a hostname: the .trade host this used to
// name does not resolve, and a share card is the one surface people read a
// domain off and type back in.
export const alt = "lazybull. Options you can see.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#050505";
const FG = "#f5f5f0";
const DIM = "#8a8a82";
const BULL = "#52ffa5";
const BEAR = "#ff2e63";
const GRID = "rgba(245,245,240,0.06)";
// The bull mark's ramp (components/BullMark.tsx), violet to blue to mint.
const RAMP = ["#7b5cff", "#4d8dff", "#6dffc0"];

export default function Image() {
  // The payoff geometry, in the card's own coordinate space, confined to the
  // band between the subhead (ends near y=400) and the footer rule (near
  // y=522), so the rising leg never strikes through the word "see".
  const x0 = 88, x1 = 1112;
  const yLoss = 498; // the flat max-loss leg
  const yZero = 458; // the dashed zero line, above it
  const yPeak = 410; // where the uncapped leg exits the frame
  const kink = 610; // the strike

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "56px 72px 60px",
          position: "relative",
        }}
      >
        {/* hairline grid: the terminal ground */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ position: "absolute", left: (i + 1) * 100, top: 0, bottom: 0, width: 1, background: GRID }} />
          ))}
        </div>

        {/* the payoff: loss in red, profit in mint, the only colours that mean money */}
        <svg width={1200} height={630} viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <line x1={x0} y1={yZero} x2={x1} y2={yZero} stroke={DIM} strokeWidth={1} strokeDasharray="4 7" />
          <path d={`M ${x0} ${yLoss} L ${kink} ${yLoss}`} stroke={BEAR} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d={`M ${kink} ${yLoss} L ${x1} ${yPeak}`} stroke={BULL} strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={kink} cy={yLoss} r={7} fill={BULL} />
        </svg>

        {/* the mark and the wordmark, as the nav sets them; the promise on the right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width={56} height={40} viewBox="0 0 28 20">
              <defs>
                <linearGradient id="ramp" x1="0" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor={RAMP[0]} />
                  <stop offset="0.52" stopColor={RAMP[1]} />
                  <stop offset="1" stopColor={RAMP[2]} />
                </linearGradient>
              </defs>
              <polyline
                points={bullMarkPoints(28, 20, 2)}
                stroke="url(#ramp)"
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, letterSpacing: -1, color: FG }}>
              lazybull.
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: SANS, fontSize: 24, color: DIM }}>Paper only · $0 at risk, ever</div>
        </div>

        {/* the thesis */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: -40 }}>
          <div
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontSize: 116,
              lineHeight: 1,
              letterSpacing: -4,
              color: FG,
              fontWeight: 600,
            }}
          >
            Options you can&nbsp;
            <span
              style={{
                fontStyle: "italic",
                backgroundImage: `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[1]} 52%, ${RAMP[2]})`,
                backgroundClip: "text",
                color: "transparent",
                marginLeft: -10, // the italic's own side bearing already opens the gap
                paddingRight: 8,
              }}
            >
              see.
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: SANS, fontSize: 30, letterSpacing: -0.3 }}>
            <div style={{ display: "flex", color: DIM }}>27 bots · 13 models · 8 live demos</div>
            <div style={{ display: "flex", color: FG }}>{`${TAGLINE_LEAD} ${TAGLINE}`}</div>
          </div>
        </div>

        {/* footer rule */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: SANS,
            fontSize: 24,
            color: DIM,
            borderTop: "1px solid rgba(245,245,240,0.12)",
            paddingTop: 20,
          }}
        >
          <div style={{ display: "flex", color: FG }}>lazybull.us</div>
          <div style={{ display: "flex" }}>Max loss can be a number you choose</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: DISPLAY, data: font("Fraunces-Display.ttf"), weight: 600, style: "normal" },
        { name: DISPLAY, data: font("Fraunces-Display-Italic.ttf"), weight: 600, style: "italic" },
        { name: SANS, data: font("BricolageGrotesque.ttf"), weight: 400, style: "normal" },
      ],
    }
  );
}

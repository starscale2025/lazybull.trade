import { ImageResponse } from "next/og";

// The share card. There wasn't one — /opengraph-image 404'd and the metadata
// carried no openGraph block, so every link to this site rendered as bare text.
//
// Deliberately typographic and dependency-free: no font fetch, no image fetch,
// nothing that can fail at build time or in a preview deploy. It draws the one
// object the whole product is about — a long-call payoff, flat at max loss,
// hard kink at the strike, uncapped above it — in the brand's own tokens.
//
// This is the INTERIM card. The intended final frame is a render of the fused
// price ladder (cone + strikes + payoff on one axis); when that exists, this is
// the file it replaces.

export const alt = "lazybull.trade — Options you can see";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#050505";
const FG = "#f5f5f0";
const DIM = "#8a8a82";
const BULL = "#00ff87";
const BEAR = "#ff2e63";
const GRID = "rgba(245,245,240,0.06)";

export default function Image() {
  // The payoff geometry, in the card's own coordinate space.
  //
  // Confined to the band BELOW the type on purpose: the first cut ran the
  // rising leg up through the headline and struck out the word "see", which is
  // the one word on the card that must not be defaced.
  //
  // Read left to right it is a long call: flat at max loss below the strike,
  // a hard kink AT the strike, then uncapped — crossing the dashed zero line at
  // breakeven. The shape is the argument.
  // It has to clear BOTH neighbours: the subhead ends around y=390 and the
  // footer rule starts around y=522, so the whole figure lives in between.
  const x0 = 88, x1 = 1112;
  const yLoss = 498;   // the flat max-loss leg
  const yZero = 456;   // the dashed zero line, above it
  const yPeak = 404;   // where the uncapped leg exits the frame
  const kink = 610;    // the strike

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
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {/* hairline grid — the terminal ground */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (i + 1) * 100,
                top: 0,
                bottom: 0,
                width: 1,
                background: GRID,
              }}
            />
          ))}
        </div>

        {/* the payoff curve */}
        <svg
          width={1200}
          height={630}
          viewBox="0 0 1200 630"
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <line x1={x0} y1={yZero} x2={x1} y2={yZero} stroke={DIM} strokeWidth={1} strokeDasharray="4 7" />
          <path d={`M ${x0} ${yLoss} L ${kink} ${yLoss}`} stroke={BEAR} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d={`M ${kink} ${yLoss} L ${x1} ${yPeak}`} stroke={BULL} strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={kink} cy={yLoss} r={7} fill={BULL} />
        </svg>

        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: "monospace",
            fontSize: 21,
            letterSpacing: 4,
            color: BULL,
            textTransform: "uppercase",
          }}
        >
          <div style={{ width: 9, height: 9, borderRadius: 9, background: BULL }} />
          paper-only · $0 at risk, ever
        </div>

        {/* the thesis */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 116,
              lineHeight: 1,
              letterSpacing: -4,
              color: FG,
              fontWeight: 600,
            }}
          >
            Options you can&nbsp;<span style={{ color: BULL, fontStyle: "italic" }}>see.</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: DIM, letterSpacing: -0.4 }}>
            27 bots · 13 models · 8 live demos — learn it, backtest it, then paper trade it.
          </div>
        </div>

        {/* footer rule */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "monospace",
            fontSize: 22,
            color: DIM,
            letterSpacing: 2,
            borderTop: `1px solid rgba(245,245,240,0.12)`,
            paddingTop: 22,
          }}
        >
          <div style={{ display: "flex", color: FG, letterSpacing: 1 }}>lazybull.trade</div>
          <div style={{ display: "flex" }}>max loss is a number you chose</div>
        </div>
      </div>
    ),
    size
  );
}

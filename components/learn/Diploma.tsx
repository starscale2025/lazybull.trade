"use client";

// THE PAPER DIPLOMA (/learn redesign L4) — §14's payoff. A certificate styled
// like a trade confirmation, tallying the concepts you called and how many you
// nailed. Your name if you're signed in, else "Trader". Copy the summary to
// the clipboard, or save the card as a PNG you draw yourself. It never posts
// anywhere — on-page artifact only, honest to the brand.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PillButton, Stats } from "@/components/calm/kit";
import { useLearnProgress } from "@/lib/learn-progress";

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

export function Diploma() {
  const { data: session } = useSession();
  const { answeredCount, correctCount, total } = useLearnProgress();
  const [date, setDate] = useState("");
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const name = session?.user?.name || "Trader";
  const cid = `LB-${djb2(`${name}:${answeredCount}:${correctCount}`).toString(16).slice(0, 6).toUpperCase()}`;

  useEffect(() => {
    // client-only date to avoid a hydration mismatch
    setDate(new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }));
  }, []);

  const summary =
    `LAZYBULL — PAPER DIPLOMA · ${name} called ${answeredCount}/${total} concepts on /learn, ` +
    `${correctCount} right on the first try. Conf #${cid}. $0 real risk.`;

  const copy = () => {
    navigator.clipboard?.writeText(summary).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  };

  // Draw the card to a canvas and let the user save it. User-initiated only.
  const savePng = () => {
    const W = 1200;
    const H = 630;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#07070a";
    ctx.fillRect(0, 0, W, H);
    // The brand ink, as on the page (a canvas cannot read the token).
    ctx.strokeStyle = "#8f73ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.fillStyle = "#8f73ff";
    ctx.font = "600 20px ui-monospace, monospace";
    ctx.fillText("LAZYBULL · PAPER DIPLOMA", 60, 90);
    ctx.fillStyle = "#e8e8e0";
    ctx.font = "italic 76px Georgia, 'Times New Roman', serif";
    ctx.fillText(name, 58, 250);
    ctx.fillStyle = "#8a8a82";
    ctx.font = "18px ui-monospace, monospace";
    ctx.fillText(`CALLED ${answeredCount}/${total} CONCEPTS · ${correctCount} RIGHT FIRST TRY`, 60, 320);
    ctx.fillText(`CONF #${cid}   ·   ${date}   ·   $0 REAL RISK`, 60, 352);
    ctx.fillStyle = "#8f73ff";
    ctx.font = "600 26px ui-monospace, monospace";
    // The domain is printed on an artefact people keep and share, so it has
    // to be one that resolves. lazybull.us is the site.
    ctx.fillText("lazybull.us", 60, H - 70);
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lazybull-diploma-${cid}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div ref={cardRef} className="calm-panel mt-16 p-8 sm:p-10">
      <i aria-hidden className="lit-aura" />
      <div className="t-eyebrow text-brand-ink">lazybull · paper diploma</div>
      <div className="mt-5 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.035em] text-fg">
        {name}
      </div>
      <Stats
        className="mt-7"
        items={[
          { value: `${answeredCount}/${total}`, label: "concepts called" },
          { value: correctCount, label: "right first try" },
          { value: "$0", label: "real risk" },
        ]}
      />
      <div className="mt-5 text-[0.8125rem] text-fg-faint">
        Conf #{cid} · {date || "—"}
      </div>

      {/* Both quiet: the page's one primary here is "Open the workbench",
          just above. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PillButton size="sm" onClick={copy}>
          {copied ? "✓ Copied" : "Copy summary"}
        </PillButton>
        <PillButton size="sm" onClick={savePng}>
          Save card ↓
        </PillButton>
        {answeredCount < total && (
          <span className="text-[0.8125rem] text-fg-faint">
            {total - answeredCount} concept{total - answeredCount === 1 ? "" : "s"} left to call
          </span>
        )}
      </div>
    </div>
  );
}

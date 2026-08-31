"use client";

// THE PAPER DIPLOMA (/learn redesign L4) — §14's payoff. A certificate styled
// like a trade confirmation, tallying the concepts you called and how many you
// nailed. Your name if you're signed in, else "Trader". Copy the summary to
// the clipboard, or save the card as a PNG you draw yourself. It never posts
// anywhere — on-page artifact only, honest to the brand.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
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
    ctx.strokeStyle = "#00ff87";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.fillStyle = "#00ff87";
    ctx.font = "600 20px ui-monospace, monospace";
    ctx.fillText("LAZYBULL · PAPER DIPLOMA", 60, 90);
    ctx.fillStyle = "#e8e8e0";
    ctx.font = "italic 76px Georgia, 'Times New Roman', serif";
    ctx.fillText(name, 58, 250);
    ctx.fillStyle = "#8a8a82";
    ctx.font = "18px ui-monospace, monospace";
    ctx.fillText(`CALLED ${answeredCount}/${total} CONCEPTS · ${correctCount} RIGHT FIRST TRY`, 60, 320);
    ctx.fillText(`CONF #${cid}   ·   ${date}   ·   $0 REAL RISK`, 60, 352);
    ctx.fillStyle = "#00ff87";
    ctx.font = "600 26px ui-monospace, monospace";
    ctx.fillText("lazybull.trade", 60, H - 70);
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
    <div className="mt-16">
      <div
        ref={cardRef}
        className="relative overflow-hidden border border-bull/50 bg-bg p-8 sm:p-10"
        style={{ boxShadow: "0 0 60px -20px rgba(0,255,135,0.4)" }}
      >
        <div className="pointer-events-none absolute -right-6 -top-8 select-none font-display italic leading-none text-bull/[0.05]" style={{ fontSize: "16rem" }} aria-hidden>
          ✓
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.3em] text-bull">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" /> lazybull · paper diploma
          </div>
          <div className="mt-6 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-light italic leading-[0.9] tracking-tightest text-fg">
            {name}
          </div>
          <div className="mt-6 grid max-w-[35rem] grid-cols-3 gap-px border border-border bg-border">
            <div className="bg-bg p-4">
              <div className="font-mono text-2xl text-bull">{answeredCount}/{total}</div>
              <div className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.25em] text-fg-faint">concepts called</div>
            </div>
            <div className="bg-bg p-4">
              <div className="font-mono text-2xl text-cyan">{correctCount}</div>
              <div className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.25em] text-fg-faint">right first try</div>
            </div>
            <div className="bg-bg p-4">
              <div className="font-mono text-2xl text-fg">$0</div>
              <div className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.25em] text-fg-faint">real risk</div>
            </div>
          </div>
          <div className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.25em] text-fg-faint">
            conf #{cid} · {date || "—"}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={copy}
              className="h-9 border border-border bg-bg px-4 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull hover:text-bull"
            >
              {copied ? "✓ copied" : "copy summary"}
            </button>
            <button
              onClick={savePng}
              className="h-9 bg-bull px-4 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bull-dim"
            >
              save card ↓
            </button>
            {answeredCount < total && (
              <span className="flex items-center font-mono text-[0.625rem] uppercase tracking-[0.2em] text-fg-faint">
                {total - answeredCount} concept{total - answeredCount === 1 ? "" : "s"} left to call
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

// The market map behind /start: ~100 of the largest US stocks by sector,
// tiles sized by approximate market cap (lib/market/heatmap.ts) and coloured
// by today's move, live from the quote chain (Alpaca in production). When no
// feed answers it shows a simulated day and says so, never passing it off as
// real. The map is scenery behind the page's links, so it is aria-hidden; its
// caption carries the reading in words.

import { useEffect, useMemo, useRef, useState } from "react";
import { squarify } from "@/lib/viz/treemap";
import { MAP_SECTORS, MAP_SYMBOLS, inkOn, moveColor, simulatedMoves } from "@/lib/market/heatmap";

type Feed = { moves: Record<string, number>; state: "live" | "closed" | "sim"; provider?: string; at: number };

const BATCH = 40; // /api/quote-batch takes up to 50
const REFRESH_MS = 60_000;
const today = () => new Date().toISOString().slice(0, 10);

async function loadMoves(): Promise<Feed> {
  const batches: string[][] = [];
  for (let i = 0; i < MAP_SYMBOLS.length; i += BATCH) batches.push(MAP_SYMBOLS.slice(i, i + BATCH));
  const replies = await Promise.all(
    batches.map((b) =>
      fetch(`/api/quote-batch?symbols=${encodeURIComponent(b.join(","))}`)
        .then((r) => r.json())
        .catch(() => null),
    ),
  );
  const moves: Record<string, number> = {};
  let provider: string | undefined;
  let open = false;
  for (const j of replies) {
    if (!j?.ok || !Array.isArray(j.quotes)) continue;
    provider ??= typeof j.source === "string" ? j.source : undefined;
    for (const q of j.quotes) {
      if (q?.sym && Number.isFinite(q.chgPct)) {
        moves[q.sym] = q.chgPct;
        if (q.marketState === "REGULAR") open = true;
      }
    }
  }
  // Under half the map priced is not a market picture: show the labelled sim.
  if (Object.keys(moves).length < MAP_SYMBOLS.length / 2) return { moves: simulatedMoves(today()), state: "sim", at: Date.now() };
  return { moves, state: open ? "live" : "closed", provider, at: Date.now() };
}

const pct = (p: number) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(2)}%`;

export function MarketHeatmap() {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [feed, setFeed] = useState<Feed | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const pull = () => {
      if (document.hidden) return;
      loadMoves().then((f) => alive && setFeed(f));
    };
    pull();
    const id = setInterval(pull, REFRESH_MS);
    document.addEventListener("visibilitychange", pull);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  const layout = useMemo(() => {
    if (!size.w || !size.h) return { sectors: [], tiles: [] };
    const sectors = squarify(
      MAP_SECTORS.map((s) => ({ value: s.stocks.reduce((a, x) => a + x.cap, 0), data: s })),
      { x: 0, y: 0, w: size.w, h: size.h },
    ).map((r) => ({ ...r, header: r.w > 96 && r.h > 72 ? 17 : 0 }));
    const tiles = sectors.flatMap((r) =>
      squarify(
        r.data.stocks.map((x) => ({ value: x.cap, data: x })),
        { x: r.x + 2, y: r.y + 2 + r.header, w: Math.max(0, r.w - 4), h: Math.max(0, r.h - 4 - r.header) },
      ),
    );
    return { sectors, tiles };
  }, [size]);

  const reading = useMemo(() => {
    if (!feed) return null;
    const rows = Object.entries(feed.moves);
    if (!rows.length) return null;
    const up = rows.filter(([, p]) => p > 0).length;
    const down = rows.filter(([, p]) => p < 0).length;
    const best = rows.reduce((a, b) => (b[1] > a[1] ? b : a));
    const worst = rows.reduce((a, b) => (b[1] < a[1] ? b : a));
    return { up, down, best, worst };
  }, [feed]);

  const status =
    feed?.state === "live"
      ? { dot: "bg-bull", text: `Live${feed.provider ? ` · ${feed.provider[0].toUpperCase()}${feed.provider.slice(1)}` : ""}` }
      : feed?.state === "closed"
        ? { dot: "bg-fg-faint", text: "Market closed · last session's moves" }
        : feed?.state === "sim"
          ? { dot: "bg-amber", text: "SIM · simulated, not real quotes" }
          : { dot: "bg-fg-faint animate-pulse", text: "Reading the market…" };

  return (
    <>
      {/* Pinned to the screen under the navbar: the map stays one dense picture
          while the links scroll over it. */}
      <div ref={box} aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 top-[var(--nav-h)] z-0 overflow-hidden bg-[#050505]">
        {layout.sectors.map((s) =>
          s.header ? (
            <div
              key={s.data.name}
              className="absolute truncate font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[#9b9b92]"
              style={{ left: s.x + 5, top: s.y + 3, width: Math.max(0, s.w - 10) }}
            >
              {s.data.name}
            </div>
          ) : null,
        )}
        {layout.tiles.map((t) => {
          const p = feed?.moves[t.data.sym];
          const bg = moveColor(p);
          const w = Math.max(0, t.w - 2);
          const h = Math.max(0, t.h - 2);
          const fs = Math.min(28, w / (t.data.sym.length * 0.7 + 0.6), h * 0.34);
          return (
            <div
              key={t.data.sym}
              className="absolute flex flex-col items-center justify-center overflow-hidden text-center leading-[1.1] motion-safe:transition-colors motion-safe:duration-700"
              style={{ left: t.x + 1, top: t.y + 1, width: w, height: h, background: bg, color: inkOn(bg) }}
            >
              {fs >= 8 && (
                <span className="font-sans font-semibold tracking-[-0.01em]" style={{ fontSize: fs }}>
                  {t.data.sym}
                </span>
              )}
              {fs >= 8 && p != null && h > fs * 2.3 && w > 34 && (
                <span className="font-mono tabular-nums opacity-90" style={{ fontSize: Math.max(8, fs * 0.6) }}>
                  {pct(p)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* A veil, heavier on the left where the heading sits, so the words read
          and the market still shows. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 top-[var(--nav-h)] z-[1] bg-[linear-gradient(90deg,rgba(5,5,5,0.7),rgba(5,5,5,0.42)_55%,rgba(5,5,5,0.3))]"
      />

      {/* The reading, in words: what the map is, whether it is live, and the day in one line. */}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-20 flex justify-end sm:left-[var(--dial-clear)]">
        <p className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[rgba(245,245,240,0.12)] bg-[rgba(5,5,5,0.82)] px-3 py-2 font-mono text-[0.6875rem] text-[#bdbcb3] backdrop-blur-md">
          <span className="flex items-center gap-1.5 text-[#f5f5f0]">
            <span aria-hidden className={`size-1.5 rounded-full ${status.dot}`} />
            {status.text}
          </span>
          <span className="hidden sm:inline">US large caps by sector · tile size ≈ market cap</span>
          {reading && (
            <>
              <span>
                {reading.up} up · {reading.down} down
              </span>
              <span className="hidden md:inline">
                best {reading.best[0]} <span className="text-bull">{pct(reading.best[1])}</span>
              </span>
              <span className="hidden md:inline">
                worst {reading.worst[0]} <span className="text-bear">{pct(reading.worst[1])}</span>
              </span>
            </>
          )}
          <span className="flex items-center gap-1.5" aria-label="Colour: −3% red, 0 grey, +3% green">
            −3%
            <span
              aria-hidden
              className="inline-block h-1.5 w-20 rounded-full"
              style={{ background: `linear-gradient(90deg, ${moveColor(-3)}, ${moveColor(-1)}, ${moveColor(0)}, ${moveColor(1)}, ${moveColor(3)})` }}
            />
            +3%
          </span>
          {feed && (
            <span className="hidden sm:inline">
              updated {new Date(feed.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </p>
      </div>
    </>
  );
}

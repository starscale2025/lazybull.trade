"use client";

// The market floor: the day's map drawn in perspective on one canvas
// (lib/start/floor.ts has the geometry). A canvas, not a tilted element: a
// tilted element is rasterised flat and then resampled, which smears its
// labels, and one wide enough to meet the horizon would be enormous. Here each
// tile is a quad and each label is set after projection, so type stays sharp.
//
// It repaints only when something changes (the feed, the size, the fonts) and
// for the short runs when tiles light up or flash; it holds no frame loop at rest.

import { useEffect, useRef } from "react";
import { subscribeFrame } from "@/lib/ambient-clock";
import { inkOn, moveColor } from "@/lib/market/heatmap";
import type { Feed } from "@/lib/start/feed";
import { floorLayout, labelBox, quadOf, type FloorView } from "@/lib/start/floor";
import { mixOklab } from "@/lib/viz/color";
import css from "./start.module.css";

const LAYOUT = floorLayout();
// Sectors light up from the middle of the front edge outward.
const SECTOR_TURN = new Map(
  [...LAYOUT.sectors]
    .sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - 0.5, a.v0) - Math.hypot((b.x0 + b.x1) / 2 - 0.5, b.v0))
    .map((s, i) => [s.name, i]),
);
/** Before the quotes arrive the floor is darkness, not a grey wireframe. */
const UNLIT = "#0b0d0c";
/** The floor is under glass: its joints are hairlines and its type is quiet. */
const JOINT = "rgba(5,5,5,0.55)";
const SEAM = "rgba(5,5,5,0.85)";
const LABEL_ALPHA = 0.6;
/** Labels only where they can be read. */
const LABEL_MIN_PX = 12;
const LABEL_MAX_PX = 26;
/** The brand's light where the horizon meets the floor. */
const HORIZON_LIGHT = "#00ff87";
const LIGHT_MS = 520;
const STAGGER_MS = 85;
const FLASH_MS = 700;

export function MarketFloor({ view, feed, still }: { view: FloorView | null; feed: Feed | null; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // What the painter reads: kept in a ref so one paint function serves every trigger.
  const now = useRef({ view, feed, still });
  now.current = { view, feed, still };
  const mem = useRef({ litAt: 0, flash: new Map<string, number>(), prev: null as Record<string, number> | null, sans: "sans-serif", mono: "monospace", stop: null as null | (() => void) });
  // Set by the mount effect: paint once, and keep painting while something moves.
  const run = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const m = mem.current;

    const paint = (t: number) => {
      const { view, feed, still } = now.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || !view) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(view.width * dpr);
      const H = Math.round(view.bottom * dpr);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, view.width, view.bottom);

      const moves = feed?.moves ?? null;
      if (moves && !m.litAt) m.litAt = t;
      let busy = false;
      const lit = (sector: string) => {
        if (!moves) return 0;
        if (still) return 1;
        const k = (t - m.litAt - (SECTOR_TURN.get(sector) ?? 0) * STAGGER_MS) / LIGHT_MS;
        if (k < 1) busy = true;
        return k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3);
      };

      // tiles
      ctx.lineJoin = "round";
      for (const tile of LAYOUT.tiles) {
        const [a, b, c, d] = quadOf(tile, view);
        if (Math.max(a.x, b.x, c.x, d.x) < 0 || Math.min(a.x, b.x, c.x, d.x) > view.width) continue;
        const k = lit(tile.sector);
        const p = moves?.[tile.sym];
        const target = moveColor(p);
        const fill = k >= 1 ? target : k <= 0 ? UNLIT : mixOklab(UNLIT, target, k);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        const born = m.flash.get(tile.sym);
        if (born != null) {
          const f = 1 - (t - born) / FLASH_MS;
          if (f > 0 && !still) {
            busy = true;
            ctx.fillStyle = `rgba(255,255,255,${(0.2 * f * f).toFixed(3)})`;
            ctx.fill();
          } else m.flash.delete(tile.sym);
        }
        ctx.strokeStyle = JOINT;
        ctx.lineWidth = 0.75;
        ctx.stroke();

        // the label, painted on the floor: upright glyphs leaning with the tile
        if (k > 0.6) {
          const box = labelBox(tile, view);
          const size = Math.min(LABEL_MAX_PX, box.height * 0.34, box.width / (tile.sym.length * 0.62 + 0.7));
          if (size >= LABEL_MIN_PX && box.x > 8 && box.x < view.width - 8) {
            const lean = Math.max(-0.34, Math.min(0.34, box.lean));
            const move = p != null && size >= 14 && box.height > size * 2.5 ? p : null;
            ctx.save();
            ctx.setTransform(dpr, 0, lean * dpr, dpr, box.x * dpr, box.y * dpr);
            ctx.globalAlpha = LABEL_ALPHA * Math.min(1, (k - 0.6) / 0.4);
            ctx.fillStyle = inkOn(fill);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `600 ${size.toFixed(1)}px ${m.sans}`;
            ctx.fillText(tile.sym, 0, move != null ? -size * 0.3 : 0);
            if (move != null) {
              ctx.globalAlpha *= 0.86;
              ctx.font = `${Math.max(8, size * 0.6).toFixed(1)}px ${m.mono}`;
              ctx.fillText(`${move > 0 ? "+" : move < 0 ? "−" : ""}${Math.abs(move).toFixed(2)}%`, 0, size * 0.56);
            }
            ctx.restore();
          }
        }
      }

      // a slightly firmer seam between sectors
      ctx.strokeStyle = SEAM;
      ctx.lineWidth = 1.5;
      for (const s of LAYOUT.sectors) {
        const [a, b, c, d] = quadOf(s, view);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.stroke();
      }

      // fog: the far rows sink slowly into the ground, and the horizon's light lies on it
      const depth = view.bottom - view.horizon;
      const fog = ctx.createLinearGradient(0, view.horizon, 0, view.horizon + depth * 0.78);
      fog.addColorStop(0, "rgba(5,5,5,0.98)");
      fog.addColorStop(0.32, "rgba(5,5,5,0.78)");
      fog.addColorStop(0.7, "rgba(5,5,5,0.22)");
      fog.addColorStop(1, "rgba(5,5,5,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, view.horizon, view.width, depth * 0.78 + 1);
      const glow = ctx.createLinearGradient(0, view.horizon, 0, view.horizon + 70);
      glow.addColorStop(0, `${HORIZON_LIGHT}30`);
      glow.addColorStop(1, `${HORIZON_LIGHT}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, view.horizon, view.width, 70);
      // and the floor's outer edges fall away
      for (const side of [0, 1]) {
        const x0 = side ? view.width : 0;
        const x1 = side ? view.width * 0.86 : view.width * 0.14;
        const edge = ctx.createLinearGradient(x0, 0, x1, 0);
        edge.addColorStop(0, "rgba(5,5,5,0.85)");
        edge.addColorStop(1, "rgba(5,5,5,0)");
        ctx.fillStyle = edge;
        ctx.fillRect(Math.min(x0, x1), view.horizon, Math.abs(x1 - x0), depth);
      }

      return busy;
    };

    // Paint now; keep painting on the shared clock only while something is still moving.
    run.current = () => {
      if (m.stop) return;
      if (!paint(performance.now())) return;
      m.stop = subscribeFrame((t) => {
        if (!paint(t)) {
          m.stop?.();
          m.stop = null;
        }
      });
    };

    const root = getComputedStyle(document.documentElement);
    m.sans = getComputedStyle(document.body).fontFamily || m.sans;
    m.mono = root.getPropertyValue("--font-jetbrains").trim() ? `${root.getPropertyValue("--font-jetbrains").trim()}, ui-monospace, monospace` : m.mono;
    run.current();
    let alive = true;
    document.fonts?.ready.then(() => alive && run.current());
    return () => {
      alive = false;
      run.current = () => {};
      m.stop?.();
      m.stop = null;
    };
  }, []);

  // A new feed: mark the tiles whose value moved, then repaint.
  useEffect(() => {
    const m = mem.current;
    if (feed) {
      if (m.prev) {
        const t = performance.now();
        for (const [sym, p] of Object.entries(feed.moves)) if (Math.abs((m.prev[sym] ?? p) - p) >= 0.01) m.flash.set(sym, t);
      }
      m.prev = feed.moves;
    }
    run.current();
  }, [feed, view, still]);

  return <canvas ref={ref} aria-hidden className={css.floor} data-start="floor" />;
}

import type { CSSProperties } from "react";
import { pct } from "./MarketCaption";
import css from "./start.module.css";

// The day's biggest movers. On a wide stage they float on two mirrored wings
// above the ring (lib/start/chips.ts places them, worst to best, left to
// right); on a small screen the day's worst and best sit in a row along the
// top. Decoration: the reading below the stage says the same in words. On a
// simulated day every chip carries a SIM tag, so none can be read as a real
// quote.

export type Mover = { sym: string; move: number };
export type Chip = Mover & { x: number; y: number };

const tone = (move: number) => (move >= 0 ? "#00ff87" : "#ff2e63");

function Body({ m, sim, i }: { m: Mover; sim: boolean; i: number }) {
  return (
    <div className={css.chipBody} style={{ "--bob": `${5.4 + (i % 3) * 0.9}s`, animationDelay: `${0.9 + i * 0.07}s, ${-i * 1.3}s` } as CSSProperties}>
      {sim && <span className={css.chipSim}>SIM</span>}
      <span className={css.chipSym}>{m.sym}</span>
      <span className={css.chipMove}>{pct(m.move)}</span>
    </div>
  );
}

/** The wings: each chip centred on its own place. */
export function MoverChips({ chips, sim }: { chips: Chip[]; sim: boolean }) {
  return (
    <>
      {chips.map((c, i) => (
        <div key={c.sym} aria-hidden data-start="chip" data-move={c.move} className={css.chip} style={{ left: c.x, top: c.y, "--tone": tone(c.move) } as CSSProperties}>
          <Body m={c} sim={sim} i={i} />
        </div>
      ))}
    </>
  );
}

/**
 * The small screen's row: the first mover against the left margin, the last
 * against the right. The browser lays it out, so however wide a chip is (a SIM
 * tag, a long ticker) it stays on the screen; if two cannot share a line, the
 * second takes the next.
 */
export function MoverRow({ movers, sim }: { movers: Mover[]; sim: boolean }) {
  if (!movers.length) return null;
  return (
    <div aria-hidden className={css.chipRow} data-start="chip-row">
      {movers.map((m, i) => (
        <div key={m.sym} data-start="chip" data-move={m.move} className={css.chipFlow} style={{ "--tone": tone(m.move) } as CSSProperties}>
          <Body m={m} sim={sim} i={i} />
        </div>
      ))}
    </div>
  );
}

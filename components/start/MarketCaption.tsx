"use client";

// The market map's reading, in words: what the floor is, whether it is live,
// and the day in one line. The floor itself is scenery and hidden from screen
// readers; this is where its meaning is said.

import { moveColor, reading } from "@/lib/market/heatmap";
import { useFeed, type Feed } from "@/lib/start/feed";
import css from "./start.module.css";

export const pct = (p: number) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(2)}%`;

/** Live, closed or simulated, said plainly. A simulated day is never passed off as real. */
export function statusText(feed: Feed | null): string {
  if (!feed) return "Reading the market…";
  if (feed.state === "sim") return "Simulated day · not real quotes";
  if (feed.state === "closed") return "Market closed · last session's moves";
  return `Live${feed.provider ? ` · ${feed.provider[0].toUpperCase()}${feed.provider.slice(1)}` : ""}`;
}

/** The same in a word or two, for the bar on the stage. */
export function statusWord(feed: Feed | null): string {
  if (!feed) return "Reading the market…";
  if (feed.state === "sim") return "Simulated";
  if (feed.state === "closed") return "Market closed";
  return "Live";
}

const KEY = [-3, -1, 0, 1, 3];

export function MarketCaption() {
  const feed = useFeed();
  const r = feed ? reading(feed.moves) : null;
  return (
    <p className={css.reading} data-start="caption">
      <span className={css.readingLead}>
        <span aria-hidden className={css.statusDot} data-state={feed?.state} />
        {statusText(feed)}
      </span>
      <span>The floor is the US large caps by sector; a tile&apos;s size is roughly its market cap.</span>
      {r && (
        <>
          <span>
            {r.up} up · {r.down} down
          </span>
          {r.best[0] && (
            <span>
              Best {r.best[0][0]} <span className={css.up}>{pct(r.best[0][1])}</span>
            </span>
          )}
          {r.worst[0] && (
            <span>
              Worst {r.worst[0][0]} <span className={css.down}>{pct(r.worst[0][1])}</span>
            </span>
          )}
        </>
      )}
      <span className={css.key} aria-label="Colour: a 3% fall is deep red, no change is grey, a 3% rise is deep green">
        <span aria-hidden>−3%</span>
        <span aria-hidden className={css.swatches}>
          {KEY.map((p) => (
            <i key={p} className={css.swatch} style={{ background: moveColor(p) }} />
          ))}
        </span>
        <span aria-hidden>+3%</span>
      </span>
      {feed && <span>Updated {new Date(feed.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
    </p>
  );
}

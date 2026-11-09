import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TickerLamp, feedState, type FeedState } from "@/components/TickerBar";

/**
 * Gate A4 #1: the ticker prints named securities, so its lamp is a claim
 * about the data. "LIVE" only over real quotes; the simulated tape says so
 * in visible words, not just a tooltip or an sr-only span.
 */
const lamp = (state: FeedState) => renderToStaticMarkup(createElement(TickerLamp, { state, stateLabel: "MARKET OPEN" }));
const visible = (html: string) => html.replace(/<span class="sr-only[^"]*">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "");

describe("the ticker lamp", () => {
  it("is never LIVE before the first real quote", () => {
    expect(feedState(false, false)).toBe("connecting");
    expect(lamp("connecting")).not.toMatch(/LIVE/);
    expect(lamp("connecting")).not.toMatch(/bg-bull|pulse-dot/);
    expect(visible(lamp("connecting"))).toMatch(/connecting/);
  });

  it("is never LIVE over the simulated tape, and says SIM in visible text", () => {
    expect(feedState(false, true)).toBe("sim");
    const html = lamp("sim");
    expect(html).not.toMatch(/LIVE/);
    expect(html).not.toMatch(/bg-bull|pulse-dot/);
    expect(visible(html)).toMatch(/^SIM tape · not real quotes/);
  });

  it("says LIVE only over real quotes, even once the grace period has passed", () => {
    expect(feedState(true, false)).toBe("live");
    expect(feedState(true, true)).toBe("live");
    expect(visible(lamp("live"))).toMatch(/^LIVE/);
  });
});

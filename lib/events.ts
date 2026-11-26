// The dated events the builder pins between today and a position's expiry.
//
// Only dates an authority has published are here: the Federal Reserve's
// rate-setting meetings and the Bureau of Labor Statistics' inflation
// releases. This file used to make its dates up: a hash of the ticker's
// letters picked an "earnings" day, an "ex-dividend" day and a "Fed" day, and
// the builder drew them as upcoming events with nothing saying so. A visitor
// who knew when Apple reports saw a date that was simply wrong.
//
// Company earnings and dividend dates are not shown at all until the site has
// a calendar it is licensed to show. No date is ever inferred: past the end of
// the tables below, the builder shows no event rather than a guess.

export type MarketEvent = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  kind: "earnings" | "fed" | "cpi" | "dividend" | "split";
  title: string;
  blurb: string;
  vol: "low" | "medium" | "high";
};

const KIND_TONE: Record<MarketEvent["kind"], string> = {
  earnings: "var(--bear)",
  fed: "var(--amber)",
  cpi: "var(--cyan)",
  dividend: "var(--bull)",
  split: "var(--plasma)",
};
export const eventTone = (k: MarketEvent["kind"]) => KIND_TONE[k];

/**
 * Federal Open Market Committee meetings: the second day of each, when the
 * statement comes out. From the Federal Reserve's calendar,
 * https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm, as last
 * updated on 18 November 2026. The calendar calls every date tentative until
 * the meeting before it confirms it.
 */
const FED_MEETINGS: { date: string; strategy?: true }[] = [
  { date: "2026-12-09" },
  { date: "2027-01-27" },
  { date: "2027-03-17" },
  { date: "2027-04-28" },
  { date: "2027-06-09" },
  { date: "2027-07-28" },
  { date: "2027-09-15" },
  // Listed by the Federal Reserve as a "Monetary Policy Strategy Meeting".
  { date: "2027-10-27", strategy: true },
  { date: "2027-11-17" },
  { date: "2028-01-26" },
];

/**
 * Consumer Price Index releases (08:30 Eastern). From the Bureau of Labor
 * Statistics' schedule, https://www.bls.gov/schedule/news_release/cpi.htm,
 * read on 25 November 2026.
 */
const CPI_RELEASES: string[] = [
  "2026-12-10",
  "2027-01-13",
  "2027-02-11",
  "2027-03-10",
  "2027-04-13",
  "2027-05-12",
  "2027-06-10",
  "2027-07-14",
  "2027-08-11",
  "2027-09-14",
  "2027-10-14",
  "2027-11-10",
  "2027-12-10",
];

/** The last day either table covers. Past it the builder has nothing to pin. */
export const EVENTS_KNOWN_UNTIL = "2027-12-10";

/** A calendar date (yyyy-mm-dd) as the start of that day, UTC. */
const dayMs = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

/**
 * The published events from `from` to `to`, both included, oldest first.
 * They are the same for every stock: nothing here is about one company.
 */
export function scheduledEvents(from: Date, to: Date): MarketEvent[] {
  // Whole days: an event dated today counts, whatever the hour is now.
  const lo = dayMs(from.toISOString().slice(0, 10));
  const hi = to.getTime();
  const within = (date: string) => {
    const t = dayMs(date);
    return t >= lo && t <= hi;
  };
  const out: MarketEvent[] = [];
  for (const m of FED_MEETINGS) {
    if (!within(m.date)) continue;
    out.push({
      id: `fed-${m.date}`,
      date: m.date,
      kind: "fed",
      title: m.strategy ? "Fed strategy meeting" : "Fed rate decision",
      blurb: m.strategy
        ? "The Federal Reserve lists this one as a monetary policy strategy meeting."
        : "The Federal Reserve's statement, then its press conference. Prices can swing in both directions on the day.",
      vol: "high",
    });
  }
  for (const date of CPI_RELEASES) {
    if (!within(date)) continue;
    out.push({
      id: `cpi-${date}`,
      date,
      kind: "cpi",
      title: "US inflation report (CPI)",
      blurb: "The monthly consumer price figures, out at 08:30 Eastern. Interest-rate expectations react first.",
      vol: "medium",
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function nearestEvent(events: MarketEvent[], target: Date): MarketEvent | null {
  if (!events.length) return null;
  let best: MarketEvent | null = null;
  let bestDelta = Infinity;
  const t = target.getTime();
  for (const e of events) {
    const d = Math.abs(new Date(e.date).getTime() - t);
    if (d < bestDelta) {
      bestDelta = d;
      best = e;
    }
  }
  return best;
}

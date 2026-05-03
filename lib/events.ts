// Deterministic event calendar so the timeline always shows the same pins
// for a given symbol/date range. Real product would pull from an actual
// economic calendar API.

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

function hash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function eventsFor(symbol: string, from: Date, to: Date): MarketEvent[] {
  const out: MarketEvent[] = [];
  const seed = hash(symbol);
  const fromMs = from.getTime();
  const toMs = to.getTime();

  // earnings — quarterly cadence offset by symbol seed
  let cursor = new Date(from);
  cursor.setDate(cursor.getDate() + (seed % 80));
  while (cursor.getTime() <= toMs) {
    if (cursor.getTime() >= fromMs) {
      out.push({
        id: `er-${iso(cursor)}`,
        date: iso(cursor),
        kind: "earnings",
        title: `${symbol} earnings`,
        blurb: "Implied vol typically rises into the print and crushes after.",
        vol: "high",
      });
    }
    cursor = addDays(cursor, 91);
  }

  // Fed meetings — 8 per year, fixed-ish dates (months 1,3,5,6,7,9,11,12)
  const fedMonths = [0, 2, 4, 5, 7, 8, 10, 11];
  for (let y = from.getFullYear() - 1; y <= to.getFullYear() + 1; y++) {
    for (const m of fedMonths) {
      const d = new Date(y, m, 18 + (seed % 4)); // mid-month
      if (d.getTime() >= fromMs && d.getTime() <= toMs) {
        out.push({
          id: `fed-${iso(d)}`,
          date: iso(d),
          kind: "fed",
          title: "FOMC decision",
          blurb: "Fed rate decision and presser. Whippy intraday tape — wider stops.",
          vol: "high",
        });
      }
    }
  }

  // CPI — second Tuesday-ish of each month
  for (let y = from.getFullYear() - 1; y <= to.getFullYear() + 1; y++) {
    for (let m = 0; m < 12; m++) {
      const d = new Date(y, m, 12 + (seed % 3));
      if (d.getTime() >= fromMs && d.getTime() <= toMs) {
        out.push({
          id: `cpi-${iso(d)}`,
          date: iso(d),
          kind: "cpi",
          title: "US CPI print",
          blurb: "Inflation reading. Front-end of the curve reacts hardest.",
          vol: "medium",
        });
      }
    }
  }

  // Dividends — quarterly if a "stock-like" symbol
  if (!symbol.startsWith("^") && !symbol.includes("-USD")) {
    let div = new Date(from);
    div.setDate(div.getDate() + (seed % 30));
    while (div.getTime() <= toMs) {
      if (div.getTime() >= fromMs) {
        out.push({
          id: `div-${iso(div)}`,
          date: iso(div),
          kind: "dividend",
          title: `${symbol} ex-dividend`,
          blurb: "Stock drops by ~div amount on ex-date. Calls/puts adjust accordingly.",
          vol: "low",
        });
      }
      div = addDays(div, 91);
    }
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

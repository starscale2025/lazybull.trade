import { useSyncExternalStore } from "react";

/**
 * THE CALENDAR WAITS FOR THE BROWSER (Gate A4 #2, React #418). The chains are
 * rendered on the server, so a date read during render is the server's day
 * (the build's, on a prerendered page), and from the next day, or east of UTC
 * near midnight, the expiry labels and every quote seeded from them disagreed
 * with the HTML. So: the days-out render on the server; the calendar labels
 * and ISO dates arrive after hydration (useToday's server snapshot is null);
 * and the quote noise is keyed to days-out, never to the date, so the numbers
 * do not move when the labels land.
 */

const noSubscribe = () => () => {};
const todayKey = () => new Date().toDateString();

/** Today, as a stable key, in the browser only: null on the server and through hydration. */
export function useToday(): string | null {
  return useSyncExternalStore(noSubscribe, todayKey, () => null);
}

/** An expiry `daysOut` days after `today`, for priceChain: labelled only once there is a today. */
export function expiryOn(today: string | null, daysOut: number) {
  const seed = `d${daysOut}`;
  if (!today) return { iso: seed, label: null, daysToExpiry: daysOut, seed };
  const d = new Date(today);
  d.setHours(12); // noon, so the ISO (UTC) date is the local one, east or west
  d.setDate(d.getDate() + daysOut);
  return {
    iso: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
    daysToExpiry: daysOut,
    seed,
  };
}

// The Pro terminal's clock is India time for every viewer, wherever they sit.

const pad = (n: number) => String(n).padStart(2, "0");

/** `d` as HH:MM:SS in India (UTC+5:30, no daylight saving). The viewer's own
    offset has no part in it: subtracting it, as this once did, set the clock
    5.5 hours fast in India and 5 hours slow in New York, and right only for a
    viewer on UTC. */
export function fmtIST(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
}

// The year heatmap — a pure SVG grid of one cell per day, column = week,
// row = weekday (Monday on top), the last column ending on `endDay`.
// Hand-rolled like the sparkline in components/admin/KpiStrip.tsx (lines 4-26):
// no library, colours as CSS vars, a viewBox so the whole thing scales with
// its container. No transitions — this can be 364 rects.
//
// In the pitch deck's hand (2026-11-17): the waffle of slide 2 — near-square
// cells, the empty ones in the hairline grey, the month names as mono
// capitals — with a solved day lit in the deck's green, the colour of the
// ● solved circle and the Accepted verdict.
//
// DATE-FREE BY DESIGN. Everything is derived from the `endDay` string the
// container passes (parsed as UTC); there is no Date.now() here, so the server
// and the client render the same grid and nothing hydrates differently.

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Month names: mono capitals in viewBox units, and the width three of them
    take (~0.6em a glyph plus the 0.1em tracking). */
const LABEL_SIZE = 9;
const LABEL_W = 3 * 0.7 * LABEL_SIZE;

/** `yyyy-mm-dd` → UTC midnight epoch ms. */
function parseDay(day: string): number {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmtDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  return fmtDay(parseDay(day) + n * DAY_MS);
}

/** Monday = 0 … Sunday = 6. */
function weekday(day: string): number {
  return (new Date(parseDay(day)).getUTCDay() + 6) % 7;
}

/** The hairline grey for a blank day, then the deck's green at four
    strengths: one, two, three, four or more problems first solved. */
function fillFor(n: number): string {
  if (n <= 0) return "var(--border)";
  if (n === 1) return "color-mix(in srgb, var(--bull) 30%, transparent)";
  if (n === 2) return "color-mix(in srgb, var(--bull) 52%, transparent)";
  if (n === 3) return "color-mix(in srgb, var(--bull) 76%, transparent)";
  return "var(--bull)";
}

export type HeatmapProps = {
  /** yyyy-mm-dd → solves that day. Missing days are zero. */
  activity: Record<string, number>;
  /** yyyy-mm-dd; the last day of the last column. */
  endDay: string;
  weeks?: number;
  /** Cell size in viewBox units (px at 1:1). Cells sit on a 2-unit gutter. */
  cell?: number;
  showMonths?: boolean;
  className?: string;
};

export function Heatmap({ activity, endDay, weeks = 52, cell = 10, showMonths = false, className = "" }: HeatmapProps) {
  const step = cell + 2;
  const top = showMonths ? 14 : 0;
  // Walk back from endDay to its Monday, then (weeks - 1) whole weeks.
  const firstDay = addDays(endDay, -(weekday(endDay) + (weeks - 1) * 7));

  const cells: { day: string; n: number; x: number; y: number }[] = [];
  const labels: { x: number; text: string }[] = [];
  let activeDays = 0;
  let solves = 0;

  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const day = addDays(firstDay, w * 7 + r);
      // yyyy-mm-dd compares correctly as a string; days after endDay are the future.
      if (day > endDay) break;
      const n = activity[day] ?? 0;
      if (n > 0) {
        activeDays += 1;
        solves += n;
      }
      if (showMonths && r === 0) {
        // A column whose Monday falls in the first week of a month names it —
        // unless the name would run past the last column, where the svg's
        // viewport would clip it mid-letter.
        const d = new Date(parseDay(day));
        if (d.getUTCDate() <= 7 && w * step + LABEL_W <= weeks * step) labels.push({ x: w * step, text: MONTHS[d.getUTCMonth()] ?? "" });
      }
      cells.push({ day, n, x: w * step, y: top + r * step });
    }
  }

  const summary = `${activeDays} active day${activeDays === 1 ? "" : "s"} in the last ${weeks} weeks · ${solves} solved`;

  return (
    <div role="img" aria-label={summary} className={className}>
      <svg
        viewBox={`0 0 ${weeks * step} ${top + 7 * step}`}
        preserveAspectRatio="xMinYMin meet"
        className="block w-full"
        aria-hidden
      >
        {labels.map((l) => (
          <text key={l.x} x={l.x} y={9} fontSize={LABEL_SIZE} letterSpacing="0.1em" fill="var(--fg-faint)" className="font-mono">
            {l.text.toUpperCase()}
          </text>
        ))}
        {cells.map((c) => (
          <rect key={c.day} x={c.x} y={c.y} width={cell} height={cell} rx={1.5} fill={fillFor(c.n)}>
            <title>{`${c.day} · ${c.n} solved`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

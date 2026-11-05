// One month of the streak, as a 7-column grid: weekday initials on top,
// Monday first, a cell per day. Active days are lit bull, today is ringed.
//
// DATE-FREE BY DESIGN. The month is whichever contains the `today` string the
// container passes (parsed as UTC); nothing here calls Date.now(), so server
// and client agree on the grid.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");

export type StreakCalendarProps = {
  /** yyyy-mm-dd → solves that day. Missing days are zero. */
  activity: Record<string, number>;
  /** yyyy-mm-dd. Picks the month and rings the cell. */
  today: string;
  /** Overrides the "September 2026" caption. */
  monthLabel?: string;
  className?: string;
};

export function StreakCalendar({ activity, today, monthLabel, className = "" }: StreakCalendarProps) {
  const [y = 0, m = 1] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Leading blanks so the 1st lands under its weekday, Monday = 0.
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const label = monthLabel ?? `${MONTHS[m - 1] ?? ""} ${y}`;

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = `${y}-${pad(m)}-${pad(i + 1)}`;
    return { day, num: i + 1, n: activity[day] ?? 0, isToday: day === today };
  });
  const activeDays = days.filter((d) => d.n > 0).length;

  return (
    <div
      role="img"
      aria-label={`${label}: ${activeDays} active day${activeDays === 1 ? "" : "s"}`}
      className={className}
    >
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="grid size-7 place-items-center t-chrome text-fg-faint">
            {w}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden className="size-7" />
        ))}
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day} · ${d.n} solved`}
            className={`grid size-7 place-items-center font-mono text-[0.625rem] ${
              d.n > 0 ? "bg-bull/15 text-bull" : "text-fg-faint"
            } ${d.isToday ? "border border-bull" : ""}`}
          >
            {d.num}
          </div>
        ))}
      </div>
      <div className="mt-2 t-chrome text-fg-faint">{label}</div>
    </div>
  );
}

"use client";

/**
 * Number physics (M4, 2026-11-09): a figure that changes rolls each digit to
 * its new value like an odometer instead of snapping, so a moving number reads
 * as one quantity changing rather than a string being swapped.
 *
 * Every digit is a column of 0–9 shifted by CSS; nothing is measured, so it
 * holds through server render and hydration, and it inherits the font, size
 * and colour it is set in (tabular figures are forced so columns line up).
 * Columns are keyed from the right, so when a number gains a digit the units
 * stay put and the new digit enters on the left.
 *
 * Screen readers read the whole value once, from a visually hidden copy; the
 * columns are hidden from them. Reduced motion and the site's pause stop the roll
 * (globals.css, ROLLING NUMBERS).
 */
export function RollingNumber({ value, className = "" }: { value: string; className?: string }) {
  const chars = Array.from(value);
  return (
    <span className={`roll ${className}`}>
      <span className="sr-only">{value}</span>
      {chars.map((c, i) => {
        const key = chars.length - i;
        if (c >= "0" && c <= "9") {
          return (
            <span key={key} className="roll-col" aria-hidden>
              <span className="roll-strip" style={{ transform: `translateY(${-Number(c) * 10}%)` }}>
                0<br />1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9
              </span>
              <span className="roll-ghost">0</span>
            </span>
          );
        }
        return (
          <span key={key} aria-hidden>
            {c}
          </span>
        );
      })}
    </span>
  );
}

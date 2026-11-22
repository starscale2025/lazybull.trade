import { useId } from "react";
import css from "./start.module.css";

// The ring of words: a faint arc of type over the wordmark. It is a circle
// centred a little below the horizon, so only its top shows, and that top is
// faded at both ends long before it could reach a letter (start.module.css,
// .ringClip). Set in the display face, light and in sentence case, it reads as
// light on something turning, not as a dial. It turns on a CSS animation
// alone, against the pods.

const PHRASE = "lazybull · options you can see · learn it · practice it · build it · chart it · ";
// SVG drops a trailing space, which would close the circle as "chart it ·lazybull": end on a no-break space
const TEXT = PHRASE.repeat(4).trimEnd() + "\u00a0";
const R = 470;
const LENGTH = Math.round(2 * Math.PI * R);

export function TextRing() {
  const id = useId();
  return (
    <div aria-hidden className={css.ringClip} data-start="arc">
      <div className={css.ringBox}>
        <svg className={css.ring} viewBox="0 0 1000 1000">
          <defs>
            {/* from the top, clockwise, so the words read left to right over the top */}
            <path id={id} d={`M 500,${500 - R} a ${R},${R} 0 1,1 0,${2 * R} a ${R},${R} 0 1,1 0,${-2 * R}`} />
          </defs>
          <text className={css.ringText} textLength={LENGTH} lengthAdjust="spacing">
            <textPath href={`#${id}`} textLength={LENGTH} lengthAdjust="spacing">
              {TEXT}
            </textPath>
          </text>
        </svg>
      </div>
    </div>
  );
}

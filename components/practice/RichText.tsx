// Inline prose for /practice statements, constraints and hints. A string with
// `backtick` spans becomes text with <code> chips — the chip is the inline
// code pattern from app/learn/bots/[id]/page.tsx. Problem content is authored
// as plain strings (see ProblemContent.statement in lib/practice/types.ts),
// so this is the one place the backtick convention is interpreted.
//
// PURE — no hooks, no directive. Renders from server pages and client
// workspaces alike.

import { Fragment } from "react";

const CODE_CLS = "rounded-[4px] bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-1 font-mono text-[0.6875rem] text-fg";

type Segment = { code: boolean; text: string };

/** Split on backticks into alternating plain/code runs. A trailing unmatched
    backtick never opened a span, so it — and everything after it — stays
    literal text rather than swallowing the rest of the line into a chip. */
function segments(text: string): Segment[] {
  const parts = text.split("`");
  // n backticks give n + 1 parts; an even n (balanced) gives an odd count.
  const balanced = parts.length % 2 === 1;
  const out: Segment[] = [];
  parts.forEach((part, i) => {
    const code = i % 2 === 1;
    if (code && !balanced && i === parts.length - 1) {
      out.push({ code: false, text: `\`${part}` });
      return;
    }
    if (part === "") return;
    out.push({ code, text: part });
  });
  return out;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const body = segments(text).map((s, i) =>
    s.code ? (
      <code key={i} className={CODE_CLS}>
        {s.text}
      </code>
    ) : (
      <Fragment key={i}>{s.text}</Fragment>
    )
  );
  return className ? <span className={className}>{body}</span> : <>{body}</>;
}

/** A run of statement paragraphs. `className` lands on the wrapper, so a
    caller sets the reading role once — `t-body-sm text-fg-dim` — and the
    <p>s inherit it. Paragraph rhythm is `space-y-3`. */
export function Paragraphs({ paragraphs, className = "" }: { paragraphs: string[]; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i}>
          <RichText text={p} />
        </p>
      ))}
    </div>
  );
}
